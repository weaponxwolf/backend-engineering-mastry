package com.example.todo;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
class TodoService {
    private final TodoRepository repository;

    TodoService(TodoRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public TodoResponse create(TodoRequest request) {
        return repository.save(new Todo(request.title(), request.description())).toResponse();
    }

    public TodoResponse get(Long id) {
        return requireTodo(id).toResponse();
    }

    public TodoPage list(int page, int size) {
        if (page < 0 || page > 10000 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be between 0 and 10000; size must be between 1 and 100");
        }
        var result = repository.findAll(PageRequest.of(page, size, Sort.by("id")));
        return new TodoPage(result.getContent().stream().map(Todo::toResponse).toList(),
                page, size, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public TodoResponse update(Long id, TodoRequest request) {
        Todo todo = requireTodo(id);
        todo.update(request.title(), request.description());
        // Hibernate writes changes to this managed entity when the transaction commits.
        return todo.toResponse();
    }

    @Transactional
    public TodoResponse complete(Long id) {
        Todo todo = requireTodo(id);
        todo.complete();
        return todo.toResponse();
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(requireTodo(id));
    }

    private Todo requireTodo(Long id) {
        return repository.findById(id).orElseThrow(() -> new TodoNotFoundException(id));
    }
}
