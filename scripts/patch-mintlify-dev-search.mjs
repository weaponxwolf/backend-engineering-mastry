import fs from 'fs';
import path from 'path';
import os from 'os';

// 1. Helper to patch all layout_tsx files in ~/.mintlify/previews
function patchClientLayouts() {
  try {
    const homeDir = os.homedir();
    const previewsDir = path.join(homeDir, '.mintlify', 'previews');
    if (!fs.existsSync(previewsDir)) return;

    function scanAndPatch(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanAndPatch(full);
        } else if (entry.name.includes('layout_tsx') && entry.name.endsWith('.js')) {
          try {
            let text = fs.readFileSync(full, 'utf-8');
            const target = 'isLoggedInCli:u,hasChatPermissions:u,subdomain:v,deploymentMetadataValue:{subdomain:v}';
            const replacement = 'isLoggedInCli:u,hasChatPermissions:false,subdomain:v||"backend-mastery",deploymentMetadataValue:{subdomain:v||"backend-mastery"}';
            if (text.includes(target)) {
              text = text.replace(target, replacement);
              fs.writeFileSync(full, text, 'utf-8');
              console.log(`✅ [patch-mintlify] Disabled assistant & enabled offline subdomain in ${entry.name}`);
            }
          } catch (e) {}
        }
      }
    }
    scanAndPatch(previewsDir);
  } catch (err) {
    console.error('Failed to patch client layouts:', err);
  }
}

// Run layout patch immediately for existing previews
patchClientLayouts();

// 2. Patch node_modules/@mintlify/previewing/dist/local-preview/run.js
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
let modified = false;

// Ensure top imports include fs, path, os
if (!content.includes("import os from 'os';")) {
  content = `import fs from 'fs';\nimport path from 'path';\nimport os from 'os';\n` + content;
  modified = true;
}

// Ensure process.env.MINTLIFY_CLI_ACCESS_TOKEN and MINTLIFY_CLI_SUBDOMAIN are set BEFORE setupNext() is called
const runFnHeaderReplacement = `export const run = async (argv) => {
    process.env.MINTLIFY_CLI_ACCESS_TOKEN = process.env.MINTLIFY_CLI_ACCESS_TOKEN || argv.accessToken || 'local-offline-dev-token';
    process.env.MINTLIFY_CLI_SUBDOMAIN = process.env.MINTLIFY_CLI_SUBDOMAIN || argv.subdomain || 'backend-mastery';
    try {
        const homeDir = os.homedir();
        const pDir = path.join(homeDir, '.mintlify', 'previews');
        if (fs.existsSync(pDir)) {
            const scan = (d) => {
                for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                    const f = path.join(d, e.name);
                    if (e.isDirectory()) scan(f);
                    else if (e.name.includes('layout_tsx') && e.name.endsWith('.js')) {
                        let t = fs.readFileSync(f, 'utf-8');
                        const tgt = 'isLoggedInCli:u,hasChatPermissions:u,subdomain:v,deploymentMetadataValue:{subdomain:v}';
                        const rep = 'isLoggedInCli:u,hasChatPermissions:false,subdomain:v||"backend-mastery",deploymentMetadataValue:{subdomain:v||"backend-mastery"}';
                        if (t.includes(tgt)) {
                            fs.writeFileSync(f, t.replace(tgt, rep), 'utf-8');
                        }
                    }
                }
            };
            scan(pDir);
        }
    } catch {}
    const port = argv.port || '3000';
    const currentPort = parseInt(port, 10) || 3000;
    const app = express();
    const server = createServer(app);
    const io = new SocketServer(server);
    const requestHandler = await timeDev('setup Next handler', () => setupNext());`;

