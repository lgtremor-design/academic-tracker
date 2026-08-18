/* ==========================================================
   Subject Functions
   ========================================================== */

async function loadSubjects() {
  try {
    subjects = await api("/subjects");
    renderSubjects();
    updateSubjectSelects();
    updateDashboard();
    renderSchedule();
  } catch (err) {
    console.error(err);
    showToast("Unable to load subjects", "err");
  }
}

async function addSubject() {
  const name = $("newSubjectName").value.trim();
  const notes = $("newSubjectNotes").value.trim();
  const units = safeNumber($("newSubjectUnits")?.value, 3);

  if (!name) {
    showToast("Please enter a subject name", "warn");
    return;
  }

  if (subjects.some(subject => subject.name === name)) {
    showToast("Subject already exists", "warn");
    return;
  }

  const previousSubjects = cloneSubjects();
  subjects = [...subjects, buildOptimisticSubject({ name, notes, units })];
  $("newSubjectName").value = "";
  $("newSubjectNotes").value = "";
  if ($("newSubjectUnits")) $("newSubjectUnits").value = "3";
  refreshInstantViews();
  showToast("Subject added successfully");

  try {
    const savedSubjects = await api("/subjects", {
      method: "POST",
      body: JSON.stringify({ name, notes, units })
    });
    subjects = savedSubjects;
    refreshInstantViews();
  } catch (err) {
    subjects = previousSubjects;
    refreshInstantViews();
    showToast(err.message, "err");
  }
}

function getDefaultComponents() {
  return [
    { name: "Quiz", weight: 33.34, score: 0, scores: [] },
    { name: "Exam", weight: 33.33, score: 0, scores: [] },
    { name: "Assignment", weight: 33.33, score: 0, scores: [] }
  ];
}

function getSelectedSubject() {
  const name = $("criteriaSubject")?.value;
  return subjects.find(subject => subject.name === name) || null;
}

function getSubjectComponents(subject) {
  if (subject && Array.isArray(subject.components) && subject.components.length) {
    return subject.components.map(component => ({
      name: component.name || "Component",
      weight: safeNumber(component.weight),
      score: safeNumber(component.score),
      scores: Array.isArray(component.scores) ? component.scores.map(item => ({
        score: safeNumber(item.score),
        maxScore: safeNumber(item.maxScore ?? item.max)
      })).filter(item => item.maxScore > 0) : []
    }));
  }

  if (subject) {
    return [
      { name: "Quiz", weight: safeNumber(subject.quizWeight), score: safeNumber(subject.quizScore), scores: legacyScore(subject.quizScore) },
      { name: "Exam", weight: safeNumber(subject.examWeight), score: safeNumber(subject.examScore), scores: legacyScore(subject.examScore) },
      { name: "Assignment", weight: safeNumber(subject.assignmentWeight), score: safeNumber(subject.assignmentScore), scores: legacyScore(subject.assignmentScore) }
    ];
  }

  return getDefaultComponents();
}

function matchesSubject(subject, query = getSearchQuery()) {
  if (!query) return true;
  const grade = safeNumber(subject.weightedGrade ?? subject.average ?? 0);
  const components = getSubjectComponents(subject).map(component =>
    `${component.name} ${format2(component.weight)} ${format2(component.score)}`
  );
  return [
    subject.name,
    subject.notes,
    grade,
    safeNumber(subject.equivalentGrade, 5),
    safeNumber(subject.goal),
    ...components
  ].some(part => String(part ?? "").toLowerCase().includes(query));
}

function matchesTask(task, query = getSearchQuery()) {
  if (!query) return true;
  return [
    task.subjectName,
    task.description,
    task.type,
    task.status,
    task.link,
    formatDeadline(task),
    getDaysLeft(task)
  ].some(part => String(part ?? "").toLowerCase().includes(query));
}

function legacyScore(score) {
  const value = safeNumber(score);
  return value > 0 ? [{ score: value, maxScore: 100 }] : [];
}

function formatSubScores(scores) {
  if (!Array.isArray(scores)) return "";
  return scores
    .filter(item => safeNumber(item.maxScore ?? item.max) > 0)
    .map(item => `${safeNumber(item.score)}/${safeNumber(item.maxScore ?? item.max)}`)
    .join("\n");
}

function parseSubScores(text) {
  return String(text || "")
    .split(/\n|,/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split("/");
      if (parts.length !== 2) return null;
      const score = safeNumber(parts[0], NaN);
      const maxScore = safeNumber(parts[1], NaN);
      if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
      return { score, maxScore };
    })
    .filter(Boolean);
}

function findInvalidSubScore(components) {
  for (const component of components) {
    for (const item of component.scores) {
      const score = safeNumber(item.score);
      const maxScore = safeNumber(item.maxScore);
      if (score < 0) return `${component.name}: score cannot be negative`;
      if (score > maxScore) return `${component.name}: ${score}/${maxScore} is higher than the maximum score`;
    }
  }
  return "";
}

