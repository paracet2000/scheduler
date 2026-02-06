// js/master.js
// Master/System Settings UI
window.renderSystemSettings = async function renderSystemSettings() {
    if (typeof window.showPage === 'function') {
        window.showPage('settingsSystem');
    }

    const roles = typeof window.getStoredRoles === 'function' ? window.getStoredRoles() : [];
    const isAdmin = roles.includes('admin');
    const isHead = roles.includes('head');
    const isHr = roles.includes('hr');
    const canManageSystem = isAdmin || isHead || isHr;

    $('#systemSettings').empty();

    if (!canManageSystem) {
        $('#systemSettings').append(
            $('<div>', {
                class: 'settings-placeholder',
                text: 'System settings are available for admin/head users only.'
            })
        );
        return;
    }

    const systemWrap = $('<div>', { class: 'system-settings' });
    const systemMenu = $('<div>', { class: 'system-settings-menu' });
    const systemContent = $('<div>', { class: 'system-settings-content' });

    const token = localStorage.getItem('auth_token');

    const cacheKey = 'master_types_cache';
    const cacheTsKey = 'master_types_cache_ts';
    const cacheTtlMs = 10 * 60 * 1000; // 10 minutes

    let items = [];
    try {
        const cached = localStorage.getItem(cacheKey);
        const cachedTs = Number(localStorage.getItem(cacheTsKey) || 0);
        const cacheValid = cached && (Date.now() - cachedTs) < cacheTtlMs;

        if (cacheValid) {
            items = JSON.parse(cached);
        } else {
            const apiBase = window.BASE_URL || 'http://localhost:3000';
            const res = await fetch(`${apiBase}/api/master-types`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load master types');
            }
            items = Array.isArray(json.data) ? json.data : [];
            localStorage.setItem(cacheKey, JSON.stringify(items));
            localStorage.setItem(cacheTsKey, String(Date.now()));
        }
    } catch (err) {
        systemContent.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load master types.'
            })
        );
    }

    const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

    const renderSchedulerHeadSection = async () => {
        systemContent.empty();

        const apiBase = window.BASE_URL || 'http://localhost:3000';
        let wards = [];
        let heads = [];

        try {
            const [wardRes, headRes] = await Promise.all([
                fetch(`${apiBase}/api/masters/WARD`, { headers: authHeaders() }),
                fetch(`${apiBase}/api/scheduler-heads`, { headers: authHeaders() })
            ]);

            const wardJson = await wardRes.json();
            const headJson = await headRes.json();

            if (!wardRes.ok) throw new Error(wardJson.message || 'Failed to load wards');
            if (!headRes.ok) throw new Error(headJson.message || 'Failed to load scheduler heads');

            wards = Array.isArray(wardJson.data) ? wardJson.data : [];
            heads = Array.isArray(headJson.data) ? headJson.data : [];
        } catch (err) {
            systemContent.append(
                $('<div>', {
                    class: 'settings-placeholder',
                    text: err.message || 'Unable to load scheduler heads.'
                })
            );
            return;
        }

        const wardLookup = wards.map(w => ({
            _id: w._id,
            name: w.name,
            code: w.code
        }));

        const normalizedHeads = heads.map(h => ({
            ...h,
            wardId: h.wardId?._id || h.wardId
        }));

        const gridEl = $('<div>', { id: 'schedulerHeadGrid' });
        systemContent.append(gridEl);

        const grid = gridEl.dxDataGrid({
            dataSource: normalizedHeads,
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'row',
                allowAdding: true,
                allowUpdating: false,
                allowDeleting: false
            },
            columns: [
                {
                    dataField: 'wardId',
                    caption: 'Ward',
                    lookup: {
                        dataSource: wardLookup,
                        valueExpr: '_id',
                        displayExpr: (item) => item ? `${item.name}${item.code ? ` (${item.code})` : ''}` : ''
                    },
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'periodStart',
                    caption: 'Start',
                    dataType: 'date',
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'periodEnd',
                    caption: 'End',
                    dataType: 'date',
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'status',
                    caption: 'Status',
                    allowEditing: false
                },
                {
                    dataField: 'note',
                    caption: 'Note'
                },
                {
                    caption: 'Action',
                    width: 160,
                    allowEditing: false,
                    cellTemplate: (container, options) => {
                        const status = options.data?.status;
                        const id = options.data?._id;

                        if (status === 'DRAFT') {
                            const btn = $('<button>', { class: 'dx-button dx-button-mode-contained dx-button-normal' })
                                .text('Open')
                                .on('click', async () => {
                                    const res = await fetch(`${apiBase}/api/scheduler-heads/${id}/open`, {
                                        method: 'PATCH',
                                        headers: authHeaders()
                                    });
                                    const json = await res.json();
                                    if (!res.ok) {
                                        DevExpress.ui.notify(json.message || 'Open failed', 'error', 3000);
                                        return;
                                    }
                                    options.data.status = json.data?.status || 'OPEN';
                                    options.component.refresh();
                                    DevExpress.ui.notify('Opened', 'success', 2000);
                                });
                            container.append(btn);
                        } else if (status === 'OPEN') {
                            const btn = $('<button>', { class: 'dx-button dx-button-mode-contained dx-button-danger' })
                                .text('Close')
                                .on('click', async () => {
                                    const res = await fetch(`${apiBase}/api/scheduler-heads/${id}/close`, {
                                        method: 'PATCH',
                                        headers: authHeaders()
                                    });
                                    const json = await res.json();
                                    if (!res.ok) {
                                        DevExpress.ui.notify(json.message || 'Close failed', 'error', 3000);
                                        return;
                                    }
                                    options.data.status = json.data?.status || 'CLOSED';
                                    options.component.refresh();
                                    DevExpress.ui.notify('Closed', 'success', 2000);
                                });
                            container.append(btn);
                        } else {
                            container.text('-');
                        }
                    }
                }
            ],
            onRowInserting: async (e) => {
                const payload = {
                    wardId: e.data.wardId,
                    periodStart: e.data.periodStart,
                    periodEnd: e.data.periodEnd,
                    note: e.data.note
                };

                const res = await fetch(`${apiBase}/api/scheduler-heads`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                    return;
                }
                e.data._id = json.data?._id || e.data._id;
                e.data.status = json.data?.status || 'DRAFT';
                DevExpress.ui.notify('Created', 'success', 2000);
            },
            onRowValidating: (e) => {
                if (e.newData?.periodStart && e.newData?.periodEnd) {
                    if (new Date(e.newData.periodStart) > new Date(e.newData.periodEnd)) {
                        e.isValid = false;
                        e.errorText = 'Start date must be earlier than end date.';
                    }
                }
            }
        }).dxDataGrid('instance');
    };

    const renderWardMemberSection = async () => {
        systemContent.empty();

        const apiBase = window.BASE_URL || 'http://localhost:3000';
        let meta = {};
        let items = [];

        try {
            const [metaRes, listRes] = await Promise.all([
                fetch(`${apiBase}/api/ward-members/meta`, { headers: authHeaders() }),
                fetch(`${apiBase}/api/ward-members`, { headers: authHeaders() })
            ]);
            const metaJson = await metaRes.json();
            const listJson = await listRes.json();
            if (!metaRes.ok) throw new Error(metaJson.message || 'Failed to load meta');
            if (!listRes.ok) throw new Error(listJson.message || 'Failed to load user wards');
            meta = metaJson.data || {};
            items = Array.isArray(listJson.data) ? listJson.data : [];
        } catch (err) {
            systemContent.append(
                $('<div>', {
                    class: 'settings-placeholder',
                    text: err.message || 'Unable to load ward members.'
                })
            );
            return;
        }

        const users = Array.isArray(meta.users) ? meta.users : [];
        const wards = Array.isArray(meta.wards) ? meta.wards : [];
        const positions = Array.isArray(meta.positions) ? meta.positions : [];

        const gridData = items.map(item => ({
            ...item,
            userId: item.userId?._id || item.userId,
            wardId: item.wardId?._id || item.wardId,
            wardGroup: item.wardId?.meta?.group || ''
        }));

        const gridEl = $('<div>', { id: 'wardMemberGrid' });
        systemContent.append(gridEl);

        gridEl.dxDataGrid({
            dataSource: gridData,
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'row',
                allowAdding: true,
                allowUpdating: true,
                allowDeleting: false
            },
            columns: [
                {
                    dataField: 'userId',
                    caption: 'User',
                    allowEditing: true,
                    lookup: {
                        dataSource: users,
                        valueExpr: '_id',
                        displayExpr: (item) => item ? `${item.employeeCode || ''} ${item.name || ''}`.trim() : ''
                    },
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'wardId',
                    caption: 'Ward',
                    allowEditing: true,
                    lookup: {
                        dataSource: wards,
                        valueExpr: '_id',
                        displayExpr: (item) => item ? `${item.name || ''} ${item.code ? `(${item.code})` : ''}`.trim() : ''
                    },
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'wardGroup',
                    caption: 'Group',
                    allowEditing: false
                },
                {
                    dataField: 'position',
                    caption: 'Position',
                    lookup: {
                        dataSource: positions,
                        valueExpr: 'code',
                        displayExpr: (item) => item ? item.code : ''
                    },
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'roles',
                    caption: 'Roles',
                    cellTemplate: (container, options) => {
                        const roles = Array.isArray(options.value) ? options.value : [];
                        container.text(roles.join(', '));
                    },
                    editCellTemplate: (cellElement, cellInfo) => {
                        $('<div>').appendTo(cellElement).dxTagBox({
                            items: ['USER', 'HEAD', 'APPROVER', 'HR', 'FINANCE'],
                            value: cellInfo.value || [],
                            onValueChanged(e) {
                                cellInfo.setValue(e.value);
                            }
                        });
                    }
                },
                {
                    dataField: 'status',
                    caption: 'Status',
                    lookup: {
                        dataSource: ['ACTIVE', 'INACTIVE']
                    }
                }
            ].concat(String(typeCode).toUpperCase() === 'SHIFT'
                ? [
                    {
                        dataField: 'meta.timeFrom',
                        caption: 'Time From'
                    },
                    {
                        dataField: 'meta.timeTo',
                        caption: 'Time To'
                    }
                ]
                : []),
            onRowInserting: async (e) => {
                const payload = {
                    userId: e.data.userId,
                    wardId: e.data.wardId,
                    position: e.data.position,
                    roles: e.data.roles,
                    status: e.data.status
                };
                const res = await fetch(`${apiBase}/api/ward-members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                    return;
                }
                e.data._id = json.data?._id || e.data._id;
                DevExpress.ui.notify('Created', 'success', 2000);
            },
            onRowUpdating: async (e) => {
                const id = e.key;
                const payload = { ...e.oldData, ...e.newData };
                delete payload.isPrimary;
                const res = await fetch(`${apiBase}/api/ward-members/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Update failed', 'error', 3000);
                    return;
                }
                DevExpress.ui.notify('Updated', 'success', 2000);
            }
        });
    };

    const renderUserShiftRateSection = async () => {
        systemContent.empty();

        const apiBase = window.BASE_URL || 'http://localhost:3000';
        let meta = {};
        let items = [];

        try {
            const [metaRes, listRes] = await Promise.all([
                fetch(`${apiBase}/api/user-shift-rates/meta`, { headers: authHeaders() }),
                fetch(`${apiBase}/api/user-shift-rates`, { headers: authHeaders() })
            ]);
            const metaJson = await metaRes.json();
            const listJson = await listRes.json();
            if (!metaRes.ok) throw new Error(metaJson.message || 'Failed to load meta');
            if (!listRes.ok) throw new Error(listJson.message || 'Failed to load user shift rates');
            meta = metaJson.data || {};
            items = Array.isArray(listJson.data) ? listJson.data : [];
        } catch (err) {
            systemContent.append(
                $('<div>', {
                    class: 'settings-placeholder',
                    text: err.message || 'Unable to load user shift rates.'
                })
            );
            return;
        }

        const users = Array.isArray(meta.users) ? meta.users : [];
        const shifts = Array.isArray(meta.shifts) ? meta.shifts : [];

        const gridData = items.map(item => ({
            ...item,
            userId: item.userId?._id || item.userId
        }));

        const gridEl = $('<div>', { id: 'userShiftRateGrid' });
        systemContent.append(gridEl);

        gridEl.dxDataGrid({
            dataSource: gridData,
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'row',
                allowAdding: true,
                allowUpdating: true,
                allowDeleting: false
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
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'shiftCode',
                    caption: 'Shift',
                    lookup: {
                        dataSource: shifts,
                        valueExpr: 'code',
                        displayExpr: (item) => item ? item.code : ''
                    },
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'amount',
                    caption: 'Amount',
                    dataType: 'number',
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'currency',
                    caption: 'Currency'
                },
                {
                    dataField: 'status',
                    caption: 'Status',
                    lookup: {
                        dataSource: ['ACTIVE', 'INACTIVE']
                    }
                }
            ],
            onRowInserting: async (e) => {
                const payload = {
                    userId: e.data.userId,
                    shiftCode: e.data.shiftCode,
                    amount: e.data.amount,
                    currency: e.data.currency,
                    status: e.data.status
                };
                const res = await fetch(`${apiBase}/api/user-shift-rates`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                    return;
                }
                e.data._id = json.data?._id || e.data._id;
                DevExpress.ui.notify('Created', 'success', 2000);
            },
            onRowUpdating: async (e) => {
                const id = e.key;
                const payload = { ...e.oldData, ...e.newData };
                const res = await fetch(`${apiBase}/api/user-shift-rates/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Update failed', 'error', 3000);
                    return;
                }
                DevExpress.ui.notify('Updated', 'success', 2000);
            }
        });
    };

    const renderCodeMappingSection = async () => {
        systemContent.empty();

        const apiBase = window.BASE_URL || 'http://localhost:3000';
        let meta = {};
        let items = [];

        try {
            const [metaRes, listRes] = await Promise.all([
                fetch(`${apiBase}/api/code-mappings/meta`, { headers: authHeaders() }),
                fetch(`${apiBase}/api/code-mappings`, { headers: authHeaders() })
            ]);
            const metaJson = await metaRes.json();
            const listJson = await listRes.json();
            if (!metaRes.ok) throw new Error(metaJson.message || 'Failed to load meta');
            if (!listRes.ok) throw new Error(listJson.message || 'Failed to load code mappings');
            meta = metaJson.data || {};
            items = Array.isArray(listJson.data) ? listJson.data : [];
        } catch (err) {
            systemContent.append(
                $('<div>', {
                    class: 'settings-placeholder',
                    text: err.message || 'Unable to load code mappings.'
                })
            );
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

        const gridEl = $('<div>', { id: 'codeMappingGrid' });
        systemContent.append(gridEl);

        gridEl.dxDataGrid({
            dataSource: gridData,
            keyExpr: 'userId',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'row',
                allowUpdating: true,
                allowDeleting: false
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
                    lookup: {
                        dataSource: ['ACTIVE', 'INACTIVE']
                    }
                }
            ],
            onRowUpdating: async (e) => {
                const payload = { ...e.oldData, ...e.newData };
                const isUpdate = !!payload._id;
                const url = isUpdate
                    ? `${apiBase}/api/code-mappings/${payload._id}`
                    : `${apiBase}/api/code-mappings`;
                const method = isUpdate ? 'PUT' : 'POST';

                const res = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
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
        const wrap = $('<div>', { class: 'attendance-sync' });
        const formEl = $('<div>', { id: 'attendanceSyncForm' });
        const logFilters = $('<div>', { class: 'attendance-log-filters' });
        const logArea = $('<div>', { class: 'attendance-log' });

        wrap.append(formEl, logFilters, logArea);
        systemContent.append(wrap);

        let parsedRows = [];
        let mappedRows = [];
        let unmapped = [];

        const toSeconds = (time) => {
            const parts = String(time || '').split(':').map(Number);
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

        const logEntries = [];
        const logOptions = {
            info: true,
            warn: true,
            error: true,
            success: true
        };

        const filterItem = (key, label) => {
            const id = `attendance-log-${key}`;
            const wrap = $('<label>', { class: 'attendance-log-filter' });
            const input = $('<input>', { type: 'checkbox', id, checked: true });
            input.on('change', () => {
                logOptions[key] = input.is(':checked');
            });
            wrap.append(input, $('<span>', { text: label }));
            return wrap;
        };
        logFilters.append(
            filterItem('info', 'Info'),
            filterItem('success', 'Success'),
            filterItem('warn', 'Warning'),
            filterItem('error', 'Error')
        );
        const log = (message, type = 'info') => {
            if (!logOptions[type]) return;
            const line = $('<div>', { class: `attendance-log-line ${type}`, text: message });
            logArea.append(line);
            logEntries.push(`[${type.toUpperCase()}] ${message}`);
        };

        const loadMappings = async () => {
            const res = await fetch(`${apiBase}/api/code-mappings?status=ACTIVE`, { headers: authHeaders() });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed to load code mappings');
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

        const handleFile = async (file) => {
            if (!file) return;
            const text = await file.text();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            logArea.empty();
            logEntries.length = 0;
            parsedRows = lines.map(line => {
                const [empcode, date, time, machineNo] = line.split(',').map(v => v.trim());
                return { empcode, date, time, machineNo };
            }).filter(r => r.empcode && r.date && r.time);

            const mapping = await loadMappings();
            unmapped = [];
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
            log(`Rows: ${parsedRows.length}`);
            log(`Mapped (unique user/date): ${mappedRows.length}`);
            log(`Unmapped codes: ${unmapped.length ? unmapped.join(', ') : '-'}`, unmapped.length ? 'warn' : 'info');
            const singlePunch = mappedRows.filter(r => r.punchCount === 1);
            if (singlePunch.length) {
                log(`Single punch rows: ${singlePunch.length}`, 'warn');
            }
        };

        const syncNow = async () => {
            if (!mappedRows.length) {
                DevExpress.ui.notify('No mapped rows to sync', 'warning', 2000);
                log('No mapped rows to sync', 'warn');
                return;
            }
            const res = await fetch(`${apiBase}/api/attendance/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({ rows: mappedRows })
            });
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Sync failed', 'error', 3000);
                log(`Sync failed: ${json.message || 'Unknown error'}`, 'error');
                return;
            }
            DevExpress.ui.notify('Synced', 'success', 2000);
            log(`Sync success. Matched: ${json.data?.matched || 0}, Modified: ${json.data?.modified || 0}`, 'success');
            const noSchedule = Array.isArray(json.data?.noSchedule) ? json.data.noSchedule : [];
            if (noSchedule.length) {
                log(`No schedule found: ${noSchedule.length}`, 'error');
                noSchedule.slice(0, 20).forEach(item => {
                    log(`No schedule for user ${item.userId} on ${item.date}`, 'error');
                });
            }
        };

        const downloadLog = () => {
            if (!logEntries.length) {
                DevExpress.ui.notify('No log to download', 'warning', 2000);
                return;
            }
            const blob = new Blob([logEntries.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-sync-log-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const formData = { file: null };
        formEl.dxForm({
            formData,
            colCount: 1,
            items: [
                {
                    itemType: 'group',
                    items: [
                        { itemType: 'label', text: 'Sync Time Attendance (CSV)' }
                    ]
                },
                {
                    dataField: 'file',
                    label: { text: 'CSV File' },
                    editorType: 'dxFileUploader',
                    editorOptions: {
                        accept: '.csv',
                        uploadMode: 'useForm',
                        selectButtonText: 'Select file',
                        onValueChanged: (e) => {
                            const f = e.value && e.value[0];
                            handleFile(f);
                        }
                    }
                },
                {
                    itemType: 'group',
                    caption: 'Actions',
                    colCount: 2,
                    items: [
                        {
                            itemType: 'button',
                            horizontalAlignment: 'left',
                            buttonOptions: {
                                text: 'Sync',
                                type: 'default',
                                onClick: syncNow
                            }
                        },
                        {
                            itemType: 'button',
                            horizontalAlignment: 'left',
                            buttonOptions: {
                                text: 'Download Log',
                                type: 'normal',
                                onClick: downloadLog
                            }
                        }
                    ]
                }
            ]
        });
    };

    const renderSystemSection = async (item) => {
        systemContent.empty();
        if (item && item._type === 'schedulerHead') {
            await renderSchedulerHeadSection();
            return;
        }
        if (item && item._type === 'wardMember') {
            await renderWardMemberSection();
            return;
        }
        if (item && item._type === 'userShiftRate') {
            await renderUserShiftRateSection();
            return;
        }
        if (item && item._type === 'codeMapping') {
            await renderCodeMappingSection();
            return;
        }
        const meta = item.meta || {};
        const hint = meta.hint || 'Master type';

        const gridEl = $('<div>', { id: 'masterGrid' });
        systemContent.append(gridEl);

        const apiBase = window.BASE_URL || 'http://localhost:3000';
        const typeCode = item.code;

        let gridData = [];
        try {
            const res = await fetch(`${apiBase}/api/masters/${typeCode}`, {
                headers: authHeaders()
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load masters');
            }
            gridData = Array.isArray(json.data) ? json.data : [];
        } catch (err) {
            systemContent.append(
                $('<div>', {
                    class: 'settings-placeholder',
                    text: err.message || 'Unable to load masters.'
                })
            );
        }

        const getContrastText = (hex) => {
            if (!hex) return '#0f172a';
            const clean = hex.replace('#', '');
            if (clean.length !== 6) return '#0f172a';
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance < 0.55 ? '#ffffff' : '#0f172a';
        };

        const gridInstance = $('#masterGrid').dxDataGrid({
            dataSource: gridData,
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'row',
                allowAdding: true,
                allowUpdating: true,
                allowDeleting: false
            },
            columns: [
                {
                    dataField: 'code',
                    caption: 'Code',
                    allowEditing: false,
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'name',
                    caption: 'Name',
                    validationRules: [{ type: 'required' }]
                },
                { dataField: 'description', caption: 'Description' },
                ...(String(typeCode).toUpperCase() === 'WARD'
                    ? [{
                        dataField: 'meta.group',
                        caption: 'Group',
                        validationRules: [{ type: 'required' }]
                    }]
                    : []),
                {
                    dataField: 'status',
                    caption: 'Status',
                    lookup: {
                        dataSource: ['ACTIVE', 'INACTIVE']
                    }
                }
            ],
            onRowInserting: async (e) => {
                const payload = {
                    ...e.data,
                    type: typeCode
                };
                const res = await fetch(`${apiBase}/api/masters`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                    return;
                }
                e.data._id = json.data?._id || e.data._id;
                DevExpress.ui.notify('Created', 'success', 2000);
            },
            onRowUpdating: async (e) => {
                const id = e.key;
                const payload = { ...e.oldData, ...e.newData };
                const res = await fetch(`${apiBase}/api/masters/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Update failed', 'error', 3000);
                    return;
                }
                DevExpress.ui.notify('Updated', 'success', 2000);
            },
            onRowValidating: (e) => {
                if (e.newData && Object.prototype.hasOwnProperty.call(e.newData, 'code')) {
                    e.isValid = false;
                    e.errorText = 'Code cannot be changed.';
                }
            },
            onContentReady: (e) => {
                const headerColor = (meta && meta.color) ? meta.color : '#e2e8f0';
                const textColor = getContrastText(headerColor);
                const $grid = e.component.element();
                $grid.find('.dx-header-row').css('background-color', headerColor);
                $grid.find('.dx-header-row > td').css('background-color', headerColor);
                $grid.find('.dx-header-row, .dx-header-row > td').css('color', textColor);
            }
        }).dxDataGrid('instance');
    };

    const baseSystemItems = [
        {
            _id: 'SCHEDULER_HEAD',
            name: 'Scheduler Head',
            meta: { color: '#0ea5e9', icon: 'sh', hint: 'เปิด/ปิดรอบเวร' },
            _type: 'schedulerHead'
        },
        {
            _id: 'WARD_MEMBER',
            name: 'Ward Member',
            meta: { color: '#64748b', icon: 'wm', hint: 'ผูกผู้ใช้กับ ward' },
            _type: 'wardMember'
        },
        {
            _id: 'USER_SHIFT_RATE',
            name: 'User Shift Rate',
            meta: { color: '#22c55e', icon: 'sr', hint: 'เรทต่อคน/รหัสเวร' },
            _type: 'userShiftRate'
        },
        {
            _id: 'CODE_MAPPING',
            name: 'Code Mapping',
            meta: { color: '#94a3b8', icon: 'cm', hint: 'รหัสเครื่องสแกน ↔ ผู้ใช้' },
            _type: 'codeMapping'
        },
        ...items
    ];

    const systemItems = (isHr && !(isAdmin || isHead))
        ? baseSystemItems.filter(i => i._type === 'codeMapping')
        : baseSystemItems;

    const targetType = window.systemSettingsTarget;
    if (targetType) {
        window.systemSettingsTarget = null;
    }

    const activeType = targetType && systemItems.some(i => i._type === targetType)
        ? targetType
        : (systemItems[0]?._type || '');

    systemItems.forEach((item, index) => {
        const meta = item.meta || {};
        const btn = $('<button>', {
            class: `system-settings-item${item._type === activeType ? ' active' : ''}`,
            click: () => {
                systemMenu.find('.system-settings-item').removeClass('active');
                btn.addClass('active');
                renderSystemSection(item);
            }
        });

        const color = meta.color || '#e2e8f0';
        const icon = meta.icon || 'type';
        const hint = meta.hint || '';

        const iconBadge = $('<span>', {
            class: 'system-settings-icon',
            text: icon.slice(0, 2).toUpperCase()
        }).css('background', color);

        const label = $('<div>', { class: 'system-settings-label' }).text(item.name);
        const sub = $('<div>', { class: 'system-settings-sub' }).text(hint);

        btn.append(iconBadge, $('<div>').append(label, sub));
        systemMenu.append(btn);
        if (item._type === activeType) renderSystemSection(item);
    });

    if (!systemItems.length) {
        systemContent.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: 'No master types found.'
            })
        );
    }

    systemWrap.append(systemMenu, systemContent);
    $('#systemSettings').append(systemWrap);
};
