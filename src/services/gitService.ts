import * as vscode from 'vscode';
import * as child_process from 'child_process';

/**
 * Service for working with Git.
 */
export class GitService {
    /**
     * Gets the name of the current Git branch.
     * @returns {Promise<string | null>} The branch name or null if it could not be determined.
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
                    vscode.window.showErrorMessage('Failed to get the current Git branch.');
                    resolve(null);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Extracts the Jira task number from the branch name.
     * @param {string} branchName The name of the branch.
     * @returns {string | null} The Jira task number or null if not found.
     */
    extractJiraTaskId(branchName: string): string {
        const match = branchName.match(/[A-Z]+_\d+/);
        return match ? match[0].replace(/_/g, "-") : "None";
    }
}