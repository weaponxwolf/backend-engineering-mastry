import fs from 'fs';
import path from 'path';

const outDir = path.resolve('out');
if (!fs.existsSync(outDir)) {
  console.error(`Error: Directory ${outDir} does not exist.`);
  process.exit(1);
}

// Derive repository name: check GITHUB_REPOSITORY (e.g. "weaponxwolf/backend-engineering-mastry")
const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : 'backend-engineering-mastry';
const isUserSite = repo.toLowerCase().endsWith('.github.io');
const basePath = process.env.BASE_PATH ?? (isUserSite ? '' : `/${repo}`);

console.log(`[prepare-github-pages] Target out directory: ${outDir}`);
console.log(`[prepare-github-pages] Repository: ${repo}`);
console.log(`[prepare-github-pages] Computed basePath: "${basePath}"`);

// 1. Create .nojekyll so GitHub Pages does not ignore _next/
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('[prepare-github-pages] Created .nojekyll');

if (!basePath) {
  console.log('[prepare-github-pages] Root-level deployment detected. No subpath rewriting required.');
  process.exit(0);
}

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const allFiles = getAllFiles(outDir);
let modifiedCount = 0;

const envInjection = `<script>
window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
window.__NEXT_DATA__.basePath = "${basePath}";
window.process = window.process || { env: {} };
window.process.env = window.process.env || {};
window.process.env.NEXT_PUBLIC_BASE_PATH = "${basePath}";
window.process.env.NEXT_PUBLIC_ASSET_PREFIX = "${basePath}";
window.process.env.BASE_PATH = "${basePath}";
</script>`;

for (const filePath of allFiles) {
  const ext = path.extname(filePath);

  if (ext === '.html') {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Inject runtime env if not present
    if (!content.includes('window.__NEXT_DATA__.basePath =')) {
      content = content.replace('<head>', `<head>${envInjection}`);
    }

    // 1. Replace assets starting with /_next/
    content = content.replaceAll('"/_next/', `"${basePath}/_next/`);
    content = content.replaceAll("'/_next/", `'${basePath}/_next/`);

    // 2. Replace href="/ (avoiding href="//, href="http, and href="#)
    content = content.replaceAll(/href="\/(?!\/)/g, `href="${basePath}/`);

    // 3. Replace src="/ (avoiding src="//)
    content = content.replaceAll(/src="\/(?!\/)/g, `src="${basePath}/`);

    // 4. Update Mintlify base path router variable
    content = content.replaceAll('var b="";', `var b="${basePath}";`);

    // 5. Update data-current-path
    content = content.replaceAll('data-current-path="/', `data-current-path="${basePath}/`);

    // 6. Update meta content="/
    content = content.replaceAll(/content="\/(?!\/)/g, `content="${basePath}/`);

    // Clean up any double basePath if already partially applied
    const doubleBase = `${basePath}${basePath}/`;
    while (content.includes(doubleBase)) {
      content = content.replaceAll(doubleBase, `${basePath}/`);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedCount++;
    }
  } else if (ext === '.js') {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    if (content.includes('/_next/')) {
      content = content.replaceAll('"/_next/', `"${basePath}/_next/`);
      content = content.replaceAll("'/_next/", `'${basePath}/_next/`);

      const doubleBase = `${basePath}${basePath}/_next/`;
      while (content.includes(doubleBase)) {
        content = content.replaceAll(doubleBase, `${basePath}/_next/`);
      }
    }

    // Replace Next.js environment fallbacks inside JS bundles with valid syntax
    if (content.includes('NEXT_PUBLIC_BASE_PATH')) {
      content = content.replaceAll('.NEXT_PUBLIC_BASE_PATH??""', `.NEXT_PUBLIC_BASE_PATH??"${basePath}"`);
      content = content.replaceAll('.NEXT_PUBLIC_BASE_PATH?? ""', `.NEXT_PUBLIC_BASE_PATH??"${basePath}"`);
      content = content.replaceAll('.NEXT_PUBLIC_ASSET_PREFIX??""', `.NEXT_PUBLIC_ASSET_PREFIX??"${basePath}"`);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedCount++;
    }
  } else if (ext === '.css') {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    if (content.includes('/_next/')) {
      content = content.replaceAll('/_next/', `${basePath}/_next/`);
      const doubleBase = `${basePath}${basePath}/_next/`;
      while (content.includes(doubleBase)) {
        content = content.replaceAll(doubleBase, `${basePath}/_next/`);
      }

      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedCount++;
      }
    }
  }
}

// Verify syntax of all generated JS chunks
for (const filePath of allFiles) {
  if (path.extname(filePath) === '.js') {
    try {
      import('child_process').then(cp => cp.execSync(`node --check "${filePath}"`));
    } catch (err) {
      console.error(`[prepare-github-pages] Syntax error in ${filePath}:`, err.message);
      process.exit(1);
    }
  }
}

// 404 fallback: ensure 404.html exists for client-side routing on GitHub Pages
const notFoundPath = path.join(outDir, '404.html');
const indexPath = path.join(outDir, 'index.html');
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log('[prepare-github-pages] Created 404.html fallback from index.html');
}

console.log(`[prepare-github-pages] Done! Prefixed ${modifiedCount} files with base path "${basePath}".`);
