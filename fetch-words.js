// fetch-words.js - Fetches words from Bluesky posts (public API)
const fs = require('fs').promises;
const fetch = require('node-fetch');

class BlueskyWordFetcher {
    constructor() {
        this.stopWords = new Set([
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
            'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
            'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
            'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
            'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
            'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
            'https', 'com', 'http', 'www', 'just', 'like', 'can', 'its',
            'im', 'dont', 'thats', 'was', 'is', 'are', 'been', 'has'
        ]);
    }

    async fetchPublicPosts(query = '', limit = 100) {
        try {
            // Use public API endpoint - no auth required
            const url = query 
                ? `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`
                : `https://public.api.bsky.app/xrpc/app.bsky.feed.getTimeline?limit=${limit}`;
            
            console.log(`Fetching from: ${url}`);
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'WordCloudBot/1.0'
                },
                timeout: 10000
            });

            if (!response.ok) {
                console.error(`API error: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            console.log(`Got ${data.posts?.length || 0} posts`);
            return data.posts || [];
        } catch (error) {
            console.error('Fetch error:', error.message);
            return [];
        }
    }

    processWords(posts) {
        const wordCounts = new Map();

        posts.forEach(post => {
            const text = post.record?.text || '';
            const words = text.toLowerCase()
                .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3 && !this.stopWords.has(word));

            words.forEach(word => {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            });
        });

        return Array.from(wordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 150);
    }

    async run() {
        console.log('Fetching words from Bluesky...');
        
        const queries = ['technology', 'programming', 'ai', 'web', 'javascript', 'coding'];
        const allPosts = [];

        // Try different queries
        for (const query of queries) {
            console.log(`Searching for: ${query}`);
            const posts = await this.fetchPublicPosts(query, 25);
            allPosts.push(...posts);
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Also get some timeline posts (no query)
        const timelinePosts = await this.fetchPublicPosts('', 50);
        allPosts.push(...timelinePosts);

        console.log(`Total posts collected: ${allPosts.length}`);

        if (allPosts.length === 0) {
            console.log('No posts found, using fallback data');
            await this.saveFallbackData();
            return;
        }

        const topWords = this.processWords(allPosts);
        
        const outputData = {
            words: topWords,
            timestamp: new Date().toISOString(),
            postCount: allPosts.length
        };

        await fs.writeFile('word-data.json', JSON.stringify(outputData, null, 2));
        console.log(`Saved ${topWords.length} words from ${allPosts.length} posts`);
    }

    async saveFallbackData() {
        const fallbackWords = [
            ['technology', 45], ['programming', 42], ['javascript', 38], ['future', 35],
            ['artificial', 32], ['intelligence', 30], ['learning', 28], ['development', 27],
            ['building', 26], ['design', 24], ['community', 23], ['open', 22],
            ['source', 21], ['code', 20], ['creative', 19], ['digital', 18],
            ['innovation', 17], ['software', 16], ['security', 15], ['data', 14]
        ];

        await fs.writeFile('word-data.json', JSON.stringify({
            words: fallbackWords,
            timestamp: new Date().toISOString(),
            postCount: 0,
            fallback: true
        }, null, 2));
    }
}

// Run
new BlueskyWordFetcher().run().catch(console.error);
