/**
 * @fileoverview LoginFailHandler - стратегия обработки пакета LoginFail (0x01)
 * Обрабатывает ошибку авторизации
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';

import { Logger } from '../../../logger/Logger';

/**
 * Причины ошибки авторизации
 */
export enum LoginFailReason {
    SYSTEM_ERROR = 0x01,
    WRONG_PASSWORD = 0x02,
    WRONG_LOGIN_OR_PASSWORD = 0x03,
    ACCESS_DENIED = 0x04,
    INVALID_ACCOUNT_INFO = 0x05,
    ACCESS_DENIED_TRY_LATER = 0x06,
    ACCOUNT_ALREADY_IN_USE = 0x07,
    AGE_RESTRICTION = 0x08,
    SERVER_FULL = 0x09,
    MAINTENANCE = 0x10,
    TEMPORARY_BAN = 0x11,
    DUAL_BOX_RESTRICTION = 0x23,
}

/**
 * Получить текстовое описание причины ошибки
 */
export function getLoginFailReasonMessage(code: number): string {
    switch (code) {
        case LoginFailReason.SYSTEM_ERROR: return 'System error';
        case LoginFailReason.WRONG_PASSWORD: return 'Wrong password';
        case LoginFailReason.WRONG_LOGIN_OR_PASSWORD: return 'Wrong login or password';
        case LoginFailReason.ACCESS_DENIED: return 'Access denied';
        case LoginFailReason.INVALID_ACCOUNT_INFO: return 'Invalid account info';
        case LoginFailReason.ACCESS_DENIED_TRY_LATER: return 'Access denied (try later)';
        case LoginFailReason.ACCOUNT_ALREADY_IN_USE: return 'Account already in use';
        case LoginFailReason.AGE_RESTRICTION: return 'Age restriction';
        case LoginFailReason.SERVER_FULL: return 'Server full';
        case LoginFailReason.MAINTENANCE: return 'Server maintenance';
        case LoginFailReason.TEMPORARY_BAN: return 'Temporary ban';
        case LoginFailReason.DUAL_BOX_RESTRICTION: return 'Dual box restriction';
        default: return `Unknown reason (0x${code.toString(16).toUpperCase()})`;
    }
}

/**
 * Стратегия обработки пакета LoginFail
 * Уведомляет SessionManager об ошибке авторизации
 */
export class LoginFailHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x01, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // LoginFail может прийти в разных состояниях
        return state === 'WAIT_INIT' || state === 'WAIT_LOGIN_OK' || state === 'WAIT_PLAY_OK';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const reason = this.decodeLoginFail(reader);
            
            const message = getLoginFailReasonMessage(reason);
            
            Logger.error('LoginFailHandler', `Authentication failed: ${message}`);

            // Уведомляем SessionManager об ошибке
            this.sessionManager.setAuthFailed(reason, message);

        } catch (error) {
            Logger.error('LoginFailHandler', `Error processing packet: ${error}`);
        }
    }

    /**
     * Декодировать LoginFail пакет
     */
    private decodeLoginFail(reader: IPacketReader): number {
        // Пропускаем опкод
        reader.readUInt8();
        
        // Читаем код причины
        return reader.readUInt8();
    }
}
