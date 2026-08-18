CC ?= gcc
CFLAGS ?= -Wall -Wextra -std=c11
TARGET ?= academic_tracker
SRC = main.c server.c server_utils.c server_routes.c server_dispatch.c subject.c task.c analytics.c fileio.c event.c

ifeq ($(OS),Windows_NT)
  TARGET := academic_tracker.exe
  LDLIBS += -lws2_32
endif

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET) $(LDLIBS)

clean:
	rm -f novi novi.exe academic_tracker academic_tracker.exe at.exe
