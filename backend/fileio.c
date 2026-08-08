/*
 * fileio.c
 * --------
 * Reads and writes the local Academic Tracker data file.
 * Uses a hand-written JSON parser (no external libraries) so
 * the project compiles with a plain gcc on Windows MSYS2.
 *
 * File format  (pretty-printed for clarity):
 * {
 *   "subjects": [ { ...Subject fields... }, ... ],
 *   "tasks":    [ { ...Task fields...    }, ... ]
 * }
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "fileio.h"
#include "config.h"
#include "subject.h"   /* jsonEscape() */

/* ─────────────────────────────────────────────────────────────
   SAVE  (Subject[] + Task[] → JSON file)
   ───────────────────────────────────────────────────────────── */

void saveData(Subject subjects[], int subjectCount,
              Task    tasks[],   int taskCount) {

    /* Open the save file where all subjects and tasks are stored. */
    FILE *fp = fopen(DATA_FILE, "w");
    if (!fp) {
        fprintf(stderr, "[fileio] Cannot open %s for writing.\n", DATA_FILE);
        return;
    }

    fprintf(fp, "{\n");

    /* ── subjects array ── */
    /* Start writing the subject list. */
    fprintf(fp, "  \"subjects\": [\n");
    for (int i = 0; i < subjectCount; i++) {
        /* Get one subject from the list. */
        Subject *s = &subjects[i];
        char eName[MAX_NAME * 2];
        char eNotes[MAX_NOTES * 2];
        char eDay[32];
        char eLocation[MAX_NAME * 2];
        /* Make text safe before saving it as JSON. */
        jsonEscape(s->name,             eName,      sizeof(eName));
        jsonEscape(s->notes,            eNotes,     sizeof(eNotes));
        jsonEscape(s->scheduleDay,      eDay,       sizeof(eDay));
        jsonEscape(s->scheduleLocation, eLocation,  sizeof(eLocation));

        fprintf(fp, "    {\n");
        fprintf(fp, "      \"name\": \"%s\",\n",    eName);
        fprintf(fp, "      \"notes\": \"%s\",\n",   eNotes);
        fprintf(fp, "      \"componentCount\": %d,\n", s->componentCount);
        fprintf(fp, "      \"components\": [\n");
        for (int j = 0; j < s->componentCount && j < MAX_GRADE_COMPONENTS; j++) {
            char eCompName[MAX_COMPONENT_NAME * 2];
            jsonEscape(s->componentNames[j], eCompName, sizeof(eCompName));
            fprintf(fp,
                    "        {\"name\": \"%s\", \"weight\": %.2f, \"score\": %.2f, \"scores\": [",
                    eCompName,
                    s->componentWeights[j],
                    s->componentScores[j]);
            for (int k = 0; k < s->componentSubScoreCounts[j] && k < MAX_COMPONENT_SUBSCORES; k++) {
                fprintf(fp, "%s{\"score\": %.2f, \"maxScore\": %.2f}",
                        k ? ", " : "",
                        s->componentSubScores[j][k],
                        s->componentMaxScores[j][k]);
            }
            fprintf(fp, "]}%s\n", (j < s->componentCount - 1) ? "," : "");
        }
        fprintf(fp, "      ],\n");
        fprintf(fp, "      \"quizWeight\": %.2f,\n",       s->quizWeight);
        fprintf(fp, "      \"examWeight\": %.2f,\n",       s->examWeight);
        fprintf(fp, "      \"assignmentWeight\": %.2f,\n", s->assignmentWeight);
        fprintf(fp, "      \"quizScore\": %.2f,\n",        s->quizScore);
        fprintf(fp, "      \"examScore\": %.2f,\n",        s->examScore);
        fprintf(fp, "      \"assignmentScore\": %.2f,\n",  s->assignmentScore);
        fprintf(fp, "      \"weightedGrade\": %.2f,\n",    s->weightedGrade);
        fprintf(fp, "      \"equivalentGrade\": %.2f,\n",  s->equivalentGrade);
        fprintf(fp, "      \"units\": %.2f,\n",            s->units);
        fprintf(fp, "      \"average\": %.2f,\n",          s->average);
        fprintf(fp, "      \"scheduleDay\": \"%s\",\n",    eDay);
        fprintf(fp, "      \"scheduleLocation\": \"%s\",\n", eLocation);
        fprintf(fp, "      \"scheduleStartHour\": %d,\n",  s->scheduleStartHour);
        fprintf(fp, "      \"scheduleStartMinute\": %d,\n", s->scheduleStartMinute);
        fprintf(fp, "      \"scheduleEndHour\": %d,\n",    s->scheduleEndHour);
        fprintf(fp, "      \"scheduleEndMinute\": %d,\n",  s->scheduleEndMinute);
        fprintf(fp, "      \"absences\": %d,\n",           s->absences);
        fprintf(fp, "      \"studyHours\": %.1f,\n",       s->studyHours);
        fprintf(fp, "      \"trackedStudyHours\": %.2f,\n", s->trackedStudyHours);
        fprintf(fp, "      \"studyFrequency\": %d,\n",     s->studyFrequency);
        fprintf(fp, "      \"goal\": %.2f,\n",             s->goal);
        fprintf(fp, "      \"scoreCount\": %d,\n",         s->scoreCount);
        fprintf(fp, "      \"scores\": [");
        for (int j = 0; j < s->scoreCount; j++) {
            fprintf(fp, "%s%.2f", j ? "," : "", s->scores[j]);
        }
        fprintf(fp, "]\n");
        fprintf(fp, "    }%s\n", (i < subjectCount - 1) ? "," : "");
    }
    fprintf(fp, "  ],\n");

    /* ── tasks array ── */
    /* Start writing the task list. */
    fprintf(fp, "  \"tasks\": [\n");
    for (int i = 0; i < taskCount; i++) {
        /* Get one task from the list. */
        Task *t = &tasks[i];
        char eTSubject[MAX_NAME * 2];
        char eTDesc[MAX_DESC * 2];
        char eTType[48];
        char eTStatus[48];
        char eTLink[MAX_LINK * 2];
        /* Make task text safe before saving it. */
        jsonEscape(t->subjectName, eTSubject, sizeof(eTSubject));
        jsonEscape(t->description, eTDesc,    sizeof(eTDesc));
        jsonEscape(t->type,        eTType,    sizeof(eTType));
        jsonEscape(t->status,      eTStatus,  sizeof(eTStatus));
        jsonEscape(t->link,        eTLink,    sizeof(eTLink));
        fprintf(fp, "    {\n");
        fprintf(fp, "      \"id\": %d,\n",              t->id);
        fprintf(fp, "      \"subjectName\": \"%s\",\n", eTSubject);
        fprintf(fp, "      \"description\": \"%s\",\n", eTDesc);
        fprintf(fp, "      \"type\": \"%s\",\n",        eTType);
        fprintf(fp, "      \"status\": \"%s\",\n",      eTStatus);
        fprintf(fp, "      \"link\": \"%s\",\n",        eTLink);
        fprintf(fp, "      \"year\": %d,\n",            t->year);
        fprintf(fp, "      \"month\": %d,\n",           t->month);
        fprintf(fp, "      \"day\": %d,\n",             t->day);
        fprintf(fp, "      \"hour\": %d,\n",            t->hour);
        fprintf(fp, "      \"minute\": %d\n",           t->minute);
        fprintf(fp, "    }%s\n", (i < taskCount - 1) ? "," : "");
    }
    fprintf(fp, "  ]\n");
    fprintf(fp, "}\n");
    fclose(fp);
    printf("[fileio] Data saved → %s\n", DATA_FILE);
}

