# Dedicated tasks

A powerful VS Code extension that transforms your tasks.json and launch.json into an organized, easy-to-access UI with grouping, icons, and quick-access status bar integration.

## Why Dedicated tasks?

If you have many tasks and debug configurations in your workspace, the default VS Code task picker and launch menu can become overwhelming. This extension solves that by:

- 📁 **Organizing tasks and launch configs into hierarchical groups** - Create multi-level folder structures
- 📌 **Pinning tasks and debug configs to the status bar** - One-click access to your most-used actions
- 🎨 **Supporting icons** - Use VS Code's built-in icon library for visual identification
- 🔍 **Providing a dedicated sidebar view** - All your tasks and launch configs in one convenient location
- ⚡ **Maintaining your existing config files** - Just add metadata, no breaking changes
- 🔀 **Unified organization** - Tasks and launch configs can share groups and be sorted together

## Features

- **Category Support**: Organize tasks into categories for top-level separation. Switch between categories via a dropdown in the tree view header.
- **Multi-folder Workspace Support**: Full support for multi-folder workspaces with folder abbreviations and per-folder configuration
- **Tree View Controls**: Filter, expand all, and collapse all buttons for easy navigation
- **Dedicated Activity Bar View**: Access your tasks and launch configs from a dedicated icon in the VS Code activity bar
- **Status Bar Integration**: Pin frequently used tasks and launch configs to the status bar for quick access with hierarchical group selection
- **Icon Support**: Use any VS Code icon (e.g., `$(gear)`, `$(rocket)`, `$(debug)`) in labels
- **Hierarchical Groups**: Organize tasks and launch configs into multi-level collapsible folder structures
- **Unified Organization**: Tasks and launch configs can share groups and be sorted together by order
- **Flexible Organization**: Items can appear in multiple groups simultaneously
- **Custom Labels & Details**: Override names with friendly labels and add descriptions
- **Item Ordering**: Control the display order of tasks and launch configs within groups
- **Selective Visibility**: Hide items from the UI while keeping them in your config files
- **Dual File Support**: Configure both tasks.json and launch.json with the same metadata structure

## Usage

### 1. Configure Your Tasks and Launch Configurations

Add the `dedicatedTasks` configuration to your tasks in `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build",
      "type": "shell",
      "command": "npm run build",
      "options": {
        "dedicatedTasks": {
          "label": "$(rocket) Build Project",
          "detail": "Compile TypeScript and bundle",
          "groups": [["Build", "Production"]],
          "order": 1
        }
      }
    },
    {
      "label": "Test",
      "type": "shell",
      "command": "npm test",
      "options": {
        "dedicatedTasks": {
          "label": "$(beaker) Run Tests",
          "detail": "Execute all unit tests",
          "groups": ["Test", ["Development", "Test"]],
          "order": 1
        }
      }
    },
    {
      "label": "Dev Server",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "dedicatedTasks": {
          "label": "$(server) Start Dev Server",
          "detail": "Launch development server with watch mode",
          "groups": [["Development", "Server"]],
          "order": 1
        }
      }
    },
    {
      "label": "Clean",
      "type": "shell",
      "command": "npm run clean",
      "options": {
        "dedicatedTasks": {
          "label": "$(trash) Clean Build",
          "detail": "Remove all build artifacts",
          "groups": ["Build"],
          "order": 0
        }
      }
    }
  ]
}
```

**And/or** add it to your launch configurations in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
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
    },
    {
      "name": "Run Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/test/index.js",
      "dedicatedTasks": {
        "label": "$(beaker) Debug Tests",
        "detail": "Run tests with debugger attached",
        "groups": ["Test", ["Debug", "Tests"]],
        "order": 1
      }
    }
  ]
}
```

### 2. View Your Tasks and Launch Configurations

1. Click on the "Dedicated Tasks" icon in the activity bar (left sidebar)
2. Your tasks and launch configs will be organized into collapsible groups
3. Click on any task to run it, or click on any launch config to start debugging

### 3. Use Categories (Optional)

Organize tasks at the top level using categories:

1. Add a `category` field to any task or launch config's `dedicatedTasks` configuration
2. Tasks without a category default to "default"
3. When multiple categories exist, a dropdown button appears in the tree view header
4. Click the dropdown to switch between categories
5. The tree view title updates to show the current category (e.g., "DEDICATED TASKS: Development")
6. Status bar items are also filtered to show only tasks from the selected category

**Example with categories:**
```json
{
  "label": "Build for Production",
  "type": "shell",
  "command": "npm run build:prod",
  "options": {
    "dedicatedTasks": {
      "label": "$(package) Production Build",
      "groups": ["Build"],
      "category": "Production"
    }
  }
}
```

### 4. Configure Status Bar (Optional)

Add frequently used tasks and launch configs to the status bar for quick access:

1. Click the gear icon (⚙️) in the Dedicated Tasks view title bar, or
2. Run the command **"Configure Status Bar Items"** from the command palette
3. Select individual tasks/launch configs or entire groups to display in the status bar
4. Selected items will appear in the status bar with their icons
5. Click any status bar item to execute it immediately (run task or start debugging)

**Status Bar Tips:**
- You can select entire groups (e.g., all "Build" items) to show multiple related tasks and configs
- Items in the status bar show their configured icons and labels
- Hover over a status bar item to see its description
- Configuration is saved in `.vscode/dedicated-tasks.json` and can be version controlled
- Tasks and launch configs can be mixed in the same status bar

## Configuration Files

This extension uses the following configuration files in your workspace:

### `.vscode/tasks.json`
Standard VS Code tasks file with optional `dedicatedTasks` metadata in `options`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build",
      "type": "shell",
      "command": "npm run build",
      "options": {
        "dedicatedTasks": {
          "label": "$(rocket) Build",
          "groups": ["Build"],
          "order": 1
        }
      }
    }
  ]
}
```

