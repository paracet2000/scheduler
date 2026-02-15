/* global $, DevExpress, Common */
'use strict';

window.renderConfigManagement = async function renderConfigManagement() {
    if (typeof window.showPage === 'function') {
        window.showPage('config');
    }

    const $page = $('#config');
    $page.empty();

    const $toolbar = $('<div>', { class: 'config-toolbar' }).appendTo($page);
    const $typeWrap = $('<div>', { id: 'drpType' }).appendTo($toolbar);
    const $gridWrap = $('<div>', { id: 'grdConfig', class: 'dx-grid config-grid' }).appendTo($page);

    let selectedType = null;
    let gridInstance = null;

    let types = [];
    try {
        const res = await Common.fetchWithAuth('/api/configuration/gettype');
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load types');
        }
        types = Array.isArray(json.data) ? json.data : [];
    } catch (err) {
        $page.empty().append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load types.'
            })
        );
        return;
    }

    const buildStore = () => new DevExpress.data.CustomStore({
        key: '_id',
        load: async () => {
            if (!selectedType) return [];
            const res = await Common.fetchWithAuth(`/api/configuration?typ_code=${encodeURIComponent(selectedType)}`);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load configurations');
            }
            return Array.isArray(json.data) ? json.data : [];
        },
        insert: async (values) => {
            if (!selectedType) {
                throw new Error('Please select a type first');
            }
            const payload = {
                ...values,
                typ_code: selectedType
            };
            const res = await Common.postWithAuth('/api/configuration', {
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Create failed');
            }
            return json.data;
        },
        update: async (key, values) => {
            const res = await Common.putWithAuth(`/api/configuration/${key}`, {
                body: JSON.stringify(values)
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Update failed');
            }
            return json.data;
        }
    });

    selectedType = types.length ? types[0].typ_code : null;

    $typeWrap.dxSelectBox({
        dataSource: types,
        valueExpr: 'typ_code',
        displayExpr: (item) => item ? item.typ_description : '',
        placeholder: 'Select type',
        searchEnabled: true,
        showClearButton: false,
        value: selectedType,
        onValueChanged: (e) => {
            selectedType = e.value || null;
            if (gridInstance) {
                gridInstance.option('dataSource', buildStore());
                gridInstance.refresh();
            }
        }
    });

    const renderGrid = () => {
        const createCustomTag = (args) => {
            const text = String(args?.text || '').trim();
            args.customItem = text || null;
        };

        gridInstance = $gridWrap.dxDataGrid({
            dataSource: buildStore(),
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'popup',
                allowUpdating: true,
                allowAdding: true,
                allowDeleting: false,
                useIcons: true,
                popup: {
                    title: 'Data Management',
                    showTitle: true,
                    width: 720,
                    maxHeight: '80vh'
                },
                form: {
                    colCount: 1,
                    items: [
                        {
                            dataField: 'conf_code',
                            editorOptions: {
                                inputAttr: { style: 'text-transform: uppercase;' }
                            }
                        },
                        { dataField: 'conf_description' },
                        { dataField: 'conf_value' },
                        {
                            dataField: 'options',
                            editorType: 'dxTagBox',
                            editorOptions: {
                                hideSelectedItems: true,
                                acceptCustomValue: true,
                                placeholder: 'Type and press Enter',
                                onCustomItemCreating: createCustomTag
                            }
                        }
                    ]
                }
            },
            columns: [
                {
                    dataField: 'typ_code',
                    caption: 'Type',
                    visible: false
                },
                {
                    dataField: 'conf_code',
                    caption: 'Code',
                    validationRules: [{ type: 'required' }],
                    setCellValue: (newData, value) => {
                        newData.conf_code = String(value || '').toUpperCase();
                    },
                    editorOptions: {
                        inputAttr: { style: 'text-transform: uppercase;' }
                    }
                },
                {
                    dataField: 'conf_description',
                    caption: 'Description',
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'conf_value',
                    caption: 'Value'
                },
                {
                    dataField: 'options',
                    caption: 'Options',
                    cellTemplate: (container, options) => {
                        const values = Array.isArray(options.value) ? options.value : [];
                        container.text(values.join(', '));
                    }
                }
            ],
            onInitNewRow: (e) => {
                e.data.options = [];
            },
            onRowInserted: () => {
                DevExpress.ui.notify('Configuration created', 'success', 2000);
            },
            onRowUpdated: () => {
                DevExpress.ui.notify('Configuration updated', 'success', 2000);
            },
            onDataErrorOccurred: (e) => {
                DevExpress.ui.notify(e.error?.message || 'Operation failed', 'error', 3000);
            }
        }).dxDataGrid('instance');
    };

    renderGrid();
};
