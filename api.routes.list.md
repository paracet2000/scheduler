# API Routes List

Base paths from `app.js`:
- `/api/auth`
- `/api/users`
- `/api/masters`
- `/api/master-types`
- `/api/master-patterns`
- `/api/ward-members`
- `/api/code-mappings`
- `/api/user-shift-rates`
- `/api/attendance`
- `/api/kpi`
- `/api/schedules`
- `/api/scheduler-heads`
- `/api/changes`

## /api/auth
- `POST /register`
- `POST /login`
- `GET /verify/:token`
- `POST /resend-verify`

## /api/users
- `GET /me`
- `PUT /me`
- `POST /me/change-password`
- `POST /me/avatar`
- `GET /`
- `PUT /:id`
- `POST /:id/reset-password`

## /api/masters
- `GET /:type`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

## /api/master-types
- `GET /`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

## /api/master-patterns
- `GET /`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

## /api/ward-members
- `GET /meta`
- `GET /mine`
- `GET /users`
- `GET /me`
- `GET /`
- `POST /`
- `PUT /:id`

## /api/code-mappings
- `GET /meta`
- `GET /`
- `POST /`
- `PUT /:id`

## /api/user-shift-rates
- `GET /meta`
- `GET /`
- `POST /`
- `PUT /:id`

## /api/attendance
- `POST /sync`

## /api/kpi
- `GET /definitions`
- `POST /definitions`
- `PUT /definitions/:id`
- `GET /entries`
- `GET /entries-range`
- `POST /entries`
- `GET /dashboard/widgets`
- `POST /dashboard/widgets`
- `PUT /dashboard/widgets/:id`
- `GET /dashboard/thresholds`
- `POST /dashboard/thresholds`
- `GET /dashboard/summary`
- `GET /dashboard/checklist`

## /api/schedules
- `POST /book`
- `POST /dayBook`
- `POST /day-book`
- `POST /my`
- `GET /user/:userId`
- `GET /head/:wardId`
- `GET /summary/:wardId`
- `GET /summary-range/:wardId`
- `GET /ward/:wardId`
- `PUT /:id`
- `POST /:id/activate`

## /api/scheduler-heads
- `GET /`
- `GET /ward/:wardId/active`
- `POST /`
- `PATCH /:id/open`
- `PATCH /:id/close`

## /api/changes
- `POST /`
- `GET /my`
- `GET /inbox`
- `PATCH /:id/accept`
- `GET /`
- `PATCH /:id/approve`
- `PATCH /:id/reject`
