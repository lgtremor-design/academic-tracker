/* ==========================================================
   Study Timer
   ==========================================================
   State lives entirely in these module-level variables.
   The timer ticks every second via setInterval.
   When stopped, elapsed seconds are converted to hours and
   sent to POST /subjects/studyhours, which adds them to the
   subject's persistent studyHours total.
   ========================================================== */

let _timerSubject     = null;   // name of subject being timed
let _timerStartTs     = null;   // Date.now() when Start was pressed
let _timerElapsed     = 0;      // seconds accumulated this session
let _timerInterval    = null;   // setInterval handle
let _timerSessionLog  = [];     // [{subject, duration (hrs), time}] for display
let _timerMode        = "free"; // selected study method
let _pomodoroSessions = Number(localStorage.getItem("noviPomodoroSessions") || "0");

const TIMER_MODES = {
  free: { label: "Free study", seconds: 0, hint: "Free study counts up until you stop it." },
  pomodoro: { label: "Pomodoro", seconds: 25 * 60, hint: "Pomodoro runs 25 minutes of focus, then take a 5 minute break." },
  short: { label: "Short review", seconds: 15 * 60, hint: "Short review is a quick 15 minute focused session." },
  deep: { label: "Deep work", seconds: 50 * 60, hint: "Deep work gives you 50 minutes for longer focus." }
};

/* Called when the tab becomes visible */
function renderStudyTimer() {
  _populateTimerSubjectSelect();
  _syncTimerMode();
  _renderTimerSummary();
  _syncTimerCard();
}

function _syncTimerMode() {
  const select = $("timerModeSelect");
  const hint = $("timerModeHint");
  if (select) {
    _timerMode = select.value || "free";
  }
  const mode = TIMER_MODES[_timerMode] || TIMER_MODES.free;
  if (hint) hint.textContent = mode.hint;
  _renderPomodoroCount();
}

function onTimerModeChange() {
  if (_timerInterval) {
    const select = $("timerModeSelect");
    if (select) select.value = _timerMode;
    showToast("Stop the current timer before changing technique", "warn");
    return;
  }
  _syncTimerMode();
  _renderClock(0);
}

