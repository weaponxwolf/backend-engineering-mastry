package com.example.todo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:todo-tests;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
class TodoApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TodoRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void requestLifecyclePersistsChangesAndDeletesTheRow() throws Exception {
        String path = create("Learn HTTP");
        mvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Learn HTTP"))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.createdAt").isString());

        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Trace HTTP\",\"description\":\"Read the server log\"}"))
                .andExpect(status().isOk());
        mvc.perform(get(path))
                .andExpect(jsonPath("$.title").value("Trace HTTP"))
                .andExpect(jsonPath("$.description").value("Read the server log"));

        // Repeating this state-setting operation does not undo completion.
        for (int i = 0; i < 2; i++) {
            mvc.perform(patch(path + "/complete"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.completed").value(true));
        }
        mvc.perform(get(path)).andExpect(jsonPath("$.completed").value(true));
        mvc.perform(delete(path)).andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get(path)).andExpect(status().isNotFound());
        assertThat(repository.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejectsBlankTitlesWithoutInsertingRows(String title) throws Exception {
        mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new TodoRequest(title, ""))))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.title").isString());
        assertThat(repository.count()).isZero();
    }

    @Test
    void rejectsMissingTitleAndOversizedFields() throws Exception {
        for (TodoRequest request : new TodoRequest[]{
                new TodoRequest(null, ""), new TodoRequest("x".repeat(121), ""),
                new TodoRequest("Valid title", "x".repeat(2001))}) {
            mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        }
        assertThat(repository.count()).isZero();
    }

    @Test
    void invalidUpdateDoesNotChangeStoredData() throws Exception {
        String path = create("Keep this title");
        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path)).andExpect(jsonPath("$.title").value("Keep this title"));
    }

    @Test
    void returnsStructuredErrorsForMalformedJsonAndInvalidIds() throws Exception {
        mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));
        mvc.perform(get("/api/todos/not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void absentResourceReturns404ForEveryOperation() throws Exception {
        String path = "/api/todos/9223372036854775807";
        mvc.perform(get(path)).andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404));
        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"New\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch(path + "/complete")).andExpect(status().isNotFound());
        mvc.perform(delete(path)).andExpect(status().isNotFound());
    }

    @Test
    void paginationIsBoundedAndUsesStableIdOrder() throws Exception {
        create("First");
        create("Second");
        create("Third");
        mvc.perform(get("/api/todos").param("page", "0").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].title").value("First"))
                .andExpect(jsonPath("$.items[1].title").value("Second"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/todos").param("page", "1").param("size", "2"))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Third"));
        mvc.perform(get("/api/todos").param("page", "2").param("size", "2"))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "page=10001", "size=0", "size=101"})
    void rejectsUnboundedPageRequests(String query) throws Exception {
        mvc.perform(get("/api/todos?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    private String create(String title) throws Exception {
        return mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new TodoRequest(title, ""))))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.title").value(title))
                .andReturn().getResponse().getHeader("Location");
    }
}
