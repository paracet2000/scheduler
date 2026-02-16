// seed/forecast-menu-names.js
// Forecast mnu_name from mnu_description + mnu_code, then upsert by mnu_code.
//
// Usage:
//   node seed/forecast-menu-names.js
//   node seed/forecast-menu-names.js --apply
//   node seed/forecast-menu-names.js --apply --force
//
// Notes:
// - Dry-run by default.
// - Without --force, only rows with empty mnu_name will be updated.

const path = require('path')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const Menu = require('../model/menu.model')

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    force: argv.includes('--force')
  }
}

function normalizeCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '')
    .trim()
}

function humanizeCode(code) {
  const raw = String(code || '').trim()
  if (!raw) return ''

  const cleaned = raw
    .replace(/^\d+/, '')
    .replace(/^menu/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word
      if (/^[a-z0-9]{2,}$/.test(word)) return word.charAt(0).toUpperCase() + word.slice(1)
      return word
    })
    .join(' ')
}

function forecastName(menu) {
  const desc = String(menu?.mnu_description || '').trim()
  const codeName = humanizeCode(menu?.mnu_code)
  if (desc && codeName) {
    const d = normalizeCompare(desc)
    const c = normalizeCompare(codeName)
    if (!d || !c || d === c || d.includes(c) || c.includes(d)) return desc
    return `${desc} (${codeName})`
  }
  return desc || codeName || String(menu?.mnu_code || '').trim()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const uri = String(process.env.MONGODB_URI || '').trim()
  if (!uri) throw new Error('MONGODB_URI is not set in .env')

  await mongoose.connect(uri)

  const menus = await Menu.find({}).select('mnu_code mnu_description mnu_name').sort({ mnu_code: 1 })
  if (!menus.length) {
    console.log('No menus found.')
    await mongoose.disconnect()
    return
  }

  const rows = menus.map((m) => {
    const currentName = String(m.mnu_name || '').trim()
    const nextName = forecastName(m)
    const shouldUpdate = args.force ? !!nextName : !currentName && !!nextName
    return {
      id: m._id,
      mnu_code: String(m.mnu_code || '').trim(),
      currentName,
      nextName,
      shouldUpdate
    }
  })

  const toUpdate = rows.filter((r) => r.shouldUpdate && r.nextName)
  console.log(`Menus found: ${rows.length}`)
  console.log(`Will update: ${toUpdate.length}`)
  rows.slice(0, 10).forEach((r) => {
    console.log(`- ${r.mnu_code} | current="${r.currentName}" | forecast="${r.nextName}"`)
  })
  if (rows.length > 10) console.log(`... and ${rows.length - 10} more`)
  console.log(`Mode: ${args.apply ? 'APPLY (write to DB)' : 'DRY-RUN (no DB writes)'}`)

  if (!args.apply || !toUpdate.length) {
    await mongoose.disconnect()
    return
  }

  const ops = toUpdate.map((r) => ({
    updateOne: {
      filter: { mnu_code: r.mnu_code },
      update: {
        $set: {
          mnu_name: r.nextName
        }
      },
      upsert: true
    }
  }))

  const result = await Menu.bulkWrite(ops, { ordered: false })
  console.log(`Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exitCode = 1
})

