import { CONFIG } from '../config';

export type LoginConfig = typeof CONFIG;

export interface SessionData {
  sessionId: number;
  rsaPublicKey?: Buffer;
  ggAuthResponse: number;
  loginOkId1: number;
  loginOkId2: number;
  gameServerIp: string;
  gameServerPort: number;
  playOkId1: number;
  playOkId2: number;
  charName?: string;
  charId?: number;
  username: string;
}

export enum LoginState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  WAIT_INIT = 'WAIT_INIT',
  WAIT_GG_AUTH = 'WAIT_GG_AUTH',
  WAIT_LOGIN_OK = 'WAIT_LOGIN_OK',
  WAIT_SERVER_LIST = 'WAIT_SERVER_LIST',
  WAIT_PLAY_OK = 'WAIT_PLAY_OK',
  DONE = 'DONE',
  ERROR = 'ERROR',
}
