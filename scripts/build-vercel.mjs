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

// 6. Prepare HTML files for Pagefind indexing and client interceptor
console.log('📝 [build-vercel] Tagging main content and injecting interceptor script in HTML output...');
function prepareHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'pagefind') prepareHtmlFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      let html = fs.readFileSync(fullPath, 'utf-8');
      let modified = false;

      // Ensure Pagefind only indexes the main article body, ignoring sidebars and navs
      if (html.includes('<main ') && !html.includes('data-pagefind-body')) {
        html = html.replace('<main ', '<main data-pagefind-body ');
        modified = true;
      }

      // Inject the Pagefind search interceptor in the document head
      if (!html.includes('pagefind-interceptor.js') && html.includes('</head>')) {
        html = html.replace('</head>', '<script src="/pagefind-interceptor.js"></script></head>');
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, html, 'utf-8');
      }
    }
  }
}
prepareHtmlFiles(outDir);

// 7. Write Pagefind interceptor script to out/pagefind-interceptor.js
const interceptorCode = `(function() {
  if (typeof window === 'undefined') return;
  const origFetch = window.fetch;
  let pagefindPromise = null;

  async function getPagefind() {
    if (!pagefindPromise) {
      pagefindPromise = import('/pagefind/pagefind.js').then(async (pf) => {
        await pf.init();
        return pf;
      });
    }
    return pagefindPromise;
  }

  const categoryMap = {
    'getting-started': 'Platform & Orientation',
    'backend-basics': 'Level 0: Backend Basics',
    'java': 'Java Foundation',
    'database': 'Database Engineering',
    'spring-boot': 'Spring Boot',
    'production': 'Production & DevOps',
    'advanced': 'Advanced Backend',
    'system-design': 'System Design',
    'projects': 'Projects & Labs',
    'interview': 'Interview Preparation'
  };

  window.fetch = async function(resource, init) {
    const url = typeof resource === 'string' ? resource : resource?.url || '';
    if (url.includes('/_mintlify/api-public/search') || url.includes('/api/search') || url.includes('/_mintlify/api/search')) {
      try {
        let query = '';
        if (init?.body) {
          try {
            const parsed = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
            query = parsed.query || '';
          } catch {}
        }
        if (!query.trim()) {
          return new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const pf = await getPagefind();
        const searchRes = await pf.search(query);
        const topResults = await Promise.all(
          searchRes.results.slice(0, 15).map((r) => r.data())
        );

        const results = [];
        for (const item of topResults) {
          let cleanUrl = item.url
            .replace(/\\/index\\.html$/, '')
            .replace(/\\.html$/, '')
            .replace(/\\/$/, '')
            .replace(/^\\//, '');
          if (cleanUrl === 'index') cleanUrl = '';
          const folder = cleanUrl.split('/')[0] || '';
          const categoryName = categoryMap[folder] || 'Documentation';
          const rawTitle = item.meta?.title || cleanUrl.split('/').pop() || 'Documentation';
          const pageTitle = rawTitle.replace(/\\s*-\\s*Backend Mastery$/, '').trim() || 'Documentation';

          // Add primary page match
          results.push({
            id: cleanUrl || 'index',
            page: cleanUrl,
            header: pageTitle,
            content: item.excerpt ? item.excerpt.replace(/<[^>]+>/g, '') : '',
            metadata: {
              breadcrumbs: [categoryName]
            }
          });

          // Add section sub-results if available
          if (Array.isArray(item.sub_results)) {
            for (const sub of item.sub_results.slice(0, 3)) {
              if (sub.title && sub.title !== rawTitle && sub.title !== pageTitle) {
                const hash = sub.url.includes('#') ? sub.url.split('#')[1] : '';
                if (hash) {
                  results.push({
                    id: cleanUrl + '#' + hash,
                    page: cleanUrl + '#' + hash,
                    header: sub.title,
                    content: sub.excerpt ? sub.excerpt.replace(/<[^>]+>/g, '') : '',
                    metadata: {
                      breadcrumbs: [pageTitle]
                    }
                  });
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({ results }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Pagefind client search fallback error:', err);
      }
    }
    return origFetch.apply(this, arguments);
  };
})();`;

fs.writeFileSync(path.join(outDir, 'pagefind-interceptor.js'), interceptorCode, 'utf-8');
console.log('🔌 [build-vercel] Generated out/pagefind-interceptor.js.');

// 8. Build Pagefind client-side search index
console.log('🔍 [build-vercel] Building Pagefind WebAssembly search index for static bundle...');
try {
  execSync('npx -y pagefind --site out', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('❌ [build-vercel] Pagefind indexing failed:', error.message);
  process.exit(1);
}

// 9. Verify core assets
if (!fs.existsSync(indexFile)) {
  console.error('❌ [build-vercel] Verification failed: out/index.html is missing!');
  process.exit(1);
}

const nextStaticDir = path.join(outDir, '_next', 'static');
if (!fs.existsSync(nextStaticDir)) {
  console.error('❌ [build-vercel] Verification failed: out/_next/static is missing!');
  process.exit(1);
}

const pagefindDir = path.join(outDir, 'pagefind');
if (!fs.existsSync(pagefindDir)) {
  console.error('❌ [build-vercel] Verification failed: out/pagefind is missing!');
  process.exit(1);
}

console.log('✅ [build-vercel] Build complete! Static bundle with Pagefind search ready for Vercel deployment.');
