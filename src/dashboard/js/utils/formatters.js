/**
 * Utility functions for formatting data in the dashboard
 */

const Formatters = {
    /**
     * Format number with thousand separators
     */
    number(num) {
        if (num === undefined || num === null) return '--';
        return num.toLocaleString('en-US');
    },

    /**
     * Format HP/MP/CP values
     */
    stat(current, max) {
        if (current === undefined || max === undefined) return '--/--';
        return `${this.number(current)}/${this.number(max)}`;
    },

    /**
     * Calculate percentage
     */
    percent(current, max) {
        if (!max || max === 0) return 0;
        return Math.min(100, Math.max(0, Math.round((current / max) * 100)));
    },

    /**
     * Format XP with percentage
     */
    xp(current, max) {
        if (current === undefined || max === undefined) return '--%';
        const percent = this.percent(current, max);
        return `${percent}%`;
    },

    /**
     * Format distance in meters
     */
    distance(value) {
        if (value === undefined || value === null) return '--';
        return `${Math.round(value)}m`;
    },

    /**
     * Format coordinates
     */
    coord(value) {
        if (value === undefined || value === null) return '--';
        return Math.round(value).toString();
    },

    /**
     * Format timestamp for event log
     */
    time(date = new Date()) {
        return date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    /**
     * Format class ID to name
     */
    className(classId) {
        const classes = {
            0: 'Fighter', 1: 'Warrior', 2: 'Gladiator', 3: 'Warlord',
            4: 'Knight', 5: 'Paladin', 6: 'Dark Avenger',
            7: 'Rogue', 8: 'Treasure Hunter', 9: 'Hawkeye',
            10: 'Mage', 11: 'Wizard', 12: 'Sorcerer', 13: 'Necromancer',
            14: 'Warlock', 15: 'Cleric', 16: 'Bishop', 17: 'Prophet',
            18: 'Elven Fighter', 19: 'Elven Knight', 20: 'Temple Knight',
            21: 'Swordsinger', 22: 'Elven Scout', 23: 'Plainswalker',
            24: 'Silver Ranger', 25: 'Elven Mage', 26: 'Elven Wizard',
            27: 'Spellsinger', 28: 'Elemental Summoner', 29: 'Oracle',
            30: 'Elder', 31: 'Dark Fighter', 32: 'Palus Knight',
            33: 'Shillien Knight', 34: 'Bladedancer', 35: 'Assassin',
            36: 'Abyss Walker', 37: 'Phantom Ranger', 38: 'Dark Mage',
            39: 'Dark Wizard', 40: 'Spellhowler', 41: 'Phantom Summoner',
            42: 'Shillien Oracle', 43: 'Shillien Elder', 44: 'Orc Fighter',
            45: 'Orc Raider', 46: 'Destroyer', 47: 'Orc Monk',
            48: 'Tyrant', 49: 'Orc Mage', 50: 'Orc Shaman',
            51: 'Overlord', 52: 'Warcryer', 53: 'Dwarven Fighter',
            54: 'Scavenger', 55: 'Bounty Hunter', 56: 'Artisan',
            57: 'Warsmith'
        };
        return classes[classId] || `Class ${classId}`;
    },

    /**
     * Format item grade
     */
    grade(grade) {
        const grades = {
            'NONE': 'N', 'D': 'D', 'C': 'C', 'B': 'B',
            'A': 'A', 'S': 'S'
        };
        return grades[grade] || grade;
    },

    /**
     * Format adena amount
     */
    adena(amount) {
        if (amount === undefined || amount === null) return '--';
        if (amount >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}M`;
        }
        if (amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}K`;
        }
        return this.number(amount);
    },

    /**
     * Format phase name
     */
    phase(phase) {
        const phases = {
            'DISCONNECTED': 'Disconnected',
            'LOGIN_CONNECTING': 'Connecting to Login...',
            'LOGIN_AUTHENTICATING': 'Authenticating...',
            'SELECTING_CHARACTER': 'Selecting Character...',
            'ENTERING_GAME': 'Entering Game...',
            'IN_GAME': 'In Game',
            'WAITING_SERVER_SELECT': 'Selecting Server...',
            'ERROR': 'Error'
        };
        return phases[phase] || phase;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formatters;
}
