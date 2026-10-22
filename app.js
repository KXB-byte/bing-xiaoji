const DB_NAME = "xiaoji-db";
const DB_VERSION = 2;
const ITEM_STORE = "items";
const TEMPLATE_STORE = "templates";
const META_STORE = "metadata";
const DRAFT_KEY = "xiaoji-item-draft";
const VIEW_KEY = "xiaoji-view";
const OPTION_LIBRARY_KEY = "xiaoji-option-library";
const DAY_MS = 24 * 60 * 60 * 1000;
const TRASH_RETENTION_MS = 30 * DAY_MS;
const OPTION_LIBRARY_VERSION = 2;
const DATA_SCHEMA_VERSION = 2;
const COLOR_PRESETS = [
  "#f5bd4f",
  "#f28c52",
  "#ef6f6c",
  "#ed82a4",
  "#a985d6",
  "#62a9df",
  "#57c2d1",
  "#8fc86f"
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
  completionTimers: new Map(),
  undoIds: [],
  undoTimer: null,
  installPrompt: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  mapElements();
  loadOptionLibrary();
  renderColorPresets();
  bindEvents();
  await openDatabase();
  await ensureDataSchemaMetadata();
  await purgeExpiredTrash();
  await refreshData();
  setView(state.view);
  registerServiceWorker();
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
    "data-dialog",
    "category-management-list",
    "tag-management-list",
    "export-data",
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
    render();
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

  elements.addItem.addEventListener("click", () => openItemDialog());
  elements.itemForm.addEventListener("submit", saveItemFromForm);
  elements.itemForm.addEventListener("input", saveDraft);
  elements.itemTime.addEventListener("change", normalizeTimeInput);
  elements.categoryColorPresets.addEventListener("click", selectPresetColor);
  elements.tagColorPresets.addEventListener("click", selectPresetColor);
  elements.newCategoryColor.addEventListener("input", syncPresetSelection);
  elements.newTagColor.addEventListener("input", syncPresetSelection);
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
  elements.openData.addEventListener("click", openDataDialog);
  elements.categoryManagementList.addEventListener("click", handleOptionDelete);
  elements.tagManagementList.addEventListener("click", handleOptionDelete);
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
    transaction.oncomplete = () => resolve(value);
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
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function storeDelete(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function refreshData() {
  const [items, templates] = await Promise.all([storeGetAll(ITEM_STORE), storeGetAll(TEMPLATE_STORE)]);
  state.items = items.map(normalizeItemRecord);
  state.templates = templates.map(normalizeTemplateRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  mergeOptionsFromSavedData([...state.items, ...state.templates]);
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
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    weeklyOnly: Boolean(item.weeklyOnly),
    dataSchemaVersion: DATA_SCHEMA_VERSION
  };
}

function normalizeTemplateRecord(template) {
  return {
    ...template,
    tags: Array.isArray(template.tags) ? template.tags : [],
    weeklyOnly: Boolean(template.weeklyOnly),
    dataSchemaVersion: DATA_SCHEMA_VERSION
  };
}

async function purgeExpiredTrash() {
  const threshold = Date.now() - TRASH_RETENTION_MS;
  const items = await storeGetAll(ITEM_STORE);
  const expired = items.filter((item) => item.deletedAt && new Date(item.deletedAt).getTime() < threshold);
  await Promise.all(expired.map((item) => storeDelete(ITEM_STORE, item.id)));
}

function setView(view) {
  const allowedViews = ["day", "week", "month"];
  state.view = allowedViews.includes(view) ? view : "day";
  localStorage.setItem(VIEW_KEY, state.view);
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  render();
}

function movePeriod(direction) {
  const date = new Date(state.selectedDate);
  if (state.view === "day") date.setDate(date.getDate() + direction);
  if (state.view === "week") date.setDate(date.getDate() + direction * 7);
  if (state.view === "month") date.setMonth(date.getMonth() + direction);
  state.selectedDate = startOfDay(date);
  render();
}

function render() {
  renderPeriodTitle();
  renderPlanner();
}

function renderPeriodTitle() {
  if (state.view === "day") {
    elements.periodTitle.textContent = formatDate(state.selectedDate, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    });
    return;
  }

  if (state.view === "week") {
    const start = startOfWeek(state.selectedDate);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    elements.periodTitle.textContent = sameMonth
      ? `${start.getFullYear()}年${start.getMonth() + 1}月 ${start.getDate()}–${end.getDate()}日`
      : `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
    return;
  }

  elements.periodTitle.textContent = formatDate(state.selectedDate, { year: "numeric", month: "long" });
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
          return `
            <button
              class="month-cell ${outside ? "outside" : ""} ${isToday(date) ? "today" : ""} ${
                dateKey === toDateKey(state.selectedDate) ? "selected" : ""
              }"
              type="button"
              data-select-date="${dateKey}"
            >
              <span class="month-number">${date.getDate()}</span>
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
  const plainMeta = [item.time || "全天", item.seriesId ? recurrenceLabel(item.recurrence) : "", item.pinned ? "已置顶" : ""]
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
  return (a.time || "99:99").localeCompare(b.time || "99:99") || a.createdAt.localeCompare(b.createdAt);
}

function handlePlannerClick(event) {
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
  const markup = COLOR_PRESETS.map(
    (color, index) => `
      <button
        class="color-preset"
        type="button"
        data-preset-color="${color}"
        aria-label="选择预设颜色 ${index + 1}"
      >
        <span style="background:${color}"></span>
      </button>`
  ).join("");
  elements.categoryColorPresets.innerHTML = markup;
  elements.tagColorPresets.innerHTML = markup;
  syncPresetSelection();
}

function selectPresetColor(event) {
  const button = event.target.closest("[data-preset-color]");
  if (!button) return;
  const colorInput =
    event.currentTarget === elements.categoryColorPresets ? elements.newCategoryColor : elements.newTagColor;
  colorInput.value = button.dataset.presetColor;
  syncPresetSelection();
  saveDraft();
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

  if (!saved || Number(saved.version || 0) < OPTION_LIBRARY_VERSION) {
    DEFAULT_CATEGORIES.forEach((category) => {
      const existing = state.categories.find((candidate) => candidate.name === category.name);
      if (existing) existing.color = category.color;
      else state.categories.push({ ...category });
    });
  }
  saveOptionLibrary();
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

function saveOptionLibrary() {
  localStorage.setItem(
    OPTION_LIBRARY_KEY,
    JSON.stringify({
      version: OPTION_LIBRARY_VERSION,
      categories: state.categories,
      tags: state.tags
    })
  );
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
    : '<span class="tag-empty">还没有标签，可以在下方添加。</span>';
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
  renderCategoryOptions(name);
  elements.newCategoryName.value = "";
  saveDraft();
  showSnackbar("分类已添加", false);
}

function addTag() {
  const name = elements.newTagName.value.trim();
  if (!name) {
    elements.newTagName.focus();
    return;
  }

  const selectedNames = Array.from(
    elements.tagOptions.querySelectorAll('input[type="checkbox"]:checked'),
    (input) => input.value
  );
  const existing = state.tags.find((tag) => tag.name === name);
  if (!existing) {
    state.tags.push({ name, color: sanitizeColor(elements.newTagColor.value) });
    saveOptionLibrary();
  }

  renderTagOptions([...new Set([...selectedNames, name])]);
  elements.newTagName.value = "";
  saveDraft();
  showSnackbar(existing ? "已选择这个标签" : "标签已添加并选中", false);
}

function normalizeTimeInput() {
  if (!elements.itemTime.value) return;
  const [hour, minute] = elements.itemTime.value.split(":").map(Number);
  const roundedMinutes = Math.min(23 * 60 + 55, Math.round((hour * 60 + minute) / 5) * 5);
  elements.itemTime.value = `${String(Math.floor(roundedMinutes / 60)).padStart(2, "0")}:${String(
    roundedMinutes % 60
  ).padStart(2, "0")}`;
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
    elements.itemTime.value = item.time || "";
    elements.itemCategory.value = item.category || "";
    elements.itemNotes.value = item.notes || "";
    elements.itemRecurrence.value = item.recurrence || "none";
    elements.itemRecurrence.disabled = Boolean(item.seriesId);
    elements.itemPinned.checked = Boolean(item.pinned);
    elements.itemWeekly.checked = Boolean(item.weeklyOnly);
    elements.itemWeekly.disabled = Boolean(item.seriesId);
    elements.deleteItem.classList.remove("hidden");
  } else {
    elements.itemDialogTitle.textContent = "新建事项";
    elements.itemId.value = "";
    elements.itemDate.value = defaults.date || toDateKey(state.selectedDate);
    elements.itemWeekly.checked = Boolean(defaults.weeklyOnly);
    elements.deleteItem.classList.add("hidden");
    restoreDraft();
    if (defaults.weeklyOnly) {
      elements.itemDate.value = defaults.date;
      elements.itemWeekly.checked = true;
    }
  }

  updateWeeklyFormState();
  elements.itemDialog.showModal();
  window.setTimeout(() => elements.itemTitle.focus(), 50);
}

function readItemForm() {
  return {
    title: elements.itemTitle.value.trim(),
    date: elements.itemDate.value,
    time: elements.itemTime.value,
    category: elements.itemCategory.value,
    tags: Array.from(elements.tagOptions.querySelectorAll('input[type="checkbox"]:checked'), (input) => input.value),
    notes: elements.itemNotes.value.trim(),
    recurrence: elements.itemRecurrence.value,
    pinned: elements.itemPinned.checked,
    weeklyOnly: elements.itemWeekly.checked
  };
}

async function saveItemFromForm(event) {
  event.preventDefault();
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
    category: definition.category || "",
    tags: definition.tags || [],
    notes: definition.notes || "",
    recurrence: definition.recurrence || "none",
    seriesId,
    completed: false,
    pinned: Boolean(definition.pinned),
    weeklyOnly: Boolean(definition.weeklyOnly),
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null
  }));
  await storePutMany(ITEM_STORE, items);
  return items;
}

