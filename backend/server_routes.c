#include "server_internal.h"

void handleGetSubjects(SOCKET client) {
    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "Out of memory"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) { free(buf); send400(client, "Response too large"); return; }
    send200(client, buf);
    free(buf);
}

/* POST /subjects  body: {"name":"Maths","notes":"...","units":3} */
void handlePostSubject(SOCKET client, const char *body) {
    if (*g_subjectCount >= MAX_SUBJECTS) {
        send400(client, "Subject list full"); return;
    }
    char name[MAX_NAME] = {0};
    char notes[MAX_NOTES] = {0};
    float units = 3.0f;

    if (!jsonGetStr(body, "name", name, MAX_NAME) || name[0] == '\0') {
        send400(client, "Missing name"); return;
    }
    jsonGetStr(body, "notes", notes, MAX_NOTES);
    jsonGetFloat(body, "units", &units);

    if (findSubjectIndex(g_subjects, *g_subjectCount, name) != -1) {
        send400(client, "Subject already exists"); return;
    }

    Subject *s = &g_subjects[(*g_subjectCount)++];
    initSubject(s, name);
    strncpy(s->notes, notes, MAX_NOTES - 1);
    s->units = units > 0.0f ? units : 3.0f;

    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) { free(buf); send400(client, "Response too large"); return; }
    send201(client, buf);
    free(buf);
}

/* POST /subjects/score  body: {"name":"Maths","score":87.5} */
void handlePostScore(SOCKET client, const char *body) {
    char name[MAX_NAME] = {0};
    float score = 0.0f;

    if (!jsonGetStr(body, "name", name, MAX_NAME))   { send400(client, "Missing name");  return; }
    if (!jsonGetFloat(body, "score", &score))         { send400(client, "Missing score"); return; }
    if (score < 0.0f || score > 100.0f)               { send400(client, "Score out of range"); return; }

    int idx = findSubjectIndex(g_subjects, *g_subjectCount, name);
    if (idx == -1) { send400(client, "Subject not found"); return; }

    addScoreToSubject(&g_subjects[idx], score);
    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) { free(buf); send400(client, "Response too large"); return; }
    send200(client, buf);
    free(buf);
}

/*
 * POST /subjects/criteria
 * body: {name, components:[{name, weight, scores:[{score,maxScore}]}],
 *        studyHours, studyFrequency, goal}
 * studyHours is the target. Timer hours are saved separately.
 */
void handlePostCriteria(SOCKET client, const char *body) {
    char name[MAX_NAME] = {0};
    if (!jsonGetStr(body, "name", name, MAX_NAME)) { send400(client, "Missing name"); return; }

    int idx = findSubjectIndex(g_subjects, *g_subjectCount, name);
    if (idx == -1) { send400(client, "Subject not found"); return; }

    Subject *s = &g_subjects[idx];
    Subject before = *s;
    float f = 0; int iv = 0;

    if (!jsonGetComponents(body, s)) {
        if (jsonGetFloat(body, "quizWeight",       &f)) s->componentWeights[0] = f;
        if (jsonGetFloat(body, "examWeight",       &f)) s->componentWeights[1] = f;
        if (jsonGetFloat(body, "assignmentWeight", &f)) s->componentWeights[2] = f;
        if (jsonGetFloat(body, "quizScore",        &f)) s->componentScores[0]  = f;
        if (jsonGetFloat(body, "examScore",        &f)) s->componentScores[1]  = f;
        if (jsonGetFloat(body, "assignmentScore",  &f)) s->componentScores[2]  = f;
        if (s->componentCount <= 0) {
            s->componentCount = 3;
            strncpy(s->componentNames[0], "Quiz", MAX_COMPONENT_NAME - 1);
            strncpy(s->componentNames[1], "Exam", MAX_COMPONENT_NAME - 1);
            strncpy(s->componentNames[2], "Assignment", MAX_COMPONENT_NAME - 1);
        }
    }
    if (subjectHasInvalidScores(s)) {
        *s = before;
        send400(client, "Score must be between 0 and maxScore");
        return;
    }
    if (jsonGetFloat(body, "studyHours",       &f)) s->studyHours       = f;
    if (jsonGetInt  (body, "studyFrequency",   &iv)) s->studyFrequency  = iv;
    if (jsonGetFloat(body, "goal",             &f)) s->goal             = f;
    if (jsonGetFloat(body, "units",            &f)) s->units            = f > 0.0f ? f : s->units;

    computeWeightedGrade(s);
    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) { free(buf); send400(client, "Response too large"); return; }
    send200(client, buf);
    free(buf);
}

