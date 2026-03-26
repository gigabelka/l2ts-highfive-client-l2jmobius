import * as net from 'node:net';
import { Logger } from '../logger/Logger';
import type { INetworkConnection, ConnectCallback, DisconnectCallback, ErrorCallback, DataCallback } from './INetworkConnection';

/**
 * @fileoverview Connection - TCP client with L2 packet framing
 * 
 * Handles low-level TCP connection management and implements the Lineage 2
 * packet framing protocol. Each packet begins with a 2-byte length header
 * (uint16LE) indicating the total packet size including the header.
 * 
 * Key features:
 * - Automatic packet reassembly from TCP stream
 * - Connection state management (connect, disconnect, error)
 * - Event-based interface for protocol-specific implementations
 * 
 * L2 Packet Format:
 * ```
 * [Length: 2 bytes uint16LE] [Body: Length-2 bytes]
 * ```
 * 
 * Note: Multiple packets may arrive in a single TCP chunk, or a single
 * packet may span multiple chunks. This class handles reassembly automatically.
 * 
 * @module network/Connection
 * @example
 * ```typescript
 * const connection = new Connection();
 * connection.onConnect(() => console.log('Connected!'));
 * connection.onData((data) => console.log('Received:', data));
 * connection.connect('127.0.0.1', 7777);
 * ```
 */

/**
 * TCP connection with Lineage 2 packet framing.
 * 
 * Implements the base TCP connection logic including:
 * - Connection establishment and teardown
 * - Packet reassembly from TCP stream
 * - Event-based handlers for protocol-specific processing
 * 
 * @class Connection
 * @implements INetworkConnection
 */
class Connection implements INetworkConnection {
  /** Underlying TCP socket */
  protected socket?: net.Socket;
  /** Receive buffer for packet reassembly */
  private recvBuffer: Buffer = Buffer.alloc(0);
  /** Remote host address */
  private host?: string;
  /** Remote port number */
  private port?: number;
  /** Connection timeout timer */
  private connectTimeout?: NodeJS.Timeout;
  /** Connection timeout in milliseconds */
  private readonly CONNECT_TIMEOUT_MS = 10000;

