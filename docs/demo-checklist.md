# Demo Checklist

## 1) Environment
- Server is running and reachable at target URL.
- Database is connected and sample data is available.
- Browser cache/local storage is cleared before demo.
- Test account credentials are prepared.

## 2) Guest State (Before Login)
- Open app in fresh tab/session.
- Verify visible menus are only `Register` and `Login`.
- Verify protected endpoints/pages are blocked and redirect to login.

## 3) Register Flow
- Register a brand new email.
- Verify success message is shown.
- Verify screen moves to `Login` page immediately.
- Verify no unauthorized error popup appears after successful register.

## 4) Login Flow
- Login with valid credentials.
- Verify visible menus are `read=1` permissions plus `Logout`.
- Verify user avatar/profile loads.
- Verify restricted pages are hidden from menu.

## 5) Logout Flow
- Click `Logout`.
- Verify local/session storage is cleared.
- Verify app returns to `Login` page.
- Verify visible menus return to only `Register` and `Login`.

## 6) Multi-Tab Behavior
- Open Tab A and Tab B.
- Login on Tab B.
- Return to Tab A and verify menu state syncs correctly.
- Logout on one tab and verify both tabs return to guest menu state.

## 7) Quick Regression
- `Register -> Login -> Logout -> Login` works without refresh.
- No duplicate submit behavior on Register/Login buttons.
- No console error during menu render transitions.

