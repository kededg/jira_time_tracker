import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { JiraService } from './services/jiraService';
import { loadSettings } from './utils/configUtils';

export class ActivityTracker {
    private lastActivityTime: number;
    private inactivityTimeout: number; // Время бездействия в миллисекундах
    private timer: NodeJS.Timeout | null;
    private statusBarItem: vscode.StatusBarItem;
    private totalActiveTime: number; // Общее время активности в миллисекундах
    private gitService: GitService;
    private currentTaskId: string | null; // Текущая задача Jira
    private outputChannel: vscode.OutputChannel;
    private isTaskRecognized: boolean; // Флаг для отслеживания распознавания задачи
    private settings: any;
    private stopTimer: boolean;
    private massageInactive: any;

    constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.lastActivityTime = Date.now();
        this.inactivityTimeout = 10 * 60 * 1000; // 10 минут по умолчанию
        this.timer = null;
        this.totalActiveTime = 0;
        this.gitService = new GitService();
        this.currentTaskId = null;
        this.outputChannel = outputChannel;
        this.isTaskRecognized = false; // Изначально задача не распознана
        this.stopTimer = false;

        // Создаем StatusBarItem
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.text = "Время работы: 0:00 | Задача: Нет";
        this.statusBarItem.show();

        // Сохраняем StatusBarItem в контекст, чтобы он не был удален сборщиком мусора
        context.subscriptions.push(this.statusBarItem);

