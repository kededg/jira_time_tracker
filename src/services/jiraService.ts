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
            this.outputChannel.appendLine(`[validateToken]\tВыполнение запроса к: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.oauthToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.outputChannel.appendLine(`[validateToken]\tОшибка при проверке токена: ${response.statusText}`);
                this.outputChannel.appendLine(`[validateToken]\tДетали ошибки: ${errorText}`);
                return false;
            }

            this.outputChannel.appendLine(`[validateToken]\tУспех при проверке токена: ${response.statusText}`);

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[validateToken]\tОшибка при проверке токена: ${error.message}`);
            } else {
                this.outputChannel.appendLine(`[validateToken]\tОшибка при проверке токена: ${String(error)}`);
            }
            return false;
        }
    }

    /**
     * Логирует время в задачу Jira.
     * @param {string} taskId Номер задачи Jira.
     * @param {number} timeSpent Время в минутах.
     * @returns {Promise<boolean>} Успешно ли выполнено логирование.
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
                this.outputChannel.appendLine(`[logTime]\tОшибка при логировании времени: ${response.statusText}`);
                this.outputChannel.appendLine(`[logTime]\tДетали ошибки: ${errorText}`);
                return false;
            }

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[logTime]\tОшибка при логировании времени в Jira: ${error.message} URL: ${url} Task: ${taskId} Time: ${timeSpent} Msg: ${msg}`);
            } else {
                this.outputChannel.appendLine(`[logTime]\tОшибка при логировании времени в Jira: ${String(error)} URL: ${url} Task: ${taskId} Time: ${timeSpent} Msg: ${msg}`);
            }
            return false;
        }
    }

    public async logTimeForTask(task: string, time: number, msg: string = ""): Promise<boolean> {
        const success = await this.logTime(task, time, msg);
        if (success) {
            this.outputChannel.appendLine(`[logTimeForTask]\tВремя успешно залогировано в задачу ${task}.`);
            await vscode.window.showInformationMessage(
                `Время успешно залогировано в задачу ${task}. ${time}мин`);
        } else {
            this.outputChannel.appendLine(`[logTimeForTask]\tНе удалось залогировать время в задачу ${task}.`);
        }
        return success;
    }
}