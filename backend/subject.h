/*
 * subject.h
 * ---------
 * Defines the Subject data structure and declares all Subject-related
 * functions used across the backend (fileio, server, analytics).
 *
 * Grading model
 * -------------
 * A Subject holds up to MAX_GRADE_COMPONENTS weighted grade components
 * (e.g. Quiz, Exam, Assignment).  Each component can have multiple
 * sub-scores (e.g. individual quiz marks) that are averaged to produce
 * the component's final percentage.  The weighted average of all
 * components becomes weightedGrade (0-100), which is then converted to
 * the Philippine equivalentGrade scale (1.0 = excellent, 5.0 = fail).
 */

#ifndef SUBJECT_H   /* Include guard — prevents duplicate declarations. */
#define SUBJECT_H

#include "config.h"   /* MAX_NAME, MAX_NOTES, MAX_SCORES, and other limits. */

/* ── Subject struct ─────────────────────────────────────────────────────── */
typedef struct {
    char  name[MAX_NAME];   /* Display name of the subject (e.g. "Calculus"). */

    /* --- Customisable weighted grading components ----------------------- */
    char  componentNames[MAX_GRADE_COMPONENTS][MAX_COMPONENT_NAME]; /* Name of each grading component (e.g. "Quiz", "Exam"). */
    float componentWeights[MAX_GRADE_COMPONENTS];                   /* Percentage weight of each component (should sum to 100). */
    float componentSubScores[MAX_GRADE_COMPONENTS][MAX_COMPONENT_SUBSCORES]; /* Individual raw scores within each component (e.g. per-quiz marks). */
    float componentMaxScores[MAX_GRADE_COMPONENTS][MAX_COMPONENT_SUBSCORES]; /* Maximum possible score for each sub-score entry. */
    int   componentSubScoreCounts[MAX_GRADE_COMPONENTS];            /* How many sub-scores are recorded for each component. */
    float componentScores[MAX_GRADE_COMPONENTS];                    /* Computed average percentage per component (0-100). */
    int   componentCount;                                           /* Number of active grading components (1-MAX_GRADE_COMPONENTS). */

    /* --- Legacy aliases kept for older JSON / frontend compatibility ---- */
    float quizWeight;        /* Mirrors componentWeights[0] for backwards compatibility. */
    float examWeight;        /* Mirrors componentWeights[1] for backwards compatibility. */
    float assignmentWeight;  /* Mirrors componentWeights[2] for backwards compatibility. */

    /* --- Raw score inputs (legacy, synced from component arrays) -------- */
    float quizScore;         /* Mirrors componentScores[0]. */
    float examScore;         /* Mirrors componentScores[1]. */
    float assignmentScore;   /* Mirrors componentScores[2]. */

    /* --- Computed grade fields ------------------------------------------ */
    float weightedGrade;    /* Final grade on the 0-100 numeric scale.           */
    float equivalentGrade;  /* Converted grade on the Philippine 1.0-5.0 scale. */
    float scores[MAX_SCORES]; /* Historical individual raw scores added over time. */
    int   scoreCount;       /* Number of entries currently in scores[].           */
    float average;          /* Simple arithmetic mean of scores[].               */
    float units;            /* Credit units used for computing GWA.              */

    /* --- Notes & schedule ----------------------------------------------- */
    char  notes[MAX_NOTES];           /* Free-text notes the student typed.         */
    char  scheduleDay[16];            /* Day of week (e.g. "Monday").               */
    char  scheduleLocation[MAX_NAME]; /* Room or building name.                     */
    int   scheduleStartHour;          /* Class start time — hour component (0-23).  */
    int   scheduleStartMinute;        /* Class start time — minute component (0-59). */
    int   scheduleEndHour;            /* Class end time — hour component (0-23).    */
    int   scheduleEndMinute;          /* Class end time — minute component (0-59).  */
    int   absences;                   /* Running count of absences for this subject. */

    /* --- Study habit tracking ------------------------------------------- */
    float studyHours;        /* Target study hours per week set by the student. */
    float trackedStudyHours; /* Actual hours logged via the in-app study timer. */
    int   studyFrequency;    /* Target days per week the student plans to study. */
    float goal;              /* Target grade (0-100) the student wants to reach. */
} Subject;

/* ── Function prototypes ────────────────────────────────────────────────── */

/* Initialise all fields of *s to safe defaults and set the name. */
void  initSubject(Subject *s, const char *name);

/* Append one raw score to s->scores[] and recompute s->average. */
void  addScoreToSubject(Subject *s, float score);

/* Recompute s->average from all entries in s->scores[]. */
void  computeSubjectAverage(Subject *s);

/*
 * Recompute s->weightedGrade from the component arrays, then convert
 * that to s->equivalentGrade and sync the legacy quiz/exam/assignment fields.
 */
void  computeWeightedGrade(Subject *s);

/* Map a numeric grade (0-100) to the Philippine equivalent grade (1.0-5.0). */
float convertNumericToEquivalent(float grade);

/*
 * Calculate the General Weighted Average across all subjects using
 * each subject's equivalentGrade and units.
 */
float calculateGWA(Subject subjects[], int subjectCount);

/*
 * Copy the first three component values into the legacy
 * quizWeight/examWeight/assignmentWeight and score fields so that
 * older code paths and JSON consumers still work correctly.
 */
void  syncLegacyCriteria(Subject *s);

/* Return the index of the subject with the given name, or -1 if not found. */
int   findSubjectIndex(Subject subjects[], int count, const char *name);

/* ── JSON serialisation helpers ─────────────────────────────────────────── */
/* Used by fileio.c, analytics.c, and server.c to build HTTP responses.     */

/*
 * Escape *src for safe embedding inside a JSON string.
 * Writes into dst (capacity dstlen) and returns bytes written
 * (not counting the null terminator).
 */
int   jsonEscape(const char *src, char *dst, int dstlen);

/*
 * Serialise a single Subject to a compact JSON object string.
 * buf must be large enough (SEND_BUF from config.h is safe).
 * Returns the number of bytes written.
 */
int   subjectToJSON(const Subject *s, char *buf, int buflen);

/*
 * Serialise the entire subjects[] array to a JSON array string.
 * Returns bytes written, or -1 if buf would overflow.
 */
int   allSubjectsToJSON(Subject subjects[], int count, char *buf, int buflen);

#endif /* SUBJECT_H */
