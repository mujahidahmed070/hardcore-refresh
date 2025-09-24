const clearLocalStorageCheckbox = document.getElementById('clearLocalStorage');
const clearSessionStorageCheckbox = document.getElementById('clearSessionStorage');
const clearCookiesCheckbox = document.getElementById('clearCookies');
const form = document.getElementById('popup-form');
const runButton = document.getElementById('runButton');
const toast = document.getElementById('toast');

function setRunning(running) {
  if (runButton) {
    runButton.disabled = running;
    runButton.textContent = running ? 'Running…' : 'Clear & Reload';
  }
}

function showToast(msg, ms = 1500) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, ms);
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({
    clearLocalStorage: true,
    clearSessionStorage: true,
    clearCookies: false
  }, (prefs) => {
    clearLocalStorageCheckbox.checked = prefs.clearLocalStorage;
    clearSessionStorageCheckbox.checked = prefs.clearSessionStorage;
    clearCookiesCheckbox.checked = prefs.clearCookies;
  });
  // ensure run button is in default state
  setRunning(false);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs.length) return;
    const tabId = tabs[0].id;

    chrome.scripting.executeScript({
      target: {tabId},
      function: (clearLocal, clearSession, clearCookies) => {
        if (clearLocal) localStorage.clear();
        if (clearSession) sessionStorage.clear();

        // Cookies cannot be cleared from page context, so send message to background
        if (clearCookies) {
          chrome.runtime.sendMessage({clearCookies: true});
        }

        location.reload();
      },
      args: [
        clearLocalStorageCheckbox.checked,
        clearSessionStorageCheckbox.checked,
        clearCookiesCheckbox.checked
      ]
    }, () => {
      // Request background to run a circular progress animation around the icon
      // disable UI while running
      setRunning(true);
      try {
        chrome.runtime.sendMessage({ action: 'startProgress', duration: 1500 });
      } catch (e) {
        // fallback to badge tick if messaging fails
        chrome.action.setBadgeText({ text: '✓' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
        // re-enable UI after short delay
        setTimeout(() => setRunning(false), 1200);
      }
    });
  });
});

// Listen for message to clear cookies (from page context)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.clearCookies) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs.length) return;
      const tab = tabs[0];
      const url = new URL(tab.url);
      const domain = url.hostname;

      chrome.cookies.getAll({domain}, (cookies) => {
        for (const cookie of cookies) {
          const cookieUrl = (cookie.secure ? "https://" : "http://") + cookie.domain + cookie.path;

// Listen for background progress completion so we can re-enable UI and show toast
chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.action) return;
  if (message.action === 'progressComplete') {
    setRunning(false);
    showToast('Done');
  }
});
          chrome.cookies.remove({url: cookieUrl, name: cookie.name});
        }
      });
    });
  }
});
