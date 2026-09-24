/* excel-sync.js — บันทึกข้อมูลกลับเป็นไฟล์ .xlsx รายวัน
   - ชื่อไฟล์: <ชื่อไฟล์ต้นทาง>-YYYY-MM-DD.xlsx
   - แก้ไข/เพิ่ม/ลบโปรเจกต์ → เขียนไฟล์อัตโนมัติ
   - วันเดียวกันเขียนทับไฟล์เดิม (เก็บ FileSystemFileHandle ใน IndexedDB)
   - ข้ามวัน → ขอเลือกไฟล์ใหม่ด้วยชื่อวันใหม่
   - เบราว์เซอร์ไม่รองรับ (Firefox ฯลฯ) → ปุ่ม "บันทึก Excel" จะดาวน์โหลดแทน */
"use strict";

const ExcelSync = (() => {

  const HEADERS = ["   Team", "Project code", "Sales", "Presales", "Customer", "Start", "Target",
    "Start Date", "Project name", "Revenue", "Product", "No. Register", "%progress", "% win",
    "Win/Lost/Drop", "Status", "Action"];

  /* ---------- ชื่อไฟล์ ---------- */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function baseName() {
    const src = PT.state && PT.state.source;
    return (src && src.fileName ? src.fileName : "Pipeline").replace(/\.(xlsx|xls)$/i, "");
  }
  function todayFileName() { return `${baseName()}-${todayStr()}.xlsx`; }

  /* ---------- สร้าง workbook จาก state ปัจจุบัน ---------- */
  function buildWorkbook() {
    const rows = [HEADERS];
    for (const p of PT.projects()) {
      rows.push([
        p.team || "", p.code || "", p.sales || "", p.presales || "", p.customer || "",
        p.start || "", p.target || "", p.startDate || "", p.name || "",
        p.revenue ?? "", p.product || "", p.register || "",
        p.progressPct ?? 0, p.winPct ?? 0, p.status || "",
        p.statusNote || "", p.action || "",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 16 }, { wch: 9 },
      { wch: 9 }, { wch: 11 }, { wch: 38 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
      { wch: 9 }, { wch: 7 }, { wch: 13 }, { wch: 44 }, { wch: 30 }];
    ws["!autofilter"] = { ref: `A1:Q${rows.length}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pipeline");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    // SheetJS คืน ArrayBuffer หรือ Uint8Array ตาม platform — เอา Uint8Array ไปใช้ต่อ
    return out instanceof Uint8Array ? out : new Uint8Array(out);
  }

  /* ---------- IndexedDB: เก็บ file handle ---------- */
  const DB_NAME = "mfec-pipeline-sync", STORE = "handles", KEY = "save";
  function idbOpen() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function loadRec() {
    try {
      const db = await idbOpen();
      return await new Promise((res, rej) => {
        const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      });
    } catch (e) { return null; }
  }
  async function storeRec(rec) {
    try {
      const db = await idbOpen();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec, KEY);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { /* ignore */ }
  }

  async function ensurePermission(handle) {
    const opts = { mode: "readwrite" };
    try {
      if ((await handle.queryPermission(opts)) === "granted") return true;
      if ((await handle.requestPermission(opts)) === "granted") return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  /* ---------- sync ---------- */
  let busy = false;
  async function requestSync(canPrompt) {
    if (busy) return;
    busy = true;
    try { await doSync(canPrompt); }
    finally { busy = false; }
  }

  async function doSync(canPrompt) {
    if (!PT.state || !PT.state.projects || !PT.state.projects.length) return;

    if (!window.showSaveFilePicker) {
      setStatus(`เบราว์เซอร์นี้เขียนทับไฟล์อัตโนมัติไม่ได้ — กด "บันทึก Excel" เพื่อดาวน์โหลด ${todayFileName()}`);
      return;
    }

    const today = todayStr();
    const base = baseName();
    let rec = await loadRec();
    let handle = null;

    /* ใช้ handle เดิมได้เฉพาะวันเดียวกัน + ไฟล์ต้นทางชื่อเดียวกัน */
    if (rec && rec.date === today && rec.base === base && rec.handle) {
      handle = rec.handle;
      if (!(await ensurePermission(handle))) {
        setStatus("รอสิทธิ์เขียนไฟล์ — ลองบันทึกอีกครั้ง");
        return;
      }
    }

    if (!handle) {
      if (!canPrompt) {
        setStatus(`ยังไม่ได้เชื่อมไฟล์ — กด "บันทึก Excel" เพื่อเลือกที่ตั้งไฟล์ ${todayFileName()}`);
        return;
      }
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: todayFileName(),
          types: [{
            description: "Excel workbook",
            accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
          }],
        });
      } catch (e) {
        setStatus("ยกเลิกการเลือกไฟล์ — ข้อมูลยังเก็บในเบราว์เซอร์");
        return;
      }
      await storeRec({ handle, date: today, base });
    }

    try {
      const bytes = buildWorkbook();
      const w = await handle.createWritable();
      await w.write(bytes);
      await w.close();
      setStatus(`บันทึก ${handle.name} แล้ว ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (e) {
      setStatus("เขียนไฟล์ไม่สำเร็จ: " + (e.message || e));
    }
  }

  /* fallback: ดาวน์โหลด (ไม่มี File System Access API) */
  function downloadToday() {
    PT.download(todayFileName(), buildWorkbook(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    setStatus(`ดาวน์โหลด ${todayFileName()} แล้ว — เลือกบันทึกทับไฟล์ของวันนี้ได้`);
  }

  function manualSave() {
    if (window.showSaveFilePicker) requestSync(true);
    else downloadToday();
  }

  function setStatus(t) {
    const el = document.getElementById("syncState");
    if (el) el.textContent = t;
  }

  return { requestSync, manualSave, buildWorkbook, todayFileName };
})();
