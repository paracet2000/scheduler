// js/kpi.js
// KPI Entry (Head)
window.renderKpiEntry = async function renderKpiEntry() {
    if (typeof window.showPage === 'function') {
        window.showPage('kpiEntry');
    }

    const roles = typeof window.getStoredRoles === 'function' ? window.getStoredRoles() : [];
    const isHead = roles.includes('head');
    const isAdmin = roles.includes('admin');

    const container = $('#kpiEntryForm');
    container.empty();

    if (!isHead && !isAdmin) {
        container.append($('<div>', { class: 'settings-placeholder', text: 'KPI entry is available for head/admin only.' }));
        return;
    }

    const apiBase = window.BASE_URL || 'http://localhost:3000';
    const token = localStorage.getItem('auth_token');
    const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

    let wards = [];
    let shifts = [];
    let definitions = [];

    try {
        const [wardRes, defRes] = await Promise.all([
            fetch(`${apiBase}/api/ward-members/mine`, { headers: authHeaders() }),
           
            fetch(`${apiBase}/api/kpi/definitions?status=ACTIVE`, { headers: authHeaders() })
        ]);
        const wardJson = await wardRes.json();
        
        const defJson = await defRes.json();
        if (!wardRes.ok) throw new Error(wardJson.message || 'Failed to load wards');
        
        if (!defRes.ok) throw new Error(defJson.message || 'Failed to load KPI definitions');
        wards = Array.isArray(wardJson.data) ? wardJson.data : [];
        shifts = [
            { code: 'M', desc: 'Morning' },
            { code: 'A', desc: 'Afternoon' },
            { code: 'N', desc: 'Night' }
        ]; // Fixed shifts
        definitions = Array.isArray(defJson.data) ? defJson.data : [];
    } catch (err) {
        container.append($('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load KPI meta.' }));
        return;
    }

    if (!wards.length) {
        container.append($('<div>', { class: 'settings-placeholder', text: 'No ward membership found.' }));
        return;
    }

    const guessShiftCode = (list) => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeValue = hour + minute / 60;
        let bucket = 'N';
        if (timeValue < 10) {
            bucket = 'N';
        } else if (timeValue < 18) {
            bucket = 'M';
        } else if (timeValue < 23.5) {
            bucket = 'A';
        } else {
            bucket = 'N';
        }
       return bucket;
    };

    const guessedShift = guessShiftCode(shifts);
    const normalizedShift = shifts.some(s => s.code === guessedShift) ? guessedShift : null;
    const nowDate = new Date();
    const isNight = String(guessedShift || '').toUpperCase().startsWith('N');
    const usePrevDate = isNight && nowDate.getHours() < 10;
    const entryDate = usePrevDate
        ? new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - 1)
        : nowDate;

    const formData = {
        wardId: wards[0]?._id || null,
        shiftCode: normalizedShift,
        date: entryDate
    };

    const buildDynamicItems = () => {
        const list = definitions
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const items = [];
        let colIndex = 0;

        list.forEach((def) => {
            if (def.valueType === 'group') {
                if (colIndex !== 0) {
                    items.push({ itemType: 'empty', colSpan: 2 - colIndex });
                    colIndex = 0;
                }
                items.push({
                    itemType: 'group',
                    caption: def.name,
                    colSpan: 2,
                    items: []
                });
                return;
            }

            const field = `values.${def.code}`;
            let item;
            if (def.valueType === 'boolean') {
                item = {
                    dataField: field,
                    label: { text: def.name },
                    editorType: 'dxCheckBox'
                };
            } else if (def.valueType === 'select') {
                item = {
                    dataField: field,
                    label: { text: def.name },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        items: def.options || []
                    }
                };
            } else if (def.valueType === 'text') {
                item = {
                    dataField: field,
                    label: { text: def.name },
                    editorType: 'dxTextBox'
                };
            } else {
                item = {
                    dataField: field,
                    label: { text: `${def.name}${def.unit ? ` (${def.unit})` : ''}` },
                    editorType: 'dxNumberBox',
                    editorOptions: {
                        value: 0,
                        min: 0,
                        showSpinButtons: true,
                        onValueChanged(e) {
                            if (e.value === null || e.value === '') {
                                e.component.option('value', 0);
                            }
                        }
                    }
                };
            }

            items.push(item);
            colIndex = (colIndex + 1) % 2;
        });

        return items;
    };

    let isLoadingEntry = false;
    let lastLoadKey = '';
    let loadTimer = null;
    const applyEntryValues = (values) => {
        const form = $('#kpiEntryDxForm').dxForm('instance');
        if (!form) return;
        isLoadingEntry = true;
        const nextData = { ...form.option('formData'), values: values || {} };
        form.option('formData', nextData);
        setTimeout(() => { isLoadingEntry = false; }, 0);
    };

    const loadEntry = async (wardId, shiftCode, date) => {
        if (!wardId || !shiftCode || !date) return;
        const iso = new Date(date);
        const dateStr = iso.toISOString().slice(0, 10);
        const key = `${wardId}|${shiftCode}|${dateStr}`;
        if (key === lastLoadKey) return;
        lastLoadKey = key;
        try {
            const res = await fetch(`${apiBase}/api/kpi/entries?wardId=${wardId}&shiftCode=${shiftCode}&date=${dateStr}`, {
                headers: authHeaders()
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Load entry failed');
            const entry = json.data;
            applyEntryValues(entry?.values || {});
        } catch (err) {
            DevExpress.ui.notify(err.message || 'Load entry failed', 'error', 2000);
            applyEntryValues({});
        }
    };

    container.append('<div id="kpiEntryDxForm"></div>');
    const saveKpi = async () => {
        const instance = $('#kpiEntryDxForm').dxForm('instance');
        const result = instance.validate(); 
              
        if (!result.isValid) {
            DevExpress.ui.notify('Please complete required fields.', 'warning', 2000);
            return;
        }
        const data = instance.option('formData');
        console.log('Saving KPI Data: ',data); //correct data
        if (!data.wardId || !data.shiftCode || !data.date) {
            DevExpress.ui.notify('Ward, Shift, and Date are required.', 'warning', 2000);
            return;
        }
        // save to server
        try {
            const res = await fetch(`${apiBase}/api/kpi/entries`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',     
                    ...authHeaders()
                },
                body: JSON.stringify(data)
            });
            const resJson = await res.json();
            if (!res.ok) throw new Error(resJson.message || 'Failed to save KPI entry');
            DevExpress.ui.notify('KPI entry saved successfully.', 'success', 2000); 
        } catch (err) {
            console.error('Error saving KPI entry:', err);
            DevExpress.ui.notify(err.message || 'Error saving KPI entry.', 'error', 3000);
        }
    };
    
    const form = $('#kpiEntryDxForm').dxForm({
        formData,
        colCount: 3,
        showValidationSummary: true,
        onEditorPreparing: (e) => {
            if (e.parentType !== 'dataField') return;
            const original = e.editorOptions?.onKeyDown;
            e.editorOptions.onKeyDown = (args) => {
                if (typeof original === 'function') original(args);
                const evt = args.event;
                if (!evt || evt.key !== 'Enter') return;
                evt.preventDefault();
                const $form = $('#kpiEntryDxForm');
                const $inputs = $form.find('input, textarea, select, .dx-texteditor-input')
                    .filter(':visible')
                    .filter(function () {
                        return !$(this).prop('disabled') && !$(this).attr('readonly');
                    });
                const idx = $inputs.index(evt.target);
                if (idx >= 0 && idx < $inputs.length - 1) {
                    $inputs.eq(idx + 1).focus().select();
                }
            };
        },
        items: [
            {
                dataField: 'wardId',
                label: { text: 'Ward' },
                editorType: 'dxSelectBox',
                editorOptions: {
                    items: wards,
                    displayExpr: 'name',
                    valueExpr: '_id',
                    onBlur: () => {
                        const data = form.option('formData');
                        loadEntry(data.wardId, data.shiftCode, data.date);
                    }
                },
                colSpan: 1,
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'shiftCode',
                label: { text: 'Shift' },
                editorType: 'dxSelectBox',
                editorOptions: {
                    items: shifts,
                    displayExpr: 'code',
                    valueExpr: 'code',
                    onBlur: () => {
                        const data = form.option('formData');
                        loadEntry(data.wardId, data.shiftCode, data.date);
                    }
                },
                colSpan: 1,
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'date',
                label: { text: 'Date' },
                editorType: 'dxDateBox',
                editorOptions: {
                    displayFormat: 'dd/MM/yyyy',
                    onBlur: () => {
                        const data = form.option('formData');
                        loadEntry(data.wardId, data.shiftCode, data.date);
                    }
                },
                colSpan: 1,
                validationRules: [{ type: 'required' }]
            },
            {
                itemType: 'group',
                colSpan: 3,
                colCount: 2,
                caption: '',
                items: buildDynamicItems()
            },
            {
                itemType: 'button',
                colSpan: 3,
                horizontalAlignment: 'left',
                buttonOptions: {
                    text: 'ส่งข้อมูล',
                    type: 'success',
                    onClick: saveKpi
                }
            }
        ]
    }).dxForm('instance');
    // Enter-to-next field (fallback for editors that don't trigger onKeyDown)
    container.off('keydown.kpiEnter').on('keydown.kpiEnter', '.dx-texteditor-input, textarea, input', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const $form = $('#kpiEntryDxForm');
        const $inputs = $form.find('.dx-texteditor-input, textarea, input')
            .filter(':visible')
            .filter(function () {
                return !$(this).prop('disabled') && !$(this).attr('readonly');
            });
        const idx = $inputs.index(e.target);
        if (idx >= 0 && idx < $inputs.length - 1) {
            $inputs.eq(idx + 1).focus().select();
        }
    });

    // initial load if defaults are present
    loadEntry(formData.wardId, formData.shiftCode, formData.date);
};
