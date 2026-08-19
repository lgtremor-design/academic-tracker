/* ==========================================================
   Academic Tracker - app.js
   Frontend controller for the C backend (127.0.0.1:8080)
   ========================================================== */

// Use 127.0.0.1 so the browser talks directly to this laptop.
// On some Windows setups, the first "localhost" request waits a few seconds.
const API_BASE = "http://127.0.0.1:8080";

let subjects = [];
let tasks = [];
let events = [];
let analytics = null;
let toastTimer = null;
let calendarCursor = new Date();
let editingTaskId = null;
let activeThemeConfig = null;
const MAX_ABSENCES = 6;
const DESIGN_THEME_KEY = "atDesignTheme";
const DESIGN_THEME_VERSION_KEY = "atDesignThemeDefaultVersion";
const DESIGN_THEME_DEFAULT_VERSION = "standard-v1";
const THEME_CONFIG = {
  standard: {
    name: "Clean Green",
    title: "You are doing amazing today.",
    subtitle: "Here is your academic overview for today.",
    backgroundImages: [],
    characterImages: [],
    mainCharacter: {
      name: "Academic Tracker",
      subtitle: "Clean light dashboard",
      image: ""
    },
    colors: {
      bg: "#f3f7f1",
      bg2: "#e7f0e8",
      surface: "rgba(255,255,255,.92)",
      surface2: "#f7fbf6",
      surface3: "#eaf3eb",
      accent: "#12733d",
      accent2: "#31a35f",
      accent3: "#083f2b",
      accentRgb: "18,115,61",
      charcoal: "#10231b",
      charcoal2: "#446257",
      charcoalRgb: "16,35,27",
      text: "#10231b",
      text2: "#446257",
      text3: "#7d9389",
      textInv: "#ffffff",
      green: "#16834a",
      amber: "#d88a16",
      red: "#d94f45",
      blue: "#2b7c8f",
      teal: "#0d9488",
      border: "rgba(16,35,27,.08)",
      border2: "rgba(18,115,61,.16)"
    }
  },
  demonslayer: {
    name: "Demon Slayer",
    title: "Demon Slayer Dashboard",
    subtitle: "Set your heart ablaze.",
    backgroundImages: [
      "assets/themes/Demonslayer/renguko-oneeye.jpg",
      "assets/themes/Demonslayer/renguko-fierce.jpg",
      "assets/themes/Demonslayer/renguko-front.jpg"
    ],
    characterImages: [
      "assets/themes/Demonslayer/renguko-oneeye.jpg",
      "assets/themes/Demonslayer/renguko-fierce.jpg",
      "assets/themes/Demonslayer/renguko-front.jpg",
      "assets/themes/Demonslayer/renguko-smile.jpg"

    ],
    mainCharacter: {
      name: "Kyojuro Rengoku",
      subtitle: "Flame Hashira centerpiece",
      image: "assets/themes/Demonslayer/renguko-oneeye.jpg"
    },
    colors: {
      bg: "#120f0d",
      bg2: "#201511",
      surface: "rgba(19,17,14,.76)",
      surface2: "rgba(32,23,18,.84)",
      surface3: "rgba(245,118,35,.15)",
      accent: "#f97316",
      accent2: "#facc15",
      accent3: "#7f1d1d",
      accentRgb: "249,115,22",
      charcoal: "#120f0d",
      charcoal2: "#31150f",
      charcoalRgb: "18,15,13",
      text: "#fff8e7",
      text2: "#fde7bc",
      text3: "#f8bd72",
      textInv: "#ffffff",
      green: "#facc15",
      amber: "#f97316",
      red: "#ef4444",
      blue: "#fb923c",
      teal: "#fde68a",
      border: "rgba(249,115,22,.3)",
      border2: "rgba(250,204,21,.34)"
    }
  },
  jujutsu: {
    name: "Jujutsu Kaisen",
    title: "Jujutsu Kaisen Dashboard",
    subtitle: "Daijoubo desho datte kimi yowaimo",
    backgroundImages: [
      "assets/themes/jujutsu/gojo-main.jpg",
      "assets/themes/jujutsu/gojo-domain.jpg",
      "assets/themes/jujutsu/gojo-blue.webp",
      "assets/themes/jujutsu/gojo-black.png"
    ],
    characterImages: [
      "assets/themes/jujutsu/gojo-main.jpg",
      "assets/themes/jujutsu/gojo-domain.jpg",
      "assets/themes/jujutsu/gojo-black.png",
      "assets/themes/jujutsu/gojo-blue.webp"

    ],
    mainCharacter: {
      name: "Gojo Satoru",
      subtitle: "Limitless focus mode",
      image: "assets/themes/jujutsu/gojo-main.jpg"
    },
    colors: {
      bg: "#0b1020",
      bg2: "#15112b",
      surface: "rgba(13,16,33,.76)",
      surface2: "rgba(21,20,43,.84)",
      surface3: "rgba(99,102,241,.16)",
      accent: "#7dd3fc",
      accent2: "#a78bfa",
      accent3: "#111827",
      accentRgb: "125,211,252",
      charcoal: "#0b1020",
      charcoal2: "#242044",
      charcoalRgb: "11,16,32",
      text: "#f8fbff",
      text2: "#dbeafe",
      text3: "#b9c6e4",
      textInv: "#ffffff",
      green: "#7dd3fc",
      amber: "#a78bfa",
      red: "#f472b6",
      blue: "#60a5fa",
      teal: "#22d3ee",
      border: "rgba(125,211,252,.26)",
      border2: "rgba(167,139,250,.36)"
    }
  },
  royalblue: {
    name: "Royal Blue (Luxury Mode)",
    title: "Royal Blue Luxury Dashboard",
    subtitle: "Focus with clarity. Move with precision.",
    backgroundImages: [],
    characterImages: [],
    mainCharacter: {
      name: "Luxury Mode",
      subtitle: "Royal blue command center",
      image: ""
    },
    colors: {
      bg: "#061126",
      bg2: "#0a1b3d",
      surface: "rgba(7,18,42,.68)",
      surface2: "rgba(12,30,68,.78)",
      surface3: "rgba(65,105,225,.16)",
      accent: "#4169E1",
      accent2: "#b9d7ff",
      accent3: "#03102b",
      accentRgb: "65,105,225",
      charcoal: "#061126",
      charcoal2: "#102a5c",
      charcoalRgb: "6,17,38",
      text: "#f8fbff",
      text2: "#dbeafe",
      text3: "#a9c7ff",
      textInv: "#ffffff",
      green: "#b9d7ff",
      amber: "#93c5fd",
      red: "#bfdbfe",
      blue: "#4169E1",
      teal: "#7dd3fc",
      border: "rgba(185,215,255,.24)",
      border2: "rgba(65,105,225,.42)"
    }
  }
};
const DESIGN_THEMES = Object.keys(THEME_CONFIG);
const preloadedThemeImages = new Set();

