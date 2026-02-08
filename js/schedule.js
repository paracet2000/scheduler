// js/schedule.js
// Personal Schedule Booking (Custom Calendar)
window.renderSchedule = async function renderSchedule(options = {}) {
    if (typeof window.showPage === 'function') {
        window.showPage('schedule');
    }

    const apiBase = window.BASE_URL || '';
    const token = localStorage.getItem('auth_token');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const scheduleEl = $('#personalScheduler');
    scheduleEl.empty();

    const toolbar = $('<div>', { class: 'schedule-toolbar' });
    const editBanner = $('<div>', { class: 'schedule-edit-banner' }).hide();
    const wardSelectEl = $('<div>', { id: 'scheduleWardFilter' });
    const patternSelectEl = $('<div>', { id: 'schedulePatternFilter' });
    const patternApplyBtnEl = $('<div>', { id: 'schedulePatternApply' });
    const monthNav = $('<div>', { class: 'schedule-month-nav' });
    const prevBtn = $('<button>', { class: 'schedule-nav-btn', text: '<' });
    const nextBtn = $('<button>', { class: 'schedule-nav-btn', text: '>' });
    const monthLabel = $('<div>', { class: 'schedule-month-label' });
    monthNav.append(prevBtn, monthLabel, nextBtn);
    toolbar.append(monthNav, wardSelectEl, patternSelectEl, patternApplyBtnEl);

    const calendarWrap = $('<div>', { class: 'schedule-grid' });
    const bookingBanner = $('<div>', { class: 'schedule-booking-banner' }).hide();
    scheduleEl.append(editBanner, toolbar, calendarWrap);
    scheduleEl.append(bookingBanner);

    const editUserId = options.userId || null;
    const editWardId = options.wardId || null;
    const editUserName = options.userName || '';
    const editUserAvatar = options.userAvatar || '';
    const lockWard = !!options.lockWard;
    const lockMonth = !!options.lockMonth;
    const returnToSummary = !!options.returnToSummary;
    let selectedDate = options.year && options.month
        ? new Date(options.year, options.month - 1, 1)
        : new Date();

    const loadSchedules = async (date) => {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        if (editUserId) {
            const wardQuery = editWardId ? `&wardId=${editWardId}` : '';
            return fetch(`${apiBase}/api/schedules/user/${editUserId}?month=${month}&year=${year}${wardQuery}`, { headers: authHeaders });
        }
        return fetch(`${apiBase}/api/schedules/my`, { headers: authHeaders });
    };

    const [wardRes, shiftRes, myRes, patternRes, meRes, inboxRes] = await Promise.all([
        fetch(`${apiBase}/api/ward-members/mine`, { headers: authHeaders }),
        fetch(`${apiBase}/api/masters/SHIFT`, { headers: authHeaders }),
        loadSchedules(selectedDate),
        fetch(`${apiBase}/api/master-patterns`, { headers: authHeaders }),
        fetch(`${apiBase}/api/users/me`, { headers: authHeaders }),
        fetch(`${apiBase}/api/changes/inbox?status=OPEN`, { headers: authHeaders })
    ]);

    const wardJson = await wardRes.json();
    const shiftJson = await shiftRes.json();
    const myJson = await myRes.json();
    const patternJson = await patternRes.json();
    const meJson = await meRes.json();
    const inboxJson = await inboxRes.json();

    if (!wardRes.ok || !shiftRes.ok || !myRes.ok || !patternRes.ok || !meRes.ok || !inboxRes.ok) {
        const message = wardJson?.message || shiftJson?.message || myJson?.message || patternJson?.message || meJson?.message || inboxJson?.message || 'Failed to load schedule data';
        scheduleEl.html(`<div class="settings-placeholder">${message}</div>`);
        return;
    }

    const wards = Array.isArray(wardJson.data) ? wardJson.data : [];
    const shifts = Array.isArray(shiftJson.data) ? shiftJson.data : [];
    const schedules = Array.isArray(myJson.data) ? myJson.data : [];
    const patterns = Array.isArray(patternJson.data) ? patternJson.data : [];
    const profile = meJson?.data || {};
    const inboxRequests = Array.isArray(inboxJson.data) ? inboxJson.data : [];
    const isEmailVerified = !!profile.emailVerified;

    if (editUserId) {
        const nameText = editUserName || profile?.name || profile?.email || 'User';
        const avatarUrl = editUserAvatar
            ? (typeof window.resolveAvatarUrl === 'function' ? window.resolveAvatarUrl(editUserAvatar) : editUserAvatar)
            : (typeof window.resolveAvatarUrl === 'function' ? window.resolveAvatarUrl(profile?.avatar || '') : '');
        const avatarEl = $('<div>', { class: 'schedule-edit-avatar' });
        if (avatarUrl) {
            avatarEl.css('background-image', `url('${avatarUrl}')`);
        } else {
            const initial = String(nameText || 'U').trim().charAt(0).toUpperCase();
            avatarEl.text(initial);
        }
        const title = $('<div>', { class: 'schedule-edit-title', text: `Editing: ${nameText}` });
        editBanner.empty().append(avatarEl, title).show();
    }

    const shiftCodes = shifts.map(s => s.code);
    const scheduleMap = new Map();
    const scheduleMetaMap = new Map();
    const scheduleMetaByDateCode = new Map();
    const scheduleItemMap = new Map();

    const inboxScheduleMap = new Map();
    inboxRequests.forEach(r => {
        if (!Array.isArray(r.affectedSchedules)) return;
        r.affectedSchedules.forEach(item => {
            if (item.scheduleId) {
                inboxScheduleMap.set(String(item.scheduleId), r._id);
            }
        });
    });
    const shiftMetaByCode = new Map(shifts.map(s => [String(s.code).toUpperCase(), s.meta || {}]));
    const getKey = (date, wardId) => `${new Date(date).toDateString()}|${wardId || 'ALL'}`;

    schedules.forEach(s => {
        const wardId = String(s.wardId?._id || s.wardId);
        const key = getKey(s.workDate, wardId);
        if (!scheduleMap.has(key)) scheduleMap.set(key, []);
        scheduleMap.get(key).push(s.shiftCode);
        if (!scheduleItemMap.has(key)) scheduleItemMap.set(key, []);
        scheduleItemMap.get(key).push({ id: String(s._id), code: s.shiftCode, meta: s.meta || {} });
        const dateKey = new Date(s.workDate).toDateString();
        const metaKey = `${dateKey}|${wardId}|${String(s.shiftCode).toUpperCase()}`;
        scheduleMetaMap.set(metaKey, s.meta || {});
        const aggKey = `${dateKey}|${String(s.shiftCode).toUpperCase()}`;
        if (s.meta?.changeStatus === 'OPEN') {
            scheduleMetaByDateCode.set(aggKey, { changeStatus: 'OPEN' });
        }
    });

    const wardItems = [...wards];
    if (editWardId && !wardItems.some(w => String(w._id) === String(editWardId))) {
        const fromSchedule = schedules.find(s => String(s.wardId?._id || s.wardId) === String(editWardId));
        const wardName = fromSchedule?.wardId?.name || `Ward ${String(editWardId).slice(-4)}`;
        wardItems.push({ _id: editWardId, name: wardName });
    }
    let wardFilterInstance;
    let patternFilterInstance;
    let bookingOpen = false;

    const checkBookingWindow = async () => {
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
        if (!wardId) {
            bookingOpen = false;
            bookingBanner.text('กรุณาเลือก Ward ก่อน').show();
            return;
        }

        const res = await fetch(`${apiBase}/api/schedules/head/${wardId}`, {
            headers: authHeaders
        });
        const json = await res.json();
        if (!res.ok || !json?.data?.open) {
            bookingOpen = false;
            bookingBanner.text('หัวหน้ายังไม่เปิดให้ Booking').show();
            return;
        }
        bookingOpen = true;
        bookingBanner.hide();
    };

    if (!wardItems.length) {
        scheduleEl.html('<div class="settings-placeholder">No ward membership found.</div>');
        return;
    }

    if (!editUserId && wardItems.length === 1 && String(wardItems[0].code || '') === 'TEMP_WARD') {
        const tempWardId = wardItems[0]._id;
        try {
            const headRes = await fetch(`${apiBase}/api/schedules/head/${tempWardId}`, { headers: authHeaders });
            if (!headRes.ok) {
                await fetch(`${apiBase}/api/scheduler-heads`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders
                    },
                    body: JSON.stringify({
                        wardId: tempWardId,
                        periodStart: new Date(),
                        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
                        status: 'OPEN',
                        note: 'Auto open for TEMP_WARD'
                    })
                });
            }
        } catch {
            // no-op
        }
    }

    wardSelectEl.dxSelectBox({
        items: wardItems,
        displayExpr: 'name',
        valueExpr: '_id',
        value: editWardId || (wardItems[0]?._id || null),
        width: 220,
        placeholder: 'Select ward',
        disabled: lockWard,
        onInitialized(e) {
            wardFilterInstance = e.component;
        },
        onValueChanged() {
            checkBookingWindow();
            renderCalendar();
        }
    });

    const patternItems = [{ _id: 'NONE', name: 'No Pattern' }, ...patterns];
    patternSelectEl.dxSelectBox({
        items: patternItems,
        displayExpr: 'name',
        valueExpr: '_id',
        value: 'NONE',
        width: 220,
        placeholder: 'Select pattern',
        onInitialized(e) {
            patternFilterInstance = e.component;
        }
    });

    patternApplyBtnEl.dxButton({
        text: 'Apply',
        type: 'default',
        onClick: async () => {
            if (!patternFilterInstance) return;
            const selectedId = patternFilterInstance.option('value');
            if (!selectedId || selectedId === 'NONE') {
                DevExpress.ui.notify('Please select a pattern', 'warning', 2000);
                return;
            }
            const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
            if (!wardId) {
                DevExpress.ui.notify('Please select a ward', 'warning', 2000);
                return;
            }

            const pattern = patterns.find(p => String(p._id) === String(selectedId));
            if (!pattern) return;

            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const schedulesToCreate = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month, d);
                const dayIndex = date.getDay(); // 0=Sun
                const code = (pattern.dayCodes || [])[dayIndex] || '';
                if (!code) continue;
                schedulesToCreate.push({
                    workDate: date,
                    wardId,
                    shiftCode: code,
                    meta: {}
                });
            }

            if (!schedulesToCreate.length) {
                DevExpress.ui.notify('Pattern has no shifts for this month', 'warning', 2000);
                return;
            }

            const res = await fetch(`${apiBase}/api/schedules/book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({
                    schedules: schedulesToCreate.map(item => ({
                        ...item,
                        userId: editUserId || undefined
                    }))
                })
            });
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Apply pattern failed', 'error', 3000);
                return;
            }

            schedulesToCreate.forEach(item => {
                const key = new Date(item.workDate).toDateString();
                const existing = scheduleMap.get(key) || [];
                if (!existing.includes(item.shiftCode)) {
                    existing.push(item.shiftCode);
                }
                scheduleMap.set(key, existing);
            });

            renderCalendar();
            DevExpress.ui.notify('Pattern applied', 'success', 2000);
        }
    });

    const parseCodes = (value) => {
        if (!value) return [];
        const raw = value
            .replace(/,/g, ' ')
            .split(' ')
            .map(v => v.trim().toUpperCase())
            .filter(Boolean);
        const allowed = new Set(shiftCodes.map(s => s.toUpperCase()));
        const valid = raw.filter(v => allowed.has(v));
        const unique = Array.from(new Set(valid));
        return unique;
    };

    const getMonthLabel = (date) => {
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    const getCodesForDate = (date) => {
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
        if (!wardId) return [];
        const key = getKey(date, wardId);
        return scheduleMap.get(key) || [];
    };

    const renderCalendar = () => {
        calendarWrap.empty();
        monthLabel.text(getMonthLabel(selectedDate));

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const dayOfWeek = firstDay.getDay(); // 0 Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const weekdayOrder = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
        const weekdayByJs = {
            0: 'อา.',
            1: 'จ.',
            2: 'อ.',
            3: 'พ.',
            4: 'พฤ.',
            5: 'ศ.',
            6: 'ส.'
        };
        const startWeekday = weekdayByJs[dayOfWeek];
        const startIndex = weekdayOrder.indexOf(startWeekday);
        const rotatedWeekdays = weekdayOrder.slice(startIndex).concat(weekdayOrder.slice(0, startIndex));

        const headerRow = $('<div>', { class: 'schedule-grid-header' });
        rotatedWeekdays.forEach(d => {
            const colClass = d === 'ส.' ? 'col-sat' : d === 'อา.' ? 'col-sun' : '';
            headerRow.append($('<div>', { class: `schedule-grid-cell header ${colClass}`, text: d }));
        });
        calendarWrap.append(headerRow);

        const cells = [];
        for (let i = 0; i < 35; i++) {
            const colIndex = i % 7;
            const weekday = rotatedWeekdays[colIndex];
            const colClass = weekday === 'ส.' ? 'col-sat' : weekday === 'อา.' ? 'col-sun' : '';
            const cell = $('<div>', { class: `schedule-grid-cell ${colClass}` });
            const dayNum = i + 1;
            if (dayNum <= daysInMonth) {
                const cellDate = new Date(year, month, dayNum);
                cell.attr('data-date', cellDate.toISOString());
                const label = $('<div>', { class: 'schedule-day', text: dayNum });
                const shiftsEl = $('<div>', { class: 'schedule-shifts' });
                const codes = getCodesForDate(cellDate);
                const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
                const cellKey = getKey(cellDate, wardId);
                const items = scheduleItemMap.get(cellKey) || [];
                items.forEach(item => {
                    const c = item.code;
                    const meta = shiftMetaByCode.get(String(c).toUpperCase()) || {};
                    const chip = $('<span>', { class: 'schedule-shift-chip', text: c });
                    const dateKey = cellDate.toDateString();
                    const codeKey = String(c).toUpperCase();
                    const metaKey = `${dateKey}|${wardId || 'ALL'}|${codeKey}`;
                    const changeMeta = scheduleMetaMap.get(metaKey) || {};
                    if (changeMeta.changeStatus === 'OPEN') {
                        chip.addClass('schedule-shift-pending');
                    }
                    if (meta.color) {
                        chip.css('background-color', meta.color);
                    }
                    if (changeMeta.changeStatus) {
                        const statusText = $('<span>', {
                            class: `schedule-status-text schedule-status-${String(changeMeta.changeStatus).toLowerCase()}`,
                            text: changeMeta.changeStatus
                        });
                        chip.append(statusText);
                    }

                    if (!editUserId && wardId && inboxScheduleMap.has(item.id)) {
                        const acceptBtn = $('<button>', { class: 'schedule-accept-btn', text: 'Accept' });
                        acceptBtn.on('click', async (e) => {
                            e.stopPropagation();
                            const reqId = inboxScheduleMap.get(item.id);
                            const res = await fetch(`${apiBase}/api/changes/${reqId}/accept`, {
                                method: 'PATCH',
                                headers: authHeaders
                            });
                            const json = await res.json();
                            if (!res.ok) {
                                DevExpress.ui.notify(json.message || 'Accept failed', 'error', 3000);
                                return;
                            }
                            DevExpress.ui.notify('Accepted', 'success', 2000);
                            changeMeta.changeStatus = 'ACCEPTED';
                            chip.removeClass('schedule-shift-pending');
                            statusText.text('ACCEPTED').removeClass().addClass('schedule-status-text schedule-status-accepted');
                            acceptBtn.remove();
                        });
                        chip.append(acceptBtn);
                    }
                    shiftsEl.append(chip);
                });
                cell.append(label, shiftsEl);
                if (cellDate.toDateString() === selectedDate.toDateString()) {
                    cell.addClass('selected');
                }
            } else {
                cell.addClass('empty');
            }
            cells.push(cell);
        }

        const gridRow = $('<div>', { class: 'schedule-grid-body' });
        cells.forEach(c => gridRow.append(c));
        calendarWrap.append(gridRow);

        // Summary row
        const summary = $('<div>', { class: 'schedule-summary' });
        if (!isEmailVerified) {
            summary.append($('<div>', { class: 'schedule-verify-warning', text: 'กรุณายืนยันอีเมล์ก่อน เพื่อจะปรากฏผลสรุปตารางเวร' }));
            calendarWrap.append(summary);
            return;
        }
        const counts = {};
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const codes = getCodesForDate(date);
            codes.forEach(c => {
                const code = String(c).toUpperCase();
                counts[code] = (counts[code] || 0) + 1;
            });
        }
        const summaryItems = Object.keys(counts).sort().map(code => {
            const meta = shiftMetaByCode.get(code) || {};
            const chip = $('<span>', { class: 'schedule-shift-chip', text: `${code}: ${counts[code]}` });
            if (meta.color) chip.css('background-color', meta.color);
            return chip;
        });
        if (!summaryItems.length) {
            summary.append($('<span>', { text: 'No shifts in this month.' }));
        } else {
            summaryItems.forEach(ch => summary.append(ch));
        }
        calendarWrap.append(summary);

        calendarWrap.off('click').on('click', '.schedule-grid-cell', function () {
            if ($(this).hasClass('empty')) return;
            if (!bookingOpen) {
                DevExpress.ui.notify('Booking ยังไม่เปิด', 'warning', 2000);
                return;
            }
            const date = new Date($(this).attr('data-date'));
            selectedDate = date;
            const codes = getCodesForDate(selectedDate);

            const $cell = $(this);
            const $input = $('<input>', {
                class: 'schedule-shift-input',
                type: 'text',
                value: codes.join(' ')
            });

            $cell.find('.schedule-shifts').empty().append($input);
            $input.focus();

            const saveInput = async () => {
                const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
                if (!wardId) {
                    DevExpress.ui.notify('Please select a ward', 'warning', 2000);
                    renderCalendar();
                    return;
                }
                if (!bookingOpen) {
                    DevExpress.ui.notify('Booking ยังไม่เปิด', 'warning', 2000);
                    renderCalendar();
                    return;
                }

                const newCodes = parseCodes($input.val());
                const existing = new Set(codes.map(c => c.toUpperCase()));
                const toCreate = newCodes.filter(c => !existing.has(c));

                if (!toCreate.length) {
                    scheduleMap.set(key, newCodes);
                    renderCalendar();
                    return;
                }

                const payload = {
                    schedules: toCreate.map(code => ({
                        workDate: selectedDate,
                        wardId,
                        shiftCode: code,
                        meta: {},
                        userId: editUserId || undefined
                    }))
                };

                const res = await fetch(`${apiBase}/api/schedules/book`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    DevExpress.ui.notify(json.message || 'Booking failed', 'error', 3000);
                    renderCalendar();
                    return;
                }

                scheduleMap.set(getKey(selectedDate, wardId), newCodes);
                renderCalendar();
                DevExpress.ui.notify('Booked', 'success', 2000);
            };

            $input.on('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    await saveInput();
                    const idx = $cell.index();
                    const nextCell = cells[idx + 1];
                    if (nextCell) $(nextCell).trigger('click');
                }
            });

            $input.on('blur', async () => {
                await saveInput();
            });
        });
    };

    if (returnToSummary) {
        const backBtn = $('<button>', { class: 'schedule-nav-btn', text: 'Back' });
        monthNav.prepend(backBtn);
        backBtn.on('click', () => {
            if (typeof window.renderScheduleSummary === 'function') {
                window.renderScheduleSummary({
                    autoLoad: true,
                    filters: options.summaryFilters || {}
                });
            }
        });
    }

    prevBtn.prop('disabled', lockMonth);
    nextBtn.prop('disabled', lockMonth);

    prevBtn.on('click', async () => {
        if (lockMonth) return;
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
        if (editUserId) {
            const res = await loadSchedules(selectedDate);
            const json = await res.json();
            if (res.ok) {
                schedules.length = 0;
                schedules.push(...(Array.isArray(json.data) ? json.data : []));
                scheduleMap.clear();
                schedules.forEach(s => {
                    const wardId = String(s.wardId?._id || s.wardId);
                    const key = getKey(s.workDate, wardId);
                    if (!scheduleMap.has(key)) scheduleMap.set(key, []);
                    scheduleMap.get(key).push(s.shiftCode);
                });
            }
        }
        renderCalendar();
    });
    nextBtn.on('click', async () => {
        if (lockMonth) return;
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
        if (editUserId) {
            const res = await loadSchedules(selectedDate);
            const json = await res.json();
            if (res.ok) {
                schedules.length = 0;
                schedules.push(...(Array.isArray(json.data) ? json.data : []));
                scheduleMap.clear();
                schedules.forEach(s => {
                    const wardId = String(s.wardId?._id || s.wardId);
                    const key = getKey(s.workDate, wardId);
                    if (!scheduleMap.has(key)) scheduleMap.set(key, []);
                    scheduleMap.get(key).push(s.shiftCode);
                });
            }
        }
        renderCalendar();
    });

    await checkBookingWindow();
    renderCalendar();
};
    
