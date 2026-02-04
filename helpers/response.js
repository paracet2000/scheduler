module.exports = {
  success(res, data = null, message = 'success', status = 200) {
    return res.status(status).json({
      result: true,
      message,
      data
    });
  },

  fail(res, message = 'error', status = 400) {
    return res.status(status).json({
      result: false,
      message,
      data: null
    });
  }
};
