/*
 * task.h
 * ------
 * Defines the Task data structure and declares all Task-related
 * functions used across the backend (fileio, server).
 *
 * A Task represents a homework, project, or exam deadline linked to
 * a specific subject.  Tasks are sorted by deadline and labelled with
 * a priority (URGENT / HIGH / MEDIUM / LOW) based on days remaining.
 */

#ifndef TASK_H   /* Include guard — prevents duplicate declarations. */
#define TASK_H

#include "config.h"   /* MAX_NAME, MAX_DESC, MAX_LINK, and other limits. */

/* ── Task struct ────────────────────────────────────────────────────────── */
typedef struct {
    int   id;                      /* Unique sequential ID assigned at creation.           */
    char  subjectName[MAX_NAME];   /* Name of the linked subject (foreign key by name).    */
    char  description[MAX_DESC];   /* Human-readable task description (e.g. "Chapter 3 quiz"). */
    char  type[20];                /* Either "Group" or "Individual".                      */
    char  status[20];              /* One of "Not Started", "In Progress", or "Done".      */
    char  link[MAX_LINK];          /* Optional URL to a resource or submission portal.     */

    /* --- Deadline date/time fields ------------------------------------- */
    int   year;    /* Four-digit deadline year (e.g. 2025).          */
    int   month;   /* Deadline month, 1-12.                          */
    int   day;     /* Deadline day of month, 1-31.                   */
    int   hour;    /* Deadline hour in 24-hour format (0-23).        */
    int   minute;  /* Deadline minute (0-59).                        */
} Task;

/* ── Function prototypes ────────────────────────────────────────────────── */

/* Initialise all fields of *t to safe defaults ("Individual", "Not Started"). */
void  initTask(Task *t);

/*
 * Sort tasks[] in-place by deadline, earliest first, using bubble sort.
 * Called before returning the tasks list to the frontend.
 */
void  sortTasksByDeadline(Task tasks[], int count);

/*
 * Calculate how many whole days remain until the task deadline.
 * Returns a negative number if the deadline has already passed.
 */
int   computeDaysRemaining(const Task *t);

/* ── JSON serialisation helpers ─────────────────────────────────────────── */

/*
 * Serialise a single Task to a compact JSON object string.
 * Also computes and embeds daysRemaining and priority fields.
 * Returns the number of bytes written.
 */
int   taskToJSON(const Task *t, char *buf, int buflen);

/*
 * Serialise the entire tasks[] array to a JSON array string.
 * Returns bytes written.
 */
int   allTasksToJSON(Task tasks[], int count, char *buf, int buflen);

#endif /* TASK_H */
