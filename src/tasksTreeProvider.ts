import * as vscode from 'vscode';

export interface DedicatedTasksConfig {
	label?: string;
	detail?: string;
	hide?: boolean;
	groups: (string | string[])[];
	order?: number;
}

export interface TaskWithConfig extends vscode.Task {
	dedicatedUiConfig?: DedicatedTasksConfig;
}

export type ActionItemType = 'task' | 'launch';

export class TaskTreeItem extends vscode.TreeItem {
	constructor(
		public readonly task: vscode.Task,
		public readonly config: DedicatedTasksConfig,
		public readonly itemType: ActionItemType = 'task'
	) {
		const labelText = config.label || task.name;

		// Extract icon from label (format: "$(iconName) text")
		const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
		const icon = iconMatch ? iconMatch[1] : 'play';
		const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

		super(displayLabel, vscode.TreeItemCollapsibleState.None);

		this.description = config.detail || '';
		this.tooltip = `${displayLabel}${config.detail ? '\n' + config.detail : ''}`;
		this.contextValue = 'task';

		this.command = {
			command: 'dedicatedTasks.runTask',
			title: 'Run Task',
			arguments: [task]
		};

		// Set icon from label or default to play
		this.iconPath = new vscode.ThemeIcon(icon);
	}
}

export class LaunchConfigItem extends vscode.TreeItem {
	constructor(
		public readonly launchConfig: { name: string; folder: vscode.WorkspaceFolder },
		public readonly config: DedicatedTasksConfig,
		public readonly itemType: ActionItemType = 'launch'
	) {
		const labelText = config.label || launchConfig.name;

		// Extract icon from label (format: "$(iconName) text")
		const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
		const icon = iconMatch ? iconMatch[1] : 'debug-start';
		const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

		super(displayLabel, vscode.TreeItemCollapsibleState.None);

		this.description = config.detail || '';
		this.tooltip = `${displayLabel}${config.detail ? '\n' + config.detail : ''}`;
		this.contextValue = 'launchConfig';

		this.command = {
			command: 'dedicatedTasks.runLaunchConfig',
			title: 'Run Launch Configuration',
			arguments: [launchConfig.name, launchConfig.folder]
		};

		// Set icon from label or default to debug-start
		this.iconPath = new vscode.ThemeIcon(icon);
	}
}

export class GroupTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly children: (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[],
		public readonly path: string[]
	) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);

		this.contextValue = 'group';

		// Count items recursively
		const itemCount = this.countItems(children);
		if (itemCount > 0) {
			this.description = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
		}

		this.iconPath = new vscode.ThemeIcon('folder');
	}

	private countItems(items: (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[]): number {
		let count = 0;
		for (const item of items) {
			if (item instanceof TaskTreeItem || item instanceof LaunchConfigItem) {
				count++;
			} else if (item instanceof GroupTreeItem) {
				count += this.countItems(item.children);
			}
		}
		return count;
	}
}

