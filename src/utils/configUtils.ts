import * as vscode from 'vscode';

/**
 * Loads extension settings.
 */
export async function loadSettings(): Promise<{jiraUrl: string, inactivityTimeout: number, autoLogging: boolean, autoLoggingTime: number} | null> {
    const config = vscode.workspace.getConfiguration('timeTracker');

    let jiraUrl = config.get<string>('jiraUrl') as string;
    let inactivityTimeout = config.get<number>('inactivityTimeout') as number;
    let autoLogging = config.get<boolean>('autoLogging');
    let autoLoggingTime = config.get<number>('autoLoggingTime');

    if (!jiraUrl || !inactivityTimeout || !autoLogging || !autoLoggingTime) {
        return null;
    }

    return {jiraUrl, inactivityTimeout, autoLogging, autoLoggingTime};
}

/**
 * Saves extension settings.
 */
export async function saveSettings(jiraUrl: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('timeTracker');

    await config.update('jiraUrl', jiraUrl, vscode.ConfigurationTarget.Global);
}