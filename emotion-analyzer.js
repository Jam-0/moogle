// World Mood Tracker - Emotion Analysis Engine
// Combines NRC Emotion Lexicon and VADER sentiment analysis

class EmotionAnalyzer {
    constructor() {
        this.initializeLexicons();
    }

    initializeLexicons() {
        // NRC Emotion Lexicon (subset for demonstration)
        // In production, load from a complete JSON file
        this.nrcLexicon = {
            // Format: word -> { emotions: [], sentiment: 'positive'|'negative'|'neutral' }
            'happy': { emotions: ['joy', 'trust'], sentiment: 'positive' },
            'sad': { emotions: ['sadness'], sentiment: 'negative' },
            'angry': { emotions: ['anger'], sentiment: 'negative' },
            'fear': { emotions: ['fear', 'anticipation'], sentiment: 'negative' },
            'love': { emotions: ['joy', 'trust'], sentiment: 'positive' },
            'hate': { emotions: ['anger', 'disgust'], sentiment: 'negative' },
            'excited': { emotions: ['joy', 'anticipation'], sentiment: 'positive' },
            'calm': { emotions: ['trust'], sentiment: 'positive' },
            'anxious': { emotions: ['fear', 'anticipation'], sentiment: 'negative' },
            'hope': { emotions: ['anticipation', 'joy'], sentiment: 'positive' },
            'despair': { emotions: ['sadness', 'fear'], sentiment: 'negative' },
            'surprise': { emotions: ['surprise'], sentiment: 'neutral' },
            'disgust': { emotions: ['disgust'], sentiment: 'negative' },
            'trust': { emotions: ['trust'], sentiment: 'positive' },
            'anticipation': { emotions: ['anticipation'], sentiment: 'neutral' },
            'wonderful': { emotions: ['joy', 'surprise'], sentiment: 'positive' },
            'terrible': { emotions: ['fear', 'sadness', 'anger'], sentiment: 'negative' },
            'amazing': { emotions: ['joy', 'surprise'], sentiment: 'positive' },
            'awful': { emotions: ['disgust', 'anger'], sentiment: 'negative' },
            'beautiful': { emotions: ['joy'], sentiment: 'positive' },
            'ugly': { emotions: ['disgust'], sentiment: 'negative' },
            'brilliant': { emotions: ['joy', 'anticipation'], sentiment: 'positive' },
            'stupid': { emotions: ['anger', 'disgust'], sentiment: 'negative' },
            'fantastic': { emotions: ['joy'], sentiment: 'positive' },
            'horrible': { emotions: ['fear', 'disgust'], sentiment: 'negative' }
        };

        // VADER lexicon adjustments for social media
        this.vaderAdjustments = {
            // Booster words that intensify sentiment
            'very': 0.3,
            'really': 0.3,
            'so': 0.3,
            'extremely': 0.4,
            'absolutely': 0.4,
            'totally': 0.3,
            'quite': 0.2,
            'just': 0.1,
            'almost': -0.1,
            'barely': -0.2,
            'hardly': -0.2,
            'scarcely': -0.2,
            
            // Negation words
            'not': -0.5,
            'never': -0.5,
            'no': -0.5,
            'neither': -0.5,
            'nor': -0.5,
            'cannot': -0.5,
            
            // Social media specific
            'lol': 0.3,
            'haha': 0.3,
            'omg': 0.4,
            'wtf': -0.4,
            'smh': -0.3,
            'fml': -0.5
        };

        // Emoticon sentiment scores
        this.emoticons = {
            ':)': 0.5, ':-)': 0.5, ':]': 0.5, ':D': 0.7, ':-D': 0.7,
            ':(': -0.5, ':-(': -0.5, ':[': -0.5, ':\'(': -0.7,
            ':P': 0.3, ':-P': 0.3, ';)': 0.4, ';-)': 0.4,
            ':|': 0, ':-|': 0, ':/': -0.2, ':-/': -0.2,
            '<3': 0.7, '</3': -0.7, ':*': 0.6, ':-*': 0.6
        };

        // Emoji to emotion mapping
        this.emojiEmotions = {
            '😊': ['joy'], '😃': ['joy'], '😄': ['joy'], '😁': ['joy'],
            '😢': ['sadness'], '😭': ['sadness'], '😥': ['sadness'],
            '😡': ['anger'], '😠': ['anger'], '🤬': ['anger'],
            '😨': ['fear'], '😱': ['fear', 'surprise'], '😰': ['fear', 'anticipation'],
            '😴': ['trust'], '😌': ['trust'], '🥰': ['joy', 'trust'],
            '🤔': ['anticipation'], '😏': ['anticipation'], '🤗': ['trust', 'joy'],
            '😮': ['surprise'], '😲': ['surprise'], '😯': ['surprise'],
            '🤢': ['disgust'], '🤮': ['disgust'], '😖': ['disgust']
        };
    }

