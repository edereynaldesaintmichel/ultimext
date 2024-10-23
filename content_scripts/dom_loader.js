// Create a custom event type
const DOM_STABLE_EVENT = 'domStable';

// Track network requests
let pendingRequests = 0;
const originalFetch = window.fetch;
window.fetch = function (...args) {
    pendingRequests++;
    return originalFetch.apply(this, args)
        .finally(() => {
            pendingRequests--;
            checkStability();
        });
};

const originalXHR = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function () {
    pendingRequests++;
    this.addEventListener('loadend', () => {
        pendingRequests--;
        checkStability();
    });
    return originalXHR.apply(this, arguments);
};

// Monitor DOM mutations
let mutationCount = 0;
let lastMutationTime = Date.now();
let lastScrollHeight = 0;
let isStable = false;
let stabilityTimeout;
const initial_time = Date.now();

const observer = new MutationObserver((mutations) => {
    mutationCount += mutations.length;
    lastMutationTime = Date.now();
    lastScrollHeight = document.body.scrollHeight;

    clearTimeout(stabilityTimeout);

    // Check stability after a delay
    stabilityTimeout = setTimeout(checkStability, 500);
});

window.addEventListener('DOMContentLoaded', e => {
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });
});


// Check all stability conditions
function checkStability() {
    const conditions = [
        Date.now() - lastMutationTime > 1000,  // No recent mutations
        pendingRequests === 0,                 // No pending network requests
        document.body.scrollHeight === lastScrollHeight  // Stable height
    ];

    if ((Date.now() - initial_time > 5000 || conditions.every(Boolean)) && !isStable) {
        isStable = true;
        // Dispatch the custom event
        document.dispatchEvent(new CustomEvent(DOM_STABLE_EVENT, {
            detail: {
                mutationCount,
                finalHeight: lastScrollHeight,
                timestamp: Date.now()
            }
        }));
        clearTimeout(stabilityTimeout);
    }
}