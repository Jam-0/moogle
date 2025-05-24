// World Mood Tracker - Complete System Integration
// This file demonstrates how all components work together

class WorldMoodSystem {
    constructor(config = {}) {
        // Initialize configuration
        this.config = {
            blueskyHandle: config.blueskyHandle || process.env.BLUESKY_HANDLE,
            blueskyPassword: config.blueskyPassword || process.env.BLUESKY_PASSWORD,
            updateInterval: config.updateInterval || 3600000, // 1 hour
            batchSize: config.batchSize || 1000,
            cacheExpiry: config.cacheExpiry || 3600000, // 1 hour
            ...config
        };

        // Initialize components
        this.initializeComponents();
        
        // Setup periodic updates
        this.setupPeriodicUpdates();
    }

    // Initialize all system components
    initializeComponents() {
        // Emotion Analysis Engine
        this.emotionAnalyzer = new EmotionAnalyzer();
        
        // Weather Metaphor Generator
        this.weatherGenerator = new WeatherMetaphorGenerator();
        
        // Bluesky API Client
        this.blueskyClient = new BlueskyAPIClient({
            handle: this.config.blueskyHandle,
            appPassword: this.config.blueskyPassword
        });
        
        // Initialize data storage
        this.initializeStorage();
        
        // Initialize web workers for parallel processing
        this.initializeWorkers();
    }

    // Initialize storage systems
    async initializeStorage() {
        // IndexedDB for client-side caching
        this.db = await this.openDatabase();
        
        // In-memory cache for quick access
        this.memoryCache = new Map();
        
        // File system for batch results (server-side)
        this.resultsPath = './mood-data/';
    }

