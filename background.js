// background.js

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "refresh-with-clear") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Inject script to clear localStorage/sessionStorage and other storages
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: clearAllStoragesAndNotify,
    }, () => {
      // Show tick animation on extension icon
      chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
    });
  }
});

// This function runs in the page context
function clearAllStoragesAndNotify() {
  (async () => {
    try {
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Clear IndexedDB
      const databases = await indexedDB.databases();
      for (const db of databases) {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = () => resolve();
        });
      }

      // Clear Cache Storage
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }

      // Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 🎉 Show celebration and reload
      showVisualCelebration();

      // Notify background to show tick
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'showTick' });
        }
      } catch (e) {
        // ignore errors in page context
      }

      setTimeout(() => location.reload(), 2000);
    } catch (e) {
      console.error("Error clearing storages:", e);
      alert("Error clearing storages: " + e.message);
    }
  })();

  function showVisualCelebration() {
    // Show notification banner
    const banner = document.createElement("div");
    banner.textContent = "🎉 Storage cleared! Reloading...";
    banner.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%;
      background: #4caf50;
      color: white;
      font-size: 16px;
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 10px;
      z-index: 100000;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = 1 }, 100);

    // 🎉 Launch confetti
    launchConfetti();
  }

  function launchConfetti() {
    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 100001;
    `;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const confetti = Array.from({ length: 150 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H - H,
      r: Math.random() * 6 + 4,
      d: Math.random() * 150 + 150,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      tilt: Math.random() * 10 - 5
    }));

    let angle = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      angle += 0.01;
      for (let i = 0; i < confetti.length; i++) {
        const c = confetti[i];
        c.y += (Math.cos(angle + c.d) + 1 + c.r / 2) * 0.5;
        c.x += Math.sin(angle) * 2;
        c.tilt = Math.sin(c.y / 10) * 10;

        ctx.beginPath();
        ctx.fillStyle = c.color;
        ctx.ellipse(c.x + c.tilt, c.y, c.r, c.r / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    let interval = setInterval(draw, 20);
    setTimeout(() => {
      clearInterval(interval);
      canvas.remove();
    }, 2000);
  }
}

// Listen for messages from page script
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.action === 'showTick') {
    // Show tick animation on extension icon
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
  }
});
