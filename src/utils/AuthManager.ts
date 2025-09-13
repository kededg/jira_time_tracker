import * as vscode from 'vscode';

export class AuthManager {
    private static readonly JIRA_TOKEN_KEY = 'jiraAccessToken';

    constructor(private context: vscode.ExtensionContext) {}

    // Сохранение токена в secure storage
    async saveToken(token: string): Promise<void> {
        const secretStorage = this.context.secrets;
        await secretStorage.store(AuthManager.JIRA_TOKEN_KEY, token);
    }

    // Получение токена из secure storage
    async getToken(): Promise<string | undefined> {
        const secretStorage = this.context.secrets;
        return await secretStorage.get(AuthManager.JIRA_TOKEN_KEY);
    }

    // Удаление токена
    async deleteToken(): Promise<void> {
        const secretStorage = this.context.secrets;
        await secretStorage.delete(AuthManager.JIRA_TOKEN_KEY);
    }

}