const runFnHeaderRegex = /export const run = async \(argv\) => \{[\s\S]*?const requestHandler = await timeDev\('setup Next handler', \(\) => setupNext\(\)\);/;

if (runFnHeaderRegex.test(content)) {
  content = content.replace(runFnHeaderRegex, runFnHeaderReplacement);
  modified = true;
}

// Patch token and subdomain assignment
const tokenTarget = "process.env.MINTLIFY_CLI_ACCESS_TOKEN = accessToken ?? '';";
const tokenReplacement = "process.env.MINTLIFY_CLI_ACCESS_TOKEN = process.env.MINTLIFY_CLI_ACCESS_TOKEN || accessToken || 'local-offline-dev-token';\n    process.env.MINTLIFY_CLI_SUBDOMAIN = process.env.MINTLIFY_CLI_SUBDOMAIN || subdomain || 'backend-mastery';";

if (content.includes(tokenTarget)) {
  content = content.replace(tokenTarget, tokenReplacement);
  modified = true;
}

const subdomainCheck = "if (subdomain)\n        process.env.MINTLIFY_CLI_SUBDOMAIN = subdomain;";
const subdomainReplacement = "process.env.MINTLIFY_CLI_SUBDOMAIN = process.env.MINTLIFY_CLI_SUBDOMAIN || subdomain || 'backend-mastery';";
if (content.includes(subdomainCheck)) {
  content = content.replace(subdomainCheck, subdomainReplacement);
  modified = true;
}

// Patch local search endpoint to return scored offline search results with clean excerpts
const searchEndpointRegex = /app\.post\('\/_mintlify\/api-public\/search\/:subdomain', express\.json\(\), async \(req, res\) => \{[\s\S]*?\}\);\n    app\.post\('\/_mintlify\/api-public\/assistant/;

const searchReplacement = `app.post('/_mintlify/api-public/search/:subdomain', express.json(), async (req, res) => {
        const targetSubdomain = subdomain ?? req.params.subdomain ?? 'backend-mastery';
        if (accessToken && accessToken !== 'local-offline-dev-token') {
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
                res.status(200).json({ id: 'local-dev-search', results: [] });
                return;
            }
            const docsDir = fs.existsSync(path.join(CMD_EXEC_PATH, 'docs')) ? path.join(CMD_EXEC_PATH, 'docs') : CMD_EXEC_PATH;
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

            function getCleanExcerpt(text, lower, q) {
                const descMatch = text.match(/description:\\s*["']?([^"'\\n]+)["']?/);
                const body = text.replace(/^---[\\s\\S]*?---/, '').trim();
                const bodyLower = body.toLowerCase();
                const bodyIdx = bodyLower.indexOf(q);
                if (bodyIdx !== -1) {
                    const start = Math.max(0, bodyIdx - 40);
                    const end = Math.min(body.length, bodyIdx + 120);
                    let snippet = body.substring(start, end)
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/[#*\`>\\n\\r\\t]/g, ' ')
                        .replace(/\\s+/g, ' ')
                        .trim();
                    if (start > 0) snippet = '...' + snippet;
                    if (end < body.length) snippet = snippet + '...';
                    return snippet;
                }
                if (descMatch) return descMatch[1].trim();
                return body.substring(0, 150)
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/[#*\`>\\n\\r\\t]/g, ' ')
                    .replace(/\\s+/g, ' ')
                    .trim();
            }

            function searchDir(current) {
                if (!fs.existsSync(current)) return;
                for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                    const full = path.join(current, entry.name);
                    if (entry.isDirectory()) {
                        searchDir(full);
                    } else if (entry.name.endsWith('.mdx')) {
                        const fileText = fs.readFileSync(full, 'utf-8');
                        const lower = fileText.toLowerCase();
                        if (lower.includes(query)) {
                            let rel = path.relative(docsDir, full).replace(/\\\\/g, '/').replace(/\\.mdx$/, '');
                            if (rel === 'index') rel = '';
                            const titleMatch = fileText.match(/title:\\s*["']?([^"'\\n]+)["']?/);
                            const title = titleMatch ? titleMatch[1].trim() : (rel.split('/').pop() || 'Documentation');
                            const folder = rel.split('/')[0] || '';
                            const category = categoryMap[folder] || 'Documentation';

                            let score = 10;
                            const titleLower = title.toLowerCase();
                            if (titleLower === query) score += 120;
                            else if (titleLower.includes(query)) score += 60;
                            if (rel.toLowerCase().includes(query)) score += 30;

                            const excerpt = getCleanExcerpt(fileText, lower, query);

                            results.push({
                                id: rel || 'index',
                                page: rel,
                                header: title,
                                content: excerpt,
                                metadata: {
                                    breadcrumbs: [category]
                                },
                                score
                            });
                        }
                    }
                }
            }
            searchDir(docsDir);
            results.sort((a, b) => b.score - a.score);
            res.status(200).json({
                id: 'local-dev-search-' + Date.now(),
                results: results.slice(0, 20)
            });
        } catch (localErr) {
            console.error('Local search fallback failed:', localErr);
            res.status(502).json({ error: 'search failed' });
        }
    });\n    app.post('/_mintlify/api-public/assistant`;

if (searchEndpointRegex.test(content)) {
  content = content.replace(searchEndpointRegex, searchReplacement);
  modified = true;
}

// Suppress SearchDisabledLog warning
const disabledLogTarget = `        if (!accessToken) {
            addLog(_jsx(SearchDisabledLog, { loginCommand: \`\${argv.packageName} login\` }));
        }`;
const disabledLogReplacement = `        if (!accessToken) {
            // Local offline search is active
        }`;

if (content.includes(disabledLogTarget)) {
  content = content.replace(disabledLogTarget, disabledLogReplacement);
  modified = true;
}

if (modified) {
  fs.writeFileSync(runJsPath, content, 'utf-8');
  console.log('✅ [patch-mintlify] Successfully patched dev search fallback, subdomain & token in run.js.');
} else {
  console.log('✅ [patch-mintlify] Dev search patch already up to date in run.js.');
}
