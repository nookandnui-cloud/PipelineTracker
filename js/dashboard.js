/* dashboard.js — overview: KPIs, team chart, quarter timeline, top projects */
"use strict";

const Dashboard = (() => {

  let teamFilter = "";

  function render(view) {
    const all = PT.projects();
    const P = teamFilter ? all.filter(p => p.team === teamFilter) : all;
    const teams = PT.teamStatusMatrix(all);
    const qKeys = PT.quarters().filter(q => PT.quarterIndex(q) >= PT.quarterIndex("Q1/2026"));
    const qb = PT.quarterBuckets(P);

    const total = P.length;
    const win = P.filter(p => p.status === "Win").length;
    const lost = P.filter(p => p.status === "Lost").length;
    const drop = P.filter(p => p.status === "Drop").length;
    const prog = total - win - lost - drop;
    const openRev = P.filter(p => p.status === "In Progress").reduce((s, p) => s + (p.revenue || 0), 0);
    const winRev = P.filter(p => p.status === "Win").reduce((s, p) => s + (p.revenue || 0), 0);
    const allRev = P.reduce((s, p) => s + (p.revenue || 0), 0);

    view.innerHTML = `
      <div class="view-head">
        <h1>Pipeline Overview</h1>
        <span class="sub">${total} projects · seeded from Excel ${PT.esc((window.PIPELINE_SEED && window.PIPELINE_SEED.generatedAt || "").slice(0, 10))}</span>
        <span class="spacer"></span>
        <div class="seg" id="dashTeamSeg">
          <button data-team="" class="on">All Teams</button>
          ${PT.TEAM_ORDER.filter(t => teams[t]).map(t => `<button data-team="${t}">${t}</button>`).join("")}
        </div>
      </div>

      <div class="grid cols-4" style="margin-bottom:14px">
        ${kpi("Total Projects", total, `${prog} in progress`, "")}
        ${kpi("Win", win, PT.fmtBaht(winRev) + " THB", "up")}
        ${kpi("Lost / Drop", lost + drop, `Win rate ${total ? Math.round(win / (win + lost + drop || 1) * 100) : 0}%`, "down")}
        ${kpi("Open Pipeline Value", PT.fmtBaht(openRev), `Grand total ${PT.fmtBaht(allRev)}`, "")}
      </div>

      <div class="grid cols-2" style="margin-bottom:14px">
        <div class="card">
          <div class="card-head"><h2>Status by Team</h2><span class="spacer"></span>
            <div class="legend">
              ${["In Progress", "Win", "Lost", "Drop"].map(s => `<span class="li"><span class="sw" style="background:${PT.STATUS_COLOR[s]}"></span>${s}</span>`).join("")}
            </div>
          </div>
          <div class="card-body" id="dashTeamChart"></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Target Quarter Timeline</h2></div>
          <div class="card-body" id="dashQChart"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>Top Open Projects by Value</h2></div>
        <div class="tbl-wrap" id="dashTop"></div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>Watchlist: Next Quarter &amp; Overdue</h2></div>
          <div class="card-body" id="dashWatch"></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Status Breakdown</h2></div>
          <div class="card-body" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
            <div id="dashDonut"></div>
            <div id="dashDonutLegend"></div>
          </div>
        </div>
      </div>
    `;

    Charts.stackedBars(document.getElementById("dashTeamChart"), teams, { order: PT.TEAM_ORDER });
    Charts.quarterTimeline(document.getElementById("dashQChart"), qb, qKeys);

    /* top open projects */
    const top = P.filter(p => p.status === "In Progress" || p.status === "Win")
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 8);
    document.getElementById("dashTop").innerHTML = topTable(top);

    /* watchlist: target quarter <= next quarter, still in progress */
    const curQ = currentQuarter();
    const curIdx = PT.quarterIndex(curQ);
    const watch = P.filter(p => p.status === "In Progress" && p.target && PT.quarterIndex(p.target) <= curIdx + 1)
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 8);
    document.getElementById("dashWatch").innerHTML = watch.length
      ? `<table class="tbl"><tbody>${watch.map(p => `
          <tr data-id="${p.id}">
            <td><span class="team-chip team-${p.team}">${p.team || "—"}</span></td>
            <td class="strong">${PT.esc(p.name)}</td>
            <td class="muted">${PT.esc(p.customer)}</td>
            <td class="nowrap"><span class="code">${p.target}</span></td>
            <td class="num strong">${PT.fmtBaht(p.revenue)}</td>
            <td>${progressBar(p.progressPct, "prog")}</td>
          </tr>`).join("")}</tbody></table>`
      : `<div class="empty">No projects with a near-term target</div>`;

    Charts.donut(document.getElementById("dashDonut"), {
      "In Progress": prog, "Win": win, "Lost": lost, "Drop": drop,
    });
    document.getElementById("dashDonutLegend").innerHTML = `
      <div style="display:grid;gap:6px">
        ${[["In Progress", prog], ["Win", win], ["Lost", lost], ["Drop", drop]].map(([s, v]) => `
          <div style="display:flex;align-items:center;gap:8px;font-size:12px">
            <span class="sw" style="width:10px;height:10px;border-radius:3px;background:${PT.STATUS_COLOR[s]}"></span>
            <span style="width:80px">${s}</span><b>${v}</b>
            <span class="muted small">${total ? Math.round(v / total * 100) : 0}%</span>
          </div>`).join("")}
      </div>`;

    /* team filter segment */
    document.getElementById("dashTeamSeg").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      teamFilter = b.dataset.team;
      render(view);
    });

    view.querySelectorAll("[data-id]").forEach(tr => tr.addEventListener("click", () => {
      App.openDrawer(tr.dataset.id);
    }));
  }

  function kpi(label, value, sub, cls) {
    return `<div class="card kpi">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${value}</span>
      <span class="kpi-sub">${sub || ""}</span>
    </div>`;
  }

  function progressBar(pct, kind) {
    return `<div class="pbar"><div class="track"><div class="fill f-${kind === "win" ? "win" : "prog"}" style="width:${pct}%"></div></div><span class="pct">${pct}%</span></div>`;
  }

  function topTable(rows) {
    if (!rows.length) return `<div class="empty">No data</div>`;
    return `<table class="tbl">
      <thead><tr>
        <th>Team</th><th>Project</th><th>Customer</th><th>Target</th>
        <th class="num">Value</th><th>Progress</th><th>% Win</th><th>Status</th>
      </tr></thead>
      <tbody>${rows.map(p => `
        <tr data-id="${p.id}">
          <td><span class="team-chip team-${p.team}">${p.team || "—"}</span></td>
          <td class="strong"><div class="clamp2">${PT.esc(p.name)}</div></td>
          <td class="muted">${PT.esc(p.customer)}</td>
          <td class="nowrap"><span class="code">${p.target || "—"}</span></td>
          <td class="num strong">${PT.fmtBaht(p.revenue)}</td>
          <td>${progressBar(p.progressPct, "prog")}</td>
          <td>${progressBar(p.winPct, "win")}</td>
          <td><span class="badge st-${p.status.replace(" ", "")}">${p.status}</span></td>
        </tr>`).join("")}
      </tbody></table>`;
  }

  function currentQuarter() {
    const d = new Date();
    return `Q${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}`;
  }

  return { render };
})();
