/**
 * REST API Client for L2 Bot Dashboard
 */

class L2ApiClient {
    constructor(baseUrl = '/api/v1') {
        this.baseUrl = baseUrl;
        this.requestId = 0;
        this.apiKey = new URLSearchParams(window.location.search).get('token') || '';
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${++this.requestId}_${Date.now().toString(36)}`;
    }

    /**
     * Make API request
     */
    async request(method, endpoint, data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Id': this.generateRequestId()
            }
        };

        // Add API key if present
        if (this.apiKey) {
            options.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error?.message || `HTTP ${response.status}`);
            }
            
            return result.data;
        } catch (error) {
            console.error(`API Error [${method} ${endpoint}]:`, error);
            throw error;
        }
    }

    // ==================== Status ====================
    
    async getStatus() {
        return this.request('GET', '/status');
    }

    // ==================== Connection ====================
    
    async connect(overrideConfig = null) {
        const data = overrideConfig ? { overrideConfig } : {};
        return this.request('POST', '/connect', data);
    }

    async disconnect() {
        return this.request('POST', '/connect/disconnect');
    }

    async reconnect(delayMs = 3000) {
        return this.request('POST', '/connect/reconnect', { delayMs });
    }

    // ==================== Character ====================
    
    async getCharacter() {
        return this.request('GET', '/character');
    }

    async getCharacterStats() {
        return this.request('GET', '/character/stats');
    }

    async getCharacterBuffs() {
        return this.request('GET', '/character/buffs');
    }

    // ==================== Inventory ====================
    
    async getInventory(type = null, equipped = null) {
        let endpoint = '/inventory';
        const params = [];
        if (type) params.push(`type=${type}`);
        if (equipped !== null) params.push(`equipped=${equipped}`);
        if (params.length) endpoint += `?${params.join('&')}`;
        return this.request('GET', endpoint);
    }

    async useItem(objectId) {
        return this.request('POST', '/inventory/use', { objectId });
    }

    async dropItem(objectId, count = 1, position = null) {
        const data = { objectId, count };
        if (position) data.position = position;
        return this.request('POST', '/inventory/drop', data);
    }

    // ==================== Target ====================
    
    async getTarget() {
        return this.request('GET', '/target');
    }

    async setTarget(objectId) {
        return this.request('POST', '/target/set', { objectId });
    }

    async clearTarget() {
        return this.request('POST', '/target/clear');
    }

    // ==================== Combat ====================
    
    async attack(objectId = null) {
        const data = {};
        if (objectId) data.objectId = objectId;
        return this.request('POST', '/combat/attack', data);
    }

    async stopAttack() {
        return this.request('POST', '/combat/stop');
    }

    // ==================== Target ====================
    
    async nextTarget() {
        return this.request('POST', '/target/next');
    }

    async nextTargetAndAttack() {
        return this.request('POST', '/target/next-attack');
    }

    async getCurrentTarget() {
        return this.request('GET', '/target');
    }

    // ==================== Nearby ====================
    
    async getNearbyNpcs(radius = 600, attackable = null, alive = true) {
        let endpoint = `/nearby/npcs?radius=${radius}`;
        if (attackable !== null) endpoint += `&attackable=${attackable}`;
        if (alive !== null) endpoint += `&alive=${alive}`;
        return this.request('GET', endpoint);
    }

    async getNearbyPlayers(radius = 600) {
        return this.request('GET', `/nearby/players?radius=${radius}`);
    }

    async getNearbyItems(radius = 600) {
        return this.request('GET', `/nearby/items?radius=${radius}`);
    }

    async pickupItem(objectId) {
        return this.request('POST', '/nearby/pickup', { objectId });
    }

    // ==================== Movement ====================
    
    async moveTo(x, y, z, validateRange = true) {
        return this.request('POST', '/move/to', { x, y, z, validateRange });
    }

    async stopMove() {
        return this.request('POST', '/move/stop');
    }

    async getMoveStatus() {
        return this.request('GET', '/move/status');
    }

    async follow(objectId, minDistance = 80) {
        return this.request('POST', '/move/follow', { objectId, minDistance });
    }

    // ==================== Chat ====================
    
    async sendChat(channel, message, target = null) {
        const data = { channel, message };
        if (target) data.target = target;
        return this.request('POST', '/chat/send', data);
    }

    async getChatHistory(channel = null, limit = 50, since = null) {
        let endpoint = `/chat/history?limit=${limit}`;
        if (channel) endpoint += `&channel=${channel}`;
        if (since) endpoint += `&since=${since}`;
        return this.request('GET', endpoint);
    }

    // ==================== Skills ====================
    
    async getSkills() {
        return this.request('GET', '/skills');
    }

    async useSkill(skillId, level, targetObjectId = null, ctrlPressed = false, shiftPressed = false) {
        return this.request('POST', '/skills/use', {
            skillId,
            level,
            targetObjectId,
            ctrlPressed,
            shiftPressed
        });
    }

    async getShortcuts() {
        return this.request('GET', '/skills/shortcuts');
    }

    // ==================== Party ====================
    
    async getParty() {
        return this.request('GET', '/party');
    }

    async inviteToParty(playerName) {
        return this.request('POST', '/party/invite', { playerName });
    }

    async leaveParty() {
        return this.request('POST', '/party/leave');
    }

    // ==================== Social ====================
    
    async socialAction(actionId) {
        return this.request('POST', '/social/action', { actionId });
    }

    async toggleSit(stand = false) {
        return this.request('POST', '/social/sit', { stand });
    }
}

// Create global instance
const apiClient = new L2ApiClient();
