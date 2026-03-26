/**
 * @fileoverview BaseHandler - базовый класс для обработчиков Login Server
 * Упрощенная версия без strict generic constraints
 * @module login/protocol/handlers
 */

import type { IPacketReader } from '../../../application/ports';
import type { LoginPacketContext } from '../LoginPacketProcessor';
import type { SessionManager } from '../../session/SessionManager';

/**
 * Базовый класс для обработчиков пакетов Login Server
 */
export abstract class BaseHandler {
    constructor(
        protected readonly opcode: number,
        protected readonly sessionManager: SessionManager
    ) {}

    /**
     * Может ли обработать данный опкод в данном состоянии
     */
    canHandle(opcode: number, state: string): boolean {
        return opcode === this.opcode && this.canHandleInState(state);
    }

    /**
     * Проверить можно ли обработать в данном состоянии
     */
    protected abstract canHandleInState(state: string): boolean;

    /**
     * Обработать пакет
     */
    abstract handle(context: LoginPacketContext, reader: IPacketReader): void;
}
