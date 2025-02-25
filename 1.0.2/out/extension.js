"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fuzzy_search_1 = __importDefault(require("fuzzy-search"));
const debounce_1 = __importDefault(require("debounce"));
const HISTORY_FILE = 'history.json';
const MAX_HISTORY_ENTRIES = 50;
function activate(context) {
    const historyPath = path.join(context.globalStorageUri.fsPath, HISTORY_FILE);
    let history = loadHistory(historyPath);
    const updateHistory = (0, debounce_1.default)(() => {
        saveHistory(historyPath, history);
    }, 500);
    const addPathToHistory = (pathToAdd) => {
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
        }
        else {
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
    const suggestPaths = (input) => {
        if (!input) {
            return [];
        }
        const searcher = new fuzzy_search_1.default(history, ['path'], {
            caseSensitive: false,
            sort: true,
        });
        const results = searcher.search(input);
        return results.map((entry) => {
            const item = new vscode.CompletionItem(entry.path, vscode.CompletionItemKind.Folder);
            item.detail = `Rank: ${entry.rank}`;
            return item;
        });
    };
    const debouncedSuggestPaths = (0, debounce_1.default)(suggestPaths, 150);
    let jumpCommandDisposable = vscode.commands.registerCommand('zoxide-like.jump', async () => {
        const options = {
            placeHolder: 'Jump to directory or type a path...',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        };
        const items = history.map(entry => ({
            label: entry.path,
            detail: `Rank: ${entry.rank}`,
        }));
        const enterPathItem = { label: 'Enter Path', description: 'Manually enter a directory path' };
        items.push(enterPathItem);
        const pickedItem = await vscode.window.showQuickPick(items, options);
        let targetPath;
        if (pickedItem === enterPathItem) {
            targetPath = await vscode.window.showInputBox({
                prompt: "Enter a directory path:",
                placeHolder: "/path/to/directory",
                ignoreFocusOut: true,
            });
            if (!targetPath) {
                return;
            }
        }
        else if (pickedItem) {
            targetPath = pickedItem.label;
        }
        else {
            targetPath = await vscode.window.showInputBox({
                prompt: "Enter a directory path:",
                placeHolder: "/path/to/directory",
                ignoreFocusOut: true,
            });
            if (!targetPath)
                return; // User cancelled
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
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Could not open folder: ${message}`);
                // Remove from history if openFolder fails (path likely invalid)
                history = history.filter(entry => entry.path !== targetPath);
                updateHistory(); // Save the updated history
            }
        }
    });
    const completionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
        provideCompletionItems(document, position) {
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
exports.activate = activate;
function loadHistory(historyPath) {
    try {
        const data = fs.readFileSync(historyPath, 'utf8');
        const history = JSON.parse(data);
        return history.map(entry => ({ ...entry, lastAccessed: entry.lastAccessed || Date.now() }));
    }
    catch (err) {
        return [];
    }
}
function saveHistory(historyPath, history) {
    try {
        const historyDir = path.dirname(historyPath);
        fs.mkdirSync(historyDir, { recursive: true });
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    }
    catch (err) {
        console.error("Error saving history:", err);
        let errorMessage = "Failed to save history.";
        if (err instanceof Error) {
            errorMessage += ` ${err.message}`;
        }
        vscode.window.showErrorMessage(`Error saving history: ${errorMessage}`);
    }
}
function deactivate() { }
exports.deactivate = deactivate;
