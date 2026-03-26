/**
 * @fileoverview PlayOkHandler - стратегия обработки пакета PlayOk (0x07)
 * Обрабатывает успешное завершение авторизации
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';
import { Logger } from '../../../logger/Logger';

/**
 * Данные PlayOk
 */
export interface PlayOkData {
    playOkId1: number;
    playOkId2: number;
}

/**
 * Стратегия обработки пакета PlayOk
 * Завершает процесс авторизации на Login Server
 */
export class PlayOkHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x07, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // PlayOk принимается только после запроса входа на сервер
        return state === 'WAIT_PLAY_OK';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const data = this.decodePlayOk(reader);
            
            Logger.info('PlayOkHandler', 
                `Play OK received - Keys: ${data.playOkId1.toString(16)}/${data.playOkId2.toString(16)}`
            );
            Logger.info('PlayOkHandler', 'Login Server authentication complete!');

            // Сохраняем в SessionManager - это завершит сессию
            this.sessionManager.setPlayOk(data.playOkId1, data.playOkId2);

        } catch (error) {
            Logger.error('PlayOkHandler', `Error processing packet: ${error}`);
        }
    }

    /**
     * Декодировать PlayOk пакет
     */
    private decodePlayOk(reader: IPacketReader): PlayOkData {
        // Пропускаем опкод
        reader.readUInt8();

        const playOkId1 = reader.readInt32LE();
        const playOkId2 = reader.readInt32LE();

        return {
            playOkId1,
            playOkId2,
        };
    }
}
