/* report.js — report: period filter + team×status pivot, presales pivot, win/drop values, export
   Value rules:
     Open Value = sum(revenue) WHERE status = "In Progress"
     Win Value  = sum(revenue) WHERE status = "Win"
     Lost Value = sum(revenue) WHERE status = "Lost"
     Drop Value = sum(revenue) WHERE status = "Drop"
   Projects without a Target are ALWAYS included (never excluded by the period filter). */
"use strict";

const Report = (() => {

  const period = PT.periodDefaults();

  function render(view) {
    const all = PT.projects();
    const P = all.filter(p => PT.inPeriod(p, period));

    const teams = PT.teamStatusMatrix(P);
    const order = PT.TEAM_ORDER.filter(t => teams[t]);
    const grand = { "In Progress": 0, "Win": 0, "Lost": 0, "Drop": 0 };
    order.forEach(t => PT.STATUSES.forEach(s => grand[s] += teams[t][s] || 0));

    /* grand-total value buckets, each strictly from its own status */
    const sumBy = st => P.filter(p => p.status === st).reduce((s, p) => s + (p.revenue || 0), 0);
    const grandOpen = sumBy("In Progress");
    const grandWin = sumBy("Win");
    const grandLost = sumBy("Lost");
    const grandDrop = sumBy("Drop");
    const grandTotal = P.reduce((s, p) => s + (p.revenue || 0), 0);

    const presales = presalesMatrix(P);
    const noTarget = all.filter(p => !/^Q[1-4]\/\d{4}$/.test(p.target || "")).length;

    view.innerHTML = `
      <div class="view-head">
        <h1>Pipeline Report</h1>
        <span class="sub">${PT.periodLabel(period)} · ${P.length} projects</span>
        <span class="spacer"></span>
        <button class="btn small" id="rpPrint">Print / PDF</button>
        <button class="btn primary small" id="rpExport">Export CSV</button>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="filters">
          ${PT.periodBarHTML(period, all, "rp")}
          ${noTarget ? `<span class="muted small">${noTarget} project(s) with no Target are always included</span>` : ""}
        </div>
      </div>

      <div class="grid cols-4" style="margin-bottom:14px">
        ${kpi("Open Value", PT.fmtBaht(grandOpen), `${grand["In Progress"]} In Progress`, "open")}
        ${kpi("Win Value", PT.fmtBaht(grandWin), `${grand["Win"]} Win`, "win")}
        ${kpi("Drop Value", PT.fmtBaht(grandDrop), `${grand["Drop"]} Drop`, "drop")}
        ${kpi("Lost Value", PT.fmtBaht(grandLost), `${grand["Lost"]} Lost`, "lost")}
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>Team × Status (like the Excel Pivot)</h2></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Team</th><th class="num">In Progress</th><th class="num">Win</th><th class="num">Lost</th><th class="num">Drop</th>
              <th class="num">Total</th><th class="num">Open Value</th><th class="num">Win Value</th><th class="num">Lost Value</th><th class="num">Drop Value</th><th class="num">Total Value</th>
            </tr></thead>
            <tbody>
              ${order.map(t => `<tr>
                <td><span class="team-chip team-${t}">${t}</span></td>
                <td class="num">${teams[t]["In Progress"]}</td>
                <td class="num" style="color:var(--win);font-weight:700">${teams[t]["Win"]}</td>
                <td class="num">${teams[t]["Lost"]}</td>
                <td class="num">${teams[t]["Drop"]}</td>
                <td class="num strong">${teams[t].total}</td>
                <td class="num" style="color:var(--prog)">${PT.fmtBaht(teams[t].openRev)}</td>
                <td class="num" style="color:var(--win)">${PT.fmtBaht(teams[t].winRev)}</td>
                <td class="num" style="color:var(--lost)">${PT.fmtBaht(teams[t].lostRev)}</td>
                <td class="num" style="color:var(--drop)">${PT.fmtBaht(teams[t].dropRev)}</td>
                <td class="num">${PT.fmtBaht(teams[t].revenue)}</td>
              </tr>`).join("")}
              <tr style="background:var(--surface-2);font-weight:750">
                <td>Grand Total</td>
                <td class="num">${grand["In Progress"]}</td>
                <td class="num" style="color:var(--win)">${grand["Win"]}</td>
                <td class="num">${grand["Lost"]}</td>
                <td class="num">${grand["Drop"]}</td>
                <td class="num">${P.length}</td>
                <td class="num" style="color:var(--prog)">${PT.fmtBaht(grandOpen)}</td>
                <td class="num" style="color:var(--win)">${PT.fmtBaht(grandWin)}</td>
                <td class="num" style="color:var(--lost)">${PT.fmtBaht(grandLost)}</td>
                <td class="num" style="color:var(--drop)">${PT.fmtBaht(grandDrop)}</td>
                <td class="num">${PT.fmtBaht(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>Presales × Status</h2></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Presales</th><th class="num">In Progress</th><th class="num">Win</th><th class="num">Lost</th><th class="num">Drop</th>
              <th class="num">Total</th><th class="num">Open Value</th><th class="num">Win Value</th><th class="num">Drop Value</th>
            </tr></thead>
            <tbody>
              ${Object.keys(presales).sort((a, b) => presales[b].total - presales[a].total).map(u => `<tr>
                <td>${PT.esc(u)}</td>
                <td class="num">${presales[u]["In Progress"]}</td>
                <td class="num" style="color:var(--win);font-weight:700">${presales[u]["Win"]}</td>
                <td class="num">${presales[u]["Lost"]}</td>
                <td class="num">${presales[u]["Drop"]}</td>
                <td class="num strong">${presales[u].total}</td>
                <td class="num" style="color:var(--prog)">${PT.fmtBaht(presales[u].openRev)}</td>
                <td class="num" style="color:var(--win)">${PT.fmtBaht(presales[u].winRev)}</td>
                <td class="num" style="color:var(--drop)">${PT.fmtBaht(presales[u].dropRev)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>Wins (by value)</h2></div>
          <div class="tbl-wrap">${miniList(P.filter(p => p.status === "Win").sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10))}</div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Watchlist: In Progress at / past Target</h2></div>
          <div class="tbl-wrap">${miniList(P.filter(p => p.status === "In Progress" && p.target && PT.quarterIndex(p.target) <= curIdx()).sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10))}</div>
        </div>
      </div>`;

    PT.wirePeriodBar(period, "rp", () => render(view));
    document.getElementById("rpPrint").onclick = () => window.print();
    document.getElementById("rpExport").onclick = () => exportReport(P, teams, order, grand, presales);
  }

  function kpi(label, value, sub, cls) {
    const color = { open: "var(--prog)", win: "var(--win)", drop: "var(--drop)", lost: "var(--lost)" }[cls];
    return `<div class="card kpi">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value" ${color ? `style="color:${color}"` : ""}>${value}</span>
      <span class="kpi-sub">${sub || ""}</span>
    </div>`;
  }

  function presalesMatrix(P) {
    const m = {};
    for (const p of P) {
      const u = p.presales || "(unassigned)";
      m[u] = m[u] || {
        "In Progress": 0, "Win": 0, "Lost": 0, "Drop": 0,
        total: 0, openRev: 0, winRev: 0, lostRev: 0, dropRev: 0,
      };
      m[u][p.status] = (m[u][p.status] || 0) + 1;
      m[u].total++;
      if (p.status === "In Progress") m[u].openRev += p.revenue || 0;
      if (p.status === "Win") m[u].winRev += p.revenue || 0;
      if (p.status === "Lost") m[u].lostRev += p.revenue || 0;
      if (p.status === "Drop") m[u].dropRev += p.revenue || 0;
    }
    return m;
  }

  function curIdx() { return PT.quarterIndex(`Q${Math.floor(new Date().getMonth() / 3) + 1}/${new Date().getFullYear()}`); }

  function miniList(rows) {
    if (!rows.length) return `<div class="empty">No data</div>`;
    return `<table class="tbl"><tbody>${rows.map(p => `<tr data-id="${p.id}">
      <td><span class="team-chip team-${p.team}">${p.team || "—"}</span></td>
      <td class="strong">${PT.esc(p.name)}</td>
      <td class="muted">${PT.esc(p.customer)}</td>
      <td class="num">${PT.fmtBaht(p.revenue)}</td>
    </tr>`).join("")}</tbody></table>`;
  }

  function exportReport(P, teams, order, grand, presales) {
    const sumBy = st => P.filter(p => p.status === st).reduce((s, p) => s + (p.revenue || 0), 0);
    const rows = [
      ["Pipeline Report", PT.periodLabel(period), `Data as of ${new Date().toISOString().slice(0, 10)}`],
      ["Open Value (In Progress)", sumBy("In Progress")],
      ["Win Value (Win)", sumBy("Win")],
      ["Lost Value (Lost)", sumBy("Lost")],
      ["Drop Value (Drop)", sumBy("Drop")],
      ["Total Value", P.reduce((s, p) => s + (p.revenue || 0), 0)],
      [],
      ["Team × Status"],
      ["Team", "In Progress", "Win", "Lost", "Drop", "Total", "Open Value", "Win Value", "Lost Value", "Drop Value", "Total Value"],
      ...order.map(t => [t, teams[t]["In Progress"], teams[t]["Win"], teams[t]["Lost"], teams[t]["Drop"], teams[t].total,
        teams[t].openRev, teams[t].winRev, teams[t].lostRev, teams[t].dropRev, teams[t].revenue]),
      ["Grand Total", grand["In Progress"], grand["Win"], grand["Lost"], grand["Drop"], P.length,
        sumBy("In Progress"), sumBy("Win"), sumBy("Lost"), sumBy("Drop")],
      [],
      ["Presales × Status"],
      ["Presales", "In Progress", "Win", "Lost", "Drop", "Total", "Open Value", "Win Value", "Drop Value"],
      ...Object.keys(presales).sort((a, b) => presales[b].total - presales[a].total)
        .map(u => [u, presales[u]["In Progress"], presales[u]["Win"], presales[u]["Lost"], presales[u]["Drop"], presales[u].total,
          presales[u].openRev, presales[u].winRev, presales[u].dropRev]),
    ];
    PT.download(`pipeline-report-${period.mode === "all" ? "all" : period.value}-${new Date().toISOString().slice(0, 10)}.csv`, "\uFEFF" + PT.toCSV(rows), "text/csv;charset=utf-8");
    PT.toast("Report exported");
  }

  return { render, _setPeriod: (m, v) => { period.mode = m; period.value = v; } };
})();
