// js/kpi-dashboard.js
window.renderKpiDashboard = async function renderKpiDashboard() {
    if (typeof window.showPage === 'function') {
        window.showPage('kpiDashboard');
    }

    const container = $('#kpiDashboard');
    container.empty();

    let wards = [];
    try {
        wards = await Helper.getWards();
        if (!Array.isArray(wards) || !wards.length) {
            throw new Error('Failed to load wards');
        }
    } catch (err) {
        container.append($('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load wards.' }));
        return;
    }

    const now = new Date();
    const monthItems = [
        { value: 1, text: 'Jan' }, { value: 2, text: 'Feb' }, { value: 3, text: 'Mar' },
        { value: 4, text: 'Apr' }, { value: 5, text: 'May' }, { value: 6, text: 'Jun' },
        { value: 7, text: 'Jul' }, { value: 8, text: 'Aug' }, { value: 9, text: 'Sep' },
        { value: 10, text: 'Oct' }, { value: 11, text: 'Nov' }, { value: 12, text: 'Dec' }
    ];
    const currentYear = now.getFullYear();
    const yearItems = [currentYear - 1, currentYear, currentYear + 1];

    const header = $(
        '<div class="kpi-dashboard-header">' +
            '<div class="kpi-dashboard-title">Business Performance Meters Dashboard</div>' +
            '<div class="kpi-dashboard-subtitle">Operational KPIs across wards and shifts</div>' +
            '<div class="kpi-dashboard-range" id="kpiDashRangeText"></div>' +
        '</div>'
    );
    const filters = $(
        '<div class="kpi-dashboard-filters">' +
            '<div id="kpiDashWard"></div>' +
            '<div id="kpiDashFrom"></div>' +
            '<div id="kpiDashTo"></div>' +
            '<div id="kpiDashShift"></div>' +
            '<div id="kpiDashLoad"></div>' +
        '</div>'
    );
    const checklist = $('<div class="kpi-checklist"></div>');
    const grid = $('<div class="kpi-dashboard-grid"></div>');
    container.append(header).append(filters).append(checklist).append(grid);

    const wardSelect = $('#kpiDashWard').dxTagBox({
        items: wards,
        displayExpr: (item) => item ? (item.conf_description || item.name || item.conf_code || '') : '',
        valueExpr: '_id',
        value: wards[0]?._id ? [wards[0]._id] : [],
        placeholder: 'Select wards'
    }).dxTagBox('instance');

    const fromDate = $('#kpiDashFrom').dxDateBox({
        value: new Date(now.getFullYear(), now.getMonth(), 1),
        displayFormat: 'dd/MM/yyyy'
    }).dxDateBox('instance');

    const toDate = $('#kpiDashTo').dxDateBox({
        value: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        displayFormat: 'dd/MM/yyyy'
    }).dxDateBox('instance');

    const shiftSelect = $('#kpiDashShift').dxTagBox({
        items: [
            { code: 'ช', name: 'เช้า' },
            { code: 'บ', name: 'บ่าย' },
            { code: 'ด', name: 'ดึก' }
        ],
        displayExpr: 'name',
        valueExpr: 'code',
        value: ['ช', 'บ', 'ด'],
        placeholder: '(ทั้งหมด)'
    }).dxTagBox('instance');

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

    const buildGradientRanges = (baseRanges, stepsPerRange = 12) => {
        if (!Array.isArray(baseRanges) || baseRanges.length < 2) return baseRanges || [];
        const segments = [];
        baseRanges.forEach((r, idx) => {
            const start = Number(r.startValue) || 0;
            const end = Number(r.endValue) || 0;
            if (end <= start) return;
            const startRgb = hexToRgb(r.color);
            const nextColor = baseRanges[idx + 1]?.color || r.color;
            const endRgb = hexToRgb(nextColor);
            if (!startRgb || !endRgb) {
                segments.push({ startValue: start, endValue: end, color: r.color });
                return;
            }
            const span = end - start;
            const steps = Math.max(2, Number(stepsPerRange) || 12);
            for (let i = 0; i < steps; i++) {
                const t1 = i / steps;
                const t2 = (i + 1) / steps;
                const color = rgbToHex({
                    r: lerp(startRgb.r, endRgb.r, t1),
                    g: lerp(startRgb.g, endRgb.g, t1),
                    b: lerp(startRgb.b, endRgb.b, t1)
                });
                segments.push({
                    startValue: start + span * t1,
                    endValue: start + span * t2,
                    color
                });
            }
        });
        return segments;
    };

    const buildAlphaRanges = (baseRanges, stepsPerRange = 10) => {
        if (!Array.isArray(baseRanges) || !baseRanges.length) return baseRanges || [];
        const segments = [];
        baseRanges.forEach((r) => {
            const start = Number(r.startValue) || 0;
            const end = Number(r.endValue) || 0;
            if (end <= start) return;
            const rgb = hexToRgb(r.color);
            if (!rgb) {
                segments.push({ startValue: start, endValue: end, color: r.color });
                return;
            }
            const span = end - start;
            const steps = Math.max(2, Number(stepsPerRange) || 10);
            for (let i = 0; i < steps; i++) {
                const t1 = i / steps;
                const t2 = (i + 1) / steps;
                const alpha = 0.1 + (0.9 * t1);
                segments.push({
                    startValue: start + span * t1,
                    endValue: start + span * t2,
                    color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`
                });
            }
        });
        return segments;
    };

    const renderCards = (items) => {
        grid.empty();
        if (!items.length) {
            const sample = {
                title: 'ตัวอย่าง KPI',
                name: 'ประสิทธิภาพการทำงาน',
                value: 99,
                unit: '%',
                description: 'ตัวอย่าง',
                status: 'green',
                threshold: {
                    redMin: 0,
                    redMax: 25,
                    purpleMin: 26,
                    purpleMax: 49,
                    amberMin: 50,
                    amberMax: 79,
                    greenMin: 80,
                    greenMax: 100
                }
            };
            items = [sample];
        }
        const resolveValueColor = (value, ranges) => {
            const v = Number(value);
            if (Number.isNaN(v)) return { text: '#0f172a', bg: '#f1f5f9' };
            const hit = (ranges || []).find(r => v >= Number(r.startValue) && v <= Number(r.endValue));
            if (!hit) return { text: '#0f172a', bg: '#f1f5f9' };
            const rgb = hexToRgb(hit.color);
            if (!rgb) return { text: '#0f172a', bg: hit.color || '#f1f5f9' };
            const bg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
            return { text: hit.color, bg };
        };

        items.forEach(item => {
            const card = $('<div>', { class: `kpi-card kpi-card--${item.status || 'unknown'}` });
            card.append($('<div>', { class: 'kpi-card-title', text: item.title || item.code }));
            const gaugeWrap = $('<div>', { class: 'kpi-gauge' });
            card.append(gaugeWrap);
            if (item.description) card.append($('<div>', { class: 'kpi-card-desc', text: item.description }));
            const legend = $('<div>', { class: 'kpi-gauge-legend' })
                .append('<span class="legend legend-green"></span><span>Great</span>')
                .append('<span class="legend legend-amber"></span><span>Average</span>')
                .append('<span class="legend legend-red"></span><span>Poor</span>');
            card.append(legend);

            const t = item.threshold || {};
            const mins = [t.greenMin, t.amberMin, t.redMin].filter(v => v !== null && v !== undefined);
            const maxs = [t.greenMax, t.amberMax, t.redMax].filter(v => v !== null && v !== undefined);
            const min = mins.length ? Math.min(...mins) : 0;
            const max = maxs.length ? Math.max(...maxs) : 10;

            const ranges = [];
            if (t.redMin !== null && t.redMax !== null) ranges.push({ startValue: t.redMin, endValue: t.redMax, color: '#ef4444' });
            if (t.purpleMin !== null && t.purpleMax !== null) ranges.push({ startValue: t.purpleMin, endValue: t.purpleMax, color: '#8b5cf6' });
            if (t.amberMin !== null && t.amberMax !== null) ranges.push({ startValue: t.amberMin, endValue: t.amberMax, color: '#f59e0b' });
            if (t.greenMin !== null && t.greenMax !== null) ranges.push({ startValue: t.greenMin, endValue: t.greenMax, color: '#22c55e' });
            if (!ranges.length) {
                ranges.push({ startValue: 0, endValue: 25, color: '#ef4444' });
                ranges.push({ startValue: 26, endValue: 49, color: '#8b5cf6' });
                ranges.push({ startValue: 50, endValue: 79, color: '#f59e0b' });
                ranges.push({ startValue: 80, endValue: 100, color: '#22c55e' });
            }

            const valueText = `${item.value ?? 0}${item.unit ? ` ${item.unit}` : ''}`;
            const valueColors = resolveValueColor(item.value, ranges);
            const isRed = valueColors.text === '#ef4444';
            const isGreen = valueColors.text === '#22c55e';
            card.append(
                $('<div>', {
                    class: `kpi-card-value${isRed ? ' kpi-value-alert' : ''}`,
                    text: valueText
                }).css({
                    color: valueColors.text,
                    backgroundColor: valueColors.bg
                })
            );
            if (isGreen) {
                card.append($('<div>', { class: 'kpi-card-heart', text: '💗' }));
            }

            const useGradient = !!item.gradient;
            const renderRanges = useGradient ? buildAlphaRanges(ranges, 10) : ranges;
            const curveWidth = Number(item.curveWidth) || 30;

            gaugeWrap.dxCircularGauge({
                geometry: {
                    startAngle: 180,
                    endAngle: 0
                },
                scale: {
                    startValue: min,
                    endValue: max,
                    tickInterval: Math.max(1, Math.round((max - min) / 5)),
                    label: { visible: true, font: { size: 11, color: '#64748b' } },
                    tick: { visible: true, color: '#cbd5f5', length: 6, width: 1 },
                    minorTick: { visible: false }
                },
                rangeContainer: {
                    offset: 6,
                    width: curveWidth,
                    backgroundColor: '#e5e7eb',
                    ranges: renderRanges
                },
                value: Number(item.value || 0),
                valueIndicator: {
                    type: 'triangleNeedle',
                    color: item.status === 'red' ? '#ef4444' : item.status === 'amber' ? '#f59e0b' : item.status === 'green' ? '#22c55e' : '#0f766e',
                    width: 2
                },
                backgroundColor: '#ffffff',
                centerTemplate: (g, container) => {
                    $('<div>')
                        .addClass('kpi-gauge-center')
                        .text(item.icon ? String(item.icon).slice(0, 2).toUpperCase() : '⚙')
                        .appendTo(container);
                }
            });

            grid.append(card);
        });
    };

    const renderChecklist = (items) => {
        checklist.empty();
        if (!items.length) return;
        const wrap = $('<div class="kpi-checklist-list"></div>');
        items.forEach(item => {
            const badge = $('<span>', { class: `kpi-checklist-badge kpi-checklist-${item.status}` })
                .text(`${item.percent}%`);
            const row = $('<div class="kpi-checklist-item"></div>');
            row.append($('<div class="kpi-checklist-name"></div>').text(item.wardName || item.wardCode || 'Ward'));
            row.append($('<div class="kpi-checklist-meta"></div>').text(`${item.completed}/${item.totalExpected}`));
            row.append(badge);
            wrap.append(row);
        });
        checklist.append('<div class="kpi-checklist-title">Daily Checklist (Keyed/Total)</div>');
        checklist.append(wrap);
    };

    const updateRangeText = () => {
        const from = fromDate.option('value');
        const to = toDate.option('value');
        if (!from || !to) {
            $('#kpiDashRangeText').text('');
            return;
        }
        const fromD = new Date(from);
        const toD = new Date(to);
        const fmt = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };
        let label = `Range: ${fmt(fromD)} → ${fmt(toD)}`;
        if (fromD.getFullYear() === toD.getFullYear() && fromD.getMonth() === toD.getMonth()) {
            const monthName = fromD.toLocaleString('en', { month: 'long' });
            label = `Month: ${monthName} ${fromD.getFullYear()} (${fmt(fromD)} → ${fmt(toD)})`;
        }
        $('#kpiDashRangeText').text(label);
    };

    const loadSummary = async () => {
        const wardIds = wardSelect.option('value') || [];
        const from = fromDate.option('value');
        const to = toDate.option('value');
        const shifts = shiftSelect.option('value') || [];
        if (!from || !to) {
            DevExpress.ui.notify('Please select date range', 'warning', 2000);
            return;
        }
        updateRangeText();
        const wardQuery = wardIds.length ? `&wardIds=${wardIds.join(',')}` : '';
        const shiftQuery = shifts.length ? `&shiftCodes=${shifts.join(',')}` : '';
        const summaryReq = Common.fetchWithAuth(`/api/kpi/dashboard/summary?from=${from.toISOString()}&to=${to.toISOString()}${wardQuery}${shiftQuery}`);
        const checklistReq = Common.fetchWithAuth(`/api/kpi/dashboard/checklist?from=${from.toISOString()}&to=${to.toISOString()}${wardQuery}${shiftQuery}`);

        const [summaryRes, checklistRes] = await Promise.all([summaryReq, checklistReq]);
        const summaryJson = await summaryRes.json();
        const checklistJson = await checklistRes.json();
        if (!summaryRes.ok) {
            DevExpress.ui.notify(summaryJson.message || 'Load failed', 'error', 3000);
            return;
        }
        renderCards(Array.isArray(summaryJson.data) ? summaryJson.data : []);
        if (checklistRes.ok) {
            renderChecklist(Array.isArray(checklistJson.data) ? checklistJson.data : []);
        }
    };

    $('#kpiDashLoad').dxButton({
        text: 'Load',
        type: 'default',
        onClick: loadSummary
    });

    updateRangeText();
    loadSummary();
};
