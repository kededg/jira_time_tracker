import * as vscode from 'vscode';
import { ActivityTracker } from './activityTracker';
import { configureCommand } from './commands/configureCommand';
import { loadSettings } from './utils/configUtils';
import { JiraService } from './services/jiraService';
import {Timer} from  './services/timer';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Расширение "Time Tracker" активировано.');

    // Создаем Output Channel
    const outputChannel = vscode.window.createOutputChannel('Time Tracker');
    context.subscriptions.push(outputChannel);

    // Загружаем настройки
    const settings = await loadSettings();
    if (settings) {
        const {jiraUrl, accessToken } = settings; // Используем accessToken

        // Проверяем учетные данные Jira
        const jiraService = new JiraService(jiraUrl, accessToken, outputChannel); // Передаем accessToken
        const isValid = await jiraService.validateToken(); // Используем validateToken вместо validateJiraCredentials

        if (!isValid) {
            outputChannel.appendLine('[Time Tracker] Учетные данные Jira недействительны. Пожалуйста, настройте расширение.');
            vscode.window.showErrorMessage('Учетные данные Jira недействительны. Пожалуйста, настройте расширение.');
        } else {
            outputChannel.appendLine('[Time Tracker] Учетные данные Jira действительны.');
        }
    } else {
        outputChannel.appendLine('[Time Tracker] Настройки не найдены. Пожалуйста, настройте расширение.');
        vscode.window.showErrorMessage('Настройки не найдены. Пожалуйста, настройте расширение.');
    }

    // Инициализация трекера активности
    const timer = new Timer(context, outputChannel);
    const activityTracker = new ActivityTracker(context, outputChannel, timer);

    // Регистрация команды для логирования времени
    const logTimeDisposable = vscode.commands.registerCommand('timeTracker.logTime', () => activityTracker.logTimeForCurrentTask());
    context.subscriptions.push(logTimeDisposable);

    // Регистрация команды для настройки
    const configureDisposable = vscode.commands.registerCommand('timeTracker.configure', () => configureCommand(context, outputChannel));
    context.subscriptions.push(configureDisposable);

    // Регистрация команды для управление таймером
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
    console.log('Расширение "Time Tracker" деактивировано.');
}