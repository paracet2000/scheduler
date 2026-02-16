// seed/seed-menus-from-file.js
// Update/seed menus from a JSON file (default: data/menus.json).
//
// Usage:
//   node seed/seed-menus-from-file.js
//   node seed/seed-menus-from-file.js --file data/menus.json --apply
//
// Notes:
// - Dry-run by default (no DB writes) unless --apply is provided.
// - Upserts by mnu_code.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Menu = require('../model/menu.model');

function parseArgs(argv) {
  const out = { file: 'data/menus.json', apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--file') out.file = argv[i + 1] || out.file;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.isAbsolute(args.file)
    ? args.file
    : path.join(__dirname, '..', args.file);

  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Menu JSON file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let items = JSON.parse(raw);
  if (!Array.isArray(items)) {
    throw new Error('Menu JSON must be an array of menu objects');
  }

  // Normalize exported API dumps: sometimes wrapped as {data:[...]}
  if (items.length === 0 && raw.includes('"data"')) {
    const wrapped = JSON.parse(raw);
    if (Array.isArray(wrapped?.data)) items = wrapped.data;
  }

  const cleaned = items
    .map((m) => ({
      mnu_code: String(m?.mnu_code || '').trim(),
      mnu_name: String(m?.mnu_name || m?.mnu_description || '').trim(),
      mnu_description: String(m?.mnu_description || '').trim(),
      mnu_icon: m?.mnu_icon === undefined ? undefined : String(m.mnu_icon || '').trim(),
      mnu_status: m?.mnu_status === undefined ? undefined : String(m.mnu_status || '').trim().toUpperCase()
    }))
    .filter((m) => m.mnu_code && m.mnu_description);

  if (!cleaned.length) {
    throw new Error('No valid menus found (need mnu_code + mnu_description)');
  }

  // Preview
  console.log(`File: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  console.log(`Menus in file (valid): ${cleaned.length}`);
  cleaned.slice(0, 10).forEach((m) => console.log(`- ${m.mnu_code} | ${m.mnu_description}`));
  if (cleaned.length > 10) console.log(`... and ${cleaned.length - 10} more`);
  console.log(`Mode: ${args.apply ? 'APPLY (write to DB)' : 'DRY-RUN (no DB writes)'}`);

  if (!args.apply) return;

  await mongoose.connect(uri);

  const ops = cleaned.map((m) => {
    const $set = { mnu_name: m.mnu_name || m.mnu_description, mnu_description: m.mnu_description };
    if (m.mnu_icon !== undefined) $set.mnu_icon = m.mnu_icon;
    if (m.mnu_status !== undefined) $set.mnu_status = m.mnu_status;
    return {
      updateOne: {
        filter: { mnu_code: m.mnu_code },
        update: { $set },
        upsert: true
      }
    };
  });

  const result = await Menu.bulkWrite(ops, { ordered: false });
  console.log(
    `Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});
