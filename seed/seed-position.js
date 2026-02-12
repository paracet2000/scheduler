// seed/seed-position.js
// Seed positions into configurations with typ_code = 'POST'
require('dotenv').config();
const mongoose = require('mongoose');
const Configuration = require('../model/configuration.model');

const POSITIONS = [
  { conf_code: 'RN', conf_description: 'RN' },
  { conf_code: 'PT', conf_description: 'PT' },
  { conf_code: 'TN', conf_description: 'TN' },
  { conf_code: 'CLERK', conf_description: 'Clerk' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const ops = POSITIONS.map((p) => ({
      updateOne: {
        filter: { typ_code: 'POST', conf_code: p.conf_code },
        update: {
          $set: {
            typ_code: 'POST',
            conf_code: p.conf_code,
            conf_description: p.conf_description,
            conf_value: '',
            options: []
          }
        },
        upsert: true
      }
    }));

    const result = await Configuration.bulkWrite(ops, { ordered: false });
    const total = await Configuration.countDocuments({ typ_code: 'POST' });

    console.log('Seeded POST codes:');
    POSITIONS.forEach((p) => console.log(`- ${p.conf_code} | ${p.conf_description}`));
    console.log(`Upserted: ${result.upsertedCount}, Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    console.log(`Total POST records: ${total}`);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();

