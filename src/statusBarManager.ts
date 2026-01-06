import * as vscode from 'vscode';
import { TaskTreeItem, LaunchConfigItem, generateFolderAbbreviations } from './tasksTreeProvider';

interface FolderStatusBarConfig {
	itemNames: string[];  // Item names (task or launch config) to show
	groups: string[][];   // Group paths to show (all items in these groups)
}

interface MergedStatusBarConfig {
	// Map of folder URI string to its config
	folders: Map<string, FolderStatusBarConfig>;
}

export class StatusBarManager {
	private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
	private config: MergedStatusBarConfig;
	private folderAbbreviations: Map<string, string> = new Map();
	private readonly configFileName = 'dedicated-tasks.json';

	constructor() {
		this.config = { folders: new Map() };
		this.loadConfigAsync();
	}

	private async loadConfigAsync(): Promise<void> {
		this.config = await this.loadAllConfigs();
	}

	private async loadAllConfigs(): Promise<MergedStatusBarConfig> {
		const result: MergedStatusBarConfig = { folders: new Map() };

		if (!vscode.workspace.workspaceFolders) {
			return result;
		}

		// Generate abbreviations
		this.folderAbbreviations = generateFolderAbbreviations(vscode.workspace.workspaceFolders);

		for (const folder of vscode.workspace.workspaceFolders) {
			const configUri = vscode.Uri.joinPath(folder.uri, '.vscode', this.configFileName);

			try {
				const content = await vscode.workspace.fs.readFile(configUri);
				const text = new TextDecoder().decode(content);
				const parsed = JSON.parse(text);
				result.folders.set(folder.uri.toString(), {
					itemNames: parsed.statusBar?.itemNames || [],
					groups: parsed.statusBar?.groups || []
				});
			} catch {
				// Config doesn't exist for this folder, use empty config
				result.folders.set(folder.uri.toString(), {
					itemNames: [],
					groups: []
				});
			}
		}

		return result;
	}

	private async saveConfigForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
		const configUri = vscode.Uri.joinPath(folder.uri, '.vscode', this.configFileName);
		const folderConfig = this.config.folders.get(folder.uri.toString()) || { itemNames: [], groups: [] };

		const configData = {
			statusBar: folderConfig
		};

