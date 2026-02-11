# Changelog

All notable changes to this project will be documented in this file.

## [1.1] - 2026-02-11

### Added
- Configuration-based master data (`configuration`, `type`, `code_type`) and related routes/controllers.
- User rights management UI and API for menu permissions.
- Scheduler Head UI and workflow.
- Shift Pattern UI and seed data.
- KPI dashboard settings UI and supporting routes.
- Attendance sync UI with CSV processing and mapping grid.
- Helper utilities for consistent ward/shift lookup.

### Changed
- WARD/SHIFT lookups standardized to configuration (`conf_code`) in multiple controllers.
- Global dxDataGrid defaults (row height, fixed height, auto filter row when > 25 rows).
- KPI dashboard ward selector now reads from helper (configuration-based).
- Menu labels updated (Shift Summary naming).
- UI: standardized grid headers via global styles.

### Removed
- Legacy master routes/controller usage (migrated to configuration-based data).

