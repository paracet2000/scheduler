// js/login.js
$(document).ready(function() {
    async function setMenuAuthorization() {
        if (typeof window.rebuildDrawerMenu === 'function') {
            await window.rebuildDrawerMenu();
        }
    }

    function closeLogin() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_kpi_tools');
        localStorage.removeItem('auth_avatar');
        localStorage.removeItem('auth_display_name');
        if (typeof window.updateAuthUI === 'function') {
            window.updateAuthUI(false);
        }
        if (typeof window.Common?.loadMenuAuthorization === 'function') {
            window.Common.loadMenuAuthorization(null);
        }
        setMenuAuthorization();
        $('#avatar').attr('src', 'images/defaultprofile.jpg');
        if (typeof window.Common?.updateAppTitle === 'function') {
            window.Common.updateAppTitle('');
        }
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
                const canUseKpiTools = json?.data?.meta?.['Can-use-kpi-tools'] ?? json?.data?.meta?.canUseKpiTools ?? null;
                if (canUseKpiTools !== null && canUseKpiTools !== undefined) {
                    localStorage.setItem('auth_kpi_tools', String(canUseKpiTools));
                } else {
                    localStorage.removeItem('auth_kpi_tools');
                }
                if (typeof window.updateAuthUI === 'function') {
                    window.updateAuthUI(true);
                }
                if (typeof window.Common?.loadMenuAuthorization === 'function') {
                    await window.Common.loadMenuAuthorization(token);
                }
            }
            //ไม่ต้องกลัว exception ปล่อยมันออกมาจะได้แก้ได้ 
            
            await Common.renderProfileAvatar($('#avatar'));
            await setMenuAuthorization();
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
