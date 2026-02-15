/* global $, DevExpress, Common */
'use strict';

window.renderShiftPattern = async function renderShiftPattern() {
    if (typeof window.showPage === 'function') {
        window.showPage('shiftPattern');
    }

    const container = $('#shiftPattern');
    container.empty();

    const gridEl = $('<div>', { id: 'shiftPatternGrid', class: 'dx-grid shift-pattern-grid' });
    container.append(gridEl);

    let patterns = [];
    let shiftCodes = [];

    try {
        const [patternRes, shiftRes] = await Promise.all([
            Common.fetchWithAuth('/api/master-patterns'),
            Common.fetchWithAuth('/api/configuration?typ_code=SHIFT')
        ]);
        const patternJson = await patternRes.json();
        const shiftJson = await shiftRes.json();
        if (!patternRes.ok) throw new Error(patternJson.message || 'Failed to load patterns');
        if (!shiftRes.ok) throw new Error(shiftJson.message || 'Failed to load shifts');
        patterns = Array.isArray(patternJson.data) ? patternJson.data : [];
        const shifts = Array.isArray(shiftJson.data) ? shiftJson.data : [];
        shiftCodes = shifts.map(s => s.conf_code || s.code).filter(Boolean);
    } catch (err) {
        container.append(
            $('<div>', { class: 'settings-placeholder', text: err.message || 'Unable to load shift patterns.' })
        );
        return;
    }

    const dayFields = [
        { key: 'day0', label: 'Sun' },
        { key: 'day1', label: 'Mon' },
        { key: 'day2', label: 'Tue' },
        { key: 'day3', label: 'Wed' },
        { key: 'day4', label: 'Thu' },
        { key: 'day5', label: 'Fri' },
        { key: 'day6', label: 'Sat' }
    ];

    const toRow = (p) => {
        const row = {
            _id: p._id,
            code: p.code,
            name: p.name,
            description: p.description,
            status: p.status,
            order: p.order
        };
        const days = Array.isArray(p.dayCodes) ? p.dayCodes : [];
        dayFields.forEach((d, idx) => {
            row[d.key] = days[idx] || '';
        });
        return row;
    };

    const toPayload = (row) => {
        const dayCodes = dayFields.map(d => String(row[d.key] || '').trim().toUpperCase());
        return {
            code: row.code,
            name: row.name,
            description: row.description,
            status: row.status,
            order: row.order,
            dayCodes
        };
    };

    const data = patterns.map(toRow);

    gridEl.dxDataGrid({
        dataSource: data,
        keyExpr: '_id',
        showBorders: true,
        columnAutoWidth: true,
        paging: { pageSize: 10 },
        editing: {
            mode: 'popup',
            allowAdding: true,
            allowUpdating: true,
            allowDeleting: false,
            useIcons: true
        },
        columns: [
            { dataField: 'code', caption: 'Code', validationRules: [{ type: 'required' }] },
            { dataField: 'name', caption: 'Name', validationRules: [{ type: 'required' }] },
            { dataField: 'description', caption: 'Description' },
            ...dayFields.map(d => ({
                dataField: d.key,
                caption: d.label,
                lookup: {
                    dataSource: [''].concat(shiftCodes),
                    valueExpr: 'this',
                    displayExpr: 'this'
                }
            })),
            { dataField: 'order', caption: 'Order', dataType: 'number', width: 70 },
            {
                dataField: 'status',
                caption: 'Status',
                lookup: { dataSource: ['ACTIVE', 'INACTIVE'] }
            }
        ],
        onRowInserting: async (e) => {
            const payload = toPayload(e.data);
            const res = await Common.fetchWithAuth('/api/master-patterns', {
                method: 'POST',
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
            const merged = { ...e.oldData, ...e.newData };
            const payload = toPayload(merged);
            const res = await Common.fetchWithAuth(`/api/master-patterns/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                e.cancel = true;
                DevExpress.ui.notify(json.message || 'Update failed', 'error', 3000);
                return;
            }
            DevExpress.ui.notify('Updated', 'success', 2000);
        }
    });
};
