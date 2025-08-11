// server.js

// 1. Import necessary libraries
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const compression = require('compression');

// 2. Create the Express app and configure middleware
const app = express();
app.use(cors()); // Enable Cross-Origin Resource Sharing to allow your frontend to call this API
app.use(compression()); // Gzip/deflate responses to reduce payload size

// This is the port your backend server will run on.
const PORT = 3000;

// --- Simple in-memory cache to avoid repeated remote calls ---
const cache = new Map(); // key: scholarNo, value: { data, ts }
const RESULT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function getFromCache(scholarNo) {
    const entry = cache.get(String(scholarNo));
    if (!entry) return null;
    const isFresh = Date.now() - entry.ts < RESULT_TTL_MS;
    return isFresh ? entry.data : null;
}

function setInCache(scholarNo, data) {
    cache.set(String(scholarNo), { data, ts: Date.now() });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(operation, { retries = 2, backoffMs = 400 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;
            if (attempt === retries) break;
            await sleep(backoffMs * Math.pow(2, attempt));
        }
    }
    throw lastError;
}

// --- This is the scraping logic from our previous discussion ---
/**
 * Scrapes the results for a single scholar number by calling the website's internal APIs.
 * @param {string} scholarNumber - The scholar number to look up.
 * @param {string} baseUrl - The base URL of the college website.
 * @returns {Promise<object|null>} The result data or null if an error occurs.
 */
async function scrapeResultsApi(scholarNumber, baseUrl) {
    // Create a keep-alive https agent and a tuned axios client with timeout
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        maxSockets: 50,
    });
    const client = axios.create({
        baseURL: baseUrl,
        httpsAgent,
        timeout: 10000, // 10s per request
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        },
        // validateStatus keeps default (200-299)
    });
    
    try {
        // API CALL 1: Get the FormId from the scholar number
        console.log(`[Backend] Requesting FormId for ${scholarNumber}...`);
        const response1 = await withRetry(() =>
            client.get('/api/StudentActivity/GetStudentData', { params: { scholarno: scholarNumber } })
        );
        
        if (response1.status !== 200 || !response1.data || response1.data.length === 0) {
            console.log(`[Backend] Could not find FormId for ${scholarNumber}.`);
            return null;
        }
            
        const formId = response1.data[0].FormId;
        console.log(`[Backend] Successfully found FormId: ${formId}`);

        // API CALL 2: Get the final results using the FormId
        console.log(`[Backend] Requesting results for FormId ${formId}...`);
        const response2 = await withRetry(() =>
            client.get('/api/StudentActivity/GetStudentResult', { params: { FormId: formId } })
        );

        if (response2.status !== 200) {
            console.log(`[Backend] Error in API call 2. Status: ${response2.status}`);
            return null;
        }
        
        return response2.data;

    } catch (error) {
        console.error(`[Backend] An error occurred for ${scholarNumber}: ${error.message}`);
        return null;
    }
}


// 3. Define the API Endpoint
app.get('/api/getResult', async (req, res) => {
    // Get the scholar number from the query parameters (e.g., ?scholarNo=211113004)
    const { scholarNo, forceRefresh } = req.query;

    if (!scholarNo) {
        return res.status(400).json({ error: 'Scholar number is required' });
    }

    // IMPORTANT: Replace this with the base URL of your college's website.
    const collegeBaseUrl = "https://academic.manit.ac.in"; 

    // Check cache unless forceRefresh is truthy
    if (!forceRefresh) {
        const cached = getFromCache(scholarNo);
        if (cached) {
            res.set('Cache-Control', `public, max-age=${RESULT_TTL_MS / 1000}`);
            return res.status(200).json(cached);
        }
    }

    // Call our scraping function
    const resultData = await scrapeResultsApi(scholarNo, collegeBaseUrl);

    if (resultData) {
        // Cache and return
        setInCache(scholarNo, resultData);
        res.set('Cache-Control', `public, max-age=${RESULT_TTL_MS / 1000}`);
        res.status(200).json(resultData);
    } else {
        // If no data is found or an error occurred, send a 404 Not Found response.
        res.status(404).json({ error: `No results found for scholar number ${scholarNo}` });
    }
});


// 4. Start the server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`To test, open your browser to: http://localhost:${PORT}/api/getResult`);
});
