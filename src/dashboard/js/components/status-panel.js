/**
 * Status Panel Component - Updates character status display
 * Supports both polling and real-time WebSocket updates
 */

class StatusPanel {
    constructor() {
        this.elements = {
            name: document.getElementById('char-name'),
            class: document.getElementById('char-class'),
            level: document.getElementById('char-level'),
            hpBar: document.getElementById('hp-bar'),
            hpValue: document.getElementById('hp-value'),
            mpBar: document.getElementById('mp-bar'),
            mpValue: document.getElementById('mp-value'),
            xpBar: document.getElementById('xp-bar'),
            xpValue: document.getElementById('xp-value'),
            cpBar: document.getElementById('cp-bar'),
            cpValue: document.getElementById('cp-value'),
            posX: document.getElementById('pos-x'),
            posY: document.getElementById('pos-y'),
            posZ: document.getElementById('pos-z')
        };
        
        this.lastData = null;
        this.pollingInterval = null;
        this.isConnected = false;
        
        // console.log('[StatusPanel] Initializing, elements found:', Object.keys(this.elements).filter(k => this.elements[k]));
        
        // Setup WebSocket listeners for real-time updates
        this.setupWebSocketListeners();
    }

    /**
     * Setup WebSocket event listeners for real-time updates
     */
    setupWebSocketListeners() {
        // Wait for wsClient to be available
        if (typeof wsClient === 'undefined') {
            console.warn('[StatusPanel] wsClient not available yet, retrying in 100ms...');
            setTimeout(() => this.setupWebSocketListeners(), 100);
            return;
        }

        // console.log('[StatusPanel] Setting up WebSocket listeners');
        
        // Character stats changes (HP/MP/CP/XP) - real-time updates
        wsClient.addEventListener('character.stats_changed', (e) => {
            // console.log('[StatusPanel] Stats changed event:', e.detail);
            this.updateStatsRealtime(e.detail);
        });

        // Position changes - real-time updates
        wsClient.addEventListener('movement.position_changed', (e) => {
            // console.log('[StatusPanel] Position changed event:', e.detail);
            this.updatePositionRealtime(e.detail);
        });

        // Character level up
        wsClient.addEventListener('character.level_up', (e) => {
            // console.log('[StatusPanel] Level up event:', e.detail);
            this.handleLevelUp(e.detail);
        });

        // Character died
        wsClient.addEventListener('character.died', (e) => {
            // console.log('[StatusPanel] Died event:', e.detail);
            this.handleDeath(e.detail);
        });

        // Character revived
        wsClient.addEventListener('character.revived', (e) => {
            // console.log('[StatusPanel] Revived event:', e.detail);
            this.handleRevived(e.detail);
        });

        // System events for connection status
        wsClient.addEventListener('system.connected', (e) => {
            // console.log('[StatusPanel] System connected:', e.detail);
            this.isConnected = true;
            this.update(); // Full refresh when connected
        });

        // System disconnected
        wsClient.addEventListener('system.disconnected', (e) => {
            // console.log('[StatusPanel] System disconnected:', e.detail);
            this.isConnected = false;
            this.showDisconnected();
        });
    }

    /**
     * Start polling for character data (fallback)
     */
    start() {
        // console.log('[StatusPanel] Starting polling');
        this.update(); // Initial update
        this.pollingInterval = setInterval(() => this.update(), 2000);
    }

    /**
     * Stop polling
     */
    stop() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Fetch and update character data
     */
    async update() {
        try {
            // console.log('[StatusPanel] Fetching character data...');
            const data = await apiClient.getCharacter();
            // console.log('[StatusPanel] Character data received:', data);
            
            if (!data) {
                // Character not in game yet
                this.isConnected = false;
                this.showDisconnected();
                return;
            }
            
            this.render(data);
            this.lastData = data;
            this.isConnected = true;
        } catch (error) {
            console.error('[StatusPanel] Failed to update character status:', error);
            this.isConnected = false;
            this.showDisconnected();
        }
    }

