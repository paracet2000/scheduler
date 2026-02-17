/* global $, DevExpress, Common */
'use strict';

window.renderKpiDefinitions = async function renderKpiDefinitions() {
    const GRID_MAX_ROWS = 25;
    const GRID_ROW_HEIGHT = 25;
    const GRID_HEIGHT = GRID_MAX_ROWS * GRID_ROW_HEIGHT + 10;

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

    const createCustomTag = (args) => {
        const text = String(args?.text || '').trim();
        args.customItem = text || null;
    };

    const syncFilterRowVisibility = (comp) => {
        if (!comp || typeof comp.getDataSource !== 'function') return;
        const ds = comp.getDataSource();
        let total = 0;
        if (ds) {
            const tc = typeof ds.totalCount === 'function' ? ds.totalCount() : null;
            if (typeof tc === 'number' && !Number.isNaN(tc)) {
                total = tc;
            } else if (typeof ds.items === 'function') {
                total = (ds.items() || []).length;
            } else if (Array.isArray(ds._items)) {
                total = ds._items.length;
            }
        }
        const filterRow = comp.option('filterRow') || {};
        const shouldShow = total > GRID_MAX_ROWS;
        if (Boolean(filterRow.visible) === shouldShow) return;
        comp.option('filterRow', { ...filterRow, visible: shouldShow });
    };

    $gridWrap.dxDataGrid({
        dataSource: buildStore(),
        keyExpr: '_id',
        showBorders: true,
        rowHeight: GRID_ROW_HEIGHT,
        height: GRID_HEIGHT,
        columnAutoWidth: true,
        scrolling: {
            mode: 'virtual',
            rowRenderingMode: 'virtual'
        },
        paging: { pageSize: GRID_MAX_ROWS },
        filterRow: { visible: false },
        editing: {
            mode: 'popup',
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
                formItem: {
                    editorType: 'dxTagBox',
                    editorOptions: {
                        hideSelectedItems: true,
                        acceptCustomValue: true,
                        onCustomItemCreating: createCustomTag
                    }
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
        },
        onContentReady: (e) => {
            syncFilterRowVisibility(e.component);
        }
    });
};
