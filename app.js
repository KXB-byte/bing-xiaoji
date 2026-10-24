const DB_NAME = "xiaoji-db";
const DB_VERSION = 2;
const ITEM_STORE = "items";
const TEMPLATE_STORE = "templates";
const META_STORE = "metadata";
const DRAFT_KEY = "xiaoji-item-draft";
const VIEW_KEY = "xiaoji-view";
const OPTION_LIBRARY_KEY = "xiaoji-option-library";
const OPTIONS_UPDATED_AT_KEY = "xiaoji-options-updated-at";
const LAST_SYNC_KEY = "xiaoji-last-sync";
const LAST_BACKUP_KEY = "xiaoji-last-backup";
const LAST_BACKUP_REMINDER_KEY = "xiaoji-last-backup-reminder";
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_REMINDER_INTERVAL_MS = 7 * DAY_MS;
const AUTO_SYNC_DELAY_MS = 1200;
const TRASH_RETENTION_MS = 30 * DAY_MS;
const OPTION_LIBRARY_VERSION = 2;
const DATA_SCHEMA_VERSION = 5;
const REMINDER_LEAD_MS = 5 * 60 * 1000;
const PLANNER_SWIPE_MIN_DISTANCE = 48;
const PLANNER_SWIPE_DIRECTION_RATIO = 1.2;
const FIXED_CALENDAR_LABELS = new Map([
  ["1-1", "元旦"],
  ["5-1", "劳动节"],
  ["10-1", "国庆"]
]);
const LUNAR_CALENDAR_LABELS = new Map([
  ["1-1", "春节"],
  ["1-15", "元宵"],
  ["2-2", "龙抬头"],
  ["5-5", "端午"],
  ["7-7", "七夕"],
  ["8-15", "中秋"],
  ["9-9", "重阳"],
  ["12-8", "腊八"]
]);
const SOLAR_TERM_NAMES = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至"
];
const SOLAR_TERM_MINUTES = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693, 263343, 285989,
  308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
];
const CHINESE_CALENDAR_FORMATTER = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  month: "numeric",
  day: "numeric"
});
const HAS_CHINESE_CALENDAR = CHINESE_CALENDAR_FORMATTER.resolvedOptions().calendar === "chinese";
const COLOR_PRESETS = [
  "#d58b63",
  "#c97c5d",
  "#b56576",
  "#9b5d73",
  "#7d4e68",
  "#5a3d52",
  "#f4a7b9",
  "#e6b8af",
  "#e9b872",
  "#f5bd4f",
  "#ddb892",
  "#a98467",
  "#d4e3b5",
  "#b7c9a8",
  "#8fc86f",
  "#6f9e7c",
  "#4f7c68",
  "#365d4a",
  "#a8dadc",
  "#57c2d1",
  "#62a9df",
  "#9bc7ee",
  "#5b8db8",
  "#355070",
  "#d8c4e8",
  "#b8a7d9",
  "#a985d6",
  "#8f7aae",
  "#735d78",
  "#4f4359",
  "#f2e8dc",
  "#d8c3a5",
  "#b7a99a",
  "#94a3b8",
  "#64748b",
  "#40372f",
  "#ff1744",
  "#ff5252",
  "#ff6d00",
  "#ff9100",
  "#ffd600",
  "#c6ff00",
  "#00e676",
  "#00e5ff",
  "#00b0ff",
  "#536dfe",
  "#7c4dff",
  "#ff4081"
];
const DEFAULT_CATEGORIES = [
  { name: "生活", color: "#f5bd4f" },
  { name: "科研", color: "#62a9df" },
  { name: "工作", color: "#9bc7ee" },
  { name: "运动", color: "#8fc86f" }
];

const state = {
  selectedDate: startOfDay(new Date()),
  view: localStorage.getItem(VIEW_KEY) || "day",
  items: [],
  templates: [],
  categories: [],
  tags: [],
  search: "",
  actionItemId: null,
  copyItemId: null,
  templateId: null,
  deleteItemId: null,
  optionDeletePending: false,
  plannerSwipeStart: null,
  ignorePlannerClickUntil: 0,
  periodTransitioning: false,
  optionColorEditType: null,
  optionColorEditName: null,
  completionTimers: new Map(),
  undoIds: [],
  undoTimer: null,
  installPrompt: null,
  optionsUpdatedAt: "1970-01-01T00:00:00.000Z",
  syncClient: null,
  syncTimer: null,
  syncInProgress: false,
  syncApplying: false,
  syncMessage: "尚未配置云同步",
  syncMessageType: "idle"
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  mapElements();
  state.syncClient = new window.XiaojiSyncClient();
  loadOptionLibrary();
  renderColorPresets();
  bindEvents();
  await openDatabase();
  await ensureDataSchemaMetadata();
  await purgeExpiredTrash();
  await refreshData();
  setView(state.view);
  registerServiceWorker();
  requestPersistentStorage();
  window.setTimeout(checkBackupReminder, 300);
  window.addEventListener("online", () => queueAutoSync(true));
  if (state.syncClient.isSignedIn()) window.setTimeout(() => syncNow({ silent: true }), 500);
}

function mapElements() {
  const ids = [
    "planner",
    "period-title",
    "date-picker",
    "previous-period",
    "next-period",
    "today-button",
    "search-input",
    "add-item",
    "open-templates",
    "open-trash",
    "open-data",
    "install-button",
    "item-dialog",
    "item-form",
    "item-dialog-title",
    "item-id",
    "item-title",
    "item-date",
    "item-time",
    "item-deadline-time",
    "item-category",
    "tag-options",
    "new-category-name",
    "new-category-color",
    "category-color-presets",
    "add-category",
    "new-tag-name",
    "new-tag-color",
    "tag-color-presets",
    "add-tag",
    "item-notes",
    "item-recurrence",
    "item-pinned",
    "item-weekly",
    "item-reminder",
    "delete-item",
    "save-template-from-item",
    "draft-hint",
    "action-dialog",
    "action-item-title",
    "edit-action",
    "copy-action",
    "template-action",
    "delete-action",
    "copy-dialog",
    "copy-form",
    "copy-date",
    "recurrence-delete-dialog",
    "templates-dialog",
    "templates-list",
    "template-date-dialog",
    "template-date-form",
    "template-date-title",
    "template-target-date",
    "trash-dialog",
    "trash-list",
    "backup-reminder-dialog",
    "backup-reminder-later",
    "backup-reminder-export",
    "data-dialog",
    "category-management-list",
    "tag-management-list",
    "option-color-dialog",
    "option-color-dialog-title",
    "option-color-palette",
    "export-data",
    "backup-status",
    "sync-status",
    "open-sync-settings",
    "sync-dialog",
    "sync-project-url",
    "sync-publishable-key",
    "sync-vapid-public-key",
    "save-sync-config",
    "clear-sync-config",
    "sync-account-section",
    "sync-email",
    "sync-password",
    "sync-login",
    "sync-session-section",
    "sync-account-email",
    "sync-now",
    "sync-logout",
    "notification-status",
    "toggle-notifications",
    "sync-dialog-status",
    "choose-import",
    "import-file",
    "snackbar",
    "snackbar-message",
    "snackbar-action"
  ];

  ids.forEach((id) => {
    elements[toCamelCase(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll(".close-dialog").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  elements.previousPeriod.addEventListener("click", () => movePeriod(-1));
  elements.nextPeriod.addEventListener("click", () => movePeriod(1));
  elements.todayButton.addEventListener("click", () => {
    state.selectedDate = startOfDay(new Date());
    setView("day");
  });
  elements.periodTitle.addEventListener("click", () => {
    elements.datePicker.value = toDateKey(state.selectedDate);
    if (typeof elements.datePicker.showPicker === "function") {
      elements.datePicker.showPicker();
    } else {
      elements.datePicker.click();
    }
  });
  elements.datePicker.addEventListener("change", () => {
    if (!elements.datePicker.value) return;
    state.selectedDate = fromDateKey(elements.datePicker.value);
    render();
  });
  elements.searchInput.addEventListener("input", () => {
    state.search = elements.searchInput.value.trim().toLocaleLowerCase("zh-CN");
    renderPlanner();
  });
  elements.planner.addEventListener("pointerdown", handlePlannerPointerDown);
  window.addEventListener("pointerup", handlePlannerPointerUp);
  window.addEventListener("pointercancel", clearPlannerSwipe);

  elements.addItem.addEventListener("click", () => openItemDialog());
  elements.itemForm.addEventListener("submit", saveItemFromForm);
  elements.itemForm.addEventListener("input", saveDraft);
  elements.itemTime.addEventListener("change", () => handleTimeChange(elements.itemTime, true));
  elements.itemDeadlineTime.addEventListener("change", () => handleTimeChange(elements.itemDeadlineTime));
  elements.categoryColorPresets.addEventListener("click", selectPresetColor);
  elements.tagColorPresets.addEventListener("click", selectPresetColor);
  elements.optionColorPalette.addEventListener("click", selectManagedOptionColor);
  elements.itemWeekly.addEventListener("change", updateWeeklyFormState);
  elements.addCategory.addEventListener("click", addCategory);
  elements.addTag.addEventListener("click", addTag);
  elements.deleteItem.addEventListener("click", () => requestDelete(elements.itemId.value));
  elements.saveTemplateFromItem.addEventListener("click", saveTemplateFromForm);

  elements.planner.addEventListener("click", handlePlannerClick);
  elements.editAction.addEventListener("click", editActionItem);
  elements.copyAction.addEventListener("click", openCopyDialog);
  elements.templateAction.addEventListener("click", saveActionItemAsTemplate);
  elements.deleteAction.addEventListener("click", () => requestDelete(state.actionItemId));
  elements.copyForm.addEventListener("submit", copyItemToDate);
  document.querySelectorAll(".delete-scope").forEach((button) => {
    button.addEventListener("click", () => deleteWithScope(button.dataset.scope));
  });

  elements.openTemplates.addEventListener("click", openTemplatesDialog);
  elements.templatesList.addEventListener("click", handleTemplateClick);
  elements.templateDateForm.addEventListener("submit", createItemFromTemplate);

  elements.openTrash.addEventListener("click", openTrashDialog);
  elements.trashList.addEventListener("click", handleTrashClick);
  elements.backupReminderLater.addEventListener("click", () => elements.backupReminderDialog.close());
  elements.backupReminderExport.addEventListener("click", () => {
    exportAllData();
    elements.backupReminderDialog.close();
  });
  elements.openData.addEventListener("click", openDataDialog);
  elements.openSyncSettings.addEventListener("click", openSyncDialog);
  elements.saveSyncConfig.addEventListener("click", saveSyncConfig);
  elements.clearSyncConfig.addEventListener("click", clearSyncConfig);
  elements.syncLogin.addEventListener("click", signInToSync);
  elements.syncNow.addEventListener("click", () => syncNow());
  elements.syncLogout.addEventListener("click", signOutOfSync);
  elements.toggleNotifications.addEventListener("click", togglePushNotifications);
  elements.categoryManagementList.addEventListener("click", handleOptionDelete);
  elements.tagManagementList.addEventListener("click", handleOptionDelete);
  elements.categoryManagementList.addEventListener("click", openManagedOptionColorDialog);
  elements.tagManagementList.addEventListener("click", openManagedOptionColorDialog);
  elements.exportData.addEventListener("click", exportAllData);
  elements.chooseImport.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importBackup);
  elements.snackbarAction.addEventListener("click", undoLastDelete);

  elements.installButton.addEventListener("click", installApp);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    elements.installButton.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    elements.installButton.classList.add("hidden");
  });
  navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
}

function handleServiceWorkerMessage(event) {
  if (event.data?.type !== "OPEN_REMINDER") return;
  if (event.data.date) state.selectedDate = fromDateKey(event.data.date);
  setView("day");
  const item = findItem(event.data.itemId);
  if (item && !item.deletedAt) openItemDialog(item);
}

async function openDatabase() {
  if (openDatabase.promise) return openDatabase.promise;

  openDatabase.promise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        const itemStore = db.createObjectStore(ITEM_STORE, { keyPath: "id" });
        itemStore.createIndex("date", "date", { unique: false });
        itemStore.createIndex("seriesId", "seriesId", { unique: false });
        itemStore.createIndex("deletedAt", "deletedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
        db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onblocked = () => {
      console.warn("数据库升级正在等待其他冰小记页面关闭");
    };
    request.onerror = () => reject(request.error);
  });

  return openDatabase.promise;
}

