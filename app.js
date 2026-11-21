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
const analysisPanel = $("analysisPanel");
const analysisContent = $("analysisContent");
const analysisSource = $("analysisSource");
const aiSettingsBtn = $("aiSettingsBtn");
const settingsModal = $("settingsModal");
const settingsClose = $("settingsClose");
const settingsSave = $("settingsSave");
const testBtn = $("testBtn");
const providerSelect = $("providerSelect");
const baseUrlInput = $("baseUrlInput");
const apiKeyInput = $("apiKeyInput");
const modelInput = $("modelInput");
const exportDayBtn = $("exportDayBtn");
const importDayBtn = $("importDayBtn");
const importDayModal = $("importDayModal");
const importDayClose = $("importDayClose");
const importDayCancel = $("importDayCancel");
const importDayConfirm = $("importDayConfirm");
const importDayArea = $("importDayArea");
const importDayTarget = $("importDayTarget");

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

// 压缩图片并转为 base64（限制宽度，控制 localStorage 体积）
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 480;
      let w = img.width, h = img.height;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => callback("");
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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
  day.tasks.push({ id: uid(), title, start, end, hours, done: false, desc: "", image: "" });
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

  if (t.desc) {
    const desc = document.createElement("div");
    desc.className = "task-desc";
    desc.textContent = t.desc;
    body.appendChild(desc);
  }
  if (t.image) {
    const img = document.createElement("img");
    img.className = "task-image";
    img.src = t.image;
    img.alt = t.title;
    img.title = "点击查看大图";
    img.addEventListener("click", () => window.open(t.image, "_blank"));
    body.appendChild(img);
  }

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

  // 文字描述
  const descInput = document.createElement("textarea");
  descInput.className = "edit-input edit-desc";
  descInput.value = t.desc || "";
  descInput.placeholder = "添加文字描述（可选）…";
  descInput.rows = 2;

  // 图片描述
  let imgData = t.image || "";
  const imageWrap = document.createElement("div");
  imageWrap.className = "edit-image-wrap";
  const imagePreview = document.createElement("img");
  imagePreview.className = "edit-image-preview";
  const imgBtns = document.createElement("div");
  imgBtns.className = "edit-image-btns";
  const fileId = "imgFile_" + t.id;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = fileId;
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  const uploadLabel = document.createElement("label");
  uploadLabel.className = "btn btn-ghost btn-sm";
  uploadLabel.setAttribute("for", fileId);
  uploadLabel.textContent = "🖼 添加图片";
  const removeImgBtn = document.createElement("button");
  removeImgBtn.type = "button";
  removeImgBtn.className = "btn btn-ghost btn-sm";
  removeImgBtn.textContent = "🗑 删除图片";

  function updateImagePreview() {
    if (imgData) {
      imagePreview.src = imgData;
      imagePreview.style.display = "block";
      uploadLabel.textContent = "🖼 更换图片";
      removeImgBtn.style.display = "";
    } else {
      imagePreview.style.display = "none";
      imagePreview.src = "";
      uploadLabel.textContent = "🖼 添加图片";
      removeImgBtn.style.display = "none";
    }
  }
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    compressImage(file, (dataUrl) => {
      imgData = dataUrl;
      updateImagePreview();
    });
  });
  removeImgBtn.addEventListener("click", () => {
    imgData = "";
    updateImagePreview();
  });
  imageWrap.appendChild(imagePreview);
  imgBtns.appendChild(uploadLabel);
  imgBtns.appendChild(removeImgBtn);
  imgBtns.appendChild(fileInput);
  imageWrap.appendChild(imgBtns);
  updateImagePreview();

  body.appendChild(titleInput);
  body.appendChild(timeRow);
  body.appendChild(descInput);
  body.appendChild(imageWrap);

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
    t.desc = descInput.value.trim();
    t.image = imgData;
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

  // 当日 AI 分析
  renderAnalysisPanel();
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

// 本地精简分析：返回纯文本
function buildLocalAnalysis() {
  const day = getDay(currentDate);
  const tasks = day.tasks;
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const undone = tasks.filter((t) => !t.done);
  const hours = tasks.reduce((s, t) => s + t.hours, 0);
  const goal = day.goal || 0;
  const gap = goal - hours;

  if (total === 0) {
    return "今天还没有安排学习任务，建议先规划一个可执行的小目标开始行动。";
  }

  const lines = [];
  lines.push(`完成 ${done}/${total} 项（${Math.round((done / total) * 100)}%），累计 ${hours.toFixed(1)} 小时。`);
  if (goal > 0) {
    lines.push(gap > 0 ? `离目标还差 ${gap.toFixed(1)} 小时。` : `已达 ${goal} 小时目标 ✓`);
  }

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      if (isOverlap(tasks[i], tasks[j])) {
        lines.push(`「${tasks[i].title}」与「${tasks[j].title}」时间重叠，需错开。`);
      }
    }
  }

  if (undone.length > 0) {
    const free = findFreeSlots(tasks);
    undone.forEach((t, idx) => {
      const slot = free[idx % free.length];
      if (slot && slot.hours >= t.hours) {
        lines.push(`「${t.title}」未完成，可安排 ${slot.start}-${slot.end}。`);
      } else if (slot) {
        lines.push(`「${t.title}」未完成，空档不足，建议拆分或延后。`);
      } else {
        lines.push(`「${t.title}」未完成，时间已满，建议延后。`);
      }
    });
  }

  if (done === total && total > 0) {
    lines.push("全部完成，很棒！可休息或预习明日。");
  }

  return lines.join("\n");
}

