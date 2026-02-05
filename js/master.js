// js/master.js
// Master/System Settings UI
window.renderSystemSettings = async function renderSystemSettings() {
    if (typeof window.showPage === 'function') {
        window.showPage('settingsSystem');
    }

    const roles = typeof window.getStoredRoles === 'function' ? window.getStoredRoles() : [];
    const isAdmin = roles.includes('admin');

    $('#systemSettings').empty();

    if (!isAdmin) {
        $('#systemSettings').append(
            $('<div>', {
                class: 'settings-placeholder',
                text: 'System settings are available for admin users only.'
            })
        );
        return;
    }

    const systemWrap = $('<div>', { class: 'system-settings' });
    const systemMenu = $('<div>', { class: 'system-settings-menu' });
    const systemContent = $('<div>', { class: 'system-settings-content' });

    const token = localStorage.getItem('auth_token');

    const cacheKey = 'master_types_cache';
    const cacheTsKey = 'master_types_cache_ts';
    const cacheTtlMs = 10 * 60 * 1000; // 10 minutes

    let items = [];
    try {
        const cached = localStorage.getItem(cacheKey);
        const cachedTs = Number(localStorage.getItem(cacheTsKey) || 0);
        const cacheValid = cached && (Date.now() - cachedTs) < cacheTtlMs;

        if (cacheValid) {
            items = JSON.parse(cached);
        } else {
            const apiBase = window.BASE_URL || 'http://localhost:3000';
            const res = await fetch(`${apiBase}/api/master-types`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load master types');
            }
            items = Array.isArray(json.data) ? json.data : [];
            localStorage.setItem(cacheKey, JSON.stringify(items));
            localStorage.setItem(cacheTsKey, String(Date.now()));
        }
    } catch (err) {
        systemContent.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: err.message || 'Unable to load master types.'
            })
        );
    }

    const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

    const renderSystemSection = async (item) => {
        systemContent.empty();
        const meta = item.meta || {};
        const hint = meta.hint || 'Master type';

        const gridEl = $('<div>', { id: 'masterGrid' });
        systemContent.append(gridEl);

        const apiBase = window.BASE_URL || 'http://localhost:3000';
        const typeCode = item.code;

        let gridData = [];
        try {
            const res = await fetch(`${apiBase}/api/masters/${typeCode}`, {
                headers: authHeaders()
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load masters');
            }
            gridData = Array.isArray(json.data) ? json.data : [];
        } catch (err) {
            systemContent.append(
                $('<div>', {
                    class: 'settings-placeholder',
                    text: err.message || 'Unable to load masters.'
                })
            );
        }

        const getContrastText = (hex) => {
            if (!hex) return '#0f172a';
            const clean = hex.replace('#', '');
            if (clean.length !== 6) return '#0f172a';
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance < 0.55 ? '#ffffff' : '#0f172a';
        };

        const gridInstance = $('#masterGrid').dxDataGrid({
            dataSource: gridData,
            keyExpr: '_id',
            showBorders: true,
            columnAutoWidth: true,
            paging: { pageSize: 10 },
            editing: {
                mode: 'row',
                allowAdding: true,
                allowUpdating: true,
                allowDeleting: false
            },
            columns: [
                {
                    dataField: 'code',
                    caption: 'Code',
                    allowEditing: false,
                    validationRules: [{ type: 'required' }]
                },
                {
                    dataField: 'name',
                    caption: 'Name',
                    validationRules: [{ type: 'required' }]
                },
                { dataField: 'description', caption: 'Description' },
                {
                    dataField: 'status',
                    caption: 'Status',
                    lookup: {
                        dataSource: ['ACTIVE', 'INACTIVE']
                    }
                }
            ],
            onRowInserting: async (e) => {
                const payload = {
                    ...e.data,
                    type: typeCode
                };
                const res = await fetch(`${apiBase}/api/masters`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Create failed', 'error', 3000);
                    return;
                }
                e.data._id = json.data?._id || e.data._id;
                DevExpress.ui.notify('Created', 'success', 2000);
            },
            onRowUpdating: async (e) => {
                const id = e.key;
                const payload = { ...e.oldData, ...e.newData };
                const res = await fetch(`${apiBase}/api/masters/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (!res.ok) {
                    e.cancel = true;
                    DevExpress.ui.notify(json.message || 'Update failed', 'error', 3000);
                    return;
                }
                DevExpress.ui.notify('Updated', 'success', 2000);
            },
            onRowValidating: (e) => {
                if (e.newData && Object.prototype.hasOwnProperty.call(e.newData, 'code')) {
                    e.isValid = false;
                    e.errorText = 'Code cannot be changed.';
                }
            },
            onContentReady: (e) => {
                const headerColor = (meta && meta.color) ? meta.color : '#e2e8f0';
                const textColor = getContrastText(headerColor);
                const $grid = e.component.element();
                $grid.find('.dx-header-row').css('background-color', headerColor);
                $grid.find('.dx-header-row > td').css('background-color', headerColor);
                $grid.find('.dx-header-row, .dx-header-row > td').css('color', textColor);
            }
        }).dxDataGrid('instance');
    };

    items.forEach((item, index) => {
        const meta = item.meta || {};
        const btn = $('<button>', {
            class: `system-settings-item${index === 0 ? ' active' : ''}`,
            click: () => {
                systemMenu.find('.system-settings-item').removeClass('active');
                btn.addClass('active');
                renderSystemSection(item);
            }
        });

        const color = meta.color || '#e2e8f0';
        const icon = meta.icon || 'type';
        const hint = meta.hint || '';

        const iconBadge = $('<span>', {
            class: 'system-settings-icon',
            text: icon.slice(0, 2).toUpperCase()
        }).css('background', color);

        const label = $('<div>', { class: 'system-settings-label' }).text(item.name);
        const sub = $('<div>', { class: 'system-settings-sub' }).text(hint);

        btn.append(iconBadge, $('<div>').append(label, sub));
        systemMenu.append(btn);
        if (index === 0) renderSystemSection(item);
    });

    if (!items.length) {
        systemContent.append(
            $('<div>', {
                class: 'settings-placeholder',
                text: 'No master types found.'
            })
        );
    }

    systemWrap.append(systemMenu, systemContent);
    $('#systemSettings').append(systemWrap);
};
