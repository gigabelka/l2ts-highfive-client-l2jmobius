import { decodePacket, getSupportedOpcodes } from '../src/infrastructure/protocol/game/PacketDecoder';

const packets = [
  { opcode: 0x04, hex: '0x04', name: 'UserInfo', data: { level: 80, hp: 5000, mp: 1200 } },
  { opcode: 0x0F, hex: '0x0F', name: 'Attack', data: { damage: 2450, critical: true } },
  { opcode: 0x01, hex: '0x01', name: 'MoveToLocation', data: { toX: 83200, toY: 148000, toZ: -3400 } },
  { opcode: 0x02, hex: '0x02', name: 'Say2', data: { name: 'DarkKnight', channelName: 'TRADE', text: 'Продам стратилу' } },
  { opcode: 0x05, hex: '0x05', name: 'Die', data: { sweepable: true } },
  { opcode: 0xD3, hex: '0xD3', name: 'NetPingRequest', data: {} },
  { opcode: 0xFF, hex: '0xFF', name: 'Unknown', data: {} },
];

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        L2 Interlude Packet Decoder - Результаты            ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('Всего поддерживаемых пакетов:', getSupportedOpcodes().length);
console.log('');

for (const p of packets) {
  const msg = {
    type: 'system.raw_packet',
    channel: 'system',
    payload: {
      opcode: p.opcode,
      opcodeHex: p.hex,
      length: 32,
      state: 'IN_GAME',
      ...p.data
    },
    timestamp: '2026-03-19T12:00:00Z'
  };
  
  const result = decodePacket(msg);
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log(`│ ${p.hex} → ${result.type.padEnd(46)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│ Summary: ${result.summary.substring(0, 48).padEnd(48)}│`);
  console.log(`│ Category: ${result.packet.category.padEnd(47)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}
