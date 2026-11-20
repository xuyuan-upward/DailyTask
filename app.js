// 每日学习清单应用逻辑（多日保存版）
const STORAGE_KEY = "dailyStudyPlannerV2";
const LEGACY_KEY = "dailyStudyPlanner";

const $ = (id) => document.getElementById(id);

// ---------- 日期工具 ----------
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() {
  return formatDate(new Date());
}
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftDate(str, delta) {
  return formatDate(new Date(parseDate(str).getTime() + delta * 86400000));
}

// ---------- 存储（按日期字典） ----------
function loadStore() {
  let store = { days: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) store = JSON.parse(raw);
  } catch (e) {}
  if (!store.days) store.days = {};

  // 迁移旧版本单日数据
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const d = JSON.parse(legacy);
      if (d.date && Array.isArray(d.tasks) && !store.days[d.date]) {
        store.days[d.date] = { tasks: d.tasks, goal: d.goal ?? 8 };
      }
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch (e) {}
  return store;
}
function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
function getDay(dateStr) {
  if (!store.days[dateStr]) {
    store.days[dateStr] = { tasks: [], goal: 8 };
  }
  return store.days[dateStr];
}

const store = loadStore();
let currentDate = todayStr();
let editingId = null; // 正在编辑的任务 id

// ---------- DOM ----------
const taskList = $("taskList");
const emptyState = $("emptyState");
const taskInput = $("taskInput");
const startInput = $("startTime");
const endInput = $("endTime");
const addBtn = $("addBtn");
const resetBtn = $("resetBtn");
const goalInput = $("goalHours");
const prevDayBtn = $("prevDay");
const nextDayBtn = $("nextDay");
const todayBtn = $("todayBtn");
const datePicker = $("datePicker");
const dateNavText = $("dateNavText");
const aiBtn = $("aiBtn");
const aiModal = $("aiModal");
const aiClose = $("aiClose");
const aiCloseBtn = $("aiCloseBtn");
const aiBody = $("aiBody");
const aiSettingsBtn = $("aiSettingsBtn");
const settingsModal = $("settingsModal");
const settingsClose = $("settingsClose");
const settingsSave = $("settingsSave");
const testBtn = $("testBtn");
const providerSelect = $("providerSelect");
const baseUrlInput = $("baseUrlInput");
const apiKeyInput = $("apiKeyInput");
const modelInput = $("modelInput");
const exportBtn = $("exportBtn");
const importFile = $("importFile");

// ---------- 工具 ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function toMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}
// 根据开始/结束时间计算小时数（支持跨天，如 23:00 → 01:00）
function calcHours(start, end) {
  let diff = toMinutes(end) - toMinutes(start);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

// ---------- 任务操作 ----------
function addTask() {
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }
  const start = startInput.value || "09:00";
  const end = endInput.value || "10:00";
  const hours = calcHours(start, end);
  if (hours <= 0) {
    alert("结束时间需晚于开始时间哦～");
    return;
  }

  const day = getDay(currentDate);
  day.tasks.push({ id: uid(), title, start, end, hours, done: false });
  taskInput.value = "";
  saveStore();
  render();
  taskInput.focus();
}

function toggleTask(id) {
  const day = getDay(currentDate);
  const t = day.tasks.find((t) => t.id === id);
  if (t) {
    t.done = !t.done;
    saveStore();
    render();
  }
}

function deleteTask(id) {
  const day = getDay(currentDate);
  day.tasks = day.tasks.filter((t) => t.id !== id);
  saveStore();
  render();
}

function resetDay() {
  const day = getDay(currentDate);
  if (day.tasks.length === 0) return;
  const isToday = currentDate === todayStr();
  const msg = isToday ? "确定要清空今日所有任务吗？" : "确定要清空该日所有任务吗？";
  if (!confirm(msg)) return;
  day.tasks = [];
  saveStore();
  render();
}

// ---------- 日期导航 ----------
function goToDate(dateStr) {
  currentDate = dateStr;
  render();
}
function goPrev() { goToDate(shiftDate(currentDate, -1)); }
function goNext() { goToDate(shiftDate(currentDate, 1)); }
function goToday() { goToDate(todayStr()); }

