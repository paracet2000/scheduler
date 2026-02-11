// seed/seed-dept.js
// Seed departments into code_types with typ_code = 'DEPT'
require('dotenv').config();
const mongoose = require('mongoose');
const CodeType = require('../model/code.type.model');

const DEPTS = [
  { conf_code: 'W01', conf_description: 'Pedetric ward' },
  { conf_code: 'ICU', conf_description: 'ICU' },
  { conf_code: 'OR', conf_description: 'OR' },
  { conf_code: 'CCU', conf_description: 'Cardio ICU' },
  { conf_code: 'W02', conf_description: 'Ward 2' },
  { conf_code: 'W03', conf_description: 'Ward 3' },
  { conf_code: 'W04', conf_description: 'Ward 4' },
  { conf_code: 'W05', conf_description: 'Ward 5' },
  { conf_code: 'W06', conf_description: 'Ward 6' },
  { conf_code: 'W07', conf_description: 'Ward 7' },
  { conf_code: 'W08', conf_description: 'Ward 8' },
  { conf_code: 'W09', conf_description: 'Ward 9' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const ops = DEPTS.map((d) => ({
      updateOne: {
        filter: { typ_code: 'DEPT', conf_code: d.conf_code },
        update: {
          $set: {
            typ_code: 'DEPT',
            conf_code: d.conf_code,
            conf_description: d.conf_description,
            conf_value: '',
            options: []
          }
        },
        upsert: true
      }
    }));

    const result = await CodeType.bulkWrite(ops, { ordered: false });
    const total = await CodeType.countDocuments({ typ_code: 'DEPT' });

    console.log('Seeded DEPT codes:');
    DEPTS.forEach((d) => console.log(`- ${d.conf_code} | ${d.conf_description}`));
    console.log(`Upserted: ${result.upsertedCount}, Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    console.log(`Total DEPT records: ${total}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
