// seed/seed-userxmenu.js
// Seed MenuAuthorize as cartesian product of all users x all menus
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../model/user.model');
const Menu = require('../model/menu.model');
const MenuAuthorize = require('../model/menu.authorize.model');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const [users, menus] = await Promise.all([
      User.find({}, { _id: 1 }),
      Menu.find({}, { mnu_code: 1 })
    ]);

    if (!users.length || !menus.length) {
      console.log('No users or menus to seed.');
      process.exit(0);
    }

    const ops = [];
    for (const user of users) {
      for (const menu of menus) {
        ops.push({
          updateOne: {
            filter: { userId: user._id, mnu_code: menu.mnu_code },
            update: {
              $setOnInsert: {
                userId: user._id,
                mnu_code: menu.mnu_code,
                acc_read: 1,
                acc_write: 1,
                acc_export: 1
              }
            },
            upsert: true
          }
        });
      }
    }

    const result = await MenuAuthorize.bulkWrite(ops, { ordered: false });
    const total = await MenuAuthorize.countDocuments({});

    console.log(`Users: ${users.length}, Menus: ${menus.length}`);
    console.log(`Upserted: ${result.upsertedCount}, Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    console.log(`Total MenuAuthorize: ${total}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
