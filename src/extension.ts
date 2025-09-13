import * as vscode from 'vscode';
import { ActivityTracker } from './activityTracker';
import { configureCommand } from './commands/configureCommand';
import { loadSettings } from './utils/configUtils';
import { JiraService } from './services/jiraService';
import { Timer } from './services/timer';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Time Tracker" activated.');

    // Create Output Channel
    const outputChannel = vscode.window.createOutputChannel('Time Tracker');
    context.subscriptions.push(outputChannel);

    // Load settings
    const settings = await loadSettings();
    if (settings) {
        const { jiraUrl, accessToken, inactivityTimeout, autoLogging, autoLoggingTime } = settings;
        outputChannel.appendLine(`[config]\nURL:\t\t\t${jiraUrl}\nInact Timeout:\t${inactivityTimeout}m\nAuto logging:\t${autoLogging}\nAuto log Time:\t${autoLoggingTime}m`);

        // Check Jira credentials
        const jiraService = new JiraService(jiraUrl, accessToken, outputChannel);
        const isValid = await jiraService.validateToken();
        if (isValid) {
            outputChannel.appendLine('[Time Tracker] Jira credentials are valid.');
        } else {
            outputChannel.appendLine('[Time Tracker] Jira credentials are invalid. Please configure the extension.');
            vscode.window.showErrorMessage('Jira credentials are invalid. Please configure the extension.');
        }
    } else {
        outputChannel.appendLine('[Time Tracker] Settings not found. Please configure the extension.');
        vscode.window.showErrorMessage('Settings not found. Please configure the extension.');
    }

    // Initialize activity tracker
    const timer = new Timer(context, outputChannel, settings?.inactivityTimeout as number, settings?.autoLoggingTime as number);
    const activityTracker = new ActivityTracker(context, outputChannel, timer);

    // Register command for logging time
    const logTimeDisposable = vscode.commands.registerCommand('timeTracker.logTime', () => activityTracker.logTimeForCurrentTask());
    context.subscriptions.push(logTimeDisposable);

    // Register command for configuration
    const configureDisposable = vscode.commands.registerCommand('timeTracker.configure', () => configureCommand(context, outputChannel));
    context.subscriptions.push(configureDisposable);

    // Register commands for timer control
    const startTimerDisposable = vscode.commands.registerCommand('timeTracker.start', () => timer.start());
    const stopTimerDisposable = vscode.commands.registerCommand('timeTracker.stop', () => timer.pause());
    const resetTimerDisposable = vscode.commands.registerCommand('timeTracker.reset', () => timer.reset());
    const setTaskID = vscode.commands.registerCommand('timeTracker.setTask', () => activityTracker.updateTaskID());
    context.subscriptions.push(startTimerDisposable);
    context.subscriptions.push(stopTimerDisposable);
    context.subscriptions.push(resetTimerDisposable);
    context.subscriptions.push(setTaskID);
}

export async function deactivate() {
    console.log('Extension "Time Tracker" deactivated.');
}