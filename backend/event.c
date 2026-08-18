#include <stdio.h>
#include <string.h>
#include "event.h"
#include "subject.h"

void initCalendarEvent(CalendarEvent *event) {
    memset(event, 0, sizeof(*event));
    strncpy(event->color, "#3b82f6", sizeof(event->color) - 1);
}

int eventToJSON(const CalendarEvent *event, char *buf, int buflen) {
    char title[256];
    char note[512];
    char color[32];
    jsonEscape(event->title, title, sizeof(title));
    jsonEscape(event->note, note, sizeof(note));
    jsonEscape(event->color, color, sizeof(color));
    return snprintf(buf, buflen,
        "{\"id\":%d,\"title\":\"%s\",\"note\":\"%s\",\"year\":%d,\"month\":%d,\"day\":%d,\"color\":\"%s\"}",
        event->id, title, note, event->year, event->month, event->day, color);
}

int allEventsToJSON(CalendarEvent events[], int count, char *buf, int buflen) {
    int used = 0;
    if (buflen <= 0) return -1;
    buf[used++] = '[';
    for (int i = 0; i < count; i++) {
        char item[1024];
        int written = eventToJSON(&events[i], item, sizeof(item));
        if (written < 0 || used + written + 2 >= buflen) return -1;
        if (i > 0) buf[used++] = ',';
        memcpy(buf + used, item, (size_t)written);
        used += written;
    }
    buf[used++] = ']';
    buf[used] = '\0';
    return used;
}
