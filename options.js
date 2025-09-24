// options.js

document.addEventListener('DOMContentLoaded', () => {
  const shortcutBox = document.getElementById('shortcutBox');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusMessage = document.getElementById('statusMessage');
  
  let isListening = false;
  let currentModifiers = [];
  let currentKey = null;
  
  // Default shortcut based on platform
  const DEFAULT_SHORTCUT = navigator.platform.includes('Mac') 
    ? 'Command+Shift+L' 
    : 'Ctrl+Shift+L';
  
  // Key mapping for display
  const keyDisplayMap = {
    'Control': 'Ctrl',
    'Alt': 'Alt',
    'Shift': 'Shift',
    'Meta': navigator.platform.includes('Mac') ? 'Command' : 'Win',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Escape': 'Esc'
  };
  
  // Load stored shortcut or default
  loadSavedShortcut();
  
  // Start listening for keyboard input
  shortcutBox.addEventListener('click', () => {
    if (!isListening) {
      startListening();
    }
  });
  
  shortcutBox.addEventListener('keydown', (event) => {
    if (!isListening) return;
    
    event.preventDefault();
    
    // Track modifier keys
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      if (!currentModifiers.includes(event.key)) {
        currentModifiers.push(event.key);
      }
    } else {
      // Non-modifier key pressed
      currentKey = event.key;
      
      // Update display
      updateShortcutDisplay();
      
      // Stop listening after a complete shortcut is captured
      stopListening();
      
      // Enable save button if we have a valid shortcut
      if (isValidShortcut()) {
        saveBtn.disabled = false;
      }
    }
  });
  
  shortcutBox.addEventListener('keyup', (event) => {
    if (!isListening) return;
    
    // Remove released modifier from tracking
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      currentModifiers = currentModifiers.filter(mod => mod !== event.key);
    }
  });
  
  // Clear button handler
  clearBtn.addEventListener('click', () => {
    currentModifiers = [];
    currentKey = null;
    shortcutBox.textContent = 'Click to record shortcut';
    shortcutBox.classList.remove('listening');
    saveBtn.disabled = true;
    isListening = false;
    hideStatus();
  });
  
  // Reset to default button handler
  resetBtn.addEventListener('click', () => {
    // Parse the default shortcut
    const parts = DEFAULT_SHORTCUT.split('+');
    
    // Convert to our internal format
    currentModifiers = parts.slice(0, -1).map(mod => {
      if (mod === 'Ctrl') return 'Control';
      if (mod === 'Command' || mod === 'Win') return 'Meta';
      return mod;
    });
    
    currentKey = parts[parts.length - 1];
    
    // Update the display
    updateShortcutDisplay();
    
    // Enable save button
    saveBtn.disabled = false;
    
    // Show status
    showStatus('success', 'Reset to default shortcut. Click Save to apply.');
  });
  
  // Save button handler
  saveBtn.addEventListener('click', () => {
    if (!isValidShortcut()) {
      showStatus('error', 'Invalid shortcut. Please try again.');
      return;
    }
    
    const shortcut = formatShortcutForStorage();
    
    // Save to storage
    chrome.storage.sync.set({ shortcut }, () => {
      if (chrome.runtime.lastError) {
        showStatus('error', 'Error saving shortcut: ' + chrome.runtime.lastError.message);
        return;
      }
      
      // Show the shortcut configuration dialog
      showShortcutConfigDialog(shortcut);
    });
  });
  
  // Helper functions
  function startListening() {
    isListening = true;
    currentModifiers = [];
    currentKey = null;
    shortcutBox.textContent = 'Press keys...';
    shortcutBox.classList.add('listening');
    shortcutBox.focus();
    hideStatus();
  }
  
  function stopListening() {
    isListening = false;
    shortcutBox.classList.remove('listening');
  }
  
  function updateShortcutDisplay() {
    shortcutBox.innerHTML = '';
    
    // Add modifier keys
    currentModifiers.forEach(mod => {
      const keySpan = document.createElement('span');
      keySpan.className = 'key';
      keySpan.textContent = keyDisplayMap[mod] || mod;
      shortcutBox.appendChild(keySpan);
      
      // Add + separator
      const plus = document.createTextNode(' + ');
      shortcutBox.appendChild(plus);
    });
    
    // Add main key
    if (currentKey) {
      const keySpan = document.createElement('span');
      keySpan.className = 'key';
      keySpan.textContent = keyDisplayMap[currentKey] || currentKey;
      shortcutBox.appendChild(keySpan);
    }
  }
  
  function formatShortcutForStorage() {
    const modifiers = currentModifiers.map(mod => {
      if (mod === 'Control') return 'Ctrl';
      if (mod === 'Meta') return navigator.platform.includes('Mac') ? 'Command' : 'Win';
      return mod;
    });
    
    const key = keyDisplayMap[currentKey] || currentKey;
    return [...modifiers, key].join('+');
  }
  
  function isValidShortcut() {
    // Must have at least one modifier and one key
    return currentModifiers.length > 0 && currentKey;
  }
  
  function showStatus(type, message) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    
    // Auto-hide success messages after a few seconds
    if (type === 'success') {
      setTimeout(() => {
        hideStatus();
      }, 5000);
    }
  }
  
  function hideStatus() {
    statusMessage.className = 'status';
  }
  
  function showShortcutConfigDialog(shortcut) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Apply Keyboard Shortcut';
    modal.appendChild(title);
    
    // Add message
    const message = document.createElement('p');
    message.innerHTML = `
      Your shortcut <strong>${shortcut}</strong> has been saved to preferences.<br><br>
      Due to Chrome security restrictions, we need to open the Chrome shortcuts page for you to apply this change.
      <br><br>
      <strong>Follow these steps:</strong>
      <ol>
        <li>On the next page, find "Hardcore Refresh" in the list</li>
        <li>Click on the pencil icon next to "Clear storage and reload the page"</li>
        <li>Press your shortcut: <strong>${shortcut}</strong></li>
        <li>Click "OK" to save</li>
      </ol>
    `;
    modal.appendChild(message);
    
    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'modal-buttons';
    
    const openButton = document.createElement('button');
    openButton.textContent = 'Open Chrome Shortcuts Page';
    openButton.className = 'primary-button';
    openButton.addEventListener('click', () => {
      // Open the Chrome shortcuts page in a new tab
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      
      // Close the modal
      document.body.removeChild(overlay);
      
      // Show success status
      showStatus('success', 'Shortcut saved to preferences!');
    });
    buttonContainer.appendChild(openButton);
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'secondary-button';
    cancelButton.addEventListener('click', () => {
      // Close the modal
      document.body.removeChild(overlay);
      
      // Show success status
      showStatus('success', 'Shortcut saved to preferences!');
    });
    buttonContainer.appendChild(cancelButton);
    
    modal.appendChild(buttonContainer);
    
    // Add modal to overlay
    overlay.appendChild(modal);
    
    // Add overlay to body
    document.body.appendChild(overlay);
  }
  
  function loadSavedShortcut() {
    chrome.storage.sync.get(['shortcut'], (result) => {
      // Use the saved shortcut or fall back to default
      const shortcutToUse = result.shortcut || DEFAULT_SHORTCUT;
      
      // Parse the shortcut
      const parts = shortcutToUse.split('+');
      
      // Convert to our internal format
      currentModifiers = parts.slice(0, -1).map(mod => {
        if (mod === 'Ctrl') return 'Control';
        if (mod === 'Command' || mod === 'Win') return 'Meta';
        return mod;
      });
      
      currentKey = parts[parts.length - 1];
      
      // Update the display
      updateShortcutDisplay();
      
      // Enable save button if we have a valid shortcut
      saveBtn.disabled = !isValidShortcut();
    });
  }
});
