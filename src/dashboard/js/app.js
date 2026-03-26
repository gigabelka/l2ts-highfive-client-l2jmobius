/**
 * L2 Bot Dashboard - Main Application (Simplified)
 */

class DashboardApp {
  constructor() {
    this.currentTab = "dashboard";
    this.connectionStatus = "DISCONNECTED";
    this.pingInterval = null;
    this.statusCheckInterval = null;
    this.lastWsActivity = 0;
    this.isInGame = false;
  }

  /**
   * Initialize the dashboard
   */
  init() {
    // Check dependencies
    if (typeof lucide === "undefined") {
      console.error("[DashboardApp] Lucide not loaded!");
    }
    if (typeof apiClient === "undefined") {
      console.error("[DashboardApp] apiClient not loaded!");
    }
    if (typeof wsClient === "undefined") {
      console.error("[DashboardApp] wsClient not loaded!");
    }
    if (typeof statusPanel === "undefined") {
      console.error("[DashboardApp] statusPanel not loaded!");
    }

    // Initialize Lucide icons
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    // Setup navigation
    this.setupNavigation();

    // Setup quick action buttons
    this.setupQuickActions();

    // Start WebSocket connection
    this.setupWebSocket();

    // Start status polling (after a small delay to ensure all components ready)
    setTimeout(() => {
      this.startStatusPolling();
    }, 100);

    // Start ping monitoring
    this.startPingMonitor();

    // Initial status update
    this.updateConnectionStatus();
  }

