import "dotenv/config";
import { z } from "zod";
import { Logger } from "./logger/Logger";

// =============================================================================
// Схемы валидации Zod v4
// =============================================================================

const ServerConfigSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  loginIp: z.union([z.string().ipv4(), z.string().ipv6()]),
  loginPort: z
    .number()
    .int()
    .min(1)
    .max(65535, "Port must be between 1 and 65535"),
  gamePort: z
    .number()
    .int()
    .min(1)
    .max(65535, "Port must be between 1 and 65535"),
  protocol: z
    .number()
    .int()
    .min(1)
    .max(9999, "Protocol must be a positive integer"),
  serverId: z.number().int().min(1, "Server ID must be at least 1"),
  charSlotIndex: z
    .number()
    .int()
    .min(0)
    .max(7, "Character slot must be between 0 and 7"),
});

const ApiConfigSchema = z.object({
  port: z
    .number()
    .int()
    .min(1)
    .max(65535, "API port must be between 1 and 65535"),
  host: z.string().min(1, "API host is required"),
  apiKey: z.string(), // Empty string = no auth required
  enableCors: z.boolean(),
  rateLimit: z.object({
    windowMs: z.number().int().positive(),
    maxRequests: z.number().int().positive(),
    moveLimit: z.number().int().positive(),
    combatLimit: z.number().int().positive(),
  }),
});

const DashboardConfigSchema = z.object({
  enabled: z.boolean(),
  title: z.string().min(1),
  refreshInterval: z.number().int().positive(),
  wsReconnect: z.object({
    initialDelay: z.number().int().positive(),
    maxDelay: z.number().int().positive(),
    multiplier: z.number().int().min(1),
  }),
  theme: z.enum(["dark", "light"]),
});

// =============================================================================
// Типы конфигурации
// =============================================================================

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

// =============================================================================
// Валидация и создание конфигурации
// =============================================================================

function validateServerConfig(): ServerConfig {
  const rawConfig = {
    username: process.env["L2_USERNAME"] || "qwerty",
    password: process.env["L2_PASSWORD"] || "qwerty",
    loginIp: process.env["L2_LOGIN_IP"] || "192.168.0.33",
    loginPort: parseInt(process.env["L2_LOGIN_PORT"] || "2106", 10),
    gamePort: parseInt(process.env["L2_GAME_PORT"] || "7777", 10),
    protocol: parseInt(process.env["L2_PROTOCOL"] || "267", 10),
    serverId: parseInt(process.env["L2_SERVER_ID"] || "2", 10),
    charSlotIndex: parseInt(process.env["L2_CHAR_SLOT"] || "0", 10),
  };

  const result = ServerConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    Logger.error("CONFIG", "❌ Server configuration validation failed:");
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      const envVar = getEnvVarName(path);
      Logger.error("CONFIG", `  - ${path}: ${issue.message}`);
      if (envVar) {
        Logger.error("CONFIG", `    Check environment variable: ${envVar}`);
      }
    }
    Logger.error("CONFIG", "\nPlease check your .env file and try again.");
    process.exit(1);
  }

  // // Предупреждение о дефолтных credentials только если используются реальные значения
  // if (rawConfig.username === "qwerty" && rawConfig.password === "qwerty") {
  //     Logger.warn("CONFIG", "Using default credentials. Set L2_USERNAME and L2_PASSWORD in .env file.");
  // }

  return result.data;
}

