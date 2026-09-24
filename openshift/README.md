# PipelineTracker — OpenShift Deploy

ไฟล์ YAML สำหรับ deploy บน OpenShift cluster `api.ailab.mfec.co.th:6443`

## โครงสร้าง

```
openshift/
├── namespace.yaml      # สร้าง namespace mfec-pipeline-tools
├── configmap-app.yaml  # ConfigMap ไฟล์หลัก (index.html, styles.css, .py, etc.)
├── configmap-js.yaml   # ConfigMap ไฟล์ JavaScript (js/*.js)
├── configmap-xlsx.yaml # ConfigMap ไฟล์ xlsx.full.min.js (Large - ใช้คำสั่ง oc create)
├── deployment.yaml       # Deployment (Busybox httpd, replicas: 1, strategy: Recreate)
├── service.yaml          # ClusterIP Service พอร์ต 8080
└── route.yaml            # Edge Route สำหรับเข้าถึงจากภายนอก
```

## ข้อควรรู้ก่อน deploy

- **ConfigMap xlsx**: `configmap-xlsx.yaml` เป็นไฟล์ marker เท่านั้น ไม่มี binary จริง เพราะไฟล์ `xlsx.full.min.js` มีขนาด ~951KB ไม่สามารถ embed ลงใน YAML ได้ ต้องสร้างผ่านคำสั่ง `oc create configmap ... --from-file=...`
- **Deployment**: ใช้ Deployment พร้อม `strategy: Recreate` เพราะ ConfigMap volumes ต้อง mount พร้อมกัน ได้แค่ replica เดียว
- **Busybox httpd**: เลือก busybox แทน nginx/UBI เพราะภาพที่มี `USER` directive + ConfigMap volume mount จะเจอปัญหา SCC UID range และ `setgroups: Invalid argument` บน CRI-O runtime นี้
- **UID**: Pod ใช้ UID อัตโนมัติใน SCC range `1001040000-1001049999` ของ OpenShift

## วิธี Deploy

### 1. สร้าง Namespace
```bash
oc new-project mfec-pipeline-tools
```

### 2. สร้าง ConfigMaps
```bash
# ConfigMap สำหรับไฟล์หลัก
oc apply -f openshift/configmap-app.yaml -n mfec-pipeline-tools

# ConfigMap สำหรับไฟล์ JavaScript
oc apply -f openshift/configmap-js.yaml -n mfec-pipeline-tools

# ConfigMap สำหรับ xlsx.full.min.js (จริงๆ ต้องใช้คำสั่ง oc create)
oc create configmap pipeline-tracker-xlsx \
  --from-file=libs/xlsx.full.min.js=libs/xlsx.full.min.js \
  -n mfec-pipeline-tools
```

### 3. สร้าง Deployment
```bash
oc apply -f openshift/deployment.yaml -n mfec-pipeline-tools
```

### 4. สร้าง Service
```bash
oc apply -f openshift/service.yaml -n mfec-pipeline-tools
```

### 5. สร้าง Route
```bash
oc apply -f openshift/route.yaml -n mfec-pipeline-tools
```

## เข้าถึง

```
https://pipeline-tracker-mfec-pipeline-tools.apps.ailab.mfec.co.th
```

## อัปเดตโค้ด

```bash
# อัปเดต ConfigMap แล้ว rollout ใหม่
oc set data configmap/pipeline-tracker-js --from-file=js/report.js=js/report.js -n mfec-pipeline-tools
oc rollout restart deployment/pipeline-tracker -n mfec-pipeline-tools
```

## ตรวจสอบสถานะ

```bash
oc get deployment pipeline-tracker -n mfec-pipeline-tools
oc get pods -n mfec-pipeline-tools -l app=pipeline-tracker
oc get route pipeline-tracker -n mfec-pipeline-tools
curl -s -o /dev/null -w "%{http_code}" https://pipeline-tracker-mfec-pipeline-tools.apps.ailab.mfec.co.th/
# ควรได้ 200
```

## ลบออก

```bash
oc delete route pipeline-tracker -n mfec-pipeline-tools
oc delete service pipeline-tracker -n mfec-pipeline-tools
oc delete deployment pipeline-tracker -n mfec-pipeline-tools
oc delete configmap pipeline-tracker-xlsx -n mfec-pipeline-tools
oc delete configmap pipeline-tracker-js -n mfec-pipeline-tools
oc delete configmap pipeline-tracker-app -n mfec-pipeline-tools
oc delete namespace mfec-pipeline-tools
```
