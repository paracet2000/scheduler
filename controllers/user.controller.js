const User = require('../model/user');
const asyncHandler = require('../helpers/asyncHandler');
const response = require('../helpers/response');
const AppError = require('../helpers/AppError');

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

/**
 * @desc    Resend verification email
 * @route   POST /api/users/resend-verify
 */
exports.resendVerifyEmail = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.emailVerified) {
    throw new AppError('Email already verified', 400);
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');

  user.emailVerifyToken = verifyToken;
  await user.save();

  const verifyLink = `${process.env.CLIENT_URL}/verify/${verifyToken}`;
  await mail.sendVerifyEmail(user.email, verifyLink);

  response.success(res, null, 'Verification email resent');
});