async function storeGetAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storePut(storeName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => {
      queueAutoSyncForStore(storeName);
      resolve(value);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function storePutMany(storeName, values) {
  if (!values.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    transaction.oncomplete = () => {
      queueAutoSyncForStore(storeName);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function refreshData() {
  const [items, templates] = await Promise.all([storeGetAll(ITEM_STORE), storeGetAll(TEMPLATE_STORE)]);
  state.items = items.map(normalizeItemRecord);
  state.templates = templates.map(normalizeTemplateRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  mergeOptionsFromSavedData([
    ...state.items.filter((item) => !item.deletedAt),
    ...state.templates.filter((template) => !template.deletedAt)
  ]);
  render();
}

async function ensureDataSchemaMetadata() {
  await storePut(META_STORE, {
    key: "dataSchema",
    version: DATA_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  });
}

function normalizeItemRecord(item) {
  const reminderEnabled =
    typeof item.reminderEnabled === "boolean" ? item.reminderEnabled : Boolean(item.time);
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    deadlineTime: typeof item.deadlineTime === "string" ? item.deadlineTime : "",
    reminderEnabled,
    reminderAt:
      reminderEnabled && item.time
        ? isValidTimestamp(item.reminderAt)
          ? item.reminderAt
          : buildReminderAt(item.date, item.time)
        : null,
    timeZone: typeof item.timeZone === "string" ? item.timeZone : getCurrentTimeZone(),
    purgedAt: typeof item.purgedAt === "string" ? item.purgedAt : null,
    weeklyOnly: Boolean(item.weeklyOnly),
    dataSchemaVersion: DATA_SCHEMA_VERSION
  };
}

function normalizeTemplateRecord(template) {
  const reminderEnabled =
    typeof template.reminderEnabled === "boolean" ? template.reminderEnabled : Boolean(template.time);
  return {
    ...template,
    tags: Array.isArray(template.tags) ? template.tags : [],
    deadlineTime: typeof template.deadlineTime === "string" ? template.deadlineTime : "",
    reminderEnabled,
    deletedAt: typeof template.deletedAt === "string" ? template.deletedAt : null,
    weeklyOnly: Boolean(template.weeklyOnly),
    dataSchemaVersion: DATA_SCHEMA_VERSION
  };
}

async function purgeExpiredTrash() {
  const threshold = Date.now() - TRASH_RETENTION_MS;
  const items = await storeGetAll(ITEM_STORE);
  const expired = items.filter(
    (item) => item.deletedAt && !item.purgedAt && new Date(item.deletedAt).getTime() < threshold
  );
  if (!expired.length) return;
  const now = new Date().toISOString();
  await storePutMany(
    ITEM_STORE,
    expired.map((item) => ({ ...item, purgedAt: now, updatedAt: now }))
  );
}

function setView(view) {
  const allowedViews = ["day", "week", "month"];
  state.view = allowedViews.includes(view) ? view : "day";
  localStorage.setItem(VIEW_KEY, state.view);
  document.body.dataset.view = state.view;
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  render();
}

function movePeriod(direction) {
  if (state.periodTransitioning) return;

  const updatePeriod = () => {
    applyPeriodMove(direction);
    render();
  };
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    updatePeriod();
    return;
  }

  state.periodTransitioning = true;
  document.documentElement.dataset.periodDirection = direction > 0 ? "next" : "previous";
  const finishTransition = () => {
    state.periodTransitioning = false;
    delete document.documentElement.dataset.periodDirection;
  };

  if (typeof document.startViewTransition === "function") {
    const transition = document.startViewTransition(updatePeriod);
    transition.finished.then(finishTransition, (error) => {
      console.error("日历切换动画失败", error);
      finishTransition();
    });
    return;
  }

  updatePeriod();
  const animation = elements.planner.animate(
    [
      { opacity: 0.35, transform: `translateX(${direction > 0 ? 18 : -18}px)` },
      { opacity: 1, transform: "translateX(0)" }
    ],
    { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );
  animation.finished.then(finishTransition, (error) => {
    if (error.name !== "AbortError") console.error("日历切换动画失败", error);
    finishTransition();
  });
}

function applyPeriodMove(direction) {
  const date = new Date(state.selectedDate);
  if (state.view === "day") date.setDate(date.getDate() + direction);
  if (state.view === "week") date.setDate(date.getDate() + direction * 7);
  if (state.view === "month") {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }
  state.selectedDate = startOfDay(date);
}

function handlePlannerPointerDown(event) {
  if (event.pointerType === "mouse" || !event.isPrimary) return;
  state.plannerSwipeStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY
  };
}

function handlePlannerPointerUp(event) {
  const start = state.plannerSwipeStart;
  clearPlannerSwipe();
  if (!start || start.pointerId !== event.pointerId) return;

  const horizontalDistance = event.clientX - start.x;
  const verticalDistance = event.clientY - start.y;
  if (
    Math.abs(horizontalDistance) < PLANNER_SWIPE_MIN_DISTANCE ||
    Math.abs(horizontalDistance) <= Math.abs(verticalDistance) * PLANNER_SWIPE_DIRECTION_RATIO
  ) {
    return;
  }

  state.ignorePlannerClickUntil = Date.now() + 350;
  movePeriod(horizontalDistance < 0 ? 1 : -1);
}

function clearPlannerSwipe() {
  state.plannerSwipeStart = null;
}

function render() {
  renderPeriodTitle();
  renderPlanner();
}

function renderPeriodTitle() {
  const currentYear = new Date().getFullYear();
  const selectedYear = state.selectedDate.getFullYear();
  const includeYear = selectedYear !== currentYear;

  if (state.view === "day") {
    elements.periodTitle.textContent = formatDate(state.selectedDate, {
      ...(includeYear ? { year: "numeric" } : {}),
      month: "long",
      day: "numeric",
      weekday: "short"
    });
    return;
  }

  if (state.view === "week") {
    const start = startOfWeek(state.selectedDate);
    const end = addDays(start, 6);
    const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    const yearPrefix = start.getFullYear() !== currentYear ? `${start.getFullYear()}年` : "";
    elements.periodTitle.textContent = sameMonth
      ? `${yearPrefix}${start.getMonth() + 1}月${start.getDate()}–${end.getDate()}日`
      : `${yearPrefix}${start.getMonth() + 1}月${start.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`;
    return;
  }

  elements.periodTitle.textContent = `${includeYear ? `${selectedYear}年` : ""}${state.selectedDate.getMonth() + 1}月`;
}

function renderPlanner() {
  if (state.view === "day") renderDayView();
  if (state.view === "week") renderWeekView();
  if (state.view === "month") renderMonthView();
}

function renderDayView() {
  const dateKey = toDateKey(state.selectedDate);
  const items = getVisibleItemsForDate(dateKey);
  const unfinished = items.filter((item) => !item.completed);
  const completed = items.filter((item) => item.completed);
  const heading = isToday(state.selectedDate) ? "今天" : formatDate(state.selectedDate, { month: "long", day: "numeric" });

  elements.planner.innerHTML = `
    <div class="day-layout">
      <div class="day-heading">
        <h2>${escapeHtml(heading)}</h2>
        <span>${items.length ? `${items.length} 项` : "轻松的一天"}</span>
      </div>
      ${unfinished.length ? `<div class="item-list">${unfinished.map(renderItemCard).join("")}</div>` : ""}
      ${
        completed.length
          ? `<section class="day-section">
              <h3>已完成 · ${completed.length}</h3>
              <div class="item-list">${completed.map(renderItemCard).join("")}</div>
            </section>`
          : ""
      }
      ${
        items.length
          ? ""
          : `<div class="empty-state">
              <div class="empty-icon">✓</div>
              <h3>这一天还没有事项</h3>
              <p>点右下角的加号，记下第一件事。</p>
            </div>`
      }
    </div>
  `;
}

function renderWeekView() {
  const start = startOfWeek(state.selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const weeklyItems = getWeeklyOnlyItems(start);

  elements.planner.innerHTML = `
    <div class="week-board">
      ${renderWeekOverview(weeklyItems)}
      ${days
        .map((date) => {
          const dateKey = toDateKey(date);
          const items = getVisibleItemsForDate(dateKey);
          const completedCount = items.filter((item) => item.completed).length;
          return `
            <section class="week-card ${dateKey === toDateKey(state.selectedDate) ? "selected" : ""}">
              <button class="week-day-button" type="button" data-select-date="${dateKey}">
                <span><strong>${date.getDate()}</strong> ${formatDate(date, { weekday: "short" })}</span>
                <em>${completedCount}/${items.length}</em>
              </button>
              <div class="week-item-list">
                ${items.length ? items.map(renderWeekItem).join("") : `<span class="week-empty">暂无事项</span>`}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderWeekOverview(items) {
  const completedCount = items.filter((item) => item.completed).length;
  return `
    <section class="week-card week-overview">
      <div class="week-overview-heading">
        <span class="overview-icon">✓</span>
        <strong>本周事项</strong>
        <em>${completedCount}/${items.length}</em>
        <button class="week-add-button" type="button" data-add-weekly aria-label="添加本周总体事项">＋</button>
      </div>
      <div class="week-item-list">
        ${items.length ? items.map(renderWeekItem).join("") : '<span class="week-empty">本周还没有事项</span>'}
      </div>
    </section>`;
}

function renderWeekItem(item) {
  const categoryColor = getCategoryColor(item.category);
  return `
    <div class="week-item ${item.completed ? "completed" : ""}" data-item-id="${item.id}">
      <span class="week-item-dot" style="background:${categoryColor}"></span>
      <button type="button" class="week-item-title" data-open-id="${item.id}">${escapeHtml(item.title)}</button>
      <button class="week-complete" type="button" data-complete-id="${item.id}" aria-label="${
        item.completed ? "标记为未完成" : "标记为完成"
      }">${item.completed ? "✓" : ""}</button>
    </div>`;
}

function getLunarDateParts(date) {
  if (!HAS_CHINESE_CALENDAR) return null;
  const parts = CHINESE_CALENDAR_FORMATTER.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  if (!/^\d+$/.test(month) || !/^\d+$/.test(day)) return null;
  return { month: Number(month), day: Number(day) };
}

function getLunarCalendarLabel(date) {
  const lunarDate = getLunarDateParts(date);
  if (!lunarDate) return "";
  const label = LUNAR_CALENDAR_LABELS.get(`${lunarDate.month}-${lunarDate.day}`);
  if (label) return label;

  const nextLunarDate = getLunarDateParts(addDays(date, 1));
  return nextLunarDate?.month === 1 && nextLunarDate.day === 1 ? "除夕" : "";
}

function getSolarTermLabel(date) {
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return "";
  const baseTime = Date.UTC(1900, 0, 6, 2, 5);
  for (let index = 0; index < SOLAR_TERM_NAMES.length; index += 1) {
    const termDate = new Date(baseTime + 31556925974.7 * (year - 1900) + SOLAR_TERM_MINUTES[index] * 60_000);
    if (termDate.getUTCMonth() === date.getMonth() && termDate.getUTCDate() === date.getDate()) {
      return SOLAR_TERM_NAMES[index];
    }
  }
  return "";
}

function getCalendarLabel(date) {
  const fixedLabel = FIXED_CALENDAR_LABELS.get(`${date.getMonth() + 1}-${date.getDate()}`) || "";
  const labels = [fixedLabel, getLunarCalendarLabel(date), getSolarTermLabel(date)].filter(
    (label, index, allLabels) => label && allLabels.indexOf(label) === index
  );
  return labels.join(" · ");
}

function renderMonthView() {
  const firstOfMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

  elements.planner.innerHTML = `
    <div class="month-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="month-grid">
      ${days
        .map((date) => {
          const dateKey = toDateKey(date);
          const items = getVisibleItemsForDate(dateKey);
          const outside = date.getMonth() !== state.selectedDate.getMonth();
          const calendarLabel = getCalendarLabel(date);
          return `
            <button
              class="month-cell ${outside ? "outside" : ""} ${isToday(date) ? "today" : ""} ${
                dateKey === toDateKey(state.selectedDate) ? "selected" : ""
              }"
              type="button"
              data-select-date="${dateKey}"
            >
              <span class="month-date-line">
                <span class="month-number">${date.getDate()}</span>
                ${
                  calendarLabel
                    ? `<span class="month-calendar-label" title="${escapeHtml(calendarLabel)}">${escapeHtml(
                        calendarLabel
                      )}</span>`
                    : ""
                }
              </span>
              <span class="month-items">
                ${items
                  .map(
                    (item) => {
                      const categoryColor = getCategoryColor(item.category);
                      return `<span class="month-item ${item.completed ? "completed" : ""}" style="background:${hexToRgba(
                        categoryColor,
                        0.18
                      )};color:${categoryColor}">${escapeHtml(item.title)}</span>`;
                    }
                  )
                  .join("")}
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderItemCard(item) {
  const categoryColor = getCategoryColor(item.category);
  const plainMeta = [
    formatTimeRange(item),
    item.reminderEnabled && item.time && !item.completed ? "提前5分钟提醒" : "",
    item.seriesId ? recurrenceLabel(item.recurrence) : "",
    item.pinned ? "已置顶" : ""
  ]
    .filter(Boolean)
    .map((entry) => `<span>${escapeHtml(entry)}</span>`);
  const categoryMeta = item.category
    ? `<span class="category-badge" style="--badge-color:${categoryColor};--badge-tint:${hexToRgba(
        categoryColor,
        0.13
      )}">${escapeHtml(item.category)}</span>`
    : "";
  const tagMeta = (item.tags || [])
    .map((tag) => {
      const tagColor = getTagColor(tag);
      return `<span class="tag-badge" style="--tag-color:${tagColor};--tag-tint:${hexToRgba(tagColor, 0.12)}">#${escapeHtml(
        tag
      )}</span>`;
    })
    .join("");

  return `
    <article class="item-card ${item.completed ? "completed" : ""} ${
      item.pinned ? "pinned" : ""
    }" style="--category-color:${categoryColor};--category-tint:${hexToRgba(categoryColor, 0.1)}" data-item-id="${item.id}">
      <button class="complete-button" type="button" data-complete-id="${item.id}" aria-label="${
        item.completed ? "标记为未完成" : "标记为完成"
      }">${item.completed ? "✓" : ""}</button>
      <div class="item-main" data-open-id="${item.id}">
        <span class="item-title">${escapeHtml(item.title)}</span>
        <span class="item-meta">${plainMeta.join("")}${categoryMeta}${tagMeta}</span>
        ${item.notes ? `<p class="item-notes">${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <button class="item-menu" type="button" data-menu-id="${item.id}" aria-label="事项操作">⋮</button>
    </article>
  `;
}

function getVisibleItemsForDate(dateKey) {
  return state.items
    .filter((item) => !item.deletedAt && !item.weeklyOnly && item.date === dateKey && matchesSearch(item))
    .sort(compareItems);
}

function getWeeklyOnlyItems(weekStart) {
  const startKey = toDateKey(weekStart);
  const endKey = toDateKey(addDays(weekStart, 6));
  return state.items
    .filter(
      (item) =>
        !item.deletedAt &&
        item.weeklyOnly &&
        item.date >= startKey &&
        item.date <= endKey &&
        matchesSearch(item)
    )
    .sort(compareItems);
}

function matchesSearch(item) {
  if (!state.search) return true;
  const haystack = [item.title, item.notes, item.category, ...(item.tags || [])].join(" ").toLocaleLowerCase("zh-CN");
  return haystack.includes(state.search);
}

function compareItems(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const aSortTime = a.time || a.deadlineTime || "99:99";
  const bSortTime = b.time || b.deadlineTime || "99:99";
  return aSortTime.localeCompare(bSortTime) || a.createdAt.localeCompare(b.createdAt);
}

function handlePlannerClick(event) {
  if (Date.now() < state.ignorePlannerClickUntil) return;
  const addWeeklyButton = event.target.closest("[data-add-weekly]");
  if (addWeeklyButton) {
    openItemDialog(null, { weeklyOnly: true, date: toDateKey(startOfWeek(state.selectedDate)) });
    return;
  }

  const completeButton = event.target.closest("[data-complete-id]");
  if (completeButton) {
    toggleComplete(completeButton.dataset.completeId);
    return;
  }

  const menuButton = event.target.closest("[data-menu-id]");
  if (menuButton) {
    openActionDialog(menuButton.dataset.menuId);
    return;
  }

  const itemMain = event.target.closest("[data-open-id]");
  if (itemMain) {
    openItemDialog(findItem(itemMain.dataset.openId));
    return;
  }

  const dateButton = event.target.closest("[data-select-date]");
  if (dateButton) {
    state.selectedDate = fromDateKey(dateButton.dataset.selectDate);
    if (state.view === "month") setView("day");
    else render();
  }
}

async function toggleComplete(id) {
  const item = findItem(id);
  if (!item) return;
  const updatedItem = {
    ...item,
    completed: !item.completed,
    updatedAt: new Date().toISOString()
  };
  state.items = state.items.map((candidate) => (candidate.id === id ? updatedItem : candidate));
  updateCompletionInView(updatedItem);

  storePut(ITEM_STORE, updatedItem).catch((error) => {
    console.error("保存完成状态失败", error);
    state.items = state.items.map((candidate) => (candidate.id === id ? item : candidate));
    renderPlanner();
    showSnackbar("完成状态保存失败，请重试", false);
  });

  window.clearTimeout(state.completionTimers.get(id));
  state.completionTimers.set(
    id,
    window.setTimeout(() => {
      state.completionTimers.delete(id);
      renderPlanner();
    }, 260)
  );
}

function updateCompletionInView(item) {
  elements.planner.querySelectorAll(`[data-item-id="${item.id}"]`).forEach((container) => {
    container.classList.toggle("completed", item.completed);
    container.classList.remove("completion-changing");
    void container.offsetWidth;
    container.classList.add("completion-changing");
    const button = container.querySelector("[data-complete-id]");
    if (button) {
      button.textContent = item.completed ? "✓" : "";
      button.setAttribute("aria-label", item.completed ? "标记为未完成" : "标记为完成");
    }
  });
}

function renderColorPresets() {
  renderColorPalette(elements.categoryColorPresets, elements.newCategoryColor.value);
  renderColorPalette(elements.tagColorPresets, elements.newTagColor.value);
  syncPresetSelection();
}

function renderColorPalette(container, selectedColor = "") {
  container.innerHTML = COLOR_PRESETS.map(
    (color, index) => `
      <button
        class="color-preset ${color.toLowerCase() === selectedColor.toLowerCase() ? "selected" : ""}"
        type="button"
        data-preset-color="${color}"
        aria-label="选择颜色 ${index + 1}"
        title="${color}"
      >
        <span style="background:${color}"></span>
      </button>`
  ).join("");
}

function selectPresetColor(event) {
  const button = event.target.closest("[data-preset-color]");
  if (!button) return;
  const colorInput =
    event.currentTarget === elements.categoryColorPresets ? elements.newCategoryColor : elements.newTagColor;
  colorInput.value = button.dataset.presetColor;
  syncPresetSelection();
}

function syncPresetSelection() {
  [
    [elements.categoryColorPresets, elements.newCategoryColor],
    [elements.tagColorPresets, elements.newTagColor]
  ].forEach(([container, input]) => {
    container.querySelectorAll("[data-preset-color]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.presetColor.toLowerCase() === input.value.toLowerCase());
    });
  });
}

function loadOptionLibrary() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(OPTION_LIBRARY_KEY));
  } catch {
    localStorage.removeItem(OPTION_LIBRARY_KEY);
  }

  state.categories = Array.isArray(saved?.categories)
    ? saved.categories.map(normalizeOption).filter(Boolean)
    : DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  state.tags = Array.isArray(saved?.tags) ? saved.tags.map(normalizeOption).filter(Boolean) : [];
  state.optionsUpdatedAt =
    typeof saved?.updatedAt === "string"
      ? saved.updatedAt
      : localStorage.getItem(OPTIONS_UPDATED_AT_KEY) || (saved ? new Date().toISOString() : "1970-01-01T00:00:00.000Z");

  let changed = false;
  if (!saved || Number(saved.version || 0) < OPTION_LIBRARY_VERSION) {
    DEFAULT_CATEGORIES.forEach((category) => {
      const existing = state.categories.find((candidate) => candidate.name === category.name);
      if (existing) existing.color = category.color;
      else {
        state.categories.push({ ...category });
        changed = true;
      }
    });
  }
  if (saved && Number(saved.version || 0) < OPTION_LIBRARY_VERSION) {
    state.optionsUpdatedAt = new Date().toISOString();
    changed = true;
  }
  saveOptionLibrary({ updatedAt: state.optionsUpdatedAt, schedule: false });
  if (changed) queueAutoSync();
}

function normalizeOption(option) {
  if (!option || typeof option.name !== "string" || !option.name.trim()) return null;
  return {
    name: option.name.trim().slice(0, 20),
    color: sanitizeColor(option.color)
  };
}

function mergeOptionsFromSavedData(records) {
  let changed = false;
  records.forEach((record) => {
    if (record.category && !state.categories.some((category) => category.name === record.category)) {
      state.categories.push({ name: record.category, color: "#8d7e68" });
      changed = true;
    }
    (record.tags || []).forEach((tag) => {
      if (tag && !state.tags.some((candidate) => candidate.name === tag)) {
        state.tags.push({ name: tag, color: "#7b8177" });
        changed = true;
      }
    });
  });
  if (changed) saveOptionLibrary();
}

function saveOptionLibrary({ updatedAt = new Date().toISOString(), schedule = true } = {}) {
  state.optionsUpdatedAt = updatedAt;
  localStorage.setItem(OPTIONS_UPDATED_AT_KEY, updatedAt);
  localStorage.setItem(
    OPTION_LIBRARY_KEY,
    JSON.stringify({
      version: OPTION_LIBRARY_VERSION,
      updatedAt,
      categories: state.categories,
      tags: state.tags
    })
  );
  if (schedule) queueAutoSync();
}

function renderCategoryOptions(selectedName = elements.itemCategory.value) {
  elements.itemCategory.innerHTML = [
    '<option value="">未分类</option>',
    ...state.categories.map(
      (category) =>
        `<option value="${escapeHtml(category.name)}" ${
          category.name === selectedName ? "selected" : ""
        }>${escapeHtml(category.name)}</option>`
    )
  ].join("");
}

function renderTagOptions(selectedNames = []) {
  const selected = new Set(selectedNames);
  elements.tagOptions.innerHTML = state.tags.length
    ? state.tags
        .map(
          (tag) => `
            <label class="tag-choice" style="--tag-color:${tag.color}">
              <input type="checkbox" value="${escapeHtml(tag.name)}" ${selected.has(tag.name) ? "checked" : ""} />
              <span>#${escapeHtml(tag.name)}</span>
            </label>`
        )
        .join("")
    : '<span class="tag-empty">还没有标签，可在“管理”中添加。</span>';
}

function addCategory() {
  const name = elements.newCategoryName.value.trim();
  if (!name) {
    elements.newCategoryName.focus();
    return;
  }
  if (state.categories.some((category) => category.name === name)) {
    renderCategoryOptions(name);
    elements.newCategoryName.value = "";
    showSnackbar("这个分类已经存在", false);
    return;
  }

  state.categories.push({ name, color: sanitizeColor(elements.newCategoryColor.value) });
  saveOptionLibrary();
  renderCategoryOptions();
  renderOptionManagement();
  elements.newCategoryName.value = "";
  showSnackbar("分类已添加", false);
}

function addTag() {
  const name = elements.newTagName.value.trim();
  if (!name) {
    elements.newTagName.focus();
    return;
  }

  const existing = state.tags.find((tag) => tag.name === name);
  if (!existing) {
    state.tags.push({ name, color: sanitizeColor(elements.newTagColor.value) });
    saveOptionLibrary();
  }

  renderTagOptions();
  renderOptionManagement();
  elements.newTagName.value = "";
  showSnackbar(existing ? "这个标签已经存在" : "标签已添加", false);
}

function normalizeTimeToFiveMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  if (!match) return "";
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  const rounded = Math.min(Math.round(minutes / 5) * 5, 24 * 60 - 5);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function getNearestFiveMinuteTime(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const rounded = Math.min(Math.round(minutes / 5) * 5, 24 * 60 - 5);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function setTimeInputValue(input, value) {
  const safeValue = typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : "";
  input.value = safeValue;
  const isLegacyTime = Boolean(safeValue && normalizeTimeToFiveMinutes(safeValue) !== safeValue);
  input.step = isLegacyTime ? "any" : "300";
}

function handleTimeChange(input, updatesReminder = false) {
  input.step = "300";
  input.value = normalizeTimeToFiveMinutes(input.value);
  validateTimeRange();
  if (updatesReminder) updateReminderFormState();
  saveDraft();
}

function validateTimeRange() {
  const invalid =
    elements.itemTime.value &&
    elements.itemDeadlineTime.value &&
    elements.itemDeadlineTime.value < elements.itemTime.value;
  elements.itemDeadlineTime.setCustomValidity(invalid ? "截止时间不能早于开始时间" : "");
  return !invalid;
}

function updateReminderFormState() {
  elements.itemReminder.disabled = !elements.itemTime.value;
}

function buildReminderAt(dateKey, time) {
  if (!dateKey || !time) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  const start = fromDateKey(dateKey);
  start.setHours(hour, minute, 0, 0);
  return new Date(start.getTime() - REMINDER_LEAD_MS).toISOString();
}

function getCurrentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatTimeRange(item) {
  if (item.time && item.deadlineTime) return `${item.time}–${item.deadlineTime}`;
  if (item.time) return item.time;
  if (item.deadlineTime) return `截止 ${item.deadlineTime}`;
  return "全天";
}

function updateWeeklyFormState() {
  if (elements.itemWeekly.checked) {
    elements.itemRecurrence.value = "none";
    elements.itemRecurrence.disabled = true;
    return;
  }
  elements.itemRecurrence.disabled = Boolean(findItem(elements.itemId.value)?.seriesId);
}

function getCategoryColor(name) {
  return state.categories.find((category) => category.name === name)?.color || "#9a9c96";
}

function getTagColor(name) {
  return state.tags.find((tag) => tag.name === name)?.color || "#7b8177";
}

function sanitizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#7b8177";
}

function hexToRgba(color, alpha) {
  const safeColor = sanitizeColor(color);
  const red = Number.parseInt(safeColor.slice(1, 3), 16);
  const green = Number.parseInt(safeColor.slice(3, 5), 16);
  const blue = Number.parseInt(safeColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function openItemDialog(item = null, defaults = {}) {
  elements.itemForm.reset();
  setTimeInputValue(elements.itemTime, "");
  setTimeInputValue(elements.itemDeadlineTime, "");
  elements.draftHint.classList.add("hidden");
  elements.itemRecurrence.disabled = false;
  elements.itemWeekly.disabled = false;
  renderCategoryOptions(item?.category || "");
  renderTagOptions(item?.tags || []);

  if (item) {
    elements.itemDialogTitle.textContent = "编辑事项";
    elements.itemId.value = item.id;
    elements.itemTitle.value = item.title;
    elements.itemDate.value = item.date;
    setTimeInputValue(elements.itemTime, item.time);
    setTimeInputValue(elements.itemDeadlineTime, item.deadlineTime);
    elements.itemCategory.value = item.category || "";
    elements.itemNotes.value = item.notes || "";
    elements.itemRecurrence.value = item.recurrence || "none";
    elements.itemRecurrence.disabled = Boolean(item.seriesId);
    elements.itemPinned.checked = Boolean(item.pinned);
    elements.itemWeekly.checked = Boolean(item.weeklyOnly);
    elements.itemReminder.checked = Boolean(item.reminderEnabled);
    elements.itemWeekly.disabled = Boolean(item.seriesId);
    elements.deleteItem.classList.remove("hidden");
  } else {
    const now = new Date();
    elements.itemDialogTitle.textContent = "新建事项";
    elements.itemId.value = "";
    elements.itemDate.value = defaults.date || toDateKey(state.selectedDate);
    if (!defaults.weeklyOnly) setTimeInputValue(elements.itemTime, getNearestFiveMinuteTime(now));
    elements.itemWeekly.checked = Boolean(defaults.weeklyOnly);
    elements.itemReminder.checked = true;
    elements.deleteItem.classList.add("hidden");
    restoreDraft();
    if (defaults.weeklyOnly) {
      elements.itemDate.value = defaults.date;
      elements.itemWeekly.checked = true;
    }
  }

  updateWeeklyFormState();
  updateReminderFormState();
  elements.itemDialog.showModal();
  window.setTimeout(() => elements.itemTitle.focus(), 50);
}

function readItemForm() {
  const time = elements.itemTime.value;
  const deadlineTime = elements.itemDeadlineTime.value;
  const date = elements.itemDate.value;
  const reminderEnabled = Boolean(time && elements.itemReminder.checked);
  return {
    title: elements.itemTitle.value.trim(),
    date,
    time,
    deadlineTime,
    category: elements.itemCategory.value,
    tags: Array.from(elements.tagOptions.querySelectorAll('input[type="checkbox"]:checked'), (input) => input.value),
    notes: elements.itemNotes.value.trim(),
    recurrence: elements.itemRecurrence.value,
    pinned: elements.itemPinned.checked,
    weeklyOnly: elements.itemWeekly.checked,
    reminderEnabled,
    reminderAt: reminderEnabled ? buildReminderAt(date, time) : null,
    timeZone: getCurrentTimeZone()
  };
}

async function saveItemFromForm(event) {
  event.preventDefault();
  if (!validateTimeRange()) {
    elements.itemDeadlineTime.reportValidity();
    return;
  }
  const formValue = readItemForm();
  if (!formValue.title || !formValue.date) return;

  const existing = findItem(elements.itemId.value);
  const now = new Date().toISOString();

  if (existing) {
    await storePut(ITEM_STORE, {
      ...existing,
      ...formValue,
      recurrence: existing.seriesId ? existing.recurrence : formValue.recurrence,
      updatedAt: now
    });
  } else {
    await createItemsFromDefinition(formValue, now);
  }

  localStorage.removeItem(DRAFT_KEY);
  elements.itemDialog.close();
  state.selectedDate = fromDateKey(formValue.date);
  await refreshData();
  showSnackbar(existing ? "事项已更新" : "事项已保存", false);
}

async function createItemsFromDefinition(definition, timestamp = new Date().toISOString()) {
  const seriesId = definition.recurrence !== "none" ? crypto.randomUUID() : null;
  const dates = seriesId
    ? generateRecurrenceDates(definition.date, definition.recurrence)
    : [definition.date];
  const items = dates.map((date) => ({
    id: crypto.randomUUID(),
    title: definition.title,
    date,
    time: definition.time || "",
    deadlineTime: definition.deadlineTime || "",
    category: definition.category || "",
    tags: definition.tags || [],
    notes: definition.notes || "",
    recurrence: definition.recurrence || "none",
    seriesId,
    completed: false,
    pinned: Boolean(definition.pinned),
    weeklyOnly: Boolean(definition.weeklyOnly),
    reminderEnabled: Boolean(definition.time && definition.reminderEnabled),
    reminderAt:
      definition.time && definition.reminderEnabled ? buildReminderAt(date, definition.time) : null,
    timeZone: definition.timeZone || getCurrentTimeZone(),
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    purgedAt: null
  }));
  await storePutMany(ITEM_STORE, items);
  return items;
}

function generateRecurrenceDates(startDateKey, recurrence) {
  const startDate = fromDateKey(startDateKey);
  const dates = [];
  const limits = { daily: 365, weekly: 104, biweekly: 52, monthly: 24 };
  const count = limits[recurrence] || 1;

  for (let index = 0; index < count; index += 1) {
    const date = new Date(startDate);
    if (recurrence === "daily") date.setDate(startDate.getDate() + index);
    if (recurrence === "weekly") date.setDate(startDate.getDate() + index * 7);
    if (recurrence === "biweekly") date.setDate(startDate.getDate() + index * 14);
    if (recurrence === "monthly") {
      date.setDate(1);
      date.setMonth(startDate.getMonth() + index);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(startDate.getDate(), lastDay));
    }
    dates.push(toDateKey(date));
  }
  return dates;
}

function saveDraft() {
  if (elements.itemId.value) return;
  const draft = readItemForm();
  if (!draft.title && !draft.notes && !draft.category && !draft.tags.length) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function restoreDraft() {
  const rawDraft = localStorage.getItem(DRAFT_KEY);
  if (!rawDraft) return;

  try {
    const draft = JSON.parse(rawDraft);
    elements.itemTitle.value = draft.title || "";
    elements.itemDate.value = draft.date || toDateKey(state.selectedDate);
    setTimeInputValue(elements.itemTime, draft.time);
    setTimeInputValue(elements.itemDeadlineTime, draft.deadlineTime);
    renderCategoryOptions(draft.category || "");
    renderTagOptions(draft.tags || []);
    elements.itemCategory.value = draft.category || "";
    elements.itemNotes.value = draft.notes || "";
    elements.itemRecurrence.value = draft.recurrence || "none";
    elements.itemPinned.checked = Boolean(draft.pinned);
    elements.itemWeekly.checked = Boolean(draft.weeklyOnly);
    elements.itemReminder.checked =
      typeof draft.reminderEnabled === "boolean" ? draft.reminderEnabled : Boolean(draft.time);
    updateWeeklyFormState();
    updateReminderFormState();
    elements.draftHint.classList.remove("hidden");
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function openActionDialog(id) {
  const item = findItem(id);
  if (!item) return;
  state.actionItemId = id;
  elements.actionItemTitle.textContent = item.title;
  elements.actionDialog.showModal();
}

function editActionItem() {
  const item = findItem(state.actionItemId);
  elements.actionDialog.close();
  if (item) openItemDialog(item);
}

function openCopyDialog() {
  const item = findItem(state.actionItemId);
  if (!item) return;
  state.copyItemId = item.id;
  elements.copyDate.value = toDateKey(addDays(fromDateKey(item.date), 1));
  elements.actionDialog.close();
  elements.copyDialog.showModal();
}

async function copyItemToDate(event) {
  event.preventDefault();
  const item = findItem(state.copyItemId);
  if (!item || !elements.copyDate.value) return;
  const now = new Date().toISOString();
  const date = elements.copyDate.value;
  await storePut(ITEM_STORE, {
    ...item,
    id: crypto.randomUUID(),
    date,
    recurrence: "none",
    seriesId: null,
    completed: false,
    reminderAt: item.reminderEnabled && item.time ? buildReminderAt(date, item.time) : null,
    timeZone: getCurrentTimeZone(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
  state.selectedDate = fromDateKey(date);
  elements.copyDialog.close();
  await refreshData();
  showSnackbar("已复制到所选日期", false);
}

async function saveActionItemAsTemplate() {
  const item = findItem(state.actionItemId);
  if (!item) return;
  await saveTemplate(item);
  elements.actionDialog.close();
  showSnackbar("已保存为常用模板", false);
}

async function saveTemplateFromForm() {
  const definition = readItemForm();
  if (!definition.title) {
    elements.itemTitle.focus();
    return;
  }
  if (!validateTimeRange()) {
    elements.itemDeadlineTime.reportValidity();
    return;
  }
  await saveTemplate(definition);
  showSnackbar("已保存为常用模板", false);
}

async function saveTemplate(source) {
  const now = new Date().toISOString();
  await storePut(TEMPLATE_STORE, {
    id: crypto.randomUUID(),
    title: source.title,
    time: source.time || "",
    deadlineTime: source.deadlineTime || "",
    category: source.category || "",
    tags: source.tags || [],
    notes: source.notes || "",
    recurrence: "none",
    pinned: Boolean(source.pinned),
    weeklyOnly: Boolean(source.weeklyOnly),
    reminderEnabled: Boolean(source.time && source.reminderEnabled),
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
  state.templates = (await storeGetAll(TEMPLATE_STORE))
    .map(normalizeTemplateRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function requestDelete(id) {
  const item = findItem(id);
  if (!item) return;
  state.deleteItemId = item.id;
  closeOpenItemDialogs();

  if (item.seriesId) {
    elements.recurrenceDeleteDialog.showModal();
  } else {
    deleteWithScope("single");
  }
}

async function deleteWithScope(scope) {
  const item = findItem(state.deleteItemId);
  if (!item) return;
  const deletedAt = new Date().toISOString();
  let affected = [item];

  if (item.seriesId && scope === "future") {
    affected = state.items.filter(
      (candidate) => candidate.seriesId === item.seriesId && candidate.date >= item.date && !candidate.deletedAt
    );
  }
  if (item.seriesId && scope === "series") {
    affected = state.items.filter((candidate) => candidate.seriesId === item.seriesId && !candidate.deletedAt);
  }

  await storePutMany(
    ITEM_STORE,
    affected.map((candidate) => ({ ...candidate, deletedAt, purgedAt: null, updatedAt: deletedAt }))
  );
  state.undoIds = affected.map((candidate) => candidate.id);
  closeOpenItemDialogs();
  await refreshData();
  showSnackbar(affected.length > 1 ? `已删除 ${affected.length} 个循环事项` : "事项已移入回收站", true);
}

async function undoLastDelete() {
  const affected = state.items.filter((item) => state.undoIds.includes(item.id));
  if (!affected.length) return;
  const now = new Date().toISOString();
  await storePutMany(
    ITEM_STORE,
    affected.map((item) => ({ ...item, deletedAt: null, purgedAt: null, updatedAt: now }))
  );
  state.undoIds = [];
  hideSnackbar();
  await refreshData();
}

function openTemplatesDialog() {
  renderTemplates();
  elements.templatesDialog.showModal();
}

function renderTemplates() {
  const visibleTemplates = state.templates.filter((template) => !template.deletedAt);
  if (!visibleTemplates.length) {
    elements.templatesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">＋</div>
        <h3>还没有常用模板</h3>
        <p>在事项操作中选择“保存为常用模板”。</p>
      </div>`;
    return;
  }

  elements.templatesList.innerHTML = visibleTemplates
    .map(
      (template) => `
        <div class="template-row">
          <div>
            <strong>${escapeHtml(template.title)}</strong>
            <small>${escapeHtml([formatTimeRange(template), template.category].filter(Boolean).join(" · "))}</small>
          </div>
          <div class="template-actions">
            <button class="mini-button" type="button" data-use-template="${template.id}">使用</button>
            <button class="mini-button danger" type="button" data-delete-template="${template.id}">删除</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function handleTemplateClick(event) {
  const useButton = event.target.closest("[data-use-template]");
  if (useButton) {
    const template = state.templates.find(
      (candidate) => candidate.id === useButton.dataset.useTemplate && !candidate.deletedAt
    );
    if (!template) return;
    state.templateId = template.id;
    elements.templateDateTitle.textContent = template.title;
    elements.templateTargetDate.value = toDateKey(state.selectedDate);
    elements.templatesDialog.close();
    elements.templateDateDialog.showModal();
    return;
  }

  const deleteButton = event.target.closest("[data-delete-template]");
  if (deleteButton) {
    const template = state.templates.find((candidate) => candidate.id === deleteButton.dataset.deleteTemplate);
    if (!template) return;
    const now = new Date().toISOString();
    await storePut(TEMPLATE_STORE, { ...template, deletedAt: now, updatedAt: now });
    await refreshData();
    renderTemplates();
  }
}

async function createItemFromTemplate(event) {
  event.preventDefault();
  const template = state.templates.find((candidate) => candidate.id === state.templateId && !candidate.deletedAt);
  if (!template || !elements.templateTargetDate.value) return;
  await createItemsFromDefinition({
    ...template,
    date: elements.templateTargetDate.value
  });
  state.selectedDate = fromDateKey(elements.templateTargetDate.value);
  elements.templateDateDialog.close();
  await refreshData();
  showSnackbar("已从模板添加事项", false);
}

function openTrashDialog() {
  renderTrash();
  elements.trashDialog.showModal();
}

function renderTrash() {
  const deletedItems = state.items
    .filter((item) => item.deletedAt && !item.purgedAt)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  if (!deletedItems.length) {
    elements.trashList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        <h3>回收站是空的</h3>
        <p>最近删除的事项会显示在这里。</p>
      </div>`;
    return;
  }

  elements.trashList.innerHTML = deletedItems
    .map(
      (item) => `
        <div class="template-row">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.date)} · ${daysUntilRemoval(item.deletedAt)} 天后清理</small>
          </div>
          <div class="template-actions">
            <button class="mini-button" type="button" data-restore-item="${item.id}">恢复</button>
            <button class="mini-button danger" type="button" data-purge-item="${item.id}">彻底删除</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function handleTrashClick(event) {
  const restoreButton = event.target.closest("[data-restore-item]");
  if (restoreButton) {
    const item = findItem(restoreButton.dataset.restoreItem);
    if (!item) return;
    await storePut(ITEM_STORE, {
      ...item,
      deletedAt: null,
      purgedAt: null,
      updatedAt: new Date().toISOString()
    });
    await refreshData();
    renderTrash();
    return;
  }

  const purgeButton = event.target.closest("[data-purge-item]");
  if (purgeButton) {
    const item = findItem(purgeButton.dataset.purgeItem);
    if (!item) return;
    const now = new Date().toISOString();
    await storePut(ITEM_STORE, { ...item, purgedAt: now, updatedAt: now });
    await refreshData();
    renderTrash();
  }
}

function openDataDialog() {
  renderOptionManagement();
  renderBackupStatus();
  renderSyncStatus();
  elements.dataDialog.showModal();
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  } catch (error) {
    console.warn("无法申请持久化存储，仍可通过导出备份保护数据", error);
  }
}

function checkBackupReminder() {
  const hasData =
    state.items.some((item) => !item.deletedAt) || state.templates.some((template) => !template.deletedAt);
  if (!hasData || elements.backupReminderDialog.open) return;

  const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0;
  const lastReminder = Number(localStorage.getItem(LAST_BACKUP_REMINDER_KEY)) || 0;
  const lastBackupActivity = Math.max(lastBackup, lastReminder);
  if (lastBackupActivity && Date.now() - lastBackupActivity < BACKUP_REMINDER_INTERVAL_MS) return;

  localStorage.setItem(LAST_BACKUP_REMINDER_KEY, String(Date.now()));
  elements.backupReminderDialog.showModal();
}

function renderBackupStatus() {
  const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0;
  elements.backupStatus.textContent = lastBackup
    ? `上次导出：${new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(lastBackup)}`
    : "还没有导出过备份";
}

function queueAutoSyncForStore(storeName) {
  if (storeName === ITEM_STORE || storeName === TEMPLATE_STORE) queueAutoSync();
}

function queueAutoSync(immediate = false) {
  window.clearTimeout(state.syncTimer);
  if (
    state.syncApplying ||
    state.syncInProgress ||
    !state.syncClient?.isSignedIn()
  ) {
    return;
  }
  if (!navigator.onLine) {
    setSyncMessage("当前离线，数据已保存在本机，联网后会自动同步", "idle");
    return;
  }
  state.syncTimer = window.setTimeout(() => syncNow({ silent: true }), immediate ? 0 : AUTO_SYNC_DELAY_MS);
}

function setSyncMessage(message, type = "idle") {
  state.syncMessage = message;
  state.syncMessageType = type;
  renderSyncStatus();
  renderSyncDialog();
}

function renderSyncStatus() {
  if (!elements.syncStatus) return;
  const session = state.syncClient?.getSession();
  if (!state.syncClient?.isConfigured()) {
    elements.syncStatus.textContent = "尚未配置云同步";
    return;
  }
  if (!session) {
    elements.syncStatus.textContent = "项目已配置，尚未登录";
    return;
  }
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);
  elements.syncStatus.textContent =
    state.syncMessageType === "error"
      ? state.syncMessage
      : lastSync
        ? `已登录 ${session.user.email || "同步账号"} · 上次同步 ${formatShortDateTime(lastSync)}`
        : `已登录 ${session.user.email || "同步账号"} · 等待首次同步`;
}

function openSyncDialog() {
  const config = state.syncClient.getConfig();
  elements.syncProjectUrl.value = config?.url || "";
  elements.syncPublishableKey.value = config?.publishableKey || "";
  elements.syncVapidPublicKey.value = config?.vapidPublicKey || "";
  elements.syncPassword.value = "";
  renderSyncDialog();
  refreshNotificationStatus();
  elements.dataDialog.close();
  elements.syncDialog.showModal();
}

function renderSyncDialog() {
  if (!elements.syncDialogStatus) return;
  const configured = state.syncClient?.isConfigured();
  const session = state.syncClient?.getSession();
  elements.syncAccountSection.classList.toggle("hidden", !configured || Boolean(session));
  elements.syncSessionSection.classList.toggle("hidden", !session);
  elements.syncAccountEmail.textContent = session
    ? `当前登录：${session.user.email || "同步账号"} · 账号标识 ${session.user.id.slice(-8)}`
    : "";
  elements.syncDialogStatus.textContent = state.syncMessage;
  elements.syncDialogStatus.className = `sync-dialog-status ${state.syncMessageType}`;
  elements.syncNow.disabled = state.syncInProgress;
}

function saveSyncConfig() {
  try {
    state.syncClient.saveConfig(
      elements.syncProjectUrl.value,
      elements.syncPublishableKey.value,
      elements.syncVapidPublicKey.value
    );
    elements.syncPassword.value = "";
    setSyncMessage("项目配置已保存在这台设备，请登录同步账号", "success");
  } catch (error) {
    setSyncMessage(error.message, "error");
  }
}

async function clearSyncConfig() {
  window.clearTimeout(state.syncTimer);
  if (state.syncClient.isSignedIn()) {
    try {
      await disablePushNotifications();
    } catch (error) {
      setSyncMessage(`清除配置前无法关闭推送：${error.message}`, "error");
      return;
    }
  }
  state.syncClient.clearConfig();
  elements.syncProjectUrl.value = "";
  elements.syncPublishableKey.value = "";
  elements.syncVapidPublicKey.value = "";
  elements.syncEmail.value = "";
  elements.syncPassword.value = "";
  setSyncMessage("已清除这台设备上的 Supabase 配置和登录会话", "success");
}

function readSyncCredentials() {
  const email = elements.syncEmail.value.trim();
  const password = elements.syncPassword.value;
  if (!email || !elements.syncEmail.checkValidity()) {
    elements.syncEmail.reportValidity();
    throw new window.XiaojiSyncError("请输入有效邮箱");
  }
  if (password.length < 6) {
    elements.syncPassword.reportValidity();
    throw new window.XiaojiSyncError("密码至少需要 6 位");
  }
  return { email, password };
}

async function signInToSync() {
  setSyncBusy(true);
  try {
    const { email, password } = readSyncCredentials();
    await state.syncClient.signIn(email, password);
    elements.syncPassword.value = "";
    setSyncMessage("登录成功，正在合并本机与云端数据", "success");
    await syncNow();
    await refreshNotificationStatus();
  } catch (error) {
    setSyncMessage(`登录失败：${error.message}`, "error");
  } finally {
    setSyncBusy(false);
  }
}

async function signOutOfSync() {
  setSyncBusy(true);
  try {
    await disablePushNotifications();
    await state.syncClient.signOut();
    setSyncMessage("已退出同步账号，本机数据仍然保留", "success");
  } catch (error) {
    setSyncMessage(error.message, "error");
  } finally {
    setSyncBusy(false);
  }
}

function setSyncBusy(busy) {
  [
    elements.saveSyncConfig,
    elements.clearSyncConfig,
    elements.syncLogin,
    elements.syncNow,
    elements.syncLogout
  ].forEach((button) => {
    button.disabled = busy;
  });
}

async function refreshNotificationStatus() {
  if (!elements.notificationStatus) return;
  if (!("Notification" in window) || !("PushManager" in window)) {
    elements.notificationStatus.textContent = "当前浏览器不支持 Web Push 通知";
    elements.toggleNotifications.disabled = true;
    return;
  }
  if (Notification.permission === "denied") {
    elements.notificationStatus.textContent = "通知权限已被拒绝，请在浏览器设置中允许";
    elements.toggleNotifications.textContent = "通知已被阻止";
    elements.toggleNotifications.disabled = true;
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  elements.notificationStatus.textContent = subscription
    ? "已开启：有开始时间且启用提醒的事项会提前 5 分钟通知"
    : "尚未开启；首次开启时手机会询问通知权限";
  elements.toggleNotifications.textContent = subscription ? "关闭手机通知" : "开启手机通知";
  elements.toggleNotifications.disabled = false;
}

async function togglePushNotifications() {
  if (!state.syncClient.isSignedIn()) {
    setSyncMessage("请先登录同步账号，再开启手机通知", "error");
    return;
  }
  setSyncBusy(true);
  elements.toggleNotifications.disabled = true;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await disablePushNotifications(existing);
      setSyncMessage("已关闭这台设备的手机通知", "success");
      return;
    }

    const vapidPublicKey = state.syncClient.getConfig()?.vapidPublicKey;
    if (!vapidPublicKey) {
      throw new window.XiaojiSyncError("请先填写 Web Push VAPID 公钥并保存配置");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new window.XiaojiSyncError("未获得通知权限，请在浏览器设置中允许通知");
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    try {
      await state.syncClient.savePushSubscription(subscription, getCurrentTimeZone());
    } catch (error) {
      await subscription.unsubscribe();
      throw error;
    }
    setSyncMessage("已开启手机通知", "success");
  } catch (error) {
    const message = /push service error/i.test(error.message)
      ? "手机浏览器连接推送服务失败。请切换网络后重试；Android Chrome 还需要可用的 Google Play 服务，也可以尝试使用 Firefox 安装冰小记。"
      : error.message;
    setSyncMessage(`通知设置失败：${message}`, "error");
  } finally {
    setSyncBusy(false);
    await refreshNotificationStatus();
  }
}

async function disablePushNotifications(subscription = null) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await navigator.serviceWorker.ready;
  const current = subscription || (await registration.pushManager.getSubscription());
  if (!current) return;
  await state.syncClient.deletePushSubscription(current.endpoint);
  const unsubscribed = await current.unsubscribe();
  if (!unsubscribed) throw new window.XiaojiSyncError("浏览器未能取消推送订阅");
  await refreshNotificationStatus();
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function syncNow({ silent = false } = {}) {
  if (state.syncInProgress) return;
  if (!state.syncClient.isSignedIn()) {
    if (!silent) setSyncMessage("请先登录同步账号", "error");
    return;
  }
  if (!navigator.onLine) {
    setSyncMessage("当前离线，数据已保存在本机，联网后会自动同步", "idle");
    return;
  }

  state.syncInProgress = true;
  setSyncBusy(true);
  if (!silent) setSyncMessage("正在同步本机与云端数据…", "idle");

  try {
    const session = state.syncClient.getSession();
    const remoteRecords = await state.syncClient.getRecords();
    const localRecords = buildLocalSyncRecords(session.user.id);
    const remoteMap = new Map(remoteRecords.map((record) => [syncRecordKey(record), record]));
    const localMap = new Map(localRecords.map((record) => [syncRecordKey(record), record]));
    const recordsToPush = [];
    const recordsToApply = [];

    localRecords.forEach((localRecord) => {
      const remoteRecord = remoteMap.get(syncRecordKey(localRecord));
      if (!remoteRecord || compareSyncTimestamps(localRecord.updated_at, remoteRecord.updated_at) > 0) {
        recordsToPush.push(localRecord);
      } else if (compareSyncTimestamps(remoteRecord.updated_at, localRecord.updated_at) > 0) {
        recordsToApply.push(remoteRecord);
      }
    });
    remoteRecords.forEach((remoteRecord) => {
      if (!localMap.has(syncRecordKey(remoteRecord))) recordsToApply.push(remoteRecord);
    });

    await applyRemoteSyncRecords(recordsToApply);
    await state.syncClient.upsertRecords(recordsToPush);
    const verifiedRemoteRecords = await state.syncClient.getRecords();
    const verifiedRemoteMap = new Map(
      verifiedRemoteRecords.map((record) => [syncRecordKey(record), record])
    );
    const unconfirmedRecords = recordsToPush.filter((record) => {
      const verifiedRecord = verifiedRemoteMap.get(syncRecordKey(record));
      return (
        !verifiedRecord ||
        compareSyncTimestamps(verifiedRecord.updated_at, record.updated_at) < 0
      );
    });
    if (unconfirmedRecords.length) {
      throw new Error(`云端未确认 ${unconfirmedRecords.length} 条上传记录`);
    }
    const syncedAt = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, syncedAt);
    setSyncMessage(
      `同步完成：上传 ${recordsToPush.length} 条，下载 ${recordsToApply.length} 条，云端共 ${verifiedRemoteRecords.length} 条`,
      "success"
    );
  } catch (error) {
    console.error("Supabase 同步失败", error);
    setSyncMessage(`同步失败：${error.message}。本机数据已保留，可稍后重试`, "error");
  } finally {
    state.syncInProgress = false;
    setSyncBusy(false);
  }
}

function buildLocalSyncRecords(userId) {
  const itemRecords = state.items.map((item) => toCloudRecord(userId, "item", item));
  const templateRecords = state.templates.map((template) => toCloudRecord(userId, "template", template));
  return [
    ...itemRecords,
    ...templateRecords,
    {
      user_id: userId,
      record_type: "options",
      record_id: "library",
      payload: {
        categories: state.categories,
        tags: state.tags
      },
      updated_at: state.optionsUpdatedAt,
      deleted_at: null
    }
  ];
}

function toCloudRecord(userId, recordType, record) {
  return {
    user_id: userId,
    record_type: recordType,
    record_id: record.id,
    payload: record,
    updated_at: record.updatedAt || record.createdAt || new Date(0).toISOString(),
    deleted_at: record.deletedAt || null
  };
}

async function applyRemoteSyncRecords(records) {
  if (!records.length) return;
  const items = [];
  const templates = [];
  let remoteOptions = null;

  records.forEach((record) => {
    if (!record || typeof record.record_id !== "string" || !isValidTimestamp(record.updated_at)) {
      console.warn("已跳过无效的云端同步记录", record);
      return;
    }
    if (record.record_type === "item" && record.payload && typeof record.payload === "object") {
      items.push(
        normalizeItemRecord({
          ...record.payload,
          id: record.record_id,
          updatedAt: record.updated_at,
          deletedAt: record.deleted_at || null
        })
      );
    }
    if (record.record_type === "template" && record.payload && typeof record.payload === "object") {
      templates.push(
        normalizeTemplateRecord({
          ...record.payload,
          id: record.record_id,
          updatedAt: record.updated_at,
          deletedAt: record.deleted_at || null
        })
      );
    }
    if (record.record_type === "options" && record.record_id === "library") {
      remoteOptions = record;
    }
  });

  state.syncApplying = true;
  try {
    await Promise.all([
      storePutMany(ITEM_STORE, items),
      storePutMany(TEMPLATE_STORE, templates)
    ]);
    if (remoteOptions?.payload && typeof remoteOptions.payload === "object") {
      state.categories = Array.isArray(remoteOptions.payload.categories)
        ? remoteOptions.payload.categories.map(normalizeOption).filter(Boolean)
        : [];
      state.tags = Array.isArray(remoteOptions.payload.tags)
        ? remoteOptions.payload.tags.map(normalizeOption).filter(Boolean)
        : [];
      saveOptionLibrary({ updatedAt: remoteOptions.updated_at, schedule: false });
    }
    await refreshData();
  } finally {
    state.syncApplying = false;
  }
}

function syncRecordKey(record) {
  return `${record.record_type}:${record.record_id}`;
}

function compareSyncTimestamps(left, right) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function formatShortDateTime(value) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}

function renderOptionManagement() {
  elements.categoryManagementList.innerHTML = state.categories.length
    ? state.categories.map((category) => renderManagedOption("category", category)).join("")
    : '<span class="management-empty">暂无分类</span>';
  elements.tagManagementList.innerHTML = state.tags.length
    ? state.tags.map((tag) => renderManagedOption("tag", tag)).join("")
    : '<span class="management-empty">暂无标签</span>';
}

function renderManagedOption(type, option) {
  const encodedName = encodeURIComponent(option.name);
  return `
    <div class="managed-option">
      <button
        class="managed-color-button"
        type="button"
        style="--managed-color:${option.color}"
        data-edit-option-color="${type}"
        data-option-name="${encodedName}"
        aria-label="修改${escapeHtml(option.name)}的颜色"
      ><span></span></button>
      <strong>${escapeHtml(option.name)}</strong>
      <button
        class="mini-button danger"
        type="button"
        data-delete-option="${type}"
        data-option-name="${encodedName}"
        aria-label="删除${escapeHtml(option.name)}"
      >删除</button>
    </div>`;
}

function openManagedOptionColorDialog(event) {
  const button = event.target.closest("[data-edit-option-color]");
  if (!button) return;
  const type = button.dataset.editOptionColor;
  const name = decodeURIComponent(button.dataset.optionName);
  const options = type === "category" ? state.categories : state.tags;
  const option = options.find((candidate) => candidate.name === name);
  if (!option) {
    showSnackbar("没有找到要修改的分类或标签", false);
    renderOptionManagement();
    return;
  }

  state.optionColorEditType = type;
  state.optionColorEditName = name;
  elements.optionColorDialogTitle.textContent = `修改“${name}”的颜色`;
  renderColorPalette(elements.optionColorPalette, option.color);
  elements.optionColorDialog.showModal();
}

function selectManagedOptionColor(event) {
  const button = event.target.closest("[data-preset-color]");
  if (!button || !state.optionColorEditType || !state.optionColorEditName) return;
  const type = state.optionColorEditType;
  const options = type === "category" ? state.categories : state.tags;
  const option = options.find((candidate) => candidate.name === state.optionColorEditName);
  if (!option) {
    elements.optionColorDialog.close();
    showSnackbar("没有找到要修改的分类或标签", false);
    return;
  }

  const color = sanitizeColor(button.dataset.presetColor);
  if (option.color === color) {
    elements.optionColorDialog.close();
    return;
  }
  option.color = color;
  saveOptionLibrary();
  renderCategoryOptions();
  renderTagOptions();
  renderPlanner();
  renderOptionManagement();
  elements.optionColorDialog.close();
  showSnackbar(`${type === "category" ? "分类" : "标签"}颜色已更新`, false);
}

async function handleOptionDelete(event) {
  const button = event.target.closest("[data-delete-option]");
  if (!button || state.optionDeletePending) return;
  state.optionDeletePending = true;
  button.disabled = true;
  const type = button.dataset.deleteOption;
  const name = decodeURIComponent(button.dataset.optionName);
  const now = new Date().toISOString();

  if (type === "category") {
    state.categories = state.categories.filter((category) => category.name !== name);
    const changedItems = state.items
      .filter((item) => item.category === name)
      .map((item) => ({ ...item, category: "", updatedAt: now }));
    const changedTemplates = state.templates
      .filter((template) => template.category === name)
      .map((template) => ({ ...template, category: "", updatedAt: now }));
    await Promise.all([
      storePutMany(ITEM_STORE, changedItems),
      storePutMany(TEMPLATE_STORE, changedTemplates)
    ]);
  } else {
    state.tags = state.tags.filter((tag) => tag.name !== name);
    const changedItems = state.items
      .filter((item) => (item.tags || []).includes(name))
      .map((item) => ({
        ...item,
        tags: item.tags.filter((tag) => tag !== name),
        updatedAt: now
      }));
    const changedTemplates = state.templates
      .filter((template) => (template.tags || []).includes(name))
      .map((template) => ({
        ...template,
        tags: template.tags.filter((tag) => tag !== name),
        updatedAt: now
      }));
    await Promise.all([
      storePutMany(ITEM_STORE, changedItems),
      storePutMany(TEMPLATE_STORE, changedTemplates)
    ]);
  }

  saveOptionLibrary();
  await refreshData();
  renderOptionManagement();
  state.optionDeletePending = false;
  showSnackbar(type === "category" ? "分类已删除，相关事项已变为未分类" : "标签已删除并从事项中移除", false);
}

function exportAllData() {
  const exportedAt = new Date();
  const backup = {
    app: "xiaoji",
    backupVersion: 1,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    items: state.items,
    templates: state.templates,
    categories: state.categories,
    tags: state.tags
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `冰小记备份-${toDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_BACKUP_KEY, String(exportedAt.getTime()));
  localStorage.setItem(LAST_BACKUP_REMINDER_KEY, String(exportedAt.getTime()));
  renderBackupStatus();
  showSnackbar("备份已导出，请妥善保存文件", false);
}

async function importBackup(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (error) {
    console.error("备份文件解析失败", error);
    showSnackbar("导入失败：文件不是有效的 JSON 备份", false);
    return;
  }

  if (Number(backup?.dataSchemaVersion || 1) > DATA_SCHEMA_VERSION) {
    showSnackbar("导入失败：备份来自更新版本，请先升级冰小记", false);
    return;
  }

  if (!isValidBackup(backup)) {
    showSnackbar("导入失败：这不是“冰小记”生成的备份文件", false);
    return;
  }
  backup = migrateBackup(backup);

  const currentItemIds = new Set(state.items.map((item) => item.id));
  const currentTemplateIds = new Set(state.templates.map((template) => template.id));
  const newItems = backup.items.filter((item) => !currentItemIds.has(item.id));
  const newTemplates = backup.templates.filter((template) => !currentTemplateIds.has(template.id));

  await Promise.all([
    storePutMany(ITEM_STORE, newItems),
    storePutMany(TEMPLATE_STORE, newTemplates)
  ]);

  backup.categories.map(normalizeOption).filter(Boolean).forEach((category) => {
    if (!state.categories.some((current) => current.name === category.name)) state.categories.push(category);
  });
  backup.tags.map(normalizeOption).filter(Boolean).forEach((tag) => {
    if (!state.tags.some((current) => current.name === tag.name)) state.tags.push(tag);
  });
  saveOptionLibrary();
  await refreshData();
  renderOptionManagement();
  showSnackbar(`导入完成：新增 ${newItems.length} 个事项、${newTemplates.length} 个模板`, false);
}

function isValidBackup(backup) {
  if (
    !backup ||
    backup.app !== "xiaoji" ||
    backup.backupVersion !== 1 ||
    !Array.isArray(backup.items) ||
    !Array.isArray(backup.templates) ||
    !Array.isArray(backup.categories) ||
    !Array.isArray(backup.tags)
  ) {
    return false;
  }

  return (
    backup.items.every((item) => item && typeof item.id === "string" && typeof item.title === "string") &&
    backup.templates.every(
      (template) => template && typeof template.id === "string" && typeof template.title === "string"
    )
  );
}

function migrateBackup(backup) {
  return {
    ...backup,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    items: backup.items.map(normalizeItemRecord),
    templates: backup.templates.map(normalizeTemplateRecord)
  };
}

function showSnackbar(message, canUndo) {
  window.clearTimeout(state.undoTimer);
  elements.snackbarMessage.textContent = message;
  elements.snackbarAction.classList.toggle("hidden", !canUndo);
  elements.snackbar.classList.remove("hidden");
  state.undoTimer = window.setTimeout(hideSnackbar, canUndo ? 7000 : 3000);
}

function hideSnackbar() {
  elements.snackbar.classList.add("hidden");
}

function closeOpenItemDialogs() {
  [elements.itemDialog, elements.actionDialog, elements.recurrenceDeleteDialog].forEach((dialog) => {
    if (dialog.open) dialog.close();
  });
}

async function installApp() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  elements.installButton.classList.add("hidden");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("离线功能注册失败", error);
    });
  }
}

function findItem(id) {
  return state.items.find((item) => item.id === id);
}

function recurrenceLabel(recurrence) {
  return { daily: "每天", weekly: "每周", biweekly: "每两周", monthly: "每月" }[recurrence] || "";
}

function daysUntilRemoval(deletedAt) {
  const remaining = TRASH_RETENTION_MS - (Date.now() - new Date(deletedAt).getTime());
  return Math.max(1, Math.ceil(remaining / DAY_MS));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function isToday(date) {
  return toDateKey(date) === toDateKey(new Date());
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