function renderCriteriaRows(components) {
  const container = $("criteriaRows");
  if (!container) return;

  container.innerHTML = components.map((component, index) => `
    <div class="weight-row criteria-row" data-index="${index}">
      <div class="field">
        <label>Component</label>
        <input class="criteria-name" type="text" value="${escapeAttr(component.name)}" placeholder="e.g. Laboratory"/>
      </div>
      <div class="field">
        <label>Weight %</label>
        <input class="criteria-weight" type="number" value="${safeNumber(component.weight)}" min="0" max="100"/>
      </div>
      <div class="field">
        <label>Scores</label>
        <textarea class="criteria-scores" rows="3" placeholder="32/40&#10;75/90">${escapeHtml(formatSubScores(component.scores))}</textarea>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeCriteriaRow(${index})" type="button">Remove</button>
    </div>
  `).join("");
}

function readCriteriaRows() {
  return [...document.querySelectorAll(".criteria-row")]
    .map(row => ({
      name: row.querySelector(".criteria-name").value.trim() || "Component",
      weight: safeNumber(row.querySelector(".criteria-weight").value),
      scores: parseSubScores(row.querySelector(".criteria-scores").value)
    }))
    .filter(component => component.name || component.weight || component.scores.length);
}

function loadCriteriaForm() {
  const subject = getSelectedSubject();
  const components = getSubjectComponents(subject);
  renderCriteriaRows(components.length ? components : getDefaultComponents());

  if (subject) {
    $("studyHours").value = safeNumber(subject.studyHours) || "";
    $("studyFreq").value = safeNumber(subject.studyFrequency) || "";
    $("targetGrade").value = safeNumber(subject.goal) || "";
  } else {
    $("studyHours").value = "";
    $("studyFreq").value = "";
    $("targetGrade").value = "";
  }
}

function getWhatIfSubject() {
  const name = $("whatIfSubject")?.value;
  return subjects.find(subject => subject.name === name) || null;
}

function loadWhatIfForm() {
  const subject = getWhatIfSubject();
  const componentSelect = $("whatIfComponent");
  if (!componentSelect) return;

  const components = getSubjectComponents(subject);
  componentSelect.innerHTML = "";

  if (!subject || !components.length) {
    componentSelect.innerHTML = '<option value="">No components</option>';
    calculateWhatIf();
    return;
  }

  components.forEach((component, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = component.name;
    componentSelect.appendChild(opt);
  });
  calculateWhatIf();
}

function calculateWhatIf() {
  const result = $("whatIfResult");
  if (!result) return;

  const subject = getWhatIfSubject();
  if (!subject) {
    result.textContent = "Select a subject to start.";
    return;
  }

  const components = getSubjectComponents(subject);
  const index = safeNumber($("whatIfComponent")?.value, 0);
  const target = safeNumber($("whatIfTarget")?.value, 0);
  const targetComponent = components[index];

  if (!targetComponent || safeNumber(targetComponent.weight) <= 0) {
    result.textContent = "Choose a component with a weight above 0%.";
    return;
  }

  const otherContribution = components.reduce((sum, component, componentIndex) => {
    if (componentIndex === index) return sum;
    return sum + safeNumber(component.score) * safeNumber(component.weight) / 100;
  }, 0);
  const needed = (target - otherContribution) * 100 / safeNumber(targetComponent.weight);
  const current = safeNumber(targetComponent.score);

  if (needed <= 0) {
    result.innerHTML = `You already have enough from other components to reach <strong>${format2(target)}%</strong>.`;
  } else if (needed > 100) {
    result.innerHTML = `You would need <strong>${format2(needed)}%</strong> in ${escapeHtml(targetComponent.name)}, so the target is above the current reachable range.`;
  } else {
    result.innerHTML = `Need <strong>${format2(needed)}%</strong> in ${escapeHtml(targetComponent.name)}. Current component average is ${format2(current)}%.`;
  }
}

function addCriteriaRow() {
  const components = readCriteriaRows();
  components.push({ name: "", weight: 0, score: 0, scores: [] });
  renderCriteriaRows(components);
}

function removeCriteriaRow(index) {
  const components = readCriteriaRows();
  if (components.length <= 1) {
    showToast("At least one component is required", "warn");
    return;
  }
  components.splice(index, 1);
  renderCriteriaRows(components);
}

function loadCMSC21Template() {
  renderCriteriaRows([
    { name: "Long Exams", weight: 25, score: 0, scores: [] },
    { name: "Final Exam/Final Project", weight: 20, score: 0, scores: [] },
    { name: "Quizzes/Assignments", weight: 10, score: 0, scores: [] },
    { name: "Attendance/Participation", weight: 5, score: 0, scores: [] },
    { name: "Laboratory", weight: 40, score: 0, scores: [] }
  ]);
}

