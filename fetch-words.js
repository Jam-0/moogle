// fetch-words.js
const fs = require('fs').promises;
const fetch = require('node-fetch');

class BlueskyWordFetcher {
    constructor() {
        this.handle = process.env.BLUESKY_HANDLE;
        this.password = process.env.BLUESKY_PASSWORD;
        this.accessToken = null;
        this.stopWords = new Set([
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
            'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
            'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
            'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
            'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
            'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
            'https', 'com', 'http', 'www', 'just', 'like', 'can', 'its'
        ]);
    }

    async authenticate() {
        if (!this.handle || !this.password) {
            console.log('No credentials provided');
            return false;
        }

        try {
            const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: this.handle,
                    password: this.password
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.accessJwt;
                console.log('Authenticated successfully');
                return true;
            }
            console.error(`Auth failed: ${response.status}`);
        } catch (error) {
            console.error('Auth error:', error.message);
        }
        return false;
    }

    async fetchPosts(query = '', limit = 30) {
        if (!this.accessToken) return [];

        try {
            const endpoint = query 
                ? `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`
                : `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=${limit}`;
            
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                return data.posts || [];
            }
        } catch (error) {
            console.error('Fetch error:', error.message);
        }
        return [];
    }

    processWords(posts) {
        const wordCounts = new Map();

        posts.forEach(post => {
            const text = post.record?.text || '';
            const words = text.toLowerCase()
                .replace(/https?:\/\/[^\s]+/g, '')
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3 && !this.stopWords.has(word));

            words.forEach(word => {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            });
        });

        return Array.from(wordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100);
    }

    async run() {
        const authenticated = await this.authenticate();
        
        if (!authenticated) {
            console.log('Using fallback data');
            await this.saveFallbackData();
            return;
        }

        const queries = ['tech', 'code', 'ai'];
        const allPosts = [];

        for (const query of queries) {
            const posts = await this.fetchPosts(query, 30);
            allPosts.push(...posts);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const timelinePosts = await this.fetchPosts('', 50);
        allPosts.push(...timelinePosts);

        const topWords = this.processWords(allPosts);
        
        await fs.writeFile('word-data.json', JSON.stringify({
            words: topWords,
            timestamp: new Date().toISOString(),
            postCount: allPosts.length
        }, null, 2));

        console.log(`Saved ${topWords.length} words from ${allPosts.length} posts`);
    }

    async saveFallbackData() {
        const fallbackWords = [
            ['technology', 45], ['programming', 42], ['javascript', 38], ['future', 35],
            ['artificial', 32], ['intelligence', 30], ['learning', 28], ['development', 27],
            ['building', 26], ['design', 24], ['community', 23], ['open', 22]
        ];

        await fs.writeFile('word-data.json', JSON.stringify({
            words: fallbackWords,
            timestamp: new Date().toISOString(),
            postCount: 0
        }, null, 2));
    }
}

new BlueskyWordFetcher().run().catch(console.error);