function generateRecurrenceDates(startDateKey, recurrence) {
  const startDate = fromDateKey(startDateKey);
  const dates = [];
  const limits = { daily: 365, weekly: 104, monthly: 24 };
  const count = limits[recurrence] || 1;

  for (let index = 0; index < count; index += 1) {
    const date = new Date(startDate);
    if (recurrence === "daily") date.setDate(startDate.getDate() + index);
    if (recurrence === "weekly") date.setDate(startDate.getDate() + index * 7);
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
    elements.itemTime.value = draft.time || "";
    renderCategoryOptions(draft.category || "");
    renderTagOptions(draft.tags || []);
    elements.itemCategory.value = draft.category || "";
    elements.itemNotes.value = draft.notes || "";
    elements.itemRecurrence.value = draft.recurrence || "none";
    elements.itemPinned.checked = Boolean(draft.pinned);
    elements.itemWeekly.checked = Boolean(draft.weeklyOnly);
    updateWeeklyFormState();
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
  await storePut(ITEM_STORE, {
    ...item,
    id: crypto.randomUUID(),
    date: elements.copyDate.value,
    recurrence: "none",
    seriesId: null,
    completed: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
  state.selectedDate = fromDateKey(elements.copyDate.value);
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
  await saveTemplate(definition);
  showSnackbar("已保存为常用模板", false);
}

async function saveTemplate(source) {
  const now = new Date().toISOString();
  await storePut(TEMPLATE_STORE, {
    id: crypto.randomUUID(),
    title: source.title,
    time: source.time || "",
    category: source.category || "",
    tags: source.tags || [],
    notes: source.notes || "",
    recurrence: "none",
    pinned: Boolean(source.pinned),
    weeklyOnly: Boolean(source.weeklyOnly),
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  });
  state.templates = (await storeGetAll(TEMPLATE_STORE)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
    affected.map((candidate) => ({ ...candidate, deletedAt, updatedAt: deletedAt }))
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
    affected.map((item) => ({ ...item, deletedAt: null, updatedAt: now }))
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
  if (!state.templates.length) {
    elements.templatesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">＋</div>
        <h3>还没有常用模板</h3>
        <p>在事项操作中选择“保存为常用模板”。</p>
      </div>`;
    return;
  }

  elements.templatesList.innerHTML = state.templates
    .map(
      (template) => `
        <div class="template-row">
          <div>
            <strong>${escapeHtml(template.title)}</strong>
            <small>${escapeHtml([template.time || "全天", template.category].filter(Boolean).join(" · "))}</small>
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
    const template = state.templates.find((candidate) => candidate.id === useButton.dataset.useTemplate);
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
    await storeDelete(TEMPLATE_STORE, deleteButton.dataset.deleteTemplate);
    state.templates = state.templates.filter((template) => template.id !== deleteButton.dataset.deleteTemplate);
    renderTemplates();
  }
}

async function createItemFromTemplate(event) {
  event.preventDefault();
  const template = state.templates.find((candidate) => candidate.id === state.templateId);
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
    .filter((item) => item.deletedAt)
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
    await storePut(ITEM_STORE, { ...item, deletedAt: null, updatedAt: new Date().toISOString() });
    await refreshData();
    renderTrash();
    return;
  }

  const purgeButton = event.target.closest("[data-purge-item]");
  if (purgeButton) {
    await storeDelete(ITEM_STORE, purgeButton.dataset.purgeItem);
    await refreshData();
    renderTrash();
  }
}

function openDataDialog() {
  renderOptionManagement();
  elements.dataDialog.showModal();
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
      <span class="managed-color" style="background:${option.color}"></span>
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
  const backup = {
    app: "xiaoji",
    backupVersion: 1,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
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

  function migrateBackup(backup) {
    return {
      ...backup,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      items: backup.items.map(normalizeItemRecord),
      templates: backup.templates.map(normalizeTemplateRecord)
    };
  }

  return (
    backup.items.every((item) => item && typeof item.id === "string" && typeof item.title === "string") &&
    backup.templates.every(
      (template) => template && typeof template.id === "string" && typeof template.title === "string"
    )
  );
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
  return { daily: "每天", weekly: "每周", monthly: "每月" }[recurrence] || "";
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
