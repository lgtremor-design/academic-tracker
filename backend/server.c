/*
 * server.c
 * --------
 * Owns the backend server globals and the blocking accept loop.
 * Request parsing helpers, route handlers and dispatch live in the
 * server_* modules so the backend is easier to navigate.
 */

#include "server_internal.h"

Subject *g_subjects;
int     *g_subjectCount;
Task    *g_tasks;
int     *g_taskCount;
CalendarEvent *g_events;
int     *g_eventCount;
int      g_nextTaskId = 1;
int      g_nextEventId = 1;

void refreshNextTaskId(void) {
    g_nextTaskId = 1;
    for (int i = 0; i < *g_taskCount; i++) {
        if (g_tasks[i].id >= g_nextTaskId) g_nextTaskId = g_tasks[i].id + 1;
    }
}
void refreshNextEventId(void) {
    g_nextEventId = 1;
    for (int i = 0; i < *g_eventCount; i++) {
        if (g_events[i].id >= g_nextEventId) g_nextEventId = g_events[i].id + 1;
    }
}

void runServer(Subject subjects[], int *subjectCount,
               Task    tasks[],   int *taskCount,
               CalendarEvent events[], int *eventCount) {

    /* Remember where the subject and task lists are kept. */
    g_subjects      = subjects;
    g_subjectCount  = subjectCount;
    g_tasks         = tasks;
    g_taskCount     = taskCount;
    g_events        = events;
    g_eventCount    = eventCount;

    /* Make sure the next task ID does not repeat an old one. */
    refreshNextTaskId();
    refreshNextEventId();

/* â”€â”€ Winsock init â”€â”€ */
#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2,2), &wsa) != 0) {
        fprintf(stderr, "WSAStartup failed\n"); return;
    }
#endif

    SOCKET listenSock = socket(AF_INET, SOCK_STREAM, 0);
    if (listenSock == INVALID_SOCKET) {
        perror("socket"); return;
    }

    /* Let the backend restart without waiting too long for the port. */
    int opt = 1;
    setsockopt(listenSock, SOL_SOCKET, SO_REUSEADDR,
               (const char *)&opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family      = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port        = htons(SERVER_PORT);

    if (bind(listenSock, (struct sockaddr *)&addr, sizeof(addr)) == SOCK_ERR) {
        perror("bind"); CLOSE_SOCKET(listenSock); return;
    }
    if (listen(listenSock, BACKLOG) == SOCK_ERR) {
        perror("listen"); CLOSE_SOCKET(listenSock); return;
    }

    printf("\n========================================\n");
    printf("  Academic Tracker backend running on port %d\n", SERVER_PORT);
    printf("  Open frontend/index.html in your browser\n");
    printf("  Press Ctrl+C to stop\n");
    printf("========================================\n\n");

    /* Make space for one browser request. */
    char *recvBuf = (char *)malloc(RECV_BUF);
    if (!recvBuf) { CLOSE_SOCKET(listenSock); return; }

    /* â”€â”€ Accept loop â”€â”€ */
    for (;;) {
        struct sockaddr_in clientAddr;
        socklen_t clientLen = sizeof(clientAddr);
        SOCKET clientSock = accept(listenSock,
                                   (struct sockaddr *)&clientAddr,
                                   &clientLen);
        if (clientSock == INVALID_SOCKET) {
            perror("accept"); continue;
        }

        /* Clear the request space before reading a new request. */
        memset(recvBuf, 0, RECV_BUF);

        /* Read until we have the full request (headers + body).
           A single recv() call is not guaranteed to return all bytes â€”
           TCP may deliver them in multiple segments, and POST bodies
           larger than one segment would otherwise be silently truncated. */
        /* Count how much of the request has been received. */
        int total = 0;
        for (;;) {
            int n = recv(clientSock, recvBuf + total, RECV_BUF - 1 - total, 0);
            if (n <= 0) break;
            total += n;
            recvBuf[total] = '\0';

            /* Check if headers are fully received */
            char *headerEnd = strstr(recvBuf, "\r\n\r\n");
            if (!headerEnd) {
                if (total >= RECV_BUF - 1) break; /* no more room */
                continue;
            }

            /* Parse Content-Length to know when body is complete */
            const char *clHeader = strstr(recvBuf, "Content-Length:");
            if (!clHeader) clHeader = strstr(recvBuf, "content-length:");
            if (clHeader) {
                int contentLen = 0;
                sscanf(clHeader + 15, " %d", &contentLen);
                int bodyStart = (int)(headerEnd - recvBuf) + 4;
                int bodyReceived = total - bodyStart;
                if (bodyReceived >= contentLen) break; /* full body in buffer */
                if (total >= RECV_BUF - 1) break;      /* buffer full, proceed anyway */
            } else {
                break; /* no body expected (GET/DELETE), headers complete */
            }
        }
        int bytesRecv = total;
        if (bytesRecv > 0) {
            dispatchRequest(clientSock, recvBuf, bytesRecv);
        }

        CLOSE_SOCKET(clientSock);
    }

    free(recvBuf);
    CLOSE_SOCKET(listenSock);
#ifdef _WIN32
    WSACleanup();
#endif
}


