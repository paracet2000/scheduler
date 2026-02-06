/**
 * masterPattern.seed.js
 * ใช้สำหรับ seed master pattern data
 * run: node seed/masterPattern.seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MasterPattern = require('../model/masterpattern.model');

const patterns = [
  {
    code: 'OFF_WEEKEND',
    name: 'เวรหยุดหัวหน้า',
    description: 'X ทุกวันเสาร์-อาทิตย์',
    dayCodes: ['X', '', '', '', '', '', 'X'], // Sun ... Sat
    order: 1
  },
  {
    code: 'MGMT_WEEKDAY',
    name: 'เวรผู้บริหาร',
    description: 'ช จันทร์-ศุกร์',
    dayCodes: ['', 'ช', 'ช', 'ช', 'ช', 'ช', ''],
    order: 2
  },
  {
    code: 'PT_WED',
    name: 'เวร part time มาแทนหัวหน้าประชุม',
    description: 'บ ทุกวันพุธ',
    dayCodes: ['', '', '', 'บ', '', '', ''],
    order: 3
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const codes = patterns.map((p) => p.code);
    await MasterPattern.deleteMany({ code: { $in: codes } });
    await MasterPattern.insertMany(patterns);

    console.log('✅ Master pattern seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
