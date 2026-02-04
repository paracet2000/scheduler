// helpers/master.helper.js
const Master = require('../models/master.model');

exports.getPositionIdsByCodes = async (codes) => {
  const positions = await Master.find({
    type: 'POSITION',
    code: { $in: codes }
  }).select('_id');

  return positions.map(p => p._id);
};
