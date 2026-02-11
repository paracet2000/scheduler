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

    let profile = null;
    let wardNames = '-';
    try {
        const [res, wardRes] = await Promise.all([
            Common.fetchWithAuth('/api/users/me'),
            Common.fetchWithAuth('/api/ward-members/mine')
        ]);
        const json = await res.json();
        const wardJson = await wardRes.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load profile');
        }
        // ใช้ข้อมูลโปรไฟล์จาก API (ถ้าไม่มีให้เป็น null)
        profile = json.data || null;
        if (wardRes.ok) {
            // wardJson.data ต้องเป็น array ไม่ใช่ให้ fallback เป็น []
            const wards = Array.isArray(wardJson.data) ? wardJson.data : [];
            // ดึงชื่อ ward (ใช้ name ก่อน ถ้าไม่มีใช้ code) แล้วตัดค่าที่ว่างทิ้ง
            const names = wards
                .map(w => w.name || w.code || '')
                .filter(Boolean); //filter(Boolean) คือการกรอง เอาเฉพาะค่าที่เป็น truthy
            // รวมเป็นข้อความสำหรับแสดงผล ถ้าไม่มีชื่อเลยให้เป็น "-"
            wardNames = names.length ? names.join(', ') : '-';
        }
    } catch (err) {
        $('#personalSettings').append(
            $('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load profile.' })
        );
        return;
    }

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
            { dataField: 'email',label: { text: 'Email' },editorOptions: { mode: 'email', readOnly: !!profile?.email}},
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
            info.find('.profile-name').text(updated.name || profile?.name || 'User');
        }
    });

    // Avatar upload UI inside dxForm
    const uploadAvatar = async (file, previewId) => {
        console.log('file Data: ',file);
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('image', file);
            console.log('formData Data: ',formData);
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

        // load current avatar into preview
        const currentAvatar = Common.resolveAvatarUrl(profile?.avatar || '') || 'images/defaultprofile.jpg';
        $('#avatarPreview').attr('src', currentAvatar);

        $input.on('change', () => {
            const file = $input[0]?.files?.[0];
            if (!file) return;
            const previewUrl = URL.createObjectURL(file);
            $('#avatarPreview').attr('src', previewUrl);
        });

        $btn.on('click', async (e) => {
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
            await uploadAvatar(file, 'avatarPreview');
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
            // Check current password before showing confirmation
            try {
                const res = await Common.postWithAuth('/api/auth/verify-password', {
                    body: JSON.stringify({ password: data.currentPassword })
                });
                const json = await res.json();
                if (!res.ok || !json.data?.valid) {
                    DevExpress.ui.notify('Current password is incorrect', 'error', 3000);
                    return;
                }
            } catch {}

            confirmPopup.show();
        }
    });
    // load cuurent avatar into avatarPreview
    
};
