/**
 * WebSocket Vision API Client for L2 Headless Client
 * 
 * Пример клиента на Node.js для подключения к WebSocket Vision API.
 * Показывает полный снимок состояния и слушает события игрового мира.
 * 
 * Запуск:
 *   node examples/ws-client-node.js
 * 
 * С опциями:
 *   node examples/ws-client-node.js --host=192.168.1.100 --port=3001 --token=secret
 */

const WebSocket = require("ws");

// Парсинг аргументов командной строки
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    if (key && value) {
        acc[key.replace(/^--/, '')] = value;
    }
    return acc;
}, {});

const HOST = args.host || "localhost";
const PORT = args.port || 3001;
const TOKEN = args.token || "";
const CHANNELS = args.channels ? args.channels.split(',') : ['*'];

// Формируем URL
const wsUrl = TOKEN 
    ? `ws://${HOST}:${PORT}?token=${TOKEN}`
    : `ws://${HOST}:${PORT}`;

console.log(`🔌 Connecting to L2 Vision API at ${wsUrl}...`);
console.log(`📡 Subscribing to channels: ${CHANNELS.join(', ')}\n`);

const ws = new WebSocket(wsUrl);

// Форматирование чисел
const fmt = (n) => n?.toLocaleString() ?? '?';

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

ws.on("open", () => {
    console.log(`${colors.green}✅ Connected to L2 Vision API${colors.reset}\n`);
    
    // Запрашиваем полный снимок состояния
    ws.send(JSON.stringify({ type: "get.snapshot" }));
    
    // Подписываемся на каналы
    ws.send(JSON.stringify({ 
        type: "subscribe", 
        channels: CHANNELS 
    }));
    
    // Запрашиваем статистику аудита (если DEBUG_WS_AUDIT включен)
    ws.send(JSON.stringify({ type: "get_audit_stats" }));
});

