/**
 * InstaPoll Alert — Background Service Worker
 * Handles notifications and audio playback via offscreen document.
 */

// Default settings
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  notificationsEnabled: true,
};

// Track state
let isConnected = false;
let isAlerting = false;

// --- Settings ---

async function getSettings() {
  const result = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

// --- Offscreen Document (for audio) ---

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play notification chime when a new poll is detected",
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

async function startChime() {
  await ensureOffscreenDocument();
  chrome.runtime.sendMessage({ type: "PLAY_CHIME" });
}

async function stopChime() {
  try {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({ type: "STOP_CHIME" });
  } catch (e) {
    // offscreen doc may not exist
  }
  isAlerting = false;
  chrome.action.setBadgeText({ text: "" });
  // Notify popup to update UI
  chrome.runtime.sendMessage({ type: "ALERT_STOPPED" }).catch(() => { });
}

// --- Notifications ---

async function showNotification(pollData) {
  const settings = await getSettings();

  if (settings.notificationsEnabled) {
    // Clear any previous poll notifications first
    chrome.notifications.getAll((existing) => {
      Object.keys(existing).forEach((id) => {
        if (id.startsWith("poll-")) chrome.notifications.clear(id);
      });
    });

    chrome.notifications.create(`poll-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "🚨 NEW INSTAPOLL — ANSWER NOW!",
      message: `${pollData.pollName}\n📚 ${pollData.courseTitle}\n\nClick to open Instapoll →`,
      priority: 2,
      requireInteraction: true, // stays until user dismisses
    });
  }

  if (settings.soundEnabled) {
    isAlerting = true;
    startChime(); // starts repeating every 5s
    // Notify popup to show stop button
    chrome.runtime.sendMessage({ type: "ALERT_STARTED" }).catch(() => { });
  }

  // Update badge — bright red for urgency
  chrome.action.setBadgeText({ text: "!!!" });
  chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "CONTENT_SCRIPT_READY":
      isConnected = true;
      if (!isAlerting) chrome.action.setBadgeText({ text: "" });
      chrome.runtime.sendMessage({ type: "STATUS_UPDATE", connected: true }).catch(() => { });
      break;

    case "NEW_POLL":
      showNotification(message.data);
      break;

    case "GET_STATUS":
      sendResponse({ connected: isConnected, alerting: isAlerting });
      return true; // async response

    case "STOP_ALERT":
      stopChime();
      break;

    case "CLEAR_BADGE":
      if (!isAlerting) chrome.action.setBadgeText({ text: "" });
      break;
  }
});

// Handle notification click — focus the Instapoll tab AND stop alert
chrome.notifications.onClicked.addListener(async (notificationId) => {
  const tabs = await chrome.tabs.query({ url: "*://polls.la.utexas.edu/*" });
  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  }
  chrome.notifications.clear(notificationId);
  stopChime(); // stop the repeating sound when user clicks notification
});

// Reset connection status when tab is closed or navigated away
chrome.tabs.onRemoved.addListener(() => {
  checkConnection();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    checkConnection();
  }
});

async function checkConnection() {
  const tabs = await chrome.tabs.query({ url: "*://polls.la.utexas.edu/*" });
  isConnected = tabs.length > 0;
  chrome.runtime.sendMessage({ type: "STATUS_UPDATE", connected: isConnected }).catch(() => { });
}
