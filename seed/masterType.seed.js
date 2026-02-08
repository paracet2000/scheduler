/**
 * mastertype.seed.js
 * ใช้สำหรับ seed master type data
 * run: node seed/mastertype.seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MasterType = require('../model/mastertype.model');

const masterTypes = [
  {
    code: 'WARD',
    name: 'Ward',
    description: 'ข้อมูลหอผู้ป่วย',
    order: 1,
  },
  {
    code: 'SHIFT',
    name: 'Shift',
    description: 'ข้อมูลเวร',
    order: 2,
  },
  {
    code: 'POSITION',
    name: 'Position',
    description: 'ตำแหน่งงาน',
    order: 3,
  },
  {
    code: 'SHIFT_NOTATION',
    name: 'Shift Notation',
    description: 'สัญลักษณ์เวร',
    order: 4,
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const codes = masterTypes.map((t) => t.code);
    await MasterType.deleteMany({ code: { $in: codes } });

    await MasterType.insertMany(masterTypes);

    console.log('✅ Master type seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
