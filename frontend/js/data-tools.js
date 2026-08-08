/* ==========================================================
   Data Backup and Deadline Reminders
   ========================================================== */

const REMINDER_ENABLED_KEY = "noviDeadlineRemindersEnabled";
const REMINDER_SENT_KEY = "noviDeadlineRemindersSent";

function initializeDataTools() {
  renderReminderStatus();
  maybeNotifyDeadlineReminders();
  setInterval(maybeNotifyDeadlineReminders, 5 * 60 * 1000);
}

async function exportBackup() {
  try {
    const backup = await api("/backup");
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `academic-tracker-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported");
  } catch (err) {
    showToast("Export failed: " + err.message, "err");
  }
}

async function importBackupFile(file) {
  if (!file) return;
  if (!confirm("Import this backup? Current subjects and tasks will be replaced.")) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.tasks)) {
      throw new Error("Backup file must include subjects and tasks arrays");
    }

    await api("/backup", {
      method: "POST",
      body: JSON.stringify(parsed)
    });

    await loadSubjects();
    await loadTasks();
    refreshInstantViews();
    showToast("Backup imported");
  } catch (err) {
    showToast("Import failed: " + err.message, "err");
  }
}

async function enableDeadlineReminders() {
  if (!("Notification" in window)) {
    showToast("This browser does not support notifications", "warn");
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "granted") {
    localStorage.setItem(REMINDER_ENABLED_KEY, "1");
    renderReminderStatus();
    maybeNotifyDeadlineReminders(true);
    showToast("Deadline reminders enabled");
  } else {
    localStorage.removeItem(REMINDER_ENABLED_KEY);
    renderReminderStatus();
    showToast("Notifications were not allowed", "warn");
  }
}

function renderReminderStatus() {
  const status = $("reminderStatus");
  if (!status) return;
  const enabled = localStorage.getItem(REMINDER_ENABLED_KEY) === "1";
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  status.textContent = enabled && permission === "granted"
    ? "Reminders are on for tasks due within 24 hours."
    : "Reminders are off until you enable browser notifications.";
}

function getSentReminderKeys() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_SENT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSentReminderKeys(keys) {
  localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify(keys));
}

function maybeNotifyDeadlineReminders(force = false) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (localStorage.getItem(REMINDER_ENABLED_KEY) !== "1") return;

  const sent = getSentReminderKeys();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  let changed = false;

  tasks
    .filter(task => task.status !== "Done")
    .forEach(task => {
      const deadline = getTaskDate(task).getTime();
      const msLeft = deadline - now;
      if (msLeft <= 0 || msLeft > oneDay) return;

      const key = `${task.id}-${task.year}-${task.month}-${task.day}-${task.hour}-${task.minute}`;
      if (!force && sent[key]) return;

      const hours = Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)));
      new Notification("Academic Tracker deadline reminder", {
        body: `${task.description} is due in about ${hours} hour${hours === 1 ? "" : "s"}.`
      });
      sent[key] = Date.now();
      changed = true;
    });

  if (changed) saveSentReminderKeys(sent);
}
