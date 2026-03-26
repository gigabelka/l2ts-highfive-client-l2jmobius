import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

/**
 * LoginOkPacket (OpCode=0x03) — successful login authentication.
 * loginOkId1/2 are used for server list request and game server auth.
 */
export class LoginOkPacket implements IncomingLoginPacket {
  public loginOkId1: number = 0;
  public loginOkId2: number = 0;

  decode(reader: PacketReader): this {
    reader.readUInt8();  // opcode 0x03

    this.loginOkId1 = reader.readInt32();
    Logger.info('LoginOkPacket', `loginOkId1=0x${this.loginOkId1.toString(16).toUpperCase()}`);

    this.loginOkId2 = reader.readInt32();
    Logger.info('LoginOkPacket', `loginOkId2=0x${this.loginOkId2.toString(16).toUpperCase()}`);

    Logger.info('LoginOkPacket', 'Login auth successful, IDs saved');
    return this;
  }
}
