# Dedicated Tasks UI

A VS Code extension that provides a dedicated UI in the activity bar for managing tasks with custom configuration.

## Features

- **Dedicated Activity Bar View**: Access your tasks from a dedicated icon in the VS Code activity bar
- **Grouped Tasks**: Organize tasks into collapsible groups
- **Custom Configuration**: Add metadata to tasks for better organization and display
- **Task Ordering**: Control the order of tasks within groups
- **Hidden Tasks**: Selectively show/hide tasks from the UI

## Usage

### 1. Configure Your Tasks

Add the `dedicatedTasksUi` configuration to your tasks in `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build",
      "type": "shell",
      "command": "npm run build",
      "options": {
        "dedicatedTasksUi": {
          "label": "Build Project",
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
        "dedicatedTasksUi": {
          "label": "Run Tests",
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
        "dedicatedTasksUi": {
          "label": "Start Dev Server",
          "detail": "Launch development server with watch mode",
          "groups": [["Development", "Server"]],
          "order": 1
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

## Configuration Options

### `dedicatedTasksUi` Object

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

### Example Configuration

```json
{
  "label": "Build Production",
  "type": "shell",
  "command": "npm run build:prod",
  "options": {
    "dedicatedTasksUi": {
      "label": "Production Build",
      "detail": "Build optimized production bundle",
      "groups": [["Build", "Production"], "Quick Actions"],
      "order": 2,
      "hide": false
    }
  }
}
```

## Requirements

- VS Code version 1.85.0 or higher

## Extension Settings

This extension does not add any VS Code settings. All configuration is done through `tasks.json`.

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release:
- Dedicated activity bar view for tasks
- Task grouping and ordering
- Custom labels and details
- JSON schema validation for configuration

## Contributing

This extension is open source. Contributions are welcome!

## License

MIT
