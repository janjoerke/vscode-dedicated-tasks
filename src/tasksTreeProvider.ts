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
		public readonly workspaceFolder: vscode.WorkspaceFolder,
		public readonly folderAbbreviation: string,
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
		public readonly workspaceFolder: vscode.WorkspaceFolder,
		public readonly folderAbbreviation: string,
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

export class WorkspaceFolderItem extends vscode.TreeItem {
	constructor(
		public readonly folder: vscode.WorkspaceFolder,
		public readonly abbreviation: string,
		public readonly children: (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[]
	) {
		super(folder.name, vscode.TreeItemCollapsibleState.Expanded);

		this.description = `[${abbreviation}]`;
		this.tooltip = `${folder.name} (${abbreviation})\n${folder.uri.fsPath}`;
		this.contextValue = 'workspaceFolder';
		this.iconPath = new vscode.ThemeIcon('root-folder');
	}
}

export class GroupTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly children: (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[],
		public readonly path: string[],
		public readonly workspaceFolder?: vscode.WorkspaceFolder,
		public readonly folderAbbreviation?: string
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

/**
 * Generates unique 3-character abbreviations for workspace folder names.
 * Algorithm:
 * 1. Try first 3 uppercase letters of the name
 * 2. If conflict, try first letter + next 2 consonants
 * 3. If conflict, try first letter + first + last letter
 * 4. If still conflict, append numbers (AB1, AB2, etc.)
 */
export function generateFolderAbbreviations(folders: readonly vscode.WorkspaceFolder[]): Map<string, string> {
	const abbreviations = new Map<string, string>();
	const usedAbbreviations = new Set<string>();

	const getConsonants = (str: string): string => {
		return str.replace(/[aeiouAEIOU\s\-_\.]/g, '');
	};

	const generateAbbreviation = (name: string): string => {
		const cleanName = name.replace(/[\s\-_\.]/g, '').toUpperCase();

		// Strategy 1: First 3 characters
		let abbrev = cleanName.substring(0, 3).padEnd(3, 'X');
		if (!usedAbbreviations.has(abbrev)) {
			return abbrev;
		}

		// Strategy 2: First letter + next 2 consonants
		const consonants = getConsonants(cleanName.substring(1));
		abbrev = (cleanName[0] + consonants.substring(0, 2)).padEnd(3, 'X');
		if (!usedAbbreviations.has(abbrev)) {
			return abbrev;
		}

		// Strategy 3: First + middle + last character
		if (cleanName.length >= 3) {
			const mid = Math.floor(cleanName.length / 2);
			abbrev = cleanName[0] + cleanName[mid] + cleanName[cleanName.length - 1];
			if (!usedAbbreviations.has(abbrev)) {
				return abbrev;
			}
		}

		// Strategy 4: Add number suffix
		const base = cleanName.substring(0, 2).padEnd(2, 'X');
		for (let i = 1; i <= 9; i++) {
			abbrev = base + i.toString();
			if (!usedAbbreviations.has(abbrev)) {
				return abbrev;
			}
		}

		// Fallback: use folder index
		return 'F' + (folders.indexOf(folders.find(f => f.name === name)!) + 1).toString().padStart(2, '0');
	};

	for (const folder of folders) {
		const abbrev = generateAbbreviation(folder.name);
		abbreviations.set(folder.uri.toString(), abbrev);
		usedAbbreviations.add(abbrev);
	}

	return abbreviations;
}

export class TasksTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem | undefined | null | void> =
		new vscode.EventEmitter<TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private folderAbbreviations: Map<string, string> = new Map();

	refresh(): void {
		// Regenerate abbreviations on refresh
		if (vscode.workspace.workspaceFolders) {
			this.folderAbbreviations = generateFolderAbbreviations(vscode.workspace.workspaceFolders);
		}
		this._onDidChangeTreeData.fire();
	}

	getFolderAbbreviation(folder: vscode.WorkspaceFolder): string {
		return this.folderAbbreviations.get(folder.uri.toString()) || folder.name.substring(0, 3).toUpperCase();
	}

	getFolderAbbreviations(): Map<string, string> {
		return this.folderAbbreviations;
	}

	async getAllTasks(): Promise<(TaskTreeItem | LaunchConfigItem)[]> {
		// Ensure abbreviations are generated
		if (vscode.workspace.workspaceFolders && this.folderAbbreviations.size === 0) {
			this.folderAbbreviations = generateFolderAbbreviations(vscode.workspace.workspaceFolders);
		}

		const tasks = await this.getDedicatedTasks();
		const launchConfigs = await this.getDedicatedLaunchConfigs();
		return [...tasks, ...launchConfigs];
	}

	getTreeItem(element: TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem): Promise<(TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem)[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		// Ensure abbreviations are generated
		if (this.folderAbbreviations.size === 0) {
			this.folderAbbreviations = generateFolderAbbreviations(vscode.workspace.workspaceFolders);
		}

		if (!element) {
			// Root level
			const folders = vscode.workspace.workspaceFolders;

			if (folders.length === 1) {
				// Single folder: show hierarchy directly (no folder wrapper)
				return this.buildHierarchyForFolder(folders[0]);
			} else {
				// Multiple folders: show workspace folders at top level
				const folderItems: WorkspaceFolderItem[] = [];
				for (const folder of folders) {
					const abbreviation = this.getFolderAbbreviation(folder);
					const children = await this.buildHierarchyForFolder(folder);
					folderItems.push(new WorkspaceFolderItem(folder, abbreviation, children));
				}
				return folderItems;
			}
		} else if (element instanceof WorkspaceFolderItem) {
			return element.children;
		} else if (element instanceof GroupTreeItem) {
			return element.children;
		}

		return [];
	}

	private async buildHierarchyForFolder(folder: vscode.WorkspaceFolder): Promise<(TaskTreeItem | LaunchConfigItem | GroupTreeItem)[]> {
		const tasks = await this.getDedicatedTasksForFolder(folder);
		const launchConfigs = await this.getDedicatedLaunchConfigsForFolder(folder);
		const allItems = [...tasks, ...launchConfigs];

		return this.buildHierarchyFromItems(allItems, folder);
	}

	private buildHierarchyFromItems(
		allItems: (TaskTreeItem | LaunchConfigItem)[],
		folder?: vscode.WorkspaceFolder
	): (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[] {
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
				const abbreviation = folder ? this.getFolderAbbreviation(folder) : undefined;
				items.push(new GroupTreeItem(name, childItems, childNode.path, folder, abbreviation));
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
				const folder = this.getTaskWorkspaceFolder(task);
				if (folder) {
					const abbreviation = this.getFolderAbbreviation(folder);
					dedicatedTasks.push(new TaskTreeItem(task, config, folder, abbreviation));
				}
			}
		}

		return dedicatedTasks;
	}

