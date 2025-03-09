import * as vscode from 'vscode';
import { EncryptionService } from '../services/encryptionService';
import { saveSettings, loadSettings } from '../utils/configUtils';
import fetch from 'node-fetch';
import * as crypto from 'crypto';

/**
 * Генерирует случайный секрет для шифрования.
 * @returns {string} Случайный секрет.
 */
function generateEncryptionSecret(): string {
    return crypto.randomBytes(32).toString('hex'); // Генерация 32-байтового случайного значения
}

/**
 * Открывает страницу для генерации Personal Access Token.
 */
function openTokenGenerationPage(baseUrl: string) {
    const tokenGenerationUrl = `${baseUrl}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`;
    vscode.env.openExternal(vscode.Uri.parse(tokenGenerationUrl));
}

/**
 * Проверяет валидность Personal Access Token.
 * @param {string} jiraUrl URL Jira.
 * @param {string} token Personal Access Token.
 * @returns {Promise<boolean>} True, если токен действителен, иначе False.
 */
async function validateToken(jiraUrl: string, token: string): Promise<boolean> {
    try {
        const response = await fetch(`${jiraUrl}/rest/api/2/myself`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Ошибка при проверке токена: ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('Ошибка при проверке токена:', error);
        return false;
    }
}

async function updateToken(jiraUrl: string, outputChannel: vscode.OutputChannel, config: vscode.WorkspaceConfiguration): Promise<string> {
    openTokenGenerationPage(jiraUrl); // Открываем страницу для генерации токена

    let token = await vscode.window.showInputBox({
        prompt: 'Введите Personal Access Token, сгенерированный в Jira',
        placeHolder: 'Personal Access Token',
        password: true,
        ignoreFocusOut: true, // Окно не закроется при потере фокуса
    }) as string;

    if (!token) {
        outputChannel.appendLine('[Time Tracker] Ошибка: Токен обязателен для настройки.');
        return "";
    } else {
        outputChannel.appendLine('[Time Tracker] Токен принят.');
    }

    const isValid = await validateToken(jiraUrl, token);
    if (!isValid) {
        outputChannel.appendLine('[Time Tracker] Ошибка: Токен недействителен. Пожалуйста, проверьте токен.');
        return "";
    }

    config.update('accessToken', token, vscode.ConfigurationTarget.Global)
        .then(() => {
                outputChannel.appendLine('[Time Tracker] Configuration updated successfully.');
            }, (error: unknown) => {
                outputChannel.appendLine(`[Time Tracker] Failed to update configuration: ${error}`);
            });

    return token;
}

/**
 * Команда для настройки расширения.
 * @param {vscode.ExtensionContext} context Контекст расширения.
 */
export async function configureCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    let config = vscode.workspace.getConfiguration('timeTracker');

    const settings = await loadSettings();

    let jiraUrl = settings?.jiraUrl;

    if (!jiraUrl) {
        jiraUrl = await vscode.window.showInputBox({
            prompt: 'Введите URL вашего Jira (например, https://j.yadro.com)',
            placeHolder: 'https://j.yadro.com',
            value: 'https://j.yadro.com', // Значение по умолчанию
            ignoreFocusOut: true, // Окно не закроется при потере фокуса
        }) as string;

        if (!jiraUrl) {
            outputChannel.appendLine('[Time Tracker] Ошибка: URL Jira обязателен для настройки.');
            return;
        } else {
            config.update('jiraUrl', jiraUrl, vscode.ConfigurationTarget.Global)
            .then(() => {
                    outputChannel.appendLine('[Time Tracker] Configuration updated successfully.');
                }, (error: unknown) => {
                    outputChannel.appendLine(`[Time Tracker] Failed to update configuration: ${error}`);
                });
        }
    }

    outputChannel.appendLine(`[Time Tracker] Выбран URL Jira: ${jiraUrl}`);

    let accessToken = settings?.accessToken as string;

    if (accessToken  != "undefined") {
        const isValid = await validateToken(jiraUrl, accessToken);
        if (isValid) {
            outputChannel.appendLine('[Time Tracker] Токен действителен. Настройки загружены.');
        } else {
            outputChannel.appendLine('[Time Tracker] Предупреждение: Токен недействителен. Пожалуйста, сгенерируйте новый.');

            accessToken  = await updateToken(jiraUrl, outputChannel, config);
        }
    } else {
        accessToken  = await updateToken(jiraUrl, outputChannel, config);
    }

    await saveSettings(jiraUrl, accessToken);

    // Вывод информации о конфигурации
    outputChannel.appendLine(`[Time Tracker] Настройки успешно применены`);
}
