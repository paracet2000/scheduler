/**
 * user-shift-rate.seed.js
 * Seed user shift rates for all users based on shift code prefix.
 * run: node seed/user-shift-rate.seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../model/user.model');
const Master = require('../model/base/master.schema');
const UserShiftRate = require('../model/user-shift-rate.model');

const resolveAmount = (code) => {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) return null;
  if (upper.startsWith('ช') || upper.startsWith('M')) return 800;
  if (upper.startsWith('บ') || upper.startsWith('A')) return 700;
  if (upper.startsWith('ด') || upper.startsWith('N')) return 1000;
  return null;
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const [users, shifts] = await Promise.all([
      User.find().select('_id status').lean(),
      Master.find({ type: 'SHIFT', status: 'ACTIVE' }).select('code').lean()
    ]);

    if (!users.length) {
      console.log('⚠️ No users or shifts found. Nothing to seed.');
      process.exit(0);
    }

    const baseCodes = ['A', 'M', 'N', 'ช', 'บ', 'ด'];
    const shiftCodes = new Set(
      [...shifts.map(s => String(s.code).trim().toUpperCase()), ...baseCodes]
        .filter(Boolean)
    );

    let upserts = 0;
    for (const user of users) {
      for (const code of shiftCodes) {
        const amount = resolveAmount(code);
        if (amount === null) continue;
        await UserShiftRate.updateOne(
          { userId: user._id, shiftCode: String(code).trim().toUpperCase() },
          { $set: { amount, currency: 'THB', status: 'ACTIVE' } },
          { upsert: true }
        );
        upserts += 1;
      }
    }

    console.log(`✅ User shift rates seeded: ${upserts} records upserted`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
