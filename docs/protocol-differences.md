# Различия протоколов CT_0_Interlude vs CT-2.6-HighFive

## Основные различия

| Характеристика | CT_0_Interlude (текущий) | CT-2.6-HighFive (цель) |
|---|---|---|
| **Версия протокола** | 746 | 267 (основная версия HighFive) |
| **Шифрование Game Server** | ОТКЛЮЧЕНО (flag=0) | ВКЛЮЧЕНО (XOR шифрование) |
| **ProtocolVersion опкод** | 0x00 | 0x0E (стандартный L2) |
| **AuthRequest опкод** | 0x08 | 0x2B (стандартный L2) |
| **CharacterSelect опкод** | 0x0D | 0x36 (стандартный L2) |
| **EnterWorld последовательность** | 3 пакета (0x9D + 0xD0 0x08 0x00 + 0x03) | 1 пакет (0x11) |

## Источники информации

На основе анализа следующих источников:
- [Protocol Overview - Lineage 2 JavaScript Client](https://npetrovski.github.io/l2js-client/guide/protocolOverview.html)
- [Game Protocol - Lineage 2 JavaScript Client](https://npetrovski.github.io/l2js-client/guide/gameProtocol.html)
- [L2 Protocols Versions](http://akumu.ru/lineage2/protocols.html)
- Текущая документация проекта в `docs/client_server_protocol.md`

## Версии протокола HighFive

| Версия | Chronicle | Описание |
|---|---|---|
| 267 | HighFive | Основная версия |
| 268 | HighFive Update 1 | Первое обновление |
| 271 | HighFive Update 2 | Второе обновление |
| 273 | HighFive Update 3 | Третье обновление |

**Для CT-2.6-HighFive рекомендуется использовать версию протокола 267.**

## Mapping опкодов

### Client → Game Server

| Пакет | CT_0_Interlude | HighFive | Примечания |
|---|---|---|---|
| ProtocolVersion | 0x00 | 0x0E | Первый пакет подключения |
| AuthRequest | 0x08 | 0x2B | Аутентификация с session keys |
| CharacterSelected | 0x0D | 0x36 | Выбор персонажа |
| EnterWorld | 0x03 (+ спец. последовательность) | 0x11 | Вход в игровой мир |

### Game Server → Client

| Пакет | CT_0_Interlude | HighFive | Примечания |
|---|---|---|---|
| CryptInit | 0x00 | 0x2E (реальный опкод с сервера) | Шифровальный ключ и флаг |
| CharSelectInfo | 0x13 | 0x09 | Список персонажей |
| CharSelected | 0x15 | 0x1D | Подтверждение выбора |
| UserInfo | 0x04 | 0x04 | Информация о персонаже |

## Ключевые изменения в последовательности подключения

### CT_0_Interlude (текущий):
```
Client                    Game Server
   |                           |
   |--- ProtocolVersion (0x00)->|  (protocol=746)
   |<---- CryptInit (0x00) -----|  (encryption flag=0)
   |                           |
   |--- AuthRequest (0x08) --->|
   |<--- CharSelectInfo (0x13)-|
   |                           |
   |--- CharacterSelected ---->|
   |      (0x0D)               |
   |<--- CharSelected (0x15) --|
   |                           |
   |--- 0x9D ----------------->|  \
   |--- 0xD0 0x08 0x00 ------->|   > Специальная EnterWorld
   |--- 0x03 + 104 bytes ----->|  /  последовательность
   |                           |
   |<--- UserInfo (0x04) ------|
```

### CT-2.6-HighFive (цель):
```
Client                    Game Server
   |                           |
   |--- ProtocolVersion (0x0E)->|  (protocol=267)
   |<---- KeyPacket (0xE9) -----|  (encryption enabled)
   |                           |
   |--- AuthLogin (0x2B) ----->|
   |<--- CharSelectionInfo -----|
   |      (0x09)               |
   |                           |
   |--- CharacterSelect ------>|
   |      (0x36)               |
   |<--- CharSelected (0x1D) --|
   |                           |
   |--- EnterWorld (0x11) ---->|  Стандартный пакет
   |                           |
   |<--- UserInfo (0x04) ------|
```

## Изменения в шифровании

### CT_0_Interlude:
- **Game Server**: Шифрование **ОТКЛЮЧЕНО** через flag=0 в CryptInit
- **Login Server**: Стандартное Blowfish + RSA

### CT-2.6-HighFive:
- **Game Server**: XOR шифрование **ВКЛЮЧЕНО** по умолчанию
- **Login Server**: Стандартное Blowfish + RSA (без изменений)

## Структурные изменения пакетов

### ProtocolVersion
- **Опкод**: 0x00 → 0x0E
- **Версия протокола**: 746 → 267
- **Структура**: остается той же (INT32LE)

### AuthRequest → AuthLogin
- **Опкод**: 0x08 → 0x2B
- **Поля**: возможны изменения в порядке session keys

### EnterWorld
- **Вместо**: 3 пакета (0x9D + 0xD0 0x08 0x00 + 0x03)
- **Используется**: 1 пакет с опкодом 0x11
- **Размер**: минимальный без padding

## Файлы, требующие изменения

### Критичные (обязательно):
1. `src/config.ts` - изменить дефолтный протокол с 746 на 267
2. `src/game/packets/outgoing/ProtocolVersion.ts` - опкод 0x00 → 0x0E
3. `src/game/packets/outgoing/AuthRequest.ts` - опкод 0x08 → 0x2B
4. `src/game/packets/outgoing/CharacterSelected.ts` - опкод 0x0D → 0x36
5. `src/game/packets/outgoing/EnterWorld.ts` - создать новый с опкодом 0x11
6. `src/game/GameClient.ts` - логика EnterWorld последовательности
7. `src/game/GameCrypt.ts` - включить XOR шифрование
8. `src/infrastructure/protocol/game/PacketRegistry.ts` - обновить опкоды

### Высокий приоритет:
- Все packet DTOs в `src/infrastructure/protocol/game/packets/`
- Все handlers в `src/infrastructure/protocol/game/handlers/`
- `docs/client_server_protocol.md` - обновить документацию

## Вопросы для уточнения

1. **Точная версия HighFive**: Использовать 267 или более новую (268, 271, 273)?
2. **Опкод обфускации**: Используется ли opcode obfuscation в CT-2.6-HighFive?
3. **Структуры пакетов**: Изменились ли поля в UserInfo, CharInfo, NpcInfo?
4. **Дополнительные пакеты**: Появились ли новые опкоды в HighFive?

## Рекомендуемый план действий

1. Начать с изменения версии протокола на 267
2. Обновить опкоды основных пакетов (ProtocolVersion, AuthRequest, etc.)
3. Включить XOR шифрование Game Server
4. Заменить EnterWorld последовательность
5. Тестировать подключение с реальным HighFive сервером
6. Поэтапно обновлять структуры входящих пакетов