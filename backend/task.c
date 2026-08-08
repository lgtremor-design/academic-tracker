/*
 * task.c
 * ------
 * Implements Task operations: initialisation, deadline countdown,
 * sorting, and JSON serialisation.
 *
 * Priority labels are derived from days remaining at serialisation time:
 *   ≤ 1 day  → URGENT
 *   ≤ 3 days → HIGH
 *   ≤ 7 days → MEDIUM
 *   > 7 days → LOW
 */

#include <stdio.h>    /* snprintf — used in JSON helpers. */
#include <string.h>   /* memset, strncpy — used in initTask and jsonEscapeT. */
#include <time.h>     /* time, mktime, difftime, struct tm — for deadline math. */
#include "task.h"     /* Task struct and all prototypes declared here. */

/* ── initTask ───────────────────────────────────────────────────────────── */
/* Initialise a task with safe defaults ── */
void initTask(Task *t) {
    /* Zero every byte so no stale data from a previous task leaks in. */
    memset(t, 0, sizeof(Task));

    /* Set sensible string defaults that the frontend can display immediately. */
    strncpy(t->type,   "Individual", 19);   /* Individual task unless changed. */
    strncpy(t->status, "Not Started", 19);  /* Task has not been started yet.  */
}

/* ── computeDaysRemaining ───────────────────────────────────────────────── */
/* Compute days remaining until deadline (mirrors original) ── */
int computeDaysRemaining(const Task *t) {
    /* Get the current wall-clock time as a Unix timestamp. */
    time_t now = time(NULL);

    /* Populate a broken-down time structure for the task's deadline. */
    struct tm deadline;
    memset(&deadline, 0, sizeof(deadline));
    deadline.tm_year  = t->year  - 1900;   /* struct tm stores years since 1900. */
    deadline.tm_mon   = t->month - 1;      /* struct tm months are 0-indexed.    */
    deadline.tm_mday  = t->day;            /* Day of month, 1-31.                */
    deadline.tm_hour  = t->hour;           /* Hour in 24-hour format.            */
    deadline.tm_min   = t->minute;         /* Minute within the hour.            */
    deadline.tm_isdst = -1;                /* Let mktime infer DST automatically. */

    /* Convert the broken-down deadline to a Unix timestamp. */
    time_t deadlineTime = mktime(&deadline);

    /* Compute the signed difference in seconds between deadline and now. */
    double diffSeconds = difftime(deadlineTime, now);

    /* Convert seconds to whole days (truncates toward zero). */
    return (int)(diffSeconds / (60.0 * 60.0 * 24.0));
}

/* ── taskIsLater ────────────────────────────────────────────────────────── */
/* Return non-zero if task *a has a later deadline than task *b. */
/* Used as the comparison function for the bubble sort below.     */
static int taskIsLater(const Task *a, const Task *b) {
    /* Compare fields from most-significant (year) to least-significant (minute). */
    if (a->year   != b->year)   return a->year   > b->year;    /* Different years: compare years. */
    if (a->month  != b->month)  return a->month  > b->month;   /* Same year: compare months.      */
    if (a->day    != b->day)    return a->day    > b->day;     /* Same month: compare days.       */
    if (a->hour   != b->hour)   return a->hour   > b->hour;    /* Same day: compare hours.        */
    return a->minute > b->minute;   /* Same hour: compare minutes as the tiebreaker. */
}

