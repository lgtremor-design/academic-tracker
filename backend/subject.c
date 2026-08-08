/*
 * subject.c
 * ---------
 * Implements all Subject operations: initialisation, score tracking,
 * grade computation, GWA calculation, and JSON serialisation.
 *
 * Grade computation pipeline:
 *   1. Student enters sub-scores per component (e.g. individual quiz marks).
 *   2. computeWeightedGrade() averages sub-scores → component percentage.
 *   3. Component percentages are combined with their weights → weightedGrade.
 *   4. weightedGrade is converted to equivalentGrade via the PH grade table.
 *   5. syncLegacyCriteria() mirrors values into the legacy quiz/exam/assignment
 *      fields so older frontend code paths continue to work.
 */

#include <stdio.h>    /* snprintf, fprintf — used in JSON helpers. */
#include <string.h>   /* memset, strncpy, strcmp — used throughout. */
#include "subject.h"  /* Subject struct and all prototypes declared here. */

/* ── initSubject ────────────────────────────────────────────────────────── */
/* Initialise a subject with defaults ── */
void initSubject(Subject *s, const char *name) {
    /* Zero out every byte so no stale data leaks into the new subject. */
    memset(s, 0, sizeof(Subject));

    /* Copy the caller-supplied name; cap at MAX_NAME-1 to keep the null terminator. */
    strncpy(s->name, name, MAX_NAME - 1);
    s->name[MAX_NAME - 1] = '\0';   /* Guarantee null termination even if name was too long. */

    s->scoreCount = 0;     /* No raw scores recorded yet. */
    s->average    = 0.0f;  /* Average starts at zero. */
    s->notes[0]   = '\0';  /* Notes field starts empty. */
    s->scheduleDay[0] = '\0';        /* No schedule day set yet. */
    s->scheduleLocation[0] = '\0';   /* No room location set yet. */
    s->equivalentGrade = 5.0f;  /* Default to failing grade until real scores arrive. */
    s->units = 3.0f;            /* Most subjects are 3 credit units; can be overridden. */
    s->studyHours = 0.0f;         /* No weekly study target set yet. */
    s->trackedStudyHours = 0.0f;  /* Timer has not logged any hours yet. */

    /* Create three default grading components so new subjects are immediately usable. */
    s->componentCount = 3;
    strncpy(s->componentNames[0], "Quiz",       MAX_COMPONENT_NAME - 1); /* First component: quizzes.      */
    strncpy(s->componentNames[1], "Exam",       MAX_COMPONENT_NAME - 1); /* Second component: exams.       */
    strncpy(s->componentNames[2], "Assignment", MAX_COMPONENT_NAME - 1); /* Third component: assignments.  */

    /* Give each component an equal one-third weight so they sum to 100%. */
    s->componentWeights[0] = 33.34f;  /* Slightly larger to compensate for rounding. */
    s->componentWeights[1] = 33.33f;  /* Quiz/Exam/Assignment share grade equally.   */
    s->componentWeights[2] = 33.33f;

    /* Sync the new component values into the legacy fields immediately. */
    syncLegacyCriteria(s);
}

/* ── addScoreToSubject ──────────────────────────────────────────────────── */
/* Add a raw score and recompute average (mirrors original) ── */
void addScoreToSubject(Subject *s, float score) {
    /* Refuse to add more scores once the fixed-size array is full. */
    if (s->scoreCount >= MAX_SCORES) return;

    /* Append the new score and advance the count. */
    s->scores[s->scoreCount++] = score;

    /* Immediately recompute the average to keep it in sync. */
    computeSubjectAverage(s);
}

/* ── computeSubjectAverage ──────────────────────────────────────────────── */
/* Recompute the simple mean of scores[] ── */
void computeSubjectAverage(Subject *s) {
    /* Guard: avoid division by zero when there are no scores yet. */
    if (s->scoreCount == 0) { s->average = 0.0f; return; }

    /* Sum every recorded score. */
    float sum = 0.0f;
    for (int i = 0; i < s->scoreCount; i++) sum += s->scores[i];

    /* Divide by count to get the arithmetic mean. */
    s->average = sum / (float)s->scoreCount;
}

