/**
 * admin.seed.js
 * Seed admin user with all roles
 * run: node seed/admin.seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../model/user.model');

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    let user = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    if (!user) {
      user = new User({
        name: 'Admin',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        roles: ['user', 'head', 'approver', 'hr', 'finance', 'admin'],
        status: 'ACTIVE',
        emailVerified: true,
        meta: { 'Can-use-kpi-tools': 1 }
      });
      await user.save();
      console.log('✅ Admin user created');
    } else {
      user.name = user.name || 'Admin';
      user.roles = ['user', 'head', 'approver', 'hr', 'finance', 'admin'];
      user.status = 'ACTIVE';
      user.emailVerified = true;
      user.meta = { ...(user.meta || {}), 'Can-use-kpi-tools': 1 };
      await user.save();
      console.log('✅ Admin user updated');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
