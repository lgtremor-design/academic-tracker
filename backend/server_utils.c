#include "server_internal.h"

const char *jsonFindKeyValue(const char *json, const char *key) {
    size_t keyLen = strlen(key);

    for (const char *p = json; *p; p++) {
        if (*p != '"') continue;

        const char *start = p + 1;
        const char *q = start;
        int escaped = 0;

        while (*q) {
            if (escaped) {
                escaped = 0;
            } else if (*q == '\\') {
                escaped = 1;
            } else if (*q == '"') {
                break;
            }
            q++;
        }

        if (*q != '"') return NULL;

        const char *after = q + 1;
        while (*after == ' ' || *after == '\t' || *after == '\r' || *after == '\n') after++;

        if (*after == ':' && (size_t)(q - start) == keyLen && strncmp(start, key, keyLen) == 0) {
            after++;
            while (*after == ' ' || *after == '\t' || *after == '\r' || *after == '\n') after++;
            return after;
        }

        p = q;
    }

    return NULL;
}

int jsonGetStr(const char *json, const char *key, char *dst, int dstlen) {
    const char *p = jsonFindKeyValue(json, key);
    if (!p) return 0;
    if (*p != '"') return 0;
    p++;
    int n = 0;
    while (*p && *p != '"' && n < dstlen - 1) {
        if (*p == '\\' && *(p+1)) {
            p++;
            if (*p == 'n')       { dst[n++] = '\n'; }
            else if (*p == 'r')  { dst[n++] = '\r'; }
            else if (*p == 't')  { dst[n++] = '\t'; }
            else                 { dst[n++] = *p;   }
        } else {
            dst[n++] = *p;
        }
        p++;
    }
    dst[n] = '\0';
    return 1;
}

/* Extract numeric value for "key": number */
int jsonGetFloat(const char *json, const char *key, float *out) {
    const char *p = jsonFindKeyValue(json, key);
    if (!p) return 0;
    if (*p != '-' && (*p < '0' || *p > '9')) return 0;
    *out = (float)strtod(p, NULL);
    return 1;
}

int jsonGetInt(const char *json, const char *key, int *out) {
    float f = 0;
    if (!jsonGetFloat(json, key, &f)) return 0;
    *out = (int)f;
    return 1;
}

void urlDecode(const char *src, char *dst, int dstlen) {
    int n = 0;
    while (*src && n < dstlen - 1) {
        if (*src == '%' && src[1] && src[2]) {
            char hex[3] = { src[1], src[2], '\0' };
            dst[n++] = (char)strtol(hex, NULL, 16);
            src += 3;
        } else if (*src == '+') {
            dst[n++] = ' ';
            src++;
        } else {
            dst[n++] = *src++;
        }
    }
    dst[n] = '\0';
}

/* Path-segment decode: like urlDecode but treats '+' as a literal '+',
   not a space.  Use this for values extracted from the URL path, not
   from query strings. (#7) */
void urlDecodePath(const char *src, char *dst, int dstlen) {
    int n = 0;
    while (*src && n < dstlen - 1) {
        if (*src == '%' && src[1] && src[2]) {
            char hex[3] = { src[1], src[2], '\0' };
            dst[n++] = (char)strtol(hex, NULL, 16);
            src += 3;
        } else {
            dst[n++] = *src++;
        }
    }
    dst[n] = '\0';
}