/* ── computeWeightedGrade ───────────────────────────────────────────────── */
/* Recompute weighted grade from component inputs ── */
void computeWeightedGrade(Subject *s) {
    /* Accumulators for the weighted sum and total weight so far. */
    float weightedSum = 0.0f;
    float total = 0.0f;

    /* Fall back to three legacy components if none have been configured. */
    if (s->componentCount <= 0) {
        s->componentCount = 3;
        strncpy(s->componentNames[0], "Quiz",       MAX_COMPONENT_NAME - 1);
        strncpy(s->componentNames[1], "Exam",       MAX_COMPONENT_NAME - 1);
        strncpy(s->componentNames[2], "Assignment", MAX_COMPONENT_NAME - 1);
        s->componentWeights[0] = s->quizWeight;        /* Restore from legacy field. */
        s->componentWeights[1] = s->examWeight;
        s->componentWeights[2] = s->assignmentWeight;
        s->componentScores[0]  = s->quizScore;         /* Restore from legacy field. */
        s->componentScores[1]  = s->examScore;
        s->componentScores[2]  = s->assignmentScore;
    }

    /* Process each grading component. */
    for (int i = 0; i < s->componentCount && i < MAX_GRADE_COMPONENTS; i++) {
        float weight   = s->componentWeights[i];   /* This component's percentage weight. */
        float score    = s->componentScores[i];    /* Previously stored component score.  */
        int   subCount = s->componentSubScoreCounts[i]; /* Number of sub-scores entered.  */

        /* Clamp negative weights to zero; they would distort the total otherwise. */
        if (weight < 0.0f) weight = 0.0f;

        /* If sub-scores exist, compute the component score as their average percent. */
        if (subCount > 0) {
            float percentSum = 0.0f;   /* Sum of (earned/max)*100 for each sub-score. */
            int   validCount = 0;      /* Number of sub-scores with a valid max > 0.  */

            for (int j = 0; j < subCount && j < MAX_COMPONENT_SUBSCORES; j++) {
                float earned   = s->componentSubScores[i][j];   /* Raw score the student earned. */
                float maxScore = s->componentMaxScores[i][j];   /* Maximum possible for this item. */

                if (maxScore <= 0.0f) continue;   /* Skip entries with no valid maximum. */

                /* Clamp earned score to the valid [0, max] range. */
                if (earned < 0.0f)       earned = 0.0f;
                if (earned > maxScore)   earned = maxScore;

                /* Convert to a percentage and accumulate. */
                percentSum += (earned / maxScore) * 100.0f;
                validCount++;
            }

            /* Average the sub-score percentages to get the component percentage. */
            score = (validCount > 0) ? (percentSum / (float)validCount) : 0.0f;

            /* Store the computed score back so JSON export includes the up-to-date value. */
            s->componentScores[i] = score;
        }

        /* Clamp the final component score to the [0, 100] range. */
        if (score < 0.0f)   score = 0.0f;
        if (score > 100.0f) score = 100.0f;

        /* Accumulate this component's contribution to the weighted grade. */
        weightedSum += score * weight;   /* e.g. 85 * 33.34 = 2834 */
        total       += weight;           /* Running sum of weights.  */
    }

    /*
     * Divide by 100 because weights are stored as percentages (0-100),
     * so weightedSum is in units of "score × percent" rather than
     * "score × fraction".  If no weights are defined, fall back to the
     * raw average so the field is never zero unexpectedly.
     */
    s->weightedGrade   = (total > 0.0f) ? (weightedSum / 100.0f) : s->average;

    /* Convert the 0-100 numeric grade to the Philippine 1.0-5.0 scale. */
    s->equivalentGrade = convertNumericToEquivalent(s->weightedGrade);

    /* Keep the legacy quiz/exam/assignment fields in sync. */
    syncLegacyCriteria(s);
}