/* ── sortTasksByDeadline ─────────────────────────────────────────────────── */
/* Bubble-sort tasks[] so the earliest deadline is at index 0. */
void sortTasksByDeadline(Task tasks[], int count) {
    /* Outer loop: each pass bubbles the latest deadline toward the end. */
    for (int i = 0; i < count - 1; i++) {
        /* Inner loop: compare adjacent pairs and swap if out of order. */
        for (int j = 0; j < count - i - 1; j++) {
            if (taskIsLater(&tasks[j], &tasks[j + 1])) {
                /* Swap adjacent tasks using a temporary variable. */
                Task tmp   = tasks[j];
                tasks[j]   = tasks[j + 1];
                tasks[j+1] = tmp;
            }
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   JSON helpers
   ───────────────────────────────────────────────────────────────────────── */

/* jsonEscapeT — local copy of the JSON string escaper for task strings. */
static int jsonEscapeT(const char *src, char *dst, int dstlen) {
    /* Output byte counter. */
    int n = 0;

    /* Walk every byte of the source, replacing special characters with escapes. */
    for (; *src && n < dstlen - 2; src++) {
        unsigned char c = (unsigned char)*src;
        if      (c == '"')  { dst[n++] = '\\'; dst[n++] = '"';  }   /* Quote → \" */
        else if (c == '\\') { dst[n++] = '\\'; dst[n++] = '\\'; }   /* Backslash → \\ */
        else if (c == '\n') { dst[n++] = '\\'; dst[n++] = 'n';  }   /* Newline → \n */
        else if (c == '\r') { dst[n++] = '\\'; dst[n++] = 'r';  }   /* Carriage return → \r */
        else if (c == '\t') { dst[n++] = '\\'; dst[n++] = 't';  }   /* Tab → \t */
        else                { dst[n++] = (char)c; }                  /* Other: copy verbatim. */
    }
    dst[n] = '\0';   /* Null-terminate the output. */
    return n;
}

/* ── taskToJSON ─────────────────────────────────────────────────────────── */
/* Serialise one Task to a JSON object string. */
int taskToJSON(const Task *t, char *buf, int buflen) {
    /* Escaped copies of all string fields to prevent broken JSON. */
    char eSubj[MAX_NAME  * 2];   /* Escaped subject name. */
    char eDesc[MAX_DESC  * 2];   /* Escaped task description. */
    char eType[64], eStatus[64]; /* Escaped type and status strings. */
    char eLink[MAX_LINK  * 2];   /* Escaped URL link. */

    /* Escape each text field before embedding in the JSON string. */
    jsonEscapeT(t->subjectName, eSubj,   sizeof(eSubj));
    jsonEscapeT(t->description, eDesc,   sizeof(eDesc));
    jsonEscapeT(t->type,        eType,   sizeof(eType));
    jsonEscapeT(t->status,      eStatus, sizeof(eStatus));
    jsonEscapeT(t->link,        eLink,   sizeof(eLink));

    /* Compute how many days remain before the deadline (negative = overdue). */
    int days = computeDaysRemaining(t);

    /* Determine the priority label based on days remaining. */
    const char *priority;
    if      (days <= 1)  priority = "URGENT";   /* Due today or tomorrow.          */
    else if (days <= 3)  priority = "HIGH";      /* Due within three days.          */
    else if (days <= 7)  priority = "MEDIUM";    /* Due within a week.              */
    else                 priority = "LOW";        /* More than a week away.          */

    /* Build and return the complete JSON object. */
    return snprintf(buf, buflen,
        "{"
        "\"id\":%d,"               /* Unique task identifier.                    */
        "\"subjectName\":\"%s\","  /* Linked subject name.                       */
        "\"description\":\"%s\","  /* Task description text.                     */
        "\"type\":\"%s\","         /* Group or Individual.                       */
        "\"status\":\"%s\","       /* Current completion status.                 */
        "\"link\":\"%s\","         /* Optional reference URL.                    */
        "\"year\":%d,\"month\":%d,\"day\":%d,"   /* Deadline date components.    */
        "\"hour\":%d,\"minute\":%d,"             /* Deadline time components.    */
        "\"daysRemaining\":%d,"    /* Positive = future, negative = overdue.     */
        "\"priority\":\"%s\""      /* Derived priority label.                    */
        "}",
        t->id,
        eSubj, eDesc, eType, eStatus, eLink,
        t->year, t->month, t->day,
        t->hour, t->minute,
        days, priority);
}

/* ── allTasksToJSON ─────────────────────────────────────────────────────── */
/* Serialise all tasks to a JSON array string. */
int allTasksToJSON(Task tasks[], int count, char *buf, int buflen) {
    /* Start the JSON array. */
    int pos = 0;
    buf[pos++] = '[';   /* Opening bracket. */

    for (int i = 0; i < count; i++) {
        if (i) { buf[pos++] = ','; }   /* Comma before every element except the first. */

        /* Serialise one task into a temporary scratch buffer. */
        char tmp[2048];
        int n = taskToJSON(&tasks[i], tmp, sizeof(tmp));

        /* Stop early if the next entry would overflow the output buffer. */
        if (pos + n + 4 >= buflen) break;

        /* Copy the serialised task into the output buffer. */
        memcpy(buf + pos, tmp, n);
        pos += n;
    }

    buf[pos++] = ']';   /* Closing bracket. */
    buf[pos]   = '\0';  /* Null-terminate.   */
    return pos;         /* Return bytes written. */
}
