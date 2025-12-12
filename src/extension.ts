import * as vscode from 'vscode';
import { TasksTreeDataProvider } from './tasksTreeProvider';
import { StatusBarManager } from './statusBarManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('Dedicated tasks extension is now active');

	// Create and register the tree data provider
	const tasksProvider = new TasksTreeDataProvider();

	// Create status bar manager
	const statusBarManager = new StatusBarManager();

	vscode.window.registerTreeDataProvider(
		'dedicatedTasks.tasksView',
		tasksProvider
	);

	// Update status bar when tasks change
	const updateStatusBar = async () => {
		const tasks = await tasksProvider.getAllTasks();
		statusBarManager.updateStatusBar(tasks);
	};

	// Initial status bar update
	updateStatusBar();

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasks.runTask', (task: vscode.Task) => {
			vscode.tasks.executeTask(task);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasks.runLaunchConfig', async (configName: string, folder: vscode.WorkspaceFolder) => {
			await vscode.debug.startDebugging(folder, configName);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasks.refresh', () => {
			tasksProvider.refresh();
			updateStatusBar();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasks.configureStatusBar', async () => {
			const tasks = await tasksProvider.getAllTasks();
			await statusBarManager.configureStatusBar(tasks);
		})
	);

	// Watch for tasks.json changes
	const tasksJsonWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/tasks.json');
	tasksJsonWatcher.onDidChange(() => {
		tasksProvider.refresh();
		updateStatusBar();
	});
	tasksJsonWatcher.onDidCreate(() => {
		tasksProvider.refresh();
		updateStatusBar();
	});
	tasksJsonWatcher.onDidDelete(() => {
		tasksProvider.refresh();
		updateStatusBar();
	});

	// Watch for launch.json changes
	const launchJsonWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
	launchJsonWatcher.onDidChange(() => {
		tasksProvider.refresh();
		updateStatusBar();
	});
	launchJsonWatcher.onDidCreate(() => {
		tasksProvider.refresh();
		updateStatusBar();
	});
	launchJsonWatcher.onDidDelete(() => {
		tasksProvider.refresh();
		updateStatusBar();
	});

	// Watch for dedicated-tasks.json changes
	const configWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/dedicated-tasks.json');
	configWatcher.onDidChange(async () => {
		await statusBarManager.reloadConfig();
		updateStatusBar();
	});
	configWatcher.onDidCreate(async () => {
		await statusBarManager.reloadConfig();
		updateStatusBar();
	});
	configWatcher.onDidDelete(async () => {
		await statusBarManager.reloadConfig();
		updateStatusBar();
	});

	context.subscriptions.push(tasksJsonWatcher);
	context.subscriptions.push(launchJsonWatcher);
	context.subscriptions.push(configWatcher);
	context.subscriptions.push(statusBarManager);
}

export function deactivate() { }

