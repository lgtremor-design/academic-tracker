/* ==========================================================
   Analytics Functions
   ========================================================== */

async function loadAnalytics() {
  try {
    analytics = await api("/analytics");
    renderAnalytics();
  } catch (err) {
    console.error(err);
    showToast("Unable to load analytics", "err");
  }
}

function renderAnalytics() {
  renderAnalyticsSummary();
  renderAnalyticsCharts();
  renderAnalyticsCards();
  renderPriorityTable();
}

function renderAnalyticsSummary() {
  const container = $("analyticsSummary");
  if (!container) return;

  const avg = calculateAverageGrade();
  const done = tasks.filter(t => t.status === "Done").length;
  const total = tasks.length;

  container.innerHTML = `
    <div class="as-card">
      <div class="as-icon">SUB</div>
      <div>
        <div class="as-val">${subjects.length}</div>
        <div class="as-lbl">Subjects</div>
      </div>
    </div>
    <div class="as-card">
      <div class="as-icon">AVG</div>
      <div>
        <div class="as-val">${format2(avg)}</div>
        <div class="as-lbl">Average Grade</div>
      </div>
    </div>
    <div class="as-card">
      <div class="as-icon">OK</div>
      <div>
        <div class="as-val">${done}/${total}</div>
        <div class="as-lbl">Completed Tasks</div>
      </div>
    </div>
    <div class="as-card">
      <div class="as-icon">!</div>
      <div>
        <div class="as-val">${getUrgentCount()}</div>
        <div class="as-lbl">Urgent Tasks</div>
      </div>
    </div>
  `;
}

function renderAnalyticsCharts() {
  renderAnalyticsTaskChart();
  renderAnalyticsGradeBars();
}

