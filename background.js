import { functions as db } from './db.js';
db.initDB();

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "sendTextToGemini",
    title: "Send text to Gemini",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "sendHtmlToGemini",
    title: "Send element HTML to Gemini",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sendTextToGemini") {
    const selectedText = info.selectionText;
    showPromptSelection(selectedText, false);
  } else if (info.menuItemId === "sendHtmlToGemini") {
    chrome.tabs.sendMessage(tab.id, { action: "getClickedElementHtml" }, response => {
      if (response && response.html) {
        showPromptSelection(response.html, true);
      }
    });
  }
});

function showPromptSelection(text, isHtml) {
  chrome.windows.create({
    url: 'promptSelect.html',
    type: 'popup',
    width: 400,
    height: 300
  }, (window) => {
    chrome.tabs.sendMessage(window.tabs[0].id, {
      action: "initializePromptSelect",
      text: text,
      isHtml: isHtml
    });
  });
}

async function sendToGemini(data) {
  const apiKey = 'AIzaSyALhlsiTjwhTX9n_MmGcW0PRWx0X40Z4Vo';
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  const fullPrompt = `
  ============= Context
  ${data.context}
  
  ============= System Instructions
  ${data.system_prompt}

  ============= User prompt
  ${data.prompt}
  `;

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      })
    });

    const data = await response.json();
    const result = data.candidates[0].content.parts[0].text;
    const request_data = {
      ...data,
      result
    };
    await db.saveData('requests', request_data);

    return result;
  } catch (error) {
    console.error('Error:', error);
    return error.message;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.get_all) {
    const store = request.get_all;
    db.getAll(store).then(result => {
      sendResponse(result);
    });
    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.get) {
    const store = request.get;
    const id = request.id;
    db.getData(store, id).then(result => {
      sendResponse(result);
    });
    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.save) {
    const store = request.save;
    const data = request.data;
    db.saveData(store, data).then(result => {
      sendResponse(result);
    });
    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.delete) {
    const store = request.delete;
    const id = request.id;
    db.deleteData(store, id).then(result => {
      sendResponse(result);
    });
    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.action === "send_gemini") {
    sendToGemini(request.data).then(result => {
      sendResponse(result);
    });

    return true;
  }
});