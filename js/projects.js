/* projects.js — full project table + detail/edit drawer */
"use strict";

const Projects = (() => {

  let sortKey = "team", sortDir = 1;
  let teamFilter = "", statusFilter = "", qFilter = "", searchQ = "", presalesFilter = "";

  function render(view) {
    const presalesList = [...new Set(PT.projects().map(p => p.presales).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
    view.innerHTML = `
      <div class="view-head">
        <h1>All Projects</h1>
        <span class="sub" id="pjCount"></span>
        <span class="spacer"></span>
        <button class="btn small" id="pjExport">Export CSV</button>
        <button class="btn primary small" id="pjAdd">+ Add Project</button>
      </div>
      <div class="card">
        <div class="filters">
          <label>Team</label>
          <select id="pTeam"><option value="">All</option>${PT.TEAM_ORDER.map(t => `<option ${teamFilter === t ? "selected" : ""}>${t}</option>`).join("")}</select>
          <label>Status</label>
          <select id="pStatus"><option value="">All</option>${PT.STATUSES.map(s => `<option ${statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <label>Presales</label>
          <select id="pPresales"><option value="">All</option>${presalesList.map(u => `<option ${presalesFilter === u ? "selected" : ""}>${PT.esc(u)}</option>`).join("")}</select>
          <label>Target</label>
          <select id="pQuarter"><option value="">All</option>${PT.quarters().map(q => `<option ${qFilter === q ? "selected" : ""}>${q}</option>`).join("")}</select>
          <label>Search</label>
          <input type="search" id="pSearch" placeholder="Name / customer / code / product…" value="${PT.esc(searchQ)}">
        </div>
        <div class="tbl-wrap" style="max-height:calc(100vh - 230px)">
          <table class="tbl">
            <thead><tr>
              ${[["team", "Team"], ["code", "Code"], ["name", "Project"], ["customer", "Customer"],
                 ["sales", "Sales"], ["presales", "Presales"], ["target", "Target"], ["revenue", "Value"],
                 ["progressPct", "Progress"], ["winPct", "% Win"], ["status", "Status"]].map(([k, l]) =>
                `<th class="sortable" data-k="${k}">${l}<span class="arrow"></span></th>`).join("")}
            </tr></thead>
            <tbody id="pjBody"></tbody>
          </table>
        </div>
      </div>`;

    document.getElementById("pTeam").onchange = e => { teamFilter = e.target.value; renderRows(); };
    document.getElementById("pStatus").onchange = e => { statusFilter = e.target.value; renderRows(); };
    document.getElementById("pPresales").onchange = e => { presalesFilter = e.target.value; renderRows(); };
    document.getElementById("pQuarter").onchange = e => { qFilter = e.target.value; renderRows(); };
    document.getElementById("pSearch").oninput = e => { searchQ = e.target.value; renderRows(); };
    document.getElementById("pjExport").onclick = exportCSV;
    document.getElementById("pjAdd").onclick = () => openDrawer(null);
    view.querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
      view.querySelectorAll("th .arrow").forEach(a => a.textContent = "");
      th.querySelector(".arrow").textContent = sortDir > 0 ? "▲" : "▼";
      renderRows();
    }));
    renderRows();
  }

  function filtered() {
    let P = PT.projects();
    if (teamFilter) P = P.filter(p => p.team === teamFilter);
    if (statusFilter) P = P.filter(p => p.status === statusFilter);
    if (presalesFilter) P = P.filter(p => p.presales === presalesFilter);
    if (qFilter) P = P.filter(p => p.target === qFilter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      P = P.filter(p => [p.name, p.customer, p.sales, p.code, p.product, p.presales].some(v => (v || "").toLowerCase().includes(q)));
    }
    return [...P].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "revenue") { va = va || 0; vb = vb || 0; return (va - vb) * sortDir; }
      if (sortKey === "progressPct" || sortKey === "winPct") return (a[sortKey] - b[sortKey]) * sortDir;
      if (sortKey === "target") return ((PT.quarterIndex(a.target) ?? 9999) - (PT.quarterIndex(b.target) ?? 9999)) * sortDir;
      va = (va || "").toLowerCase(); vb = (vb || "").toLowerCase();
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }

  function renderRows() {
    const tbody = document.getElementById("pjBody");
    if (!tbody) return;
    const P = filtered();
    document.getElementById("pjCount").textContent = `${P.length} of ${PT.projects().length} projects`;
    if (!P.length) { tbody.innerHTML = `<tr><td colspan="11"><div class="empty">No projects match the filters</div></td></tr>`; return; }

    tbody.innerHTML = P.map(p => `<tr data-id="${p.id}">
      <td><span class="team-chip team-${p.team}">${p.team || "—"}</span></td>
      <td><span class="code">${PT.esc(p.code) || "—"}</span></td>
      <td><div class="strong clamp2">${PT.esc(p.name)}</div><div class="muted small clamp2" style="max-width:220px">${PT.esc(p.product) || ""}</div></td>
      <td>${PT.esc(p.customer)}</td>
      <td class="muted">${PT.esc(p.sales)}</td>
      <td class="muted">${PT.esc(p.presales)}</td>
      <td class="nowrap"><span class="code">${p.target || "—"}</span></td>
      <td class="num strong">${PT.fmtBaht(p.revenue)}</td>
      <td>${pbar(p.progressPct, "prog")}</td>
      <td>${pbar(p.winPct, "win")}</td>
      <td><span class="badge st-${p.status.replace(" ", "")}">${p.status}</span></td>
    </tr>`).join("");

    tbody.querySelectorAll("tr[data-id]").forEach(tr => tr.addEventListener("click", () => openDrawer(tr.dataset.id)));
  }

  function pbar(pct, kind) {
    return `<div class="pbar"><div class="track"><div class="fill f-${kind}" style="width:${pct ?? 0}%"></div></div><span class="pct">${pct ?? 0}%</span></div>`;
  }

  function exportCSV() {
    const rows = [["Team", "Project code", "Sales", "Presales", "Customer", "Start", "Target", "Project name", "Revenue", "Product", "%progress", "%win", "Win/Lost/Drop", "Status", "Action"]];
    filtered().forEach(p => rows.push([p.team, p.code, p.sales, p.presales, p.customer, p.start, p.target, p.name, p.revenue ?? "", p.product, p.progressPct, p.winPct, p.status, p.statusNote, p.action]));
    PT.download("pipeline-projects.csv", "\uFEFF" + PT.toCSV(rows), "text/csv;charset=utf-8");
    PT.toast("CSV exported");
  }

  /* ================= drawer ================= */
  function openDrawer(id) {
    const isNew = !id;
    const p = isNew ? {
      id: "P" + Date.now().toString(36).toUpperCase(),
      team: "", code: "", sales: "", presales: "", customer: "",
      start: "", target: "", startDate: null, name: "", revenue: null,
      product: "", register: "", progressPct: 25, winPct: 50,
      status: "In Progress", statusNote: "", action: "",
    } : PT.byId(id);

    const bd = document.getElementById("drawerBackdrop"), dw = document.getElementById("drawer");
    const hist = PT.historyOf(p.id).slice().reverse();

    dw.innerHTML = `
      <div class="drawer-head">
        <div>
          <h3>${isNew ? "New Project" : PT.esc(p.name || "(unnamed)")}</h3>
          <div class="sub">${isNew ? "Fill in the details and save" : `${p.code ? PT.esc(p.code) + " · " : ""}${PT.esc(p.customer || "")}`}</div>
        </div>
        <button class="close" id="dwClose">✕</button>
      </div>
      <div class="drawer-body">
        <form class="frm" id="dwForm" autocomplete="off">
          <div class="row"><label>Team</label>
            <select name="team">${PT.TEAM_ORDER.map(t => `<option ${p.team === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
          <div class="row"><label>Project code</label><input name="code" value="${PT.esc(p.code || "")}"></div>
          <div class="row"><label>Project name</label><input name="name" required value="${PT.esc(p.name || "")}"></div>
          <div class="row"><label>Customer</label><input name="customer" value="${PT.esc(p.customer || "")}"></div>
          <div class="row"><label>Sales</label><input name="sales" value="${PT.esc(p.sales || "")}"></div>
          <div class="row"><label>Presales</label><input name="presales" value="${PT.esc(p.presales || "")}"></div>
          <div class="row"><label>Start</label>
            <select name="start"><option value="">—</option>${PT.quarters().map(q => `<option ${p.start === q ? "selected" : ""}>${q}</option>`).join("")}</select></div>
          <div class="row"><label>Target</label>
            <select name="target"><option value="">—</option>${PT.quarters().map(q => `<option ${p.target === q ? "selected" : ""}>${q}</option>`).join("")}</select></div>
          <div class="row"><label>Revenue (THB)</label><input name="revenue" type="number" min="0" step="1000" value="${p.revenue ?? ""}"></div>
          <div class="row"><label>Product</label><input name="product" value="${PT.esc(p.product || "")}"></div>
          <div class="row"><label>% Progress</label><input name="progressPct" type="number" min="0" max="100" step="5" value="${p.progressPct ?? 0}"></div>
          <div class="row"><label>% Win</label><input name="winPct" type="number" min="0" max="100" step="5" value="${p.winPct ?? 0}"></div>
          <div class="row"><label>Status</label>
            <select name="status">${PT.STATUSES.map(s => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div class="row wide"><label>Status note (from Excel)</label>
            <textarea name="statusNote">${PT.esc(p.statusNote || "")}</textarea></div>
          <div class="row wide"><label>Action / Next steps</label>
            <textarea name="action">${PT.esc(p.action || "")}</textarea></div>
        </form>

        ${!isNew && hist.length ? `
        <div style="margin-top:18px">
          <div class="card-head" style="padding:8px 0;border-bottom:1px solid var(--border)">
            <h2>Weekly History</h2>
          </div>
          <ul class="timeline" style="margin-top:10px">
            ${hist.map(r => `
              <li class="t-${r.status.replace(" ", "")}">
                <div class="t-date">${PT.weekKeyLabel(r.week)} · <span class="badge st-${r.status.replace(" ", "")}">${r.status}</span> · progress ${r.progressPct}% · win ${r.winPct}%</div>
                ${r.note ? `<div class="t-note">${PT.esc(r.note)}</div>` : ""}
              </li>`).join("")}
          </ul>
        </div>` : ""}
      </div>
      <div class="drawer-foot">
        ${!isNew ? `<button class="btn ghost" id="dwDelete" style="margin-right:auto;color:var(--lost)">Delete Project</button>` : ""}
        <button class="btn" id="dwCancel">Cancel</button>
        <button class="btn primary" id="dwSave">Save</button>
      </div>`;

    bd.hidden = false; dw.hidden = false;
    document.getElementById("dwClose").onclick = closeDrawer;
    document.getElementById("dwCancel").onclick = closeDrawer;
    bd.onclick = closeDrawer;
    document.getElementById("dwSave").onclick = () => saveDrawer(isNew, p.id);
    const del = document.getElementById("dwDelete");
    if (del) del.onclick = () => {
      if (!confirm("Delete this project?")) return;
      const st = PT.state;
      st.projects = st.projects.filter(x => x.id !== p.id);
      delete st.history[p.id];
      PT.queueSave();
      ExcelSync.requestSync(false);
      closeDrawer();
      App.render();
      PT.toast("Deleted");
    };
  }

  function saveDrawer(isNew, id) {
    const f = document.getElementById("dwForm");
    if (!f.name.value.trim()) { PT.toast("Please enter a project name"); return; }
    let p;
    if (isNew) {
      p = { id, register: "", startDate: null };
      PT.state.projects.push(p);
    } else {
      p = PT.byId(id);
    }
    const g = n => f.elements[n].value;
    p.team = g("team"); p.code = g("code") || null; p.name = g("name").trim();
    p.customer = g("customer") || null; p.sales = g("sales") || null; p.presales = g("presales") || null;
    p.start = g("start") || null; p.target = g("target") || null;
    p.revenue = g("revenue") === "" ? null : +g("revenue");
    p.product = g("product") || null;
    p.progressPct = Math.max(0, Math.min(100, +g("progressPct") || 0));
    p.winPct = Math.max(0, Math.min(100, +g("winPct") || 0));
    p.status = g("status"); p.statusNote = g("statusNote") || null; p.action = g("action") || null;

    PT.queueSave();
    ExcelSync.requestSync(false);
    closeDrawer();
    App.render();
    PT.toast(isNew ? "Project added" : "Saved");
  }

  function closeDrawer() {
    document.getElementById("drawerBackdrop").hidden = true;
    document.getElementById("drawer").hidden = true;
  }

  return { render, openDrawer, closeDrawer };
})();
