// middleware/authenticate.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const User = require('../model/user.model');

module.exports = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    throw new AppError('Unauthorized', 401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);
  
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('User not found or inactive', 401);
  }

  req.user = user;
  next();
});