function preloadThemeImages(config) {
  [...config.backgroundImages, ...config.characterImages, config.mainCharacter.image].filter(Boolean).forEach(src => {
    if (!src || preloadedThemeImages.has(src)) return;
    preloadedThemeImages.add(src);
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.src = src;
  });
}

function applyDesignTheme(theme) {
  const selected = DESIGN_THEMES.includes(theme) ? theme : "standard";
  const config = THEME_CONFIG[selected];
  const root = document.documentElement;
  preloadThemeImages(config);

  Object.entries(config.colors).forEach(([key, value]) => {
    const cssName = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    root.style.setProperty(`--${cssName}`, value);
  });
  root.style.setProperty("--accent-dim", `rgba(${config.colors.accentRgb},.14)`);
  root.style.setProperty("--accent-glow", `rgba(${config.colors.accentRgb},.26)`);
  root.style.setProperty("--theme-image", config.mainCharacter.image ? `url("${config.mainCharacter.image}")` : "none");

  document.body.dataset.theme = selected;
  document.body.classList.add("theme-is-switching");
  const select = $("themeSelect");
  if (select) select.value = selected;
  renderAnimeTheme(config);
  window.setTimeout(() => document.body.classList.remove("theme-is-switching"), 220);
}

function setDesignTheme(theme) {
  const selected = DESIGN_THEMES.includes(theme) ? theme : "standard";
  localStorage.setItem(DESIGN_THEME_KEY, selected);
  applyDesignTheme(selected);
}

