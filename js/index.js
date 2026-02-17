$(document).ready(function () {
    const MENU_DESCRIPTION_MAP = {
        menuSignup: 'Create a new account and start using the platform.',
        menuLogin: 'Sign in to access your available menus.'
    };
    const TAB_LABELS = {
        popular: 'Popular',
        schedule: 'Schedule',
        'routine-data': 'Routine Data',
        settings: 'Settings'
    };
    const MAX_USERS_PER_CARD = 10;
    const AVATAR_VISIBLE = 6;
    const TOP_POPULAR_LIMIT = 8;
    const GRID_MAX_ROWS = 25;
    const GRID_ROW_HEIGHT = 25;
    const GRID_HEIGHT = 635;
    const PRIORITY_MENUS = [
        { code: 'menuSignup', label: 'Register', icon: 'RG', category: 'settings', clickCounter: 0, lastClickedAt: null },
        { code: 'menuLogin', label: 'Login', icon: 'LG', category: 'settings', clickCounter: 0, lastClickedAt: null }
    ];
    const PALETTE = [
        ['#60a5fa', '#2563eb'],
        ['#22d3ee', '#3b82f6'],
        ['#93c5fd', '#1d4ed8'],
        ['#bfdbfe', '#0ea5e9'],
        ['#38bdf8', '#1e40af']
    ];

    let allMenus = [];
    let allUsers = [];
    let readableMenuCodes = new Set();
    let isLoggedIn = false;
    let activeTab = 'popular';
    const MENU_AUTH_DEBUG = true;
    const MAIN_CONTAINER_DEFAULT_TITLE = 'Menu Workspace';
    const PAGE_TO_MENU_CODE = {
        register: 'menuSignup',
        login: 'menuLogin',
        personalSettingPage: 'menuSettingsPersonal',
        schedulerHead: 'menuSchedulerHead',
        wardMember: 'menuWardMember',
        schedule: 'menuSchedule',
        change: 'menuChangeRequest',
        userManagement: 'menuUserManagement',
        config: 'menuSettingsSystem',
        kpiEntry: 'menuKpiEntry',
        kpiDefinition: 'menuKpiDefinition',
        kpiDashboardSetting: 'menuKpiDashboardSetting',
        kpiDashboard: 'menuKpiDashboard',
        kpiTools: 'menuKpiTools',
        commonReport: 'menuCommonReport',
        shiftPattern: 'menuShiftPattern',
        userRights: 'menuUserRights',
        attendanceSync: 'menuTimeAttendanceSync'
    };

    function resolveGridTotalRows(comp) {
        if (!comp || typeof comp.getDataSource !== 'function') return 0;
        const ds = comp.getDataSource();
        if (!ds) return 0;

        const totalCount = typeof ds.totalCount === 'function' ? ds.totalCount() : null;
        if (typeof totalCount === 'number' && !Number.isNaN(totalCount)) {
            return totalCount;
        }

        if (typeof ds.items === 'function') {
            const items = ds.items();
            return Array.isArray(items) ? items.length : 0;
        }

        if (Array.isArray(ds._items)) {
            return ds._items.length;
        }

        return 0;
    }

    function syncGridFilterRow(comp) {
        if (!comp || typeof comp.option !== 'function') return;
        const totalRows = resolveGridTotalRows(comp);
        const shouldShowFilter = totalRows > GRID_MAX_ROWS;
        const currentFilterRow = comp.option('filterRow') || {};
        if (Boolean(currentFilterRow.visible) === shouldShowFilter) return;
        comp.option('filterRow', { ...currentFilterRow, visible: shouldShowFilter });
    }

    function applyGridGlobalDefaults() {
        if (!window.DevExpress?.ui?.dxDataGrid) return;

        DevExpress.ui.dxDataGrid.defaultOptions({
            options: {
                rowHeight: GRID_ROW_HEIGHT,
                height: GRID_HEIGHT,
                scrolling: {
                    mode: 'virtual',
                    rowRenderingMode: 'virtual'
                },
                paging: {
                    pageSize: GRID_MAX_ROWS
                },
                filterRow: {
                    visible: false
                },
                onInitialized: (e) => {
                    const comp = e?.component;
                    if (!comp || comp.__globalGridStandardBound) return;
                    comp.__globalGridStandardBound = true;

                    comp.on('contentReady', (args) => {
                        syncGridFilterRow(args?.component || comp);
                    });

                    syncGridFilterRow(comp);
                }
            }
        });
    }

    applyGridGlobalDefaults();

    function setMainContainerTitle(text) {
        const titleEl = $('#mainContainerTitle');
        if (!titleEl.length) return;
        titleEl.text(String(text || MAIN_CONTAINER_DEFAULT_TITLE).trim() || MAIN_CONTAINER_DEFAULT_TITLE);
    }

    function findMenuByCode(code) {
        const normalized = normalizeMenuCode(code);
        return allMenus.find((menu) => normalizeMenuCode(menu.code) === normalized) || null;
    }

    function setMainContainerTitleFromMenu(menu) {
        const label = String(menu?.label || normalizeMenuCode(menu?.code) || '').trim();
        const description = String(menu?.description || resolveMenuDescription(menu?.code, label) || '').trim();
        if (label && description) {
            setMainContainerTitle(`${label} - ${description}`);
            return;
        }
        if (label) {
            setMainContainerTitle(label);
            return;
        }
        setMainContainerTitle(MAIN_CONTAINER_DEFAULT_TITLE);
    }

    function logOpenStateSummary(reason = '') {
        if (!MENU_AUTH_DEBUG) return;
        const stateByCode = {};
        allMenus.forEach((menu) => {
            const key = normalizeMenuCode(menu.code);
            if (!key) return;
            stateByCode[key] = {
                code: menu.code,
                canOpen: canOpenMenu(menu)
            };
        });
        console.log('[menu-grid] open-state summary', {
            reason,
            isLoggedIn,
            allowedReadCodes: Array.from(readableMenuCodes),
            register: stateByCode.menuSignup || { code: null, canOpen: !isLoggedIn },
            login: stateByCode.menuLogin || { code: null, canOpen: !isLoggedIn },
            logout: stateByCode.menuLogout || { code: null, canOpen: isLoggedIn }
        });
    }

    function showMainContainer() {
        const container = $('#mainContainer');
        if (!container.length) return;
        container.removeClass('main-container--hidden').attr('aria-hidden', 'false');
    }

    function showMenuLayer() {
        const container = $('#mainContainer');
        if (!container.length) return;
        container.addClass('main-container--hidden').attr('aria-hidden', 'true');
        $('.page').addClass('pagehidden');
        setMainContainerTitle(MAIN_CONTAINER_DEFAULT_TITLE);
    }

    function showPage(pageId) {
        const target = String(pageId || '').trim();
        if (!target) return;
        const pageEl = $(`#${target}`);
        if (!pageEl.length) return;
        showMainContainer();
        $('.page').addClass('pagehidden');
        pageEl.removeClass('pagehidden');

        const mappedCode = PAGE_TO_MENU_CODE[target];
        if (mappedCode) {
            const mappedMenu = findMenuByCode(mappedCode);
            if (mappedMenu) setMainContainerTitleFromMenu(mappedMenu);
        }
    }

    function renderRegister() {
        showPage('register');
        let isSubmitting = false;
        $('#registerForm').dxForm({
            formData: {
                employeeCode: '',
                name: '',
                email: '',
                password: '',
                phone: '',
                roles: ['user']
            },
            colCount: 2,
            showValidationSummary: true,
            items: [
                { dataField: 'employeeCode', label: { text: 'Employee Code' }, validationRules: [{ type: 'required' }] },
                { dataField: 'name', validationRules: [{ type: 'required' }] },
                { dataField: 'email', validationRules: [{ type: 'required' }, { type: 'email' }] },
                { dataField: 'password', editorOptions: { mode: 'password' }, validationRules: [{ type: 'required' }] },
                { dataField: 'phone' },
                {
                    dataField: 'roles',
                    editorType: 'dxTagBox',
                    visible: false,
                    editorOptions: {
                        items: ['user', 'head', 'approver', 'hr', 'finance', 'admin']
                    }
                }
            ]
        });

        $('#btnSave').dxButton({
            text: 'Register',
            type: 'success',
            width: 100,
            onClick: async () => {
                if (isSubmitting) return;
                const form = $('#registerForm').dxForm('instance');
                if (!form || !form.validate().isValid) return;

                const data = form.option('formData');
                try {
                    isSubmitting = true;
                    const btn = $('#btnSave').dxButton('instance');
                    if (btn) btn.option('disabled', true);
                    const res = await fetch(getApiUrl('/api/auth/register'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.message || 'Register failed');

                    DevExpress.ui.notify('Register success! Please verify your email.', 'success', 3000);
                    if (typeof window.renderLogin === 'function') {
                        window.renderLogin();
                    }
                } catch (err) {
                    DevExpress.ui.notify(err.message || 'Register failed', 'error', 3000);
                } finally {
                    isSubmitting = false;
                    const btn = $('#btnSave').dxButton('instance');
                    if (btn) btn.option('disabled', false);
                }
            }
        });

        $('#btnClose').dxButton({
            text: 'Close',
            type: 'danger',
            width: 100,
            onClick: () => {
                if (typeof window.renderLogin === 'function') {
                    window.renderLogin();
                    return;
                }
                showMenuLayer();
            }
        });
    }

    function normalizeMenuCode(code) {
        return String(code || '').trim().replace(/^\d+/, '');
    }

    function getApiUrl(path) {
        if (window.Common && typeof window.Common.buildApiUrl === 'function') {
            return window.Common.buildApiUrl(path);
        }
        return path;
    }

    function compareMenusByPopularity(a, b) {
        const aCounter = Number(a?.clickCounter || 0);
        const bCounter = Number(b?.clickCounter || 0);
        if (aCounter !== bCounter) return bCounter - aCounter;

        const aTime = new Date(a?.lastClickedAt || 0).getTime();
        const bTime = new Date(b?.lastClickedAt || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;

        return String(a?.code || '').localeCompare(String(b?.code || ''));
    }

    function decodeHtmlNumericEntities(value) {
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
    }

    function resolveMenuIconText(icon, label, code) {
        const rawIcon = String(icon || '').trim();
        if (rawIcon) {
            const decoded = decodeHtmlNumericEntities(rawIcon);
            return decoded.length > 2 ? decoded.slice(0, 2) : decoded;
        }
        const base = String(label || code || 'M').trim();
        return (base ? base.charAt(0) : 'M').toUpperCase();
    }

    function resolveMenuDescription(code, label) {
        const normalized = normalizeMenuCode(code);
        if (MENU_DESCRIPTION_MAP[normalized]) return MENU_DESCRIPTION_MAP[normalized];
        return `Open ${label || normalized || code}.`;
    }

    function normalizeTabName(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return '';
        if (raw === 'routine data' || raw === 'routine_data') return 'routine-data';
        return raw;
    }

    function resolveCategoryFromLayout(layoutMap, code, fallback = 'routine-data') {
        const rawCode = String(code || '').trim();
        const normalizedCode = normalizeMenuCode(rawCode);
        const byRaw = normalizeTabName(layoutMap.get(rawCode));
        if (byRaw && TAB_LABELS[byRaw]) return byRaw;
        const byNormalized = normalizeTabName(layoutMap.get(normalizedCode));
        if (byNormalized && TAB_LABELS[byNormalized]) return byNormalized;
        return fallback;
    }

    function dedupeMenus(menus) {
        const seen = new Set();
        return menus.filter((menu) => {
            const normalized = normalizeMenuCode(menu.code);
            if (!normalized || seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });
    }

    function normalizeUser(user) {
        const id = String(user?._id || user?.id || user?.userId || user?.email || user?.name || '').trim();
        if (!id) return null;
        return {
            id,
            name: String(user?.name || user?.email || 'User').trim(),
            avatar: String(user?.avatar || '').trim()
        };
    }

    function hashString(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
        }
        return hash;
    }

    function pickUsersForMenu(menu, users, limit = MAX_USERS_PER_CARD) {
        const clickers = Array.isArray(menu?.clickers) ? menu.clickers : [];
        if (clickers.length) {
            const seen = new Set();
            const picked = [];
            clickers.forEach((u) => {
                const normalized = normalizeUser(u);
                if (!normalized) return;
                if (seen.has(normalized.id)) return;
                seen.add(normalized.id);
                picked.push(normalized);
            });
            return picked.slice(0, limit);
        }
        if (!Array.isArray(users) || !users.length) return [];
        const baseHash = hashString(normalizeMenuCode(menu?.code));
        const picked = [];
        for (let i = 0; i < Math.min(limit, users.length); i += 1) {
            const idx = (baseHash + i) % users.length;
            picked.push(users[idx]);
        }
        return picked;
    }

    function getInitialLetter(text) {
        const value = String(text || '').trim();
        return value ? value.charAt(0).toUpperCase() : 'U';
    }

    async function fetchMenuLayoutMap() {
        try {
            const res = await fetch(getApiUrl('/api/menu-layouts'));
            const json = await res.json();
            if (!res.ok || !Array.isArray(json.data)) return new Map();
            const map = new Map();
            json.data.forEach((row) => {
                const code = String(row?.mnu_code || '').trim();
                const tabName = normalizeTabName(row?.tab_name);
                const normalizedCode = normalizeMenuCode(code);
                if (code && tabName) map.set(code, tabName);
                if (normalizedCode && tabName) map.set(normalizedCode, tabName);
            });
            return map;
        } catch {
            return new Map();
        }
    }

    async function fetchMenus(layoutMap = new Map()) {
        try {
            const res = await fetch(getApiUrl('/api/menus'));
            const json = await res.json();
            if (!res.ok || !Array.isArray(json.data)) return [];
            return json.data
                .map((m) => ({
                    code: String(m?.mnu_code || m?.code || '').trim(),
                    label: String(m?.mnu_name || m?.mnu_description || m?.label || m?.mnu_code || '').trim(),
                    description: String(m?.mnu_description || '').trim(),
                    icon: String(m?.mnu_icon || m?.icon || '').trim(),
                    clickCounter: Number(m?.mnu_clickCounter || 0),
                    lastClickedAt: m?.mnu_lastClickedAt ? new Date(m.mnu_lastClickedAt).toISOString() : null,
                    clickers: Array.isArray(m?.last10Clicker) ? m.last10Clicker.map(normalizeUser).filter(Boolean) : [],
                    category: resolveCategoryFromLayout(layoutMap, String(m?.mnu_code || m?.code || '').trim())
                }))
                .filter((m) => m.code)
                .sort((a, b) => a.code.localeCompare(b.code));
        } catch {
            return [];
        }
    }

    async function fetchUsers() {
        if (!window.Common || typeof window.Common.getToken !== 'function' || !window.Common.getToken()) {
            return [];
        }
        try {
            const res = await window.Common.fetchWithAuth('/api/users');
            const json = await res.json();
            if (!res.ok || !Array.isArray(json.data)) return [];
            return json.data.map(normalizeUser).filter(Boolean);
        } catch {
            return [];
        }
    }

    async function fetchReadableMenuCodes() {
        const token = window.Common?.getToken?.();
        if (!token) {
            if (MENU_AUTH_DEBUG) {
                console.log('[menu-grid] fetchReadableMenuCodes: no token');
            }
            return new Set();
        }
        try {
            const res = await window.Common.fetchWithAuth('/api/menu-authorize/me');
            const json = await res.json();
            if (MENU_AUTH_DEBUG) {
                console.log('[menu-grid] /api/menu-authorize/me response', {
                    ok: res.ok,
                    status: res.status,
                    rows: Array.isArray(json?.data) ? json.data.length : 0,
                    data: json?.data
                });
            }
            if (!res.ok || !Array.isArray(json.data)) return new Set();
            const allowed = new Set();
            json.data.forEach((item) => {
                if (Number(item?.acc_read) !== 1) return;
                const rawCode = String(item?.mnu_code || '').trim();
                const normalizedCode = normalizeMenuCode(rawCode);
                if (rawCode) allowed.add(rawCode);
                if (normalizedCode) allowed.add(normalizedCode);
            });
            if (MENU_AUTH_DEBUG) {
                console.log('[menu-grid] allowed read menu codes', Array.from(allowed));
            }
            return allowed;
        } catch {
            if (MENU_AUTH_DEBUG) {
                console.log('[menu-grid] fetchReadableMenuCodes failed');
            }
            return new Set();
        }
    }

    function canOpenMenu(menu) {
        const rawCode = String(menu?.code || '').trim();
        const normalizedCode = normalizeMenuCode(rawCode);
        if (!normalizedCode) return false;

        if (normalizedCode === 'menuSignup' || normalizedCode === 'menuLogin') {
            return !isLoggedIn;
        }
        if (normalizedCode === 'menuLogout') {
            return isLoggedIn;
        }
        if (!isLoggedIn) return false;

        return readableMenuCodes.has(rawCode) || readableMenuCodes.has(normalizedCode);
    }

    function buildMenuList(dbMenus) {
        const byNormalized = new Map(
            dbMenus.map((m) => [normalizeMenuCode(m.code), m])
        );
        const normalizedPriority = new Set(PRIORITY_MENUS.map((m) => normalizeMenuCode(m.code)));

        const head = PRIORITY_MENUS.map((p) => {
            const matched = byNormalized.get(normalizeMenuCode(p.code));
            if (!matched) return p;
            return {
                ...matched,
                label: matched.label || p.label,
                icon: matched.icon || p.icon,
                category: matched.category || p.category
            };
        });
        const tail = dbMenus.filter((m) => !normalizedPriority.has(normalizeMenuCode(m.code)));
        return dedupeMenus([...head, ...tail]);
    }

    function filterMenusByTab(menus, tab) {
        if (tab === 'popular') {
            return [...menus].sort(compareMenusByPopularity).slice(0, TOP_POPULAR_LIMIT);
        }
        if (tab === 'schedule') return menus.filter((m) => m.category === 'schedule');
        if (tab === 'routine-data') return menus.filter((m) => m.category === 'routine-data');
        if (tab === 'settings') return menus.filter((m) => m.category === 'settings');
        return menus;
    }

    function updateToolbarMeta(count, tab) {
        const label = TAB_LABELS[tab] || TAB_LABELS.popular;
        $('#menuToolbarMeta').text(`${label} (${count})`);
    }

    function bindTabs() {
        $('#menuTabs').on('click', '.menu-tab', function () {
            const tab = String($(this).data('tab') || '').trim() || 'popular';
            activeTab = tab;
            $('#menuTabs .menu-tab').removeClass('is-active');
            $(this).addClass('is-active');
            render();
        });
    }

    function createAvatarNode(user) {
        const node = $('<div>', {
            class: 'menu-user-avatar',
            title: user.name || 'User'
        });
        const resolved = window.Common?.resolveAvatarUrl?.(user.avatar) || '';
        if (resolved) {
            node.addClass('has-image');
            const img = $('<img>', { src: resolved, alt: user.name || 'User avatar', loading: 'lazy' });
            img.on('error', () => {
                node.removeClass('has-image');
                node.empty().text(getInitialLetter(user.name));
            });
            node.append(img);
            return node;
        }
        node.text(getInitialLetter(user.name));
        return node;
    }

    function renderCardFooter(card, menu, users) {
        const footer = $('<div>', { class: 'menu-card-footer' });
        const left = $('<div>', { class: 'menu-card-users' });
        const stack = $('<div>', { class: 'menu-user-stack' });
        const list = pickUsersForMenu(menu, users, MAX_USERS_PER_CARD);
        const visible = list.slice(0, AVATAR_VISIBLE);

        if (!visible.length) {
            stack.append($('<div>', { class: 'menu-user-avatar menu-user-avatar--ghost', text: '-' }));
        } else {
            visible.forEach((user) => stack.append(createAvatarNode(user)));
            if (list.length > visible.length) {
                stack.append($('<div>', {
                    class: 'menu-user-avatar menu-user-avatar--more',
                    text: `+${list.length - visible.length}`
                }));
            }
        }

        left.append(stack, $('<div>', { class: 'menu-card-users-text', text: 'Last 10 users' }));
        const canOpen = canOpenMenu(menu);
        const action = $('<button>', {
            class: 'menu-card-action',
            type: 'button',
            text: 'Open',
            disabled: !canOpen,
            'aria-disabled': String(!canOpen)
        });
        if (!canOpen) action.addClass('is-disabled');
        action.on('click', () => handleOpenMenu(menu));
        footer.append(left, action);
        card.append(footer);
    }

    async function trackMenuClick(menu) {
        const token = window.Common?.getToken?.();
        if (!token) return null;
        try {
            const code = encodeURIComponent(String(menu?.code || '').trim());
            const res = await window.Common.fetchWithAuth(`/api/menus/${code}/click`, { method: 'POST' });
            const json = await res.json();
            if (!res.ok || !json?.data) return null;
            return json.data;
        } catch {
            return null;
        }
    }

    function applyClickResult(menu, data) {
        if (!menu || !data) return;
        menu.clickCounter = Number(data?.mnu_clickCounter || menu.clickCounter || 0);
        menu.lastClickedAt = data?.mnu_lastClickedAt || menu.lastClickedAt || null;
        menu.clickers = Array.isArray(data?.last10Clicker)
            ? data.last10Clicker.map(normalizeUser).filter(Boolean)
            : menu.clickers;
    }

    function invokeMenuAction(menu) {
        const normalized = normalizeMenuCode(menu?.code);
        const resolvedMenu = menu?.label ? menu : (findMenuByCode(normalized) || menu);
        setMainContainerTitleFromMenu(resolvedMenu);
        const actions = {
            menuSignup: () => window.renderRegister?.(),
            menuSettingsPersonal: () => window.renderPersonalSettings?.(),
            menuSettingsSystem: () => (window.renderSystemSettings || window.renderConfigManagement)?.(),
            menuSchedulerHead: () => window.renderSchedulerHead?.(),
            menuWardMember: () => window.renderWardMember?.(),
            menuSchedule: () => window.renderSchedule?.(),
            menuChangeRequest: () => window.renderChangeRequest?.(),
            menuScheduleSummary: () => window.renderScheduleSummary?.(),
            menuKpiEntry: () => window.renderKpiEntry?.(),
            menuKpiDefinition: () => window.renderKpiDefinitions?.(),
            menuKpiDashboardSetting: () => window.renderKpiDashboardSetting?.(),
            menuKpiDashboard: () => window.renderKpiDashboard?.(),
            menuKpiTools: () => window.renderKpiTools?.(),
            menuCommonReport: () => window.renderCommonReport?.(),
            menuUserManagement: () => window.renderUserManagement?.(),
            menuShiftPattern: () => window.renderShiftPattern?.(),
            menuUserShiftRate: () => window.renderUserShiftRate?.(),
            menuUserRights: () => window.renderUserRights?.(),
            menuTimeAttendanceSync: () => window.renderAttendanceSync?.(),
            menuLogin: () => window.renderLogin?.(),
            menuLogout: () => window.Common?.logout?.()
        };

        const action = actions[normalized];
        if (typeof action === 'function') {
            action();
            return;
        }
        DevExpress?.ui?.notify?.(`No action handler for ${normalized}`, 'warning', 2000);
    }

    async function handleOpenMenu(menu) {
        if (!canOpenMenu(menu)) return;
        const clickResult = await trackMenuClick(menu);
        applyClickResult(menu, clickResult);
        invokeMenuAction(menu);
        render();
    }

    function renderMenuCards(menus, users) {
        const grid = $('#menuGrid');
        if (!grid.length) return;
        grid.empty();

        if (!menus.length) {
            grid.append($('<div>', { class: 'menu-empty', text: 'No menu data' }));
            return;
        }

        menus.forEach((menu, idx) => {
            const colors = PALETTE[idx % PALETTE.length];
            const iconText = resolveMenuIconText(menu.icon, menu.label, menu.code);
            const labelText = menu.label || menu.code;

            const card = $('<article>', { class: 'menu-card', 'data-code': menu.code, title: labelText });
            const icon = $('<div>', { class: 'menu-card-icon', text: iconText });
            icon.css('background', `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`);

            card.append(icon);
            card.append($('<h3>', { class: 'menu-card-name', text: labelText }));
            card.append($('<p>', {
                class: 'menu-card-desc',
                text: menu.description || resolveMenuDescription(menu.code, labelText)
            }));
            card.append($('<div>', { class: 'menu-card-divider' }));
            renderCardFooter(card, menu, users);

            grid.append(card);
        });
    }

    function render() {
        const filtered = filterMenusByTab(allMenus, activeTab);
        updateToolbarMeta(filtered.length, activeTab);
        renderMenuCards(filtered, allUsers);
    }

    async function initMenuGrid() {
        isLoggedIn = !!window.Common?.getToken?.();
        const [layoutMap, users, allowedCodes] = await Promise.all([
            fetchMenuLayoutMap(),
            fetchUsers(),
            fetchReadableMenuCodes()
        ]);
        const dbMenus = await fetchMenus(layoutMap);
        allMenus = buildMenuList(dbMenus);
        allUsers = users;
        readableMenuCodes = allowedCodes;
        render();
        logOpenStateSummary('initMenuGrid');
    }

    if (window.Common) {
        if (typeof window.Common.renderProfileAvatar === 'function') {
            window.Common.renderProfileAvatar($('#avatar'));
        }
        if (typeof window.Common.setFavicon === 'function') {
            window.Common.setFavicon();
        }
    }

    window.showPage = showPage;
    window.showMenuLayer = showMenuLayer;
    window.renderRegister = renderRegister;
    window.renderSystemSettings = window.renderSystemSettings || window.renderConfigManagement;
    window.drawerAction = function drawerAction(menuCode) {
        invokeMenuAction({ code: menuCode });
    };

    $('#mainContainerClose').on('click', () => showMenuLayer());
    $(document).on('keydown', (event) => {
        if (event.key === 'Escape') {
            showMenuLayer();
        }
    });

    bindTabs();
    initMenuGrid();
    window.rebuildMenuGrid = initMenuGrid;
});
