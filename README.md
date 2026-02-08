# Scheduler

## Setup
Seed ขั้นพื้นฐานสำหรับระบบใหม่ (เรียงตาม dependency):

1. **Master Types**
   - `WARD`, `SHIFT`, `POSITION`, `SHIFT_NOTATION`
2. **Master Data**
   - `WARD` (รวม `meta.group`)
   - `SHIFT` (รวม `meta` เช่น color/bucket/rate)
   - `POSITION`
3. **Master Pattern**
   - Pattern เวรพื้นฐาน
4. **Users**
   - อย่างน้อย 1 `admin` + 1 `head` + 1 `user`
5. **Ward Member**
   - ผูก `userId` + `wardId` + `position` (+ `roles`)
6. **Scheduler Head**
   - เปิดช่วง booking ต่อ ward
7. **User Shift Rate** (ถ้าคำนวณเงิน)
   - กำหนด rate ต่อ user + shift

## New Employee
ขั้นตอนเพิ่มพยาบาล 1 คน:

1. **สร้าง User**
   - `name`, `email`, `password`, `phone`
   - `roles`: อย่างน้อย `user` (ถ้าเป็นหัวหน้าเพิ่ม `head`)
2. **Ward Member**
   - เพิ่ม record ใน ward-member: `userId`, `wardId`, `position`, `roles`
3. **User Shift Rate** (ถ้าใช้เงิน)
   - ใส่ rate ต่อ shift สำหรับ user นี้
4. **ตรวจ Email/Phone**
   - เพื่อให้สร้าง Change Request และ Notify ได้

## KPI Tools Access
การเปิดสิทธิ์เมนู **KPI Tools** ให้ผู้ใช้ ทำโดยกำหนด `meta` ของ User:

- Key: `meta.Can-use-kpi-tools`
- Value ที่ถือว่าเปิดใช้: `true`, `1`, `"1"`, `"true"` (ค่าใดๆ ที่เป็น truthy)
- Value ที่ปิดใช้: `false`, `0`, `null`, `undefined` หรือไม่ใส่ key นี้เลย

**ข้อควรระวัง**
- `"0"` (สตริง) จะถูกตีความเป็น **true** เพราะเป็น string ที่ไม่ว่าง
- เพื่อความชัดเจน แนะนำใช้ `true` หรือ `false` เท่านั้น

**ตัวอย่าง**
```
meta: {
  "Can-use-kpi-tools": true
}
```
