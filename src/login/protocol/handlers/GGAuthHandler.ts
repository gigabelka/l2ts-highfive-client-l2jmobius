/**
 * @fileoverview GGAuthHandler - стратегия обработки пакета GGAuth (0x0B)
 * Обрабатывает ответ GGAuth от Login Server
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';

import { Logger } from '../../../logger/Logger';

/**
 * Стратегия обработки пакета GGAuth
 * Сохраняет ответ GGAuth в SessionManager
 */
export class GGAuthHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x0B, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // GGAuth принимается только после Init
        return state === 'WAIT_GG_AUTH';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const response = this.decodeGGAuth(reader);
            
            Logger.info('GGAuthHandler', `GGAuth response: ${response}`);

            // Сохраняем в SessionManager
            this.sessionManager.setGgAuthResponse(response);

        } catch (error) {
            Logger.error('GGAuthHandler', `Error processing packet: ${error}`);
        }
    }

    /**
     * Декодировать GGAuth пакет
     */
    private decodeGGAuth(reader: IPacketReader): number {
        // Пропускаем опкод
        reader.readUInt8();
        
        // Читаем ответ GGAuth
        return reader.readInt32LE();
    }
}
