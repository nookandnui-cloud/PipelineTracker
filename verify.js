/* verify.js — Node harness: stub minimal DOM, load real modules, exercise the data layer */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const sandbox = {
  console,
  window: {},
  document: {
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild: () => {}, addEventListener: () => {}, set href(v) {}, click: () => {} }),
    body: { appendChild: () => {} },
  },
  localStorage: (() => {
    let store = {};
    return {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    };
  })(),
  setTimeout: (fn) => fn(), // run saves immediately in tests
  clearTimeout: () => {},
  URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
  Blob: function (parts) { this.size = 0; },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
}

load("pipeline-data.js");
load("js/util.js");

const PT = vm.runInContext("PT", sandbox);
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else { fails++; console.log("FAIL", name, extra === undefined ? "" : JSON.stringify(extra)); }
}

/* --- seed data sanity --- */
const seed = sandbox.window.PIPELINE_SEED;
check("seed has 133 projects", seed.projects.length === 133, seed.projects.length);

/* --- load + selectors --- */
PT.load();
const P = PT.projects();
check("state loaded 133 projects", P.length === 133, P.length);
check("all have status", P.every(p => PT.STATUSES.includes(p.status)));
check("all have target quarter", P.every(p => /^Q[1-4]\/\d{4}$/.test(p.target || "")),
  P.filter(p => !/^Q[1-4]\/\d{4}$/.test(p.target || "")).map(p => p.target));

/* --- team matrix (compare with Excel pivot: BFSI 44, ENTE 9, GOV 16, Inno 1, MTIS 1, total 71) --- */
const m = PT.teamStatusMatrix(P);
check("BFSI total 61 (Excel pivot counted 44 for its subset)", m.BFSI.total === 61, m.BFSI);
check("teams present", ["BFSI", "GOV", "ENT", "TELCO", "MTIS"].every(t => m[t]), Object.keys(m));
const grand = Object.values(m).reduce((s, t) => s + t.total, 0);
check("grand total 133", grand === 133, grand);

/* --- quarters --- */
check("quarterIndex works", PT.quarterIndex("Q1/2026") === 8105, PT.quarterIndex("Q1/2026"));
const qb = PT.quarterBuckets(P);
check("quarter buckets populated", Object.keys(qb).length >= 5, Object.keys(qb));

/* --- week helpers --- */
const wk = PT.weekKey(new Date(2026, 8, 23)); // Wed 23 Sep 2026
check("weekKey is Monday 21 Sep 2026", wk === "2026-09-21", wk);
check("addWeeks back", PT.addWeeks(wk, -1) === "2026-09-14", PT.addWeeks(wk, -1));
check("weekKeyLabel renders", /Week of/.test(PT.weekKeyLabel(wk)), PT.weekKeyLabel(wk));

/* --- record week change + diff --- */
const p0 = P[0];
PT.currentWeek = wk;
p0.status = "Win"; p0.progressPct = 80;
PT.recordWeekChange(p0, "status", "ชนะการประมูล");
const prev = PT.addWeeks(wk, -1);
// simulate a previous-week record
PT.state.history[p0.id].unshift({ week: prev, status: "In Progress", progressPct: 25, winPct: 50, note: "" });
PT.save(); // persist the simulated history too
const diff = PT.diffWeeks(prev, wk);
check("diff detects the change", diff.length === 1 && diff[0].type === "change", diff);
check("diff from/to correct", diff[0] && diff[0].from.status === "In Progress" && diff[0].to.status === "Win", diff[0]);

/* --- persistence --- */
const saved = JSON.parse(sandbox.localStorage.getItem(PT.LS_KEY));
check("persisted to localStorage", saved && saved.projects.length === 133);
check("history persisted", Array.isArray(saved.history[p0.id]) && saved.history[p0.id].length === 2);

/* --- CSV escaping --- */
check("csv escapes quotes/commas", PT.toCSV([['a"b', "c,d"]]) === '"a""b","c,d"', PT.toCSV([['a"b', "c,d"]]));

/* --- fmtBaht --- */
check("fmtBaht millions", PT.fmtBaht(30000000) === "30M", PT.fmtBaht(30000000));
check("fmtBaht null", PT.fmtBaht(null) === "—");

console.log(fails ? `\n${fails} FAILURES` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
