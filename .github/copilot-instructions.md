# Copilot Instructions for Dedicated Tasks Extension

## Project Overview

A VS Code extension that organizes `tasks.json` entries into a hierarchical tree view with status bar integration. Users add `dedicatedTasks` metadata to their task definitions, and the extension renders them in an Activity Bar sidebar with grouping, icons, and quick-access status bar buttons.

## Architecture

### Three-Component Design

1. **extension.ts** - Activation entry point, command registration, file watcher for `.vscode/tasks.json`
2. **tasksTreeProvider.ts** - Core logic: parses `dedicatedTasks` metadata from tasks.json, builds hierarchical tree structure, provides tree data to VS Code's TreeView API
3. **statusBarManager.ts** - Manages status bar items based on user-selected tasks/groups, persists configuration in `globalState`

**Key data flow**: File watcher detects tasks.json changes → `tasksProvider.refresh()` → re-parses tasks.json → rebuilds hierarchy → updates both tree view and status bar

### Configuration Schema

Tasks are enriched with `options.dedicatedTasks` object in `.vscode/tasks.json`:
```json
{
  "label": "$(icon) Display Name",  // Supports VS Code icon syntax
  "detail": "Description text",
  "groups": ["Build", ["Development", "Build"]],  // Can be string OR array for hierarchy
  "order": 1,  // Numeric sorting within groups
  "hide": false  // Exclude from UI
}
```

**Critical**: `groups` field allows both flat strings (`"Build"`) and nested arrays (`["Build", "Frontend"]`) in the same array. Tasks can appear in multiple locations simultaneously.

## Build System

- **esbuild** bundles TypeScript (not tsc) - see [esbuild.js](esbuild.js)
- **npm run compile** = type-check (tsc --noEmit) + esbuild bundle
- **npm run watch** = parallel watch on both tsc (type checking) and esbuild (bundling)
- Output: `out/extension.js` (single bundled file, not per-file transpilation)

**Don't** run `tsc` alone for building - it only type-checks. Use `npm run compile`.

## Key Implementation Patterns

### Parsing tasks.json with Comments

VS Code's tasks.json supports comments. [tasksTreeProvider.ts#L239-L248](tasksTreeProvider.ts#L239-L248) strips `//` and `/* */` before `JSON.parse()`. When modifying task parsing logic, maintain this comment-stripping behavior.

### Hierarchical Group Building

[tasksTreeProvider.ts#L121-L156](tasksTreeProvider.ts#L121-L156) builds a tree from flat group paths:
- Normalize `groups` entries to arrays (handle both string and array types)
- Insert each task into ALL specified group paths (not exclusive)
- Recursively create intermediate nodes for nested paths like `["Build", "Frontend", "React"]`

**Sorting**: Groups alphabetically, tasks by `order` field (ascending, default 0).

### Status Bar Parent-Child Selection

[statusBarManager.ts#L78-L105](statusBarManager.ts#L78-L105): When user selects a parent group (e.g., "Build"), ALL child tasks match via `isChildOfGroup()` prefix matching. This allows configuring entire branches at once.

### Icon Extraction Pattern

Both [tasksTreeProvider.ts#L24-L26](tasksTreeProvider.ts#L24-L26) and [statusBarManager.ts#L35-L37](statusBarManager.ts#L35-L37) extract icons using regex `/^\$\(([^)]+)\)\s*/`. Pattern: `$(iconName) Label Text` → icon='iconName', label='Label Text'. Always preserve this pattern when displaying task labels.

## VS Code API Integration

- **TreeDataProvider**: Implements `getTreeItem()` and `getChildren()`, fires `onDidChangeTreeData` for refresh
- **FileSystemWatcher**: Watches `**/.vscode/tasks.json` - onChange/onCreate/onDelete all trigger refresh
- **Commands**: All use `dedicatedTasks.*` namespace (e.g., `dedicatedTasks.runTask`)
- **ExtensionContext.globalState**: Persists status bar configuration across sessions (key: `dedicatedTasks.statusBar`)

## Testing & Debugging

- **F5**: Launches Extension Development Host (`.vscode/launch.json` assumed standard setup)
- **Test tasks.json**: Add test cases to workspace's `.vscode/tasks.json` with varying group structures
- **Verify hierarchy**: Check tree recursion with nested groups like `[["A", "B", "C"], "D", ["A", "E"]]`

## Common Modifications

**Adding new task metadata fields**:
1. Update `DedicatedTasksConfig` interface in [tasksTreeProvider.ts#L3-L9](tasksTreeProvider.ts#L3-L9)
2. Add to [schemas/tasks-schema.json](schemas/tasks-schema.json) for IntelliSense
3. Handle in `TaskTreeItem` constructor or `getDedicatedTaskConfig()`

**Changing tree display logic**: Modify `buildHierarchy()` in [tasksTreeProvider.ts#L121-L182](tasksTreeProvider.ts#L121-L182). Remember to preserve task ordering (`order` field) and group sorting (alphabetical).

**Status bar behavior**: Edit `filterTasksForStatusBar()` in [statusBarManager.ts#L61-L107](statusBarManager.ts#L61-L107). Parent-child matching relies on array prefix comparison.

## Schema Validation

[schemas/tasks-schema.json](schemas/tasks-schema.json) provides JSON Schema for tasks.json. Registered via `jsonValidation` contribution point in [package.json#L63-L68](package.json#L63-L68). Changes to config structure must update both the TypeScript interface AND the schema.
