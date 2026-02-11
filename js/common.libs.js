// js/common.libs.js
// Shared constants and helpers
(function () {
    const rawBaseUrl = typeof window.BASE_URL === 'string' ? window.BASE_URL.trim() : '';
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    window.BASE_URL = rawBaseUrl || (isLocalHost ? 'http://localhost:3000' : '');

    const state = {
        menuReady: false,
        pendingAllowedCodes: null,
        menuButtons: {},
        dropdownMenu: null,
        topAvatarEl: null,
        updateAuthUI: null
    };

    const Common = {
        // constants
        APP_NAME: 'Nurse Scheduler',

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
            if (raw.startsWith('/')) return raw;
            if (raw.startsWith('uploads/')) return `/${raw}`;
            if (!raw.includes('/')) return `/uploads/${raw}`;
            return `/${raw}`;
        },

        resolveAvatarUrl(avatarUrl) {
            if (!avatarUrl) return '';
            if (
                avatarUrl.startsWith('http://') ||
                avatarUrl.startsWith('https://') ||
                avatarUrl.startsWith('data:') ||
                avatarUrl.startsWith('blob:')
            ) {
                return avatarUrl;
            }
            const apiBase = (window.BASE_URL || '').replace(/\/+$/, '');
            const path = Common.normalizeAvatarPath(avatarUrl);
            return apiBase ? `${apiBase}${path}` : path;
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
            try {
                const res = await Common.fetchWithAuth('/api/users/me');
                const json = await res.json();
                if (res.ok) {

                    const avatarUrl = json?.data?.avatar || '';
                    link.href = Common.resolveAvatarUrl(avatarUrl) || fallback;
                    return;
                }
            } catch {}
            link.href = fallback;
        },

        async renderProfileAvatar(avatarEl) {
            if (!avatarEl) return;
            const res = this.fetchWithAuth(`api/users/me`);
            const json = await (await res).json();
            const profile = json?.data || {};
            const avatarUrl = profile?.avatar || '';
            const proto=window.location.hostname;
            avatarEl.attr('src', Common.resolveAvatarUrl(avatarUrl) || 'images/defaultprofile.jpg');
            Common.setFavicon();
        },

        applyMenuAuthorization(allowedCodes) {
            if (!state.menuReady) {
                state.pendingAllowedCodes = allowedCodes;
                return;
            }
            const allowed = new Set(allowedCodes || []);
            Object.keys(state.menuButtons).forEach((id) => {
                if (id === 'menuLogin' || id === 'menuLogout') return;
                if (!allowed.size) {
                    state.menuButtons[id].toggle(true);
                    return;
                }
                state.menuButtons[id].toggle(allowed.has(id));
            });
        },

        async loadMenuAuthorization(token) {
            if (!token) {
                Common.applyMenuAuthorization(null);
                return;
            }
            try {
                const res = await fetch(Common.buildApiUrl('/api/menu-authorize/me'), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (res.ok && Array.isArray(json.data)) {
                    const allowed = json.data
                        .filter((m) => Number(m.acc_read) === 1)
                        .map((m) => m.mnu_code);
                    Common.applyMenuAuthorization(allowed);
                    return;
                }
            } catch {}
            Common.applyMenuAuthorization(null);
        },

        logout() {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_roles');
            localStorage.removeItem('auth_kpi_tools');
            Common.updateTopAvatar(null);
            if (typeof state.updateAuthUI === 'function') {
                state.updateAuthUI(false);
            }
            Common.loadMenuAuthorization(null);
            if (typeof window.showPage === 'function') {
                window.showPage('personalDashboard');
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
                menus.forEach((item) => {
                    const menuItem = $('<button>', {
                        text: item.mnu_description || item.text || item.id,
                        class: 'dropdown-item',
                        click: () => {
            const token = Common.getToken();
                            if (!token) {
                                if (typeof window.renderLogin === 'function') {
                                    window.renderLogin();
                                }
                                dropdownMenu.hide();
                                return;
                            }
                            if (typeof menuActions[item.id] === 'function') {
                                menuActions[item.id]();
                            }
                            dropdownMenu.hide();
                        }
                    });
                    if (item.id) state.menuButtons[item.id] = menuItem;
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
                if (state.menuButtons.menuLogin) state.menuButtons.menuLogin.toggle(!isLoggedIn);
                if (state.menuButtons.menuLogout) state.menuButtons.menuLogout.toggle(isLoggedIn);
            };

            const initialToken = Common.getToken();
            state.updateAuthUI(!!initialToken);
            loadMenus().then(() => {
                if (initialToken) {
                    Common.loadMenuAuthorization(initialToken);
                    Common.renderProfileAvatar(state.topAvatarEl);
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
                        label: m.mnu_description,
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

            menus.forEach((m, idx) => {
                const item = $('<div>', { class: 'drawer-item', 'data-code': m.code });
                const icon = $('<div>', { class: 'drawer-item-icon' });
                const label = $('<div>', { class: 'drawer-item-label', text: m.label || m.code });

                const colors = palette[idx % palette.length];
                icon.css('background', `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`);
                icon.text((m.icon || m.label || m.code || 'M').trim().charAt(0).toUpperCase());

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
