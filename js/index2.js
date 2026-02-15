// js/index2.js
$(document).ready(function() {
    const GRID_MAX_ROWS = 25;
    const GRID_ROW_HEIGHT = 25;
    const GRID_HEIGHT = GRID_MAX_ROWS * GRID_ROW_HEIGHT + 10;

    if (window.DevExpress?.ui?.dxDataGrid) {
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
                editing: {
                    useIcons: true
                },
                onInitialized: (e) => {
                    const comp = e?.component;
                    if (!comp) return;

                    const scrolling = comp.option('scrolling') || {};
                    comp.option('scrolling', {
                        ...scrolling,
                        mode: 'virtual',
                        rowRenderingMode: 'virtual'
                    });

                    const paging = comp.option('paging') || {};
                    comp.option('paging', {
                        ...paging,
                        pageSize: GRID_MAX_ROWS
                    });

                    const editing = comp.option('editing') || {};
                    const allowPopup = !!(editing.allowAdding || editing.allowUpdating);
                    if (allowPopup) {
                        comp.option('editing', {
                            ...editing,
                            mode: 'popup',
                            popup: {
                                showTitle: true,
                                title: 'Data Management',
                                width: 760,
                                maxHeight: '85vh',
                                ...(editing.popup || {})
                            }
                        });
                    }

                    comp.option('height', GRID_HEIGHT);
                },
                onContentReady: (e) => {
                    const comp = e?.component;
                    if (!comp || typeof comp.getDataSource !== 'function') return;
                    const ds = comp.getDataSource();
                    let total = 0;
                    if (ds) {
                        const tc = typeof ds.totalCount === 'function' ? ds.totalCount() : null;
                        if (typeof tc === 'number' && !Number.isNaN(tc)) {
                            total = tc;
                        } else if (typeof ds.items === 'function') {
                            total = ds.items().length;
                        } else if (Array.isArray(ds._items)) {
                            total = ds._items.length;
                        }
                    }
                    const filterRow = comp.option('filterRow') || {};
                    comp.option('filterRow', { ...filterRow, visible: total > GRID_MAX_ROWS });
                }
            }
        });
    }

    function showPage(pageId) {
        $('.page').addClass('pagehidden');
        $(`#${pageId}`).removeClass('pagehidden');
    }

    const DRAWER_MODE_EXPANDED = 0;
    const DRAWER_MODE_TOGGLE_ONLY = 1;
    let currentDrawerMode = DRAWER_MODE_EXPANDED;
    const DRAWER_WIDTH_STORAGE_KEY = 'scheduler.drawer.width';
    const DRAWER_RESIZE_STEP = 16;
    const normalizeMenuCode = (code) => String(code || '').trim().replace(/^\d+/, '');
    const rootStyle = window.getComputedStyle(document.documentElement);
    const parseCssPx = (cssValue, fallback) => {
        const next = Number.parseFloat(String(cssValue || '').trim());
        return Number.isFinite(next) ? next : fallback;
    };
    const DEFAULT_DRAWER_WIDTH = parseCssPx(rootStyle.getPropertyValue('--drawer-width'), 220);
    const DRAWER_MIN_WIDTH = parseCssPx(rootStyle.getPropertyValue('--drawer-width-min'), 180);
    const DRAWER_MAX_WIDTH = parseCssPx(rootStyle.getPropertyValue('--drawer-width-max'), 420);
    let expandedDrawerWidth = DEFAULT_DRAWER_WIDTH;

    function isDesktopLayout() {
        return !window.matchMedia('(max-width: 900px)').matches;
    }

    function clampDrawerWidth(width) {
        return Math.max(DRAWER_MIN_WIDTH, Math.min(DRAWER_MAX_WIDTH, width));
    }

    function setExpandedDrawerWidth(width, persist = true) {
        const clampedWidth = clampDrawerWidth(width);
        expandedDrawerWidth = clampedWidth;
        document.documentElement.style.setProperty('--drawer-width', `${clampedWidth}px`);
        if (!persist) return;
        try {
            localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clampedWidth));
        } catch {}
    }

    function restoreDrawerWidth() {
        try {
            const raw = localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
                setExpandedDrawerWidth(DEFAULT_DRAWER_WIDTH, false);
                return;
            }
            setExpandedDrawerWidth(parsed, false);
        } catch {
            setExpandedDrawerWidth(DEFAULT_DRAWER_WIDTH, false);
        }
    }

    function syncDrawerSplitterState() {
        const splitter = $('#drawerSplitter');
        if (!splitter.length) return;
        const isDisabled = !isDesktopLayout() || currentDrawerMode === DRAWER_MODE_TOGGLE_ONLY;
        splitter.toggleClass('is-disabled', isDisabled);
        splitter.attr('aria-disabled', String(isDisabled));
    }

    function applyDrawerState(mode) {
        const drawer = $('#drawer');
        drawer.removeClass('drawer--icon drawer--icon-text drawer--text drawer--toggle-only');
        if (mode === DRAWER_MODE_TOGGLE_ONLY) {
            drawer.addClass('drawer--toggle-only');
            syncDrawerSplitterState();
            return;
        }
        drawer.addClass('drawer--icon-text');
        syncDrawerSplitterState();
    }

    function bindDrawerSplitter() {
        const splitter = document.getElementById('drawerSplitter');
        const drawer = document.getElementById('drawer');
        if (!splitter || !drawer) return;

        let isResizing = false;
        let pointerId = null;
        let startX = 0;
        let startWidth = 0;

        const stopResize = (event) => {
            if (!isResizing) return;
            isResizing = false;
            document.body.classList.remove('is-resizing-drawer');
            if (pointerId !== null && typeof splitter.releasePointerCapture === 'function') {
                try { splitter.releasePointerCapture(pointerId); } catch {}
            }
            pointerId = null;
            if (event?.preventDefault) event.preventDefault();
        };

        splitter.addEventListener('pointerdown', (event) => {
            if (!isDesktopLayout() || currentDrawerMode === DRAWER_MODE_TOGGLE_ONLY) return;
            isResizing = true;
            pointerId = event.pointerId;
            startX = event.clientX;
            startWidth = drawer.getBoundingClientRect().width;
            document.body.classList.add('is-resizing-drawer');
            if (typeof splitter.setPointerCapture === 'function') {
                try { splitter.setPointerCapture(pointerId); } catch {}
            }
            event.preventDefault();
        });

        splitter.addEventListener('pointermove', (event) => {
            if (!isResizing) return;
            const deltaX = event.clientX - startX;
            setExpandedDrawerWidth(startWidth + deltaX);
            event.preventDefault();
        });

        splitter.addEventListener('pointerup', stopResize);
        splitter.addEventListener('pointercancel', stopResize);
        splitter.addEventListener('dblclick', () => {
            if (!isDesktopLayout()) return;
            setExpandedDrawerWidth(DEFAULT_DRAWER_WIDTH);
        });

        splitter.addEventListener('keydown', (event) => {
            if (!isDesktopLayout() || currentDrawerMode === DRAWER_MODE_TOGGLE_ONLY) return;
            if (event.key === 'ArrowLeft') {
                setExpandedDrawerWidth(expandedDrawerWidth - DRAWER_RESIZE_STEP);
                event.preventDefault();
            }
            if (event.key === 'ArrowRight') {
                setExpandedDrawerWidth(expandedDrawerWidth + DRAWER_RESIZE_STEP);
                event.preventDefault();
            }
            if (event.key === 'Home') {
                setExpandedDrawerWidth(DRAWER_MIN_WIDTH);
                event.preventDefault();
            }
            if (event.key === 'End') {
                setExpandedDrawerWidth(DRAWER_MAX_WIDTH);
                event.preventDefault();
            }
        });

        window.addEventListener('resize', syncDrawerSplitterState);
    }

    function normalizeDrawerModeInput(state) {
        if (state === 'toggle-only' || state === 'collapsed') return DRAWER_MODE_TOGGLE_ONLY;
        if (state === 'expanded' || state === 'icon-text') return DRAWER_MODE_EXPANDED;

        const next = Number(state);
        if (Number.isNaN(next)) return currentDrawerMode;
        // Backward compatibility with legacy states:
        // 0/1/2 => expanded, 3 => toggle-only
        return next === 3 ? DRAWER_MODE_TOGGLE_ONLY : DRAWER_MODE_EXPANDED;
    }

    async function buildDrawerMenu() {
        const drawerMenu = $('#drawerMenu');
        if (!drawerMenu.length) return;
        drawerMenu.empty();
        const token = Common?.getToken?.();

        let menus = [];
        try {
            const res = await fetch(Common.buildApiUrl('/api/menus'));
            const json = await res.json();
            if (res.ok && Array.isArray(json.data)) {
                menus = json.data.map((m) => ({
                    code: m.mnu_code,
                    label: m.mnu_description,
                    icon: m.mnu_icon
                })).sort((a, b) => String(a.code).localeCompare(String(b.code)));
            }
        } catch {}

        const allowedReadCodes = new Set();
        if (token) {
            try {
                const res = await fetch(Common.buildApiUrl('/api/menu-authorize/me'), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (res.ok && Array.isArray(json.data)) {
                    json.data
                        .filter((m) => Number(m.acc_read) === 1)
                        .forEach((m) => {
                            const rawCode = String(m.mnu_code || '').trim();
                            const normalized = normalizeMenuCode(rawCode);
                            if (rawCode) allowedReadCodes.add(rawCode);
                            if (normalized) allowedReadCodes.add(normalized);
                        });
                }
            } catch {}
        }

        const palette = [
            ['#38bdf8', '#fbbf24'],
            ['#a7f3d0', '#60a5fa'],
            ['#fda4af', '#fde68a'],
            ['#c4b5fd', '#f9a8d4']
        ];

        const visibleMenus = menus.filter((m) => {
            const rawCode = String(m.code || '').trim();
            const normalized = normalizeMenuCode(rawCode);
            if (normalized === 'menuSignup' || normalized === 'menuLogin') return !token;
            if (normalized === 'menuLogout') return !!token;
            if (!token) return false;
            return allowedReadCodes.has(rawCode) || allowedReadCodes.has(normalized);
        });

        visibleMenus.forEach((m, idx) => {
            const item = $('<div>', { class: 'drawer-item', 'data-code': m.code });
            const icon = $('<div>', { class: 'drawer-item-icon' });
            const displayCode = normalizeMenuCode(m.code);
            const labelText = m.label || displayCode || m.code;
            const label = $('<div>', { class: 'drawer-item-label', text: labelText });

            const colors = palette[idx % palette.length];
            icon.css('background', `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`);
            icon.text((m.icon || labelText || displayCode || m.code || 'M').trim().charAt(0).toUpperCase());

            item.append(icon, label);
            item.on('click', () => {
                currentDrawerMode = DRAWER_MODE_TOGGLE_ONLY;
                applyDrawerState(currentDrawerMode);
                if (typeof window.drawerAction === 'function') {
                    window.drawerAction(displayCode || m.code);
                }
            });
            drawerMenu.append(item);
        });
        applyDrawerState(currentDrawerMode);
    }

    window.drawerAction = function drawerAction(menuCode) {
        console.log('Drawer action triggered for menu code:', menuCode);
        if (menuCode !== 'menuSignup' && menuCode !== 'menuLogin') {
            if (!Common?.getToken?.()) {
                if (typeof window.renderLogin === 'function') {
                    window.renderLogin();
                }
                return;
            }
        }

        const actions = {
            menuSignup: () => window.renderRegister?.(),
            menuSettingsPersonal: () => window.renderPersonalSettings?.(),
            menuSettingsSystem: () => window.renderConfigManagement?.(),
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
            menuTimeAttendanceSync: () => {
                if (typeof window.renderAttendanceSync === 'function') {
                    window.renderAttendanceSync();
                }
            },
            menuLogin: () => window.renderLogin?.(),
            menuLogout: () => window.Common?.logout?.()
        };

        if (typeof actions[menuCode] === 'function') {
            actions[menuCode]();
        } else {
            console.warn('No action handler for menu code:', menuCode);
        }
    };

    $('#drawerToggle').on('click', async () => {
        currentDrawerMode = currentDrawerMode === DRAWER_MODE_EXPANDED
            ? DRAWER_MODE_TOGGLE_ONLY
            : DRAWER_MODE_EXPANDED;
        applyDrawerState(currentDrawerMode);
    });

    restoreDrawerWidth();
    bindDrawerSplitter();
    syncDrawerSplitterState();
    buildDrawerMenu();
    window.rebuildDrawerMenu = async function rebuildDrawerMenu() {
        await buildDrawerMenu();
    };
    window.setDrawerState = async function setDrawerState(state) {
        currentDrawerMode = normalizeDrawerModeInput(state);
        applyDrawerState(currentDrawerMode);
    };

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
                if (!form.validate().isValid) return;

                const data = form.option('formData');
                try {
                    isSubmitting = true;
                    const btn = $('#btnSave').dxButton('instance');
                    if (btn) btn.option('disabled', true);
                    const res = await fetch(Common.buildApiUrl('/api/auth/register'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    const json = await res.json();

                    if (!res.ok) {
                        throw new Error(json.message || 'Register failed');
                    }

                    DevExpress.ui.notify(
                        'Register success! Please verify your email.',
                        'success',
                        3000
                    );
                    if (typeof window.renderLogin === 'function') {
                        window.renderLogin();
                    } else {
                        showPage('login');
                    }
                } catch (err) {
                    DevExpress.ui.notify(err.message, 'error', 3000);
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
            onClick() {
                if (typeof window.renderLogin === 'function') {
                    window.renderLogin();
                } else {
                    showPage('login');
                }
            }
        });
    }

    window.showPage = showPage;
    window.renderRegister = renderRegister;
});
