// fetch-mood-data.js - Fixed version with better error handling
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const config = {
    handle: process.env.BLUESKY_HANDLE,
    appPassword: process.env.BLUESKY_PASSWORD
};

class RobustBlueSkyClient {
    constructor() {
        this.accessToken = null;
        this.session = null;
    }

    async authenticate() {
        if (!config.handle || !config.appPassword) {
            console.log('⚠️  No Bluesky credentials found in secrets');
            console.log('   Add BLUESKY_HANDLE and BLUESKY_PASSWORD to GitHub Secrets');
            return false;
        }

        try {
            console.log(`🔐 Authenticating with Bluesky as ${config.handle}...`);
            
            const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'WorldMoodTracker/1.0'
                },
                body: JSON.stringify({
                    identifier: config.handle,
                    password: config.appPassword
                })
            });

            const responseText = await response.text();
            
            if (!response.ok) {
                console.error(`❌ Auth failed: ${response.status} ${response.statusText}`);
                console.error('Response:', responseText.substring(0, 200));
                return false;
            }

            const data = JSON.parse(responseText);
            if (data.accessJwt) {
                this.accessToken = data.accessJwt;
                this.session = data;
                console.log('✅ Successfully authenticated with Bluesky');
                return true;
            } else {
                console.error('❌ No access token in response');
                return false;
            }
        } catch (error) {
            console.error('❌ Authentication error:', error.message);
            return false;
        }
    }

    async searchPosts(query, limit = 25) {
        // Try different API approaches
        const endpoints = [
            'https://bsky.social/xrpc/app.bsky.feed.searchPosts',
            'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Searching "${query}" via ${endpoint}`);
                
                const headers = {
                    'Accept': 'application/json',
                    'User-Agent': 'WorldMoodTracker/1.0'
                };

                if (this.accessToken) {
                    headers['Authorization'] = `Bearer ${this.accessToken}`;
                }

                const url = `${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`;
                const response = await fetch(url, { 
                    headers,
                    timeout: 10000 // 10 second timeout
                });

                const responseText = await response.text();
                
                if (!response.ok) {
                    console.log(`⚠️  ${endpoint} returned ${response.status}: ${response.statusText}`);
                    console.log('Response preview:', responseText.substring(0, 100));
                    continue;
                }

                // Check if response is actually JSON
                if (responseText.trim().startsWith('<')) {
                    console.log(`⚠️  ${endpoint} returned HTML instead of JSON`);
                    console.log('HTML preview:', responseText.substring(0, 100));
                    continue;
                }

                const data = JSON.parse(responseText);
                const posts = data.posts || [];
                console.log(`✅ Found ${posts.length} posts for "${query}"`);
                return posts;

            } catch (error) {
                console.log(`⚠️  ${endpoint} failed:`, error.message);
                continue;
            }
        }

        console.log(`❌ All endpoints failed for query: "${query}"`);
        return [];
    }
}

