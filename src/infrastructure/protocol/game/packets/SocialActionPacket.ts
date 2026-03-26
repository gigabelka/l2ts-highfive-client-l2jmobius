/**
 * @fileoverview SocialActionPacket - DTO для пакета SocialAction (0x2d)
 * Социальные действия (эмоции, жесты)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface SocialActionData {
    objectId: number;
    actionId: number;
}

/**
 * Пакет SocialAction (0x2d)
 * Эмоции и жесты персонажей
 */
export class SocialActionPacket implements IIncomingPacket {
    readonly opcode = 0x2d;
    private data!: SocialActionData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const actionId = reader.readInt32LE();

        this.data = { objectId, actionId };
        return this;
    }

    getData(): SocialActionData {
        return { ...this.data };
    }
}
