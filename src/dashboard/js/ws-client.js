/**
 * WebSocket Client for L2 Bot Dashboard
 * Features: Auto-reconnect with exponential backoff, channel subscription, event dispatching
 * Supports: Shared mode (port 3000/ws) and Standalone mode (port 8080)
 */

class L2WsClient extends EventTarget {
    constructor(url = null) {
        super();
        this.url = url || this.buildWsUrl();
        this.ws = null;
        
        // Reconnect configuration with exponential backoff
        this.reconnectDelay = 1000;      // Initial delay: 1 second
        this.maxReconnectDelay = 30000;  // Maximum delay: 30 seconds
        this.reconnectMultiplier = 2;    // Double the delay each time
        this.reconnectTimer = null;
        this.shouldReconnect = true;     // Flag to prevent reconnect after manual disconnect
        
        this.subscribedChannels = ['system', 'character', 'combat', 'world'];
        this.isConnected = false;
        this.connectionAttempts = 0;
        
        // Connection mode: 'shared' (port 3000/ws) or 'standalone' (port 8080)
        this.mode = 'shared';
    }

    /**
     * Build WebSocket URL from current location and mode
     */
    buildWsUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        
        // Get token from URL query param
        const token = new URLSearchParams(window.location.search).get('token');
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        
        if (this.mode === 'standalone') {
            return `${protocol}//${host}:8080${tokenParam}`;
        }
        
        // Shared mode - use same port as HTTP
        return `${protocol}//${window.location.host}/ws${tokenParam}`;
    }
    
    /**
     * Set connection mode and rebuild URL
     * @param {'shared'|'standalone'} mode 
     */
    setMode(mode) {
        if (this.mode === mode) return;
        
        const wasConnected = this.isConnected;
        
        // Disconnect if connected
        if (wasConnected) {
            this.disconnect();
        }
        
        this.mode = mode;
        this.url = this.buildWsUrl();
        
        console.log(`[WS] Mode changed to: ${mode}, URL: ${this.url}`);
        
        // Reconnect if was connected
        if (wasConnected) {
            this.shouldReconnect = true;
            this.connect();
        }
        
        // Dispatch mode change event
        this.dispatchEvent(new CustomEvent('modeChanged', { 
            detail: { mode, url: this.url }
        }));
    }
    
    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            return;
        }

        if (this.ws?.readyState === WebSocket.CONNECTING) {
            console.log('[WS] Connection already in progress');
            return;
        }

        this.connectionAttempts++;
        console.log(`[WS] Connecting to ${this.url} (attempt ${this.connectionAttempts})`);
        
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = (event) => {
                console.log('[WS] Connected');
                this.isConnected = true;
                this.connectionAttempts = 0;
                this.resetReconnectDelay();
                this.clearReconnectTimer();
                
                // Subscribe to channels
                this.subscribe(this.subscribedChannels);
                
                // Dispatch event
                this.dispatchEvent(new CustomEvent('connected', { detail: event }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[WS] Failed to parse message:', error);
                    this.dispatchEvent(new CustomEvent('error', { 
                        detail: { type: 'parse_error', error, raw: event.data }
                    }));
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                this.dispatchEvent(new CustomEvent('error', { detail: error }));
            };

            this.ws.onclose = (event) => {
                console.log(`[WS] Closed: code=${event.code}, reason=${event.reason || 'none'}`);
                this.isConnected = false;
                this.dispatchEvent(new CustomEvent('disconnected', { detail: event }));
                
                // Auto-reconnect with exponential backoff
                if (this.shouldReconnect && !this.reconnectTimer) {
                    this.scheduleReconnect();
                }
            };

        } catch (error) {
            console.error('[WS] Failed to create connection:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            
            if (this.shouldReconnect) {
                this.scheduleReconnect();
            }
        }
    }

    /**
     * Handle incoming message
     */
    handleMessage(message) {
        // Handle pong
        if (message.type === 'pong') {
            this.dispatchEvent(new CustomEvent('pong', { detail: message }));
        }
        
        // Dispatch generic message event
        this.dispatchEvent(new CustomEvent('message', { detail: message }));
        
        // Dispatch typed event based on message type
        if (message.type) {
            this.dispatchEvent(new CustomEvent(message.type, { detail: message.payload || message.data }));
        }
        
        // Dispatch channel event
        if (message.channel) {
            this.dispatchEvent(new CustomEvent(`channel:${message.channel}`, { 
                detail: message 
            }));
        }
        
        // Dispatch 'any' event for catch-all listeners
        this.dispatchEvent(new CustomEvent('any', { detail: message }));
    }

    /**
     * Send message to server
     */
    send(type, data = null) {
        if (!this.isConnected || !this.ws) {
            console.warn('[WS] Not connected, cannot send message');
            return false;
        }

        const message = { type };
        if (data) Object.assign(message, data);

        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('[WS] Failed to send message:', error);
            return false;
        }
    }

    /**
     * Subscribe to channels
     */
    subscribe(channels) {
        // Merge with existing subscriptions
        this.subscribedChannels = [...new Set([...this.subscribedChannels, ...channels])];
        
        if (this.isConnected) {
            this.send('subscribe', { channels });
            console.log('[WS] Subscribed to channels:', channels);
        }
    }

    /**
     * Unsubscribe from channels
     */
    unsubscribe(channels) {
        this.subscribedChannels = this.subscribedChannels.filter(c => !channels.includes(c));
        
        if (this.isConnected) {
            this.send('unsubscribe', { channels });
        }
    }

    /**
     * Send ping
     */
    ping() {
        return this.send('ping');
    }

    /**
     * Disconnect from server (no auto-reconnect)
     */
    disconnect() {
        console.log('[WS] Disconnecting (no reconnect)');
        this.shouldReconnect = false;
        this.clearReconnectTimer();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
    }

    /**
     * Schedule reconnect with exponential backoff
     */
    scheduleReconnect() {
        if (this.reconnectTimer) return;
        if (!this.shouldReconnect) return;
        
        console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms...`);
        this.dispatchEvent(new CustomEvent('reconnecting', { 
            detail: { delay: this.reconnectDelay, attempt: this.connectionAttempts + 1 }
        }));
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
        
        // Exponential backoff: double the delay for next time (up to max)
        this.reconnectDelay = Math.min(
            this.reconnectDelay * this.reconnectMultiplier,
            this.maxReconnectDelay
        );
    }

    /**
     * Clear reconnect timer
     */
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Reset reconnect delay to initial value
     */
    resetReconnectDelay() {
        this.reconnectDelay = 1000;
    }

    /**
     * Check connection status
     */
    get status() {
        if (!this.ws) return 'DISCONNECTED';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'CONNECTED';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }

    /**
     * Get connection info
     */
    getInfo() {
        return {
            status: this.status,
            isConnected: this.isConnected,
            url: this.url,
            subscribedChannels: [...this.subscribedChannels],
            reconnectDelay: this.reconnectDelay,
            connectionAttempts: this.connectionAttempts
        };
    }
}

// Create global instance
const wsClient = new L2WsClient();