/* ─────────────────────────────────────────────────────────────
   LOAD  (JSON file → Subject[] + Task[])
   Hand-written parser: scans for known key patterns.
   Robust enough for the well-formed output we write above.
   ───────────────────────────────────────────────────────────── */

/* Skip whitespace */
static const char *skipWS(const char *p) {
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
    return p;
}

/* Read a JSON string value into dst (max dstlen-1 chars).
   p must point at the opening '"'.  Returns pointer after closing '"'. */
static const char *readStr(const char *p, char *dst, int dstlen) {
    if (*p == '"') p++;
    int n = 0;
    while (*p && *p != '"') {
        if (*p == '\\' && *(p+1)) {
            p++;
            if      (*p == 'n')  { if (n < dstlen-1) dst[n++] = '\n'; }
            else if (*p == 'r')  { if (n < dstlen-1) dst[n++] = '\r'; }
            else if (*p == 't')  { if (n < dstlen-1) dst[n++] = '\t'; }
            else                 { if (n < dstlen-1) dst[n++] = *p;   }
        } else {
            if (n < dstlen-1) dst[n++] = *p;
        }
        p++;
    }
    dst[n] = '\0';
    if (*p == '"') p++;
    return p;
}

/* Read a JSON number (integer or float) and advance p */
static const char *readFloat(const char *p, float *out) {
    *out = (float)strtod(p, (char **)&p);
    return p;
}
static const char *readInt(const char *p, int *out) {
    *out = (int)strtol(p, (char **)&p, 10);
    return p;
}

