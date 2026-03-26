/**
 * NPC Database - Client-side NPC name lookup
 * Loads NPC data from /data/export/npcs/npcs.json
 */

class NpcDatabase {
    constructor() {
        this.npcMap = new Map();
        this.loaded = false;
        this.loading = false;
    }

    /**
     * Load NPC data from JSON file
     */
    async load() {
        if (this.loaded || this.loading) return;
        this.loading = true;

        try {
            console.log('[NpcDatabase] Loading NPC data...');
            const response = await fetch('/data/export/npcs/npcs.json');
            console.log('[NpcDatabase] Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const npcs = await response.json();
            console.log('[NpcDatabase] Parsed JSON, npcs count:', npcs.length);
            
            // Build lookup map
            npcs.forEach(npc => {
                this.npcMap.set(npc.id, npc);
            });
            
            this.loaded = true;
            console.log(`[NpcDatabase] Loaded ${this.npcMap.size} NPCs`);
            
            // Test lookup
            const testNpc = this.npcMap.get(12077);
            console.log('[NpcDatabase] Test lookup (id=12077):', testNpc?.name);
        } catch (error) {
            console.error('[NpcDatabase] Failed to load:', error);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Get NPC by ID
     */
    getNpc(npcId) {
        return this.npcMap.get(npcId);
    }

    /**
     * Get NPC name by ID
     */
    getNpcName(npcId) {
        console.log('[NpcDatabase] getNpcName called with:', npcId, 'type:', typeof npcId);
        console.log('[NpcDatabase] loaded:', this.loaded, 'size:', this.npcMap.size);
        
        // Ensure npcId is a number
        const id = typeof npcId === 'string' ? parseInt(npcId) : npcId;
        const npc = this.npcMap.get(id);
        
        console.log('[NpcDatabase] Found NPC:', npc?.name || 'NOT FOUND');
        return npc?.name || null;
    }

    /**
     * Get NPC level by ID
     */
    getNpcLevel(npcId) {
        const npc = this.npcMap.get(npcId);
        return npc?.level || null;
    }

    /**
     * Search NPCs by name (partial match)
     */
    findByName(name) {
        const search = name.toLowerCase();
        const results = [];
        
        for (const npc of this.npcMap.values()) {
            if (npc.name.toLowerCase().includes(search)) {
                results.push(npc);
            }
        }
        
        return results;
    }

    /**
     * Resolve NPC name - returns name from database or fallback
     */
    resolveName(npcId, fallbackName) {
        const dbName = this.getNpcName(npcId);
        if (dbName) return dbName;
        
        // If fallback looks like "NPC 12345", try to clean it up
        if (fallbackName && fallbackName.startsWith('NPC ') && !isNaN(parseInt(fallbackName.slice(4)))) {
            return `NPC ${npcId}`;
        }
        
        return fallbackName || `NPC ${npcId}`;
    }
}

// Create global instance
const npcDatabase = new NpcDatabase();

// Auto-load on startup
npcDatabase.load();
