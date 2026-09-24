# PipelineTracker

**Dashboard ติดตาม pipeline โปรเจกต์รายสัปดาห์** — สำหรับฝ่ายขาย/ธุรกิจ ใช้ track โปรเจกต์จากไฟล์ Excel

> **ไม่ต้องติดตั้งอะไร** — เปิด `index.html` ใน browser ได้เลย (pure HTML/CSS/JS)

---

## เร็วๆ

| ขั้นตอน | ทำอะไร |
|---|---|
| 1. เปิด | เปิด `index.html` ใน browser |
| 2. อัปโหลด Excel | ลากไฟล์ `.xlsx` มาวาง หรือกดเลือกไฟล์ |
| 3. ใช้งาน | ระบบอ่านข้อมูลโดยอัตโนมัติ โดยแบ่งเป็น 3 แท็บ: **ภาพรวม**, **โปรเจกต์**, **รายงาน** |
| 4. บันทึก | แก้ไข/เพิ่ม/ลบโปรเจกต์ ระบบจะบันทึกไฟล์ Excel `.xlsx` รายวันโดยอัตโนมัติ |

> ทุกอย่างประมวลผลในเครื่องคุณ ไม่มีการส่งไฟล์ขึ้น server

---

## จุดเด่น

- **อ่านไฟล์ Excel ได้โดยตรง** — ใช้ SheetJS (xlsx.full.min.js) โหลดใน browser
- **3 แท็บครบ**:
  - **ภาพรวม**: KPI, กราฟทีม×สถานะ, ไทม์ไลน์ Target Quarter, Top มูลค่า, watchlist
  - **โปรเจกต์**: ตารางทุกคอลัมน์ + filter ทีม/สถานะ/Presales/Target + ค้นหา, drawer แก้ไข, เพิ่ม/ลบ, export CSV
  - **รายงาน**: filter ช่วงเวลา (ทั้งหมด/รายเดือน/ราย Q/รายปี) + Pivot ทีม×สถานะ, Presales×สถานะ, Win/Watchlist, export CSV / พิมพ์ PDF
- **บันทึกอัตโนมัติเป็นไฟล์ `.xlsx`**:
  - ชื่อไฟล์: `<ชื่อไฟล์ต้นทาง>-YYYY-MM-DD.xlsx` (เช่น `Pipeline system team-2026-09-24.xlsx`)
  - วันเดียวกัน → เขียนทับไฟล์ของวันนั้น, ข้ามวัน → สร้างไฟล์วันใหม่ (เก็บประวัติรายวัน)
  - ครั้งแรกที่บันทึก browser จะถามที่ตั้งไฟล์ 1 ครั้ง (File System Access API — Chrome/Edge)
  - ถ้า browser ไม่รองรับ (Firefox/Safari) ปุ่ม "บันทึก Excel" จะดาวน์โหลดไฟล์แทน
  - มีปุ่ม **"บันทึก Excel"** มุมขวาบน สำหรับบันทึกมือ + สถานะการบันทึกแสดงข้างๆ
- **normalize อัตโนมัติ** ตอนอัปโหลด:
  - ทีม: `Ent/ENTE → ENT`, `Mtis → MTIS`
  - สถานะ: `win/Win → Win`, `lost/Lost → Lost`, `drop/Drop → Drop`, `Inprogress → In Progress`
  - ไตรมาส: ตัดอักขระไทยหลุด เช่น `Q2/202ุ6 → Q2/2026`
  - Revenue ข้อความ → ตัวเลข, Start Date เสีย → ว่าง
  - หาหัวคอลัมน์แบบยืดหยุ่น (ชื่อใกล้เคียงก็หาเจอ เช่น "Budget" แทน "Revenue")

---

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

---

## วิธีใช้ (Workflow รายสัปดาห์)

1. **อัปโหลดไฟล์ Excel** ประจำสัปดาห์ (ปุ่ม "เปลี่ยนไฟล์" ถ้าเปิดค้างไว้)
2. **แท็บ อัปเดตรายสัปดาห์** — อัปเดตสถานะ dropdown / slider %คืบหน้า / %win + โน้ตสั้นๆ
3. **ดู "สรุปการเคลื่อนไหว"** ด้านล่าง — diff กับสัปดาห์ก่อนอัตโนมัติ
4. **แท็บ รายงาน** — pivot ทีม×สถานะ + movement, export CSV หรือพิมพ์ PDF ส่งหัวหน้า

