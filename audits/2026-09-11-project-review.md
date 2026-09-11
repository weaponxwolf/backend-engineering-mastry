# Project review — 11 September 2026

The strongest feature is breadth across Java, Spring, SQL, reliability, and system design. The biggest weakness was the gap between sophisticated prose and verified learning outcomes. Adding advanced chapters alone would widen that gap.

## Scope and method

Inventoried all 84 original MDX pages (31,878 lines), navigation, package scripts, CI, and guidance. Read the entry path and sampled high-risk capstones and explanations in detail. Checked selected claims against official Spring, PostgreSQL, Flyway, Kafka, Java, Stripe, and Mintlify references. This is a targeted correctness review, not verification of every embedded snippet.

The original tree had no checked-in Java source, Maven applications, pinned Mintlify dependency/lockfile, or pull-request verification workflow. Historical AGENTS.md completion claims were not application-test evidence.

## Findings and implementation

| Priority | Original evidence | Consequence | Implemented response |
| --- | --- | --- | --- |
| Critical | security-jwt: revocation then unchecked exception inside transaction | Revocation rolls back | Family-row serialization and committed rejection outcome |
| Critical | spring-security-production: supplied author ID authorizes deletion | Another user's resource can be targeted | Stored owner-scoped mutation, correct JWT principal, separate cookie/bearer chains |
| Critical | message-queues: acknowledgment before database commit | Work can be lost | Explicit commit before acknowledgment, deduplication, accurate retry semantics |
| Critical | ecommerce-full-build: hardcoded order/event and wrong Stripe signature comparison | Cannot safely settle payment | Remove unsafe handler; official SDK verification boundary and explicit processing requirements |
| High | Checkout catches uniqueness error then queries failed transaction | Invalid recovery; global replay lookup leaks data | Remove replay lookup, scope uniqueness by user, let rollback happen; document missing full replay |
| High | Roadmap requires internals before first program | Unexplained prerequisites block beginners | First-program guide, revised path, two-pass reading, seven assessment gates |
| High | Full-build labels with no applications in source control | MDX validation mistaken for working backends | Java and Todo projects; explicit limits on other walkthroughs |
| High | Migration chapters use -- flyway:transactional=false | SQL comment does not configure Flyway | Actual .sql.conf settings and lock discussion |
| High | Keyset/quorum/cache guarantees lack conditions | Incorrect transfer to real design | Matching index/cost, overlap limitations, stale-refill explanation |
| Medium | Unpinned npx tooling, push-only checks | Different tooling per checkout; late feedback | Mintlify 4.2.885 lockfile, npm ci, PR docs/example checks |
| Medium | Java record/boxing/preview assumptions | Incorrect mental models and compilation surprises | Shallow immutability, benchmark requirements, version notes |
| Medium | Exit 137 and GC/container guarantees | Diagnosis assumes causes without evidence | Termination-reason checks and qualified memory/latency claims |

Corrected chapters cite primary references near the explanations. The [curriculum audit](../docs/getting-started/curriculum-audit.mdx) summarizes status for learners.

## New evidence

- Java foundations compiles on Java 21 and passes 12 checks for totals, invalid inputs, and overflow without external dependencies.
- Todo pins Boot 3.5.10, supplies all source/configuration, a Flyway schema, DTOs, bounded pagination, Problem Details, and 12 passing MVC/JPA/H2 test cases. It has local temporary storage and no authentication.
- The content audit checks metadata, navigation coverage/duplicates, and fence structure. Four regression tests include invalid fixtures. Heading signals and legacy generic fences are editorial observations, not a quality score.

## Remaining work and completion criteria

| Work | Completion criterion |
| --- | --- |
| PostgreSQL Todo | Fresh migrations validate; restart preserves writes; rollback/concurrency tests and restore drill pass |
| Authenticated Notes | Complete auth wiring; two-user matrix; real bad-token tests; refresh replay/race tests against PostgreSQL |
| Advanced capstones | All source and dependencies; startup/cleanup commands; deterministic failure fixtures; CI results |
| Example drift | Canonical source and a maintained mapping to documentation contracts |
| Beginner usability | A novice completes setup and Todo using only instructions; observed failures drive edits |
| Operations | Repeatable backup/restore, migration, load, and outage labs with expected observations |
| Version maintenance | Distinguish historical teaching versions from supported deployment choices; regularly review dependencies |

Make the main path independently reproducible before adding another architecture topic. Connect advanced references to measured problems in running services.

## Tooling dependency audit

Mintlify 4.2.885 plus compatible npm audit fixes still reported **17 findings: 14 high and 3 moderate**, including transitive YAML, archive, image, and browser tooling. These are development-tool dependencies. Exploitability in this site was not established; findings are not resolved. The proposed forced fix would downgrade Mintlify incompatibly, so it was not applied blindly. Track upstream fixes and validate deliberate updates.

## Verification boundaries

Final command results are recorded in AGENTS.md. npm run check covers audit tests, structure, MDX, and internal links/anchors. Application tests are separate. External-link health, all advanced excerpts, deployed GitHub Pages behavior, and real payment-provider integration are not certified by these checks.

An internal review cannot establish “best in the world.” A defensible quality bar is repeatable builds, correct explanations, independent learner success, and maintained evidence.
