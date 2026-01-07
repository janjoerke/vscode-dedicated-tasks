# Copilot Instructions for Dedicated Tasks Extension

## Project Overview

A VS Code extension that organizes both `tasks.json` entries and `launch.json` debug configurations into a unified hierarchical tree view with status bar integration. Users add `dedicatedTasks` metadata to their task/launch definitions, and the extension renders them in an Activity Bar sidebar with grouping, icons, and quick-access status bar buttons.

**Multi-folder workspace support**: When a workspace contains multiple folders, the tree view shows workspace folders at the top level with their tasks/groups nested underneath. Tasks are differentiated using 3-character abbreviations (e.g., `[VSC]`, `[API]`) derived from folder names.

## Architecture

### Three-Component Design

1. **extension.ts** - Activation entry point, command registration, file watchers for `.vscode/tasks.json`, `.vscode/launch.json`, and `.vscode/dedicated-tasks.json`
2. **tasksTreeProvider.ts** - Core logic: parses `dedicatedTasks` metadata from both files, builds unified hierarchical tree structure (with workspace folders at top in multi-folder mode), generates folder abbreviations, provides tree data to VS Code's TreeView API
3. **statusBarManager.ts** - Manages status bar items based on user-selected tasks/launch configs/groups per folder, persists configuration in each folder's `.vscode/dedicated-tasks.json`, displays folder abbreviation prefixes in multi-folder workspaces

**Key data flow**: File watchers detect changes → `tasksProvider.refresh()` → regenerates folder abbreviations → re-parses JSON files per folder → rebuilds unified hierarchy → updates both tree view and status bar

### Configuration Schema

Both tasks and launch configurations use the same `dedicatedTasks` metadata structure:

**Tasks** (`options.dedicatedTasks` in `.vscode/tasks.json`):
```json
{
  "label": "$(icon) Display Name",  // Supports VS Code icon syntax
  "statusbarLabel": "$(icon) Short",  // Optional: shorthand for status bar display
  "detail": "Description text",
  "groups": ["Build", ["Development", "Build"]],  // Can be string OR array for hierarchy
  "order": 1,  // Numeric sorting within groups
  "hide": false,  // Exclude from UI
  "categories": ["Development", "CI/CD"]  // Optional: array of categories (defaults to ["default"])
}
```

**Launch Configs** (`dedicatedTasks` at root level in `.vscode/launch.json`):
```json
{
  "name": "Debug Extension",
  "type": "extensionHost",
  "request": "launch",
  "dedicatedTasks": {
    "label": "$(debug) Debug Extension",
    "statusbarLabel": "$(debug) Debug",
    "detail": "Launch extension in debug mode",
    "groups": [["Debug", "Extension"]],
    "order": 1,
    "categories": ["Development"]  // Optional: array of categories
  }
}
```

**Per-Folder Configuration** (`.vscode/dedicated-tasks.json`):
```json
{
  "abbreviation": "API",  // Optional: custom folder abbreviation (overrides auto-generated)
  "statusBar": {
    "itemNames": ["Build"],
    "groups": [["Development"]]
  }
}
```

**Critical**: `groups` field allows both flat strings (`"Build"`) and nested arrays (`["Build", "Frontend"]`) in the same array. Items can appear in multiple locations simultaneously. Tasks and launch configs in the same group are sorted together by `order` field.

## Build System

- **esbuild** bundles TypeScript (not tsc) - see [esbuild.js](esbuild.js)
- **npm run compile** = type-check (tsc --noEmit) + esbuild bundle
- **npm run watch** = parallel watch on both tsc (type checking) and esbuild (bundling)
- Output: `out/extension.js` (single bundled file, not per-file transpilation)

**Don't** run `tsc` alone for building - it only type-checks. Use `npm run compile`.

## Key Implementation Patterns

### Multi-Folder Workspace Support

The extension fully supports multi-folder workspaces:

**Tree View Structure**:
- Single folder: Groups and items shown directly at root
- Multiple folders: `WorkspaceFolderItem` nodes at root, each containing that folder's groups/items

**Folder Abbreviations** (`generateFolderAbbreviations()`):
- Generates unique 3-character abbreviations for each workspace folder
- Algorithm tries in order: first 3 chars → first + 2 consonants → first + middle + last → numbered fallback
- Used as prefixes in status bar (e.g., `[VSC] Build`) and configuration UI
- Stored in `folderAbbreviations` Map keyed by folder URI

