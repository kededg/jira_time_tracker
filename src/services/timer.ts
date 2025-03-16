import * as vscode from 'vscode';
import { loadSettings } from '../utils/configUtils';
import { JiraService } from '../services/jiraService';

export class Timer {
    private outputChannel: vscode.OutputChannel;

    private infoStatusBarItem: vscode.StatusBarItem;
    private startPauseStatusBarItem: vscode.StatusBarItem;
    private resetStatusBarItem: vscode.StatusBarItem;

    private taskID: string = "None";
    private timer: NodeJS.Timeout | null = null;
    private timeoutTimer: NodeJS.Timeout | null = null;
    private timeElapsed: number = 0;
    private isRunning: boolean = false;
    private inactivityTimeout: number;
    private autoLoggingTime: number;

    private settings: any;

    constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;

        this.infoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.infoStatusBarItem.text = "Time track: 00:00:00 | Task: None";
        this.infoStatusBarItem.show();
        context.subscriptions.push(this.infoStatusBarItem);

        this.startPauseStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.startPauseStatusBarItem.text = "$(play)";
        this.startPauseStatusBarItem.tooltip = "Start";
        this.startPauseStatusBarItem.command = "timeTracker.start";
        this.startPauseStatusBarItem.show();
        context.subscriptions.push(this.startPauseStatusBarItem);

        this.resetStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
        this.resetStatusBarItem.text = "$(refresh)";
        this.resetStatusBarItem.tooltip = "Reset";
        this.resetStatusBarItem.command = "timeTracker.reset";
        this.resetStatusBarItem.show();
        context.subscriptions.push(this.resetStatusBarItem);


        this.settings = loadSettings();
        this.inactivityTimeout = this.settings?.inactivityTimeout as number;
        this.autoLoggingTime = this.settings?.autoLoggingTime as number;
        this.timer = null;
        this.timeoutTimer = null;
    }

    public start(): void {
        if (!this.timer) {
            this.timer = setInterval(() => this.updateTimer(), 1000);
            this.startPauseStatusBarItem.text = "$(debug-pause)";
            this.startPauseStatusBarItem.tooltip = "Pause";
            this.startPauseStatusBarItem.command = "timeTracker.stop";
            this.isRunning = true;
            this.outputChannel.appendLine(`[Time Tracker] Timer is started.`);
        }
    }

    public pause(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.startPauseStatusBarItem.text = "$(play)";
        this.startPauseStatusBarItem.tooltip = "Start";
        this.startPauseStatusBarItem.command = "timeTracker.start";
        this.isRunning = false;
        this.outputChannel.appendLine(`[Time Tracker] Timer is paused.`);
    }


    public reset(): void {
        this.pause();
        this.updateTimer();
        this.outputChannel.appendLine(`[Time Tracker] Timer was reset.`);
    }


    public setTaskID(taskID: string): void {
        this.outputChannel.appendLine(`[Time Tracker] Task ID updated ${this.taskID} -> ${taskID}`);
        this.taskID = taskID;
        this.updateTimer();
    }


    public getTime(): number {
        return this.timeElapsed;
    }


    public isRun(): boolean {
        return this.isRunning;
    }


    public resetTimeoutTimer(){
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
        this.timeoutTimer = setTimeout(() => this.handleInactivity(), this.inactivityTimeout);
    }

    private async handleInactivity() {
        let spendWorkTime = this.timeElapsed - this.inactivityTimeout;
        if (spendWorkTime > this.autoLoggingTime) {
            const inactivityTimeoutMin = Math.floor(this.inactivityTimeout/60);
            const spendWorkTimeMin = Math.floor(spendWorkTime/60);
            this.outputChannel.appendLine(`[Time Tracker] Бездействовали более ${inactivityTimeoutMin} минут. Время работы: ${spendWorkTimeMin} Номер задачи: ${this.taskID}`);

            this.pause();
            let massageInactive = await vscode.window.showWarningMessage(
                `Вы бездействовали более ${inactivityTimeoutMin} минут. Залогировать ${spendWorkTimeMin} мин в ${this.taskID} Jira?`, { modal: true },
                'Yes'
            );

            this.outputChannel.appendLine(`[Time Tracker] Табло ${massageInactive}`);

            if (massageInactive === 'Yes') {
                const {jiraUrl, accessToken } = this.settings;
                const jiraService = new JiraService( jiraUrl, accessToken, this.outputChannel);
                await jiraService.logTimeForTask(this.taskID, spendWorkTime);
                this.reset();
            }

            this.start();
        }
        return;
    }


    private updateTimer(): void {
        const hours = Math.floor(this.timeElapsed / 3600);
        const minutes = Math.floor((this.timeElapsed % 3600) / 60);
        const seconds = this.timeElapsed % 60;
        this.infoStatusBarItem.text = `Time track: ${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)} | Task: ${this.taskID}`;
        this.timeElapsed++;
    }


    private pad(num: number): string {
        return num < 10 ? `0${num}` : num.toString();
    }


    public dispose(): void {
        this.infoStatusBarItem.dispose();
        this.startPauseStatusBarItem.dispose();
        this.resetStatusBarItem.dispose();
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

}