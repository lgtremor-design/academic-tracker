/* ==========================================================
   Initialization
   ========================================================== */

async function initialize() {
  initializeDesignTheme();
  initializeStudentName();
  initializeSearch();
  initializeDataTools();
  renderCalendar();
  updateDashboard();
  renderSchedule();
  renderSubjectFolders();
  renderTodoList();

  await checkServer();
  await loadSubjects();
  await loadTasks();
  await loadEvents();
  updateDashboard();
  renderCalendar();
  renderSchedule();
  renderSubjectFolders();

  // Refresh health indicator every 10 seconds
  setInterval(checkServer, 10000);
}

document.addEventListener("DOMContentLoaded", initialize);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDeadlineModal();
    closeImageViewer();
  }
});


