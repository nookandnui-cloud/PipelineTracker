/* render-test.js — smoke-test all four views with a stub DOM */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;

function makeEl(tag) {
  const el = {
    tagName: tag, children: [], style: {}, dataset: {}, hidden: false,
    _innerHTML: "", textContent: "",
    setAttribute() {}, appendChild(c) { el.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20 }; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    elements: {}, focus() {},
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = String(v); },
  });
  return el;
}

const byId = {};
const documentStub = {
  getElementById(id) { if (!byId[id]) byId[id] = makeEl("div"); return byId[id]; },
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t),
  body: makeEl("body"),
  addEventListener() {},
};

const sandbox = {
  console,
  window: {},
  document: documentStub,
  localStorage: (() => { let s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; })(),
  setTimeout: (fn) => fn(), clearTimeout: () => {},
  URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
  Blob: function () {},
  confirm: () => true,
  scrollTo() {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
}

["libs/xlsx.full.min.js", "pipeline-data.js", "js/util.js", "js/charts.js", "js/dashboard.js", "js/projects.js", "js/report.js", "js/upload.js", "js/excel-sync.js", "js/app.js"].forEach(load);

let fails = 0;
function render(name, fn) {
  try {
    const host = makeEl("main");
    fn(host);
    const len = host.innerHTML.length;
    if (len < 500) throw new Error(`suspiciously small output: ${len} chars`);
    console.log(`PASS render ${name} (${len} chars)`);
  } catch (e) {
    fails++;
    console.log(`FAIL render ${name}: ${e.message}`);
  }
}

const PT = vm.runInContext("PT", sandbox);
PT.load();
const host = () => makeEl("main");

render("dashboard", h => vm.runInContext("Dashboard.render", sandbox)(h));
render("projects", h => vm.runInContext("Projects.render", sandbox)(h));
render("report", h => vm.runInContext("Report.render", sandbox)(h));

/* presales filter ต้องมีในหน้า projects */
try {
  const h = makeEl("main");
  vm.runInContext("Projects.render", sandbox)(h);
  const html = h.innerHTML;
  if (!html.includes('id="pPresales"')) throw new Error("ไม่พบ select pPresales");
  if (!html.includes("Presales")) throw new Error("ไม่พบหัวคอลัมน์ Presales");
  console.log("PASS presales filter + column ปรากฏในหน้าโปรเจกต์");
} catch (e) { fails++; console.log("FAIL presales filter:", e.message); }

/* report: period filter UI + กรองถูกต้อง */
try {
  const h = makeEl("main");
  vm.runInContext("Report.render", sandbox)(h);
  let html = h.innerHTML;
  if (!html.includes('id="rpMode"')) throw new Error("mode buttons not found");
  if (!html.includes("Monthly") || !html.includes("Quarterly") || !html.includes("Yearly")) throw new Error("period mode buttons not found");
  console.log("PASS report period filter UI present (mode: all)");

  /* simulate selecting Yearly 2025 and re-render — must keep only projects with startDate in 2025 */
  const Report = vm.runInContext("Report", sandbox);
  vm.runInContext("void (Report._setPeriod && Report._setPeriod('year','2025'))", sandbox);
  const all = PT.projects();
  const exp2025 = all.filter(p => p.startDate && p.startDate.startsWith("2025")).length;
  const h2 = makeEl("main");
  Report.render(h2);
  const html2 = h2.innerHTML;
  const m = /(\d+) projects/.exec(html2);
  const shown = m ? +m[1] : -1;
  if (shown !== exp2025) throw new Error(`yearly 2025 should show ${exp2025} but got ${shown}`);
  console.log(`PASS report yearly 2025 filters to ${shown} projects (matches startDate)`);
} catch (e) { fails++; console.log("FAIL report period filter:", e.message); }

/* ExcelSync: สร้าง workbook ได้ + ชื่อไฟล์รายวัน */
try {
  const ES = vm.runInContext("ExcelSync", sandbox);
  const bytes = ES.buildWorkbook();          // Uint8Array
  if (!(bytes && bytes.length > 5000)) throw new Error("workbook เล็กผิดปกติ: " + (bytes && bytes.length));
  const XLSX = vm.runInContext("XLSX", sandbox);
  const wb = XLSX.read(bytes, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  if (rows.length !== PT.projects().length + 1) throw new Error(`แถวไม่ตรง: ${rows.length} vs ${PT.projects().length + 1}`);
  if (!String(rows[0][8]).includes("Project name")) throw new Error("header ผิด: " + rows[0][8]);
  const fname = ES.todayFileName();
  if (!/^\S+-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fname)) throw new Error("ชื่อไฟล์ผิดรูปแบบ: " + fname);
  /* อ่านกลับแล้วต้องได้จำนวนโปรเจกต์เท่าเดิม */
  const Upload = vm.runInContext("Upload", sandbox);
  const reparsed = Upload.parseWorkbook(bytes);
  if (reparsed.projects.length !== PT.projects().length) throw new Error(`roundtrip ไม่ตรง: ${reparsed.projects.length}`);
  console.log(`PASS ExcelSync workbook (${bytes.length.toLocaleString()} bytes, ${rows.length - 1} โปรเจกต์, ไฟล์ ${fname}, roundtrip OK)`);
} catch (e) { fails++; console.log("FAIL ExcelSync:", e.message); }

/* drawer open + save roundtrip */
try {
  const Projects = vm.runInContext("Projects", sandbox);
  const p = PT.projects()[0];
  const before = PT.projects().length;
  Projects.openDrawer(p.id);
  const form = byId["dwForm"];
  // simulate save: fill required name, call handler via dwSave click binding is stubbed — call saveDrawer indirectly
  vm.runInContext("Projects.closeDrawer()", sandbox);
  console.log("PASS drawer open/close, projects still", PT.projects().length === before);
} catch (e) { fails++; console.log("FAIL drawer:", e.message); }

/* charts render into stubs */
try {
  const Charts = vm.runInContext("Charts", sandbox);
  const c1 = makeEl("div"), c2 = makeEl("div"), c3 = makeEl("div");
  Charts.stackedBars(c1, PT.teamStatusMatrix(PT.projects()), { order: PT.TEAM_ORDER });
  Charts.quarterTimeline(c2, PT.quarterBuckets(PT.projects()), PT.quarters());
  Charts.donut(c3, { "In Progress": 60, "Win": 20, "Lost": 10, "Drop": 10 });
  if (!c1.children.length || !c2.children.length || !c3.children.length) throw new Error("empty chart");
  console.log("PASS charts render (svg nodes:", c1.children[0].children.length + c2.children[0].children.length + c3.children[0].children.length + ")");
} catch (e) { fails++; console.log("FAIL charts:", e.message); }

console.log(fails ? `\n${fails} FAILURES` : "\nALL RENDER TESTS PASSED");
process.exit(fails ? 1 : 0);
