import * as vscode from 'vscode';
import * as child_process from 'child_process';

/**
 * Сервис для работы с Git.
 */
export class GitService {
    /**
     * Получает имя текущей ветки Git.
     * @returns {Promise<string | null>} Имя ветки или null, если не удалось определить.
     */
    async getCurrentBranch(): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        return new Promise((resolve, reject) => {
            child_process.exec('git branch --show-current', { cwd: rootPath }, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage('Не удалось получить текущую ветку Git.');
                    resolve(null);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Извлекает номер задачи Jira из имени ветки.
     * @param {string} branchName Имя ветки.
     * @returns {string | null} Номер задачи Jira or None, если не найден.
     */
    extractJiraTaskId(branchName: string): string {
        const match = branchName.match(/[A-Z]+_\d+/);
        return match ? match[0].replace(/_/g, "-") : "None";
    }
}