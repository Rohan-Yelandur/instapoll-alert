(function () {
  "use strict";

  const POLL_CHECK_INTERVAL = 3000;
  const DEBOUNCE_DELAY = 500;
  const LOG_PREFIX = "[InstaPoll Alert]";

  const notifiedPolls = new Set();
  let hasActivePolls = false;
  let debounceTimer = null;

  function scanForPolls() {
    const tables = document.querySelectorAll("table.table-hover.table-itemlist");
    let incompletePollCount = 0;
    let newPollFound = false;

    tables.forEach((table) => {
      const rows = table.querySelectorAll("tbody tr, tr");
      rows.forEach((row, index) => {
        if (row.querySelector("th")) return;

        const cells = row.querySelectorAll("td");
        if (cells.length < 3) return;

        const statusText = cells[2].textContent.trim();
        const pollName = cells[0] ? cells[0].textContent.trim() : "";
        if (!pollName) return;

        if (!statusText.includes("Completed")) {
          incompletePollCount++;

          if (!notifiedPolls.has(pollName)) {
            notifiedPolls.add(pollName);
            newPollFound = true;
            console.log(`${LOG_PREFIX} New incomplete poll: "${pollName}"`);

            chrome.runtime.sendMessage({
              type: "NEW_POLL",
              data: {
                pollName,
                status: statusText,
                url: window.location.href,
                courseTitle: getCourseTitle(),
              },
            });
          }
        }
      });
    });

    if (hasActivePolls && incompletePollCount === 0) {
      console.log(`${LOG_PREFIX} All polls completed — stopping alert`);
      chrome.runtime.sendMessage({ type: "POLLS_COMPLETED" });
    }

    hasActivePolls = incompletePollCount > 0;
    return newPollFound;
  }

  function getCourseTitle() {
    const h6 = document.querySelector("#student_app h6");
    if (h6) return h6.textContent.trim();
    const h4 = document.querySelector("#student_app h4");
    if (h4) return h4.textContent.trim();
    return "UT Instapoll";
  }

  function startObserver() {
    const target = document.getElementById("student_app") || document.body;

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanForPolls, DEBOUNCE_DELAY);
    });

    observer.observe(target, { childList: true, subtree: true });
    console.log(`${LOG_PREFIX} MutationObserver attached to #${target.id || "body"}`);
    return observer;
  }

  function init() {
    console.log(`${LOG_PREFIX} Monitoring started on ${window.location.href}`);
    chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });
    scanForPolls();
    startObserver();
    setInterval(scanForPolls, POLL_CHECK_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
