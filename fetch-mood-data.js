// fetch-mood-data.js - Fixed version with proper authentication
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const config = {
    handle: process.env.BLUESKY_HANDLE,
    appPassword: process.env.BLUESKY_PASSWORD
};

class BlueSkyAuthenticatedClient {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.session = null;
    }

    async authenticate() {
        if (!config.handle || !config.appPassword) {
            console.log('❌ No Bluesky credentials found in GitHub Secrets');
            console.log('   Please add BLUESKY_HANDLE and BLUESKY_PASSWORD to repository secrets');
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
                console.error(`❌ Authentication failed: ${response.status} ${response.statusText}`);
                console.error('Response:', responseText.substring(0, 200));
                return false;
            }

            const data = JSON.parse(responseText);
            if (data.accessJwt && data.refreshJwt) {
                this.accessToken = data.accessJwt;
                this.refreshToken = data.refreshJwt;
                this.session = data;
                // Tokens typically expire after 2 hours
                this.tokenExpiry = Date.now() + (2 * 60 * 60 * 1000);
                
                console.log('✅ Successfully authenticated with Bluesky');
                console.log(`   Access token expires in ~2 hours`);
                return true;
            } else {
                console.error('❌ No access tokens in authentication response');
                return false;
            }
        } catch (error) {
            console.error('❌ Authentication error:', error.message);
            return false;
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) {
            console.log('⚠️  No refresh token available, re-authenticating...');
            return await this.authenticate();
        }

        try {
            console.log('🔄 Refreshing access token...');
            
            const response = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.refreshToken}`,
                    'User-Agent': 'WorldMoodTracker/1.0'
                }
            });

            if (!response.ok) {
                console.log('⚠️  Token refresh failed, re-authenticating...');
                return await this.authenticate();
            }

            const data = await response.json();
            if (data.accessJwt) {
                this.accessToken = data.accessJwt;
                this.refreshToken = data.refreshJwt || this.refreshToken;
                this.tokenExpiry = Date.now() + (2 * 60 * 60 * 1000);
                
                console.log('✅ Access token refreshed successfully');
                return true;
            }
        } catch (error) {
            console.error('❌ Token refresh error:', error.message);
            return await this.authenticate();
        }
    }

    async ensureValidToken() {
        // Check if token is expired or will expire soon (15 minutes buffer)
        const bufferTime = 15 * 60 * 1000; // 15 minutes
        
        if (!this.accessToken || !this.tokenExpiry || Date.now() > (this.tokenExpiry - bufferTime)) {
            console.log('🔄 Token expired or expiring soon, refreshing...');
            return await this.refreshAccessToken();
        }
        
        return true;
    }

    async searchPosts(query, limit = 25) {
        // Ensure we have a valid token
        const hasValidToken = await this.ensureValidToken();
        if (!hasValidToken) {
            console.error(`❌ Cannot search without valid authentication`);
            return [];
        }

        try {
            console.log(`🔍 Searching "${query}" (authenticated request)...`);
            
            const headers = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'User-Agent': 'WorldMoodTracker/1.0'
            };

            // Only use authenticated endpoint - public endpoints are broken
            const url = `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`;
            
            const response = await fetch(url, { 
                headers,
                timeout: 15000 // 15 second timeout
            });

            const responseText = await response.text();
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('🔄 Token expired during request, refreshing and retrying...');
                    const refreshed = await this.refreshAccessToken();
                    if (refreshed) {
                        // Retry the request with new token
                        return await this.searchPosts(query, limit);
                    }
                }
                
                console.log(`⚠️  Search failed: ${response.status} ${response.statusText}`);
                console.log('Response preview:', responseText.substring(0, 200));
                return [];
            }

            // Check if response is actually JSON
            if (responseText.trim().startsWith('<')) {
                console.log(`⚠️  Received HTML instead of JSON for query "${query}"`);
                return [];
            }

            const data = JSON.parse(responseText);
            const posts = data.posts || [];
            console.log(`✅ Found ${posts.length} posts for "${query}"`);
            return posts;

        } catch (error) {
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                console.log(`⏰ Request timeout for query "${query}"`);
            } else {
                console.log(`❌ Search error for "${query}":`, error.message);
            }
            return [];
        }
    }
}
