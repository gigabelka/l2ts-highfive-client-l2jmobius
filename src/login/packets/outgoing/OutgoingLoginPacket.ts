import { Buffer } from 'buffer';

export interface OutgoingLoginPacket {
  encode(): Buffer;
}
