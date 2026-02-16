// controllers/menu.layout.controller.js
const MenuLayout = require('../model/menu.layout.model')
const asyncHandler = require('../helpers/async.handler')
const response = require('../helpers/response')

exports.listLayouts = asyncHandler(async (req, res) => {
  const layouts = await MenuLayout.find({})
    .select('tab_name mnu_code')
    .sort({ tab_name: 1, mnu_code: 1 })
    .lean()

  response.success(res, layouts, 'Menu layouts loaded')
})

