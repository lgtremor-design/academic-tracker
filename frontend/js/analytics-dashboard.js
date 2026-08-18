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
  const studied = getTotalTrackedStudyHours();

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
      <div class="as-icon">HRS</div>
      <div>
        <div class="as-val">${formatHours(studied)}</div>
        <div class="as-lbl">Study Time</div>
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

  const subjectHours = Object.entries(getStudyHoursBySubjectFromSubjects())
    .map(([name, hours]) => ({ name, hours: Number(hours) }))
    .filter(item => Number.isFinite(item.hours) && item.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  if (!subjectHours.length) {
    container.innerHTML = `<div class="empty-state">No study hours logged yet. Complete a timer session to fill this chart.</div>`;
    return;
  }

  const total = subjectHours.reduce((sum, item) => sum + item.hours, 0);
  const center = 110;
  const radius = 82;
  let angle = -Math.PI / 2;
  const polarPoint = currentAngle => [
    center + radius * Math.cos(currentAngle),
    center + radius * Math.sin(currentAngle)
  ];
  const slices = subjectHours.map(item => {
    const startAngle = angle;
    const endAngle = angle + (item.hours / total) * Math.PI * 2;
    angle = endAngle;
    const [startX, startY] = polarPoint(startAngle);
    const [endX, endY] = polarPoint(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const color = subjectTheme(item.name).color;
    return {
      ...item,
      color,
      path: `M ${center} ${center} L ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)} Z`
    };
  });

  const chart = slices.length === 1
    ? `<circle cx="${center}" cy="${center}" r="${radius}" fill="${slices[0].color}"></circle>`
    : slices.map(slice => `<path d="${slice.path}" fill="${slice.color}" stroke="var(--surface)" stroke-width="2"></path>`).join("");
  const legend = slices.map(slice => `
    <div class="subject-hours-legend-item">
      <span class="subject-hours-swatch" style="background:${slice.color};"></span>
      <span class="subject-hours-name">${escapeHtml(slice.name)}</span>
      <strong>${format2(slice.hours)} hrs</strong>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="subject-hours-pie-wrap">
      <svg class="subject-hours-pie" viewBox="0 0 220 220" role="img" aria-label="Study hours by subject">
        ${chart}
        <circle cx="${center}" cy="${center}" r="44" fill="var(--surface)"></circle>
        <text x="${center}" y="106" text-anchor="middle" class="subject-hours-total">${format2(total)}</text>
        <text x="${center}" y="122" text-anchor="middle" class="subject-hours-total-label">hours</text>
      </svg>
    </div>
    <div class="subject-hours-legend">${legend}</div>
  `;
}

function renderAnalyticsGradeBars() {
  const container = $("analyticsGradeBars");
  if (!container) return;
  container.innerHTML = renderDailyStudyHoursChart();
}

function renderDailyStudyHoursChart() {
  const dayCount = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (dayCount - 1 - index));
    return {
      date,
      key: getLocalDateKey(date),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    };
  });
  const startKey = dates[0].key;
  const endKey = dates[dates.length - 1].key;
  const byDate = {};
  const subjectNames = new Set();

  getStudyLog().forEach(entry => {
    if (entry.date < startKey || entry.date > endKey) return;
    const hours = Number(entry.hours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    byDate[entry.date] ||= {};
    byDate[entry.date][entry.subject] = (byDate[entry.date][entry.subject] || 0) + hours;
    subjectNames.add(entry.subject);
  });

  const totals = dates.map(item => Object.values(byDate[item.key] || {})
    .reduce((sum, hours) => sum + hours, 0));
  const maxHours = Math.max(1, Math.ceil(Math.max(...totals)));
  if (!subjectNames.size) {
    return `<div class="empty-state">No study hours logged in the last ${dayCount} days.</div>`;
  }

  const width = 720;
  const height = 250;
  const left = 48;
  const right = 18;
  const top = 18;
  const bottom = 48;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const slotW = plotW / dayCount;
  const barW = Math.max(10, slotW - 12);
  const yForHours = hours => top + plotH - (hours / maxHours) * plotH;
  const yTicks = [0, maxHours / 2, maxHours];
  const bars = dates.map((item, index) => {
    const entries = Object.entries(byDate[item.key] || {});
    let cursor = top + plotH;
    const segments = entries.map(([subject, hours]) => {
      const segmentHeight = (hours / maxHours) * plotH;
      cursor -= segmentHeight;
      return `<rect x="${(left + index * slotW + (slotW - barW) / 2).toFixed(1)}" y="${cursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, segmentHeight).toFixed(1)}" rx="3" fill="${subjectTheme(subject).color}"><title>${escapeHtml(subject)}: ${format2(hours)} hrs on ${escapeHtml(item.label)}</title></rect>`;
    }).join("");
    return segments + `<text x="${(left + index * slotW + slotW / 2).toFixed(1)}" y="${height - 22}" text-anchor="middle" class="daily-study-x-label">${escapeHtml(item.label)}</text>`;
  }).join("");
  const legend = [...subjectNames].sort().map(subject => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${subjectTheme(subject).color};"></span>
      <span>${escapeHtml(subject)}</span>
    </div>
  `).join("");

  return `
    <div class="daily-study-chart-wrap">
      <svg class="daily-study-chart" viewBox="0 0 720 250" role="img" aria-label="Daily study hours for the last ${dayCount} days">
        ${yTicks.map(value => {
          const y = yForHours(value);
          return `
            <g class="chart-gridline">
              <text x="8" y="${y + 4}" class="chart-y-label">${format2(value)}</text>
              <line x1="${left}" x2="${left + plotW}" y1="${y}" y2="${y}"></line>
            </g>`;
        }).join("")}
        <line class="chart-axis" x1="${left}" x2="${left + plotW}" y1="${top + plotH}" y2="${top + plotH}"></line>
        ${bars}
      </svg>
      <div class="trend-legend">${legend}</div>
    </div>
  `;
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
  renderStudyStreak();
  renderDueSoonIndicator();
  renderDashboardProgress();
  renderDashboardCharts();
  renderDashboardDate();
  renderDashboardAbsences();
}

function renderStudyStreak() {
  const value = $("dash-streak");
  const label = $("dash-streak-label");
  if (!value || !label) return;

  const activeDates = new Set(
    getStudyLog()
      .filter(entry => Number(entry.hours) > 0)
      .map(entry => entry.date)
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  let streak = 0;

  if (!activeDates.has(getLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  if (activeDates.has(getLocalDateKey(cursor))) {
    while (activeDates.has(getLocalDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  value.textContent = String(streak);
  label.textContent = streak === 0 ? "No study streak yet" : String(streak) + " day streak";
}

function renderDueSoonIndicator() {
  const target = $("dueSoonIndicator");
  if (!target) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);

  const isWithinWindow = (year, month, day) => {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date >= start && date < end;
  };
  const dueTasks = tasks.filter(task =>
    task.status !== "Done" && isWithinWindow(task.year, task.month, task.day)
  ).length;
  const upcomingEvents = events.filter(event =>
    isWithinWindow(event.year, event.month, event.day)
  ).length;
  const parts = [];

  if (dueTasks) parts.push(`${dueTasks} task${dueTasks === 1 ? "" : "s"} due`);
  if (upcomingEvents) parts.push(`${upcomingEvents} event${upcomingEvents === 1 ? "" : "s"}`);
  target.textContent = parts.length
    ? `${parts.join(", ")} in the next 3 days`
    : "Nothing due in the next 3 days";
  target.classList.toggle("has-due-soon", parts.length > 0);
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

function getTaskStatusSummary() {
  const completed = tasks.filter(task => task.status === "Done").length;
  const inProgress = tasks.filter(task => task.status === "In Progress").length;
  const pending = tasks.filter(task => task.status === "Not Started").length;
  const overdue = tasks.filter(task => isTaskOverdue(task)).length;
  const remaining = Math.max(0, tasks.length - completed);
  return { total: tasks.length, completed, inProgress, pending, overdue, remaining };
}

function renderDashboardProgress() {
  const percent = getCompletionPercent();
  const summary = getTaskStatusSummary();
  const ring = $("dashProgressRing");
  const value = $("dashProgressValue");
  const text = $("dashProgressText");

  if (ring) ring.style.setProperty("--progress", `${percent}%`);
  if (value) value.textContent = `${percent}%`;
  if (text) {
    text.textContent = summary.total
      ? `${summary.completed} complete, ${summary.remaining} remaining`
      : "No tasks yet";
  }
}

function renderDashboardCharts() {
  renderTaskStatusChart();
  renderGradeChart();
}

function renderTaskStatusChart() {
  const container = $("dashboardBarChart");
  if (!container) return;

  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state">No tasks yet. Add tasks to see progress.</div>`;
    return;
  }

  const summary = getTaskStatusSummary();
  const statuses = [
    { label: "Completed", count: summary.completed, color: "var(--green)" },
    { label: "In Progress", count: summary.inProgress, color: "var(--blue)" },
    { label: "Pending", count: summary.pending, color: "var(--amber)" },
    { label: "Overdue", count: summary.overdue, color: "var(--red)" }
  ];
  const total = Math.max(summary.total, 1);

  container.innerHTML = `
    <div class="task-progress-summary">
      <strong>${summary.completed}/${summary.total}</strong>
      <span>tasks finished</span>
    </div>
    ${statuses.map(status => {
      const width = Math.round((status.count / total) * 100);
    return `
      <div class="bar-row task-status-row">
        <span><i style="background:${status.color};"></i>${status.label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%; background:${status.color};"></div>
        </div>
        <strong>${status.count}</strong>
      </div>
    `;
    }).join("")}
  `;
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
          <div class="standing-name" style="color:${theme.color};">${escapeHtml(subject.name || "Unnamed Subject")}</div>
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
        <strong style="color:${subjectTheme(subject.name).color};">${escapeHtml(subject.name)}</strong>
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


