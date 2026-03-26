/**
 * @fileoverview ServerListHandler - стратегия обработки пакета ServerList (0x04)
 * Обрабатывает список доступных игровых серверов
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';
import { type ServerInfo } from '../../packets/incoming/ServerListPacket';
import { Logger } from '../../../logger/Logger';

/**
 * Результат выбора сервера
 */
export interface ServerSelectionResult {
    success: boolean;
    server?: ServerInfo;
    error?: string;
}

/**
 * Стратегия обработки пакета ServerList
 * Сохраняет список серверов и автоматически выбирает нужный
 */
export class ServerListHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x04, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // ServerList принимается только в состоянии ожидания списка серверов
        return state === 'WAIT_SERVER_LIST';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const servers = this.decodeServerList(reader);
            
            if (servers.length === 0) {
                Logger.warn('ServerListHandler', 'No servers in list');
                return;
            }

            Logger.info('ServerListHandler', `Received ${servers.length} servers`);

            // Логируем все серверы
            for (const server of servers) {
                this.logServer(server);
            }

            // Выбираем сервер (в реальном сценарии ID сервера приходит из конфигурации)
            // Здесь мы сохраняем список и ждем внешнего выбора
            // или выбираем первый доступный
            const selectedServer = this.selectServer(servers);
            
            if (selectedServer) {
                Logger.info('ServerListHandler', 
                    `Selected server: ID=${selectedServer.serverId} IP=${selectedServer.ip}:${selectedServer.port}`
                );
            }

        } catch (error) {
            Logger.error('ServerListHandler', `Error processing packet: ${error}`);
        }
    }

    /**
     * Декодировать список серверов
     */
    private decodeServerList(reader: IPacketReader): ServerInfo[] {
        const servers: ServerInfo[] = [];

        try {
            // Пропускаем опкод
            reader.readUInt8();

            const serverCount = reader.readUInt8();
            reader.readUInt8(); // unknown byte

            for (let i = 0; i < serverCount; i++) {
                const serverId = reader.readUInt8();

                // Читаем IP (4 байта)
                const ipBytes = reader.readBytes(4);
                const ip = `${ipBytes[0]}.${ipBytes[1]}.${ipBytes[2]}.${ipBytes[3]}`;

                const port = reader.readInt32LE();
                const ageLimit = reader.readUInt8();
                const isPvp = reader.readUInt8() === 1;
                const onlinePlayers = reader.readUInt16LE();
                const maxPlayers = reader.readUInt16LE();
                const isOnline = reader.readUInt8() === 1;

                reader.readInt32LE(); // server flags
                reader.readUInt8();   // unknown byte

                const serverInfo: ServerInfo = {
                    serverId,
                    ip,
                    port,
                    ageLimit,
                    isPvp,
                    onlinePlayers,
                    maxPlayers,
                    isOnline,
                };

                servers.push(serverInfo);
            }
        } catch (error) {
            Logger.error('ServerListHandler', `Decode error: ${error}`);
        }

        return servers;
    }

    /**
     * Выбрать сервер из списка
     * По умолчанию выбирает первый доступный сервер
     */
    private selectServer(servers: ServerInfo[]): ServerInfo | null {
        // Сначала ищем онлайн серверы
        const onlineServers = servers.filter(s => s.isOnline);
        
        if (onlineServers.length > 0) {
            // Выбираем первый онлайн сервер
            const selected = onlineServers[0]!;
            this.sessionManager.selectServer(selected.serverId, servers);
            return selected;
        }

        // Если нет онлайн серверов, берем первый из списка
        if (servers.length > 0) {
            const selected = servers[0]!;
            this.sessionManager.selectServer(selected.serverId, servers);
            return selected;
        }

        return null;
    }

    /**
     * Выбрать конкретный сервер по ID
     */
    selectServerById(serverId: number, servers: ServerInfo[]): ServerSelectionResult {
        const server = this.sessionManager.selectServer(serverId, servers);
        
        if (server) {
            return {
                success: true,
                server,
            };
        }

        return {
            success: false,
            error: `Server with ID ${serverId} not found`,
        };
    }

    /**
     * Логировать информацию о сервере
     */
    private logServer(server: ServerInfo): void {
        Logger.info('ServerListHandler',
            `[SERVER] ID=${server.serverId} IP=${server.ip}:${server.port} ` +
            `Players=${server.onlinePlayers}/${server.maxPlayers} ` +
            `PVP=${server.isPvp} Online=${server.isOnline}`
        );
    }
}
