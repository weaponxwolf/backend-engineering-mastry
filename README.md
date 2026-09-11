# Backend Mastery

A comprehensive backend engineering course and documentation platform with Java 21, Spring Boot, databases, distributed systems, and production engineering.

Start with [Your First Program](docs/getting-started/first-program.mdx), follow the [roadmap](docs/getting-started/backend-roadmap.mdx), and use the [assessments](docs/getting-started/mastery-assessments.mdx) to test independent skill.

## Run the examples

From the repository root, with JDK 21:

```bash
bash examples/java-foundations/run.sh
```

Expected: an order total and `PASS: 12 checks`. No dependencies or network are needed.

For the Spring starter, also install Maven 3.6.3 or newer:

```bash
mvn -f examples/todo-api/pom.xml verify
mvn -f examples/todo-api/pom.xml spring-boot:run
```

The first command runs 12 test cases and packages the app. The second starts it on localhost:8080. See the [Todo README](examples/todo-api/README.md) for requests, responses, and exercises. It uses temporary H2 storage and has no authentication.

## Run the documentation

Use Node.js 22, the CI baseline, and npm:

```bash
npm ci
npm run dev
```

This starts Mintlify from `docs/`; it does not start a backend application.

```bash
npm run check
npm run test:examples
```

The first command checks audit behavior, page metadata/navigation, MDX, and internal links including anchors. The second runs Java and Todo tests and requires Java/Maven. Pull requests run both checks in separate jobs.

For an editorial inventory or an external-link check:

```bash
npm run audit -- --json
npm run links:external
```

Legacy generic text fences are reported for review. External-link checks need network access and can report temporary failures.

## Deploying to Vercel

The documentation is configured for hosting on [Vercel](https://vercel.com).
- **Build command**: `node scripts/build-vercel.mjs` (or `npm run build`)
- **Output directory**: `out`
- **Routing**: Clean URLs enabled, root domain hosting without subpath issues.

To deploy:
1. Import `weaponxwolf/backend-engineering-mastry` in [Vercel](https://vercel.com/new).
2. Vercel automatically detects `vercel.json` and builds via `npm run build`.
3. Or deploy via CLI: `npx vercel login` followed by `npx vercel --prod`.

## Verification and maintenance

Read [Versions and Verification](docs/getting-started/versions-and-evidence.mdx) before mixing examples. Older full-build chapters remain walkthroughs with missing integration work; a documentation build does not compile their Java snippets.

The [project review](audits/2026-09-11-project-review.md) records findings, improvements, and remaining work. The [curriculum audit](docs/getting-started/curriculum-audit.mdx) is the learner-facing status page.

Use the [Book Replacement Standard](docs/getting-started/book-standard.mdx) and [Simple English Rule](docs/getting-started/simple-english-rule.mdx) when editing. Pin versions, cite primary sources, and support stronger claims with runnable evidence.