/* Find next occurrence of key "key": and return pointer after ':' */
static const char *findKey(const char *p, const char *key) {
    /* Build search pattern  "key": */
    char pat[128];
    snprintf(pat, sizeof(pat), "\"%s\":", key);
    const char *found = strstr(p, pat);
    if (!found) return NULL;
    return found + strlen(pat);
}

/* Parse one subject object starting after '{'.  Returns pointer past '}'. */
static const char *parseSubject(const char *start, const char *end, Subject *s) {
    initSubject(s, "");

    /* search for each key inside the block [start, end] */
    const char *p;

#define LOAD_STR(key, field, maxlen)                       \
    p = findKey(start, key);                               \
    if (p && p < end) {                                    \
        p = skipWS(p);                                     \
        readStr(p, s->field, maxlen);                      \
    }

#define LOAD_FLOAT(key, field)                             \
    p = findKey(start, key);                               \
    if (p && p < end) {                                    \
        p = skipWS(p);                                     \
        readFloat(p, &s->field);                           \
    }

#define LOAD_INT(key, field)                               \
    p = findKey(start, key);                               \
    if (p && p < end) {                                    \
        p = skipWS(p);                                     \
        readInt(p, &s->field);                             \
    }

    LOAD_STR  ("name",             name,              MAX_NAME)
    LOAD_STR  ("notes",            notes,             MAX_NOTES)
    LOAD_FLOAT("quizWeight",       quizWeight)
    LOAD_FLOAT("examWeight",       examWeight)
    LOAD_FLOAT("assignmentWeight", assignmentWeight)
    LOAD_FLOAT("quizScore",        quizScore)
    LOAD_FLOAT("examScore",        examScore)
    LOAD_FLOAT("assignmentScore",  assignmentScore)
    LOAD_FLOAT("weightedGrade",    weightedGrade)
    LOAD_FLOAT("equivalentGrade",  equivalentGrade)
    LOAD_FLOAT("units",            units)
    LOAD_FLOAT("average",          average)
    LOAD_STR  ("scheduleDay",      scheduleDay,       16)
    LOAD_STR  ("scheduleLocation", scheduleLocation,  MAX_NAME)
    LOAD_INT  ("scheduleStartHour", scheduleStartHour)
    LOAD_INT  ("scheduleStartMinute", scheduleStartMinute)
    LOAD_INT  ("scheduleEndHour",   scheduleEndHour)
    LOAD_INT  ("scheduleEndMinute", scheduleEndMinute)
    LOAD_INT  ("absences",         absences)
    LOAD_FLOAT("studyHours",       studyHours)
    LOAD_FLOAT("trackedStudyHours", trackedStudyHours)
    LOAD_INT  ("studyFrequency",   studyFrequency)
    LOAD_FLOAT("goal",             goal)
    LOAD_INT  ("scoreCount",       scoreCount)

    /* scores array */
    const char *scoreSearchStart = findKey(start, "scoreCount");
    p = scoreSearchStart ? findKey(scoreSearchStart, "scores") : findKey(start, "scores");
    if (p && p < end) {
        p = skipWS(p);
        if (*p == '[') {
            p++;
            for (int j = 0; j < s->scoreCount && j < MAX_SCORES; j++) {
                p = skipWS(p);
                p = readFloat(p, &s->scores[j]);
                p = skipWS(p);
                if (*p == ',') p++;
            }
        }
    }

    /* customizable grading components */
    int loadedComponents = 0;
    p = findKey(start, "components");
    if (p && p < end) {
        p = skipWS(p);
        if (*p == '[') {
            p++;
            while (loadedComponents < MAX_GRADE_COMPONENTS && p < end) {
                p = skipWS(p);
                if (*p == ']') break;
                if (*p != '{') { p++; continue; }

                int depth = 0;
                const char *objStart = p;
                const char *objEnd = p;
                for (const char *q = p; q < end && *q; q++) {
                    if (*q == '{') depth++;
                    else if (*q == '}') {
                        depth--;
                        if (depth == 0) { objEnd = q; break; }
                    }
                }

                const char *cp = findKey(objStart, "name");
                if (cp && cp < objEnd) {
                    cp = skipWS(cp);
                    readStr(cp, s->componentNames[loadedComponents], MAX_COMPONENT_NAME);
                }

                cp = findKey(objStart, "weight");
                if (cp && cp < objEnd) {
                    cp = skipWS(cp);
                    readFloat(cp, &s->componentWeights[loadedComponents]);
                }

                cp = findKey(objStart, "score");
                if (cp && cp < objEnd) {
                    cp = skipWS(cp);
                    readFloat(cp, &s->componentScores[loadedComponents]);
                }

                int subCount = 0;
                cp = findKey(objStart, "scores");
                if (cp && cp < objEnd) {
                    cp = skipWS(cp);
                    if (*cp == '[') {
                        cp++;
                        while (subCount < MAX_COMPONENT_SUBSCORES && cp < objEnd) {
                            cp = skipWS(cp);
                            if (*cp == ']') break;
                            if (*cp != '{') { cp++; continue; }

                            int sdepth = 0;
                            const char *scoreObjStart = cp;
                            const char *scoreObjEnd = cp;
                            for (const char *q = cp; q < objEnd && *q; q++) {
                                if (*q == '{') sdepth++;
                                else if (*q == '}') {
                                    sdepth--;
                                    if (sdepth == 0) { scoreObjEnd = q; break; }
                                }
                            }

                            const char *sp = findKey(scoreObjStart, "score");
                            if (sp && sp < scoreObjEnd) {
                                sp = skipWS(sp);
                                readFloat(sp, &s->componentSubScores[loadedComponents][subCount]);
                            }

                            sp = findKey(scoreObjStart, "maxScore");
                            if (!sp || sp >= scoreObjEnd) sp = findKey(scoreObjStart, "max");
                            if (sp && sp < scoreObjEnd) {
                                sp = skipWS(sp);
                                readFloat(sp, &s->componentMaxScores[loadedComponents][subCount]);
                            }

                            if (s->componentMaxScores[loadedComponents][subCount] > 0.0f) {
                                subCount++;
                            }

                            cp = scoreObjEnd + 1;
                            cp = skipWS(cp);
                            if (*cp == ',') cp++;
                        }
                    }
                }

                if (subCount > 0) {
                    s->componentSubScoreCounts[loadedComponents] = subCount;
                } else if (s->componentScores[loadedComponents] > 0.0f) {
                    s->componentSubScores[loadedComponents][0] = s->componentScores[loadedComponents];
                    s->componentMaxScores[loadedComponents][0] = 100.0f;
                    s->componentSubScoreCounts[loadedComponents] = 1;
                }

                loadedComponents++;
                p = objEnd + 1;
                p = skipWS(p);
                if (*p == ',') p++;
            }
        }
    }

    if (loadedComponents > 0) {
        s->componentCount = loadedComponents;
    } else {
        s->componentCount = 3;
        strncpy(s->componentNames[0], "Quiz", MAX_COMPONENT_NAME - 1);
        strncpy(s->componentNames[1], "Exam", MAX_COMPONENT_NAME - 1);
        strncpy(s->componentNames[2], "Assignment", MAX_COMPONENT_NAME - 1);
        s->componentWeights[0] = s->quizWeight;
        s->componentWeights[1] = s->examWeight;
        s->componentWeights[2] = s->assignmentWeight;
        s->componentScores[0] = s->quizScore;
        s->componentScores[1] = s->examScore;
        s->componentScores[2] = s->assignmentScore;
        for (int i = 0; i < s->componentCount; i++) {
            if (s->componentScores[i] > 0.0f) {
                s->componentSubScores[i][0] = s->componentScores[i];
                s->componentMaxScores[i][0] = 100.0f;
                s->componentSubScoreCounts[i] = 1;
            }
        }
    }

    computeWeightedGrade(s);

#undef LOAD_STR
#undef LOAD_FLOAT
#undef LOAD_INT

    return end + 1;
}

