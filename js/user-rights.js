/* global $, DevExpress, Common */
'use strict';

window.renderUserRights = async function renderUserRights() {
    if (typeof window.showPage === 'function') {
        window.showPage('userRights');
    }

    const container = $('#userRights');
    container.empty();

    const header = $('<div>', { class: 'rights-header' });
    const userSelectEl = $('<div>', { id: 'rightsUserSelect' });
    const saveBtnEl = $('<div>', { id: 'rightsSaveBtn' });
    const gridEl = $('<div>', { id: 'rightsGrid', class: 'dx-grid rights-grid' });
    header.append(userSelectEl, saveBtnEl);
    container.append(header, gridEl);

    let users = [];
    let menus = [];
    let selectedUserId = null;
    let gridInstance = null;

    const loadUsers = async () => {
        const res = await Common.fetchWithAuth('/api/users');
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load users');
        return Array.isArray(json.data) ? json.data : [];
    };

    const loadMenus = async () => {
        const res = await Common.fetchWithAuth('/api/menu-authorize/menus');
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load menus');
        return Array.isArray(json.data) ? json.data : [];
    };

    const loadPermissions = async (userId) => {
        const res = await Common.fetchWithAuth(`/api/menu-authorize/user/${userId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load permissions');
        return Array.isArray(json.data) ? json.data : [];
    };

    const buildGridData = (menuList, perms) => {
        const map = new Map(perms.map(p => [String(p.mnu_code), p]));
        return menuList.map(m => {
            const p = map.get(String(m.mnu_code)) || {};
            return {
                mnu_code: m.mnu_code,
                mnu_description: m.mnu_description,
                acc_read: Number(p.acc_read) === 1,
                acc_write: Number(p.acc_write) === 1,
                acc_export: Number(p.acc_export) === 1
            };
        });
    };

    const setBoolField = (newData, value, field) => {
        newData[field] = !!value;
    };

    const renderGrid = async () => {
        if (!selectedUserId) return;
        const perms = await loadPermissions(selectedUserId);
        const data = buildGridData(menus, perms);

        gridInstance = gridEl.dxDataGrid({
            dataSource: data,
            keyExpr: 'mnu_code',
            showBorders: true,
            columnAutoWidth: true,
            editing: {
                mode: 'row',
                allowUpdating: true,
                allowAdding: true,
                allowDeleting: false,
                useIcons: true
            },
            toolbar: {
                items: [
                    { location: 'after', name: 'addRowButton' }
                ]
            },
            columns: [
                {
                    dataField: 'mnu_code',
                    caption: 'Code',
                    width: 140,
                    lookup: {
                        dataSource: menus,
                        valueExpr: 'mnu_code',
                        displayExpr: (item) => item ? `${item.mnu_code} - ${item.mnu_description}` : ''
                    },
                    validationRules: [{ type: 'required' }]
                },
                { dataField: 'mnu_description', caption: 'Menu', allowEditing: false },
                {
                    dataField: 'acc_read',
                    caption: 'Read',
                    dataType: 'boolean',
                    setCellValue: (newData, value) => setBoolField(newData, value, 'acc_read')
                },
                {
                    dataField: 'acc_write',
                    caption: 'Write',
                    dataType: 'boolean',
                    setCellValue: (newData, value) => setBoolField(newData, value, 'acc_write')
                },
                {
                    dataField: 'acc_export',
                    caption: 'Export',
                    dataType: 'boolean',
                    setCellValue: (newData, value) => setBoolField(newData, value, 'acc_export')
                }
            ],
            onRowInserting: (e) => {
                const menu = menus.find(m => String(m.mnu_code) === String(e.data.mnu_code));
                if (menu) {
                    e.data.mnu_description = menu.mnu_description;
                }
            },
            onRowUpdating: (e) => {
                if (e.newData && e.newData.mnu_code) {
                    const menu = menus.find(m => String(m.mnu_code) === String(e.newData.mnu_code));
                    if (menu) {
                        e.newData.mnu_description = menu.mnu_description;
                    }
                }
            },
            onRowInserted: async () => {
                await savePermissions();
            },
            onRowUpdated: async () => {
                await savePermissions();
            },
            // delete disabled
        }).dxDataGrid('instance');
    };

    const savePermissions = async () => {
        if (!selectedUserId || !gridInstance) return;
        const data = gridInstance.option('dataSource') || [];
        const payload = data.map(row => ({
            mnu_code: row.mnu_code,
            acc_read: row.acc_read ? 1 : 0,
            acc_write: row.acc_write ? 1 : 0,
            acc_export: row.acc_export ? 1 : 0
        }));
        const res = await Common.fetchWithAuth(`/api/menu-authorize/user/${selectedUserId}`, {
            method: 'POST',
            body: JSON.stringify({ permissions: payload })
        });
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Save failed', 'error', 3000);
            return;
        }
        DevExpress.ui.notify('Permissions saved', 'success', 1500);
    };

    try {
        users = await loadUsers();
        menus = await loadMenus();
    } catch (err) {
        container.append(
            $('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load user rights.' })
        );
        return;
    }

    userSelectEl.dxSelectBox({
        items: users,
        displayExpr: (u) => u ? `${u.employeeCode || ''} ${u.name || u.email || ''}`.trim() : '',
        valueExpr: '_id',
        width: 320,
        placeholder: 'Select user',
        value: users[0]?._id || null,
        onInitialized(e) {
            selectedUserId = e.component.option('value');
            renderGrid();
        },
        onValueChanged(e) {
            selectedUserId = e.value;
            renderGrid();
        }
    });

    saveBtnEl.remove();
};