    /**
     * Update stats in real-time from WebSocket event
     */
    updateStatsRealtime(data) {
        if (!data) return;
        // console.log('[StatusPanel] Updating stats realtime:', data);

        // Update HP with animation
        if (data.hp && this.elements.hpBar && this.elements.hpValue) {
            const hpPercent = Formatters.percent(data.hp.current, data.hp.max);
            this.elements.hpBar.value = hpPercent;
            this.elements.hpValue.textContent = Formatters.stat(data.hp.current, data.hp.max);
            
            // Visual feedback for HP changes
            if (data.hp.delta) {
                this.showStatChange('hp', data.hp.delta);
            }
        }

        // Update MP with animation
        if (data.mp && this.elements.mpBar && this.elements.mpValue) {
            const mpPercent = Formatters.percent(data.mp.current, data.mp.max);
            this.elements.mpBar.value = mpPercent;
            this.elements.mpValue.textContent = Formatters.stat(data.mp.current, data.mp.max);
            
            if (data.mp.delta) {
                this.showStatChange('mp', data.mp.delta);
            }
        }

        // Update CP with animation
        if (data.cp && this.elements.cpBar && this.elements.cpValue) {
            const cpPercent = Formatters.percent(data.cp.current, data.cp.max);
            this.elements.cpBar.value = cpPercent;
            this.elements.cpValue.textContent = Formatters.stat(data.cp.current, data.cp.max);
            
            if (data.cp.delta) {
                this.showStatChange('cp', data.cp.delta);
            }
        }

        // Update XP
        if (data.xp && this.elements.xpBar && this.elements.xpValue) {
            const xpPercent = Formatters.percent(data.xp.current, data.xp.max);
            this.elements.xpBar.value = xpPercent;
            this.elements.xpValue.textContent = `${xpPercent.toFixed(1)}%`;
        }

        // Update SP if present
        if (data.sp && this.lastData) {
            this.lastData.sp = data.sp.current;
        }
    }

    /**
     * Update position in real-time from WebSocket event
     */
    updatePositionRealtime(data) {
        if (!data || !data.position) return;
        // console.log('[StatusPanel] Updating position:', data.position);

        const { position } = data;
        
        if (this.elements.posX) {
            this.elements.posX.textContent = Formatters.coord(position.x);
            this.highlightElement(this.elements.posX);
        }
        if (this.elements.posY) {
            this.elements.posY.textContent = Formatters.coord(position.y);
            this.highlightElement(this.elements.posY);
        }
        if (this.elements.posZ) {
            this.elements.posZ.textContent = Formatters.coord(position.z);
            this.highlightElement(this.elements.posZ);
        }

        // Update cached position
        if (this.lastData) {
            this.lastData.position = position;
        }
    }

    /**
     * Handle level up event
     */
    handleLevelUp(data) {
        if (!data) return;
        
        if (this.elements.level) {
            this.elements.level.textContent = `Level ${data.newLevel || '--'}`;
            this.highlightElement(this.elements.level.parentElement, 'level-up');
        }

        // Trigger level up animation/effect
        this.showLevelUpEffect(data.newLevel);

        if (this.lastData) {
            this.lastData.level = data.newLevel;
            this.lastData.sp = data.sp;
        }
    }

    /**
     * Handle character death
     */
    handleDeath(data) {
        // Visual indicator of death
        const characterInfo = document.getElementById('character-info');
        if (characterInfo) {
            characterInfo.classList.add('character-dead');
        }
        
        // HP should be 0
        if (this.elements.hpBar) this.elements.hpBar.value = 0;
        if (this.elements.hpValue) this.elements.hpValue.textContent = '0/--';
    }

    /**
     * Handle character revived
     */
    handleRevived(data) {
        // Remove death indicator
        const characterInfo = document.getElementById('character-info');
        if (characterInfo) {
            characterInfo.classList.remove('character-dead');
        }
        
        // Update HP/MP from revive data
        if (data.hp && this.elements.hpBar) {
            this.elements.hpBar.value = Formatters.percent(data.hp, this.lastData?.hp?.max || 100);
        }
        if (data.mp && this.elements.mpBar) {
            this.elements.mpBar.value = Formatters.percent(data.mp, this.lastData?.mp?.max || 100);
        }
        
        // Full refresh to get current state
        this.update();
    }

    /**
     * Show visual feedback for stat changes
     */
    showStatChange(stat, delta) {
        const bar = this.elements[`${stat}Bar`];
        if (!bar) return;

        const isPositive = delta > 0;
        const flashClass = isPositive ? 'stat-flash-heal' : 'stat-flash-damage';
        
        bar.classList.add(flashClass);
        setTimeout(() => bar.classList.remove(flashClass), 500);
    }

