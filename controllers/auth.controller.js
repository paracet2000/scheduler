// controllers/auth.controller.js
const User = require('../model/user.model');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');
const AppError = require('../helpers/apperror');

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mail = require('../helpers/mail.helper');

/* ---------- helpers ---------- */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

/* ---------- register ---------- */
/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new AppError('Email already exists', 400);

  const verifyToken = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    name,
    email,
    password,
    emailVerifyToken: verifyToken,
    emailVerified: false
  });

  const verifyLink = `${process.env.CLIENT_URL}/verify/${verifyToken}`;
  await mail.sendVerifyEmail(user.email, verifyLink);

  const token = signToken(user._id);

  response.success(
    res,
    {
      user: user.toJSON(),
      token
    },
    'Register successful. Please verify your email.'
  );
});

/* ---------- login ---------- */
/**
 * @desc    Login
 * @route   POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new AppError('Invalid credentials', 401);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid credentials', 401);

  const token = signToken(user._id);

  response.success(
    res,
    {
      user: user.toJSON(),
      token
    },
    'Login successful'
  );
});

/* ---------- verify email ---------- */
/**
 * @desc    Verify email
 * @route   GET /api/auth/verify/:token
 */
exports.verify = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ emailVerifyToken: token });
  if (!user) throw new AppError('Invalid or expired token', 400);

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  await user.save();

  response.success(res, null, 'Email verified successfully');
});

/* ---------- resend verification email ---------- */
/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verify
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