/* POST /subjects/meta body: {name, notes, scheduleDay, scheduleLocation,
   scheduleStartHour, scheduleStartMinute, scheduleEndHour, scheduleEndMinute, absences} */
void handlePostSubjectMeta(SOCKET client, const char *body) {
    char name[MAX_NAME] = {0};
    if (!jsonGetStr(body, "name", name, MAX_NAME)) { send400(client, "Missing name"); return; }

    int idx = findSubjectIndex(g_subjects, *g_subjectCount, name);
    if (idx == -1) { send400(client, "Subject not found"); return; }

    Subject *s = &g_subjects[idx];
    char text[MAX_NOTES] = {0};
    char small[MAX_NAME] = {0};
    int iv = 0;

    if (jsonGetStr(body, "notes", text, MAX_NOTES)) {
        strncpy(s->notes, text, MAX_NOTES - 1);
    }
    if (jsonGetStr(body, "scheduleDay", small, sizeof(small))) {
        strncpy(s->scheduleDay, small, sizeof(s->scheduleDay) - 1);
    }
    if (jsonGetStr(body, "scheduleLocation", small, sizeof(small))) {
        strncpy(s->scheduleLocation, small, MAX_NAME - 1);
    }
    if (jsonGetInt(body, "scheduleStartHour", &iv)) s->scheduleStartHour = iv;
    if (jsonGetInt(body, "scheduleStartMinute", &iv)) s->scheduleStartMinute = iv;
    if (jsonGetInt(body, "scheduleEndHour", &iv)) s->scheduleEndHour = iv;
    if (jsonGetInt(body, "scheduleEndMinute", &iv)) s->scheduleEndMinute = iv;
    if (jsonGetInt(body, "absences", &iv)) {
        if (iv < 0) iv = 0;
        if (iv > MAX_ABSENCES) iv = MAX_ABSENCES;
        s->absences = iv;
    }

    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) { free(buf); send400(client, "Response too large"); return; }
    send200(client, buf);
    free(buf);
}

/* DELETE /subjects/{name} */
void handleDeleteSubject(SOCKET client, const char *path) {
    const char *rawName = path + strlen("/subjects/");
    char name[MAX_NAME] = {0};
    urlDecodePath(rawName, name, MAX_NAME);

    int idx = findSubjectIndex(g_subjects, *g_subjectCount, name);
    if (idx == -1) { send404(client); return; }

    for (int i = idx; i < *g_subjectCount - 1; i++) {
        g_subjects[i] = g_subjects[i + 1];
    }
    (*g_subjectCount)--;

    int writeIndex = 0;
    for (int i = 0; i < *g_taskCount; i++) {
        if (strcmp(g_tasks[i].subjectName, name) != 0) {
            g_tasks[writeIndex++] = g_tasks[i];
        }
    }
    *g_taskCount = writeIndex;

    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) { free(buf); send400(client, "Response too large"); return; }
    send200(client, buf);
    free(buf);
}

/* GET /tasks */
void handleGetTasks(SOCKET client) {
    sortTasksByDeadline(g_tasks, *g_taskCount);
    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    allTasksToJSON(g_tasks, *g_taskCount, buf, SEND_BUF);
    send200(client, buf);
    free(buf);
}

/* POST /tasks  body: {subjectName, description, type, status, link,
                       year, month, day, hour, minute} */
