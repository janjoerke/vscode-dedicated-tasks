import * as vscode from 'vscode';
import { TasksTreeDataProvider } from './tasksTreeProvider';
import { StatusBarManager } from './statusBarManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('Dedicated tasks extension is now active');

	// Create and register the tree data provider
	const tasksProvider = new TasksTreeDataProvider();

	// Create status bar manager
	const statusBarManager = new StatusBarManager(context);

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

	context.subscriptions.push(tasksJsonWatcher);
	context.subscriptions.push(statusBarManager);
}

export function deactivate() { }

