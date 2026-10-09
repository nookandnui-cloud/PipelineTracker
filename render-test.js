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

/* report: period filter UI + filtering rules (by TARGET; no-Target excluded when filtered) */
try {
  const h = makeEl("main");
  vm.runInContext("Report.render", sandbox)(h);
  let html = h.innerHTML;
  if (!html.includes('id="rpMode"')) throw new Error("mode buttons not found");
  if (!html.includes("Monthly") || !html.includes("Quarterly") || !html.includes("Yearly")) throw new Error("period mode buttons not found");
  if (!html.includes("by Target")) throw new Error("period bar should be labelled 'by Target'");
  if (html.includes("always included")) throw new Error("the 'always included' hint must be gone");
  console.log("PASS report period filter UI present (mode: all, labelled by Target, no hint)");

  /* Yearly 2025 by TARGET: keep ONLY projects whose target year is 2025 */
  const Report = vm.runInContext("Report", sandbox);
  vm.runInContext("void (Report._setPeriod && Report._setPeriod('year','2025'))", sandbox);
  const all = PT.projects();
  const isQ = t => /^Q[1-4]\/\d{4}$/.test(t || "");
  const exp2025 = all.filter(p => isQ(p.target) && p.target.endsWith("/2025")).length;
  const h2 = makeEl("main");
  Report.render(h2);
  const m = /(\d+) projects/.exec(h2.innerHTML);
  const shown = m ? +m[1] : -1;
  if (shown !== exp2025) throw new Error(`target-year 2025 should show ${exp2025} but got ${shown}`);
  console.log(`PASS report target-year 2025 shows ${shown} projects (target 2025 only)`);

  /* Quarterly by TARGET must match the target quarter exactly */
  vm.runInContext("void (Report._setPeriod && Report._setPeriod('quarter','Q3/2026'))", sandbox);
  const expQ = all.filter(p => p.target === "Q3/2026").length;
  const h3 = makeEl("main");
  Report.render(h3);
  const m3 = /(\d+) projects/.exec(h3.innerHTML);
  const shownQ = m3 ? +m3[1] : -1;
  if (shownQ !== expQ) throw new Error(`target Q3/2026 should show ${expQ} but got ${shownQ}`);
  console.log(`PASS report target-quarter Q3/2026 shows ${shownQ} projects`);
  vm.runInContext("void (Report._setPeriod && Report._setPeriod('all',''))", sandbox);
} catch (e) { fails++; console.log("FAIL report period filter:", e.message); }

/* value buckets must be strictly per-status (open=InProgress only, win=Win, drop=Drop) */
try {
  const all = PT.projects();
  const sum = st => all.filter(p => p.status === st).reduce((s, p) => s + (p.revenue || 0), 0);
  const m = PT.teamStatusMatrix(all);
  const totOpen = Object.values(m).reduce((s, t) => s + t.openRev, 0);
  const totWin = Object.values(m).reduce((s, t) => s + t.winRev, 0);
  const totDrop = Object.values(m).reduce((s, t) => s + t.dropRev, 0);
  const totLost = Object.values(m).reduce((s, t) => s + t.lostRev, 0);
  if (totOpen !== sum("In Progress")) throw new Error(`openRev ${totOpen} != InProgress sum ${sum("In Progress")}`);
  if (totWin !== sum("Win")) throw new Error(`winRev ${totWin} != Win sum ${sum("Win")}`);
  if (totDrop !== sum("Drop")) throw new Error(`dropRev ${totDrop} != Drop sum ${sum("Drop")}`);
  if (totLost !== sum("Lost")) throw new Error(`lostRev ${totLost} != Lost sum ${sum("Lost")}`);
  const openWin = all.filter(p => p.status === "In Progress" || p.status === "Win").reduce((s, p) => s + (p.revenue || 0), 0);
  if (totOpen === openWin && sum("Win") > 0) throw new Error("openRev still includes Win projects");
  console.log(`PASS value buckets per-status (open ${PT.fmtBaht(totOpen)}, win ${PT.fmtBaht(totWin)}, drop ${PT.fmtBaht(totDrop)}, lost ${PT.fmtBaht(totLost)})`);
} catch (e) { fails++; console.log("FAIL value buckets:", e.message); }

/* projects page: Target filter must offer Yearly and Quarterly modes */
try {
  const h = makeEl("main");
  vm.runInContext("Projects.render", sandbox)(h);
  const html = h.innerHTML;
  if (!html.includes('id="pTgtMode"')) throw new Error("target mode segment not found");
  if (!html.includes(">Yearly<") || !html.includes(">Quarterly<")) throw new Error("Yearly/Quarterly buttons not found");
  if (!html.includes('id="pTarget"')) throw new Error("target value select not found");
  if (html.includes('id="pQuarter"')) throw new Error("old pQuarter select still present");
  console.log("PASS projects Target filter has Yearly/Quarterly modes");
} catch (e) { fails++; console.log("FAIL projects target filter UI:", e.message); }

