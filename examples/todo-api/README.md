# Todo API: first running backend

Build one HTTP request all the way to a database. This is a local, single-user learning app. It binds to `127.0.0.1`, uses an in-memory H2 database, and loses all rows when the process stops. It has no login, ownership rules, or deployment setup.

## Run and test

Install JDK 21 and Maven 3.6.3 or newer. Maven downloads the pinned dependencies on the first run, so that run needs internet access. Run these commands from the repository root:

```bash
java -version
mvn -version
mvn -f examples/todo-api/pom.xml verify
mvn -f examples/todo-api/pom.xml spring-boot:run
```

The test command must end with `BUILD SUCCESS`. The server should log `Started TodoApplication` and listen on `http://localhost:8080`. Stop it with Ctrl+C. If port 8080 is occupied, pass `-Dspring-boot.run.arguments=--server.port=8081` to the run command and use that port below.

Spring Boot is pinned to **3.5.10**, an [official published release](https://spring.io/blog/2026/01/22/spring-boot-3-5-10-available-now/), to make the lesson repeatable. This pin is a tested teaching baseline, not a claim that it is the latest patch. Check supported versions and dependency advisories before deploying a derivative project.

## Make your first request

In a second terminal:

```bash
curl -i -X POST http://localhost:8080/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn HTTP","description":"Trace one request"}'
```

Expected: `201 Created`, `Location: /api/todos/1`, and a body with `id`, `title`, `description`, `completed: false`, and an ISO timestamp named `createdAt`. The ID is only `1` on a fresh database; use the returned Location for later requests.

```bash
curl -i http://localhost:8080/api/todos/1
curl -i 'http://localhost:8080/api/todos?page=0&size=20'
curl -i -X PUT http://localhost:8080/api/todos/1 \
  -H 'Content-Type: application/json' \
  -d '{"title":"Trace HTTP","description":"Explain each layer"}'
curl -i -X PATCH http://localhost:8080/api/todos/1/complete
curl -i -X DELETE http://localhost:8080/api/todos/1
curl -i http://localhost:8080/api/todos/1
```

Expected statuses in order: `200`, `200`, `200`, `200`, `204`, `404`. The list response has `items`, `page`, `size`, `totalElements`, and `totalPages`. Pages start at zero. The maximum size is 100 and page number is limited to 10000 for this exercise. Results are ordered by ID.

## Break it deliberately

```bash
curl -i -X POST http://localhost:8080/api/todos \
  -H 'Content-Type: application/json' -d '{"title":"   "}'
curl -i 'http://localhost:8080/api/todos?size=100000'
curl -i http://localhost:8080/api/todos/not-a-number
```

Each response should be `400` with `application/problem+json`. A validation response includes an `errors` object naming the bad field. Invalid writes must not change the database. A title is required and limited to 120 characters. Description is optional and limited to 2000 characters. PUT replaces the editable title and description; it does not clear completion.

## Read the source in this order

1. `TodoController`: converts HTTP inputs into calls and chooses response statuses.
2. `TodoRequest`: checks the input shape using Jakarta Validation.
3. `TodoService`: defines transaction boundaries and application operations.
4. `Todo`: stores state and exposes explicit update/complete operations.
5. `TodoRepository`: asks Spring Data JPA to read and write entities.
6. `db/migration/V1__create_todos.sql`: creates the schema through Flyway.
7. `ApiExceptionHandler`: returns structured errors, without stack traces.
8. `TodoApiTest`: drives HTTP handling, JPA, Flyway, and H2 together.

`ddl-auto: validate` makes Hibernate check the schema. It does not modify it. `open-in-view: false` closes database work at the service boundary. The response records keep JPA objects out of the HTTP contract.

The tests use real application wiring and committed writes; they do not mock the repository or service. They cover the request lifecycle, validation without writes, persisted updates, repeat completion, missing resources, malformed requests, and bounded pagination. MockMvc exercises Spring MVC without opening a network port. H2 results do not establish PostgreSQL SQL, locking, or migration compatibility.

## Prove that you learned it

- Draw the path of one POST request through the files above.
- Explain why create returns 201, delete returns 204, and a deleted ID returns 404.
- Remove `@Valid`, run tests, and explain the failing behavior; restore it.
- Add a `priority` field through a new V2 migration, entity, request, response, and tests. Do not edit a migration already applied to a persistent database.
- Write a test for listing an empty database before implementing a filtered list.
- Restart the server and explain why the rows disappear.

The next gate is PostgreSQL with Testcontainers, then authenticated ownership. Later add optimistic concurrency with a version/ETag contract. This starter does not protect stale edits or claim multi-user production readiness.
