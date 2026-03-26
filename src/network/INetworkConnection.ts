/**
 * @fileoverview INetworkConnection - Interface for network connection
 * Абстракция над TCP соединением для инверсии зависимостей
 * @module network/INetworkConnection
 */

/**
 * Callback types for connection events
 */
export type ConnectCallback = () => void;
export type DisconnectCallback = () => void;
export type ErrorCallback = (error: Error) => void;
export type DataCallback = (data: Buffer) => void;

/**
 * Interface for network connection implementations
 * Provides abstraction for TCP connection operations
 */
export interface INetworkConnection {
    /**
     * Establish connection to the specified host and port
     * @param host - Remote host address
     * @param port - Remote port number
     */
    connect(host: string, port: number): void;

    /**
     * Close the connection gracefully
     */
    disconnect(): void;

    /**
     * Send raw data over the connection
     * @param data - Raw bytes to send
     */
    send(data: Buffer): void;

    /**
     * Check if connection is established
     */
    isConnected(): boolean;

    /**
     * Register callback for incoming data
     * @param callback - Function to call when data is received
     */
    onData(callback: DataCallback): void;

    /**
     * Register callback for connection establishment
     * @param callback - Function to call when connected
     */
    onConnect(callback: ConnectCallback): void;

    /**
     * Register callback for connection closure
     * @param callback - Function to call when disconnected
     */
    onDisconnect(callback: DisconnectCallback): void;

    /**
     * Register callback for connection errors
     * @param callback - Function to call when error occurs
     */
    onError(callback: ErrorCallback): void;
}

/**
 * Factory interface for creating network connections
 * Used by DI container for creating connection instances
 */
export interface INetworkConnectionFactory {
    /**
     * Create a new network connection instance
     */
    create(): INetworkConnection;
}
