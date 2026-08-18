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
let _timerCompletionAlarmPlayed = false;

function getTodayKey(subjectName) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `studyToday_${subjectName}_${year}-${month}-${day}`;
}

function getTodayHours(subjectName) {
  return Number.parseFloat(sessionStorage.getItem(getTodayKey(subjectName)) || "0") || 0;
}

function addTodayHours(subjectName, hours) {
  const key = getTodayKey(subjectName);
  const total = getTodayHours(subjectName) + hours;
  sessionStorage.setItem(key, String(total));
}

const STUDY_LOG_KEY = "noviStudyLog";
const STUDY_LOG_MAX_DAYS = 180;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function getStudyLog() {
  try {
    const raw = localStorage.getItem(STUDY_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(entry =>
          entry &&
          /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
          typeof entry.subject === "string" &&
          Number.isFinite(Number(entry.hours)) &&
          Number(entry.hours) > 0
        )
      : [];
  } catch (_err) {
    return [];
  }
}

function addStudyLogEntry(date, subject, hours) {
  const numericHours = Number(hours);
  if (!date || !subject || !Number.isFinite(numericHours) || numericHours <= 0) return;

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (STUDY_LOG_MAX_DAYS - 1));
  const cutoffKey = getLocalDateKey(cutoff);
  const log = getStudyLog()
    .concat({ date, subject, hours: numericHours })
    .filter(entry => entry.date >= cutoffKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  try {
    localStorage.setItem(STUDY_LOG_KEY, JSON.stringify(log));
  } catch (_err) {
    // Keep session saving functional if browser storage is unavailable/full.
  }
}

function _studyLogEntriesForDays(days = STUDY_LOG_MAX_DAYS) {
  const count = Math.max(1, Math.floor(Number(days) || STUDY_LOG_MAX_DAYS));
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (count - 1));
  const cutoffKey = getLocalDateKey(cutoff);
  return getStudyLog().filter(entry => entry.date >= cutoffKey && entry.date <= getLocalDateKey());
}

function getStudyHoursByDate(days = STUDY_LOG_MAX_DAYS) {
  return _studyLogEntriesForDays(days).reduce((totals, entry) => {
    totals[entry.date] = (totals[entry.date] || 0) + Number(entry.hours);
    return totals;
  }, {});
}

function getStudyHoursBySubject(days = STUDY_LOG_MAX_DAYS) {
  return _studyLogEntriesForDays(days).reduce((totals, entry) => {
    totals[entry.subject] = (totals[entry.subject] || 0) + Number(entry.hours);
    return totals;
  }, {});
}

function toggleMiniTimer() {
  const mini = document.getElementById("miniTimer");
  if (!mini) return;
  _initializeMiniTimerDrag();
  mini.classList.toggle("hide");
  const subj = document.getElementById("miniTimerSubject");
  if (subj) subj.textContent = _timerSubject || "No subject";
}

function _initializeMiniTimerDrag() {
  const mini = document.getElementById("miniTimer");
  if (!mini || mini.dataset.dragReady === "true") return;
  mini.dataset.dragReady = "true";

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  mini.addEventListener("mousedown", event => {
    if (event.target.closest("button")) return;
    const rect = mini.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    mini.style.left = `${rect.left}px`;
    mini.style.top = `${rect.top}px`;
    mini.style.right = "auto";
    mini.style.bottom = "auto";
    dragging = true;
    event.preventDefault();
  });

  document.addEventListener("mousemove", event => {
    if (!dragging) return;
    mini.style.left = `${Math.max(0, event.clientX - offsetX)}px`;
    mini.style.top = `${Math.max(0, event.clientY - offsetY)}px`;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

function _playChime(tones, spacing) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const startTime = audioContext.currentTime;
    tones.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const toneStart = startTime + index * spacing;
      const toneEnd = toneStart + 0.16;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(0.16, toneStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd);
    });

    setTimeout(() => audioContext.close(), (tones.length * spacing + 0.4) * 1000);
  } catch (_err) {
    // Audio may be unavailable or blocked by the browser.
  }
}

function _playGoalAlarm() {
  _playChime([523, 659, 784], 0.2);
}

