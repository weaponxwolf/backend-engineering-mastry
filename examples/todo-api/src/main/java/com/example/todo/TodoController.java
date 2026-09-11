package com.example.todo;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
public class TodoController {
    private final TodoService service;

    TodoController(TodoService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TodoResponse> create(@Valid @RequestBody TodoRequest request) {
        TodoResponse todo = service.create(request);
        return ResponseEntity.created(URI.create("/api/todos/" + todo.id())).body(todo);
    }

    @GetMapping("/{id}")
    TodoResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping
    TodoPage list(@RequestParam(defaultValue = "0") int page,
                  @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @PutMapping("/{id}")
    TodoResponse update(@PathVariable Long id, @Valid @RequestBody TodoRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/complete")
    TodoResponse complete(@PathVariable Long id) {
        return service.complete(id);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
