import * as vscode from 'vscode';
import { TaskTreeItem, LaunchConfigItem } from './tasksTreeProvider';

interface StatusBarConfig {
	itemNames: string[];  // Item names (task or launch config) to show
	groups: string[][];    // Group paths to show (all items in these groups)
}

export class StatusBarManager {
	private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
	private config: StatusBarConfig;
	private readonly configKey = 'dedicatedTasks.statusBar';

	constructor(private context: vscode.ExtensionContext) {
		// Load saved configuration
		this.config = this.context.globalState.get<StatusBarConfig>(this.configKey, {
			itemNames: [],
			groups: []
		});
	}

	updateStatusBar(items: (TaskTreeItem | LaunchConfigItem)[]): void {
		// Clear existing status bar items
		this.clearStatusBar();

		// Filter items based on configuration
		const itemsToShow = this.filterItemsForStatusBar(items);

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

			// Set status bar item properties
			statusBarItem.text = icon ? `$(${icon}) ${displayLabel}` : displayLabel;
			statusBarItem.tooltip = new vscode.MarkdownString(
				`**${displayLabel}**\n\n${item.config.detail || ''}\n\n---\n\n` +
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

			// Store with unique ID
			const itemId = itemName;
			this.statusBarItems.set(itemId, statusBarItem);
			statusBarItem.show();
		}
	}

	private filterItemsForStatusBar(items: (TaskTreeItem | LaunchConfigItem)[]): (TaskTreeItem | LaunchConfigItem)[] {
		const filtered: (TaskTreeItem | LaunchConfigItem)[] = [];
		const seenItems = new Set<string>();

		for (const item of items) {
			const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;

			// Skip if already added
			if (seenItems.has(itemName)) {
				continue;
			}

			// Check if item name is in the list
			if (this.config.itemNames.includes(itemName)) {
				filtered.push(item);
				seenItems.add(itemName);
				continue;
			}

			// Check if any of item's groups match or are children of configured groups
			for (const itemGroup of item.config.groups) {
				const itemGroupPath = Array.isArray(itemGroup) ? itemGroup : [itemGroup];

				for (const configGroup of this.config.groups) {
					// Check if item's group path starts with config group path
					// This allows parent group selection to include all children
					if (this.isChildOfGroup(itemGroupPath, configGroup)) {
						filtered.push(item);
						seenItems.add(itemName);
						break;
					}
				}

				if (seenItems.has(itemName)) {
					break;
				}
			}
		}

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
		// Build a hierarchical structure of all groups
		interface GroupNode {
			path: string[];
			children: Map<string, GroupNode>;
			itemCount: number;
		}

		const rootNode: GroupNode = { path: [], children: new Map(), itemCount: 0 };
		const itemsMap = new Map<string, TaskTreeItem | LaunchConfigItem>();

		// Build the tree structure
		for (const item of allItems) {
			const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;
			itemsMap.set(itemName, item);

			for (const group of item.config.groups) {
				const groupPath = Array.isArray(group) ? group : [group];

				// Add this path and all parent paths
				for (let depth = 1; depth <= groupPath.length; depth++) {
					const partialPath = groupPath.slice(0, depth);
					let currentNode = rootNode;

					for (let i = 0; i < partialPath.length; i++) {
						const segment = partialPath[i];
						if (!currentNode.children.has(segment)) {
							currentNode.children.set(segment, {
								path: partialPath.slice(0, i + 1),
								children: new Map(),
								itemCount: 0
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
			type: 'item' | 'group';
			itemName?: string;
			groupPath?: string[];
			depth?: number;
		}

		const items: ConfigItem[] = [];

		// Helper to check if a group is selected
		const isGroupSelected = (path: string[]): boolean => {
			return this.config.groups.some(g =>
				JSON.stringify(g) === JSON.stringify(path)
			);
		};

		// Helper to count selected items in a subtree
		const countSelectedInSubtree = (node: GroupNode): number => {
			let count = 0;

			// Check if this node itself is selected
			if (node.path.length > 0 && isGroupSelected(node.path)) {
				return node.itemCount;
			}

			// Check children
			for (const child of node.children.values()) {
				count += countSelectedInSubtree(child);
			}

			return count;
		};

		// Build hierarchical group items
		const addGroupItems = (node: GroupNode, depth: number = 0) => {
			const sortedChildren = Array.from(node.children.entries())
				.sort((a, b) => a[0].localeCompare(b[0]));

			for (const [name, childNode] of sortedChildren) {
				const isSelected = isGroupSelected(childNode.path);
				const selectedCount = countSelectedInSubtree(childNode);
				const hasChildren = childNode.children.size > 0;

				const indent = '  '.repeat(depth);
				const icon = hasChildren ? (depth === 0 ? '$(folder)' : '$(folder)') : '$(symbol-namespace)';
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
					depth: depth
				});

				// Recursively add children
				addGroupItems(childNode, depth + 1);
			}
		};

		// Add separator and groups
		items.push({
			label: '$(folder-opened) Groups & Hierarchies',
			kind: vscode.QuickPickItemKind.Separator,
			type: 'group'
		});

		addGroupItems(rootNode);

		// Add individual items (tasks and launch configs)
		items.push({
			label: '$(symbol-event) Individual Items',
			kind: vscode.QuickPickItemKind.Separator,
			type: 'item'
		});

		const sortedItems = Array.from(itemsMap.values())
			.sort((a, b) => {
				const nameA = a instanceof TaskTreeItem ? a.task.name : a.launchConfig.name;
				const nameB = b instanceof TaskTreeItem ? b.task.name : b.launchConfig.name;
				return nameA.localeCompare(nameB);
			});

		for (const item of sortedItems) {
			const itemName = item instanceof TaskTreeItem ? item.task.name : item.launchConfig.name;
			const isSelected = this.config.itemNames.includes(itemName);
			const labelText = item.config.label || itemName;

			// Extract icon if present
			const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
			const displayLabel = iconMatch ? labelText : labelText;

			// Add type indicator
			const typeIcon = item instanceof TaskTreeItem ? '$(play)' : '$(debug-start)';

			items.push({
				label: `  ${typeIcon} ${displayLabel}`,
				description: isSelected ? '$(check) Shown' : '',
				detail: item.config.detail,
				picked: isSelected,
				type: 'item',
				itemName: itemName
			});
		}

		// Show quick pick
		const selected = await vscode.window.showQuickPick(items, {
			canPickMany: true,
			title: 'Configure Status Bar Items',
			placeHolder: 'Select tasks/launch configs and groups to show in status bar (parent groups include all children)'
		});

		if (selected) {
			// Update configuration
			this.config.itemNames = selected
				.filter(item => item.type === 'item' && item.itemName)
				.map(item => item.itemName!);

			this.config.groups = selected
				.filter(item => item.type === 'group' && item.groupPath)
				.map(item => item.groupPath!);

			// Save configuration
			await this.context.globalState.update(this.configKey, this.config);

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
