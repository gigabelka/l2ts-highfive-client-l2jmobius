/**
 * @fileoverview PlayFailHandler - стратегия обработки пакета PlayFail (0x06)
 * Обрабатывает ошибку входа на Game Server
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';
import { Logger } from '../../../logger/Logger';

/**
 * Причины ошибки Play
 */
export enum PlayFailReason {
    SYSTEM_ERROR = 0x01,
    INVALID_SELECTION = 0x02,
    UPDATE_USER_INFO = 0x03,
    UPDATE_USER_CARD = 0x04,
    UPDATE_USER_PAYMENT = 0x05,
    UPDATE_USER_STAT = 0x06,
    UPDATE_USER_ACCOUNT = 0x07,
    UPDATE_USER_ITEM = 0x08,
    UPDATE_USER_SKILL = 0x09,
    UPDATE_USER_HOTPOINT = 0x0A,
    UPDATE_USER_BIRTHDAY = 0x0B,
    UPDATE_USER_DERIVED = 0x0C,
    UPDATE_USER_ENCHANT = 0x0D,
    UPDATE_USER_FRIEND = 0x0E,
    UPDATE_USER_MSN = 0x0F,
    UPDATE_USER_PROP = 0x10,
    UPDATE_USER_EXTPROP = 0x11,
    UPDATE_USER_QUEST = 0x12,
    UPDATE_USER_MACRO = 0x13,
    UPDATE_USER_CONFIG = 0x14,
    UPDATE_USER_ATTACH = 0x15,
    UPDATE_USER_RECIPE = 0x16,
    UPDATE_USER_BOOKMARK = 0x17,
    UPDATE_USER_CLASSID = 0x18,
    UPDATE_USER_COLOR = 0x19,
    UPDATE_USER_INVENTORY = 0x1A,
    UPDATE_USER_WAREHOUSE = 0x1B,
    UPDATE_USER_SUMMON = 0x1C,
    UPDATE_USER_PET = 0x1D,
    UPDATE_USER_REMIT = 0x1E,
    UPDATE_USER_PACKAGE = 0x1F,
}

/**
 * Получить текстовое описание причины ошибки
 */
export function getPlayFailReasonMessage(code: number): string {
    switch (code) {
        case PlayFailReason.SYSTEM_ERROR: return 'System error';
        case PlayFailReason.INVALID_SELECTION: return 'Invalid server selection';
        case PlayFailReason.UPDATE_USER_INFO: return 'User info needs update';
        case PlayFailReason.UPDATE_USER_ACCOUNT: return 'Account needs update';
        case PlayFailReason.UPDATE_USER_ITEM: return 'Items need update';
        case PlayFailReason.UPDATE_USER_SKILL: return 'Skills need update';
        default: return `Unknown reason (0x${code.toString(16).toUpperCase()})`;
    }
}

/**
 * Стратегия обработки пакета PlayFail
 * Уведомляет SessionManager об ошибке
 */
export class PlayFailHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x06, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // PlayFail приходит в ожидании PlayOk
        return state === 'WAIT_PLAY_OK';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const reason = this.decodePlayFail(reader);
            const message = getPlayFailReasonMessage(reason);
            
            Logger.error('PlayFailHandler', `Play failed: ${message}`);

            // Уведомляем SessionManager об ошибке
            this.sessionManager.setAuthFailed(reason, message);

        } catch (error) {
            Logger.error('PlayFailHandler', `Error processing packet: ${error}`);
        }
    }

    /**
     * Декодировать PlayFail пакет
     */
    private decodePlayFail(reader: IPacketReader): number {
        // Пропускаем опкод
        reader.readUInt8();
        
        // Читаем код причины
        return reader.readUInt8();
    }
}
