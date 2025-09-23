const clearLocalStorageCheckbox = document.getElementById('clearLocalStorage');
const clearSessionStorageCheckbox = document.getElementById('clearSessionStorage');
const clearCookiesCheckbox = document.getElementById('clearCookies');
const form = document.getElementById('popup-form');

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
      // Show tick animation on extension icon
      chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
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
          chrome.cookies.remove({url: cookieUrl, name: cookie.name});
        }
      });
    });
  }
});
