// js/common.libs.js
// Shared constants and helpers
(function () {
    const rawBaseUrl = typeof window.BASE_URL === 'string' ? window.BASE_URL.trim() : '';
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    // When the frontend is served from Express (same origin as API), use relative URLs.
    // Only default to localhost:3000 when running the frontend from a separate dev server (e.g. Live Server/Vite).
    const port = String(window.location.port || '').trim();
    const isStandaloneFrontend =
        window.location.protocol === 'file:' ||
        (isLocalHost && (port === '5500' || port === '5173'));

    window.BASE_URL = rawBaseUrl || (isStandaloneFrontend ? 'http://localhost:3000' : '');

    const state = {
        menuReady: false,
        pendingAllowedCodes: null,
        menuButtons: {},
        menuButtonsByNormalized: {},
        dropdownMenu: null,
        topAvatarEl: null,
        updateAuthUI: null
    };

    const Common = {
        // constants
        APP_NAME: 'Nurse Scheduler',
        APP_TITLE_PREFIX: '🩺 Nurse Scheduler',

        // helpers
        getToken() {
            return localStorage.getItem('auth_token');
        },
        setMenuAccessMap(map) {
            window.MenuAccess = map || {};
        },
        getMenuAccess(code) {
            return (window.MenuAccess && window.MenuAccess[code]) || null;
        },
        normalizeMenuCode(code) {
            return String(code || '').trim().replace(/^\d+/, '');
        },
        updateAppTitle(displayName = '') {
            const nameText = String(displayName || '').trim();
            const title = nameText
                ? `${Common.APP_TITLE_PREFIX} [ ${nameText} ]`
                : Common.APP_TITLE_PREFIX;
            $('.logo').text(title);
        },
        fetchWithAuth(url, options = {}) {
            // เชื่อม ต่อ URL อย่างถูกต้อง โดยระวังเรื่อง slash ให้แล้ว
            const finalUrl = Common.buildApiUrl(url);
            const method = options.method || 'GET';
            const headers = { ...(options.headers || {}) };
            // Default to JSON when the body is a string and Content-Type not provided.
            if (typeof options.body === 'string' && !headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }

            const token = Common.getToken();
            
            return fetch(finalUrl, {
                ...options,
                method,
                headers: {
                    ...headers,
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
        },
        buildApiUrl(path) {
            const raw = String(path || '').trim();
            if (!raw) return raw;
            if (
                raw.startsWith('http://') ||
                raw.startsWith('https://') ||
                raw.startsWith('data:') ||
                raw.startsWith('blob:')
            ) {
                return raw;
            }
            const base = String(window.BASE_URL || '').trim().replace(/\/+$/, '');
            const clean = raw.startsWith('/') ? raw : `/${raw}`;
            return base ? `${base}${clean}` : clean;
        },
        postWithAuth(url, options = {}) {
            return Common.fetchWithAuth(url, {
                ...options,
                method: 'POST'
            });
        },
        putWithAuth(url, options = {}) {
            return Common.fetchWithAuth(url, {
                ...options,
                method: 'PUT'
            });
        },
        patchWithAuth(url, options = {}) {
            return Common.fetchWithAuth(url, {
                ...options,
                method: 'PATCH'
            });
        },
        deleteWithAuth(url, options = {}) {
            return Common.fetchWithAuth(url, {
                ...options,
                method: 'DELETE'
            });
        },
        safeJsonParse(value, fallback) {
            if (typeof value !== 'string') return fallback;
            try {
                return JSON.parse(value);
            } catch {
                return fallback;
            }
        },
        async getCachedMasters(type, ttlMs = 10 * 60 * 1000) {
            const code = String(type || '').trim().toUpperCase();
            console.log('code Data: ',code);
            if (!code) return [];
            const cacheKey = `masters_${code}_cache`;
            const cacheTsKey = `masters_${code}_cache_ts`;

            const cached = localStorage.getItem(cacheKey);
            const cachedTs = Number(localStorage.getItem(cacheTsKey) || 0);
            const cacheValid = cached && (Date.now() - cachedTs) < ttlMs;
            if (cacheValid) {
                return Common.safeJsonParse(cached, []);
            }

            const res = await Common.fetchWithAuth(`/api/configuration?typ_code=${encodeURIComponent(code)}`);
            const json = await res.json();
            console.log('json Data: CACHE',json);
            if (res.ok && Array.isArray(json.data)) {
                localStorage.setItem(cacheKey, JSON.stringify(json.data));
                localStorage.setItem(cacheTsKey, String(Date.now()));
                return json.data;
            }
            return Common.safeJsonParse(cached, []);
        },
        toggleHide(el, shouldHide = true) {
            if (!el) return;
            const $el = el.jquery ? el : $(el);
            $el.toggle(!shouldHide);
        },
        toggleEnable(el, shouldEnable = true) {
            if (!el) return;
            const $el = el.jquery ? el : $(el);
            $el.prop('disabled', !shouldEnable);
            $el.toggleClass('is-disabled', !shouldEnable);
        },

        normalizeAvatarPath(avatarUrl) {
            const raw = String(avatarUrl || '').trim();
            if (!raw) return '';
            const normalizedRaw = raw.replace(/\\/g, '/');

            // Legacy absolute URL that points to /uploads/<file> is no longer valid in current deploy model.
            const absoluteUploadMatch = normalizedRaw.match(/\/uploads\/([^/?#]+)(?:[?#].*)?$/i);
            if (absoluteUploadMatch && absoluteUploadMatch[1]) {
                return '';
            }

            const cleaned = normalizedRaw.replace(/^\.?\//, '');
            if (cleaned.startsWith('images/')) return `/${cleaned}`;
            if (cleaned.startsWith('uploads/')) {
                return '';
            }
            // Legacy plain filename: resolve under ./images by default.
            if (!cleaned.includes('/')) {
                if (/^profile_[\w-]+\.(jpg|jpeg|png|webp)$/i.test(cleaned)) return '';
                return `/images/${cleaned}`;
            }
            return `/${cleaned}`;
        },

        resolveAvatarUrl(avatarUrl) {
            if (!avatarUrl) return '';
            const normalizedInput = String(avatarUrl || '').trim();
            if (
                normalizedInput.startsWith('data:') ||
                normalizedInput.startsWith('blob:')
            ) {
                return normalizedInput;
            }
            const pathOnly = Common.normalizeAvatarPath(normalizedInput);
            if (!pathOnly) return '';

            // Keep external image URLs untouched unless they were remapped to local /images path above.
            if (
                (normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')) &&
                !pathOnly.startsWith('/images/')
            ) {
                return normalizedInput;
            }

            const apiBase = (window.BASE_URL || '').replace(/\/+$/, '');
            return apiBase ? `${apiBase}${pathOnly}` : pathOnly;
        },
        updateTopAvatar(avatarUrl, targetEl = null) {
            const fallback = 'images/defaultprofile.jpg';
            const resolved = Common.resolveAvatarUrl(String(avatarUrl || '').trim()) || fallback;
            const avatarEl = targetEl && targetEl.length ? targetEl : state.topAvatarEl;
            if (avatarEl && avatarEl.length) {
                avatarEl.off('error.commonAvatar').on('error.commonAvatar', function() {
                    if ($(this).attr('src') !== fallback) {
                        $(this).attr('src', fallback);
                    }
                });
                avatarEl.attr('src', resolved);
            }
            const link = document.getElementById('appFavicon');
            if (link) {
                link.href = resolved;
            }
        },

        async setFavicon() {
            const link = document.getElementById('appFavicon') || (() => {
                const l = document.createElement('link');
                l.id = 'appFavicon';
                l.rel = 'icon';
                document.head.appendChild(l);
                return l;
            })();
            const fallback = 'images/defaultprofile.jpg';
            const cacheKey = 'auth_avatar';
            const cachedAvatar = localStorage.getItem(cacheKey) || '';
            if (cachedAvatar) {
                link.href = Common.resolveAvatarUrl(cachedAvatar) || fallback;
            }
            try {
                const res = await Common.fetchWithAuth('/api/users/me');
                const json = await res.json();
                if (res.ok) {
                    const avatarUrl = json?.data?.avatar || '';
                    if (avatarUrl) {
                        localStorage.setItem(cacheKey, avatarUrl);
                    } else {
                        localStorage.removeItem(cacheKey);
                    }
                    link.href = Common.resolveAvatarUrl(avatarUrl) || fallback;
                    return;
                }
            } catch {}
            if (!cachedAvatar) {
                link.href = fallback;
            }
        },

        async renderProfileAvatar(avatarEl) {
            const target = avatarEl && avatarEl.length ? avatarEl : state.topAvatarEl;
            if (!target || !target.length) return;

            const avatarCacheKey = 'auth_avatar';
            const nameCacheKey = 'auth_display_name';
            const cachedAvatar = localStorage.getItem(avatarCacheKey) || '';
            const cachedName = localStorage.getItem(nameCacheKey) || '';
            if (cachedName) {
                Common.updateAppTitle(cachedName);
            }
            if (cachedAvatar) {
                Common.updateTopAvatar(cachedAvatar, target);
            }

            if (!Common.getToken()) {
                localStorage.removeItem(avatarCacheKey);
                localStorage.removeItem(nameCacheKey);
                Common.updateTopAvatar(null, target);
                Common.updateAppTitle('');
                return;
            }

            try {
                const res = await this.fetchWithAuth('/api/users/me');
                const json = await res.json();
                if (res.ok) {
                    const profile = json?.data || {};
                    const avatarUrl = profile?.avatar || '';
                    const displayName = String(profile?.name || profile?.email || '').trim();
                    if (avatarUrl) {
                        localStorage.setItem(avatarCacheKey, avatarUrl);
                    } else {
                        localStorage.removeItem(avatarCacheKey);
                    }
                    if (displayName) {
                        localStorage.setItem(nameCacheKey, displayName);
                    } else {
                        localStorage.removeItem(nameCacheKey);
                    }
                    Common.updateTopAvatar(avatarUrl, target);
                    Common.updateAppTitle(displayName);
                    return;
                }
            } catch {}

            if (!cachedAvatar) {
                Common.updateTopAvatar(null, target);
            }
            if (!cachedName) {
                Common.updateAppTitle('');
            }
        },

        applyMenuAuthorization(allowedCodes) {
            if (!state.menuReady) {
                state.pendingAllowedCodes = allowedCodes;
                return;
            }
            const isLoggedIn = !!Common.getToken();
            const allowedRaw = new Set((allowedCodes || []).map((c) => String(c || '').trim()));
            const allowedNormalized = new Set(
                (allowedCodes || []).map((c) => Common.normalizeMenuCode(c))
            );
            Object.keys(state.menuButtons).forEach((id) => {
                const normalizedId = Common.normalizeMenuCode(id);
                if (normalizedId === 'menuSignup' || normalizedId === 'menuLogin') {
                    state.menuButtons[id].toggle(!isLoggedIn);
                    return;
                }
                if (normalizedId === 'menuLogout') {
                    state.menuButtons[id].toggle(isLoggedIn);
                    return;
                }
                if (!isLoggedIn) {
                    state.menuButtons[id].toggle(false);
                    return;
                }
                const isAllowed =
                    allowedRaw.has(id) ||
                    allowedRaw.has(normalizedId) ||
                    allowedNormalized.has(id) ||
                    allowedNormalized.has(normalizedId);
                state.menuButtons[id].toggle(isAllowed);
            });
        },

        async loadMenuAuthorization(token) {
            if (!token) {
                Common.setMenuAccessMap({});
                Common.applyMenuAuthorization([]);
                return;
            }
            try {
                const res = await fetch(Common.buildApiUrl('/api/menu-authorize/me'), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (res.ok && Array.isArray(json.data)) {
                    const accessMap = {};
                    json.data.forEach((m) => {
                        const rawCode = String(m?.mnu_code || '').trim();
                        const normalizedCode = Common.normalizeMenuCode(rawCode);
                        const access = {
                            mnu_code: rawCode,
                            acc_read: Number(m?.acc_read) === 1 ? 1 : 0,
                            acc_write: Number(m?.acc_write) === 1 ? 1 : 0,
                            acc_export: Number(m?.acc_export) === 1 ? 1 : 0
                        };
                        if (rawCode) accessMap[rawCode] = access;
                        if (normalizedCode) accessMap[normalizedCode] = access;
                    });
                    Common.setMenuAccessMap(accessMap);
                    const allowed = json.data
                        .filter((m) => Number(m.acc_read) === 1)
                        .map((m) => m.mnu_code);
                    Common.applyMenuAuthorization(allowed);
                    return;
                }
            } catch {}
            Common.setMenuAccessMap({});
            Common.applyMenuAuthorization([]);
        },

        logout() {
            localStorage.clear();
            try { sessionStorage.clear(); } catch {}
            Common.updateTopAvatar(null);
            Common.updateAppTitle('');
            if (typeof state.updateAuthUI === 'function') {
                state.updateAuthUI(false);
            }
            // Force guest menu state immediately after token is cleared.
            Common.applyMenuAuthorization([]);
            // Also force drawer items in current DOM to guest state immediately.
            $('#drawerMenu .drawer-item').each(function() {
                const el = $(this);
                const code = Common.normalizeMenuCode(el.data('code'));
                const isGuestMenu = code === 'menuSignup' || code === 'menuLogin';
                el.toggle(isGuestMenu);
            });
            Common.loadMenuAuthorization(null);
            if (typeof window.rebuildDrawerMenu === 'function') {
                window.rebuildDrawerMenu();
            }
            if (typeof window.rebuildMenuGrid === 'function') {
                window.rebuildMenuGrid();
            }
            if (typeof window.renderLogin === 'function') {
                window.renderLogin();
            } else if (typeof window.showPage === 'function') {
                window.showPage('login');
            }
        },

        initMenuUI() {
            const topMenu = $('#topMenu');
            if (!topMenu.length || topMenu.data('authMenuInit')) {
                return;
            }
            topMenu.data('authMenuInit', true);

            const dropdown = $('<div>', { class: 'dropdown' });
            const button = $('<button>', { class: 'user-menu-button dropdown-toggle', 'aria-label': 'User menu' })
                .text('Menu');
            const dropdownMenu = $('<div>', { class: 'dropdown-menu' });

            state.dropdownMenu = dropdownMenu;
            state.topAvatarEl = $('#avatar');

            const menuActions = {
                menuSignup: () => {
                    if (typeof window.renderRegister === 'function') {
                        window.renderRegister();
                    }
                },
                menuSettingsPersonal: () => {
                    console.log('menuSettingsPersonal clicked');
                    if (typeof window.renderPersonalSettings === 'function') {
                        window.renderPersonalSettings();
                    }
                },
                menuSettingsSystem: () => {
                    if (typeof window.renderSystemSettings === 'function') {
                        window.renderSystemSettings();
                    }
                },
                menuSchedule: () => {
                    if (typeof window.renderSchedule === 'function') {
                        window.renderSchedule();
                    }
                },
                menuChangeRequest: () => {
                    if (typeof window.renderChangeRequest === 'function') {
                        window.renderChangeRequest();
                    }
                },
                menuScheduleSummary: () => {
                    if (typeof window.renderScheduleSummary === 'function') {
                        window.renderScheduleSummary();
                    }
                },
                menuKpiEntry: () => {
                    if (typeof window.renderKpiEntry === 'function') {
                        window.renderKpiEntry();
                    }
                },
                menuKpiDefinition: () => {
                    if (typeof window.renderKpiDefinitions === 'function') {
                        window.renderKpiDefinitions();
                    }
                },
                menuKpiDashboardSetting: () => {
                    if (typeof window.renderKpiDashboardSetting === 'function') {
                        window.renderKpiDashboardSetting();
                    }
                },
                menuKpiDashboard: () => {
                    if (typeof window.renderKpiDashboard === 'function') {
                        window.renderKpiDashboard();
                    }
                },
                menuKpiTools: () => {
                    if (typeof window.renderKpiTools === 'function') {
                        window.renderKpiTools();
                    }
                },
                menuCommonReport: () => {
                    if (typeof window.renderCommonReport === 'function') {
                        window.renderCommonReport();
                    }
                },
                menuUserManagement: () => {
                    if (typeof window.renderUserManagement === 'function') {
                        window.renderUserManagement();
                    }
                },
                menuShiftPattern: () => {
                    if (typeof window.renderShiftPattern === 'function') {
                        window.renderShiftPattern();
                    }
                },
                menuUserShiftRate: () => {
                    if (typeof window.renderUserShiftRate === 'function') {
                        window.renderUserShiftRate();
                    }
                },
                menuUserRights: () => {
                    if (typeof window.renderUserRights === 'function') {
                        window.renderUserRights();
                    }
                },
                menuWardMember: () => {
                    if (typeof window.renderWardMember === 'function') {
                        window.renderWardMember();
                    }
                },
                menuTimeAttendanceSync: () => {
                    if (typeof window.renderAttendanceSync === 'function') {
                        window.renderAttendanceSync();
                    }
                },
                menuLogin: () => {
                    if (typeof window.renderLogin === 'function') {
                        window.renderLogin();
                    }
                },
                menuLogout: () => {
                    Common.logout();
                }
            };

            function buildMenuItems(menus) {
                dropdownMenu.empty();
                Object.keys(state.menuButtons).forEach((id) => delete state.menuButtons[id]);
                Object.keys(state.menuButtonsByNormalized).forEach((id) => delete state.menuButtonsByNormalized[id]);
                menus.forEach((item) => {
                    const rawCode = String(item.id || '').trim();
                    const normalizedCode = Common.normalizeMenuCode(rawCode);
                    const isLoggedIn = !!Common.getToken();
                    const menuItem = $('<button>', {
                        text: item.mnu_name || item.mnu_description || item.text || normalizedCode || item.id,
                        class: 'dropdown-item',
                        click: () => {
            const token = Common.getToken();
                            const guestAllowed = normalizedCode === 'menuSignup' || normalizedCode === 'menuLogin';
                            if (!token && !guestAllowed) {
                                if (typeof window.renderLogin === 'function') {
                                    window.renderLogin();
                                }
                                dropdownMenu.hide();
                                return;
                            }
                            if (typeof menuActions[normalizedCode] === 'function') {
                                menuActions[normalizedCode]();
                            }
                            dropdownMenu.hide();
                        }
                    });
                    if (normalizedCode === 'menuSignup' || normalizedCode === 'menuLogin') {
                        menuItem.toggle(!isLoggedIn);
                    } else if (normalizedCode === 'menuLogout') {
                        menuItem.toggle(isLoggedIn);
                    } else {
                        menuItem.toggle(false);
                    }
                    if (rawCode) state.menuButtons[rawCode] = menuItem;
                    if (normalizedCode) state.menuButtonsByNormalized[normalizedCode] = menuItem;
                    dropdownMenu.append(menuItem);
                });
                state.menuReady = true;
                if (state.pendingAllowedCodes) {
                    Common.applyMenuAuthorization(state.pendingAllowedCodes);
                    state.pendingAllowedCodes = null;
                }
            }

            async function loadMenus() {
            try {
                const res = await fetch(Common.buildApiUrl('/api/menus'));
                const json = await res.json();
                    if (res.ok && Array.isArray(json.data)) {
                        const menus = json.data.map((m) => ({
                            id: m.mnu_code,
                            mnu_name: m.mnu_name,
                            mnu_description: m.mnu_description,
                            mnu_icon: m.mnu_icon
                        }));
                        buildMenuItems(menus);
                        return;
                    }
                } catch {}
                const fallbackMenus = Object.keys(menuActions).map((id) => ({ id, mnu_description: id }));
                buildMenuItems(fallbackMenus);
            }

            dropdown.append(button).append(dropdownMenu);
            topMenu.css('display', 'flex').css('justify-content', 'flex-end').append(dropdown);

            button.on('click', function() {
                dropdownMenu.toggle();
            });

            state.updateAuthUI = function updateAuthUI(isLoggedIn) {
                const signupBtn = state.menuButtonsByNormalized.menuSignup || state.menuButtons.menuSignup;
                const loginBtn = state.menuButtonsByNormalized.menuLogin || state.menuButtons.menuLogin;
                const logoutBtn = state.menuButtonsByNormalized.menuLogout || state.menuButtons.menuLogout;
                if (signupBtn) signupBtn.toggle(!isLoggedIn);
                if (loginBtn) loginBtn.toggle(!isLoggedIn);
                if (logoutBtn) logoutBtn.toggle(isLoggedIn);
            };

            const initialToken = Common.getToken();
            state.updateAuthUI(!!initialToken);
            loadMenus().then(() => {
                Common.loadMenuAuthorization(initialToken);
                if (initialToken) {
                    Common.renderProfileAvatar(state.topAvatarEl);
                } else {
                    Common.updateAppTitle('');
                }
            });

            window.addEventListener('storage', (event) => {
                if (!['auth_token', 'auth_kpi_tools', 'auth_display_name'].includes(event.key)) return;
                const token = Common.getToken();
                if (typeof state.updateAuthUI === 'function') {
                    state.updateAuthUI(!!token);
                }
                Common.loadMenuAuthorization(token);
                if (token) {
                    Common.renderProfileAvatar(state.topAvatarEl);
                } else {
                    Common.updateAppTitle('');
                }
                if (typeof window.rebuildDrawerMenu === 'function') {
                    window.rebuildDrawerMenu();
                }
            });
        }
        ,
        async buildDrawerMenu() {
            const drawerMenu = $('#drawerMenu');
            if (!drawerMenu.length) return;
            drawerMenu.empty();

            let menus = [];
            try {
                const res = await fetch(Common.buildApiUrl('/api/menus'));
                const json = await res.json();
                if (res.ok && Array.isArray(json.data)) {
                    menus = json.data.map((m) => ({
                        code: m.mnu_code,
                        label: m.mnu_name || m.mnu_description,
                        icon: m.mnu_icon
                    }));
                }
            } catch {}

            if (!menus.length) {
                menus = [
                    { code: 'menuSchedule', label: 'My Schedule', icon: 'S' },
                    { code: 'menuChangeRequest', label: 'Change Request', icon: 'C' },
                    { code: 'menuScheduleSummary', label: 'Schedule Summary', icon: 'Σ' },
                    { code: 'menuKpiDashboard', label: 'KPI Dashboard', icon: 'K' }
                ];
            }

            const palette = [
                ['#38bdf8', '#fbbf24'],
                ['#a7f3d0', '#60a5fa'],
                ['#fda4af', '#fde68a'],
                ['#c4b5fd', '#f9a8d4']
            ];

            const decodeHtmlNumericEntities = (value) => {
                const text = String(value || '');
                return text
                    .replace(/&#x([0-9a-f]+);/gi, (full, hex) => {
                        const codePoint = Number.parseInt(hex, 16);
                        if (!Number.isFinite(codePoint)) return full;
                        try {
                            return String.fromCodePoint(codePoint);
                        } catch {
                            return full;
                        }
                    })
                    .replace(/&#([0-9]+);/g, (full, dec) => {
                        const codePoint = Number.parseInt(dec, 10);
                        if (!Number.isFinite(codePoint)) return full;
                        try {
                            return String.fromCodePoint(codePoint);
                        } catch {
                            return full;
                        }
                    });
            };

            const resolveMenuIconText = ({ icon, label, code }) => {
                const rawIcon = String(icon || '').trim();
                if (rawIcon) {
                    const decoded = decodeHtmlNumericEntities(rawIcon);
                    return decoded.length > 2 ? decoded.slice(0, 2) : decoded;
                }
                const base = String(label || code || 'M').trim();
                return (base ? base.charAt(0) : 'M').toUpperCase();
            };

            menus.forEach((m, idx) => {
                const item = $('<div>', { class: 'drawer-item', 'data-code': m.code });
                const icon = $('<div>', { class: 'drawer-item-icon' });
                const label = $('<div>', { class: 'drawer-item-label', text: m.label || m.code });

                const colors = palette[idx % palette.length];
                icon.css('background', `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`);
                icon.text(resolveMenuIconText({ icon: m.icon, label: m.label, code: m.code }));

                item.append(icon, label);
                drawerMenu.append(item);
            });
        }
    };

    window.Common = Common;
    window.resolveAvatarUrl = Common.resolveAvatarUrl;
    window.updateUserAvatar = Common.updateTopAvatar;
    window.initAuthMenu = Common.initMenuUI;
    window.updateAuthUI = function (isLoggedIn) {
        if (typeof state.updateAuthUI === 'function') {
            state.updateAuthUI(isLoggedIn);
        }
    };
})();