async function saveCriteria() {
  const name = $("criteriaSubject").value;

  if (!name) {
    showToast("Select a subject first", "warn");
    return;
  }

  const payload = {
    name,
    components: readCriteriaRows(),
    studyHours: safeNumber($("studyHours").value),
    studyFrequency: safeNumber($("studyFreq").value),
    goal: safeNumber($("targetGrade").value),
    units: safeNumber(getSelectedSubject()?.units, 3)
  };

  const total = payload.components.reduce((sum, component) => {
    return sum + safeNumber(component.weight);
  }, 0);

  const hint = $("weightSumHint");
  if (hint) {
    hint.innerHTML = `Weight total: <code>${total}%<\/code>`;
  }

  if (Math.abs(total - 100) > 0.01) {
    showToast("Weights should total 100%", "warn");
  }

  const invalidScore = findInvalidSubScore(payload.components);
  if (invalidScore) {
    showToast(invalidScore, "err");
    return;
  }

  const previousSubjects = cloneSubjects();
  applyCriteriaLocally(name, payload);
  refreshInstantViews();
  showToast("Criteria saved successfully");

  try {
    const savedSubjects = await api("/subjects/criteria", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    subjects = savedSubjects;
    refreshInstantViews();
  } catch (err) {
    subjects = previousSubjects;
    refreshInstantViews();
    showToast(err.message, "err");
  }
}

function updateSubjectSelects() {
  const selects = [
    $("criteriaSubject"),
    $("taskSubject"),
    $("scheduleSubject"),
    $("taskFilterSubject"),
    $("whatIfSubject")
  ];

  selects.forEach(select => {
    if (!select) return;

    const current = select.value;
    select.innerHTML = "";

    if (select.id === "taskFilterSubject") {
      const all = document.createElement("option");
      all.value = "";
      all.textContent = "All subjects";
      select.appendChild(all);
    }

    if (subjects.length === 0 && select.id !== "taskFilterSubject") {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No subjects available";
      select.appendChild(opt);
      return;
    }

    subjects.forEach(subject => {
      const opt = document.createElement("option");
      opt.value = subject.name;
      opt.textContent = subject.name;
      select.appendChild(opt);
    });

    if (current) {
      select.value = current;
    }
  });

  loadCriteriaForm();
  loadWhatIfForm();
  loadScheduleForm();
}

function renderSubjects() {
  renderSubjectTable();
  renderSubjectCards();
  renderSubjectNotes();
}

function renderSubjectNotes() {
  const container = $("subjectNotesList");
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<div class="empty-state">No subjects yet.</div>`;
    return;
  }

  const visibleSubjects = subjects.filter(subject => matchesSubject(subject));
  if (!visibleSubjects.length) {
    container.innerHTML = `<div class="empty-state">No subjects match your search.</div>`;
    return;
  }

  container.innerHTML = visibleSubjects.map(subject => {
    const index = subjects.indexOf(subject);
    const safeId = cssSafe(subject.name);
    const attachments = getNoteFiles(subject.name);
    const attachList = attachments.length
      ? `<div class="note-attachments">
          ${attachments.map(file => `
            <div class="note-attach-item">
              <span class="note-attach-name" onclick="openNoteFile(${JSON.stringify(subject.name)},${JSON.stringify(file.name)})" title="Open ${escapeAttr(file.name)}">File: ${escapeHtml(file.name)}</span>
              <button class="note-attach-remove" onclick="removeNoteFile(${JSON.stringify(subject.name)},${JSON.stringify(file.name)})" title="Remove">x</button>
            </div>`).join("")}
        </div>`
      : `<div class="hint">No files attached.</div>`;

    return `
      <article class="subject-note-card">
        <div class="subject-note-head">
          <h3>${escapeHtml(subject.name)}</h3>
          <span>${attachments.length} file${attachments.length === 1 ? "" : "s"}</span>
        </div>
        <div class="field">
          <label for="subjectNotes-${safeId}">Notes</label>
          <textarea id="subjectNotes-${safeId}" rows="5">${escapeHtml(subject.notes || "")}</textarea>
          ${attachList}
          <div class="note-attach-actions">
            <button class="btn btn-sm" onclick="openNoteFilePickerForIndex(${index})" title="Attach a PDF or image">Attach File</button>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveSubjectNotesByIndex(${index})">Save Notes</button>
      </article>`;
  }).join("");
}

function renderSubjectCards() {
  const container = $("subjectCards");
  if (!container) return;

  if (subjects.length === 0) {
    container.innerHTML =
      `<div class="empty-state">No subjects yet - add some in the Subjects tab.</div>`;
    return;
  }

  container.innerHTML = subjects.map(subject => {
    const grade = safeNumber(subject.weightedGrade ?? subject.average ?? 0);
    const equivalent = safeNumber(subject.equivalentGrade, 5);
    const notes = subject.notes || "No notes";
    const width = Math.min(100, Math.max(0, grade));
    const theme = subjectTheme(subject.name);

    return `
      <div class="subject-card" style="${subjectThemeStyle(theme)}">
        <div class="sc-name">${escapeHtml(subject.name)}</div>
        <div class="sc-notes">${escapeHtml(notes)}</div>
        <div class="sc-grade">${format2(grade)} / ${format2(equivalent, 5)}</div>
        <div class="sc-bar-wrap">
          <div class="sc-bar" style="width:${width}%; background:linear-gradient(90deg, var(--subject-color), var(--subject-color-2));"></div>
        </div>
      </div>
    `;
  }).join("");
}



