// routes/user.routes.js
const router = require('express').Router();

const authenticate = require('../middleware/authenticate');
const upload = require('../middleware/upload');
const userController = require('../controllers/user.controller');

// user profile
router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, userController.updateProfile);
router.post('/me/avatar',  authenticate,  upload.single('image'),  userController.uploadProfileImage);

module.exports = router;
