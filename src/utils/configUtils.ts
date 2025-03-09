import * as vscode from 'vscode';

/**
 * Загружает настройки расширения.
 */
export async function loadSettings(): Promise<{jiraUrl: string, accessToken: string, inactivityTimeout: number, autoLogging: boolean, autoLoggingTime: number} | null> {
    const config = vscode.workspace.getConfiguration('timeTracker');

    let jiraUrl = config.get<string>('jiraUrl') as string;
    let accessToken = config.get<string>('accessToken') as string;
    let inactivityTimeout = config.get<number>('inactivityTimeout');
    let autoLogging = config.get<boolean>('autoLogging');
    let autoLoggingTime = config.get<number>('autoLoggingTime');

    if (!jiraUrl || !accessToken || !inactivityTimeout || !autoLogging || !autoLoggingTime) {
        return null;
    }

    return {jiraUrl, accessToken, inactivityTimeout, autoLogging, autoLoggingTime};
}

/**
 * Сохраняет настройки расширения.
 */
export async function saveSettings(jiraUrl: string, accessToken: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('timeTracker');

    await config.update('jiraUrl', jiraUrl, vscode.ConfigurationTarget.Global);
    await config.update('accessToken', accessToken, vscode.ConfigurationTarget.Global);
}