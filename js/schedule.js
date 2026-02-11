// js/schedule.js
// Personal Schedule Booking (Custom Calendar)
window.renderSchedule = async function renderSchedule(options = {}) {
    if (typeof window.showPage === 'function') {
        window.showPage('schedule');
    }

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
            return Common.fetchWithAuth(`/api/schedules/user/${editUserId}?month=${month}&year=${year}${wardQuery}`);
        }
        return Common.fetchWithAuth('/api/schedules/my');
    };

    const [wardRes, shiftRes, myRes, patternRes, meRes, inboxRes] = await Promise.all([
        Common.fetchWithAuth('/api/ward-members/mine'),
        Common.fetchWithAuth('/api/configuration?typ_code=SHIFT'),
        loadSchedules(selectedDate),
        Common.fetchWithAuth('/api/master-patterns'),
        Common.fetchWithAuth('/api/users/me'),
        Common.fetchWithAuth('/api/changes/inbox?status=OPEN')
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

    const shiftCodes = shifts.map(s => s.code || s.conf_code || '').filter(Boolean);
    const normalizeShiftCode = (code) => String(code || '').trim().toUpperCase();
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
    const shiftMetaByCode = new Map(
        shifts.map(s => [normalizeShiftCode(s.code || s.conf_code || ''), s.meta || {}])
            .filter(([code]) => code)
    );
    const getKey = (date, wardId) => `${new Date(date).toDateString()}|${wardId || 'ALL'}`;

    const rebuildScheduleMaps = (list) => {
        scheduleMap.clear();
        scheduleMetaMap.clear();
        scheduleMetaByDateCode.clear();
        scheduleItemMap.clear();
        list.forEach(s => {
            const wardId = String(s.wardId?._id || s.wardId);
            const key = getKey(s.workDate, wardId);
            if (!scheduleMap.has(key)) scheduleMap.set(key, []);
            scheduleMap.get(key).push(normalizeShiftCode(s.shiftCode));
            if (!scheduleItemMap.has(key)) scheduleItemMap.set(key, []);
            scheduleItemMap.get(key).push({ id: String(s._id), code: normalizeShiftCode(s.shiftCode), meta: s.meta || {} });
            const dateKey = new Date(s.workDate).toDateString();
            const metaKey = `${dateKey}|${wardId}|${normalizeShiftCode(s.shiftCode)}`;
            scheduleMetaMap.set(metaKey, s.meta || {});
            const aggKey = `${dateKey}|${normalizeShiftCode(s.shiftCode)}`;
            if (s.meta?.changeStatus === 'OPEN') {
                scheduleMetaByDateCode.set(aggKey, { changeStatus: 'OPEN' });
            }
        });
    };

    rebuildScheduleMaps(schedules);

    const wardItems = [...wards];
    if (editWardId && !wardItems.some(w => String(w._id) === String(editWardId))) {
        const fromSchedule = schedules.find(s => String(s.wardId?._id || s.wardId) === String(editWardId));
        const wardName = fromSchedule?.wardId?.name || `Ward ${String(editWardId).slice(-4)}`;
        wardItems.push({ _id: editWardId, name: wardName });
    }
    let wardFilterInstance;
    let patternFilterInstance;
    let bookingOpen = false;

    const getWardCodeById = (id) => {
        const ward = wardItems.find(w => String(w._id) === String(id));
        return ward?.code || ward?.conf_code || '';
    };

    const checkBookingWindow = async () => {
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : null;
        if (!wardId) {
            bookingOpen = false;
            bookingBanner.text('กรุณาเลือก Ward ก่อน').show();
            return;
        }

        const wardCode = String(getWardCodeById(wardId) || '').trim().toUpperCase();
        console.log('wardcode Data: ',wardCode);
        const res = await Common.fetchWithAuth(`/api/schedules/head/${wardCode}`);
        const json = await res.json();
        console.log('Ward to open Data: ',json.data);
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
            const wardCode = String(getWardCodeById(tempWardId) || '').trim().toUpperCase();
            const headRes = await Common.fetchWithAuth(`/api/schedules/head/${wardCode}`);
            if (!headRes.ok) {
                await Common.postWithAuth('/api/scheduler-heads', {
                    body: JSON.stringify({
                        wardCode,
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
                const code = normalizeShiftCode((pattern.dayCodes || [])[dayIndex] || '');
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

            const res = await Common.postWithAuth('/api/schedules/book', {
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

            const reloadRes = await loadSchedules(selectedDate);
            const reloadJson = await reloadRes.json();
            if (reloadRes.ok) {
                schedules.length = 0;
                schedules.push(...(Array.isArray(reloadJson.data) ? reloadJson.data : []));
                rebuildScheduleMaps(schedules);
            }

            renderCalendar();
            DevExpress.ui.notify('Pattern applied', 'success', 2000);
        }
    });

    const parseCodes = (value) => {
        if (!value) return [];
        const raw = value
            .replace(/,/g, ' ')
            .split(' ')
            .map(v => normalizeShiftCode(v))
            .filter(Boolean);
        const allowed = new Set(shiftCodes.map(s => normalizeShiftCode(s)).filter(Boolean));
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
                            const res = await Common.patchWithAuth(`/api/changes/${reqId}/accept`);
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
        const existing = new Set(codes.map(c => normalizeShiftCode(c)));
                const toCreate = newCodes.filter(c => !existing.has(c));

                if (!toCreate.length) {
                    scheduleMap.set(getKey(selectedDate, wardId), newCodes);
                    renderCalendar();
                    return;
                }

                const payload = {
                    schedules: toCreate.map(code => ({
                        workDate: selectedDate,
                        wardId,
                        shiftCode: normalizeShiftCode(code),
                        meta: {},
                        userId: editUserId || undefined
                    }))
                };

                const res = await Common.postWithAuth('/api/schedules/book', {
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
                    scheduleMap.get(key).push(normalizeShiftCode(s.shiftCode));
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
                    scheduleMap.get(key).push(normalizeShiftCode(s.shiftCode));
                });
            }
        }
        renderCalendar();
    });

    await checkBookingWindow();
    renderCalendar();
};
    