  /**
   * Setup navigation tabs
   */
  setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  /**
   * Switch to a different tab
   */
  switchTab(tab) {
    console.log("[DashboardApp] Switching to tab:", tab);

    // Update nav links
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle("active", content.id === `tab-${tab}`);
    });

    this.currentTab = tab;

    // Special handling for specific tabs
    if (tab === "skills") {
      // Refresh skills when switching to skills tab
      if (typeof skillsPanel !== "undefined") {
        skillsPanel.refresh();
      }
    }

    if (tab === "inventory") {
      // Refresh inventory when switching to inventory tab
      if (typeof inventoryPanel !== "undefined") {
        inventoryPanel.refresh();
      }
    }

    if (tab === "ws-monitor") {
      // Force render packet console when switching to WS Monitor tab
      if (typeof packetConsole !== "undefined") {
        packetConsole.render();
      }
    }

    // Re-initialize icons after tab switch
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  }

  /**
   * Setup quick action buttons with enhanced functionality
   */
  setupQuickActions() {
    // Toggle Connect button (Connect/Disconnect)
    const btnToggleConnect = document.getElementById("btn-toggle-connect");
    if (btnToggleConnect) {
      btnToggleConnect.addEventListener("click", () =>
        this.handleToggleConnect(),
      );
    }

    // Attack button - toggle attack
    const btnAttack = document.getElementById("btn-attack");
    if (btnAttack) {
      btnAttack.addEventListener("click", () => this.handleAttack());
    }

    // Next Target button
    const btnNextTarget = document.getElementById("btn-next-target");
    if (btnNextTarget) {
      btnNextTarget.addEventListener("click", () => this.handleNextTarget());
    }

    // Pickup button
    const btnPickup = document.getElementById("btn-pickup");
    if (btnPickup) {
      btnPickup.addEventListener("click", () => this.handlePickup());
    }

    // Sit button - toggle sit/stand
    const btnSit = document.getElementById("btn-sit");
    if (btnSit) {
      btnSit.addEventListener("click", () => this.handleSit());
    }

    // Chat button
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
      btnChat.addEventListener("click", () => this.handleChat());
    }

    // Target actions
    const btnTargetAttack = document.getElementById("btn-target-attack");
    if (btnTargetAttack) {
      btnTargetAttack.addEventListener("click", () =>
        this.handleTargetAttack(),
      );
    }

    const btnTargetSkill = document.getElementById("btn-target-skill");
    if (btnTargetSkill) {
      btnTargetSkill.addEventListener("click", () => this.handleTargetSkill());
    }

    // Movement buttons
    this.setupMovementControls();
  }

  /**
   * Setup movement controls
   */
  setupMovementControls() {
    // Movement buttons
    const btnForward = document.getElementById("btn-move-forward");
    const btnBackward = document.getElementById("btn-move-backward");
    const btnLeft = document.getElementById("btn-move-left");
    const btnRight = document.getElementById("btn-move-right");
    const btnStop = document.getElementById("btn-move-stop");

    if (btnForward) {
      btnForward.addEventListener("click", () => this.handleMove("forward"));
    }
    if (btnBackward) {
      btnBackward.addEventListener("click", () => this.handleMove("backward"));
    }
    if (btnLeft) {
      btnLeft.addEventListener("click", () => this.handleMove("left"));
    }
    if (btnRight) {
      btnRight.addEventListener("click", () => this.handleMove("right"));
    }
    if (btnStop) {
      btnStop.addEventListener("click", () => this.handleStopMove());
    }

    // Keyboard controls for movement
    document.addEventListener("keydown", (e) => {
      if (!this.isInGame) return;
      // Don't trigger if typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          e.preventDefault();
          this.handleMove("forward");
          break;
        case "s":
        case "arrowdown":
          e.preventDefault();
          this.handleMove("backward");
          break;
        case "a":
        case "arrowleft":
          e.preventDefault();
          this.handleMove("left");
          break;
        case "d":
        case "arrowright":
          e.preventDefault();
          this.handleMove("right");
          break;
        case "x":
          e.preventDefault();
          this.handleStopMove();
          break;
      }
    });

    // Step size slider
    const stepSlider = document.getElementById("movement-step");
    const stepValue = document.getElementById("movement-step-value");
    if (stepSlider && stepValue) {
      stepSlider.addEventListener("input", (e) => {
        stepValue.textContent = e.target.value;
      });
    }
  }

  /**
   * Get current character position from UI
   */
  getCurrentPosition() {
    const posX = document.getElementById("pos-x");
    const posY = document.getElementById("pos-y");
    const posZ = document.getElementById("pos-z");

    if (!posX || !posY || !posZ) return null;

    const x = parseInt(posX.textContent);
    const y = parseInt(posY.textContent);
    const z = parseInt(posZ.textContent);

    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;

    return { x, y, z };
  }

  /**
   * Get movement step size from slider
   */
  getMovementStep() {
    const slider = document.getElementById("movement-step");
    return slider ? parseInt(slider.value) : 100;
  }

  /**
   * Handle movement in a direction
   */
  async handleMove(direction) {
    if (!this.isInGame) {
      console.warn("[DashboardApp] Not in game, cannot move");
      return;
    }

    const currentPos = this.getCurrentPosition();
    if (!currentPos) {
      console.warn("[DashboardApp] Position unknown, cannot move");
      return;
    }

    const step = this.getMovementStep();
    let newPos = { ...currentPos };

    switch (direction) {
      case "forward":
        newPos.y -= step;
        break;
      case "backward":
        newPos.y += step;
        break;
      case "left":
        newPos.x -= step;
        break;
      case "right":
        newPos.x += step;
        break;
    }

    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }

      console.log(`[DashboardApp] Moving ${direction} (${step} units)`);
      await apiClient.moveTo(newPos.x, newPos.y, newPos.z);
    } catch (error) {
      console.error("[DashboardApp] Move error:", error);
    }
  }

  /**
   * Handle stop movement
   */
  async handleStopMove() {
    if (!this.isInGame) return;

    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }

      await apiClient.stopMove();
      console.log("[DashboardApp] Stopped");
    } catch (error) {
      console.error("[DashboardApp] Stop move error:", error);
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocket() {
    if (typeof wsClient === "undefined") {
      console.error("[DashboardApp] wsClient not available");
      return;
    }

    // Initialize packet console
    if (typeof packetConsole !== "undefined") {
      packetConsole.init();
    }

    wsClient.addEventListener("connected", () => {
      console.log("[DashboardApp] WebSocket connected");
      this.updateConnectionStatus();
      if (typeof packetConsole !== "undefined") {
        packetConsole.setWsStatus("connected");
      }
    });

    wsClient.addEventListener("disconnected", () => {
      console.log("[DashboardApp] WebSocket disconnected");
      this.updateConnectionStatus();
      if (typeof packetConsole !== "undefined") {
        packetConsole.setWsStatus("disconnected");
      }
    });

    wsClient.addEventListener("error", (e) => {
      console.error("[DashboardApp] WS error:", e.detail);
      if (typeof packetConsole !== "undefined") {
        packetConsole.setWsStatus("error", "Connection Error");
      }
    });

    wsClient.addEventListener("any", (e) => {
      this.lastWsActivity = Date.now();
      
      // Send to packet console
      if (typeof packetConsole !== "undefined" && e.detail) {
        packetConsole.onWsMessage(e.detail);
      }
    });

    // System events for connection status
    wsClient.addEventListener("system.connected", (e) => {
      this.connectionStatus = e.detail?.phase || "IN_GAME";
      this.isInGame = this.connectionStatus === "IN_GAME";
      this.updateConnectionStatus();
      this.updateActionButtons();
      console.log(
        "[DashboardApp] Connected to game:",
        e.detail?.characterName || "Unknown",
      );
    });

    wsClient.addEventListener("system.disconnected", (e) => {
      console.log("[DashboardApp] System disconnected:", e.detail);
      this.connectionStatus = "DISCONNECTED";
      this.isInGame = false;
      this.updateConnectionStatus();
      this.updateActionButtons();
    });

    // Granular connection phase updates
    wsClient.addEventListener("connection.phase_changed", (e) => {
      if (e.detail && e.detail.phase) {
        this.connectionStatus = e.detail.phase;
        this.isInGame = this.connectionStatus === "IN_GAME";
        this.updateConnectionStatus();
        this.updateActionButtons();
      }
    });

    // Initial connection
    wsClient.connect();
    
    // Set initial status
    if (typeof packetConsole !== "undefined") {
      packetConsole.setWsStatus("connecting");
    }
  }

  /**
   * Start status polling
   */
  startStatusPolling() {
    // Start character status polling
    if (typeof statusPanel !== "undefined") {
      statusPanel.start();
    } else {
      console.error("[DashboardApp] statusPanel not available for polling");
    }

    // Start inventory polling
    if (typeof inventoryPanel !== "undefined") {
      inventoryPanel.start();
    } else {
      console.error("[DashboardApp] inventoryPanel not available");
    }

    // Poll general status
    this.updateStatus();
    this.statusCheckInterval = setInterval(() => this.updateStatus(), 5000);
  }

  /**
   * Start ping monitor
   */
  startPingMonitor() {
    this.pingInterval = setInterval(() => {
      this.measurePing();
    }, 5000);
  }

  /**
   * Update connection status display
   */
  async updateStatus() {
    try {
      if (typeof apiClient === "undefined") {
        console.warn("[DashboardApp] apiClient not available");
        return;
      }

      const status = await apiClient.getStatus();

      this.connectionStatus = status.phase || "DISCONNECTED";
      this.isInGame = this.connectionStatus === "IN_GAME";
      this.updateConnectionStatus();

      // Update quick action buttons
      this.updateActionButtons();

      // Update target display if we have target info
      if (status.target) {
        this.updateTargetDisplay(status.target);
      }
    } catch (error) {
      console.error("[DashboardApp] Failed to get status:", error);
      this.connectionStatus = "DISCONNECTED";
      this.isInGame = false;
      this.updateConnectionStatus();
      this.updateActionButtons();
    }
  }

  /**
   * Update connection status UI
   */
  updateConnectionStatus() {
    const statusEl = document.getElementById("connection-status");
    if (!statusEl) {
      console.warn("[DashboardApp] connection-status element not found");
      return;
    }

    // Remove old status classes
    statusEl.classList.remove("connected", "connecting", "error");

    // Add appropriate class
    const phase = this.connectionStatus;
    let statusText = phase;
    let statusClass = "";

    if (phase === "IN_GAME") {
      statusClass = "connected";
      statusText = "IN GAME";
    } else if (phase === "DISCONNECTED" || phase === "ERROR") {
      statusClass = "error";
      statusText = phase === "ERROR" ? "ERROR" : "OFFLINE";
    } else {
      statusClass = "connecting";
      statusText = Formatters.phase(phase);
    }

    statusEl.classList.add(statusClass);
    const span = statusEl.querySelector("span");
    if (span) span.textContent = statusText;
  }

  /**
   * Update action buttons state based on game status
   */
  updateActionButtons() {
    const isInGame = this.isInGame;

    // Combat buttons - only enabled when in game
    const combatButtons = [
      "btn-attack",
      "btn-next-target",
      "btn-pickup",
      "btn-sit",
      "btn-chat",
    ];
    combatButtons.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = !isInGame;
        btn.classList.toggle("disabled", !isInGame);
      }
    });

    // Movement buttons - only enabled when in game
    const movementButtons = [
      "btn-move-forward",
      "btn-move-backward",
      "btn-move-left",
      "btn-move-right",
      "btn-move-stop",
    ];
    movementButtons.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = !isInGame;
      }
    });

    // Toggle Connect button
    const btnToggleConnect = document.getElementById("btn-toggle-connect");
    if (btnToggleConnect) {
      const isDisconnected =
        this.connectionStatus === "DISCONNECTED" ||
        this.connectionStatus === "ERROR";
      if (isDisconnected) {
        btnToggleConnect.innerHTML = '<i data-lucide="log-in"></i> Connect';
        btnToggleConnect.classList.remove("secondary");
      } else {
        btnToggleConnect.innerHTML = '<i data-lucide="log-out"></i> Disconnect';
        btnToggleConnect.classList.add("secondary");
      }
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    }

    // Target action buttons
    const targetDetails = document.getElementById("target-details");
    const hasTarget =
      targetDetails && !targetDetails.classList.contains("hidden");
    const btnTargetAttack = document.getElementById("btn-target-attack");
    const btnTargetSkill = document.getElementById("btn-target-skill");

    if (btnTargetAttack) btnTargetAttack.disabled = !isInGame || !hasTarget;
    if (btnTargetSkill) btnTargetSkill.disabled = !isInGame || !hasTarget;
  }

  /**
   * Set button loading state
   */
  setButtonLoading(buttonId, loading = true) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (loading) {
      btn.dataset.originalContent = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> ...';
      btn.disabled = true;
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    } else {
      btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
      btn.disabled = false;
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    }
  }

  /**
   * Measure ping to server
   */
  async measurePing() {
    if (typeof apiClient === "undefined") return;

    const start = Date.now();
    try {
      await apiClient.getStatus();
      const ping = Date.now() - start;

      const pingBadge = document.getElementById("ping-badge");
      if (pingBadge) {
        pingBadge.textContent = `${ping} ms`;
        pingBadge.classList.remove("ping-good", "ping-medium", "ping-bad");
        if (ping < 100) pingBadge.classList.add("ping-good");
        else if (ping < 300) pingBadge.classList.add("ping-medium");
        else pingBadge.classList.add("ping-bad");
      }
    } catch (error) {
      const pingBadge = document.getElementById("ping-badge");
      if (pingBadge) {
        pingBadge.textContent = "-- ms";
        pingBadge.classList.remove("ping-good", "ping-medium", "ping-bad");
      }
    }
  }

  /**
   * Update target display
   */
  updateTargetDisplay(target) {
    const targetEmpty = document.querySelector(".target-empty");
    const targetDetails = document.getElementById("target-details");

    if (!target || !target.objectId) {
      if (targetEmpty) targetEmpty.classList.remove("hidden");
      if (targetDetails) targetDetails.classList.add("hidden");
      this.updateActionButtons();
      return;
    }

    if (targetEmpty) targetEmpty.classList.add("hidden");
    if (targetDetails) {
      targetDetails.classList.remove("hidden");

      const targetName = document.getElementById("target-name");
      const targetType = document.getElementById("target-type");
      const targetLevel = document.getElementById("target-level");

      // Resolve NPC name from database if available
      let displayName = target.name;
      let displayLevel = target.level;

      if (
        target.type === "NPC" &&
        target.npcId &&
        typeof npcDatabase !== "undefined"
      ) {
        const npcIdNum = parseInt(target.npcId);
        const dbName = npcDatabase.getNpcName(npcIdNum);
        if (dbName) {
          displayName = dbName;
        }
        const dbLevel = npcDatabase.getNpcLevel(npcIdNum);
        if (dbLevel) {
          displayLevel = dbLevel;
        }
      }

      if (targetName) targetName.textContent = displayName || "Unknown";
      if (targetType) targetType.textContent = target.type || "NPC";
      if (targetLevel) targetLevel.textContent = `Level ${displayLevel || "?"}`;

      const hpBar = document.getElementById("target-hp-bar");
      const hpValue = document.getElementById("target-hp-value");
      if (target.hp && hpBar && hpValue) {
        const hpPercent = Formatters.percent(target.hp.current, target.hp.max);
        hpBar.value = hpPercent;
        hpValue.textContent = Formatters.stat(target.hp.current, target.hp.max);
      }

      const targetDistance = document.getElementById("target-distance");
      if (targetDistance) {
        targetDistance.textContent = `Distance: ${Formatters.distance(target.distance)}`;
      }
    }

    this.updateActionButtons();
  }

  // ==================== Action Handlers ====================

  async handleToggleConnect() {
    const isDisconnected =
      this.connectionStatus === "DISCONNECTED" ||
      this.connectionStatus === "ERROR";

    if (isDisconnected) {
      // Connect
      console.log("[DashboardApp] Handle Connect clicked");

      this.setButtonLoading("btn-toggle-connect", true);
      try {
        if (typeof apiClient === "undefined") {
          throw new Error("API client not available");
        }
        const result = await apiClient.connect();
        console.log("[DashboardApp] Connect result:", result);
      } catch (error) {
        console.error("[DashboardApp] Connect error:", error);
      } finally {
        this.setButtonLoading("btn-toggle-connect", false);
      }
    } else {
      // Disconnect
      console.log("[DashboardApp] Handle Disconnect clicked");

      this.setButtonLoading("btn-toggle-connect", true);
      try {
        if (typeof apiClient === "undefined") {
          throw new Error("API client not available");
        }
        await apiClient.disconnect();
        console.log("[DashboardApp] Disconnected from game server");
        this.isInGame = false;
        this.updateActionButtons();
      } catch (error) {
        console.error("[DashboardApp] Disconnect error:", error);
      } finally {
        this.setButtonLoading("btn-toggle-connect", false);
      }
    }
  }

  async handleAttack() {
    console.log("[DashboardApp] Handle Attack clicked");
    const btnAttack = document.getElementById("btn-attack");
    const isAttacking = btnAttack?.classList.contains("active");

    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }
      await apiClient.attack();
    } catch (error) {
      console.error("[DashboardApp] Attack error:", error);
    }
  }

  async handleNextTarget() {
    console.log("[DashboardApp] Handle Next Target clicked");
    this.setButtonLoading("btn-next-target", true);
    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }

      const target = await apiClient.nextTarget();

      // Resolve name from database for display
      let displayName = target.name;
      let displayLevel = target.level;
      if (target.npcId && typeof npcDatabase !== "undefined") {
        const dbName = npcDatabase.getNpcName(target.npcId);
        if (dbName) displayName = dbName;
        const dbLevel = npcDatabase.getNpcLevel(target.npcId);
        if (dbLevel) displayLevel = dbLevel;
      }

      console.log(
        `[DashboardApp] Target: ${displayName} (Lv.${displayLevel}, ${target.distance?.toFixed(1)}m)`,
      );

      // Update target UI (pass original target with npcId for proper lookup)
      this.updateTargetDisplay(target);
    } catch (error) {
      console.error("[DashboardApp] Next target error:", error);
    } finally {
      this.setButtonLoading("btn-next-target", false);
    }
  }

  async handlePickup() {
    console.log("[DashboardApp] Handle Pickup clicked");
    this.setButtonLoading("btn-pickup", true);
    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }

      // Get nearby items first
      const result = await apiClient.getNearbyItems(200);
      const items = result?.items || [];
      if (items.length > 0) {
        // Pick up the closest item
        const item = items[0];
        await apiClient.pickupItem(item.objectId);
        console.log(
          `[DashboardApp] Moving to pickup ${item.name || "item"} x${item.count || 1}`,
        );
      } else {
        console.log("[DashboardApp] No items nearby to pickup");
      }
    } catch (error) {
      console.error("[DashboardApp] Pickup error:", error);
    } finally {
      this.setButtonLoading("btn-pickup", false);
    }
  }

  async handleSit() {
    console.log("[DashboardApp] Handle Sit clicked");
    const btnSit = document.getElementById("btn-sit");
    const isSitting = btnSit?.classList.contains("active");

    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }

      await apiClient.toggleSit(isSitting); // true = stand, false = sit
      if (isSitting) {
        console.log("[DashboardApp] Standing up");
        if (btnSit) {
          btnSit.classList.remove("active");
          btnSit.innerHTML = '<i data-lucide="armchair"></i> Sit/Stand';
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
      } else {
        console.log("[DashboardApp] Sitting down");
        if (btnSit) {
          btnSit.classList.add("active");
          btnSit.innerHTML = '<i data-lucide="user"></i> Sit/Stand';
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
      }
    } catch (error) {
      console.error("[DashboardApp] Sit error:", error);
    }
  }

  async handleChat() {
    console.log("[DashboardApp] Handle Chat clicked");

    // Create a nicer modal for chat instead of prompt
    const result = await this.showChatDialog();
    if (result && result.message) {
      try {
        if (typeof apiClient === "undefined") {
          throw new Error("API client not available");
        }

        await apiClient.sendChat(result.channel, result.message);
        console.log(
          `[DashboardApp] Chat [${result.channel}]: ${result.message}`,
        );
      } catch (error) {
        console.error("[DashboardApp] Chat error:", error);
      }
    }
  }

  /**
   * Show chat input dialog
   */
  showChatDialog() {
    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement("div");
      modal.className = "chat-modal";
      modal.innerHTML = `
                <div class="chat-modal-content">
                    <h4>Send Message</h4>
                    <select id="chat-channel">
                        <option value="ALL">All</option>
                        <option value="TRADE">Trade</option>
                        <option value="SHOUT">Shout</option>
                        <option value="TELL">Tell</option>
                        <option value="CLAN">Clan</option>
                        <option value="ALLIANCE">Alliance</option>
                        <option value="PARTY">Party</option>
                    </select>
                    <input type="text" id="chat-message" placeholder="Enter your message..." maxlength="100">
                    <div class="chat-modal-actions">
                        <button id="chat-cancel" class="secondary">Cancel</button>
                        <button id="chat-send">Send</button>
                    </div>
                </div>
            `;

      document.body.appendChild(modal);

      const channelSelect = modal.querySelector("#chat-channel");
      const input = modal.querySelector("#chat-message");
      const sendBtn = modal.querySelector("#chat-send");
      const cancelBtn = modal.querySelector("#chat-cancel");

      input.focus();

      const cleanup = () => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      };

      const getResult = () => ({
        channel: channelSelect.value,
        message: input.value.trim(),
      });

      sendBtn.addEventListener("click", () => {
        const result = getResult();
        cleanup();
        resolve(result);
      });

      cancelBtn.addEventListener("click", () => {
        cleanup();
        resolve(null);
      });

      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const result = getResult();
          cleanup();
          resolve(result);
        }
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      });

      // Close on backdrop click
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  async handleTargetAttack() {
    console.log("[DashboardApp] Handle Target Attack clicked");
    const targetInfo = document.getElementById("target-details");
    if (targetInfo && !targetInfo.classList.contains("hidden")) {
      await this.handleAttack();
    } else {
      console.warn("[DashboardApp] No target selected");
    }
  }

  async handleTargetSkill() {
    console.log("[DashboardApp] Handle Target Skill clicked");
    const targetInfo = document.getElementById("target-details");
    if (!targetInfo || targetInfo.classList.contains("hidden")) {
      console.warn("[DashboardApp] No target selected");
      return;
    }

    // Show skill selection dialog
    try {
      if (typeof apiClient === "undefined") {
        throw new Error("API client not available");
      }

      const skills = await apiClient.getSkills();
      if (!skills || skills.length === 0) {
        console.log("[DashboardApp] No skills available");
        return;
      }

      const skillId = await this.showSkillDialog(skills);
      if (skillId) {
        const skillName = this.getSkillName(skillId) || `Skill #${skillId}`;
        await apiClient.useSkill(skillId, 1);
        console.log(`[DashboardApp] Using skill: ${skillName}`);
      }
    } catch (error) {
      console.error("[DashboardApp] Skill error:", error);
    }
  }

  /**
   * Load skill names from database
   */
  async loadSkillNames() {
    if (this.skillNameCache) return this.skillNameCache;

    try {
      const response = await fetch("/data/skills.json");
      if (response.ok) {
        this.skillNameCache = await response.json();
        return this.skillNameCache;
      }
    } catch (error) {
      console.warn("[DashboardApp] Failed to load skill names:", error);
    }
    return {};
  }

  /**
   * Get skill name from cache
   */
  getSkillName(skillId) {
    if (this.skillNameCache && this.skillNameCache[skillId]) {
      return this.skillNameCache[skillId].name;
    }
    return null;
  }

  /**
   * Show skill selection dialog
   */
  async showSkillDialog(skills) {
    // Ensure skill names are loaded
    await this.loadSkillNames();

    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "skill-modal";

      const skillsHtml = skills
        .map((s) => {
          const skillId = s.id || s.skillId;
          const skillName =
            s.name || this.getSkillName(skillId) || `Skill #${skillId}`;
          return `
                    <div class="skill-item" data-skill-id="${skillId}">
                        <span class="skill-name">${skillName}</span>
                        <span class="skill-level">Lv.${s.level || 1}</span>
                    </div>
                `;
        })
        .join("");

      modal.innerHTML = `
                <div class="skill-modal-content">
                    <h4>Select Skill</h4>
                    <div class="skills-list">
                        ${skillsHtml}
                    </div>
                    <div class="skill-modal-actions">
                        <button id="skill-cancel" class="secondary">Cancel</button>
                    </div>
                </div>
            `;

      document.body.appendChild(modal);

      const cleanup = () => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      };

      modal.querySelectorAll(".skill-item").forEach((item) => {
        item.addEventListener("click", () => {
          const skillId = parseInt(item.dataset.skillId);
          cleanup();
          resolve(skillId);
        });
      });

      modal.querySelector("#skill-cancel").addEventListener("click", () => {
        cleanup();
        resolve(null);
      });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }
}

// Initialize when DOM is ready
console.log("[DashboardApp] Script loaded, waiting for DOM...");
document.addEventListener("DOMContentLoaded", () => {
  window.dashboard = new DashboardApp();
  window.dashboard.init();
});
