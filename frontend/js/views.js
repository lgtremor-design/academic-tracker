function getTaskDateValue(task) {
  return `${String(task.year).padStart(4, "0")}-${String(task.month).padStart(2, "0")}-${String(task.day).padStart(2, "0")}`;
}

function sortTasksForView(list) {
  const sort = $("taskSort")?.value || "deadline";
  return [...list].sort((a, b) => {
    if (sort === "subject") return String(a.subjectName || "").localeCompare(String(b.subjectName || ""));
    if (sort === "status") return String(a.status || "").localeCompare(String(b.status || ""));
    if (sort === "priority") return getDaysLeft(a) - getDaysLeft(b);
    return getTaskDate(a) - getTaskDate(b);
  });
}

function getFilteredTasks() {
  const status = $("taskFilterStatus")?.value || "";
  const subject = $("taskFilterSubject")?.value || "";
  return sortTasksForView(tasks.filter(task =>
    (!status || task.status === status) &&
    (!subject || task.subjectName === subject) &&
    (status === "Done" || task.status !== "Done") &&
    matchesTask(task)
  ));
}

function getDoneTasks() {
  return sortTasksForView(tasks.filter(task => task.status === "Done" && matchesTask(task)));
}

function taskLinkMarkup(task, className = "task-link") {
  if (!task.link) return "";
  const href = escapeAttr(task.link);
  return `<a class="${className}" href="${href}" target="_blank" rel="noopener">Open link</a>`;
}

function renderSubjectTable() {
  const tbody = $("subjectTableBody");
  if (!tbody) return;

  const visibleSubjects = subjects.filter(subject => matchesSubject(subject));

  if (subjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No subjects yet.</td></tr>`;
    return;
  }

  if (visibleSubjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No subjects match your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = visibleSubjects.map(subject => {
    const grade = safeNumber(subject.weightedGrade ?? subject.average ?? 0);
    const equivalent = safeNumber(subject.equivalentGrade, 5);
    const units = safeNumber(subject.units, 3);
    const goal = safeNumber(subject.goal);
    const hours = formatStudyProgress(subject);
    const theme = subjectTheme(subject.name);
    const components = getSubjectComponents(subject);
    const criteriaTitle = components
      .map(component => {
        const contribution = safeNumber(component.score) * safeNumber(component.weight) / 100;
        return `${component.name}: ${format2(component.score)}% earned, ${format2(component.weight)}% weight, ${format2(contribution)}% final contribution`;
      })
      .join("\n");
    const criteria = components.length
      ? `<div class="criteria-summary" title="${escapeAttr(criteriaTitle)}">
          ${components.map(component => {
            const count = Array.isArray(component.scores) ? component.scores.length : 0;
            const contribution = safeNumber(component.score) * safeNumber(component.weight) / 100;
            return `<span class="criteria-chip">
              <strong>${escapeHtml(component.name)}</strong>
              <em>${format2(component.score)}% earned</em>
              <small>${format2(component.weight)}% weight | ${format2(contribution)}% final${count ? ` | ${count} score${count === 1 ? "" : "s"}` : ""}</small>
            </span>`;
          }).join("")}
        </div>`
      : "No criteria";
    const status = grade >= goal && goal > 0
      ? badge("On Track", "green")
      : goal > 0
      ? badge("Needs Work", "amber")
      : badge("No Goal", "gray");

    return `
      <tr class="subject-row" style="${subjectThemeStyle(theme)}">
        <td><strong>${escapeHtml(subject.name)}</strong></td>
        <td>${criteria}</td>
        <td><strong>${format2(grade)}</strong></td>
        <td><strong>${format2(equivalent, 5)}</strong></td>
        <td>${goal ? format2(goal) : "-"}</td>
        <td>${format2(units, 3)}</td>
        <td>${hours}</td>
        <td>${status}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteSubject('${escapeAttr(subject.name)}')">Delete</button></td>
      </tr>
    `;
  }).join("");
}

async function deleteSubject(name) {
  const linkedCount = tasks.filter(task => task.subjectName === name).length;
  const suffix = linkedCount ? ` This will also remove ${linkedCount} linked task${linkedCount === 1 ? "" : "s"}.` : "";
  if (!confirm(`Delete "${name}"?${suffix}`)) return;

  try {
    subjects = await api(`/subjects/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
    await loadTasks();
    refreshInstantViews();
    showToast("Subject deleted");
  } catch (err) {
    showToast(err.message, "err");
  }
}

