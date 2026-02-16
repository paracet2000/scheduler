const express = require('express')
const router = express.Router()

const controller = require('../controllers/menu.layout.controller')

router.get('/', controller.listLayouts)

module.exports = router