function initializeDesignTheme() {
  let selected = localStorage.getItem(DESIGN_THEME_KEY);
  const defaultVersion = localStorage.getItem(DESIGN_THEME_VERSION_KEY);
  if (!selected || (defaultVersion !== DESIGN_THEME_DEFAULT_VERSION && selected === "royalblue")) {
    selected = "standard";
    localStorage.setItem(DESIGN_THEME_KEY, selected);
  }
  localStorage.setItem(DESIGN_THEME_VERSION_KEY, DESIGN_THEME_DEFAULT_VERSION);
  applyDesignTheme(selected);
  const preloadRest = () => DESIGN_THEMES
    .filter(key => key !== selected)
    .forEach(key => preloadThemeImages(THEME_CONFIG[key]));
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preloadRest);
  } else {
    window.setTimeout(preloadRest, 900);
  }
}

function renderAnimeTheme(config) {
  activeThemeConfig = config;
  const backdrop = $("animeThemeBackdrop");
  if (backdrop) {
    const backdropImages = getThemeGalleryImages(config);
    backdrop.innerHTML = backdropImages.length
      ? backdropImages.map((image, index) => `
        <div class="anime-bg-layer layer-${index + 1}" style="background-image:url('${escapeAttr(image)}')"></div>
      `).join("")
      : `<div class="luxury-bg-layer"></div>`;
  }

  const characterImage = $("themeCharacterImage");
  if (characterImage) {
    characterImage.toggleAttribute("hidden", !config.mainCharacter.image);
    characterImage.src = config.mainCharacter.image || "";
    characterImage.alt = config.mainCharacter.name;
    characterImage.onclick = config.mainCharacter.image ? () => openImageViewer(config.mainCharacter.image, config.mainCharacter.name) : null;
  }

  const characterName = $("themeCharacterName");
  if (characterName) characterName.textContent = config.mainCharacter.name;

  const characterSubtitle = $("themeCharacterSubtitle");
  if (characterSubtitle) characterSubtitle.textContent = config.mainCharacter.subtitle || "";

  const themeTitle = $("themeTitle");
  if (themeTitle) themeTitle.textContent = config.title || `${config.name} Dashboard`;

  const themeSubtitle = $("themeSubtitle");
  if (themeSubtitle) themeSubtitle.innerHTML = config.subtitle ? `<em>${escapeHtml(config.subtitle)}</em>` : "";

  const thumbs = $("themeThumbs");
  if (thumbs) {
    const images = getThemeGalleryImages(config);
    thumbs.innerHTML = images.length ? images.map((image, index) => `
      <button class="anime-thumb ${index === 0 ? "featured-thumb" : ""}" type="button" onclick="setFeaturedThemeImage('${escapeAttr(image)}', this)" ondblclick="openImageViewer('${escapeAttr(image)}', '${escapeAttr(config.mainCharacter.name)} artwork')">
        <img src="${escapeAttr(image)}" alt="" loading="lazy">
      </button>
    `).join("") : `
      <div class="luxury-swatch featured-thumb"></div>
      <div class="luxury-swatch"></div>
      <div class="luxury-swatch"></div>
    `;
  }
}

function setFeaturedThemeImage(src, button) {
  const characterImage = $("themeCharacterImage");
  if (!characterImage || !src) return;
  characterImage.hidden = false;
  characterImage.src = src;
  characterImage.alt = `${activeThemeConfig?.mainCharacter?.name || "Theme"} artwork`;
  characterImage.onclick = () => openImageViewer(src, characterImage.alt);
  document.querySelectorAll(".anime-thumb").forEach(thumb => thumb.classList.remove("featured-thumb"));
  button?.classList.add("featured-thumb");
}

function uniqueImages(images) {
  return [...new Set(images.filter(Boolean))];
}

function getThemeGalleryImages(config) {
  return uniqueImages([config.mainCharacter.image, ...config.characterImages, ...config.backgroundImages]).slice(0, 4);
}

function openImageViewer(src, alt = "Theme artwork") {
  const viewer = $("imageViewer");
  const image = $("imageViewerImg");
  if (!viewer || !image || !src) return;
  image.src = src;
  image.alt = alt;
  viewer.classList.remove("hide");
  viewer.setAttribute("aria-hidden", "false");
}

function closeImageViewer(event) {
  if (event && event.target?.id !== "imageViewer") return;
  const viewer = $("imageViewer");
  const image = $("imageViewerImg");
  if (!viewer || !image) return;
  viewer.classList.add("hide");
  viewer.setAttribute("aria-hidden", "true");
  image.src = "";
}

