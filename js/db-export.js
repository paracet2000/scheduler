/* global $, DevExpress, Common */
'use strict';

(function () {
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function exportDbJson() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      const res = await Common.fetchWithAuth('/api/admin/export-db');
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }

      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || `Export failed (${res.status})`;
        DevExpress.ui.notify(msg, 'error', 4000);
        return;
      }

      downloadText(`db-export-${ts}.json`, text);
      DevExpress.ui.notify('Exported DB JSON', 'success', 2500);
    } catch (err) {
      DevExpress.ui.notify(err?.message || 'Export failed', 'error', 4000);
    }
  }

  window.exportDbJson = exportDbJson;
})();

