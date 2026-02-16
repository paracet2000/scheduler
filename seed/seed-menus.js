// scripts/seed-menus.js
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Menu = require('../model/menu.model');

const menus = [
  { mnu_code: '01menuSignup', mnu_description: 'Register', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '02menuLogin', mnu_description: 'Login', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '07menuSettingsPersonal', mnu_description: 'Personal Settings', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '12menuSettingsSystem', mnu_description: 'System Settings', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '17menuSchedule', mnu_description: 'My Schedule', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '22menuChangeRequest', mnu_description: 'Change Request', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '27menuScheduleSummary', mnu_description: 'Schedule Summary', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '32menuKpiEntry', mnu_description: 'Shift Summary', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '33menuKpiDefinition', mnu_description: 'Shift Summary Structure', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '34menuKpiDashboardSetting', mnu_description: 'KPI Dashboard Setting', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '37menuKpiDashboard', mnu_description: 'KPI Dashboard', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '42menuKpiTools', mnu_description: 'KPI Tools', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '47menuCommonReport', mnu_description: 'Common Report', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '52menuUserManagement', mnu_description: 'User Management', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '53menuSchedulerHead', mnu_description: 'Scheduler Head', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '54menuWardMember', mnu_description: 'Ward Member', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '55menuShiftPattern', mnu_description: 'Shift Pattern', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '56menuUserRights', mnu_description: 'User Rights', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '57menuTimeAttendanceSync', mnu_description: 'Time Attendance Sync', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '58menuUserShiftRate', mnu_description: 'User Shift Rate', mnu_icon: '', mnu_status: 'ACTIVE' },
  { mnu_code: '99menuLogout', mnu_description: 'Logout', mnu_icon: '', mnu_status: 'ACTIVE' }
];

async function main() {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);

  const ops = menus.map((m) => ({
    updateOne: {
      filter: { mnu_code: m.mnu_code },
      update: {
        $set: {
          ...m,
          mnu_name: String(m.mnu_name || m.mnu_description || m.mnu_code || '').trim()
        }
      },
      upsert: true
    }
  }));

  const result = await Menu.bulkWrite(ops, { ordered: false });
  const total = await Menu.countDocuments({ mnu_code: { $in: menus.map(m => m.mnu_code) } });

  console.log('Menus to seed:');
  menus.forEach((m) => console.log(`- ${m.mnu_code} | ${m.mnu_description}`));
  console.log(`Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`);
  console.log(`Total in DB (these codes): ${total}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
