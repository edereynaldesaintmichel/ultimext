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