# Dedicated tasks

A powerful VS Code extension that transforms your tasks.json into an organized, easy-to-access UI with grouping, icons, and quick-access status bar integration.

## Why Dedicated tasks?

If you have many tasks in your workspace, the default VS Code task picker can become overwhelming. This extension solves that by:

- 📁 **Organizing tasks into hierarchical groups** - Create multi-level folder structures
- 📌 **Pinning tasks to the status bar** - One-click access to your most-used tasks
- 🎨 **Supporting icons** - Use VS Code's built-in icon library for visual identification
- 🔍 **Providing a dedicated sidebar view** - All your tasks in one convenient location
- ⚡ **Maintaining your existing tasks.json** - Just add metadata, no breaking changes

## Features

- **Dedicated Activity Bar View**: Access your tasks from a dedicated icon in the VS Code activity bar
- **Status Bar Integration**: Pin frequently used tasks to the status bar for quick access with hierarchical group selection
- **Icon Support**: Use any VS Code icon (e.g., `$(gear)`, `$(rocket)`, `$(trash)`) in task labels
- **Hierarchical Groups**: Organize tasks into multi-level collapsible folder structures
- **Flexible Organization**: Tasks can appear in multiple groups simultaneously
- **Custom Labels & Details**: Override task names with friendly labels and add descriptions
- **Task Ordering**: Control the display order of tasks within groups
- **Selective Visibility**: Hide tasks from the UI while keeping them in tasks.json

## Usage

### 1. Configure Your Tasks

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

### 2. View Your Tasks

1. Click on the "Dedicated Tasks" icon in the activity bar (left sidebar)
2. Your tasks will be organized into collapsible groups
3. Click on any task to run it

### 3. Configure Status Bar (Optional)

Add frequently used tasks to the status bar for quick access:

1. Click the gear icon (⚙️) in the Dedicated Tasks view title bar, or
2. Run the command **"Configure Status Bar Tasks"** from the command palette
3. Select individual tasks or entire groups to display in the status bar
4. Selected tasks will appear in the status bar with their icons
5. Click any status bar task to execute it immediately

**Status Bar Tips:**
- You can select entire groups (e.g., all "Build" tasks) to show multiple related tasks
- Tasks in the status bar show their configured icons and labels
- Hover over a status bar task to see its description
- Configuration is saved and persists across VS Code sessions

## Getting Started

### Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Open your workspace** that contains a `.vscode/tasks.json` file
3. **Add `dedicatedTasks` configuration** to your tasks (see examples above)
4. **Click the checkmark icon** in the activity bar to view your organized tasks
5. **Optional**: Click the gear icon (⚙️) in the view title to configure status bar tasks

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

Add this object under `tasks[].options` in your `tasks.json`:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | string | No | Display label for the task (defaults to task's `label`) |
| `detail` | string | No | Additional detail text shown below the task label |
| `hide` | boolean | No | Set to `true` to hide this task from the UI (default: `false`) |
| `groups` | array | **Yes** | Array of group paths. Each item can be a string for single-level groups or an array of strings for multi-level hierarchies |
| `order` | number | No | Sort order within the group (lower numbers appear first, default: `0`) |

### Group Path Examples

The `groups` field supports flexible hierarchies:

- **Single-level group**: `"groups": ["Build"]` - Task appears in "Build" group
- **Multi-level group**: `"groups": [["Build", "Frontend"]]` - Task appears nested under Build → Frontend
- **Multiple locations**: `"groups": ["Quick Tasks", ["Build", "Frontend"]]` - Task appears in both "Quick Tasks" and "Build → Frontend"
- **Mixed levels**: `"groups": ["Build", ["Development", "Build"]]` - Task appears in top-level "Build" and nested "Development → Build"

### Complete Task Example

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

This task will:
- Display with a package icon (📦)
- Appear in two locations: "Build → Production" and "Quick Actions"
- Be sorted with order priority 2
- Be visible in the UI (not hidden)

## Requirements

- VS Code version 1.85.0 or higher

## Extension Settings

This extension does not add any VS Code settings. All configuration is done through `tasks.json`.

## Tips & Tricks

### Organizing Large Task Lists

For projects with many tasks (50+), use a hierarchical structure:

```json
"groups": [["Build Type", "Architecture", "Operation"]]
```

Example: `["Debug", "x64", "Build"]` → Debug → x64 → Build

### Status Bar Best Practices

- **Select parent groups** instead of individual tasks to quickly show all related tasks
- **Use icons** to make tasks visually distinct in the status bar
- **Keep labels short** for status bar tasks (the detail field provides additional info on hover)
- **Use order numbers** to control the sequence of tasks in the status bar (lower = left)

### Quick Access Pattern

Create a "Quick Actions" or "Favorites" group for your most-used tasks:

```json
"groups": ["⭐ Favorites", ["Build", "Debug"]]
```

This makes the task appear both in its logical location and in a quick-access group.

### Hiding Implementation Details

Use `"hide": true` for helper tasks that should run via `dependsOn` but don't need to be directly accessible:

```json
{
  "label": "clean-temp",
  "command": "rm -rf temp",
  "options": {
    "dedicatedTasks": {
      "hide": true
    }
  }
}
```

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release of Dedicated tasks:

**Core Features:**
- Dedicated activity bar view for task organization
- Hierarchical grouping with unlimited nesting levels
- Tasks can appear in multiple groups simultaneously
- Custom labels and descriptions for better clarity

**Icon Support:**
- Full VS Code icon library integration
- Icons display in both tree view and status bar
- Simple syntax: `$(icon-name) Label`

**Status Bar Integration:**
- Pin individual tasks or entire groups to status bar
- Hierarchical group selection (parent groups include all children)
- One-click task execution from status bar
- Persistent configuration across sessions
- Visual indicators for selected items

**Developer Experience:**
- JSON schema validation for configuration
- IntelliSense support in tasks.json
- Live reload when tasks.json changes
- Sorting and ordering control
- Selective task visibility

## Contributing

This extension is open source. Contributions are welcome!

## License

MIT
