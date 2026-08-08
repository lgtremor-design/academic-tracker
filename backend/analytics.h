/*
 * analytics.h
 * -----------
 * Handles grade analysis and task priorities.
 */

#ifndef ANALYTICS_H
#define ANALYTICS_H

#include "subject.h"
#include "task.h"

/* Stores analysis results for one subject */
typedef struct {

    /* Name of the subject */
    char  subjectName[MAX_NAME];

    /* Current average score */
    float average;

    /* Grade after applying weights */
    float weightedGrade;

    /* Equivalent grade value */
    float equivalentGrade;

    /* Number of units */
    float units;

    /* Expected final grade */
    float projectedFinal;

    /* Difference between goal and current grade */
    float goalGap;          /* goal - weightedGrade; negative = on track */

    /* Target study hours set by the user */
    float studyHours;

    /* Hours saved by the timer */
    float trackedStudyHours;

    /* Target hours minus timer hours */
    float remainingStudyHours;

    /* Performance level */
    char  performance[20];  /* "Excellent"|"Good"|"Passing"|"Needs Work" */

    /* Lowest scoring part */
    char  weakArea[MAX_COMPONENT_NAME]; /* component name of weakest area */

    /* Suggested action for improvement */
    char  suggestion[256];

} SubjectAnalytics;


/* Function declarations */

/* Predict possible final grade */
float predictFinalGrade(const Subject *s);

/* Analyze subject performance */
SubjectAnalytics analyseSubject(const Subject *s);

/* Convert analytics data into JSON format */
int analyticsToJSON(SubjectAnalytics a[], int count,
                    Task tasks[], int taskCount,
                    char *buf, int buflen);

#endif /* ANALYTICS_H */
