import * as vscode from 'vscode';
import { TasksTreeDataProvider } from './tasksTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Dedicated Tasks UI extension is now active');

	// Create and register the tree data provider
	const tasksProvider = new TasksTreeDataProvider();

	vscode.window.registerTreeDataProvider(
		'dedicatedTasksUi.tasksView',
		tasksProvider
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasksUi.runTask', (task: vscode.Task) => {
			vscode.tasks.executeTask(task);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasksUi.refresh', () => {
			tasksProvider.refresh();
		})
	);

	// Watch for tasks.json changes
	const tasksJsonWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/tasks.json');
	tasksJsonWatcher.onDidChange(() => tasksProvider.refresh());
	tasksJsonWatcher.onDidCreate(() => tasksProvider.refresh());
	tasksJsonWatcher.onDidDelete(() => tasksProvider.refresh());

	context.subscriptions.push(tasksJsonWatcher);
}

export function deactivate() { }