    // Main analysis function
    analyzeText(text) {
        // Preprocess text
        const processedText = this.preprocessText(text);
        const tokens = this.tokenize(processedText);
        
        // Run both analyses
        const nrcResults = this.analyzeWithNRC(tokens);
        const vaderResults = this.analyzeWithVADER(tokens, text);
        
        // Combine results
        const hybridResults = this.combineAnalyses(nrcResults, vaderResults);
        
        return hybridResults;
    }

    // Preprocess text for analysis
    preprocessText(text) {
        // Convert to lowercase but preserve emoticons
        let processed = text.toLowerCase();
        
        // Preserve capitalization information for VADER
        const capsCount = (text.match(/[A-Z]/g) || []).length;
        const capsRatio = capsCount / text.length;
        
        // Remove URLs
        processed = processed.replace(/https?:\/\/[^\s]+/g, '');
        
        // Remove mentions but keep the sentiment context
        processed = processed.replace(/@\w+/g, '');
        
        // Normalize repeated characters (e.g., "sooooo" -> "so")
        processed = processed.replace(/(.)\1{2,}/g, '$1$1');
        
        return { text: processed, capsRatio };
    }

    // Tokenize text
    tokenize(processedData) {
        const { text } = processedData;
        
        // Split on whitespace and punctuation, but keep emoticons intact
        const tokens = text.match(/:[-)DPp(|/*]+|<3|<\/3|\b\w+\b|[^\s\w]+/g) || [];
        
        return tokens.filter(token => token.trim().length > 0);
    }

    // NRC Emotion Lexicon analysis
    analyzeWithNRC(tokens) {
        const emotionCounts = {
            joy: 0,
            trust: 0,
            fear: 0,
            surprise: 0,
            sadness: 0,
            disgust: 0,
            anger: 0,
            anticipation: 0
        };
        
        let positiveCount = 0;
        let negativeCount = 0;
        let emotionWordCount = 0;

        tokens.forEach(token => {
            const cleanToken = token.replace(/[^\w]/g, '');
            
            if (this.nrcLexicon[cleanToken]) {
                const entry = this.nrcLexicon[cleanToken];
                emotionWordCount++;
                
                // Count emotions
                entry.emotions.forEach(emotion => {
                    emotionCounts[emotion]++;
                });
                
                // Count sentiment
                if (entry.sentiment === 'positive') positiveCount++;
                else if (entry.sentiment === 'negative') negativeCount++;
            }
            
            // Check emojis
            if (this.emojiEmotions[token]) {
                this.emojiEmotions[token].forEach(emotion => {
                    emotionCounts[emotion] += 0.5; // Emojis have half weight
                });
                emotionWordCount += 0.5;
            }
        });

        // Calculate emotion frequencies
        const totalWords = tokens.length || 1;
        const emotionFrequencies = {};
        
        Object.keys(emotionCounts).forEach(emotion => {
            emotionFrequencies[emotion] = emotionCounts[emotion] / totalWords;
        });

        // Identify dominant emotions (top 2)
        const sortedEmotions = Object.entries(emotionFrequencies)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, score]) => score > 0);
        
        const dominantEmotions = sortedEmotions.slice(0, 2).map(([emotion]) => emotion);

        return {
            emotions: emotionCounts,
            emotionFrequencies,
            dominantEmotions,
            sentimentBalance: (positiveCount - negativeCount) / (emotionWordCount || 1),
            emotionDensity: emotionWordCount / totalWords
        };
    }

    // VADER-style sentiment analysis
    analyzeWithVADER(tokens, originalText) {
        let sentimentScore = 0;
        let wordCount = 0;

        // Check for capitalization emphasis
        const capsBoost = originalText.toUpperCase() === originalText && originalText.length > 10 ? 0.2 : 0;

        // Analyze each token
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const cleanToken = token.replace(/[^\w]/g, '');
            
            // Check if it's a sentiment word
            let tokenScore = 0;
            
            // Check NRC lexicon
            if (this.nrcLexicon[cleanToken]) {
                const sentiment = this.nrcLexicon[cleanToken].sentiment;
                if (sentiment === 'positive') tokenScore = 0.5;
                else if (sentiment === 'negative') tokenScore = -0.5;
                wordCount++;
            }
            
            // Check emoticons
            if (this.emoticons[token]) {
                tokenScore = this.emoticons[token];
                wordCount++;
            }
            
            // Apply boosters and negations
            if (tokenScore !== 0) {
                // Check previous words for boosters/negations
                for (let j = 1; j <= 3 && i - j >= 0; j++) {
                    const prevToken = tokens[i - j].toLowerCase();
                    
                    if (this.vaderAdjustments[prevToken]) {
                        if (prevToken === 'not' || prevToken === 'never' || prevToken === 'no') {
                            tokenScore *= -1; // Flip sentiment
                        } else {
                            tokenScore *= (1 + this.vaderAdjustments[prevToken]);
                        }
                        break;
                    }
                }
                
                // Check for exclamation points (intensifier)
                if (originalText.includes(token + '!')) {
                    tokenScore *= 1.2;
                }
                
                // Check for question marks (uncertainty)
                if (originalText.includes(token + '?')) {
                    tokenScore *= 0.8;
                }
            }
            
            sentimentScore += tokenScore;
        }

        // Normalize score
        const normalizedScore = wordCount > 0 ? sentimentScore / wordCount : 0;
        
        // Apply capitalization boost
        const finalScore = Math.max(-1, Math.min(1, normalizedScore + capsBoost));

        // Determine sentiment category
        let sentimentCategory;
        if (finalScore >= 0.5) sentimentCategory = 'very positive';
        else if (finalScore >= 0.1) sentimentCategory = 'positive';
        else if (finalScore <= -0.5) sentimentCategory = 'very negative';
        else if (finalScore <= -0.1) sentimentCategory = 'negative';
        else sentimentCategory = 'neutral';

        return {
            score: finalScore,
            category: sentimentCategory,
            intensity: Math.abs(finalScore),
            wordCount: wordCount
        };
    }

    // Combine NRC and VADER results
    combineAnalyses(nrcResults, vaderResults) {
        // Weight: 60% NRC emotions, 40% VADER sentiment
        const combinedScore = (nrcResults.sentimentBalance * 0.6) + (vaderResults.score * 0.4);
        
        // Determine primary emotion based on both analyses
        let primaryEmotion = nrcResults.dominantEmotions[0] || 'neutral';
        
        // Adjust based on VADER intensity
        if (vaderResults.intensity > 0.7) {
            if (vaderResults.score > 0 && !['joy', 'trust', 'anticipation'].includes(primaryEmotion)) {
                primaryEmotion = 'joy';
            } else if (vaderResults.score < 0 && !['anger', 'fear', 'sadness'].includes(primaryEmotion)) {
                primaryEmotion = 'anger';
            }
        }

        // Generate emotion profile
        const emotionProfile = {
            primary: primaryEmotion,
            secondary: nrcResults.dominantEmotions[1] || 'neutral',
            intensity: vaderResults.intensity,
            valence: combinedScore > 0 ? 'positive' : combinedScore < 0 ? 'negative' : 'neutral',
            confidence: Math.min(nrcResults.emotionDensity * 2, 1) // Higher density = higher confidence
        };

        return {
            emotionProfile,
            sentimentScore: combinedScore,
            nrcEmotions: nrcResults.emotions,
            vaderCategory: vaderResults.category,
            dominantEmotions: nrcResults.dominantEmotions,
            rawScores: {
                nrc: nrcResults,
                vader: vaderResults
            }
        };
    }

    // Batch analyze multiple texts (for processing many posts)
    batchAnalyze(texts, options = {}) {
        const results = texts.map(text => this.analyzeText(text));
        
        // Aggregate results
        const aggregated = this.aggregateResults(results, options);
        
        return aggregated;
    }

    // Aggregate emotion results from multiple texts
    aggregateResults(results, options = {}) {
        const { weightByIntensity = true, timeDecay = false } = options;
        
        // Initialize aggregates
        const emotionTotals = {
            joy: 0, trust: 0, fear: 0, surprise: 0,
            sadness: 0, disgust: 0, anger: 0, anticipation: 0
        };
        
        let totalSentiment = 0;
        let totalIntensity = 0;
        let count = results.length;

        // Process each result
        results.forEach((result, index) => {
            const weight = weightByIntensity ? result.emotionProfile.intensity : 1;
            const timeWeight = timeDecay ? Math.exp(-index / count) : 1; // Recent posts weighted more
            const finalWeight = weight * timeWeight;
            
            // Add emotions
            Object.keys(result.nrcEmotions).forEach(emotion => {
                emotionTotals[emotion] += result.nrcEmotions[emotion] * finalWeight;
            });
            
            totalSentiment += result.sentimentScore * finalWeight;
            totalIntensity += result.emotionProfile.intensity;
        });

        // Normalize
        const avgSentiment = totalSentiment / count;
        const avgIntensity = totalIntensity / count;
        
        // Find dominant emotions
        const sortedEmotions = Object.entries(emotionTotals)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, score]) => score > 0);
        
        const dominantEmotions = sortedEmotions.slice(0, 3).map(([emotion]) => emotion);

        // Determine overall mood category
        const moodCategory = this.categorizeMood(avgSentiment, dominantEmotions, avgIntensity);

        return {
            sentimentScore: avgSentiment,
            intensity: avgIntensity,
            dominantEmotions,
            emotionDistribution: emotionTotals,
            moodCategory,
            sampleSize: count
        };
    }

    // Categorize mood based on sentiment and emotions
    categorizeMood(sentiment, dominantEmotions, intensity) {
        const primary = dominantEmotions[0];
        
        if (sentiment > 0.5 && intensity > 0.6) {
            if (primary === 'joy') return 'euphoric';
            if (primary === 'trust') return 'confident';
            if (primary === 'anticipation') return 'excited';
            return 'very positive';
        } else if (sentiment > 0.2) {
            if (primary === 'joy') return 'cheerful';
            if (primary === 'trust') return 'content';
            if (primary === 'anticipation') return 'optimistic';
            return 'positive';
        } else if (sentiment < -0.5 && intensity > 0.6) {
            if (primary === 'anger') return 'furious';
            if (primary === 'fear') return 'terrified';
            if (primary === 'sadness') return 'despondent';
            return 'very negative';
        } else if (sentiment < -0.2) {
            if (primary === 'anger') return 'frustrated';
            if (primary === 'fear') return 'anxious';
            if (primary === 'sadness') return 'melancholic';
            return 'negative';
        } else {
            if (primary === 'surprise') return 'curious';
            if (dominantEmotions.includes('anticipation')) return 'contemplative';
            return 'neutral';
        }
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmotionAnalyzer;
}