#include "server_internal.h"

void dispatchRequest(SOCKET client, char *request, int reqLen) {
    (void)reqLen;

    /* Read the request type and page name from the first line. */
    char method[16] = {0};
    char path[256]  = {0};
    if (sscanf(request, "%15s %255s", method, path) != 2) {
        /* If the request is not readable, send an error. */
        send400(client, "Malformed request");
        return;
    }

    /* Let the browser check if it is allowed to send a request. */
    if (strcmp(method, "OPTIONS") == 0) {
        send204(client);
        return;
    }

    /* Print the request in the backend window for checking. */
    printf("[server] %s %s\n", method, path);

    /* Find the form data sent by the frontend. */
    const char *body = strstr(request, "\r\n\r\n");
    /* If there is no form data, use an empty value. */
    body = body ? body + 4 : "";

    /* â”€â”€ Route table â”€â”€ */

    /* Check if the backend is running. */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/health") == 0) {
        handleHealth(client); return;
    }

    /* Export or import all saved app data. */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/backup") == 0) {
        handleGetBackup(client); return;
    }
    if (strcmp(method, "POST") == 0 && strcmp(path, "/backup") == 0) {
        handlePostBackup(client, body); return;
    }

    /* Send all subjects to the frontend. */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/subjects") == 0) {
        handleGetSubjects(client); return;
    }

    /* Save one new subject score. */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/subjects/score") == 0) {
        handlePostScore(client, body); return;
    }

    /* Save the grading rules and scores for a subject. */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/subjects/criteria") == 0) {
        handlePostCriteria(client, body); return;
    }

    /* Save subject notes, schedule, or absences. */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/subjects/meta") == 0) {
        handlePostSubjectMeta(client, body); return;
    }

    /* POST /subjects/studyhours  body: {name, hours} â€” adds hours to existing total */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/subjects/studyhours") == 0) {
        handlePostStudyHours(client, body); return;
    }

    /* Save a new subject. */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/subjects") == 0) {
        handlePostSubject(client, body); return;
    }

    /* Delete a subject by name. */
    if (strcmp(method, "DELETE") == 0 && strncmp(path, "/subjects/", 10) == 0) {
        handleDeleteSubject(client, path); return;
    }

    /* Send all tasks to the frontend. */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/tasks") == 0) {
        handleGetTasks(client); return;
    }

    /* Save a new task. */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/tasks") == 0) {
        handlePostTask(client, body); return;
    }

    /* Change only the status of one task. */
    if (strcmp(method, "PUT") == 0 && strncmp(path, "/tasks/", 7) == 0
        && strstr(path, "/status") != NULL) {
        handlePutTaskStatus(client, path, body); return;
    }

    /* Edit the full details of one task. */
    if (strcmp(method, "PUT") == 0 && strncmp(path, "/tasks/", 7) == 0) {
        handlePutTask(client, path, body); return;
    }

    /* Delete one task. */
    if (strcmp(method, "DELETE") == 0 && strncmp(path, "/tasks/", 7) == 0) {
        handleDeleteTask(client, path); return;
    }

    /* Send the analytics page data. */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/analytics") == 0) {
        handleGetAnalytics(client); return;
    }

    /* If nothing matched, tell the frontend the request was not found. */
    send404(client);
}