  /** Event callbacks */
  private onConnectCallbacks: ConnectCallback[] = [];
  private onDisconnectCallbacks: DisconnectCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];
  private onDataCallbacks: DataCallback[] = [];

  /**
   * Establish TCP connection to the specified host and port.
   * 
   * @param {string} host - Remote host address (IP or hostname)
   * @param {number} port - Remote port number
   * @example
   * ```typescript
   * connection.connect('192.168.1.100', 7777);
   * ```
   */
  connect(host: string, port: number): void {
    this.host = host;
    this.port = port;

    Logger.info('TCP', `Connecting to ${host}:${port}`);

    this.socket = new net.Socket();

    // Set up connection timeout
    this.connectTimeout = setTimeout(() => {
      const timeoutError = new Error(`Connection timeout after ${this.CONNECT_TIMEOUT_MS}ms`);
      Logger.error('TCP', timeoutError.message);
      this.socket?.destroy();
      this.emitError(timeoutError);
    }, this.CONNECT_TIMEOUT_MS);

    this.socket.on('connect', () => {
      // Clear connection timeout on successful connection
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      Logger.info('TCP', `Connected to ${host}:${port}`);
      this.emitConnect();
    });

    this.socket.on('data', (chunk: Buffer) => {
      this.handleData(chunk);
    });

    this.socket.on('close', (hadError: boolean) => {
      // Clear connection timeout if still pending
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      Logger.info('TCP', `Connection to ${host}:${port} closed (${hadError ? 'with error' : 'clean'})`);
      this.emitDisconnect();
    });

    this.socket.on('error', (err: Error) => {
      // Clear connection timeout on error
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      Logger.error('TCP', `Socket error: ${err.message}`);
      this.emitError(err);
    });

    try {
      this.socket.connect(port, host);
    } catch (err) {
      // Clear connection timeout on synchronous error
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error('TCP', `Connection failed: ${error.message}`);
      this.emitError(error);
    }
  }

  /**
   * Send raw data over the TCP connection.
   * 
   * @param {Buffer} data - Raw bytes to send
   * @example
   * ```typescript
   * const packet = Buffer.from([0x00, 0x05, 0x01, 0x02, 0x03]);
   * connection.send(packet);
   * ```
   */
  send(data: Buffer): void {
    if (!this.socket || this.socket.destroyed) {
      Logger.error('TCP', 'Cannot send: socket not initialized or destroyed');
      return;
    }
    Logger.info('TCP', `*** SENT ${data.length} bytes to server ***`);
    this.socket.write(data);
  }

  /**
   * @deprecated Use send() instead
   */
  protected sendRaw(data: Buffer): void {
    this.send(data);
  }

  /**
   * Check if connection is established.
   * @returns true if socket exists and is not destroyed
   */
  isConnected(): boolean {
    return !!this.socket && !this.socket.destroyed && this.socket.readyState === 'open';
  }

  /**
   * Register callback for incoming data.
   * @param callback - Function to call when data is received
   */
  onData(callback: DataCallback): void {
    this.onDataCallbacks.push(callback);
  }

  /**
   * Register callback for connection establishment.
   * @param callback - Function to call when connected
   */
  onConnect(callback: ConnectCallback): void {
    this.onConnectCallbacks.push(callback);
  }

  /**
   * Register callback for connection closure.
   * @param callback - Function to call when disconnected
   */
  onDisconnect(callback: DisconnectCallback): void {
    this.onDisconnectCallbacks.push(callback);
  }

  /**
   * Register callback for connection errors.
   * @param callback - Function to call when error occurs
   */
  onError(callback: ErrorCallback): void {
    this.onErrorCallbacks.push(callback);
  }

  /**
   * Close the TCP connection gracefully.
   * 
   * @example
   * ```typescript
   * connection.disconnect();
   * ```
   */
  disconnect(): void {
    // Clear connection timeout if still pending
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = undefined;
    }
    if (this.socket && !this.socket.destroyed) {
      Logger.info('TCP', `Closing connection to ${this.host}:${this.port}`);
      this.socket.end();
      this.socket.destroy();
    } else {
      Logger.debug('TCP', 'Socket already closed');
    }
  }

  /**
   * Reassemble L2 packets from TCP stream data.
   * 
   * The L2 protocol uses a 2-byte length prefix (uint16LE) at the start
   * of each packet. This method accumulates incoming data and extracts
   * complete packets, calling onData callbacks for each one.
   * 
   * @private
   * @param {Buffer} chunk - Raw TCP data chunk
   */
  private handleData(chunk: Buffer): void {
    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);
    Logger.info('TCP', `*** RAW TCP DATA RECEIVED: ${chunk.length} bytes ***`);
    Logger.debug('TCP', `Data received: ${chunk.length} bytes, buffer total: ${this.recvBuffer.length} bytes`);

    while (this.recvBuffer.length >= 2) {
      const packetLen = this.recvBuffer.readUInt16LE(0);
      Logger.debug('TCP', `Packet length field: ${packetLen}, available: ${this.recvBuffer.length}`);

      if (this.recvBuffer.length < packetLen) {
        Logger.debug('TCP', `Incomplete packet: need ${packetLen}, have ${this.recvBuffer.length}`);
        break;
      }

      const fullPacket = this.recvBuffer.subarray(0, packetLen);
      this.recvBuffer  = this.recvBuffer.subarray(packetLen);

      Logger.debug('TCP', `Packet assembled: ${fullPacket.length} bytes, buffer remaining: ${this.recvBuffer.length} bytes`);
      this.emitData(fullPacket);
    }
  }

  /**
   * Emit connect event to all registered callbacks
   */
  private emitConnect(): void {
    // First call legacy handler for backward compatibility with subclasses
    this.handleConnect();
    
    // Then call registered callbacks
    for (const callback of this.onConnectCallbacks) {
      try {
        callback();
      } catch (err) {
        Logger.error('TCP', `Error in connect callback: ${err}`);
      }
    }
  }

  /**
   * Emit disconnect event to all registered callbacks
   */
  private emitDisconnect(): void {
    // First call legacy handler for backward compatibility with subclasses
    this.handleDisconnect();
    
    // Then call registered callbacks
    for (const callback of this.onDisconnectCallbacks) {
      try {
        callback();
      } catch (err) {
        Logger.error('TCP', `Error in disconnect callback: ${err}`);
      }
    }
  }

  /**
   * Emit error event to all registered callbacks
   */
  private emitError(error: Error): void {
    // First call legacy handler for backward compatibility with subclasses
    this.handleError(error);
    
    // Then call registered callbacks
    for (const callback of this.onErrorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        Logger.error('TCP', `Error in error callback: ${err}`);
      }
    }
  }

  /**
   * Legacy error handler - override in subclasses for custom processing.
   * @protected
   * @param {Error} _error - Error object
   */
  protected handleError(_error: Error): void {
    // Override in subclass for legacy behavior
  }

  /**
   * Emit data event to all registered callbacks
   */
  private emitData(data: Buffer): void {
    // First call legacy handler for backward compatibility with subclasses
    this.handleRawPacket(data);
    
    // Then call registered callbacks
    for (const callback of this.onDataCallbacks) {
      try {
        callback(data);
      } catch (err) {
        Logger.error('TCP', `Error in data callback: ${err}`);
      }
    }
  }

  // ============================================================================
  // Legacy protected methods - for backward compatibility with existing subclasses
  // These are called by the emit methods
  // ============================================================================

  /**
   * Handle a complete packet received from the server.
   * Override this method in subclasses for custom processing.
   * @protected
   * @param {Buffer} _fullPacket - Complete packet including 2-byte length header
   */
  protected handleRawPacket(_fullPacket: Buffer): void {
    // Override in subclass for legacy behavior
  }

  /**
   * Handle successful connection establishment.
   * Override this method in subclasses for custom processing.
   * @protected
   */
  protected handleConnect(): void {
    // Override in subclass for legacy behavior
  }

  /**
   * Handle connection closure.
   * Override this method in subclasses for custom processing.
   * @protected
   */
  protected handleDisconnect(): void {
    // Override in subclass for legacy behavior
  }
}

export default Connection;
