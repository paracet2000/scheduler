/* global $, DevExpress, Common */
'use strict';

window.renderKpiDashboardSetting = async function renderKpiDashboardSetting() {
    if (typeof window.showPage === 'function') {
        window.showPage('kpiDashboardSetting');
    }
    if (typeof window.setDrawerState === 'function') {
        window.setDrawerState(0);
    }

    const $page = $('#kpiDashboardSetting');
    $page.empty();

    const $gridWrap = $('<div>', { id: 'grdKpiWidget', class: 'dx-grid kpi-widget-grid' }).appendTo($page);
    const $thresholdWrap = $('<div>', { id: 'grdKpiWidgetThreshold', class: 'dx-grid kpi-widget-threshold-grid' }).appendTo($page);

    let selectedCode = null;
    let definitionItems = [];

    try {
        const defRes = await Common.fetchWithAuth('/api/kpi/definitions?status=ACTIVE');
        const defJson = await defRes.json();
        if (!defRes.ok) throw new Error(defJson.message || 'Failed to load KPI definitions');
        definitionItems = Array.isArray(defJson.data) ? defJson.data : [];
    } catch (err) {
        DevExpress.ui.notify(err.message || 'Unable to load KPI definitions', 'error', 3000);
        definitionItems = [];
    }

    let thresholdGrid = null;

    const buildWidgetStore = () => new DevExpress.data.CustomStore({
        key: '_id',
        load: async () => {
            const res = await Common.fetchWithAuth('/api/kpi/dashboard/widgets');
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed to load widgets');
            return Array.isArray(json.data) ? json.data : [];
        },
        insert: async (values) => {
            const res = await Common.postWithAuth('/api/kpi/dashboard/widgets', {
                body: JSON.stringify(values)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Create failed');
            return json.data;
        },
        update: async (key, values) => {
            const res = await Common.putWithAuth(`/api/kpi/dashboard/widgets/${key}`, {
                body: JSON.stringify(values)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Update failed');
            return json.data;
        }
    });

    const widgetGrid = $gridWrap.dxDataGrid({
        dataSource: buildWidgetStore(),
        keyExpr: '_id',
        showBorders: true,
        columnAutoWidth: true,
        paging: { pageSize: 10 },
        selection: { mode: 'single' },
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
                editorOptions: { inputAttr: { style: 'text-transform: uppercase;' } }
            },
            { dataField: 'title', caption: 'Title', validationRules: [{ type: 'required' }] },
            { dataField: 'description', caption: 'Description' },
            {
                dataField: 'calc',
                caption: 'Calc',
                lookup: { dataSource: ['sum', 'count', 'avg', 'ratio'] }
            },
            {
                dataField: 'sourceCodes',
                caption: 'Source Codes',
                cellTemplate: (c, o) => c.text((o.value || []).join(', ')),
                editCellTemplate: (cellElement, cellInfo) => {
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: definitionItems,
                        valueExpr: 'code',
                        displayExpr: (item) => item ? `${item.code} - ${item.name}` : '',
                        value: cellInfo.value || [],
                        hideSelectedItems: true,
                        acceptCustomValue: true,
                        placeholder: 'Select KPI or type number',
                        onCustomItemCreating: (args) => {
                            const text = String(args.text || '').trim();
                            if (!text) { args.customItem = null; return; }
                            args.customItem = text;
                        },
                        onValueChanged(e) {
                            const next = (e.value || []).map(v => String(v).toUpperCase());
                            cellInfo.setValue(next);
                        }
                    });
                }
            },
            {
                dataField: 'numeratorCodes',
                caption: 'Numerator',
                cellTemplate: (c, o) => c.text((o.value || []).join(', ')),
                editCellTemplate: (cellElement, cellInfo) => {
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: definitionItems,
                        valueExpr: 'code',
                        displayExpr: (item) => item ? `${item.code} - ${item.name}` : '',
                        value: cellInfo.value || [],
                        hideSelectedItems: true,
                        acceptCustomValue: true,
                        placeholder: 'Select KPI or type number',
                        onCustomItemCreating: (args) => {
                            const text = String(args.text || '').trim();
                            if (!text) { args.customItem = null; return; }
                            args.customItem = text;
                        },
                        onValueChanged(e) {
                            const next = (e.value || []).map(v => String(v).toUpperCase());
                            cellInfo.setValue(next);
                        }
                    });
                }
            },
            {
                dataField: 'numeratorMode',
                caption: 'Numerator Mode',
                lookup: { dataSource: ['sum', 'count', 'absolute'] }
            },
            {
                dataField: 'numeratorValue',
                caption: 'Numerator Value',
                dataType: 'number'
            },
            {
                dataField: 'denominatorCodes',
                caption: 'Denominator',
                cellTemplate: (c, o) => c.text((o.value || []).join(', ')),
                editCellTemplate: (cellElement, cellInfo) => {
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: definitionItems,
                        valueExpr: 'code',
                        displayExpr: (item) => item ? `${item.code} - ${item.name}` : '',
                        value: cellInfo.value || [],
                        hideSelectedItems: true,
                        acceptCustomValue: true,
                        placeholder: 'Select KPI or type number',
                        onCustomItemCreating: (args) => {
                            const text = String(args.text || '').trim();
                            if (!text) { args.customItem = null; return; }
                            args.customItem = text;
                        },
                        onValueChanged(e) {
                            const next = (e.value || []).map(v => String(v).toUpperCase());
                            cellInfo.setValue(next);
                        }
                    });
                }
            },
            {
                dataField: 'denominatorMode',
                caption: 'Denominator Mode',
                lookup: { dataSource: ['sum', 'count', 'absolute'] }
            },
            {
                dataField: 'denominatorValue',
                caption: 'Denominator Value',
                dataType: 'number'
            },
            { dataField: 'unit', caption: 'Unit' },
            { dataField: 'curveWidth', caption: 'Curve Width', dataType: 'number' },
            { dataField: 'gradient', caption: 'Gradient', dataType: 'boolean' },
            {
                dataField: 'roles',
                caption: 'Roles',
                cellTemplate: (c, o) => c.text((o.value || []).join(', ')),
                editCellTemplate: (cellElement, cellInfo) => {
                    const roles = ['admin', 'head', 'finance', 'hr'];
                    $('<div>').appendTo(cellElement).dxTagBox({
                        items: roles,
                        value: cellInfo.value || [],
                        onValueChanged(e) {
                            cellInfo.setValue(e.value);
                        }
                    });
                }
            },
            { dataField: 'order', caption: 'Order', dataType: 'number' },
            {
                dataField: 'status',
                caption: 'Status',
                lookup: { dataSource: ['ACTIVE', 'INACTIVE'] }
            }
        ],
        onSelectionChanged: (e) => {
            const row = e.selectedRowsData?.[0];
            selectedCode = row?.code || null;
            if (thresholdGrid) {
                thresholdGrid.option('dataSource', buildThresholdStore());
                thresholdGrid.refresh();
            }
        },
        onContentReady: (e) => {
            const data = e.component.getDataSource()?.items?.() || [];
            const selected = e.component.getSelectedRowKeys();
            if (!selected.length && data.length) {
                e.component.selectRowsByIndexes([0]);
            }
        },
        onDataErrorOccurred: (e) => {
            DevExpress.ui.notify(e.error?.message || 'Operation failed', 'error', 3000);
        }
    }).dxDataGrid('instance');

    const buildThresholdStore = () => new DevExpress.data.CustomStore({
        key: 'widgetCode',
        load: async () => {
            if (!selectedCode) return [];
            const res = await Common.fetchWithAuth('/api/kpi/dashboard/thresholds');
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed to load thresholds');
            const items = Array.isArray(json.data) ? json.data : [];
            return items.filter(i => String(i.widgetCode || '').toUpperCase() === String(selectedCode || '').toUpperCase());
        },
        insert: async (values) => {
            if (!selectedCode) throw new Error('Please select a widget first');
            const payload = { ...values, widgetCode: selectedCode };
            const res = await Common.postWithAuth('/api/kpi/dashboard/thresholds', {
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Save failed');
            return json.data;
        },
        update: async (key, values) => {
            const current = thresholdGrid?.getDataSource?.()?.items?.() || [];
            const existing = current.find(r => String(r.widgetCode) === String(selectedCode || key)) || {};
            const payload = { ...existing, ...values, widgetCode: selectedCode || key };
            const res = await Common.postWithAuth('/api/kpi/dashboard/thresholds', {
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Save failed');
            return json.data;
        }
    });

    thresholdGrid = $thresholdWrap.dxDataGrid({
        dataSource: buildThresholdStore(),
        keyExpr: 'widgetCode',
        showBorders: true,
        columnAutoWidth: true,
        paging: { pageSize: 5 },
        editing: {
            mode: 'row',
            allowUpdating: true,
            allowAdding: true,
            allowDeleting: false,
            useIcons: true
        },
        columns: [
            { dataField: 'widgetCode', caption: 'Widget Code', allowEditing: false },
            { dataField: 'greenMin', caption: 'Green Min', dataType: 'number' },
            { dataField: 'greenMax', caption: 'Green Max', dataType: 'number' },
            { dataField: 'amberMin', caption: 'Amber Min', dataType: 'number' },
            { dataField: 'amberMax', caption: 'Amber Max', dataType: 'number' },
            { dataField: 'redMin', caption: 'Red Min', dataType: 'number' },
            { dataField: 'redMax', caption: 'Red Max', dataType: 'number' },
            {
                dataField: 'status',
                caption: 'Status',
                lookup: { dataSource: ['ACTIVE', 'INACTIVE'] }
            }
        ],
        onRowInserted: () => {
            DevExpress.ui.notify('Threshold saved', 'success', 2000);
        },
        onRowUpdated: () => {
            DevExpress.ui.notify('Threshold updated', 'success', 2000);
        },
        onDataErrorOccurred: (e) => {
            DevExpress.ui.notify(e.error?.message || 'Operation failed', 'error', 3000);
        }
    }).dxDataGrid('instance');
};
