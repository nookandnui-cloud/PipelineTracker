/* upload-test.js — ทดสอบ Excel parser ใน browser context ด้วยไฟล์จริง (SheetJS ใน Node) */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;

function makeEl() {
  const el = {
    children: [], style: {}, dataset: {}, hidden: false, textContent: "", value: "",
    setAttribute() {}, appendChild(c) { el.children.push(c); return c; },
    addEventListener() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  };
  Object.defineProperty(el, "innerHTML", { get: () => el._h || "", set(v) { el._h = String(v); } });
  return el;
}
const byId = {};
const documentStub = {
  getElementById(id) { if (!byId[id]) byId[id] = makeEl(); return byId[id]; },
  createElement: () => makeEl(), createElementNS: (n, t) => makeEl(),
  body: makeEl(), addEventListener() {},
};

const sandbox = {
  console, window: {}, document: documentStub,
  localStorage: (() => { let s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; })(),
  setTimeout: fn => fn(), clearTimeout: () => {},
  URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }, Blob: function () {},
  FileReader: function () { this.readAsArrayBuffer = () => {}; },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(f) { vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f }); }

load("libs/xlsx.full.min.js");   // ให้ XLSX global ใน sandbox
load("pipeline-data.js");
load("js/util.js");
load("js/upload.js");
load("js/charts.js");
load("js/dashboard.js");
load("js/projects.js");
load("js/report.js");
load("js/excel-sync.js");
load("js/app.js");

const PT = vm.runInContext("PT", sandbox);
const Upload = vm.runInContext("Upload", sandbox);

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else { fails++; console.log("FAIL", name, extra === undefined ? "" : JSON.stringify(extra)); }
}

/* --- parse ไฟล์ Excel จริง --- */
const XLSX_PATH = process.argv[2] || "../Pipeline system team.xlsx";
const xbuf = fs.readFileSync(path.resolve(root, XLSX_PATH));
const { sheetName, projects } = Upload.parseWorkbook(new Uint8Array(xbuf).buffer);

check("parse ได้ 133 โปรเจกต์จาก Excel จริง", projects.length === 133, projects.length);
check("sheet ที่เลือกคือ Pipeline2026", sheetName === "Pipeline2026", sheetName);
check("ทุกโปรเจกต์มี status ที่ normalize แล้ว", projects.every(p => PT.STATUSES.includes(p.status)));
check("ทีม normalize (ไม่มี Ent/Mtis หลงเหลือ)", projects.every(p => !["Ent", "Mtis", "ENTE"].includes(p.team)),
  [...new Set(projects.map(p => p.team))]);
check("ไตรมาสสะอาดหมด", projects.every(p => !p.target || /^Q[1-4]\/\d{4}$/.test(p.target)),
  projects.filter(p => p.target && !/^Q[1-4]\/\d{4}$/.test(p.target)).map(p => p.target).slice(0, 5));
const bfsi = projects.filter(p => p.team === "BFSI").length;
check("BFSI 61 โปรเจกต์ (ตรงกับ build_data.py)", bfsi === 61, bfsi);
const withRev = projects.filter(p => p.revenue != null);
check("มี revenue 117 โปรเจกต์ (ตรงกับ no_revenue=16)", withRev.length === 117, withRev.length);

/* --- ingest + render ทุก view ด้วยข้อมูลที่อัปโหลด --- */
PT.ingest(projects, "Pipeline system team.xlsx", sheetName);
check("ingest แล้ว state.projects = 133", PT.projects().length === 133, PT.projects().length);
check("source บันทึกแล้ว", PT.state.source && PT.state.source.fileName === "Pipeline system team.xlsx");
check("quarters recompute แล้ว", PT.quarters().length >= 5, PT.quarters().length);

const Dashboard = vm.runInContext("Dashboard", sandbox);
const Projects = vm.runInContext("Projects", sandbox);
const Report = vm.runInContext("Report", sandbox);

for (const [name, mod] of [["dashboard", Dashboard], ["projects", Projects], ["report", Report]]) {
  try {
    const h = makeEl();
    mod.render(h);
    check(`render ${name} ด้วยข้อมูลอัปโหลด`, h.innerHTML.length > 500, h.innerHTML.length);
  } catch (e) { fails++; console.log(`FAIL render ${name}: ${e.message}`); }
}

/* --- ไฟล์ไม่ถูกต้อง: ไฟล์ที่ไม่ใช่ Excel ต้อง throw --- */
try {
  Upload.parseWorkbook(new TextEncoder().encode("not an excel file").buffer);
  fails++; console.log("FAIL ไฟล์ขยะควร throw error");
} catch (e) {
  check("ไฟล์ไม่ใช่ Excel → error สวยงาม", /อ่าน|sheet|format|zip/i.test(e.message), e.message);
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL UPLOAD TESTS PASSED");
process.exit(fails ? 1 : 0);
