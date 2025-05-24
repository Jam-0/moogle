// World Mood Tracker - Weather Metaphor Generator
// Converts emotion analysis results to intuitive weather descriptions

class WeatherMetaphorGenerator {
    constructor() {
        this.initializeMetaphors();
    }

    initializeMetaphors() {
        // Base weather patterns for emotions
        this.emotionWeatherMap = {
            // Positive emotions
            joy: {
                high: ['brilliant sunshine', 'radiant skies', 'golden rays', 'dazzling daylight'],
                medium: ['sunny spells', 'warm sunshine', 'bright skies', 'cheerful rays'],
                low: ['patches of sun', 'gentle sunshine', 'soft light', 'mild brightness']
            },
            trust: {
                high: ['crystal clear skies', 'perfect visibility', 'serene atmosphere', 'stable conditions'],
                medium: ['clear skies', 'calm weather', 'steady conditions', 'peaceful atmosphere'],
                low: ['mostly clear', 'settled weather', 'gentle conditions', 'quiet skies']
            },
            anticipation: {
                high: ['electric atmosphere', 'charged air', 'building energy', 'dynamic conditions'],
                medium: ['fresh breeze', 'changing winds', 'stirring air', 'shifting patterns'],
                low: ['light breeze', 'subtle changes', 'gentle shifts', 'mild variations']
            },
            
            // Negative emotions
            anger: {
                high: ['raging storms', 'violent thunder', 'fierce lightning', 'turbulent tempests'],
                medium: ['stormy weather', 'thunder rumbling', 'lightning strikes', 'rough conditions'],
                low: ['scattered storms', 'distant thunder', 'occasional lightning', 'unsettled weather']
            },
            fear: {
                high: ['ominous clouds', 'threatening skies', 'dark shadows', 'foreboding atmosphere'],
                medium: ['grey clouds gathering', 'uncertain skies', 'shadowy conditions', 'uneasy weather'],
                low: ['cloudy patches', 'overcast moments', 'slight shadows', 'mild uncertainty']
            },
            sadness: {
                high: ['heavy downpour', 'relentless rain', 'deep grey skies', 'overwhelming gloom'],
                medium: ['steady rain', 'grey skies', 'persistent drizzle', 'melancholic weather'],
                low: ['light rain', 'misty conditions', 'gentle drizzle', 'soft grey clouds']
            },
            disgust: {
                high: ['toxic fog', 'suffocating haze', 'polluted air', 'noxious atmosphere'],
                medium: ['thick fog', 'murky conditions', 'hazy air', 'unpleasant atmosphere'],
                low: ['light fog', 'misty air', 'slight haze', 'unclear conditions']
            },
            
            // Neutral emotion
            surprise: {
                high: ['sudden changes', 'unexpected shifts', 'dramatic transitions', 'surprising patterns'],
                medium: ['variable conditions', 'changing patterns', 'mixed weather', 'unpredictable shifts'],
                low: ['slight variations', 'minor changes', 'gentle surprises', 'mild shifts']
            }
        };

        // Sentiment modifiers
        this.sentimentModifiers = {
            veryPositive: {
                prefix: ['wonderfully', 'beautifully', 'magnificently', 'delightfully'],
                suffix: ['with promise ahead', 'and brightening', 'with rays of hope', 'and warming']
            },
            positive: {
                prefix: ['pleasantly', 'nicely', 'comfortably', 'gently'],
                suffix: ['with improvement', 'and clearing', 'with optimism', 'and settling']
            },
            neutral: {
                prefix: ['currently', 'presently', 'now showing', 'displaying'],
                suffix: ['holding steady', 'remaining stable', 'unchanging', 'consistent']
            },
            negative: {
                prefix: ['unfortunately', 'regrettably', 'showing', 'experiencing'],
                suffix: ['but may improve', 'though unstable', 'with caution advised', 'requiring patience']
            },
            veryNegative: {
                prefix: ['severely', 'intensely', 'deeply', 'heavily'],
                suffix: ['needing shelter', 'requiring care', 'demanding attention', 'calling for support']
            }
        };

        // Transition words for multiple emotions
        this.transitionWords = {
            contrasting: ['but', 'yet', 'however', 'though'],
            complementary: ['with', 'and', 'plus', 'alongside'],
            sequential: ['followed by', 'then', 'leading to', 'becoming']
        };

        // Time-based variations
        this.timeVariations = {
            morning: {
                modifiers: ['dawn', 'sunrise', 'early', 'fresh'],
                actions: ['breaking', 'emerging', 'awakening', 'beginning']
            },
            afternoon: {
                modifiers: ['midday', 'noon', 'afternoon'],
                actions: ['continuing', 'developing', 'progressing', 'building']
            },
            evening: {
                modifiers: ['dusk', 'sunset', 'twilight', 'evening'],
                actions: ['settling', 'calming', 'easing', 'transitioning']
            },
            night: {
                modifiers: ['nighttime', 'midnight', 'nocturnal', 'dark'],
                actions: ['deepening', 'quieting', 'resting', 'dreaming']
            }
        };
    }

