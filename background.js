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
        // Start circular progress animation around the icon (direct call in service worker)
        startProgressAnimation(1500).catch(() => {
          // fallback to badge tick
          chrome.action.setBadgeText({ text: '✓' });
          setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
        });
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
              chrome.runtime.sendMessage({ action: 'startProgress', duration: 2000 });
        }
      } catch (e) {
        // ignore errors in page context
      }

      // Ensure the background stops the progress animation before reload
      setTimeout(() => {
        try {
          if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'stopProgress' });
          }
        } catch (e) {
          // ignore
        }
        location.reload();
      }, 2000);
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
  if (!message || !message.action) return;
  if (message.action === 'showTick') {
    // fallback: show tick badge briefly
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
    return;
  }

  if (message.action === 'startProgress') {
    const duration = typeof message.duration === 'number' ? message.duration : 1500;
    startProgressAnimation(duration).catch(() => {
      // fallback to badge tick if animation isn't supported
      chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), duration);
    });
    return;
  }

  if (message.action === 'stopProgress') {
    stopProgressAnimation();
    return;
  }
});

// Progress animation implementation
let progressInterval = null;
let progressStart = 0;
let progressDuration = 0;
let logoBitmap = null; // cached ImageBitmap of logo-v2.png
let progressGuardTimer = null;

async function startProgressAnimation(durationMs = 1500) {
  if (progressInterval) {
    // already running, extend duration
    progressDuration = Math.max(progressDuration, durationMs);
    return;
  }
  progressDuration = durationMs;
  progressStart = Date.now();

  // clear any previous guard
  if (progressGuardTimer) {
    clearTimeout(progressGuardTimer);
    progressGuardTimer = null;
  }
  // set a forced guard to stop the animation even if something goes wrong
  progressGuardTimer = setTimeout(() => {
    try {
      console.warn('Progress guard timeout fired; forcing stopProgressAnimation');
      stopProgressAnimation();
    } catch (e) {
      // ignore
    }
  }, durationMs + 1000);

  // Animation tick: draw ring at progress and set as action icon
  progressInterval = setInterval(async () => {
    const elapsed = Date.now() - progressStart;
    const t = Math.min(1, elapsed / progressDuration);
    try {
      await setIconWithProgress(t);
    } catch (err) {
      // If drawing or setIcon fails, stop the animation and fallback to a brief badge tick
      console.error('Progress icon update failed, stopping animation:', err);
      stopProgressAnimation();
      try {
        chrome.action.setBadgeText({ text: '✓' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), Math.max(500, progressDuration));
      } catch (e) {
        // ignore
      }
      return;
    }

    if (t >= 1) {
      stopProgressAnimation();
    }
  }, 40);
}

function stopProgressAnimation() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (progressGuardTimer) {
    clearTimeout(progressGuardTimer);
    progressGuardTimer = null;
  }
  // restore original icon
  chrome.action.setIcon({ path: {
    16: 'logo-v2.png',
    48: 'logo-v2.png',
    128: 'logo-v2.png'
  }});
}

async function setIconWithProgress(progress) {
  // progress: 0..1
  const sizes = [16, 48, 128];
  const imageDataMap = {};
  for (const size of sizes) {
    const imgData = await drawProgressIcon(size, progress);
    imageDataMap[size] = imgData;
  }

  // Set the action icon using ImageData objects
  try {
    chrome.action.setIcon({ imageData: {
      16: imageDataMap[16],
      48: imageDataMap[48],
      128: imageDataMap[128]
    }});
  } catch (e) {
    // If setIcon with ImageData fails, rethrow so caller can fallback
    throw e;
  }
}

async function drawProgressIcon(size, progress) {
  // Use OffscreenCanvas (works in service worker). Return ImageData.
  if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas not available');

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // clear
  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const radius = center - Math.max(4, size * 0.06);

  // Draw the actual logo under the ring. Cache a single ImageBitmap for performance.
  try {
    if (!logoBitmap) {
      const url = chrome.runtime.getURL('logo-v2.png');
      const resp = await fetch(url);
      const blob = await resp.blob();
      // createImageBitmap available in service worker contexts
      logoBitmap = await createImageBitmap(blob);
    }

    // draw the logo scaled to the icon size while preserving aspect ratio
    const bmp = logoBitmap;
    const bmpRatio = bmp.width / bmp.height;
    let dw = size;
    let dh = size;
    if (bmpRatio > 1) {
      // wider than tall
      dh = size / bmpRatio;
    } else {
      dw = size * bmpRatio;
    }
    const dx = Math.round((size - dw) / 2);
    const dy = Math.round((size - dh) / 2);
    ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, dx, dy, dw, dh);
  } catch (e) {
    // If loading logo fails, draw a simple white circular background as fallback
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    // small placeholder mark
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.45, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();
  }

  // draw progress ring in bright green (overlay only)
  const ringRadius = radius;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = '#43a047';
  ctx.beginPath();
  ctx.arc(center, center, ringRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function createCanvas(w, h) {
  // Not used anymore; kept for compatibility
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    c.width = w; c.height = h;
    return c;
  }
  throw new Error('No OffscreenCanvas available in this environment');
}

