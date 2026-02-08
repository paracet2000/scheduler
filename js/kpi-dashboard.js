// js/kpi-dashboard.js
window.renderKpiDashboard = async function renderKpiDashboard() {
    if (typeof window.showPage === 'function') {
        window.showPage('kpiDashboard');
    }

    const roles = typeof window.getStoredRoles === 'function' ? window.getStoredRoles() : [];
    const isAdmin = roles.includes('admin');
    const isHead = roles.includes('head');
    const isFinance = roles.includes('finance');

    const container = $('#kpiDashboard');
    container.empty();

    if (!isAdmin && !isHead && !isFinance) {
        container.append($('<div>', { class: 'settings-placeholder', text: 'KPI dashboard is available for admin/head/finance only.' }));
        return;
    }

    const apiBase = window.BASE_URL || '';
    const token = localStorage.getItem('auth_token');
    const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

    let wards = [];
    try {
        const res = await fetch(`${apiBase}/api/masters/WARD`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load wards');
        wards = Array.isArray(json.data) ? json.data : [];
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
        displayExpr: 'name',
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
            { code: 'M', name: 'เช้า' },
            { code: 'A', name: 'บ่าย' },
            { code: 'N', name: 'ดึก' }
        ],
        displayExpr: 'name',
        valueExpr: 'code',
        value: ['M', 'A', 'N'],
        placeholder: '(ทั้งหมด)'
    }).dxTagBox('instance');

    const renderCards = (items) => {
        grid.empty();
        if (!items.length) {
            grid.append($('<div>', { class: 'settings-placeholder', text: 'No KPI widgets configured.' }));
            return;
        }
        items.forEach(item => {
            const card = $('<div>', { class: `kpi-card kpi-card--${item.status || 'unknown'}` });
            card.append($('<div>', { class: 'kpi-card-title', text: item.title || item.code }));
            const gaugeWrap = $('<div>', { class: 'kpi-gauge' });
            card.append(gaugeWrap);
            card.append($('<div>', { class: 'kpi-card-value', text: `${item.value ?? 0}${item.unit ? ` ${item.unit}` : ''}` }));
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
            if (t.amberMin !== null && t.amberMax !== null) ranges.push({ startValue: t.amberMin, endValue: t.amberMax, color: '#f59e0b' });
            if (t.greenMin !== null && t.greenMax !== null) ranges.push({ startValue: t.greenMin, endValue: t.greenMax, color: '#22c55e' });
            if (!ranges.length) {
                ranges.push({ startValue: 0, endValue: 35, color: '#ef4444' });
                ranges.push({ startValue: 35, endValue: 65, color: '#f59e0b' });
                ranges.push({ startValue: 65, endValue: 100, color: '#22c55e' });
            }

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
                    width: 35,
                    backgroundColor: '#e5e7eb',
                    ranges
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
        const summaryReq = fetch(`${apiBase}/api/kpi/dashboard/summary?from=${from.toISOString()}&to=${to.toISOString()}${wardQuery}${shiftQuery}`, {
            headers: authHeaders()
        });
        const checklistReq = fetch(`${apiBase}/api/kpi/dashboard/checklist?from=${from.toISOString()}&to=${to.toISOString()}${wardQuery}${shiftQuery}`, {
            headers: authHeaders()
        });

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
