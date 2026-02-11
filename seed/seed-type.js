// seed/seed-type.js
// Seed types (typ_code, typ_description)
require('dotenv').config();
const mongoose = require('mongoose');
const Type = require('../model/type.model');

const TYPES = [
  { typ_code: 'DEPT', typ_description: 'Department' },
  { typ_code: 'POST', typ_description: 'Position' },
  { typ_code: 'ROLE', typ_description: 'หน้าที่บทบาท' },
  { typ_code: 'SHIFT', typ_description: 'รหัสเวร' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const ops = TYPES.map((t) => ({
      updateOne: {
        filter: { typ_code: t.typ_code },
        update: {
          $set: {
            typ_code: t.typ_code,
            typ_description: t.typ_description,
            status: 'ACTIVE'
          }
        },
        upsert: true
      }
    }));

    const result = await Type.bulkWrite(ops, { ordered: false });
    const total = await Type.countDocuments({ typ_code: { $in: TYPES.map(t => t.typ_code) } });

    console.log('Seeded types:');
    TYPES.forEach((t) => console.log(`- ${t.typ_code} | ${t.typ_description}`));
    console.log(`Upserted: ${result.upsertedCount}, Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    console.log(`Total Types (these codes): ${total}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