    // Initialize web workers
    initializeWorkers() {
        this.workerPool = [];
        const workerCount = navigator.hardwareConcurrency || 4;
        
        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker('./emotion-worker.js');
            this.workerPool.push({
                worker,
                busy: false
            });
        }
    }

    // Main processing pipeline
    async processWorldMood(options = {}) {
        const startTime = Date.now();
        console.log('Starting world mood analysis...');

        try {
            // Authenticate with Bluesky
            const authenticated = await this.blueskyClient.authenticate();
            if (!authenticated) {
                throw new Error('Failed to authenticate with Bluesky');
            }

            // Process each region
            const regions = ['world', 'usa', 'canada', 'australia-nz', 'europe', 'asia', 'south-america'];
            const regionResults = await this.processRegions(regions, options);

            // Generate world aggregate
            const worldMood = this.aggregateWorldMood(regionResults);

            // Store results
            await this.storeResults(regionResults, worldMood);

            // Generate summary report
            const report = this.generateReport(regionResults, worldMood);

            console.log(`World mood analysis completed in ${Date.now() - startTime}ms`);
            return report;

        } catch (error) {
            console.error('Error processing world mood:', error);
            throw error;
        }
    }

    // Process multiple regions in parallel
    async processRegions(regions, options) {
        const results = new Map();
        
        // Process in batches to avoid overwhelming the API
        const batchSize = 3;
        for (let i = 0; i < regions.length; i += batchSize) {
            const batch = regions.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(region => this.processRegion(region, options))
            );
            
            batch.forEach((region, index) => {
                results.set(region, batchResults[index]);
            });
            
            // Small delay between batches
            if (i + batchSize < regions.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }

    // Process a single region
    async processRegion(region, options = {}) {
        const cacheKey = `${region}-${options.timeRange || 'day'}-${new Date().toDateString()}`;
        
        // Check cache first
        const cached = await this.getCachedResult(cacheKey);
        if (cached) {
            console.log(`Using cached result for ${region}`);
            return cached;
        }

        console.log(`Processing ${region}...`);

        // Fetch posts from Bluesky
        const posts = await this.blueskyClient.fetchRegionPosts(region, {
            timeRange: options.timeRange || 'day',
            limit: this.config.batchSize
        });

        if (posts.length === 0) {
            console.warn(`No posts found for ${region}`);
            return this.getDefaultMoodData(region);
        }

        // Extract text for analysis
        const texts = this.blueskyClient.extractPostsText(posts);

        // Process in parallel using workers
        const emotions = await this.analyzeEmotionsParallel(texts);

        // Generate weather metaphor
        const weatherData = this.weatherGenerator.generateWeatherMetaphor(emotions, {
            timeOfDay: options.timeRange || 'day',
            style: 'descriptive'
        });

        // Calculate momentum (comparing with previous day)
        const previousData = await this.getPreviousDayData(region);
        const momentum = this.calculateMomentum(emotions.sentimentScore, previousData?.sentimentScore);

        // Build result
        const result = {
            region,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            timeRange: options.timeRange || 'day',
            ...emotions,
            weather_metaphor: weatherData,
            momentum: momentum.text,
            momentum_icon: momentum.icon,
            comparison_yesterday: momentum.change,
            sample_size: posts.length,
            confidence: Math.min(posts.length / 500, 1)
        };

        // Cache result
        await this.cacheResult(cacheKey, result);

        return result;
    }

    // Analyze emotions in parallel using workers
    async analyzeEmotionsParallel(texts) {
        const chunkSize = Math.ceil(texts.length / this.workerPool.length);
        const chunks = [];
        
        for (let i = 0; i < texts.length; i += chunkSize) {
            chunks.push(texts.slice(i, i + chunkSize));
        }

        const workerPromises = chunks.map((chunk, index) => 
            this.processWithWorker(chunk, index)
        );

        const results = await Promise.all(workerPromises);
        
        // Aggregate worker results
        return this.emotionAnalyzer.aggregateResults(results.flat());
    }

    // Process chunk with worker
    processWithWorker(textChunk, workerIndex) {
        return new Promise((resolve, reject) => {
            const worker = this.workerPool[workerIndex];
            
            worker.busy = true;
            worker.worker.postMessage({
                type: 'analyze',
                texts: textChunk
            });

            worker.worker.onmessage = (e) => {
                worker.busy = false;
                if (e.data.error) {
                    reject(new Error(e.data.error));
                } else {
                    resolve(e.data.results);
                }
            };
        });
    }

    // Aggregate world mood from regional data
    aggregateWorldMood(regionResults) {
        const allEmotions = [];
        let totalSentiment = 0;
        let totalSamples = 0;

        regionResults.forEach((data, region) => {
            if (region !== 'world') {
                // Weight by sample size
                const weight = data.sample_size;
                totalSentiment += data.sentimentScore * weight;
                totalSamples += weight;
                
                // Collect emotions
                data.dominantEmotions.forEach(emotion => {
                    allEmotions.push({ emotion, weight });
                });
            }
        });

        // Calculate weighted averages
        const avgSentiment = totalSamples > 0 ? totalSentiment / totalSamples : 0.5;
        
        // Find most common emotions globally
        const emotionCounts = {};
        allEmotions.forEach(({ emotion, weight }) => {
            emotionCounts[emotion] = (emotionCounts[emotion] || 0) + weight;
        });
        
        const dominantEmotions = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([emotion]) => emotion);

        // Generate global weather metaphor
        const weatherData = this.weatherGenerator.generateWeatherMetaphor({
            sentimentScore: avgSentiment,
            dominantEmotions,
            intensity: 0.6, // Moderate intensity for global average
            emotionDistribution: emotionCounts
        });

        return {
            region: 'world',
            sentimentScore: avgSentiment,
            dominantEmotions,
            weather_metaphor: weatherData,
            totalSamples,
            timestamp: Date.now()
        };
    }

    // Calculate momentum compared to previous day
    calculateMomentum(currentScore, previousScore = 0.5) {
        const change = currentScore - previousScore;
        
        if (Math.abs(change) < 0.05) {
            return { text: 'and steady', icon: '→', change: 0 };
        } else if (change > 0) {
            if (change > 0.2) return { text: 'and rapidly brightening', icon: '↗️', change };
            if (change > 0.1) return { text: 'and brightening', icon: '↗️', change };
            return { text: 'and gently brightening', icon: '↗️', change };
        } else {
            if (change < -0.2) return { text: 'and rapidly darkening', icon: '↘️', change };
            if (change < -0.1) return { text: 'and darkening', icon: '↘️', change };
            return { text: 'and slightly dimming', icon: '↘️', change };
        }
    }

    // Store results in various formats
    async storeResults(regionResults, worldMood) {
        const timestamp = new Date().toISOString();
        
        // Store in IndexedDB
        const transaction = this.db.transaction(['moods'], 'readwrite');
        const store = transaction.objectStore('moods');
        
        // Store each region
        for (const [region, data] of regionResults) {
            await store.put({
                id: `${region}-${timestamp}`,
                region,
                timestamp,
                data
            });
        }

        // Store world aggregate
        await store.put({
            id: `world-aggregate-${timestamp}`,
            region: 'world',
            timestamp,
            data: worldMood
        });

        // Also save as JSON for API serving
        const jsonData = {
            timestamp,
            regions: Object.fromEntries(regionResults),
            world: worldMood
        };

        // In a real implementation, this would save to a file or database
        this.latestResults = jsonData;
    }

    // Generate human-readable report
    generateReport(regionResults, worldMood) {
        const report = {
            summary: `The mood of the world today is ${worldMood.weather_metaphor}`,
            timestamp: new Date().toISOString(),
            regions: {}
        };

        regionResults.forEach((data, region) => {
            report.regions[region] = {
                mood: data.weather_metaphor,
                sentiment: data.sentimentScore,
                momentum: `${data.momentum_icon} ${data.momentum}`,
                confidence: `${Math.round(data.confidence * 100)}%`,
                sampleSize: data.sample_size
            };
        });

        return report;
    }

    // Setup periodic updates
    setupPeriodicUpdates() {
        // Initial run
        this.processWorldMood().catch(console.error);

        // Schedule periodic updates
        setInterval(() => {
            this.processWorldMood().catch(console.error);
        }, this.config.updateInterval);

        // Schedule daily batch processing at 1 AM
        const scheduleDailyUpdate = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(1, 0, 0, 0);
            
            const msUntilTomorrow = tomorrow - now;
            
            setTimeout(() => {
                this.processDailyBatch().catch(console.error);
                scheduleDailyUpdate(); // Reschedule for next day
            }, msUntilTomorrow);
        };
        
        scheduleDailyUpdate();
    }

    // Process full daily batch
    async processDailyBatch() {
        console.log('Starting daily batch processing...');
        
        const timeRanges = ['morning', 'afternoon', 'evening', 'night'];
        const allResults = new Map();

        for (const timeRange of timeRanges) {
            const results = await this.processWorldMood({ timeRange });
            allResults.set(timeRange, results);
        }

        // Generate daily summary
        const dailySummary = this.generateDailySummary(allResults);
        
        // Store daily summary
        await this.storeDailySummary(dailySummary);
        
        console.log('Daily batch processing completed');
    }

    // Helper methods for caching and data retrieval
    async getCachedResult(key) {
        // Check memory cache first
        if (this.memoryCache.has(key)) {
            const cached = this.memoryCache.get(key);
            if (cached.timestamp > Date.now() - this.config.cacheExpiry) {
                return cached.data;
            }
            this.memoryCache.delete(key);
        }

        // Check IndexedDB
        try {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const result = await store.get(key);
            
            if (result && result.timestamp > Date.now() - this.config.cacheExpiry) {
                // Restore to memory cache
                this.memoryCache.set(key, result);
                return result.data;
            }
        } catch (error) {
            console.error('Cache read error:', error);
        }

        return null;
    }

    async cacheResult(key, data) {
        const cacheEntry = {
            timestamp: Date.now(),
            data
        };

        // Store in memory
        this.memoryCache.set(key, cacheEntry);

        // Store in IndexedDB
        try {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            await store.put({ id: key, ...cacheEntry });
        } catch (error) {
            console.error('Cache write error:', error);
        }
    }

    // Database initialization
    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WorldMoodDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('moods')) {
                    db.createObjectStore('moods', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('daily')) {
                    db.createObjectStore('daily', { keyPath: 'date' });
                }
            };
        });
    }

    // API endpoint handlers (for serving data to frontend)
    async getCurrentMood(region = 'world', timeRange = 'day') {
        const cacheKey = `${region}-${timeRange}-${new Date().toDateString()}`;
        
        // Try cache first
        const cached = await this.getCachedResult(cacheKey);
        if (cached) return cached;

        // Process on demand if not cached
        const result = await this.processRegion(region, { timeRange });
        return result;
    }

    async getComparison(region1, region2, timeRange = 'day') {
        const [data1, data2] = await Promise.all([
            this.getCurrentMood(region1, timeRange),
            this.getCurrentMood(region2, timeRange)
        ]);

        const comparison = this.weatherGenerator.generateComparisonMetaphor(data1, data2);
        
        return {
            region1: data1,
            region2: data2,
            comparison,
            timestamp: Date.now()
        };
    }

    // Default data generators
    getDefaultMoodData(region) {
        return {
            region,
            sentimentScore: 0.5,
            dominantEmotions: ['neutral', 'steady'],
            weather_metaphor: 'conditions unclear, awaiting data',
            momentum: 'steady',
            momentum_icon: '→',
            sample_size: 0,
            confidence: 0
        };
    }

    getPreviousDayData(region) {
        // In production, this would query historical data
        // For now, return mock data
        return {
            sentimentScore: 0.5 + (Math.random() - 0.5) * 0.2
        };
    }

    generateDailySummary(timeRangeResults) {
        // Aggregate all time ranges for each region
        const summary = {
            date: new Date().toISOString().split('T')[0],
            regions: {},
            highlights: []
        };

        // Process each region's daily pattern
        const regions = new Set();
        timeRangeResults.forEach(result => {
            Object.keys(result.regions).forEach(region => regions.add(region));
        });

        regions.forEach(region => {
            const dayPattern = [];
            timeRangeResults.forEach((result, timeRange) => {
                if (result.regions[region]) {
                    dayPattern.push({
                        time: timeRange,
                        mood: result.regions[region].mood,
                        sentiment: result.regions[region].sentiment
                    });
                }
            });

            summary.regions[region] = {
                pattern: dayPattern,
                trend: this.analyzeDayTrend(dayPattern)
            };
        });

        return summary;
    }

    analyzeDayTrend(dayPattern) {
        if (dayPattern.length < 2) return 'insufficient data';
        
        const sentiments = dayPattern.map(p => p.sentiment);
        const trend = sentiments[sentiments.length - 1] - sentiments[0];
        
        if (trend > 0.1) return 'improving throughout the day';
        if (trend < -0.1) return 'declining throughout the day';
        return 'stable throughout the day';
    }

    async storeDailySummary(summary) {
        const transaction = this.db.transaction(['daily'], 'readwrite');
        const store = transaction.objectStore('daily');
        await store.put(summary);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMoodSystem;
}