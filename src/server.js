require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

/* ---------- middleware ---------- */
app.use(cors());
app.use(express.json());

/* ---------- health check ---------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ---------- port ---------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
