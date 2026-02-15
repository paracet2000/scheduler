require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const log = require('./helpers/log.helper');

connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  // log.info(`Server started on port ${PORT}`);
});
