/**
 * Instagram Post Discovery Service
 *
 * Supports three discovery strategies:
 *   A) Manual   — curated list of known post URLs
 *   B) Hashtag  — scrape Instagram web hashtag pages
 *   C) Explore  — scrape Instagram's web explore page
 *
 * Returns an array of verified post URLs ready to enqueue.
 *
 * BACKLOG: Rate limiting — max actions per device per hour.
 */

import * as https from 'https';
import * as http from 'http';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredPost {
    url: string;
    shortcode: string;
    source: 'manual' | 'hashtag' | 'explore';
    hashtag?: string;
}

export interface DiscoveryOptions {
    /** Strategy A: direct post URL list */
    manualUrls?: string[];

    /** Strategy B: hashtags to scrape (e.g. ['ai', 'startup', 'india']) */
    hashtags?: string[];

    /** Strategy C: enable explore page scraping */
    useExplore?: boolean;

    /** Max posts to return across all sources */
    maxPosts?: number;

    /** Verify each URL is accessible before returning (HEAD request) */
    verify?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractShortcodes(html: string): string[] {
    const codes = new Set<string>();

    // Pattern 1: /p/{shortcode}/ in href attributes
    const postRegex = /\/p\/([A-Za-z0-9_\-]{8,12})\//g;
    let match;
    while ((match = postRegex.exec(html)) !== null) {
        if (match[1]) codes.add(match[1]);
    }

    // Pattern 2: shortcode_media in JSON
    const jsonRegex = /"shortcode"\s*:\s*"([A-Za-z0-9_\-]{8,12})"/g;
    while ((match = jsonRegex.exec(html)) !== null) {
        if (match[1]) codes.add(match[1]);
    }

    return Array.from(codes);
}

async function fetchPage(url: string, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeoutMs);
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-IN,en;q=0.9',
                'Cache-Control': 'no-cache',
            }
        }, (res) => {
            clearTimeout(timer);
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(body));
            res.on('error', reject);
        });

        req.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function verifyUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 8000);
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, { method: 'HEAD', headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        }}, (res) => {
            clearTimeout(timer);
            resolve(res.statusCode !== 404);
        });

        req.on('error', () => { clearTimeout(timer); resolve(false); });
        req.end();
    });
}

// ─── Discovery Strategies ─────────────────────────────────────────────────────

/**
 * Strategy A: Return manual curated URLs directly.
 */
function discoverManual(urls: string[]): DiscoveredPost[] {
    return urls
        .filter(url => url.includes('/p/') || url.includes('/reel/'))
        .map(url => {
            const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_\-]+)/);
            const shortcode = match?.[1] ?? url.split('/').filter(Boolean).pop() ?? '';
            return {
                url: url.endsWith('/') ? url : `${url}/`,
                shortcode,
                source: 'manual' as const,
            };
        });
}

/**
 * Strategy B: Scrape Instagram's web hashtag page for post shortcodes.
 * Uses the public web interface — no auth required.
 */
async function discoverByHashtag(hashtag: string, maxPerTag = 10): Promise<DiscoveredPost[]> {
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;
    console.log(`[Discovery] Scraping hashtag #${hashtag}...`);

    try {
        const html = await fetchPage(url);
        const shortcodes = extractShortcodes(html).slice(0, maxPerTag);
        console.log(`[Discovery] Found ${shortcodes.length} posts for #${hashtag}`);

        return shortcodes.map(code => ({
            url: `https://www.instagram.com/p/${code}/`,
            shortcode: code,
            source: 'hashtag' as const,
            hashtag,
        }));
    } catch (err: any) {
        console.warn(`[Discovery] Failed to scrape #${hashtag}: ${err.message}`);
        return [];
    }
}

/**
 * Strategy C: Scrape Instagram's web explore page for trending posts.
 */
