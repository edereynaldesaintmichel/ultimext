chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{
          header: 'content-security-policy',
          operation: 'remove',
        }],
      },
      condition: {
        urlFilter: '*',
        resourceTypes: ["main_frame", "sub_frame"]
      },
    }],
  });
});


// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROCESS_IMAGE') {
      fetchAndProcessImage(message.payload.src)
          .then(base64Data => {
              sendResponse({ base64Data });
          });
      return true; // Will respond asynchronously
  }
});

async function fetchAndProcessImage(url) {
  try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
      });
  } catch (error) {
      console.error('Error processing image:', error);
      return null;
  }
}