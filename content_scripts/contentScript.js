const escapeHTMLPolicy = trustedTypes.createPolicy("forceInner", {
    createHTML: (to_escape) => to_escape
});

let selection_start;
let selection_end;
let context_element;
const current_page_url = new URL(location.href);

if (current_page_url.searchParams.get('parse_html_id')) {
    document.addEventListener('domStable', e => {
        console.log('DOM is now stable!!!');
        sendPageHTML(current_page_url.toString());
    });
}

const trustedScriptPolicy = trustedTypes.createPolicy("trustedScriptPolicy", {
    createScript: (scriptString) => scriptString
});

window.addEventListener('load', async e => {
    await initDomUltimext();
    getExtensionData().then(data => {
        for (const key in data) {
            const form_element = document.getElementById(key);
            if (!form_element) {
                continue;
            }
            form_element.value = data[key];
        }
    });

    document.getElementById('to_send_to_gemini').addEventListener('submit', async e => {
        e.preventDefault();
        const data = await getDataToSend();
        const response = await getLLMCompletion(data, 'google');
        processLLMResponse(response);
    });
});

async function getDataToSend() {
    // Get the form data from the form element
    const form_data = new FormData(document.getElementById('to_send_to_gemini'));

    // Handle HTML context type
    if (document.getElementById('context_textarea').getAttribute('data-context_type') === 'html') {
        // Append page URL and HTML to context
        form_data.set('context', `Page url: ${location.href} \n\n HTML: ${form_data.get('context')}`);

        // Get context elements
        const context_elements = document.getElementsByClassName('context_element');
        if (context_elements.length !== 1) {
            return form_data;
        }

        // Get images from context
        const imgs = [context_elements[0].closest('img')] || context_elements[0].getElementsByTagName('img');
        if (imgs.length !== 1) {
            return form_data;
        }

        const image = imgs[0];

        // Handle image from different sources (src, srcset, or data-src)
        if (image) {
            try {
                const imageFile = await handleImage(image);
                form_data.append('files', imageFile);
            } catch (e) {
                // Handle potential tainted canvas errors
                console.error('Error converting image:', e);
            }
        }
    }

    return form_data;
}


document.addEventListener('focusin', e => {
    if (e.target.closest('#ultimate_extension_div')) {
        e.stopImmediatePropagation();
        e.stopPropagation();
    }
});

document.addEventListener('mousedown', e => {
    if (e.target.closest('#ultimate_extension_div')) {
        e.stopImmediatePropagation();
        e.stopPropagation();
    }
});


function processLLMResponse(response) {
    const result_textarea = document.getElementById('ultimext_result');
    result_textarea.value = response;
    resizeTextarea(result_textarea);
    runResponseScript(response);
}

function runResponseScript(response) {
    const scriptRegex = /(?:<script>([\s\S]*?)<\/script>)|(?:```(?:java)*script\s*([\s\S]*?)```)/g;
    const matches = [...response.matchAll(scriptRegex)];

    if (!matches.length) {
        return;
    }

    matches.forEach(match => {
        let code = match[1] || match[2];

        code = `(async function() {
            ${code}
        })()`;

        const scriptElement = document.createElement('script');
        scriptElement.textContent = trustedScriptPolicy.createScript(code);
        document.body.appendChild(scriptElement);
    });
}


function runScript() {
    const result = document.getElementById('ultimext_result').value;

    runResponseScript(result);
}

async function getLLMCompletion(formData, provider = "openAI") {
    const provider_routes = {
        openAI: "send_to_openai",
        anthropic: "send_to_anthropic",
        google: "send_to_gemini",
    };

    if (!provider_routes[provider]) {
        throw new Error('Invalid provider specified');
    }

    try {
        // Make the request
        const response = await fetch(`${BACKEND_URL}/${provider_routes[provider]}`, {
            method: 'POST',
            // Don't set Content-Type header - browser will set it automatically with boundary
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
                errorData?.error || `HTTP error! status: ${response.status}`
            );
        }

        const result = await response.json();
        document.getElementById('save_fine_tuning_example').disabled = false;
        return result.result;

    } catch (error) {
        console.error('Error getting completion:', error);
        throw error;
    }
}


// Your main world script
function getExtensionData() {
    return new Promise((resolve, reject) => {
        window.postMessage({ type: 'GET_EXTENSION_DATA' }, '*');

        window.addEventListener('message', function listener(event) {
            // Only accept messages from the same frame
            if (event.source !== window) return;

            if (event.data.type && event.data.type === 'GET_EXTENSION_DATA_RESPONSE') {
                window.removeEventListener('message', listener);
                resolve(event.data.payload);
            }
        });

        // Add a timeout in case the response never comes
        setTimeout(() => reject(new Error('Timeout waiting for extension data')), 5000);
    });
}