function validateApiConfig(): ApiConfig {
  const rawConfig = {
    port: parseInt(process.env["API_PORT"] || "3000", 10),
    host: "0.0.0.0",
    apiKey: process.env["API_KEY"] || "", // Empty = no auth required
    enableCors: true,
    rateLimit: {
      windowMs: 1000, // 1 second
      maxRequests: 100, // 100 requests per second
      moveLimit: 10, // 10 move commands per second
      combatLimit: 5, // 5 combat commands per second
    },
  };

  const result = ApiConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    Logger.error("CONFIG", "❌ API configuration validation failed:");
    for (const issue of result.error.issues) {
      Logger.error("CONFIG", `  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

function validateDashboardConfig(): DashboardConfig {
  const rawConfig = {
    enabled: true,
    title: "🎮 L2 Bot Dashboard",
    refreshInterval: 2000,
    wsReconnect: {
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
    },
    theme: "dark" as const,
  };

  const result = DashboardConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    Logger.error("CONFIG", "❌ Dashboard configuration validation failed:");
    for (const issue of result.error.issues) {
      Logger.error("CONFIG", `  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

/**
 * Получить имя переменной окружения по пути конфигурации
 */
function getEnvVarName(path: string): string | null {
  const mapping: Record<string, string> = {
    username: "L2_USERNAME",
    password: "L2_PASSWORD",
    loginIp: "L2_LOGIN_IP",
    loginPort: "L2_LOGIN_PORT",
    gamePort: "L2_GAME_PORT",
    protocol: "L2_PROTOCOL",
    serverId: "L2_SERVER_ID",
    charSlotIndex: "L2_CHAR_SLOT",
  };
  return mapping[path] || null;
}

// =============================================================================
// Экспорт конфигурации
// =============================================================================

const SERVER_CONFIG = validateServerConfig();
const API_CONFIG = validateApiConfig();
const DASHBOARD_CONFIG = validateDashboardConfig();

/**
 * Основная конфигурация сервера L2
 * @deprecated Используйте отдельные экспорты SERVER_CONFIG, API_CONFIG, DASHBOARD_CONFIG
 */
export const CONFIG = {
  Username: SERVER_CONFIG.username,
  Password: SERVER_CONFIG.password,
  LoginIp: SERVER_CONFIG.loginIp,
  LoginPort: SERVER_CONFIG.loginPort,
  GamePort: SERVER_CONFIG.gamePort,
  Protocol: SERVER_CONFIG.protocol,
  ServerId: SERVER_CONFIG.serverId,
  CharSlotIndex: SERVER_CONFIG.charSlotIndex,
} as const;

/**
 * Конфигурация API сервера
 * @deprecated Используйте API_CONFIG
 */
export const API_CONFIG_DEPRECATED = API_CONFIG;

/**
 * Конфигурация Dashboard
 * @deprecated Используйте DASHBOARD_CONFIG
 */
export const DASHBOARD_CONFIG_DEPRECATED = DASHBOARD_CONFIG;

// =============================================================================
// Новые предпочтительные экспорты
// =============================================================================

export { SERVER_CONFIG, API_CONFIG, DASHBOARD_CONFIG };

// Backward compatibility - прямые экспорты для удобства
export const Username = SERVER_CONFIG.username;
export const Password = SERVER_CONFIG.password;
export const LoginIp = SERVER_CONFIG.loginIp;
export const LoginPort = SERVER_CONFIG.loginPort;
export const GamePort = SERVER_CONFIG.gamePort;
export const Protocol = SERVER_CONFIG.protocol;
export const ServerId = SERVER_CONFIG.serverId;
export const CharSlotIndex = SERVER_CONFIG.charSlotIndex;

// =============================================================================
// WebSocket API Configuration
// =============================================================================

const WsConfigSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(1).max(65535),
  authEnabled: z.boolean(),
  authTokens: z.array(z.string()),
  maxClients: z.number().int().min(1).max(100),
  batchInterval: z.number().int().min(0).max(1000),
  moveThrottleMs: z.number().int().min(0).max(1000),
  debugAudit: z.boolean(),
});

export type WsConfig = z.infer<typeof WsConfigSchema>;

function validateWsConfig(): WsConfig {
  const rawConfig = {
    enabled: process.env["WS_ENABLED"] !== "false", // true by default
    port: parseInt(process.env["WS_PORT"] || "3001", 10), // Default 3001 to avoid conflict with API
    authEnabled: process.env["WS_AUTH_ENABLED"] === "true",
    authTokens: process.env["WS_AUTH_TOKENS"]?.split(",").filter(Boolean) || [],
    maxClients: parseInt(process.env["WS_MAX_CLIENTS"] || "10", 10),
    batchInterval: parseInt(process.env["WS_BATCH_INTERVAL"] || "50", 10),
    moveThrottleMs: parseInt(process.env["WS_MOVE_THROTTLE_MS"] || "100", 10),
    debugAudit: process.env["DEBUG_WS_AUDIT"] === "true",
  };

  const result = WsConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    Logger.error("CONFIG", "❌ WebSocket configuration validation failed:");
    for (const issue of result.error.issues) {
      Logger.error("CONFIG", `  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

/**
 * WebSocket API конфигурация
 */
export const WS_CONFIG = validateWsConfig();
