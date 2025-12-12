# Dedicated Tasks UI Extension

## ✅ Project Setup Complete!

Your VS Code extension "dedicated-tasks-ui" has been successfully created and compiled.

## 🚀 How to Test the Extension

### 1. Launch the Extension Development Host

Press **F5** or run the "Run Extension" debug configuration. This will:
- Compile the extension
- Open a new VS Code window with your extension loaded

### 2. Try It Out

In the Extension Development Host window:

1. **Click the checkmark icon** in the activity bar (left sidebar) - this is your "Dedicated Tasks" view
2. You'll see the example tasks organized into groups and subgroups:
   - **Build** group with "Compile Extension"
   - **Development** group with nested subgroups:
     - **Build** with "Compile Extension" (also appears here)
     - **Watch** with "Watch Mode"
   - **Setup** group with "Install Dependencies"

### 3. Customize Your Tasks

Edit [.vscode/tasks.json](.vscode/tasks.json) and add the `dedicatedTasksUi` configuration to your tasks:

```json
{
  "label": "My Task",
  "type": "shell",
  "command": "echo Hello",
  "options": {
    "dedicatedTasksUi": {
      "label": "Custom Label",
      "detail": "Task description",
      "groups": [["My Group", "Subgroup"]],
      "order": 1
    }
  }
}
```

**Groups can be:**
- A string: `"groups": ["Build"]` - single-level group
- An array: `"groups": [["Build", "Frontend"]]` - multi-level hierarchy
- Multiple paths: `"groups": ["Quick", ["Build", "Frontend"]]` - task appears in multiple locations

**Example hierarchy visualization:**

```
📁 Build
  📁 Frontend
    ▶️ Compile TypeScript
    ▶️ Bundle Assets
  📁 Backend
    ▶️ Compile Server
📁 Quick Actions
  ▶️ Compile TypeScript  (same task, different location)
📁 Development
  📁 Watch
    ▶️ Watch Mode
```

## 📁 Project Structure

```
task-ui/
├── src/
│   ├── extension.ts              # Extension entry point
│   └── tasksTreeProvider.ts      # Tree view logic for displaying tasks
├── resources/
│   └── tasks-icon.svg            # Activity bar icon
├── schemas/
│   └── tasks-schema.json         # JSON schema for tasks.json validation
├── .vscode/
│   ├── tasks.json                # Example tasks with dedicatedTasksUi config
│   ├── launch.json               # Debug configuration
│   └── settings.json             # Workspace settings
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
├── esbuild.js                    # Build script
└── README.md                     # User documentation
```

## 🎯 Key Features Implemented

✅ **Dedicated Activity Bar View** - Custom icon and view container  
✅ **Multi-level Hierarchies** - Nest tasks in group → subgroup → task structures  
✅ **Multiple Locations** - Same task can appear in multiple hierarchy paths  
✅ **Task Ordering** - Sorted by the `order` field within each group  
✅ **Custom Labels & Details** - Override task names and add descriptions  
✅ **Hide Tasks** - Selectively show/hide tasks with `hide: true`  
✅ **JSON Schema** - IntelliSense support for `dedicatedTasksUi` configuration  
✅ **Auto-refresh** - Watches for changes to tasks.json  
✅ **One-click Execution** - Click any task to run it

## 🔧 Available npm Scripts

- `npm run compile` - Build the extension
- `npm run watch` - Watch mode for development
- `npm run check-types` - Type-check without building
- `npm run package` - Create production build

## 📝 Configuration Example

Here's a complete example of a tasks.json with the extension configuration:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "options": {
        "dedicatedTasksUi": {
          "label": "🔨 Build Project",
          "detail": "Compile TypeScript and create bundle",
          "groups": [["Build", "Production"], "Quick Actions"],
          "order": 1
        }
      }
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "options": {
        "dedicatedTasksUi": {
          "label": "🧪 Run Tests",
          "detail": "Execute all unit tests",
          "groups": [["Testing", "Unit Tests"]],
          "order": 1
        }
      }
    },
    {
      "label": "deploy",
      "type": "shell",
      "command": "npm run deploy",
      "options": {
        "dedicatedTasksUi": {
          "label": "🚀 Deploy to Production",
          "detail": "Build and deploy to production server",
          "groups": [["Deployment", "Production"]],
          "order": 1,
          "hide": false
        }
      }
    }
  ]
}
```

## 🎨 Customization Tips

1. **Use emojis** in labels to make tasks visually distinctive
2. **Create hierarchies** to organize related tasks (e.g., `["Build", "Frontend"]`, `["Build", "Backend"]`)
3. **Duplicate strategically** - put frequently used tasks in multiple locations for easy access
4. **Use order numbers** to prioritize important tasks (lower = higher priority)
5. **Add descriptive details** to explain what each task does
6. **Hide internal tasks** that users don't need to run directly

### Hierarchy Best Practices

- **By function**: `["Build", "Production"]`, `["Build", "Development"]`
- **By component**: `["Frontend", "Build"]`, `["Backend", "Build"]`
- **Quick access + organized**: Put common tasks in both a "Quick Actions" group and their logical hierarchy
- **Environment-based**: `["Deploy", "Staging"]`, `["Deploy", "Production"]`

## 🐛 Debugging

If you need to debug the extension:

1. Set breakpoints in [src/extension.ts](src/extension.ts) or [src/tasksTreeProvider.ts](src/tasksTreeProvider.ts)
2. Press F5 to start debugging
3. The debugger will attach and stop at your breakpoints

## 📦 Next Steps

To publish your extension:

1. Update `package.json` with your details (author, repository, etc.)
2. Add a `LICENSE` file
3. Test thoroughly
4. Package with `vsce package`
5. Publish to the VS Code Marketplace with `vsce publish`

---

**Enjoy your new Dedicated Tasks UI extension!** 🎉