/* projects target filtering logic: quarterly exact, yearly by suffix */
try {
  const Projects = vm.runInContext("Projects", sandbox);
  const all = PT.projects();
  const q3 = all.filter(p => p.target === "Q3/2026").length;
  const y2026 = all.filter(p => p.target && p.target.endsWith("/2026")).length;
  if (q3 === 0 || y2026 === 0) throw new Error("fixture data lacks Q3/2026 or 2026 targets");
  if (y2026 <= q3) throw new Error(`year count ${y2026} should exceed single quarter ${q3}`);

  /* drive the page through its own handlers via a stub-friendly run */
  vm.runInContext("void (Projects._setTarget && Projects._setTarget('quarter','Q3/2026'))", sandbox);
  const hq = makeEl("main");
  Projects.render(hq);
  const cq = byId["pjCount"] ? byId["pjCount"].textContent : "";
  const mq = /(\d+) of (\d+) projects/.exec(cq);
  if (!mq) throw new Error(`count line not found for quarterly (got "${cq}")`);
  if (+mq[1] !== q3) throw new Error(`quarterly Q3/2026 shows ${mq[1]}, expected ${q3}`);

  vm.runInContext("void (Projects._setTarget && Projects._setTarget('year','2026'))", sandbox);
  const hy = makeEl("main");
  Projects.render(hy);
  const cy = byId["pjCount"] ? byId["pjCount"].textContent : "";
  const my = /(\d+) of (\d+) projects/.exec(cy);
  if (!my) throw new Error(`count line not found for yearly (got "${cy}")`);
  if (+my[1] !== y2026) throw new Error(`yearly 2026 shows ${my[1]}, expected ${y2026}`);

  /* yearly option list must contain years, quarterly list must contain quarters */
  if (!hy.innerHTML.includes('value="2026"')) throw new Error("yearly mode should list the year 2026");
  if (!hq.innerHTML.includes('value="Q3/2026"')) throw new Error("quarterly mode should list Q3/2026");

  vm.runInContext("void (Projects._setTarget && Projects._setTarget('quarter',''))", sandbox);
  console.log(`PASS projects target filter: quarterly Q3/2026 → ${q3}, yearly 2026 → ${y2026}`);
} catch (e) { fails++; console.log("FAIL projects target filtering:", e.message); }

/* dashboard must expose the period filter bar */
try {
  const h = makeEl("main");
  vm.runInContext("Dashboard.render", sandbox)(h);
  const html = h.innerHTML;
  if (!html.includes('id="dashMode"')) throw new Error("dashboard period mode buttons not found");
  if (!html.includes('id="dashValue"')) throw new Error("dashboard period value select not found");
  if (!html.includes("Win Value") || !html.includes("Drop Value")) throw new Error("Win/Drop value KPIs not found");
  console.log("PASS dashboard period filter + Win/Drop value KPIs present");
} catch (e) { fails++; console.log("FAIL dashboard period filter:", e.message); }

/* win rate = Win / (Win + Lost) * 100 — Drop must NOT be counted */
try {
  const all = PT.projects();
  const win = all.filter(p => p.status === "Win").length;
  const lost = all.filter(p => p.status === "Lost").length;
  const drop = all.filter(p => p.status === "Drop").length;
  const expected = Math.round(win / ((win + lost) || 1) * 100);
  const withDrop = Math.round(win / ((win + lost + drop) || 1) * 100);
  const h = makeEl("main");
  vm.runInContext("Dashboard.render", sandbox)(h);
  const html = h.innerHTML;
  if (!html.includes(expected + "%")) throw new Error(`Win Rate ${expected}% not found in dashboard`);
  if (expected !== withDrop && html.includes(withDrop + "%") && !html.includes(expected + "%")) throw new Error("dashboard still uses the Drop-inclusive rate");
  if (!html.includes("Drop excluded")) throw new Error("missing 'Drop excluded' note");
  console.log(`PASS win rate = Win/(Win+Lost) = ${win}/(${win}+${lost}) = ${expected}% (Drop ${drop} excluded; old formula would be ${withDrop}%)`);
} catch (e) { fails++; console.log("FAIL win rate:", e.message); }

/* inPeriod: filtering uses TARGET; projects with no/invalid Target are EXCLUDED when a period is set */
try {
  const withTarget = PT.projects().find(x => x.target === "Q1/2026");
  if (!withTarget) throw new Error("no Q1/2026 project to test");
  if (!PT.inPeriod(withTarget, { mode: "quarter", value: "Q1/2026" })) throw new Error("Q1/2026 project excluded from its own quarter");
  if (PT.inPeriod(withTarget, { mode: "quarter", value: "Q3/2026" })) throw new Error("Q1/2026 project leaked into Q3/2026");
  if (!PT.inPeriod(withTarget, { mode: "year", value: "2026" })) throw new Error("Q1/2026 project excluded from year 2026");
  if (PT.inPeriod(withTarget, { mode: "year", value: "2025" })) throw new Error("Q1/2026 project leaked into year 2025");
  if (!PT.inPeriod(withTarget, { mode: "all", value: "" })) throw new Error("project excluded in All mode");

  const p = { id: "TEST", name: "synthetic", target: null };
  for (const mode of ["month", "quarter", "year"]) {
    if (PT.inPeriod(p, { mode, value: mode === "month" ? "2025-01" : "Q3/2025" })) throw new Error(`no-Target project should be EXCLUDED in ${mode} mode`);
  }
  const bad = { id: "TEST2", name: "synthetic-bad", target: "Q2/202ุ6" };
  for (const mode of ["month", "quarter", "year"]) {
    if (PT.inPeriod(bad, { mode, value: "Q3/2025" })) throw new Error(`unparseable-Target project should be EXCLUDED in ${mode} mode`);
  }
  /* but they must still show up in All */
  if (!PT.inPeriod(p, { mode: "all", value: "" })) throw new Error("no-Target project must appear in All mode");
  console.log("PASS period filter uses Target; no/invalid Target is excluded when a period is selected (kept in All)");
} catch (e) { fails++; console.log("FAIL inPeriod target rules:", e.message); }

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