function renderDateNav() {
  const isToday = currentDate === todayStr();
  const d = parseDate(currentDate);
  const week = ["日", "一", "二", "三", "四", "五", "六"];
  const label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${week[d.getDay()]}`;

  // 头部日期文本
  $("dateText").textContent = (isToday ? "今天 · " : "") + label;

  // 日期导航栏
  dateNavText.textContent = (isToday ? "今天 · " : "") + `${d.getMonth() + 1}月${d.getDate()}日`;
  dateNavText.classList.toggle("is-today", isToday);
  todayBtn.style.display = isToday ? "none" : "inline-flex";
  resetBtn.textContent = isToday ? "重置今日" : "清空当日";
  datePicker.value = currentDate;
}

// ---------- 渲染辅助 ----------
function bindTimePicker(input) {
  input.addEventListener("click", () => {
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.focus();
    } catch (e) {
      input.focus();
    }
  });
}

function createTaskItem(t) {
  const li = document.createElement("li");
  li.className = "task-item" + (t.done ? " done" : "");

  const checkbox = document.createElement("div");
  checkbox.className = "checkbox";
  checkbox.textContent = t.done ? "✓" : "";
  checkbox.addEventListener("click", () => toggleTask(t.id));

  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = t.title;
  const meta = document.createElement("div");
  meta.className = "task-meta";
  if (t.start && t.end) {
    const time = document.createElement("span");
    time.className = "task-time";
    time.textContent = `🕐 ${t.start} - ${t.end}`;
    meta.appendChild(time);
  }
  const hours = document.createElement("span");
  hours.className = "task-hours";
  hours.innerHTML = `⏱ ${t.hours}<span class="unit"> 小时</span>`;
  meta.appendChild(hours);
  body.appendChild(title);
  body.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.className = "icon-btn";
  edit.title = "编辑任务";
  edit.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';
  edit.addEventListener("click", () => {
    editingId = t.id;
    render();
  });
  const del = document.createElement("button");
  del.className = "icon-btn del";
  del.title = "删除任务";
  del.textContent = "🗑";
  del.addEventListener("click", () => deleteTask(t.id));
  actions.appendChild(edit);
  actions.appendChild(del);

  li.appendChild(checkbox);
  li.appendChild(body);
  li.appendChild(actions);
  return li;
}

function createEditItem(t) {
  const li = document.createElement("li");
  li.className = "task-item editing";

  const body = document.createElement("div");
  body.className = "task-body edit-body";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "edit-input";
  titleInput.value = t.title;
  titleInput.maxLength = 80;
  titleInput.placeholder = "任务内容";

  const timeRow = document.createElement("div");
  timeRow.className = "edit-time-row";
  const startInput = document.createElement("input");
  startInput.type = "time";
  startInput.value = t.start || "09:00";
  bindTimePicker(startInput);
  const sep = document.createElement("span");
  sep.className = "time-sep";
  sep.textContent = "→";
  const endInput = document.createElement("input");
  endInput.type = "time";
  endInput.value = t.end || "10:00";
  bindTimePicker(endInput);
  timeRow.appendChild(startInput);
  timeRow.appendChild(sep);
  timeRow.appendChild(endInput);

  body.appendChild(titleInput);
  body.appendChild(timeRow);

  const actions = document.createElement("div");
  actions.className = "edit-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary btn-sm";
  saveBtn.textContent = "保存";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost btn-sm";
  cancelBtn.textContent = "取消";

  saveBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }
    const start = startInput.value || "09:00";
    const end = endInput.value || "10:00";
    const hours = calcHours(start, end);
    if (hours <= 0) {
      alert("结束时间需晚于开始时间哦～");
      return;
    }
    t.title = title;
    t.start = start;
    t.end = end;
    t.hours = hours;
    editingId = null;
    saveStore();
    render();
  });
  cancelBtn.addEventListener("click", () => {
    editingId = null;
    render();
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  li.appendChild(body);
  li.appendChild(actions);
  return li;
}

// ---------- 渲染 ----------
function render() {
  const day = getDay(currentDate);
  goalInput.value = day.goal;

  // 列表（按开始时间升序排序，无时间项排最后）
  taskList.innerHTML = "";
  const sortedTasks = [...day.tasks].sort((a, b) => {
    const am = a.start ? toMinutes(a.start) : Infinity;
    const bm = b.start ? toMinutes(b.start) : Infinity;
    return am - bm;
  });

  // 按早/中/晚分组
  const buckets = [
    { emoji: "🌅", label: "早上", tasks: [] },
    { emoji: "🌤", label: "中午", tasks: [] },
    { emoji: "🌙", label: "晚上", tasks: [] },
    { emoji: "⏳", label: "未安排时间", tasks: [] },
  ];
  sortedTasks.forEach((t) => {
    if (!t.start) {
      buckets[3].tasks.push(t);
      return;
    }
    const m = toMinutes(t.start);
    if (m >= 5 * 60 && m < 12 * 60) buckets[0].tasks.push(t);
    else if (m >= 12 * 60 && m < 18 * 60) buckets[1].tasks.push(t);
    else buckets[2].tasks.push(t);
  });

  buckets.forEach((b) => {
    if (b.tasks.length === 0) return;
    const header = document.createElement("li");
    header.className = "group-header";
    header.innerHTML =
      `<span class="group-emoji">${b.emoji}</span>` +
      `<span class="group-label">${b.label}</span>` +
      `<span class="group-count">${b.tasks.length} 项</span>`;
    taskList.appendChild(header);
    b.tasks.forEach((t) => {
      const li = t.id === editingId ? createEditItem(t) : createTaskItem(t);
      taskList.appendChild(li);
    });
  });

  // 空状态
  emptyState.classList.toggle("show", day.tasks.length === 0);

  // 统计
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.done).length;
  const hours = day.tasks.reduce((s, t) => s + t.hours, 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  $("statTotal").textContent = total;
  $("statDone").textContent = done;
  $("statHours").textContent = hours.toFixed(1);
  $("progressPct").textContent = pct + "%";

  // 圆环
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fg = $("ringFg");
  fg.style.strokeDasharray = circ;
  fg.style.strokeDashoffset = circ * (1 - pct / 100);

  // 日期导航
  renderDateNav();
}

// ---------- 事件 ----------
addBtn.addEventListener("click", addTask);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});
resetBtn.addEventListener("click", resetDay);
prevDayBtn.addEventListener("click", goPrev);
nextDayBtn.addEventListener("click", goNext);
todayBtn.addEventListener("click", goToday);

// 点击日期文本弹出日历选择器
dateNavText.addEventListener("click", () => {
  try {
    if (typeof datePicker.showPicker === "function") {
      datePicker.showPicker();
    } else {
      datePicker.focus();
      datePicker.click();
    }
  } catch (e) {}
});
datePicker.addEventListener("change", () => {
  if (datePicker.value) goToDate(datePicker.value);
});

// 点击时间输入框任意位置即可弹出时间选择器
bindTimePicker(startInput);
bindTimePicker(endInput);

goalInput.addEventListener("change", () => {
  const day = getDay(currentDate);
  day.goal = Math.max(0, parseFloat(goalInput.value) || 0);
  saveStore();
  render();
});

// ---------- AI 智能分析 ----------
function fmtMin(min) {
  min = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 检测两个任务时间段是否重叠
function isOverlap(a, b) {
  if (!a.start || !b.start) return false;
  let as = toMinutes(a.start), ae = toMinutes(a.end);
  if (ae <= as) ae += 1440;
  let bs = toMinutes(b.start), be = toMinutes(b.end);
  if (be <= bs) be += 1440;
  return as < be && bs < ae;
}

// 找出当天任务之间的空闲时段
function findFreeSlots(tasks) {
  const valid = tasks.filter((t) => t.start && t.end);
  if (valid.length === 0) return [{ start: "00:00", end: "24:00", hours: 24 }];

  const slots = valid
    .map((t) => {
      let s = toMinutes(t.start), e = toMinutes(t.end);
      if (e <= s) e += 1440;
      return { s, e };
    })
    .sort((a, b) => a.s - b.s);

  const free = [];
  let cursor = 0;
  for (const sl of slots) {
    if (sl.s > cursor) free.push({ start: cursor, end: sl.s });
    cursor = Math.max(cursor, sl.e);
  }
  if (cursor < 1440) free.push({ start: cursor, end: 1440 });

  return free
    .map((f) => ({
      start: fmtMin(f.start),
      end: fmtMin(f.end),
      hours: Math.round(((f.end - f.start) / 60) * 100) / 100,
    }))
    .filter((f) => f.hours >= 0.25);
}

function runAnalysis() {
  const day = getDay(currentDate);
  const tasks = day.tasks;
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const undone = tasks.filter((t) => !t.done);
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);
  const hours = tasks.reduce((s, t) => s + t.hours, 0);
  const goal = day.goal || 0;
  const gap = goal - hours;

  // 时间冲突
  const conflicts = [];
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      if (isOverlap(tasks[i], tasks[j])) {
        conflicts.push([tasks[i], tasks[j]]);
      }
    }
  }

  // 空闲时段
  const freeSlots = findFreeSlots(tasks);

  // 整体统计（所有已保存日期）
  const dates = Object.keys(store.days).sort();
  let allTasks = 0, allDone = 0, allHours = 0;
  dates.forEach((d) => {
    const dd = store.days[d];
    allTasks += dd.tasks.length;
    allDone += dd.tasks.filter((t) => t.done).length;
    allHours += dd.tasks.reduce((s, t) => s + t.hours, 0);
  });
  const avgRate = allTasks === 0 ? 0 : Math.round((allDone / allTasks) * 100);

  // 生成建议
  const suggestions = [];

  undone.forEach((t, idx) => {
    const slot = freeSlots[idx % freeSlots.length];
    if (slot && slot.hours >= t.hours) {
      suggestions.push({
        type: "task",
        ico: "📌",
        text: `「${t.title}」尚未完成（需 ${t.hours} 小时），可安排在空档 ${slot.start} - ${slot.end}（约 ${slot.hours} 小时）内完成。`,
      });
    } else if (slot) {
      suggestions.push({
        type: "task",
        ico: "📌",
        text: `「${t.title}」尚未完成（需 ${t.hours} 小时），最近空档仅 ${slot.hours} 小时，建议拆分成多次完成。`,
      });
    } else {
      suggestions.push({
        type: "task",
        ico: "📌",
        text: `「${t.title}」尚未完成，今日时间已排满，建议延后至明天或压缩其他任务。`,
      });
    }
  });

  if (goal > 0 && hours > 0) {
    if (gap > 0) {
      suggestions.push({
        type: "goal",
        ico: "🎯",
        text: `距离每日目标 ${goal} 小时还差 ${gap.toFixed(1)} 小时，建议利用空档补充学习内容。`,
      });
    } else {
      suggestions.push({
        type: "goal",
        ico: "🎯",
        text: `已达成每日 ${goal} 小时目标（实际 ${hours.toFixed(1)} 小时），继续保持！`,
      });
    }
  }

  conflicts.forEach(([a, b]) => {
    suggestions.push({
      type: "warn",
      ico: "⚠️",
      text: `「${a.title}」与「${b.title}」时间重叠，建议错开安排，避免冲突。`,
    });
  });

  if (done > 0 && done === total && total > 0) {
    suggestions.push({
      type: "tip",
      ico: "🎉",
      text: "今日所有任务全部完成，表现非常出色！可以适当休息或预习明日内容。",
    });
  } else if (total === 0) {
    suggestions.push({
      type: "tip",
      ico: "🌱",
      text: "今天还没有安排学习任务，建议先规划一个可执行的小目标开始行动。",
    });
  }

  return { total, done, rate, hours, goal, gap, undone, freeSlots, conflicts, suggestions, savedDays: dates.length, avgRate, allHours };
}

function renderAnalysis() {
  const a = runAnalysis();
  const isToday = currentDate === todayStr();
  const dateLabel = isToday ? "今天" : currentDate;

  let html = "";

  // 总览卡片
  html += `<div class="ai-overview">
    <div class="ai-card"><div class="num">${a.savedDays}</div><div class="lbl">已记录天数</div></div>
    <div class="ai-card"><div class="num">${a.allHours.toFixed(1)}h</div><div class="lbl">累计学习时长</div></div>
    <div class="ai-card"><div class="num">${a.avgRate}%</div><div class="lbl">平均完成率</div></div>
  </div>`;

  // 当前日期分析
  html += `<div class="ai-section">
    <h4>📊 ${dateLabel}清单分析</h4>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim);">
      <span>完成度</span><span>${a.rate}%</span>
    </div>
    <div class="ai-rate-bar"><div class="fill" style="width:${a.rate}%"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim);">
      <span>任务 ${a.total} 个 · 已完成 ${a.done} 个 · 未完成 ${a.undone.length} 个</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim);">
      <span>学习时长 ${a.hours.toFixed(1)}h / 目标 ${a.goal}h</span>
      ${a.goal > 0 ? `<span>${a.gap > 0 ? "还差 " + a.gap.toFixed(1) + "h" : "已达标 ✓"}</span>` : ""}
    </div>
  </div>`;

  // 空闲时段
  if (a.freeSlots.length > 0) {
    html += `<div class="ai-section">
      <h4>🕐 空闲时段</h4>
      ${a.freeSlots.map((f) => `<div class="sug-item tip"><span class="ico">⏳</span><span>${f.start} - ${f.end}（约 ${f.hours} 小时）</span></div>`).join("")}
    </div>`;
  }

  // 建议
  html += `<div class="ai-section">
    <h4>💡 优化分配建议</h4>`;
  if (a.suggestions.length === 0) {
    html += `<div class="ai-empty"><div class="big">🌟</div><div>暂无建议，当前安排很合理</div></div>`;
  } else {
    html += a.suggestions
      .map((s) => `<div class="sug-item ${s.type}"><span class="ico">${s.ico}</span><span>${s.text}</span></div>`)
      .join("");
  }
  html += `</div>`;

  aiBody.innerHTML = html;
}

// ---------- AI 模型配置 ----------
const AI_CONFIG_KEY = "dailyStudyPlannerAIConfig";
const PROVIDERS = {
  deepseek: { name: "DeepSeek", url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
  openai: { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  moonshot: { name: "Moonshot (Kimi)", url: "https://api.moonshot.cn/v1/chat/completions", model: "moonshot-v1-8k" },
  custom: { name: "自定义", url: "", model: "" },
};

function loadAIConfig() {
  const def = {
    provider: "deepseek",
    url: PROVIDERS.deepseek.url,
    apiKey: "",
    model: PROVIDERS.deepseek.model,
  };
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return Object.assign(def, JSON.parse(raw));
  } catch (e) {}
  return def;
}
function saveAIConfig(cfg) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg));
}
let aiConfig = loadAIConfig();

function openSettings() {
  providerSelect.value = aiConfig.provider || "deepseek";
  baseUrlInput.value = aiConfig.url || "";
  apiKeyInput.value = aiConfig.apiKey || "";
  modelInput.value = aiConfig.model || "";
  settingsModal.classList.add("show");
}
function closeSettings() {
  settingsModal.classList.remove("show");
}
function saveSettings() {
  aiConfig.provider = providerSelect.value;
  aiConfig.url = baseUrlInput.value.trim();
  aiConfig.apiKey = apiKeyInput.value.trim();
  aiConfig.model = modelInput.value.trim();
  saveAIConfig(aiConfig);
  closeSettings();
  alert("配置已保存 ✅");
}
function onProviderChange() {
  const p = PROVIDERS[providerSelect.value];
  if (p) {
    baseUrlInput.value = p.url;
    modelInput.value = p.model;
  }
}

async function testConnection() {
  const url = baseUrlInput.value.trim();
  const key = apiKeyInput.value.trim();
  const model = modelInput.value.trim();
  if (!url || !key) {
    alert("请先填写 API 地址和 API Key");
    return;
  }
  const origin = testBtn.textContent;
  testBtn.textContent = "测试中…";
  testBtn.disabled = true;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "user", content: "请回复两个字：正常" }],
        max_tokens: 10,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    alert("连接成功 ✅ 模型响应正常");
  } catch (e) {
    alert("连接失败 ❌\n" + e.message);
  } finally {
    testBtn.textContent = origin;
    testBtn.disabled = false;
  }
}

// ---------- 真实 AI 调用 ----------
function buildMessages() {
  const day = getDay(currentDate);
  const tasks = day.tasks
    .map(
      (t) =>
        `- ${t.title}：${t.start || "?"}-${t.end || "?"}（${t.hours} 小时）[${t.done ? "已完成" : "未完成"}]`
    )
    .join("\n");
  const isToday = currentDate === todayStr();
  const system =
    "你是一名专业的学习规划教练，擅长分析每日学习清单并给出可执行的优化建议。请用简洁清晰的中文回答，使用要点列表，重点突出可落地的时间分配方案。";
  const user = `请分析我${isToday ? "今天" : currentDate}的每日学习清单并给出建议：\n\n每日目标：${day.goal} 小时\n\n学习任务：\n${tasks || "（暂无任务）"}\n\n请从以下方面分析：\n1. 未完成的任务应该怎么安排、分配到哪个时间空档；\n2. 时间安排是否合理（是否有冲突、过于密集或空闲过多）；\n3. 距离目标时长还差多少小时、如何补足；\n4. 其他针对性的学习建议。`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

async function callAI() {
  const res = await fetch(aiConfig.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: buildMessages(),
      temperature: 0.7,
      stream: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 请求失败 (HTTP ${res.status})：${err.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "（模型未返回内容）";
}

// 轻量 markdown 转 HTML
function simpleMarkdown(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{1,3}\s*(.*)$/gm, "<h4>$1</h4>")
    .replace(/^\s*[-*•]\s+(.*)$/gm, "<div class=\"ai-li\">• $1</div>")
    .replace(/^\s*(\d+)[.、]\s*(.*)$/gm, "<div class=\"ai-li\">$1. $2</div>")
    .replace(/\n+/g, "<br/>");
}

function renderAIResult(text) {
  const providerName = (PROVIDERS[aiConfig.provider] || {}).name || "AI";
  return `<span class="ai-source"><span class="dot"></span>由 ${providerName}（${aiConfig.model}）生成</span>
    <div class="ai-content">${simpleMarkdown(text)}</div>`;
}

// ---------- 打开分析 ----------
function openAnalysis() {
  if (aiConfig.apiKey && aiConfig.url) {
    aiModal.classList.add("show");
    aiBody.innerHTML =
      `<div class="ai-loading"><div class="spinner"></div><div>正在调用 ${(PROVIDERS[aiConfig.provider] || {}).name || "AI"} 分析中…</div></div>`;
    callAI()
      .then((text) => {
        aiBody.innerHTML = renderAIResult(text);
      })
      .catch((e) => {
        // 调用失败，回退本地分析并提示
        renderAnalysis();
        aiBody.insertAdjacentHTML(
          "afterbegin",
          `<span class="ai-source local"><span class="dot"></span>AI 调用失败，已切换为本地分析：${escapeHtml(e.message)}</span>`
        );
      });
  } else {
    renderAnalysis();
    aiBody.insertAdjacentHTML(
      "afterbegin",
      `<span class="ai-source local"><span class="dot"></span>本地智能分析（点击右上角 ⚙️ 配置 AI 模型可获得更智能建议）</span>`
    );
    aiModal.classList.add("show");
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function closeAnalysis() {
  aiModal.classList.remove("show");
}

aiBtn.addEventListener("click", openAnalysis);
aiClose.addEventListener("click", closeAnalysis);
aiCloseBtn.addEventListener("click", closeAnalysis);
aiModal.addEventListener("click", (e) => {
  if (e.target === aiModal) closeAnalysis();
});

aiSettingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsSave.addEventListener("click", saveSettings);
providerSelect.addEventListener("change", onProviderChange);
testBtn.addEventListener("click", testConnection);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

// ---------- 数据导出 / 导入 ----------
function exportData() {
  const data = {
    app: "dailyStudyPlanner",
    version: 2,
    exportedAt: new Date().toISOString(),
    days: store.days,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `每日学习清单备份_${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const days = data && data.days;
      if (!days || typeof days !== "object") {
        throw new Error("文件格式不正确，未找到清单数据");
      }
      let count = 0;
      Object.keys(days).forEach((k) => {
        if (days[k] && Array.isArray(days[k].tasks)) {
          store.days[k] = days[k];
          count++;
        }
      });
      saveStore();
      render();
      alert(`✅ 导入成功，已合并 ${count} 天的学习清单数据`);
    } catch (err) {
      alert("❌ 导入失败：" + err.message);
    }
  };
  reader.readAsText(file);
}

exportBtn.addEventListener("click", exportData);
importFile.addEventListener("change", () => {
  if (importFile.files && importFile.files[0]) {
    importData(importFile.files[0]);
    importFile.value = "";
  }
});

// ---------- 初始化 ----------
render();