	private async getDedicatedTasksForFolder(folder: vscode.WorkspaceFolder): Promise<TaskTreeItem[]> {
		const allTasks = await vscode.tasks.fetchTasks();
		const dedicatedTasks: TaskTreeItem[] = [];

		for (const task of allTasks) {
			const taskFolder = this.getTaskWorkspaceFolder(task);
			if (!taskFolder || taskFolder.uri.toString() !== folder.uri.toString()) {
				continue;
			}

			const config = await this.getDedicatedTaskConfig(task);

			if (config && !config.hide) {
				const abbreviation = this.getFolderAbbreviation(folder);
				dedicatedTasks.push(new TaskTreeItem(task, config, folder, abbreviation));
			}
		}

		return dedicatedTasks;
	}

	private getTaskWorkspaceFolder(task: vscode.Task): vscode.WorkspaceFolder | undefined {
		if (task.scope && typeof task.scope !== 'number') {
			return task.scope as vscode.WorkspaceFolder;
		}
		return vscode.workspace.workspaceFolders?.[0];
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
			const folderConfigs = await this.getDedicatedLaunchConfigsForFolder(folder);
			dedicatedConfigs.push(...folderConfigs);
		}

		return dedicatedConfigs;
	}

	private async getDedicatedLaunchConfigsForFolder(folder: vscode.WorkspaceFolder): Promise<LaunchConfigItem[]> {
		const dedicatedConfigs: LaunchConfigItem[] = [];
		const launchJsonUri = vscode.Uri.joinPath(folder.uri, '.vscode', 'launch.json');

		try {
			const document = await vscode.workspace.openTextDocument(launchJsonUri);
			const text = document.getText();
			const launchConfig = this.parseJsonWithComments(text);

			if (launchConfig && launchConfig.configurations && Array.isArray(launchConfig.configurations)) {
				for (const config of launchConfig.configurations) {
					if (config.dedicatedTasks && !config.dedicatedTasks.hide) {
						const dedicatedConfig = config.dedicatedTasks as DedicatedTasksConfig;
						const abbreviation = this.getFolderAbbreviation(folder);
						dedicatedConfigs.push(new LaunchConfigItem(
							{ name: config.name, folder },
							dedicatedConfig,
							folder,
							abbreviation
						));
					}
				}
			}
		} catch (error) {
			// launch.json doesn't exist or can't be read
		}

		return dedicatedConfigs;
	}
}
