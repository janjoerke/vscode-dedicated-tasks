# Change Log

All notable changes to the "Dedicated tasks" extension will be documented in this file.

## [0.3.0] - 2026-01-08

### Added
- **`showDetailsInTreeView` setting**: New setting to control whether task/launch config details are displayed in the tree view. When disabled (default), details are only visible in tooltips on hover. Enable `dedicatedTasks.showDetailsInTreeView` in VS Code settings to always show details.

### Changed
- Task and launch config details are now hidden from the tree view by default for a cleaner appearance. Details remain visible in tooltips.

## [0.2.0] - 2026-01-07

### Added
- **Category support**: New optional `categories` array field allows organizing tasks at the top level. Tasks can belong to multiple categories. Switch between categories via a dropdown in the tree view header.
- **Dynamic tree view title**: The tree view title updates to show the currently selected category (e.g., "DEDICATED TASKS: Development").
- **Category filtering**: Both tree view and status bar only show tasks from the selected category.
- **`statusbarLabel` field**: New optional field in `dedicatedTasks` configuration to specify a shorthand label for status bar display. Falls back to `label` if not set.
- **Custom folder abbreviations**: New `abbreviation` field in `.vscode/dedicated-tasks.json` allows overriding the auto-generated 3-character folder abbreviation with a custom value.
- **Schema for dedicated-tasks.json**: Added JSON schema for IntelliSense support when editing `.vscode/dedicated-tasks.json`.

### Changed
- Status bar now uses `statusbarLabel` when available, allowing shorter labels in the status bar while keeping descriptive labels in the tree view.
- Folder abbreviations now check for custom values in `dedicated-tasks.json` before auto-generating.
- Status bar items are now filtered by the currently selected category.

### Fixed
- Fixed issue where updating status bar items would overwrite the `abbreviation` field in `dedicated-tasks.json`.

## [0.1.0] - 2026-01-06

### Added
- **Multi-folder workspace support**: Workspace folders now appear as top-level items in the tree view
- **Folder abbreviations**: Unique 3-character abbreviations (e.g., `[VSC]`, `[API]`) differentiate tasks across workspace folders
- **Per-folder configuration**: Status bar config stored in each folder's `.vscode/dedicated-tasks.json`
- **Tree view controls**: New toolbar buttons for collapse all, expand all, and filter
- **Filter functionality**: Search tasks by name, label, detail, groups, or folder abbreviation
- **Expand all button**: Expands all groups and workspace folders in one click
- **Collapse all button**: Collapses all groups and workspace folders
- **Filter preservation**: Clearing filter preserves current expand/collapse state

### Changed
- Tree view now uses `symbol-folder` icon for groups to fix indentation issues
- Improved parent tracking for tree items to support reveal/expand functionality

### Technical
- Added unique `id` properties to all tree items for `TreeView.reveal()` support
- Implemented `getParent()` method in TreeDataProvider
- Tree items now track parent references for proper hierarchy navigation

## [0.0.1] - 2025-12-12

### Added
- Initial release of Dedicated tasks
- Dedicated activity bar view for organized task access
- Hierarchical task grouping with unlimited nesting levels
- Tasks can appear in multiple groups simultaneously
- Custom labels and descriptions for tasks
- Icon support using VS Code's icon library (`$(icon-name)` syntax)
- Status bar integration for quick task access
- Configurable status bar with hierarchical group selection
- Parent group selection automatically includes all child tasks
- Persistent status bar configuration
- JSON schema validation for `dedicatedTasks` configuration
- IntelliSense support in tasks.json
- Task ordering within groups
- Selective task visibility (hide option)
- Live reload when tasks.json changes
- Refresh command for manual updates

### Features
- **Tree View**: Collapsible hierarchical groups in activity bar
- **Status Bar**: One-click task execution from status bar
- **Icons**: Visual identification with VS Code's built-in icon library
- **Flexibility**: Tasks can belong to multiple groups
- **Organization**: Multi-level folder-like structures
- **Configuration**: Simple JSON-based setup in tasks.json
