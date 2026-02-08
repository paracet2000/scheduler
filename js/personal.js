// js/personal.js
// Personal Settings UI
window.renderPersonalSettings = async function renderPersonalSettings() {
    if (typeof window.showPage === 'function') {
        window.showPage('settingsPersonal');
    }

    const apiBase = window.BASE_URL || '';
    const token = localStorage.getItem('auth_token');

    $('#personalSettings').empty();

    let profile = null;
    try {
        console.log('token Data on me: ',token);
        const res = await fetch(`${apiBase}/api/users/me`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Failed to load profile');
        }
        profile = json.data || null;
    } catch (err) {
        $('#personalSettings').append(
            $('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load profile.' })
        );
        return;
    }

    const header = $('<div>', { class: 'profile-header' });
    const avatar = $('<div>', { class: 'profile-avatar' });
    if (profile?.avatar) {
        const resolved = typeof window.resolveAvatarUrl === 'function'
            ? window.resolveAvatarUrl(profile.avatar)
            : profile.avatar;
        avatar.css('background-image', `url(${resolved})`).addClass('has-image');
    } else {
        const initial = (profile?.name || profile?.email || 'U').trim().charAt(0).toUpperCase();
        avatar.text(initial);
    }

    const info = $('<div>', { class: 'profile-info' })
        .append($('<div>', { class: 'profile-name', text: profile?.name || 'User' }))
        .append($('<div>', { class: 'profile-email', text: profile?.email || '' }));

    header.append(avatar, info);

    const meta = $('<div>', { class: 'profile-meta' })
        .append($('<div>', { class: 'profile-badge', text: `Status: ${profile?.status || 'ACTIVE'}` }))
        .append($('<div>', { class: 'profile-badge', text: `Roles: ${(profile?.roles || []).join(', ') || '-'}` }));

    const profileFormWrap = $('<div>', { class: 'profile-section' });
    const profileFormEl = $('<div>', { id: 'profileForm' });
    profileFormWrap.append($('<div>', { class: 'profile-section-title', text: 'Basic Info' }), profileFormEl);

    const avatarWrap = $('<div>', { class: 'profile-section' });
    const uploaderEl = $('<div>', { id: 'avatarUploader' });
    avatarWrap.append($('<div>', { class: 'profile-section-title', text: 'Profile Image' }), uploaderEl);

    const passwordWrap = $('<div>', { class: 'profile-section' });
    const passwordFormEl = $('<div>', { id: 'passwordForm' });
    const passwordBtnEl = $('<div>', { id: 'passwordBtn' });
    passwordWrap.append(
        $('<div>', { class: 'profile-section-title', text: 'Change Password' }),
        passwordFormEl,
        passwordBtnEl
    );

    $('#personalSettings').append(header, meta, profileFormWrap, avatarWrap, passwordWrap);

    $('#profileForm').dxForm({
        formData: {
            name: profile?.name || '',
            email: profile?.email || '',
            phone: profile?.phone || ''
        },
        colCount: 2,
        showValidationSummary: true,
        items: [
            { dataField: 'name', label: { text: 'Name' }, validationRules: [{ type: 'required' }] },
            {
                dataField: 'email',
                label: { text: 'Email' },
                editorOptions: { mode: 'email', readOnly: true }
            },
            { dataField: 'phone', label: { text: 'Phone' } }
        ]
    });

    const uploadHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    console.log('upload Header: ',uploadHeaders);
    $('#avatarUploader').dxFileUploader({
        selectButtonText: 'Select Image',
        labelText: 'or drag & drop',
        accept: 'image/*',
        name: 'image',
        uploadMode: 'instantly',
        uploadUrl: `${apiBase}/api/users/me/avatar`,
        uploadHeaders,
        onUploaded: async () => {
            DevExpress.ui.notify('Avatar updated', 'success', 2000);
            try {
                const res = await fetch(`${apiBase}/api/users/me`, {
                    headers: uploadHeaders
                });
                const json = await res.json();
                if (res.ok && json.data) {
                    const newAvatar = json.data.avatar;
                    if (newAvatar) {
                        const resolved = typeof window.resolveAvatarUrl === 'function'
                            ? window.resolveAvatarUrl(newAvatar)
                            : newAvatar;
                        avatar.css('background-image', `url(${resolved})`).addClass('has-image').text('');
                        if (typeof window.updateUserAvatar === 'function') {
                            window.updateUserAvatar(newAvatar);
                        }
                    }
                }
            } catch {}
        },
        onUploadError: (e) => {
            DevExpress.ui.notify(e.error?.message || 'Upload failed', 'error', 3000);
        }
    });

    $('#passwordForm').dxForm({
        formData: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        },
        colCount: 2,
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
                validationRules: [{ type: 'required' }]
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
                        const res = await fetch(`${apiBase}/api/users/me/change-password`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...uploadHeaders
                            },
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

    $('#passwordBtn').dxButton({
        text: 'Update Password',
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
            confirmPopup.show();
        }
    });
};
