const express = require('express');
const router = express.Router();

// Example route for user-wards
router.get('/', (req, res) => {
  res.status(200).json({ message: 'User-Wards route is working!' });
});

module.exports = router;