// ---- Extra schedule slots (frontend localStorage, supports multi-day per subject) ----
// Structure: { "SubjectName": [ { day, startHour, startMinute, endHour, endMinute, location }, ... ] }
function getExtraSlots() {
  try { return JSON.parse(localStorage.getItem("noviExtraSlots") || "{}"); } catch { return {}; }
}
function saveExtraSlots(slots) {
  localStorage.setItem("noviExtraSlots", JSON.stringify(slots));
}
function addExtraSlot(subjectName, slot) {
  const slots = getExtraSlots();
  if (!slots[subjectName]) slots[subjectName] = [];
  slots[subjectName].push(slot);
  saveExtraSlots(slots);
}
function removeExtraSlot(subjectName, index) {
  const slots = getExtraSlots();
  if (!slots[subjectName]) return;
  slots[subjectName].splice(index, 1);
  if (!slots[subjectName].length) delete slots[subjectName];
  saveExtraSlots(slots);
}
function getCustomSlots() {
  try { return JSON.parse(localStorage.getItem("noviCustomSlots") || "[]"); } catch { return []; }
}
function saveCustomSlots(slots) {
  localStorage.setItem("noviCustomSlots", JSON.stringify(slots));
}
function addCustomSlot(slot) {
  const slots = getCustomSlots();
  slots.push(slot);
  saveCustomSlots(slots);
}
function removeCustomSlot(index) {
  const slots = getCustomSlots();
  slots.splice(index, 1);
  saveCustomSlots(slots);
}
function getAllSlotsForSubject(subject) {
  // Primary slot from backend
  const primary = [];
  if (subject.scheduleDay) {
    primary.push({
      day: subject.scheduleDay,
      startHour: safeNumber(subject.scheduleStartHour),
      startMinute: safeNumber(subject.scheduleStartMinute),
      endHour: safeNumber(subject.scheduleEndHour),
      endMinute: safeNumber(subject.scheduleEndMinute),
      location: subject.scheduleLocation || "",
      isPrimary: true
    });
  }
  // Extra slots from localStorage
  const extra = (getExtraSlots()[subject.name] || []).map((s, extraIndex) => ({ ...s, extraIndex, isPrimary: false }));
  return [...primary, ...extra];
}
function formatSlotTime(slot) {
  const start = `${String(slot.startHour).padStart(2,"0")}:${String(slot.startMinute).padStart(2,"0")}`;
  const end   = `${String(slot.endHour).padStart(2,"0")}:${String(slot.endMinute).padStart(2,"0")}`;
  return `${slot.day}, ${start}-${end}`;
}

/* ==========================================================
   Utility Functions
   ========================================================== */

function $(id) {
  return document.getElementById(id);
}

function showToast(message, type = "ok") {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hide");
  }, type === "err" ? 5000 : 3500);

  toast.classList.remove("hide");
}

function getSearchQuery() {
  return ($("globalSearch")?.value || "").trim().toLowerCase();
}

function matchesSearch(parts) {
  const query = getSearchQuery();
  if (!query) return true;
  return parts.some(part => String(part ?? "").toLowerCase().includes(query));
}

