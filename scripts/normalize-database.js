// scripts/normalize-database.js
// Нормализация database.json в удобную структуру для экспорта
//
// Требует предварительного запуска export-xml.js для создания database.json.
// Этот скрипт читает: src/data/stats/database.json
// Результат сохраняется в: src/data/export/

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../src/data/stats/database.json');
const OUTPUT_DIR = path.join(__dirname, '../src/data/export');

// Утилиты
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const writeJSON = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✓ ${path.basename(filePath)}: ${Array.isArray(data) ? data.length : Object.keys(data).length} записей`);
};

// Нормализация armor sets
function normalizeArmorSets(db) {
    const sets = [];
    const grades = ['a_grade', 'b_grade', 'c_grade', 'd_grade', 'no_grade', 's_grade', 'clan'];
    
    for (const grade of grades) {
        const key = `armorsets/${grade}`;
        if (!db[key]?.list?.set) continue;
        
        let items = db[key].list.set;
        if (!Array.isArray(items)) items = [items];
        
        for (const item of items) {
            const set = {
                id: parseInt(item.id),
                grade: grade.replace('_grade', '').toUpperCase(),
                items: {
                    chest: item.chest ? parseInt(item.chest.id) : null,
                    legs: item.legs ? parseInt(item.legs.id) : null,
                    head: item.head ? parseInt(item.head.id) : null,
                    gloves: item.gloves ? parseInt(item.gloves.id) : null,
                    feet: item.feet ? parseInt(item.feet.id) : null,
                    shield: item.shield ? parseInt(item.shield.id) : null,
                },
                skills: [],
                shieldSkill: item.shield_skill ? {
                    id: parseInt(item.shield_skill.id),
                    level: parseInt(item.shield_skill.level)
                } : null,
                enchant6Skill: item.enchant6skill ? {
                    id: parseInt(item.enchant6skill.id),
                    level: parseInt(item.enchant6skill.level)
                } : null,
                stats: {}
            };
            
            // Скиллы сета
            if (item.skill) {
                const skills = Array.isArray(item.skill) ? item.skill : [item.skill];
                set.skills = skills.map(s => ({ id: parseInt(s.id), level: parseInt(s.level) }));
            }
            
            // Статы
            ['str', 'con', 'dex', 'int', 'wit', 'men'].forEach(stat => {
                if (item[stat]) {
                    set.stats[stat] = parseInt(item[stat].val);
                }
            });
            
            sets.push(set);
        }
    }
    
    return sets;
}

// Нормализация предметов
function normalizeItems(db) {
    const items = [];
    const itemKeys = Object.keys(db).filter(k => k.startsWith('items/') && !k.includes('custom'));
    
    for (const key of itemKeys) {
        const data = db[key];
        if (!data?.list?.item) continue;
        
        let itemList = data.list.item;
        if (!Array.isArray(itemList)) itemList = [itemList];
        
        for (const item of itemList) {
            const normalized = {
                id: parseInt(item.id),
                name: item.name || 'Unknown',
                type: item.type || 'NONE',
                material: item.material || null,
                weight: parseInt(item.weight) || 0,
                price: parseInt(item.price) || 0,
                crystallizable: item.crystallizable === 'true',
                crystalType: item.crystal_type || 'NONE',
                crystalCount: parseInt(item.crystal_count) || 0,
                duration: parseInt(item.duration) || -1,
                stats: {},
                skills: []
            };
            
            // Доп. данные по типу
            if (item.type === 'Weapon') {
                normalized.weaponType = item.weapon_type || null;
                normalized.soulshots = parseInt(item.soulshots) || 0;
                normalized.spiritshots = parseInt(item.spiritshots) || 0;
                normalized.pAtk = parseInt(item.pAtk) || 0;
                normalized.mAtk = parseInt(item.mAtk) || 0;
                normalized.atkSpeed = parseInt(item.atkSpeed) || 0;
                normalized.critical = parseInt(item.critical) || 0;
                normalized.hitModify = parseInt(item.hitModify) || 0;
                normalized.avoidModify = parseInt(item.avoidModify) || 0;
            } else if (item.type === 'Armor') {
                normalized.armorType = item.armor_type || null;
                normalized.pDef = parseInt(item.pDef) || 0;
                normalized.mDef = parseInt(item.mDef) || 0;
                normalized.mpBonus = parseInt(item.mpBonus) || 0;
            }
            
            // Скиллы предмета
            if (item.skill) {
                const skills = Array.isArray(item.skill) ? item.skill : [item.skill];
                normalized.skills = skills.map(s => ({
                    id: parseInt(s.id),
                    level: parseInt(s.level),
                    type: s.type || 'NONE'
                }));
            }
            
            items.push(normalized);
        }
    }
    
    return items;
}

// Нормализация NPC
function normalizeNpcs(db) {
    const npcs = [];
    const npcKeys = Object.keys(db).filter(k => k.startsWith('npcs/') && !k.includes('custom'));
    
    for (const key of npcKeys) {
        const data = db[key];
        if (!data?.list?.npc) continue;
        
        let npcList = data.list.npc;
        if (!Array.isArray(npcList)) npcList = [npcList];
        
        for (const npc of npcList) {
            const normalized = {
                id: parseInt(npc.id),
                name: npc.name || 'Unknown',
                title: npc.title || '',
                type: npc.type || 'L2Npc',
                level: parseInt(npc.level) || 1,
                stats: {
                    str: parseInt(npc.str) || 0,
                    con: parseInt(npc.con) || 0,
                    dex: parseInt(npc.dex) || 0,
                    int: parseInt(npc.int) || 0,
                    wit: parseInt(npc.wit) || 0,
                    men: parseInt(npc.men) || 0,
                    hp: parseFloat(npc.hp) || 0,
                    mp: parseFloat(npc.mp) || 0,
                    hpRegen: parseFloat(npc.hpRegen) || 0,
                    mpRegen: parseFloat(npc.mpRegen) || 0,
                    pAtk: parseInt(npc.pAtk) || 0,
                    pDef: parseInt(npc.pDef) || 0,
                    mAtk: parseInt(npc.mAtk) || 0,
                    mDef: parseInt(npc.mDef) || 0,
                    atkSpeed: parseInt(npc.atkSpeed) || 0,
                    castSpeed: parseInt(npc.castSpeed) || 0,
                    speed: parseInt(npc.speed) || 0,
                },
                drops: [],
                spoil: []
            };
            
            // Дроп
            if (npc.drop) {
                const drops = Array.isArray(npc.drop) ? npc.drop : [npc.drop];
                normalized.drops = drops.map(d => ({
                    itemId: parseInt(d.id),
                    min: parseInt(d.min),
                    max: parseInt(d.max),
                    chance: parseFloat(d.chance)
                }));
            }
            
            // Спойл
            if (npc.spoil) {
                const spoils = Array.isArray(npc.spoil) ? npc.spoil : [npc.spoil];
                normalized.spoil = spoils.map(s => ({
                    itemId: parseInt(s.id),
                    min: parseInt(s.min),
                    max: parseInt(s.max),
                    chance: parseFloat(s.chance)
                }));
            }
            
            npcs.push(normalized);
        }
    }
    
    return npcs;
}

// Нормализация скиллов
function normalizeSkills(db) {
    const skills = [];
    const skillKeys = Object.keys(db).filter(k => k.startsWith('skills/') && !k.includes('custom'));
    
    for (const key of skillKeys) {
        const data = db[key];
        if (!data?.list?.skill) continue;
        
        let skillList = data.list.skill;
        if (!Array.isArray(skillList)) skillList = [skillList];
        
        for (const skill of skillList) {
            const normalized = {
                id: parseInt(skill.id),
                name: skill.name || 'Unknown',
                maxLevel: parseInt(skill.levels) || 1,
                type: 'ACTIVE',
                isPassive: false,
                target: 'TARGET_NONE',
                effects: []
            };
            
            // Парсим set параметры
            if (skill.set) {
                const sets = Array.isArray(skill.set) ? skill.set : [skill.set];
                for (const s of sets) {
                    switch (s.name) {
                        case 'operateType':
                            if (s.val === 'OP_PASSIVE') {
                                normalized.type = 'PASSIVE';
                                normalized.isPassive = true;
                            } else if (s.val === 'OP_TOGGLE') {
                                normalized.type = 'TOGGLE';
                            } else if (s.val === 'OP_CHANCE') {
                                normalized.type = 'CHANCE';
                            }
                            break;
                        case 'target':
                            normalized.target = s.val;
                            break;
                    }
                }
            }
            
            skills.push(normalized);
        }
    }
    
    return skills;
}

// Нормализация умений персонажей (skill trees)
function normalizeSkillTrees(db) {
    const trees = {};
    const treeKeys = Object.keys(db).filter(k => k.includes('skillTrees'));
    
    for (const key of treeKeys) {
        const data = db[key];
        if (!data?.list?.skill) continue;
        
        const className = key.split('/').pop();
        let skills = data.list.skill;
        if (!Array.isArray(skills)) skills = [skills];
        
        trees[className] = skills.map(s => ({
            id: parseInt(s.id),
            name: s.name || 'Unknown',
            minLevel: parseInt(s.minLevel) || 1,
            cost: parseInt(s.cost) || 0
        }));
    }
    
    return trees;
}

// Нормализация шаблонов классов
function normalizeClassTemplates(db) {
    const templates = {};
    const templateKeys = Object.keys(db).filter(k => k.includes('templates') && k.includes('Class'));
    
    for (const key of templateKeys) {
        const data = db[key];
        if (!data?.list) continue;
        
        const className = key.split('/').pop();
        
        templates[className] = {
            stats: {},
            items: [],
            skills: []
        };
        
        // Стартовые статы
        if (data.list.stat) {
            const stats = Array.isArray(data.list.stat) ? data.list.stat : [data.list.stat];
            for (const stat of stats) {
                templates[className].stats[stat.name] = parseInt(stat.val);
            }
        }
        
        // Стартовые предметы
        if (data.list.item) {
            const items = Array.isArray(data.list.item) ? data.list.item : [data.list.item];
            templates[className].items = items.map(i => ({
                id: parseInt(i.id),
                count: parseInt(i.count) || 1
            }));
        }
        
        // Стартовые скиллы
        if (data.list.skill) {
            const skills = Array.isArray(data.list.skill) ? data.list.skill : [data.list.skill];
            templates[className].skills = skills.map(s => ({
                id: parseInt(s.id),
                level: parseInt(s.level) || 1
            }));
        }
    }
    
    return templates;
}

// Нормализация питомцев
function normalizePets(db) {
    const pets = [];
    const petKeys = Object.keys(db).filter(k => k.startsWith('pets/'));
    
    for (const key of petKeys) {
        const data = db[key];
        if (!data?.pet) continue;
        
        const pet = data.pet;
        pets.push({
            id: parseInt(pet.id),
            name: pet.name || 'Unknown',
            level: parseInt(pet.level) || 1,
            exp: parseInt(pet.exp) || 0,
            maxExp: parseInt(pet.maxExp) || 0,
            hp: parseInt(pet.hp) || 0,
            mp: parseInt(pet.mp) || 0,
            pAtk: parseInt(pet.pAtk) || 0,
            pDef: parseInt(pet.pDef) || 0,
            mAtk: parseInt(pet.mAtk) || 0,
            mDef: parseInt(pet.mDef) || 0,
            atkSpeed: parseInt(pet.atkSpeed) || 0,
            castSpeed: parseInt(pet.castSpeed) || 0,
            speed: parseInt(pet.speed) || 0,
            foodId: pet.foodId ? parseInt(pet.foodId) : null
        });
    }
    
    return pets;
}

// Нормализация рыбалки
function normalizeFishing(db) {
    const result = {
        fishes: [],
        monsters: [],
        rods: []
    };
    
    // Рыбы
    if (db['fishing/fishes']?.list?.fish) {
        let fishes = db['fishing/fishes'].list.fish;
        if (!Array.isArray(fishes)) fishes = [fishes];
        result.fishes = fishes.map(f => ({
            id: parseInt(f.id),
            name: f.name || 'Unknown',
            level: parseInt(f.level) || 1,
            hp: parseInt(f.hp) || 0,
            xp: parseInt(f.xp) || 0,
            sp: parseInt(f.sp) || 0
        }));
    }
    
    // Монстры
    if (db['fishing/fishingMonsters']?.list?.npc) {
        let monsters = db['fishing/fishingMonsters'].list.npc;
        if (!Array.isArray(monsters)) monsters = [monsters];
        result.monsters = monsters.map(m => ({
            id: parseInt(m.id),
            name: m.name || 'Unknown',
            level: parseInt(m.level) || 1
        }));
    }
    
    // Удочки
    if (db['fishing/fishingRods']?.list?.rod) {
        let rods = db['fishing/fishingRods'].list.rod;
        if (!Array.isArray(rods)) rods = [rods];
        result.rods = rods.map(r => ({
            id: parseInt(r.id),
            name: r.name || 'Unknown',
            mpConsume: parseInt(r.mpConsume) || 0
        }));
    }
    
    return result;
}

// Нормализация хенны (татуировок)
function normalizeHenna(db) {
    if (!db.hennaList?.list?.henna) return [];
    
    let hennas = db.hennaList.list.henna;
    if (!Array.isArray(hennas)) hennas = [hennas];
    
    return hennas.map(h => ({
        symbolId: parseInt(h.symbolId),
        dyeId: parseInt(h.dyeId),
        name: h.name || 'Unknown',
        stat: h.stat || 'NONE',
        amount: parseInt(h.amount) || 0,
        price: parseInt(h.price) || 0,
        INT: parseInt(h.INT) || 0,
        STR: parseInt(h.STR) || 0,
        CON: parseInt(h.CON) || 0,
        MEN: parseInt(h.MEN) || 0,
        DEX: parseInt(h.DEX) || 0,
        WIT: parseInt(h.WIT) || 0
    }));
}

// Нормализация аугментации
function normalizeAugmentation(db) {
    const result = {
        skillMap: {},
        options: []
    };
    
    // Skill map
    if (db['augmentation/augmentation_skillmap']?.list?.augmentation) {
        let augments = db['augmentation/augmentation_skillmap'].list.augmentation;
        if (!Array.isArray(augments)) augments = [augments];
        
        for (const aug of augments) {
            result.skillMap[aug.id] = {
                skillId: parseInt(aug.skillId),
                skillLevel: parseInt(aug.skillLevel) || 1
            };
        }
    }
    
    // Options
    const optionKeys = Object.keys(db).filter(k => k.startsWith('augmentation/options/'));
    for (const key of optionKeys) {
        const data = db[key];
        if (!data?.list?.option) continue;
        
        let options = data.list.option;
        if (!Array.isArray(options)) options = [options];
        
        for (const opt of options) {
            result.options.push({
                id: parseInt(opt.id),
                effect1: opt.effect1 || null,
                effect2: opt.effect2 || null,
                effect3: opt.effect3 || null
            });
        }
    }
    
    return result;
}

// Главная функция
function normalize() {
    console.log('Начинаем нормализацию database.json...\n');
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Ошибка: Файл не найден: ${INPUT_FILE}`);
        return;
    }
    
    const db = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    ensureDir(OUTPUT_DIR);
    
    // Создаем поддиректории
    const dirs = ['armorsets', 'items', 'npcs', 'skills', 'players', 'pets', 'fishing', 'augmentation'];
    dirs.forEach(d => ensureDir(path.join(OUTPUT_DIR, d)));
    
    console.log('=== Armor Sets ===');
    writeJSON(path.join(OUTPUT_DIR, 'armorsets/armorsets.json'), normalizeArmorSets(db));
    
    console.log('\n=== Items ===');
    writeJSON(path.join(OUTPUT_DIR, 'items/items.json'), normalizeItems(db));
    
    console.log('\n=== NPCs ===');
    writeJSON(path.join(OUTPUT_DIR, 'npcs/npcs.json'), normalizeNpcs(db));
    
    console.log('\n=== Skills ===');
    writeJSON(path.join(OUTPUT_DIR, 'skills/skills.json'), normalizeSkills(db));
    
    console.log('\n=== Players ===');
    writeJSON(path.join(OUTPUT_DIR, 'players/skillTrees.json'), normalizeSkillTrees(db));
    writeJSON(path.join(OUTPUT_DIR, 'players/classTemplates.json'), normalizeClassTemplates(db));
    
    console.log('\n=== Pets ===');
    writeJSON(path.join(OUTPUT_DIR, 'pets/pets.json'), normalizePets(db));
    
    console.log('\n=== Fishing ===');
    writeJSON(path.join(OUTPUT_DIR, 'fishing/fishing.json'), normalizeFishing(db));
    
    console.log('\n=== Henna ===');
    writeJSON(path.join(OUTPUT_DIR, 'henna.json'), normalizeHenna(db));
    
    console.log('\n=== Augmentation ===');
    writeJSON(path.join(OUTPUT_DIR, 'augmentation/augmentation.json'), normalizeAugmentation(db));
    
    console.log('\n✅ Нормализация завершена!');
    console.log(`📁 Результат: ${OUTPUT_DIR}`);
}

normalize();
