// bridge.js
// This script runs in the isolated world and can access chrome APIs
window.addEventListener('message', async (event) => {
    if (event.data.type === 'PROCESS_IMAGE') {
        // Forward to background script
        chrome.runtime.sendMessage({
            type: 'PROCESS_IMAGE',
            payload: event.data.payload
        }, (response) => {
            // Forward response back to main world
            window.postMessage({
                type: 'IMAGE_PROCESSED',
                payload: response
            }, '*');
        });
    }
});