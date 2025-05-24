// fetch-words.js - Fetches words from Bluesky posts
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
            'https', 'com', 'http', 'www'
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
                return true;
            }
        } catch (error) {
            console.error('Auth failed:', error.message);
        }
        return false;
    }

    async fetchPosts(query = 'technology', limit = 100) {
        if (!this.accessToken) return [];

        try {
            const response = await fetch(
                `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${query}&limit=${limit}`,
                { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
            );

            if (response.ok) {
                const data = await response.json();
                return data.posts || [];
            }
        } catch (error) {
            console.error('Fetch failed:', error.message);
        }
        return [];
    }

    processWords(posts) {
        const wordCounts = new Map();

        posts.forEach(post => {
            const text = post.record?.text || '';
            const words = text.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 2 && !this.stopWords.has(word));

            words.forEach(word => {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            });
        });

        return Array.from(wordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100);
    }

    async run() {
        console.log('Starting word fetch...');
        
        const authenticated = await this.authenticate();
        if (!authenticated) {
            console.log('Using sample data...');
            await this.saveSampleData();
            return;
        }

        const queries = ['tech', 'ai', 'coding', 'javascript', 'web'];
        const allPosts = [];

        for (const query of queries) {
            const posts = await this.fetchPosts(query, 50);
            allPosts.push(...posts);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        }

        const topWords = this.processWords(allPosts);
        
        await fs.writeFile('word-data.json', JSON.stringify({
            words: topWords,
            timestamp: new Date().toISOString(),
            postCount: allPosts.length
        }, null, 2));

        console.log(`Saved ${topWords.length} words from ${allPosts.length} posts`);
    }

    async saveSampleData() {
        const sampleWords = [
            ['technology', 45], ['coding', 42], ['javascript', 38], ['future', 35],
            ['innovation', 32], ['community', 30], ['learning', 28], ['development', 27],
            ['programming', 26], ['design', 24], ['artificial', 23], ['intelligence', 22],
            ['climate', 21], ['change', 20], ['creative', 19], ['building', 18],
            ['opensource', 17], ['collaboration', 16], ['security', 15], ['performance', 14]
        ];

        await fs.writeFile('word-data.json', JSON.stringify({
            words: sampleWords,
            timestamp: new Date().toISOString(),
            postCount: 0
        }, null, 2));
    }
}

// Run
new BlueskyWordFetcher().run();
