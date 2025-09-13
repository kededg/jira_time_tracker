import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { JiraService } from './services/jiraService';
import { loadSettings } from './utils/configUtils';
import { Timer } from './services/timer';
import { AuthManager } from './utils/AuthManager';

export class ActivityTracker {
    private timer: Timer | null;
    private totalActiveTime: number; // Total active time in milliseconds
    private gitService: GitService;
    private currentTaskId: string; // Current Jira task
    private outputChannel: vscode.OutputChannel;
    private settings: any;

    constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, timer: Timer) {
        this.timer = timer;
        this.totalActiveTime = 0;
        this.gitService = new GitService();
        this.currentTaskId = "None";
        this.outputChannel = outputChannel;
    }

    /**
     * Starts tracking user activity.
     */
    public async startTracking(context: vscode.ExtensionContext) {
        this.settings = await loadSettings();

        const handleEvent = (event: any) => {
            if (this.timer?.isRun()) {
                this.timer?.updateTimeoutTimer();
            }
            this.handleBranchChange();
        };

        // Subscribe to each event
        context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeWindowState(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeTerminalState(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(handleEvent));
        context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidCreateFiles(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidDeleteFiles(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidRenameFiles(handleEvent));
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(handleEvent));
    }


    /**
     * Handles branch change.
     */
    private async handleBranchChange() {
        const branchName = await this.gitService.getCurrentBranch();
        if (branchName) {
            const taskId = this.gitService.extractJiraTaskId(branchName) as string;
            if (taskId != this.currentTaskId && taskId != "None") {
                this.outputChannel.appendLine(`[Time Tracker] Branch changed. New task: ${taskId}. Previously: ${this.currentTaskId}`);

                const timeSpent = Math.floor(this.timer?.getTime() as number / 60);
                const autoLoggingTime = this.settings?.autoLoggingTime as number;
                const autoLogging = this.settings?.autoLogging;

                // Offer to log time if the task has changed and time exceeds the specified amount
                if (autoLoggingTime < timeSpent) {
                    if (!this.settings) {
                        this.outputChannel.appendLine(`[Time Tracker] Failed to log time for task ${this.currentTaskId}. Configuration missing.`);
                        return;
                    }

                    const authManager = new AuthManager(this.context);
                    const oauthToken = await authManager.getToken();

                    const { jiraUrl } = this.settings;
                    const jiraService = new JiraService(jiraUrl, oauthToken, this.outputChannel);

                    if (!autoLogging) {
                        const shouldLogTime = await vscode.window.showWarningMessage(
                            `You switched to task ${taskId}. Log time spent on previous task ${timeSpent}min?`,
                            'Yes', 'No'
                        );

                        if (shouldLogTime === 'Yes') {
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
     * Logs time for the current task.
     */
    async logTimeForCurrentTask() {
        if (!this.settings) {
            this.outputChannel.appendLine(`[Time Tracker] Failed to log time for task ${this.currentTaskId}. Configuration missing.`);
            return;
        }

        const { jiraUrl } = this.settings;
        const authManager = new AuthManager(this.context);
        const oauthToken = await authManager.getToken();
        const jiraService = new JiraService(jiraUrl, oauthToken, this.outputChannel);

        const timeSpent = Math.floor(this.timer?.getTime() as number / 60);
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
