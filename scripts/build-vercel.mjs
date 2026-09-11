import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const outDir = path.join(rootDir, 'out');
const exportZipPath = path.join(docsDir, 'export.zip');

console.log('🚀 [build-vercel] Starting Mintlify documentation export...');

// 1. Run Mintlify export inside docs directory
try {
  execSync('npx mintlify export', {
    cwd: docsDir,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' }
  });
} catch (error) {
  console.error('❌ [build-vercel] Mintlify export failed:', error.message);
  process.exit(1);
}

if (!fs.existsSync(exportZipPath)) {
  console.error(`❌ [build-vercel] Expected export zip at ${exportZipPath} not found.`);
  process.exit(1);
}

console.log('📦 [build-vercel] Export zip generated successfully.');

// 2. Prepare clean output directory
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// 3. Unzip export.zip to out/
console.log(`📂 [build-vercel] Extracting static bundle to ${outDir}...`);
try {
  execSync(`unzip -q -o "${exportZipPath}" -d "${outDir}"`, { stdio: 'inherit' });
} catch (error) {
  console.error('❌ [build-vercel] Failed to extract export.zip:', error.message);
  process.exit(1);
}

// 4. Remove redundant nested export.zip in out/ to optimize upload payload
const nestedZip = path.join(outDir, 'export.zip');
if (fs.existsSync(nestedZip)) {
  fs.unlinkSync(nestedZip);
  console.log('🧹 [build-vercel] Cleaned up redundant nested export.zip in out/ directory.');
}

// 5. Ensure 404.html fallback exists for client-side routing on direct route reloads
const notFoundFile = path.join(outDir, '404.html');
const indexFile = path.join(outDir, 'index.html');
if (!fs.existsSync(notFoundFile) && fs.existsSync(indexFile)) {
  fs.copyFileSync(indexFile, notFoundFile);
  console.log('📄 [build-vercel] Created out/404.html from index.html for SPA fallback.');
}

// 6. Verify core assets
if (!fs.existsSync(indexFile)) {
  console.error('❌ [build-vercel] Verification failed: out/index.html is missing!');
  process.exit(1);
}

const nextStaticDir = path.join(outDir, '_next', 'static');
if (!fs.existsSync(nextStaticDir)) {
  console.error('❌ [build-vercel] Verification failed: out/_next/static is missing!');
  process.exit(1);
}

console.log('✅ [build-vercel] Build complete! Static bundle ready for Vercel deployment.');
