/*
 * fileio.h
 * --------
 * Declares the two functions that handle all disk I/O for the application.
 * All subject and task data is persisted as human-readable JSON so that
 * the frontend (JavaScript) can also read the same file directly.
 *
 * The actual file path is set by DATA_FILE in config.h.
 */

#ifndef FILEIO_H   /* Include guard — prevents double-inclusion in the same build unit. */
#define FILEIO_H

#include "subject.h"   /* Subject struct and MAX_* constants needed by saveData/loadData. */
#include "task.h"      /* Task struct needed by saveData/loadData.                        */
#include "event.h"     /* CalendarEvent struct needed by saveData/loadData.              */

/* ── Function prototypes ────────────────────────────────────────────────── */

/*
 * saveData()
 * ----------
 * Serialises the in-memory subject and task arrays to DATA_FILE as JSON.
 * Called whenever the backend modifies any subject or task so that data
 * survives a server restart.
 *
 * Parameters:
 *   subjects      — array of Subject structs to write.
 *   subjectCount  — number of valid entries in subjects[].
 *   tasks         — array of Task structs to write.
 *   taskCount     — number of valid entries in tasks[].
 */
void saveData(Subject subjects[], int subjectCount,
              Task    tasks[],   int taskCount,
              CalendarEvent events[], int eventCount);

/*
 * loadData()
 * ----------
 * Reads DATA_FILE and populates the in-memory subject and task arrays.
 * Called once at server start-up.  If the file is absent, arrays remain
 * empty and the server starts fresh.
 *
 * Parameters:
 *   subjects      — output array to fill with loaded Subject data.
 *   subjectCount  — output; set to the number of subjects loaded.
 *   tasks         — output array to fill with loaded Task data.
 *   taskCount     — output; set to the number of tasks loaded.
 */
void loadData(Subject subjects[], int *subjectCount,
              Task    tasks[],   int *taskCount,
              CalendarEvent events[], int *eventCount);

#endif /* FILEIO_H */
