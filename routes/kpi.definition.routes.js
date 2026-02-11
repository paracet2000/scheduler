const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/kpi.definition.controller');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);

module.exports = router;
