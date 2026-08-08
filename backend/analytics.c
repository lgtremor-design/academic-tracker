/*
 * analytics.c
 * -----------
 * Handles subject grade analysis and task priority summaries.
 */

#include <stdio.h>
#include <string.h>
#include "analytics.h"
#include "subject.h"   /* jsonEscape() */

/* Predict final grade using weighted grade or average */
float predictFinalGrade(const Subject *s) {

    /* Use weighted grade if available, otherwise use average grade */
    return (s->weightedGrade > 0.0f) ? s->weightedGrade : s->average;
}

/* Find the lowest scoring component of a subject */
static const char *weakArea(const Subject *s) {

    /* Stores index of weakest component */
    int idx = -1;

    /* Set high value so lower scores can replace it */
    float lowest = 101.0f;

    /* Check every grade component */
    for (int i = 0; i < s->componentCount && i < MAX_GRADE_COMPONENTS; i++) {

        /* Skip empty scores */
        if (s->componentScores[i] <= 0.0f)
            continue;

        /* Update lowest score found */
        if (s->componentScores[i] < lowest) {
            lowest = s->componentScores[i];
            idx = i;
        }
    }

    /* Return component name or N/A if none exists */
    return (idx == -1) ? "N/A" : s->componentNames[idx];
}

/* Create study suggestions based on performance */
static void buildSuggestion(const Subject *s, float grade,
                            char *out, int outlen) {

    /* No scores entered */
    if (grade == 0.0f) {
        snprintf(out, outlen,
                 "Enter scores to receive suggestions.");
        return;
    }

    /* Suggestion based on grade range */
    if (grade >= 90.0f) {
        snprintf(out, outlen,
                 "Excellent! Maintain your current study habits.");

    } else if (grade >= 80.0f) {
        snprintf(out, outlen,
                 "Good performance. Review %s to push higher.",
                 weakArea(s));

    } else if (grade >= 75.0f) {
        snprintf(out, outlen,
                 "You are passing. Focus more on %s and increase study frequency.",
                 weakArea(s));

    } else {
        snprintf(out, outlen,
                 "Grade needs improvement. %s is your weakest area — allocate more time there.",
                 weakArea(s));
    }
}

/* Analyze one subject and store results */
SubjectAnalytics analyseSubject(const Subject *s) {

    SubjectAnalytics a;

    /* Initialize structure with zero values */
    memset(&a, 0, sizeof(a));

    /* Copy subject name */
    strncpy(a.subjectName, s->name, MAX_NAME - 1);

    /* Store grade information */
    a.average = s->average;
    a.weightedGrade = s->weightedGrade;
    a.equivalentGrade = s->equivalentGrade;
    a.units = s->units;

    /* Predict possible final grade */
    a.projectedFinal = predictFinalGrade(s);

    /* Difference between goal and current grade */
    a.goalGap = s->goal - a.weightedGrade;
    /* Copy study target and timer progress into analytics. */
    a.studyHours = s->studyHours;
    a.trackedStudyHours = s->trackedStudyHours;
    a.remainingStudyHours = s->studyHours - s->trackedStudyHours;
    if (a.remainingStudyHours < 0.0f) {
        a.remainingStudyHours = 0.0f;
    }

    float g = a.projectedFinal;

    /* Determine performance category */
    if (g >= 90.0f)
        strncpy(a.performance, "Excellent", 19);

    else if (g >= 80.0f)
        strncpy(a.performance, "Good", 19);

    else if (g >= 75.0f)
        strncpy(a.performance, "Passing", 19);

    else
        strncpy(a.performance, "Needs Work", 19);

    /* Save weakest area and suggestion */
    strncpy(a.weakArea, weakArea(s), 19);

    buildSuggestion(s, g, a.suggestion, 255);

    return a;
}

/*
 * Convert analytics information into JSON format
 */
