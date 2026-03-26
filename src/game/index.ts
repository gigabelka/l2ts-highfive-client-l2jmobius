// src/game/index.ts
// Game module exports

// Core game client
export { GameClientNew } from './GameClient';
export type { IGameClient } from './IGameClient';
export { GameClientState } from './GameClientState';
export { GameState } from './GameState';
export { GameCommandManager } from './GameCommandManager';
export { GameStateUpdater } from './GameStateUpdater';

// Outgoing packets
export * from './packets/outgoing';
