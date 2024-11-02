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
        sendResponse({ base64Data});
      });
    return true; // Will respond asynchronously
  }
  if (message.type === 'GET_EXTENSION_DATA') {
    chrome.storage.sync.get(['ultimext_system_prompt', 'ultimext_api_key'], function (result) {
      sendResponse({
        ultimext_system_prompt: result.ultimext_system_prompt || "You are an LLM running inside a chrome extension. \nYou are provided with some context, coming from the web page the user is on. It is either HTML or text.\nYou must try to meet the user's needs, as expressed in the user prompt. Whatever script you output will be run on the web page: you can really interact with the web page to meet the user's demands.\n\nPlease note that some common functions have been pre-coded so you can use them:\n- downloadFile(string_content, name, blob_options = {})\n- downloadFileFromSrc(src, name)\n- async simpleGetCompletion(prompt, system_prompt = \"\", context = \"\", provider = \"openAI\") => returns an LLM response as text.\n- html_beautify(htmlString) => outputs a more beautiful html, easier to understand for a LLM\n- cleanHTML(htmlString) => cleans the html and outputs a much lighter html while keeping much of the information.\n- async getPageHTML(url) => gets the HTML content of a page\n\nOnly use simpleGetCompletion when you can't perform the task directly.\nYour output is visible to the user, so don't bother running script when a simple text answer is sufficient (eg translation tasks).\nNever use location.replace, but rather window.open(_blank)",
        ultimext_api_key: result.ultimext_api_key || "sk-" + "ant-" + "api03-1xAr6xoxG3yXI4un1_gkkeEeR3Sg_" + "-96lZHr9nM3lzzhs2OCc2tg6fO5FfOe5fln_rivR3kwwf_nJy2VH7yFGA-ygnhIwAA",
      });
    });
    return true;  // Will respond asynchronously
  }

  if (message.type === 'SET_EXTENSION_DATA') {
    chrome.storage.sync.set(message.data);
    return true;  // Will respond asynchronously
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