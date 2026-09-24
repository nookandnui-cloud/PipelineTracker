/* report.js — รายงาน: filter รายเดือน/Q/ปี + pivot ทีม×สถานะ, presales×สถานะ, watchlist, export */
"use strict";

const Report = (() => {

  let periodMode = "all";   // all | month | quarter | year
  let periodValue = "";

  /* โปรเจกต์อยู่ในช่วงเวลาที่เลือกหรือไม่ (ยึดตาม Start Date) */
  function inPeriod(p) {
    if (periodMode === "all") return true;
    const d = p.startDate ? new Date(p.startDate) : null;
    if (!d || isNaN(d)) return false;
    if (periodMode === "month") return d.toISOString().slice(0, 7) === periodValue;          // YYYY-MM
    if (periodMode === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}` === periodValue;
    return String(d.getFullYear()) === periodValue;                                            // YYYY
  }

  function periodLabel() {
    if (periodMode === "all") return "ทุกช่วงเวลา";
    if (periodMode === "month") {
      const [y, m] = periodValue.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    }
    return periodValue;
  }

  function render(view) {
    const all = PT.projects();
    const P = all.filter(inPeriod);

    /* ตัวเลือกช่วงเวลาจากข้อมูลจริง (Start Date) */
    const months = [...new Set(all.map(p => p.startDate).filter(Boolean).map(s => s.slice(0, 7)))].sort().reverse();
    const quarters = [...new Set(all.map(p => {
      if (!p.startDate) return null;
      const d = new Date(p.startDate);
      return `Q${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}`;
    }).filter(Boolean))].sort((a, b) => (PT.quarterIndex(a) ?? 0) - (PT.quarterIndex(b) ?? 0)).reverse();
    const years = [...new Set(all.map(p => p.startDate ? String(new Date(p.startDate).getFullYear()) : null).filter(Boolean))].sort().reverse();

    const teams = PT.teamStatusMatrix(P);
    const order = PT.TEAM_ORDER.filter(t => teams[t]);
    const grand = { "In Progress": 0, "Win": 0, "Lost": 0, "Drop": 0 };
    order.forEach(t => PT.STATUSES.forEach(s => grand[s] += teams[t][s] || 0));
    const presales = presalesMatrix(P);
    const noDate = all.length - P.length;

    view.innerHTML = `
      <div class="view-head">
        <h1>รายงาน Pipeline</h1>
        <span class="sub">${periodLabel()} · ${P.length} โปรเจกต์</span>
        <span class="spacer"></span>
        <button class="btn small" id="rpPrint">พิมพ์ / PDF</button>
        <button class="btn primary small" id="rpExport">ส่งออกรายงาน CSV</button>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="filters">
          <label>ช่วงเวลา</label>
          <div class="seg" id="rpMode">
            <button data-m="all" class="${periodMode === "all" ? "on" : ""}">ทั้งหมด</button>
            <button data-m="month" class="${periodMode === "month" ? "on" : ""}">รายเดือน</button>
            <button data-m="quarter" class="${periodMode === "quarter" ? "on" : ""}">ราย Q</button>
            <button data-m="year" class="${periodMode === "year" ? "on" : ""}">รายปี</button>
          </div>
          <select id="rpValue" ${periodMode === "all" ? "hidden" : ""}>
            ${periodMode === "month" ? months.map(m => {
              const [y, mo] = m.split("-");
              return `<option value="${m}" ${periodValue === m ? "selected" : ""}>${new Date(y, mo - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</option>`;
            }).join("") : ""}
            ${periodMode === "quarter" ? quarters.map(q => `<option value="${q}" ${periodValue === q ? "selected" : ""}>${q}</option>`).join("") : ""}
            ${periodMode === "year" ? years.map(y => `<option value="${y}" ${periodValue === y ? "selected" : ""}>${+y + 543} (${y})</option>`).join("") : ""}
          </select>
          ${noDate && periodMode !== "all" ? `<span class="muted small">อีก ${noDate} โปรเจกต์ไม่มี Start Date → ไม่ถูกนับในช่วงนี้</span>` : ""}
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>สรุปทีม × สถานะ (เหมือน Pivot ใน Excel)</h2></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>ทีม</th><th class="num">In Progress</th><th class="num">Win</th><th class="num">Lost</th><th class="num">Drop</th><th class="num">รวม</th><th class="num">มูลค่ารวม</th><th class="num">มูลค่าเปิด</th></tr></thead>
            <tbody>
              ${order.map(t => `<tr>
                <td><span class="team-chip team-${t}">${t}</span></td>
                <td class="num">${teams[t]["In Progress"]}</td>
                <td class="num" style="color:var(--win);font-weight:700">${teams[t]["Win"]}</td>
                <td class="num">${teams[t]["Lost"]}</td>
                <td class="num">${teams[t]["Drop"]}</td>
                <td class="num strong">${teams[t].total}</td>
                <td class="num">${PT.fmtBaht(teams[t].revenue)}</td>
                <td class="num">${PT.fmtBaht(teams[t].openRev)}</td>
              </tr>`).join("")}
              <tr style="background:var(--surface-2);font-weight:750">
                <td>Grand Total</td>
                <td class="num">${grand["In Progress"]}</td>
                <td class="num" style="color:var(--win)">${grand["Win"]}</td>
                <td class="num">${grand["Lost"]}</td>
                <td class="num">${grand["Drop"]}</td>
                <td class="num">${P.length}</td>
                <td class="num">${PT.fmtBaht(P.reduce((s, p) => s + (p.revenue || 0), 0))}</td>
                <td class="num">${PT.fmtBaht(P.filter(p => p.status === "In Progress" || p.status === "Win").reduce((s, p) => s + (p.revenue || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>สรุป Presales × สถานะ</h2></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Presales</th><th class="num">In Progress</th><th class="num">Win</th><th class="num">Lost</th><th class="num">Drop</th><th class="num">รวม</th><th class="num">มูลค่าเปิด</th><th class="num">มูลค่าปิด</th></tr></thead>
            <tbody>
              ${Object.keys(presales).sort((a, b) => presales[b].total - presales[a].total).map(u => `<tr>
                <td>${PT.esc(u)}</td>
                <td class="num">${presales[u]["In Progress"]}</td>
                <td class="num" style="color:var(--win);font-weight:700">${presales[u]["Win"]}</td>
                <td class="num">${presales[u]["Lost"]}</td>
                <td class="num">${presales[u]["Drop"]}</td>
                <td class="num strong">${presales[u].total}</td>
                <td class="num">${PT.fmtBaht(presales[u].openRev)}</td>
                <td class="num" style="color:var(--win)">${PT.fmtBaht(presales[u].closedRev || 0)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>Win (เรียงตามมูลค่า)</h2></div>
          <div class="tbl-wrap">${miniList(P.filter(p => p.status === "Win").sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10))}</div>
        </div>
        <div class="card">
          <div class="card-head"><h2>เฝ้าระวัง: In Progress ที่ถึง/เลย Target</h2></div>
          <div class="tbl-wrap">${miniList(P.filter(p => p.status === "In Progress" && p.target && PT.quarterIndex(p.target) <= curIdx()).sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10))}</div>
        </div>
      </div>`;

    /* wiring */
    document.getElementById("rpMode").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      periodMode = b.dataset.m;
      periodValue = "";
      render(view);
    });
    const valSel = document.getElementById("rpValue");
    if (valSel) valSel.onchange = e => { periodValue = e.target.value; render(view); };

    document.getElementById("rpPrint").onclick = () => window.print();
    document.getElementById("rpExport").onclick = () => exportReport(P, teams, order, grand, presales);
  }

  function presalesMatrix(P) {
    const m = {};
    for (const p of P) {
      const u = p.presales || "(ไม่ระบุ)";
      m[u] = m[u] || { "In Progress": 0, "Win": 0, "Lost": 0, "Drop": 0, total: 0, openRev: 0, closedRev: 0 };
      m[u][p.status] = (m[u][p.status] || 0) + 1;
      m[u].total++;
      if (p.status === "In Progress" || p.status === "Win") m[u].openRev += p.revenue || 0;
      if (p.status === "Win") m[u].closedRev += p.revenue || 0;
    }
    return m;
  }

  function curIdx() { return PT.quarterIndex(`Q${Math.floor(new Date().getMonth() / 3) + 1}/${new Date().getFullYear()}`); }

  function miniList(rows) {
    if (!rows.length) return `<div class="empty">ไม่มีข้อมูล</div>`;
    return `<table class="tbl"><tbody>${rows.map(p => `<tr data-id="${p.id}">
      <td><span class="team-chip team-${p.team}">${p.team || "—"}</span></td>
      <td class="strong">${PT.esc(p.name)}</td>
      <td class="muted">${PT.esc(p.customer)}</td>
      <td class="num">${PT.fmtBaht(p.revenue)}</td>
    </tr>`).join("")}</tbody></table>`;
  }

  function exportReport(P, teams, order, grand, presales) {
    const rows = [
      ["รายงาน Pipeline", periodLabel(), `ข้อมูล ณ ${new Date().toLocaleDateString("th-TH")}`],
      [],
      ["สรุปทีม × สถานะ"],
      ["ทีม", "In Progress", "Win", "Lost", "Drop", "รวม", "มูลค่ารวม", "มูลค่าเปิด"],
      ...order.map(t => [t, teams[t]["In Progress"], teams[t]["Win"], teams[t]["Lost"], teams[t]["Drop"], teams[t].total, teams[t].revenue, teams[t].openRev]),
      ["Grand Total", grand["In Progress"], grand["Win"], grand["Lost"], grand["Drop"], P.length],
      [],
      ["สรุป Presales × สถานะ"],
      ["Presales", "In Progress", "Win", "Lost", "Drop", "รวม", "มูลค่าเปิด", "มูลค่าปิด"],
      ...Object.keys(presales).sort((a, b) => presales[b].total - presales[a].total)
        .map(u => [u, presales[u]["In Progress"], presales[u]["Win"], presales[u]["Lost"], presales[u]["Drop"], presales[u].total, presales[u].openRev, presales[u].closedRev]),
    ];
    PT.download(`pipeline-report-${periodMode === "all" ? "all" : periodValue}-${new Date().toISOString().slice(0, 10)}.csv`, "\uFEFF" + PT.toCSV(rows), "text/csv;charset=utf-8");
    PT.toast("ส่งออกรายงานแล้ว");
  }

  return { render, _setPeriod: (m, v) => { periodMode = m; periodValue = v; } };
})();
