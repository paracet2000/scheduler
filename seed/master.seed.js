/**
 * master.seed.js
 * ใช้สำหรับ seed master data (WARD, SHIFT, POSITION)
 * run: node master.seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Master = require('../model/base/master.schema');

const masters = [
  /* =========================
   * WARD
   * ========================= */
  {
    code: 'OPD',
    name: 'Out Patient Department',
    description: 'แผนกผู้ป่วยนอก',
    type: 'WARD',
    status: 'ACTIVE'
  },
  {
    code: 'ER',
    name: 'Emergency Room',
    description: 'ห้องฉุกเฉิน',
    type: 'WARD',
    status: 'ACTIVE'
  },
  {
    code: 'ICU',
    name: 'Intensive Care Unit',
    description: 'หอผู้ป่วยวิกฤต',
    type: 'WARD',
    status: 'ACTIVE'
  },
  {
    code: 'OR',
    name: 'Operating Room',
    description: 'ห้องผ่าตัด',
    type: 'WARD',
    status: 'ACTIVE'
  },
  {
    code: 'PEDIATRIC',
    name: 'Pediatric Ward',
    description: 'หอผู้ป่วยเด็ก',
    type: 'WARD',
    status: 'ACTIVE'
  },
  {
    code: 'WARD3C',
    name: 'Ward 3C',
    description: 'หอผู้ป่วย 3C',
    type: 'WARD',
    status: 'ACTIVE'
  },
  {
    code: 'WARD9C',
    name: 'Ward 9C',
    description: 'หอผู้ป่วย 9C',
    type: 'WARD',
    status: 'ACTIVE'
  },

  /* =========================
   * POSITION
   * ========================= */
  {
    code: 'GN',
    name: 'General Nurse',
    description: 'พยาบาลทั่วไป',
    type: 'POSITION',
    status: 'ACTIVE',
    meta: { level: 1 }
  },
  {
    code: 'PN',
    name: 'Practical Nurse',
    description: 'ผู้ช่วยพยาบาลวิชาชีพ',
    type: 'POSITION',
    status: 'ACTIVE',
    meta: { level: 1 }
  },
  {
    code: 'RN',
    name: 'Registered Nurse',
    description: 'พยาบาลวิชาชีพ',
    type: 'POSITION',
    status: 'ACTIVE',
    meta: { level: 2 }
  },
  {
    code: 'TN',
    name: 'Technical Nurse',
    description: 'พยาบาลเทคนิค',
    type: 'POSITION',
    status: 'ACTIVE',
    meta: { level: 2 }
  },
  {
    code: 'ASST',
    name: 'Assistant',
    description: 'ผู้ช่วย',
    type: 'POSITION',
    status: 'ACTIVE',
    meta: { level: 0 }
  },
  {
    code: 'CLERK',
    name: 'Clerk',
    description: 'เจ้าหน้าที่ธุรการ',
    type: 'POSITION',
    status: 'ACTIVE',
    meta: { level: 0 }
  },

  /* =========================
   * SHIFT
   * ========================= */
  {
    code: 'M',
    name: 'Morning Shift',
    description: 'เวรเช้า',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { hours: 7 }
  },
  {
    code: 'A',
    name: 'Afternoon Shift',
    description: 'เวรบ่าย',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { hours: 5 }
  },
  {
    code: 'N',
    name: 'Night Shift',
    description: 'เวรดึก',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { hours: 8 }
  },

  /* --- shift notations (ใช้ร่วมกับ base shift) --- */
  {
    code: '*',
    name: 'On Call',
    description: 'เวร on-call',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { flag: 'ONCALL' }
  },
  {
    code: '#',
    name: 'Management',
    description: 'เวรฝ่ายบริหาร',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { flag: 'MANAGEMENT' }
  },
  {
    code: '%',
    name: 'Special Event',
    description: 'กิจกรรมพิเศษ (HA, ISO9000)',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { flag: 'SPECIAL_EVENT' }
  },
  {
    code: '+',
    name: 'Extended Shift',
    description: 'ขายเวลาเพิ่ม 4 ชั่วโมง',
    type: 'SHIFT',
    status: 'ACTIVE',
    meta: { extraHours: 4 }
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // ลบเฉพาะ master ที่เกี่ยวข้อง
    await Master.deleteMany({
      type: { $in: ['WARD', 'POSITION', 'SHIFT'] }
    });

    await Master.insertMany(masters);

    console.log('🌱 Master data seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
