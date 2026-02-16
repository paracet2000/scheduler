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

    const loadHeads = async () => {
        const headRes = await Common.fetchWithAuth('/api/scheduler-heads');
        const headJson = await headRes.json();
        if (!headRes.ok) {
            throw new Error(headJson.message || 'Failed to load scheduler heads');
        }
        return Array.isArray(headJson.data) ? headJson.data : [];
    };

    const reloadHeads = async (grid) => {
        heads = await loadHeads();
        grid.option('dataSource', heads);
        grid.refresh();
    };

    try {
        const [wardList, loadedHeads] = await Promise.all([
            Helper.getWards(),
            loadHeads()
        ]);

        wards = Array.isArray(wardList) ? wardList : [];
        heads = loadedHeads;
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
        onRowPrepared: (e) => {
            if (e.rowType !== 'data') return;

            const st = String(e.data?.status || '').trim().toUpperCase();
            // Color rows by status via CSS classes (see styles.css)
            $(e.rowElement)
                .removeClass('row-status-open row-status-draft row-status-closed')
                .addClass(
                    st === 'OPEN'
                        ? 'row-status-open'
                        : (st === 'CLOSED' || st === 'CLOSE')
                            ? 'row-status-closed'
                            : st === 'DRAFT'
                                ? 'row-status-draft'
                                : ''
                );
        },
        editing: {
            mode: 'popup',
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
                dataField: 'monthYear',
                caption: 'Month/Year',
                allowEditing: false,
                calculateCellValue: (row) => {
                    if (row?.monthYear) return row.monthYear;
                    const d = row?.periodStart ? new Date(row.periodStart) : null;
                    if (!d || Number.isNaN(d.getTime())) return '';
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    return `${mm}-${d.getFullYear()}`;
                }
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
                                await reloadHeads(options.component);
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
                                await reloadHeads(options.component);
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
            e.cancel = true;

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
                e.component.cancelEditData();
                DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                return;
            }

            await reloadHeads(e.component);
            e.component.cancelEditData();
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
