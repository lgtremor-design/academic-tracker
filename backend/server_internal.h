#ifndef SERVER_INTERNAL_H
#define SERVER_INTERNAL_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  typedef int socklen_t;
  #define CLOSE_SOCKET(s) closesocket(s)
  #define SOCK_ERR        SOCKET_ERROR
#else
  #include <unistd.h>
  #include <sys/types.h>
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  typedef int SOCKET;
  #define INVALID_SOCKET  (-1)
  #define CLOSE_SOCKET(s) close(s)
  #define SOCK_ERR        (-1)
#endif

#include "server.h"
#include "subject.h"
#include "task.h"
#include "event.h"
#include "analytics.h"
#include "fileio.h"
#include "config.h"

extern Subject *g_subjects;
extern int     *g_subjectCount;
extern Task    *g_tasks;
extern int     *g_taskCount;
extern CalendarEvent *g_events;
extern int     *g_eventCount;
extern int      g_nextTaskId;
extern int      g_nextEventId;

void refreshNextTaskId(void);
void refreshNextEventId(void);

const char *jsonFindKeyValue(const char *json, const char *key);
int jsonGetStr(const char *json, const char *key, char *dst, int dstlen);
int jsonGetFloat(const char *json, const char *key, float *out);
int jsonGetInt(const char *json, const char *key, int *out);
void urlDecode(const char *src, char *dst, int dstlen);
void urlDecodePath(const char *src, char *dst, int dstlen);
int jsonGetComponents(const char *json, Subject *s);
int subjectHasInvalidScores(const Subject *s);

void sendResponse(SOCKET client, int statusCode, const char *statusText, const char *contentType, const char *body);
void send200(SOCKET c, const char *body);
void send201(SOCKET c, const char *body);
void send400(SOCKET c, const char *msg);
void send404(SOCKET c);
void send204(SOCKET c);

void handleGetSubjects(SOCKET client);
void handlePostSubject(SOCKET client, const char *body);
void handlePostScore(SOCKET client, const char *body);
void handlePostCriteria(SOCKET client, const char *body);
void handlePostSubjectMeta(SOCKET client, const char *body);
void handleDeleteSubject(SOCKET client, const char *path);
void handleGetTasks(SOCKET client);
void handlePostTask(SOCKET client, const char *body);
void handlePutTaskStatus(SOCKET client, const char *path, const char *body);
void handlePutTask(SOCKET client, const char *path, const char *body);
void handleDeleteTask(SOCKET client, const char *path);
void handleGetEvents(SOCKET client);
void handlePostEvent(SOCKET client, const char *body);
void handleDeleteEvent(SOCKET client, const char *path);
void handlePostStudyHours(SOCKET client, const char *body);
void handleGetBackup(SOCKET client);
void handlePostBackup(SOCKET client, const char *body);
void handleGetAnalytics(SOCKET client);
void handleHealth(SOCKET client);

void dispatchRequest(SOCKET client, char *request, int reqLen);

#endif