function renderTasks() {
  const tbody = $("taskTableBody");
  if (!tbody) return;

  const visibleTasks = getFilteredTasks();
  renderDoneTasks();
  renderTodoList();
  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No tasks yet.</td></tr>`;
    return;
  }

  if (visibleTasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No tasks match these filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = visibleTasks.map((task, index) => {
    if (editingTaskId === task.id) {
      return `
        <tr class="editing-row">
          <td>${index + 1}</td>
          <td>
            <select id="editTaskSubject-${task.id}">
              ${subjects.map(subject => `<option value="${escapeAttr(subject.name)}" ${task.subjectName === subject.name ? "selected" : ""}>${escapeHtml(subject.name)}</option>`).join("")}
            </select>
          </td>
          <td><input id="editTaskDesc-${task.id}" type="text" value="${escapeAttr(task.description)}"></td>
          <td>
            <select id="editTaskType-${task.id}">
              ${["Individual", "Group"].map(type => `<option value="${type}" ${task.type === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </td>
          <td>
            <select id="editTaskStatus-${task.id}">
              ${["Not Started", "In Progress", "Done"].map(status => `<option value="${status}" ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </td>
          <td>
            <input id="editTaskDate-${task.id}" type="date" value="${getTaskDateValue(task)}">
            <input id="editTaskTime-${task.id}" type="time" value="${formatTaskTime(task)}">
            <input id="editTaskLink-${task.id}" type="text" value="${escapeAttr(task.link || "")}" placeholder="https://...">
          </td>
          <td>${renderDaysBadge(getDaysLeft(task), task.status)}</td>
          <td>${getPriority(getDaysLeft(task), task.status)}</td>
          <td class="table-actions">
            <button class="btn btn-primary btn-sm" onclick="saveTaskEdit(${task.id})">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="cancelTaskEdit()">Cancel</button>
          </td>
        </tr>
      `;
    }

    const days = getDaysLeft(task);
    const rowClass = isTaskOverdue(task) ? "overdue-row" : "";
    return `
      <tr class="${rowClass}">
        <td>${index + 1}</td>
        <td><strong class="task-subject-label" style="color:${subjectTheme(task.subjectName).color};">${escapeHtml(task.subjectName || "-")}</strong></td>
        <td>
          <div class="task-desc">${escapeHtml(task.description)}</div>
          ${taskLinkMarkup(task)}
        </td>
        <td>${escapeHtml(task.type || "-")}</td>
        <td>
          <select onchange="updateTaskStatus(${task.id}, this.value)">
            ${["Not Started", "In Progress", "Done"]
              .map(status => `<option value="${status}" ${task.status === status ? "selected" : ""}>${status}</option>`)
              .join("")}
          </select>
        </td>
        <td>${formatDeadline(task)}</td>
        <td>${renderDaysBadge(days, task.status)}</td>
        <td>${getPriority(days, task.status)}</td>
        <td class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="startTaskEdit(${task.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTask(${task.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderDoneTasks() {
  const tbody = $("doneTaskTableBody");
  if (!tbody) return;
  const doneTasks = getDoneTasks();
  if (!doneTasks.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No completed tasks yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = doneTasks.map((task, index) => `
    <tr class="done-row">
      <td>${index + 1}</td>
      <td><strong class="task-subject-label" style="color:${subjectTheme(task.subjectName).color};">${escapeHtml(task.subjectName || "-")}</strong></td>
      <td>${escapeHtml(task.description)} ${taskLinkMarkup(task)}</td>
      <td>${badge("Completed", "green")}</td>
      <td class="table-actions">
        <button class="btn btn-ghost btn-sm" onclick="updateTaskStatus(${task.id}, 'In Progress')">Reopen</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTask(${task.id})">Delete</button>
      </td>
    </tr>
  `).join("");
}

function getTodoItems() {
  try { return JSON.parse(localStorage.getItem("atTodoItems") || "[]"); } catch { return []; }
}

function saveTodoItems(items) {
  localStorage.setItem("atTodoItems", JSON.stringify(items));
}

function addTodoItem() {
  const input = $("todoInput");
  const text = input?.value.trim();
  if (!text) {
    showToast("Type a to-do first", "warn");
    return;
  }
  const items = getTodoItems();
  items.push({ id: Date.now(), text, done: false });
  saveTodoItems(items);
  input.value = "";
  renderTodoList();
}

function toggleTodoItem(id) {
  const items = getTodoItems().map(item =>
    item.id === id ? { ...item, done: !item.done } : item
  );
  saveTodoItems(items);
  renderTodoList();
}

function deleteTodoItem(id) {
  saveTodoItems(getTodoItems().filter(item => item.id !== id));
  renderTodoList();
}

function renderTodoList() {
  const list = $("todoList");
  if (!list) return;
  const items = getTodoItems();
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">No quick to-dos yet.</div>`;
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="todo-item ${item.done ? "todo-done" : ""}">
      <label>
        <input type="checkbox" ${item.done ? "checked" : ""} onchange="toggleTodoItem(${item.id})">
        <span>${escapeHtml(item.text)}</span>
      </label>
      <button class="note-attach-remove" onclick="deleteTodoItem(${item.id})" title="Remove">x</button>
    </div>
  `).join("");
}

function startTaskEdit(id) {
  editingTaskId = id;
  renderTasks();
}

function cancelTaskEdit() {
  editingTaskId = null;
  renderTasks();
}

async function saveTaskEdit(id) {
  const date = $(`editTaskDate-${id}`)?.value;
  const time = $(`editTaskTime-${id}`)?.value || "23:59";
  const description = $(`editTaskDesc-${id}`)?.value.trim();
  if (!description || !date) {
    showToast("Description and deadline date are required", "warn");
    return;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  try {
    tasks = await api(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        subjectName: $(`editTaskSubject-${id}`)?.value || "",
        description,
        type: $(`editTaskType-${id}`)?.value || "Individual",
        status: $(`editTaskStatus-${id}`)?.value || "Not Started",
        link: $(`editTaskLink-${id}`)?.value.trim() || "",
        year,
        month,
        day,
        hour,
        minute
      })
    });
    editingTaskId = null;
    renderTasks();
    renderUpcomingTasks();
    renderCalendar();
    updateDashboard();
    showToast("Task saved");
  } catch (err) {
    showToast(err.message, "err");
  }
}

function renderUpcomingTasks() {
  const container = $("upcomingTasks");
  if (!container) return;

  const visibleTasks = tasks.filter(task => task.status !== "Done" && matchesTask(task));
  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-state">No tasks yet - add some in the Tasks tab.</div>`;
    return;
  }

  if (visibleTasks.length === 0) {
    container.innerHTML = `<div class="empty-state">No upcoming tasks match your search.</div>`;
    return;
  }

  const upcoming = sortTasksForView(visibleTasks).slice(0, 6);
  container.innerHTML = upcoming.map(task => {
    const days = getDaysLeft(task);
    const isDone = task.status === "Done";
    const cls = isDone ? "done" : days < 0 ? "overdue" : days <= 1 ? "urgent" : days <= 3 ? "high" : days <= 7 ? "medium" : "low";
    return `
      <div class="deadline-card ${cls}">
        <div class="dc-subject" style="color:${subjectTheme(task.subjectName).color};">${escapeHtml(task.subjectName || "General")}</div>
        <div class="dc-desc">${escapeHtml(task.description)}</div>
        <div class="dc-days">${isDone ? "Completed" : formatDaysLabel(days)}</div>
        ${taskLinkMarkup(task, "dc-link")}
      </div>
    `;
  }).join("");
}

function getCalendarContext() {
  return {
    year: calendarCursor.getFullYear(),
    monthIndex: calendarCursor.getMonth(),
    month: calendarCursor.getMonth() + 1,
    monthName: calendarCursor.toLocaleString(undefined, { month: "long", year: "numeric" })
  };
}

function changeCalendarMonth(delta) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
  renderCalendar();
}

function renderCalendarMarkup() {
  const { year, monthIndex, month, monthName } = getCalendarContext();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(`<div class="calendar-cell muted"></div>`);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayTasks = getTasksForDate(year, month, day);
    const hasDeadlines = dayTasks.length > 0;
    cells.push(`
      <div class="calendar-cell ${hasDeadlines ? "has-deadlines" : ""}" onclick="openDeadlineModal(${year}, ${month}, ${day})" title="View deadlines for this date">
        <div class="calendar-day">${day}${hasDeadlines ? `<span class="calendar-badge">${dayTasks.length}</span>` : ""}</div>
        ${calendarDeadlineMarkup(dayTasks)}
      </div>
    `);
  }

  return `
    <div class="calendar-head">
      <button class="icon-btn" type="button" onclick="changeCalendarMonth(-1)" aria-label="Previous month">&lt;</button>
      <div class="calendar-title">${monthName}</div>
      <button class="icon-btn" type="button" onclick="changeCalendarMonth(1)" aria-label="Next month">&gt;</button>
    </div>
    <div class="calendar-weekdays">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("")}
    </div>
    <div class="calendar-days">${cells.join("")}</div>
  `;
}

