// js/login.js
$(document).ready(function() {
    async function setMenuAuthorization() {
        const res = await window.Common.fetchWithAuth('/api/menu-authorize/me');
        const json = await res.json();
        
        if (!res.ok) return;
        
        const authorizedMenus = json.data || [];
        
        authorizedMenus.forEach(menu => {
            const code = menu.mnu_code;
            const canRead = !!menu.acc_read;
            const canWrite = !!menu.acc_write;
            const canExport = !!menu.acc_export;

            // after this setting register should be hidden if no permissions
            const el = $(`#drawerMenu [data-code='${code}']`);
            el.data('canWrite', canWrite);
            el.data('canExport', canExport);
            window.Common.toggleEnable($(el), canRead);
            const shouldHide = !canRead && !canWrite && !canExport;
            window.Common.toggleHide($(el), shouldHide);
        });
        return;
    }

    function closeLogin() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_roles');
        localStorage.removeItem('auth_kpi_tools');
        $('#avatar').attr('src', 'images/defaultprofile.jpg');
        $('#login').addClass('pagehidden');
    }

    async function authenticate() {
        const form = $('#loginForm').dxForm('instance');
        if (!form || !form.validate().isValid) return false;

        const data = form.option('formData');
        try {
            // Authenticate user
            const res = await fetch(Common.buildApiUrl('/api/auth/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const json = await res.json();

            if (!res.ok) {
                DevExpress.ui.notify(json.message || 'Login failed', 'error', 3000);
                return false;
            }

            const token = json?.data?.token;
            if (token) {
                localStorage.setItem('auth_token', token);
            }
            //ไม่ต้องกลัว exception ปล่อยมันออกมาจะได้แก้ได้ 
            
            Common.renderProfileAvatar($('#avatar'));         
            setMenuAuthorization();
            Common.setFavicon();
            $('#login').addClass('pagehidden');
            DevExpress.ui.notify('Login success!', 'success', 3000);
            return true;
        } catch (err) {
            DevExpress.ui.notify(err.message || 'Login failed', 'error', 3000);
            return false;
        }
    }

    function renderLogin() {
        if (typeof window.showPage === 'function') {
            window.showPage('login');
        }

        $('#loginForm').dxForm({
            formData: {
                email: '',
                password: ''
            },
            colCount: 1,
            showValidationSummary: true,
            items: [
                { dataField: 'email', label: { text: 'Email' }, validationRules: [{ type: 'required' }, { type: 'email' }] },
                { dataField: 'password', editorOptions: { mode: 'password' }, validationRules: [{ type: 'required' }] }
            ]
        });

        $('#btnLogin').dxButton({
            text: 'Login',
            type: 'success',
            width: 100,
            onClick: async () => {
                const ok = await authenticate();
                if (!ok) return;
                if (typeof window.renderSchedule === 'function') {
                    window.renderSchedule();
                } else if (typeof window.showPage === 'function') {
                    window.showPage('personalDashboard');
                }
            }
        });

        $('#btnLoginClose').dxButton({
            text: 'Close',
            type: 'danger',
            width: 100,
            onClick: closeLogin
        });
    }
    window.renderLogin = renderLogin;
});
