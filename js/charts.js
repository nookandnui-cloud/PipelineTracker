/* charts.js — dependency-free SVG charts: stacked bars, quarter timeline, donut
   หน่วย px จริง + max-width:100% (กราฟไม่ขยายตาม container ที่กว้างกว่า) */
"use strict";

const Charts = (() => {

  function el(tag, attrs, children) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    (children || []).forEach(c => n.appendChild(c));
    return n;
  }

  const FIT = "display:block;max-width:100%;height:auto";

  /* ---------- stacked bar: team x status ---------- */
  function stackedBars(container, teams, opts) {
    opts = opts || {};
    const statuses = ["In Progress", "Win", "Lost", "Drop"];
    const colors = { "In Progress": "#3b82f6", "Win": "#22c55e", "Lost": "#ef4444", "Drop": "#f59e0b" };
    const order = (opts.order || Object.keys(teams)).filter(t => teams[t]);
    const max = Math.max(1, ...order.map(t => teams[t].total));
    const W = 540, rowH = 30, padL = 52, padR = 14, totW = 22, padT = 4;
    const H = padT + order.length * rowH;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: FIT });

    order.forEach((t, i) => {
      const y = padT + i * rowH;
      const d = teams[t];
      const lbl = el("text", { x: padL - 8, y: y + rowH / 2 + 4, "text-anchor": "end", "font-size": 11, "font-weight": 700, fill: "#47536b" });
      lbl.textContent = t;
      svg.appendChild(lbl);

      const trackW = W - padL - padR - totW;
      let x = padL;
      statuses.forEach(s => {
        const v = d[s] || 0;
        if (!v) return;
        const w = (v / max) * trackW;
        const rect = el("rect", { x: x.toFixed(1), y: y + 7, width: Math.max(w - 1.5, 2).toFixed(1), height: rowH - 14, rx: 2, fill: colors[s] });
        if (w > 26) {
          const tx = el("text", { x: (x + w / 2).toFixed(1), y: y + rowH / 2 + 3.5, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: "#fff" });
          tx.textContent = v;
          svg.appendChild(tx);
        }
        attachTip(rect, `<div class="tip-title">${t} · ${s}</div><div class="tip-row"><span>จำนวน</span><b>${v}</b></div>`);
        svg.appendChild(rect);
        x += w;
      });

      const tot = el("text", { x: W - padR, y: y + rowH / 2 + 4, "text-anchor": "end", "font-size": 10, fill: "#94a3b8" });
      tot.textContent = d.total;
      svg.appendChild(tot);
    });

    container.innerHTML = "";
    container.appendChild(svg);
  }

  /* ---------- quarter timeline (grouped horizontal bars per quarter) ---------- */
  function quarterTimeline(container, buckets, quarterKeys) {
    const statuses = ["In Progress", "Win", "Lost", "Drop"];
    const colors = { "In Progress": "#3b82f6", "Win": "#22c55e", "Lost": "#ef4444", "Drop": "#f59e0b" };
    const keys = quarterKeys.filter(q => buckets[q]);
    if (!keys.length) { container.innerHTML = `<div class="empty">No data</div>`; return; }
    const max = Math.max(1, ...keys.map(q => statuses.reduce((s, st) => s + (buckets[q][st] || 0), 0)));
    const W = 540, rowH = 26, padL = 52, padR = 14, totW = 20, padT = 4;
    const H = padT + keys.length * rowH;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: FIT });

    keys.forEach((q, i) => {
      const y = padT + i * rowH;
      const d = buckets[q];
      const lbl = el("text", { x: padL - 8, y: y + rowH / 2 + 3.5, "text-anchor": "end", "font-size": 10.5, "font-weight": 700, fill: "#47536b" });
      lbl.textContent = q.replace("/", " ");
      svg.appendChild(lbl);

      const trackW = W - padL - padR - totW;
      let x = padL;
      const total = statuses.reduce((s, st) => s + (d[st] || 0), 0);
      statuses.forEach(s => {
        const v = d[s] || 0;
        if (!v) return;
        const w = (v / max) * trackW;
        const rect = el("rect", { x: x.toFixed(1), y: y + 6, width: Math.max(w - 1.5, 2).toFixed(1), height: rowH - 12, rx: 2, fill: colors[s] });
        attachTip(rect, `<div class="tip-title">${q}</div><div class="tip-row"><span>${s}</span><b>${v}</b></div><div class="tip-row"><span>มูลค่า</span><b>${PT.fmtBaht(d.revenue)}</b></div>`);
        svg.appendChild(rect);
        x += w;
      });
      const tot = el("text", { x: W - padR, y: y + rowH / 2 + 3.5, "text-anchor": "end", "font-size": 9.5, fill: "#94a3b8" });
      tot.textContent = total;
      svg.appendChild(tot);
    });

    container.innerHTML = "";
    container.appendChild(svg);
  }

  /* ---------- donut ---------- */
  function donut(container, counts, opts) {
    opts = opts || {};
    const entries = Object.entries(counts).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const colors = { "In Progress": "#3b82f6", "Win": "#22c55e", "Lost": "#ef4444", "Drop": "#f59e0b" };
    if (!total) { container.innerHTML = `<div class="empty">No data</div>`; return; }

    const R = 15.9;
    const svg = el("svg", { viewBox: "0 0 42 42", width: opts.size || 118, height: opts.size || 118 });
    svg.appendChild(el("circle", { cx: 21, cy: 21, r: R, fill: "none", stroke: "#eef1f6", "stroke-width": 6 }));
    let off = 25;
    entries.forEach(([k, v]) => {
      const frac = v / total;
      const arc = el("circle", {
        cx: 21, cy: 21, r: R, fill: "none",
        stroke: colors[k] || "#94a3b8", "stroke-width": 6,
        "stroke-dasharray": `${(frac * 100).toFixed(2)} ${(100 - frac * 100).toFixed(2)}`,
        "stroke-dashoffset": off,
      });
      attachTip(arc, `<div class="tip-title">${k}</div><div class="tip-row"><span>จำนวน</span><b>${v} (${(frac * 100).toFixed(0)}%)</b></div>`);
      svg.appendChild(arc);
      off -= frac * 100;
    });
    const t1 = el("text", { x: 21, y: 20.5, "text-anchor": "middle", "font-size": 8, "font-weight": 800, fill: "#1a2233" });
    t1.textContent = total;
    const t2 = el("text", { x: 21, y: 27, "text-anchor": "middle", "font-size": 3.4, fill: "#64748b" });
    t2.textContent = opts.centerLabel || "projects";
    svg.appendChild(t1); svg.appendChild(t2);

    container.innerHTML = "";
    container.appendChild(svg);
  }

  /* ---------- tooltip ---------- */
  let tipEl = null;
  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "chart-tip";
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function attachTip(node, html) {
    node.addEventListener("mouseenter", e => {
      const t = ensureTip();
      t.innerHTML = html;
      t.hidden = false;
    });
    node.addEventListener("mousemove", e => {
      const t = ensureTip();
      const x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8);
      const y = Math.max(8, e.clientY - t.offsetHeight - 10);
      t.style.left = x + "px"; t.style.top = y + "px";
    });
    node.addEventListener("mouseleave", () => { ensureTip().hidden = true; });
  }

  return { stackedBars, quarterTimeline, donut };
})();
