/**
 * @fileoverview ActionFailedPacket - DTO для пакета ActionFailed (0x25)
 * Сервер отклонил действие клиента
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ActionFailedData {
    /** Пустой пакет — просто уведомление */
    _empty?: boolean;
}

/**
 * Пакет ActionFailed (0x25)
 * Уведомление о том, что запрошенное действие не может быть выполнено
 */
export class ActionFailedPacket implements IIncomingPacket {
    readonly opcode = 0x25;
    private data!: ActionFailedData;

    decode(_reader: IPacketReader): this {
        this.data = { _empty: true };
        return this;
    }

    getData(): ActionFailedData {
        return { ...this.data };
    }
}
