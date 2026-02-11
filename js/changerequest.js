// js/changerequest.js
// Change Request (User)
window.renderChangeRequest = async function renderChangeRequest() {
    if (typeof window.showPage === 'function') {
        window.showPage('change');
    }

    const changeEl = $('#change');
    changeEl.empty();

    const header = $('<div>', { class: 'settings-placeholder', text: 'Create Change Request' });
    const formWrap = $('<div>', { id: 'changeRequestForm' });
    const gridWrap = $('<div>', { id: 'changeRequestGrid', class: 'dx-grid change-request-grid' });
    const actions = $('<div>', { class: 'form-actions-left' });
    const btnSubmit = $('<div>', { id: 'btnChangeSubmit' });
    const btnReset = $('<div>', { id: 'btnChangeReset' });
    actions.append(btnSubmit, btnReset);

    changeEl.append(header, formWrap, gridWrap, actions);

    let selectedMonth = new Date();
    let schedules = [];
    let gridInstance;
    let changeForm;
    let swapCandidates = [];

    const monthNav = $('<div>', { class: 'schedule-month-nav' });
    const prevBtn = $('<button>', { class: 'schedule-nav-btn', text: '<' });
    const nextBtn = $('<button>', { class: 'schedule-nav-btn', text: '>' });
    const monthLabel = $('<div>', { class: 'schedule-month-label' });
    monthNav.append(prevBtn, monthLabel, nextBtn);
    formWrap.before(monthNav);

    const getMonthLabel = (date) => date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const updateMonthLabel = () => monthLabel.text(getMonthLabel(selectedMonth));

    const loadSchedules = async () => {
        const res = await Common.fetchWithAuth('/api/schedules/my');
        const json = await res.json();
        console.log('json Data on change: ',json);
        if (!res.ok) {
            DevExpress.ui.notify(json.message || 'Failed to load schedules', 'error', 3000);
            return [];
        }
        return Array.isArray(json.data) ? json.data : [];
    };

    const renderGrid = () => {
        const month = selectedMonth.getMonth();
        const year = selectedMonth.getFullYear();
        const filtered = schedules.filter(s => {
            const d = new Date(s.workDate);
            return d.getMonth() === month && d.getFullYear() === year;
        });

        const data = filtered.map(s => ({
            _id: s._id,
            wardId: s.wardId?._id || s.wardId || null,
            date: s.workDate,
            shiftCode: s.shiftCode,
            ward: s.wardId?.name || s.wardId?.code || ''
        }));

        if (gridInstance) {
            gridInstance.option('dataSource', data);
            gridInstance.clearSelection();
            return;
        }

        gridInstance = gridWrap.dxDataGrid({
            dataSource: data,
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            selection: { mode: 'multiple' },
            columns: [
                { dataField: 'date', caption: 'Date', dataType: 'date' },
                { dataField: 'shiftCode', caption: 'Shift' },
                { dataField: 'ward', caption: 'Ward' }
            ]
        }).dxDataGrid('instance');
    };

    prevBtn.on('click', () => {
        selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
        updateMonthLabel();
        renderGrid();
    });
    nextBtn.on('click', () => {
        selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
        updateMonthLabel();
        renderGrid();
    });

    updateMonthLabel();

    changeForm = $('#changeRequestForm').dxForm({
        formData: {
            type: 'LEAVE',
            reason: ''
        },
        colCount: 1,
        items: [
            {
                dataField: 'type',
                label: { text: 'Type' },
                editorType: 'dxSelectBox',
                editorOptions: {
                    items: [
                        { value: 'LEAVE', text: 'Leave' },
                        { value: 'SWAP', text: 'Swap' },
                        { value: 'CHANGE', text: 'Change' }
                    ],
                    displayExpr: 'text',
                    valueExpr: 'value',
                    onValueChanged: async (e) => {
                        if (e.value === 'SWAP') {
                            changeForm.itemOption('acceptedBy', 'visible', true);
                            await loadSwapCandidates();
                        } else {
                            changeForm.itemOption('acceptedBy', 'visible', false);
                        }
                    }
                }
            },
            {
                dataField: 'acceptedBy',
                label: { text: 'Change with' },
                visible: false,
                editorType: 'dxSelectBox',
                editorOptions: {
                    items: swapCandidates,
                    displayExpr: (item) => item ? `${item.employeeCode || ''} ${item.name || ''}`.trim() : '',
                    valueExpr: '_id',
                    searchEnabled: true
                }
            },
            {
                dataField: 'reason',
                label: { text: 'Reason' },
                editorType: 'dxTextArea',
                editorOptions: { minHeight: 80 }
            }
        ]
    }).dxForm('instance');

    const loadSwapCandidates = async () => {
        const selected = gridInstance ? gridInstance.getSelectedRowsData() : [];
        if (!selected.length) return;
        const wardId = selected[0].wardId;
        if (!wardId) return;

        const meRes = await Common.fetchWithAuth(`/api/ward-members/me?wardId=${wardId}`);
        const meJson = await meRes.json();
        if (!meRes.ok) return;
        const myPosition = meJson?.data?.position;

        const positionQuery = myPosition ? `&position=${encodeURIComponent(myPosition)}` : '';
        const res = await Common.fetchWithAuth(`/api/ward-members/users?wardId=${wardId}${positionQuery}&excludeSelf=1`);
        const json = await res.json();
        if (!res.ok) return;
        swapCandidates = Array.isArray(json.data) ? json.data : [];
        changeForm.getEditor('acceptedBy')?.option('items', swapCandidates);
    };

    btnSubmit.dxButton({
        text: 'Submit Request',
        type: 'default',
        onClick: async () => {
            const data = changeForm.option('formData') || {};
            const selected = gridInstance ? gridInstance.getSelectedRowsData() : [];
            if (!selected.length) {
                DevExpress.ui.notify('Please select at least one schedule', 'warning', 2000);
                return;
            }

            if (data.type === 'SWAP' && !data.acceptedBy) {
                DevExpress.ui.notify('Please select Change with', 'warning', 2000);
                return;
            }

            const meRes = await Common.fetchWithAuth('/api/users/me');
            const meJson = await meRes.json();
            if (meRes.ok) {
                const me = meJson?.data || {};
                if (!me.email || !me.phone) {
                    DevExpress.ui.notify('Please set email and phone in Personal Settings first', 'warning', 3000);
                    if (typeof window.renderPersonalSettings === 'function') {
                        window.renderPersonalSettings();
                    }
                    return;
                }
            }

            const affectedSchedules = selected.map(s => ({
                scheduleId: s._id,
                date: s.date,
                shiftCode: s.shiftCode
            }));

            const res = await Common.postWithAuth('/api/changes', {
                body: JSON.stringify({
                    type: data.type,
                    reason: data.reason,
                    acceptedBy: data.acceptedBy || null,
                    affectedSchedules
                })
            });
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Create request failed', 'error', 3000);
                return;
            }

            DevExpress.ui.notify('Request created', 'success', 2000);
            gridInstance.clearSelection();
            changeForm.resetValues();
        }
    });

    btnReset.dxButton({
        text: 'Reset',
        type: 'normal',
        onClick: () => {
            changeForm.resetValues();
            if (gridInstance) gridInstance.clearSelection();
        }
    });

    schedules = await loadSchedules();
    renderGrid();
};
