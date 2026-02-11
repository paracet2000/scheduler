const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const controller = require('../controllers/kpi.controller');

const authorizeRoles = () => (req, res, next) => next();

router.use(authenticate);

router.get('/definitions', authorizeRoles('admin', 'hr', 'head'), controller.listDefinitions);
router.post('/definitions', authorizeRoles('admin', 'hr'), controller.createDefinition);
router.put('/definitions/:id', authorizeRoles('admin', 'hr'), controller.updateDefinition);

router.get('/entries', controller.getEntry);
router.get('/entries-range', controller.listEntriesRange);
router.post('/entries', controller.upsertEntry);

router.get('/dashboard/widgets', authorizeRoles('admin', 'hr'), controller.listDashboardWidgets);
router.post('/dashboard/widgets', authorizeRoles('admin', 'hr'), controller.createDashboardWidget);
router.put('/dashboard/widgets/:id', authorizeRoles('admin', 'hr'), controller.updateDashboardWidget);

router.get('/dashboard/thresholds', authorizeRoles('admin', 'hr'), controller.listThresholds);
router.post('/dashboard/thresholds', authorizeRoles('admin', 'hr'), controller.upsertThreshold);

router.get('/dashboard/summary', authorizeRoles('admin', 'head', 'finance'), controller.dashboardSummary);
router.get('/dashboard/checklist', authorizeRoles('admin', 'head', 'finance'), controller.dashboardChecklist);

module.exports = router;
