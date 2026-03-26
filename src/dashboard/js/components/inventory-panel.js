/**
 * Inventory Panel Component
 * Handles inventory loading and display
 */

class InventoryPanel {
    constructor() {
        this.items = [];
        this.equipment = new Map();
        this.adena = 0;
        this.isLoading = false;
        this.lastUpdate = 0;
    }

    /**
     * Start inventory polling
     */
    start() {
        // Setup filter change handler
        const filterSelect = document.getElementById('inventory-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.refresh());
        }
        
        // Initial load
        this.refresh();
        
        // Listen for tab switch to inventory
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const inventoryTab = document.getElementById('tab-inventory');
                    if (inventoryTab && inventoryTab.classList.contains('active')) {
                        this.refresh();
                    }
                }
            });
        });
        
        const inventoryTab = document.getElementById('tab-inventory');
        if (inventoryTab) {
            observer.observe(inventoryTab, { attributes: true });
        }
        
        // Setup WebSocket listeners for real-time updates
        this.setupWebSocketListeners();
    }

    /**
     * Setup WebSocket event listeners for real-time updates
     */
    setupWebSocketListeners() {
        // Wait for wsClient to be available
        if (typeof wsClient === 'undefined') {
            console.warn('[InventoryPanel] wsClient not available yet, retrying in 100ms...');
            setTimeout(() => this.setupWebSocketListeners(), 100);
            return;
        }

        console.log('[InventoryPanel] Setting up WebSocket listeners');
        
        // Inventory updated event
        wsClient.addEventListener('inventory.changed', (e) => {
            console.log('[InventoryPanel] Inventory changed event:', e.detail);
            this.refresh();
        });

        // Inventory cleared event - when disconnected from game
        wsClient.addEventListener('inventory.cleared', (e) => {
            console.log('[InventoryPanel] Inventory cleared event:', e.detail);
            this.clear();
        });

        // System disconnected - clear inventory
        wsClient.addEventListener('system.disconnected', () => {
            console.log('[InventoryPanel] System disconnected, clearing inventory');
            this.clear();
        });
    }

    /**
     * Refresh inventory data from API
     */
    async refresh() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            // Get filter
            const filterSelect = document.getElementById('inventory-filter');
            const filter = filterSelect ? filterSelect.value : 'all';
            
            // Load inventory
            const response = await apiClient.getInventory();
            
            // Check if response has data property (new API format) or is direct data (old format)
            const data = response.data || response;
            
            // If not in game, clear the display
            if (response.inGame === false || (data && data.inGame === false)) {
                console.log('[InventoryPanel] Not in game, clearing inventory');
                this.clear();
                return;
            }
            
            if (data && data.items) {
                this.items = data.items || [];
                this.adena = data.adena || 0;
                
                // Filter items
                let displayItems = this.items;
                if (filter === 'equipped') {
                    displayItems = this.items.filter(i => i.equipped);
                } else if (filter === 'weapons') {
                    displayItems = this.items.filter(i => i.type === 'weapon');
                } else if (filter === 'armor') {
                    displayItems = this.items.filter(i => i.type === 'armor');
                } else if (filter === 'consumables') {
                    displayItems = this.items.filter(i => i.type === 'consumable');
                }
                
                this.render(displayItems);
                this.updateAdena();
            } else {
                this.showEmpty('No inventory data');
            }
        } catch (error) {
            console.error('[InventoryPanel] Failed to load inventory:', error);
            this.showEmpty('Failed to load inventory');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Render inventory items
     */
    render(items) {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        
        // Clear current content
        grid.innerHTML = '';
        
        if (items.length === 0) {
            this.showEmpty('No items found');
            return;
        }
        
        // Create item elements
        items.forEach(item => {
            const itemEl = this.createItemElement(item);
            grid.appendChild(itemEl);
        });
    }

    /**
     * Create item DOM element
     */
    createItemElement(item) {
        const el = document.createElement('div');
        el.className = 'inventory-item';
        if (item.equipped) {
            el.classList.add('equipped');
        }
        
        const iconClass = this.getItemIconClass(item);
        const enchantStr = item.enchant > 0 ? `+${item.enchant}` : '';
        const name = item.name || `Item ${item.itemId}`;
        
        el.innerHTML = `
            <div class="item-icon ${iconClass}">
                ${item.equipped ? '<span class="equipped-badge">E</span>' : ''}
                ${enchantStr ? `<span class="enchant-badge">${enchantStr}</span>` : ''}
            </div>
            <div class="item-info">
                <div class="item-name" title="${name}">${name}</div>
                <div class="item-meta">
                    <span class="item-count">${this.formatCount(item.count)}</span>
                    ${item.mana > 0 ? `<span class="item-mana">${item.mana}%</span>` : ''}
                </div>
            </div>
        `;
        
        // Click handler for item actions
        el.addEventListener('click', () => this.handleItemClick(item));
        
        return el;
    }

    /**
     * Get icon class based on item type
     */
    getItemIconClass(item) {
        if (item.equipped) return 'icon-equipped';
        switch (item.type) {
            case 'weapon': return 'icon-weapon';
            case 'armor': return 'icon-armor';
            case 'consumable': return 'icon-consumable';
            case 'material': return 'icon-material';
            case 'quest': return 'icon-quest';
            default: return 'icon-etc';
        }
    }

    /**
     * Format item count
     */
    formatCount(count) {
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count.toString();
    }

    /**
     * Update adena display
     */
    updateAdena() {
        const adenaEl = document.querySelector('#adena-amount span');
        if (adenaEl) {
            adenaEl.textContent = this.formatCount(this.adena);
        }
    }

    /**
     * Show empty state
     */
    showEmpty(message) {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="inventory-empty">
                <i data-lucide="package-x"></i>
                <p>${message}</p>
            </div>
        `;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Handle item click
     */
    async handleItemClick(item) {
        // Show context menu or modal with actions
        const actions = [];
        
        if (item.type === 'consumable') {
            actions.push({ label: 'Use', action: () => this.useItem(item) });
        }
        
        if (!item.equipped && (item.type === 'weapon' || item.type === 'armor')) {
            actions.push({ label: 'Equip', action: () => this.equipItem(item) });
        }
        
        actions.push({ label: 'Drop', action: () => this.dropItem(item) });
        
        // Show action menu
        this.showActionMenu(item, actions);
    }

    /**
     * Show action menu for item
     */
    showActionMenu(item, actions) {
        // Remove existing menu
        const existing = document.querySelector('.item-action-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'item-action-menu';
        
        menu.innerHTML = actions.map(a => 
            `<button class="action-btn" data-action="${a.label}">${a.label}</button>`
        ).join('');
        
        document.body.appendChild(menu);
        
        // Position menu
        const rect = event.target.closest('.inventory-item').getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;
        
        // Handle actions
        menu.querySelectorAll('.action-btn').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                actions[idx].action();
                menu.remove();
            });
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', close);
                }
            });
        }, 0);
    }

    /**
     * Use item
     */
    async useItem(item) {
        try {
            await apiClient.useItem(item.objectId);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`📦 Using ${item.name}`);
            }
        } catch (error) {
            console.error('[InventoryPanel] Use item failed:', error);
        }
    }

    /**
     * Drop item
     */
    async dropItem(item) {
        // Show confirmation/count dialog
        const count = prompt(`Drop how many ${item.name}? (Max: ${item.count})`, '1');
        if (!count || isNaN(count)) return;
        
        const dropCount = parseInt(count);
        if (dropCount <= 0 || dropCount > item.count) return;
        
        try {
            await apiClient.dropItem(item.objectId, dropCount);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`📦 Dropped ${item.name} x${dropCount}`);
            }
            this.refresh();
        } catch (error) {
            console.error('[InventoryPanel] Drop item failed:', error);
        }
    }

    /**
     * Clear inventory display
     */
    clear() {
        this.items = [];
        this.equipment.clear();
        this.adena = 0;
        this.showEmpty('Not connected to game');
        this.updateAdena();
    }
}

// Create global instance
const inventoryPanel = new InventoryPanel();
