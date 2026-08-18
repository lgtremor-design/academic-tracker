#ifndef EVENT_H
#define EVENT_H

#include "config.h"

typedef struct {
    int id;
    char title[128];
    char note[256];
    int year, month, day;
    char color[16];
} CalendarEvent;

void initCalendarEvent(CalendarEvent *event);
int eventToJSON(const CalendarEvent *event, char *buf, int buflen);
int allEventsToJSON(CalendarEvent events[], int count, char *buf, int buflen);

#endif
