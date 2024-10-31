// bridge.js
// This script runs in the isolated world and can access chrome APIs
window.addEventListener('message', async (event) => {
    if (!event.data?.type || event.data.type.endsWith('_RESPONSE')) {
        return;
    }
    chrome.runtime.sendMessage(event.data, (response) => {
        console.log(event);
        window.postMessage({
            type: event.data.type + '_RESPONSE',
            payload: response
        }, '*');
    });
});