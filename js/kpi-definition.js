/* global $, DevExpress, Common */
'use strict';

window.renderKpiDefinitions = async function renderKpiDefinitions() {
    if (typeof window.showPage === 'function') {
        window.showPage('kpiDefinition');
    }

    const $page = $('#kpiDefinition');
    $page.empty();

    const $gridWrap = $('<div>', { id: 'grdKpiDefinition', class: 'dx-grid kpi-definition-grid' }).appendTo($page);

    const buildStore = () => new DevExpress.data.CustomStore({
        key: '_id',
        load: async () => {
            const res = await Common.fetchWithAuth('/api/kpi/definitions');
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed to load definitions');
            return Array.isArray(json.data) ? json.data : [];
        },
        insert: async (values) => {
            const res = await Common.postWithAuth('/api/kpi/definitions', {
                body: JSON.stringify(values)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Create failed');
            return json.data;
        },
        update: async (key, values) => {
            const res = await Common.putWithAuth(`/api/kpi/definitions/${key}`, {
                body: JSON.stringify(values)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Update failed');
            return json.data;
        }
    });

    $gridWrap.dxDataGrid({
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
                dataField: 'code',
                caption: 'Code',
                validationRules: [{ type: 'required' }],
                setCellValue: (newData, value) => {
                    newData.code = String(value || '').toUpperCase();
                },
                editorOptions: {
                    inputAttr: { style: 'text-transform: uppercase;' }
                }
            },
            {
                dataField: 'name',
                caption: 'Name',
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'description',
                caption: 'Description'
            },
            {
                dataField: 'valueType',
                caption: 'Type',
                lookup: {
                    dataSource: ['number', 'text', 'boolean', 'select', 'group']
                }
            },
            {
                dataField: 'required',
                caption: 'Required',
                dataType: 'boolean'
            },
            {
                dataField: 'options',
                caption: 'Options',
                cellTemplate: (container, options) => {
                    const values = Array.isArray(options.value) ? options.value : [];
                    container.text(values.join(', '));
                },
                editCellTemplate: (cellElement, cellInfo) => {
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: Array.isArray(cellInfo.value) ? cellInfo.value : [],
                        value: cellInfo.value || [],
                        hideSelectedItems: true,
                        acceptCustomValue: true,
                        placeholder: 'พิมพ์แล้วกด Enter',
                        onCustomItemCreating: (args) => {
                            const text = String(args.text || '').trim();
                            if (!text) {
                                args.customItem = null;
                                return;
                            }
                            args.customItem = text;
                        },
                        onValueChanged(e) {
                            cellInfo.setValue(e.value);
                        }
                    });
                }
            },
            {
                dataField: 'unit',
                caption: 'Unit'
            },
            {
                dataField: 'order',
                caption: 'Order',
                dataType: 'number'
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
            DevExpress.ui.notify('KPI definition created', 'success', 2000);
        },
        onRowUpdated: () => {
            DevExpress.ui.notify('KPI definition updated', 'success', 2000);
        },
        onDataErrorOccurred: (e) => {
            DevExpress.ui.notify(e.error?.message || 'Operation failed', 'error', 3000);
        }
    });
};