/* Populate the subject dropdown */
function _populateTimerSubjectSelect() {
  const sel = $("timerSubjectSelect");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">- choose a subject -</option>';
  subjects.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

/* Sync card UI to current state (selected subject, running/stopped) */
function _syncTimerCard() {
  const nameEl    = $("timerSubjectName");
  const totalEl   = $("timerTotalHours");
  const startBtn  = $("timerStartBtn");
  const stopBtn   = $("timerStopBtn");
  const clock     = $("timerDisplay");

  if (!nameEl) return;

  const subjectName = $("timerSubjectSelect") ? $("timerSubjectSelect").value : "";
  const subject     = subjects.find(s => s.name === subjectName) || null;

  // If a timer is running for a DIFFERENT subject (edge case), leave it alone
  if (_timerInterval && _timerSubject !== subjectName) {
    nameEl.textContent  = _timerSubject + " (timer running)";
    totalEl.textContent = "-";
    startBtn.classList.add("hide");
    stopBtn.classList.remove("hide");
    clock.classList.add("running");
    return;
  }

  if (!subject) {
    nameEl.textContent  = "No subject selected";
    totalEl.textContent = "-";
    startBtn.disabled   = true;
    startBtn.classList.remove("hide");
    stopBtn.classList.add("hide");
    clock.classList.remove("running");
    if (!_timerInterval) { _timerElapsed = 0; _renderClock(0); }
    return;
  }

  nameEl.textContent  = subject.name;
  totalEl.textContent = getStudyTargetHours(subject) > 0
    ? `${formatHours(getTrackedStudyHours(subject))} studied, ${formatHours(getRemainingStudyHours(subject))} left`
    : `${formatHours(getTrackedStudyHours(subject))} studied`;
  startBtn.disabled   = false;

  if (_timerInterval && _timerSubject === subjectName) {
    startBtn.classList.add("hide");
    stopBtn.classList.remove("hide");
    clock.classList.add("running");
  } else {
    startBtn.classList.remove("hide");
    stopBtn.classList.add("hide");
    clock.classList.remove("running");
    if (_timerSubject !== subjectName) {
      _timerElapsed = 0;
      _renderClock(0);
    }
  }
}

/* Dropdown changed */
function onTimerSubjectChange() {
  // If a timer is running for the OLD subject, stop and discard it silently
  // (user switched away before stopping - warn them)
  if (_timerInterval) {
    if (!confirm(`A timer is still running for ${_timerSubject}. Stop it without saving?`)) {
      // Put the dropdown back on the subject that still has the running timer.
      const sel = $("timerSubjectSelect");
      if (sel) sel.value = _timerSubject;
      return;
    }
    _cancelTimer();
  }
  _syncTimerCard();
}

/* Start */
function startStudyTimer() {
  const sel = $("timerSubjectSelect");
  if (!sel || !sel.value) return;

  _timerSubject  = sel.value;
  _timerStartTs  = Date.now();
  _timerElapsed  = 0;
  _syncTimerMode();
  const mode = TIMER_MODES[_timerMode] || TIMER_MODES.free;

  _timerInterval = setInterval(() => {
    _timerElapsed = Math.floor((Date.now() - _timerStartTs) / 1000);
    _renderClock(_timerElapsed);
    if (mode.seconds > 0 && _timerElapsed >= mode.seconds) {
      stopStudyTimer(true);
    }
  }, 1000);

  _renderClock(0);
  _syncTimerCard();
  showToast(`${mode.label} started for ${_timerSubject}`);
}

/* Stop & Save */
async function stopStudyTimer(autoFinished = false) {
  if (!_timerInterval) return;

  clearInterval(_timerInterval);
  _timerInterval = null;

  const elapsed = Math.floor((Date.now() - _timerStartTs) / 1000);
  _timerElapsed  = elapsed;
  _renderClock(elapsed);

  if (elapsed < 1) {
    showToast("Session too short to save", "warn");
    _timerSubject = null;
    _timerElapsed = 0;
    _syncTimerCard();
    return;
  }

  const hours = elapsed / 3600;

  try {
    subjects = await api("/subjects/studyhours", {
      method: "POST",
      body: JSON.stringify({ name: _timerSubject, hours })
    });

    // Log the session for display
    _timerSessionLog.unshift({
      subject:  _timerSubject,
      duration: hours,
      time:     new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    if (_timerSessionLog.length > 10) _timerSessionLog.length = 10;

    _renderSessionLog();
    if (autoFinished && _timerMode === "pomodoro") {
      _pomodoroSessions++;
      localStorage.setItem("noviPomodoroSessions", String(_pomodoroSessions));
      _renderPomodoroCount();
    }
    showToast((autoFinished && _timerMode === "pomodoro" ? "Pomodoro complete. Take a 5 minute break. Saved " : autoFinished ? "Technique finished. Saved " : "Saved ") + _formatDuration(elapsed) + " for " + _timerSubject);
    updateDashboard();
    renderSubjects();
    renderAnalytics();
    _renderTimerSummary();
  } catch (err) {
    showToast("Failed to save session: " + err.message, "err");
  }

  _timerSubject = null;
  _timerElapsed = 0;
  _renderClock(0);
  _syncTimerCard();
}

function _renderPomodoroCount() {
  const el = $("timerPomodoroCount");
  if (!el) return;
  el.textContent = `Pomodoros completed: ${_pomodoroSessions}`;
  el.classList.toggle("hide", _timerMode !== "pomodoro");
}

/* Cancel without saving (used when switching subjects mid-timer) */
function _cancelTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  _timerSubject = null;
  _timerElapsed = 0;
  _renderClock(0);
}

/* Render HH:MM:SS into the clock display */
function _renderClock(totalSeconds) {
  const mode = TIMER_MODES[_timerMode] || TIMER_MODES.free;
  const shownSeconds = mode.seconds > 0 ? Math.max(0, mode.seconds - totalSeconds) : totalSeconds;
  const h = Math.floor(shownSeconds / 3600);
  const m = Math.floor((shownSeconds % 3600) / 60);
  const s = shownSeconds % 60;
  const pad = n => String(n).padStart(2, "0");
  const el = $("timerDisplay");
  if (el) el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
}

/* Format seconds as a human-readable duration */
function _formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return h + "h " + m + "m " + s + "s";
  if (m > 0) return m + "m " + s + "s";
  return s + "s";
}

/* Render this session's log entries */
function _renderSessionLog() {
  const el = $("timerSessionLog");
  if (!el) return;
  if (_timerSessionLog.length === 0) { el.innerHTML = ""; return; }
  el.innerHTML = _timerSessionLog.map(entry =>
    `<div class="st-log-entry">
       <span>${entry.time} - ${entry.subject}</span>
       <span>+${formatHours(entry.duration)}</span>
     </div>`
  ).join("");
}

/* Render the summary grid of all subjects */
function _renderTimerSummary() {
  const grid = $("timerSummaryGrid");
  if (!grid) return;
  if (!subjects || subjects.length === 0) {
    grid.innerHTML = '<div style="color:var(--text3);font-size:.85rem;">No subjects yet.</div>';
    return;
  }

  const maxHours = subjects.reduce((mx, s) => Math.max(mx, getStudyTargetHours(s), getTrackedStudyHours(s)), 0);

  grid.innerHTML = subjects.map(s => {
    const target = getStudyTargetHours(s);
    const studied = getTrackedStudyHours(s);
    const pct = target > 0
      ? Math.min(100, (studied / target) * 100)
      : maxHours > 0
      ? (studied / maxHours) * 100
      : 0;
    return `<div class="st-sum-card">
      <div class="st-sum-name" title="${s.name}">${s.name}</div>
      <div class="st-sum-hours">${formatHours(studied)} <span style="font-size:.75rem;font-weight:500;color:var(--text3)">studied</span></div>
      <div class="hint">${escapeHtml(studyProgressNote(s))}</div>
      <div class="st-sum-bar-bg"><div class="st-sum-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
  }).join("");
}

