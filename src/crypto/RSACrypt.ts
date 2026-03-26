import * as crypto from 'node:crypto';
import { Logger } from '../logger/Logger';

/**
 * @fileoverview RSACrypt - RSA encryption for Login Server credentials
 * 
 * Implements RSA encryption with 1024-bit keys and NO_PADDING for
 * encrypting login credentials sent to the Lineage 2 Login Server.
 * 
 * L2 Interlude Protocol 746 uses a specific plaintext layout:
 * - 128 bytes total (matching RSA 1024-bit block size)
 * - Credentials are embedded at fixed offsets within this block
 * 
 * Plaintext Layout (128 bytes):
 * ```
 * Offset   Size    Content
 * 0x00     94      Zeros (padding)
 * 0x5E     14      Login (ASCII, null-padded)
 * 0x6C     2       Zeros (separator)
 * 0x6E     16      Password (ASCII, null-padded)
 * 0x7E     2       Zeros (padding)
 * ```
 * 
 * @module crypto/RSACrypt
 * @see https://datatracker.ietf.org/doc/html/rfc8017
 * @example
 * ```typescript
 * import RSACrypt from './crypto/RSACrypt';
 * 
 * // Encrypt credentials for login packet
 * const modulus = Buffer.from(serverPublicKey, 'hex');
 * const encrypted = RSACrypt.encryptCredentials('mylogin', 'mypassword', modulus);
 * 
 * // Send encrypted data in RequestAuthLogin packet
 * socket.write(encrypted);
 * ```
 */

/**
 * RSA encryption utility for Lineage 2 Login Server.
 * 
 * Uses RSA-1024 with NO_PADDING mode as required by the L2 protocol.
 * The plaintext is formatted according to L2J standards before encryption.
 * 
 * @class RSACrypt
 */
class RSACrypt {
  /** RSA key size in bytes (1024 bits = 128 bytes). @readonly */
  private static readonly RSA_KEY_SIZE    = 128;
  /** RSA public exponent (standard value 65537 = 0x10001). @readonly */
  private static readonly PUBLIC_EXPONENT = 65537;

  /**
   * Encrypt login credentials using RSA-1024.
   * 
   * @param {string} login - User login name (max 14 characters)
   * @param {string} password - User password (max 16 characters)
   * @param {Buffer} publicKeyModulus - Server's RSA public key modulus (128 bytes)
   * @returns {Buffer} Encrypted credentials (128 bytes)
   * @throws {Error} If modulus size is incorrect or encryption fails
   * 
   * @example
   * ```typescript
   * const modulus = Buffer.from('a1b2c3d4...', 'hex'); // 128 bytes
   * const encrypted = RSACrypt.encryptCredentials('player', 'secret123', modulus);
   * ```
   */
  static encryptCredentials(
    login: string,
    password: string,
    publicKeyModulus: Buffer
  ): Buffer {
    if (publicKeyModulus.length !== RSACrypt.RSA_KEY_SIZE) {
      throw new Error(
        `RSA modulus must be ${RSACrypt.RSA_KEY_SIZE} bytes, got ${publicKeyModulus.length}`
      );
    }

    Logger.debug('RSACrypt', `Encrypting credentials: login="${login}"`);

    const plaintext = RSACrypt.buildPlaintext(login, password);
    Logger.logCryptoSingle('RSA PLAINTEXT', plaintext, 128);

    const derKey = RSACrypt.buildPublicKeyDer(publicKeyModulus, RSACrypt.PUBLIC_EXPONENT);
    Logger.logCryptoSingle('RSA DER KEY', derKey, 16);

    try {
      const key = crypto.createPublicKey({ key: derKey, format: 'der', type: 'pkcs1' });
      const ciphertext = crypto.publicEncrypt(
        { key, padding: crypto.constants.RSA_NO_PADDING },
        plaintext
      );
      Logger.logCryptoSingle('RSA CIPHERTEXT', Buffer.from(ciphertext), 32);
      return Buffer.from(ciphertext);
    } catch (error) {
      throw new Error(`RSA encryption failed: ${error}`, { cause: error });
    }
  }