**Per-Folder Configuration**:
- Each folder stores its status bar config in `.vscode/dedicated-tasks.json`
- Status bar manager loads and merges configs from all folders
- Config structure: `{ "abbreviation": "XXX", "statusBar": { "itemNames": [...], "groups": [[...]] } }`
- Custom `abbreviation` field overrides the auto-generated folder abbreviation
- When saving status bar config, the `abbreviation` field is preserved

### Unified Tree with Two Item Types

The tree provider handles both `TaskTreeItem` and `LaunchConfigItem` instances:
- **TaskTreeItem**: Wraps `vscode.Task`, stores `workspaceFolder` and `folderAbbreviation`, executes via `vscode.tasks.executeTask()`
- **LaunchConfigItem**: Stores config name + workspace folder + abbreviation, executes via `vscode.debug.startDebugging()`
- **WorkspaceFolderItem**: Container for a workspace folder's items (multi-folder only)
- **GroupTreeItem**: Container for grouped items, supports nesting
- **MessageItem**: Displays informational messages (e.g., "No tasks matching filter")
- All items share the same `DedicatedTasksConfig` interface and sorting/grouping logic

**Tree Item Requirements**:
- Each tree item must have a unique `id` property for `TreeView.reveal()` to work
- Items with children must track `parent` references for `getParent()` implementation
- ID format: `task:${folderUri}:${name}`, `launch:${folderUri}:${name}`, `group:${folderUri}:${path}`, `folder:${folderUri}`

### Tree View Controls

The tree view includes toolbar buttons for navigation:
- **Collapse All**: Uses built-in VS Code command `workbench.actions.treeView.dedicatedTasks.tasksView.collapseAll`
- **Expand All**: Reveals all leaf items via `treeView.reveal()` which expands ancestors
- **Filter**: Shows input box, filters items by name/label/detail, auto-expands to show results
- **Clear Filter**: Clears filter text, preserves current expand/collapse state

**Filter Implementation**:
- `matchesFilter()` checks task name, label, detail, groups, and folder abbreviation
- When filter is active, `GroupTreeItem` and `WorkspaceFolderItem` are created with `isExpanded=true`
- Context key `dedicatedTasks.filterActive` controls clear button visibility

**getParent() Implementation**:
- Required for `TreeView.reveal()` to expand ancestor nodes
- `TaskTreeItem`, `LaunchConfigItem`, `GroupTreeItem` store `parent` property
- `convertNode()` in `buildHierarchyFromItems()` sets parent during hierarchy construction
- `getChildren()` sets parent for `WorkspaceFolderItem` children

### Parsing JSON Files with Comments

VS Code's tasks.json and launch.json support comments. The `parseJsonWithComments()` method strips `//` and `/* */` before `JSON.parse()`. When modifying parsing logic, maintain this comment-stripping behavior.

### Hierarchical Group Building

`buildHierarchyForFolder()` creates a tree for a single folder, `getChildren()` orchestrates:
- Single folder: calls `buildHierarchyForFolder()` directly
- Multi-folder: creates `WorkspaceFolderItem` wrappers, each containing folder's hierarchy
- Merges items from `getDedicatedTasksForFolder()` and `getDedicatedLaunchConfigsForFolder()`
- Normalize `groups` entries to arrays (handle both string and array types)
- Insert each item into ALL specified group paths (not exclusive)
- Recursively create intermediate nodes for nested paths like `["Build", "Frontend", "React"]`

**Sorting**: Groups alphabetically, items (tasks + launch configs) by `order` field (ascending, default 0) within each group.

### Status Bar Parent-Child Selection

`filterItemsForStatusBar()` handles both item types uniformly:
- When user selects a parent group (e.g., "Build"), ALL child items match via `isChildOfGroup()` prefix matching
- Allows configuring entire branches at once regardless of item type
- Status bar items show different commands based on type (runTask vs runLaunchConfig)

### Icon Extraction Pattern

Both item types extract icons using regex `/^\$\(([^)]+)\)\s*/`:
- Pattern: `$(iconName) Label Text` → icon='iconName', label='Label Text'
- Default icons: `play` for tasks, `debug-start` for launch configs
- Always preserve this pattern when displaying labels

### Category Support

The extension supports top-level categorization of tasks and launch configs:

**Category Tracking** (`TasksTreeDataProvider`):
- `selectedCategory`: Currently active category (defaults to `DEFAULT_CATEGORY = 'default'`)
- `availableCategories`: Array of all unique categories found across tasks/launch configs
- `onDidChangeCategories`: Event fired when available categories change
- `collectCategories()`: Scans all items (with `skipCategoryFilter=true`) to build category list from `categories` arrays

