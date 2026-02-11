function parseConfValue(conf) {
  if (!conf) return {};
  const raw = String(conf.conf_value || '').trim();
  if (!raw) {
    return Array.isArray(conf.options) && conf.options.length
      ? { options: conf.options }
      : {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(conf.options) && conf.options.length) {
      return { ...parsed, options: conf.options };
    }
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
  } catch {
    return Array.isArray(conf.options) && conf.options.length
      ? { value: raw, options: conf.options }
      : { value: raw };
  }
}

module.exports = {
  parseConfValue
};