/* ── convertNumericToEquivalent ─────────────────────────────────────────── */
/* Map a 0-100 grade to the Philippine 1.0-5.0 equivalent scale. */
float convertNumericToEquivalent(float grade) {
    if (grade >= 94.0f) return 1.0f;    /* Excellent — 94 and above.            */
    if (grade >= 90.0f) return 1.25f;   /* Very Good — 90 to 93.                */
    if (grade >= 87.0f) return 1.5f;    /* Good — 87 to 89.                     */
    if (grade >= 84.0f) return 1.75f;   /* Above Average — 84 to 86.            */
    if (grade >= 80.0f) return 2.0f;    /* Average — 80 to 83.                  */
    if (grade >= 75.0f) return 2.25f;   /* Below Average — 75 to 79.            */
    if (grade >= 70.0f) return 2.5f;    /* Poor — 70 to 74.                     */
    if (grade >= 65.0f) return 2.75f;   /* Very Poor — 65 to 69.               */
    if (grade >= 60.0f) return 3.0f;    /* Passing — 60 to 64.                  */
    if (grade >= 50.0f) return 4.0f;    /* Conditional failure — 50 to 59.      */
    return 5.0f;                        /* Failure — below 50.                  */
}

/* ── calculateGWA ───────────────────────────────────────────────────────── */
/* Compute the General Weighted Average across all subjects. */
float calculateGWA(Subject subjects[], int subjectCount) {
    float weightedSum = 0.0f;   /* Sum of (equivalentGrade × units) for each subject. */
    float totalUnits  = 0.0f;   /* Total credit units so far. */

    for (int i = 0; i < subjectCount; i++) {
        float units = subjects[i].units;
        if (units <= 0.0f) continue;   /* Skip subjects with no credit units assigned. */

        weightedSum += subjects[i].equivalentGrade * units;   /* Accumulate weighted grade. */
        totalUnits  += units;                                  /* Accumulate total units.    */
    }

    /* If no subjects have units, return 0 to avoid division by zero. */
    return (totalUnits <= 0.0f) ? 0.0f : (weightedSum / totalUnits);
}

/* ── syncLegacyCriteria ─────────────────────────────────────────────────── */
/* Mirror component[0..2] values into the legacy quiz/exam/assignment fields. */
void syncLegacyCriteria(Subject *s) {
    /* Clear the legacy fields first so they are not stale if component count < 3. */
    s->quizWeight = s->examWeight = s->assignmentWeight = 0.0f;
    s->quizScore  = s->examScore  = s->assignmentScore  = 0.0f;

    /* Copy from each component slot if it exists. */
    if (s->componentCount > 0) {
        s->quizWeight = s->componentWeights[0];   /* Component 0 → quiz alias. */
        s->quizScore  = s->componentScores[0];
    }
    if (s->componentCount > 1) {
        s->examWeight = s->componentWeights[1];   /* Component 1 → exam alias. */
        s->examScore  = s->componentScores[1];
    }
    if (s->componentCount > 2) {
        s->assignmentWeight = s->componentWeights[2];   /* Component 2 → assignment alias. */
        s->assignmentScore  = s->componentScores[2];
    }
}

/* ── findSubjectIndex ───────────────────────────────────────────────────── */
/* Find subject index by name, returns -1 if not found ── */
int findSubjectIndex(Subject subjects[], int count, const char *name) {
    /* Linear scan — subject count is small (< MAX_SUBJECTS ≈ 100). */
    for (int i = 0; i < count; i++)
        if (strcmp(subjects[i].name, name) == 0) return i;   /* Found — return index. */
    return -1;   /* Not found. */
}

/* ─────────────────────────────────────────────────────────────────────────
   JSON helpers
   These produce compact JSON strings; the caller must supply a buffer
   large enough (SEND_BUF from config.h is a safe choice).
   ───────────────────────────────────────────────────────────────────────── */

/*
 * jsonEscape()
 * ------------
 * Copy *src into *dst, inserting backslash escapes before any characters
 * that would break a JSON string literal (" \\ \n \r \t).
 * Returns the number of bytes written (not counting the null terminator).
 */