**Category Filtering**:
- `getDedicatedTasks()` and `getDedicatedLaunchConfigs()` accept `skipCategoryFilter` parameter
- When `false` (default), only items whose `categories` array includes `selectedCategory` are returned
- When `true`, all items are returned (used by `collectCategories()` to build the category list)
- Tasks can belong to multiple categories via the `categories` array
- `getAllTasks()` returns category-filtered items for status bar

**Category UI**:
- `dedicatedTasks.selectCategory` command shows QuickPick with all categories
- Category dropdown button visible only when `dedicatedTasks.hasMultipleCategories` context is true
- `treeView.title` dynamically updates to show current category name
- Status bar updates when category changes to show only items from selected category

**Category Visibility Logic**:
- Dropdown hidden when all tasks are in the default category
- `hasMultiple = categories.length > 1 || (categories.length === 1 && categories[0] !== DEFAULT_CATEGORY)`

## VS Code API Integration

- **TreeDataProvider**: Implements `getTreeItem()`, `getChildren()`, and `getParent()`, fires `onDidChangeTreeData` for refresh
- **TreeView**: Created via `vscode.window.createTreeView()` for access to `reveal()` method
- **FileSystemWatcher**: Watches both `**/.vscode/tasks.json` and `**/.vscode/launch.json` - onChange/onCreate/onDelete all trigger refresh
- **Commands**: All use `dedicatedTasks.*` namespace:
  - `dedicatedTasks.runTask` - Execute a task
  - `dedicatedTasks.runLaunchConfig` - Start a debug configuration
  - `dedicatedTasks.collapseAll` - Collapse all tree nodes (uses built-in)
  - `dedicatedTasks.expandAll` - Expand all tree nodes (reveals leaf items)
  - `dedicatedTasks.filter` - Show filter input box
  - `dedicatedTasks.clearFilter` - Clear active filter
  - `dedicatedTasks.selectCategory` - Show category picker dropdown (visible only when multiple categories exist)
- **Task Execution**: `vscode.tasks.executeTask(task)` for tasks
- **Debug Execution**: `vscode.debug.startDebugging(folder, configName)` for launch configs
- **Per-folder Config**: Status bar config persisted in each folder's `.vscode/dedicated-tasks.json`

## Testing & Debugging

- **F5**: Launches Extension Development Host (`.vscode/launch.json` assumed standard setup)
- **Test files**: Add test cases to workspace's `.vscode/tasks.json` and `.vscode/launch.json` with varying group structures
- **Verify hierarchy**: Check tree recursion with nested groups like `[["A", "B", "C"], "D", ["A", "E"]]`
- **Test mixed groups**: Verify tasks and launch configs appear together when sharing groups, sorted by `order`
- **Test multi-folder**: Create a multi-folder workspace, verify folder abbreviations are unique and items show folder prefixes in status bar

## Common Modifications

**Adding new metadata fields**:
1. Update `DedicatedTasksConfig` interface in [tasksTreeProvider.ts](tasksTreeProvider.ts)
2. Add to both [schemas/tasks-schema.json](schemas/tasks-schema.json) and [schemas/launch-schema.json](schemas/launch-schema.json) for IntelliSense
3. Handle in constructors or config-parsing methods

**Changing tree display logic**: Modify `buildHierarchyForFolder()` in tasksTreeProvider. Remember to preserve:
- Unified item sorting (`order` field) regardless of item type
- Group sorting (alphabetical)
- Support for both TaskTreeItem and LaunchConfigItem
- Workspace folder info passed to items for multi-folder differentiation

**Status bar behavior**: Edit `filterItemsForStatusBar()` in statusBarManager:
- Parent-child matching relies on array prefix comparison
- Handle both item types uniformly based on shared config interface
- Set appropriate command based on item type (instanceof check)
- Uses per-folder config from merged `MergedStatusBarConfig`

## Schema Validation

Three schemas provide IntelliSense:
- [schemas/tasks-schema.json](schemas/tasks-schema.json) - for tasks.json `options.dedicatedTasks`
- [schemas/launch-schema.json](schemas/launch-schema.json) - for launch.json root-level `dedicatedTasks`
- [schemas/dedicated-tasks-schema.json](schemas/dedicated-tasks-schema.json) - for `.vscode/dedicated-tasks.json` configuration

All registered via `jsonValidation` contribution point in [package.json](package.json). Changes to config structure must update both the TypeScript interface AND the relevant schemas.
