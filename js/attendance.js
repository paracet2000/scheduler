/* global $, DevExpress, Common */
'use strict';

window.renderAttendanceSync = function renderAttendanceSync() {
    if (typeof window.showPage === 'function') {
        window.showPage('attendanceSync');
    }

    const container = $('#attendanceSync');
    container.empty();

    const wrap = $('<div>', { class: 'attendance-sync' });
    const uploadEl = $('<div>', { class: 'attendance-upload' });
    const actionsEl = $('<div>', { class: 'attendance-actions' });
    const filtersEl = $('<div>', { class: 'attendance-log-filters' });
    const logEl = $('<div>', { class: 'attendance-log', id: 'attendanceSyncLog' });
    wrap.append(uploadEl, actionsEl, filtersEl, logEl);
    container.append(wrap);

    let parsedRows = [];
    let mappedRows = [];
    let unmapped = [];

    const logs = [];
    const activeLevels = new Set(['info', 'success', 'warn', 'error']);

    const appendLog = (level, message) => {
        logs.push({ level, message, ts: new Date() });
        renderLog();
    };

    const renderLog = () => {
        const lines = logs
            .filter(l => activeLevels.has(l.level))
            .map(l => `<div class="attendance-log-line ${l.level}">[${l.ts.toLocaleTimeString()}] ${l.message}</div>`)
            .join('');
        logEl.html(lines || '<div class="attendance-log-line">No log yet.</div>');
    };

    const toSeconds = (time) => {
        const parts = String(time || '').trim().replace('.', ':').split(':').map(Number);
        if (parts.length < 2) return 0;
        const [h, m, s = 0] = parts;
        return (h * 3600) + (m * 60) + s;
    };

    const parseDate = (raw) => {
        const parts = String(raw || '').split('/');
        if (parts.length !== 3) return null;
        const [mm, dd, yy] = parts.map(p => p.padStart(2, '0'));
        const year = Number(yy) < 100 ? `20${yy}` : yy;
        return `${year}-${mm}-${dd}`;
    };

    const loadMappings = async () => {
        const res = await Common.fetchWithAuth('/api/code-mappings?status=ACTIVE');
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load code mappings');
        }
        const items = Array.isArray(json.data) ? json.data : [];
        const map = new Map();
        items.forEach(item => {
            const code = String(item.deviceEmpCode || '').trim();
            const userId = item.userId?._id || item.userId;
            if (!code || !userId) return;
            if (!map.has(code)) {
                map.set(code, userId);
            }
        });
        return map;
    };

    const parseCsvLines = (text) => {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        return lines.map(line => {
            const [empcode, date, time, machineNo] = line.split(',').map(v => v.trim());
            return { empcode, date, time, machineNo };
        }).filter(r => r.empcode && r.date && r.time);
    };

    const fileInput = $('<input type="file" accept=".csv,text/csv" />');
    const fileBtn = $('<button type="button" class="attendance-upload-btn">Select file</button>');
    const fileDrop = $('<div class="attendance-drop">or Drop a file here</div>');
    uploadEl.append(
        $('<label class="attendance-label">CSV File:</label>'),
        fileBtn,
        fileInput,
        fileDrop
    );

    fileBtn.on('click', () => fileInput.trigger('click'));

    const handleFile = async (file) => {
        if (!file) return;
        const text = await file.text();
        logEl.empty();
        logs.length = 0;
        parsedRows = parseCsvLines(text);
        mappedRows = [];
        unmapped = [];

        const mapping = await loadMappings();
        const grouped = new Map();

        parsedRows.forEach(r => {
            const date = parseDate(r.date);
            if (!date) return;
            const userId = mapping.get(r.empcode);
            if (!userId) {
                if (!unmapped.includes(r.empcode)) unmapped.push(r.empcode);
                return;
            }
            const key = `${userId}|${date}`;
            const current = grouped.get(key) || {
                userId,
                date,
                deviceEmpCode: r.empcode,
                actualIn: r.time,
                actualOut: r.time,
                punchCount: 0,
                singleTime: r.time
            };
            current.punchCount += 1;
            current.singleTime = r.time;
            if (toSeconds(r.time) < toSeconds(current.actualIn)) current.actualIn = r.time;
            if (toSeconds(r.time) > toSeconds(current.actualOut)) current.actualOut = r.time;
            grouped.set(key, current);
        });

        mappedRows = Array.from(grouped.values());
        appendLog('info', `Rows: ${parsedRows.length}`);
        appendLog('info', `Mapped (unique user/date): ${mappedRows.length}`);
        appendLog(unmapped.length ? 'warn' : 'info', `Unmapped codes: ${unmapped.length ? unmapped.join(', ') : '-'}`);
        const singlePunch = mappedRows.filter(r => r.punchCount === 1);
        if (singlePunch.length) {
            appendLog('warn', `Single punch rows: ${singlePunch.length}`);
        }
    };

    fileInput.on('change', (e) => handleFile(e.target.files?.[0]));

    fileDrop.on('dragover', (e) => {
        e.preventDefault();
        fileDrop.addClass('is-drag');
    });
    fileDrop.on('dragleave', () => fileDrop.removeClass('is-drag'));
    fileDrop.on('drop', (e) => {
        e.preventDefault();
        fileDrop.removeClass('is-drag');
        handleFile(e.originalEvent?.dataTransfer?.files?.[0]);
    });

    const syncBtn = $('<div id="attendanceSyncBtn"></div>');
    const downloadBtn = $('<div id="attendanceDownloadLog"></div>');
    actionsEl.append(syncBtn, downloadBtn);

    $('#attendanceSyncBtn').dxButton({
        text: 'Sync',
        type: 'success',
        onClick: async () => {
            if (!mappedRows.length) {
                DevExpress.ui.notify('Please select a CSV file first', 'warning', 2000);
                return;
            }
            try {
                const res = await Common.postWithAuth('/api/attendance/sync', {
                    body: JSON.stringify({ rows: mappedRows })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Sync failed');
                DevExpress.ui.notify('Attendance synced', 'success', 2000);
                appendLog('success', `Matched: ${json.data?.matched ?? 0}`);
                appendLog('success', `Modified: ${json.data?.modified ?? 0}`);
                appendLog('warn', `No Schedule: ${(json.data?.noSchedule || []).length}`);
                const noSchedule = Array.isArray(json.data?.noSchedule) ? json.data.noSchedule : [];
                if (noSchedule.length) {
                    noSchedule.slice(0, 20).forEach(item => {
                        appendLog('error', `No schedule for user ${item.userId} on ${item.date}`);
                    });
                }
            } catch (err) {
                DevExpress.ui.notify(err.message || 'Sync failed', 'error', 3000);
                appendLog('error', err.message || 'Sync failed');
            }
        }
    });

    $('#attendanceDownloadLog').dxButton({
        text: 'Download Log',
        type: 'default',
        onClick: () => {
            const content = logs.map(l => `[${l.ts.toISOString()}] [${l.level}] ${l.message}`).join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'attendance-sync-log.txt';
            a.click();
            URL.revokeObjectURL(url);
        }
    });

    ['info', 'success', 'warn', 'error'].forEach((lvl) => {
        const cb = $('<label class="attendance-log-filter"></label>');
        const input = $('<input type="checkbox" checked />');
        input.on('change', () => {
            if (input.is(':checked')) activeLevels.add(lvl);
            else activeLevels.delete(lvl);
            renderLog();
        });
        cb.append(input, $('<span>').text(lvl[0].toUpperCase() + lvl.slice(1)));
        filtersEl.append(cb);
    });

    renderLog();

    const mappingWrap = $('<div>', { class: 'attendance-mapping' });
    const mappingTitle = $('<div>', { class: 'attendance-mapping-title', text: 'Employee Code Mapping' });
    const mappingGrid = $('<div>', { id: 'attendanceCodeMappingGrid', class: 'dx-grid attendance-code-mapping-grid' });
    mappingWrap.append(mappingTitle, mappingGrid);
    wrap.append(mappingWrap);

    const renderMappingGrid = async () => {
        let meta = {};
        let items = [];

        try {
            const [metaRes, listRes] = await Promise.all([
                Common.fetchWithAuth('/api/code-mappings/meta'),
                Common.fetchWithAuth('/api/code-mappings')
            ]);
            const metaJson = await metaRes.json();
            const listJson = await listRes.json();
            if (!metaRes.ok) throw new Error(metaJson.message || 'Failed to load meta');
            if (!listRes.ok) throw new Error(listJson.message || 'Failed to load code mappings');
            meta = metaJson.data || {};
            items = Array.isArray(listJson.data) ? listJson.data : [];
        } catch (err) {
            mappingGrid.html(`<div class="settings-placeholder">${err.message || 'Unable to load code mappings.'}</div>`);
            return;
        }

        const users = Array.isArray(meta.users) ? meta.users : [];
        const mappingByUser = new Map(
            items.map(item => [String(item.userId?._id || item.userId), item])
        );

        const gridData = users.map(user => {
            const map = mappingByUser.get(String(user._id));
            return {
                _id: map?._id || null,
                userId: user._id,
                deviceEmpCode: map?.deviceEmpCode || '',
                status: map?.status || 'ACTIVE'
            };
        });

        mappingGrid.dxDataGrid({
            dataSource: gridData,
            keyExpr: 'userId',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'popup',
                allowUpdating: true,
                allowAdding: true,
                allowDeleting: false,
                useIcons: true
            },
            toolbar: {
                items: [
                    { location: 'after', name: 'addRowButton' }
                ]
            },
            columns: [
                {
                    dataField: 'userId',
                    caption: 'User',
                    lookup: {
                        dataSource: users,
                        valueExpr: '_id',
                        displayExpr: (item) => item ? `${item.employeeCode || ''} ${item.name || ''}`.trim() : ''
                    },
                    allowEditing: false
                },
                {
                    dataField: 'deviceEmpCode',
                    caption: 'Device Emp Code',
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'status',
                    caption: 'Status',
                    lookup: { dataSource: ['ACTIVE', 'INACTIVE'] }
                }
            ],
            onRowUpdating: async (e) => {
                const payload = { ...e.oldData, ...e.newData };
                const isUpdate = !!payload._id;
                const url = isUpdate ? `/api/code-mappings/${payload._id}` : '/api/code-mappings';
                const method = isUpdate ? 'PUT' : 'POST';

                const res = await Common.fetchWithAuth(url, {
                    method,
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || (isUpdate ? 'Update failed' : 'Create failed'), 'error', 3000);
                    return;
                }
                e.newData._id = json.data?._id || payload._id;
                DevExpress.ui.notify(isUpdate ? 'Updated' : 'Created', 'success', 2000);
            }
        });
    };

    renderMappingGrid();
};