document.addEventListener('keydown', async e => {
    if (!e.ctrlKey || e.key !== 's' || !e.target.closest('#system_prompt')) {
        return;
    }
    e.preventDefault();
    const textarea = document.getElementById('system_prompt');
    try {
        await saveInDB('system_prompts', {
            id: '1',
            text: textarea.value
        });
    } catch (error) {
        console.error('Error saving system prompt:', error);
    }
});

async function initDomUltimext() {
    const app_div = document.createElement('div');
    app_div.id = "ultimate_extension_div";
    app_div.style.display = "none";
    // Consider adding error handling for the fetch
    try {
        const resp = await fetch(`${BACKEND_URL}/render_main`);
        if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        const html = await resp.text();
        // Ensure escapeHTMLPolicy is defined and appropriate for your context
        // If not available (e.g., standard web page context), you might need a different sanitization method
        // or trust the source if applicable (use with caution).
        // For simplicity assuming escapeHTMLPolicy is available and works:
        app_div.innerHTML = (typeof escapeHTMLPolicy !== 'undefined')
            ? escapeHTMLPolicy.createHTML(html)
            : html; // Fallback - use only if HTML is trusted or sanitized elsewhere

    } catch (error) {
        console.error("Failed to fetch or render main extension UI:", error);
        // Optionally provide fallback UI or disable the button
        return; // Stop initialization if essential UI fails
    }


    const button = document.createElement('button');
    // Use the Line Awesome magic icon
    const iconHTML = '<i class="las la-magic"></i>';
    button.innerHTML = (typeof escapeHTMLPolicy !== 'undefined')
        ? escapeHTMLPolicy.createHTML(iconHTML)
        : iconHTML; // Fallback for icon HTML (generally safe)

    // Adjust styles for a smaller, discrete icon button
    button.style.cssText = `
        color: white;
        background-color: #027edd; /* Consider a less saturated color for more discretion? e.g., #3B82F6 or a grey */
        position: fixed;
        bottom: 1.5rem; /* Slightly lower or higher? Adjust as needed */
        right: 1.5rem;
        border: none;
        border-radius: 50%; /* Make it circular */
        font-size: 1.1rem; /* Smaller icon size */
        cursor: pointer;
        z-index: 99999; /* Ensure it's on top */
        width: 2.8rem;   /* Fixed width */
        height: 2.8rem;  /* Fixed height */
        padding: 0; /* Remove padding, use flex to center */
        display: inline-flex; /* Use flexbox for centering */
        align-items: center; /* Center icon vertically */
        justify-content: center; /* Center icon horizontally */
        box-shadow: 0 2px 5px rgba(0,0,0,0.2); /* Optional subtle shadow */
        transition: background-color 0.2s ease; /* Smooth hover effect */
    `;
    // Optional: Add a hover effect
    button.onmouseover = () => { button.style.backgroundColor = '#005ea6'; }; // Darken on hover
    button.onmouseout = () => { button.style.backgroundColor = '#027edd'; }; // Restore original color

    button.id = "toggle_ultimext";
    // Add an accessible label for screen readers
    button.setAttribute('aria-label', 'Toggle Agent Extension');
    button.setAttribute('title', 'Toggle Agent Extension'); // Tooltip for mouse users

    button.addEventListener('click', e => {
        const isHidden = app_div.style.display === 'none';
        app_div.style.display = isHidden ? 'block' : 'none';
         // Optional: Change icon or style based on state
        // button.innerHTML = escapeHTMLPolicy.createHTML(isHidden ? '<i class="las la-times"></i>' : '<i class="las la-magic"></i>');
        // button.setAttribute('aria-label', isHidden ? 'Close Agent Extension' : 'Open Agent Extension');
    });

    // Append elements only if initialization was successful
    document.body.appendChild(app_div);
    document.body.appendChild(button);

    // Add event listener only if the element exists in the fetched HTML
    const userInput = document.getElementById('user_prompt_123456');
    if (userInput) {
        userInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = e.target.closest('form');
                if (form) {
                    // Dispatching submit event might not trigger all form handlers,
                    // consider calling form.requestSubmit() if available, or finding the submit button and clicking it.
                    // form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    // Safer alternative:
                    const submitButton = form.querySelector('button[type="submit"]');
                     if (submitButton) {
                         submitButton.click();
                     } else {
                        // Fallback if no explicit submit button
                        form.requestSubmit ? form.requestSubmit() : form.submit();
                     }
                }
            }
        });
    } else {
        console.warn("Element with ID 'user_prompt_123456' not found in fetched HTML.");
    }
}

function downvote() {
    document.getElementById('hint_dialog').showModal();
}