    /**
     * Highlight element briefly
     */
    highlightElement(element, extraClass = 'highlight') {
        if (!element) return;
        element.classList.add(extraClass);
        setTimeout(() => element.classList.remove(extraClass), 1000);
    }

    /**
     * Show level up effect
     */
    showLevelUpEffect(newLevel) {
        const avatar = document.querySelector('.avatar-placeholder');
        if (avatar) {
            avatar.classList.add('level-up-effect');
            setTimeout(() => avatar.classList.remove('level-up-effect'), 2000);
        }
        
        // Could also trigger a toast notification here
        if (typeof eventLog !== 'undefined') {
            eventLog.addSystemMessage(`🎉 Level Up! You are now level ${newLevel}!`);
        }
    }

    /**
     * Render character data
     */
    render(data) {
        if (!data) {
            console.warn('[StatusPanel] render called with null data');
            return;
        }
        // console.log('[StatusPanel] Rendering character data:', data);

        // Basic info
        if (this.elements.name) this.elements.name.textContent = data.name || '--';
        if (this.elements.class) this.elements.class.textContent = 
            Formatters.className(data.classId) || '--';
        if (this.elements.level) this.elements.level.textContent = 
            `Level ${data.level || '--'}`;

        // HP
        if (data.hp && this.elements.hpBar && this.elements.hpValue) {
            const hpPercent = Formatters.percent(data.hp.current, data.hp.max);
            this.elements.hpBar.value = hpPercent;
            this.elements.hpBar.max = 100;
            this.elements.hpValue.textContent = Formatters.stat(data.hp.current, data.hp.max);
        }

        // MP
        if (data.mp && this.elements.mpBar && this.elements.mpValue) {
            const mpPercent = Formatters.percent(data.mp.current, data.mp.max);
            this.elements.mpBar.value = mpPercent;
            this.elements.mpBar.max = 100;
            this.elements.mpValue.textContent = Formatters.stat(data.mp.current, data.mp.max);
        }

        // XP
        if (data.expPercent !== undefined && this.elements.xpBar && this.elements.xpValue) {
            const xpPercent = data.expPercent || 0;
            this.elements.xpBar.value = xpPercent;
            this.elements.xpBar.max = 100;
            this.elements.xpValue.textContent = `${xpPercent.toFixed(1)}%`;
        }

        // CP (Combat Points)
        if (data.cp && this.elements.cpBar && this.elements.cpValue) {
            const cpPercent = Formatters.percent(data.cp.current, data.cp.max);
            this.elements.cpBar.value = cpPercent;
            this.elements.cpBar.max = 100;
            this.elements.cpValue.textContent = Formatters.stat(data.cp.current, data.cp.max);
        } else if (this.elements.cpBar && this.elements.cpValue) {
            // Hide CP if not available
            this.elements.cpBar.value = 0;
            this.elements.cpValue.textContent = '--/--';
        }

        // Position
        if (data.position) {
            if (this.elements.posX) this.elements.posX.textContent = Formatters.coord(data.position.x);
            if (this.elements.posY) this.elements.posY.textContent = Formatters.coord(data.position.y);
            if (this.elements.posZ) this.elements.posZ.textContent = Formatters.coord(data.position.z);
        }
    }

    /**
     * Show disconnected state
     */
    showDisconnected() {
        const fields = ['name', 'class', 'level'];
        fields.forEach(field => {
            if (this.elements[field]) this.elements[field].textContent = '--';
        });
        
        ['hp', 'mp', 'xp', 'cp'].forEach(stat => {
            if (this.elements[`${stat}Bar`]) {
                this.elements[`${stat}Bar`].value = 0;
            }
            if (this.elements[`${stat}Value`]) {
                this.elements[`${stat}Value`].textContent = '--/--';
            }
        });
        
        ['posX', 'posY', 'posZ'].forEach(pos => {
            if (this.elements[pos]) this.elements[pos].textContent = '--';
        });
        
        // Remove death indicator if present
        const characterInfo = document.getElementById('character-info');
        if (characterInfo) {
            characterInfo.classList.remove('character-dead');
        }
    }

    /**
     * Get last cached data
     */
    getLastData() {
        return this.lastData;
    }

    /**
     * Check if character data is available
     */
    hasData() {
        return this.lastData && this.lastData.objectId;
    }
}

// Create global instance
// console.log('[StatusPanel] Creating global instance');
const statusPanel = new StatusPanel();
// console.log('[StatusPanel] Global instance created');
