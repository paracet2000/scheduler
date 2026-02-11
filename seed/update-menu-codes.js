// seed/update-menu-codes.js
// Update menu codes to prefixed sortable format and sync menu_authorize
require('dotenv').config();
const mongoose = require('mongoose');
const Menu = require('../model/menu.model');
const MenuAuthorize = require('../model/menu.authorize.model');

const CODE_MAP = {
  menuSignup: '01menuSignup',
  menuLogin: '02menuLogin',
  menuSettingsPersonal: '07menuSettingsPersonal',
  menuSettingsSystem: '12menuSettingsSystem',
  menuSchedule: '17menuSchedule',
  menuChangeRequest: '22menuChangeRequest',
  menuScheduleSummary: '27menuScheduleSummary',
  menuKpiEntry: '32menuKpiEntry',
  menuKpiDashboard: '37menuKpiDashboard',
  menuKpiTools: '42menuKpiTools',
  menuCommonReport: '47menuCommonReport',
  menuUserManagement: '52menuUserManagement',
  menuTimeAttendanceSync: '57menuTimeAttendanceSync',
  menuLogout: '99menuLogout'
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const menus = await Menu.find({});
    if (!menus.length) {
      console.log('No menus found.');
      process.exit(0);
    }

    const menuOps = menus.map((m) => {
      const nextCode = CODE_MAP[m.mnu_code] || m.mnu_code;
      return {
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { mnu_code: nextCode } }
        }
      };
    });
    const menuResult = await Menu.bulkWrite(menuOps, { ordered: false });

    const authOps = Object.entries(CODE_MAP).map(([oldCode, newCode]) => ({
      updateMany: {
        filter: { mnu_code: oldCode },
        update: { $set: { mnu_code: newCode } }
      }
    }));
    const authResult = await MenuAuthorize.bulkWrite(authOps, { ordered: false });

    console.log(`Menus updated: ${menuResult.modifiedCount}`);
    console.log(`MenuAuthorize updated: ${authResult.modifiedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Update error:', err);
    process.exit(1);
  }
}

run();
