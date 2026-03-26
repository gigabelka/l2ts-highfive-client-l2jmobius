/**
 * @fileoverview DashboardNew - Event-Driven UI с новой архитектурой
 * Подписывается на события IEventBus и перерисовывается автоматически
 * @module ui/DashboardNew
 */

import { getContainer } from "../config/di/appContainer";
import { DI_TOKENS } from "../config/di/Container";
import type { IEventBus } from "../application/ports";
import type {
  ICharacterRepository,
  IWorldRepository,
  IConnectionRepository,
} from "../domain/repositories";
import { Logger } from "../logger/Logger";

/**
 * Опции Dashboard
 */
export interface DashboardOptions {
  autoRender?: boolean;
  renderInterval?: number;
  verbose?: boolean;
  colored?: boolean;
}

/**
 * Компонент Dashboard UI с новой архитектурой
 */
export class Dashboard {
  private options: Required<DashboardOptions>;
  private unsubscribeFns: Array<() => void> = [];
  private renderTimer?: NodeJS.Timeout;
  private isDirty = false;
  private lastRender = 0;

  constructor(options: DashboardOptions = {}) {
    this.options = {
      autoRender: true,
      renderInterval: 1000,
      verbose: false,
      colored: true,
      ...options,
    };
  }

  /**
   * Запустить Dashboard
   */
  start(): void {
    Logger.info(
      "Dashboard",
      "Starting Event-Driven Dashboard (New Architecture)...",
    );

    this.subscribeToEvents();

    if (this.options.autoRender) {
      this.renderTimer = setInterval(() => {
        if (this.isDirty) {
          this.render();
          this.isDirty = false;
        }
      }, this.options.renderInterval);
    }

    // Первичный рендер
    this.render();
  }

