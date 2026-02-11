/* global Common */
'use strict';

window.Helper = (function helperModule() {
    const cache = {
        wards: null,
        shifts: null
    };

    const getStoredRoles = () => {
        try {
            const raw = localStorage.getItem('auth_roles');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const checkRole = (roles) => {
        const list = getStoredRoles().map(r => String(r).toLowerCase());
        const want = Array.isArray(roles) ? roles : [roles];
        const normalized = want.map(r => String(r).toLowerCase());
        return list.some(r => normalized.includes(r));
    };

    const getWards = async (force = false) => {
        if (cache.wards && !force) return cache.wards;
        const res = await Common.fetchWithAuth('/api/configuration?typ_code=DEPT');
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load wards');
        cache.wards = Array.isArray(json.data) ? json.data : [];
        return cache.wards;
    };

    const getShifts = async (force = false) => {
        if (cache.shifts && !force) return cache.shifts;
        const res = await Common.fetchWithAuth('/api/configuration?typ_code=SHIFT');
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load shifts');
        cache.shifts = Array.isArray(json.data) ? json.data : [];
        return cache.shifts;
    };

    return {
        getStoredRoles,
        checkRole,
        getWards,
        getShifts
    };
})();
