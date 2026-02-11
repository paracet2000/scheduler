// js/schedulesummary.js
// Schedule Summary (Head)
window.renderScheduleSummary = async function renderScheduleSummary(options = {}) {
    if (typeof window.showPage === 'function') {
        window.showPage('settingsSystem');
    }

    const isHead = Helper.checkRole('head');
    const isAdmin = Helper.checkRole('admin');
    const isFinance = Helper.checkRole('finance');

    $('#systemSettings').empty();

    const initialFilters = options.filters || {};

    const filters = $('<div>', { class: 'summary-filters' });
    const wardEl = $('<div>', { id: 'summaryWard' });
    const positionEl = $('<div>', { id: 'summaryPosition' });
    const monthNav = $('<div>', { class: 'schedule-month-nav' });
    const prevBtn = $('<button>', { class: 'schedule-nav-btn', text: '<' });
    const nextBtn = $('<button>', { class: 'schedule-nav-btn', text: '>' });
    const monthLabel = $('<div>', { class: 'schedule-month-label' });
    monthNav.append(prevBtn, monthLabel, nextBtn);
    const loadBtn = $('<div>', { id: 'summaryLoad' });
    const toggleBtn = $('<div>', { id: 'summaryToggle' });
    const exportBtn = $('<div>', { id: 'summaryExport' });
    const changeListWrap = $('<div>', { class: 'change-list-wrap' });
    const changeListBadge = $('<span>', { class: 'change-list-badge' }).hide();
    const changeListBtn = $('<div>', { id: 'summaryChangeList' });
    const tableWrap = $('<div>', { class: 'summary-table-wrap' });

    changeListWrap.append(changeListBtn, changeListBadge);
    filters.append(wardEl, positionEl, monthNav, loadBtn, toggleBtn, exportBtn, changeListWrap);
    $('#systemSettings').append(filters, tableWrap);

    let wards = [];
    let positions = [];
    let shiftMeta = new Map();
    let shiftRateMap = new Map();

    try {
        const [wardRes, posRes, shiftRes] = await Promise.all([
            Common.fetchWithAuth('/api/ward-members/mine'),
            Common.fetchWithAuth('/api/configuration?typ_code=POST'),
            Common.fetchWithAuth('/api/configuration?typ_code=SHIFT')
        ]);
        const wardJson = await wardRes.json();
        const posJson = await posRes.json();
        const shiftJson = await shiftRes.json();
        if (!wardRes.ok) throw new Error(wardJson.message || 'Failed to load wards');
        if (!posRes.ok) throw new Error(posJson.message || 'Failed to load positions');
        if (!shiftRes.ok) throw new Error(shiftJson.message || 'Failed to load shifts');
        wards = Array.isArray(wardJson.data) ? wardJson.data : [];
        positions = Array.isArray(posJson.data) ? posJson.data : [];
        positions = positions.map(p => ({
            code: p.code || p.conf_code || '',
            name: p.name || p.conf_description || p.conf_code || ''
        })).filter(p => p.code);

        const shifts = Array.isArray(shiftJson.data) ? shiftJson.data : [];
        const parseMeta = (s) => {
            if (!s) return {};
            const raw = String(s.conf_value || '').trim();
            if (!raw) return s.meta || {};
            try {
                return JSON.parse(raw);
            } catch {
                return { value: raw };
            }
        };
        shiftMeta = new Map(shifts.map(s => [String(s.code || s.conf_code || '').toUpperCase(), parseMeta(s)]).filter(([code]) => code));
        shiftRateMap = new Map(
            shifts.map(s => {
                const meta = parseMeta(s);
                return [
                    String(s.code || s.conf_code || '').toUpperCase(),
                    Number(meta?.rate ?? meta?.amount ?? meta?.price ?? 0)
                ];
            }).filter(([code]) => code)
        );
    } catch (err) {
        tableWrap.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load summary data.'
            })
        );
        return;
    }

    let wardInstance;
    let positionInstance;
    const now = new Date();
    let selectedDate = initialFilters.year && initialFilters.month
        ? new Date(initialFilters.year, initialFilters.month - 1, 1)
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const getMonthLabel = (date) => date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const updateMonthLabel = () => {
        monthLabel.text(getMonthLabel(selectedDate));
    };

    wardEl.dxSelectBox({
        items: wards,
        displayExpr: 'name',
        valueExpr: '_id',
        placeholder: 'Select ward',
        width: 220,
        value: initialFilters.wardId || (wards[0]?._id || null),
        onInitialized(e) { wardInstance = e.component; }
    });

    const positionItems = [{ code: 'ALL', name: '(All)' }, ...positions];
    positionEl.dxTagBox({
        items: positionItems,
        displayExpr: 'name',
        valueExpr: 'code',
        placeholder: 'Select positions',
        width: 260,
        value: Array.isArray(initialFilters.positions) ? initialFilters.positions : ['ALL'],
        onInitialized(e) { positionInstance = e.component; },
        onValueChanged(e) {
            const value = Array.isArray(e.value) ? e.value : [];
            if (value.includes('(All)') && value.length > 1) {
                const filtered = value.filter(v => v !== '(All)');
                e.component.option('value', filtered);
            }
        }
    });
    
    updateMonthLabel();

    prevBtn.on('click', () => {
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
        updateMonthLabel();
    });
    nextBtn.on('click', () => {
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
        updateMonthLabel();
    });

    let showMoney = false;
    const DEBUG_SUMMARY = true;
    let rateMap = new Map();

    const getBucket = (code) => {
        const upper = String(code || '').toUpperCase();
        const meta = shiftMeta.get(upper) || {};
        const raw = String(
            meta.bucket || meta.shift || meta.period || meta.group || meta.slot || ''
        ).toLowerCase();

        if (['m', 'morning', 'am', 'day'].includes(raw)) return 'morning';
        if (['a', 'afternoon', 'pm', 'evening'].includes(raw)) return 'afternoon';
        if (['n', 'night'].includes(raw)) return 'night';

        if (upper.startsWith('M')) return 'morning';
        if (upper.startsWith('A')) return 'afternoon';
        if (upper.startsWith('N')) return 'night';

        return 'other';
    };

    const normalizeCode = (code) => String(code || '').toUpperCase();
    const baseCode = (code) => normalizeCode(code).replace(/[^\p{L}\p{N}]/gu, '');
    const normalizeCodes = (codes) => {
        if (!Array.isArray(codes)) return [];
        const out = [];
        codes.forEach((c) => {
            if (c === null || c === undefined) return;
            const text = String(c).trim();
            if (!text) return;
            text.split(/[,\s]+/).forEach((part) => {
                const token = part.trim();
                if (token) out.push(token);
            });
        });
        return out;
    };

    const getRate = (userId, code) => {
        const raw = normalizeCode(code);
        const key = `${userId}|${raw}`;
        if (rateMap.has(key)) return rateMap.get(key) || 0;
        if (shiftRateMap.has(raw)) return shiftRateMap.get(raw) || 0;
        const base = baseCode(raw);
        const baseKey = `${userId}|${base}`;
        if (rateMap.has(baseKey)) return rateMap.get(baseKey) || 0;
        if (shiftRateMap.has(base)) return shiftRateMap.get(base) || 0;
        return 0;
    };

    const calcMoney = (row) => {
        let morning = 0;
        let afternoon = 0;
        let night = 0;
        let total = 0;
        row.days.forEach((codes) => {
            const items = normalizeCodes(codes);
            items.forEach(c => {
                const amount = getRate(row.userId, c);
                total += amount;
                const bucket = getBucket(c);
                if (bucket === 'morning') morning += amount;
                if (bucket === 'afternoon') afternoon += amount;
                if (bucket === 'night') night += amount;
            });
        });
        return { morning, afternoon, night, total };
    };

        const renderTable = (data, filters) => {
        tableWrap.empty();

        if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
            tableWrap.append(
                $('<div>', { class: 'settings-placeholder', text: 'No schedule data.' })
            );
            return;
        }

        const daysInMonth = data.daysInMonth || 30;
        const allPositions = positions.map(p => p.code).filter(Boolean);
        const table = $('<table>', { class: 'summary-table' });
        const thead = $('<thead>');
        const headRow = $('<tr>');

        headRow.append($('<th>', { class: 'sticky-col edit-col', text: '' }));
        headRow.append($('<th>', { class: 'sticky-col name-col', text: 'Name' }));
        for (let d = 1; d <= daysInMonth; d++) {
            headRow.append($('<th>', { class: 'day-col', text: d }));
        }
        headRow.append($('<th>', { class: 'total-col', text: showMoney ? 'เช้า (฿)' : 'เช้า' }));
        headRow.append($('<th>', { class: 'total-col', text: showMoney ? 'บ่าย (฿)' : 'บ่าย' }));
        headRow.append($('<th>', { class: 'total-col', text: showMoney ? 'ดึก (฿)' : 'ดึก' }));
        headRow.append($('<th>', { class: 'total-col', text: showMoney ? 'Total (฿)' : 'Total' }));

        thead.append(headRow);
        table.append(thead);

        const tbody = $('<tbody>');
        data.rows.forEach((row, rowIdx) => {
            const tr = $('<tr>');
            const displayName = row.employeeCode
                ? `${row.employeeCode} ${row.name}`.trim()
                : row.name;
            const avatarUrl = row.avatar
                ? (typeof window.resolveAvatarUrl === 'function' ? window.resolveAvatarUrl(row.avatar) : row.avatar)
                : '';
            const avatarBtn = $('<button>', { class: 'summary-avatar-btn', title: 'Edit' });
            const avatarEl = $('<div>', { class: 'summary-avatar' });
            if (avatarUrl) {
                avatarEl.css('background-image', `url('${avatarUrl}')`);
            } else {
                const initial = String(displayName || 'U').trim().charAt(0).toUpperCase();
                avatarEl.text(initial);
            }
            avatarBtn.append(avatarEl);
            avatarBtn.on('click', () => {
                if (typeof window.renderSchedule === 'function') {
                    window.renderSchedule({
                        userId: row.userId,
                        wardId: filters.wardId,
                        month: filters.month,
                        year: filters.year,
                        userName: displayName,
                        userAvatar: row.avatar || '',
                        lockWard: true,
                        lockMonth: true,
                        returnToSummary: true,
                        summaryFilters: {
                            wardId: filters.wardId,
                            positions: filters.positions,
                            month: filters.month,
                            year: filters.year
                        }
                    });
                }
            });
            tr.append($('<td>', { class: 'sticky-col edit-col' }).append(avatarBtn));
            tr.append($('<td>', { class: 'sticky-col name-col', text: displayName }));

            row.days.forEach((codes, idx) => {
                let text = '';
                const items = normalizeCodes(codes);
                if (DEBUG_SUMMARY && showMoney && rowIdx === 1 && idx < 3) {
                    console.log('[summary] day codes', { userId: row.userId, day: idx + 1, raw: codes, items });
                }
                if (items.length) {
                    if (showMoney) {
                        const rates = items.map(c => getRate(row.userId, c));
                        if (DEBUG_SUMMARY && rowIdx === 1 && idx < 3) {
                            console.log('[summary] day rates', { userId: row.userId, day: idx + 1, items, rates });
                        }
                        text = rates.join('+');
                    } else {
                        text = items.join(' ');
                    }
                }
                const changeStatus = Array.isArray(row.dayChange) ? row.dayChange[idx] : '';
                const pendingClass = changeStatus === 'OPEN'
                    ? ' summary-cell-pending'
                    : changeStatus === 'ACCEPTED'
                        ? ' summary-cell-accepted'
                        : changeStatus === 'APPROVED'
                            ? ' summary-cell-approved'
                            : changeStatus === 'REJECTED'
                                ? ' summary-cell-rejected'
                                : '';
                const cell = $('<td>', { class: `day-col${pendingClass}`, text });
                tr.append(cell);
            });

            if (showMoney) {
                const money = calcMoney(row);
                tr.append($('<td>', { class: 'total-col', text: money.morning || 0 }));
                tr.append($('<td>', { class: 'total-col', text: money.afternoon || 0 }));
                tr.append($('<td>', { class: 'total-col', text: money.night || 0 }));
                tr.append($('<td>', { class: 'total-col', text: money.total || 0 }));
            } else {
                tr.append($('<td>', { class: 'total-col', text: row.totals?.morning || 0 }));
                tr.append($('<td>', { class: 'total-col', text: row.totals?.afternoon || 0 }));
                tr.append($('<td>', { class: 'total-col', text: row.totals?.night || 0 }));
                tr.append($('<td>', { class: 'total-col', text: row.totals?.total || 0 }));
            }

            tbody.append(tr);
        });

        const selectedPositions = (positionInstance ? positionInstance.option('value') : [])
            .filter(p => p && p !== '(All)');
        const positionList = selectedPositions.length ? selectedPositions : allPositions;

        const buildPositionSummary = (rows, positionsToShow) => {
            const result = [];
            positionsToShow.forEach(pos => {
                const dayCounts = Array.from({ length: daysInMonth }, () => 0);
                let total = 0;
                let morning = 0;
                let afternoon = 0;
                let night = 0;
                let moneyMorning = 0;
                let moneyAfternoon = 0;
                let moneyNight = 0;
                let moneyTotal = 0;
                rows.filter(r => r.position === pos).forEach(r => {
                    r.days.forEach((codes, idx) => {
                        const items = normalizeCodes(codes);
                        if (items.length) {
                            dayCounts[idx] += 1;
                            total += items.length;
                            items.forEach(c => {
                                const bucket = getBucket(c);
                                if (bucket === 'morning') morning += 1;
                                if (bucket === 'afternoon') afternoon += 1;
                                if (bucket === 'night') night += 1;
                                const amount = getRate(r.userId, c);
                                moneyTotal += amount;
                                if (bucket === 'morning') moneyMorning += amount;
                                if (bucket === 'afternoon') moneyAfternoon += amount;
                                if (bucket === 'night') moneyNight += amount;
                            });
                        }
                    });
                });
                result.push({
                    label: pos,
                    dayCounts,
                    total,
                    morning,
                    afternoon,
                    night,
                    money: { morning: moneyMorning, afternoon: moneyAfternoon, night: moneyNight, total: moneyTotal }
                });
            });

            const totalDayCounts = Array.from({ length: daysInMonth }, () => 0);
            let totalAll = 0;
            let totalMorning = 0;
            let totalAfternoon = 0;
            let totalNight = 0;
            let totalMoneyMorning = 0;
            let totalMoneyAfternoon = 0;
            let totalMoneyNight = 0;
            let totalMoney = 0;
            rows.forEach(r => {
                r.days.forEach((codes, idx) => {
                    const items = normalizeCodes(codes);
                    if (items.length) {
                        totalDayCounts[idx] += 1;
                        totalAll += items.length;
                        items.forEach(c => {
                            const bucket = getBucket(c);
                            if (bucket === 'morning') totalMorning += 1;
                            if (bucket === 'afternoon') totalAfternoon += 1;
                            if (bucket === 'night') totalNight += 1;
                            const amount = getRate(r.userId, c);
                            totalMoney += amount;
                            if (bucket === 'morning') totalMoneyMorning += amount;
                            if (bucket === 'afternoon') totalMoneyAfternoon += amount;
                            if (bucket === 'night') totalMoneyNight += amount;
                        });
                    }
                });
            });
            result.push({
                label: 'TOTAL',
                dayCounts: totalDayCounts,
                total: totalAll,
                morning: totalMorning,
                afternoon: totalAfternoon,
                night: totalNight,
                money: {
                    morning: totalMoneyMorning,
                    afternoon: totalMoneyAfternoon,
                    night: totalMoneyNight,
                    total: totalMoney
                },
                isTotal: true
            });
            return result;
        };

        const positionSummary = buildPositionSummary(data.rows, positionList);
        positionSummary.forEach(summary => {
            const tr = $('<tr>', { class: `summary-row${summary.isTotal ? ' summary-total' : ''}` });
            tr.append($('<td>', { class: 'sticky-col edit-col', text: '' }));
            tr.append($('<td>', { class: 'sticky-col name-col', text: summary.label }));
            summary.dayCounts.forEach(count => {
                tr.append($('<td>', { class: 'day-col summary-cell', text: count || '' }));
            });
            if (showMoney) {
                const money = summary.money || { morning: 0, afternoon: 0, night: 0, total: 0 };
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: money.morning || 0 }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: money.afternoon || 0 }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: money.night || 0 }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: money.total || 0 }));
            } else {
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: summary.morning || 0 }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: summary.afternoon || 0 }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: summary.night || 0 }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: summary.total || 0 }));
            }
            tbody.append(tr);
        });

        table.append(tbody);
        tableWrap.append(table);
    };

    let lastSummaryData = null;
    let lastSummaryFilters = null;

    const loadSummary = async () => {
        const wardId = wardInstance ? wardInstance.option('value') : null;
        if (!wardId) {
            DevExpress.ui.notify('Please select a ward', 'warning', 2000);
            return;
        }
        const monthVal = selectedDate.getMonth() + 1;
        const yearVal = selectedDate.getFullYear();
        const posVal = positionInstance ? positionInstance.option('value') : [];
        const normalizedPos = Array.isArray(posVal) ? posVal.filter(v => v && v !== '(All)') : [];
        const posQuery = normalizedPos.length ? `&positions=${normalizedPos.join(',')}` : '';

        const res = await Common.fetchWithAuth(
            `/api/schedules/summary/${wardId}?month=${monthVal}&year=${yearVal}${posQuery}`
        );
        const json = await res.json();
        if (DEBUG_SUMMARY) console.log('[summary] data', json);
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Load failed', 'error', 3000);
            return;
        }
        const userIds = (json.data?.rows || []).map(r => r.userId).filter(Boolean);
        if (userIds.length) {
            if (DEBUG_SUMMARY) console.log('[summary] rateMap query userIds', userIds);
            const rateRes = await Common.fetchWithAuth(`/api/user-shift-rates?userIds=${userIds.join(',')}`);
            const rateJson = await rateRes.json();
            if (rateRes.ok) {
                const rates = Array.isArray(rateJson.data) ? rateJson.data : [];
                rateMap = new Map(rates.map(r => [`${r.userId?._id || r.userId}|${String(r.shiftCode).toUpperCase()}`, r.amount || 0]));
                if (DEBUG_SUMMARY) {
                    console.log('[summary] rateMap size', rateMap.size);
                    console.log('[summary] rateMap sample', rates.slice(0, 5));
                    const sampleUser = userIds[0];
                    console.log('[summary] rateMap has sample user ช', rateMap.has(`${sampleUser}|ช`));
                    console.log('[summary] rateMap has sample user A', rateMap.has(`${sampleUser}|A`));
                    console.log('[summary] rateMap keys sample', Array.from(rateMap.keys()).slice(0, 5));
                }
            } else if (DEBUG_SUMMARY) {
                console.log('[summary] rateMap fetch failed', rateRes.status, rateJson);
            }
        }
        lastSummaryData = json.data;
        lastSummaryFilters = {
            wardId,
            positions: normalizedPos,
            month: monthVal,
            year: yearVal
        };
        renderTable(json.data, lastSummaryFilters);
    };

    loadBtn.dxButton({
        text: 'Load',
        type: 'default',
        onClick: async () => {
            await loadSummary();
        }
    });

    toggleBtn.dxButton({
        text: 'Switch',
        type: 'normal',
        visible: isFinance,
        onClick: () => {
            showMoney = !showMoney;
            if (lastSummaryData) renderTable(lastSummaryData, lastSummaryFilters);
        }
    });

    const formatDateTime = (date) => {
        const d = date instanceof Date ? date : new Date(date);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const formatDateShort = (date) => {
        const d = date instanceof Date ? date : new Date(date);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dd = String(d.getDate()).padStart(2, '0');
        const mmm = months[d.getMonth()];
        return `${dd}/${mmm}/${d.getFullYear()}`;
    };

    const buildPrintHtml = () => {
        const table = tableWrap.find('table').prop('outerHTML');
        const wardId = wardInstance ? wardInstance.option('value') : null;
        const wardName = wardId
            ? (wards.find(w => w._id === wardId)?.conf_description
                || wards.find(w => w._id === wardId)?.name
                || '')
            : '';
        const monthLabelText = monthLabel.text() || '';
        const docCode = `frm${String(wardName || 'schedule').replace(/\s+/g, '').toLowerCase()}`;
        const docDate = formatDateShort(new Date());
        const printDate = formatDateTime(new Date());
        return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Schedule Summary</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", Arial, sans-serif; padding: 16px; color: #111827; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; text-align: center; }
      th { background: #eef2ff; font-weight: 600; }
      .name-col { text-align: left; }
      .summary-row td { background: #f1f5f9; font-weight: 600; }
      .summary-total td { background: #e2e8f0; font-weight: 700; }
      .summary-total-dark { background: #cbd5f5 !important; }
      .summary-cell-pending { background: #ffe6cc; }
      .summary-cell-accepted { background: #dbeafe; }
      .summary-cell-approved { background: #dcfce7; }
      .summary-cell-rejected { background: #e5e7eb; }
      .edit-col { display: none; }
      .print-header { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
      .print-title { grid-column: 1 / -1; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
      .print-meta { font-size: 12px; }
      .print-footer { margin-top: 10px; font-size: 10px; color: #6b7280; text-align: right; }
    </style>
  </head>
  <body>
    <div class="print-header">
      <div class="print-title">ตารางการทำงาน</div>
      <div class="print-meta">หน่วยงาน: ${wardName || '-'}</div>
      <div class="print-meta">ประจำเดือน: ${monthLabelText || '-'}</div>
      <div class="print-meta">รหัสเอกสาร: ${docCode}</div>
      <div class="print-meta">วันที่เอกสาร: ${docDate}</div>
    </div>
    ${table || '<div>No data</div>'}
    <div class="print-footer">printdate: ${printDate}</div>
  </body>
</html>`;
    };

    exportBtn.dxButton({
        text: 'Export PDF',
        type: 'default',
        onClick: () => {
            const table = tableWrap.find('table');
            if (!table.length) {
                DevExpress.ui.notify('Please load summary first', 'warning', 2000);
                return;
            }
            const win = window.open('', '_blank');
            if (!win) {
                DevExpress.ui.notify('Popup blocked. Please allow popups.', 'warning', 3000);
                return;
            }
            win.document.open();
            win.document.write(buildPrintHtml());
            win.document.close();
            win.focus();
            setTimeout(() => {
                win.print();
                win.close();
            }, 300);
        }
    });

    const updateChangeBadge = async () => {
        const wardId = wardInstance ? wardInstance.option('value') : null;
        const wardQuery = wardId ? `&wardId=${wardId}` : '';
        const res = await Common.fetchWithAuth(`/api/changes?status=OPEN${wardQuery}`);
        const json = await res.json();
        if (!res.ok) return;
        const list = Array.isArray(json.data) ? json.data : [];
        if (list.length) {
            changeListBadge.text(list.length).show();
        } else {
            changeListBadge.hide();
        }
    };

    changeListBtn.dxButton({
        text: 'Change List',
        type: 'normal',
        onClick: async () => {
            const wardId = wardInstance ? wardInstance.option('value') : null;
            if (!wardId) {
                DevExpress.ui.notify('Please select a ward', 'warning', 2000);
                return;
            }

            const res = await Common.fetchWithAuth(`/api/changes?status=OPEN&wardId=${wardId}`);
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Load change list failed', 'error', 3000);
                return;
            }

            const list = Array.isArray(json.data) ? json.data : [];

            const popupEl = $('<div>').appendTo('body');
            const popup = popupEl.dxPopup({
                title: 'Change Requests (Pending)',
                width: '80%',
                height: 520,
                showCloseButton: true,
                visible: true,
                contentTemplate: (contentEl) => {
                    const gridEl = $('<div>', { id: 'changeRequestGrid', class: 'dx-grid change-request-grid' }).appendTo(contentEl);
                    gridEl.dxDataGrid({
                        dataSource: list,
                        keyExpr: '_id',
                        showBorders: true,
                        columnAutoWidth: true,
                        columns: [
                            { dataField: 'type', caption: 'Type' },
                            { dataField: 'status', caption: 'Status' },
                            {
                                dataField: 'requestedBy.name',
                                caption: 'Requested By',
                                calculateCellValue: (row) => row.requestedBy?.name || ''
                            },
                            {
                                dataField: 'acceptedBy.name',
                                caption: 'Accepted By',
                                calculateCellValue: (row) => row.acceptedBy?.name || ''
                            },
                            {
                                dataField: 'affectedSchedules',
                                caption: 'Schedules',
                                calculateCellValue: (row) => Array.isArray(row.affectedSchedules) ? row.affectedSchedules.length : 0
                            },
                            {
                                caption: 'Actions',
                                width: 180,
                                cellTemplate: (container, options) => {
                                    const approveBtn = $('<button>', { class: 'dx-button dx-button-mode-contained dx-button-success', text: 'Approve' });
                                    const rejectBtn = $('<button>', { class: 'dx-button dx-button-mode-contained dx-button-danger', text: 'Reject' });

                                    approveBtn.on('click', async () => {
                                        const res = await Common.patchWithAuth(`/api/changes/${options.data._id}/approve`);
                                        const json = await res.json();
                                        if (!res.ok) {
                                            DevExpress.ui.notify(json.message || 'Approve failed', 'error', 3000);
                                            return;
                                        }
                                        DevExpress.ui.notify('Approved', 'success', 2000);
                                        popup.hide();
                                        await loadSummary();
                                        await updateChangeBadge();
                                    });

                                    rejectBtn.on('click', async () => {
                                        const res = await Common.patchWithAuth(`/api/changes/${options.data._id}/reject`, {
                                            body: JSON.stringify({ reason: 'Rejected by head' })
                                        });
                                        const json = await res.json();
                                        if (!res.ok) {
                                            DevExpress.ui.notify(json.message || 'Reject failed', 'error', 3000);
                                            return;
                                        }
                                        DevExpress.ui.notify('Rejected', 'success', 2000);
                                        popup.hide();
                                        await loadSummary();
                                        await updateChangeBadge();
                                    });

                                    container.append(approveBtn, rejectBtn);
                                }
                            }
                        ]
                    });
                }
            }).dxPopup('instance');
        }
    });

    await updateChangeBadge();

    if (options.autoLoad) {
        await loadSummary();
    }
};
