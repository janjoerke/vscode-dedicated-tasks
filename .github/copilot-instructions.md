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
  "detail": "Description text",
  "groups": ["Build", ["Development", "Build"]],  // Can be string OR array for hierarchy
  "order": 1,  // Numeric sorting within groups
  "hide": false  // Exclude from UI
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
    "detail": "Launch extension in debug mode",
    "groups": [["Debug", "Extension"]],
    "order": 1
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
- Config structure: `{ "statusBar": { "itemNames": [...], "groups": [[...]] } }`

### Unified Tree with Two Item Types

The tree provider handles both `TaskTreeItem` and `LaunchConfigItem` instances:
- **TaskTreeItem**: Wraps `vscode.Task`, stores `workspaceFolder` and `folderAbbreviation`, executes via `vscode.tasks.executeTask()`
- **LaunchConfigItem**: Stores config name + workspace folder + abbreviation, executes via `vscode.debug.startDebugging()`
- **WorkspaceFolderItem**: Container for a workspace folder's items (multi-folder only)
- All items share the same `DedicatedTasksConfig` interface and sorting/grouping logic

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

## VS Code API Integration

- **TreeDataProvider**: Implements `getTreeItem()` and `getChildren()`, fires `onDidChangeTreeData` for refresh
- **FileSystemWatcher**: Watches both `**/.vscode/tasks.json` and `**/.vscode/launch.json` - onChange/onCreate/onDelete all trigger refresh
- **Commands**: All use `dedicatedTasks.*` namespace (e.g., `dedicatedTasks.runTask`, `dedicatedTasks.runLaunchConfig`)
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

Two schemas provide IntelliSense:
- [schemas/tasks-schema.json](schemas/tasks-schema.json) - for tasks.json `options.dedicatedTasks`
- [schemas/launch-schema.json](schemas/launch-schema.json) - for launch.json root-level `dedicatedTasks`

Both registered via `jsonValidation` contribution point in [package.json](package.json). Changes to config structure must update both the TypeScript interface AND both schemas.
