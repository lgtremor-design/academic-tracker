/*
 * main.c
 * ------
 * Entry point for the Academic Tracker backend.
 * Loads persisted data, then starts the blocking HTTP server.
 */

#include <stdio.h>
#include <stdlib.h>
#include "config.h"
#include "subject.h"
#include "task.h"
#include "event.h"
#include "fileio.h"
#include "server.h"

int main(void) {
    /* ── Allocate global arrays on the heap ── */
    Subject *subjects = (Subject *)calloc(MAX_SUBJECTS, sizeof(Subject));
    Task    *tasks    = (Task    *)calloc(MAX_TASKS,    sizeof(Task));
    CalendarEvent *events = (CalendarEvent *)calloc(MAX_EVENTS, sizeof(CalendarEvent));

    if (!subjects || !tasks || !events) {
        fprintf(stderr, "Fatal: out of memory\n");
        return 1;
    }

    int subjectCount = 0;
    int taskCount    = 0;
    int eventCount   = 0;

    /* Load persisted academic tracker data. */
    loadData(subjects, &subjectCount, tasks, &taskCount, events, &eventCount);

    /* ── Start blocking HTTP server ── */
    runServer(subjects, &subjectCount, tasks, &taskCount, events, &eventCount);

    free(subjects);
    free(tasks);
    free(events);
    return 0;
}
