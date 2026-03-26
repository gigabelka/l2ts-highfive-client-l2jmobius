/**
 * Skills Panel Component - Displays character skills
 * Supports both polling and real-time WebSocket updates
 */

class SkillsPanel {
    constructor() {
        this.elements = {
            activeList: document.getElementById('active-skills-list'),
            passiveList: document.getElementById('passive-skills-list'),
            activeCount: document.getElementById('active-skills-count'),
            passiveCount: document.getElementById('passive-skills-count'),
            skillDetails: document.getElementById('skill-details')
        };
        
        this.activeSkills = [];
        this.passiveSkills = [];
        this.selectedSkill = null;
        this.skillDatabase = new Map(); // Local cache of skill names
        
        // Load skill database
        this.loadSkillDatabase();
        
        // Setup WebSocket listeners for real-time updates
        this.setupWebSocketListeners();
    }

    /**
     * Load skill names from skills.json
     */
    async loadSkillDatabase() {
        try {
            const response = await fetch('/data/skills.json');
            if (response.ok) {
                const data = await response.json();
                for (const key in data) {
                    const skill = data[key];
                    this.skillDatabase.set(skill.id, skill);
                }
                console.log('[SkillsPanel] Loaded', this.skillDatabase.size, 'skills from database');
            }
        } catch (error) {
            console.warn('[SkillsPanel] Failed to load skill database:', error);
        }
    }

    /**
     * Get skill name from local database
     */
    getSkillName(skillId) {
        const skill = this.skillDatabase.get(skillId);
        return skill ? skill.name : null;
    }

    /**
     * Get skill type from local database
     */
    getSkillType(skillId) {
        const skill = this.skillDatabase.get(skillId);
        return skill ? skill.type : null;
    }

    /**
     * Setup WebSocket event listeners for real-time updates
     */
    setupWebSocketListeners() {
        // Wait for wsClient to be available
        if (typeof wsClient === 'undefined') {
            console.warn('[SkillsPanel] wsClient not available yet, retrying in 100ms...');
            setTimeout(() => this.setupWebSocketListeners(), 100);
            return;
        }

        console.log('[SkillsPanel] Setting up WebSocket listeners');
        
        // Skills updated event - real-time updates
        wsClient.addEventListener('character.skills_updated', (e) => {
            console.log('[SkillsPanel] Skills updated event:', e.detail);
            this.handleSkillsUpdated(e.detail);
        });

        // Skills cleared event - when disconnected from game
        wsClient.addEventListener('character.skills_cleared', (e) => {
            console.log('[SkillsPanel] Skills cleared event:', e.detail);
            this.clear();
        });

        // System connected - refresh skills
        wsClient.addEventListener('system.connected', () => {
            console.log('[SkillsPanel] System connected, refreshing skills');
            this.refresh();
        });

        // System disconnected - clear skills
        wsClient.addEventListener('system.disconnected', () => {
            console.log('[SkillsPanel] System disconnected, clearing skills');
            this.clear();
        });
    }

    /**
     * Handle skills updated event from WebSocket
     */
    handleSkillsUpdated(data) {
        if (!data || !data.skills) {
            console.warn('[SkillsPanel] Invalid skills data received');
            return;
        }

        // Enhance skills with names from database
        const enhancedSkills = data.skills.map(skill => ({
            ...skill,
            name: skill.name || this.getSkillName(skill.skillId) || `Skill #${skill.skillId}`
        }));

        // Split skills by type
        this.activeSkills = enhancedSkills.filter(s => !s.passive && s.type !== 'PASSIVE');
        this.passiveSkills = enhancedSkills.filter(s => s.passive || s.type === 'PASSIVE');

        // Update UI
        this.render();
    }

    /**
     * Refresh skills data from API
     */
    async refresh() {
        try {
            if (typeof apiClient === 'undefined') {
                console.warn('[SkillsPanel] apiClient not available');
                return;
            }

            console.log('[SkillsPanel] Fetching skills from API...');
            const response = await apiClient.getSkills();
            
            // Check if response has data property (new API format) or is array (old format)
            const data = response.data || response;
            
            // If not in game or no skills, clear the display
            if (!response.inGame && response.inGame !== undefined) {
                console.log('[SkillsPanel] Not in game, clearing skills');
                this.clear();
                return;
            }
            
            if (data && data.skills) {
                // Enhance skills with names from local database
                const enhancedSkills = data.skills.map(skill => ({
                    ...skill,
                    name: skill.name || this.getSkillName(skill.skillId) || `Skill #${skill.skillId}`
                }));

                // Split skills by passive flag
                this.activeSkills = enhancedSkills.filter(s => !s.isPassive);
                this.passiveSkills = enhancedSkills.filter(s => s.isPassive);
                this.render();
            } else {
                // No skills data - clear display
                this.clear();
            }
        } catch (error) {
            console.error('[SkillsPanel] Failed to fetch skills:', error);
            this.clear();
        }
    }

    /**
     * Render skills lists
     */
    render() {
        this.renderActiveSkills();
        this.renderPassiveSkills();
    }