  /**
   * Остановить Dashboard
   */
  stop(): void {
    Logger.info("Dashboard", "Stopping...");

    this.unsubscribeFns.forEach((fn) => fn());
    this.unsubscribeFns = [];

    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = undefined;
    }
  }

  /**
   * Принудительно обновить отображение
   */
  forceRender(): void {
    this.render();
  }

  /**
   * Подписаться на события
   */
  private subscribeToEvents(): void {
    const container = getContainer();
    const eventBus = container
      .resolve<IEventBus>(DI_TOKENS.EventBus)
      .getOrThrow();

    // Подписка на все события через subscribeAll
    const subscription = eventBus.subscribeAll(
      (event: { type: string; payload: unknown }) => {
        this.markDirty();

        if (this.options.verbose) {
          if (event.type.startsWith("combat.")) {
            Logger.info(
              "Dashboard",
              `[Combat] ${event.type}: ${JSON.stringify(event.payload)}`,
            );
          }
        }

        // Handle specific events
        if (
          event.type === "system.connected" ||
          event.type === "system.disconnected"
        ) {
          this.onSystemEvent(
            event as {
              type: string;
              payload: { characterName?: string; reason?: string };
            },
          );
        }
      },
    );

    this.unsubscribeFns.push(() => subscription.unsubscribe());
  }

  /**
   * Отметить что нужно перерисовать
   */
  private markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Обработчик системных событий
   */
  private onSystemEvent(event: {
    type: string;
    payload: { characterName?: string; reason?: string };
  }): void {
    this.markDirty();

    switch (event.type) {
      case "system.connected":
        Logger.info(
          "Dashboard",
          `✅ Connected: ${event.payload.characterName}`,
        );
        break;
      case "system.disconnected":
        Logger.info("Dashboard", `❌ Disconnected: ${event.payload.reason}`);
        break;
    }
  }

  /**
   * Отрисовать Dashboard
   */
  private render(): void {
    const now = Date.now();
    if (now - this.lastRender < 100) return;
    this.lastRender = now;

    // Получаем данные из репозиториев
    const container = getContainer();
    const charRepo = container
      .resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository)
      .getOrThrow();
    const worldRepo = container
      .resolve<IWorldRepository>(DI_TOKENS.WorldRepository)
      .getOrThrow();

    const connectionRepo = container
      .resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository)
      .getOrThrow();

    const character = charRepo.get();
    const connection = connectionRepo.get();
    const npcCount = character
      ? worldRepo.getNearbyNpcs(character.position, 10000).length
      : 0;
    const worldStats = { npcCount, itemCount: 0 };

    // Формируем вывод
    const lines: string[] = [];

    lines.push(this.renderHeader());
    lines.push(this.renderCharacter(character));
    lines.push(this.renderWorld(worldStats));
    lines.push(this.renderConnection(connection));
    lines.push(this.renderFooter());

    // Очищаем консоль и выводим
    console.clear();
    console.log(lines.join("\n"));
  }

  /**
   * Отрисовать заголовок
   */
  private renderHeader(): string {
    const now = new Date().toLocaleTimeString();
    return this.color(
      "cyan",
      `╔════════════════════════════════════════════════════════════╗\n` +
        `║           🎮 L2 Headless Client Dashboard                  ║\n` +
        `║           ${now}                                           ║\n` +
        `╚════════════════════════════════════════════════════════════╝`,
    );
  }

  /**
   * Отрисовать информацию о персонаже
   */
  private renderCharacter(
    character: import("../domain/entities").Character | null,
  ): string {
    if (!character) {
      return this.color("yellow", "\n⏳ Waiting for character data...\n");
    }

    const hpBar = this.renderBar(
      character.hp.current,
      character.hp.max,
      20,
      "red",
    );
    const mpBar = this.renderBar(
      character.mp.current,
      character.mp.max,
      20,
      "blue",
    );

    return `
${this.color("bright", "🧙 Character")}
${this.color("cyan", "─".repeat(60))}
  Name:  ${this.color("green", character.name.padEnd(20))} Level: ${this.color("yellow", String(character.level))}
  Class: ${String(character.classId).padEnd(20)} Race:  ${character.raceId}

  HP: ${hpBar} ${character.hp.current}/${character.hp.max}
  MP: ${mpBar} ${character.mp.current}/${character.mp.max}

  Position: ${character.position.x}, ${character.position.y}, ${character.position.z}
`;
  }

  /**
   * Отрисовать информацию о мире
   */
  private renderWorld(stats: { npcCount: number; itemCount: number }): string {
    return `
${this.color("bright", "🌍 World")}
${this.color("cyan", "─".repeat(60))}
  NPCs:    ${this.color("yellow", String(stats.npcCount).padStart(3))}
  Items:   ${this.color("yellow", String(stats.itemCount).padStart(3))}
`;
  }

  /**
   * Отрисовать информацию о подключении
   */
  private renderConnection(
    connection: import("../domain/repositories").ConnectionState,
  ): string {
    const phase = connection.phase;
    const statusColor = phase === "IN_GAME" ? "green" : (phase === "DISCONNECTED" ? "red" : "yellow");

    return `
${this.color("bright", "🔌 Connection")}
${this.color("cyan", "─".repeat(60))}
  Phase: ${this.color(statusColor, phase)}
  Host:  ${connection.host}:${connection.port}
`;
  }

  /**
   * Отрисовать подвал
   */
  private renderFooter(): string {
    return this.color("cyan", "═".repeat(62));
  }

  /**
   * Отрисовать прогресс-бар
   */
  private renderBar(
    current: number,
    max: number,
    width: number,
    color: "red" | "green" | "blue" | "yellow",
  ): string {
    const percent = Math.min(1, Math.max(0, current / max));
    const filled = Math.round(width * percent);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);
    return this.color(color, bar);
  }

  /**
   * Применить цвет к тексту
   */
  private color(color: string, text: string): string {
    if (!this.options.colored) return text;

    const colors: Record<string, string> = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      cyan: "\x1b[36m",
    };

    return `${colors[color] ?? colors["reset"]}${text}${colors["reset"]}`;
  }
}

// Синглтон
let dashboardInstance: Dashboard | null = null;

/**
 * Получить или создать Dashboard
 */
export function getDashboard(options?: DashboardOptions): Dashboard {
  if (!dashboardInstance) {
    dashboardInstance = new Dashboard(options);
  }
  return dashboardInstance;
}

/**
 * Уничтожить Dashboard (для тестов)
 */
export function destroyDashboard(): void {
  if (dashboardInstance) {
    dashboardInstance.stop();
    dashboardInstance = null;
  }
}
