import * as vscode from 'vscode';
import { TasksTreeDataProvider, GroupTreeItem, WorkspaceFolderItem, TaskTreeItem, LaunchConfigItem } from './tasksTreeProvider';
import { StatusBarManager } from './statusBarManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('Dedicated tasks extension is now active');

	// Create and register the tree data provider
	const tasksProvider = new TasksTreeDataProvider();

	// Create status bar manager
	const statusBarManager = new StatusBarManager();

	// Create tree view with TreeView API for collapse/expand control
	const treeView = vscode.window.createTreeView('dedicatedTasks.tasksView', {
		treeDataProvider: tasksProvider,
		showCollapseAll: false // We'll use our own button
	});

	// Update status bar when tasks change
	const updateStatusBar = async () => {
		const tasks = await tasksProvider.getAllTasks();
		await statusBarManager.updateStatusBar(tasks);
	};

	// Initial status bar update
	updateStatusBar();

	// Helper function to collect all leaf items (tasks and launch configs)
	const collectLeafItems = async (elements: any[]): Promise<any[]> => {
		const leaves: any[] = [];
		for (const element of elements) {
			if (element instanceof GroupTreeItem || element instanceof WorkspaceFolderItem) {
				const children = await tasksProvider.getChildren(element);
				leaves.push(...await collectLeafItems(children));
			} else if (element instanceof TaskTreeItem || element instanceof LaunchConfigItem) {
				leaves.push(element);
			}
		}
		return leaves;
	};

	// Helper function to expand all items by revealing leaves
	const expandAllItems = async () => {
		const rootElements = await tasksProvider.getChildren();
		const leaves = await collectLeafItems(rootElements);
		// Reveal each leaf item - this will expand all ancestors
		for (const leaf of leaves) {
			try {
				await treeView.reveal(leaf, { expand: true, select: false });
			} catch {
				// Ignore errors
			}
		}
	};

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dedicatedTasks.runTask', (task: vscode.Task) => {
			vscode.tasks.executeTask(task);
		}),
		vscode.commands.registerCommand('dedicatedTasks.runLaunchConfig', async (configName: string, folder: vscode.WorkspaceFolder) => {
			await vscode.debug.startDebugging(folder, configName);
		}),
		vscode.commands.registerCommand('dedicatedTasks.refresh', () => {
			tasksProvider.refresh();
			updateStatusBar();
		}),
		vscode.commands.registerCommand('dedicatedTasks.configureStatusBar', async () => {
			const tasks = await tasksProvider.getAllTasks();
			await statusBarManager.configureStatusBar(tasks);
		}),
		vscode.commands.registerCommand('dedicatedTasks.collapseAll', async () => {
			// Use the built-in collapse all for the view
			await vscode.commands.executeCommand('workbench.actions.treeView.dedicatedTasks.tasksView.collapseAll');
		}),

		vscode.commands.registerCommand('dedicatedTasks.expandAll', async () => {
			await expandAllItems();
		}),
		vscode.commands.registerCommand('dedicatedTasks.filter', async () => {
			const filterText = await vscode.window.showInputBox({
				prompt: 'Filter tasks by name',
				placeHolder: 'Enter filter text...',
				value: tasksProvider.getFilterText()
			});

			if (filterText !== undefined) {
				tasksProvider.setFilter(filterText);
				vscode.commands.executeCommand('setContext', 'dedicatedTasks.filterActive', filterText.length > 0);

				// If filter is active, expand all items to show results
				if (filterText.length > 0) {
					// Small delay to let the tree refresh first
					setTimeout(async () => {
						await expandAllItems();
					}, 100);
				}
			}
		}),
		vscode.commands.registerCommand('dedicatedTasks.clearFilter', async () => {
			tasksProvider.setFilter('');
			vscode.commands.executeCommand('setContext', 'dedicatedTasks.filterActive', false);
		}),
		treeView
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

	context.subscriptions.push(
		tasksJsonWatcher,
		launchJsonWatcher,
		configWatcher,
		statusBarManager
	);
}

export function deactivate() {
	// No cleanup needed
}