async function discoverFromExplore(maxPosts = 20): Promise<DiscoveredPost[]> {
    const url = 'https://www.instagram.com/explore/';
    console.log(`[Discovery] Scraping Instagram Explore page...`);

    try {
        const html = await fetchPage(url);
        const shortcodes = extractShortcodes(html).slice(0, maxPosts);
        console.log(`[Discovery] Found ${shortcodes.length} posts from Explore`);

        return shortcodes.map(code => ({
            url: `https://www.instagram.com/p/${code}/`,
            shortcode: code,
            source: 'explore' as const,
        }));
    } catch (err: any) {
        console.warn(`[Discovery] Failed to scrape Explore: ${err.message}`);
        return [];
    }
}

// ─── Main Discovery Function ──────────────────────────────────────────────────

/**
 * Discovers Instagram posts across all enabled strategies.
 *
 * Priority order: manual > hashtag > explore
 * Deduplicates by shortcode.
 */
export async function discoverInstagramPosts(options: DiscoveryOptions): Promise<DiscoveredPost[]> {
    const {
        manualUrls = [],
        hashtags = [],
        useExplore = false,
        maxPosts = 30,
        verify = true,
    } = options;

    const allPosts: DiscoveredPost[] = [];
    const seenCodes = new Set<string>();

    const addPost = (post: DiscoveredPost) => {
        if (!seenCodes.has(post.shortcode)) {
            seenCodes.add(post.shortcode);
            allPosts.push(post);
        }
    };

    // Strategy A: Manual
    if (manualUrls.length > 0) {
        console.log(`[Discovery] Strategy A: ${manualUrls.length} manual URLs`);
        discoverManual(manualUrls).forEach(addPost);
    }

    // Strategy B: Hashtag scraping
    if (hashtags.length > 0) {
        for (const tag of hashtags) {
            const posts = await discoverByHashtag(tag, Math.ceil(maxPosts / hashtags.length));
            posts.forEach(addPost);
            // Small delay between hashtag requests to avoid rate limiting
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
        }
    }

    // Strategy C: Explore page
    if (useExplore) {
        const posts = await discoverFromExplore(maxPosts);
        posts.forEach(addPost);
    }

    let result = allPosts.slice(0, maxPosts);

    // URL verification (HEAD request per post)
    if (verify && result.length > 0) {
        console.log(`[Discovery] Verifying ${result.length} discovered URLs...`);
        const verified: DiscoveredPost[] = [];

        for (const post of result) {
            const ok = await verifyUrl(post.url);
            if (ok) {
                verified.push(post);
                console.log(`  ✅ ${post.url}`);
            } else {
                console.log(`  ❌ ${post.url} — skipped (404 or unreachable)`);
            }
        }

        console.log(`[Discovery] ${verified.length}/${result.length} posts verified.`);
        return verified;
    }

    return result;
}

// ─── Preset Topic Collections ─────────────────────────────────────────────────

/**
 * Predefined hashtag sets by topic domain.
 * Mirror of LinkedIn's /top-content/ domains — adapted for Instagram.
 *
 * BACKLOG: Add auto-refresh from trending topics.
 */
export const TOPIC_HASHTAGS: Record<string, string[]> = {
    ai:           ['artificialintelligence', 'machinelearning', 'aitools', 'genai', 'chatgpt'],
    startup:      ['startup', 'entrepreneurship', 'startupindia', 'founder', 'venturecapital'],
    technology:   ['technology', 'tech', 'innovation', 'techstartup', 'softwaredevelopment'],
    finance:      ['finance', 'fintech', 'investing', 'stockmarket', 'personalfinance'],
    engineering:  ['softwareengineering', 'coding', 'developer', 'programming', 'devlife'],
    healthcare:   ['healthcare', 'medtech', 'digitalhealth', 'medicalinnovation'],
    writing:      ['writing', 'contentcreator', 'copywriting', 'storytelling'],
    communication:['publicspeaking', 'communication', 'leadership', 'networking'],
    india:        ['india', 'makeinindia', 'indiabusiness', 'indianstartup', 'bharat'],
};