int jsonGetComponents(const char *json, Subject *s) {
    const char *p = strstr(json, "\"components\"");
    int count = 0;
    if (!p) return 0;

    p = strchr(p, '[');
    if (!p) return 0;
    p++;

    while (*p && count < MAX_GRADE_COMPONENTS) {
        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
        if (*p == ']') break;
        if (*p != '{') { p++; continue; }

        int depth = 0;
        const char *objStart = p;
        const char *objEnd = p;
        for (const char *q = p; *q; q++) {
            if (*q == '{') depth++;
            else if (*q == '}') {
                depth--;
                if (depth == 0) { objEnd = q; break; }
            }
        }

        char tmp[4096];
        int len = (int)(objEnd - objStart + 1);
        if (len >= (int)sizeof(tmp)) len = (int)sizeof(tmp) - 1;
        memcpy(tmp, objStart, len);
        tmp[len] = '\0';

        char componentName[MAX_COMPONENT_NAME] = {0};
        float weight = 0.0f;
        float score = 0.0f;

        jsonGetStr(tmp, "name", componentName, MAX_COMPONENT_NAME);
        jsonGetFloat(tmp, "weight", &weight);
        jsonGetFloat(tmp, "score", &score);

        if (componentName[0] == '\0') {
            snprintf(componentName, sizeof(componentName), "Component %d", count + 1);
        }
        if (weight < 0.0f) weight = 0.0f;
        if (weight > 100.0f) weight = 100.0f;
        if (score < 0.0f) score = 0.0f;
        if (score > 100.0f) score = 100.0f;

        strncpy(s->componentNames[count], componentName, MAX_COMPONENT_NAME - 1);
        s->componentWeights[count] = weight;
        s->componentScores[count] = score;

        int subCount = 0;
        const char *sp = strstr(tmp, "\"scores\"");
        if (sp) {
            sp = strchr(sp, '[');
            if (sp) {
                sp++;
                while (*sp && subCount < MAX_COMPONENT_SUBSCORES) {
                    while (*sp == ' ' || *sp == '\t' || *sp == '\n' || *sp == '\r' || *sp == ',') sp++;
                    if (*sp == ']') break;
                    if (*sp != '{') { sp++; continue; }

                    int sdepth = 0;
                    const char *scoreObjStart = sp;
                    const char *scoreObjEnd = sp;
                    for (const char *q = sp; *q; q++) {
                        if (*q == '{') sdepth++;
                        else if (*q == '}') {
                            sdepth--;
                            if (sdepth == 0) { scoreObjEnd = q; break; }
                        }
                    }

                    char scoreObj[256];
                    int scoreLen = (int)(scoreObjEnd - scoreObjStart + 1);
                    if (scoreLen >= (int)sizeof(scoreObj)) scoreLen = (int)sizeof(scoreObj) - 1;
                    memcpy(scoreObj, scoreObjStart, scoreLen);
                    scoreObj[scoreLen] = '\0';

                    float earned = 0.0f;
                    float maxScore = 0.0f;
                    jsonGetFloat(scoreObj, "score", &earned);
                    if (!jsonGetFloat(scoreObj, "maxScore", &maxScore)) {
                        jsonGetFloat(scoreObj, "max", &maxScore);
                    }

                    if (maxScore > 0.0f) {
                        s->componentSubScores[count][subCount] = earned;
                        s->componentMaxScores[count][subCount] = maxScore;
                        subCount++;
                    }

                    sp = scoreObjEnd + 1;
                }
            }
        }

        if (subCount > 0) {
            s->componentSubScoreCounts[count] = subCount;
        } else if (score > 0.0f) {
            s->componentSubScores[count][0] = score;
            s->componentMaxScores[count][0] = 100.0f;
            s->componentSubScoreCounts[count] = 1;
        }

        count++;

        p = objEnd + 1;
    }

    if (count > 0) {
        s->componentCount = count;
        return 1;
    }
    return 0;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   HTTP response helpers
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

int subjectHasInvalidScores(const Subject *s) {
    for (int i = 0; i < s->componentCount; i++) {
        int subCount = s->componentSubScoreCounts[i];
        if (subCount < 0 || subCount > MAX_COMPONENT_SUBSCORES) return 1;

        for (int j = 0; j < subCount; j++) {
            float score = s->componentSubScores[i][j];
            float maxScore = s->componentMaxScores[i][j];
            if (maxScore <= 0.0f) return 1;
            if (score < 0.0f || score > maxScore) return 1;
        }
    }
    return 0;
}

void sendResponse(SOCKET client,
                         int    statusCode,
                         const char *statusText,
                         const char *contentType,
                         const char *body) {
    char header[512];
    int bodyLen = body ? (int)strlen(body) : 0;

    int hLen = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %d\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n"
        "Connection: close\r\n"
        "\r\n",
        statusCode, statusText,
        contentType, bodyLen);

    send(client, header, hLen, 0);
    if (body && bodyLen > 0) {
        send(client, body, bodyLen, 0);
    }
}

void send200(SOCKET c, const char *body) {
    sendResponse(c, 200, "OK", "application/json", body);
}
void send201(SOCKET c, const char *body) {
    sendResponse(c, 201, "Created", "application/json", body);
}
void send400(SOCKET c, const char *msg) {
    char b[256];
    snprintf(b, sizeof(b), "{\"error\":\"%s\"}", msg);
    sendResponse(c, 400, "Bad Request", "application/json", b);
}
void send404(SOCKET c) {
    sendResponse(c, 404, "Not Found", "application/json", "{\"error\":\"Not found\"}");
}
void send204(SOCKET c) {
    sendResponse(c, 204, "No Content", "text/plain", NULL);
}