function formatDaysLabel(days) {
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

function isTaskOverdue(task) {
  return task && task.status !== "Done" && getDaysLeft(task) < 0;
}

function renderDaysBadge(days, status = "") {
  if (status === "Done") return badge("Completed", "green");
  if (days < 0) return badge("Overdue", "red");
  if (days === 0) return badge("Due today", "amber");
  return `${days}`;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function format2(value, fallback = 0) {
  return safeNumber(value, fallback).toFixed(2);
}

/**
 * Convert a decimal hours value (e.g. 1.5) to a "1h 30m" string.
 * Shows only minutes when hours < 1, and omits minutes when mins === 0.
 */
function formatHours(decimalHours) {
  const totalMinutes = Math.round(safeNumber(decimalHours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getTrackedStudyHours(subject) {
  return safeNumber(subject?.trackedStudyHours);
}

function getStudyHourRows({ includeZero = false } = {}) {
  return subjects
    .map(subject => ({
      subject,
      name: subject.name || "Unnamed Subject",
      hours: getTrackedStudyHours(subject),
      target: getStudyTargetHours(subject),
      theme: subjectTheme(subject.name || "Unnamed Subject")
    }))
    .filter(row => includeZero || row.hours > 0)
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
}

function getTotalTrackedStudyHours() {
  return subjects.reduce((sum, subject) => sum + getTrackedStudyHours(subject), 0);
}

function getStudyHoursBySubjectFromSubjects({ includeZero = false } = {}) {
  return getStudyHourRows({ includeZero }).reduce((totals, row) => {
    totals[row.name] = row.hours;
    return totals;
  }, {});
}

function getStudyTargetHours(subject) {
  return safeNumber(subject?.studyHours);
}

function getRemainingStudyHours(subject) {
  return Math.max(0, getStudyTargetHours(subject) - getTrackedStudyHours(subject));
}

function formatStudyProgress(subject) {
  const studied = getTrackedStudyHours(subject);
  const target = getStudyTargetHours(subject);
  if (target > 0) {
    return `${formatHours(studied)} / ${formatHours(target)}`;
  }
  return `${formatHours(studied)}`;
}

function studyProgressNote(subject) {
  const target = getStudyTargetHours(subject);
  if (target > 0) {
    const remaining = getRemainingStudyHours(subject);
    return `${formatHours(remaining)} remaining`;
  }
  return "No target set";
}

function refreshInstantViews() {
  renderSubjects();
  updateSubjectSelects();
  updateDashboard();
  renderUpcomingTasks();
  renderCalendar();
  renderSchedule();
  renderAnalytics();
}

function cloneSubjects() {
  return subjects.map(subject => ({
    ...subject,
    components: Array.isArray(subject.components)
      ? subject.components.map(component => ({
          ...component,
          scores: Array.isArray(component.scores) ? component.scores.map(score => ({ ...score })) : []
        }))
      : [],
    scores: Array.isArray(subject.scores) ? [...subject.scores] : []
  }));
}

function componentAverage(component) {
  const scores = Array.isArray(component.scores) ? component.scores : [];
  const valid = scores.filter(item => safeNumber(item.maxScore) > 0);
  if (!valid.length) return safeNumber(component.score);
  const total = valid.reduce((sum, item) => {
    return sum + (safeNumber(item.score) / safeNumber(item.maxScore)) * 100;
  }, 0);
  return total / valid.length;
}

function convertNumericToEquivalent(grade) {
  if (grade >= 94) return 1.0;
  if (grade >= 90) return 1.25;
  if (grade >= 87) return 1.5;
  if (grade >= 84) return 1.75;
  if (grade >= 80) return 2.0;
  if (grade >= 75) return 2.25;
  if (grade >= 70) return 2.5;
  if (grade >= 65) return 2.75;
  if (grade >= 60) return 3.0;
  if (grade >= 50) return 4.0;
  return 5.0;
}

function buildOptimisticSubject({ name, notes = "", units = 3 }) {
  return {
    name,
    notes,
    units: safeNumber(units, 3),
    components: getDefaultComponents(),
    weightedGrade: 0,
    equivalentGrade: 5,
    average: 0,
    scoreCount: 0,
    scores: [],
    studyHours: 0,
    trackedStudyHours: 0,
    studyFrequency: 0,
    goal: 0,
    absences: 0
  };
}

function applyCriteriaLocally(name, payload) {
  const subject = subjects.find(item => item.name === name);
  if (!subject) return;

  const components = payload.components.map(component => ({
    ...component,
    score: componentAverage(component)
  }));
  const totalWeight = components.reduce((sum, component) => sum + safeNumber(component.weight), 0);
  const weightedGrade = totalWeight
    ? components.reduce((sum, component) => sum + component.score * safeNumber(component.weight), 0) / 100
    : 0;

  subject.components = components;
  subject.weightedGrade = weightedGrade;
  subject.equivalentGrade = convertNumericToEquivalent(weightedGrade);
  subject.average = weightedGrade;
  subject.studyHours = payload.studyHours;
  subject.trackedStudyHours = safeNumber(subject.trackedStudyHours);
  subject.studyFrequency = payload.studyFrequency;
  subject.goal = payload.goal;
  subject.units = payload.units;
}

function getStudentName() {
  const stored = localStorage.getItem("noviStudentName");
  return stored !== null ? stored : "student";
}

function renderStudentName() {
  const raw = getStudentName();
  const display = raw.trim() || "student";
  const greeting = $("studentGreeting");
  const welcome = $("welcomeTitle");
  const input = $("studentNameInput");
  const avatar = $("studentAvatar");

  if (greeting) greeting.textContent = `${getTimeGreeting()}, ${display}`;
  if (welcome) welcome.textContent = `Welcome back, ${display}!`;
  // Only sync input value when user is NOT actively typing in it
  if (input && document.activeElement !== input) input.value = raw;
  if (avatar) avatar.textContent = display.trim().charAt(0).toUpperCase() || "S";
}

function initializeStudentName() {
  const input = $("studentNameInput");
  if (!input) return;

  // Restore whatever was saved (could be empty string = user cleared it)
  const stored = localStorage.getItem("noviStudentName");
  input.value = stored !== null ? stored : "student";
  renderStudentName();

  // Save on every keystroke - including when field is empty - so user can clear and retype
  input.addEventListener("input", () => {
    localStorage.setItem("noviStudentName", input.value);
    renderStudentName();
  });

  // After blur, refresh display labels without touching the input itself
  input.addEventListener("blur", () => {
    const greeting = $("studentGreeting");
    const welcome = $("welcomeTitle");
    const avatar = $("studentAvatar");
    const display = input.value.trim() || "student";
    if (greeting) greeting.textContent = `${getTimeGreeting()}, ${display}`;
    if (welcome) welcome.textContent = `Welcome back, ${display}!`;
    if (avatar) avatar.textContent = display.charAt(0).toUpperCase() || "S";
  });
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initializeSearch() {
  const input = $("globalSearch");
  if (!input) return;

  input.addEventListener("input", () => {
    renderSubjectTable();
    renderTasks();
    renderUpcomingTasks();
    renderAnalyticsCards();
    renderPriorityTable();
  });

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !input.value.trim()) return;
    const query = getSearchQuery();
    if (tasks.some(task => matchesTask(task, query))) showTab("tasks");
    else if (subjects.some(subject => matchesSubject(subject, query))) showTab("subjects");
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "/") {
      event.preventDefault();
      input.focus();
    }
  });
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/* ==========================================================
   API Helper
   ========================================================== */

async function api(path, options = {}) {
  // Send one request to the backend and wait for its reply.
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      // The backend expects JSON when the frontend sends form data.
      "Content-Type": "application/json"
    },
    ...options
  });

  // Read the reply as JSON when possible, otherwise read it as plain text.
  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Show the backend error message in the toast instead of a vague error.
    const msg =
      (data && data.error) ||
      response.statusText ||
      "Request failed";
    throw new Error(msg);
  }

  return data;
}

