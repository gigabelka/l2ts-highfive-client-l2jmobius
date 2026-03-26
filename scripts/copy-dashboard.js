/**
 * Copy dashboard static files from src/dashboard to dist/dashboard
 * This ensures HTML, CSS, JS, and JSON files are available in the build output
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'dashboard');
const destDir = path.join(projectRoot, 'dist', 'dashboard');

function copyRecursive(src, dest) {
    // Create destination if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function copyDashboard() {
    console.log('📁 Copying dashboard static files...');
    
    // Check if source exists
    if (!fs.existsSync(srcDir)) {
        console.error(`❌ Source directory not found: ${srcDir}`);
        process.exit(1);
    }
    
    // Create destination if it doesn't exist
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Copy all files recursively
    try {
        copyRecursive(srcDir, destDir);
        console.log(`✅ Copied: ${srcDir} → ${destDir}`);
    } catch (error) {
        console.error('❌ Copy failed:', error);
        process.exit(1);
    }
    
    // Copy skills.json to dist/data if it exists
    const srcDataDir = path.join(projectRoot, 'src', 'data');
    const destDataDir = path.join(projectRoot, 'dist', 'data');
    if (fs.existsSync(srcDataDir)) {
        if (!fs.existsSync(destDataDir)) {
            fs.mkdirSync(destDataDir, { recursive: true });
        }
        const dataFiles = fs.readdirSync(srcDataDir);
        for (const file of dataFiles) {
            const srcFile = path.join(srcDataDir, file);
            const destFile = path.join(destDataDir, file);
            if (fs.statSync(srcFile).isFile()) {
                fs.copyFileSync(srcFile, destFile);
                console.log(`  ✓ data/${file}`);
            }
        }
    }

    // Verify key files exist
    const requiredFiles = [
        'index.html',
        'api-docs.html',
        'openapi.json',
        'css/dashboard.css',
        'js/app.js'
    ];
    
    let allExist = true;
    for (const file of requiredFiles) {
        const filePath = path.join(destDir, file);
        if (fs.existsSync(filePath)) {
            console.log(`  ✓ ${file}`);
        } else {
            console.log(`  ✗ ${file} (missing)`);
            allExist = false;
        }
    }
    
    if (allExist) {
        console.log('\n✅ Dashboard files ready!');
        console.log(`   Access: http://localhost:3000/`);
        console.log(`   API Docs: http://localhost:3000/api-docs`);
    } else {
        console.warn('\n⚠️  Some files are missing');
    }
}

copyDashboard();
