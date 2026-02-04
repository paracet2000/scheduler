const User = require('../model/user');
const asyncHandler = require('../helpers/asyncHandler');
const response = require('../helpers/response');
const AppError = require('../helpers/AppError');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mail = require('../helpers/mail.helper');

/* ---------- helpers ---------- */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

/* ---------- register ---------- */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new AppError('Email already exists', 400);

  const verifyToken = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    name,
    email,
    password,
    emailVerifyToken: verifyToken
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
exports.verify = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ emailVerifyToken: token });
  if (!user) throw new AppError('Invalid or expired token', 400);

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  await user.save();

  response.success(res, null, 'Email verified successfully');
});
