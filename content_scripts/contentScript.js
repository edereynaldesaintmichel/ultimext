const escapeHTMLPolicy = trustedTypes.createPolicy("forceInner", {
    createHTML: (to_escape) => to_escape
});

let selection_start;
let selection_end;
let context_element;
const current_page_url = new URL(location.href);

const trustedScriptPolicy = trustedTypes.createPolicy("trustedScriptPolicy", {
    createScript: (scriptString) => scriptString
});

window.addEventListener('load', e => {
    initDomUltimext();
    getSystemPrompt();

    document.getElementById('to_send_to_gemini').addEventListener('submit', async e => {
        e.preventDefault();
        const data = getDataToSend();
        const response = await getLLMCompletion(data);
        processLLMResponse(response);
    });
    if (current_page_url.searchParams.get('parse_html_id')) {
        document.addEventListener('domStable', e => {
            console.log('DOM is now stable!!!');
            sendPageHTML(current_page_url.toString());
        });
    }
});

function getDataToSend() {
    const form_data = new FormData(document.getElementById('to_send_to_gemini'));

    const data = [...form_data.entries()].reduce((acc, curr) => {
        acc[curr[0]] = curr[1];
        return acc;
    }, {});
    if (document.getElementById('context_textarea').getAttribute('data-context_type') === 'html') {
        data.context = `Page url: ${location.href} \n\n HTML: ${data.context}`;
    }

    return data;
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
    // runResponseScript(response);
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

async function getLLMCompletion(data, provider = "openAI") {
    const provider_routes = {
        openAI: "send_to_openai",
        gemini: "send_to_gemini",
    };
    if (!provider_routes[provider]) {
        return {
            result: "alert('bad provider')"
        };
    }
    try {
        const response = await fetch(`${BACKEND_URL}/${provider_routes[provider]}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json()).result;
    } catch (error) {
        console.error('Error getting completion:', error);
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
    app_div.innerHTML = escapeHTMLPolicy.createHTML(`<h2 style="color: black !important;">Gemini Text and HTML Processor</h2>
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
    
        <button id="send_gemini" class="ultimext_button" type="submit">Send
            Gemini</button>
    </form>
    <h4 style="color: black !important; margin-top: 2rem;">Résultat</h4>
    <textarea class="ultimext_textarea" id="ultimext_result">
    
    </textarea>
    <button id="run_script" class="ultimext_button" onclick="runScript()">Run script</button>
    <button id="downvote_button" class="ultimext_button danger" onclick="downvote()">Downvote</button>
    <button id="save_fine_tuning_example" class="ultimext_button success" onclick="saveFineTuningExample()">Save training example</button>

    <dialog id="hint_dialog" style="height: 50vh;width: 30vw;">
        <div id="hint_container" style="margin-bottom: 15px;">
            <label class="ultimext_label" for="hint_textarea">Hint:</label>
            <textarea class="ultimext_textarea" id="hint_textarea" name="hint" oninput="resizeTextarea(this)"></textarea>
        </div>
        <button id="submit_hint" class="ultimext_button" onclick="submitHint()">Submit Hint</button>
    </dialog>
    `);

    const button = document.createElement('button');
    button.innerHTML = escapeHTMLPolicy.createHTML('UltimExt');
    button.style.cssText = "color: white;background-color: #027edd;padding: 1rem;position: fixed;bottom: 5rem;right: 1rem;border: none;border-radius: 1rem;font-size: 1.5rem;font-weight: bold;cursor: pointer; z-index:99999;";
    button.id = "toggle_ultimext";
    button.addEventListener('click', e => {
        app_div.style.display = app_div.style.display === 'none' ? 'block' : 'none';
    });
    document.body.appendChild(app_div);
    document.body.appendChild(button);

    document.getElementById('user_prompt_123456').addEventListener('keydown', e => {
        if (e.key !== 'Enter') {
            return;
        }
        e.preventDefault();
        e.target.closest('form').dispatchEvent(new Event('submit'));
    });
}

function downvote() {
    document.getElementById('hint_dialog').showModal();
}


async function submitHint() {
    const data = getDataToSend();
    data.prompt = data.prompt + `\nHint:\n\n${document.getElementById('hint_textarea').value}`;
    const response = await getLLMCompletion(data);
    processLLMResponse(response);
}


async function saveFineTuningExample() {
    const data = getDataToSend();
    data.result = document.getElementById('ultimext_result').value;
    await postAndJSON2(`${BACKEND_URL}/save_fine_tuning_example`, data);
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
    selection_end = null;
    selection_start = null;
    context_element = null;
    for (const element of [...document.getElementsByClassName('context_element')]) {
        element.classList.remove('context_element');
    }
    if (e.target.closest('#ultimate_extension_div') || e.target.closest('#toggle_ultimext')) {
        return;
    }
    if (e.button !== 2) {
        hideUltimext();
        return;
    }
    e.preventDefault();
    selection_start = e.target;
    selection_end = null;
    document.addEventListener('mousemove', onMouseMoveWhenRightButtonDown);
});


document.addEventListener('mouseup', e => {
    document.removeEventListener('mousemove', onMouseMoveWhenRightButtonDown);

    if (e.target.closest('#ultimate_extension_div') || e.target.closest('#toggle_ultimext')) {
        return;
    }
    if (e.button !== 2) {
        return;
    }
    showUltimext();
    const selection = document.getSelection();
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
    if (!element1 || !element2) return null;

    const ancestors = new Set();

    while (element1) {
        ancestors.add(element1);
        if (element1 === document.documentElement) break;
        element1 = element1.parentElement;
    }

    while (element2) {
        if (ancestors.has(element2)) return element2;
        if (element2 === document.documentElement) break;
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
    context_element.classList.add('context_element');
}

