// js/schedule.js
// Personal Schedule Booking (Scheduler)
window.renderSchedule = async function renderSchedule() {
    if (typeof window.showPage === 'function') {
        window.showPage('schedule');
    }

    const apiBase = window.BASE_URL || 'http://localhost:3000';
    const token = localStorage.getItem('auth_token');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const [wardRes, shiftRes, myRes] = await Promise.all([
        fetch(`${apiBase}/api/masters/WARD`, { headers: authHeaders }),
        fetch(`${apiBase}/api/masters/SHIFT`, { headers: authHeaders }),
        fetch(`${apiBase}/api/schedules/my`, { headers: authHeaders })
    ]);

    const wardJson = await wardRes.json();
    const shiftJson = await shiftRes.json();
    const myJson = await myRes.json();

    if (!wardRes.ok || !shiftRes.ok || !myRes.ok) {
        const message = wardJson?.message || shiftJson?.message || myJson?.message || 'Failed to load schedule data';
        $('#personalScheduler').empty().append(
            $('<div>', { class: 'settings-placeholder', text: message })
        );
        return;
    }

    const wards = Array.isArray(wardJson.data) ? wardJson.data : [];
    const shifts = Array.isArray(shiftJson.data) ? shiftJson.data : [];
    const schedules = Array.isArray(myJson.data) ? myJson.data : [];

    const wardById = new Map(wards.map(w => [String(w._id), w]));
    const shiftByCode = new Map(shifts.map(s => [String(s.code), s]));

    const defaultShiftColors = {
        M: '#bfdbfe',
        A: '#fde68a',
        N: '#c7d2fe'
    };

    const appointments = schedules.map(s => {
        const shift = shiftByCode.get(String(s.shiftCode));
        const shiftName = shift?.code || s.shiftCode || 'SHIFT';
        const shiftColor = shift?.meta?.color || defaultShiftColors[shiftName] || '#e2e8f0';
        return {
            id: s._id,
            text: shiftName,
            startDate: new Date(s.workDate),
            endDate: new Date(s.workDate),
            allDay: true,
            wardId: s.wardId?._id || s.wardId,
            shiftCode: s.shiftCode,
            color: shiftColor
        };
    });

    const schedulerEl = $('#personalScheduler');

    const wardItems = [{ _id: 'ALL', name: 'All Wards' }, ...wards];
    let wardFilterInstance;
    let pendingShiftCodes = [];

    const schedulerInstance = schedulerEl.dxScheduler({
        dataSource: appointments,
        views: ['month'],
        currentView: 'month',
        currentDate: new Date(),
        startDayHour: 6,
        endDayHour: 22,
        height: 700,
        toolbar: {
            items: [
                { name: 'dateNavigator', location: 'before' },
                {
                    location: 'after',
                    widget: 'dxSelectBox',
                    options: {
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
                            applyWardFilter();
                        }
                    }
                }
            ]
        },
        editing: {
            allowAdding: true,
            allowUpdating: false,
            allowDeleting: false
        },
        onAppointmentFormOpening: (e) => {
            const form = e.form;
            const selectedWard = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';

            if (e.popup) {
                e.popup.option('title', 'Shift Code');
            }

            const getDateKey = (d) => new Date(d).toDateString();
            const wardId = selectedWard && selectedWard !== 'ALL' ? selectedWard : e.appointmentData.wardId;
            const targetDate = e.appointmentData.startDate || new Date();

            const existingShiftCodes = appointments
                .filter(a => String(a.wardId) === String(wardId) && getDateKey(a.startDate) === getDateKey(targetDate))
                .map(a => a.shiftCode);
            const selectedShiftCodes = new Set(existingShiftCodes);
            pendingShiftCodes = Array.from(selectedShiftCodes);
            e.appointmentData.shiftCodes = pendingShiftCodes;

            form.option('items', [
                {
                    dataField: 'startDate',
                    label: { text: 'Work Date' },
                    editorType: 'dxDateBox',
                    editorOptions: { type: 'date' }
                },
                {
                    itemType: 'simple',
                    label: { text: 'Shift Code' },
                    template: () => {
                        const wrap = $('<div>', { class: 'shift-code-list' });
                        shifts.forEach(shift => {
                            const isChecked = selectedShiftCodes.has(shift.code);
                            const row = $('<div>', { class: 'shift-code-item' });
                            const box = $('<div>').dxCheckBox({
                                value: isChecked,
                                text: `${shift.code} - ${shift.name}`,
                                onValueChanged(ev) {
                                    if (ev.value) {
                                        if (selectedShiftCodes.size >= 3) {
                                            DevExpress.ui.notify('Select up to 3 shifts per day', 'warning', 2000);
                                            const inst = $(this).dxCheckBox('instance');
                                            inst.option('value', false);
                                            return;
                                        }
                                        selectedShiftCodes.add(shift.code);
                                    } else {
                                        selectedShiftCodes.delete(shift.code);
                                    }
                                    pendingShiftCodes = Array.from(selectedShiftCodes);
                                    e.appointmentData.shiftCodes = pendingShiftCodes;
                                }
                            });
                            row.append(box);
                            wrap.append(row);
                        });
                        return wrap;
                    }
                }
            ]);

            e.appointmentData.allDay = true;
            e.appointmentData.endDate = e.appointmentData.startDate;

            if (selectedWard && selectedWard !== 'ALL') {
                e.appointmentData.wardId = selectedWard;
            }
        },
        onAppointmentAdding: async (e) => {
            const data = e.appointmentData;
            const selectedWard = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
            if (!data.wardId && selectedWard && selectedWard !== 'ALL') {
                data.wardId = selectedWard;
            }
            if (!data.wardId || data.wardId === 'ALL') {
                e.cancel = true;
                DevExpress.ui.notify('Please select a ward', 'warning', 2000);
                return;
            }

            const codes = Array.isArray(data.shiftCodes) ? data.shiftCodes
                : (data.shiftCode ? [data.shiftCode] : pendingShiftCodes);
            console.log('Codes Data: ',codes); // always empty Array(0)
            const uniqueCodes = Array.from(new Set(codes)).slice(0, 3);
            console.log('uniqueCodes Data: ',uniqueCodes); // always empty Array(0)
            if (!uniqueCodes.length) {
                e.cancel = true;
                DevExpress.ui.notify('Please select shift code', 'warning', 2000);
                return;
            }

            const payload = {
                schedules: uniqueCodes.map(code => ({
                    workDate: data.startDate,
                    wardId: data.wardId,
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
                e.cancel = true;
                DevExpress.ui.notify(json.message || 'Booking failed', 'error', 3000);
                return;
            }
            // Update UI with new shift codes
            uniqueCodes.forEach(code => {
                const shift = shiftByCode.get(String(code));
                const shiftColor = shift?.meta?.color || defaultShiftColors[code] || '#e2e8f0';
                appointments.push({
                    id: `${Date.now()}-${code}`,
                    text: code,
                    startDate: new Date(data.startDate),
                    endDate: new Date(data.startDate),
                    allDay: true,
                    wardId: data.wardId,
                    shiftCode: code,
                    color: shiftColor
                });
            });
            schedulerInstance.option('dataSource', appointments);
            applyWardFilter();
            DevExpress.ui.notify('Booked', 'success', 2000);
            pendingShiftCodes = [];
        },
        onAppointmentRendered: (e) => {
            const appt = e.appointmentData;
            const start = appt.startDate instanceof Date ? appt.startDate : new Date(appt.startDate);
            const day = start.getDay();
            const isWeekend = day === 0 || day === 6;

            const $el = e.appointmentElement;
            if (appt.color) {
                $el.css('background-color', appt.color);
                $el.css('border-color', appt.color);
            }
            if (isWeekend) {
                $el.css('color', '#dc2626');
            }
        }
    }).dxScheduler('instance');

    const applyWardFilter = () => {
        const selected = wardFilterInstance ? wardFilterInstance.option('value') : 'ALL';
        if (!selected || selected === 'ALL') {
            schedulerInstance.option('dataSource', appointments);
            return;
        }
        const filtered = appointments.filter(a => String(a.wardId) === String(selected));
        schedulerInstance.option('dataSource', filtered);
    };
    applyWardFilter();
};
