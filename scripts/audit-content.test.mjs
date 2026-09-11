import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./audit-content.mjs', import.meta.url));
const page = '---\ntitle: "Fixture"\ndescription: "A fixture"\n---\n\n## Test it\n\n```java\n// ## This is not a heading\n```\n';

async function fixture(t, navigation, pages) {
  const directory = await mkdtemp(path.join(tmpdir(), 'docs-audit-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'docs.json'), JSON.stringify({ navigation }));
  for (const [name, source] of Object.entries(pages)) await writeFile(path.join(directory, `${name}.mdx`), source);
  const result = spawnSync(process.execPath, [script, '--root', directory, '--json'], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.ok(result.stdout, result.stderr || 'Audit produced no report');
  return { status: result.status, report: JSON.parse(result.stdout) };
}

test('nested navigation resolves pages; code headings do not count as prose', async t => {
  const { status, report } = await fixture(t, { tabs: [{ groups: [{ pages: ['index', { group: 'Later', pages: ['later'] }] }] }] }, { index: page, later: page });
  assert.equal(status, 0);
  assert.equal(report.summary.pages, 2);
  assert.equal(report.pages[0].codeBlocks, 1);
  assert.equal(report.pages[0].headingSignals.tests, true);
  assert.equal(report.pages[0].headingSignals.completion, false);
});

test('missing, duplicate and orphan routes fail a build together', async t => {
  const { status, report } = await fixture(t, { pages: ['missing', 'missing'] }, { index: page });
  assert.equal(status, 1);
  assert.ok(report.errors.some(error => error.includes('missing page missing')));
  assert.ok(report.errors.some(error => error.includes('duplicate route missing')));
  assert.ok(report.errors.some(error => error.includes('orphan page index')));
});

test('missing metadata and unfinished code fences fail with page context', async t => {
  const { status, report } = await fixture(t, { pages: ['index'] }, { index: '## Broken\n```java\nclass Broken {}\n' });
  assert.equal(status, 1);
  assert.ok(report.errors.includes('index: missing YAML frontmatter'));
  assert.ok(report.errors.includes('index:2: unclosed code fence'));
});

test('unlabeled fences fail, but legacy text fences remain visible observations', async t => {
  const { status, report } = await fixture(t, { pages: ['index'] }, { index: page + '\n```text\na tree\n```\n\n```\nunknown\n```\n' });
  assert.equal(status, 1);
  assert.equal(report.summary.genericFences, 1);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /code fence needs a language/);
});
