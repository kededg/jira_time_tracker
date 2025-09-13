import * as vscode from 'vscode';
import { saveSettings, loadSettings } from '../utils/configUtils';
import fetch from 'node-fetch';
import * as crypto from 'crypto';

/**
 * Generates a random secret for encryption.
 * @returns {string} A random secret.
 */
function generateEncryptionSecret(): string {
    return crypto.randomBytes(32).toString('hex'); // Generate a 32-byte random value
}

/**
 * Opens the page for generating a Personal Access Token.
 */
function openTokenGenerationPage(baseUrl: string) {
    const tokenGenerationUrl = `${baseUrl}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`;
    vscode.env.openExternal(vscode.Uri.parse(tokenGenerationUrl));
}

/**
 * Validates the Personal Access Token.
 * @param {string} jiraUrl Jira URL.
 * @param {string} token Personal Access Token.
 * @returns {Promise<boolean>} True if the token is valid, otherwise False.
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
            throw new Error(`Error validating token: ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('Error validating token:', error);
        return false;
    }
}

async function updateToken(jiraUrl: string, outputChannel: vscode.OutputChannel, config: vscode.WorkspaceConfiguration): Promise<string> {
    openTokenGenerationPage(jiraUrl); // Open the page for generating the token

    let token = await vscode.window.showInputBox({
        prompt: 'Enter the Personal Access Token generated in Jira',
        placeHolder: 'Personal Access Token',
        password: true,
        ignoreFocusOut: true, // The window will not close when focus is lost
    }) as string;

    if (!token) {
        outputChannel.appendLine('[Time Tracker] Error: Token is required for setup.');
        return "";
    } else {
        outputChannel.appendLine('[Time Tracker] Token accepted.');
    }

    const isValid = await validateToken(jiraUrl, token);
    if (!isValid) {
        outputChannel.appendLine('[Time Tracker] Error: Invalid token. Please check the token.');
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
 * Command for configuring the extension.
 * @param {vscode.ExtensionContext} context Extension context.
 */
export async function configureCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    let config = vscode.workspace.getConfiguration('timeTracker');

    const settings = await loadSettings();

    let jiraUrl = settings?.jiraUrl;

    if (!jiraUrl) {
        jiraUrl = await vscode.window.showInputBox({
            prompt: 'Enter your Jira URL (e.g., https://j.yadro.com)',
            placeHolder: 'https://j.yadro.com',
            value: 'https://j.yadro.com', // Default value
            ignoreFocusOut: true, // The window will not close when focus is lost
        }) as string;

        if (!jiraUrl) {
            outputChannel.appendLine('[Time Tracker] Error: Jira URL is required for setup.');
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

    outputChannel.appendLine(`[Time Tracker] Selected Jira URL: ${jiraUrl}`);

    let accessToken = settings?.accessToken as string;

    if (accessToken != "undefined") {
        const isValid = await validateToken(jiraUrl, accessToken);
        if (isValid) {
            outputChannel.appendLine('[Time Tracker] Token is valid. Settings loaded.');
        } else {
            outputChannel.appendLine('[Time Tracker] Warning: Token is invalid. Please generate a new one.');
            accessToken = await updateToken(jiraUrl, outputChannel, config);
        }
    } else {
        accessToken = await updateToken(jiraUrl, outputChannel, config);
    }

    await saveSettings(jiraUrl, accessToken);

    // Display configuration information
    outputChannel.appendLine(`[Time Tracker] Settings applied successfully`);
}
