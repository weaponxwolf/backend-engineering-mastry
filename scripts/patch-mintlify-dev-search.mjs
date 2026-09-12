import fs from 'fs';
import path from 'path';

const runJsPath = path.join(
  process.cwd(),
  'node_modules',
  '@mintlify',
  'previewing',
  'dist',
  'local-preview',
  'run.js'
);

if (!fs.existsSync(runJsPath)) {
  console.log('ℹ️ [patch-mintlify] @mintlify/previewing/dist/local-preview/run.js not found. Skipping dev search patch.');
  process.exit(0);
}

let content = fs.readFileSync(runJsPath, 'utf-8');

if (content.includes('// Local offline search fallback across docs/ MDX files')) {
  console.log('✅ [patch-mintlify] Dev search patch already present in run.js.');
  process.exit(0);
}

const targetCode = `    app.post('/_mintlify/api-public/search/:subdomain', express.json(), async (req, res) => {
        const targetSubdomain = subdomain ?? req.params.subdomain;
        try {
            const upstream = await fetch(\`\${apiUrl}/api/cli/\${targetSubdomain}/search\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: \`Bearer \${accessToken}\` } : {}),
                },
                body: JSON.stringify(req.body),
            });
            const data = await upstream.json();
            res.status(upstream.status).json(data);
        }
        catch {
            res.status(502).json({ error: 'search proxy failed' });
        }
    });`;

const replacementCode = `    app.post('/_mintlify/api-public/search/:subdomain', express.json(), async (req, res) => {
        const targetSubdomain = subdomain ?? req.params.subdomain;
        if (accessToken) {
            try {
                const upstream = await fetch(\`\${apiUrl}/api/cli/\${targetSubdomain}/search\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: \`Bearer \${accessToken}\`,
                    },
                    body: JSON.stringify(req.body),
                });
                const data = await upstream.json();
                if (upstream.ok && !data.error) {
                    res.status(upstream.status).json(data);
                    return;
                }
            } catch {}
        }
        // Local offline search fallback across docs/ MDX files
        try {
            const query = (req.body?.query || '').trim().toLowerCase();
            if (!query) {
                res.status(200).json({ results: [] });
                return;
            }
            const fsModule = await import('fs');
            const pathModule = await import('path');
            const docsDir = pathModule.join(process.cwd(), 'docs');
            const results = [];
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

            function searchDir(current) {
                if (!fsModule.existsSync(current)) return;
                for (const entry of fsModule.readdirSync(current, { withFileTypes: true })) {
                    const full = pathModule.join(current, entry.name);
                    if (entry.isDirectory()) {
                        searchDir(full);
                    } else if (entry.name.endsWith('.mdx')) {
                        const fileText = fsModule.readFileSync(full, 'utf-8');
                        const lower = fileText.toLowerCase();
                        if (lower.includes(query)) {
                            let rel = pathModule.relative(docsDir, full).replace(/\\\\/g, '/').replace(/\\.mdx$/, '');
                            if (rel === 'index') rel = '';
                            const titleMatch = fileText.match(/title:\\s*["']?([^"'\\n]+)["']?/);
                            const title = titleMatch ? titleMatch[1].trim() : (rel.split('/').pop() || 'Documentation');
                            const folder = rel.split('/')[0] || '';
                            const category = categoryMap[folder] || 'Documentation';
                            
                            const idx = lower.indexOf(query);
                            const start = Math.max(0, idx - 40);
                            const end = Math.min(fileText.length, idx + 100);
                            const excerpt = fileText.substring(start, end).replace(/[#*\`\\n]/g, ' ').trim();

                            results.push({
                                page: rel,
                                header: title,
                                content: excerpt,
                                metadata: {
                                    breadcrumbs: [category]
                                }
                            });
                        }
                    }
                }
            }
            searchDir(docsDir);
            res.status(200).json({ results: results.slice(0, 15) });
        } catch (localErr) {
            console.error('Local search fallback failed:', localErr);
            res.status(502).json({ error: 'search failed' });
        }
    });`;

if (content.includes(targetCode)) {
  content = content.replace(targetCode, replacementCode);
  fs.writeFileSync(runJsPath, content, 'utf-8');
  console.log('✅ [patch-mintlify] Successfully patched dev search fallback in run.js.');
} else {
  console.warn('⚠️ [patch-mintlify] Could not match target search handler in run.js.');
}
