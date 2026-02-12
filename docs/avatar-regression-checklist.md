# Avatar Regression Checklist

## Preconditions
- Login with a test account that can open `Personal Settings`.
- Prepare 3 test images: `jpg`, `png`, and one non-image file (for negative test).
- Open browser DevTools (`Network` + `Console`).

## Upload & Save
1. Open `Personal Settings`.
2. Select a `jpg` image and click `Upload`.
3. Expect success notification.
4. Verify top avatar (`#avatar`) updates immediately.
5. Verify preview avatar (`#avatarPreview`) shows uploaded image.
6. Verify `/api/users/me` response contains `avatar` starting with `data:image/jpeg;base64,`.

## Format & Size Behavior
1. Upload a large image (e.g. >1MB).
2. Verify save still succeeds.
3. Confirm resulting avatar is JPEG data URL (not file path).
4. Visually confirm image remains square and centered (64x64 processing).

## Persistence
1. Refresh browser page.
2. Verify avatar remains visible.
3. Logout and login again.
4. Verify avatar still visible.

## Cross-Page Usage
1. Open `Schedule` and check edit banner avatar.
2. Open `Schedule Summary` and check row avatar.
3. Open any page listing user avatar (`ward member`, `user shift rate`, etc.) and verify no broken image.

## Favicon
1. After upload, verify tab favicon changes to profile image.
2. Refresh page and verify favicon still loads.

## Negative Cases
1. Try uploading non-image file.
2. Expect clear error notification and no avatar change.
3. Upload cancel/no file: expect warning and no API call.

## Production Stability
1. Deploy latest build.
2. Repeat `Upload & Save` + `Persistence` on production URL.
3. Confirm avatar still works after service restart/redeploy (no dependency on local disk).

## Pass Criteria
- Avatar displayed correctly in all major avatar UI points.
- `avatar` stored as data URL in DB and survives refresh/login/redeploy.
- No broken image icons or console errors related to avatar rendering.
