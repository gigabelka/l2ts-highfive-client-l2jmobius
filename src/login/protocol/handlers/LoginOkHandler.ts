/**
 * @fileoverview LoginOkHandler - стратегия обработки пакета LoginOk (0x03)
 * Обрабатывает успешную авторизацию на Login Server
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';

import { Logger } from '../../../logger/Logger';

/**
 * Данные LoginOk
 */
export interface LoginOkData {
    loginOkId1: number;
    loginOkId2: number;
    unknown: number;
}

/**
 * Стратегия обработки пакета LoginOk
 * Сохраняет сессионные ключи в SessionManager
 */
export class LoginOkHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x03, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // LoginOk принимается только после отправки учетных данных
        return state === 'WAIT_LOGIN_OK';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const data = this.decodeLoginOk(reader);
            
            Logger.info('LoginOkHandler', 
                `Login successful - Session keys: ${data.loginOkId1.toString(16)}/${data.loginOkId2.toString(16)}`
            );

            // Сохраняем в SessionManager
            this.sessionManager.setLoginOk(data.loginOkId1, data.loginOkId2);

        } catch (error) {
            Logger.error('LoginOkHandler', `Error processing packet: ${error}`);
        }
    }

    /**
     * Декодировать LoginOk пакет
     */
    private decodeLoginOk(reader: IPacketReader): LoginOkData {
        // Пропускаем опкод
        reader.readUInt8();

        const loginOkId1 = reader.readInt32LE();
        const loginOkId2 = reader.readInt32LE();
        const unknown = reader.readInt32LE();

        return {
            loginOkId1,
            loginOkId2,
            unknown,
        };
    }
}
