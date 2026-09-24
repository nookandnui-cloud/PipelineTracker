/* upload.js — landing page: อ่านไฟล์ .xlsx ใน browser (SheetJS) + normalize + เข้าสู่แอป */
"use strict";

const Upload = (() => {

  /* ---- normalize helpers (port จาก build_data.py) ---- */
  const TEAM_MAP = { "ENTE": "ENT", "ENT": "ENT", "MTIS": "MTIS", "BFSI": "BFSI",
                     "GOV": "GOV", "TELCO": "TELCO", "INNO": "INNO" };

  function clean(v) {
    if (v == null) return null;
    const t = String(v).replace(/\xa0/g, " ").trim();
    return t || null;
  }

  function normTeam(v) {
    const t = clean(v);
    if (!t) return null;
    const u = t.toUpperCase().replace(/\s+/g, " ");
    return TEAM_MAP[u] || u;
  }

  function normStatus(v) {
    const t = clean(v);
    if (!t) return "In Progress";
    const low = t.toLowerCase();
    if (low.includes("win")) return "Win";
    if (low.includes("lost") || low.includes("lose")) return "Lost";
    if (low.includes("drop")) return "Drop";
    return "In Progress";
  }

  function parseQuarter(v) {
    let t = clean(v);
    if (!t) return null;
    t = t.replace(/[^\x00-\x7f]/g, "");          // ตัดอักขระไทยหลุด เช่น Q2/202ุ6
    const m = /q\s*(\d)\s*\/\s*(\d{4})/i.exec(t);
    if (m) {
      const q = +m[1], y = +m[2];
      if (q >= 1 && q <= 4 && y >= 2000 && y <= 2100) return `Q${q}/${y}`;
    }
    return t || null;
  }

  function num(v) {
    if (v == null) return null;
    if (typeof v === "number") return v;
    const t = String(v).replace(/[^\d.\-]/g, "");
    if (!t) return null;
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  }

  function pct(v, dflt) {
    const n = num(v);
    if (n == null) return dflt;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function excelDate(v) {
    if (v instanceof Date) {
      return v.toISOString().slice(0, 10);
    }
    if (typeof v === "number" && v > 20000 && v < 60000) { // excel serial
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }
    return null; // ข้อความเสีย เช่น '16/4/20206'
  }

  /* ---- หา header row + map คอลัมน์แบบยืดหยุ่น ---- */
  function findColumns(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    let headerRow = -1, col = {};
    const KEY = {
      team: ["team", "ทีม"], code: ["project code", "projectcode", "code"],
      sales: ["sales"], presales: ["presales", "pre-sales"],
      customer: ["customer", "ลูกค้า"], start: ["start"], target: ["target"],
      startDate: ["start date", "startdate"], name: ["project name", "projectname", "โปรเจกต์"],
      revenue: ["revenue", "มูลค่า", "budget"], product: ["product"],
      register: ["no. register", "register", "no.register"],
      progress: ["%progress", "progress", "% progress"], win: ["% win", "%win", "win"],
      status: ["win/lost/drop", "win/lost", "status"], note: ["status", "หมายเหตุ"],
      action: ["action"],
    };
    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const cells = (rows[r] || []).map(c => clean(c));
      const hits = {};
      for (const [field, keys] of Object.entries(KEY)) {
        for (let c = 0; c < cells.length; c++) {
          const h = (cells[c] || "").toLowerCase().replace(/\s+/g, " ");
          if (h && keys.some(k => h === k || h.startsWith(k))) {
            if (hits[field] == null) hits[field] = c;
            break;
          }
        }
      }
      if (hits.name != null && hits.status != null) { headerRow = r; col = hits; break; }
    }
    return { rows, headerRow, col };
  }

  function parseWorkbook(data) {
    // รับได้ทั้ง ArrayBuffer (จาก FileReader) และ Uint8Array
    const u8 = data && data.length != null ? data : new Uint8Array(data);
    const wb = XLSX.read(u8, { type: "array", cellDates: true });
    // เลือก sheet: ชื่อมี 'pipeline' ก่อน ไม่งั้น sheet ที่ใหญ่สุดที่ไม่ใช่ pivot
    let sheetName = wb.SheetNames.find(n => /pipeline/i.test(n));
    if (!sheetName) {
      let best = null, bestRows = 0;
      wb.SheetNames.forEach(n => {
        if (/pivot|summary/i.test(n)) return;
        const ref = wb.Sheets[n]["!ref"] || "";
        const m = /[A-Z]+(\d+)$/.exec(ref);
        const nrows = m ? +m[1] : 0;
        if (nrows > bestRows) { bestRows = nrows; best = n; }
      });
      sheetName = best;
    }
    if (!sheetName) throw new Error("No pipeline sheet found (check that the file has a sheet like Pipeline2026)");
    const { rows, headerRow, col } = findColumns(wb.Sheets[sheetName]);
    if (headerRow < 0) throw new Error("Could not find 'Project name' and 'Win/Lost/Drop' headers in sheet " + sheetName);

    const projects = [];
    let n = 0;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const g = (k) => col[k] != null ? row[col[k]] : null;
      const team = normTeam(g("team"));
      const name = clean(g("name"));
      const customer = clean(g("customer"));
      if (!team && !name && !customer) continue;
      n++;
      projects.push({
        id: "P" + String(n).padStart(3, "0"),
        team, code: clean(g("code")), sales: clean(g("sales")), presales: clean(g("presales")),
        customer, start: parseQuarter(g("start")), target: parseQuarter(g("target")),
        startDate: excelDate(g("startDate")), name, revenue: num(g("revenue")),
        product: clean(g("product")), register: clean(g("register")),
        progressPct: pct(g("progress"), 0), winPct: pct(g("win"), 50),
        status: normStatus(g("status")), statusNote: clean(g("note")),
        action: clean(g("action")),
      });
    }
    if (!projects.length) throw new Error("Parsed 0 projects from sheet " + sheetName + " — check the file format");
    return { sheetName, projects };
  }

  /* ---- UI wiring ---- */
  function init() {
    const drop = document.getElementById("dropZone");
    const input = document.getElementById("fileInput");
    const browse = document.getElementById("btnBrowse");
    const errEl = document.getElementById("landingError");
    const contBtn = document.getElementById("btnContinue");

    browse.addEventListener("click", () => input.click());
    input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); });

    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove("dragover");
    }));
    drop.addEventListener("drop", e => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    contBtn.addEventListener("click", () => App.enterApp());

    /* ถ้ามีข้อมูลเก่าใน localStorage ให้เสนอปุ่มเข้าต่อ */
    try {
      const raw = localStorage.getItem(PT.LS_KEY);
      if (raw && JSON.parse(raw).projects?.length) contBtn.hidden = false;
    } catch (e) { /* ignore */ }
  }

  function handleFile(file) {
    const errEl = document.getElementById("landingError");
    errEl.hidden = true;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return showError("Only .xlsx / .xls files are supported");
    }
    const reader = new FileReader();
    reader.onerror = () => showError("Could not read the file — please try again");
    reader.onload = () => {
      try {
        const { sheetName, projects } = parseWorkbook(new Uint8Array(reader.result));
        PT.ingest(projects, file.name, sheetName);
        App.enterApp();
        PT.toast(`Loaded ${projects.length} projects from ${file.name} (${sheetName})`);
      } catch (e) {
        showError(e.message || "Could not parse this file — make sure it is an Excel file with a pipeline sheet");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function showError(msg) {
    const errEl = document.getElementById("landingError");
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  return { init, parseWorkbook };
})();
