import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

export interface ServerInfo {
  serverId: number;
  ip: string;
  port: number;
  ageLimit: number;
  isPvp: boolean;
  onlinePlayers: number;
  maxPlayers: number;
  isOnline: boolean;
}

/**
 * ServerListPacket (OpCode=0x04) — list of available game servers.
 */
export class ServerListPacket implements IncomingLoginPacket {
  public serverCount: number = 0;
  public servers: ServerInfo[] = [];

  decode(reader: PacketReader): this {
    reader.readUInt8();  // opcode 0x04

    this.serverCount = reader.readUInt8();
    reader.readUInt8();  // unknown byte

    for (let i = 0; i < this.serverCount; i++) {
      const serverId = reader.readUInt8();

      const ipBytes = reader.readBytes(4);
      const ip = `${ipBytes[0]}.${ipBytes[1]}.${ipBytes[2]}.${ipBytes[3]}`;

      const port = reader.readInt32();
      const ageLimit = reader.readUInt8();
      const isPvp = reader.readUInt8() === 1;
      const onlinePlayers = reader.readUInt16();
      const maxPlayers = reader.readUInt16();
      const isOnline = reader.readUInt8() === 1;

      reader.readInt32();  // server flags
      reader.readUInt8();  // unknown byte

      const serverInfo: ServerInfo = {
        serverId, ip, port, ageLimit, isPvp, onlinePlayers, maxPlayers, isOnline
      };

      this.servers.push(serverInfo);

      Logger.info('ServerListPacket',
        `[SERVER] ID=${serverId}  IP=${ip}:${port}  Players=${onlinePlayers}/${maxPlayers}  PVP=${isPvp}  Online=${isOnline}`);
    }

    Logger.info('ServerListPacket', `Decoded: ${this.servers.length} servers total`);
    return this;
  }
}
