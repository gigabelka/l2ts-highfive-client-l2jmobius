import { Logger } from '../logger/Logger';
import NewCrypt from '../crypto/NewCrypt';

/**
 * Login Server cryptography (Interlude / c621).
 *
 * Init packet: decrypted with static Blowfish key + rolling XOR (NewCrypt).
 * All subsequent packets: encrypted/decrypted with dynamic Blowfish key
 * from Init packet.
 */
export class LoginCrypt {
  private static readonly STATIC_KEY = Uint8Array.from([
    0x6B, 0x60, 0xCB, 0x5B,
    0x82, 0xCE, 0x90, 0xB1,
    0xCC, 0x2B, 0x6C, 0x55,
    0x6C, 0x6C, 0x6C, 0x6C,
  ]);

  private crypt: NewCrypt;
  private hasSessionKey: boolean = false;

  constructor() {
    this.crypt = new NewCrypt(LoginCrypt.STATIC_KEY);
  }

  /** Set dynamic Blowfish key from Init packet for all subsequent packets. */
  setSessionKey(blowfishKey: Buffer): void {
    Logger.logKeys('LoginCrypt: setting sessionKey', blowfishKey);
    this.crypt.init(new Uint8Array(blowfishKey));
    this.hasSessionKey = true;
  }

  /**
   * Decrypt Init packet (static Blowfish ECB + rolling XOR).
   *
   * Init packet is special: encrypted with static key, has trailing
   * 8-byte XOR seed. We decrypt the entire body including opcode.
   *
   * @param body packet body without 2-byte length prefix
   */
  decryptInit(body: Buffer): Buffer {
    Logger.debug('LoginCrypt', `decryptInit: size=${body.length}`);
    Logger.hexDump('INIT RAW BODY', body, 32);

    const raw  = new Uint8Array(body);
    const size = raw.byteLength;

    this.crypt.decrypt(raw);

    // Rolling XOR seed is in the last 8 bytes of the decrypted data
    const rndXor =
      (raw[size - 8]! & 0xFF)        |
      ((raw[size - 7]! & 0xFF) << 8)  |
      ((raw[size - 6]! & 0xFF) << 16) |
      ((raw[size - 5]! & 0xFF) << 24);

    NewCrypt.decXORPass(raw, 0, size, rndXor);

    // Remove trailing 8-byte XOR block
    const result = Buffer.from(raw).subarray(0, size - 8);

    Logger.hexDump('INIT DECRYPTED', result, 64);
    return result;
  }

  /** Decrypt a regular packet (session Blowfish key + checksum verify). */
  decrypt(body: Buffer): Buffer {
    if (!this.hasSessionKey) {
      Logger.warn('LoginCrypt', 'sessionKey not set, skipping decrypt');
      return body;
    }

    const raw = new Uint8Array(body);
    this.crypt.decrypt(raw);

    if (!NewCrypt.verifyChecksum(raw)) {
      Logger.warn('LoginCrypt', 'CHECKSUM MISMATCH');
    }

    return Buffer.from(raw);
  }

  /** Prepare outgoing packet: align + checksum + Blowfish encrypt. */
  prepareOutgoing(body: Buffer): Buffer {
    if (!this.hasSessionKey) return body;

    let result = Buffer.from(body);

    // Align to 4-byte boundary
    if (result.length % 4 !== 0) {
      const padded = Buffer.alloc(Math.ceil(result.length / 4) * 4, 0);
      result.copy(padded);
      result = padded;
    }

    // Add 8 bytes for checksum
    let withChecksum = Buffer.concat([result, Buffer.alloc(8, 0)]);

    // Align to 8-byte boundary (Blowfish ECB requirement)
    if (withChecksum.length % 8 !== 0) {
      const padded = Buffer.alloc(Math.ceil(withChecksum.length / 8) * 8, 0);
      withChecksum.copy(padded);
      withChecksum = padded;
    }

    const raw = new Uint8Array(withChecksum);
    NewCrypt.appendChecksum(raw);
    this.crypt.crypt(raw);

    return Buffer.from(raw);
  }
}
