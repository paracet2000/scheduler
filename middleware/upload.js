const multer = require('multer');
const AppError = require('../helpers/apperror');

// Store file in memory, then persist processed image to DB (not local disk).
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Only image files are allowed', 400));
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});
