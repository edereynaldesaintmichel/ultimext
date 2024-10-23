function downloadFile(content, name, blob_options = {}) {
    let file = window.URL.createObjectURL(new Blob([content], blob_options));
    let a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = file;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(file);
    document.body.removeChild(a);
}

function downloadFileFromSrc(src, name) {
    let a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";

    fetch(src)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = name;
            a.click();
            window.URL.revokeObjectURL(url);
        });
}


async function simpleGetCompletion(prompt, system_prompt = "", context = "", provider = "openAI") {
    return getLLMCompletion({
        system_prompt,
        prompt,
        context
    }, provider);
}


function handleShittyUrls(href) {
    try {
        const parsed_url = new URL(href);
        if (parsed_url.origin) { // It's a real src or href
            const base = parsed_url.origin.replace(url.origin, '') + parsed_url.pathname;
            if (base.length > 50) {
                return null;
            }
            const search_param_keys = [...parsed_url.searchParams.keys()].reverse();
            for (let i = 0; i < search_param_keys.length; i++) {
                if (base.length + parsed_url.search.length <= 50) {
                    break;
                }
                parsed_url.searchParams.delete(search_param_keys[i]);
            }
            return base + parsed_url.search;
        }
        return "";
    } catch {
        return href;
    }  
}


function optimizeClassNames() {
    
}

function cleanHTML(html_string) {
    const tags_to_remove = ['script', 'style', 'link', 'meta', 'noscript', 'iframe', 'svg', 'canvas', 'code', 'noscript', 'i'];
    const max_length_attributes_to_keep = { id: 50, class: 50, title: 250, name: 50, value: 50 };
    const query_selectors_to_remove = ["#ultimate_extension_div", '#toggle_ultimext'];
    const to_remove_if_empty = ['div', 'span', 'a'];
    const attributes_functions = {
        src: handleShittyUrls,
        href: handleShittyUrls,
    }

    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(escapeHTMLPolicy.createHTML(html_string), 'text/html');

    // Remove comments
    const commentIterator = doc.createNodeIterator(
        doc.documentElement,
        NodeFilter.SHOW_COMMENT,
        null,
        false
    );
    let comment;
    while (comment = commentIterator.nextNode()) {
        comment.remove();
    }

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
    function cleanAttributes(node) {
        const attrs = node.attributes;
        if (!attrs) { // The node is not an element
            return;
        }
        const attrs_array = [...attrs];
        for (const attribute of attrs_array) {
            if (attributes_functions[attribute.name]) {
                const new_value = attributes_functions[attribute.name](node[attribute.name]);
                if (new_value) {
                    node[attribute.name] = new_value;
                }
                node.removeAttribute(attribute.name);
                continue;
            }
            if (!max_length_attributes_to_keep[attribute.name] || attribute.value.length > max_length_attributes_to_keep[attribute.name]) {
                node.removeAttribute(attribute.name);
            }
        }
    }

    const tags_to_keep = new Set(['table', 'tr', 'th', 'td', 'thead', 'a', 'button']);
    function onlyChildPolicy(node) {
        cleanAttributes(node);
        const filtered_out_nodes = [...node.childNodes].filter(x => x.data?.trim() === "");

        for (const child_node of filtered_out_nodes) {
            node.removeChild(child_node);
        }

        if (node.childNodes.length === 1) {
            let child_node = node.childNodes[0];
            if (tags_to_keep.has(node.tagName.toLowerCase())) {
                node.replaceChild(onlyChildPolicy(child_node), child_node);
                return node;
            }
            return onlyChildPolicy(child_node);
        }
    
        for (let child_node of node.childNodes) {
            new_child = onlyChildPolicy(child_node);
            node.replaceChild(new_child, child_node);
        }

        return node;
    }

    // Start simplifying from the body
    onlyChildPolicy(doc.body);

    const sorted_elements = [...doc.body.querySelectorAll(to_remove_if_empty.join(','))].sort((x, y) => x.innerHTML.trim().length - y.innerHTML.trim() ? 1 : -1);

    for (const element of sorted_elements) {
        if (element.innerHTML.trim().length === 0) {
            element.remove();
        }
    }

    // Return the cleaned HTML
    return normalizeWhitespace(doc.body.innerHTML);
}


function normalizeWhitespace(str) {
    let oldStr;
    do {
        oldStr = str;
        // Replace 2+ line breaks with single line break
        str = str.replace(/\n\s*\n/g, '\n');
        // Replace 2+ spaces with single space
        str = str.replace(/[ \t]+/g, ' ');
    } while (oldStr !== str);
    
    return str;
}


async function getPageHTML(address) { // returns a webpage html
    const url = new URL(address);
    const uniq = Math.random().toString().slice(2, 10);
    url.searchParams.append('parse_html_id', uniq);
    open(url, '_blank');

    const result = await getAndJSON2(`${BACKEND_URL}/get_html?parse_html_id=${uniq}`);

    return result.html;
}

async function sendPageHTML(address) { // Here, the address will most of the time be equal to location.href
    const html = html_beautify(cleanHTML(document.body.outerHTML));
    const parse_html_id = (new URL(address)).searchParams.get('parse_html_id');
    await postAndJSON2(`${BACKEND_URL}/submit_html`, {
        parse_html_id,
        html
    });

    close();
}