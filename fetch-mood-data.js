// fetch-mood-data.js
// This script runs via GitHub Actions to fetch Bluesky data and save it as JSON

const fs = require('fs').promises;
const path = require('path');

// Simple fetch polyfill for Node.js
const fetch = require('node-fetch');

// Configuration from environment variables (set in GitHub Secrets)
const config = {
    handle: process.env.BLUESKY_HANDLE,
    appPassword: process.env.BLUESKY_PASSWORD
};

// Simplified Bluesky API client
class SimpleBlueSkyClient {
    constructor() {
        this.apiHost = 'https://public.api.bsky.app';
        this.accessToken = null;
    }

    async authenticate() {
        try {
            const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: config.handle,
                    password: config.appPassword
                })
            });

            const data = await response.json();
            if (data.accessJwt) {
                this.accessToken = data.accessJwt;
                console.log('✅ Authenticated successfully');
                return true;
            }
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            return false;
        }
    }

    async searchPosts(query, limit = 100) {
        try {
            const response = await fetch(
                `${this.apiHost}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`,
                {
                    headers: this.accessToken ? {
                        'Authorization': `Bearer ${this.accessToken}`
                    } : {}
                }
            );

            const data = await response.json();
            return data.posts || [];
        } catch (error) {
            console.error(`Search error for "${query}":`, error);
            return [];
        }
    }
}

// Simple emotion analyzer
function analyzeEmotions(posts) {
    // Emotion keywords (simplified version)
    const emotionKeywords = {
        joy: ['happy', 'joy', 'excited', 'love', 'wonderful', 'amazing', 'great', '😊', '😄', '❤️'],
        sadness: ['sad', 'depressed', 'crying', 'tears', 'lonely', 'hurt', '😢', '😭'],
        anger: ['angry', 'mad', 'furious', 'hate', 'annoyed', 'frustrated', '😠', '😡'],
        fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'panic', '😨', '😰'],
        calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen', '😌', '🧘']
    };

    const emotionCounts = {
        joy: 0,
        sadness: 0,
        anger: 0,
        fear: 0,
        calm: 0
    };

    let totalPosts = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    posts.forEach(post => {
        const text = (post.record?.text || '').toLowerCase();
        totalPosts++;

        // Count emotions
        Object.keys(emotionKeywords).forEach(emotion => {
            const keywords = emotionKeywords[emotion];
            const count = keywords.filter(keyword => text.includes(keyword)).length;
            emotionCounts[emotion] += count;

            // Track positive/negative
            if (emotion === 'joy' || emotion === 'calm') {
                positiveCount += count;
            } else if (emotion === 'sadness' || emotion === 'anger' || emotion === 'fear') {
                negativeCount += count;
            }
        });
    });

    // Calculate sentiment score (-1 to 1)
    const totalEmotions = positiveCount + negativeCount || 1;
    const sentimentScore = (positiveCount - negativeCount) / totalEmotions;

    // Find dominant emotions
    const sortedEmotions = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count > 0)
        .map(([emotion]) => emotion);

    const dominantEmotions = sortedEmotions.slice(0, 2);
    if (dominantEmotions.length === 0) dominantEmotions.push('neutral');

    return {
        sentimentScore,
        dominantEmotions,
        emotionCounts,
        totalPosts
    };
}

// Weather metaphor generator
function generateWeatherMetaphor(emotions) {
    const { sentimentScore, dominantEmotions } = emotions;
    const primary = dominantEmotions[0];

    const weatherMap = {
        joy: ['sunny skies', 'bright sunshine', 'radiant warmth'],
        sadness: ['grey clouds', 'gentle rain', 'overcast skies'],
        anger: ['thunderstorms', 'turbulent weather', 'lightning strikes'],
        fear: ['foggy conditions', 'uncertain skies', 'shadows gathering'],
        calm: ['clear skies', 'gentle breeze', 'peaceful atmosphere'],
        neutral: ['partly cloudy', 'mild conditions', 'steady weather']
    };

    const weatherOptions = weatherMap[primary] || weatherMap.neutral;
    const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    let prefix = '';
    if (sentimentScore > 0.3) prefix = 'beautifully ';
    else if (sentimentScore < -0.3) prefix = 'unfortunately ';

    let suffix = '';
    if (sentimentScore > 0.1) suffix = ' with rays of hope';
    else if (sentimentScore < -0.1) suffix = ' but may improve';
    else suffix = ' and holding steady';

    return prefix + weather + suffix;
}

// Process a single region
async function processRegion(client, region, searchQueries) {
    console.log(`\n📍 Processing ${region}...`);
    
    const allPosts = [];
    
    for (const query of searchQueries.slice(0, 3)) { // Limit queries to avoid rate limits
        const posts = await client.searchPosts(query, 50);
        allPosts.push(...posts);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit delay
    }

    const emotions = analyzeEmotions(allPosts);
    const weatherMetaphor = generateWeatherMetaphor(emotions);

    // Determine momentum
    let momentum = { text: 'and steady', icon: '→' };
    if (emotions.sentimentScore > 0.1) {
        momentum = { text: 'and brightening', icon: '↗️' };
    } else if (emotions.sentimentScore < -0.1) {
        momentum = { text: 'and darkening', icon: '↘️' };
    }

    return {
        region,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        dominant_emotions: emotions.dominantEmotions,
        sentiment_score: emotions.sentimentScore,
        weather_metaphor: weatherMetaphor,
        momentum: momentum.text,
        momentum_icon: momentum.icon,
        sample_size: emotions.totalPosts,
        last_updated: new Date().toISOString()
    };
}

// Main function
async function fetchMoodData() {
    console.log('🌍 World Mood Tracker - Fetching Data');
    console.log('=====================================\n');

    const client = new SimpleBlueSkyClient();
    
    // Authenticate
    const authenticated = await client.authenticate();
    if (!authenticated) {
        console.error('Failed to authenticate. Using fallback data.');
    }

    // Define regions and their search queries
    const regions = {
        world: ['world news', 'today', 'global'],
        usa: ['USA', 'America', 'United States'],
        canada: ['Canada', 'Canadian', 'Toronto'],
        'australia-nz': ['Australia', 'New Zealand', 'Sydney'],
        europe: ['Europe', 'EU', 'London'],
        asia: ['Asia', 'Tokyo', 'Beijing'],
        'south-america': ['South America', 'Brazil', 'Argentina']
    };

    // Process each region
    const results = {};
    
    for (const [region, queries] of Object.entries(regions)) {
        try {
            results[region] = await processRegion(client, region, queries);
        } catch (error) {
            console.error(`Error processing ${region}:`, error);
            // Fallback data
            results[region] = {
                region,
                date: new Date().toISOString().split('T')[0],
                weather_metaphor: 'conditions unclear',
                momentum: 'steady',
                momentum_icon: '→',
                sentiment_score: 0,
                dominant_emotions: ['neutral']
            };
        }
    }

    // Save results to JSON file
    const outputPath = path.join(__dirname, 'mood-data.json');
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Data saved to ${outputPath}`);
    console.log('\nSample data:', JSON.stringify(results.world, null, 2));
}

// Run the script
if (require.main === module) {
    fetchMoodData().catch(console.error);
}

module.exports = { fetchMoodData };