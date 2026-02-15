function toMonthYear(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  // The app's scheduling periods are aligned to Thailand time.
  // Using a fixed IANA timezone avoids server/container timezone differences (UTC vs local)
  // that can cause month/year mismatches around day boundaries.
  const timeZone = String(process.env.APP_TIMEZONE || 'Asia/Bangkok').trim() || 'Asia/Bangkok';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);

  const byType = Object.create(null);
  parts.forEach((p) => {
    if (p && p.type) byType[p.type] = p.value;
  });

  const mm = String(byType.month || '').padStart(2, '0');
  const yyyy = String(byType.year || '').trim();
  if (!/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return '';
  return `${mm}-${yyyy}`;
}

module.exports = { toMonthYear };

