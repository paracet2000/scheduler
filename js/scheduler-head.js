/* global $, DevExpress, Common, Helper */
'use strict';

window.renderSchedulerHead = async function renderSchedulerHead() {
    if (typeof window.showPage === 'function') {
        window.showPage('schedulerHead');
    }

    const container = $('#schedulerHead');
    container.empty();

    const gridEl = $('<div>', { id: 'schedulerHeadGrid', class: 'dx-grid scheduler-head-grid' });
    container.append(gridEl);

    let wards = [];
    let heads = [];

    try {
        const [wardList, headRes] = await Promise.all([
            Helper.getWards(),
            Common.fetchWithAuth('/api/scheduler-heads')
        ]);

        const headJson = await headRes.json();
        if (!headRes.ok) {
            throw new Error(headJson.message || 'Failed to load scheduler heads');
        }

        wards = Array.isArray(wardList) ? wardList : [];
        heads = Array.isArray(headJson.data) ? headJson.data : [];
    } catch (err) {
        container.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load scheduler heads.'
            })
        );
        return;
    }

    const wardLookup = wards.map(w => ({
        conf_code: w.conf_code,
        conf_description: w.conf_description || '',
        conf_value: w.conf_value || ''
    }));

    gridEl.dxDataGrid({
        dataSource: heads,
        keyExpr: '_id',
        showBorders: true,
        columnAutoWidth: true,
        paging: { pageSize: 10 },
        editing: {
            mode: 'row',
            allowAdding: true,
            allowUpdating: false,
            allowDeleting: false,
            useIcons: true
        },
        columns: [
            {
                dataField: 'wardCode',
                caption: 'Ward',
                lookup: {
                    dataSource: wardLookup,
                    valueExpr: 'conf_code',
                    displayExpr: (item) => item
                        ? `${item.conf_description || ''}${item.conf_code ? ` (${item.conf_code})` : ''}`.trim()
                        : ''
                },
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'periodStart',
                caption: 'Start',
                dataType: 'date',
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'periodEnd',
                caption: 'End',
                dataType: 'date',
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'status',
                caption: 'Status',
                allowEditing: false
            },
            {
                dataField: 'note',
                caption: 'Note'
            },
            {
                caption: 'Action',
                width: 160,
                allowEditing: false,
                cellTemplate: (containerEl, options) => {
                    const status = options.data?.status;
                    const id = options.data?._id;

                    if (status === 'DRAFT') {
                        const btn = $('<button>', { class: 'dx-button dx-button-mode-contained dx-button-normal' })
                            .text('Open')
                            .on('click', async () => {
                                const res = await Common.fetchWithAuth(`/api/scheduler-heads/${id}/open`, {
                                    method: 'PATCH'
                                });
                                const json = await res.json();
                                if (!res.ok) {
                                    DevExpress.ui.notify(json.message || 'Open failed', 'error', 3000);
                                    return;
                                }
                                options.data.status = json.data?.status || 'OPEN';
                                options.component.refresh();
                                DevExpress.ui.notify('Opened', 'success', 2000);
                            });
                        containerEl.append(btn);
                    } else if (status === 'OPEN') {
                        const btn = $('<button>', { class: 'dx-button dx-button-mode-contained dx-button-danger' })
                            .text('Close')
                            .on('click', async () => {
                                const res = await Common.fetchWithAuth(`/api/scheduler-heads/${id}/close`, {
                                    method: 'PATCH'
                                });
                                const json = await res.json();
                                if (!res.ok) {
                                    DevExpress.ui.notify(json.message || 'Close failed', 'error', 3000);
                                    return;
                                }
                                options.data.status = json.data?.status || 'CLOSED';
                                options.component.refresh();
                                DevExpress.ui.notify('Closed', 'success', 2000);
                            });
                        containerEl.append(btn);
                    } else {
                        containerEl.text('-');
                    }
                }
            }
        ],
        onRowInserting: async (e) => {
            const payload = {
                wardCode: e.data.wardCode,
                periodStart: e.data.periodStart,
                periodEnd: e.data.periodEnd,
                note: e.data.note
            };

            const res = await Common.fetchWithAuth('/api/scheduler-heads', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                e.cancel = true;
                DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                return;
            }
            e.data._id = json.data?._id || e.data._id;
            e.data.status = json.data?.status || 'DRAFT';
            DevExpress.ui.notify('Created', 'success', 2000);
        },
        onRowValidating: (e) => {
            if (e.newData?.periodStart && e.newData?.periodEnd) {
                if (new Date(e.newData.periodStart) > new Date(e.newData.periodEnd)) {
                    e.isValid = false;
                    e.errorText = 'Start date must be earlier than end date.';
                }
            }
        }
    });
};