### แท็บรายละเอียด

| แท็บ | ทำอะไรได้ |
|---|---|
| **ภาพรวม** | KPI, กราฟทีม×สถานะ, ไทม์ไลน์ Target Quarter, Top มูลค่า, watchlist |
| **โปรเจกต์** | ตารางครบทุกคอลัมน์ + filter ทีม/สถานะ/Presales/Target + ค้นหา, drawer แก้ไข, เพิ่ม/ลบ, export CSV |
| **รายงาน** | filter ช่วงเวลา: ทั้งหมด/รายเดือน/ราย Q/รายปี (ตาม Start Date), Pivot ทีม×สถานะ, Pivot Presales×สถานะ, Win/Watchlist, export CSV / พิมพ์ PDF |

---

## ฟอร์แมต Excel ที่รองรับ

ไฟล์ Excel ควรมีคอลัมน์เหล่านี้ (システム จะหาให้อัตโนมัติถ้าใช้ชื่อใกล้เคียง):

| Column | คำอธิบาย |
|--------|-----------|
| Team / ทีม | ชื่อทีม |
| Quarter / ไตรมาส | Q1, Q2, Q3, Q4 |
| Presales / ประธาน | ชื่อผู้ดูแลโครงการ |
| Project name / ชื่อโครงการ | ชื่อโครงการ |
| Status / สถานะ | In Progress, Win, Lost, Drop |
| Revenue / มูลค่า | มูลค่าโครงการ (ตัวเลข) |
| Start Date | วันเริ่มโครงการ |

> ระบบจะ normalize ชื่อคอลัมน์โดยอัตโนมัติ — ใช้ชื่อภาษาอังกฤษหรือไทยก็ได้

---

## การทดสอบ (สำหรับ developer)

```bash
node verify.js                                      # data layer — 19 checks
node render-test.js                                 # render ทุก view + charts
node upload-test.js "../Pipeline system team.xlsx" # parse Excel จริง + ingest + render
```

ผลล่าสุด: **ALL PASSED** ทั้ง 3 suite (verify 19/19, render 6/6, upload 15/15)

---

## Deploy บน OpenShift

### ขั้นตอน Deploy

