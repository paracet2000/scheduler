// controllers/user.controller.js
const User = require('../model/user.model');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');
const AppError = require('../helpers/apperror');

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 */
exports.getProfile = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  response.success(res, req.user, 'Profile loaded');
});

/**
 * @desc    Update profile (name, phone)
 * @route   PUT /api/users/me
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, phone },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  response.success(res, user, 'Profile updated');
});

/**
 * @desc    Upload profile image
 * @route   POST /api/users/me/avatar
 */
exports.uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No image uploaded', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: req.file.path },
    { new: true }
  ).select('-password');

  response.success(res, user, 'Profile image updated');
});