export class TasksTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem | LaunchConfigItem | GroupTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | LaunchConfigItem | GroupTreeItem | undefined | null | void> =
		new vscode.EventEmitter<TaskTreeItem | LaunchConfigItem | GroupTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | LaunchConfigItem | GroupTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async getAllTasks(): Promise<(TaskTreeItem | LaunchConfigItem)[]> {
		const tasks = await this.getDedicatedTasks();
		const launchConfigs = await this.getDedicatedLaunchConfigs();
		return [...tasks, ...launchConfigs];
	}

	getTreeItem(element: TaskTreeItem | LaunchConfigItem | GroupTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: TaskTreeItem | LaunchConfigItem | GroupTreeItem): Promise<(TaskTreeItem | LaunchConfigItem | GroupTreeItem)[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		if (!element) {
			// Root level - return top-level groups
			const hierarchy = await this.buildHierarchy();
			return hierarchy;
		} else if (element instanceof GroupTreeItem) {
			// Return children of this group (can be tasks or subgroups)
			return element.children;
		}

		return [];
	}

	private async buildHierarchy(): Promise<(TaskTreeItem | LaunchConfigItem | GroupTreeItem)[]> {
		const tasks = await this.getDedicatedTasks();
		const launchConfigs = await this.getDedicatedLaunchConfigs();
		const allItems = [...tasks, ...launchConfigs];

		// Build a hierarchy tree structure
		interface HierarchyNode {
			children: Map<string, HierarchyNode>;
			items: (TaskTreeItem | LaunchConfigItem)[];
			path: string[];
		}

		const root: HierarchyNode = {
			children: new Map(),
			items: [],
			path: []
		};

		// Insert each item (task or launch config) into all its group paths
		for (const item of allItems) {
			for (const groupPath of item.config.groups) {
				// Normalize group path to array
				const pathArray = typeof groupPath === 'string' ? [groupPath] : groupPath;

				// Navigate/create the hierarchy
				let currentNode = root;
				let currentPath: string[] = [];

				for (const segment of pathArray) {
					currentPath = [...currentPath, segment];

					if (!currentNode.children.has(segment)) {
						currentNode.children.set(segment, {
							children: new Map(),
							items: [],
							path: currentPath
						});
					}
					currentNode = currentNode.children.get(segment)!;
				}

				// Add item to the leaf node
				currentNode.items.push(item);
			}
		}

		// Convert hierarchy tree to TreeItems
		const convertNode = (node: HierarchyNode): (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[] => {
			const items: (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[] = [];

			// Add subgroups first (sorted alphabetically)
			const sortedGroups = Array.from(node.children.entries())
				.sort((a, b) => a[0].localeCompare(b[0]));

			for (const [name, childNode] of sortedGroups) {
				const childItems = convertNode(childNode);
				items.push(new GroupTreeItem(name, childItems, childNode.path));
			}

			// Then add items (tasks and launch configs sorted by order)
			const sortedItems = [...node.items].sort((a, b) => {
				const orderA = a.config.order ?? 0;
				const orderB = b.config.order ?? 0;
				return orderA - orderB;
			});

			items.push(...sortedItems);

			return items;
		};

		return convertNode(root);
	}

	private async getDedicatedTasks(): Promise<TaskTreeItem[]> {
		const allTasks = await vscode.tasks.fetchTasks();
		const dedicatedTasks: TaskTreeItem[] = [];

		for (const task of allTasks) {
			const config = await this.getDedicatedTaskConfig(task);

			if (config && !config.hide) {
				dedicatedTasks.push(new TaskTreeItem(task, config));
			}
		}

		return dedicatedTasks;
	}

	private async getDedicatedTaskConfig(task: vscode.Task): Promise<DedicatedTasksConfig | undefined> {
		// Get the workspace folder for this task
		let workspaceFolder: vscode.WorkspaceFolder | undefined;

		if (task.scope && typeof task.scope !== 'number') {
			workspaceFolder = task.scope as vscode.WorkspaceFolder;
		} else {
			workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		}

		if (!workspaceFolder) {
			return undefined;
		}

		// Read tasks.json
		const tasksJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'tasks.json');

		try {
			const document = await vscode.workspace.openTextDocument(tasksJsonUri);
			const text = document.getText();

			// Parse JSON (stripping comments)
			const tasksConfig = this.parseJsonWithComments(text);

			if (tasksConfig && tasksConfig.tasks && Array.isArray(tasksConfig.tasks)) {
				// Find the matching task by label
				const taskDef = tasksConfig.tasks.find((t: any) => t.label === task.name);

				if (taskDef && taskDef.options && taskDef.options.dedicatedTasks) {
					return taskDef.options.dedicatedTasks;
				}
			}
		} catch (error) {
			// tasks.json doesn't exist or can't be read
			return undefined;
		}

		return undefined;
	}

	private parseJsonWithComments(text: string): any {
		// Simple comment stripping - remove // and /* */ comments
		const withoutComments = text
			.replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
			.replace(/\/\/.*/g, ''); // Remove // comments

		try {
			return JSON.parse(withoutComments);
		} catch {
			return undefined;
		}
	}

	private async getDedicatedLaunchConfigs(): Promise<LaunchConfigItem[]> {
		const dedicatedConfigs: LaunchConfigItem[] = [];

		if (!vscode.workspace.workspaceFolders) {
			return dedicatedConfigs;
		}

		for (const folder of vscode.workspace.workspaceFolders) {
			const launchJsonUri = vscode.Uri.joinPath(folder.uri, '.vscode', 'launch.json');

			try {
				const document = await vscode.workspace.openTextDocument(launchJsonUri);
				const text = document.getText();
				const launchConfig = this.parseJsonWithComments(text);

				if (launchConfig && launchConfig.configurations && Array.isArray(launchConfig.configurations)) {
					for (const config of launchConfig.configurations) {
						if (config.dedicatedTasks && !config.dedicatedTasks.hide) {
							const dedicatedConfig = config.dedicatedTasks as DedicatedTasksConfig;
							dedicatedConfigs.push(new LaunchConfigItem(
								{ name: config.name, folder },
								dedicatedConfig
							));
						}
					}
				}
			} catch (error) {
				// launch.json doesn't exist or can't be read
				continue;
			}
		}

		return dedicatedConfigs;
	}
}
