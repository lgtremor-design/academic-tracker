/*
 * server.h
 * --------
 * Minimal single-threaded HTTP/1.1 server.
 * Exposes the REST API consumed by the frontend.
 *
 * Endpoints
 * ---------
 *  GET  /subjects              → JSON array of all subjects
 *  POST /subjects              → create subject, return updated array
 *  POST /subjects/score        → add score to a subject
 *  POST /subjects/studyhours   → add study hours to a subject {name, hours}
 *  GET  /tasks                 → JSON array of all tasks (sorted)
 *  POST /tasks                 → create task, return updated array
 *  PUT  /tasks/{id}/status     → update task status
 *  DELETE /tasks/{id}          → remove a task
 *  GET  /analytics             → grade analytics JSON
 *  GET  /                      → redirect to frontend (informational)
 */

#ifndef SERVER_H
#define SERVER_H

#include "subject.h"
#include "task.h"
#include "event.h"

/* ── Start blocking server loop ── */
void runServer(Subject subjects[], int *subjectCount,
               Task    tasks[],   int *taskCount,
               CalendarEvent events[], int *eventCount);

#endif /* SERVER_H */
