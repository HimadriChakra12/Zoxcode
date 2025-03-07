import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ZoxideEntry {
    path: string;
    rank: number;
}

const HISTORY_FILE = 'history.json';

export function activate(context: vscode.ExtensionContext) {
    const historyPath = path.join(context.globalStorageUri.fsPath, HISTORY_FILE);
    let history: ZoxideEntry[] = loadHistory(historyPath);

    const updateHistory = () => {
        saveHistory(historyPath, history);
    };

    const addPathToHistory = (path: string) => {
        const existingEntry = history.find(entry => entry.path === path);
        if (existingEntry) {
            existingEntry.rank++;
        } else {
            history.push({ path, rank: 1 });
        }
        history.sort((a, b) => b.rank - a.rank);
        updateHistory();
    };

    const suggestPaths = (input: string): vscode.CompletionItem[] => {
        return history
            .filter(entry => entry.path.toLowerCase().includes(input.toLowerCase()))
            .map(entry => {
                const item = new vscode.CompletionItem(entry.path, vscode.CompletionItemKind.Folder);
                item.detail = `Rank: ${entry.rank}`;
                return item;
            });
    };

    let disposable = vscode.commands.registerCommand('zoxide-like.jump', async () => {
        const currentFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const options: vscode.QuickPickOptions = {
            placeHolder: 'Jump to directory or type a path...',
            ignoreFocusOut: true,
        };

        const items: vscode.QuickPickItem[] = history.map(entry => ({
            label: entry.path,
            detail: `Rank: ${entry.rank}`,
        }));

        const enterPathItem = { label: 'Enter Path', description: 'Manually enter a directory path' };
        items.push(enterPathItem);

        const pickedItem = await vscode.window.showQuickPick(items, options);

        if (pickedItem) {
            let targetPath: string;

            if (pickedItem === enterPathItem) {
                const inputPath = await vscode.window.showInputBox({
                    prompt: "Enter a directory path:",
                    placeHolder: "/path/to/directory",
                    ignoreFocusOut: true,
                });

                if (!inputPath) return;

                targetPath = path.resolve(inputPath);
                addPathToHistory(targetPath);

            } else {
                targetPath = pickedItem.label;
                if (!history.find(entry => entry.path === targetPath)) {
                    addPathToHistory(targetPath);
                }
            }

            if (!fs.existsSync(targetPath)) {
                vscode.window.showErrorMessage(`Directory not found: ${targetPath}`);
                return;
            }

            try {
                await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
            } catch (err) {
                vscode.window.showErrorMessage(`Could not open folder: ${err}`);
            }
        } else {
            const inputPath = await vscode.window.showInputBox({
                prompt: "Enter a directory path:",
                placeHolder: "/path/to/directory",
                ignoreFocusOut: true,
            });

            if (!inputPath) return;

            const targetPath = path.resolve(inputPath);
            if (!fs.existsSync(targetPath)) {
                vscode.window.showErrorMessage(`Directory not found: ${targetPath}`);
                return;
            }

            addPathToHistory(targetPath);
            try {
                await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
            } catch (err) {
                vscode.window.showErrorMessage(`Could not open folder: ${err}`);
            }
        }
    });

    const completionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const currentLine = document.lineAt(position).text;
            const input = currentLine.substring(0, position.character);
            if (input.length > 0) {
                return suggestPaths(input);
            }
            return [];
        }
    });

    context.subscriptions.push(disposable, completionProvider);
}

function loadHistory(historyPath: string): ZoxideEntry[] {
    try {
        const data = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveHistory(historyPath: string, history: ZoxideEntry[]): void {
    try {
        const historyDir = path.dirname(historyPath);
        fs.mkdirSync(historyDir, { recursive: true });
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    } catch (err) {
        console.error("Error saving history:", err);

        let errorMessage = "An unknown error occurred while saving history.";

        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'object' && err !== null && 'message' in err) {
            errorMessage = String(err.message);
        }

        vscode.window.showErrorMessage(`Error saving history: ${errorMessage}`);
    }
}

export function deactivate() { }