# Dedicated Tasks UI - VS Code Extension

## Project Overview
VS Code extension that provides a dedicated UI in the activity bar for managing tasks with custom configuration.

## Progress Tracking
- [x] Create copilot-instructions.md
- [x] Get VS Code extension project setup info
- [x] Scaffold VS Code extension
- [x] Implement tree view provider
- [x] Extend tasks.json schema
- [x] Install dependencies and compile
- [x] Test and document

## Project Structure
- `src/extension.ts` - Extension entry point
- `src/tasksTreeProvider.ts` - Tree view provider for displaying tasks
- `schemas/tasks-schema.json` - JSON schema for tasks.json validation
- `resources/tasks-icon.svg` - Activity bar icon
- `.vscode/tasks.json` - Example tasks configuration

## How to Run
1. Press F5 to start debugging the extension
2. In the Extension Development Host window, open a workspace with a `.vscode/tasks.json` file
3. Add `dedicatedTasksUi` configuration to your tasks
4. Click the "Dedicated Tasks" icon in the activity bar to view your tasks
