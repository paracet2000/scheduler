// js/kpi-tools.js
window.renderKpiTools = function renderKpiTools() {
    if (typeof window.showPage === 'function') {
        window.showPage('kpiTools');
    }

    const canUse = typeof window.getStoredKpiTools === 'function' ? window.getStoredKpiTools() : false;
    const container = $('#kpiTools');
    container.empty();

    if (!canUse) {
        container.append($('<div>', { class: 'settings-placeholder', text: 'KPI Tools is not enabled for this user.' }));
        // return;
    }

    const wrapper = $('<div>', { class: 'kpi-tools-wrapper' });
    const builder = $('<div>', { class: 'kpi-tools-card' });
    const viewer = $('<div>', { class: 'kpi-tools-card kpi-tools-viewer' });

    const exportGrid = (component, format) => {
        if (!component) return;
        if (format === 'xlsx') {
            if (!window.ExcelJS || !window.saveAs) {
                DevExpress.ui.notify('Export dependencies missing (ExcelJS/FileSaver).', 'error', 3000);
                return;
            }
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Ranges');
            DevExpress.excelExporter.exportDataGrid({
                component,
                worksheet,
                autoFilterEnabled: true
            }).then(() => workbook.xlsx.writeBuffer())
              .then((buffer) => {
                  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'kpi-ranges.xlsx');
              });
            return;
        }
        if (format === 'pdf') {
            if (!window.jspdf) {
                DevExpress.ui.notify('Export dependencies missing (jsPDF).', 'error', 3000);
                return;
            }
            const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            DevExpress.pdfExporter.exportDataGrid({
                jsPDFDocument: doc,
                component
            }).then(() => {
                doc.save('kpi-ranges.pdf');
            });
        }
    };

    builder.append($('<div>', { class: 'kpi-tools-title', text: 'KPI Tools - JSON Builder' }));
    viewer.append($('<div>', { class: 'kpi-tools-title', text: 'KPI Tools - JSON Viewer' }));

    const formEl = $('<div id="kpiToolsForm"></div>');
    builder.append(formEl);

    const rangesEl = $('<div id="kpiToolsRanges" class="dx-grid kpi-tools-range-grid"></div>');
    builder.append($('<div>', { class: 'kpi-tools-subtitle', text: 'Ranges' }));
    builder.append(rangesEl);

    const builderActions = $('<div class="kpi-tools-actions"></div>');
    const addJsonBtn = $('<div id="kpiToolsAddJson"></div>');
    const downloadBtn = $('<div id="kpiToolsDownload"></div>');
    builderActions.append(addJsonBtn, downloadBtn);
    builder.append(builderActions);

    const viewerRow = $('<div class="kpi-tools-viewer-row"></div>');
    const fileInput = $('<input type="file" accept="application/json" />');
    const textArea = $('<div id="kpiToolsJsonEditor" class="kpi-tools-json"></div>');
    const renderBtn = $('<div id="kpiToolsRender"></div>');
    viewerRow.append(fileInput, renderBtn);
    viewer.append(viewerRow, textArea);

    const gaugeWrap = $('<div class="kpi-tools-gauge"></div>');

    wrapper.append(builder, viewer);
    container.append(wrapper, gaugeWrap);

    const formData = {
        title: 'Sample KPI',
        name: 'Sample',
        value: 75,
        min: 0,
        max: 100,
        unit: '',
        curvewidth: 24
    };

    $('#kpiToolsForm').dxForm({
        formData,
        colCount: 3,
        items: [
            { dataField: 'title', label: { text: 'Title' }, editorType: 'dxTextBox' },
            { dataField: 'name', label: { text: 'Name' }, editorType: 'dxTextBox' },
            { dataField: 'value', label: { text: 'Value' }, editorType: 'dxNumberBox' },
            { dataField: 'unit', label: { text: 'Unit' }, editorType: 'dxTextBox' },
            { dataField: 'min', label: { text: 'Min' }, editorType: 'dxNumberBox' },
            { dataField: 'max', label: { text: 'Max' }, editorType: 'dxNumberBox' },
            { dataField: 'curvewidth', label: { text: 'Curve Width' }, editorType: 'dxNumberBox' }
        ]
    });

    const rangeData = [
        { start: 0, end: 50, startcolor: '#ef4444', endcolor: '#f0f0f0', label: 'Low' },
        { start: 50, end: 80, startcolor: '#f59e0b', endcolor: '#f0f0f0', label: 'Medium' },
        { start: 80, end: 100, startcolor: '#22c55e', endcolor: '#f0f0f0', label: 'High' }
    ];

    const rangeGrid = $('#kpiToolsRanges').dxDataGrid({
        dataSource: rangeData,
        keyExpr: 'label',
        showBorders: true,
        columnAutoWidth: true,
        height: 9 * 25 + 10,
        scrolling: { mode: 'virtual' },
        editing: {
            mode: 'row',
            allowAdding: true,
            allowUpdating: true,
            allowDeleting: true,
            useIcons: true
        },
        toolbar: {
            items: [
                { name: 'addRowButton', location: 'after' },
                {
                    location: 'after',
                    widget: 'dxButton',
                    options: {
                        icon: 'add',
                        text: 'JSON',
                        type: 'default',
                        onClick: addConfigToJson
                    }
                },
                {
                    location: 'after',
                    widget: 'dxButton',
                    options: {
                        icon: 'download',
                        text: 'JSON',
                        type: 'success',
                        onClick: downloadJson
                    }
                }
            ]
        },
        columns: [
            { dataField: 'start', caption: 'Start', dataType: 'number' },
            { dataField: 'end', caption: 'End', dataType: 'number' },
            {
                dataField: 'startcolor',
                caption: 'Start Color',
                editCellTemplate: (cell, info) => {
                    $('<div>').dxColorBox({
                        value: info.value,
                        onValueChanged: (e) => { info.setValue(e.value); }
                    }).appendTo(cell);
                }
            },
            {
                dataField: 'endcolor',
                caption: 'End Color',
                editCellTemplate: (cell, info) => {
                    $('<div>').dxColorBox({
                        value: info.value,
                        onValueChanged: (e) => { info.setValue(e.value); }
                    }).appendTo(cell);
                }
            },
            { dataField: 'label', caption: 'Label' }
        ]
    }).dxDataGrid('instance');

    const buildConfig = () => {
        const data = $('#kpiToolsForm').dxForm('instance').option('formData');
        const ranges = rangeGrid.option('dataSource') || [];
        return {
            title: data.title || '',
            name: data.name || '',
            value: Number(data.value) || 0,
            min: Number(data.min) || 0,
            max: Number(data.max) || 100,
            unit: data.unit || '',
            curvewidth: Number(data.curvewidth) || 24,
            ranges: ranges.map(r => ({
                start: Number(r.start) || 0,
                end: Number(r.end) || 0,
                startcolor: r.startcolor || r.color || '#999999',
                endcolor: r.endcolor || r.color || '#999999',
                label: r.label || ''
            }))
        };
    };

    const textAreaInstance = $('#kpiToolsJsonEditor').dxTextArea({
        value: '',
        height: '100%'
    }).dxTextArea('instance');

    const getJsonArray = () => {
        const raw = textAreaInstance.option('value');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [];
        }
    };

    const gaugeInstances = [];

    function addConfigToJson() {
        const list = getJsonArray();
        list.push(buildConfig());
        textAreaInstance.option('value', JSON.stringify(list, null, 2));
        DevExpress.ui.notify('Added to JSON.', 'success', 1500);
    }

    function downloadJson() {
        const raw = textAreaInstance.option('value') || '';
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kpi-gauges.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    const exportGauges = (format) => {
        if (!DevExpress?.viz?.exportWidgets) {
            DevExpress.ui.notify('Export is not available (missing DevExpress export).', 'error', 3000);
            return;
        }
        if (!gaugeInstances.length) {
            DevExpress.ui.notify('No gauges to export.', 'warning', 2000);
            return;
        }
        DevExpress.viz.exportWidgets(gaugeInstances, {
            format,
            fileName: 'kpi-gauges'
        });
    };

    $('#kpiToolsAddJson').dxButton({
        text: 'Export PDF',
        type: 'default',
        icon: 'exportpdf',
        onClick: () => {
            exportGauges('PDF');
        }
    });

    $('#kpiToolsDownload').dxButton({
        text: 'Export PNG',
        type: 'default',
        icon: 'export',
        onClick: () => {
            exportGauges('PNG');
        }
    });

    fileInput.on('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            textAreaInstance.option('value', reader.result || '');
        };
        reader.readAsText(file);
    });

    const renderGauge = (config) => {
        const card = $('<div class="kpi-tools-gauge-card"></div>');
        const gaugeEl = $('<div class="kpi-tools-gauge-inner"></div>');
        const nameEl = $('<div class="kpi-tools-gauge-name"></div>').text(config.name || '');
        card.append(gaugeEl, nameEl);
        gaugeWrap.append(card);

        const ranges = Array.isArray(config.ranges) ? config.ranges : [];
        const hexToRgb = (hex) => {
            const clean = String(hex || '').replace('#', '').trim();
            if (clean.length === 3) {
                return {
                    r: parseInt(clean[0] + clean[0], 16),
                    g: parseInt(clean[1] + clean[1], 16),
                    b: parseInt(clean[2] + clean[2], 16)
                };
            }
            if (clean.length !== 6) return null;
            return {
                r: parseInt(clean.slice(0, 2), 16),
                g: parseInt(clean.slice(2, 4), 16),
                b: parseInt(clean.slice(4, 6), 16)
            };
        };
        const rgbToHex = (rgb) => {
            const toHex = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
            return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
        };
        const lerp = (a, b, t) => Math.round(a + (b - a) * t);
        const buildGradientRanges = (r, steps = 12) => {
            const start = Number(r.start) || 0;
            const end = Number(r.end) || 0;
            if (!steps || steps < 2 || end <= start) return [];
            const startRgb = hexToRgb(r.startcolor);
            const endRgb = hexToRgb(r.endcolor);
            if (!startRgb || !endRgb) return [];
            const span = end - start;
            return Array.from({ length: steps }, (_, i) => {
                const t1 = i / steps;
                const t2 = (i + 1) / steps;
                const color = rgbToHex({
                    r: lerp(startRgb.r, endRgb.r, t1),
                    g: lerp(startRgb.g, endRgb.g, t1),
                    b: lerp(startRgb.b, endRgb.b, t1)
                });
                return {
                    startValue: start + span * t1,
                    endValue: start + span * t2,
                    color
                };
            });
        };
        const renderRanges = ranges.flatMap(r => {
            if (r.startcolor && r.endcolor) {
                const grad = buildGradientRanges(r, 14);
                if (grad.length) return grad;
            }
            return [{
                startValue: Number(r.start) || 0,
                endValue: Number(r.end) || 0,
                color: r.endcolor || r.startcolor || r.color || '#999999'
            }];
        });
        const curveWidth = Number(config.curvewidth) || 24;
        const instance = gaugeEl.dxCircularGauge({
            value: Number(config.value) || 0,
            geometry: { startAngle: 180, endAngle: 0 },
            scale: {
                startValue: Number(config.min) || 0,
                endValue: Number(config.max) || 100,
                tickInterval: 10,
                label: { useRangeColors: false }
            },
            rangeContainer: {
                backgroundColor: '#e5e7eb',
                width: curveWidth,
                ranges: renderRanges
            },
            title: {
                text: config.title || 'KPI',
                subtitle: { text: config.unit ? `${config.value} ${config.unit}` : String(config.value || 0) }
            }
        }).dxCircularGauge('instance');
        if (instance) gaugeInstances.push(instance);
    };

    $('#kpiToolsRender').dxButton({
        text: 'Render',
        type: 'success',
        icon: 'chart',
        onClick: () => {
            try {
                const raw = textAreaInstance.option('value');
                const config = raw ? JSON.parse(raw) : [buildConfig()];
                const list = Array.isArray(config) ? config : [config];
                gaugeWrap.empty();
                gaugeInstances.length = 0;
                list.forEach(item => renderGauge(item));
            } catch (err) {
                DevExpress.ui.notify('Invalid JSON format', 'error', 3000);
            }
        }
    });
};
