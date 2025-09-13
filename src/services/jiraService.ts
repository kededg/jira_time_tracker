import fetch from 'node-fetch';
import * as vscode from 'vscode';

/**
 * Service for working with Jira.
 */
export class JiraService {
    private baseUrl: string;
    private oauthToken: string;
    private outputChannel: vscode.OutputChannel;

    constructor(baseUrl: string, oauthToken: string, outputChannel: vscode.OutputChannel) {
        this.baseUrl = baseUrl;
        this.oauthToken = oauthToken;
        this.outputChannel = outputChannel;
    }

    /**
     * Checks the validity of a Personal Access Token.
     * @returns {Promise<boolean>} True if the token is valid, otherwise False.
     */
    async validateToken(): Promise<boolean> {
        try {
            const url = `${this.baseUrl}/rest/api/2/myself`;
            this.outputChannel.appendLine(`[validateToken]\tExecuting request to: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.oauthToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.outputChannel.appendLine(`[validateToken]\tError checking token: ${response.statusText}`);
                this.outputChannel.appendLine(`[validateToken]\tError details: ${errorText}`);
                return false;
            }

            this.outputChannel.appendLine(`[validateToken]\tToken validation successful: ${response.statusText}`);

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[validateToken]\tError checking token: ${error.message}`);
            } else {
                this.outputChannel.appendLine(`[validateToken]\tError checking token: ${String(error)}`);
            }
            return false;
        }
    }

    /**
     * Logs time to a Jira task.
     * @param {string} taskId Jira task ID.
     * @param {number} timeSpent Time in minutes.
     * @returns {Promise<boolean>} Whether logging was successful.
     */
    async logTime(taskId: string, timeSpent: number, msg: string = ""): Promise<boolean> {
        const url = `${this.baseUrl}/rest/api/2/issue/${taskId}/worklog`;

        if (msg == "") {
            msg = "Work on Issue";
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.oauthToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timeSpentSeconds: timeSpent * 60,
                    comment: `VSCode TimeTracker: ${msg}`
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.outputChannel.appendLine(`[logTime]\tError logging time: ${response.statusText}`);
                this.outputChannel.appendLine(`[logTime]\tError details: ${errorText}`);
                return false;
            }

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[logTime]\tError logging time to Jira: ${error.message} URL: ${url} Task: ${taskId} Time: ${timeSpent} Msg: ${msg}`);
            } else {
                this.outputChannel.appendLine(`[logTime]\tError logging time to Jira: ${String(error)} URL: ${url} Task: ${taskId} Time: ${timeSpent} Msg: ${msg}`);
            }
            return false;
        }
    }

    public async logTimeForTask(task: string, time: number, msg: string = ""): Promise<boolean> {
        const success = await this.logTime(task, time, msg);
        if (success) {
            this.outputChannel.appendLine(`[logTimeForTask]\tTime successfully logged to task ${task}.`);
            await vscode.window.showInformationMessage(
                `Time successfully logged to task ${task}. ${time}min`);
        } else {
            this.outputChannel.appendLine(`[logTimeForTask]\tFailed to log time to task ${task}.`);
        }
        return success;
    }
}