import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import type { SessionData } from '../../../login/types';
import { CONFIG } from '../../../config';

/**
 * AuthRequest — request to login to game server with session keys.
 *
 * OpCode: 0x08 for CT_0_Interlude (L2J Mobius specific)
 *         0x2B for HighFive (standard L2 protocol - AuthLogin)
 *
 * Format: username (UTF-16LE null-terminated) + session keys + language
 */
export class AuthRequest implements OutgoingGamePacket {
    constructor(
        private session: SessionData,
        private username: string
    ) { }

    encode(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x08, HighFive (267) uses 0x2B (AuthLogin)
        const opcode = CONFIG.Protocol === 267 ? 0x2B : 0x08;
        w.writeUInt8(opcode);

        // Username in UTF-16LE null-terminated
        const usernameUtf16 = Buffer.from(this.username, 'utf16le');
        w.writeBytes(usernameUtf16);
        w.writeUInt16LE(0); // null terminator

        // Session tokens (same order for both protocols)
        w.writeInt32LE(this.session.playOkId2); // playOkId2 FIRST!
        w.writeInt32LE(this.session.playOkId1); // playOkId1 SECOND
        w.writeInt32LE(this.session.loginOkId1);
        w.writeInt32LE(this.session.loginOkId2);

        // Language / Unknown constant (usually 1)
        w.writeInt32LE(1);

        const body = w.toBuffer();
        const protocolName = CONFIG.Protocol === 267 ? 'HighFive' : 'CT0_Mobius';
        Logger.info('AuthRequest', `Sending keys (0x${opcode.toString(16)} ${protocolName}): play2=0x${(this.session.playOkId2 >>> 0).toString(16)}, play1=0x${(this.session.playOkId1 >>> 0).toString(16)}, login1=0x${(this.session.loginOkId1 >>> 0).toString(16)}, login2=0x${(this.session.loginOkId2 >>> 0).toString(16)}`);
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('AuthRequest', `Encoded: opcode=0x${opcode.toString(16)}, bodyLen=${body.length}, username="${this.username}"`);
        return body;
    }
}
