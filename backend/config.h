/*
 * config.h
 * --------
 * Stores system settings and limits for Academic Tracker.
 */

#ifndef CONFIG_H
#define CONFIG_H

/* Maximum number of subjects and tasks */
#define MAX_SUBJECTS  50
#define MAX_TASKS     200
#define MAX_EVENTS    200

/* Maximum number of scores allowed */
#define MAX_SCORES    20

/* Maximum number of grade components */
#define MAX_GRADE_COMPONENTS 10

/* Maximum number of absences tracked per subject */
#define MAX_ABSENCES 6

/* Maximum number of sub scores inside a component */
#define MAX_COMPONENT_SUBSCORES 20


/* Maximum text lengths */

/* Maximum subject name length */
#define MAX_NAME   50

/* Maximum description length */
#define MAX_DESC   200

/* Maximum notes length */
#define MAX_NOTES  500

/* Maximum link length */
#define MAX_LINK   200

/* Maximum component name length */
#define MAX_COMPONENT_NAME 50


/* File used to save data */
#define DATA_FILE  "novi_data.json"


/* Server settings */

/* Server port number */
#define SERVER_PORT  8080

/* Maximum waiting connection requests */
#define BACKLOG      10          /* listen() queue depth      */

/* Size of incoming request data.
   The recv() loop reads until Content-Length is satisfied.
   32 KB gives ample room for even large POST bodies. */
#define RECV_BUF     32768       /* bytes for incoming request */

/* Size of outgoing response data.
   50 subjects x ~3 KB each = ~150 KB worst-case.
   256 KB gives comfortable headroom. */
#define SEND_BUF     262144      /* bytes for outgoing response*/

#endif /* CONFIG_H */
