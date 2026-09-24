/* util.js — state, storage, formatting, week helpers */
"use strict";

const PT = (() => {

  const STATUSES = ["In Progress", "Win", "Lost", "Drop"];
  const STATUS_COLOR = {
    "Win": "#15803d", "Lost": "#b91c1c", "Drop": "#d97706", "In Progress": "#2563eb",
  };
  const TEAM_ORDER = ["BFSI", "GOV", "ENT", "TELCO", "MTIS", "INNO"];
  const LS_KEY = "mfec-pipeline-tracker-v1";

  /* ---------- week helpers (ISO week, Mon-Sun) ---------- */
  function mondayOf(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Mon=0
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function fmtDate(d) {
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtShort(d) {
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  }
  function weekKey(d) {
    const m = mondayOf(d);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
  }
  function weekLabel(d) {
    const m = mondayOf(d);
    const s = new Date(m); s.setDate(s.getDate() + 6);
    return `Week of ${fmtShort(m)} – ${fmtShort(s)}`;
  }
  function weekKeyLabel(key) {
    const [y, m, d] = key.split("-").map(Number);
    return weekLabel(new Date(y, m - 1, d));
  }
  function addWeeks(key, n) {
    const [y, m, d] = key.split("-").map(Number);
    const x = new Date(y, m - 1, d);
    x.setDate(x.getDate() + 7 * n);
    return weekKey(x);
  }

  /* ---------- quarter helpers ---------- */
  let _quarters = null;
  function quarters() {
    if (_quarters) return _quarters;
    const qs = new Set();
    projectsRef().forEach(p => {
      if (p.target) qs.add(p.target);
      if (p.start) qs.add(p.start);
    });
    _quarters = [...qs].filter(q => /^Q[1-4]\/\d{4}$/.test(q)).sort((a, b) => {
      const [qa, ya] = a.slice(1).split("/"), [qb, yb] = b.slice(1).split("/");
      return (+ya - +yb) || (+qa - +qb);
    });
    return _quarters;
  }
  function projectsRef() { return (state && state.projects) || SEED_PROJECTS(); }
  function SEED_PROJECTS() { return (window.PIPELINE_SEED && window.PIPELINE_SEED.projects) || []; }
  function quarterIndex(q) {
    const m = /^Q([1-4])\/(\d{4})$/.exec(q || "");
    return m ? (+m[2] * 4 + +m[1]) : null;
  }

  /* ---------- formatting ---------- */
  function fmtBaht(n) {
    if (n == null) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M";
    return n.toLocaleString("th-TH");
  }
  function fmtBahtFull(n) {
    return n == null ? "—" : "฿" + Math.round(n).toLocaleString("th-TH");
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------- state ---------- */
  let state = null;

  function SEED_PROJECTS() { return (window.PIPELINE_SEED && window.PIPELINE_SEED.projects) || []; }

  function defaultState() {
    const now = new Date();
    return {
      version: 1,
      currentWeek: weekKey(now),
      source: null,         // { fileName, sheetName, ingestedAt, count }
      projects: JSON.parse(JSON.stringify(SEED_PROJECTS())),
      weeks: {},           // weekKey -> { note, savedAt }
      history: {},         // projectId -> [{week, status, progressPct, winPct, note}]
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version === 1 && Array.isArray(s.projects) && s.projects.length) {
          state = s;
          return;
        }
      }
    } catch (e) { /* corrupt -> fresh */ }
    state = defaultState();
    save();
  }

  /* รับโปรเจกต์จากไฟล์ Excel ที่ผู้ใช้อัปโหลด (ผ่าน upload.js) */
  function ingest(projects, fileName, sheetName) {
    state = {
      version: 1,
      currentWeek: state ? state.currentWeek : weekKey(new Date()),
      source: { fileName, sheetName, ingestedAt: new Date().toISOString(), count: projects.length },
      projects: JSON.parse(JSON.stringify(projects)),
      weeks: {},
      history: {},
    };
    _quarters = null;   // recompute from new data
    save();
  }

  let saveTimer = null;
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      setSaveState("Saved " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setSaveState("Save failed (storage limit)");
    }
  }
  function queueSave() {
    setSaveState("…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }
  function setSaveState(t) {
    const el = document.getElementById("saveState");
    if (el) el.textContent = t;
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    load();
  }

  /* ---------- selectors ---------- */
  function projects() { return state.projects; }
  function byId(id) { return state.projects.find(p => p.id === id); }

  function weekRecords(weekKey_) {
    return state.projects.filter(p => {
      const h = state.history[p.id] || [];
      return h.some(r => r.week === weekKey_);
    });
  }
  function historyOf(id) { return state.history[id] || []; }

  function recordWeekChange(p, fields, note) {
    const rec = {
      week: state.currentWeek,
      status: p.status, progressPct: p.progressPct, winPct: p.winPct,
      note: note || "",
    };
    const h = state.history[p.id] || (state.history[p.id] = []);
    const i = h.findIndex(r => r.week === rec.week);
    if (i >= 0) h[i] = Object.assign(h[i], rec);
    else h.push(rec);
    queueSave();
  }

  /* movement between two weeks */
  function diffWeeks(wA, wB) {
    const out = [];
    for (const p of state.projects) {
      const h = state.history[p.id] || [];
      const a = h.find(r => r.week === wA);
      const b = h.find(r => r.week === wB);
      if (!a && !b) continue;
      if (!a && b) { out.push({ p, type: "new", to: b }); continue; }
      if (a && !b) { out.push({ p, type: "gone", from: a }); continue; }
      if (a.status !== b.status || a.progressPct !== b.progressPct || a.winPct !== b.winPct) {
        out.push({ p, type: "change", from: a, to: b });
      }
    }
    return out;
  }

  /* aggregate by team x status */
  function teamStatusMatrix(list) {
    const teams = {};
    for (const p of list) {
      const t = p.team || "—";
      teams[t] = teams[t] || { "In Progress": 0, "Win": 0, "Lost": 0, "Drop": 0, total: 0, revenue: 0, openRev: 0 };
      teams[t][p.status] = (teams[t][p.status] || 0) + 1;
      teams[t].total++;
      teams[t].revenue += p.revenue || 0;
      if (p.status === "In Progress" || p.status === "Win") teams[t].openRev += p.revenue || 0;
    }
    return teams;
  }

  /* quarter buckets by target */
  function quarterBuckets(list) {
    const q = {};
    for (const p of list) {
      if (!p.target) continue;
      q[p.target] = q[p.target] || { "In Progress": 0, "Win": 0, "Lost": 0, "Drop": 0, revenue: 0 };
      q[p.target][p.status] = (q[p.target][p.status] || 0) + 1;
      q[p.target].revenue += p.revenue || 0;
    }
    return q;
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function download(filename, text, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function toCSV(rows) {
    return rows.map(r => r.map(c => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\r\n");
  }

  return {
    STATUSES, STATUS_COLOR, TEAM_ORDER, LS_KEY,
    mondayOf, weekKey, weekLabel, weekKeyLabel, addWeeks, fmtDate, fmtShort,
    quarters, quarterIndex,
    fmtBaht, fmtBahtFull, esc,
    load, save, queueSave, reset, setSaveState, ingest,
    projects, byId, weekRecords, historyOf, recordWeekChange, diffWeeks,
    teamStatusMatrix, quarterBuckets, toast, download, toCSV,
    get state() { return state; },
    set currentWeek(k) { state.currentWeek = k; queueSave(); },
    get currentWeek() { return state.currentWeek; },
  };
})();