ws.on("message", (raw) => {
    try {
        const event = JSON.parse(raw);
        const ts = new Date(event.ts).toLocaleTimeString();
        
        switch (event.type) {
            case "welcome":
                console.log(`${colors.cyan}👋 Welcome! Version: ${event.data.version}, Clients online: ${event.data.clientsOnline}${colors.reset}\n`);
                break;
                
            case "snapshot": {
                const me = event.data.me;
                if (me) {
                    console.log(`${colors.bright}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
                    console.log(`${colors.bright}║  ${colors.yellow}${me.name}${colors.reset} Lv.${me.level} [${me.className}]${' '.repeat(Math.max(0, 30 - me.name.length - me.className.length))}${colors.bright}║${colors.reset}`);
                    console.log(`${colors.bright}╠══════════════════════════════════════════════════════════╣${colors.reset}`);
                    console.log(`${colors.bright}║${colors.reset}  HP: ${colors.red}${fmt(me.hp)}/${fmt(me.maxHp)}${colors.reset}  MP: ${colors.blue}${fmt(me.mp)}/${fmt(me.maxMp)}${colors.reset}${' '.repeat(26)}${colors.bright}║${colors.reset}`);
                    console.log(`${colors.bright}║${colors.reset}  CP: ${colors.yellow}${fmt(me.cp)}/${fmt(me.maxCp)}${colors.reset}  XP: ${colors.green}${fmt(me.exp)}${colors.reset}${' '.repeat(27)}${colors.bright}║${colors.reset}`);
                    console.log(`${colors.bright}║${colors.reset}  Position: (${me.x}, ${me.y}, ${me.z})${' '.repeat(23)}${colors.bright}║${colors.reset}`);
                    console.log(`${colors.bright}╠══════════════════════════════════════════════════════════╣${colors.reset}`);
                    console.log(`${colors.bright}║${colors.reset}  Players nearby: ${colors.cyan}${event.data.players?.length ?? 0}${colors.reset}  NPCs nearby: ${colors.magenta}${event.data.npcs?.length ?? 0}${colors.reset}${' '.repeat(15)}${colors.bright}║${colors.reset}`);
                    console.log(`${colors.bright}║${colors.reset}  Items on ground: ${colors.yellow}${event.data.items?.length ?? 0}${colors.reset}${' '.repeat(37)}${colors.bright}║${colors.reset}`);
                    console.log(`${colors.bright}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);
                } else {
                    console.log(`${colors.dim}⏳ Character not in game yet...${colors.reset}`);
                }
                break;
            }
            
            case "me": {
                const me = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 👤 ${colors.bright}${me.name}${colors.reset} Lv.${me.level} [${me.className}]`);
                console.log(`   Position: (${me.x}, ${me.y}, ${me.z})`);
                console.log(`   HP: ${me.hp}/${me.maxHp} | MP: ${me.mp}/${me.maxMp} | CP: ${me.cp}/${me.maxCp}\n`);
                break;
            }
            
            case "me.update": {
                const d = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🔄 Me updated: HP ${d.hp}/${d.maxHp}, MP ${d.mp}/${d.maxMp}\n`);
                break;
            }
            
            case "player.appear": {
                const p = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 👤 ${colors.green}→${colors.reset} Player appeared: ${colors.bright}${p.name}${colors.reset} [${p.className}] dist=${Math.round(p.distanceToMe)}`);
                break;
            }
            
            case "player.update": {
                const p = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🔄 Player update: ${p.name} - (${p.x}, ${p.y}, ${p.z})\n`);
                break;
            }
            
            case "npc.appear": {
                const n = event.data;
                const icon = n.attackable ? '⚔️' : '👤';
                console.log(`${colors.yellow}[${ts}]${colors.reset} ${icon} ${colors.magenta}→${colors.reset} NPC appeared: ${colors.bright}${n.name}${colors.reset} Lv.${n.level} dist=${Math.round(n.distanceToMe)}`);
                break;
            }
            
            case "npc.update": {
                const n = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🔄 NPC update: ${n.name} - (${n.x}, ${n.y}, ${n.z})\n`);
                break;
            }
            
            case "entity.move": {
                const e = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🏃 ${e.name} moved: (${e.from.x}, ${e.from.y}) → (${e.to.x}, ${e.to.y}) dist=${Math.round(e.distanceToMe)}\n`);
                break;
            }
            
            case "entity.despawn": {
                const e = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 👋 ${e.name} disappeared\n`);
                break;
            }
            
            case "entity.die": {
                const e = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 💀 ${colors.red}✕${colors.reset} Died: ${colors.bright}${e.name}${colors.reset}\n`);
                break;
            }
            
            case "entity.revive": {
                const e = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} ✨ ${e.name} revived\n`);
                break;
            }
            
            case "chat.message": {
                const c = event.data;
                const typeColors = {
                    all: colors.reset,
                    shout: colors.red,
                    whisper: colors.dim,
                    party: colors.blue,
                    clan: colors.green,
                    trade: colors.yellow,
                    hero: colors.magenta,
                    system: colors.cyan,
                };
                const typeColor = typeColors[c.type] || colors.reset;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 💬 [${typeColor}${c.type}${colors.reset}] ${colors.bright}${c.sender}${colors.reset}: ${c.message}\n`);
                break;
            }
            
            case "status.update": {
                const s = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} ❤️ Status: ${s.name} HP=${s.hp}/${s.maxHp}, MP=${s.mp}/${s.maxMp}\n`);
                break;
            }
            
            case "item.spawn": {
                const i = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 📦 Item spawned: ${i.name} x${i.count} at (${i.x}, ${i.y})\n`);
                break;
            }
            
            case "item.drop": {
                const i = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 💧 Item dropped: ${i.name} x${i.count} by ${i.droppedBy}\n`);
                break;
            }
            
            case "combat.skill.use": {
                const s = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} ⚔️ Skill: ${s.skillName} (Lv.${s.skillLevel}) by ${s.casterName} → ${s.targetName}\n`);
                break;
            }
            
            case "target.select": {
                const t = event.data;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🎯 Target selected: ${t.name} (${t.type}) HP=${t.hp}/${t.maxHp}\n`);
                break;
            }
            
            case "target.unselect":
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🎯❌ Target unselected\n`);
                break;
            
            case "effects.update": {
                const effects = event.data.effects;
                console.log(`${colors.yellow}[${ts}]${colors.reset} ✨ Effects updated: ${effects.length} active\n`);
                break;
            }
            
            case "inventory.full":
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🎒 Inventory updated: ${event.data.length} items\n`);
                break;
            
            case "inventory.update":
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🎒 Inventory changed\n`);
                break;
            
            case "skills.full":
                console.log(`${colors.yellow}[${ts}]${colors.reset} 📚 Skills loaded: ${event.data.length} skills\n`);
                break;
            
            case "pong":
                console.log(`${colors.dim}[${ts}] pong${colors.reset}`);
                break;
            
            case "subscribed":
                console.log(`${colors.green}[${ts}] ✅ Subscribed to: ${event.data.channels.join(', ')}${colors.reset}\n`);
                break;
            
            case "unsubscribed":
                console.log(`${colors.yellow}[${ts}] ⬅️ Unsubscribed from: ${event.data.channels.join(', ')}${colors.reset}\n`);
                break;
            
            case "batch": {
                console.log(`${colors.yellow}[${ts}]${colors.reset} 📦 Batch: ${event.data.length} events\n`);
                // Можно развернуть события внутри батча
                break;
            }
            
            case "audit_stats": {
                const a = event.data;
                const lostColor = a.lost > 0 ? colors.red : colors.green;
                console.log(`${colors.yellow}[${ts}]${colors.reset} 🔍 Audit stats: Received=${a.packetsReceived}, Sent=${a.packetsSentToWs}, ${lostColor}Lost=${a.lost}${colors.reset}, Queue=${a.queueSize}`);
                if (a.lostPackets && a.lostPackets.length > 0) {
                    console.log(`   ⚠️ Recent lost packets:`);
                    a.lostPackets.slice(0, 5).forEach(pkt => {
                        console.log(`      - ${pkt.name} (${pkt.opcodeHex}): ${pkt.reason}`);
                    });
                }
                break;
            }
            
            default:
                console.log(`${colors.dim}[${ts}]${colors.reset} 📨 ${event.type}:`, JSON.stringify(event.data).substring(0, 100), "\n");
        }
    } catch (err) {
        console.error("❌ Failed to parse message:", err.message);
        console.error("Raw:", raw.toString().substring(0, 200));
    }
});

ws.on("error", (err) => {
    console.error(`${colors.red}❌ WebSocket error:${colors.reset}`, err.message);
    if (err.message.includes("ECONNREFUSED")) {
        console.error(`${colors.red}   Make sure the L2 client is running with WebSocket API enabled${colors.reset}`);
        console.error(`${colors.red}   Check WS_ENABLED=true in .env${colors.reset}`);
    }
});

ws.on("close", (code, reason) => {
    console.log(`\n${colors.red}🔌 Connection closed:${colors.reset} Code ${code}${reason ? ', Reason: ' + reason : ''}`);
    process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}👋 Disconnecting...${colors.reset}`);
    ws.close();
});

// Пинг каждые 30 секунд для keepalive
const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
    }
}, 30000);

ws.on('close', () => {
    clearInterval(pingInterval);
});