    // Main generation function
    generateWeatherMetaphor(emotionData, options = {}) {
        const {
            sentimentScore,
            dominantEmotions,
            intensity,
            emotionDistribution
        } = emotionData;

        const {
            timeOfDay = 'day',
            includeModifiers = true,
            style = 'descriptive' // 'descriptive', 'poetic', 'simple'
        } = options;

        // Determine sentiment category
        const sentimentCategory = this.categorizeSentiment(sentimentScore);
        
        // Generate base weather description
        const baseWeather = this.generateBaseWeather(dominantEmotions, intensity, emotionDistribution);
        
        // Apply modifiers and style
        const styledWeather = this.applyStyle(baseWeather, sentimentCategory, style, includeModifiers);
        
        // Add time variations if not 'day'
        const finalWeather = timeOfDay !== 'day' 
            ? this.addTimeVariation(styledWeather, timeOfDay)
            : styledWeather;

        return finalWeather;
    }

    // Generate base weather description from emotions
    generateBaseWeather(dominantEmotions, intensity, distribution) {
        if (!dominantEmotions || dominantEmotions.length === 0) {
            return 'calm and neutral conditions';
        }

        const primary = dominantEmotions[0];
        const secondary = dominantEmotions[1];
        
        // Determine intensity level
        const intensityLevel = intensity > 0.7 ? 'high' : intensity > 0.4 ? 'medium' : 'low';
        
        // Get primary weather pattern
        const primaryWeather = this.getWeatherForEmotion(primary, intensityLevel);
        
        // If only one emotion or secondary is weak
        if (!secondary || !distribution[secondary] || distribution[secondary] < distribution[primary] * 0.3) {
            return primaryWeather;
        }
        
        // Combine with secondary emotion
        const secondaryWeather = this.getWeatherForEmotion(secondary, intensityLevel);
        const combination = this.combineWeatherPatterns(primaryWeather, secondaryWeather, primary, secondary);
        
        return combination;
    }

    // Get weather pattern for specific emotion and intensity
    getWeatherForEmotion(emotion, intensityLevel) {
        const patterns = this.emotionWeatherMap[emotion];
        if (!patterns) return 'variable conditions';
        
        const options = patterns[intensityLevel] || patterns['medium'];
        return options[Math.floor(Math.random() * options.length)];
    }

    // Combine two weather patterns
    combineWeatherPatterns(primary, secondary, primaryEmotion, secondaryEmotion) {
        // Determine relationship between emotions
        const positive = ['joy', 'trust', 'anticipation'];
        const negative = ['anger', 'fear', 'sadness', 'disgust'];
        
        const primaryPositive = positive.includes(primaryEmotion);
        const secondaryPositive = positive.includes(secondaryEmotion);
        
        let transition;
        if (primaryPositive === secondaryPositive) {
            // Same valence - complementary
            transition = this.transitionWords.complementary[Math.floor(Math.random() * this.transitionWords.complementary.length)];
        } else {
            // Different valence - contrasting
            transition = this.transitionWords.contrasting[Math.floor(Math.random() * this.transitionWords.contrasting.length)];
        }
        
        return `${primary} ${transition} ${secondary}`;
    }

    // Apply style and modifiers
    applyStyle(baseWeather, sentimentCategory, style, includeModifiers) {
        if (style === 'simple') {
            return baseWeather;
        }
        
        const modifiers = this.sentimentModifiers[sentimentCategory] || this.sentimentModifiers.neutral;
        
        if (style === 'poetic') {
            return this.createPoeticDescription(baseWeather, modifiers);
        }
        
        // Default descriptive style
        if (includeModifiers) {
            const prefix = modifiers.prefix[Math.floor(Math.random() * modifiers.prefix.length)];
            const suffix = modifiers.suffix[Math.floor(Math.random() * modifiers.suffix.length)];
            return `${prefix} ${baseWeather} ${suffix}`;
        }
        
        return baseWeather;
    }

