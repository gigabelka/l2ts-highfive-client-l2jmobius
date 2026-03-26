/**
 * @fileoverview Утилиты для работы с Buffer
 * @module shared/utils/BufferUtils
 */

import type { Opcode } from '../types/primitives';

/**
 * Утилиты для работы с бинарными данными
 */
export namespace BufferUtils {
  /**
   * Создать hex dump строку из Buffer
   */
  export function toHexDump(buffer: Buffer, offset: number = 0, length?: number): string {
    const len = length ?? buffer.length - offset;
    const end = Math.min(offset + len, buffer.length);
    const lines: string[] = [];

    for (let i = offset; i < end; i += 16) {
      const chunk = buffer.slice(i, Math.min(i + 16, end));
      const hexPart = Array.from(chunk)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      const asciiPart = Array.from(chunk)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push(`${i.toString(16).padStart(4, '0')}:  ${hexPart.padEnd(48, ' ')}  |${asciiPart}|`);
    }

    return lines.join('\n');
  }

  /**
   * Преобразовать Buffer в hex строку
   */
  export function toHexString(buffer: Buffer, separator: string = ' '): string {
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(separator);
  }

  /**
   * Создать Buffer из hex строки
   */
  export function fromHexString(hex: string): Buffer {
    const clean = hex.replace(/\s+/g, '');
    if (clean.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }
    return Buffer.from(clean, 'hex');
  }

  /**
   * Прочитать opcode из буфера пакета
   */
  export function readOpcode(buffer: Buffer): Opcode {
    return buffer[0] ?? 0;
  }

  /**
   * Создать L2-форматированный пакет (с uint16LE length prefix)
   */
  export function createL2Packet(body: Buffer): Buffer {
    const packet = Buffer.alloc(2 + body.length);
    packet.writeUInt16LE(2 + body.length, 0);
    body.copy(packet, 2);
    return packet;
  }

  /**
   * XOR два буфера одинаковой длины
   */
  export function xorBuffers(a: Buffer, b: Buffer): Buffer {
    if (a.length !== b.length) {
      throw new Error('Buffers must have same length for XOR');
    }
    const result = Buffer.alloc(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i]! ^ b[i]!;
    }
    return result;
  }

  /**
   * Проверить, что все байты в буфере равны нулю
   */
  export function isZeroFilled(buffer: Buffer): boolean {
    return buffer.every((b) => b === 0);
  }

  /**
   * Безопасно скопировать буфер
   */
  export function safeCopy(buffer: Buffer): Buffer {
    return Buffer.from(buffer);
  }
}