int analyticsToJSON(SubjectAnalytics a[], int count,
                    Task tasks[], int taskCount,
                    char *buf, int buflen) {

    int pos = 0;

    /* Start JSON subject array */
    pos += snprintf(buf + pos, buflen - pos,
                    "{\"subjects\":[");

    for (int i = 0; i < count; i++) {

        /* Add comma between items */
        if (i)
            buf[pos++] = ',';

        /* Variables for safe text storage */
        char eName[MAX_NAME * 2];
        char eSugg[512 * 2];
        char ePerf[48 * 2];
        char eWeak[MAX_COMPONENT_NAME * 2];  /* #15: sized for full component name */

        /* Full JSON escape — handles ", \, newlines, tabs (#6) */
        jsonEscape(a[i].subjectName, eName, sizeof(eName));
        jsonEscape(a[i].suggestion,  eSugg, sizeof(eSugg));
        jsonEscape(a[i].performance, ePerf, sizeof(ePerf));
        jsonEscape(a[i].weakArea,    eWeak, sizeof(eWeak));

        /* Add subject data to JSON */
        pos += snprintf(buf + pos,
                        buflen - pos,
                        "{\"name\":\"%s\","
                        "\"average\":%.2f,"
                        "\"weightedGrade\":%.2f,"
                        "\"equivalentGrade\":%.2f,"
                        "\"units\":%.2f,"
                        "\"projectedFinal\":%.2f,"
                        "\"goalGap\":%.2f,"
                        "\"studyHours\":%.2f,"
                        "\"trackedStudyHours\":%.2f,"
                        "\"remainingStudyHours\":%.2f,"
                        "\"performance\":\"%s\","
                        "\"weakArea\":\"%s\","
                        "\"suggestion\":\"%s\"}",
                        eName,
                        a[i].average,
                        a[i].weightedGrade,
                        a[i].equivalentGrade,
                        a[i].units,
                        a[i].projectedFinal,
                        a[i].goalGap,
                        a[i].studyHours,
                        a[i].trackedStudyHours,
                        a[i].remainingStudyHours,
                        ePerf,
                        eWeak,
                        eSugg);
    }

    float gwaWeighted = 0.0f;
    float gwaUnits = 0.0f;

    /* Compute General Weighted Average */
    for (int i=0;i<count;i++) {

        if(a[i].units<=0.0f)
            continue;

        gwaWeighted +=
        a[i].equivalentGrade * a[i].units;

        gwaUnits += a[i].units;
    }

    float gwa =
        (gwaUnits<=0.0f)?
        0.0f :
        (gwaWeighted/gwaUnits);

    /* Start task JSON array */
    pos += snprintf(buf+pos,
                    buflen-pos,
                    "],\"gwa\":%.2f,\"tasks\":[",
                    gwa);

    for(int i=0;i<taskCount;i++){

        if(i)
            buf[pos++]=',';

        /* Calculate days remaining */
        int days=
        computeDaysRemaining(&tasks[i]);

        const char *prio;

        /* Assign task priority level */
        if(days<=1)
            prio="URGENT";

        else if(days<=3)
            prio="HIGH";

        else if(days<=7)
            prio="MEDIUM";

        else
            prio="LOW";

        /* Escape quotation marks in description */
        char eDesc[MAX_DESC*2];

        int ni2=0;

        for(const char *p=tasks[i].description;
            *p && ni2<(int)sizeof(eDesc)-2;
            p++){

            if(*p=='"')
                eDesc[ni2++]='\\';

            eDesc[ni2++]=*p;
        }

        eDesc[ni2]='\0';

        /* Add task information to JSON */
        pos += snprintf(buf+pos,
                        buflen-pos,
                        "{\"id\":%d,\"description\":\"%s\",\"priority\":\"%s\",\"daysRemaining\":%d}",
                        tasks[i].id,
                        eDesc,
                        prio,
                        days);
    }

    /* End JSON object */
    pos += snprintf(buf+pos,
                    buflen-pos,
                    "]}");

    return pos;
}
