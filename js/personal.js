// js/personal.js
// Personal Settings UI
window.renderPersonalSettings = async function renderPersonalSettings() {
    if (typeof window.showPage === 'function') {
        window.showPage('personalSettingPage');
    }
    if (!Common.getToken()) {
        if (typeof window.renderLogin === 'function') {
            window.renderLogin();
        }
        return;
    }

    $('#profileForm').empty();
    $('#btnPersonalSave').empty();
    $('#wardMemberInfoGrid').empty();
    $('#myShiftRateGrid').empty();
    $('#passwordForm').empty();
    $('#btnPasswordSave').empty();

    const toUpper = (value) => String(value || '').trim().toUpperCase();
    const formatAmount = (value) => Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    const fetchList = async (url, fallbackMessage, logTag = '') => {
        try {
            if (logTag) {
                console.log(`[personal] ${logTag} request`, { url });
            }
            const res = await Common.fetchWithAuth(url);
            const json = await res.json();
            if (logTag) {
                console.log(`[personal] ${logTag} response`, {
                    status: res.status,
                    ok: res.ok,
                    message: json?.message || '',
                    count: Array.isArray(json?.data) ? json.data.length : 0,
                    sample: Array.isArray(json?.data) && json.data.length ? json.data[0] : null
                });
            }
            if (!res.ok) {
                throw new Error(json.message || fallbackMessage);
            }
            return {
                data: Array.isArray(json?.data) ? json.data : [],
                error: ''
            };
        } catch (err) {
            if (logTag) {
                console.error(`[personal] ${logTag} error`, {
                    url,
                    message: err.message || fallbackMessage
                });
            }
            return {
                data: [],
                error: err.message || fallbackMessage
            };
        }
    };

    let profile = null;
    try {
        const res = await Common.fetchWithAuth('/api/users/me');
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load profile');
        }
        profile = json.data || null;
        if (!profile?._id) {
            throw new Error('Profile is invalid');
        }
    } catch (err) {
        $('#personalSettingPage').prepend(
            $('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load profile.' })
        );
        return;
    }

    const [wardRes, rateRes, shiftRes, positionRes] = await Promise.all([
        fetchList(`/api/ward-members?userId=${encodeURIComponent(profile._id)}&status=ACTIVE`, 'Unable to load ward member info.', 'Ward Member'),
        fetchList(`/api/user-shift-rates?userIds=${encodeURIComponent(profile._id)}&status=ACTIVE`, 'Unable to load shift rates.', 'My Shift Rates'),
        fetchList('/api/configuration?typ_code=SHIFT', 'Unable to load shift master data.'),
        fetchList('/api/configuration?typ_code=POST', 'Unable to load position master data.')
    ]);

    const shiftNameMap = new Map(
        shiftRes.data.map((s) => [
            toUpper(s.conf_code || s.code),
            s.conf_description || s.name || ''
        ]).filter(([code]) => code)
    );

    const positionNameMap = new Map(
        positionRes.data.map((p) => [
            toUpper(p.conf_code || p.code),
            p.conf_description || p.name || ''
        ]).filter(([code]) => code)
    );

    const wardMemberRows = wardRes.data
        .map((item) => {
            const wardObj = item?.wardId || {};
            const wardName = wardObj.conf_description || wardObj.name || '-';
            const wardCode = wardObj.conf_code || wardObj.code || '';
            const positionCode = toUpper(item?.position || '');
            const positionName = positionNameMap.get(positionCode) || positionCode || '-';
            const roles = Array.isArray(item?.roles) ? item.roles : [];
            return {
                _id: item?._id || `${String(item?.userId?._id || item?.userId || '')}-${String(item?.wardId?._id || item?.wardId || '')}`,
                ward: wardCode ? `${wardName} (${wardCode})` : wardName,
                position: positionName,
                roles: roles.join(', ') || '-',
                status: item?.status || '-'
            };
        })
        .sort((a, b) => String(a.ward).localeCompare(String(b.ward)));
    console.log('[personal] Ward Member rows (form)', {
        count: wardMemberRows.length,
        sample: wardMemberRows.length ? wardMemberRows[0] : null
    });

    const shiftRateRows = rateRes.data
        .map((item) => {
            const shiftCode = toUpper(item?.shiftCode || '');
            return {
                _id: item?._id || shiftCode,
                shiftCode,
                shiftName: shiftNameMap.get(shiftCode) || '-',
                amountText: formatAmount(item?.amount),
                currency: toUpper(item?.currency || 'THB') || 'THB',
                status: item?.status || '-'
            };
        })
        .sort((a, b) => String(a.shiftCode).localeCompare(String(b.shiftCode)));
    console.log('[personal] My Shift Rates rows (form)', {
        count: shiftRateRows.length,
        sample: shiftRateRows.length ? shiftRateRows[0] : null
    });

    $('#profileForm').dxForm({
        formData: {
            name: profile?.name || '',
            email: profile?.email || '',
            phone: profile?.phone || ''
        },
        colCount: 1,
        showValidationSummary: true,
        items: [
            { dataField: 'name', label: { text: 'Name' }, validationRules: [{ type: 'required' }] },
            { dataField: 'email', label: { text: 'Email' }, editorOptions: { mode: 'email', readOnly: !!profile?.email } },
            { dataField: 'phone', label: { text: 'Phone' } }
        ]
    });

    $('#btnPersonalSave').dxButton({
        text: 'Save',
        type: 'success',
        onClick: async () => {
            const form = $('#profileForm').dxForm('instance');
            const validation = form.validate();
            if (!validation.isValid) return;
            const data = form.option('formData') || {};
            const res = await Common.putWithAuth('/api/users/me', {
                body: JSON.stringify({ name: data.name, phone: data.phone })
            });
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Save failed', 'error', 3000);
                return;
            }

            DevExpress.ui.notify('Profile updated', 'success', 2000);
            const updated = json.data || {};
            profile = { ...profile, ...updated };
            const $profileName = $('.profile-name').first();
            if ($profileName.length) {
                $profileName.text(updated.name || profile?.name || 'User');
            }
            if (typeof Common.updateAppTitle === 'function') {
                Common.updateAppTitle(updated.name || profile?.name || profile?.email || '');
            }
        }
    });

    const readonlyTextItem = (field, label, colSpan = 1) => ({
        dataField: field,
        label: { text: label },
        editorType: 'dxTextBox',
        editorOptions: { readOnly: true },
        colSpan
    });

    const $wardMemberInfoGrid = $('#wardMemberInfoGrid');
    if (wardRes.error) {
        $wardMemberInfoGrid.append($('<div>', { class: 'settings-placeholder', text: wardRes.error }));
    } else if (!wardMemberRows.length) {
        $wardMemberInfoGrid.append($('<div>', { class: 'settings-placeholder', text: 'No ward membership found.' }));
    } else {
        const wardGroups = wardMemberRows.reduce((acc, row) => {
            const key = row.ward || '-';
            if (!acc.has(key)) acc.set(key, []);
            acc.get(key).push(row);
            return acc;
        }, new Map());

        const wardFormData = {};
        const wardItems = [];
        let wardGroupIndex = 0;
        wardGroups.forEach((rows, wardName) => {
            const groupItems = [];
            rows.forEach((row, rowIndex) => {
                const suffix = `ward_${wardGroupIndex}_${rowIndex}`;
                const roleField = `${suffix}_role`;
                const positionField = `${suffix}_position`;
                const statusField = `${suffix}_status`;
                const orderLabel = rows.length > 1 ? ` ${rowIndex + 1}` : '';

                wardFormData[roleField] = row.roles || '-';
                wardFormData[positionField] = row.position || '-';
                wardFormData[statusField] = row.status || '-';

                groupItems.push(readonlyTextItem(roleField, `Role${orderLabel}`));
                groupItems.push(readonlyTextItem(positionField, `Position${orderLabel}`));
                groupItems.push(readonlyTextItem(statusField, `Status${orderLabel}`, 2));
            });

            wardItems.push({
                itemType: 'group',
                caption: wardName || '-',
                colCount: 3,
                items: groupItems
            });
            wardGroupIndex += 1;
        });

        $wardMemberInfoGrid.dxForm({
            formData: wardFormData,
            colCount: 1,
            labelMode: 'static',
            readOnly: true,
            items: wardItems
        });
    }

    const $myShiftRateGrid = $('#myShiftRateGrid');
    if (rateRes.error) {
        $myShiftRateGrid.append($('<div>', { class: 'settings-placeholder', text: rateRes.error }));
    } else if (!shiftRateRows.length) {
        $myShiftRateGrid.append($('<div>', { class: 'settings-placeholder', text: 'No shift rates found.' }));
    } else {
        const shiftGroups = shiftRateRows.reduce((acc, row) => {
            const code = String(row.shiftCode || '').trim();
            const prefix = code ? code.charAt(0) : '-';
            if (!acc.has(prefix)) acc.set(prefix, []);
            acc.get(prefix).push(row);
            return acc;
        }, new Map());

        const sortedShiftGroupKeys = Array.from(shiftGroups.keys())
            .sort((a, b) => String(a).localeCompare(String(b), 'th'));
        const shiftFormData = {};
        const shiftItems = [];

        sortedShiftGroupKeys.forEach((groupKey, groupIndex) => {
            const rows = shiftGroups.get(groupKey) || [];
            const groupItems = [];

            rows.forEach((row, rowIndex) => {
                const suffix = `shift_${groupIndex}_${rowIndex}`;
                const shiftField = `${suffix}_shift`;
                const rateField = `${suffix}_rate`;
                const statusField = `${suffix}_status`;
                const shiftText = row.shiftName && row.shiftName !== '-'
                    ? `${row.shiftCode} - ${row.shiftName}`
                    : row.shiftCode;
                const rateText = row.currency ? `${row.amountText} ${row.currency}` : row.amountText;

                shiftFormData[shiftField] = shiftText || '-';
                shiftFormData[rateField] = rateText || '-';
                shiftFormData[statusField] = row.status || '-';

                groupItems.push(readonlyTextItem(shiftField, 'Shift'));
                groupItems.push(readonlyTextItem(rateField, 'Rate'));
                groupItems.push(readonlyTextItem(statusField, 'Status'));
            });

            shiftItems.push({
                itemType: 'group',
                caption: String(groupKey || '-'),
                colCount: 3,
                items: groupItems
            });
        });

        $myShiftRateGrid.dxForm({
            formData: shiftFormData,
            colCount: 1,
            labelMode: 'static',
            readOnly: true,
            items: shiftItems
        });
    }

    // Avatar upload UI inside dxForm
    const uploadAvatar = async (file) => {
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await Common.postWithAuth('/api/users/me/avatar', {
                body: formData
            });
            const json = await res.json();
            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Upload failed', 'error', 3000);
                return;
            }
            DevExpress.ui.notify('Avatar updated', 'success', 2000);
        } catch (err) {
            DevExpress.ui.notify(err.message || 'Upload failed', 'error', 3000);
        }
    };

    const $avatarPart = $('#avatarPart');
    if ($avatarPart.length) {
        const $input = $('#avatarInput');
        const $btn = $('#btnAvatarUpload');

        const currentAvatar = Common.resolveAvatarUrl(profile?.avatar || '') || 'images/defaultprofile.jpg';
        $('#avatarPreview').attr('src', currentAvatar);

        $input.off('change').on('change', () => {
            const file = $input[0]?.files?.[0];
            if (!file) return;
            const previewUrl = URL.createObjectURL(file);
            $('#avatarPreview').attr('src', previewUrl);
        });

        $btn.off('click').on('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!Common.getToken()) {
                DevExpress.ui.notify('Please login first', 'warning', 2000);
                return;
            }
            const file = $input[0]?.files?.[0];
            if (!file) {
                DevExpress.ui.notify('Please select an image first', 'warning', 2000);
                return;
            }
            await uploadAvatar(file);
            await Common.renderProfileAvatar($('#avatar'));
            Common.setFavicon();
        });
    }

    $('#passwordForm').dxForm({
        formData: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        },
        colCount: 1,
        showValidationSummary: true,
        items: [
            {
                dataField: 'currentPassword',
                label: { text: 'Current Password' },
                editorOptions: { mode: 'password' },
                validationRules: [{ type: 'required' }]
            },
            {
                dataField: 'newPassword',
                label: { text: 'New Password' },
                editorOptions: { mode: 'password' },
                validationRules: [{ type: 'required' }, { type: 'stringLength', min: 6 }]
            },
            {
                dataField: 'confirmPassword',
                label: { text: 'Confirm Password' },
                editorOptions: { mode: 'password' },
                validationRules: [
                    { type: 'required' },
                    {
                        type: 'custom',
                        message: 'Passwords do not match',
                        validationCallback: (e) => {
                            const form = $('#passwordForm').dxForm('instance');
                            const data = form ? form.option('formData') : {};
                            return e.value === (data?.newPassword || '');
                        }
                    }
                ]
            }
        ]
    });

    $('#passwordConfirmPopup').remove();
    const confirmPopup = $('<div>', { id: 'passwordConfirmPopup' }).appendTo('body').dxPopup({
        title: 'Confirm Change Password',
        width: 360,
        height: 'auto',
        showTitle: true,
        visible: false,
        dragEnabled: false,
        closeOnOutsideClick: true,
        contentTemplate: () => {
            return $('<div>').append(
                $('<div>', { text: 'Are you sure you want to change your password?' })
            );
        },
        toolbarItems: [
            {
                widget: 'dxButton',
                toolbar: 'bottom',
                location: 'after',
                options: {
                    text: 'Cancel',
                    type: 'warning',
                    onClick() {
                        confirmPopup.hide();
                    }
                }
            },
            {
                widget: 'dxButton',
                toolbar: 'bottom',
                location: 'after',
                options: {
                    text: 'Confirm',
                    type: 'success',
                    onClick: async () => {
                        const form = $('#passwordForm').dxForm('instance');
                        const data = form.option('formData');
                        const res = await Common.postWithAuth('/api/users/me/change-password', {
                            body: JSON.stringify({
                                currentPassword: data.currentPassword,
                                newPassword: data.newPassword
                            })
                        });
                        const json = await res.json();
                        if (!res.ok) {
                            DevExpress.ui.notify(json.message || 'Change password failed', 'error', 3000);
                            return;
                        }
                        DevExpress.ui.notify('Password changed', 'success', 2000);
                        form.resetValues();
                        confirmPopup.hide();
                    }
                }
            }
        ]
    }).dxPopup('instance');

    $('#btnPasswordSave').dxButton({
        text: 'Update',
        type: 'success',
        onClick: async () => {
            const form = $('#passwordForm').dxForm('instance');
            const validation = form.validate();
            if (!validation.isValid) return;
            const data = form.option('formData');
            if (data.newPassword !== data.confirmPassword) {
                DevExpress.ui.notify('Passwords do not match', 'error', 3000);
                return;
            }

            try {
                const res = await Common.postWithAuth('/api/auth/verify-password', {
                    body: JSON.stringify({ password: data.currentPassword })
                });
                const json = await res.json();
                if (!res.ok || !json.data?.valid) {
                    DevExpress.ui.notify('Current password is incorrect', 'error', 3000);
                    return;
                }
            } catch {
                DevExpress.ui.notify('Unable to verify current password', 'error', 3000);
                return;
            }

            confirmPopup.show();
        }
    });
};
