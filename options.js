// options.js

const shortcutInput = document.getElementById("shortcutInput");
const saveBtn = document.getElementById("saveBtn");

// Load stored shortcut or default
chrome.storage.sync.get(["shortcut"], (result) => {
  shortcutInput.value = result.shortcut || "Ctrl+Shift+L";
});

saveBtn.addEventListener("click", () => {
  const shortcut = shortcutInput.value.trim();

  if (!shortcut) {
    alert("Please enter a shortcut");
    return;
  }

  // Save to storage
  chrome.storage.sync.set({ shortcut }, () => {
    alert("Shortcut saved! Please reload the extension at chrome://extensions/ to apply.");
  });
});
