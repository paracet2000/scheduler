// js/userManagement.js
// Admin User Management UI
window.renderUserManagement = async function renderUserManagement() {
    if (typeof window.showPage === 'function') {
        window.showPage('userManagement');
    }

    let users = [];
    try {
        const res = await Common.fetchWithAuth('/api/users');
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load users');
        }
        users = Array.isArray(json.data) ? json.data : [];
    } catch (err) {
        $('#userGrid').empty().append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load users.'
            })
        );
        return;
    }

    const rolesList = ['user', 'head', 'approver', 'hr', 'finance', 'admin'];

    $('#userGrid').addClass('dx-grid user-grid').dxDataGrid({
        dataSource: users,
        keyExpr: '_id',
        showBorders: true,
        columnAutoWidth: true,
        paging: { pageSize: 10 },
        editing: {
            mode: 'row',
            allowUpdating: true,
            allowAdding: false,
            allowDeleting: false
        },
        columns: [
            { dataField: 'employeeCode', caption: 'Employee Code' },
            { dataField: 'name', caption: 'Name' },
            { dataField: 'email', caption: 'Email' },
            { dataField: 'phone', caption: 'Phone' },
            {
                dataField: 'roles',
                caption: 'Roles',
                cellTemplate: (container, options) => {
                    const roles = Array.isArray(options.value) ? options.value : [];
                    container.text(roles.join(', '));
                },
                editCellTemplate: (cellElement, cellInfo) => {
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: rolesList,
                        value: cellInfo.value || [],
                        onValueChanged(e) {
                            cellInfo.setValue(e.value);
                        }
                    });
                }
            },
            {
                dataField: 'status',
                caption: 'Status',
                lookup: {
                    dataSource: ['ACTIVE', 'INACTIVE']
                }
            },
            {
                caption: 'Password',
                width: 160,
                allowEditing: false,
                cellTemplate: (container, options) => {
                    const btn = $('<button>', {
                        class: 'dx-button dx-button-mode-contained dx-button-normal reset-pass-btn',
                        title: 'Reset Password',
                        'aria-label': 'Reset Password'
                    }).append($('<i>', { class: 'dx-icon dx-icon-key' }));

                    btn.on('click', async () => {
                        const newPassword = window.prompt('Enter new password');
                        if (!newPassword) return;

                        const res = await Common.postWithAuth(`/api/users/${options.data._id}/reset-password`, {
                            body: JSON.stringify({ password: newPassword })
                        });
                        const json = await res.json();
                        if (!res.ok) {
                            DevExpress.ui.notify(json.message || 'Reset failed', 'error', 3000);
                            return;
                        }
                        DevExpress.ui.notify('Password reset', 'success', 2000);
                    });

                    container.append(btn);
                }
            }
        ],
        onRowUpdating: async (e) => {
            const id = e.key;
            const payload = { ...e.oldData, ...e.newData };
            const res = await Common.putWithAuth(`/api/users/${id}`, {
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                e.cancel = true;
                DevExpress.ui.notify(json.message || 'Update failed', 'error', 3000);
                return;
            }
            DevExpress.ui.notify('User updated', 'success', 2000);
        }
    });
};
