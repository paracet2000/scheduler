// seed/seed-menu-layouts.js
const path = require('path')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const MenuLayout = require('../model/menu.layout.model')

const layouts = [
  { tab_name: 'settings', mnu_code: '01menuSignup' },
  { tab_name: 'settings', mnu_code: '02menuLogin' },
  // Personal dashboard (current closest menu code in system)
  { tab_name: 'schedule', mnu_code: '07menuSettingsPersonal' },
  { tab_name: 'settings', mnu_code: '12menuSettingsSystem' },
  { tab_name: 'schedule', mnu_code: '17menuSchedule' },
  { tab_name: 'schedule', mnu_code: '22menuChangeRequest' },
  { tab_name: 'schedule', mnu_code: '27menuScheduleSummary' },
  { tab_name: 'routine-data', mnu_code: '32menuKpiEntry' },
  { tab_name: 'settings', mnu_code: '33menuKpiDefinition' },
  { tab_name: 'settings', mnu_code: '34menuKpiDashboardSetting' },
  { tab_name: 'routine-data', mnu_code: '37menuKpiDashboard' },
  { tab_name: 'settings', mnu_code: '42menuKpiTools' },
  { tab_name: 'routine-data', mnu_code: '47menuCommonReport' },
  { tab_name: 'settings', mnu_code: '52menuUserManagement' },
  { tab_name: 'routine-data', mnu_code: '53menuSchedulerHead' },
  { tab_name: 'routine-data', mnu_code: '54menuWardMember' },
  { tab_name: 'settings', mnu_code: '55menuShiftPattern' },
  { tab_name: 'settings', mnu_code: '56menuUserRights' },
  { tab_name: 'routine-data', mnu_code: '57menuTimeAttendanceSync' },
  { tab_name: 'settings', mnu_code: '58menuUserShiftRate' },
  { tab_name: 'settings', mnu_code: '99menuLogout' }
]

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim()
  if (!uri) throw new Error('MONGODB_URI is not set in .env')

  await mongoose.connect(uri)

  const ops = layouts.map((item) => ({
    updateOne: {
      filter: { mnu_code: item.mnu_code },
      update: { $set: { tab_name: item.tab_name, mnu_code: item.mnu_code } },
      upsert: true
    }
  }))

  const result = await MenuLayout.bulkWrite(ops, { ordered: false })
  console.log(`Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exitCode = 1
})
