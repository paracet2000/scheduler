// js/commonreport.js
window.renderCommonReport = async function renderCommonReport() {
    if (typeof window.showPage === 'function') {
        window.showPage('commonReport');
    }

    const roles = typeof window.getStoredRoles === 'function' ? window.getStoredRoles() : [];
    const isAdmin = roles.includes('admin');
    const isHead = roles.includes('head');
    const isFinance = roles.includes('finance');

    const container = $('#commonReport');
    container.empty();

    if (!isAdmin && !isHead && !isFinance) {
        container.append($('<div>', { class: 'settings-placeholder', text: 'Common Report is available for admin/head/finance only.' }));
        return;
    }

    const apiBase = window.BASE_URL || '';
    const token = localStorage.getItem('auth_token');
    const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

    let wards = [];
    let users = [];
    let positions = [];
    try {
        const [wardRes, userRes, posRes] = await Promise.all([
            fetch(`${apiBase}/api/masters/WARD`, { headers: authHeaders() }),
            fetch(`${apiBase}/api/users`, { headers: authHeaders() }),
            fetch(`${apiBase}/api/masters/POSITION`, { headers: authHeaders() })
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
        container.append($('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load wards.' }));
        return;
    }

    const now = new Date();
    const reportTypes = [
        { code: 'schedule_summary', name: 'Schedule Summary (By Person/Day/Shift)' },
        { code: 'position_summary', name: 'Schedule Summary (By Position/Day)' },
        { code: 'payroll_summary', name: 'Payroll Summary (By Person/Day)' },
        { code: 'payroll_position_summary', name: 'Payroll Summary (By Position/Day)' },
        { code: 'kpi_completeness', name: 'KPI Data Completeness (By Shift/Date/Ward)' },
        { code: 'booking_summary', name: 'Booking Summary (By Month/Ward/Name)' }
    ];

    const formData = {
        reportType: reportTypes[0].code,
        wardIds: wards[0]?._id ? [wards[0]._id] : [],
        userId: null,
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        shifts: ['M', 'A', 'N']
    };

    const panel = $('<div class="report-panel"></div>');
    const formEl = $('<div id="commonReportForm"></div>');
    const resultEl = $('<div class="report-result">Select filters and click Generate.</div>');
    panel.append(formEl);
    container.append(panel, resultEl);

    const normalizeShift = (code) => {
        const raw = String(code || '').trim().toUpperCase();
        if (!raw) return '';
        if (['M', 'CH', 'CHAO', 'เช้า', 'ช'].includes(raw)) return 'M';
        if (['A', 'BAI', 'บ่าย', 'บ'].includes(raw)) return 'A';
        if (['N', 'NIGHT', 'ดึก', 'ด'].includes(raw)) return 'N';
        if (raw.startsWith('M')) return 'M';
        if (raw.startsWith('A')) return 'A';
        if (raw.startsWith('N')) return 'N';
        if (raw.startsWith('ช')) return 'M';
        if (raw.startsWith('บ')) return 'A';
        if (raw.startsWith('ด')) return 'N';
        return raw;
    };

    const fmt = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const exportGrid = (component, format, headerMap = {}) => {
        if (!component) return;
        if (format === 'xlsx') {
            if (!window.ExcelJS || !window.saveAs) {
                DevExpress.ui.notify('Export dependencies missing (ExcelJS/FileSaver).', 'error', 3000);
                return;
            }
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Report');
            DevExpress.excelExporter.exportDataGrid({
                component,
                worksheet,
                autoFilterEnabled: true
            }).then(() => workbook.xlsx.writeBuffer())
              .then((buffer) => {
                  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'common-report.xlsx');
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
                component,
                customizeCell: ({ gridCell, pdfCell }) => {
                    if (gridCell.rowType === 'header') {
                        const field = gridCell.column?.dataField;
                        const caption = gridCell.column?.caption || '';
                        if (field && headerMap[field]) {
                            pdfCell.text = headerMap[field];
                        } else if (caption) {
                            pdfCell.text = String(caption).replace(/[^ -~]/g, '') || String(field || '');
                        }
                    }
                }
            }).then(() => {
                doc.save('common-report.pdf');
            });
        }
    

    };

    const THAI_M = '\u0e0a';
    const THAI_A = '\u0e1a';
    const THAI_N = '\u0e14';

    const buildRateMap = async (userIds) => {
        if (!userIds || !userIds.length) return new Map();
        const res = await fetch(`${apiBase}/api/user-shift-rates?userIds=${userIds.join(',')}`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Failed to load shift rates', 'error', 3000);
            return new Map();
        }
        const map = new Map();
        (json.data || []).forEach(r => {
            const userId = r.userId?._id || r.userId;
            const code = String(r.shiftCode || '').toUpperCase();
            if (!userId || !code) return;
            const key = `${userId}|${code}`;
            map.set(key, Number(r.amount) || 0);
            if (code === 'M') map.set(`${userId}|${THAI_M}`, Number(r.amount) || 0);
            if (code === 'A') map.set(`${userId}|${THAI_A}`, Number(r.amount) || 0);
            if (code === 'N') map.set(`${userId}|${THAI_N}`, Number(r.amount) || 0);
            if (code === THAI_M) map.set(`${userId}|M`, Number(r.amount) || 0);
            if (code === THAI_A) map.set(`${userId}|A`, Number(r.amount) || 0);
            if (code === THAI_N) map.set(`${userId}|N`, Number(r.amount) || 0);
        });
        return map;
    };

    const getRate = (rateMap, userId, code) => {
        if (!rateMap || !userId) return 0;
        const upper = String(code || '').toUpperCase();
        const norm = normalizeShift(upper);
        const candidates = [upper, norm];
        const thaiMap = { M: THAI_M, A: THAI_A, N: THAI_N };
        const engMap = { [THAI_M]: 'M', [THAI_A]: 'A', [THAI_N]: 'N' };
        if (thaiMap[norm]) candidates.push(thaiMap[norm]);
        if (engMap[upper]) candidates.push(engMap[upper]);
        for (const c of candidates) {
            if (!c) continue;
            const key = `${userId}|${c}`;
            if (rateMap.has(key)) return Number(rateMap.get(key)) || 0;
        }
        return 0;
    };

    const renderSummaryTable = (summary, filters, wardName) => {
        const { from, to, userId, shifts } = filters;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const start = new Date(from);
        const end = new Date(to);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const daysCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
        const shiftSet = new Set((shifts || []).map(normalizeShift).filter(Boolean));

        const filteredRows = summary.rows.filter(row => !userId || row.userId === userId);
        const tableWrap = $('<div>', { class: 'summary-table-wrap' });
        const gridEl = $('<div>', { class: 'summary-grid' });
        tableWrap.append(gridEl);

        let sumMorning = 0;
        let sumAfternoon = 0;
        let sumNight = 0;
        let sumOther = 0;
        const rows = [];

        for (let i = 0; i < daysCount; i += 1) {
            let morning = 0;
            let afternoon = 0;
            let night = 0;
            let other = 0;

            filteredRows.forEach(row => {
                const codes = Array.isArray(row.days[i]) ? row.days[i] : [];
                const items = codes
                    .map(c => String(c))
                    .filter(c => {
                        if (!shiftSet.size) return true;
                        const normalized = normalizeShift(c);
                        return shiftSet.has(normalized);
                    });
                items.forEach(c => {
                    const bucket = normalizeShift(c);
                    if (bucket === 'M') morning += 1;
                    else if (bucket === 'A') afternoon += 1;
                    else if (bucket === 'N') night += 1;
                    else other += 1;
                });
            });

            const total = morning + afternoon + night + other;
            const dayDate = new Date(start.getTime() + i * MS_PER_DAY);
            rows.push({
                date: fmt(dayDate),
                day: dayDate.getDate(),
                month: dayDate.getMonth() + 1,
                year: dayDate.getFullYear(),
                ward: wardName || '',
                morning: morning || 0,
                afternoon: afternoon || 0,
                night: night || 0,
                other: other || 0,
                total: total || 0,
                __isTotal: false
            });

            sumMorning += morning;
            sumAfternoon += afternoon;
            sumNight += night;
            sumOther += other;
        }

        const sumTotal = sumMorning + sumAfternoon + sumNight + sumOther;
        rows.push({
            date: 'Total',
            day: '',
            month: '',
            year: '',
            ward: '',
            morning: sumMorning || 0,
            afternoon: sumAfternoon || 0,
            night: sumNight || 0,
            other: sumOther || 0,
            total: sumTotal || 0,
            __isTotal: true
        });

        const headerMap = {
            day: 'Day',
            month: 'Month',
            year: 'Year',
            ward: 'Ward',
            morning: 'Morning',
            afternoon: 'Afternoon',
            night: 'Night',
            other: 'Other',
            total: 'Total'
        };

        const gridInstance = gridEl.dxDataGrid({
            dataSource: rows,
            keyExpr: 'date',
            showBorders: true,
            columnAutoWidth: true,
            paging: { enabled: false },
            sorting: { mode: 'none' },
            hoverStateEnabled: false,
            groupPanel: { visible: true },
            grouping: { autoExpandAll: false },
            export: {
                enabled: true,
                formats: ['xlsx', 'pdf'],
                allowExportSelectedData: false
            },
            toolbar: {
                items: ['groupPanel', 'exportButton']
            },
            onExporting: (e) => {
                exportGrid(e.component, e.format, headerMap);
                e.cancel = true;
            },
            summary: {
                groupItems: [
                    { column: 'morning', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'afternoon', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'night', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'other', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'total', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` }
                ],
                totalItems: [
                    { column: 'morning', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'afternoon', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'night', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'other', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'total', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` }
                ]
            },
            columns: [
                { dataField: 'day', caption: 'Day', allowEditing: false },
                { dataField: 'month', caption: 'Month', allowEditing: false },
                { dataField: 'year', caption: 'Year', allowEditing: false },
                { dataField: 'ward', caption: 'Ward', allowEditing: false },
                { dataField: 'morning', caption: 'Morning', allowEditing: false },
                { dataField: 'afternoon', caption: 'Afternoon', allowEditing: false },
                { dataField: 'night', caption: 'Night', allowEditing: false },
                { dataField: 'other', caption: 'Other', allowEditing: false },
                { dataField: 'total', caption: 'Total', allowEditing: false }
            ],
            rowPrepared: (e) => {
                if (e.rowType === 'data' && e.data?.__isTotal) {
                    e.rowElement.addClass('summary-total');
                }
            }
        });

        return tableWrap;
    };

    const generateScheduleSummary = async (data) => {
        const wardIds = data.wardIds || [];
        if (!wardIds.length) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }
        const wardId = wardIds[0];
        if (wardIds.length > 1) {
            DevExpress.ui.notify('Schedule Summary supports one ward at a time (using first selection).', 'info', 2000);
        }

        const from = new Date(data.from);
        const to = new Date(data.to);
        const res = await fetch(
            `${apiBase}/api/schedules/summary-range/${wardId}?from=${from.toISOString()}&to=${to.toISOString()}`,
            { headers: authHeaders() }
        );
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
            return;
        }

        const wardNames = wards
            .filter(w => wardIds.includes(w._id))
            .map(w => w.name)
            .join(', ');
        const userName = data.userId
            ? (users.find(u => u._id === data.userId)?.name || '')
            : '';
        resultEl.empty().append(
            $('<div>', { class: 'report-summary-title', text: 'Schedule Summary Report' }),
            $('<div>', {
                class: 'report-summary-meta',
                text: `Ward: ${wardNames || 'All'} | User: ${userName || 'All'} | Date: ${fmt(from)} - ${fmt(to)} | Shifts: ${(data.shifts || []).join(', ') || 'All'}`
            }),
            renderSummaryTable(json.data, { from, to, userId: data.userId, shifts: data.shifts }, wardNames)
        );
    };

    const renderPositionSummaryGrid = (summary, filters, wardName) => {
        const { from, to, shifts } = filters;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const start = new Date(from);
        const end = new Date(to);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const daysCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
        const shiftSet = new Set((shifts || []).map(normalizeShift).filter(Boolean));

        const positionCodes = positions.map(p => p.code).filter(Boolean);
        const rows = [];

        for (let i = 0; i < daysCount; i += 1) {
            const dayDate = new Date(start.getTime() + i * MS_PER_DAY);
            const row = {
                day: dayDate.getDate(),
                month: dayDate.getMonth() + 1,
                year: dayDate.getFullYear(),
                ward: wardName || '',
                total: 0
            };
            positionCodes.forEach(code => {
                row[code] = 0;
            });

            summary.rows.forEach(userRow => {
                const codes = Array.isArray(userRow.days[i]) ? userRow.days[i] : [];
                const items = codes
                    .map(c => String(c))
                    .filter(c => {
                        if (!shiftSet.size) return true;
                        const normalized = normalizeShift(c);
                        return shiftSet.has(normalized);
                    });
                if (!items.length) return;
                const posCode = userRow.position || '';
                if (posCode && row[posCode] !== undefined) {
                    row[posCode] += items.length;
                }
                row.total += items.length;
            });

            rows.push(row);
        }

        const totalRow = {
            day: 'Total',
            month: '',
            year: '',
            ward: '',
            total: 0,
            __isTotal: true
        };
        positionCodes.forEach(code => {
            totalRow[code] = rows.reduce((sum, r) => sum + (Number(r[code]) || 0), 0);
            totalRow.total += totalRow[code];
        });
        rows.push(totalRow);

        const tableWrap = $('<div>', { class: 'summary-table-wrap' });
        const gridEl = $('<div>', { class: 'summary-grid' });
        tableWrap.append(gridEl);

        const columns = [
            { dataField: 'day', caption: 'Day', allowEditing: false },
            { dataField: 'month', caption: 'Month', allowEditing: false },
            { dataField: 'year', caption: 'Year', allowEditing: false },
            { dataField: 'ward', caption: 'Ward', allowEditing: false }
        ];
        positionCodes.forEach(code => {
            const name = positions.find(p => p.code === code)?.name || code;
            columns.push({ dataField: code, caption: name, allowEditing: false });
        });
        columns.push({ dataField: 'total', caption: 'Total', allowEditing: false });

          const gridInstance = gridEl.dxDataGrid({
              dataSource: rows,
              keyExpr: 'day',
              showBorders: true,
              columnAutoWidth: true,
              paging: { enabled: false },
              sorting: { mode: 'none' },
              hoverStateEnabled: false,
              groupPanel: { visible: true },
              grouping: { autoExpandAll: false },
              export: { enabled: true, formats: ['xlsx', 'pdf'] },
              toolbar: { items: ['groupPanel', 'exportButton'] },
              onExporting: (e) => {
                  exportGrid(e.component, e.format);
                  e.cancel = true;
              },
              summary: {
                  groupItems: columns
                    .filter(c => !['day', 'month', 'year', 'ward'].includes(c.dataField))
                    .map(c => ({ column: c.dataField, summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` })),
                totalItems: columns
                    .filter(c => !['day', 'month', 'year', 'ward'].includes(c.dataField))
                    .map(c => ({ column: c.dataField, summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` }))
            },
            columns,
            rowPrepared: (e) => {
                if (e.rowType === 'data' && e.data?.__isTotal) {
                    e.rowElement.addClass('summary-total');
                }
            }
        });

        return tableWrap;
    };

    const generatePositionSummary = async (data) => {
        const wardIds = data.wardIds || [];
        if (!wardIds.length) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }
        const wardId = wardIds[0];
        if (wardIds.length > 1) {
            DevExpress.ui.notify('Position Summary supports one ward at a time (using first selection).', 'info', 2000);
        }

        const from = new Date(data.from);
        const to = new Date(data.to);
        const res = await fetch(
            `${apiBase}/api/schedules/summary-range/${wardId}?from=${from.toISOString()}&to=${to.toISOString()}`,
            { headers: authHeaders() }
        );
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
            return;
        }

        const wardNames = wards
            .filter(w => wardIds.includes(w._id))
            .map(w => w.name)
            .join(', ');

        resultEl.empty().append(
            $('<div>', { class: 'report-summary-title', text: 'Position Summary Report' }),
            $('<div>', {
                class: 'report-summary-meta',
                text: `Ward: ${wardNames || 'All'} | Date: ${fmt(from)} - ${fmt(to)} | Shifts: ${(data.shifts || []).join(', ') || 'All'}`
            }),
            renderPositionSummaryGrid(json.data, { from, to, shifts: data.shifts }, wardNames)
        );
    };

    const generateReport = () => {
        const data = $('#commonReportForm').dxForm('instance').option('formData');
        if (data.reportType === 'schedule_summary') {
            generateScheduleSummary(data);
            return;
        }
        if (data.reportType === 'position_summary') {
            generatePositionSummary(data);
            return;
        }
        if (data.reportType === 'payroll_summary') {
            generatePayrollSummary(data);
            return;
        }
        if (data.reportType === 'payroll_position_summary') {
            generatePayrollPositionSummary(data);
            return;
        }
        if (data.reportType === 'kpi_completeness') {
            generateKpiCompleteness(data);
            return;
        }
        if (data.reportType === 'booking_summary') {
            generateBookingSummary(data);
            return;
        }
        resultEl.html('<div class="report-summary-placeholder">Report output will be added here.</div>');
    };

    const generateBookingSummary = async (data) => {
        const wardIds = data.wardIds || [];
        if (!wardIds.length) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }

        const from = new Date(data.from);
        const to = new Date(data.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            DevExpress.ui.notify('Invalid date range', 'warning', 2000);
            return;
        }

        const rows = [];
        for (const wardId of wardIds) {
            const res = await fetch(
                `${apiBase}/api/schedules/summary-range/${wardId}?from=${from.toISOString()}&to=${to.toISOString()}`,
                { headers: authHeaders() }
            );
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
                return;
            }

            const wardName = wards.find(w => w._id === wardId)?.name || '';
            const start = new Date(from);
            const month = start.getMonth() + 1;
            const year = start.getFullYear();
            const monthYear = `${year}-${String(month).padStart(2, '0')}`;

            (json.data?.rows || []).forEach(userRow => {
                const booked = Array.isArray(userRow.days) && userRow.days.some(day => Array.isArray(day) && day.length);
                rows.push({
                    monthYear,
                    ward: wardName,
                    name: userRow.name || '',
                    status: booked ? 'Booked' : 'Un-booked'
                });
            });
        }

        const tableWrap = $('<div>', { class: 'summary-table-wrap' });
        const gridEl = $('<div>', { class: 'summary-grid' });
        tableWrap.append(gridEl);

        const headerMap = {
            monthYear: 'Year-Month',
            ward: 'Ward',
            name: 'Name',
            status: 'Status'
        };

        gridEl.dxDataGrid({
            dataSource: rows,
            keyExpr: (row) => `${row.month}-${row.year}-${row.ward}-${row.name}`,
            showBorders: true,
            columnAutoWidth: true,
            paging: { enabled: false },
            sorting: { mode: 'none' },
            hoverStateEnabled: false,
            groupPanel: { visible: true },
            grouping: { autoExpandAll: true },
            export: { enabled: true, formats: ['xlsx', 'pdf'] },
            toolbar: { items: ['groupPanel', 'exportButton'] },
            onExporting: (e) => {
                exportGrid(e.component, e.format, headerMap);
                e.cancel = true;
            },
            columns: [
                { dataField: 'monthYear', caption: 'Year-Month', allowEditing: false, groupIndex: 0 },
                { dataField: 'ward', caption: 'Ward', allowEditing: false, groupIndex: 1 },
                { dataField: 'name', caption: 'Name', allowEditing: false },
                { dataField: 'status', caption: 'Status', allowEditing: false }
            ],
            summary: {
                groupItems: [
                    { column: 'status', summaryType: 'count', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` }
                ],
                totalItems: [
                    { column: 'status', summaryType: 'count', customizeText: (e) => `${e.value ?? 0}` }
                ]
            }
        });

        resultEl.empty().append(
            $('<div>', { class: 'report-summary-title', text: 'Booking Summary Report' }),
            $('<div>', {
                class: 'report-summary-meta',
                text: `Ward: ${wardIds.map(id => wards.find(w => w._id === id)?.name || '').join(', ')} | Date: ${fmt(from)} - ${fmt(to)}`
            }),
            tableWrap
        );
    };
    const generateKpiCompleteness = async (data) => {
        const wardIds = data.wardIds || [];
        if (!wardIds.length) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }
        const from = new Date(data.from);
        const to = new Date(data.to);
        const shiftCodes = (data.shifts || []).map(s => String(s));

        const res = await fetch(
            `${apiBase}/api/kpi/entries-range?from=${from.toISOString()}&to=${to.toISOString()}&wardIds=${wardIds.join(',')}&shiftCodes=${shiftCodes.join(',')}`,
            { headers: authHeaders() }
        );
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
            return;
        }

        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const start = new Date(from);
        const end = new Date(to);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const daysCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

        const entrySet = new Set(
            (json.data || []).map(e => {
                const day = new Date(e.date);
                day.setHours(0, 0, 0, 0);
                return `${e.wardId}|${String(e.shiftCode).toUpperCase()}|${day.toISOString()}`;
            })
        );

        const rows = [];
        for (let i = 0; i < daysCount; i += 1) {
            const dayDate = new Date(start.getTime() + i * MS_PER_DAY);
            const dateIso = dayDate.toISOString();
            wardIds.forEach(wardId => {
                const wardName = wards.find(w => w._id === wardId)?.name || '';
                shiftCodes.forEach(code => {
                    const key = `${wardId}|${String(code).toUpperCase()}|${dateIso}`;
                    const status = entrySet.has(key) ? 'Complete' : 'In-complete';
                    rows.push({
                        shift: String(code).toUpperCase(),
                        date: fmt(dayDate),
                        day: dayDate.getDate(),
                        month: dayDate.getMonth() + 1,
                        year: dayDate.getFullYear(),
                        ward: wardName,
                        status
                    });
                });
            });
        }

        const tableWrap = $('<div>', { class: 'summary-table-wrap' });
        const gridEl = $('<div>', { class: 'summary-grid' });
        tableWrap.append(gridEl);
        const headerMap = {
            shift: 'Shift',
            date: 'Date',
            day: 'Day',
            month: 'Month',
            year: 'Year',
            ward: 'Ward',
            status: 'Status'
        };

        gridEl.dxDataGrid({
            dataSource: rows,
            keyExpr: (row) => `${row.shift}|${row.date}|${row.ward}`,
            showBorders: true,
            columnAutoWidth: true,
            paging: { enabled: false },
            sorting: { mode: 'none' },
            hoverStateEnabled: false,
            groupPanel: { visible: true },
            grouping: { autoExpandAll: true },
            export: { enabled: true, formats: ['xlsx', 'pdf'] },
            toolbar: { items: ['groupPanel', 'exportButton'] },
            onExporting: (e) => {
                exportGrid(e.component, e.format, headerMap);
                e.cancel = true;
            },
            columns: [
                { dataField: 'status', caption: 'Status', allowEditing: false, groupIndex: 0 },
                { dataField: 'ward', caption: 'Ward', allowEditing: false, groupIndex: 1 },
                { dataField: 'shift', caption: 'Shift', allowEditing: false },
                { dataField: 'date', caption: 'Date', allowEditing: false }
            ],
            summary: {
                groupItems: [
                    { column: 'status', summaryType: 'count', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` }
                ],
                totalItems: [
                    { column: 'status', summaryType: 'count', customizeText: (e) => `${e.value ?? 0}` }
                ]
            }
        });

        resultEl.empty().append(
            $('<div>', { class: 'report-summary-title', text: 'KPI Data Completeness Report' }),
            $('<div>', {
                class: 'report-summary-meta',
                text: `Ward: ${wardIds.map(id => wards.find(w => w._id === id)?.name || '').join(', ')} | Date: ${fmt(from)} - ${fmt(to)} | Shifts: ${(shiftCodes || []).join(', ') || 'All'}`
            }),
            tableWrap
        );
    };

    const renderPayrollSummaryGrid = (summary, filters, wardName, rateMap) => {
        const { from, to, shifts } = filters;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const start = new Date(from);
        const end = new Date(to);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const daysCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
        const shiftSet = new Set((shifts || []).map(normalizeShift).filter(Boolean));

        const rows = [];
        let sumMorning = 0;
        let sumAfternoon = 0;
        let sumNight = 0;
        let sumOther = 0;

        for (let i = 0; i < daysCount; i += 1) {
            let morning = 0;
            let afternoon = 0;
            let night = 0;
            let other = 0;

            summary.rows.forEach(userRow => {
                const codes = Array.isArray(userRow.days[i]) ? userRow.days[i] : [];
                const items = codes
                    .map(c => String(c))
                    .filter(c => {
                        if (!shiftSet.size) return true;
                        const normalized = normalizeShift(c);
                        return shiftSet.has(normalized);
                    });
                items.forEach(code => {
                    const bucket = normalizeShift(code);
                    const amount = getRate(rateMap, userRow.userId, code);
                    if (bucket === 'M') morning += amount;
                    else if (bucket === 'A') afternoon += amount;
                    else if (bucket === 'N') night += amount;
                    else other += amount;
                });
            });

            const total = morning + afternoon + night + other;
            const dayDate = new Date(start.getTime() + i * MS_PER_DAY);
            rows.push({
                day: dayDate.getDate(),
                month: dayDate.getMonth() + 1,
                year: dayDate.getFullYear(),
                ward: wardName || '',
                morning: morning || 0,
                afternoon: afternoon || 0,
                night: night || 0,
                other: other || 0,
                total: total || 0,
                __isTotal: false
            });

            sumMorning += morning;
            sumAfternoon += afternoon;
            sumNight += night;
            sumOther += other;
        }

        const sumTotal = sumMorning + sumAfternoon + sumNight + sumOther;
        rows.push({
            day: 'Total',
            month: '',
            year: '',
            ward: '',
            morning: sumMorning || 0,
            afternoon: sumAfternoon || 0,
            night: sumNight || 0,
            other: sumOther || 0,
            total: sumTotal || 0,
            __isTotal: true
        });

        const tableWrap = $('<div>', { class: 'summary-table-wrap' });
        const gridEl = $('<div>', { class: 'summary-grid' });
        tableWrap.append(gridEl);

        const headerMap = {
            day: 'Day',
            month: 'Month',
            year: 'Year',
            ward: 'Ward',
            morning: 'Morning',
            afternoon: 'Afternoon',
            night: 'Night',
            other: 'Other',
            total: 'Total'
        };

        gridEl.dxDataGrid({
            dataSource: rows,
            keyExpr: 'day',
            showBorders: true,
            columnAutoWidth: true,
            paging: { enabled: false },
            sorting: { mode: 'none' },
            hoverStateEnabled: false,
            groupPanel: { visible: true },
            grouping: { autoExpandAll: false },
            export: { enabled: true, formats: ['xlsx', 'pdf'] },
            toolbar: { items: ['groupPanel', 'exportButton'] },
            onExporting: (e) => {
                exportGrid(e.component, e.format, headerMap);
                e.cancel = true;
            },
            summary: {
                groupItems: [
                    { column: 'morning', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'afternoon', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'night', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'other', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'total', summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` }
                ],
                totalItems: [
                    { column: 'morning', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'afternoon', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'night', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'other', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` },
                    { column: 'total', summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` }
                ]
            },
            columns: [
                { dataField: 'day', caption: 'Day', allowEditing: false },
                { dataField: 'month', caption: 'Month', allowEditing: false },
                { dataField: 'year', caption: 'Year', allowEditing: false },
                { dataField: 'ward', caption: 'Ward', allowEditing: false },
                { dataField: 'morning', caption: 'Morning', allowEditing: false },
                { dataField: 'afternoon', caption: 'Afternoon', allowEditing: false },
                { dataField: 'night', caption: 'Night', allowEditing: false },
                { dataField: 'other', caption: 'Other', allowEditing: false },
                { dataField: 'total', caption: 'Total', allowEditing: false }
            ],
            rowPrepared: (e) => {
                if (e.rowType === 'data' && e.data?.__isTotal) {
                    e.rowElement.addClass('summary-total');
                }
            }
        });

        return tableWrap;
    };

    const renderPayrollPositionSummaryGrid = (summary, filters, wardName, rateMap) => {
        const { from, to, shifts } = filters;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const start = new Date(from);
        const end = new Date(to);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const daysCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
        const shiftSet = new Set((shifts || []).map(normalizeShift).filter(Boolean));

        const positionCodes = positions.map(p => p.code).filter(Boolean);
        const rows = [];

        for (let i = 0; i < daysCount; i += 1) {
            const dayDate = new Date(start.getTime() + i * MS_PER_DAY);
            const row = {
                day: dayDate.getDate(),
                month: dayDate.getMonth() + 1,
                year: dayDate.getFullYear(),
                ward: wardName || '',
                total: 0
            };
            positionCodes.forEach(code => {
                row[code] = 0;
            });

            summary.rows.forEach(userRow => {
                const codes = Array.isArray(userRow.days[i]) ? userRow.days[i] : [];
                const items = codes
                    .map(c => String(c))
                    .filter(c => {
                        if (!shiftSet.size) return true;
                        const normalized = normalizeShift(c);
                        return shiftSet.has(normalized);
                    });
                if (!items.length) return;
                const posCode = userRow.position || '';
                let totalAmount = 0;
                items.forEach(code => {
                    totalAmount += getRate(rateMap, userRow.userId, code);
                });
                if (posCode && row[posCode] !== undefined) {
                    row[posCode] += totalAmount;
                }
                row.total += totalAmount;
            });

            rows.push(row);
        }

        const totalRow = {
            day: 'Total',
            month: '',
            year: '',
            ward: '',
            total: 0,
            __isTotal: true
        };
        positionCodes.forEach(code => {
            totalRow[code] = rows.reduce((sum, r) => sum + (Number(r[code]) || 0), 0);
            totalRow.total += totalRow[code];
        });
        rows.push(totalRow);

        const tableWrap = $('<div>', { class: 'summary-table-wrap' });
        const gridEl = $('<div>', { class: 'summary-grid' });
        tableWrap.append(gridEl);

        const columns = [
            { dataField: 'day', caption: 'Day', allowEditing: false },
            { dataField: 'month', caption: 'Month', allowEditing: false },
            { dataField: 'year', caption: 'Year', allowEditing: false },
            { dataField: 'ward', caption: 'Ward', allowEditing: false }
        ];
        positionCodes.forEach(code => {
            const name = positions.find(p => p.code === code)?.name || code;
            columns.push({ dataField: code, caption: name, allowEditing: false });
        });
        columns.push({ dataField: 'total', caption: 'Total', allowEditing: false });

        gridEl.dxDataGrid({
            dataSource: rows,
            keyExpr: 'day',
            showBorders: true,
            columnAutoWidth: true,
            paging: { enabled: false },
            sorting: { mode: 'none' },
            hoverStateEnabled: false,
            groupPanel: { visible: true },
            grouping: { autoExpandAll: false },
            export: { enabled: true, formats: ['xlsx', 'pdf'] },
            toolbar: { items: ['groupPanel', 'exportButton'] },
            onExporting: (e) => {
                exportGrid(e.component, e.format);
                e.cancel = true;
            },
            summary: {
                groupItems: columns
                    .filter(c => !['day', 'month', 'year', 'ward'].includes(c.dataField))
                    .map(c => ({ column: c.dataField, summaryType: 'sum', alignByColumn: true, customizeText: (e) => `${e.value ?? 0}` })),
                totalItems: columns
                    .filter(c => !['day', 'month', 'year', 'ward'].includes(c.dataField))
                    .map(c => ({ column: c.dataField, summaryType: 'sum', customizeText: (e) => `${e.value ?? 0}` }))
            },
            columns,
            rowPrepared: (e) => {
                if (e.rowType === 'data' && e.data?.__isTotal) {
                    e.rowElement.addClass('summary-total');
                }
            }
        });

        return tableWrap;
    };

    const generatePayrollSummary = async (data) => {
        const wardIds = data.wardIds || [];
        if (!wardIds.length) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }
        const wardId = wardIds[0];
        if (wardIds.length > 1) {
            DevExpress.ui.notify('Payroll Summary supports one ward at a time (using first selection).', 'info', 2000);
        }

        const from = new Date(data.from);
        const to = new Date(data.to);
        const res = await fetch(
            `${apiBase}/api/schedules/summary-range/${wardId}?from=${from.toISOString()}&to=${to.toISOString()}`,
            { headers: authHeaders() }
        );
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
            return;
        }
        const wardNames = wards
            .filter(w => wardIds.includes(w._id))
            .map(w => w.name)
            .join(', ');
        const userIds = (json.data?.rows || []).map(r => r.userId).filter(Boolean);
        const rateMap = await buildRateMap(userIds);

        resultEl.empty().append(
            $('<div>', { class: 'report-summary-title', text: 'Payroll Summary Report' }),
            $('<div>', {
                class: 'report-summary-meta',
                text: `Ward: ${wardNames || 'All'} | Date: ${fmt(from)} - ${fmt(to)} | Shifts: ${(data.shifts || []).join(', ') || 'All'}`
            }),
            renderPayrollSummaryGrid(json.data, { from, to, shifts: data.shifts }, wardNames, rateMap)
        );
    };

    const generatePayrollPositionSummary = async (data) => {
        const wardIds = data.wardIds || [];
        if (!wardIds.length) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }
        const wardId = wardIds[0];
        if (wardIds.length > 1) {
            DevExpress.ui.notify('Payroll Position Summary supports one ward at a time (using first selection).', 'info', 2000);
        }

        const from = new Date(data.from);
        const to = new Date(data.to);
        const res = await fetch(
            `${apiBase}/api/schedules/summary-range/${wardId}?from=${from.toISOString()}&to=${to.toISOString()}`,
            { headers: authHeaders() }
        );
        const json = await res.json();
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
            return;
        }
        const wardNames = wards
            .filter(w => wardIds.includes(w._id))
            .map(w => w.name)
            .join(', ');
        const userIds = (json.data?.rows || []).map(r => r.userId).filter(Boolean);
        const rateMap = await buildRateMap(userIds);

        resultEl.empty().append(
            $('<div>', { class: 'report-summary-title', text: 'Payroll by Position Report' }),
            $('<div>', {
                class: 'report-summary-meta',
                text: `Ward: ${wardNames || 'All'} | Date: ${fmt(from)} - ${fmt(to)} | Shifts: ${(data.shifts || []).join(', ') || 'All'}`
            }),
            renderPayrollPositionSummaryGrid(json.data, { from, to, shifts: data.shifts }, wardNames, rateMap)
        );
    };


    formEl.dxForm({
        formData,
        colCount: 5,
        items: [
            {
                dataField: 'reportType',
                label: { text: 'Report' },
                editorType: 'dxSelectBox',
                colSpan: 5,
                editorOptions: {
                    items: reportTypes,
                    displayExpr: (item) => item?.name || item?.code || '',
                    valueExpr: 'code',
                    width: '100%'
                }
            },
            {
                dataField: 'wardIds',
                label: { text: 'Ward' },
                editorType: 'dxTagBox',
                editorOptions: {
                    items: wards,
                    displayExpr: 'name',
                    valueExpr: '_id'
                }
            },
            {
                dataField: 'userId',
                label: { text: 'User' },
                editorType: 'dxSelectBox',
                editorOptions: {
                    items: users,
                    displayExpr: (u) => u ? `${u.employeeCode || ''} ${u.name || ''}`.trim() : '',
                    valueExpr: '_id',
                    placeholder: 'All'
                }
            },
            {
                dataField: 'from',
                label: { text: 'From' },
                editorType: 'dxDateBox',
                editorOptions: { displayFormat: 'dd/MM/yyyy' }
            },
            {
                dataField: 'to',
                label: { text: 'To' },
                editorType: 'dxDateBox',
                editorOptions: { displayFormat: 'dd/MM/yyyy' }
            },
            {
                dataField: 'shifts',
                label: { text: 'Shift' },
                editorType: 'dxTagBox',
                editorOptions: {
                    items: [
                        { code: 'M', name: 'เช้า' },
                        { code: 'A', name: 'บ่าย' },
                        { code: 'N', name: 'ดึก' }
                    ],
                    displayExpr: 'name',
                    valueExpr: 'code'
                }
            },
            {
                itemType: 'button',
                colSpan: 5,
                horizontalAlignment: 'left',
                buttonOptions: {
                    text: 'Generate',
                    type: 'default',
                    onClick: generateReport
                }
            }
        ]
    });
};
