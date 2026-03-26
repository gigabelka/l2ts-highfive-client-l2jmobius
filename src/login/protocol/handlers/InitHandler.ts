/**
 * @fileoverview InitHandler - стратегия обработки пакета Init (0x00)
 * Обрабатывает инициализацию сессии от Login Server
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import { BaseHandler } from './BaseHandler';

import { ScrambledRSAKey } from '../../../crypto/ScrambledRSAKey';
import { Logger } from '../../../logger/Logger';

/**
 * Данные из Init пакета
 */
export interface InitData {
    sessionId: number;
    protocolRevision: number;
    rsaPublicKey: Buffer;
    blowfishKey: Buffer;
}

/**
 * Стратегия обработки пакета Init
 * Сохраняет session ID, RSA ключ и Blowfish ключ в SessionManager
 */
export class InitHandler extends BaseHandler {
    constructor(sessionManager: import('../../session/SessionManager').SessionManager) {
        super(0x00, sessionManager);
    }

    protected canHandleInState(state: string): boolean {
        // Init пакет принимается только в состоянии ожидания инициализации
        return state === 'WAIT_INIT' || state === 'IDLE' || state === 'CONNECTING';
    }

    handle(_context: LoginPacketContext, reader: IPacketReader): void {
        try {
            // Декодируем пакет
            const data = this.decodeInitPacket(reader);
            
            if (!data) {
                Logger.error('InitHandler', 'Failed to decode Init packet');
                return;
            }

            Logger.info('InitHandler', 
                `Session ID: ${data.sessionId}, Protocol: 0x${data.protocolRevision.toString(16).toUpperCase()}`
            );

            // Расшифровываем RSA ключ
            const rsaPublicKey = ScrambledRSAKey.unscramble(data.scrambledRsaKey);
            
            // Сохраняем в SessionManager
            this.sessionManager.setInitData(
                data.sessionId,
                rsaPublicKey,
                data.blowfishKey
            );

            Logger.info('InitHandler', 'Init data saved to session manager');

        } catch (error) {
            Logger.error('InitHandler', `Error processing Init packet: ${error}`);
        }
    }

    /**
     * Декодировать Init пакет
     */
    private decodeInitPacket(reader: IPacketReader): {
        sessionId: number;
        protocolRevision: number;
        scrambledRsaKey: Buffer;
        blowfishKey: Buffer;
    } | null {
        try {
            // Пропускаем опкод (уже прочитан)
            reader.readUInt8();

            const sessionId = reader.readInt32LE();
            const protocolRevision = reader.readInt32LE();
            
            // Читаем scrambled RSA ключ (128 байт)
            const scrambledRsaKey = reader.readBytes(128);
            
            // Пропускаем 16 неизвестных байт
            reader.readBytes(16);
            
            // Читаем Blowfish ключ (16 байт)
            const blowfishKey = reader.readBytes(16);
            
            // Пропускаем null terminator
            reader.readUInt8();

            return {
                sessionId,
                protocolRevision,
                scrambledRsaKey,
                blowfishKey,
            };
        } catch (error) {
            Logger.error('InitHandler', `Decode error: ${error}`);
            return null;
        }
    }
}
