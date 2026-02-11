const express = require('express');
const router = express.Router();

const {
  listConfigurations,
  filterConfigurations,
  createConfiguration,
  updateConfiguration,
  getTypes
} = require('../controllers/configuration.controller');
const authenticate = require('../middleware/authenticate');

// GET /api/configuration?typ_code=DEPT&conf_code=W01
router.get('/', authenticate, listConfigurations);
router.get('/gettype', authenticate, getTypes);
router.post('/', authenticate, createConfiguration);
// POST /api/configuration/filter  body: { typ_code, conf_code, ... }
router.post('/filter', authenticate, filterConfigurations);
router.put('/:id', authenticate, updateConfiguration);

module.exports = router;
