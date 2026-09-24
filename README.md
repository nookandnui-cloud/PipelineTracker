# MFEC Pipeline Tracker — Weekly

เว็บแอปพลิเคชันติดตาม pipeline โปรเจกต์รายสัปดาห์ (System Team)
**ไม่ต้องติดตั้งอะไร** — เปิด `index.html` ใน browser ได้เลย (pure HTML/CSS/JS)

## วิธีใช้

1. เปิด `index.html`
2. **หน้าแรก:** ลากไฟล์ `.xlsx` มาวาง (หรือกดเลือกไฟล์) เช่น `Pipeline system team.xlsx`
3. ระบบอ่าน sheet pipeline ในไฟล์ (หาจากชื่อ sheet ที่มีคำว่า "pipeline", ไม่มีก็ใช้ sheet ใหญ่สุด)
   normalize ข้อมูลให้อัตโนมัติ แล้วเข้าสู่ Dashboard
4. ครั้งถัดไปเปิดมาใหม่ ถ้ายังใช้ไฟล์เดิมกด **"เข้าสู่ Dashboard ด้วยข้อมูลเดิม"** ได้เลย
   (ข้อมูล+ประวัติรายสัปดาห์เก็บใน localStorage ของ browser)
5. อัปโหลดไฟล์ใหม่ทุกสัปดาห์ผ่านปุ่ม **"เปลี่ยนไฟล์"** (มุมขวาบน) — ข้อมูลเก่าจะถูกแทนที่

> ทุกอย่างประมวลผลในเครื่องคุณ ไม่มีการส่งไฟล์ขึ้น server ใดๆ

## แท็บทั้ง 3

| แท็บ | ทำอะไรได้ |
|---|---|
| **ภาพรวม** | KPI, กราฟทีม×สถานะ, ไทม์ไลน์ Target Quarter, Top มูลค่า, watchlist |
| **โปรเจกต์** | ตารางครบทุกคอลัมน์ + **filter ทีม/สถานะ/Presales/Target** + ค้นหา, drawer แก้ไข, เพิ่ม/ลบ, export CSV |
| **รายงาน** | **filter ช่วงเวลา: ทั้งหมด/รายเดือน/ราย Q/รายปี** (ตาม Start Date), Pivot ทีม×สถานะ, Pivot Presales×สถานะ, Win/Watchlist, export CSV / พิมพ์ PDF |

## บันทึกอัตโนมัติเป็นไฟล์ .xlsx รายวัน

เมื่อ**แก้ไข / เพิ่ม / ลบโปรเจกต์** ระบบจะเขียนไฟล์ Excel ให้อัตโนมัติ:

- ชื่อไฟล์: `<ชื่อไฟล์ต้นทาง>-YYYY-MM-DD.xlsx` เช่น `Pipeline system team-2026-09-24.xlsx`
- **วันเดียวกัน → เขียนทับไฟล์ของวันนั้น**, ข้ามวัน → สร้างไฟล์วันใหม่ (เก็บประวัติรายวันไว้เป็นไฟล์)
- ครั้งแรกที่บันทึก browser จะถามที่ตั้งไฟล์ 1 ครั้ง แล้วจำ (File System Access API — Chrome/Edge)
- ถ้า browser ไม่รองรับ (Firefox/Safari) ปุ่ม "บันทึก Excel" จะดาวน์โหลดไฟล์แทน
- มีปุ่ม **"บันทึก Excel"** (มุมขวาบน) สำหรับบันทึกมือ + สถานะการบันทึกแสดงข้างๆ

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | landing/upload + shell แอป |
| `styles.css` | design tokens + components |
| `libs/xlsx.full.min.js` | SheetJS 0.20.3 (เก็บ local ใช้ offline) — อ่านไฟล์ Excel ใน browser |
| `js/upload.js` | อ่าน .xlsx ที่อัปโหลด + normalize (port จาก build_data.py) |
| `js/util.js` | state, localStorage, week/quarter helpers, CSV |
| `js/charts.js` | SVG charts (ไม่มี dependency): stacked bars, timeline, donut |
| `js/dashboard.js` / `weekly.js` / `projects.js` / `report.js` | 4 views |
| `js/app.js` | bootstrap + routing + landing→app flow |
| `pipeline-data.js` | seed ตัวอย่างจาก Excel ล่าสุด (สำรอง กรณีไม่อัปโหลด) |
| `build_data.py` | (dev) regenerate seed จาก Excel — `py build_data.py "<file>.xlsx" pipeline-data.js` |

## Normalize ที่ทำให้อัตโนมัติตอนอัปโหลด

- ทีม: `Ent/ENTE → ENT`, `Mtis → MTIS`
- สถานะ: `win/Win → Win`, `lost/Lost → Lost`, `drop/Drop → Drop`, `Inprogress → In Progress`
- ไตรมาส: ตัดอักขระไทยหลุด เช่น `Q2/202ุ6 → Q2/2026`
- Revenue ข้อความ → ตัวเลข, Start Date เสีย (`16/4/20206`) → ว่าง
- หาหัวคอลัมน์แบบยืดหยุ่น (ชื่อใกล้เคียงก็หาเจอ เช่น "Budget" แทน "Revenue")

## การใช้งานรายสัปดาห์ (workflow แนะนำ)

1. อัปโหลดไฟล์ Excel ประจำสัปดาห์ (ปุ่ม "เปลี่ยนไฟล์" ถ้าเปิดค้างไว้)
2. แท็บ **อัปเดตรายสัปดาห์** — อัปเดตสถานะ dropdown / slider %คืบหน้า / %win + โน้ตสั้นๆ
3. ดู "สรุปการเคลื่อนไหว" ด้านล่าง — diff กับสัปดาห์ก่อนอัตโนมัติ
4. แท็บ **รายงาน** — pivot ทีม×สถานะ + movement, export CSV หรือพิมพ์ PDF ส่งหัวหน้า

## การทดสอบ

```bash
node verify.js                                      # data layer — 19 checks
node render-test.js                                 # render ทุก view + charts
node upload-test.js "../Pipeline system team.xlsx"  # parse Excel จริง + ingest + render
```

ผลล่าสุด: ALL PASSED ทั้ง 3 suite (verify 19/19, render 6/6, upload 15/15)

## หมายเหตุ

- localStorage เป็น per-browser/per-PC — ใช้ข้ามเครื่องไม่ได้ แนะนำ export CSV สำรองรายสัปดาห์
- ถ้าไฟล์ Excel ใช้หัวคอลัมน์ต่างจากนี้มาก ระบบจะแจ้ง error พร้อมสาเหตุ ลองเช็คว่ามีหัวคอลัมน์ "Project name" และ "Win/Lost/Drop"