function renderAnalyticsTaskChart() {
  const container = $("analyticsTaskChart");
  if (!container) return;

  const statuses = [
    { label: "Done", color: "var(--green)" },
    { label: "In Progress", color: "var(--blue)" },
    { label: "Not Started", color: "var(--amber)" }
  ];
  const total = Math.max(tasks.length, 1);

  container.innerHTML = statuses.map(status => {
    const count = tasks.filter(task => task.status === status.label).length;
    const width = Math.round((count / total) * 100);
    return `
      <div class="bar-row">
        <span><i style="background:${status.color};"></i>${status.label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%; background:${status.color};"></div>
        </div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

function renderAnalyticsGradeBars() {
  const container = $("analyticsGradeBars");
  if (!container) return;
  container.innerHTML = renderPerformanceTrendChart();
}

function renderAnalyticsCards() {
  const container = $("analyticsCards");
  if (!container) return;

  if (subjects.length === 0) {
    container.innerHTML =
      `<div class="empty-state" style="grid-column:1/-1;">No subjects available.</div>`;
    return;
  }

  container.innerHTML = subjects.map(subject => {
    const grade = safeNumber(subject.weightedGrade ?? subject.average ?? 0);
    const equivalent = safeNumber(subject.equivalentGrade, 5);
    const goal = safeNumber(subject.goal);
    const studyTarget = getStudyTargetHours(subject);
    const studied = getTrackedStudyHours(subject);
    const remaining = getRemainingStudyHours(subject);
    const width = Math.min(100, Math.max(0, grade));
    const suggestion =
      goal > 0 && grade < goal
        ? `Increase study time to reach your target of ${format2(goal)}.`
        : "Current performance is on track.";
    const trend = trendForSubject(subject);
    const targetWidth = goal ? Math.min(100, Math.max(0, (grade / goal) * 100)) : width;
    const theme = subjectTheme(subject.name);

    return `
      <div class="an-card" style="${subjectThemeStyle(theme)}">
        <div class="an-head">
          <div class="an-icon" style="background:${theme.soft}; color:${theme.color}; border-color:color-mix(in srgb,${theme.color} 28%,var(--border));">${escapeHtml(subjectInitial(subject))}</div>
          <div class="an-name" style="color:${theme.color};">${escapeHtml(subject.name)}</div>
          <span class="trend-pill ${trendBadgeClass(trend)}">${escapeHtml(trend.label)}</span>
        </div>

        <div class="an-row">
          <span>Current Grade</span>
          <strong style="color:${theme.color};">${format2(grade)}</strong>
        </div>

        <div class="an-row">
          <span>Equivalent</span>
          <strong>${format2(equivalent, 5)}</strong>
        </div>

        <div class="an-row">
          <span>Target Grade</span>
          <strong>${goal ? format2(goal) : "-"}</strong>
        </div>

        <div class="an-row">
          <span>Study Hours</span>
          <strong>${formatHours(studied)}${studyTarget > 0 ? ` / ${formatHours(studyTarget)}` : ""}</strong>
        </div>

        <div class="an-row">
          <span>Study Left</span>
          <strong>${studyTarget > 0 ? `${formatHours(remaining)}` : "No target"}</strong>
        </div>

        <div class="an-bar-wrap">
          <div class="an-bar"
               style="width:${targetWidth}%; background:linear-gradient(90deg, ${theme.color}, ${theme.color2});"></div>
        </div>

        ${trendSvg(trend.points)}

        <div class="an-sugg">${escapeHtml(suggestion)}</div>
      </div>
    `;
  }).join("");
}

function renderPriorityTable() {
  const tbody = $("priorityTableBody");
  if (!tbody) return;

  if (tasks.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="4" class="empty-row">No tasks available.</td></tr>`;
    return;
  }

  tbody.innerHTML = tasks.map(task => {
    const days = getDaysLeft(task);

    return `
      <tr>
        <td>${task.id}</td>
        <td>${escapeHtml(task.description)}</td>
        <td>${getPriority(days, task.status)}</td>
        <td>${renderDaysBadge(days, task.status)}</td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================
   Dashboard
   ========================================================== */

function updateDashboard() {
  if ($("dash-subjects")) $("dash-subjects").textContent = subjects.length;
  if ($("dash-tasks")) $("dash-tasks").textContent = tasks.length;
  if ($("dash-avg")) $("dash-avg").textContent =
    subjects.length ? format2(calculateGWA()) : "-";
  if ($("dash-urgent")) $("dash-urgent").textContent = getUrgentCount();
  renderDashboardProgress();
  renderDashboardCharts();
  renderDashboardDate();
  renderDashboardAbsences();
}

function renderDashboardDate() {
  const target = $("dashToday");
  if (!target) return;
  target.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function getCompletionPercent() {
  if (!tasks.length) return 0;
  const done = tasks.filter(task => task.status === "Done").length;
  return Math.round((done / tasks.length) * 100);
}

function renderDashboardProgress() {
  const percent = getCompletionPercent();
  const ring = $("dashProgressRing");
  const value = $("dashProgressValue");
  const text = $("dashProgressText");

  if (ring) ring.style.setProperty("--progress", `${percent}%`);
  if (value) value.textContent = `${percent}%`;
  if (text) text.textContent = `${percent}% complete`;
}

function renderDashboardCharts() {
  renderTaskStatusChart();
  renderGradeChart();
}

function renderTaskStatusChart() {
  const container = $("dashboardBarChart");
  if (!container) return;

  const statuses = [
    { label: "Done", color: "var(--green)" },
    { label: "In Progress", color: "var(--blue)" },
    { label: "Not Started", color: "var(--amber)" }
  ];
  const total = Math.max(tasks.length, 1);

  container.innerHTML = statuses.map(status => {
    const count = tasks.filter(task => task.status === status.label).length;
    const width = Math.round((count / total) * 100);
    return `
      <div class="bar-row">
        <span>${status.label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%; background:${status.color};"></div>
        </div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

function renderGradeChart() {
  const container = $("dashboardGradeChart");
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<div class="empty-state">Add subjects to see grades.</div>`;
    return;
  }

  container.innerHTML = subjects.map(subject => {
    const grade = Math.min(100, Math.max(0, safeNumber(subject.weightedGrade ?? subject.average ?? 0)));
    const equivalent = safeNumber(subject.equivalentGrade, 5);
    const displayGrade = format2(equivalent, 5);
    const theme = subjectTheme(subject.name);
    return `
      <div class="standing-row" style="${subjectThemeStyle(theme)}" title="${escapeAttr(subject.name)}: ${format2(grade)} / ${format2(equivalent, 5)}">
        <div class="standing-line">
          <div class="standing-name">${escapeHtml(subject.name || "Unnamed Subject")}</div>
          <div class="standing-grade">${displayGrade}</div>
        </div>
        <div class="standing-progress">
          <span style="width:${Math.max(0, Math.min(100, grade))}%;"></span>
        </div>
      </div>
    `;
  }).join("");
}

function renderDashboardAbsences() {
  const container = $("dashboardAbsences");
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<div class="empty-state">Add subjects to track absences.</div>`;
    return;
  }

  container.innerHTML = subjects.map((subject, index) => `
    <div class="absence-item">
      <div>
        <strong>${escapeHtml(subject.name)}</strong>
        <span>${safeNumber(subject.absences)} recorded absence${safeNumber(subject.absences) === 1 ? "" : "s"}</span>
      </div>
      <input id="dashAbsence-${index}" type="number" min="0" value="${safeNumber(subject.absences)}" onchange="saveDashboardAbsence(${index})">
    </div>
  `).join("");
}

function calculateAverageGrade() {
  if (subjects.length === 0) return 0;

  const total = subjects.reduce((sum, subject) => {
    return sum + safeNumber(subject.weightedGrade ?? subject.average ?? 0);
  }, 0);

  return total / subjects.length;
}

function calculateGWA() {
  if (subjects.length === 0) return 0;

  const totals = subjects.reduce((acc, subject) => {
    const units = safeNumber(subject.units, 3);
    const equivalent = safeNumber(subject.equivalentGrade, 5);
    if (units <= 0) return acc;
    acc.weighted += equivalent * units;
    acc.units += units;
    return acc;
  }, { weighted: 0, units: 0 });

  return totals.units ? totals.weighted / totals.units : 0;
}

function getUrgentCount() {
  return tasks.filter(task => task.status !== "Done" && getDaysLeft(task) <= 1).length;
}

/* ==========================================================
   Formatting Helpers
   ========================================================== */

function badge(text, color) {
  return `<span class="badge badge-${color}">${text}</span>`;
}

function getTaskDate(task) {
  return new Date(
    task.year,
    task.month - 1,
    task.day,
    task.hour || 0,
    task.minute || 0
  );
}

function getDaysLeft(task) {
  const now = new Date();
  const due = getTaskDate(task);
  const diff = due - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDeadline(task) {
  const due = getTaskDate(task);
  return due.toLocaleString();
}

function getPriority(days, status) {
  if (status === "Done") return badge("Completed", "green");
  if (days < 0) return badge("Overdue", "red");
  if (days <= 1) return badge("Critical", "red");
  if (days <= 3) return badge("High", "amber");
  if (days <= 7) return badge("Medium", "blue");
  return badge("Low", "green");
}