int jsonEscape(const char *src, char *dst, int dstlen) {
    int n = 0;   /* Output byte count. */

    /* Walk every byte of the source string. */
    for (; *src && n < dstlen - 2; src++) {
        unsigned char c = (unsigned char)*src;

        /* Each special character is replaced by its two-byte JSON escape sequence. */
        if      (c == '"')  { dst[n++] = '\\'; dst[n++] = '"';  }   /* Quote → \" */
        else if (c == '\\') { dst[n++] = '\\'; dst[n++] = '\\'; }   /* Backslash → \\ */
        else if (c == '\n') { dst[n++] = '\\'; dst[n++] = 'n';  }   /* Newline → \n */
        else if (c == '\r') { dst[n++] = '\\'; dst[n++] = 'r';  }   /* Carriage return → \r */
        else if (c == '\t') { dst[n++] = '\\'; dst[n++] = 't';  }   /* Tab → \t */
        else                { dst[n++] = (char)c; }                  /* Everything else: copy verbatim. */
    }
    dst[n] = '\0';   /* Null-terminate the output. */
    return n;
}

/* ── subjectToJSON ──────────────────────────────────────────────────────── */
/* Serialise one Subject to a JSON object string. */
int subjectToJSON(const Subject *s, char *buf, int buflen) {
    /* Escaped copies of every string field (prevents malformed JSON). */
    char eName[MAX_NAME * 2];
    char eNotes[MAX_NOTES * 2];
    char eDay[32];
    char eLocation[MAX_NAME * 2];

    /* Escape each text field before embedding it in JSON. */
    jsonEscape(s->name,             eName,     sizeof(eName));
    jsonEscape(s->notes,            eNotes,    sizeof(eNotes));
    jsonEscape(s->scheduleDay,      eDay,      sizeof(eDay));
    jsonEscape(s->scheduleLocation, eLocation, sizeof(eLocation));

    /* Build the scores[] JSON array as a string (e.g. "[85.00,90.50]"). */
    char scoresArr[512] = "[";
    int  pos = 1;   /* Position after the opening '['. */
    for (int i = 0; i < s->scoreCount && pos < 500; i++) {
        pos += snprintf(scoresArr + pos, 512 - pos,
                        "%s%.2f", i ? "," : "", s->scores[i]);   /* Comma-separate entries. */
    }
    scoresArr[pos++] = ']';   /* Close the array. */
    scoresArr[pos]   = '\0';

    /* Build the components[] JSON array (includes sub-scores for each component). */
    char componentsArr[8192] = "[";
    int cpos = 1;   /* Position after the opening '['. */

    for (int i = 0; i < s->componentCount && i < MAX_GRADE_COMPONENTS; i++) {
        char eComponent[MAX_COMPONENT_NAME * 2];   /* Escaped component name. */
        char subScoresArr[1024] = "[";             /* Per-component sub-scores array. */
        int  spos = 1;

        /* Build the sub-scores array for this component. */
        for (int j = 0; j < s->componentSubScoreCounts[i] && j < MAX_COMPONENT_SUBSCORES; j++) {
            spos += snprintf(subScoresArr + spos, sizeof(subScoresArr) - spos,
                             "%s{\"score\":%.2f,\"maxScore\":%.2f}",
                             j ? "," : "",                           /* Comma before entries 1+. */
                             s->componentSubScores[i][j],           /* Raw score earned.        */
                             s->componentMaxScores[i][j]);          /* Maximum possible score.  */
            if (spos >= (int)sizeof(subScoresArr) - 64) break;   /* Stop if buffer is nearly full. */
        }
        subScoresArr[spos++] = ']';   /* Close the sub-scores array. */
        subScoresArr[spos]   = '\0';

        /* Escape the component name before embedding it. */
        jsonEscape(s->componentNames[i], eComponent, sizeof(eComponent));

        /* Append this component object to the components array. */
        cpos += snprintf(componentsArr + cpos, sizeof(componentsArr) - cpos,
                         "%s{\"name\":\"%s\",\"weight\":%.2f,\"score\":%.2f,\"scores\":%s}",
                         i ? "," : "",           /* Comma before components 1+. */
                         eComponent,
                         s->componentWeights[i],
                         s->componentScores[i],
                         subScoresArr);
        if (cpos >= (int)sizeof(componentsArr) - 128) break;   /* Stop if buffer is nearly full. */
    }
    componentsArr[cpos++] = ']';   /* Close the components array. */
    componentsArr[cpos]   = '\0';

    /* Assemble the final JSON object and return the byte count. */
    return snprintf(buf, buflen,
        "{"
        "\"name\":\"%s\","             /* Subject display name.                     */
        "\"notes\":\"%s\","            /* Student notes.                            */
        "\"components\":%s,"           /* Full component array with sub-scores.     */
        "\"componentCount\":%d,"       /* Number of active components.              */
        "\"quizWeight\":%.2f,"         /* Legacy weight alias for component 0.      */
        "\"examWeight\":%.2f,"         /* Legacy weight alias for component 1.      */
        "\"assignmentWeight\":%.2f,"   /* Legacy weight alias for component 2.      */
        "\"quizScore\":%.2f,"          /* Legacy score alias for component 0.       */
        "\"examScore\":%.2f,"          /* Legacy score alias for component 1.       */
        "\"assignmentScore\":%.2f,"    /* Legacy score alias for component 2.       */
        "\"weightedGrade\":%.2f,"      /* Final computed grade (0-100).             */
        "\"equivalentGrade\":%.2f,"    /* Philippine equivalent grade (1.0-5.0).    */
        "\"units\":%.2f,"              /* Credit units for GWA calculation.         */
        "\"scores\":%s,"               /* Historical raw scores array.              */
        "\"scoreCount\":%d,"           /* Number of entries in scores[].            */
        "\"average\":%.2f,"            /* Simple average of scores[].               */
        "\"scheduleDay\":\"%s\","       /* Day of week for class schedule.           */
        "\"scheduleLocation\":\"%s\"," /* Room or building name.                    */
        "\"scheduleStartHour\":%d,"    /* Class start hour (0-23).                  */
        "\"scheduleStartMinute\":%d,"  /* Class start minute (0-59).               */
        "\"scheduleEndHour\":%d,"      /* Class end hour (0-23).                    */
        "\"scheduleEndMinute\":%d,"    /* Class end minute (0-59).                 */
        "\"absences\":%d,"             /* Absence count.                            */
        "\"studyHours\":%.1f,"         /* Weekly study hour target.                 */
        "\"trackedStudyHours\":%.2f,"  /* Actual hours logged by the timer.         */
        "\"studyFrequency\":%d,"       /* Target study days per week.               */
        "\"goal\":%.2f"                /* Target grade (0-100).                     */
        "}",
        eName, eNotes,
        componentsArr,
        s->componentCount,
        s->quizWeight, s->examWeight, s->assignmentWeight,
        s->quizScore,  s->examScore,  s->assignmentScore,
        s->weightedGrade,
        s->equivalentGrade,
        s->units,
        scoresArr,
        s->scoreCount,
        s->average,
        eDay,
        eLocation,
        s->scheduleStartHour,
        s->scheduleStartMinute,
        s->scheduleEndHour,
        s->scheduleEndMinute,
        s->absences,
        s->studyHours,
        s->trackedStudyHours,
        s->studyFrequency,
        s->goal);
}

/* ── allSubjectsToJSON ──────────────────────────────────────────────────── */
/* Serialise all subjects to a JSON array string.
   Returns bytes written on success, or -1 if the buffer would overflow. */
int allSubjectsToJSON(Subject subjects[], int count, char *buf, int buflen) {
    int pos = 0;
    buf[pos++] = '[';   /* Open the JSON array. */

    for (int i = 0; i < count; i++) {
        if (i) { buf[pos++] = ','; }   /* Comma-separate elements. */

        /* Serialise one subject into a temporary buffer first. */
        char tmp[16384];
        int n = subjectToJSON(&subjects[i], tmp, sizeof(tmp));

        /* Abort if the combined output would overflow the caller's buffer. */
        if (pos + n + 4 >= buflen) {
            buf[0] = '\0';   /* Return an empty string to signal failure. */
            return -1;
        }

        /* Append the serialised subject to the output buffer. */
        memcpy(buf + pos, tmp, n);
        pos += n;
    }

    buf[pos++] = ']';   /* Close the JSON array. */
    buf[pos]   = '\0';  /* Null-terminate. */
    return pos;         /* Return total bytes written. */
}
