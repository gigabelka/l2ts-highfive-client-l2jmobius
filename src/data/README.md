# L2J Mobius Data

Нормализованные данные сервера L2J Mobius CT 0 Interlude в формате JSON.

## Структура

```
src/data/
├── export/                    # Нормализованные данные
│   ├── armorsets/            # Сеты брони
│   │   └── armorsets.json    # 51 сет
│   ├── items/                # Предметы
│   │   └── items.json        # 9208 предметов
│   ├── npcs/                 # NPC
│   │   └── npcs.json         # 6519 NPC
│   ├── skills/               # Скиллы
│   │   └── skills.json       # 2694 скилла
│   ├── players/              # Данные игроков
│   │   ├── skillTrees.json   # Деревья умений
│   │   └── classTemplates.json # Шаблоны классов
│   ├── pets/                 # Питомцы
│   │   └── pets.json
│   ├── fishing/              # Рыбалка
│   │   └── fishing.json
│   ├── augmentation/         # Аугментация
│   │   └── augmentation.json
│   └── henna.json            # Татуировки (180 шт)
├── stats/                    # Исходный database.json
│   └── database.json
├── types.ts                  # TypeScript типы
├── loader.ts                 # Утилиты загрузки
└── index.ts                  # Главный экспорт
```

## Использование

### Импорт данных

```typescript
import { 
    items, npcs, skills, armorSets,
    getItem, getNpc, getSkill, findItemsByName 
} from './data';

// Получить предмет по ID
const sword = getItem(1);

// Поиск по имени
const healSkills = findSkillsByName('Heal');

// Доступ к массивам
console.log(`Loaded ${items.length} items`);
console.log(`Loaded ${npcs.length} npcs`);
```

### Типы

```typescript
import type { Item, Npc, Skill, ArmorSet } from './data';

const item: Item = getItem(1);
const npc: Npc = getNpc(20101);
```

## Обновление данных

1. Скопируйте папку `data/stats` из сервера L2J Mobius в `stats/`
2. Запустите экспорт:

```bash
npm run export:data
```

Или полный цикл:
```bash
npm run export:stats
```

## Источник данных

- **Сервер**: L2J Mobius CT 0 Interlude
- **Протокол**: 746
- **XML Location**: `dist/game/data/stats/` (на сервере)
