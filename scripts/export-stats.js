// scripts/export-stats.js
// Полный экспорт всех данных из stats в нормализованный вид
//
// Перед запуском: скопируйте папку data/stats из сервера L2J_Mobius CT_0 Interlude
// в корень проекта (папка stats/ рядом с package.json).
// Скачать сервер: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '../stats');
const OUTPUT_DIR = path.join(__dirname, '../src/data/stats');

console.log('=== L2J Mobius Stats Exporter ===\n');

// Проверяем наличие папки stats
if (!fs.existsSync(STATS_DIR)) {
    console.error(`❌ Директория stats не найдена: ${STATS_DIR}`);
    console.log('Скопируйте папку data/stats из сервера L2J Mobius в корень проекта');
    process.exit(1);
}

// Шаг 1: Конвертация XML в JSON (если есть export-xml.js)
console.log('📦 Шаг 1: Конвертация XML в JSON...');
try {
    const exportXml = require('./export-xml.js');
    console.log('✓ XML конвертирован в database.json\n');
} catch (e) {
    console.log('ℹ️ export-xml.js не найден, используем существующий database.json\n');
}

// Шаг 2: Нормализация данных
console.log('📦 Шаг 2: Нормализация данных...');
try {
    execSync('node scripts/normalize-database.js', { stdio: 'inherit' });
} catch (e) {
    console.error('❌ Ошибка нормализации:', e.message);
    process.exit(1);
}

console.log('\n✅ Экспорт завершен успешно!');
console.log(`📁 Данные сохранены в: ${path.resolve(OUTPUT_DIR)}`);
console.log('\nДоступные данные:');
console.log('  • Armor Sets (armorsets/)');
console.log('  • Items (items/)');
console.log('  • NPCs (npcs/)');
console.log('  • Skills (skills/)');
console.log('  • Players (players/)');
console.log('  • Pets (pets/)');
console.log('  • Fishing (fishing/)');
console.log('  • Henna (henna.json)');
console.log('  • Augmentation (augmentation/)');
