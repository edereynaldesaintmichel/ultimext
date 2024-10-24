// Replace with your actual backend URL
const BACKEND_URL = 'https://localhost:5000';


async function getAndJSON2(url) {
    try {
        const resp = await fetch(url, {
            // mode: 'no-cors'
        });
        const response = await resp.json();
        return response;
    } catch {
        return {
            success: false,
        }
    }
    
}

async function postAndJSON2(url, data) {
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // mode: 'no-cors',
        body: JSON.stringify(data),
    });

    const response = await resp.json();

    return response;
}

async function saveInDB(store, data) {
    data.action = 'save';
    return await postAndJSON2(`${BACKEND_URL}/db/${store}`, data);
}

async function deleteFromDB(store, id) {
    data.action = 'delete';
    return await postAndJSON2(`${BACKEND_URL}/db/${store}`, {id});
}

async function getFromDB(store, id) {
    return await getAndJSON2(`${BACKEND_URL}/db/${store}?id=${id}`);
}

async function getAllFromStore(store) {
    return await getAndJSON2(`${BACKEND_URL}/db/${store}`);
}

async function sendToGemini(data) {
    return await postAndJSON2(`${BACKEND_URL}/send_to_gemini`, data);
}

async function getEmbedding(text) {
    return await postAndJSON2(`${BACKEND_URL}/get_embedding`, text);
}