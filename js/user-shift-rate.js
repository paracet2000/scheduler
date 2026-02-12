/* global $, DevExpress, Common */
'use strict';

window.renderUserShiftRate = async function renderUserShiftRate() {
    if (typeof window.showPage === 'function') {
        window.showPage('settingsSystem');
    }
    if (typeof window.setDrawerState === 'function') {
        window.setDrawerState(3);
    }

    const $userHead = $('#headFormUser');
    const $shiftHead = $('#headFormShift');
    const $formRoot = $('#ShiftRateForm');

    if (!$userHead.length || !$shiftHead.length || !$formRoot.length) {
        return;
    }

    $userHead.empty();
    $shiftHead.empty();
    $formRoot.empty();

    const $userLabel = $('<div>', { class: 'dashboard-card-label', text: 'User' });
    const $shiftLabel = $('<div>', { class: 'dashboard-card-label', text: 'Shift' });
    const $userLookupHost = $('<div>', { id: 'headUserLookupControl' });
    const $shiftLookupHost = $('<div>', { id: 'headShiftLookupControl' });
    $userHead.append($userLabel, $userLookupHost);
    $shiftHead.append($shiftLabel, $shiftLookupHost);

    let users = [];
    let shifts = [];
    let selectedUserId = '';
    let selectedShiftCode = '';
    let currentRateId = null;
    let formInstance = null;

    const defaultFormData = () => ({
        amount: null,
        currency: 'THB',
        status: 'ACTIVE'
    });
    let formData = defaultFormData();

    const userText = (u) => (u ? `${u.employeeCode || ''} ${u.name || ''}`.trim() : '');
    const shiftText = (s) => (s ? String(s.name || s.code || '').trim() : '');

    const safeValidate = () => {
        if (!formInstance || typeof formInstance.validate !== 'function') return;
        setTimeout(() => {
            try { formInstance.validate(); } catch {}
        }, 0);
    };

    const renderDetailForm = () => {
        $formRoot.empty();
        const $form = $('<div>', { id: 'userShiftRateDetailForm' }).appendTo($formRoot);

        $form.dxForm({
            formData: { ...formData },
            colCount: 1,
            labelMode: 'floating',
            items: [
                {
                    dataField: 'amount',
                    label: { text: 'Amount' },
                    editorType: 'dxNumberBox',
                    validationRules: [
                        { type: 'required' },
                        { type: 'range', min: 0, message: 'Amount must be >= 0' }
                    ],
                    editorOptions: {
                        min: 0,
                        showSpinButtons: true
                    }
                },
                {
                    dataField: 'currency',
                    label: { text: 'Currency' },
                    editorType: 'dxTextBox',
                    editorOptions: {
                        valueChangeEvent: 'keyup'
                    }
                },
                {
                    dataField: 'status',
                    label: { text: 'Status' },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: ['ACTIVE', 'INACTIVE']
                    }
                },
                {
                    itemType: 'button',
                    horizontalAlignment: 'left',
                    buttonOptions: {
                        text: 'Save',
                        type: 'success',
                        onClick: async () => {
                            if (!formInstance) return;
                            const validated = formInstance.validate();
                            if (!validated?.isValid) return;
                            if (!selectedUserId || !selectedShiftCode) {
                                DevExpress.ui.notify('Please select user and shift first', 'warning', 2000);
                                return;
                            }

                            const values = formInstance.option('formData') || {};
                            const payload = {
                                userId: selectedUserId,
                                shiftCode: selectedShiftCode,
                                amount: Number(values.amount || 0),
                                currency: String(values.currency || 'THB').toUpperCase(),
                                status: values.status || 'ACTIVE'
                            };

                            let res;
                            if (currentRateId) {
                                res = await Common.putWithAuth(`/api/user-shift-rates/${currentRateId}`, {
                                    body: JSON.stringify({
                                        amount: payload.amount,
                                        currency: payload.currency,
                                        status: payload.status
                                    })
                                });
                            } else {
                                res = await Common.postWithAuth('/api/user-shift-rates', {
                                    body: JSON.stringify(payload)
                                });
                            }

                            const json = await res.json();
                            if (!res.ok) {
                                DevExpress.ui.notify(json.message || 'Save failed', 'error', 3000);
                                return;
                            }

                            DevExpress.ui.notify(currentRateId ? 'Updated' : 'Created', 'success', 1500);
                            await loadRateAndRender(selectedUserId, selectedShiftCode);
                        }
                    }
                }
            ],
            onFieldDataChanged: () => safeValidate(),
            onInitialized: (e) => {
                formInstance = e.component;
                safeValidate();
            }
        });
    };

    const loadRateAndRender = async (userId, shiftCode) => {
        currentRateId = null;
        formData = defaultFormData();

        if (!userId || !shiftCode) {
            renderDetailForm();
            safeValidate();
            return;
        }

        const query = `?userIds=${encodeURIComponent(userId)}&shiftCode=${encodeURIComponent(shiftCode)}`;
        const res = await Common.fetchWithAuth(`/api/user-shift-rates${query}`);
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load user shift rate');
        }

        const rows = Array.isArray(json.data) ? json.data : [];
        const row = rows.find((r) =>
            String(r.shiftCode || '').toUpperCase() === String(shiftCode || '').toUpperCase()
        ) || null;

        if (row) {
            currentRateId = row._id || null;
            formData = {
                amount: Number(row.amount || 0),
                currency: String(row.currency || 'THB').toUpperCase(),
                status: row.status || 'ACTIVE'
            };
        }

        renderDetailForm();
        safeValidate();
    };

    try {
        const metaRes = await Common.fetchWithAuth('/api/user-shift-rates/meta');
        const metaJson = await metaRes.json();
        if (!metaRes.ok) {
            throw new Error(metaJson.message || 'Failed to load user shift rate meta');
        }
        users = Array.isArray(metaJson?.data?.users) ? metaJson.data.users : [];
        shifts = Array.isArray(metaJson?.data?.shifts) ? metaJson.data.shifts : [];
    } catch (err) {
        $formRoot.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load user shift rate page.'
            })
        );
        return;
    }

    $userLookupHost.dxLookup({
        dataSource: users,
        valueExpr: '_id',
        displayExpr: userText,
        placeholder: 'Select user',
        searchEnabled: true,
        fullScreen: true,
        showPopupTitle: true,
        popupTitle: 'Select User',
        value: users[0]?._id || null,
        onValueChanged: async (e) => {
            selectedUserId = e.value || '';
            try {
                await loadRateAndRender(selectedUserId, selectedShiftCode);
            } catch (err) {
                DevExpress.ui.notify(err.message || 'Load failed', 'error', 3000);
            }
        }
    });

    $shiftLookupHost.dxLookup({
        dataSource: shifts,
        valueExpr: 'code',
        displayExpr: shiftText,
        placeholder: 'Select shift',
        searchEnabled: true,
        fullScreen: true,
        showPopupTitle: true,
        popupTitle: 'Select Shift',
        value: shifts[0]?.code || null,
        onValueChanged: async (e) => {
            selectedShiftCode = String(e.value || '').toUpperCase();
            try {
                await loadRateAndRender(selectedUserId, selectedShiftCode);
            } catch (err) {
                DevExpress.ui.notify(err.message || 'Load failed', 'error', 3000);
            }
        }
    });

    selectedUserId = users[0]?._id || '';
    selectedShiftCode = String(shifts[0]?.code || '').toUpperCase();
    try {
        await loadRateAndRender(selectedUserId, selectedShiftCode);
    } catch (err) {
        DevExpress.ui.notify(err.message || 'Load failed', 'error', 3000);
    }
};