function renderDashboardAbsences() {
  const container = $("dashboardAbsences");
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<div class="empty-state">Add subjects to track absences.</div>`;
    return;
  }

  container.innerHTML = subjects.map((subject, index) => {
    const absences = safeNumber(subject.absences);
    const ratio = absences / MAX_ABSENCES;
    const level = ratio >= 0.75 ? "danger" : ratio >= 0.5 ? "warn" : "ok";
    return `
      <div class="absence-item absence-${level}">
        <div>
          <strong style="color:${subjectTheme(subject.name).color};">${escapeHtml(subject.name)}</strong>
          <span>${absences} / ${MAX_ABSENCES} absences used</span>
          <div class="absence-meter"><span style="width:${Math.min(100, ratio * 100)}%;"></span></div>
        </div>
        <input id="dashAbsence-${index}" type="number" min="0" max="${MAX_ABSENCES}" value="${absences}" onchange="saveDashboardAbsence(${index})">
      </div>
    `;
  }).join("");
}

function renderSchedule() {
  const container = $("scheduleBoard");
  if (!container) return;

  const customSlots = getCustomSlots();
  if (!subjects.length && !customSlots.length) {
    container.innerHTML = `<div class="empty-state schedule-empty">Add subjects or personal schedule items to set up your week.</div>`;
    return;
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  container.innerHTML = days.map(day => {
    // Collect ALL slots (primary + extra) that fall on this day
    const dayBlocks = [];
    subjects.forEach(subject => {
      getAllSlotsForSubject(subject).forEach(slot => {
        if (slot.day === day) {
          dayBlocks.push({
            title: subject.name,
            subtitle: slot.location || "No room set",
            subject,
            slot,
            type: slot.isPrimary ? "primary" : "extra",
            slotIndex: slot.isPrimary ? -1 : slot.extraIndex
          });
        }
      });
    });
    customSlots.forEach((slot, customIndex) => {
      if (slot.day === day) {
        dayBlocks.push({
          title: slot.title || "Schedule Item",
          subtitle: slot.location || "Personal item",
          slot,
          type: "custom",
          slotIndex: customIndex
        });
      }
    });
    // Sort by start time
    dayBlocks.sort((a, b) => (a.slot.startHour * 60 + a.slot.startMinute) - (b.slot.startHour * 60 + b.slot.startMinute));

    return `
      <div class="schedule-day">
        <h3>${day}</h3>
        ${dayBlocks.length ? dayBlocks.map(({ title, subtitle, subject, slot, type, slotIndex }) => {
          const timeStr = `${String(slot.startHour).padStart(2,"0")}:${String(slot.startMinute).padStart(2,"0")}-${String(slot.endHour).padStart(2,"0")}:${String(slot.endMinute).padStart(2,"0")}`;
          const deleteBtn = type === "primary"
            ? `<button class="btn btn-danger btn-sm schedule-remove" onclick="clearPrimarySchedule('${escapeAttr(subject.name)}')">Remove</button>`
            : type === "custom"
            ? `<button class="btn btn-danger btn-sm schedule-remove" onclick="removeCustomSlotAndRefresh(${slotIndex})">Remove</button>`
            : `<button class="btn btn-danger btn-sm schedule-remove" onclick="removeExtraSlotAndRefresh('${escapeAttr(subject.name)}', ${slotIndex})">Remove</button>`;
          const theme = subjectTheme(title);
          return `
            <div class="schedule-block" style="${subjectThemeStyle(theme)}">
              <strong>${escapeHtml(title)}</strong>
              <span>${timeStr}</span>
              <small>${escapeHtml(subtitle)}</small>
              ${deleteBtn}
            </div>`;
        }).join("") : `<div class="empty-state">No classes.</div>`}
      </div>
    `;
  }).join("");
}

function removeExtraSlotAndRefresh(subjectName, index) {
  removeExtraSlot(subjectName, index);
  renderSchedule();
  showToast("Schedule slot removed");
}

function removeCustomSlotAndRefresh(index) {
  removeCustomSlot(index);
  renderSchedule();
  showToast("Schedule item removed");
}

async function clearPrimarySchedule(subjectName) {
  const saved = await saveSubjectMetaPayload(subjectName, {
    scheduleDay: "",
    scheduleLocation: "",
    scheduleStartHour: 0,
    scheduleStartMinute: 0,
    scheduleEndHour: 0,
    scheduleEndMinute: 0
  });
  if (saved) showToast("Schedule slot removed");
}

