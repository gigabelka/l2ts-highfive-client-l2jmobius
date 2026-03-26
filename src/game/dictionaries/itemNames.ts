/**
 * Словарь названий предметов (itemId → название)
 * Самые частые предметы Interlude
 * 
 * Примечание: для полноты нужно генерировать из серверного датапака (L2J_Mobius XML)
 * Путь в датапаке: data/stats/items/*.xml
 */

export const ITEM_NAMES: Record<number, string> = {
    // === Валюта ===
    57: 'Adena',
    5575: 'Ancient Adena',
    70154: 'Silver Coin',

    // === Soul Shots ===
    1463: 'Soulshot: No-Grade',
    1464: 'Soulshot: No-Grade (x2)',
    1465: 'Soulshot: D-Grade',
    1466: 'Soulshot: C-Grade',
    1467: 'Soulshot: B-Grade',
    1468: 'Soulshot: A-Grade',
    1469: 'Soulshot: S-Grade',

    // === Spirit Shots ===
    2510: 'Spiritshot: No-Grade',
    2511: 'Spiritshot: D-Grade',
    2512: 'Spiritshot: C-Grade',
    2513: 'Spiritshot: B-Grade',
    2514: 'Spiritshot: A-Grade',
    2515: 'Spiritshot: S-Grade',

    // === Blessed Spirit Shots ===
    3947: 'Blessed Spiritshot: No-Grade',
    3948: 'Blessed Spiritshot: D-Grade',
    3949: 'Blessed Spiritshot: C-Grade',
    3950: 'Blessed Spiritshot: B-Grade',
    3951: 'Blessed Spiritshot: A-Grade',
    3952: 'Blessed Spiritshot: S-Grade',

    // === HP Potions ===
    1061: 'Healing Potion',
    1062: 'Greater Healing Potion',
    1539: 'Greater Healing Potion (x2)',
    1540: 'Quick Healing Potion',

    // === MP Potions ===
    1831: 'Mana Potion',
    1832: 'Greater Mana Potion',
    1833: 'Quick Mana Potion',

    // === CP Potions ===
    5591: 'CP Potion',
    5592: 'Greater CP Potion',

    // === Elixirs ===
    8622: 'Elixir of Life (No-Grade)',
    8623: 'Elixir of Life (D-Grade)',
    8624: 'Elixir of Life (C-Grade)',
    8625: 'Elixir of Life (B-Grade)',
    8626: 'Elixir of Life (A-Grade)',
    8627: 'Elixir of Life (S-Grade)',
    8628: 'Elixir of Mental Strength (No-Grade)',
    8629: 'Elixir of Mental Strength (D-Grade)',
    8630: 'Elixir of Mental Strength (C-Grade)',
    8631: 'Elixir of Mental Strength (B-Grade)',
    8632: 'Elixir of Mental Strength (A-Grade)',
    8633: 'Elixir of Mental Strength (S-Grade)',
    8634: 'Elixir of CP (No-Grade)',
    8635: 'Elixir of CP (D-Grade)',
    8636: 'Elixir of CP (C-Grade)',
    8637: 'Elixir of CP (B-Grade)',
    8638: 'Elixir of CP (A-Grade)',
    8639: 'Elixir of CP (S-Grade)',

    // === Scrolls of Escape ===
    736: 'Scroll of Escape',
    1835: 'Scroll of Escape (x5)',
    13700: 'Scroll of Escape: Talking Island Village',
    13701: 'Scroll of Escape: Elven Village',
    13702: 'Scroll of Escape: Dark Elf Village',
    13703: 'Scroll of Escape: Orc Village',
    13704: 'Scroll of Escape: Dwarven Village',
    13705: 'Scroll of Escape: Gludio Castle Town',
    13706: 'Scroll of Escape: Dion Castle Town',
    13707: 'Scroll of Escape: Floran Village',
    13708: 'Scroll of Escape: Giran Castle Town',
    13709: 'Scroll of Escape: Hardin\'s Academy',
    13710: 'Scroll of Escape: Heine',
    13711: 'Scroll of Escape: Town of Oren',
    13712: 'Scroll of Escape: Ivory Tower',
    13713: 'Scroll of Escape: Hunters Village',
    13714: 'Scroll of Escape: Town of Aden',
    13715: 'Scroll of Escape: Town of Goddard',
    13716: 'Scroll of Escape: Rune Township',
    13717: 'Scroll of Escape: Town of Schuttgart',

    // === Scrolls of Resurrection ===
    737: 'Scroll of Resurrection',
    3936: 'Blessed Scroll of Resurrection',
    6387: 'Blessed Scroll of Resurrection (for Pets)',

    // === Enchant Scrolls ===
    729: 'Scroll: Enchant Weapon (A-Grade)',
    730: 'Scroll: Enchant Armor (A-Grade)',
    947: 'Scroll: Enchant Weapon (B-Grade)',
    948: 'Scroll: Enchant Armor (B-Grade)',
    951: 'Scroll: Enchant Weapon (C-Grade)',
    952: 'Scroll: Enchant Armor (C-Grade)',
    955: 'Scroll: Enchant Weapon (D-Grade)',
    956: 'Scroll: Enchant Armor (D-Grade)',
    959: 'Scroll: Enchant Weapon (S-Grade)',
    960: 'Scroll: Enchant Armor (S-Grade)',

    // === Blessed Enchant Scrolls ===
    6569: 'Blessed Scroll: Enchant Weapon (S-Grade)',
    6570: 'Blessed Scroll: Enchant Armor (S-Grade)',
    6571: 'Blessed Scroll: Enchant Weapon (A-Grade)',
    6572: 'Blessed Scroll: Enchant Armor (A-Grade)',
    6573: 'Blessed Scroll: Enchant Weapon (B-Grade)',
    6574: 'Blessed Scroll: Enchant Armor (B-Grade)',
    6575: 'Blessed Scroll: Enchant Weapon (C-Grade)',
    6576: 'Blessed Scroll: Enchant Armor (C-Grade)',
    6577: 'Blessed Scroll: Enchant Weapon (D-Grade)',
    6578: 'Blessed Scroll: Enchant Armor (D-Grade)',

    // === Кристаллы (Crystals) ===
    1458: 'Crystal: D-Grade',
    1459: 'Crystal: C-Grade',
    1460: 'Crystal: B-Grade',
    1461: 'Crystal: A-Grade',
    1462: 'Crystal: S-Grade',

    // === Gemstones ===
    2130: 'Gemstone D',
    2131: 'Gemstone C',
    2132: 'Gemstone B',
    2133: 'Gemstone A',

    // === Soul Crystals ===
    4629: 'Red Soul Crystal - Stage 1',
    4630: 'Red Soul Crystal - Stage 2',
    4631: 'Red Soul Crystal - Stage 3',
    4632: 'Red Soul Crystal - Stage 4',
    4633: 'Red Soul Crystal - Stage 5',
    4634: 'Red Soul Crystal - Stage 6',
    4635: 'Red Soul Crystal - Stage 7',
    4636: 'Red Soul Crystal - Stage 8',
    4637: 'Red Soul Crystal - Stage 9',
    4638: 'Red Soul Crystal - Stage 10',
    4639: 'Green Soul Crystal - Stage 1',
    4640: 'Green Soul Crystal - Stage 2',
    4641: 'Green Soul Crystal - Stage 3',
    4642: 'Green Soul Crystal - Stage 4',
    4643: 'Green Soul Crystal - Stage 5',
    4644: 'Green Soul Crystal - Stage 6',
    4645: 'Green Soul Crystal - Stage 7',
    4646: 'Green Soul Crystal - Stage 8',
    4647: 'Green Soul Crystal - Stage 9',
    4648: 'Green Soul Crystal - Stage 10',
    4649: 'Blue Soul Crystal - Stage 1',
    4650: 'Blue Soul Crystal - Stage 2',
    4651: 'Blue Soul Crystal - Stage 3',
    4652: 'Blue Soul Crystal - Stage 4',
    4653: 'Blue Soul Crystal - Stage 5',
    4654: 'Blue Soul Crystal - Stage 6',
    4655: 'Blue Soul Crystal - Stage 7',
    4656: 'Blue Soul Crystal - Stage 8',
    4657: 'Blue Soul Crystal - Stage 9',
    4658: 'Blue Soul Crystal - Stage 10',

    // === Common Craft Materials ===
    1864: 'Varnish',
    1865: 'Varnish of Purity',
    1866: 'Suede',
    1867: 'Animal Skin',
    1868: 'Thread',
    1869: 'Iron Ore',
    1870: 'Coal',
    1871: 'Charcoal',
    1872: 'Animal Bone',
    1873: 'Silver Nugget',
    1874: 'Oriharukon Ore',
    1875: 'Stone of Purity',
    1876: 'Mithril Ore',
    1877: 'Adamantite Nugget',
    1878: 'Bronze',
    1879: 'Steel',
    1880: 'Leather',
    1881: 'Cord',
    1882: 'Metallic Fiber',
    1883: 'Metallic Thread',
    1884: 'Metal Hardener',
    1885: 'Asofe',
    1886: 'Enria',
    1887: 'Thons',
    1888: 'Synthetic Cokes',
    1889: 'Crafted Leather',
    1890: 'Durable Metal Plate',
    1891: 'Mithril Alloy',
    1892: 'Steel Mold',
    1893: 'Synthetic Cokes Mold',
    1894: 'Artisans Frame',
    1895: 'Craftsman Mold',

    // === Key Craft Materials ===
    4040: 'Mold Glue',
    4041: 'Mold Lubricant',
    4042: 'Mold Hardener',
    4043: 'Enria',
    4044: 'Asofe',
    4045: 'Thons',
    4046: 'Mithril Alloy',
    4047: 'Synthetic Cokes',
    4048: 'Durable Metal Plate',
    4049: 'Metal Hardener',

    // === Recipes ===
    1800: 'Recipe: Wooden Arrow',
    1801: 'Recipe: Soulshot: No-Grade',
    1802: 'Recipe: Soulshot: D-Grade',
    1803: 'Recipe: Soulshot: C-Grade',
    1804: 'Recipe: Soulshot: B-Grade',
    1805: 'Recipe: Soulshot: A-Grade',
    1806: 'Recipe: Soulshot: S-Grade',
    1807: 'Recipe: Spiritshot: No-Grade',
    1808: 'Recipe: Spiritshot: D-Grade',
    1809: 'Recipe: Spiritshot: C-Grade',
    1810: 'Recipe: Spiritshot: B-Grade',
    1811: 'Recipe: Spiritshot: A-Grade',
    1812: 'Recipe: Spiritshot: S-Grade',

    // === Life Stones ===
    8723: 'Life Stone: Level 46',
    8724: 'Life Stone: Level 49',
    8725: 'Life Stone: Level 52',
    8726: 'Life Stone: Level 55',
    8727: 'Life Stone: Level 58',
    8728: 'Life Stone: Level 61',
    8729: 'Life Stone: Level 64',
    8730: 'Life Stone: Level 67',
    8731: 'Life Stone: Level 70',
    8732: 'Life Stone: Level 76',
    9573: 'Mid-Grade Life Stone: Level 46',
    9574: 'Mid-Grade Life Stone: Level 49',
    9575: 'Mid-Grade Life Stone: Level 52',
    9576: 'Mid-Grade Life Stone: Level 55',
    9577: 'Mid-Grade Life Stone: Level 58',
    9578: 'Mid-Grade Life Stone: Level 61',
    9579: 'Mid-Grade Life Stone: Level 64',
    9580: 'Mid-Grade Life Stone: Level 67',
    9581: 'Mid-Grade Life Stone: Level 70',
    9582: 'Mid-Grade Life Stone: Level 76',

    // === Ranged Ammo ===
    17: 'Wooden Arrow',
    1341: 'Bone Arrow',
    1342: 'Steel Arrow',
    1343: 'Silver Arrow',
    1344: 'Mithril Arrow',
    1345: 'Shining Arrow',

    // === Armor Sets Key Items ===
    1125: 'Recipe: Necklace of Binding',
    1126: 'Recipe: Mana Ring',
    1127: 'Recipe: Earring of Seal',
    1128: 'Recipe: Earring of Wisdom',
    1129: 'Recipe: Sage\'s Necklace',
    1130: 'Recipe: Necklace of Protection',
    1131: 'Recipe: Ring of Protection',
    1132: 'Recipe: Earring of Protection',
    1133: 'Recipe: Elemental Necklace',
    1134: 'Recipe: Necklace of Phantom',
    1135: 'Recipe: Ring of Phantom',
    1136: 'Recipe: Earring of Phantom',

    // === Cursed Weapons ===
    8190: 'Zariche',
    8689: 'Akamanah',

    // === Hero Weapons ===
    6611: 'Infinity Blade',
    6612: 'Infinity Cleaver',
    6613: 'Infinity Axe',
    6614: 'Infinity Rod',
    6615: 'Infinity Crusher',
    6616: 'Infinity Scepter',
    6617: 'Infinity Stinger',
    6618: 'Infinity Fang',
    6619: 'Infinity Bow',
    6620: 'Infinity Specter',
    6621: 'Infinity Wing',
    9384: 'Infinity Rapier',
    9385: 'Infinity Sword',
    9386: 'Infinity Shooter',

    // === Fish ===
    7600: 'Blue Mackerel',
    7601: 'Fresh Blue Mackerel',
    7602: 'Rusty Sword',
    7603: 'Rusty Coin',
    7604: 'Leather Boots',
    7605: 'Small Purple Treasure Chest',
    7606: 'Small Yellow Treasure Chest',
    7607: 'Small Blue Treasure Chest',
    7608: 'Large Purple Treasure Chest',
    7609: 'Large Yellow Treasure Chest',
    7610: 'Large Blue Treasure Chest',
    7611: 'Box of Blue Mackerel',
    7612: 'Box of Fresh Blue Mackerel',
    7613: 'Box of Rusty Sword',
    7614: 'Box of Rusty Coin',
    7615: 'Box of Leather Boots',
    7616: 'Box of Small Purple Treasure Chest',
    7617: 'Box of Small Yellow Treasure Chest',
    7618: 'Box of Small Blue Treasure Chest',
    7619: 'Box of Large Purple Treasure Chest',
    7620: 'Box of Large Yellow Treasure Chest',
    7621: 'Box of Large Blue Treasure Chest',

    // === Seven Signs Spiritstones ===
    5908: 'Nephilim Spiritstone',
    5909: 'Chakram Spiritstone',
    5910: 'Blood Sword Spiritstone',
    5911: 'Mace of The Underworld Spiritstone',
    5912: 'Demon Sword Spiritstone',
    5913: 'Demon Staff Spiritstone',
    5914: 'Dark Screamer Spiritstone',

    // === BOG / COD Items ===
    6390: 'Badly Printed Page',
    6391: 'Black Page',
    6392: 'Mysterious Page',
    6393: 'Dragon Page',
    6394: 'Old Page',
    6395: 'Torn Page',
    6396: 'Abyss Page',

    // === Transformation Items ===
    10127: 'Grail of Aegis',
    10128: 'Grail of Chaos',
    10129: 'Grail of Fury',
    10130: 'Grail of Wisdom',
    10131: 'Grail of Silence',
    10132: 'Grail of Light',
    10133: 'Grail of Darkness',
    10134: 'Grail of Life',
    10135: 'Grail of Death',
    10136: 'Grail of Power',
    10137: 'Grail of Knowledge',
    10138: 'Grail of Courage',
    10139: 'Grail of Strength',
    10140: 'Grail of Agility',
    10141: 'Grail of Speed',
    10142: 'Grail of Regeneration',

    // === Olympiad Items ===
    13750: 'Olympiad Token',
    13751: 'Noblesse Gate Pass',
    13752: 'Hero\'s Wing',
    13753: 'Hero\'s Crown',
    13754: 'Hero\'s Scepter',
    13755: 'Hero\'s Cloak',
    13756: 'Hero\'s Shield',
    13757: 'Hero\'s Sword',
    13758: 'Hero\'s Helm',
    13759: 'Hero\'s Armor',
    13760: 'Hero\'s Gloves',
    13761: 'Hero\'s Boots',
    13762: 'Hero\'s Ring',
    13763: 'Hero\'s Necklace',
    13764: 'Hero\'s Earring',
};

/**
 * Получить название предмета по ID
 * @param id - itemId
 * @returns Название предмета или "Unknown Item #id"
 * 
 * Примечание: для полноты нужно генерировать из серверного датапака
 * Путь в L2J_Mobius: data/stats/items/*.xml
 */
export function getItemName(id: number): string {
    return ITEM_NAMES[id] ?? `Unknown Item #${id}`;
}
