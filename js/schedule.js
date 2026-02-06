// js/schedule.js
// Personal Schedule Booking (Custom Calendar)
window.renderSchedule = async function renderSchedule() {
    if (typeof window.showPage === 'function') {
        window.showPage('schedule');
    }

    const apiBase = window.BASE_URL || 'http://localhost:3000';
    const token = localStorage.getItem('auth_token');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const scheduleEl = $('#personalScheduler');
    scheduleEl.empty();

    const toolbar = $('<div>', { class: 'schedule-toolbar' });
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
    scheduleEl.append(toolbar, calendarWrap);
    scheduleEl.append(bookingBanner);

    const [wardRes, shiftRes, myRes, patternRes, meRes] = await Promise.all([
        fetch(`${apiBase}/api/masters/WARD`, { headers: authHeaders }),
        fetch(`${apiBase}/api/masters/SHIFT`, { headers: authHeaders }),
        fetch(`${apiBase}/api/schedules/my`, { headers: authHeaders }),
        fetch(`${apiBase}/api/master-patterns`, { headers: authHeaders }),
        fetch(`${apiBase}/api/users/me`, { headers: authHeaders })
    ]);

    const wardJson = await wardRes.json();
    const shiftJson = await shiftRes.json();
    const myJson = await myRes.json();
    const patternJson = await patternRes.json();
    const meJson = await meRes.json();

    if (!wardRes.ok || !shiftRes.ok || !myRes.ok || !patternRes.ok || !meRes.ok) {
        const message = wardJson?.message || shiftJson?.message || myJson?.message || patternJson?.message || meJson?.message || 'Failed to load schedule data';
        scheduleEl.html(`<div class="settings-placeholder">${message}</div>`);
        return;
    }

    const wards = Array.isArray(wardJson.data) ? wardJson.data : [];
    const shifts = Array.isArray(shiftJson.data) ? shiftJson.data : [];
    const schedules = Array.isArray(myJson.data) ? myJson.data : [];
    const patterns = Array.isArray(patternJson.data) ? patternJson.data : [];
    const profile = meJson?.data || {};
    const isEmailVerified = !!profile.emailVerified;

    const shiftCodes = shifts.map(s => s.code);
    const scheduleMap = new Map();
    const shiftMetaByCode = new Map(shifts.map(s => [String(s.code).toUpperCase(), s.meta || {}]));
    const getKey = (date, wardId) => `${new Date(date).toDateString()}|${wardId || 'ALL'}`;

    schedules.forEach(s => {
        const wardId = String(s.wardId?._id || s.wardId);
        const key = getKey(s.workDate, wardId);
        if (!scheduleMap.has(key)) scheduleMap.set(key, []);
        scheduleMap.get(key).push(s.shiftCode);
    });

    const wardItems = [{ _id: 'ALL', name: 'All Wards' }, ...wards];
    let wardFilterInstance;
    let patternFilterInstance;
    let selectedDate = new Date();
    let bookingOpen = false;

    const checkBookingWindow = async () => {
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
        if (!wardId || wardId === 'ALL') {
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

    wardSelectEl.dxSelectBox({
        items: wardItems,
        displayExpr: 'name',
        valueExpr: '_id',
        value: 'ALL',
        width: 220,
        placeholder: 'Select ward',
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
            const wardId = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
            if (!wardId || wardId === 'ALL') {
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
                body: JSON.stringify({ schedules: schedulesToCreate })
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
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
        const keyDate = new Date(date).toDateString();
        if (!wardId || wardId === 'ALL') {
            // aggregate all wards for that date
            const codes = [];
            for (const [key, value] of scheduleMap.entries()) {
                if (key.startsWith(keyDate + '|')) {
                    codes.push(...value);
                }
            }
            return codes;
        }
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
                codes.forEach(c => {
                    const meta = shiftMetaByCode.get(String(c).toUpperCase()) || {};
                    const chip = $('<span>', { class: 'schedule-shift-chip', text: c });
                    if (meta.color) {
                        chip.css('background-color', meta.color);
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
        const wardId = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
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
                const wardId = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
                if (!wardId || wardId === 'ALL') {
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
                        meta: {}
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

    prevBtn.on('click', () => {
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
        renderCalendar();
    });
    nextBtn.on('click', () => {
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
        renderCalendar();
    });

    await checkBookingWindow();
    renderCalendar();
};
    
