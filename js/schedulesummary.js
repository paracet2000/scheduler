// js/schedulesummary.js
// Schedule Summary (Head)
window.renderScheduleSummary = async function renderScheduleSummary(options = {}) {
    if (typeof window.showPage === 'function') {
        window.showPage('settingsSystem');
    }

    const token = typeof Common?.getToken === 'function' ? Common.getToken() : localStorage.getItem('auth_token');
    if (token && !Common.getMenuAccess('menuScheduleSummary') && typeof Common.loadMenuAuthorization === 'function') {
        await Common.loadMenuAuthorization(token);
    }
    const summaryMenuAccess = Common.getMenuAccess('menuScheduleSummary') || Common.getMenuAccess('27menuScheduleSummary') || {};
    const canSwapByExport = Number(summaryMenuAccess.acc_export) === 1;

    const $summaryRoot = $('#settingsSystem');
    $summaryRoot.empty();

    const initialFilters = options.filters || {};

    const headerWrap = $('<div>', { class: 'summary-header-card' });
    const filterRowMain = $('<div>', { class: 'summary-filter-row summary-filter-row-main' });
    const filterRowActions = $('<div>', { class: 'summary-filter-row summary-filter-row-actions' });
    const detailWrap = $('<div>', { class: 'summary-detail-card' });

    const wardEl = $('<div>', { id: 'summaryWard' });
    const positionEl = $('<div>', { id: 'summaryPosition' });
    const rangeWrap = $('<div>', { class: 'summary-range-wrap' });
    const rangeFromEl = $('<div>', { id: 'summaryRangeFrom' });
    const rangeToEl = $('<div>', { id: 'summaryRangeTo' });
    rangeWrap.append(rangeFromEl, rangeToEl);
    const loadBtn = $('<div>', { id: 'summaryLoad' });
    const toggleBtn = $('<div>', { id: 'summaryToggle' });
    const exportBtn = $('<div>', { id: 'summaryExport' });
    const changeListWrap = $('<div>', { class: 'change-list-wrap' });
    const changeListBadge = $('<span>', { class: 'change-list-badge' }).hide();
    const changeListBtn = $('<div>', { id: 'summaryChangeList' });
    const tableWrap = $('<div>', { class: 'summary-table-wrap' });

    changeListWrap.append(changeListBtn, changeListBadge);
    filterRowMain.append(wardEl, positionEl, rangeWrap);
    filterRowActions.append(loadBtn, toggleBtn, exportBtn, changeListWrap);
    headerWrap.append(filterRowMain, filterRowActions);
    detailWrap.append(tableWrap);
    $summaryRoot.append(headerWrap, detailWrap);

    let wards = [];
    let positions = [];
    let shiftMeta = new Map();
    let shiftRateMap = new Map();

    try {
        const fetchJson = async (url, label) => {
            const res = await Common.fetchWithAuth(url);
            let json = null;
            try {
                json = await res.json();
            } catch {
                throw new Error(`${label}: invalid JSON response`);
            }
            if (!res.ok) {
                throw new Error(`${label}: ${json?.message || `HTTP ${res.status}`}`);
            }
            return json;
        };

        const wardJson = await fetchJson('/api/ward-members/mine', 'Load wards failed');
        wards = Array.isArray(wardJson.data) ? wardJson.data : [];

        // Soft-fail for positions/shifts so page still renders in production with partial data.
        let posJson = { data: [] };
        let shiftJson = { data: [] };
        try {
            posJson = await fetchJson('/api/configuration?typ_code=POST', 'Load positions failed');
        } catch (err) {
            console.warn('[summary] positions fallback:', err?.message || err);
        }
        try {
            shiftJson = await fetchJson('/api/configuration?typ_code=SHIFT', 'Load shifts failed');
        } catch (err) {
            console.warn('[summary] shifts fallback:', err?.message || err);
        }

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
        DevExpress.ui.notify(err.message || 'Unable to load summary data.', 'error', 3500);
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
    let fromInstance;
    let toInstance;
    const now = new Date();
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
    const minDate = new Date(maxDate);
    minDate.setFullYear(minDate.getFullYear() - 1);
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let selectedFromDate = initialFilters.from ? new Date(initialFilters.from) : defaultFrom;
    let selectedToDate = initialFilters.to ? new Date(initialFilters.to) : defaultTo;

    if (Number.isNaN(selectedFromDate.getTime())) selectedFromDate = defaultFrom;
    if (Number.isNaN(selectedToDate.getTime())) selectedToDate = defaultTo;

    const normalizeRange = () => {
        selectedFromDate.setHours(0, 0, 0, 0);
        selectedToDate.setHours(0, 0, 0, 0);
        if (selectedFromDate < minDate) selectedFromDate = new Date(minDate);
        if (selectedFromDate > maxDate) selectedFromDate = new Date(maxDate);
        if (selectedToDate < minDate) selectedToDate = new Date(minDate);
        if (selectedToDate > maxDate) selectedToDate = new Date(maxDate);
        if (selectedToDate < selectedFromDate) {
            selectedToDate = new Date(selectedFromDate);
            if (toInstance) toInstance.option('value', selectedToDate);
        }
        if (fromInstance) fromInstance.option('value', selectedFromDate);
        if (toInstance) toInstance.option('value', selectedToDate);
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
            if (value.includes('ALL') && value.length > 1) {
                const filtered = value.filter(v => v !== 'ALL');
                e.component.option('value', filtered);
            }
        }
    });

    rangeFromEl.dxDateBox({
        value: selectedFromDate,
        type: 'date',
        displayFormat: 'dd/MM/yyyy',
        min: minDate,
        max: maxDate,
        label: 'From',
        labelMode: 'floating',
        width: 150,
        onInitialized(e) { fromInstance = e.component; },
        onValueChanged(e) {
            const next = e.value ? new Date(e.value) : selectedFromDate;
            if (Number.isNaN(next.getTime())) return;
            selectedFromDate = next;
            normalizeRange();
        }
    });

    rangeToEl.dxDateBox({
        value: selectedToDate,
        type: 'date',
        displayFormat: 'dd/MM/yyyy',
        min: minDate,
        max: maxDate,
        label: 'To',
        labelMode: 'floating',
        width: 150,
        onInitialized(e) { toInstance = e.component; },
        onValueChanged(e) {
            const next = e.value ? new Date(e.value) : selectedToDate;
            if (Number.isNaN(next.getTime())) return;
            selectedToDate = next;
            normalizeRange();
        }
    });
    normalizeRange();

    let showMoney = false;
    const DEBUG_SUMMARY = true;
    let rateMap = new Map();
    const defaultFinanceRateMap = new Map([
        ['ช', 700],
        ['บ', 800],
        ['ด', 100]
    ]);

    const getBucket = (code) => {
        const upper = String(code || '').toUpperCase();
        const rawCode = String(code || '').trim();
        if (rawCode.startsWith('ช')) return 'morning';
        if (rawCode.startsWith('บ')) return 'afternoon';
        if (rawCode.startsWith('ด')) return 'night';
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
    const canonicalShiftCode = (code) => {
        const raw = String(code || '').trim();
        const upper = raw.toUpperCase();
        if (!raw) return '';
        if (raw.startsWith('ช') || upper === 'M' || upper === 'CH' || upper.startsWith('MORNING')) return 'ช';
        if (raw.startsWith('บ') || upper === 'A' || upper.startsWith('AFTERNOON') || upper === 'PM') return 'บ';
        if (raw.startsWith('ด') || upper === 'N' || upper.startsWith('NIGHT')) return 'ด';
        return '';
    };
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
        const canonical = canonicalShiftCode(code);
        if (canonical) {
            const canonicalKey = `${userId}|${canonical}`;
            if (rateMap.has(canonicalKey)) return rateMap.get(canonicalKey) || 0;
            if (shiftRateMap.has(canonical)) return shiftRateMap.get(canonical) || 0;
            if (defaultFinanceRateMap.has(canonical)) return defaultFinanceRateMap.get(canonical) || 0;
        }
        return 0;
    };

    const formatMoney = (value) => {
        const num = Number(value || 0);
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
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

        const dates = Array.isArray(data.dates) ? data.dates : [];
        const daysInMonth = dates.length || data.daysInMonth || 30;
        const allPositions = positions.map(p => p.code).filter(Boolean);
        const table = $('<table>', { class: 'summary-table' });
        const thead = $('<thead>');
        const monthRow = $('<tr>');
        const dayRow = $('<tr>');

        monthRow.append($('<th>', { class: 'sticky-col edit-col', text: '', rowspan: 2 }));
        monthRow.append($('<th>', { class: 'sticky-col name-col', text: 'Name', rowspan: 2 }));

        const monthKey = (iso, idx) => {
            if (!iso) return `NA-${idx}`;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return `NA-${idx}`;
            return `${d.getFullYear()}-${d.getMonth()}`;
        };
        const monthLabel = (iso) => {
            if (!iso) return '-';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '-';
            const mmm = d.toLocaleString('en-US', { month: 'short' });
            return `${mmm}/${d.getFullYear()}`;
        };
        const dayLabel = (iso, idx) => {
            if (!iso) return String(idx + 1);
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(idx + 1);
            return String(d.getDate()).padStart(2, '0');
        };

        if (daysInMonth > 0) {
            let start = 0;
            while (start < daysInMonth) {
                const key = monthKey(dates[start], start);
                let end = start + 1;
                while (end < daysInMonth && monthKey(dates[end], end) === key) {
                    end += 1;
                }
                monthRow.append($('<th>', {
                    class: 'day-col',
                    text: monthLabel(dates[start]),
                    colspan: end - start
                }));
                for (let i = start; i < end; i += 1) {
                    dayRow.append($('<th>', { class: 'day-col', text: dayLabel(dates[i], i) }));
                }
                start = end;
            }
        }

        monthRow.append($('<th>', { class: 'total-col', text: showMoney ? 'เช้า (฿)' : 'เช้า', rowspan: 2 }));
        monthRow.append($('<th>', { class: 'total-col', text: showMoney ? 'บ่าย (฿)' : 'บ่าย', rowspan: 2 }));
        monthRow.append($('<th>', { class: 'total-col', text: showMoney ? 'ดึก (฿)' : 'ดึก', rowspan: 2 }));
        monthRow.append($('<th>', { class: 'total-col', text: showMoney ? 'Total (฿)' : 'Total', rowspan: 2 }));

        thead.append(monthRow, dayRow);
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
                        lockMonth: !!filters.month,
                        returnToSummary: true,
                        summaryFilters: {
                            wardId: filters.wardId,
                            positions: filters.positions,
                            month: filters.month,
                            year: filters.year,
                            from: filters.from,
                            to: filters.to
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
                        text = rates.map(formatMoney).join('+');
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
                tr.append($('<td>', { class: 'total-col', text: formatMoney(money.morning) }));
                tr.append($('<td>', { class: 'total-col', text: formatMoney(money.afternoon) }));
                tr.append($('<td>', { class: 'total-col', text: formatMoney(money.night) }));
                tr.append($('<td>', { class: 'total-col', text: formatMoney(money.total) }));
            } else {
                tr.append($('<td>', { class: 'total-col', text: row.totals?.morning || 0 }));
                tr.append($('<td>', { class: 'total-col', text: row.totals?.afternoon || 0 }));
                tr.append($('<td>', { class: 'total-col', text: row.totals?.night || 0 }));
                tr.append($('<td>', { class: 'total-col', text: row.totals?.total || 0 }));
            }

            tbody.append(tr);
        });

        const selectedPositions = (positionInstance ? positionInstance.option('value') : [])
            .filter(p => p && p !== 'ALL');
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
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: formatMoney(money.morning) }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: formatMoney(money.afternoon) }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: formatMoney(money.night) }));
                tr.append($('<td>', { class: 'total-col summary-total-dark', text: formatMoney(money.total) }));
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
        normalizeRange();
        const fromDate = new Date(selectedFromDate);
        const toDate = new Date(selectedToDate);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        const posVal = positionInstance ? positionInstance.option('value') : [];
        const normalizedPos = Array.isArray(posVal) ? posVal.filter(v => v && v !== 'ALL') : [];
        const posQuery = normalizedPos.length ? `&positions=${normalizedPos.join(',')}` : '';

        const res = await Common.fetchWithAuth(
            `/api/schedules/summary-range/${wardId}?from=${encodeURIComponent(fromDate.toISOString())}&to=${encodeURIComponent(toDate.toISOString())}${posQuery}`
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
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            month: fromDate.getMonth() + 1,
            year: fromDate.getFullYear()
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
        text: 'เงิน',
        type: 'normal',
        visible: canSwapByExport,
        hint: 'สลับแสดงรหัสเวรและจำนวนเงิน (ช/บ/ด = 700/800/100 เมื่อไม่มีเรตเฉพาะ)',
        onClick: () => {
            showMoney = !showMoney;
            const toggleInstance = toggleBtn.dxButton('instance');
            if (toggleInstance) {
                toggleInstance.option('text', showMoney ? 'เวร' : 'เงิน');
            }
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
        const rangeText = `${formatDateShort(selectedFromDate)} - ${formatDateShort(selectedToDate)}`;
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
      <div class="print-meta">ช่วงวันที่: ${rangeText || '-'}</div>
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
