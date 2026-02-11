// js/index2.js
$(document).ready(function() {
    function showPage(pageId) {
        $('.page').addClass('pagehidden');
        $(`#${pageId}`).removeClass('pagehidden');
    }

    // state: 0 = icon only, 1 = text only, 2 = icon + text, 3 = toggle button only
    let currentStateIndex = 2;

    function applyDrawerState(state) {
        const drawer = $('#drawer');
        drawer.removeClass('drawer--icon drawer--icon-text drawer--text drawer--toggle-only');
        if (state === 0) drawer.addClass('drawer--icon');
        if (state === 1) drawer.addClass('drawer--text');
        if (state === 2) drawer.addClass('drawer--icon-text');
        if (state === 3) drawer.addClass('drawer--toggle-only');
    }

    async function buildDrawerMenu(state) {
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
                })).sort((a, b) => String(a.code).localeCompare(String(b.code)));
            }
        } catch {}

        const palette = [
            ['#38bdf8', '#fbbf24'],
            ['#a7f3d0', '#60a5fa'],
            ['#fda4af', '#fde68a'],
            ['#c4b5fd', '#f9a8d4']
        ];

        menus.forEach((m, idx) => {
            const item = $('<div>', { class: 'drawer-item', 'data-code': m.code });
            const icon = $('<div>', { class: 'drawer-item-icon' });
            const displayCode = String(m.code || '').replace(/^\d{2}/, '');
            const labelText = m.label || displayCode || m.code;
            const label = $('<div>', { class: 'drawer-item-label', text: labelText });

            const colors = palette[idx % palette.length];
            icon.css('background', `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`);
            icon.text((m.icon || labelText || displayCode || m.code || 'M').trim().charAt(0).toUpperCase());

            item.append(icon, label);
            item.on('click', () => {
                if (typeof window.drawerAction === 'function') {
                    window.drawerAction(displayCode || m.code);
                }
            });
            drawerMenu.append(item);
        });
        applyDrawerState(state);
    }

    window.drawerAction = function drawerAction(menuCode) {
        console.log('Drawer action triggered for menu code:', menuCode);
        if (menuCode !== 'menuSignup') {
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
        currentStateIndex = (currentStateIndex + 1) % 4;
        await buildDrawerMenu(currentStateIndex);
    });

    buildDrawerMenu(currentStateIndex);
    window.setDrawerState = async function setDrawerState(state) {
        const next = Number(state);
        if (Number.isNaN(next)) return;
        currentStateIndex = Math.max(0, Math.min(3, next));
        await buildDrawerMenu(currentStateIndex);
    };

    function renderRegister() {
        showPage('register');
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
                const form = $('#registerForm').dxForm('instance');
                if (!form.validate().isValid) return;

                const data = form.option('formData');
                try {
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

                    showPage('personalDashboard');
                } catch (err) {
                    DevExpress.ui.notify(err.message, 'error', 3000);
                }
            }
        });

        $('#btnClose').dxButton({
            text: 'Close',
            type: 'danger',
            width: 100,
            onClick() {
                showPage('personalDashboard');
            }
        });
    }

    window.showPage = showPage;
    window.renderRegister = renderRegister;
});