  /**
   * Build the 128-byte plaintext block for RSA encryption.
   * 
   * Layout:
   * - Bytes 0-93:   Zeros (padding)
   * - Bytes 94-107: Login (14 bytes, null-padded ASCII)
   * - Bytes 108-109: Zeros (separator)
   * - Bytes 110-125: Password (16 bytes, null-padded ASCII)
   * - Bytes 126-127: Zeros (padding)
   * 
   * @private
   * @param {string} login - User login (max 14 chars)
   * @param {string} password - User password (max 16 chars)
   * @returns {Buffer} 128-byte plaintext block
   */
  private static buildPlaintext(login: string, password: string): Buffer {
    const plaintext = Buffer.alloc(RSACrypt.RSA_KEY_SIZE, 0);

    const loginBytes = Buffer.alloc(14, 0);
    loginBytes.write(login, 'ascii');
    loginBytes.copy(plaintext, 0x5E);

    const passBytes = Buffer.alloc(16, 0);
    passBytes.write(password, 'ascii');
    passBytes.copy(plaintext, 0x6E);

    return plaintext;
  }

  /**
   * Build ASN.1 DER-encoded PKCS#1 RSAPublicKey structure.
   * 
   * RSA Public Key format:
   * ```
   * RSAPublicKey ::= SEQUENCE {
   *     modulus           INTEGER,  -- n
   *     publicExponent    INTEGER   -- e
   * }
   * ```
   * 
   * @private
   * @param {Buffer} modulus - RSA modulus (n) as big-endian bytes
   * @param {number} exponent - RSA public exponent (e), typically 65537
   * @returns {Buffer} DER-encoded RSA public key
   */
  private static buildPublicKeyDer(modulus: Buffer, exponent: number): Buffer {
    const eBytes = RSACrypt.intToDerBuffer(exponent);

    // Leading 0x00 if high bit is set (DER INTEGER is signed)
    const mBytes = (modulus[0]! & 0x80)
      ? Buffer.concat([Buffer.from([0x00]), modulus])
      : modulus;

    const intLength = RSACrypt.derLength;

    const modInt = Buffer.concat([
      Buffer.from([0x02, ...intLength(mBytes.length)]),
      mBytes,
    ]);

    const expInt = Buffer.concat([
      Buffer.from([0x02, ...intLength(eBytes.length)]),
      eBytes,
    ]);

    const inner = Buffer.concat([modInt, expInt]);

    return Buffer.concat([
      Buffer.from([0x30, ...intLength(inner.length)]),
      inner,
    ]);
  }

  /**
   * Calculate DER length encoding.
   * 
   * DER uses short form for lengths < 128, long form otherwise:
   * - Short: length byte directly
   * - Long: 0x81 + 1-byte length (for lengths < 256)
   * - Long: 0x82 + 2-byte length (for larger lengths)
   * 
   * @private
   * @param {number} len - Length value to encode
   * @returns {number[]} DER length bytes
   */
  private static derLength(len: number): number[] {
    if (len < 128) {
      return [len];
    } else if (len < 256) {
      return [0x81, len];
    } else {
      return [0x82, Math.floor(len / 256), len % 256];
    }
  }

  /**
   * Convert integer to big-endian bytes for DER encoding.
   * 
   * Handles odd-length hex strings by prepending a zero nibble.
   * 
   * @private
   * @param {number} value - Integer value to convert
   * @returns {Buffer} Big-endian byte representation
   * @example
   * ```typescript
   * RSACrypt.intToDerBuffer(65537); // Returns Buffer [0x01, 0x00, 0x01]
   * ```
   */
  private static intToDerBuffer(value: number): Buffer {
    let hex = value.toString(16);

    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }

    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }

    return Buffer.from(bytes);
  }
}

export default RSACrypt;
