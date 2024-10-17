// Replace with your actual backend URL
const BACKEND_URL = 'http://localhost:5000';

async function saveInDB(store, data) {
    try {
        const response = await fetch(`${BACKEND_URL}/db/${store}`, {
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
        console.error('Error saving data:', error);
        throw error;
    }
}

async function deleteFromDB(store, id) {
    try {
        const response = await fetch(`${BACKEND_URL}/db/${store}?id=${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return true;
    } catch (error) {
        console.error('Error deleting data:', error);
        throw error;
    }
}

async function getFromDB(store, id) {
    try {
        const response = await fetch(`${BACKEND_URL}/db/${store}?id=${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error getting data:', error);
        throw error;
    }
}

async function getAllFromStore(store) {
    try {
        const response = await fetch(`${BACKEND_URL}/db/${store}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error getting all data from store:', error);
        throw error;
    }
}

async function sendToGemini(data) {
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
        console.error('Error sending to Gemini:', error);
        throw error;
    }
}

async function getEmbedding(text) {
    try {
        const response = await fetch(`${BACKEND_URL}/get_embedding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error getting embedding:', error);
        throw error;
    }
}