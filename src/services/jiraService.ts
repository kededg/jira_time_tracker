import fetch from 'node-fetch';
import * as vscode from 'vscode';

/**
 * Сервис для работы с Jira.
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
     * Проверяет валидность Personal Access Token.
     * @returns {Promise<boolean>} True, если токен действителен, иначе False.
     */
    async validateToken(): Promise<boolean> {
        try {
            const url = `${this.baseUrl}/rest/api/2/myself`;
            this.outputChannel.appendLine(`[Time Tracker] Выполнение запроса к: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                // headers: {'Authorization': 'Basic ' + btoa(this.email + ':' + this.oauthToken)},
                headers: {
                    'Authorization': `Bearer ${this.oauthToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.outputChannel.appendLine(`[Time Tracker] Ошибка при проверке токена: ${response.statusText}`);
                this.outputChannel.appendLine(`[Time Tracker] Детали ошибки: ${errorText}`);
                return false;
            }

            this.outputChannel.appendLine(`[Time Tracker] Успех при проверке токена: ${response.statusText}`);

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[Time Tracker] Ошибка при проверке токена: ${error.message}`);
            } else {
                this.outputChannel.appendLine(`[Time Tracker] Ошибка при проверке токена: ${String(error)}`);
            }
            return false;
        }
    }

    /**
     * Логирует время в задачу Jira.
     * @param {string} taskId Номер задачи Jira.
     * @param {number} timeSpent Время в секундах.
     * @returns {Promise<boolean>} Успешно ли выполнено логирование.
     */
    async logTime(taskId: string, timeSpent: number): Promise<boolean> {
        const url = `${this.baseUrl}/rest/api/2/issue/${taskId}/worklog`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.oauthToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timeSpentSeconds: timeSpent,
                    comment: `VSCode TimeTracker in issue ${taskId}`
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.outputChannel.appendLine(`[Time Tracker] Ошибка при логировании времени: ${response.statusText}`);
                this.outputChannel.appendLine(`[Time Tracker] Детали ошибки: ${errorText}`);
                return false;
            }

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[Time Tracker] Ошибка при логировании времени в Jira: ${error.message}`);
            } else {
                this.outputChannel.appendLine(`[Time Tracker] Ошибка при логировании времени в Jira: ${String(error)}`);
            }
            return false;
        }
    }
}