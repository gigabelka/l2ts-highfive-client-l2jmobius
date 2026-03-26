/**
 * Packet Console Component for WS Monitor
 * Real-time packet logging with filtering, search, and analysis
 */

class PacketConsole extends EventTarget {
    constructor() {
        super();
        
        // Configuration
        this.maxLines = 5000;
        this.maxDataLength = 200;
        
        // State
        this.packets = [];           // All packets (limited to maxLines)
        this.filteredPackets = [];   // Currently displayed packets
        this.isPaused = false;
        this.pendingPackets = [];    // Packets received while paused
        this.autoScroll = true;
        
        // Filter state
        this.filterText = '';
        this.filterDirection = 'all';
        
        // Stats
        this.totalPackets = 0;
        this.packetsPerSecond = 0;
        this.lastSecondPackets = 0;
        this.lastStatsUpdate = Date.now();
        
        // DOM elements (initialized in init)
        this.elements = {};
        
        // Expanded packet tracking
        this.expandedPacketIds = new Set();
        
        // Throttling
        this.renderPending = false;
        this.lastRenderTime = 0;
        this.renderInterval = 50; // ms
        
        // Start stats updater
        this.startStatsUpdate();
    }
    
    /**
     * Initialize the console and bind to DOM
     */
    init() {
        this.bindElements();
        this.bindEvents();
        this.render();
        
        console.log('[PacketConsole] Initialized');
    }
    
    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            log: document.getElementById('packet-log'),
            filter: document.getElementById('packet-filter'),
            direction: document.getElementById('packet-direction'),
            pauseBtn: document.getElementById('packet-pause-btn'),
            clearBtn: document.getElementById('packet-clear-btn'),
            autoScroll: document.getElementById('packet-autoscroll'),
            wsStatus: document.getElementById('packet-ws-status'),
            showingCount: document.getElementById('packet-showing-count'),
            rate: document.getElementById('packet-rate')
        };
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Filter input - real-time filtering
        this.elements.filter?.addEventListener('input', (e) => {
            this.filterText = e.target.value;
            this.applyFilter();
        });
        
        // Direction filter
        this.elements.direction?.addEventListener('change', (e) => {
            this.filterDirection = e.target.value;
            this.applyFilter();
        });
        
        // Pause/Resume button
        this.elements.pauseBtn?.addEventListener('click', () => {
            this.togglePause();
        });
        
        // Clear button
        this.elements.clearBtn?.addEventListener('click', () => {
            this.clear();
        });
        
        // Auto-scroll toggle
        this.elements.autoScroll?.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        // Log container click - expand/collapse packets
        this.elements.log?.addEventListener('click', (e) => {
            const row = e.target.closest('.packet-row');
            if (row && !e.target.closest('.packet-data-preview')) {
                this.togglePacketExpand(row.dataset.packetId);
            }
        });
    }
    
    /**
     * Add a packet to the console
     * @param {Object} packet - Packet data
     * @param {string} packet.type - Packet type/name
     * @param {string} packet.direction - 'in' (server→client) or 'out' (client→server)
     * @param {Object} packet.data - Packet payload data
     * @param {number} packet.opcode - Optional packet opcode
     * @param {string} packet.channel - Optional channel name
     */
    addPacket(packet) {
        const enrichedPacket = {
            id: `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            ...packet
        };
        
        this.totalPackets++;
        this.lastSecondPackets++;
        
        if (this.isPaused) {
            this.pendingPackets.push(enrichedPacket);
            this.updateStats();
            return;
        }
        
        this.packets.push(enrichedPacket);
        
        // Limit max lines
        if (this.packets.length > this.maxLines) {
            const removed = this.packets.shift();
            this.expandedPacketIds.delete(removed.id);
        }
        
        // Check if matches current filter
        if (this.matchesFilter(enrichedPacket)) {
            this.filteredPackets.push(enrichedPacket);
            
            // Limit filtered packets too
            if (this.filteredPackets.length > this.maxLines) {
                this.filteredPackets.shift();
            }
            
            // Throttled render
            this.scheduleRender();
        }
        
        this.updateStats();
    }
    
    /**
     * Schedule a render with throttling
     */
    scheduleRender() {
        if (this.renderPending) return;
        
        const now = Date.now();
        const timeSinceLastRender = now - this.lastRenderTime;
        
        if (timeSinceLastRender >= this.renderInterval) {
            this.render();
        } else {
            this.renderPending = true;
            setTimeout(() => {
                this.renderPending = false;
                this.render();
            }, this.renderInterval - timeSinceLastRender);
        }
    }
    
    /**
     * Check if packet matches current filter
     */
    matchesFilter(packet) {
        // Direction filter
        if (this.filterDirection !== 'all' && packet.direction !== this.filterDirection) {
            return false;
        }
        
        // Text filter
        if (!this.filterText.trim()) {
            return true;
        }
        
        const searchTerms = this.filterText.toLowerCase().split(/\s+/).filter(Boolean);
        if (searchTerms.length === 0) {
            return true;
        }
        
        const packetText = this.getPacketSearchText(packet).toLowerCase();
        
        // AND logic with support for exclusion (!term)
        for (const term of searchTerms) {
            if (term.startsWith('!')) {
                // Exclusion - if packet contains this term, exclude it
                const excludeTerm = term.slice(1);
                if (excludeTerm && packetText.includes(excludeTerm)) {
                    return false;
                }
            } else {
                // Inclusion - packet must contain this term
                if (!packetText.includes(term)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Get searchable text from packet
     */
    getPacketSearchText(packet) {
        const parts = [
            packet.type || '',
            packet.opcode !== undefined ? `0x${packet.opcode.toString(16).toUpperCase().padStart(2, '0')}` : '',
            packet.channel || '',
            JSON.stringify(packet.data || {})
        ];
        return parts.join(' ');
    }
    
    /**
     * Apply filter to all packets
     */
    applyFilter() {
        this.filteredPackets = this.packets.filter(p => this.matchesFilter(p));
        this.render();
        this.updateStats();
    }
    
    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        
        const btn = this.elements.pauseBtn;
        const icon = btn?.querySelector('i');
        const text = btn?.querySelector('span');
        
        if (this.isPaused) {
            if (icon) icon.setAttribute('data-lucide', 'play');
            if (text) text.textContent = 'Resume';
            btn?.classList.add('active');
        } else {
            if (icon) icon.setAttribute('data-lucide', 'pause');
            if (text) text.textContent = 'Pause';
            btn?.classList.remove('active');
            
            // Process pending packets
            const pending = [...this.pendingPackets];
            this.pendingPackets = [];
            pending.forEach(p => this.addPacket(p));
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    /**
     * Clear all packets
     */
    clear() {
        this.packets = [];
        this.filteredPackets = [];
        this.pendingPackets = [];
        this.expandedPacketIds.clear();
        this.totalPackets = 0;
        this.render();
        this.updateStats();
    }
    
    /**
     * Toggle packet expand/collapse
     */
    togglePacketExpand(packetId) {
        if (this.expandedPacketIds.has(packetId)) {
            this.expandedPacketIds.delete(packetId);
        } else {
            this.expandedPacketIds.add(packetId);
        }
        
        // Re-render just this packet's row
        const row = this.elements.log?.querySelector(`[data-packet-id="${packetId}"]`);
        if (row) {
            const packet = this.filteredPackets.find(p => p.id === packetId);
            if (packet) {
                const wasExpanded = this.expandedPacketIds.has(packetId);
                row.classList.toggle('expanded', wasExpanded);
                
                // Toggle detail row
                let detailRow = row.nextElementSibling;
                if (detailRow?.classList.contains('packet-detail-row')) {
                    detailRow.remove();
                }
                
                if (wasExpanded) {
                    detailRow = document.createElement('div');
                    detailRow.className = 'packet-detail-row';
                    detailRow.innerHTML = `
                        <pre class="packet-json">${this.formatJson(packet.data)}</pre>
                    `;
                    row.after(detailRow);
                }
            }
        }
    }
    
    /**
     * Format JSON for display
     */
    formatJson(data) {
        try {
            return JSON.stringify(data, null, 2);
        } catch {
            return String(data);
        }
    }
    
    /**
     * Format timestamp
     */
    formatTime(timestamp) {
        const d = new Date(timestamp);
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        const secs = d.getSeconds().toString().padStart(2, '0');
        const ms = d.getMilliseconds().toString().padStart(3, '0');
        return `${hours}:${mins}:${secs}.${ms}`;
    }
    
    /**
     * Get direction arrow and class
     */
    getDirectionInfo(direction) {
        if (direction === 'in') {
            return { arrow: '←', class: 'dir-in', label: 'S→C' };
        } else if (direction === 'out') {
            return { arrow: '→', class: 'dir-out', label: 'C→S' };
        }
        return { arrow: '?', class: 'dir-unknown', label: '???' };
    }
    
    /**
     * Truncate data for preview
     */
    truncateData(data) {
        const str = JSON.stringify(data);
        if (str.length <= this.maxDataLength) {
            return str;
        }
        return str.substring(0, this.maxDataLength) + '...';
    }
    
    /**
     * Highlight matching text
     */
    highlightText(text, searchTerms) {
        if (!searchTerms.length) return text;
        
        // Build regex for positive search terms (exclude terms starting with !)
        const positiveTerms = searchTerms.filter(t => !t.startsWith('!'));
        if (!positiveTerms.length) return text;
        
        const escaped = positiveTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
        
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    /**
     * Render the console
     */
    render() {
        if (!this.elements.log) return;
        
        this.lastRenderTime = Date.now();
        
        if (this.filteredPackets.length === 0) {
            this.elements.log.innerHTML = `
                <div class="packet-log-empty">
                    <i data-lucide="terminal"></i>
                    <p>${this.packets.length === 0 
                        ? 'Packet console ready. Waiting for WebSocket messages...' 
                        : 'No packets match current filter'}</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        const searchTerms = this.filterText.toLowerCase().split(/\s+/).filter(Boolean);
        const fragment = document.createDocumentFragment();
        
        this.filteredPackets.forEach((packet, index) => {
            const dir = this.getDirectionInfo(packet.direction);
            const isExpanded = this.expandedPacketIds.has(packet.id);
            const isEven = index % 2 === 0;
            
            // Row
            const row = document.createElement('div');
            row.className = `packet-row ${dir.class} ${isEven ? 'even' : 'odd'} ${isExpanded ? 'expanded' : ''}`;
            row.dataset.packetId = packet.id;
            
            const typeClass = packet.type?.toLowerCase().includes('error') ? 'type-error' : '';
            const opcodeStr = packet.opcode !== undefined 
                ? `0x${packet.opcode.toString(16).toUpperCase().padStart(2, '0')}` 
                : '--';
            
            const timeStr = this.highlightText(this.formatTime(packet.timestamp), searchTerms);
            const typeStr = this.highlightText(packet.type || 'Unknown', searchTerms);
            const previewStr = this.highlightText(this.truncateData(packet.data), searchTerms);
            
            row.innerHTML = `
                <span class="packet-time">${timeStr}</span>
                <span class="packet-direction ${dir.class}">${dir.arrow}</span>
                <span class="packet-opcode">${opcodeStr}</span>
                <span class="packet-type ${typeClass}">${typeStr}</span>
                <span class="packet-data-preview">${previewStr}</span>
            `;
            
            fragment.appendChild(row);
            
            // Detail row if expanded
            if (isExpanded) {
                const detailRow = document.createElement('div');
                detailRow.className = 'packet-detail-row';
                detailRow.innerHTML = `
                    <pre class="packet-json">${this.formatJson(packet.data)}</pre>
                `;
                fragment.appendChild(detailRow);
            }
        });
        
        this.elements.log.innerHTML = '';
        this.elements.log.appendChild(fragment);
        
        // Auto-scroll
        if (this.autoScroll) {
            this.elements.log.scrollTop = this.elements.log.scrollHeight;
        }
    }
    
    /**
     * Update status bar statistics
     */
    updateStats() {
        if (!this.elements.showingCount || !this.elements.rate) return;
        
        this.elements.showingCount.textContent = `Showing: ${this.filteredPackets.length} / Total: ${this.totalPackets}`;
        this.elements.rate.textContent = `${this.packetsPerSecond} pkt/s`;
    }
    
    /**
     * Start periodic stats update
     */
    startStatsUpdate() {
        setInterval(() => {
            this.packetsPerSecond = this.lastSecondPackets;
            this.lastSecondPackets = 0;
            this.updateStats();
        }, 1000);
    }
    
    /**
     * Update WebSocket connection status
     */
    setWsStatus(status, message = null) {
        if (!this.elements.wsStatus) return;
        
        const statusMap = {
            'connected': { class: 'connected', text: message || 'Connected' },
            'disconnected': { class: 'disconnected', text: message || 'Disconnected' },
            'connecting': { class: 'connecting', text: message || 'Connecting...' },
            'error': { class: 'error', text: message || 'Error' }
        };
        
        const info = statusMap[status] || statusMap['disconnected'];
        
        this.elements.wsStatus.className = `packet-status-badge ${info.class}`;
        this.elements.wsStatus.textContent = info.text;
    }
    
    /**
     * Process WebSocket message from existing wsClient
     * Adapts message format to packet format
     */
    onWsMessage(message) {
        // Обработка server_packet от PacketBroadcastService
        if (message.type === 'server_packet' && message.payload) {
            const p = message.payload;
            this.addPacket({
                type: p.name || `Packet_${p.opcodeHex}`,
                direction: p.direction === 'client_to_server' ? 'out' : 'in',
                opcode: p.opcodeHex || p.opcode,
                data: p.data,
                channel: 'packets'
            });
            return;
        }

        // Обработка batch (WsApiServer шлёт batch при подключении)
        if (message.type === 'batch' && Array.isArray(message.events)) {
            for (const event of message.events) {
                if (event.type === 'server_packet' && event.data) {
                    const p = event.data;
                    this.addPacket({
                        type: p.name || `Packet_${p.opcodeHex}`,
                        direction: p.direction === 'client_to_server' ? 'out' : 'in',
                        opcode: p.opcodeHex || p.opcode,
                        data: p.data,
                        channel: 'packets'
                    });
                }
            }
            return;
        }

        // Остальные сообщения (доменные события) — показываем как есть
        const packet = {
            type: message.type || 'unknown',
            direction: message._direction || 'in',
            data: message.payload || message.data || message,
            opcode: message.opcode,
            channel: message.channel
        };
        this.addPacket(packet);
    }
}

// Create global instance
const packetConsole = new PacketConsole();
