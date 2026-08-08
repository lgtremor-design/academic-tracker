# Academic Tracker

Academic Tracker is a local student academic management system. It combines subject management, grade tracking, task planning, schedules, analytics, study timers, and local backups in one browser-based interface backed by a small C HTTP server.

## Purpose

Students often track grades, deadlines, schedules, absences, notes, and study time in separate places. Academic Tracker keeps those records together so a student can monitor academic progress and plan work from one dashboard.

## Features

- Subject management with notes, units, schedules, absences, study targets, and grade criteria
- Weighted grade tracking with multiple grading components and score entries
- Task management with status, type, deadlines, links, filtering, sorting, and search
- Calendar view for task deadlines
- Weekly schedule view with subject schedules and custom schedule items
- Subject folders with long-form notes and browser-local file attachments
- Analytics dashboard for grades, tasks, priorities, absences, and study progress
- Study timer with free-study and Pomodoro-style tracking
- JSON backup export and import
- Theme selector with a clean light mode and optional visual themes

## Technologies Used

- C for the backend HTTP server and data persistence
- HTML, CSS, and plain JavaScript for the frontend
- Browser `localStorage` for frontend-only preferences, custom schedule items, reminders, and note attachments
- JSON file storage for backend-managed subjects and tasks
- Makefile/GCC build flow
- Winsock on Windows and POSIX sockets on macOS/Linux

## Project Structure

```text
final_project/
├── backend/
│   ├── main.c                 # Backend entry point
│   ├── server.c               # Server setup and request loop
│   ├── server_dispatch.c      # Route dispatching
│   ├── server_routes.c        # HTTP route handlers
│   ├── server_utils.c/.h      # HTTP and parsing helpers
│   ├── subject.c/.h           # Subject data and grade behavior
│   ├── task.c/.h              # Task data behavior
│   ├── analytics.c/.h         # Analytics calculations
│   ├── fileio.c/.h            # JSON persistence
│   ├── config.h               # Limits, port, and data filename
│   └── Makefile               # Build commands
├── frontend/
│   ├── index.html             # Main application page
│   ├── style.css              # Application styling
│   ├── app.js                 # Frontend load-order note
│   ├── js/                    # Browser JavaScript modules
│   └── assets/                # Theme images
├── .gitignore
└── README.md
```

## Requirements

For normal use on Windows:

- A modern web browser
- The backend executable, if already built

For development or rebuilding:

- GCC or a compatible C compiler
- `make` or a shell capable of running the compile command manually
- On Windows, the Winsock library is linked with `-lws2_32`

## How to Build

From the `backend` folder:

```bash
make
```

On Windows, this builds:

```text
academic_tracker.exe
```

You can also compile manually on Windows:

```bash
gcc main.c server.c server_utils.c server_routes.c server_dispatch.c subject.c task.c analytics.c fileio.c -o academic_tracker.exe -lws2_32
```

On macOS or Linux:

```bash
gcc main.c server.c server_utils.c server_routes.c server_dispatch.c subject.c task.c analytics.c fileio.c -o academic_tracker
```

## How to Run

1. Open a terminal in the `backend` folder.
2. Start the backend:

   ```bash
   ./academic_tracker.exe
   ```

   If you built on macOS or Linux, run:

   ```bash
   ./academic_tracker
   ```

3. Open `frontend/index.html` in a browser.
4. Keep the backend terminal open while using the app.

The frontend sends requests to:

```text
http://127.0.0.1:8080
```

## How Data Is Saved

Backend-managed subjects and tasks are saved locally in:

```text
backend/novi_data.json
```

The filename is kept for compatibility with the existing project data. This file is runtime data and is intentionally ignored by Git.

Some frontend-only data is saved in the browser using `localStorage`, including custom schedule slots, reminders, study timer state, student name, theme selection, and subject folder attachments.

## API Routes

The frontend uses these local backend routes:

- `GET /health`
- `GET /subjects`
- `POST /subjects`
- `POST /subjects/score`
- `POST /subjects/criteria`
- `POST /subjects/meta`
- `POST /subjects/studyhours`
- `DELETE /subjects/{name}`
- `GET /tasks`
- `POST /tasks`
- `PUT /tasks/{id}`
- `PUT /tasks/{id}/status`
- `DELETE /tasks/{id}`
- `GET /analytics`
- `GET /backup`
- `POST /backup`

## GitHub Notes

The repository is configured to exclude generated and private local files, including:

- Compiled executables such as `.exe`
- Object/build output files
- Runtime data files such as `backend/novi_data.json`
- Local backup JSON files
- `.env` files and common key/certificate formats
- Editor, OS, log, and temporary files

Source code, frontend assets, the Makefile, `.gitignore`, and this README are intended to be committed.

## Security and Privacy

No API keys, passwords, access tokens, or private credentials are required for the current project. Do not commit personal runtime data, exported backups, or `.env` files if you add configuration later.

## Limitations

- The backend is a simple single-threaded local HTTP server.
- Data is stored locally, not in a cloud database.
- The frontend expects the backend to run on port `8080`.
- Subject folder attachments are stored in browser local storage, so they are tied to the browser and machine.
- This is an academic project, not a production multi-user web service.

## Future Improvements

- Add a configurable backend port
- Add automated tests for route handlers and JSON persistence
- Add stronger JSON parsing and validation
- Package the app with a simpler launcher
- Add optional cloud sync or database storage

## Author

Final academic project by the repository owner.
