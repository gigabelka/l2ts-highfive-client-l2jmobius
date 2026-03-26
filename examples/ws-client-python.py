#!/usr/bin/env python3
"""
WebSocket Vision API Client for L2 Headless Client

Пример клиента на Python для подключения к WebSocket Vision API.
Показывает полный снимок состояния и слушает события игрового мира.

Установка зависимостей:
    pip install websockets

Запуск:
    python examples/ws-client-python.py

С опциями:
    python examples/ws-client-python.py --host=192.168.1.100 --port=3001 --token=secret --channels=me,chat,combat
"""

import asyncio
import argparse
import json
import sys
from datetime import datetime
from typing import Optional

try:
    import websockets
except ImportError:
    print("❌ Error: websockets package not found")
    print("   Install with: pip install websockets")
    sys.exit(1)


# ANSI colors for terminal output
class Colors:
    RESET = '\033[0m'
    BRIGHT = '\033[1m'
    DIM = '\033[2m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'


def format_number(n: Optional[int]) -> str:
    """Format number with thousands separator"""
    if n is None:
        return '?'
    return f"{n:,}"


def get_timestamp() -> str:
    """Get current timestamp string"""
    return datetime.now().strftime('%H:%M:%S')


def print_box_line(content: str, width: int = 58) -> None:
    """Print a line in a box"""
    padding = width - len(content) - 2
    print(f"{Colors.BRIGHT}║{Colors.RESET} {content}{' ' * padding}{Colors.BRIGHT}║{Colors.RESET}")


def print_header(title: str) -> None:
    """Print box header"""
    width = 58
    print(f"{Colors.BRIGHT}╔{'═' * width}╗{Colors.RESET}")
    print_box_line(f"{Colors.YELLOW}{title}{Colors.RESET}", width)
    print(f"{Colors.BRIGHT}╠{'═' * width}╣{Colors.RESET}")


def print_footer() -> None:
    """Print box footer"""
    print(f"{Colors.BRIGHT}╚{'═' * 58}╝{Colors.RESET}\n")