function _playTimerCompletionAlarm() {
  _playChime([440, 523], 0.15);
}

const TIMER_MODES = {
  free: { label: "Free study", seconds: 0, hint: "Free study counts up until you stop it." },
  pomodoro: { label: "Pomodoro", seconds: 25 * 60, hint: "Pomodoro runs 25 minutes of focus, then take a 5 minute break." },
  short: { label: "Short review", seconds: 15 * 60, hint: "Short review is a quick 15 minute focused session." },
  deep: { label: "Deep work", seconds: 50 * 60, hint: "Deep work gives you 50 minutes for longer focus." }
};

/* Called when the tab becomes visible */
function renderStudyTimer() {
  _initializeMiniTimerDrag();
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
  totalEl.innerHTML = `<span class="st-today-hours">Today: ${formatHours(getTodayHours(subject.name))} hrs</span>` +
    `<span class="st-total-hours">Total: ${formatHours(getTrackedStudyHours(subject))} hrs studied</span>`;
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
  _timerCompletionAlarmPlayed = false;
  _syncTimerMode();
  const mode = TIMER_MODES[_timerMode] || TIMER_MODES.free;

  _timerInterval = setInterval(() => {
    _timerElapsed = Math.floor((Date.now() - _timerStartTs) / 1000);
    _renderClock(_timerElapsed);
    if (mode.seconds > 0 && _timerElapsed >= mode.seconds) {
      _timerElapsed = mode.seconds;
      _renderClock(mode.seconds);
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
  const savedName = _timerSubject;
  let goalReached = false;
  let completionNotified = false;

  if (autoFinished && !_timerCompletionAlarmPlayed) {
    _timerCompletionAlarmPlayed = true;
    completionNotified = true;
    _playTimerCompletionAlarm();
    const completedMode = TIMER_MODES[_timerMode] || TIMER_MODES.free;
    const completedModeLabel = completedMode.label.replace(/\b\w/g, letter => letter.toUpperCase());
    showToast(`${completedModeLabel} session complete!`);
  }

  try {
    subjects = await api("/subjects/studyhours", {
      method: "POST",
      body: JSON.stringify({ name: savedName, hours })
    });
    addTodayHours(savedName, hours);
    addStudyLogEntry(getLocalDateKey(), savedName, hours);

    const subjectData = subjects.find(s => s.name === savedName);
    if (subjectData) {
      const prevTotal = subjectData.trackedStudyHours - hours;
      const target = subjectData.studyHours;
      if (target > 0 && prevTotal < target && subjectData.trackedStudyHours >= target) {
        goalReached = true;
        _playGoalAlarm();
        showToast(`🎉 Goal reached for ${savedName}! You hit your ${formatHours(target)} hr target.`);
      }
    }

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
    if (!goalReached && !completionNotified) {
      showToast((autoFinished && _timerMode === "pomodoro" ? "Pomodoro complete. Take a 5 minute break. Saved " : autoFinished ? "Technique finished. Saved " : "Saved ") + _formatDuration(elapsed) + " for " + _timerSubject);
    }
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

  const miniClock = $("miniTimerClock");
  if (miniClock) {
    miniClock.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
    miniClock.classList.toggle("running", Boolean(_timerInterval));
  }
  const miniSubject = $("miniTimerSubject");
  if (miniSubject) miniSubject.textContent = _timerSubject || "No subject";
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
    const todayHours = getTodayHours(s.name);
    const pct = target > 0
      ? Math.min(100, (studied / target) * 100)
      : maxHours > 0
      ? (studied / maxHours) * 100
      : 0;
    return `<div class="st-sum-card">
      <div class="st-sum-name" title="${s.name}">${s.name}</div>
      <div class="st-sum-hours">${formatHours(studied)} <span style="font-size:.75rem;font-weight:500;color:var(--text3)">studied</span></div>
      <div class="st-sum-today">Today: ${formatHours(todayHours)} hrs</div>
      <div class="hint">${escapeHtml(studyProgressNote(s))}</div>
      <div class="st-sum-bar-bg"><div class="st-sum-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
  }).join("");
}

