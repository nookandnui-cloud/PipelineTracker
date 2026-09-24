/* app.js — bootstrap, landing→app flow, routing */
"use strict";

const App = (() => {
  let view = "dashboard";

  function boot() {
    Upload.init();

    document.getElementById("mainNav").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      view = b.dataset.view;
      document.querySelectorAll("#mainNav button").forEach(x => x.classList.toggle("active", x === b));
      render();
    });

    document.getElementById("btnExcelSave").onclick = () => ExcelSync.manualSave();

    document.getElementById("btnChangeFile").onclick = () => {
      document.getElementById("app").hidden = true;
      document.getElementById("landing").hidden = false;
    };

    document.getElementById("btnReset").onclick = () => {
      const src = PT.state && PT.state.source;
      const msg = src
        ? `Reset to the data from "${src.fileName}" (${src.count} projects)? All edits and weekly history will be cleared`
        : "Reset all data? Every edit made in this app will be lost";
      if (!confirm(msg)) return;
      PT.reset();
      render();
      PT.toast("Data reset");
    };

    /* state เก่าจาก localStorage: เข้าแอปเลย; ไม่งั้นอยู่หน้า landing รออัปโหลด */
    PT.load();
    if (PT.state.source) {
      enterApp();
    }
  }

  function enterApp() {
    document.getElementById("landing").hidden = true;
    document.getElementById("app").hidden = false;

    const st = PT.state;
    const meta = document.getElementById("dataMeta");
    if (st.source) {
      meta.textContent = `${st.source.sheetName} · ${st.source.fileName} · ${st.projects.length} projects · uploaded ${st.source.ingestedAt.slice(0, 10)}`;
    } else {
      meta.textContent = `System Team · ${st.projects.length} projects`;
    }
    render();
  }

  function render() {
    const host = document.getElementById("view");
    if (view === "dashboard") Dashboard.render(host);
    else if (view === "projects") Projects.render(host);
    else Report.render(host);
    window.scrollTo(0, 0);
  }

  function openDrawer(id) { Projects.openDrawer(id); }
  function refreshBadges() { /* reserved */ }

  document.addEventListener("DOMContentLoaded", boot);

  return { render, openDrawer, refreshBadges, enterApp };
})();