void handlePostTask(SOCKET client, const char *body) {
    if (*g_taskCount >= MAX_TASKS) { send400(client, "Task list full"); return; }

    Task *t = &g_tasks[*g_taskCount];
    initTask(t);
    t->id = g_nextTaskId++;

    jsonGetStr  (body, "subjectName", t->subjectName, MAX_NAME);
    jsonGetStr  (body, "description", t->description, MAX_DESC);
    jsonGetStr  (body, "type",        t->type,        20);
    jsonGetStr  (body, "status",      t->status,      20);
    jsonGetStr  (body, "link",        t->link,        MAX_LINK);
    jsonGetInt  (body, "year",        &t->year);
    jsonGetInt  (body, "month",       &t->month);
    jsonGetInt  (body, "day",         &t->day);
    jsonGetInt  (body, "hour",        &t->hour);
    jsonGetInt  (body, "minute",      &t->minute);

    if (t->description[0] == '\0') { send400(client, "Missing description"); return; }

    /* Basic date/time range checks (#10) */
    if (t->month != 0 && (t->month < 1 || t->month > 12)) { send400(client, "Invalid month"); return; }
    if (t->day   != 0 && (t->day   < 1 || t->day   > 31)) { send400(client, "Invalid day");   return; }
    if (t->hour  != 0 && (t->hour  < 0 || t->hour  > 23)) { send400(client, "Invalid hour");  return; }
    if (t->minute != 0 && (t->minute < 0 || t->minute > 59)) { send400(client, "Invalid minute"); return; }

    (*g_taskCount)++;
    sortTasksByDeadline(g_tasks, *g_taskCount);
    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    allTasksToJSON(g_tasks, *g_taskCount, buf, SEND_BUF);
    send201(client, buf);
    free(buf);
}

/* PUT /tasks/{id}/status  body: {"status":"Done"} */
void handlePutTaskStatus(SOCKET client, const char *path, const char *body) {
    /* Extract ID from path: /tasks/{id}/status */
    int id = 0;
    if (sscanf(path, "/tasks/%d/status", &id) != 1) {
        send400(client, "Invalid task id"); return;
    }
    char newStatus[20] = {0};
    if (!jsonGetStr(body, "status", newStatus, 20)) {
        send400(client, "Missing status"); return;
    }

    int found = 0;
    for (int i = 0; i < *g_taskCount; i++) {
        if (g_tasks[i].id == id) {
            strncpy(g_tasks[i].status, newStatus, 19);
            found = 1;
            break;
        }
    }
    if (!found) { send404(client); return; }

    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    allTasksToJSON(g_tasks, *g_taskCount, buf, SEND_BUF);
    send200(client, buf);
    free(buf);
}

/* PUT /tasks/{id} body: full editable task payload */
void handlePutTask(SOCKET client, const char *path, const char *body) {
    int id = 0;
    if (sscanf(path, "/tasks/%d", &id) != 1) {
        send400(client, "Invalid task id"); return;
    }

    Task *task = NULL;
    for (int i = 0; i < *g_taskCount; i++) {
        if (g_tasks[i].id == id) {
            task = &g_tasks[i];
            break;
        }
    }
    if (!task) { send404(client); return; }

    char text[MAX_DESC] = {0};
    int iv = 0;

    if (jsonGetStr(body, "subjectName", text, MAX_NAME)) {
        strncpy(task->subjectName, text, MAX_NAME - 1);
    }
    if (jsonGetStr(body, "description", text, MAX_DESC)) {
        if (text[0] == '\0') { send400(client, "Missing description"); return; }
        strncpy(task->description, text, MAX_DESC - 1);
    }
    if (jsonGetStr(body, "type", text, 20)) {
        strncpy(task->type, text, 19);
    }
    if (jsonGetStr(body, "status", text, 20)) {
        strncpy(task->status, text, 19);
    }
    if (jsonGetStr(body, "link", text, MAX_LINK)) {
        strncpy(task->link, text, MAX_LINK - 1);
    }
    if (jsonGetInt(body, "year", &iv)) task->year = iv;
    if (jsonGetInt(body, "month", &iv)) task->month = iv;
    if (jsonGetInt(body, "day", &iv)) task->day = iv;
    if (jsonGetInt(body, "hour", &iv)) task->hour = iv;
    if (jsonGetInt(body, "minute", &iv)) task->minute = iv;

    sortTasksByDeadline(g_tasks, *g_taskCount);
    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    allTasksToJSON(g_tasks, *g_taskCount, buf, SEND_BUF);
    send200(client, buf);
    free(buf);
}

