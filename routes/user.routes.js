// routes/user.routes.js
const router = require('express').Router();

const authenticate = require('../middleware/authenticate');
const upload = require('../middleware/upload');
const userController = require('../controllers/user.controller');
const AppError = require('../helpers/apperror');
const log = require('../helpers/log.helper');

const handleAvatarUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.log('err message: ', err.message);
    }
    if (err) {
      log.error('Avatar upload error', {
        message: err.message,
        // code: err.code
      });
      return next(new AppError(err.message || 'Upload failed', 400));
    }
    return next();
  });
};

// user profile
router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, userController.updateProfile);
router.post('/me/change-password', authenticate, userController.changePassword);
router.post('/me/avatar', authenticate, handleAvatarUpload, userController.uploadProfileImage);

// admin management
router.get('/', authenticate, userController.listUsers);
router.put('/:id', authenticate, userController.updateUser);
router.post('/:id/reset-password', authenticate, userController.resetPassword);

module.exports = router;
