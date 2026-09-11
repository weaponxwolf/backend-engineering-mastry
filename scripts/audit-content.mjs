import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const rootOption = args.indexOf('--root');
const docsRoot = rootOption >= 0 ? path.resolve(args[rootOption + 1]) : path.join(repository, 'docs');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  }));
  return files.flat();
}

function navigationPages(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'pages' && Array.isArray(child)) {
      for (const page of child) {
        if (typeof page === 'string') output.push(page);
        else navigationPages(page, output);
      }
    } else if (child && typeof child === 'object') navigationPages(child, output);
  }
  return output;
}

function inspectPage(filename, source, errors) {
  const route = path.relative(docsRoot, filename).split(path.sep).join('/').replace(/\.mdx$/, '');
  const lines = source.split(/\r?\n/);
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) errors.push(`${route}: missing YAML frontmatter`);
  else for (const field of ['title', 'description']) {
    const value = frontmatter[1].match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    if (!value || /^(""|'')$/.test(value)) errors.push(`${route}: missing ${field}`);
  }

  const headings = [];
  const genericFences = [];
  const languages = {};
  let fence;
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (match && match[1][0] === fence.marker[0]
          && match[1].length >= fence.marker.length && !match[2].trim()) fence = undefined;
      continue;
    }
    if (match) {
      const language = match[2].trim().split(/\s+/)[0];
      fence = { marker: match[1], line: index + 1 };
      languages[language || '(missing)'] = (languages[language || '(missing)'] || 0) + 1;
      if (!language) errors.push(`${route}:${index + 1}: code fence needs a language`);
      if (['text', 'plaintext'].includes(language)) genericFences.push(index + 1);
    } else if (/^\s*#{1,6}\s+/.test(line)) headings.push(line.replace(/^\s*#+\s+/, ''));
  }
  if (fence) errors.push(`${route}:${fence.line}: unclosed code fence`);
  const headingText = headings.join('\n');
  return {
    route,
    lines: lines.length - (source.endsWith('\n') ? 1 : 0),
    words: source.split(/\s+/).filter(Boolean).length,
    codeBlocks: Object.values(languages).reduce((a, b) => a + b, 0),
    languages,
    genericFenceLines: genericFences,
    // These are search signals for editors, never a score of teaching quality.
    headingSignals: {
      prerequisites: /prerequisit|before you|start here|first pass/i.test(headingText),
      practice: /practice|exercise|challenge|lab|assessment|build.*break/i.test(headingText),
      tests: /test|verif|acceptance/i.test(headingText),
      failures: /fail|mistake|debug|incident|troubleshoot/i.test(headingText),
      completion: /done|completion|exit|checkpoint|gate/i.test(headingText),
    },
    externalLinks: (source.match(/https?:\/\/[^\s<>"')]+/g) || []).length,
  };
}

try {
  const config = JSON.parse(await readFile(path.join(docsRoot, 'docs.json'), 'utf8'));
  const errors = [];
  const filenames = (await walk(docsRoot)).filter(filename => filename.endsWith('.mdx'));
  const pages = await Promise.all(filenames.map(async filename => inspectPage(filename, await readFile(filename, 'utf8'), errors)));
  const routes = new Set(pages.map(page => page.route));
  const navigation = navigationPages(config.navigation);
  const seen = new Set();
  for (const route of navigation) {
    if (seen.has(route)) errors.push(`navigation: duplicate route ${route}`);
    if (!routes.has(route)) errors.push(`navigation: missing page ${route}`);
    seen.add(route);
  }
  for (const route of routes) {
    if (!seen.has(route) && !route.startsWith('snippets/')) errors.push(`navigation: orphan page ${route}`);
  }
  if (/https:\/\/github\.com\/?"/.test(JSON.stringify(config))) {
    errors.push('docs.json: replace or remove the placeholder GitHub homepage link');
  }
  const report = {
    summary: {
      pages: pages.length,
      lines: pages.reduce((n, p) => n + p.lines, 0),
      codeBlocks: pages.reduce((n, p) => n + p.codeBlocks, 0),
      genericFences: pages.reduce((n, p) => n + p.genericFenceLines.length, 0),
      navigationEntries: navigation.length,
      errors: errors.length,
    },
    limits: 'Static structure only. Heading signals and link counts do not establish correctness, readability, runnable code, external-link health, or mastery.',
    errors: errors.sort(),
    pages,
  };
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Content inventory: ${report.summary.pages} pages, ${report.summary.lines} lines, ${report.summary.codeBlocks} code blocks.`);
    console.log(`Structure: ${errors.length} errors; ${report.summary.navigationEntries} navigation entries.`);
    console.log(`Editorial follow-up: ${report.summary.genericFences} generic text fences (report only; inspect with npm run audit -- --json).`);
    for (const error of report.errors) console.error(`ERROR: ${error}`);
    console.log(report.limits);
  }
  if (errors.length) process.exitCode = 1;
} catch (error) {
  console.error(`Content audit failed: ${error.message}`);
  process.exitCode = 1;
}
