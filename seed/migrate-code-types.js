// seed/migrate-code-types.js
// Copy documents from code_types -> configurations (idempotent)
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const db = mongoose.connection.db;
    const source = db.collection('code_types');
    const target = db.collection('configurations');

    const docs = await source.find({}).toArray();
    if (!docs.length) {
      console.log('No documents found in code_types.');
      process.exit(0);
    }

    const ops = docs.map((doc) => {
      const { _id, ...rest } = doc;
      return {
        updateOne: {
          filter: { typ_code: rest.typ_code, conf_code: rest.conf_code },
          update: { $set: rest },
          upsert: true
        }
      };
    });

    const result = await target.bulkWrite(ops, { ordered: false });
    const total = await target.countDocuments({});

    console.log(`Migrated: ${docs.length} docs`);
    console.log(`Upserted: ${result.upsertedCount}, Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    console.log(`Total in configurations: ${total}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

migrate();
