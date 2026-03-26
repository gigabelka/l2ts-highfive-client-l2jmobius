import { Logger } from '../../../logger/Logger';
import type { OutgoingLoginPacket } from './OutgoingLoginPacket';
import RSACrypt from '../../../crypto/RSACrypt';

/**
 * RequestAuthLogin (OpCode=0x00) — send RSA-encrypted credentials to Login Server.
 *
 * Body layout (176 bytes):
 *   1 byte:   opcode = 0x00
 *   128 bytes: RSA ciphertext (login + password in 128-byte plaintext block)
 *   4 bytes:  ggAuthResponse (int32LE from GGAuth packet)
 *   43 bytes: fixed GameGuard block
 */
export class RequestAuthLogin implements OutgoingLoginPacket {
  private readonly rsaBlock: Buffer;
  private readonly ggAuthResponse: number;

  constructor(
    login: string,
    password: string,
    rsaPublicKeyModulus: Buffer,
    ggAuthResponse: number
  ) {
    this.rsaBlock = RSACrypt.encryptCredentials(login, password, rsaPublicKeyModulus);

    if (this.rsaBlock.length !== 128) {
      throw new Error(`RSA block must be 128 bytes, got ${this.rsaBlock.length}`);
    }

    this.ggAuthResponse = ggAuthResponse;
    Logger.info('RequestAuthLogin', `Credentials encrypted, login="${login}"`);
  }

  encode(): Buffer {
    const bodySize = 1 + 128 + 4 + 43;
    const buffer = Buffer.alloc(bodySize);
    let offset = 0;

    buffer.writeUInt8(0x00, offset); offset += 1;

    this.rsaBlock.copy(buffer, offset); offset += 128;

    buffer.writeInt32LE(this.ggAuthResponse, offset); offset += 4;

    const ggBlock = Buffer.from([
      0x23, 0x01, 0x00, 0x00, 0x67, 0x45, 0x00, 0x00,
      0xAB, 0x89, 0x00, 0x00, 0xEF, 0xCD, 0x00, 0x00,
      0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00,
    ]);
    ggBlock.copy(buffer, offset);

    Logger.debug('RequestAuthLogin', `Encoded: bodyLen=${bodySize}`);
    return buffer;
  }
}
