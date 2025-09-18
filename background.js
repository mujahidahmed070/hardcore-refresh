chrome.commands.onCommand.addListener((command) => {
  if (command === "clear-storage") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
          },
        });
      }
    });
  }
});