    // Create poetic weather descriptions
    createPoeticDescription(baseWeather, modifiers) {
        const poeticTemplates = [
            `skies painted with ${baseWeather}`,
            `the atmosphere whispers of ${baseWeather}`,
            `nature's canvas shows ${baseWeather}`,
            `the emotional climate reveals ${baseWeather}`,
            `horizons touched by ${baseWeather}`
        ];
        
        const template = poeticTemplates[Math.floor(Math.random() * poeticTemplates.length)];
        const suffix = modifiers.suffix[Math.floor(Math.random() * modifiers.suffix.length)];
        
        return `${template}, ${suffix}`;
    }

    // Add time-of-day variations
    addTimeVariation(weather, timeOfDay) {
        const timeData = this.timeVariations[timeOfDay];
        if (!timeData) return weather;
        
        const modifier = timeData.modifiers[Math.floor(Math.random() * timeData.modifiers.length)];
        const action = timeData.actions[Math.floor(Math.random() * timeData.actions.length)];
        
        // Insert time reference naturally
        if (weather.includes('with')) {
            return weather.replace('with', `with ${modifier} ${action} and`);
        } else if (weather.includes('and')) {
            return weather.replace('and', `and ${modifier} ${action},`);
        } else {
            return `${modifier} ${action}, ${weather}`;
        }
    }

    // Categorize sentiment score
    categorizeSentiment(score) {
        if (score >= 0.5) return 'veryPositive';
        if (score >= 0.1) return 'positive';
        if (score <= -0.5) return 'veryNegative';
        if (score <= -0.1) return 'negative';
        return 'neutral';
    }

    // Generate comparison metaphor
    generateComparisonMetaphor(region1Data, region2Data) {
        const weather1 = this.generateWeatherMetaphor(region1Data, { style: 'simple' });
        const weather2 = this.generateWeatherMetaphor(region2Data, { style: 'simple' });
        
        const sentiment1 = region1Data.sentimentScore;
        const sentiment2 = region2Data.sentimentScore;
        const difference = Math.abs(sentiment1 - sentiment2);
        
        if (difference < 0.1) {
            return `Both regions share similar conditions: ${weather1}`;
        } else if (sentiment1 > sentiment2) {
            return `Brighter ${weather1} compared to ${weather2}`;
        } else {
            return `More challenging ${weather1} while enjoying ${weather2}`;
        }
    }

    // Generate momentum description
    generateMomentumDescription(currentScore, previousScore) {
        const change = currentScore - previousScore;
        const absChange = Math.abs(change);
        
        if (absChange < 0.05) {
            return { icon: '→', text: 'holding steady' };
        }
        
        if (change > 0) {
            if (absChange > 0.3) {
                return { icon: '↗️', text: 'rapidly brightening' };
            } else if (absChange > 0.15) {
                return { icon: '↗️', text: 'steadily improving' };
            } else {
                return { icon: '↗️', text: 'gently brightening' };
            }
        } else {
            if (absChange > 0.3) {
                return { icon: '↘️', text: 'quickly darkening' };
            } else if (absChange > 0.15) {
                return { icon: '↘️', text: 'gradually declining' };
            } else {
                return { icon: '↘️', text: 'slightly dimming' };
            }
        }
    }

    // Generate alert for extreme conditions
    generateWeatherAlert(emotionData) {
        const { sentimentScore, intensity, dominantEmotions } = emotionData;
        
        // Check for extreme negative conditions
        if (sentimentScore < -0.7 && intensity > 0.7) {
            if (dominantEmotions.includes('anger')) {
                return 'Storm warning: High emotional turbulence detected';
            } else if (dominantEmotions.includes('fear')) {
                return 'Advisory: Dark clouds of uncertainty prevailing';
            } else if (dominantEmotions.includes('sadness')) {
                return 'Heavy conditions: Emotional support recommended';
            }
        }
        
        // Check for extreme positive conditions
        if (sentimentScore > 0.7 && intensity > 0.7) {
            return 'Exceptional conditions: Radiant positivity detected';
        }
        
        return null;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherMetaphorGenerator;
}