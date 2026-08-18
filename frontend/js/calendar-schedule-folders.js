/* ==========================================================
   Calendar, Schedule, and Course Folders
   ========================================================== */

function getCalendarContext() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    month: now.getMonth() + 1,
    monthName: now.toLocaleString(undefined, { month: "long", year: "numeric" })
  };
}

function getTasksForDate(year, month, day) {
  return tasks.filter(task =>
    safeNumber(task.year) === year &&
    safeNumber(task.month) === month &&
    safeNumber(task.day) === day
  );
}

function getEventsForDate(year, month, day) {
  return events.filter(calendarEvent =>
    safeNumber(calendarEvent.year) === year &&
    safeNumber(calendarEvent.month) === month &&
    safeNumber(calendarEvent.day) === day
  );
}

function formatTaskTime(task) {
  const hour = safeNumber(task.hour, 0);
  const minute = safeNumber(task.minute, 0);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function calendarDeadlineMarkup(dayTasks, dayEvents = []) {
  if (!dayTasks.length && !dayEvents.length) return "";
  const visible = sortTasksForView(dayTasks).slice(0, 2);
  const extra = dayTasks.length - visible.length;
  return `
    <div class="calendar-deadlines">
      ${visible.map(task => {
        const days = getDaysLeft(task);
        const tone = days < 0 ? "urgent" : days <= 1 ? "urgent" : days <= 3 ? "high" : "normal";
        return `
          <div class="calendar-task ${tone}">
            <strong>${escapeHtml(task.subjectName || "General")}</strong>
            <span>${escapeHtml(task.description)}</span>
          </div>
        `;
      }).join("")}
      ${extra > 0 ? `<div class="calendar-more">+${extra} more</div>` : ""}
    </div>
    <div class="calendar-events">
      ${dayEvents.map(calendarEvent => `
        <button type="button" class="calendar-event" style="--event-color:${escapeAttr(calendarEvent.color || "#3b82f6")}" onclick="openCalendarEvent(event, ${safeNumber(calendarEvent.id)})" title="${escapeAttr(calendarEvent.title)}">
          <span class="calendar-event-dot"></span>
          <span>${escapeHtml(calendarEvent.title)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderCalendarMarkup() {
  const { year, monthIndex, month, monthName } = getCalendarContext();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(`<div class="calendar-cell muted"></div>`);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayTasks = getTasksForDate(year, month, day);
    const dayEvents = getEventsForDate(year, month, day);
    const itemCount = dayTasks.length + dayEvents.length;
    const hasDeadlines = itemCount > 0;
    cells.push(`
      <div class="calendar-cell ${hasDeadlines ? "has-deadlines" : ""}" onclick="openDeadlineModal(${year}, ${month}, ${day})" title="View calendar items for this date">
        <div class="calendar-day">${day}${hasDeadlines ? `<span class="calendar-badge">${itemCount}</span>` : ""}</div>
        ${calendarDeadlineMarkup(dayTasks, dayEvents)}
      </div>
    `);
  }

  return `
    <div class="calendar-title">${monthName}</div>
    <div class="calendar-weekdays">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("")}
    </div>
    <div class="calendar-days">${cells.join("")}</div>
  `;
}

function renderCalendar() {
  const markup = renderCalendarMarkup();
  const containers = [$("calendarGrid"), $("dashboardCalendar")];
  containers.forEach(container => {
    if (container) container.innerHTML = markup;
  });
}

function setCalendarEventColor(color) {
  const picker = $("calendarEventColor");
  if (picker) picker.value = color;
}

async function addCalendarEvent(formEvent) {
  if (formEvent) formEvent.preventDefault();
  const title = $("calendarEventTitle")?.value.trim();
  const date = $("calendarEventDate")?.value;
  const note = $("calendarEventNote")?.value.trim() || "";
  const color = $("calendarEventColor")?.value || "#3b82f6";
  if (!title || !date) {
    showToast("Enter an event title and date", "warn");
    return;
  }

  const [year, month, day] = date.split("-").map(Number);
  try {
    events = await api("/events", {
      method: "POST",
      body: JSON.stringify({ title, note, year, month, day, color })
    });
    $("calendarEventForm")?.reset();
    setCalendarEventColor("#3b82f6");
    renderCalendar();
    showToast("Calendar event added");
  } catch (err) {
    showToast("Unable to add calendar event: " + err.message, "err");
  }
}

function openCalendarEvent(clickEvent, eventId) {
  clickEvent?.stopPropagation();
  const calendarEvent = events.find(item => safeNumber(item.id) === safeNumber(eventId));
  const popover = $("calendarEventPopover");
  const title = $("calendarEventPopoverTitle");
  const note = $("calendarEventPopoverNote");
  if (!calendarEvent || !popover || !title || !note) return;

  popover.dataset.eventId = String(calendarEvent.id);
  popover.style.setProperty("--event-color", calendarEvent.color || "#3b82f6");
  title.textContent = calendarEvent.title;
  note.textContent = calendarEvent.note || "No note added.";
  popover.classList.remove("hide");
}

function closeCalendarEventPopover(clickEvent) {
  if (clickEvent && clickEvent.target !== clickEvent.currentTarget) return;
  $("calendarEventPopover")?.classList.add("hide");
}

async function deleteCalendarEvent() {
  const popover = $("calendarEventPopover");
  const eventId = popover?.dataset.eventId;
  if (eventId) await deleteCalendarEventById(eventId);
}

async function deleteCalendarEventById(eventId) {
  if (!eventId || !confirm("Delete this calendar event?")) return;
  const popover = $("calendarEventPopover");
  try {
    events = await api(`/events/${eventId}`, { method: "DELETE" });
    popover?.classList.add("hide");
    renderCalendar();
    showToast("Calendar event deleted");
  } catch (err) {
    showToast("Unable to delete calendar event: " + err.message, "err");
  }
}

function openDeadlineModal(year, month, day) {
  const modal = $("deadlineModal");
  const title = $("deadlineModalTitle");
  const body = $("deadlineModalBody");
  if (!modal || !title || !body) return;

  const date = new Date(year, month - 1, day);
  const dayTasks = getTasksForDate(year, month, day);
  const dayEvents = getEventsForDate(year, month, day);
  title.textContent = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  if (!dayTasks.length && !dayEvents.length) {
    body.innerHTML = `<div class="empty-state">No calendar items on this day.</div>`;
  } else {
    body.innerHTML = dayTasks.map(task => `
      <div class="deadline-item">
        <div class="deadline-item-head">
          <strong>${escapeHtml(task.subjectName || "General")}</strong>
          <span class="deadline-time">${formatTaskTime(task)}</span>
        </div>
        <p>${escapeHtml(task.description || "Untitled task")}</p>
        <div style="margin-top:8px;">${badge(escapeHtml(task.status || "Not Started"), task.status === "Done" ? "green" : task.status === "In Progress" ? "blue" : "amber")}</div>
      </div>
    `).join("") + dayEvents.map(calendarEvent => `
      <div class="deadline-item calendar-event-detail" style="--event-color:${escapeAttr(calendarEvent.color || "#3b82f6")}">
        <div class="deadline-item-head">
          <strong>${escapeHtml(calendarEvent.title)}</strong>
          <span class="calendar-event-label">Event</span>
        </div>
        <p>${escapeHtml(calendarEvent.note || "No note added.")}</p>
        <button class="btn btn-danger btn-sm" onclick="deleteCalendarEventById(${safeNumber(calendarEvent.id)})">Delete Event</button>
      </div>
    `).join("");
  }

  modal.classList.remove("hide");
}

function closeDeadlineModal(event) {
  if (event && event.target && event.target.id !== "deadlineModal") return;
  const modal = $("deadlineModal");
  if (modal) modal.classList.add("hide");
}

function formatScheduleTime(subject) {
  const startHour = safeNumber(subject.scheduleStartHour);
  const endHour = safeNumber(subject.scheduleEndHour);
  if (!subject.scheduleDay || !endHour) return "No schedule set";
  const start = `${String(startHour).padStart(2, "0")}:${String(safeNumber(subject.scheduleStartMinute)).padStart(2, "0")}`;
  const end = `${String(endHour).padStart(2, "0")}:${String(safeNumber(subject.scheduleEndMinute)).padStart(2, "0")}`;
  return `${subject.scheduleDay}, ${start}-${end}`;
}

function renderSchedule() {
  const container = $("scheduleBoard");
  if (!container) return;

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  container.innerHTML = days.map(day => {
    const daySubjects = subjects.filter(subject => subject.scheduleDay === day);
    return `
      <div class="schedule-day">
        <h3>${day}</h3>
        ${daySubjects.length ? daySubjects.map(subject => `
          <div class="schedule-block">
            <strong>${escapeHtml(subject.name)}</strong>
            <span>${formatScheduleTime(subject)}</span>
            <small>${escapeHtml(subject.scheduleLocation || "No room set")}</small>
          </div>
        `).join("") : `<div class="empty-state">No classes.</div>`}
      </div>
    `;
  }).join("");
}

function subjectTasks(name) {
  return tasks.filter(task => task.subjectName === name);
}

function trendForSubject(subject) {
  // Build a chronological score series from all individual sub-scores across components.
  // Each entry in component.scores is {score, maxScore} - convert to percentage.
  let scores = [];
  if (Array.isArray(subject.components)) {
    subject.components.forEach(component => {
      const subScores = Array.isArray(component.scores) ? component.scores : [];
      subScores.forEach(item => {
        const max = safeNumber(item.maxScore ?? item.max);
        if (max > 0) {
          scores.push((safeNumber(item.score) / max) * 100);
        }
      });
    });
  }

  // Fall back to subject-level raw scores array if present
  if (scores.length === 0 && Array.isArray(subject.scores)) {
    scores = subject.scores.map(Number).filter(Number.isFinite);
  }

  // Not enough data to show a trend
  if (scores.length < 2) return { label: "Not enough data", color: "gray", points: scores };

  const delta = scores[scores.length - 1] - scores[0];
  if (delta > 0.5) return { label: "Improving", color: "green", points: scores };
  if (delta < -0.5) return { label: "Declining", color: "red", points: scores };
  return { label: "Stable", color: "blue", points: scores };
}

function trendSvg(points) {
  if (!points.length) return `<div class="empty-state">Add raw scores to see trend.</div>`;
  const values = points.length === 1 ? [points[0], points[0]] : points;
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 60 - Math.max(0, Math.min(100, value)) * 0.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="trend-chart" viewBox="0 0 100 64" preserveAspectRatio="none"><polyline points="${coords}"></polyline></svg>`;
}

function subjectInitial(subject) {
  return String(subject?.name || "?").trim().charAt(0).toUpperCase() || "?";
}

function subjectTheme(name) {
  return {
    color: "var(--accent)",
    color2: "var(--accent2)",
    soft: "var(--accent-dim)"
  };
}

function subjectThemeStyle(theme) {
  return `--subject-color:${theme.color}; --subject-color-2:${theme.color2}; --subject-soft:${theme.soft};`;
}

function trendValuesForSubject(subject) {
  const trend = trendForSubject(subject);
  let values = Array.isArray(trend.points)
    ? trend.points.map(value => Math.min(100, Math.max(0, safeNumber(value, NaN)))).filter(Number.isFinite)
    : [];

  // If there is exactly 1 real score, show it as a flat line - do NOT fabricate a fake start
  if (values.length === 1) values = [values[0], values[0]];

  // If there are no scores at all, show the weighted grade as a single point (flat line)
  if (values.length === 0) {
    const grade = Math.min(100, Math.max(0, safeNumber(subject.weightedGrade ?? subject.average ?? 0)));
    if (grade > 0) values = [grade, grade];
  }

  return values;
}

function trendBadgeClass(trend) {
  if (trend.color === "green") return "trend-good";
  if (trend.color === "red") return "trend-bad";
  return "trend-neutral";
}

function renderPerformanceTrendChart() {
  if (!subjects.length) return `<div class="empty-state">Add subjects to see performance trends.</div>`;

  const palette = ["var(--accent)", "var(--accent2)", "var(--teal)"];
  const width = 720;
  const height = 250;
  const left = 54;
  const right = 24;
  const top = 20;
  const bottom = 46;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const visible = subjects.slice(0, 6);
  const maxSteps = Math.max(2, ...visible.map(subject => trendValuesForSubject(subject).length));

  const toPoint = (value, index) => {
    const x = left + (maxSteps === 1 ? 0 : (index / (maxSteps - 1)) * plotW);
    const y = top + (1 - Math.min(100, Math.max(0, value)) / 100) * plotH;
    return { x, y };
  };

  const series = visible.map((subject, subjectIndex) => {
    const values = trendValuesForSubject(subject);
    const padded = Array.from({ length: maxSteps }, (_, index) => {
      if (values[index] != null) return values[index];
      return values[values.length - 1] ?? 0;
    });
    const points = padded.map(toPoint);
    const line = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `${left},${top + plotH} ${line} ${left + plotW},${top + plotH}`;
    const color = palette[subjectIndex % palette.length];
    const trend = trendForSubject(subject);
    return { subject, points, line, area, color, trend };
  });

  return `
    <div class="line-chart-wrap">
      <svg class="performance-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Performance trends chart">
        <defs>
          ${series.map((item, index) => `
            <linearGradient id="trendFill${index}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${item.color}" stop-opacity=".18"/>
              <stop offset="100%" stop-color="${item.color}" stop-opacity="0"/>
            </linearGradient>
          `).join("")}
        </defs>
        ${[0, 25, 50, 75, 100].map(value => {
          const y = top + (1 - value / 100) * plotH;
          return `
            <g class="chart-gridline">
              <text x="18" y="${y + 4}" class="chart-y-label">${value}</text>
              <line x1="${left}" x2="${left + plotW}" y1="${y}" y2="${y}"></line>
            </g>
          `;
        }).join("")}
        <line class="chart-axis" x1="${left}" x2="${left + plotW}" y1="${top + plotH}" y2="${top + plotH}"></line>
        ${series.map((item, index) => `
          <polygon class="chart-area" points="${item.area}" fill="url(#trendFill${index})"></polygon>
          <polyline class="chart-line" points="${item.line}" style="--series-color:${item.color};"></polyline>
          ${item.points.map(point => `<circle class="chart-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" style="--series-color:${item.color};"></circle>`).join("")}
        `).join("")}
      </svg>
      <div class="trend-legend">
        ${series.map(item => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${item.color};"></span>
            <span>${escapeHtml(item.subject.name)}</span>
            <span class="trend-pill ${trendBadgeClass(item.trend)}">${escapeHtml(item.trend.label)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function saveSubjectMetaPayload(name, overrides = {}) {
  const subject = subjects.find(item => item.name === name) || {};
  try {
    subjects = await api("/subjects/meta", {
      method: "POST",
      body: JSON.stringify({
        name,
        notes: subject.notes || "",
        scheduleDay: subject.scheduleDay || "",
        scheduleLocation: subject.scheduleLocation || "",
        scheduleStartHour: safeNumber(subject.scheduleStartHour),
        scheduleStartMinute: safeNumber(subject.scheduleStartMinute),
        scheduleEndHour: safeNumber(subject.scheduleEndHour),
        scheduleEndMinute: safeNumber(subject.scheduleEndMinute),
        absences: safeNumber(subject.absences),
        ...overrides
      })
    });
    updateDashboard();
    renderSubjectFolders();
    renderSchedule();
    loadScheduleForm();
    return true;
  } catch (err) {
    showToast(err.message, "err");
    return false;
  }
}

function cssSafe(text) {
  return String(text).replace(/[^a-z0-9_-]/gi, "_");
}

async function saveFolderNotesByIndex(index) {
  const subject = subjects[index];
  if (!subject) return;
  const safeId = cssSafe(subject.name);
  const saved = await saveSubjectMetaPayload(subject.name, {
    notes: $(`folderNotes-${safeId}`).value
  });
  if (saved) showToast("Subject notes saved");
}

/* Open a PDF/image file picker for a subject folder and store it locally */
function openNoteFilePickerForIndex(index) {
  const subject = subjects[index];
  if (!subject) return;
  const input = document.createElement("input");
  input.type = "file";
  // Allow PDF, images, Word docs, and plain text
  input.accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.doc,.docx";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const key = `noteFiles_${subject.name}`;
    const existing = getNoteFiles(subject.name);
    // Guard against duplicate file names
    if (existing.some(f => f.name === file.name)) {
      showToast("A file with that name is already attached.", "warn");
      return;
    }
    const reader = new FileReader();
    reader.onload = evt => {
      existing.push({ name: file.name, type: file.type, dataUrl: evt.target.result });
      try { localStorage.setItem(key, JSON.stringify(existing)); } catch { showToast("Storage full - file not saved", "err"); return; }
      renderSubjectFolders();
      showToast(`Attached: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

/* Return the list of attached files for a subject (stored in localStorage) */
function getNoteFiles(subjectName) {
  try {
    const raw = localStorage.getItem(`noteFiles_${subjectName}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/* Remove a specific file from a subject's attachment list */
function removeNoteFile(subjectName, fileName) {
  const files = getNoteFiles(subjectName).filter(f => f.name !== fileName);
  try { localStorage.setItem(`noteFiles_${subjectName}`, JSON.stringify(files)); } catch {}
  renderSubjectFolders();
}

/* Open an attached file (data URL) in a new browser tab */
function openNoteFile(subjectName, fileName) {
  const file = getNoteFiles(subjectName).find(f => f.name === fileName);
  if (!file) return;
  const w = window.open();
  if (file.type === "application/pdf" || file.dataUrl.startsWith("data:application/pdf")) {
    w.document.write(`<iframe src="${file.dataUrl}" style="width:100%;height:100vh;border:none;"></iframe>`);
  } else if (file.type.startsWith("image/")) {
    w.document.write(`<img src="${file.dataUrl}" style="max-width:100%;"/>`);
  } else {
    w.location.href = file.dataUrl;
  }
}

function loadScheduleForm() {
  const kind = $("scheduleKind")?.value || "subject";
  document.querySelector(".schedule-subject-field")?.classList.toggle("hide", kind === "custom");
  document.querySelector(".schedule-custom-field")?.classList.toggle("hide", kind !== "custom");

  if (kind === "custom") {
    if ($("scheduleDay") && !$("scheduleDay").value) $("scheduleDay").value = "";
    if ($("scheduleStart") && !$("scheduleStart").value) $("scheduleStart").value = "08:00";
    if ($("scheduleEnd") && !$("scheduleEnd").value) $("scheduleEnd").value = "09:00";
    return;
  }

  const select = $("scheduleSubject");
  if (!select) return;
  const subject = subjects.find(item => item.name === select.value);

  if (!subject) {
    if ($("scheduleDay")) $("scheduleDay").value = "";
    if ($("scheduleStart")) $("scheduleStart").value = "08:00";
    if ($("scheduleEnd")) $("scheduleEnd").value = "09:00";
    if ($("scheduleLocation")) $("scheduleLocation").value = "";
    return;
  }

  $("scheduleDay").value = subject.scheduleDay || "";
  $("scheduleStart").value = `${String(safeNumber(subject.scheduleStartHour, 8)).padStart(2, "0")}:${String(safeNumber(subject.scheduleStartMinute)).padStart(2, "0")}`;
  $("scheduleEnd").value = `${String(safeNumber(subject.scheduleEndHour, 9)).padStart(2, "0")}:${String(safeNumber(subject.scheduleEndMinute)).padStart(2, "0")}`;
  $("scheduleLocation").value = subject.scheduleLocation || "";
}

async function saveScheduleFromTab() {
  const kind = $("scheduleKind")?.value || "subject";
  const day = $("scheduleDay").value;
  if (!day) {
    showToast("Please select a day", "warn");
    return;
  }

  const start = $("scheduleStart").value || "00:00";
  const end = $("scheduleEnd").value || "00:00";
  const [scheduleStartHour, scheduleStartMinute] = start.split(":").map(Number);
  const [scheduleEndHour, scheduleEndMinute] = end.split(":").map(Number);
  const location = $("scheduleLocation").value;

  if (kind === "custom") {
    const title = $("scheduleCustomTitle")?.value.trim();
    if (!title) {
      showToast("Enter a title for this schedule item", "warn");
      return;
    }

    addCustomSlot({
      title,
      day,
      startHour: scheduleStartHour,
      startMinute: scheduleStartMinute,
      endHour: scheduleEndHour,
      endMinute: scheduleEndMinute,
      location
    });
    if ($("scheduleCustomTitle")) $("scheduleCustomTitle").value = "";
    renderSchedule();
    showToast(`Added ${title} to ${day}`);
    return;
  }

  const name = $("scheduleSubject")?.value;
  if (!name) {
    showToast("Select a subject first", "warn");
    return;
  }

  const subject = subjects.find(s => s.name === name);

  // If this subject has no primary schedule yet, save it as the primary (backend)
  if (!subject || !subject.scheduleDay) {
    const saved = await saveSubjectMetaPayload(name, {
      scheduleDay: day,
      scheduleLocation: location,
      scheduleStartHour,
      scheduleStartMinute,
      scheduleEndHour,
      scheduleEndMinute
    });
    if (saved) showToast("Schedule saved");
  } else {
    // Subject already has a primary day - add as an extra local slot
    addExtraSlot(name, {
      day,
      startHour: scheduleStartHour,
      startMinute: scheduleStartMinute,
      endHour: scheduleEndHour,
      endMinute: scheduleEndMinute,
      location
    });
    renderSchedule();
    showToast(`Added ${day} slot for ${name}`);
  }
}

async function saveDashboardAbsence(index) {
  const subject = subjects[index];
  if (!subject) return;
  const input = $(`dashAbsence-${index}`);
  const saved = await saveSubjectMetaPayload(subject.name, {
    absences: safeNumber(input?.value)
  });
  if (saved) showToast("Absence updated");
}

function renderSubjectFolders() {
  const container = $("subjectFolders");
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<div class="empty-state">No subject folders yet.</div>`;
    return;
  }

  container.innerHTML = subjects.map((subject, index) => {
    const safeId = cssSafe(subject.name);
    const related = subjectTasks(subject.name);
    const trend = trendForSubject(subject);
    const attachments = getNoteFiles(subject.name);

    const attachList = attachments.length
      ? `<div class="note-attachments">
          ${attachments.map(f => `
            <div class="note-attach-item">
              <span class="note-attach-name" onclick="openNoteFile(${JSON.stringify(subject.name)},${JSON.stringify(f.name)})" title="Open ${escapeAttr(f.name)}">ðŸ“„ ${escapeHtml(f.name)}</span>
              <button class="note-attach-remove" onclick="removeNoteFile(${JSON.stringify(subject.name)},${JSON.stringify(f.name)})" title="Remove">x</button>
            </div>`).join("")}
        </div>`
      : "";

    return `
      <div class="folder-card">
        <div class="folder-head">
          <div>
            <h3>${escapeHtml(subject.name)}</h3>
            <span>${related.length} linked deadline${related.length === 1 ? "" : "s"}</span>
          </div>
          ${badge(trend.label, trend.color)}
        </div>

        <div class="folder-grid-inner">
          <div class="field">
            <label>Notes</label>
            <textarea id="folderNotes-${safeId}" rows="7">${escapeHtml(subject.notes || "")}</textarea>
            ${attachList}
            <div class="note-attach-actions">
              <button class="btn btn-sm" onclick="openNoteFilePickerForIndex(${index})" title="Attach a PDF or image">ðŸ“Ž Attach File</button>
            </div>
          </div>
          <div class="folder-tasks">
            ${related.length ? related.map(task => `<span>${escapeHtml(task.description)} - ${formatDeadline(task)}</span>`).join("") : `<span>No tasks linked to this subject.</span>`}
          </div>
        </div>

        <button class="btn btn-primary btn-sm" onclick="saveFolderNotesByIndex(${index})">Save Notes</button>
      </div>
    `;
  }).join("");
}

function renderPriorityTable() {
  const tbody = $("priorityTableBody");
  if (!tbody) return;

  const visibleTasks = getFilteredTasks();
  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">No tasks available.</td></tr>`;
    return;
  }

  if (!visibleTasks.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">No tasks match these filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = visibleTasks.map(task => {
    const days = getDaysLeft(task);
    return `
      <tr>
        <td>${task.id}</td>
        <td>${escapeHtml(task.description)} ${taskLinkMarkup(task)}</td>
        <td>${getPriority(days, task.status)}</td>
        <td>${renderDaysBadge(days, task.status)}</td>
      </tr>
    `;
  }).join("");
}


