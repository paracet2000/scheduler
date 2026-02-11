/**
 * admin.seed.js
 * Seed default users
 * run: node seed/admin.seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../model/user.model');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const EMPLOYEES = [
  { name: 'Admin', email: 'admin@admin.com', employeeCode: '1001', roles: ['user', 'head', 'approver', 'hr', 'finance', 'admin'], meta: { 'Can-use-kpi-tools': 1 } },
  { name: 'User', email: 'user@user.com', employeeCode: '1002', roles: ['user'], meta: {} },
  { name: 'Head', email: 'head@head.com', employeeCode: '1003', roles: ['head'], meta: {} }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    for (const emp of EMPLOYEES) {
      let user = await User.findOne({ email: emp.email }).select('+password');
      if (!user) {
        user = new User({
          name: emp.name,
          email: emp.email,
          password: ADMIN_PASSWORD,
          employeeCode: emp.employeeCode,
          roles: emp.roles,
          status: 'ACTIVE',
          emailVerified: true,
          meta: emp.meta
        });
        await user.save();
        console.log(`✅ ${emp.email} created`);
      } else {
        user.name = emp.name;
        user.roles = emp.roles;
        user.employeeCode = emp.employeeCode;
        user.status = 'ACTIVE';
        user.emailVerified = true;
        user.meta = { ...(user.meta || {}), ...(emp.meta || {}) };
        if (!user.password) {
          user.password = ADMIN_PASSWORD;
        }
        await user.save();
        console.log(`✅ ${emp.email} updated`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