    /**
     * Render active skills list
     */
    renderActiveSkills() {
        const container = this.elements.activeList;
        const countBadge = this.elements.activeCount;
        
        if (!container) return;

        // Update count
        if (countBadge) {
            countBadge.textContent = this.activeSkills.length;
        }

        // Clear container
        container.innerHTML = '';

        if (this.activeSkills.length === 0) {
            container.innerHTML = `
                <div class="skills-empty">
                    <i data-lucide="zap-off"></i>
                    <p>No active skills</p>
                </div>
            `;
        } else {
            this.activeSkills.forEach(skill => {
                const skillEl = this.createSkillElement(skill, 'active');
                container.appendChild(skillEl);
            });
        }

        // Re-initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Render passive skills list
     */
    renderPassiveSkills() {
        const container = this.elements.passiveList;
        const countBadge = this.elements.passiveCount;
        
        if (!container) return;

        // Update count
        if (countBadge) {
            countBadge.textContent = this.passiveSkills.length;
        }

        // Clear container
        container.innerHTML = '';

        if (this.passiveSkills.length === 0) {
            container.innerHTML = `
                <div class="skills-empty">
                    <i data-lucide="shield-off"></i>
                    <p>No passive skills</p>
                </div>
            `;
        } else {
            this.passiveSkills.forEach(skill => {
                const skillEl = this.createSkillElement(skill, 'passive');
                container.appendChild(skillEl);
            });
        }

        // Re-initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Create skill element
     */
    createSkillElement(skill, type) {
        const el = document.createElement('div');
        el.className = `skill-card ${type}`;
        el.dataset.skillId = skill.skillId || skill.id;
        
        const iconName = type === 'active' ? 'zap' : 'shield';
        const name = skill.name || this.getSkillName(skill.skillId || skill.id) || `Skill #${skill.skillId || skill.id}`;
        
        el.innerHTML = `
            <div class="skill-icon">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="skill-info">
                <span class="skill-name">${name}</span>
                <span class="skill-level">Level ${skill.level || 1}</span>
            </div>
        `;

        el.addEventListener('click', () => this.selectSkill(skill, type));
        
        return el;
    }

    /**
     * Select skill and show details
     */
    selectSkill(skill, type) {
        this.selectedSkill = skill;
        
        // Remove previous selection
        document.querySelectorAll('.skill-card').forEach(el => {
            el.classList.remove('selected');
        });

        // Add selection to current
        const skillId = skill.skillId || skill.id;
        const card = document.querySelector(`.skill-card[data-skill-id="${skillId}"]`);
        if (card) {
            card.classList.add('selected');
        }

        // Show details
        this.renderSkillDetails(skill, type);
    }

    /**
     * Render skill details panel
     */
    renderSkillDetails(skill, type) {
        const container = this.elements.skillDetails;
        if (!container) return;

        const skillId = skill.skillId || skill.id;
        const name = skill.name || this.getSkillName(skillId) || `Skill #${skillId}`;
        const skillType = skill.type || this.getSkillType(skillId) || type.toUpperCase();
        const iconName = type === 'active' ? 'zap' : 'shield';
        const typeLabel = type === 'active' ? 'Active Skill' : 'Passive Skill';
        const typeColor = type === 'active' ? '#4caf50' : '#2196f3';

        container.innerHTML = `
            <div class="skill-detail-header">
                <div class="skill-detail-icon" style="background: ${typeColor}20; border-color: ${typeColor}">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="skill-detail-info">
                    <h4>${name}</h4>
                    <span class="skill-detail-type" style="color: ${typeColor}">${typeLabel}</span>
                </div>
            </div>
            <div class="skill-detail-stats">
                <div class="skill-stat">
                    <label>Skill ID</label>
                    <code>${skillId}</code>
                </div>
                <div class="skill-stat">
                    <label>Level</label>
                    <span>${skill.level || 1}</span>
                </div>
                <div class="skill-stat">
                    <label>Type</label>
                    <span>${skillType}</span>
                </div>
            </div>
            <div class="skill-detail-actions">
                ${type === 'active' ? `
                    <button id="btn-use-skill" class="action-btn">
                        <i data-lucide="play"></i> Use Skill
                    </button>
                ` : ''}
            </div>
        `;

        // Bind use skill button
        if (type === 'active') {
            const useBtn = document.getElementById('btn-use-skill');
            if (useBtn) {
                useBtn.addEventListener('click', () => this.useSkill(skill));
            }
        }

        // Re-initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Use selected skill
     */
    async useSkill(skill) {
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }

            const skillId = skill.skillId || skill.id;
            const skillName = skill.name || this.getSkillName(skillId) || `Skill #${skillId}`;
            
            await apiClient.useSkill(skillId, skill.level || 1);
            
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`✨ Using skill: ${skillName}`);
            }
        } catch (error) {
            console.error('[SkillsPanel] Failed to use skill:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Failed to use skill: ${error.message}`);
            }
        }
    }

    /**
     * Clear skills display
     */
    clear() {
        this.activeSkills = [];
        this.passiveSkills = [];
        this.selectedSkill = null;
        this.render();
        
        if (this.elements.skillDetails) {
            this.elements.skillDetails.innerHTML = '<p>Select a skill to view details</p>';
        }
    }
}

// Create global instance
const skillsPanel = new SkillsPanel();
