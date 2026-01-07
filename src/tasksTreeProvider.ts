import * as vscode from 'vscode';

export interface DedicatedTasksConfig {
	label?: string;
	detail?: string;
	hide?: boolean;
	groups: (string | string[])[];
	order?: number;
}

export type TreeItemType = TaskTreeItem | LaunchConfigItem | GroupTreeItem | WorkspaceFolderItem | MessageItem;
export type TreeItemChildren = TaskTreeItem | LaunchConfigItem | GroupTreeItem;
export type TreeEventType = TreeItemType | undefined | null | void;

export interface TaskWithConfig extends vscode.Task {
	dedicatedUiConfig?: DedicatedTasksConfig;
}

export type ActionItemType = 'task' | 'launch';

export class TaskTreeItem extends vscode.TreeItem {
	public parent?: GroupTreeItem | WorkspaceFolderItem;

	constructor(
		public readonly task: vscode.Task,
		public readonly config: DedicatedTasksConfig,
		public readonly workspaceFolder: vscode.WorkspaceFolder,
		public readonly folderAbbreviation: string,
		public readonly itemType: ActionItemType = 'task'
	) {
		const labelText = config.label || task.name;

		// Extract icon from label (format: "$(iconName) text")
		const iconRegex = /^\$\(([^)]+)\)\s*/;
		const iconMatch = iconRegex.exec(labelText);
		const icon = iconMatch ? iconMatch[1] : 'play';
		const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

		super(displayLabel, vscode.TreeItemCollapsibleState.None);

		// Unique ID for this task item
		this.id = `task:${workspaceFolder.uri.toString()}:${task.name}`;

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
	public parent?: GroupTreeItem | WorkspaceFolderItem;

	constructor(
		public readonly launchConfig: { name: string; folder: vscode.WorkspaceFolder },
		public readonly config: DedicatedTasksConfig,
		public readonly workspaceFolder: vscode.WorkspaceFolder,
		public readonly folderAbbreviation: string,
		public readonly itemType: ActionItemType = 'launch'
	) {
		const labelText = config.label || launchConfig.name;

		// Extract icon from label (format: "$(iconName) text")
		const iconRegex = /^\$\(([^)]+)\)\s*/;
		const iconMatch = iconRegex.exec(labelText);
		const icon = iconMatch ? iconMatch[1] : 'debug-start';
		const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

		super(displayLabel, vscode.TreeItemCollapsibleState.None);

		// Unique ID for this launch config item
		this.id = `launch:${workspaceFolder.uri.toString()}:${launchConfig.name}`;

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
		public readonly children: TreeItemChildren[],
		isExpanded: boolean = false
	) {
		super(folder.name, isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);

		// Unique ID for this workspace folder item
		this.id = `folder:${folder.uri.toString()}`;

		this.description = `[${abbreviation}]`;
		this.tooltip = `${folder.name} (${abbreviation})\n${folder.uri.fsPath}`;
		this.contextValue = 'workspaceFolder';
		this.iconPath = new vscode.ThemeIcon('root-folder');
	}
}

export class MessageItem extends vscode.TreeItem {
	constructor(message: string, icon?: string) {
		super(message, vscode.TreeItemCollapsibleState.None);
		this.contextValue = 'message';
		this.iconPath = new vscode.ThemeIcon(icon || 'info');
	}
}

export class GroupTreeItem extends vscode.TreeItem {
	public parent?: GroupTreeItem | WorkspaceFolderItem;
	private _children: TreeItemChildren[];

