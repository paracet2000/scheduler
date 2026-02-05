// routes/auth.routes.js
const router = require('express').Router();

const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');

// public
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify/:token', authController.verify);

// protected
router.post(
  '/resend-verify',
  authenticate,
  authController.resendVerifyEmail
);

module.exports = router;