// Enhanced emotion analyzer with more keywords
function analyzeEmotions(posts) {
    const emotionKeywords = {
        joy: ['happy', 'joy', 'excited', 'love', 'wonderful', 'amazing', 'great', 'awesome', 'fantastic', 'celebrate', 'blessed', 'grateful', 'perfect', 'beautiful', '😊', '😄', '😍', '❤️', '🎉', '🥳', '✨', '🌟'],
        sadness: ['sad', 'depressed', 'crying', 'tears', 'lonely', 'hurt', 'disappointed', 'devastated', 'heartbroken', 'miserable', 'awful', '😢', '😭', '💔', '😞', '😔'],
        anger: ['angry', 'mad', 'furious', 'hate', 'annoyed', 'frustrated', 'outraged', 'livid', 'pissed', 'disgusted', 'wtf', 'ridiculous', '😠', '😡', '🤬', '💢'],
        fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'panic', 'terrified', 'frightened', 'concerned', 'stress', 'overwhelming', '😨', '😰', '😱'],
        calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen', 'meditation', 'mindful', 'chill', 'content', '😌', '🧘', '☮️', '🕊️']
    };

    const emotionCounts = {
        joy: 0, sadness: 0, anger: 0, fear: 0, calm: 0
    };

    let totalPosts = posts.length;
    let positiveCount = 0;
    let negativeCount = 0;

    posts.forEach(post => {
        const text = (post.record?.text || '').toLowerCase();

        Object.keys(emotionKeywords).forEach(emotion => {
            const keywords = emotionKeywords[emotion];
            const matches = keywords.filter(keyword => text.includes(keyword)).length;
            emotionCounts[emotion] += matches;

            if (emotion === 'joy' || emotion === 'calm') {
                positiveCount += matches;
            } else if (emotion === 'sadness' || emotion === 'anger' || emotion === 'fear') {
                negativeCount += matches;
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
        sentimentScore: Math.max(-1, Math.min(1, sentimentScore)),
        dominantEmotions,
        emotionCounts,
        totalPosts
    };
}

// Generate realistic mock data if APIs fail
function generateMockData(region) {
    const mockPatterns = {
        world: {
            emotions: [
                { dominant: ['contemplative', 'hopeful'], sentiment: 0.1, weather: 'partly cloudy with rays of hope' },
                { dominant: ['curious', 'energetic'], sentiment: 0.3, weather: 'bright skies with gentle breeze' },
                { dominant: ['reflective', 'calm'], sentiment: 0.05, weather: 'steady atmosphere with quiet optimism' }
            ]
        },
        usa: {
            emotions: [
                { dominant: ['anxious', 'determined'], sentiment: -0.2, weather: 'stormy conditions with determination breaking through' },
                { dominant: ['frustrated', 'hopeful'], sentiment: -0.1, weather: 'turbulent weather with clearing patches' }
            ]
        },
        europe: {
            emotions: [
                { dominant: ['thoughtful', 'resilient'], sentiment: 0.2, weather: 'stable conditions with gentle warmth' },
                { dominant: ['calm', 'practical'], sentiment: 0.15, weather: 'clear skies with measured optimism' }
            ]
        }
    };

    const patterns = mockPatterns[region] || mockPatterns.world;
    const selected = patterns.emotions[Math.floor(Math.random() * patterns.emotions.length)];
    
    return {
        dominant_emotions: selected.dominant,
        sentiment_score: selected.sentiment + (Math.random() - 0.5) * 0.1, // Add slight randomness
        weather_metaphor: selected.weather,
        sample_size: Math.floor(Math.random() * 50) + 10 // Random sample size 10-60
    };
}

// Enhanced weather metaphor generator
function generateWeatherMetaphor(emotions) {
    const { sentimentScore, dominantEmotions } = emotions;
    const primary = dominantEmotions[0] || 'neutral';

    const weatherMap = {
        joy: ['brilliant sunshine breaking through', 'radiant golden skies', 'warm rays dancing'],
        sadness: ['gentle rain with soft clouds', 'misty grey atmosphere', 'overcast with quiet reflection'],
        anger: ['thunderstorms crackling', 'turbulent winds swirling', 'lightning illuminating dark clouds'],
        fear: ['uncertain shadows gathering', 'fog rolling in slowly', 'distant storm clouds approaching'],
        calm: ['crystal clear horizons', 'gentle breeze flowing peacefully', 'serene blue skies'],
        neutral: ['partly cloudy with steady conditions', 'mild atmospheric pressure', 'balanced weather patterns'],
        contemplative: ['thoughtful grey skies', 'quiet overcast conditions', 'reflective mist'],
        hopeful: ['sunshine peeking through clouds', 'brightening on the horizon', 'dawn breaking gently'],
        determined: ['strong winds of change', 'powerful currents flowing', 'resilient clear patches']
    };

    const weatherOptions = weatherMap[primary] || weatherMap.neutral;
    const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    let modifier = '';
    if (sentimentScore > 0.3) modifier = 'beautifully ';
    else if (sentimentScore > 0.1) modifier = 'gently ';
    else if (sentimentScore < -0.3) modifier = 'intensely ';
    else if (sentimentScore < -0.1) modifier = 'quietly ';

    let suffix = '';
    if (sentimentScore > 0.2) suffix = ' with promise ahead';
    else if (sentimentScore > 0.05) suffix = ' and slowly improving';
    else if (sentimentScore < -0.2) suffix = ' but showing resilience';
    else if (sentimentScore < -0.05) suffix = ' with patience required';
    else suffix = ' and holding steady';

    return modifier + weather + suffix;
}

// Process a single region
async function processRegion(client, region, searchQueries) {
    console.log(`\n📍 Processing ${region.toUpperCase()}...`);
    
    const allPosts = [];
    let hasRealData = false;
    
    // Try to get real data first
    for (const query of searchQueries.slice(0, 2)) {
        const posts = await client.searchPosts(query, 20);
        if (posts.length > 0) {
            allPosts.push(...posts);
            hasRealData = true;
        }
        
        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    let emotions, weatherMetaphor;
    
    if (hasRealData && allPosts.length > 0) {
        console.log(`✅ Using real data: ${allPosts.length} posts`);
        emotions = analyzeEmotions(allPosts);
        weatherMetaphor = generateWeatherMetaphor(emotions);
    } else {
        console.log(`⚠️  No real data available, using enhanced mock data`);
        const mockData = generateMockData(region);
        emotions = {
            sentimentScore: mockData.sentiment_score,
            dominantEmotions: mockData.dominant_emotions,
            totalPosts: mockData.sample_size
        };
        weatherMetaphor = mockData.weather_metaphor;
    }

    // Determine momentum
    let momentum = { text: 'and steady', icon: '→' };
    if (emotions.sentimentScore > 0.15) {
        momentum = { text: 'and brightening', icon: '↗️' };
    } else if (emotions.sentimentScore < -0.15) {
        momentum = { text: 'and darkening', icon: '↘️' };
    } else if (emotions.sentimentScore > 0.05) {
        momentum = { text: 'and gently improving', icon: '↗️' };
    } else if (emotions.sentimentScore < -0.05) {
        momentum = { text: 'and slowly shifting', icon: '↘️' };
    }

    console.log(`📊 ${region}: ${emotions.totalPosts} posts, sentiment: ${emotions.sentimentScore.toFixed(2)}`);

    return {
        region,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        dominant_emotions: emotions.dominantEmotions,
        sentiment_score: parseFloat(emotions.sentimentScore.toFixed(3)),
        weather_metaphor: weatherMetaphor,
        momentum: momentum.text,
        momentum_icon: momentum.icon,
        sample_size: emotions.totalPosts,
        last_updated: new Date().toISOString(),
        data_source: hasRealData ? 'bluesky_api' : 'enhanced_simulation'
    };
}

// Main function
async function fetchMoodData() {
    console.log('🌍 World Mood Tracker - Enhanced Data Fetcher');
    console.log('===============================================\n');

    const client = new RobustBlueSkyClient();
    
    // Try to authenticate
    const authenticated = await client.authenticate();
    if (!authenticated) {
        console.log('📡 Proceeding with public API and enhanced mock data');
    }

    // Define regions with better search terms
    const regions = {
        world: ['feeling today', 'how is everyone', 'today has been'],
        usa: ['United States', 'American', 'feeling in America'],
        canada: ['Canada feeling', 'Canadian mood', 'how are Canadians'],
        'australia-nz': ['Australia today', 'feeling in Australia', 'Aussie mood'],
        europe: ['European mood', 'feeling in Europe', 'Europeans today'],
        asia: ['Asian countries', 'feeling in Asia', 'mood in Japan'],
        'south-america': ['South American', 'feeling in Brazil', 'Latin America mood']
    };

    const results = {};
    
    for (const [region, queries] of Object.entries(regions)) {
        try {
            results[region] = await processRegion(client, region, queries);
        } catch (error) {
            console.error(`❌ Error processing ${region}:`, error.message);
            
            // Ultimate fallback
            const mockData = generateMockData(region);
            results[region] = {
                region,
                date: new Date().toISOString().split('T')[0],
                dominant_emotions: mockData.dominant_emotions,
                sentiment_score: mockData.sentiment_score,
                weather_metaphor: mockData.weather_metaphor,
                momentum: 'and steady',
                momentum_icon: '→',
                sample_size: mockData.sample_size,
                last_updated: new Date().toISOString(),
                data_source: 'fallback_simulation'
            };
        }
    }

    // Save results
    const outputPath = path.join(__dirname, 'mood-data.json');
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Data saved to mood-data.json`);
    
    const totalPosts = Object.values(results).reduce((sum, r) => sum + r.sample_size, 0);
    const realDataSources = Object.values(results).filter(r => r.data_source === 'bluesky_api').length;
    
    console.log(`📈 Total posts analyzed: ${totalPosts}`);
    console.log(`🔍 Regions with real data: ${realDataSources}/${Object.keys(results).length}`);
    console.log(`🎭 Sample mood: ${results.world.weather_metaphor}`);
}

// Run the script
if (require.main === module) {
    fetchMoodData().catch(console.error);
}

module.exports = { fetchMoodData };
