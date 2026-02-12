// js/index.js
$(document).ready(function() {
    const rawBaseUrl = typeof window.BASE_URL === 'string' ? window.BASE_URL.trim() : '';
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const BASE_URL = rawBaseUrl || (isLocalHost ? 'http://localhost:3000' : '');
    window.BASE_URL = BASE_URL;
    if (typeof window.initAuthMenu === 'function') {
        window.initAuthMenu();
    }
    if (window.Common?.buildDrawerMenu) {
        window.Common.buildDrawerMenu();
    }

    const bootToken = localStorage.getItem('auth_token');
    if (!bootToken && typeof window.renderLogin === 'function') {
        window.renderLogin();
    }

    const GRID_VISIBLE_ROWS = 25;
    const GRID_ROW_HEIGHT = 25;
    const GRID_HEIGHT = GRID_VISIBLE_ROWS * GRID_ROW_HEIGHT + 10;

    if (window.DevExpress?.ui?.dxDataGrid) {
        DevExpress.ui.dxDataGrid.defaultOptions({
            options: {
                rowHeight: GRID_ROW_HEIGHT,
                height: GRID_HEIGHT,
                scrolling: {
                    mode: 'virtual'
                },
                editing: {
                    useIcons: true
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
                    const show = total > 25;
                    const filterRow = comp.option('filterRow') || {};
                    // const headerFilter = comp.option('headerFilter') || {};
                    comp.option('filterRow', { ...filterRow, visible: show });
                    // comp.option('headerFilter', { ...headerFilter, visible: show });
                }
            }
        });
    }

    // Force DevExtreme eval banner to a small height (inline !important overrides CSS).
    function shrinkDxLicense() {
        const el = document.querySelector('dx-license');
        if (!el) return;
        el.style.setProperty('height', '4px', 'important');
        el.style.setProperty('line-height', '4px', 'important');
        el.style.setProperty('padding', '0 4px', 'important');
        el.style.setProperty('font-size', '4px', 'important');
        el.style.setProperty('max-height', '4px', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.style.setProperty('position', 'fixed', 'important');
    }
    shrinkDxLicense();
    new MutationObserver(shrinkDxLicense).observe(document.body, { childList: true, subtree: true });
    function showPage(pageId) {
        $('.page').addClass('pagehidden');
        $(`#${pageId}`).removeClass('pagehidden');
    }

    window.renderPersonalDashboard = function renderPersonalDashboard(payload = {}) {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            if (typeof window.renderLogin === 'function') {
                window.renderLogin();
            } else {
                showPage('login');
            }
            return;
        }
        showPage('personalDashboard');
        const dash = $('#personalDashboard');
        const profile = payload.profile || {};
        const wards = Array.isArray(payload.wards) ? payload.wards : [];
        const roleText = Array.isArray(profile.roles) ? profile.roles.join(', ') : '';
        const wardText = wards.length ? wards.map(w => w.name || w.code).join(', ') : 'No wards';

        dash.empty();
        const header = $('<div class="dashboard-hero"></div>');
        header.append($('<div class="dashboard-title"></div>').text('Personal Dashboard'));
        header.append($('<div class="dashboard-subtitle"></div>').text('Quick snapshot for your account'));

        const cards = $('<div class="dashboard-cards"></div>');
        cards.append(
            $('<div class="dashboard-card"></div>')
                .append('<div class="dashboard-card-label">Name</div>')
                .append(`<div class="dashboard-card-value">${profile.name || profile.email || 'User'}</div>`)
        );
        cards.append(
            $('<div class="dashboard-card"></div>')
                .append('<div class="dashboard-card-label">Roles</div>')
                .append(`<div class="dashboard-card-value">${roleText || '-'}</div>`)
        );
        cards.append(
            $('<div class="dashboard-card"></div>')
                .append('<div class="dashboard-card-label">Wards</div>')
                .append(`<div class="dashboard-card-value">${wardText}</div>`)
        );

        dash.append(header, cards);
    };


    // renderPersonalSettings moved to js/personal.js

    // system settings are split into dedicated modules (config/ward/scheduler/etc.)
    window.showPage = showPage;
});