async function submitHint() {
    const form_data = await getDataToSend();
    form_data.set('prompt', form_data.get('prompt') + `\nHint:\n\n${document.getElementById('hint_textarea').value}`);
    const response = await getLLMCompletion(form_data);
    processLLMResponse(response);
}


async function saveSettings() {
    const keys = ['ultimext_system_prompt', 'ultimext_api_key'];
    let data = keys.reduce((acc, key) => {
        acc[key] = document.getElementById(key)?.value;
        return acc;
    }, {});

    window.postMessage({ type: 'SET_EXTENSION_DATA', data }, '*');
}


function toggleSettings() {
    var settingsDiv = document.getElementById('ultimext_settings');
    if (settingsDiv.classList.contains('d-none')) {
        settingsDiv.classList.remove('d-none');
    } else {
        settingsDiv.classList.add('d-none');
    }
}


async function saveFineTuningExample(button) {
    if (button.disabled) {
        return;
    }
    const conf = confirm("Êtes-vous certain de vouloir enregistrer cet exemple? S'il est mauvais, il pourrira la base d'entraînement.");
    if (!conf) {
        return;
    }
    const form_data = await getDataToSend();
    form_data.append('result', document.getElementById('ultimext_result').value);
    const response = await fetch(`${BACKEND_URL}/save_fine_tuning_example`, {
        method: 'POST',
        body: form_data,
    });
    button.disabled = true;
    alert("Exemple enregistré, merci pour votre aide!!");
}

function toggleUltimext() {
    const app_div = document.getElementById("ultimate_extension_div");
    app_div.style.display = app_div.style.display === 'none' ? 'block' : 'none';
}

function hideUltimext() {
    const ultimext_div = document.getElementById("ultimate_extension_div");
    if (!ultimext_div) {
        return;
    }
    ultimext_div.style.display = "none";
}

function showUltimext() {
    document.getElementById("ultimate_extension_div").style.display = "block";
}

function resizeTextarea(element) {
    element.style.height = "35px";
    if (element.scrollHeight == 0) {
        return;
    }
    element.style.height = (element.scrollHeight + 10) + "px";
}


document.addEventListener('contextmenu', e => {
    const selection = document.getSelection();
    if (selection.anchorNode !== null && !selection.isCollapsed) {
        e.preventDefault();
    }
});

document.addEventListener('click', e => {
    if (!e.shiftKey || !e.target.closest('.context_element')) {
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    return false;
}, true);

document.addEventListener('mousedown', e => {
    selection_end = null;
    selection_start = null;
    context_element = null;
    for (const element of [...document.getElementsByClassName('context_element')]) {
        element.classList.remove('context_element');
    }
    if (e.target.closest('#ultimate_extension_div') || e.target.closest('#toggle_ultimext')) {
        return;
    }
    const selection = document.getSelection();
    if ((e.button !== 2 || selection.anchorNode === null || selection.isCollapsed) && !e.shiftKey) {
        hideUltimext();
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    selection_start = e.target;
    selection_end = null;
    document.addEventListener('mousemove', onMouseMoveWhenRightButtonDown);
});


document.addEventListener('mouseup', e => {
    document.removeEventListener('mousemove', onMouseMoveWhenRightButtonDown);

    if (e.target.closest('#ultimate_extension_div') || e.target.closest('#toggle_ultimext')) {
        return;
    }
    const selection = document.getSelection();
    if ((e.button !== 2 || selection.anchorNode === null || selection.isCollapsed) && !e.shiftKey) {
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    showUltimext();
    const context_textarea = document.getElementById('context_textarea');
    let context = '';
    let context_type = 'text';
    if (selection.anchorNode !== null && !selection.isCollapsed) {
        context = selection.toString();
    } else {
        context = html_beautify(cleanHTML((context_element ?? selection_start).outerHTML));
        context_type = 'html';
    }
    context_textarea.value = context;
    context_textarea.setAttribute('data-context_type', context_type);
    resizeTextarea(context_textarea);

    document.getElementById('user_prompt_123456').focus();
});

function getLowestCommonAncestor(element1, element2) {

    if (!element1 || !element2) {
        return null
    };

    const ancestors = new Set();

    while (element1) {
        ancestors.add(element1);
        if (element1 === document.body) break;
        element1 = element1.parentElement;
    }

    while (element2) {
        if (ancestors.has(element2)) return element2;
        if (element2 === document.body) break;
        element2 = element2.parentElement;
    }

    return null;
}


function onMouseMoveWhenRightButtonDown(e) {
    for (const element of [...document.getElementsByClassName('context_element')]) {
        element.classList.remove('context_element');
    }
    selection_end = e.target;

    context_element = getLowestCommonAncestor(selection_start, selection_end);
    if (!context_element) {
        return;
    }
    context_element.classList.add('context_element');
}

