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

export class TaskTreeItem extends vscode.TreeItem {
	constructor(
		public readonly task: vscode.Task,
		public readonly config: DedicatedTasksConfig
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

export class GroupTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly children: (TaskTreeItem | GroupTreeItem)[],
		public readonly path: string[]
	) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);

		this.contextValue = 'group';

		// Count tasks recursively
		const taskCount = this.countTasks(children);
		if (taskCount > 0) {
			this.description = `${taskCount} task${taskCount !== 1 ? 's' : ''}`;
		}

		this.iconPath = new vscode.ThemeIcon('folder');
	}

	private countTasks(items: (TaskTreeItem | GroupTreeItem)[]): number {
		let count = 0;
		for (const item of items) {
			if (item instanceof TaskTreeItem) {
				count++;
			} else if (item instanceof GroupTreeItem) {
				count += this.countTasks(item.children);
			}
		}
		return count;
	}
}

export class TasksTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem | GroupTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | GroupTreeItem | undefined | null | void> =
		new vscode.EventEmitter<TaskTreeItem | GroupTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | GroupTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async getAllTasks(): Promise<TaskTreeItem[]> {
		return this.getDedicatedTasks();
	}

	getTreeItem(element: TaskTreeItem | GroupTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: TaskTreeItem | GroupTreeItem): Promise<(TaskTreeItem | GroupTreeItem)[]> {
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

	private async buildHierarchy(): Promise<(TaskTreeItem | GroupTreeItem)[]> {
		const tasks = await this.getDedicatedTasks();

		// Build a hierarchy tree structure
		interface HierarchyNode {
			children: Map<string, HierarchyNode>;
			tasks: TaskTreeItem[];
			path: string[];
		}

		const root: HierarchyNode = {
			children: new Map(),
			tasks: [],
			path: []
		};

		// Insert each task into all its group paths
		for (const taskItem of tasks) {
			for (const groupPath of taskItem.config.groups) {
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
							tasks: [],
							path: currentPath
						});
					}
					currentNode = currentNode.children.get(segment)!;
				}

				// Add task to the leaf node
				currentNode.tasks.push(taskItem);
			}
		}

		// Convert hierarchy tree to TreeItems
		const convertNode = (node: HierarchyNode): (TaskTreeItem | GroupTreeItem)[] => {
			const items: (TaskTreeItem | GroupTreeItem)[] = [];

			// Add subgroups first (sorted alphabetically)
			const sortedGroups = Array.from(node.children.entries())
				.sort((a, b) => a[0].localeCompare(b[0]));

			for (const [name, childNode] of sortedGroups) {
				const childItems = convertNode(childNode);
				items.push(new GroupTreeItem(name, childItems, childNode.path));
			}

			// Then add tasks (sorted by order)
			const sortedTasks = [...node.tasks].sort((a, b) => {
				const orderA = a.config.order ?? 0;
				const orderB = b.config.order ?? 0;
				return orderA - orderB;
			});

			items.push(...sortedTasks);

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
}