### `.vscode/launch.json`
Standard VS Code launch configurations with optional `dedicatedTasks` metadata at the root level:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug",
      "type": "node",
      "request": "launch",
      "program": "${file}",
      "dedicatedTasks": {
        "label": "$(debug) Debug",
        "groups": ["Debug"],
        "order": 1
      }
    }
  ]
}
```

### `.vscode/dedicated-tasks.json`
Extension configuration file (auto-generated when you configure status bar items):
```json
{
  "abbreviation": "API",
  "statusBar": {
    "itemNames": ["Build", "Debug"],
    "groups": [["Development", "Build"]]
  }
}
```

**File structure:**
- `abbreviation`: Optional custom folder abbreviation (overrides auto-generated 3-character abbreviation)
- `statusBar.itemNames`: Array of task/launch config names to show in status bar
- `statusBar.groups`: Array of group paths - all items in these groups will be shown

This file can be manually edited or manipulated by scripts/tools. Changes are automatically detected and applied.

## Getting Started

### Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Open your workspace** that contains `.vscode/tasks.json` and/or `.vscode/launch.json`
3. **Add `dedicatedTasks` configuration** to your tasks and/or launch configs (see examples above)
4. **Click the checkmark icon** in the activity bar to view your organized tasks and launch configs
5. **Optional**: Click the gear icon (⚙️) in the view title to configure status bar items

### Icons

You can use any icon from the [VS Code icon library](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing) by prefixing your label with the icon syntax:

```json
"label": "$(icon-name) Task Name"
```

**Popular icons:**
- `$(rocket)` - Launch/Build
- `$(gear)` - Configure
- `$(trash)` - Clean
- `$(beaker)` - Test
- `$(server)` - Server
- `$(cloud-download)` - Download
- `$(cloud-upload)` - Upload
- `$(debug)` - Debug
- `$(tools)` - Tools
- `$(package)` - Package

See the [complete icon reference](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing) for all available icons.

## Configuration Options

### `dedicatedTasks` Object

Add this object under `tasks[].options` in your `tasks.json`, or directly in each configuration object in `launch.json`:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | string | No | Display label for the task/config (defaults to task's `label` or config's `name`) |
| `statusbarLabel` | string | No | Shorthand label for status bar display (defaults to `label` if not set) |
| `detail` | string | No | Additional detail text shown below the item label |
| `hide` | boolean | No | Set to `true` to hide this item from the UI (default: `false`) |
| `groups` | array | **Yes** | Array of group paths. Each item can be a string for single-level groups or an array of strings for multi-level hierarchies |
| `order` | number | No | Sort order within the group - tasks and launch configs sort together (lower numbers appear first, default: `0`) |
| `category` | string | No | Top-level category for organizing tasks. Tasks with no category default to "default". When multiple categories exist, a dropdown appears in the tree view header. |

### Group Path Examples

The `groups` field supports flexible hierarchies:

- **Single-level group**: `"groups": ["Build"]` - Item appears in "Build" group
- **Multi-level group**: `"groups": [["Build", "Frontend"]]` - Item appears nested under Build → Frontend
- **Multiple locations**: `"groups": ["Quick Tasks", ["Build", "Frontend"]]` - Item appears in both "Quick Tasks" and "Build → Frontend"
- **Mixed levels**: `"groups": ["Build", ["Development", "Build"]]` - Item appears in top-level "Build" and nested "Development → Build"
- **Shared groups**: Tasks and launch configs can use the same group names and will be sorted together by `order`

### Complete Examples

**Task Example** (in tasks.json):
```json
{
  "label": "Build Production",
  "type": "shell",
  "command": "npm run build:prod",
  "options": {
    "dedicatedTasks": {
      "label": "$(package) Production Build",
      "detail": "Build optimized production bundle",
      "groups": [["Build", "Production"], "Quick Actions"],
      "order": 2,
      "hide": false
    }
  }
}
```

**Launch Config Example** (in launch.json):
```json
{
  "name": "Debug Production Build",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/dist/index.js",
  "dedicatedTasks": {
    "label": "$(debug) Debug Production",
    "detail": "Debug the production build",
    "groups": [["Build", "Production"], "Quick Actions"],
    "order": 3,
    "hide": false
  }
}
```

Both items will:
- Display with their respective icons
- Appear in two locations: "Build → Production" and "Quick Actions"
- Be sorted together by order (task at 2, launch config at 3)
- Be visible in the UI (not hidden)

## Requirements

- VS Code version 1.85.0 or higher

## Extension Settings

This extension does not add any VS Code settings. All configuration is done through `tasks.json` and `launch.json`.

## Tips & Tricks

### Organizing Large Lists

For projects with many tasks and launch configs (50+), use a hierarchical structure:

```json
"groups": [["Build Type", "Architecture", "Operation"]]
```

Example: `["Debug", "x64", "Build"]` → Debug → x64 → Build

### Status Bar Best Practices

- **Select parent groups** instead of individual items to quickly show all related tasks and launch configs
- **Use icons** to make items visually distinct in the status bar
- **Keep labels short** for status bar items (the detail field provides additional info on hover)
- **Use order numbers** to control the sequence of items in the status bar (lower = left)
- **Mix tasks and launch configs** in the same groups for related workflows (e.g., build task at order 1, debug config at order 2)

### Quick Access Pattern

Create a "Quick Actions" or "Favorites" group for your most-used tasks and launch configs:

```json
"groups": ["⭐ Favorites", ["Build", "Debug"]]
```

This makes the item appear both in its logical location and in a quick-access group. Works for both tasks and launch configurations.

### Hiding Implementation Details

Use `"hide": true` for helper tasks that should run via `dependsOn` but don't need to be directly accessible:

```json
{
  "label": "clean-temp",
  "command": "rm -rf temp",
  "options": {
    "dedicatedTasks": {
      "groups": ["Build"],
      "hide": true
    }
  }
}
```

Similarly for launch configs you rarely use directly but want to keep configured.

## Known Issues

### Launch.json Schema Validation

VS Code's built-in schema for `launch.json` doesn't recognize the `dedicatedTasks` property, so it may show as a validation warning/error in the editor (yellow/red squiggly lines). **This is cosmetic only** - the extension works perfectly fine.

**Workarounds:**
1. **Ignore the warning** - The property is read correctly by the extension
2. **Add a comment** to document it for other developers:
   ```json
   {
     "name": "Debug Extension",
     "type": "extensionHost",
     "request": "launch",
     // For Dedicated Tasks extension - organizes launch configs in sidebar
     "dedicatedTasks": {
       "label": "$(debug) Debug Extension",
       "groups": [["Debug"]]
     }
   }
   ```
3. **Disable schema validation** for launch.json (not recommended as it disables all validation)

This limitation exists because VS Code doesn't allow extensions to extend the built-in launch.json schema, only replace it entirely (which would break all standard IntelliSense). The `tasks.json` schema works fine because VS Code allows custom properties in the `options` object.

## Release Notes

### 0.1.0

**Multi-folder Workspace Support:**
- Workspace folders appear as top-level items in the tree view
- Unique 3-character abbreviations differentiate tasks across folders (e.g., `[VSC]`, `[API]`)
- Per-folder status bar configuration stored in each folder's `.vscode/dedicated-tasks.json`

**Tree View Controls:**
- Filter button to search tasks by name, label, detail, groups, or folder abbreviation
- Expand all / Collapse all buttons for quick navigation
- Filter auto-expands matching items; clearing filter preserves state

### 0.0.1

Initial release of Dedicated tasks:

**Core Features:**
- Dedicated activity bar view for task and launch configuration organization
- Unified tree view showing both tasks and launch configs
- Hierarchical grouping with unlimited nesting levels
- Items can appear in multiple groups simultaneously
- Custom labels and descriptions for better clarity
- Tasks and launch configs can share groups and sort together

**Dual File Support:**
- Configure tasks in `.vscode/tasks.json`
- Configure launch configs in `.vscode/launch.json`
- Same metadata structure for both types
- Live reload when either file changes

**Icon Support:**
- Full VS Code icon library integration
- Icons display in both tree view and status bar
- Simple syntax: `$(icon-name) Label`
- Default icons: `$(play)` for tasks, `$(debug-start)` for launch configs

**Status Bar Integration:**
- Pin individual tasks/launch configs or entire groups to status bar
- Hierarchical group selection (parent groups include all children)
- One-click execution from status bar (run task or start debugging)
- Persistent configuration across sessions
- Visual indicators for selected items
- Mixed task and launch config support

**Developer Experience:**
- JSON schema validation for both tasks.json and launch.json
- IntelliSense support in both configuration files
- Sorting and ordering control
- Selective item visibility

## License

MIT