/* DELETE /tasks/{id} */
void handleDeleteTask(SOCKET client, const char *path) {
    int id = 0;
    if (sscanf(path, "/tasks/%d", &id) != 1) {
        send400(client, "Invalid task id"); return;
    }
    int idx = -1;
    for (int i = 0; i < *g_taskCount; i++) {
        if (g_tasks[i].id == id) { idx = i; break; }
    }
    if (idx == -1) { send404(client); return; }

    /* Shift array left */
    for (int i = idx; i < *g_taskCount - 1; i++) {
        g_tasks[i] = g_tasks[i + 1];
    }
    (*g_taskCount)--;

    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    allTasksToJSON(g_tasks, *g_taskCount, buf, SEND_BUF);
    send200(client, buf);
    free(buf);
}

/* POST /subjects/studyhours  body: {name, hours}
   Adds timer hours to trackedStudyHours.
   Returns the updated subjects array so the frontend stays in sync. */
void handlePostStudyHours(SOCKET client, const char *body) {
    char name[MAX_NAME] = {0};
    float hours = 0.0f;

    if (!jsonGetStr(body, "name", name, MAX_NAME)) { send400(client, "Missing name"); return; }
    if (!jsonGetFloat(body, "hours", &hours))       { send400(client, "Missing hours"); return; }
    if (hours <= 0.0f)                              { send400(client, "hours must be positive"); return; }

    int idx = findSubjectIndex(g_subjects, *g_subjectCount, name);
    if (idx == -1) { send400(client, "Subject not found"); return; }

    /* Add timer hours to actual studied time, not to the target hours. */
    g_subjects[idx].trackedStudyHours += hours;

    saveData(g_subjects, *g_subjectCount, g_tasks, *g_taskCount);

    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    if (allSubjectsToJSON(g_subjects, *g_subjectCount, buf, SEND_BUF) < 0) {
        free(buf); send400(client, "Response too large"); return;
    }
    send200(client, buf);
    free(buf);
}

/* GET /backup
   Returns a full portable JSON backup of subjects and tasks. */
void handleGetBackup(SOCKET client) {
    char *subjectJson = (char *)malloc(SEND_BUF);
    char *taskJson = (char *)malloc(SEND_BUF);
    char *buf = (char *)malloc(SEND_BUF);
    if (!subjectJson || !taskJson || !buf) {
        free(subjectJson); free(taskJson); free(buf);
        send400(client, "OOM");
        return;
    }

    if (allSubjectsToJSON(g_subjects, *g_subjectCount, subjectJson, SEND_BUF) < 0 ||
        allTasksToJSON(g_tasks, *g_taskCount, taskJson, SEND_BUF) < 0) {
        free(subjectJson); free(taskJson); free(buf);
        send400(client, "Response too large");
        return;
    }

    snprintf(buf, SEND_BUF,
             "{\"app\":\"Academic Tracker\",\"version\":1,\"subjects\":%s,\"tasks\":%s}",
             subjectJson, taskJson);
    send200(client, buf);
    free(subjectJson);
    free(taskJson);
    free(buf);
}

/* POST /backup
   Replaces novi_data.json with an exported backup, then reloads memory. */
void handlePostBackup(SOCKET client, const char *body) {
    if (!body || body[0] == '\0') {
        send400(client, "Missing backup data");
        return;
    }
    if (!strstr(body, "\"subjects\"") || !strstr(body, "\"tasks\"")) {
        send400(client, "Backup must include subjects and tasks");
        return;
    }

    FILE *fp = fopen(DATA_FILE, "wb");
    if (!fp) {
        send400(client, "Unable to write backup file");
        return;
    }
    fwrite(body, 1, strlen(body), fp);
    fclose(fp);

    loadData(g_subjects, g_subjectCount, g_tasks, g_taskCount);
    refreshNextTaskId();

    handleGetBackup(client);
}

/* GET /analytics */
void handleGetAnalytics(SOCKET client) {
    SubjectAnalytics results[MAX_SUBJECTS];
    for (int i = 0; i < *g_subjectCount; i++) {
        results[i] = analyseSubject(&g_subjects[i]);
    }
    char *buf = (char *)malloc(SEND_BUF);
    if (!buf) { send400(client, "OOM"); return; }
    analyticsToJSON(results, *g_subjectCount,
                    g_tasks,  *g_taskCount,
                    buf, SEND_BUF);
    send200(client, buf);
    free(buf);
}

/* GET /health */
void handleHealth(SOCKET client) {
    sendResponse(client, 200, "OK", "text/plain", "Academic Tracker backend running on port 8080");
}



