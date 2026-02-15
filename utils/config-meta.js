function parseConfValue(conf) {
  if (!conf) return {};
  const raw = String(conf.conf_value || '').trim();
  if (!raw) {
    return Array.isArray(conf.options) && conf.options.length
      ? { options: conf.options }
      : {};
  }

  // Support simple time range strings (useful for typ_code=SHIFT), e.g.:
  // - "07:00 TO 16:00"
  // - "07:00TO16:00"
  // - "07:00-16:00"
  // - "07:00 - 16:00"
  const parseTimeRange = (value) => {
    const s = String(value || '').trim();
    // HH:MM or HH.MM (optional :SS)
    // Accept both ":" and "." as hour/minute separator because some devices export "16.00".
    const time = '(?:[01]?\\d|2[0-3])[:.][0-5]\\d(?::[0-5]\\d)?';
    const re = new RegExp(`^\\s*(${time})\\s*(?:-|to)\\s*(${time})\\s*$`, 'i');
    const m = s.match(re);
    if (!m) return null;

    const normalizeTime = (t) => {
      const raw = String(t || '').trim().replace('.', ':');
      const parts = raw.split(':').map((x) => String(x).trim()).filter(Boolean);
      if (parts.length < 2) return null;
      const h = String(Number(parts[0])).padStart(2, '0');
      const min = String(Number(parts[1])).padStart(2, '0');
      const sec = parts.length >= 3 ? String(Number(parts[2])).padStart(2, '0') : null;
      return sec ? `${h}:${min}:${sec}` : `${h}:${min}`;
    };

    const from = normalizeTime(m[1]);
    const to = normalizeTime(m[2]);
    if (!from || !to) return null;
    // Mark cross-day when the end is earlier than start (night shift across midnight)
    const toSec = (t) => {
      const parts = String(t).replace('.', ':').split(':').map((x) => Number(x));
      const [h, min, sec = 0] = parts;
      if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
      return (h * 3600) + (min * 60) + sec;
    };
    const fs = toSec(from);
    const ts = toSec(to);
    const crossDay = fs !== null && ts !== null ? ts < fs : false;
    return { timeFrom: from, timeTo: to, crossDay };
  };

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(conf.options) && conf.options.length) {
      return { ...parsed, options: conf.options };
    }
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
  } catch {
    const tr = parseTimeRange(raw);
    if (tr) {
      return Array.isArray(conf.options) && conf.options.length
        ? { ...tr, options: conf.options }
        : tr;
    }
    return Array.isArray(conf.options) && conf.options.length
      ? { value: raw, options: conf.options }
      : { value: raw };
  }
}

module.exports = {
  parseConfValue
};
