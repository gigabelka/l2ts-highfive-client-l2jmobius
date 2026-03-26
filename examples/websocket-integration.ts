/**
 * @fileoverview Пример интеграции GameSession с WebSocket сервером
 * 
 * Этот файл демонстрирует, как:
 * 1. Инициализировать WsServer на порту 8080 (standalone режим)
 * 2. Создать GameSession с callback'ом на получение пакетов
 * 3. Связать их: при получении JSON от PacketHandler → вызывать broadcast()
 * 
 * @example
 * ```bash
 * # Установи зависимости (если еще не установлены):
 * npm install ws
 * npm install --save-dev @types/ws
 * 
 * # Запусти пример:
 * npx ts-node examples/websocket-integration.ts
 * ```
 */

import { GameSession, createGameSession } from '../src/network/GameSession';
import { WsServer } from '../src/api/ws/WsServer';
import { PacketHandler } from '../src/packets/PacketHandler';
import { Logger } from '../src/logger/Logger';

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const CONFIG = {
    // WebSocket сервер будет на порту 8080
    wsPort: 8080,
    
    // L2 Game Server (замени на свои данные)
    gameHost: '127.0.0.1',
    gamePort: 7777,
    
    // Включаем debug-логирование
    debug: true
} as const;

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ PACKET HANDLER
// ============================================================================

/**
 * Регистрация обработчиков пакетов
 * В реальном приложении здесь регистрируются все нужные пакеты
 */
function initPacketHandlers(): void {
    Logger.info('Integration', 'Registering packet handlers...');
    
    // Пример регистрации (здесь должны быть реальные пакеты твоего проекта)
    // PacketHandler.register(0x04, UserInfoPacket);
    // PacketHandler.register(0x03, CharInfoPacket);
    // и т.д.
    
    Logger.info('Integration', `Registered ${PacketHandler.getRegisteredCount()} handlers`);
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ WEBSOCKET СЕРВЕРА
// ============================================================================

/**
 * Создает и запускает WebSocket сервер на порту 8080
 */
function initWebSocketServer(): WsServer {
    const wsServer = new WsServer();
    
    // Запускаем в standalone режиме (на порту 8080)
    wsServer.start(undefined, { 
        port: CONFIG.wsPort, 
        debug: CONFIG.debug 
    });
    
    Logger.info('Integration', `WebSocket server ready at ws://localhost:${CONFIG.wsPort}`);
    Logger.info('Integration', 'Open examples/websocket-client.html to see packets in real-time');
    
    return wsServer;
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ GAME SESSION
// ============================================================================

/**
 * Создает GameSession и связывает её с WebSocket сервером
 */
function initGameSession(wsServer: WsServer): GameSession {
    const session = createGameSession({
        debug: CONFIG.debug,
        
        // ✅ КЛЮЧЕВОЙ CALLBACK: вызывается при каждом получении пакета
        onPacketArrival: (result) => {
            if (result.success) {
                // Получаем JSON из пакета
                const packetJson = result.packet.toJSON ? result.packet.toJSON() : { 
                    opcode: result.opcode,
                    name: result.packet.constructor.name
                };
                
                // Добавляем метаданные
                const enrichedData = {
                    type: 'packet.received',
                    timestamp: new Date().toISOString(),
                    opcode: result.opcode,
                    opcodeHex: `0x${result.opcode.toString(16).padStart(2, '0')}`,
                    packetName: result.packet.constructor.name,
                    data: packetJson
                };
                
                // ✅ ОТПРАВЛЯЕМ ВСЕМ WEBSOCKET КЛИЕНТАМ
                wsServer.broadcast(enrichedData);
                
                Logger.info('Integration', `Broadcasted ${result.packet.constructor.name} to ${wsServer.getClientCount()} clients`);
            } else {
                // Отправляем ошибку парсинга тоже (для отладки)
                wsServer.broadcast({
                    type: 'packet.error',
                    timestamp: new Date().toISOString(),
                    opcode: result.opcode,
                    opcodeHex: `0x${result.opcode.toString(16).padStart(2, '0')}`,
                    error: (result as { error: string }).error,
                    hexDump: (result as { hexDump: string }).hexDump
                });
            }
        },
        
        onConnect: () => {
            Logger.info('Integration', '✅ Connected to Game Server');
            
            // Отправляем событие подключения всем WebSocket клиентам
            wsServer.broadcast({
                type: 'connection.connected',
                timestamp: new Date().toISOString(),
                server: `${CONFIG.gameHost}:${CONFIG.gamePort}`
            });
        },
        
        onClose: (hadError) => {
            Logger.info('Integration', `❌ Connection closed ${hadError ? '(with error)' : ''}`);
            
            wsServer.broadcast({
                type: 'connection.closed',
                timestamp: new Date().toISOString(),
                hadError
            });
        },
        
        onError: (err) => {
            Logger.error('Integration', `Socket error: ${err.message}`);
            
            wsServer.broadcast({
                type: 'connection.error',
                timestamp: new Date().toISOString(),
                error: err.message
            });
        }
    });
    
    return session;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================================

async function main(): Promise<void> {
    Logger.info('Integration', '='.repeat(60));
    Logger.info('Integration', '🎮 L2 WebSocket Integration Example');
    Logger.info('Integration', '='.repeat(60));
    
    // 1. Инициализируем обработчики пакетов
    initPacketHandlers();
    
    // 2. Запускаем WebSocket сервер (порт 8080)
    const wsServer = initWebSocketServer();
    
    // 3. Создаем GameSession и связываем с WebSocket
    const gameSession = initGameSession(wsServer);
    
    // 4. Подключаемся к Game Server
    Logger.info('Integration', `Connecting to ${CONFIG.gameHost}:${CONFIG.gamePort}...`);
    gameSession.connectTo(CONFIG.gameHost, CONFIG.gamePort);
    
    // 5. Graceful shutdown
    process.on('SIGINT', () => {
        Logger.info('Integration', '\nShutting down...');
        gameSession.disconnect();
        wsServer.stop();
        process.exit(0);
    });
}

// Запускаем
main().catch((error) => {
    Logger.error('Integration', `Fatal error: ${error}`);
    process.exit(1);
});
