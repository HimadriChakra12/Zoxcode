import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import FuzzySearch from 'fuzzy-search';
import debounce from 'debounce';

interface ZoxideEntry {
    path: string;
    rank: number;
    lastAccessed: number;
}

const HISTORY_FILE = 'history.json';
const MAX_HISTORY_ENTRIES = 50;

export function activate(context: vscode.ExtensionContext) {
    const historyPath = path.join(context.globalStorageUri.fsPath, HISTORY_FILE);
    let history: ZoxideEntry[] = loadHistory(historyPath);

    const updateHistory = debounce(() => {
        saveHistory(historyPath, history);
    }, 500);

    const addPathToHistory = (pathToAdd: string) => {
        const resolvedPath = path.resolve(pathToAdd);

        if (!fs.existsSync(resolvedPath)) {
            vscode.window.showErrorMessage(`Directory not found: ${resolvedPath}`);
            return;
        }

        const existingEntryIndex = history.findIndex(entry => entry.path === resolvedPath);

        if (existingEntryIndex > -1) {
            const existingEntry = history.splice(existingEntryIndex, 1)[0];
            existingEntry.rank++;
            existingEntry.lastAccessed = Date.now();
            history.unshift(existingEntry);
        } else {
            history.unshift({ path: resolvedPath, rank: 1, lastAccessed: Date.now() });
            if (history.length > MAX_HISTORY_ENTRIES) {
                history.pop();
            }
        }

        history.sort((a, b) => {
            if (b.rank !== a.rank) {
                return b.rank - a.rank;
            }
            return b.lastAccessed - a.lastAccessed;
        });
        updateHistory();
    };

    const suggestPaths = (input: string): vscode.CompletionItem[] => {
        if (!input) {
            return [];
        }

        const searcher = new FuzzySearch(history, ['path'], {
            caseSensitive: false,
            sort: true,
        });

        const results = searcher.search(input);

        return results.map((entry: ZoxideEntry) => {
            const item = new vscode.CompletionItem(entry.path, vscode.CompletionItemKind.Folder);
            item.detail = `Rank: ${entry.rank}`;
            return item;
        });
    };

    const debouncedSuggestPaths = debounce(suggestPaths, 150);

    let jumpCommandDisposable = vscode.commands.registerCommand('zoxide-like.jump', async () => {
        const options: vscode.QuickPickOptions = {
            placeHolder: 'Jump to directory or type a path...',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        };

        const items: vscode.QuickPickItem[] = history.map(entry => ({
            label: entry.path,
            detail: `Rank: ${entry.rank}`,
        }));

        const enterPathItem = { label: 'Enter Path', description: 'Manually enter a directory path' };
        items.push(enterPathItem);

        const pickedItem = await vscode.window.showQuickPick(items, options);

        let targetPath: string | undefined;

        if (pickedItem === enterPathItem) {
            targetPath = await vscode.window.showInputBox({
                prompt: "Enter a directory path:",
                placeHolder: "/path/to/directory",
                ignoreFocusOut: true,
            });

            if (!targetPath) {
                return;
            }
        } else if (pickedItem) {
            targetPath = pickedItem.label;
        } else {
            targetPath = await vscode.window.showInputBox({
                prompt: "Enter a directory path:",
                placeHolder: "/path/to/directory",
                ignoreFocusOut: true,
            });
            if (!targetPath) return; // User cancelled
        }

        if (targetPath) {
            // Check if path exists *before* adding to history
            if (!fs.existsSync(targetPath)) {
                vscode.window.showErrorMessage(`Directory not found: ${targetPath}`);
                return;
            }

            addPathToHistory(targetPath);
            try {
                await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Could not open folder: ${message}`);
                // Remove from history if openFolder fails (path likely invalid)
                history = history.filter(entry => entry.path !== targetPath);
                updateHistory(); // Save the updated history
            }
        }
    });

    const completionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const currentLine = document.lineAt(position).text;
            const input = currentLine.substring(0, position.character);
            return debouncedSuggestPaths(input);
        }
    });

    context.subscriptions.push(jumpCommandDisposable, completionProvider);

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('zoxide-like.maxHistoryEntries')) {
            console.log("Configuration changed for zoxide-like.maxHistoryEntries");
        }
    });
}

function loadHistory(historyPath: string): ZoxideEntry[] {
    try {
        const data = fs.readFileSync(historyPath, 'utf8');
        const history = JSON.parse(data) as ZoxideEntry[];
        return history.map(entry => ({ ...entry, lastAccessed: entry.lastAccessed || Date.now() }));
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
        let errorMessage = "Failed to save history.";
        if (err instanceof Error) {
            errorMessage += ` ${err.message}`;
        }
        vscode.window.showErrorMessage(`Error saving history: ${errorMessage}`);
    }
}

export function deactivate() { }