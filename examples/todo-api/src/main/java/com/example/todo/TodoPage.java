package com.example.todo;

import java.util.List;

public record TodoPage(List<TodoResponse> items, int page, int size,
                       long totalElements, int totalPages) {
}