/* Parse one task object.  Returns pointer past '}'. */
static const char *parseTask(const char *start, const char *end, Task *t) {
    initTask(t);
    const char *p;

#define LOAD_TSTR(key, field, maxlen)                      \
    p = findKey(start, key);                               \
    if (p && p < end) {                                    \
        p = skipWS(p);                                     \
        readStr(p, t->field, maxlen);                      \
    }

#define LOAD_TINT(key, field)                              \
    p = findKey(start, key);                               \
    if (p && p < end) {                                    \
        p = skipWS(p);                                     \
        readInt(p, &t->field);                             \
    }

    LOAD_TINT ("id",          id)
    LOAD_TSTR ("subjectName", subjectName, MAX_NAME)
    LOAD_TSTR ("description", description, MAX_DESC)
    LOAD_TSTR ("type",        type,        20)
    LOAD_TSTR ("status",      status,      20)
    LOAD_TSTR ("link",        link,        MAX_LINK)
    LOAD_TINT ("year",        year)
    LOAD_TINT ("month",       month)
    LOAD_TINT ("day",         day)
    LOAD_TINT ("hour",        hour)
    LOAD_TINT ("minute",      minute)

#undef LOAD_TSTR
#undef LOAD_TINT

    return end + 1;
}

/* ── Main load function ── */
void loadData(Subject subjects[], int *subjectCount,
              Task    tasks[],   int *taskCount) {
    *subjectCount = 0;
    *taskCount    = 0;

    FILE *fp = fopen(DATA_FILE, "r");
    if (!fp) {
        printf("[fileio] No existing data file — starting fresh.\n");
        return;
    }

    /* Read entire file into memory */
    fseek(fp, 0, SEEK_END);
    long fsize = ftell(fp);
    rewind(fp);

    char *buf = (char *)malloc(fsize + 1);
    if (!buf) { fclose(fp); return; }

    size_t bytesRead = fread(buf, 1, fsize, fp);
    buf[bytesRead] = '\0';
    fclose(fp);

    /* ── Parse subjects array ── */
    const char *subsStart = strstr(buf, "\"subjects\":");
    if (subsStart) {
        subsStart = strchr(subsStart, '[');
        if (subsStart) {
            subsStart++;   /* skip '[' */
            const char *cur = subsStart;
            while (*subjectCount < MAX_SUBJECTS) {
                cur = skipWS(cur);
                if (*cur == ']') break;
                if (*cur != '{') { cur++; continue; }

                /* Find matching '}' (depth counting) */
                int depth = 0;
                const char *objStart = cur;
                const char *objEnd   = cur;
                for (const char *q = cur; *q; q++) {
                    if (*q == '{') depth++;
                    else if (*q == '}') { depth--; if (depth == 0) { objEnd = q; break; } }
                }
                parseSubject(objStart + 1, objEnd,
                             &subjects[*subjectCount]);
                (*subjectCount)++;
                cur = objEnd + 1;
                cur = skipWS(cur);
                if (*cur == ',') cur++;
            }
        }
    }

    /* ── Parse tasks array ── */
    const char *tasksStart = strstr(buf, "\"tasks\":");
    if (tasksStart) {
        tasksStart = strchr(tasksStart, '[');
        if (tasksStart) {
            tasksStart++;
            const char *cur = tasksStart;
            while (*taskCount < MAX_TASKS) {
                cur = skipWS(cur);
                if (*cur == ']') break;
                if (*cur != '{') { cur++; continue; }

                int depth = 0;
                const char *objStart = cur;
                const char *objEnd   = cur;
                for (const char *q = cur; *q; q++) {
                    if (*q == '{') depth++;
                    else if (*q == '}') { depth--; if (depth == 0) { objEnd = q; break; } }
                }
                parseTask(objStart + 1, objEnd,
                          &tasks[*taskCount]);
                (*taskCount)++;
                cur = objEnd + 1;
                cur = skipWS(cur);
                if (*cur == ',') cur++;
            }
        }
    }

    free(buf);
    printf("[fileio] Loaded %d subject(s) and %d task(s) from %s\n",
           *subjectCount, *taskCount, DATA_FILE);
}