        this.startTracking(context);
    }

    /**
     * Начинает отслеживание активности пользователя.
     */
    private async startTracking(context: vscode.ExtensionContext) {
        this.settings = await loadSettings();
        this.inactivityTimeout = this.settings?.inactivityTimeout as number * 1000;

        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const timeCounterInfiniteLoop = async () => {
            while (true) {
                if (!this.stopTimer) {
                    this.totalActiveTime += 1;
                }
                await delay(1); // Ждем 1 миллисекунду
            }
        };
        const updateSBInfiniteLoop = async () => {
            while (true) {
                await delay(1000); // Ждем 1 секунду
                await this.updateStatusBar();
            }
        };

        timeCounterInfiniteLoop();
        updateSBInfiniteLoop();


        const handleEvent = (event: any) => {
            if (!this.stopTimer) {
                this.resetTimer()
            }
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
     * Сбрасывает таймер бездействия.
     */
    private async resetTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => this.handleInactivity(), this.inactivityTimeout);
    }

    /**
     * Обрабатывает период бездействия.
     */
    private async handleInactivity() {
        const autoLoggingTime = this.settings?.autoLoggingTime as number;
        let spendWorkTime = this.totalActiveTime - this.inactivityTimeout;
        if (spendWorkTime > autoLoggingTime) {
            const inactivityTimeoutMin = Math.floor(this.inactivityTimeout/60/1000);
            const spendWorkTimeMin = Math.floor(spendWorkTime/60/1000);
            this.outputChannel.appendLine(`[Time Tracker] Бездействовали более ${inactivityTimeoutMin} минут. Время работы: ${spendWorkTimeMin} Номер задачи: ${this.currentTaskId}`);

            this.stopTimer = true;
            this.massageInactive = await vscode.window.showWarningMessage(
                `Вы бездействовали более ${inactivityTimeoutMin} минут. Залогировать ${spendWorkTimeMin} мин в ${this.currentTaskId} Jira?`, { modal: true },
                'Да'
            );

            this.outputChannel.appendLine(`[Time Tracker] Табло ${this.massageInactive}`);

            if (this.massageInactive === 'Да') {
                await this.logTimeForTask(this.currentTaskId as string, spendWorkTime);
                this.totalActiveTime = 0;
            }

            this.stopTimer = false;
        }
        return;
    }

    /**
     * Обновляет текст в StatusBarItem.
     */
    private async updateStatusBar() {
        const totalMinutes = Math.floor(this.totalActiveTime / 60000);
        const totalSeconds = Math.floor((this.totalActiveTime % 60000) / 1000);
        const timeText = `Время работы: ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;

        // Получаем имя текущей ветки Git
        const branchName = await this.gitService.getCurrentBranch();
        let taskText = "Задача: Нет";

        if (branchName) {
            // Извлекаем номер задачи Jira из имени ветки
            const taskId = this.gitService.extractJiraTaskId(branchName);
            if (taskId) {
                taskText = `Задача: ${taskId}`;

                // Если задача изменилась, сбрасываем флаг
                if (this.currentTaskId !== taskId) {
                    this.isTaskRecognized = false;
                }

                this.currentTaskId = taskId;

                // Выводим сообщение только один раз
                if (!this.isTaskRecognized) {
                    this.outputChannel.appendLine(`[Time Tracker] Ветка распознана. Номер задачи: ${taskId}`);
                    await this.handleBranchChange();
                    this.isTaskRecognized = true; // Устанавливаем флаг, чтобы сообщение не выводилось повторно
                }
            } else {
                this.currentTaskId = null;
                this.isTaskRecognized = false; // Сбрасываем флаг, если задача не распознана
            }
        }

        // Обновляем текст StatusBarItem
        this.statusBarItem.text = `${timeText} | ${taskText}`;
    }

    /**
     * Обрабатывает смену ветки.
     */
    private async handleBranchChange() {
        const branchName = await this.gitService.getCurrentBranch();
        if (branchName) {
            const taskId = this.gitService.extractJiraTaskId(branchName) as string;
            if (taskId !== this.currentTaskId) {
                this.outputChannel.appendLine(`[Time Tracker] Ветка изменена. Новая задача: ${taskId}`);

                const timeSpent = Math.floor(this.totalActiveTime / 1000); // Время в секундах
                const autoLoggingTime = this.settings?.autoLoggingTime as number;
                const autoLogging = this.settings?.autoLogging;

                // Предлагаем залогировать время, если задача изменилась и время больше заданного
                if (autoLoggingTime > timeSpent) {
                    if (!autoLogging) {
                        const shouldLogTime = await vscode.window.showWarningMessage(
                            `Вы переключились на задачу ${taskId}. Залогировать время, потраченное на предыдущую задачу ${timeSpent/60}мин?`,
                            'Да', 'Нет'
                        );

                        if (shouldLogTime === 'Да') {
                            await this.logTimeForTask(taskId, this.totalActiveTime);
                        }
                    } else {
                        await this.logTimeForTask(taskId, this.totalActiveTime);
                    }
                }

                this.totalActiveTime = 0; // Сбрасываем таймер

                this.currentTaskId = taskId;
                this.isTaskRecognized = false; // Сбрасываем флаг при смене ветки
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

        const {jiraUrl, accessToken } = this.settings; // Используем accessToken вместо jiraUsername и jiraPassword
        const jiraService = new JiraService( jiraUrl, accessToken, this.outputChannel); // Передаем accessToken

        const timeSpent = Math.floor(this.totalActiveTime / 1000); // Время в секундах
        if (this.currentTaskId) {
            const success = await jiraService.logTime(this.currentTaskId, timeSpent);
            if (success) {
                this.outputChannel.appendLine(`[Time Tracker] Время успешно залогировано в задачу ${this.currentTaskId}.`);
                const shouldLogTime = await vscode.window.showInformationMessage(
                    `Время успешно залогировано в задачу ${this.currentTaskId}. ${timeSpent/60}мин`);
                this.totalActiveTime = 0; // Сбрасываем время после логирования
            } else {
                this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${this.currentTaskId}.`);
            }
        }
    }

    // /**
    // * Логирует время для задачи.
    // */
    // private async logTimeForTask(task: string) {
    //     if (!this.settings) {
    //         this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${this.currentTaskId}. Конфигурация отсутствует.`);
    //         return;
    //     }

    //     const {jiraUrl, accessToken } = this.settings; // Используем accessToken вместо jiraUsername и jiraPassword
    //     const jiraService = new JiraService( jiraUrl, accessToken, this.outputChannel); // Передаем accessToken

    //     const timeSpent = Math.floor(this.totalActiveTime / 1000); // Время в секундах
    //     if (task) {
    //         const success = await jiraService.logTime(task, timeSpent);
    //         if (success) {
    //             this.outputChannel.appendLine(`[Time Tracker] Время успешно залогировано в задачу ${task}.`);
    //             const shouldLogTime = await vscode.window.showInformationMessage(
    //                 `Время успешно залогировано в задачу ${task}. ${timeSpent/60}мин`);
    //             this.totalActiveTime = 0; // Сбрасываем время после логирования
    //         } else {
    //             this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${task}.`);
    //         }
    //     }
    // }

    /**
    * Логирует время для задачи в случае.
    */
    private async logTimeForTask(task: string, time: number) {
        if (!this.settings) {
            this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${this.currentTaskId}. Конфигурация отсутствует.`);
            return;
        }

        const {jiraUrl, accessToken } = this.settings; // Используем accessToken вместо jiraUsername и jiraPassword
        const jiraService = new JiraService( jiraUrl, accessToken, this.outputChannel); // Передаем accessToken

        const timeSpent = Math.floor(time / 1000); // Время в секундах
        if (task) {
            const success = await jiraService.logTime(task, timeSpent);
            if (success) {
                this.outputChannel.appendLine(`[Time Tracker] Время успешно залогировано в задачу ${task}.`);
                const shouldLogTime = await vscode.window.showInformationMessage(
                    `Время успешно залогировано в задачу ${task}. ${timeSpent/60}мин`);
            } else {
                this.outputChannel.appendLine(`[Time Tracker] Не удалось залогировать время в задачу ${task}.`);
            }
        }
    }
}