async def handle_event(event: dict) -> None:
    """Handle incoming WebSocket event"""
    event_type = event.get('type')
    data = event.get('data', {})
    ts = event.get('ts')
    ts_str = datetime.fromtimestamp(ts / 1000).strftime('%H:%M:%S') if ts else get_timestamp()
    
    if event_type == 'welcome':
        version = data.get('version', 'unknown')
        clients = data.get('clientsOnline', 0)
        print(f"{Colors.CYAN}👋 Welcome! Version: {version}, Clients online: {clients}{Colors.RESET}\n")
    
    elif event_type == 'snapshot':
        me = data.get('me')
        if me:
            name = me.get('name', 'Unknown')
            level = me.get('level', 0)
            class_name = me.get('className', 'Unknown')
            
            print_header(f"{name} Lv.{level} [{class_name}]")
            
            hp = me.get('hp', 0)
            max_hp = me.get('maxHp', 0)
            mp = me.get('mp', 0)
            max_mp = me.get('maxMp', 0)
            cp = me.get('cp', 0)
            max_cp = me.get('maxCp', 0)
            exp = me.get('exp', 0)
            
            print_box_line(f"HP: {Colors.RED}{format_number(hp)}/{format_number(max_hp)}{Colors.RESET}  "
                          f"MP: {Colors.BLUE}{format_number(mp)}/{format_number(max_mp)}{Colors.RESET}")
            print_box_line(f"CP: {Colors.YELLOW}{format_number(cp)}/{format_number(max_cp)}{Colors.RESET}  "
                          f"XP: {Colors.GREEN}{format_number(exp)}{Colors.RESET}")
            
            x, y, z = me.get('x', 0), me.get('y', 0), me.get('z', 0)
            print_box_line(f"Position: ({x}, {y}, {z})")
            
            print(f"{Colors.BRIGHT}╠{'═' * 58}╣{Colors.RESET}")
            
            players_count = len(data.get('players', []))
            npcs_count = len(data.get('npcs', []))
            items_count = len(data.get('items', []))
            
            print_box_line(f"Players nearby: {Colors.CYAN}{players_count}{Colors.RESET}  "
                          f"NPCs nearby: {Colors.MAGENTA}{npcs_count}{Colors.RESET}")
            print_box_line(f"Items on ground: {Colors.YELLOW}{items_count}{Colors.RESET}")
            
            print_footer()
        else:
            print(f"{Colors.DIM}⏳ Character not in game yet...{Colors.RESET}")
    
    elif event_type == 'me':
        name = data.get('name', 'Unknown')
        level = data.get('level', 0)
        class_name = data.get('className', 'Unknown')
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 👤 {Colors.BRIGHT}{name}{Colors.RESET} "
              f"Lv.{level} [{class_name}]")
        x, y, z = data.get('x', 0), data.get('y', 0), data.get('z', 0)
        print(f"   Position: ({x}, {y}, {z})")
        hp, max_hp = data.get('hp', 0), data.get('maxHp', 0)
        mp, max_mp = data.get('mp', 0), data.get('maxMp', 0)
        print(f"   HP: {hp}/{max_hp} | MP: {mp}/{max_mp}\n")
    
    elif event_type == 'me.update':
        hp, max_hp = data.get('hp', 0), data.get('maxHp', 0)
        mp, max_mp = data.get('mp', 0), data.get('maxMp', 0)
        exp = data.get('exp', 0)
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🔄 Me updated: "
              f"HP {hp}/{max_hp}, MP {mp}/{max_mp}, XP {format_number(exp)}\n")
    
    elif event_type == 'player.appear':
        name = data.get('name', 'Unknown')
        class_name = data.get('className', 'Unknown')
        dist = round(data.get('distanceToMe', 0))
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 👤 {Colors.GREEN}→{Colors.RESET} "
              f"Player appeared: {Colors.BRIGHT}{name}{Colors.RESET} [{class_name}] dist={dist}\n")
    
    elif event_type == 'player.update':
        name = data.get('name', 'Unknown')
        x, y, z = data.get('x', 0), data.get('y', 0), data.get('z', 0)
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🔄 Player update: "
              f"{name} - ({x}, {y}, {z})\n")
    
    elif event_type == 'npc.appear':
        name = data.get('name', 'Unknown')
        level = data.get('level', 0)
        attackable = data.get('attackable', False)
        dist = round(data.get('distanceToMe', 0))
        icon = '⚔️' if attackable else '👤'
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} {icon} {Colors.MAGENTA}→{Colors.RESET} "
              f"NPC appeared: {Colors.BRIGHT}{name}{Colors.RESET} Lv.{level} dist={dist}\n")
    
    elif event_type == 'npc.update':
        name = data.get('name', 'Unknown')
        x, y, z = data.get('x', 0), data.get('y', 0), data.get('z', 0)
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🔄 NPC update: "
              f"{name} - ({x}, {y}, {z})\n")
    
    elif event_type == 'entity.move':
        name = data.get('name', 'Unknown')
        from_pos = data.get('from', {})
        to_pos = data.get('to', {})
        dist = round(data.get('distanceToMe', 0))
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🏃 {name} moved: "
              f"({from_pos.get('x', 0)}, {from_pos.get('y', 0)}) → "
              f"({to_pos.get('x', 0)}, {to_pos.get('y', 0)}) dist={dist}\n")
    
    elif event_type == 'entity.despawn':
        name = data.get('name', 'Unknown')
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 👋 {name} disappeared\n")
    
    elif event_type == 'entity.die':
        name = data.get('name', 'Unknown')
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 💀 {Colors.RED}✕{Colors.RESET} "
              f"Died: {Colors.BRIGHT}{name}{Colors.RESET}\n")
    
    elif event_type == 'entity.revive':
        name = data.get('name', 'Unknown')
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} ✨ {name} revived\n")
    
    elif event_type == 'chat.message':
        msg_type = data.get('type', 'all')
        sender = data.get('sender', 'Unknown')
        message = data.get('message', '')
        
        type_colors = {
            'all': Colors.RESET,
            'shout': Colors.RED,
            'whisper': Colors.DIM,
            'party': Colors.BLUE,
            'clan': Colors.GREEN,
            'trade': Colors.YELLOW,
            'hero': Colors.MAGENTA,
            'system': Colors.CYAN,
        }
        type_color = type_colors.get(msg_type, Colors.RESET)
        
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 💬 "
              f"[{type_color}{msg_type}{Colors.RESET}] "
              f"{Colors.BRIGHT}{sender}{Colors.RESET}: {message}\n")
    
    elif event_type == 'status.update':
        name = data.get('name', 'Unknown')
        hp, max_hp = data.get('hp', 0), data.get('maxHp', 0)
        mp, max_mp = data.get('mp', 0), data.get('maxMp', 0)
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} ❤️ Status: "
              f"{name} HP={hp}/{max_hp}, MP={mp}/{max_mp}\n")
    
    elif event_type == 'item.spawn':
        name = data.get('name', 'Unknown')
        count = data.get('count', 1)
        x, y = data.get('x', 0), data.get('y', 0)
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 📦 Item spawned: "
              f"{name} x{count} at ({x}, {y})\n")
    
    elif event_type == 'item.drop':
        name = data.get('name', 'Unknown')
        count = data.get('count', 1)
        dropped_by = data.get('droppedBy', 'Unknown')
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 💧 Item dropped: "
              f"{name} x{count} by {dropped_by}\n")
    
    elif event_type == 'combat.skill.use':
        skill_name = data.get('skillName', 'Unknown')
        skill_level = data.get('skillLevel', 1)
        caster = data.get('casterName', 'Unknown')
        target = data.get('targetName', 'Unknown')
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} ⚔️ Skill: "
              f"{skill_name} (Lv.{skill_level}) by {caster} → {target}\n")
    
    elif event_type == 'target.select':
        name = data.get('name', 'Unknown')
        target_type = data.get('type', 'unknown')
        hp, max_hp = data.get('hp', 0), data.get('maxHp', 0)
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🎯 Target selected: "
              f"{name} ({target_type}) HP={hp}/{max_hp}\n")
    
    elif event_type == 'target.unselect':
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🎯❌ Target unselected\n")
    
    elif event_type == 'effects.update':
        effects = data.get('effects', [])
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} ✨ Effects updated: "
              f"{len(effects)} active\n")
    
    elif event_type == 'inventory.full':
        items = data if isinstance(data, list) else []
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🎒 Inventory updated: "
              f"{len(items)} items\n")
    
    elif event_type == 'inventory.update':
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 🎒 Inventory changed\n")
    
    elif event_type == 'skills.full':
        skills = data if isinstance(data, list) else []
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 📚 Skills loaded: "
              f"{len(skills)} skills\n")
    
    elif event_type == 'pong':
        print(f"{Colors.DIM}[{ts_str}] pong{Colors.RESET}")
    
    elif event_type == 'subscribed':
        channels = data.get('channels', [])
        print(f"{Colors.GREEN}[{ts_str}] ✅ Subscribed to: {', '.join(channels)}{Colors.RESET}\n")
    
    elif event_type == 'unsubscribed':
        channels = data.get('channels', [])
        print(f"{Colors.YELLOW}[{ts_str}] ⬅️ Unsubscribed from: {', '.join(channels)}{Colors.RESET}\n")
    
    elif event_type == 'batch':
        events = data if isinstance(data, list) else []
        print(f"{Colors.YELLOW}[{ts_str}]{Colors.RESET} 📦 Batch: "
              f"{len(events)} events\n")
    
    else:
        data_str = json.dumps(data)[:100]
        print(f"{Colors.DIM}[{ts_str}]{Colors.RESET} 📨 {event_type}: {data_str}\n")


