// World Mood Tracker - Bluesky API Integration
// Handles authentication, data fetching, and geographic filtering

class BlueskyAPIClient {
    constructor(config = {}) {
        this.apiHost = config.apiHost || 'https://public.api.bsky.app';
        this.handle = config.handle || null;
        this.appPassword = config.appPassword || null;
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        
        this.initializeGeographicFilters();
        this.initializeRateLimiter();
    }

    // Initialize geographic search patterns
    initializeGeographicFilters() {
        this.geoFilters = {
            usa: {
                keywords: ['USA', 'United States', 'America', 'US'],
                cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 
                        'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
                        'Austin', 'Jacksonville', 'San Francisco', 'Boston', 'Seattle',
                        'Denver', 'Washington DC', 'Las Vegas', 'Portland', 'Miami'],
                domains: ['.com', 'nytimes.com', 'cnn.com', 'wsj.com', 'washingtonpost.com'],
                hashtags: ['#USA', '#American', '#USNews', '#USPolitics'],
                languageCode: 'en'
            },
            canada: {
                keywords: ['Canada', 'Canadian'],
                cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton',
                        'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener'],
                domains: ['.ca', 'cbc.ca', 'globalnews.ca', 'ctvnews.ca'],
                hashtags: ['#Canada', '#Canadian', '#CanadaNews'],
                languageCode: 'en'
            },
            'australia-nz': {
                keywords: ['Australia', 'Australian', 'New Zealand', 'Kiwi', 'Aussie'],
                cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide',
                        'Auckland', 'Wellington', 'Christchurch', 'Gold Coast', 'Canberra'],
                domains: ['.au', '.nz', 'abc.net.au', 'news.com.au', 'stuff.co.nz'],
                hashtags: ['#Australia', '#NewZealand', '#Aussie', '#Kiwi', '#AusNews', '#NZNews'],
                languageCode: 'en'
            },
            europe: {
                keywords: ['Europe', 'European', 'EU'],
                cities: ['London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Amsterdam',
                        'Brussels', 'Vienna', 'Stockholm', 'Copenhagen', 'Dublin',
                        'Barcelona', 'Munich', 'Milan', 'Prague', 'Budapest'],
                domains: ['.uk', '.de', '.fr', '.es', '.it', '.nl', 'bbc.co.uk', 
                         'theguardian.com', 'lemonde.fr', 'spiegel.de'],
                hashtags: ['#Europe', '#EU', '#European', '#Brexit', '#EuropeNews'],
                languageCode: 'multi' // Will use multiple language codes
            },
            asia: {
                keywords: ['Asia', 'Asian'],
                cities: ['Tokyo', 'Beijing', 'Shanghai', 'Delhi', 'Mumbai', 'Seoul',
                        'Bangkok', 'Singapore', 'Jakarta', 'Manila', 'Taipei', 'Hong Kong',
                        'Osaka', 'Kuala Lumpur', 'Dubai', 'Istanbul'],
                domains: ['.jp', '.cn', '.in', '.kr', '.sg', 'japantimes.co.jp', 
                         'straitstimes.com', 'scmp.com'],
                hashtags: ['#Asia', '#Asian', '#AsiaNews', '#AsiaPacific'],
                languageCode: 'multi'
            },
            'south-america': {
                keywords: ['South America', 'Latin America', 'América del Sur', 'América Latina'],
                cities: ['São Paulo', 'Buenos Aires', 'Rio de Janeiro', 'Lima', 'Bogotá',
                        'Santiago', 'Caracas', 'Montevideo', 'Quito', 'La Paz'],
                domains: ['.br', '.ar', '.cl', '.co', '.pe', 'globo.com', 'clarin.com'],
                hashtags: ['#SouthAmerica', '#LatinAmerica', '#LATAM', '#AméricaLatina'],
                languageCode: 'multi' // Spanish, Portuguese
            },
            world: {
                keywords: ['world', 'global', 'international'],
                cities: [], // Will aggregate from all regions
                domains: [],
                hashtags: ['#World', '#Global', '#International', '#WorldNews'],
                languageCode: 'all'
            }
        };

        // Language codes for multi-language regions
        this.languageCodes = {
            europe: ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt'],
            asia: ['en', 'ja', 'zh', 'ko', 'hi', 'th', 'id'],
            'south-america': ['es', 'pt']
        };
    }

    // Initialize rate limiter
    initializeRateLimiter() {
        this.rateLimiter = {
            requests: [],
            maxRequestsPerHour: 5000,
            maxRequestsPerDay: 35000,
            dailyReset: new Date().setHours(0, 0, 0, 0) + 86400000 // Next midnight
        };
    }

    // Authenticate with Bluesky
    async authenticate() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return true; // Already authenticated
        }

        try {
            const response = await fetch(`${this.apiHost}/xrpc/com.atproto.server.createSession`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    identifier: this.handle,
                    password: this.appPassword
                })
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.accessJwt;
            this.refreshToken = data.refreshJwt;
            this.tokenExpiry = Date.now() + 3600000; // 1 hour
            
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    // Check rate limits
    async checkRateLimit() {
        const now = Date.now();
        
        // Reset daily counter if needed
        if (now > this.rateLimiter.dailyReset) {
            this.rateLimiter.requests = [];
            this.rateLimiter.dailyReset = now + 86400000;
        }
        
        // Remove requests older than 1 hour
        this.rateLimiter.requests = this.rateLimiter.requests.filter(
            req => now - req < 3600000
        );
        
        // Check limits
        const hourlyCount = this.rateLimiter.requests.length;
        const dailyCount = this.rateLimiter.requests.filter(
            req => now - req < 86400000
        ).length;
        
        if (hourlyCount >= this.rateLimiter.maxRequestsPerHour ||
            dailyCount >= this.rateLimiter.maxRequestsPerDay) {
            // Wait before next request
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
            return this.checkRateLimit(); // Recursive check
        }
        
        // Record this request
        this.rateLimiter.requests.push(now);
        return true;
    }

    // Fetch posts for a specific region
    async fetchRegionPosts(region, options = {}) {
        const {
            timeRange = 'day', // 'day', 'morning', 'afternoon', 'evening', 'night'
            limit = 100,
            cursor = null
        } = options;

        // Get date range
        const { since, until } = this.getTimeRange(timeRange);
        
        // Build search queries for this region
        const queries = this.buildRegionQueries(region);
        
        // Fetch posts for each query
        const allPosts = [];
        for (const query of queries) {
            try {
                await this.checkRateLimit();
                const posts = await this.searchPosts(query, { since, until, limit, cursor });
                allPosts.push(...posts);
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error fetching posts for query "${query}":`, error);
            }
        }

        // Deduplicate posts
        const uniquePosts = this.deduplicatePosts(allPosts);
        
        // Apply additional geographic filtering
        const filteredPosts = this.applyGeographicFiltering(uniquePosts, region);
        
        return filteredPosts;
    }

    // Build search queries for a region
    buildRegionQueries(region) {
        const filters = this.geoFilters[region];
        if (!filters) return [];

        const queries = [];

        // Keyword-based queries
        filters.keywords.forEach(keyword => {
            queries.push(keyword);
            
            // Add with language filter if specific
            if (filters.languageCode && filters.languageCode !== 'all' && filters.languageCode !== 'multi') {
                queries.push(`${keyword} lang:${filters.languageCode}`);
            }
        });

        // City-based queries (sample to avoid too many queries)
        const citySample = this.sampleArray(filters.cities, 5);
        citySample.forEach(city => {
            queries.push(city);
        });

        // Domain-based queries
        filters.domains.slice(0, 3).forEach(domain => {
            queries.push(`domain:${domain}`);
        });

        // Hashtag queries
        filters.hashtags.slice(0, 3).forEach(hashtag => {
            queries.push(hashtag);
        });

        // For multi-language regions, add language-specific queries
        if (filters.languageCode === 'multi' && this.languageCodes[region]) {
            this.languageCodes[region].slice(0, 3).forEach(lang => {
                queries.push(`lang:${lang} ${filters.keywords[0]}`);
            });
        }

        return queries;
    }

    // Search posts using Bluesky API
    async searchPosts(query, options = {}) {
        const { since, until, limit = 100, cursor = null } = options;

        try {
            const params = new URLSearchParams({
                q: query,
                limit: Math.min(limit, 100), // API max is 100
                ...(cursor && { cursor }),
                ...(since && { since }),
                ...(until && { until })
            });

            const response = await fetch(
                `${this.apiHost}/xrpc/app.bsky.feed.searchPosts?${params}`,
                {
                    headers: this.accessToken ? {
                        'Authorization': `Bearer ${this.accessToken}`
                    } : {}
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.posts || [];
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    // Get time range for queries
    getTimeRange(timeRange) {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        let since, until;

        switch (timeRange) {
            case 'morning':
                since = new Date(yesterday.setHours(6, 0, 0, 0));
                until = new Date(yesterday.setHours(12, 0, 0, 0));
                break;
            case 'afternoon':
                since = new Date(yesterday.setHours(12, 0, 0, 0));
                until = new Date(yesterday.setHours(18, 0, 0, 0));
                break;
            case 'evening':
                since = new Date(yesterday.setHours(18, 0, 0, 0));
                until = new Date(yesterday.setHours(23, 59, 59, 999));
                break;
            case 'night':
                since = new Date(yesterday.setHours(0, 0, 0, 0));
                until = new Date(yesterday.setHours(6, 0, 0, 0));
                break;
            default: // 'day'
                since = new Date(yesterday.setHours(0, 0, 0, 0));
                until = new Date(yesterday.setHours(23, 59, 59, 999));
        }

        return {
            since: since.toISOString(),
            until: until.toISOString()
        };
    }

    // Deduplicate posts by ID
    deduplicatePosts(posts) {
        const seen = new Set();
        return posts.filter(post => {
            if (seen.has(post.uri)) {
                return false;
            }
            seen.add(post.uri);
            return true;
        });
    }

    // Apply additional geographic filtering
    applyGeographicFiltering(posts, region) {
        const filters = this.geoFilters[region];
        if (!filters || region === 'world') return posts;

        return posts.filter(post => {
            const text = post.record?.text?.toLowerCase() || '';
            
            // Check for region keywords
            const hasKeyword = filters.keywords.some(keyword => 
                text.includes(keyword.toLowerCase())
            );
            
            // Check for city mentions
            const hasCity = filters.cities.some(city => 
                text.includes(city.toLowerCase())
            );
            
            // Check for hashtags
            const hasHashtag = filters.hashtags.some(tag => 
                text.includes(tag.toLowerCase())
            );
            
            // Accept if any geographic indicator is present
            return hasKeyword || hasCity || hasHashtag;
        });
    }

    // Extract text content from posts for analysis
    extractPostsText(posts) {
        return posts.map(post => {
            const text = post.record?.text || '';
            const author = post.author?.displayName || post.author?.handle || 'anonymous';
            const timestamp = post.record?.createdAt || new Date().toISOString();
            
            return {
                text,
                author,
                timestamp,
                uri: post.uri,
                replyCount: post.replyCount || 0,
                repostCount: post.repostCount || 0,
                likeCount: post.likeCount || 0,
                engagement: (post.replyCount || 0) + (post.repostCount || 0) + (post.likeCount || 0)
            };
        });
    }

    // Sample array helper
    sampleArray(array, n) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    }

    // Process posts for a region with emotion analysis
    async processRegionEmotions(region, emotionAnalyzer, weatherGenerator, options = {}) {
        try {
            // Fetch posts
            const posts = await this.fetchRegionPosts(region, options);
            
            if (posts.length === 0) {
                return this.getDefaultEmotionData(region);
            }

            // Extract text content
            const postsData = this.extractPostsText(posts);
            
            // Weight by engagement (optional)
            const weightedTexts = options.weightByEngagement 
                ? this.applyEngagementWeighting(postsData)
                : postsData.map(p => p.text);

            // Analyze emotions
            const emotionResults = emotionAnalyzer.batchAnalyze(weightedTexts, {
                weightByIntensity: true,
                timeDecay: options.timeRange !== 'day'
            });

            // Generate weather metaphor
            const weatherMetaphor = weatherGenerator.generateWeatherMetaphor(emotionResults, {
                timeOfDay: options.timeRange || 'day',
                style: 'descriptive'
            });

            // Calculate momentum (would need previous day's data in production)
            const momentum = weatherGenerator.generateMomentumDescription(
                emotionResults.sentimentScore,
                emotionResults.sentimentScore - 0.05 // Mock previous score
            );

            return {
                region: this.formatRegionName(region),
                date: new Date().toISOString().split('T')[0],
                time: options.timeRange || 'day',
                dominant_emotions: emotionResults.dominantEmotions,
                sentiment_score: emotionResults.sentimentScore,
                weather_metaphor: weatherMetaphor,
                momentum: momentum.text,
                momentum_icon: momentum.icon,
                comparison_yesterday: 0.05, // Mock value
                sample_size: posts.length,
                confidence: Math.min(posts.length / 100, 1) // Higher sample = higher confidence
            };
        } catch (error) {
            console.error(`Error processing emotions for ${region}:`, error);
            return this.getDefaultEmotionData(region);
        }
    }

    // Apply engagement weighting to posts
    applyEngagementWeighting(postsData) {
        const weighted = [];
        
        postsData.forEach(post => {
            // More engaged posts get more weight
            const weight = Math.ceil(Math.log2(post.engagement + 1));
            for (let i = 0; i < weight; i++) {
                weighted.push(post.text);
            }
        });
        
        return weighted;
    }

    // Format region name
    formatRegionName(region) {
        const names = {
            'world': 'the World',
            'usa': 'USA',
            'canada': 'Canada',
            'australia-nz': 'Australia/NZ',
            'europe': 'Europe',
            'asia': 'Asia',
            'south-america': 'South America'
        };
        return names[region] || region;
    }

    // Get default emotion data for fallback
    getDefaultEmotionData(region) {
        return {
            region: this.formatRegionName(region),
            date: new Date().toISOString().split('T')[0],
            dominant_emotions: ['steady', 'neutral'],
            sentiment_score: 0.5,
            weather_metaphor: 'conditions unclear, awaiting more data',
            momentum: 'steady',
            momentum_icon: '→',
            comparison_yesterday: 0,
            sample_size: 0,
            confidence: 0
        };
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlueskyAPIClient;
}