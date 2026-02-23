/**
 * InstaPoll Alert — Content Script
 * Monitors the Instapoll page DOM for new/incomplete polls
 * and notifies the background service worker.
 */

(function () {
  "use strict";

  const POLL_CHECK_INTERVAL = 3000; // fallback polling interval (ms)
  const LOG_PREFIX = "[InstaPoll Alert]";

  // Track polls we've already sent a notification for
  const notifiedPolls = new Set();

  // --- Poll Detection ---

  /**
   * Scans the page for incomplete polls.
   * Looks for the table rendered by Vue's <student-main> component.
   * The table uses class "table table-hover table-itemlist" and each row
   * has columns where the 3rd <td> contains the completion status.
   */
  function scanForPolls() {
    const tables = document.querySelectorAll("table.table-hover.table-itemlist");
    let newPollFound = false;

    tables.forEach((table) => {
      const rows = table.querySelectorAll("tbody tr, tr");
      rows.forEach((row, index) => {
        // Skip header row
        if (row.querySelector("th")) return;

        const cells = row.querySelectorAll("td");
        if (cells.length < 3) return;

        const statusCell = cells[2];
        const statusText = statusCell.textContent.trim();
        const pollName = cells[0] ? cells[0].textContent.trim() : `Poll ${index}`;

        // Create a unique key for this poll
        const pollKey = `${pollName}|${statusText}`;

        if (!statusText.includes("Completed") && !notifiedPolls.has(pollKey)) {
          notifiedPolls.add(pollKey);
          newPollFound = true;

          console.log(`${LOG_PREFIX} New incomplete poll detected: "${pollName}"`);

          // Notify background worker
          chrome.runtime.sendMessage({
            type: "NEW_POLL",
            data: {
              pollName: pollName,
              status: statusText,
              url: window.location.href,
              courseTitle: getCourseTitle(),
            },
          });
        }
      });
    });

    // Also check for any poll prompt/modal that Vue might render
    // (e.g. when a poll pops up directly)
    checkForPollPrompt();

    return newPollFound;
  }

  /**
   * Check for Vue-rendered poll prompts/modals that may appear
   * outside the table (e.g. ComponentPollPrompt).
   */
  function checkForPollPrompt() {
    // Look for common poll prompt indicators
    const selectors = [
      ".poll-prompt",
      ".poll-question",
      "[class*='poll']",
      ".modal.show",
      ".card",
    ];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = el.textContent.trim();
        // Only interested in elements that look like poll questions
        if (
          text.length > 10 &&
          text.length < 1000 &&
          !notifiedPolls.has(`prompt|${text.substring(0, 50)}`)
        ) {
          // Check if this element contains answer choices (radio/checkbox)
          const hasInputs = el.querySelectorAll(
            'input[type="radio"], input[type="checkbox"], button[class*="answer"], .form-check'
          );
          if (hasInputs.length > 0) {
            const key = `prompt|${text.substring(0, 50)}`;
            notifiedPolls.add(key);

            console.log(`${LOG_PREFIX} Poll prompt detected`);

            chrome.runtime.sendMessage({
              type: "NEW_POLL",
              data: {
                pollName: "New Poll Question",
                status: "Active",
                url: window.location.href,
                courseTitle: getCourseTitle(),
              },
            });
          }
        }
      });
    });
  }

  /**
   * Get the course title from the page globals or DOM.
   */
  function getCourseTitle() {
    // Try the global variable first (set by the page's inline script)
    try {
      if (window.course && window.course.title) {
        return window.course.title;
      }
    } catch (e) {
      // Content scripts can't always access page globals directly
    }

    // Fallback: read from the DOM
    const h6 = document.querySelector("#student_app h6");
    if (h6) return h6.textContent.trim();

    const h4 = document.querySelector("#student_app h4");
    if (h4) return h4.textContent.trim();

    return "UT Instapoll";
  }

  // --- MutationObserver ---

  function startObserver() {
    const targetNode =
      document.getElementById("student_app") || document.body;

    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        scanForPolls();
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    console.log(
      `${LOG_PREFIX} MutationObserver attached to ${targetNode.id || "body"}`
    );

    return observer;
  }

  // --- Initialization ---

  function init() {
    console.log(`${LOG_PREFIX} Monitoring started on ${window.location.href}`);

    // Notify background that we're connected
    chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });

    // Initial scan
    scanForPolls();

    // Start MutationObserver for real-time detection
    startObserver();

    // Fallback: periodic polling in case MutationObserver
    // misses changes (e.g. Vue replacing entire DOM subtrees)
    setInterval(scanForPolls, POLL_CHECK_INTERVAL);
  }

  // Wait for the Vue app to mount
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
