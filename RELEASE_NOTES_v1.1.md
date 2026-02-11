# Release Notes v1.1 (2026-02-11)

## Highlights
- **Configuration-driven masters**: WARD/SHIFT data now read from configuration (`conf_code`), reducing ambiguity and improving consistency.
- **User Rights & Permissions**: New UI and API to manage per-user menu permissions (read/write/export).
- **Scheduler Head & Shift Pattern**: Added dedicated UI flows to manage schedule windows and shift patterns.
- **KPI Dashboard Enhancements**: Dashboard settings page + widget/threshold management.
- **Attendance Sync**: CSV upload + mapping UI for time attendance imports.

## Functional Changes
- Registration now assigns default menu permissions automatically.
- KPI dashboard ward selector reads from configuration via helper.
- Multiple controllers updated to use configuration-based WARD/SHIFT data.
- Global dxDataGrid defaults and toolbar styling applied.

## UI/UX Improvements
- Consistent grid headers via global styles.
- Standardized grid IDs/classes documented in `dxDatagrid.list.md`.

## Notes
- Legacy master controller/routes removed in favor of configuration.
- If you rely on old master endpoints, update calls to configuration endpoints.