อ้างอิง pattern จาก **[nookandnui-cloud/VMTools](https://github.com/nookandnui-cloud/VMTools)** — ใช้ ConfigMap + Busybox httpd (ไม่ต้อง build Docker image)

#### 1. สร้าง namespace
```bash
oc new-project mfec-pipeline-tools
```

#### 2. สร้าง ConfigMap (แยก 3 ไฟล์ เพื่อไม่ให้เกิน 1MB limit)

```bash
# ConfigMap 1: ไฟล์หลัก (index.html, styles.css, pipeline-data.js, etc.)
oc create configmap pipeline-tracker-app \
  --from-file=index.html=index.html \
  --from-file=styles.css=styles.css \
  --from-file=pipeline-data.js=pipeline-data.js \
  --from-file=build_data.py=build_data.py \
  --from-file=inspect_xlsx.py=inspect_xlsx.py \
  --from-file=render-test.js=render-test.js \
  --from-file=upload-test.js=upload-test.js \
  --from-file=verify.js=verify.js

# ConfigMap 2: ไฟล์ JavaScript ใน js/
oc create configmap pipeline-tracker-js \
  --from-file=js/app.js=js/app.js \
  --from-file=js/upload.js=js/upload.js \
  --from-file=js/pivot.js=js/pivot.js \
  --from-file=js/report.js=js/report.js \
  --from-file=js/dashboard.js=js/dashboard.js

# ConfigMap 3: ไฟล์ xlsx.full.min.js (ขนาด ~951KB ต้องแยก)
oc create configmap pipeline-tracker-xlsx \
  --from-file=libs/xlsx.full.min.js=libs/xlsx.full.min.js
```

> **หมายเหตุ:** `libs/xlsx.full.min.js` มีขนาด ~951KB — หากรวมกับไฟล์อื่นใน ConfigMap เดียวจะเกิน 1MB limit

#### 3. สร้าง Deployment

ไฟล์ YAML พร้อมใช้งานอยู่ใน `openshift/deployment.yaml`:

```bash
oc apply -f openshift/deployment.yaml -n mfec-pipeline-tools
```

เนื้อหา deployment.yaml สรุป:
- `kind: Deployment` — replicas: 1, strategy: Recreate
- Container: `busybox:1.36` รัน `/bin/httpd -f -v -p /data -c httpd.conf`
- Volume mounts: `pipeline-tracker-app` → `/data`, `pipeline-tracker-js` → `/data/js`, `pipeline-tracker-xlsx` → `/data/libs`
- Liveness/Readiness probe: httpGet path=/ port=8080
- Resources: requests 64Mi/50m, limits 128Mi/100m
- **ไม่ตั้งค่า securityContext** — เพราะ CRI-O runtime นี้มีปัญหา `setgroups: Invalid argument` กับภาพที่มี USER directive + ConfigMap volume

#### 4. สร้าง Service
```bash
oc apply -f openshift/service.yaml -n mfec-pipeline-tools
```

#### 5. สร้าง Route
```bash
oc apply -f openshift/route.yaml -n mfec-pipeline-tools
```

#### 6. ตรวจสอบ
```bash
oc get deployment pipeline-tracker -n mfec-pipeline-tools
oc get pods -n mfec-pipeline-tools -l app=pipeline-tracker
oc get route pipeline-tracker -n mfec-pipeline-tools
curl -s -o /dev/null -w "%{http_code}" https://pipeline-tracker-mfec-pipeline-tools.apps.ailab.mfec.co.th/
# ควรได้ 200
```

### อัปเดตโค้ด

```bash
# อัปเดต ConfigMap
oc set data configmap/pipeline-tracker-js --from-file=js/report.js=js/report.js -n mfec-pipeline-tools
oc set data configmap/pipeline-tracker-app --from-file=index.html=index.html -n mfec-pipeline-tools

# Rollout Deployment ใหม่
oc rollout restart deployment/pipeline-tracker -n mfec-pipeline-tools
```

### คำเตือนสำคัญ

- **SCC UID range**: Pod นี้ใช้ UID ใน range `1001040000-1001049999` (OpenShift SCCs)
- **Busybox ไม่มี USER directive** — เหตุผลที่เลือก busybox แทน nginx/UBI เพราะ Images ที่มี `USER` directive + ConfigMap volume mount จะเจอปัญหา `setgroups: Invalid argument` บน CRI-O runtime นี้
- **strategy: Recreate** — ใช้เพราะ ConfigMap volumes ต้อง mount พร้อมกัน และ replicas=1
- **ConfigMap ไม่เหมาะสำหรับ production** ที่ต้องการความทันสมัย — ถ้าต้องการอัปเดตบ่อยๆ ควรใช้วิธีอื่น เช่น PVC + volume mount หรือ build Docker image

### ไฟล์ YAML ใน `openshift/`

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `namespace.yaml` | สร้าง namespace `mfec-pipeline-tools` |
| `configmap-app.yaml` | ConfigMap ไฟล์หลัก (index.html, styles.css, .py, .js อื่นๆ) |
| `configmap-js.yaml` | ConfigMap ไฟล์ JS ใน js/ (app.js, upload.js, pivot.js, report.js, dashboard.js) |
| `configmap-xlsx.yaml` | Marker only สำหรับ xlsx.full.min.js — ไฟล์จริงใช้ `oc create configmap ... --from-file=...` เพราะไฟล์ใหญ่เกิน 1MB และไม่สามารถ embed ลง YAML ได้ |
| `deployment.yaml` | Deployment — busybox:1.36, replicas: 1, strategy: Recreate, พร้อม probe และ resource limit |
| `service.yaml` | ClusterIP Service พอร์ต 8080 |
| `route.yaml` | Edge Route: `pipeline-tracker-mfec-pipeline-tools.apps.ailab.mfec.co.th` |

## Git

- Remote: `git@github.com:nookandnui-cloud/PipelineTracker.git` (SSH)
- Branch: `master`
- Credential helper: `store`
- Git LFS: เปิดใช้สำหรับไฟล์ใหญ่ (`libs/xlsx.full.min.js`)
- Pattern อ้างอิงจาก: **[nookandnui-cloud/VMTools](https://github.com/nookandnui-cloud/VMTools)**

```bash
# Clone
git clone git@github.com:nookandnui-cloud/PipelineTracker.git

# Push (SSH key ~/.ssh/id_ed25519_github)
git add .
git commit -m "message"
git push origin master
```

> **หมายเหตุ:** HTTPS + PAT ให้ 403 บน repo นี้ — ใช้ SSH แทน

---

## License

Internal use only
