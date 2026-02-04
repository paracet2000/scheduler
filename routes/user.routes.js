const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/user.controller');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/verify/:token', ctrl.verify);

router.get('/me', auth, ctrl.profile);
router.post('/me/avatar', auth, upload.single('image'), ctrl.uploadProfile);

module.exports = router;
