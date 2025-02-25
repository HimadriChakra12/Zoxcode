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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Configuration
const SECTION = 'zoxide-like';
const HISTORY_FILE = 'history.json';
function activate(context) {
    let historyPath = path.join(context.globalStorageUri.fsPath, HISTORY_FILE);
    let history = loadHistory(historyPath);
    const updateHistory = () => {
        saveHistory(historyPath, history);
    };
    const addPathToHistory = (path) => {
        const existingEntry = history.find(entry => entry.path === path);
        if (existingEntry) {
            existingEntry.rank++; // Simple ranking (can be improved)
        }
        else {
            history.push({ path, rank: 1 });
        }
        history.sort((a, b) => b.rank - a.rank); // Sort by rank (descending)
        updateHistory();
    };
    const suggestPaths = (input) => {
        const suggestions = history
            .filter(entry => entry.path.toLowerCase().includes(input.toLowerCase()))
            .map(entry => {
            const item = new vscode.CompletionItem(entry.path, vscode.CompletionItemKind.Folder);
            item.detail = `Rank: ${entry.rank}`; // Show rank in suggestion detail
            return item;
        });
        return suggestions;
    };
    let disposable = vscode.commands.registerCommand('zoxide-like.jump', async () => {
        const currentFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath; // Get current workspace folder
        if (!currentFolder) {
            vscode.window.showInformationMessage('No workspace folder open.');
            return;
        }
        addPathToHistory(currentFolder); // Add current folder to history
        const pickedPath = await vscode.window.showQuickPick(history.map(entry => ({
            label: entry.path,
            detail: `Rank: ${entry.rank}`,
        })), {
            placeHolder: 'Jump to directory...',
        });
        if (pickedPath) {
            try {
                await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(pickedPath.label));
                addPathToHistory(pickedPath.label); // Add jumped to path to history
            }
            catch (err) {
                vscode.window.showErrorMessage(`Could not open folder: ${err}`);
            }
        }
    });
    // Completion provider for path suggestions
    const completionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
        provideCompletionItems(document, position) {
            const currentLine = document.lineAt(position).text;
            const input = currentLine.substring(0, position.character);
            // Trigger completion only after typing a character (you can customize this)
            if (input.length > 0) {
                return suggestPaths(input);
            }
            return [];
        }
    });
    context.subscriptions.push(disposable, completionProvider);
}
exports.activate = activate;
function loadHistory(historyPath) {
    try {
        const data = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(data);
    }
    catch (err) {
        return []; // Return empty array if file doesn't exist or is invalid
    }
}
function saveHistory(historyPath, history) {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}
function deactivate() { }
exports.deactivate = deactivate;
