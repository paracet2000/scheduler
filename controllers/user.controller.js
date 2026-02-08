// controllers/user.controller.js
const User = require('../model/user.model');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');
const AppError = require('../helpers/apperror');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ensureAdminOrHr = (user) => {
  const roles = user?.roles || [];
  if (!roles.includes('admin') && !roles.includes('hr')) {
    throw new AppError('Forbidden', 403);
  }
};

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
  const tempPath = `${req.file.path}.tmp`;

  await sharp(req.file.path)
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(tempPath);

  fs.renameSync(tempPath, req.file.path);

  const avatarPath = `/uploads/${path.basename(req.file.path)}`;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarPath },
    { new: true }
  ).select('-password');

  response.success(res, user, 'Profile image updated');
});

/**
 * @desc    Change password (self)
 * @route   POST /api/users/me/change-password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current and new password are required', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  await user.save();

  response.success(res, null, 'Password changed');
});

/**
 * @desc    List all users (admin/hr)
 * @route   GET /api/users
 */
exports.listUsers = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const users = await User.find().select('-password').sort({ createdAt: -1 });
  response.success(res, users, 'Users loaded');
});

/**
 * @desc    Update user (admin/hr)
 * @route   PUT /api/users/:id
 */
exports.updateUser = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { id } = req.params;
  const { name, phone, roles, status, meta } = req.body;

  const user = await User.findById(id).select('-password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (Array.isArray(roles)) user.roles = roles;
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
    user.status = status;
  }
  if (meta !== undefined) {
    user.meta = meta;
  }

  await user.save();
  response.success(res, user, 'User updated');
});

/**
 * @desc    Reset user password (admin/hr)
 * @route   POST /api/users/:id/reset-password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const user = await User.findById(id).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.password = password;
  await user.save();

  response.success(res, null, 'Password reset');
});