		const content = new TextEncoder().encode(JSON.stringify(configData, null, 2));
		await vscode.workspace.fs.writeFile(configUri, content);
	}

	async reloadConfig(): Promise<void> {
		this.config = await this.loadAllConfigs();
	}

	private getFolderAbbreviation(folder: vscode.WorkspaceFolder): string {
		return this.folderAbbreviations.get(folder.uri.toString()) || folder.name.substring(0, 3).toUpperCase();
	}

	private isMultiFolderWorkspace(): boolean {
		return (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
	}

	updateStatusBar(items: (TaskTreeItem | LaunchConfigItem)[]): void {
		// Clear existing status bar items
		this.clearStatusBar();

		// Regenerate abbreviations if needed
		if (vscode.workspace.workspaceFolders) {
			this.folderAbbreviations = generateFolderAbbreviations(vscode.workspace.workspaceFolders);
		}

		// Filter items based on configuration
		const itemsToShow = this.filterItemsForStatusBar(items);

		const isMultiFolder = this.isMultiFolderWorkspace();

		// Create status bar items
		let priority = 1000;
		for (const item of itemsToShow) {
			const statusBarItem = vscode.window.createStatusBarItem(
				vscode.StatusBarAlignment.Left,
				priority--
			);

			// Get name and label depending on item type
			const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;
			const labelText = item.config.label || itemName;
			const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
			const icon = iconMatch ? iconMatch[1] : '';
			const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

			// Add folder abbreviation prefix in multi-folder workspaces
			const folderPrefix = isMultiFolder ? `[${item.folderAbbreviation}] ` : '';

			// Set status bar item properties
			statusBarItem.text = icon ? `$(${icon}) ${folderPrefix}${displayLabel}` : `${folderPrefix}${displayLabel}`;
			statusBarItem.tooltip = new vscode.MarkdownString(
				`**${displayLabel}**\n\n` +
				(isMultiFolder ? `*Folder: ${item.workspaceFolder.name} (${item.folderAbbreviation})*\n\n` : '') +
				`${item.config.detail || ''}\n\n---\n\n` +
				`• Click to run\n` +
				`• Right-click to configure status bar`
			);

			if (item instanceof TaskTreeItem) {
				statusBarItem.command = {
					command: 'dedicatedTasks.runTask',
					arguments: [item.task],
					title: 'Run Task'
				};
			} else {
				statusBarItem.command = {
					command: 'dedicatedTasks.runLaunchConfig',
					arguments: [item.launchConfig.name, item.launchConfig.folder],
					title: 'Run Launch Configuration'
				};
			}

			// Store with unique ID (include folder to differentiate same-named tasks)
			const itemId = isMultiFolder ? `${item.folderAbbreviation}:${itemName}` : itemName;
			this.statusBarItems.set(itemId, statusBarItem);
			statusBarItem.show();
		}
	}

	private filterItemsForStatusBar(items: (TaskTreeItem | LaunchConfigItem)[]): (TaskTreeItem | LaunchConfigItem)[] {
		const filtered: (TaskTreeItem | LaunchConfigItem)[] = [];
		const seenItems = new Set<string>();
		const isMultiFolder = this.isMultiFolderWorkspace();

		for (const item of items) {
			const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;
			const folderUri = item.workspaceFolder.uri.toString();

			// Create unique key for this item (folder + name in multi-folder)
			const uniqueKey = isMultiFolder ? `${folderUri}:${itemName}` : itemName;

			// Skip if already added
			if (seenItems.has(uniqueKey)) {
				continue;
			}

			// Get the config for this item's folder
			const folderConfig = this.config.folders.get(folderUri) || { itemNames: [], groups: [] };

			// Check if item name is in the folder's list
			if (folderConfig.itemNames.includes(itemName)) {
				filtered.push(item);
				seenItems.add(uniqueKey);
				continue;
			}

			// Check if any of item's groups match or are children of configured groups
			for (const itemGroup of item.config.groups) {
				const itemGroupPath = Array.isArray(itemGroup) ? itemGroup : [itemGroup];

				for (const configGroup of folderConfig.groups) {
					// Check if item's group path starts with config group path
					// This allows parent group selection to include all children
					if (this.isChildOfGroup(itemGroupPath, configGroup)) {
						filtered.push(item);
						seenItems.add(uniqueKey);
						break;
					}
				}

				if (seenItems.has(uniqueKey)) {
					break;
				}
			}
		}

		// Sort filtered items by folder abbreviation first (for multi-folder), then by order field
		filtered.sort((a, b) => {
			if (isMultiFolder) {
				const folderCompare = a.folderAbbreviation.localeCompare(b.folderAbbreviation);
				if (folderCompare !== 0) {
					return folderCompare;
				}
			}
			const orderA = a.config.order ?? 0;
			const orderB = b.config.order ?? 0;
			return orderA - orderB;
		});

		return filtered;
	}

	private isChildOfGroup(taskPath: string[], parentPath: string[]): boolean {
		// Check if taskPath starts with all segments of parentPath
		if (taskPath.length < parentPath.length) {
			return false;
		}

		return parentPath.every((segment, index) => taskPath[index] === segment);
	}


	async configureStatusBar(allItems: (TaskTreeItem | LaunchConfigItem)[]): Promise<void> {
		const isMultiFolder = this.isMultiFolderWorkspace();
		const folders = vscode.workspace.workspaceFolders || [];

		// Regenerate abbreviations
		if (folders.length > 0) {
			this.folderAbbreviations = generateFolderAbbreviations(folders);
		}

		// Build per-folder hierarchical structures
		interface GroupNode {
			path: string[];
			children: Map<string, GroupNode>;
			itemCount: number;
			folderUri: string;
		}

		interface FolderData {
			folder: vscode.WorkspaceFolder;
			abbreviation: string;
			rootNode: GroupNode;
			items: (TaskTreeItem | LaunchConfigItem)[];
		}

		const folderDataMap = new Map<string, FolderData>();

		// Initialize folder data
		for (const folder of folders) {
			folderDataMap.set(folder.uri.toString(), {
				folder,
				abbreviation: this.getFolderAbbreviation(folder),
				rootNode: { path: [], children: new Map(), itemCount: 0, folderUri: folder.uri.toString() },
				items: []
			});
		}

		// Build the tree structure per folder
		for (const item of allItems) {
			const folderUri = item.workspaceFolder.uri.toString();
			const folderData = folderDataMap.get(folderUri);
			if (!folderData) { continue; }

			folderData.items.push(item);

			for (const group of item.config.groups) {
				const groupPath = Array.isArray(group) ? group : [group];

				// Add this path and all parent paths
				for (let depth = 1; depth <= groupPath.length; depth++) {
					const partialPath = groupPath.slice(0, depth);
					let currentNode = folderData.rootNode;

					for (let i = 0; i < partialPath.length; i++) {
						const segment = partialPath[i];
						if (!currentNode.children.has(segment)) {
							currentNode.children.set(segment, {
								path: partialPath.slice(0, i + 1),
								children: new Map(),
								itemCount: 0,
								folderUri
							});
						}
						currentNode = currentNode.children.get(segment)!;
					}
					currentNode.itemCount++;
				}
			}
		}

		// Create quick pick items with hierarchy
		interface ConfigItem extends vscode.QuickPickItem {
			type: 'item' | 'group' | 'folder-header';
			itemName?: string;
			groupPath?: string[];
			folderUri?: string;
			depth?: number;
		}

		const items: ConfigItem[] = [];

		// Helper to check if a group is selected for a specific folder
		const isGroupSelected = (folderUri: string, path: string[]): boolean => {
			const folderConfig = this.config.folders.get(folderUri) || { itemNames: [], groups: [] };
			return folderConfig.groups.some(g =>
				JSON.stringify(g) === JSON.stringify(path)
			);
		};

		// Helper to check if an item is selected for a specific folder
		const isItemSelected = (folderUri: string, itemName: string): boolean => {
			const folderConfig = this.config.folders.get(folderUri) || { itemNames: [], groups: [] };
			return folderConfig.itemNames.includes(itemName);
		};

		// Helper to count selected items in a subtree
		const countSelectedInSubtree = (folderUri: string, node: GroupNode): number => {
			let count = 0;

			// Check if this node itself is selected
			if (node.path.length > 0 && isGroupSelected(folderUri, node.path)) {
				return node.itemCount;
			}

			// Check children
			for (const child of node.children.values()) {
				count += countSelectedInSubtree(folderUri, child);
			}

			return count;
		};

		// Build hierarchical group items for a folder
		const addGroupItems = (folderUri: string, node: GroupNode, depth: number = 0) => {
			const sortedChildren = Array.from(node.children.entries())
				.sort((a, b) => a[0].localeCompare(b[0]));

			for (const [name, childNode] of sortedChildren) {
				const isSelected = isGroupSelected(folderUri, childNode.path);
				const selectedCount = countSelectedInSubtree(folderUri, childNode);
				const hasChildren = childNode.children.size > 0;

				const indent = '  '.repeat(depth + (isMultiFolder ? 1 : 0));
				const icon = hasChildren ? '$(folder)' : '$(symbol-namespace)';
				const suffix = ` (${childNode.itemCount} items)`;

				let description = '';
				if (isSelected) {
					description = '$(check) Shown';
				} else if (selectedCount > 0) {
					description = `$(circle-outline) ${selectedCount} shown`;
				}

				items.push({
					label: `${indent}${icon} ${name}${suffix}`,
					description: description,
					detail: childNode.path.join(' $(chevron-right) '),
					picked: isSelected,
					type: 'group',
					groupPath: childNode.path,
					folderUri: folderUri,
					depth: depth
				});

				// Recursively add children
				addGroupItems(folderUri, childNode, depth + 1);
			}
		};

		// Build items for each folder
		for (const [folderUri, folderData] of folderDataMap) {
			// Skip folders with no items
			if (folderData.items.length === 0) {
				continue;
			}

			// Add folder header in multi-folder workspace
			if (isMultiFolder) {
				items.push({
					label: `$(root-folder) ${folderData.folder.name} [${folderData.abbreviation}]`,
					kind: vscode.QuickPickItemKind.Separator,
					type: 'folder-header',
					folderUri
				});
			}

			// Add groups section
			if (folderData.rootNode.children.size > 0) {
				if (!isMultiFolder) {
					items.push({
						label: '$(folder-opened) Groups & Hierarchies',
						kind: vscode.QuickPickItemKind.Separator,
						type: 'group'
					});
				}
				addGroupItems(folderUri, folderData.rootNode);
			}

			// Add individual items
			const indentPrefix = isMultiFolder ? '  ' : '';

			items.push({
				label: `${indentPrefix}$(symbol-event) Individual Items`,
				kind: vscode.QuickPickItemKind.Separator,
				type: 'item',
				folderUri
			});

			const sortedFolderItems = folderData.items.sort((a, b) => {
				const nameA = a instanceof TaskTreeItem ? a.task.name : a.launchConfig.name;
				const nameB = b instanceof TaskTreeItem ? b.task.name : b.launchConfig.name;
				return nameA.localeCompare(nameB);
			});

			for (const item of sortedFolderItems) {
				const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;
				const isSelected = isItemSelected(folderUri, itemName);
				const labelText = item.config.label || itemName;

				// Extract icon if present
				const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
				const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

				// Add type indicator
				const typeIcon = item instanceof TaskTreeItem ? '$(play)' : '$(debug-start)';
				const indent = isMultiFolder ? '    ' : '  ';

				items.push({
					label: `${indent}${typeIcon} ${displayLabel}`,
					description: isSelected ? '$(check) Shown' : '',
					detail: item.config.detail,
					picked: isSelected,
					type: 'item',
					itemName: itemName,
					folderUri: folderUri
				});
			}
		}

		// Show quick pick
		const selected = await vscode.window.showQuickPick(items, {
			canPickMany: true,
			title: 'Configure Status Bar Items',
			placeHolder: isMultiFolder
				? 'Select tasks/configs from each folder to show in status bar'
				: 'Select tasks/launch configs and groups to show in status bar (parent groups include all children)'
		});

		if (selected) {
			// Group selections by folder
			const folderSelections = new Map<string, { itemNames: string[]; groups: string[][] }>();

			// Initialize with existing folders
			for (const folder of folders) {
				folderSelections.set(folder.uri.toString(), { itemNames: [], groups: [] });
			}

			// Process selections
			for (const sel of selected) {
				if (!sel.folderUri) { continue; }

				const folderSel = folderSelections.get(sel.folderUri);
				if (!folderSel) { continue; }

				if (sel.type === 'item' && sel.itemName) {
					folderSel.itemNames.push(sel.itemName);
				} else if (sel.type === 'group' && sel.groupPath) {
					folderSel.groups.push(sel.groupPath);
				}
			}

			// Update config and save per folder
			for (const [folderUri, selections] of folderSelections) {
				this.config.folders.set(folderUri, selections);

				// Find the folder and save
				const folder = folders.find(f => f.uri.toString() === folderUri);
				if (folder) {
					await this.saveConfigForFolder(folder);
				}
			}

			// Refresh status bar
			this.updateStatusBar(allItems);
		}
	}

	clearStatusBar(): void {
		for (const item of this.statusBarItems.values()) {
			item.dispose();
		}
		this.statusBarItems.clear();
	}

	dispose(): void {
		this.clearStatusBar();
	}
}
