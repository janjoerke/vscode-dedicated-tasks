import * as vscode from 'vscode';
import { TaskTreeItem } from './tasksTreeProvider';

interface StatusBarConfig {
	taskLabels: string[];  // Task labels to show
	groups: string[][];    // Group paths to show (all tasks in these groups)
}

export class StatusBarManager {
	private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
	private config: StatusBarConfig;
	private readonly configKey = 'dedicatedTasks.statusBar';

	constructor(private context: vscode.ExtensionContext) {
		// Load saved configuration
		this.config = this.context.globalState.get<StatusBarConfig>(this.configKey, {
			taskLabels: [],
			groups: []
		});
	}

	updateStatusBar(tasks: TaskTreeItem[]): void {
		// Clear existing status bar items
		this.clearStatusBar();

		// Filter tasks based on configuration
		const tasksToShow = this.filterTasksForStatusBar(tasks);

		// Create status bar items
		let priority = 1000;
		for (const taskItem of tasksToShow) {
			const item = vscode.window.createStatusBarItem(
				vscode.StatusBarAlignment.Left,
				priority--
			);

			// Extract icon and label
			const labelText = taskItem.config.label || taskItem.task.name;
			const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
			const icon = iconMatch ? iconMatch[1] : '';
			const displayLabel = iconMatch ? labelText.substring(iconMatch[0].length) : labelText;

			// Set status bar item properties
			item.text = icon ? `$(${icon}) ${displayLabel}` : displayLabel;
			item.tooltip = new vscode.MarkdownString(
				`**${displayLabel}**\n\n${taskItem.config.detail || ''}\n\n---\n\n` +
				`• Click to run\n` +
				`• Right-click to configure status bar`
			);
			item.command = {
				command: 'dedicatedTasks.runTask',
				arguments: [taskItem.task],
				title: 'Run Task'
			};

			// Store task label as ID
			const taskId = taskItem.task.name;
			this.statusBarItems.set(taskId, item);
			item.show();
		}
	}

	private filterTasksForStatusBar(tasks: TaskTreeItem[]): TaskTreeItem[] {
		const filtered: TaskTreeItem[] = [];
		const seenTasks = new Set<string>();

		for (const task of tasks) {
			// Skip if already added
			if (seenTasks.has(task.task.name)) {
				continue;
			}

			// Check if task label is in the list
			if (this.config.taskLabels.includes(task.task.name)) {
				filtered.push(task);
				seenTasks.add(task.task.name);
				continue;
			}

			// Check if any of task's groups match or are children of configured groups
			for (const taskGroup of task.config.groups) {
				const taskGroupPath = Array.isArray(taskGroup) ? taskGroup : [taskGroup];

				for (const configGroup of this.config.groups) {
					// Check if task's group path starts with config group path
					// This allows parent group selection to include all children
					if (this.isChildOfGroup(taskGroupPath, configGroup)) {
						filtered.push(task);
						seenTasks.add(task.task.name);
						break;
					}
				}

				if (seenTasks.has(task.task.name)) {
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


	async configureStatusBar(allTasks: TaskTreeItem[]): Promise<void> {
		// Build a hierarchical structure of all groups
		interface GroupNode {
			path: string[];
			children: Map<string, GroupNode>;
			taskCount: number;
		}

		const rootNode: GroupNode = { path: [], children: new Map(), taskCount: 0 };
		const tasksMap = new Map<string, TaskTreeItem>();

		// Build the tree structure
		for (const task of allTasks) {
			tasksMap.set(task.task.name, task);

			for (const group of task.config.groups) {
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
								taskCount: 0
							});
						}
						currentNode = currentNode.children.get(segment)!;
					}
					currentNode.taskCount++;
				}
			}
		}

		// Create quick pick items with hierarchy
		interface ConfigItem extends vscode.QuickPickItem {
			type: 'task' | 'group';
			taskName?: string;
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
				return node.taskCount;
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
				const suffix = ` (${childNode.taskCount} tasks)`;

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

		// Add individual task items
		items.push({
			label: '$(symbol-event) Individual Tasks',
			kind: vscode.QuickPickItemKind.Separator,
			type: 'task'
		});

		const sortedTasks = Array.from(tasksMap.values())
			.sort((a, b) => a.task.name.localeCompare(b.task.name));

		for (const task of sortedTasks) {
			const isSelected = this.config.taskLabels.includes(task.task.name);
			const labelText = task.config.label || task.task.name;

			// Extract icon if present
			const iconMatch = labelText.match(/^\$\(([^)]+)\)\s*/);
			const displayLabel = iconMatch ? labelText : labelText;

			items.push({
				label: `  ${displayLabel}`,
				description: isSelected ? '$(check) Shown' : '',
				detail: task.config.detail,
				picked: isSelected,
				type: 'task',
				taskName: task.task.name
			});
		}

		// Show quick pick
		const selected = await vscode.window.showQuickPick(items, {
			canPickMany: true,
			title: 'Configure Status Bar Tasks',
			placeHolder: 'Select tasks and groups to show in status bar (parent groups include all children)'
		});

		if (selected) {
			// Update configuration
			this.config.taskLabels = selected
				.filter(item => item.type === 'task' && item.taskName)
				.map(item => item.taskName!);

			this.config.groups = selected
				.filter(item => item.type === 'group' && item.groupPath)
				.map(item => item.groupPath!);

			// Save configuration
			await this.context.globalState.update(this.configKey, this.config);

			// Refresh status bar
			this.updateStatusBar(allTasks);
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
