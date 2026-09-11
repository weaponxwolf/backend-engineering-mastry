package com.example.todo;

class TodoNotFoundException extends RuntimeException {
    TodoNotFoundException(Long id) {
        super("Todo " + id + " was not found");
    }
}
