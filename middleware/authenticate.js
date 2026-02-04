const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../helpers/AppError');
const asyncHandler = require('../helpers/asyncHandler');

module.exports = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Unauthorized', 401);
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new AppError('Invalid token', 401);
  }

  const user = await User.findById(decoded.userId).select('-password');
  if (!user) {
    throw new AppError('User not found', 401);
  }

  req.user = user;
  next();
});
