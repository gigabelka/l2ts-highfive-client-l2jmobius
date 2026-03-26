/**
 * @fileoverview Экспорты сетевой инфраструктуры
 * @module infrastructure/network
 */

export { BufferPool, globalBufferPool, type BufferPoolStats } from './BufferPool';
export { PacketSerializer, globalPacketSerializer, type SerializedPacket } from './PacketSerializer';
