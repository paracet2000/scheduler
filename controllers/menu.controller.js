// controllers/menu.controller.js
const Menu = require('../model/menu.model');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');

exports.listActive = asyncHandler(async (req, res) => {
  const menus = await Menu.find({ mnu_status: 'ACTIVE' }).sort({ mnu_code: 1 });
  response.success(res, menus, 'Menus loaded');
});