async def websocket_client(host: str, port: int, token: Optional[str], channels: list) -> None:
    """Main WebSocket client loop"""
    # Build WebSocket URL
    if token:
        uri = f"ws://{host}:{port}?token={token}"
    else:
        uri = f"ws://{host}:{port}"
    
    print(f"🔌 Connecting to L2 Vision API at {uri}...")
    print(f"📡 Subscribing to channels: {', '.join(channels)}\n")
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"{Colors.GREEN}✅ Connected to L2 Vision API{Colors.RESET}\n")
            
            # Request snapshot
            await websocket.send(json.dumps({"type": "get.snapshot"}))
            
            # Subscribe to channels
            await websocket.send(json.dumps({
                "type": "subscribe",
                "channels": channels
            }))
            
            # Keepalive ping task
            async def keepalive():
                while True:
                    await asyncio.sleep(30)
                    await websocket.send(json.dumps({"type": "ping"}))
            
            # Start keepalive in background
            ping_task = asyncio.create_task(keepalive())
            
            try:
                # Main message loop
                async for message in websocket:
                    try:
                        event = json.loads(message)
                        await handle_event(event)
                    except json.JSONDecodeError as e:
                        print(f"{Colors.RED}❌ Failed to parse message: {e}{Colors.RESET}")
                        print(f"   Raw: {message[:200]}")
            finally:
                ping_task.cancel()
                try:
                    await ping_task
                except asyncio.CancelledError:
                    pass
                
    except websockets.exceptions.ConnectionRefused:
        print(f"{Colors.RED}❌ Connection refused:{Colors.RESET}")
        print(f"   Make sure the L2 client is running with WebSocket API enabled")
        print(f"   Check WS_ENABLED=true in .env")
        print(f"   Default port: 3001")
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"{Colors.RED}❌ Connection failed with status {e.status_code}{Colors.RESET}")
        if e.status_code == 401:
            print(f"   Authentication failed - check your token")
    except Exception as e:
        print(f"{Colors.RED}❌ Error: {e}{Colors.RESET}")


def main():
    parser = argparse.ArgumentParser(
        description='WebSocket Vision API Client for L2 Headless Client',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ws-client-python.py
  python ws-client-python.py --host=192.168.1.100 --port=3001
  python ws-client-python.py --token=secret123 --channels=me,chat,combat
  python ws-client-python.py --channels='*'
        """
    )
    
    parser.add_argument(
        '--host',
        default='localhost',
        help='WebSocket server host (default: localhost)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=3001,
        help='WebSocket server port (default: 3001)'
    )
    parser.add_argument(
        '--token',
        default='',
        help='Authentication token (if WS_AUTH_ENABLED)'
    )
    parser.add_argument(
        '--channels',
        default='*',
        help='Comma-separated list of channels to subscribe to (default: *)'
    )
    
    args = parser.parse_args()
    
    # Parse channels
    channels = [c.strip() for c in args.channels.split(',')]
    
    # Run the client
    try:
        asyncio.run(websocket_client(
            host=args.host,
            port=args.port,
            token=args.token if args.token else None,
            channels=channels
        ))
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}👋 Disconnecting...{Colors.RESET}")


if __name__ == '__main__':
    main()