async function loadEvents() {
  try {
    events = await api("/events");
    renderCalendar();
  } catch (err) {
    console.error(err);
    events = [];
  }
}

/* ==========================================================
   Navigation
   ========================================================== */

function showTab(tabName) {
  // Hide every page first.
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });

  // Remove the active highlight from every menu button.
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active");
  });

  // Show the page that the user clicked.
  const tab = $(`tab-${tabName}`);
  if (tab) tab.classList.add("active");

  // Highlight the menu button for the current page.
  const nav = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
  if (nav) nav.classList.add("active");

  // Load extra data only when the page needs it.
  if (tabName === "analytics") {
    loadAnalytics();
  }
  if (tabName === "schedule") {
    loadScheduleForm();
    renderSchedule();
  }
  if (tabName === "calendar") renderCalendar();
  if (tabName === "studytimer") renderStudyTimer();
}

/* ==========================================================
   Server Health Check
   ========================================================== */

async function checkServer() {
  // These two items show the backend connection status in the sidebar.
  const dot = $("serverStatus");
  const label = $("serverLabel");

  // Show that the app is checking the backend right now.
  if (dot) dot.className = "status-dot checking";
  if (label) label.textContent = "Checking...";

  try {
    // Ask the backend if it is running.
    await api("/health");

    // If the request worked, show Online.
    if (dot) dot.className = "status-dot online";
    if (label) label.textContent = "Online";
  } catch (err) {
    // If the request failed, show Offline.
    if (dot) dot.className = "status-dot offline";
    if (label) label.textContent = "Offline";
  }
}