// 渲染当日分析到内嵌面板
function renderAnalysisPanel() {
  const day = getDay(currentDate);
  const a = day.analysis;
  if (a && a.text) {
    analysisPanel.style.display = "block";
    analysisContent.innerHTML = simpleMarkdown(a.text);
    analysisSource.textContent = a.source === "local" ? "本地分析" : `${a.source} 生成`;
  } else {
    analysisPanel.style.display = "none";
  }
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
    "你是学习规划教练。用简洁中文要点回答，每点一句话，总共不超过5点，直接给出可执行的分配建议，不要客套话。";
  const user = `分析我${isToday ? "今天" : currentDate}的学习清单（目标 ${day.goal} 小时）：\n${tasks || "（暂无任务）"}\n\n重点：未完成任务如何分配到具体时间空档、时间是否冲突、离目标差多少、给1-2条具体建议。`;
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

// ---------- 打开分析（内嵌并保存到当天） ----------
async function openAnalysis() {
  const day = getDay(currentDate);
  analysisPanel.style.display = "block";
  analysisSource.textContent = "分析中…";
  analysisContent.innerHTML = `<div class="ai-loading"><div class="spinner"></div><div>分析中…</div></div>`;

  let text, source;
  if (aiConfig.apiKey && aiConfig.url) {
    try {
      text = await callAI();
      source = (PROVIDERS[aiConfig.provider] || {}).name || "AI";
    } catch (e) {
      text = buildLocalAnalysis();
      source = "本地分析";
    }
  } else {
    text = buildLocalAnalysis();
    source = "本地分析";
  }

  day.analysis = { text, source, time: new Date().toISOString() };
  saveStore();
  renderAnalysisPanel();
}

aiBtn.addEventListener("click", openAnalysis);

aiSettingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsSave.addEventListener("click", saveSettings);
providerSelect.addEventListener("change", onProviderChange);
testBtn.addEventListener("click", testConnection);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

// ---------- 当天数据导出 / 导入 ----------
function buildDayJSON() {
  const day = getDay(currentDate);
  return JSON.stringify(
    {
      app: "dailyStudyPlanner",
      type: "day",
      date: currentDate,
      tasks: day.tasks,
      goal: day.goal,
    },
    null,
    2
  );
}

// 复制当天数据到剪贴板；失败时用文本框兜底
function exportDay() {
  const day = getDay(currentDate);
  const json = buildDayJSON();
  const fallback = () => {
    // 打开导入模态框，把数据放进文本框供手动复制
    importDayArea.value = json;
    importDayTarget.textContent = currentDate;
    importDayConfirm.textContent = "确认（数据已在下方，请手动复制后关闭）";
    importDayModal.classList.add("show");
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(
      () => alert(`✅ 已复制「${currentDate}」当天的 ${day.tasks.length} 个任务，去云端点「导入当天」粘贴即可`),
      fallback
    );
  } else {
    fallback();
  }
}

function importDayFromText(text) {
  const data = JSON.parse(text);
  let date, tasks, goal;
  if (data.type === "day" && data.date) {
    date = data.date;
    tasks = data.tasks;
    goal = data.goal;
  } else if (data.days) {
    // 兼容旧的全量格式：只取当前查看那天
    const d = data.days[currentDate];
    if (!d) throw new Error("全量备份里没有「" + currentDate + "」这一天的数据");
    date = currentDate;
    tasks = d.tasks;
    goal = d.goal;
  } else {
    throw new Error("数据格式无法识别，请使用「导出当天」得到的单日数据");
  }
  if (!Array.isArray(tasks)) throw new Error("任务数据格式错误");
  store.days[date] = { tasks, goal: goal ?? 8 };
  saveStore();
  currentDate = date;
  render();
  alert(`✅ 已导入「${date}」的 ${tasks.length} 个任务`);
}

function openImportDay() {
  importDayArea.value = "";
  importDayTarget.textContent = currentDate;
  importDayConfirm.textContent = "导入";
  importDayModal.classList.add("show");
}
function closeImportDay() {
  importDayModal.classList.remove("show");
}

exportDayBtn.addEventListener("click", exportDay);
importDayBtn.addEventListener("click", openImportDay);
importDayClose.addEventListener("click", closeImportDay);
importDayCancel.addEventListener("click", closeImportDay);
importDayConfirm.addEventListener("click", () => {
  const text = importDayArea.value.trim();
  if (!text) {
    alert("请先粘贴当天数据");
    return;
  }
  try {
    importDayFromText(text);
    closeImportDay();
  } catch (err) {
    alert("❌ 导入失败：" + err.message);
  }
});
importDayModal.addEventListener("click", (e) => {
  if (e.target === importDayModal) closeImportDay();
});

// ---------- 初始化 ----------
render();
