/**
 * InstaPoll Alert — Popup Script
 * Handles status display, settings toggles, and stop alert button.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const statusDot = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");
  const statusDetail = document.getElementById("status-detail");
  const statusCard = document.getElementById("status-card");
  const toggleNotifications = document.getElementById("toggle-notifications");
  const toggleSound = document.getElementById("toggle-sound");
  const stopAlertBtn = document.getElementById("stop-alert-btn");

  // --- Load saved settings ---
  const result = await chrome.storage.local.get("settings");
  const settings = {
    soundEnabled: true,
    notificationsEnabled: true,
    ...result.settings,
  };

  toggleNotifications.checked = settings.notificationsEnabled;
  toggleSound.checked = settings.soundEnabled;

  // --- Status & Alert State ---

  function setConnectedState() {
    statusDot.className = "status-indicator connected";
    statusLabel.textContent = "Monitoring Active";
    statusDetail.textContent = "Watching for new polls...";
    statusCard.classList.remove("alerting");
  }

  function setDisconnectedState() {
    statusDot.className = "status-indicator disconnected";
    statusLabel.textContent = "Not Connected";
    statusDetail.textContent = "Open your Instapoll page to start";
    statusCard.classList.remove("alerting");
  }

  function setAlertingState() {
    statusDot.className = "status-indicator alerting";
    statusLabel.textContent = "🚨 POLL ACTIVE!";
    statusDetail.textContent = "Answer now — chime repeating every 5s";
    statusCard.classList.add("alerting");
    stopAlertBtn.classList.remove("hidden");
  }

  function clearAlertingState() {
    stopAlertBtn.classList.add("hidden");
    statusCard.classList.remove("alerting");
    setConnectedState();
  }

  // --- Check initial status ---
  async function updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      if (response && response.alerting) {
        setAlertingState();
      } else if (response && response.connected) {
        setConnectedState();
      } else {
        setDisconnectedState();
      }
    } catch {
      setDisconnectedState();
    }
  }

  updateStatus();

  // Clear badge when popup is opened (but not if alerting)
  chrome.runtime.sendMessage({ type: "CLEAR_BADGE" });

  // --- Stop Alert Button ---
  stopAlertBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "STOP_ALERT" });
    clearAlertingState();
  });

  // --- Listen for status updates from background ---
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "STATUS_UPDATE":
        if (message.connected) {
          setConnectedState();
        } else {
          setDisconnectedState();
        }
        break;
      case "ALERT_STARTED":
        setAlertingState();
        break;
      case "ALERT_STOPPED":
        clearAlertingState();
        break;
    }
  });

  // --- Settings Toggles ---
  async function saveSettings() {
    const newSettings = {
      notificationsEnabled: toggleNotifications.checked,
      soundEnabled: toggleSound.checked,
    };
    await chrome.storage.local.set({ settings: newSettings });
  }

  toggleNotifications.addEventListener("change", saveSettings);
  toggleSound.addEventListener("change", saveSettings);
});
