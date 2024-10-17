window.addEventListener('load', e => {
    initDomUltimext();
    getSystemPrompt();

    document.getElementById('to_send_to_gemini').addEventListener('submit', async e => {
        e.preventDefault();
        const form_data = new FormData(e.target);

        const data = [...form_data.entries()].reduce((acc, curr) => {
            acc[curr[0]] = curr[1];
            return acc;
        }, {});
        const scriptElement = document.createElement('script');
        scriptElement.innerHTML = 'console.log("prout");';
        document.body.appendChild(scriptElement);
        const response = await sendDataToGemini(data);
        processGeminiResponse(response.result);
    });
});


function processGeminiResponse(response) {
    document.getElementById('ultimext_result').innerText = response;

    const scripts = response.match(/<script>([\s\S]*?)<\/script>/g);
    if (!scripts) {
        return;
    }
    scripts.forEach(script => {
        const code = script.replace(/<script>|<\/script>/g, '');
        const scriptElement = document.createElement('script');
        scriptElement.innerHTML = code;
        document.body.appendChild(scriptElement);
    });
}

async function simpleSendGemini(prompt, system_prompt = "", context = "") {
    return sendDataToGemini({
        system_prompt,
        prompt,
        context,
    });
}

async function sendDataToGemini(data) {
    try {
        const response = await fetch(`${BACKEND_URL}/send_to_gemini`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error sending data to Gemini:', error);
        throw error;
    }
}


async function getSystemPrompt() {
    try {
        const system_prompts = await getAllFromStore('system_prompts');
        if (system_prompts.length == 0) {
            return;
        }
        document.getElementById('system_prompt').value = system_prompts[0].text;
    } catch (error) {
        console.error('Error getting system prompt:', error);
    }
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

function initDomUltimext() {
    const app_div = document.createElement('div');
    app_div.id = "ultimate_extension_div";
    app_div.style.display = "none";
    app_div.innerHTML = `<h2 style="color: black !important;">Gemini Text and HTML Processor</h2>
    <form action="" id="to_send_to_gemini">
        <div style="margin-bottom: 15px;">
            <label class="ultimext_label" for="system_prompt">System Prompt:</label>
            <textarea class="ultimext_textarea" id="system_prompt" name="system_prompt" oninput="resizeTextarea(this)"></textarea>
        </div>
    
        <div style="margin-bottom: 15px;">
            <label class="ultimext_label" for="context_textarea">Context:</label>
            <textarea class="ultimext_textarea" id="context_textarea" name="context" oninput="resizeTextarea(this)"></textarea>
        </div>
    
        <div style="margin-bottom: 15px;">
            <label class="ultimext_label" for="user_prompt_123456">Prompt:</label>
            <input class="ultimext_textarea" id="user_prompt_123456" name="prompt"/>
        </div>
    
        <button id="send_gemini" type="submit">Send
            Gemini</button>
    </form>
    <div style="color: black !important;" id="ultimext_result">
    
    </div>
    <h3 style="color: black !important;">Recent Requests</h3>
    <div style="color: black !important;" id="recent_requests">
        <table style="color: black !important;" id="recent_requests">
    
        </table>
    </div>`;

    const button = document.createElement('button');
    button.innerHTML = 'UltimExt';
    button.style.cssText = "color: white;background-color: #027edd;padding: 1rem;position: fixed;bottom: 5rem;right: 1rem;border: none;border-radius: 1rem;font-size: 1.5rem;font-weight: bold;cursor: pointer; z-index:99999;";
    button.id = "toggle_ultimext";
    button.addEventListener('click', e => {
        app_div.style.display = app_div.style.display === 'none' ? 'block' : 'none';
    });
    document.body.appendChild(app_div);
    document.body.appendChild(button);
}

function toggleUltimext() {
    const app_div = document.getElementById("ultimate_extension_div");
    app_div.style.display = app_div.style.display === 'none' ? 'block' : 'none';
}

function hideUltimext() {
    document.getElementById("ultimate_extension_div").style.display = "none";
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
    e.preventDefault();
});

document.addEventListener('mousedown', e => {
    if (e.target.closest('#ultimate_extension_div') || e.target.closest('#toggle_ultimext')) {
        return;
    }
    if (e.button !== 2) {
        hideUltimext();
        return;
    }
    e.preventDefault();
    showUltimext();
    const selection = document.getSelection();
    const context_textarea = document.getElementById('context_textarea');
    let context = '';
    if (selection.anchorNode !== null && !selection.isCollapsed) {
        context = selection.toString();
    } else {
        context = e.target.outerHTML;
    }
    context_textarea.value = context;
    resizeTextarea(context_textarea);

    document.getElementById('user_prompt_123456').focus();
});


function findSmallestEnclosingDiv(selection) {
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    let currentNode = range.commonAncestorContainer;

    if (currentNode.nodeType === Node.TEXT_NODE) {
        currentNode = currentNode.parentNode;
    }
    while (currentNode && currentNode !== document.body) {
        if (nodeContainsSelection(currentNode, range)) {
            return currentNode;
        }
        currentNode = currentNode.parentNode;
    }

    return null;
}

function nodeContainsSelection(node, range) {
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);

    return (
        nodeRange.compareBoundaryPoints(Range.START_TO_START, range) <= 0 &&
        nodeRange.compareBoundaryPoints(Range.END_TO_END, range) >= 0
    );
}


function cleanHTML(html_string) {
    const tags_to_remove = ['script', 'style', 'link', 'meta', 'noscript', 'iframe', 'svg', 'canvas', 'code'];
    const attributes_to_keep = new Set(['id', 'src', 'href', 'class']);
    const query_selectors_to_remove = ["#ultimate_extension_div", '#toggle_ultimext'];

    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html_string, 'text/html');

    tags_to_remove.forEach(tag => {
        for (const element of [...doc.getElementsByTagName(tag)]) {
            element.remove();
        }
    });

    for (const qs of query_selectors_to_remove) {
        for (const element of [...doc.querySelectorAll(qs)]) {
            element.remove();
        }
    }

    // Function to clean attributes
    function cleanAttributes(element) {
        const attrs = [...element.attributes];
        for (const attribute of attrs) {
            if (!attributes_to_keep.has(attribute.name) || attribute.value.length > 50) {
                element.removeAttribute(attribute.name);
            }
        }
    }

    // Function to simplify DOM
    function simplifyDOM(element) {
        if (element.children.length === 1) {
            const child = element.firstElementChild;
            if (element !== doc.body) {
                element.parentNode.replaceChild(child, element);
            }
            simplifyDOM(child);
        } else {
            for (let i = element.children.length - 1; i >= 0; i--) {
                simplifyDOM(element.children[i]);
            }
        }
        cleanAttributes(element);
    }

    // Start simplifying from the body
    simplifyDOM(doc.body);

    // Return the cleaned HTML
    return doc.body.innerHTML;
}