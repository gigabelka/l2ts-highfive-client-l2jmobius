import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

/**
 * PlayOkPacket (OpCode=0x07) — server login confirmed.
 * playOkId1/2 are used for game server authentication.
 */
export class PlayOkPacket implements IncomingLoginPacket {
  public playOkId1: number = 0;
  public playOkId2: number = 0;

  decode(reader: PacketReader): this {
    reader.readUInt8();  // opcode 0x07

    this.playOkId1 = reader.readInt32();
    Logger.info('PlayOkPacket', `playOkId1=0x${this.playOkId1.toString(16).toUpperCase()}`);

    this.playOkId2 = reader.readInt32();
    Logger.info('PlayOkPacket', `playOkId2=0x${this.playOkId2.toString(16).toUpperCase()}`);

    Logger.info('PlayOkPacket', 'Play IDs saved for game server auth');
    return this;
  }
}
