// scripts/export-xml.js
// Конвертация XML-статов из сервера L2J Mobius в JSON базу данных
//
// Перед запуском: скопируйте папку data/stats из сервера L2J_Mobius CT_0 Interlude
// в корень проекта (папка stats/ рядом с package.json).
// Скачать сервер: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// --- НАСТРОЙКИ ПУТЕЙ ---
const INPUT_DIR = path.join(__dirname, '../stats');

// Укажи путь, куда сохранить готовую базу данных
const OUTPUT_DIR = path.join(__dirname, '../src/data/stats');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'database.json');

// --- ЛОГИКА РЕКУРСИВНОГО ПОИСКА ---
// Эта функция проваливается во все вложенные папки и собирает пути к .xml файлам
function getAllXmlFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllXmlFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.xml')) {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

// --- ОСНОВНАЯ ФУНКЦИЯ ПАРСИНГА ---
async function buildDatabase() {
    console.log(`🔍 Сканируем директорию: ${INPUT_DIR}...`);

    if (!fs.existsSync(INPUT_DIR)) {
        console.error('❌ Ошибка: Входная директория не найдена. Проверьте путь INPUT_DIR.');
        return;
    }

    // Создаем выходную папку, если ее еще нет
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const xmlFiles = getAllXmlFiles(INPUT_DIR);
    console.log(`📁 Найдено XML файлов: ${xmlFiles.length}. Начинаем парсинг...`);

    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const database = {};

    for (const filePath of xmlFiles) {
        try {
            const xmlData = fs.readFileSync(filePath, 'utf-8');
            const result = await parser.parseStringPromise(xmlData);
            
            // Чтобы не было каши, записываем данные по имени файла (без расширения) 
            // или можно использовать относительный путь как ключ
            const fileName = path.basename(filePath, '.xml');
            const relativeDir = path.relative(INPUT_DIR, path.dirname(filePath));
            
            // Формируем уникальный ключ, например: "skills/0100-0199/146"
            const dbKey = relativeDir ? `${relativeDir}/${fileName}` : fileName;

            database[dbKey] = result;
        } catch (err) {
            console.error(`⚠️ Ошибка при чтении/парсинге файла ${filePath}:`, err.message);
        }
    }

    // Сохраняем итоговый JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database, null, 2), 'utf-8');
    console.log(`✅ Готово! База данных успешно сохранена в: ${OUTPUT_FILE}`);
}

buildDatabase();