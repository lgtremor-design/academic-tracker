/* ==========================================================
   Task Functions
   ========================================================== */

async function loadTasks() {
  try {
    // Get the saved tasks from the backend.
    tasks = await api("/tasks");
    // Redraw every place where tasks appear.
    renderTasks();
    renderUpcomingTasks();
    renderCalendar();
    updateDashboard();
    maybeNotifyDeadlineReminders();
  } catch (err) {
    // Show this when the backend cannot send the task list.
    console.error(err);
    showToast("Unable to load tasks", "err");
  }
}

async function addTask() {
  // Read what the user typed in the task form.
  const description = $("taskDesc").value.trim();
  const date = $("taskDate").value;
  const time = $("taskTime").value || "23:59";

  // Stop early when required fields are missing.
  if (!description) {
    showToast("Task description is required", "warn");
    return;
  }

  if (!date) {
    showToast("Deadline date is required", "warn");
    return;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  // Build the task data that will be saved by the backend.
  const payload = {
    subjectName: $("taskSubject").value,
    description,
    type: $("taskType").value,
    status: $("taskStatus").value,
    link: $("taskLink").value.trim(),
    year,
    month,
    day,
    hour,
    minute
  };

  try {
    // Save the task, then replace the local task list with the backend's latest list.
    tasks = await api("/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // Refresh the page sections that show task information.
    clearTaskForm();
    renderTasks();
    renderUpcomingTasks();
    renderCalendar();
    updateDashboard();

    showToast("Task added successfully");
  } catch (err) {
    showToast(err.message, "err");
  }
}

function clearTaskForm() {
  // Empty the task form after a task is saved.
  $("taskDesc").value = "";
  $("taskLink").value = "";
  $("taskDate").value = "";
  $("taskTime").value = "23:59";
}

async function updateTaskStatus(id, status) {
  try {
    // Save the new task status in the backend.
    tasks = await api(`/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });

    // Refresh the task views so the new status appears.
    renderTasks();
    renderUpcomingTasks();
    renderCalendar();
    updateDashboard();

    showToast("Task updated");
  } catch (err) {
    showToast(err.message, "err");
  }
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;

  try {
    tasks = await api(`/tasks/${id}`, {
      method: "DELETE"
    });

    renderTasks();
    renderUpcomingTasks();
    renderCalendar();
    updateDashboard();

    showToast("Task deleted");
  } catch (err) {
    showToast(err.message, "err");
  }
}