	constructor(
		public readonly label: string,
		children: TreeItemChildren[],
		public readonly path: string[],
		public readonly workspaceFolder?: vscode.WorkspaceFolder,
		public readonly folderAbbreviation?: string,
		isExpanded: boolean = false
	) {
		super(label, isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
		this._children = children;

		// Unique ID based on path and folder
		const folderUri = workspaceFolder?.uri.toString() || 'global';
		this.id = `group:${folderUri}:${path.join('/')}`;

		this.contextValue = 'group';

		// Count items recursively
		const itemCount = this.countItems(children);
		if (itemCount > 0) {
			this.description = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
		}

		this.iconPath = new vscode.ThemeIcon('symbol-folder');
	}

	get children(): TreeItemChildren[] {
		return this._children;
	}

	set children(value: TreeItemChildren[]) {
		this._children = value;
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
		return str.replaceAll(/[aeiouAEIOU\s\-_.]/g, '');
	};

	const generateAbbreviation = (name: string): string => {
		const cleanName = name.replaceAll(/[\s\-_.]/g, '').toUpperCase();

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
			abbrev = cleanName[0] + cleanName[mid] + cleanName.at(-1);
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

export class TasksTreeDataProvider implements vscode.TreeDataProvider<TreeItemType> {
	private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeEventType> =
		new vscode.EventEmitter<TreeEventType>();
	readonly onDidChangeTreeData: vscode.Event<TreeEventType> =
		this._onDidChangeTreeData.event;

	private folderAbbreviations: Map<string, string> = new Map();
	private filterText: string = '';

	refresh(): void {
		// Regenerate abbreviations on refresh
		if (vscode.workspace.workspaceFolders) {
			this.folderAbbreviations = generateFolderAbbreviations(vscode.workspace.workspaceFolders);
		}
		this._onDidChangeTreeData.fire();
	}

	setFilter(text: string): void {
		this.filterText = text.toLowerCase();
		this._onDidChangeTreeData.fire();
	}

	getFilterText(): string {
		return this.filterText;
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

	getTreeItem(element: TreeItemType): vscode.TreeItem {
		return element;
	}

	getParent(element: TreeItemType): vscode.ProviderResult<TreeItemType> {
		if (element instanceof TaskTreeItem || element instanceof LaunchConfigItem || element instanceof GroupTreeItem) {
			return element.parent;
		}
		// WorkspaceFolderItem and MessageItem have no parent (they are root level)
		return undefined;
	}

	async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
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
				const hierarchy = await this.buildHierarchyForFolder(folders[0]);
				if (hierarchy.length === 0 && this.filterText) {
					return [new MessageItem(`No tasks matching "${this.filterText}"`, 'search')];
				}
				return hierarchy;
			} else {
				// Multiple folders: show workspace folders at top level
				const folderItems: WorkspaceFolderItem[] = [];
				let totalItems = 0;
				for (const folder of folders) {
					const abbreviation = this.getFolderAbbreviation(folder);
					const children = await this.buildHierarchyForFolder(folder);
					totalItems += children.length;
					// Only add folder if it has children (when filtering)
					if (children.length > 0 || !this.filterText) {
						// Expand when filter is active, collapse by default
						const folderItem = new WorkspaceFolderItem(folder, abbreviation, children, !!this.filterText);
						// Set parent reference for all children
						for (const child of children) {
							if (child instanceof GroupTreeItem || child instanceof TaskTreeItem || child instanceof LaunchConfigItem) {
								child.parent = folderItem;
							}
						}
						folderItems.push(folderItem);
					}
				}
				if (folderItems.length === 0 && this.filterText) {
					return [new MessageItem(`No tasks matching "${this.filterText}"`, 'search')];
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

	private async buildHierarchyForFolder(folder: vscode.WorkspaceFolder): Promise<TreeItemChildren[]> {
		const tasks = await this.getDedicatedTasksForFolder(folder);
		const launchConfigs = await this.getDedicatedLaunchConfigsForFolder(folder);
		let allItems = [...tasks, ...launchConfigs];

		// Apply filter if set
		if (this.filterText) {
			allItems = allItems.filter(item => this.matchesFilter(item));
		}

		return this.buildHierarchyFromItems(allItems, folder);
	}

	private matchesFilter(item: TaskTreeItem | LaunchConfigItem): boolean {
		if (!this.filterText) {
			return true;
		}

		// Check task/launch config name
		const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;
		if (itemName.toLowerCase().includes(this.filterText)) {
			return true;
		}

		// Check label
		const labelText = item.config.label || '';
		if (labelText.toLowerCase().includes(this.filterText)) {
			return true;
		}

		// Check detail
		const detailText = item.config.detail || '';
		if (detailText.toLowerCase().includes(this.filterText)) {
			return true;
		}

		// Check groups
		for (const group of item.config.groups) {
			const groupPath = Array.isArray(group) ? group : [group];
			if (groupPath.some(g => g.toLowerCase().includes(this.filterText))) {
				return true;
			}
		}

		return false;
	}

	private buildHierarchyFromItems(
		allItems: (TaskTreeItem | LaunchConfigItem)[],
		folder?: vscode.WorkspaceFolder
	): TreeItemChildren[] {
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
		const convertNode = (node: HierarchyNode, parentItem?: GroupTreeItem): TreeItemChildren[] => {
			const items: (TaskTreeItem | LaunchConfigItem | GroupTreeItem)[] = [];

			// Add subgroups first (sorted alphabetically)
			const sortedGroups = Array.from(node.children.entries())
				.sort((a, b) => a[0].localeCompare(b[0]));

			for (const [name, childNode] of sortedGroups) {
				const abbreviation = folder ? this.getFolderAbbreviation(folder) : undefined;
				// Create group first, then get children with parent reference
				const groupItem = new GroupTreeItem(name, [], childNode.path, folder, abbreviation, !!this.filterText);
				groupItem.parent = parentItem;

				// Now get children with this group as parent
				const childItems = convertNode(childNode, groupItem);
				// Update children array (we had to create empty first to have the reference)
				groupItem.children = childItems;

				items.push(groupItem);
			}

			// Then add items (tasks and launch configs sorted by order)
			const sortedItems = [...node.items].sort((a, b) => {
				const orderA = a.config.order ?? 0;
				const orderB = b.config.order ?? 0;
				return orderA - orderB;
			});

			// Set parent for leaf items
			for (const item of sortedItems) {
				item.parent = parentItem;
			}

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
			return task.scope;
		}
		return vscode.workspace.workspaceFolders?.[0];
	}

	private async getDedicatedTaskConfig(task: vscode.Task): Promise<DedicatedTasksConfig | undefined> {
		// Get the workspace folder for this task
		let workspaceFolder: vscode.WorkspaceFolder | undefined;

		if (task.scope && typeof task.scope !== 'number') {
			workspaceFolder = task.scope;
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

			if (tasksConfig?.tasks && Array.isArray(tasksConfig.tasks)) {
				// Find the matching task by label
				const taskDef = tasksConfig.tasks.find((t: any) => t.label === task.name);

				if (taskDef?.options?.dedicatedTasks) {
					return taskDef.options.dedicatedTasks;
				}
			}
		} catch {
			// tasks.json doesn't exist or can't be read
			return undefined;
		}

		return undefined;
	}

	private parseJsonWithComments(text: string): any {
		// Simple comment stripping - remove // and /* */ comments
		const withoutComments = text
			.replaceAll(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
			.replaceAll(/\/\/.*/g, ''); // Remove // comments

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

			if (launchConfig?.configurations && Array.isArray(launchConfig.configurations)) {
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
		} catch {
			// launch.json doesn't exist or can't be read
		}

		return dedicatedConfigs;
	}
}
