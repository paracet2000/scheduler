/* global $, DevExpress, Common */
'use strict';

window.renderWardMember = async function renderWardMember() {
    if (typeof window.showPage === 'function') {
        window.showPage('wardMember');
    }

    const $page = $('#wardMember');
    $page.empty();

    const $toolbar = $('<div>', { class: 'wardmember-toolbar' }).appendTo($page);
    const $wardWrap = $('<div>', { id: 'drpWard' }).appendTo($toolbar);
    const $gridWrap = $('<div>', { id: 'grdWardMember', class: 'dx-grid ward-member-grid' }).appendTo($page);

    let selectedWard = null;
    let gridInstance = null;

    let wards = [];
    let users = [];
    let positions = [];

    try {
        const [wardRes, userRes, posRes] = await Promise.all([
            Common.fetchWithAuth('/api/configuration?typ_code=DEPT'),
            Common.fetchWithAuth('/api/users'),
            Common.fetchWithAuth('/api/configuration?typ_code=POST')
        ]);

        const wardJson = await wardRes.json();
        const userJson = await userRes.json();
        const posJson = await posRes.json();

        if (!wardRes.ok) throw new Error(wardJson.message || 'Failed to load wards');
        if (!userRes.ok) throw new Error(userJson.message || 'Failed to load users');
        if (!posRes.ok) throw new Error(posJson.message || 'Failed to load positions');

        wards = Array.isArray(wardJson.data) ? wardJson.data : [];
        users = Array.isArray(userJson.data) ? userJson.data : [];
        positions = Array.isArray(posJson.data) ? posJson.data : [];
    } catch (err) {
        $page.empty().append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load ward members.'
            })
        );
        return;
    }

    selectedWard = wards.length ? wards[0]._id : null;

    const buildStore = () => new DevExpress.data.CustomStore({
        key: '_id',
        load: async () => {
            if (!selectedWard) return [];
            const res = await Common.fetchWithAuth(`/api/ward-members?wardId=${encodeURIComponent(selectedWard)}`);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load ward members');
            }
            const items = Array.isArray(json.data) ? json.data : [];
            return items.map((item) => ({
                ...item,
                userId: item.userId?._id || item.userId
            }));
        },
        insert: async (values) => {
            if (!selectedWard) {
                throw new Error('Please select a ward first');
            }
            const payload = {
                ...values,
                wardId: selectedWard
            };
            const res = await Common.postWithAuth('/api/ward-members', {
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Create failed');
            }
            return {
                ...json.data,
                userId: json.data?.userId?._id || json.data?.userId
            };
        },
        update: async (key, values) => {
            const res = await Common.putWithAuth(`/api/ward-members/${key}`, {
                body: JSON.stringify(values)
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Update failed');
            }
            return {
                ...json.data,
                userId: json.data?.userId?._id || json.data?.userId
            };
        }
    });

    $wardWrap.dxSelectBox({
        dataSource: wards,
        valueExpr: '_id',
        displayExpr: (item) => item ? `${item.conf_description} (${item.conf_code})` : '',
        placeholder: 'Select ward',
        searchEnabled: true,
        showClearButton: false,
        value: selectedWard,
        onValueChanged: (e) => {
            selectedWard = e.value || null;
            if (gridInstance) {
                gridInstance.option('dataSource', buildStore());
                gridInstance.refresh();
            }
        }
    });

    gridInstance = $gridWrap.dxDataGrid({
        dataSource: buildStore(),
        keyExpr: '_id',
        showBorders: true,
        columnAutoWidth: true,
        paging: { pageSize: 10 },
        editing: {
            mode: 'row',
            allowUpdating: true,
            allowAdding: true,
            allowDeleting: false,
            useIcons: true
        },
        columns: [
            {
                dataField: 'userId',
                caption: 'User',
                validationRules: [{ type: 'required' }],
                lookup: {
                    dataSource: users,
                    valueExpr: '_id',
                    displayExpr: 'name'
                }
            },
            {
                dataField: 'position',
                caption: 'Position',
                validationRules: [{ type: 'required' }],
                lookup: {
                    dataSource: positions,
                    valueExpr: 'conf_code',
                    displayExpr: (item) => item ? item.conf_description : ''
                }
            },
            {
                dataField: 'roles',
                caption: 'Roles',
                cellTemplate: (container, options) => {
                    const roles = Array.isArray(options.value) ? options.value : [];
                    container.text(roles.join(', '));
                },
                editCellTemplate: (cellElement, cellInfo) => {
                    const roleItems = ['USER', 'HEAD', 'APPROVER', 'HR', 'FINANCE'];
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: roleItems,
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
            }
        ],
        onRowInserted: () => {
            DevExpress.ui.notify('Ward member created', 'success', 2000);
        },
        onRowUpdated: () => {
            DevExpress.ui.notify('Ward member updated', 'success', 2000);
        },
        onDataErrorOccurred: (e) => {
            DevExpress.ui.notify(e.error?.message || 'Operation failed', 'error', 3000);
        }
    }).dxDataGrid('instance');
};
