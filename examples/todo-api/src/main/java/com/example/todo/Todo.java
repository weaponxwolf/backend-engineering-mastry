package com.example.todo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "todos")
class Todo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Todo() {
        // JPA creates entities through this constructor.
    }

    Todo(String title, String description) {
        update(title, description);
        createdAt = Instant.now();
    }

    void update(String title, String description) {
        if (title == null || title.isBlank() || title.length() > 120) {
            throw new IllegalArgumentException("Title must contain 1 to 120 characters");
        }
        if (description != null && description.length() > 2000) {
            throw new IllegalArgumentException("Description cannot exceed 2000 characters");
        }
        this.title = title.strip();
        this.description = description == null ? "" : description;
    }

    void complete() {
        completed = true;
    }

    TodoResponse toResponse() {
        return new TodoResponse(id, title, description, completed, createdAt);
    }
}
