// js/index.js
$(document).ready(function() {
    // const BASE_URL = window.BASE_URL || '';
    const BASE_URL = window.BASE_URL || 'http://localhost:3000';
    window.BASE_URL = BASE_URL;
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
    // Add a dropdown button to the top menu
    const dropdown = $('<div>', { class: 'dropdown' });
    const button = $('<button>', { class: 'user-menu-button dropdown-toggle', 'aria-label': 'User menu' })
        .append($('<span>', { class: 'user-avatar'}));
    const dropdownMenu = $('<div>', { class: 'dropdown-menu' });

    function showPage(pageId) {
        $('.page').addClass('pagehidden');
        $(`#${pageId}`).removeClass('pagehidden');
    }

    window.renderPersonalDashboard = function renderPersonalDashboard(payload = {}) {
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
        text: 'Save',
        type: 'success',
        width: 100,
        onClick: async () => {
            const form = $('#registerForm').dxForm('instance');
            if (!form.validate().isValid) return;

            const data = form.option('formData');
            console.log('form Data: ',data);
            try {
                const res = await fetch(`${BASE_URL}/api/auth/register`, {
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

    function renderLogin() {
        showPage('login');

        $('#loginForm').dxForm({
            formData: {
                email: '',
                password: ''
            },
            colCount: 1,
            showValidationSummary: true,
            items: [
                { dataField: 'email', label: { text: 'Email' }, validationRules: [{ type: 'required' }, { type: 'email' }] },
                { dataField: 'password', editorOptions: { mode: 'password' }, validationRules: [{ type: 'required' }] }
            ]
        });

        $('#btnLogin').dxButton({
            text: 'Login',
            type: 'success',
            width: 100,
            onClick: async () => {
                const form = $('#loginForm').dxForm('instance');
                
                if (!form.validate().isValid) return;

                const data = form.option('formData');

                try {
                    const res = await fetch(`${BASE_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    const json = await res.json();

                    if (!res.ok) {
                        throw new Error(json.message || 'Login failed');
                    }

                    const token = json?.data?.token;
                    const roles = json?.data?.roles;
                    const avatar = json?.data?.avatar;
                    const canUseKpiTools = !!(json?.data?.meta?.['Can-use-kpi-tools'] || json?.data?.meta?.canUseKpiTools);
                    console.log('avatar logon Data: ',avatar);
                    if (token) {
                        localStorage.setItem('auth_token', token);
                    }
                    if (roles) {
                        localStorage.setItem('auth_roles', JSON.stringify(roles));
                    }
                    localStorage.setItem('auth_kpi_tools', JSON.stringify(canUseKpiTools));
                    if (avatar) {
                        updateUserAvatar(avatar);
                    } else {
                        updateUserAvatar(null);
                    }
                    updateAuthUI(true);

                    DevExpress.ui.notify('Login success!', 'success', 3000);
                    if (typeof window.renderSchedule === 'function') {
                        window.renderSchedule();
                    } else {
                        showPage('personalDashboard');
                    }
                } catch (err) {
                    DevExpress.ui.notify(err.message, 'error', 3000);
                }
            }
        });

        $('#btnLoginClose').dxButton({
            text: 'Close',
            type: 'danger',
            width: 100,
            onClick() {
                
                showPage('personalDashboard');
            }
        });
    }

    // renderPersonalSettings moved to js/personal.js

    // renderSystemSettings moved to js/master.js

    // Add menu items
    const menuItems = [
        { id: 'menuSignup', text: 'Signup', action: () => {
            renderRegister();
            dropdownMenu.hide(); // Collapse the dropdown menu after click
        } },
        { id: 'menuSettingsPersonal', text: 'Personal Settings', action: () => {
            if (typeof window.renderPersonalSettings === 'function') {
                window.renderPersonalSettings();
            }
            dropdownMenu.hide(); // Collapse the dropdown menu after click
        } },
        { id: 'menuSettingsSystem', text: 'System Settings', action: () => {
            if (typeof window.renderSystemSettings === 'function') {
                window.renderSystemSettings();
            }
            dropdownMenu.hide(); // Collapse the dropdown menu after click
        } },
        { id: 'menuSchedule', text: 'My Schedule', action: () => {
            if (typeof window.renderSchedule === 'function') {
                window.renderSchedule();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuChangeRequest', text: 'Change Request', action: () => {
            if (typeof window.renderChangeRequest === 'function') {
                window.renderChangeRequest();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuScheduleSummary', text: 'Schedule Summary', action: () => {
            if (typeof window.renderScheduleSummary === 'function') {
                window.renderScheduleSummary();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuKpiEntry', text: 'KPI Entry', action: () => {
            if (typeof window.renderKpiEntry === 'function') {
                window.renderKpiEntry();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuKpiDashboard', text: 'KPI Dashboard', action: () => {
            if (typeof window.renderKpiDashboard === 'function') {
                window.renderKpiDashboard();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuKpiTools', text: 'KPI Tools', action: () => {
            if (typeof window.renderKpiTools === 'function') {
                window.renderKpiTools();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuCommonReport', text: 'Common Report', action: () => {
            if (typeof window.renderCommonReport === 'function') {
                window.renderCommonReport();
            }
            dropdownMenu.hide();
        } },
        { id: 'menuUserManagement', text: 'User Management', action: () => {
            if (typeof window.renderUserManagement === 'function') {
                window.renderUserManagement();
            }
            dropdownMenu.hide(); // Collapse the dropdown menu after click
        } },
        { id: 'menuTimeAttendanceSync', text: 'Time Attendance Sync', action: () => {
            window.systemSettingsTarget = 'codeMapping';
            if (typeof window.renderSystemSettings === 'function') {
                window.renderSystemSettings();
            } else {
                showPage('settingsSystem');
                $('#systemSettings').html('<div class="settings-placeholder">Time Attendance Sync is not available.</div>');
            }
            dropdownMenu.hide();
        } },
        { id: 'menuLogin', text: 'Login', action: () => {
            renderLogin();
            dropdownMenu.hide(); // Collapse the dropdown menu after click
        } },
        { id: 'menuLogout', text: 'Logout', action: () => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_roles');
            localStorage.removeItem('auth_kpi_tools');
            updateUserAvatar(null);
            updateAuthUI(false);
            showPage('personalDashboard');
            dropdownMenu.hide(); // Collapse the dropdown menu after click
        } }
    ];

    const menuButtons = {};

    menuItems.forEach(item => {
        const menuItem = $('<button>', {
            text: item.text,
            class: 'dropdown-item',
            click: item.action
        });
        if (item.id) menuButtons[item.id] = menuItem;
        dropdownMenu.append(menuItem);
    });

    // Append button and menu to dropdown
    dropdown.append(button).append(dropdownMenu);

    // Append dropdown to the top menu and apply right alignment
    $('#topMenu').css('display', 'flex').css('justify-content', 'flex-end').append(dropdown);

    // Toggle dropdown menu visibility
    button.on('click', function() {
        dropdownMenu.toggle();
    });

    function updateAuthUI(isLoggedIn) {
        const showWhenLoggedOut = ['menuSignup', 'menuLogin'];
        const showWhenLoggedIn = ['menuSettingsPersonal', 'menuLogout', 'menuSchedule', 'menuChangeRequest', 'menuScheduleSummary', 'menuKpiEntry', 'menuKpiDashboard', 'menuKpiTools', 'menuCommonReport'];

        showWhenLoggedOut.forEach(id => {
            if (menuButtons[id]) menuButtons[id].toggle(!isLoggedIn);
        });
        showWhenLoggedIn.forEach(id => {
            if (menuButtons[id]) menuButtons[id].toggle(isLoggedIn);
        });
        if (menuButtons.menuSettings) {
            menuButtons.menuSettings.toggle(false);
        }

        const roles = getStoredRoles();
        const isAdmin = roles.includes('admin');
        const isHead = roles.includes('head');
        const isHr = roles.includes('hr');
        if (menuButtons.menuSettingsSystem) {
            menuButtons.menuSettingsSystem.toggle(isLoggedIn && (isAdmin || isHead || isHr));
        }
        if (menuButtons.menuScheduleSummary) {
            menuButtons.menuScheduleSummary.toggle(isLoggedIn && isHead);
        }
        if (menuButtons.menuKpiEntry) {
            menuButtons.menuKpiEntry.toggle(isLoggedIn && isHead);
        }
        if (menuButtons.menuKpiDashboard) {
            menuButtons.menuKpiDashboard.toggle(isLoggedIn && (isAdmin || isHead || roles.includes('finance')));
        }
        if (menuButtons.menuKpiTools) {
            menuButtons.menuKpiTools.toggle(isLoggedIn && getStoredKpiTools());
        }
        if (menuButtons.menuCommonReport) {
            menuButtons.menuCommonReport.toggle(isLoggedIn && (isAdmin || isHead || roles.includes('finance')));
        }
        if (menuButtons.menuUserManagement) {
            menuButtons.menuUserManagement.toggle(isLoggedIn && isAdmin);
        }
        if (menuButtons.menuTimeAttendanceSync) {
            menuButtons.menuTimeAttendanceSync.toggle(isLoggedIn && isHr);
        }
    }

    function getStoredRoles() {
        const storedRoles = localStorage.getItem('auth_roles');
        if (!storedRoles) return [];
        try {
            const roles = JSON.parse(storedRoles);
            return Array.isArray(roles) ? roles : [];
        } catch {
            return [];
        }
    }

    function getStoredKpiTools() {
        const stored = localStorage.getItem('auth_kpi_tools');
        if (!stored) return false;
        try {
            return !!JSON.parse(stored);
        } catch {
            return false;
        }
    }

    function resolveAvatarUrl(avatarUrl) {
        if (!avatarUrl) return '';
        if (
            avatarUrl.startsWith('http://') ||
            avatarUrl.startsWith('https://') ||
            avatarUrl.startsWith('data:') ||
            avatarUrl.startsWith('blob:')
        ) {
            return avatarUrl;
        }
        const apiBase = window.BASE_URL || '';
        return `${apiBase}${avatarUrl}`;
    }

    function setFavicon(avatarUrl) {
        const link = document.getElementById('appFavicon') || (() => {
            const l = document.createElement('link');
            l.id = 'appFavicon';
            l.rel = 'icon';
            document.head.appendChild(l);
            return l;
        })();
        const fallback = 'images/defaultprofile.jpg';
        link.href = resolveAvatarUrl(avatarUrl) || fallback;
    }

    function updateUserAvatar(avatarUrl) {
        const avatar = button.find('.user-avatar');
        console.log('avatarUrl Data: ',avatarUrl);
        if (avatarUrl) {
            avatar
                .css('background-image', `url(${resolveAvatarUrl(avatarUrl)})`)
                .addClass('has-image user-avatar--active')
                .text('');
            setFavicon(avatarUrl);
            return;
        }

        
        if (!avatarUrl) {
        avatar
            .css('background-image', '')
            .removeClass('has-image user-avatar--active');
            setFavicon('');
            return;
        }

    }

    // Initial auth state from localStorage
    const initialToken = localStorage.getItem('auth_token');
    updateAuthUI(!!initialToken);

    if (initialToken) {
        const apiBase = window.BASE_URL || '';
        fetch(`${apiBase}/api/users/me`, {
            headers: { Authorization: `Bearer ${initialToken}` }
        })
            .then((res) => res.json())
            .then((json) => {
                if (json?.data?.avatar) {
                    updateUserAvatar(json.data.avatar);
                }
                const canUseKpiTools = !!(json?.data?.meta?.['Can-use-kpi-tools'] || json?.data?.meta?.canUseKpiTools);
                localStorage.setItem('auth_kpi_tools', JSON.stringify(canUseKpiTools));
                updateAuthUI(true);
            })
            .catch(() => {});
        if (typeof window.renderSchedule === 'function') {
            window.renderSchedule();
        }
    }

    // expose helpers for personal.js and master.js
    window.showPage = showPage;
    window.getStoredRoles = getStoredRoles;
    window.getStoredKpiTools = getStoredKpiTools;
    window.updateUserAvatar = updateUserAvatar;
    window.resolveAvatarUrl = resolveAvatarUrl;

});
