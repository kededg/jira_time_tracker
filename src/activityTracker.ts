import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { JiraService } from './services/jiraService';
import { loadSettings } from './utils/configUtils';
import {Timer} from  './services/timer';

export class ActivityTracker {
    private lastActivityTime: number;
    private inactivityTimeout: number; // Время бездействия в миллисекундах
    private timer: Timer | null;
    private timeoutTimer: NodeJS.Timeout | null = null;
    private totalActiveTime: number; // Общее время активности в миллисекундах
    private gitService: GitService;
    private currentTaskId: string; // Текущая задача Jira
    private outputChannel: vscode.OutputChannel;
    private isTaskRecognized: boolean; // Флаг для отслеживания распознавания задачи
    private settings: any;
    private massageInactive: any;

    constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, timer: Timer) {
        this.lastActivityTime = Date.now();
        this.inactivityTimeout = 10 * 60 * 1000; // 10 минут по умолчанию
        this.timer = timer;
        this.timeoutTimer = null;
        this.totalActiveTime = 0;
        this.gitService = new GitService();
        this.currentTaskId = "None";
        this.outputChannel = outputChannel;
        this.isTaskRecognized = false; // Изначально задача не распознана

        this.startTracking(context);
    }

    /**
     * Начинает отслеживание активности пользователя.
     */
    private async startTracking(context: vscode.ExtensionContext) {
        this.settings = await loadSettings();
        this.inactivityTimeout = this.settings?.inactivityTimeout as number * 1000;

        const handleEvent = (event: any) => {
            if (!this.timer?.isRun()) {
                this.timer?.resetTimeoutTimer();
            }
            this.handleBranchChange();
        };

        // Подписываемся на каждое событие
        context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeWindowState(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeTerminalState(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidCreateFiles(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidDeleteFiles(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidRenameFiles(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(handleEvent));
    }


    /**
     * Обрабатывает смену ветки.
     */
    private async handleBranchChange() {
        const branchName = await this.gitService.getCurrentBranch();
        if (branchName) {
            const taskId = this.gitService.extractJiraTaskId(branchName) as string;
            if (taskId != this.currentTaskId && taskId != "None") {
                this.outputChannel.appendLine(`[Time Tracker] Ветка изменена. Новая задача: ${taskId}. Previously: ${this.currentTaskId}`);

                const timeSpent = Math.floor(this.timer?.getTime() as number / 60);
                const autoLoggingTime = this.settings?.autoLoggingTime as number;
                const autoLogging = this.settings?.autoLogging;

                // Предлагаем залогировать время, если задача изменилась и время больше заданного
                if (autoLoggingTime < timeSpent) {
                    if (!this.settings) {
                        this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${this.currentTaskId}. Конфигурация отсутствует.`);
                        return;
                    }

                    const {jiraUrl, accessToken } = this.settings;
                    const jiraService = new JiraService( jiraUrl, accessToken, this.outputChannel);

                    if (!autoLogging) {
                        const shouldLogTime = await vscode.window.showWarningMessage(
                            `Вы переключились на задачу ${taskId}. Залогировать время, потраченное на предыдущую задачу ${timeSpent}мин?`,
                            'Да', 'Нет'
                        );

                        if (shouldLogTime === 'Да') {
                            await jiraService.logTimeForTask(taskId, this.totalActiveTime);
                            this.timer?.reset();
                        }
                    } else {
                        await jiraService.logTimeForTask(taskId, this.totalActiveTime);
                        this.timer?.reset();
                    }
                }


                this.currentTaskId = taskId;
                this.timer?.setTaskID(taskId);
                this.timer?.start();
            }
        }
    }

    /**
     * Логирует время текущей задачи.
     */
    async logTimeForCurrentTask() {
        if (!this.settings) {
            this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${this.currentTaskId}. Конфигурация отсутствует.`);
            return;
        }

        const {jiraUrl, accessToken } = this.settings;
        const jiraService = new JiraService( jiraUrl, accessToken, this.outputChannel);

        const timeSpent = Math.floor(this.timer?.getTime() as number/60);
        const success = await jiraService.logTimeForTask(this.currentTaskId, timeSpent);
        this.outputChannel.appendLine(`[logTimeForCurrentTask]\tDEBUG: ${success}.`);
        this.timer?.reset();
    }

    public async updateTaskID() {
        let taskID = await vscode.window.showInputBox({
            prompt: 'Fill Jira task ID (example: YID-666)',
            value: 'None',
            ignoreFocusOut: true,
        }) as string;

        this.outputChannel.appendLine(`[Time Tracker] Set new Task ID ${taskID}.`);

        if (this.currentTaskId != taskID) {
            this.currentTaskId = taskID;
            this.timer?.setTaskID(taskID);
        }
    }
}
