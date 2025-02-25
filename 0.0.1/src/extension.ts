import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ZoxideEntry {
  path: string;
  rank: number;
}

// Configuration
const SECTION = 'zoxide-like';
const HISTORY_FILE = 'history.json';

export function activate(context: vscode.ExtensionContext) {
  let historyPath = path.join(context.globalStorageUri.fsPath, HISTORY_FILE);
  let history: ZoxideEntry[] = loadHistory(historyPath);

  const updateHistory = () => {
    saveHistory(historyPath, history);
  };

  const addPathToHistory = (path: string) => {
    const existingEntry = history.find(entry => entry.path === path);
    if (existingEntry) {
      existingEntry.rank++; // Simple ranking (can be improved)
    } else {
      history.push({ path, rank: 1 });
    }
    history.sort((a, b) => b.rank - a.rank); // Sort by rank (descending)
    updateHistory();
  };

  const suggestPaths = (input: string): vscode.CompletionItem[] => {
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

    const pickedPath = await vscode.window.showQuickPick(
      history.map(entry => ({
        label: entry.path,
        detail: `Rank: ${entry.rank}`,
      })),
      {
        placeHolder: 'Jump to directory...',
      }
    );

    if (pickedPath) {
      try {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(pickedPath.label));
        addPathToHistory(pickedPath.label); // Add jumped to path to history
      } catch (err) {
        vscode.window.showErrorMessage(`Could not open folder: ${err}`);
      }
    }
  });

    // Completion provider for path suggestions
  const completionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
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

function loadHistory(historyPath: string): ZoxideEntry[] {
  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return []; // Return empty array if file doesn't exist or is invalid
  }
}

function saveHistory(historyPath: string, history: ZoxideEntry[]): void {
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export function deactivate() {}
