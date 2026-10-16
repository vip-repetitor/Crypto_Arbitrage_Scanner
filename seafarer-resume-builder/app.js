/* ============================================================
   Premium Seafarer Resume Builder — логика конструктора.
   Полностью локально: localStorage + Blob-скачивания.
   Итоговый формат резюме: ТОЛЬКО автономный HTML (без DOCX/PDF-веток).
   Этап UX-H: автосохранение с индикатором, Ctrl+S, Undo для удаления,
   дублирование записей, модалка помощи, защита от потери данных.
   ============================================================ */
"use strict";

/* ---------- Константы ---------- */
const STORAGE_KEY = "seafarer_resume_v1";
const UNDO_TTL_MS = 8000;                     // окно отмены удаления (этап UX-D)
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;      // порог «разумного» фото для localStorage
const PHOTO_RESIZE_LIMIT = 900;               // максимальная сторона после сжатия
const DEFAULT_FOOTER = "References and original documents available upon request.";

/* ---------- JSON-схема данных резюме (Шаг 2) ----------
   {
     schemaVersion: 2,
     header:   { fullName, rank, age, nationality, passport, seamanBook, photoDataUrl },
     personal: { dob, heightWeight, englishLevel, availableFrom, phone, email, cityCountry, totalSeaService },
     aboutMe:  string,
     vessels:  [{ vesselName, vesselType, rank, period, duration, duties }],
     certs:    [{ name, validUntil }],
     footerText: string,
     theme: {          // цвета блоков резюме (этап G: выбор цвета каждого блока)
       headerBg, headerText, accent, sectionTitle, hairline,
       bodyBg, ink, muted, tableHeadBg, tableHeadText, zebra, certBg, footerText
     }
   }
----------------------------------------------------------- */

const DEFAULT_THEME = {
  headerBg: "#0B1F3A",      // шапка: фон
  headerText: "#FFFFFF",    // шапка: основной текст (имя)
  accent: "#C9A227",        // акцент: ранг, pill-рамки, золотые линии, thead таблиц
  sectionTitle: "#0B1F3A",  // заголовки секций
  hairline: "#E3C56A",      // светлый оттенок акцента (подчёркивания, свечения)
  bodyBg: "#FFFFFF",        // фон страницы резюме
  ink: "#1C2430",           // основной текст
  muted: "#6B7686",         // вторичный текст
  tableHeadBg: "#12305A",   // фон заголовка таблицы стажа
  zebra: "#F7F9FC",         // зебра строк таблицы
  certBg: "#FBF9F1",        // фон карточек сертификатов
  footerText: "#6B7686"     // текст футера
};

// Все настраиваемые блоки: id -> подпись в UI (подписи UI на английском)
const THEME_BLOCKS = [
  ["headerBg",     "Header background"],
  ["headerText",   "Header text (name)"],
  ["accent",       "Accent / gold details"],
  ["sectionTitle", "Section titles"],
  ["hairline",     "Accent light shade"],
  ["bodyBg",       "Page background"],
  ["ink",          "Main text"],
  ["muted",        "Secondary text"],
  ["tableHeadBg",  "Table header background"],
  ["zebra",        "Table zebra rows"],
  ["certBg",       "Certificate cards background"],
  ["footerText",   "Footer text"]
];

function cloneDefaultTheme() { return Object.assign({}, DEFAULT_THEME); }

function emptyData() {
  return {
    schemaVersion: 2,
    header: { fullName: "", rank: "", age: "", nationality: "", passport: "", seamanBook: "", photoDataUrl: "" },
    personal: { dob: "", heightWeight: "", englishLevel: "", availableFrom: "", phone: "", email: "", cityCountry: "", totalSeaService: "" },
    aboutMe: "",
    vessels: [],
    certs: [],
    footerText: "",
    theme: cloneDefaultTheme()
  };
}

/* Пример данных (явно синтетический placeholder, не реальные персональные данные) */
function sampleData() {
  const d = emptyData();
  d.header = {
    fullName: "John A. Sample",
    rank: "Second Engineer",
    age: "38",
    nationality: "Filipino",
    passport: "P0000000X (sample)",
    seamanBook: "SB-0000001 (sample)",
    photoDataUrl: ""
  };
  d.personal = {
    dob: "01.01.1988",
    heightWeight: "175 cm / 72 kg",
    englishLevel: "Upper-Intermediate",
    availableFrom: "01.01.2026",
    phone: "+000 000 000 000 (sample)",
    email: "john.sample@example.com (sample)",
    cityCountry: "Manila, Philippines",
    totalSeaService: "12 years 6 months"
  };
  d.aboutMe = "Dedicated marine engineer with over 12 years of sea service on cargo and tanker vessels. " +
    "Strong background in main engine maintenance, safety management under ISM/ISM-code requirements, " +
    "and crew leadership. Zero lost-time incidents record. Ready to join worldwide.";
  d.vessels = [
    { vesselName: "MV Sample Trader", vesselType: "Bulk Carrier, 82,000 DWT", rank: "Second Engineer",
      period: "Mar 2021 – Present", duration: "4 yr 9 mo",
      duties: "Responsible for main engine, auxiliary machinery and PMS. Conducted planned maintenance and dry-dock preparations." },
    { vesselName: "MT Example Pride", vesselType: "Crude Oil Tanker, 115,000 DWT", rank: "Third Engineer",
      period: "Jun 2017 – Feb 2021", duration: "3 yr 9 mo",
      duties: "Operated and maintained boilers, purifiers and deck machinery. Assisted cargo operations under SOLAS/MARPOL requirements." },
    { vesselName: "MV Demo Fortune", vesselType: "Container Vessel, 4,500 TEU", rank: "Junior Engineer",
      period: "Jan 2013 – May 2017", duration: "4 yr 5 mo",
      duties: "Watchkeeping in ECR, maintenance of generators and pumps under supervision of the Chief Engineer." }
  ];
  d.certs = [
    { name: "STCW Basic Safety Training (A-VI/4-1/-4)", validUntil: "12.2027" },
    { name: "Advanced Fire Fighting", validUntil: "06.2027" },
    { name: "Medical Care on Board Ship", validUntil: "03.2028" },
    { name: "Tanker Familiarisation (Oil/Chemical)", validUntil: "10.2026" }
  ];
  d.footerText = DEFAULT_FOOTER;
  return d;
}

/* ---------- Состояние ---------- */
let data = emptyData();

/* ---------- Утилиты ---------- */

// Экранирование пользовательского текста перед вставкой в HTML (Шаг 8 безопасности)
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Значение или аккуратный placeholder вида [AGE]
function val(v, placeholderLabel) {
  const s = String(v == null ? "" : v).trim();
  return { text: s || ("[" + placeholderLabel + "]"), empty: !s };
}

function setStatus(msg, kind) {
  const el = document.getElementById("statusLine");
  // statusLine содержит прогресс-бар в начале — не затираем его: текст статуса
  // живёт во втором дочернем узле (этап UX-P)
  let textNode = el.querySelector(".status-text");
  if (!textNode) {
    textNode = document.createElement("span");
    textNode.className = "status-text";
    el.appendChild(textNode);
  }
  textNode.textContent = msg;
  el.className = "status-line" + (kind ? " " + kind : "");
}

// Вставка прогресс-бара в статус-строку (вызывается один раз при init)
function injectProgressBar() {
  const el = document.getElementById("statusLine");
  if (!el || el.querySelector("#progressWrap")) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = progressMarkup(); // служебная статичная разметка, без пользовательских данных
  const wrap = tmp.firstElementChild;
  el.insertBefore(wrap, el.firstChild);
}

/* ---------- Индикатор автосохранения (этап UX-B) ----------
   Кратковременно появляется внизу экрана после каждого автосейва. */
let savePillTimer = null;
function showSaved() {
  const pill = document.getElementById("savePill");
  if (!pill) return;
  pill.classList.add("show");
  clearTimeout(savePillTimer);
  savePillTimer = setTimeout(() => pill.classList.remove("show"), 1400);
}

function getByPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setByPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

/* ---------- Чтение данных из формы в модель ---------- */
function syncSimpleFieldsToModel() {
  document.querySelectorAll("[data-key]").forEach(el => {
    setByPath(data, el.dataset.key, el.value);
  });
}

/* ---------- Запись модели в простые поля формы ---------- */
function fillSimpleFieldsFromModel() {
  document.querySelectorAll("[data-key]").forEach(el => {
    const v = getByPath(data, el.dataset.key);
    el.value = v == null ? "" : v;
  });
  renderPhotoThumb();
}

/* ---------- HTML-разметка прогресс-бара (этап UX-P) ---------- */
// Вставляется в начало statusLine программно: если пользователь открыл index.html
// с кэшированным старым HTML, бар всё равно появится.
function progressMarkup() {
  return `
    <div class="progress-wrap" id="progressWrap">
      <div class="progress-top">
        <span class="progress-title">Resume Completion</span>
        <span class="progress-label" id="progressLabel">Completion: 0%</span>
      </div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Resume completion progress">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="progress-status"><span id="undoSlot"></span></div>
    </div>`;
}

/* ---------- Прогресс заполнения резюме (этап UX-P) ----------
   Считаем, сколько содержательных полей заполнено. Footer не учитываем:
   у него есть значение по умолчанию. Пустая карточка судна/сертификата
   (все поля пусты) в расчёт не берётся — чтобы «+ Add vessel» не ронял процент. */
const PROGRESS_SIMPLE_FIELDS = [
  "header.fullName", "header.rank", "header.age", "header.nationality",
  "header.passport", "header.seamanBook",
  "personal.dob", "personal.heightWeight", "personal.englishLevel",
  "personal.availableFrom", "personal.phone", "personal.email",
  "personal.cityCountry", "personal.totalSeaService",
  "aboutMe"
];
const VESSEL_KEYS = ["vesselName", "vesselType", "rank", "period", "duration", "duties"];
const CERT_KEYS = ["name", "validUntil"];

// Возвращает { filled, total, pct }
function computeProgress() {
  let filled = 0, total = 0;
  const nonEmpty = v => typeof v === "string" && v.trim() !== "";
  PROGRESS_SIMPLE_FIELDS.forEach(p => {
    total++;
    if (nonEmpty(getByPath(data, p))) filled++;
  });
  if (nonEmpty(data.header && data.header.photoDataUrl)) filled++; // фото — отдельный критерий
  total++;
  (data.vessels || []).forEach(v => {
    if (!VESSEL_KEYS.some(k => nonEmpty(v[k]))) return; // полностью пустая карточка — игнорируем
    VESSEL_KEYS.forEach(k => { total++; if (nonEmpty(v[k])) filled++; });
  });
  (data.certs || []).forEach(c => {
    if (!CERT_KEYS.some(k => nonEmpty(c[k]))) return;
    CERT_KEYS.forEach(k => { total++; if (nonEmpty(c[k])) filled++; });
  });
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, pct };
}

// Обновление видимого прогресс-бара (безопасно: не падает, если элементов нет)
function updateProgress() {
  const bar = document.getElementById("progressFill");
  const label = document.getElementById("progressLabel");
  if (!bar || !label) return;
  const p = computeProgress();
  bar.style.width = p.pct + "%";
  bar.setAttribute("aria-valuenow", String(p.pct));
  label.textContent = p.pct >= 100
    ? "Resume complete — ready to download ✓"
    : "Completion: " + p.pct + "% (" + p.filled + " of " + p.total + " fields filled)";
  label.className = "progress-label" + (p.pct >= 100 ? " done" : p.pct >= 60 ? " mid" : "");
}

/* ---------- Кнопка Undo внутри прогресс-панели (этап UX-P) ----------
   Статус-текст и Undo живут в одном слоте .progress-status, чтобы layout
   не прыгал: панель занимает фиксированную ширину в статус-строке. */
function renderUndoButton() {
  const slot = document.getElementById("undoSlot");
  if (!slot) return;
  slot.innerHTML = ""; // служебная разметка без пользовательских данных
  if (!undoState) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "undo-btn";
  btn.textContent = "Undo";
  btn.title = "Restore the removed entry";
  btn.addEventListener("click", undoRemove);
  slot.appendChild(btn);
}

/* ---------- Рендер карточек судов (Шаг 4) ---------- */
function renderVessels() {
  const wrap = document.getElementById("vesselsList");
  wrap.innerHTML = ""; // перерисовываем только служебную разметку, текст полей ставим через .value
  if (!data.vessels.length) {
    const note = document.createElement("div");
    note.className = "placeholder-note";
    note.textContent = "No vessels yet. Click “+ Add vessel” to describe your sea service.";
    wrap.appendChild(note);
    return;
  }
  data.vessels.forEach((v, i) => {
    const card = document.createElement("div");
    card.className = "item-card";

    const head = document.createElement("div");
    head.className = "item-card-head";
    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = "Vessel #" + (i + 1);
    const actions = document.createElement("div");
    actions.className = "item-actions";

    const mkBtn = (label, title, danger, disabled, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "icon-btn" + (danger ? " danger" : "");
      b.textContent = label;
      b.title = title;
      b.disabled = !!disabled;
      b.addEventListener("click", fn);
      return b;
    };
    actions.append(
      mkBtn("↑", "Move up", false, i === 0, () => { syncAll(); moveItem("vessels", i, -1); }),
      mkBtn("↓", "Move down", false, i === data.vessels.length - 1, () => { syncAll(); moveItem("vessels", i, 1); }),
      mkBtn("⧉", "Duplicate this vessel", false, false, () => { syncAll(); duplicateItem("vessels", i); }),
      mkBtn("✕", "Remove vessel", true, false, () => { syncAll(); removeItem("vessels", i); })
    );
    head.append(idx, actions);
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "grid-2";
    const fields = [
      ["vesselName", "Vessel Name", "e.g. MV Sample Trader"],
      ["vesselType", "Vessel Type", "e.g. Bulk Carrier, 82,000 DWT"],
      ["rank", "Rank", "e.g. Second Engineer"],
      ["period", "Period", "e.g. Mar 2021 – Present"],
      ["duration", "Duration", "e.g. 4 yr 9 mo"]
    ];
    fields.forEach(([key, label, ph]) => {
      const f = document.createElement("div");
      f.className = "field";
      const lab = document.createElement("label");
      lab.textContent = label;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = ph;
      inp.value = v[key] || "";
      inp.addEventListener("input", () => { v[key] = inp.value; scheduleUpdate(); updateProgress(); }); // прогресс пересчитываем сразу (этап UX-P)
      f.append(lab, inp);
      grid.appendChild(f);
    });
    card.appendChild(grid);

    const fDuties = document.createElement("div");
    fDuties.className = "field";
    const labD = document.createElement("label");
    labD.textContent = "Duties / Remarks";
    const ta = document.createElement("textarea");
    ta.style.minHeight = "60px";
    ta.placeholder = "Main responsibilities, machinery operated, notable achievements…";
    ta.value = v.duties || "";
    ta.addEventListener("input", () => { v.duties = ta.value; scheduleUpdate(); });
    fDuties.append(labD, ta);
    card.appendChild(fDuties);

    wrap.appendChild(card);
  });
}

/* ---------- Рендер карточек сертификатов (Шаг 5) ---------- */
function renderCerts() {
  const wrap = document.getElementById("certsList");
  wrap.innerHTML = "";
  if (!data.certs.length) {
    const note = document.createElement("div");
    note.className = "placeholder-note";
    note.textContent = "No certificates yet. Click “+ Add certificate” to list your STCW and other certificates.";
    wrap.appendChild(note);
    return;
  }
  data.certs.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "item-card";

    const head = document.createElement("div");
    head.className = "item-card-head";
    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = "Certificate #" + (i + 1);
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const dup = document.createElement("button");
    dup.type = "button";
    dup.className = "icon-btn";
    dup.textContent = "⧉";
    dup.title = "Duplicate certificate";
    dup.addEventListener("click", () => { syncAll(); duplicateItem("certs", i); });
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "icon-btn danger";
    rm.textContent = "✕";
    rm.title = "Remove certificate";
    rm.addEventListener("click", () => { syncAll(); removeItem("certs", i); });
    actions.append(dup, rm);
    head.append(idx, actions);
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "grid-2";
    [["name", "Certificate Name", "e.g. STCW Basic Safety Training"],
     ["validUntil", "Valid Until", "MM.YYYY"]].forEach(([key, label, ph]) => {
      const f = document.createElement("div");
      f.className = "field";
      const lab = document.createElement("label");
      lab.textContent = label;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = ph;
      inp.value = c[key] || "";
      inp.addEventListener("input", () => { c[key] = inp.value; scheduleUpdate(); updateProgress(); }); // прогресс сразу (UX-P)
      f.append(lab, inp);
      grid.appendChild(f);
    });
    card.appendChild(grid);
    wrap.appendChild(card);
  });
}

function moveItem(listKey, index, dir) {
  const arr = data[listKey];
  const j = index + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[index], arr[j]] = [arr[j], arr[index]];
  rerenderLists();
  update();
  saveToStorage();
}

/* ---------- Undo для удалений (этап UX-D) ----------
   Удаляем сразу, но в статус-баре появляется кнопка «Undo» на ~8 секунд. */
let undoState = null;   // { listKey, index, item, timer }
function clearUndo() {
  if (undoState && undoState.timer) clearTimeout(undoState.timer);
  undoState = null;
}
function removeItem(listKey, index) {
  clearUndo();
  const item = data[listKey][index];
  data[listKey].splice(index, 1);
  rerenderLists();
  update();
  saveToStorage();
  undoState = { listKey, index, item };
  undoState.timer = setTimeout(() => { undoState = null; setStatus("Ready.", ""); renderUndoButton(); }, UNDO_TTL_MS);
  setStatus(`Entry removed.`, "ok");
  renderUndoButton(); // кнопка Undo — в слоте внутри прогресс-панели (этап UX-P)
}

function undoRemove() {
  if (!undoState) return;
  const { listKey: k, index: i2, item: it } = undoState;
  clearUndo();
  data[k].splice(Math.min(i2, data[k].length), 0, it);
  rerenderLists();
  update();
  saveToStorage();
  setStatus("Removal undone.", "ok");
  renderUndoButton();
}

/* Дублирование записи: быстрый ввод однотипных контрактов/ротаций */
function duplicateItem(listKey, index) {
  const src = data[listKey][index];
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  data[listKey].splice(index + 1, 0, copy);
  rerenderLists();
  update();
  saveToStorage();
  setStatus("Entry duplicated below the original.", "ok");
}

function addItem(listKey, template) {
  syncSimpleFieldsToModel();
  data[listKey].push(Object.assign({}, template));
  rerenderLists();
  update();
  saveToStorage();
}
function rerenderLists() {
  renderVessels();
  renderCerts();
  updateProgress(); // состав записей изменился — пересчитываем прогресс (этап UX-P)
  // Кнопки «Duplicate last» активны только когда есть что дублировать
  const dv = document.getElementById("dupVesselBtn");
  const dc = document.getElementById("dupCertBtn");
  if (dv) dv.disabled = data.vessels.length === 0;
  if (dc) dc.disabled = data.certs.length === 0;
}

/* Синхронизация всего (простые поля + текущие DOM-состояния списков уже в data) */
function syncAll() { syncSimpleFieldsToModel(); }

/* ---------- Фото: загрузка, проверка типа, сжатие (Шаг безопасности) ---------- */
function handlePhotoFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    setStatus("Unsupported image format. Please use JPG, PNG, WEBP or GIF. Photo not added.", "err");
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => setStatus("Failed to read photo file.", "err");
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => { setStatus("Photo could not be decoded; placeholder will be used.", "err"); };
    img.onload = () => {
      // Сжимаем через canvas, чтобы localStorage не переполнился
      const scale = Math.min(1, PHOTO_RESIZE_LIMIT / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let out;
      try { out = canvas.toDataURL("image/jpeg", 0.85); }
      catch (e) { out = String(reader.result); } // если canvas недоступен — исходный dataURL
      if (out.length > PHOTO_MAX_BYTES * 1.35) {
        setStatus("Photo is very large even after compression; it will stay in this session but may not be auto-saved.", "err");
        data.header.photoDataUrl = "";           // не сохраняем гигантское фото в localStorage
        showPhotoTemporarily(out);
        update();
        return;
      }
      data.header.photoDataUrl = out;
      renderPhotoThumb();
      update();
      setStatus("Photo added.", "ok");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
let tempPhotoUrl = "";
function showPhotoTemporarily(url) {
  tempPhotoUrl = url;
  renderPhotoThumb();
}
function renderPhotoThumb() {
  const src = data.header.photoDataUrl || tempPhotoUrl;
  const thumb = document.getElementById("photoThumb");
  const empty = document.getElementById("photoThumbEmpty");
  const rm = document.getElementById("photoRemoveBtn");
  if (src) {
    thumb.src = src; thumb.hidden = false; empty.hidden = true; rm.hidden = false;
  } else {
    thumb.hidden = true; empty.hidden = false; rm.hidden = true;
  }
}

/* ---------- Утилиты цвета (этап G) ---------- */

// Валидация hex-цвета (#RGB / #RRGGBB); введёт user — проверяем строго,
// чтобы значение безопасно попадало в CSS/inline-стили.
function normHex(c) {
  const s = String(c == null ? "" : c).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return ("#" + s.slice(1).split("").map(ch => ch + ch).join("")).toUpperCase();
  return "";
}

// hex -> {r,g,b}
function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Смешать цвет с белым (amt>0) или чёрным (amt<0); amt в [-1..1]
function mix(hex, amt) {
  const t = hexToRgb(hex);
  const target = amt >= 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(amt));
  const ch = (c) => Math.round(target * a + c * (1 - a));
  const to2 = (v) => v.toString(16).padStart(2, "0");
  return "#" + to2(ch(t.r)) + to2(ch(t.g)) + to2(ch(t.b));
}

// Относительная яркость (WCAG)
function luminance(hex) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(a, b) {
  const l1 = Math.max(luminance(a), luminance(b));
  const l2 = Math.min(luminance(a), luminance(b));
  return (l1 + 0.05) / (l2 + 0.05);
}

// Прозрачная версия hex-цвета (rgba) — для теней/свечений акцента
function rgbaOf(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Итоговая тема пользователя поверх дефолта (пустые/битые значения игнорируются)
function currentTheme() {
  const t = cloneDefaultTheme();
  const src = (data && data.theme) || {};
  Object.keys(DEFAULT_THEME).forEach(k => {
    const v = normHex(src[k]);
    if (v) t[k] = v;
  });
  // Производные значения (не редактируются пользователем напрямую)
  t.tableHeadText = "#F3EAD0";                                   // текст thead
  t.headerBgGradEnd = mix(t.headerBg, 0.28);                    // светлее для градиента шапки
  t.accentDeep = mix(t.accent, -0.35);                           // темнее: «металл» для колец/теней
  t.borderSoft = mix(t.bodyBg, -0.13);                          // мягкие границы таблиц/карточек
  t.placeholder = "#AAB2BF";                                    // курсивные placeholder'ы
  t.photoPlaceholder = "#9AA4B2";                               // текст [PHOTO]
  return t;
}

/* Пресеты палитр (по мотивам design/design-tokens.json; все значения — примеры) */
const THEME_PRESETS = {
  "navy-gold": {
    label: "Navy Gold",
    headerBg: "#0B1F3A", headerText: "#FFFFFF", accent: "#C9A227", sectionTitle: "#0B1F3A",
    hairline: "#E3C56A", bodyBg: "#FFFFFF", ink: "#1C2430", muted: "#6B7686",
    tableHeadBg: "#12305A", zebra: "#F7F9FC", certBg: "#FBF9F1", footerText: "#6B7686"
  },
  "black-champagne": {
    label: "Black Champagne",
    headerBg: "#16110D", headerText: "#F5EFE3", accent: "#D9BE8C", sectionTitle: "#241B12",
    hairline: "#EBD9B4", bodyBg: "#FFFDF8", ink: "#2A221A", muted: "#7C7266",
    tableHeadBg: "#2A241E", zebra: "#F7F2E9", certBg: "#FAF5EA", footerText: "#7C7266"
  },
  "ocean-platinum": {
    label: "Ocean Platinum",
    headerBg: "#1E2B3A", headerText: "#FFFFFF", accent: "#8FA3B8", sectionTitle: "#1E2B3A",
    hairline: "#C6CBD4", bodyBg: "#FFFFFF", ink: "#22303E", muted: "#66788A",
    tableHeadBg: "#33485F", zebra: "#F4F7FA", certBg: "#F2F5F8", footerText: "#66788A"
  }
};

/* Собранные стили резюме: возвращает CSS с подставленными цветами выбранной темы.
   Все правила используют переменные --sr-*, поэтому экспорт остаётся самодостаточным. */
function resumeCss(t) {
  t = t || currentTheme();
  // Инлайним стили резюме в экспорт: файл должен быть самодостаточным.
  return `
    :root{
      --sr-header-bg:${t.headerBg};--sr-header-bg-grad:${t.headerBgGradEnd};
      --sr-header-text:${t.headerText};--sr-accent:${t.accent};--sr-accent-deep:${t.accentDeep};
      --sr-hairline:${t.hairline};--sr-body-bg:${t.bodyBg};--sr-ink:${t.ink};--sr-muted:${t.muted};
      --sr-title:${t.sectionTitle};--sr-thead-bg:${t.tableHeadBg};--sr-thead-text:${t.tableHeadText};
      --sr-zebra:${t.zebra};--sr-cert-bg:${t.certBg};--sr-border:${t.borderSoft};
      --sr-footer-text:${t.footerText};--sr-placeholder:${t.placeholder};--sr-photo-ph:${t.photoPlaceholder};
      --font-serif:Georgia,"Times New Roman","PT Serif",serif;
      --font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}
    body{margin:0;background:${mix(t.bodyBg, -0.06)};font-family:var(--font-sans);}
    .sr-page{max-width:900px;margin:24px auto;background:var(--sr-body-bg);color:var(--sr-ink);border-radius:6px;overflow:hidden;box-shadow:0 18px 50px ${rgbaOf(t.headerBg,.18)};}
    .sr-header{background:radial-gradient(1200px 400px at 85% -40%,${rgbaOf(t.accent,.22)},transparent 60%),linear-gradient(135deg,var(--sr-header-bg) 0%,var(--sr-header-bg-grad) 55%,var(--sr-header-bg) 100%);color:var(--sr-header-text);padding:44px 48px 38px;display:flex;gap:34px;align-items:center;}
    /* Кольцо фото — linear-градиент вместо конического: конические градиенты не поддерживаются старыми Safari/Chrome */
    .sr-photo-ring{width:150px;height:150px;border-radius:50%;padding:5px;background:linear-gradient(135deg,var(--sr-hairline),var(--sr-accent) 45%,var(--sr-accent-deep) 75%,var(--sr-hairline));box-shadow:0 10px 26px rgba(0,0,0,.35);flex:0 0 auto;}
    .sr-photo-ring img,.sr-photo-placeholder{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;background:${mix(t.bodyBg, -0.04)};}
    .sr-photo-placeholder{display:flex;align-items:center;justify-content:center;color:var(--sr-photo-ph);font-size:12px;letter-spacing:1px;text-transform:uppercase;}
    .sr-id{flex:1;min-width:0;}
    .sr-name{font-family:var(--font-serif);font-size:34px;font-weight:600;letter-spacing:1px;margin:0 0 6px;overflow-wrap:anywhere;}
    .sr-rank{color:var(--sr-hairline);font-size:16px;letter-spacing:3px;text-transform:uppercase;margin:0 0 18px;}
    .sr-pills{display:flex;flex-wrap:wrap;gap:8px;}
    .sr-pill{border:1px solid ${rgbaOf(t.accent,.55)};background:rgba(255,255,255,.06);color:var(--sr-header-text);border-radius:999px;padding:6px 14px;font-size:12.5px;}
    .sr-pill b{color:var(--sr-hairline);font-weight:600;margin-right:6px;}
    .sr-hairline{height:3px;background:linear-gradient(90deg,transparent,var(--sr-accent) 15%,var(--sr-hairline) 50%,var(--sr-accent) 85%,transparent);}
    .sr-section{padding:30px 48px 8px;}
    .sr-section-title{font-family:var(--font-serif);font-size:18px;letter-spacing:2.5px;text-transform:uppercase;color:var(--sr-title);margin:0 0 4px;}
    .sr-section-sub{height:2px;width:56px;background:linear-gradient(90deg,var(--sr-accent),var(--sr-hairline));border-radius:2px;margin:8px 0 18px;}
    .sr-about-text{font-size:14.5px;line-height:1.75;color:var(--sr-ink);margin:0;white-space:pre-line;}
    .sr-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 26px;}
    .sr-info-item{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dotted var(--sr-border);padding:7px 2px;font-size:13.5px;}
    .sr-info-item .k{color:var(--sr-muted);letter-spacing:.4px;text-transform:uppercase;font-size:11.5px;padding-top:2px;}
    .sr-info-item .v{color:var(--sr-ink);font-weight:600;text-align:right;}
    .sr-info-item .v.ph{color:var(--sr-placeholder);font-weight:400;font-style:italic;}
    .sr-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
    table.sr-table{width:100%;border-collapse:collapse;font-size:13px;border:1px solid var(--sr-border);min-width:640px;}
    .sr-table thead th{background:linear-gradient(180deg,var(--sr-header-bg-grad),var(--sr-thead-bg));color:var(--sr-thead-text);text-align:left;font-weight:600;letter-spacing:.8px;text-transform:uppercase;font-size:11px;padding:12px 14px;}
    .sr-table tbody td{padding:12px 14px;border-top:1px solid var(--sr-border);vertical-align:top;line-height:1.5;}
    .sr-table tbody tr:nth-child(even){background:var(--sr-zebra);}
    .sr-table .vessel-name{font-weight:700;color:var(--sr-title);}
    .sr-table .vessel-type{color:var(--sr-muted);font-size:12px;}
    .sr-table .rank-cell{color:${mix(t.accent, -0.28)};font-weight:600;}
    .sr-empty-row td{text-align:center;color:var(--sr-placeholder);font-style:italic;padding:22px;}
    .sr-certs{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;}
    .sr-cert{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid var(--sr-border);background:var(--sr-cert-bg);border-radius:10px;padding:12px 16px;font-size:13.5px;}
    .sr-cert .cname{font-weight:600;color:var(--sr-title);}
    .sr-cert .cvalid{color:var(--sr-muted);font-size:12px;white-space:nowrap;}
    .sr-cert .cvalid b{color:${mix(t.accent, -0.28)};}
    .sr-footer{margin-top:34px;padding:0 48px 34px;}
    /* Стальной канат убран по решению владельца проекта (этап F): футер = тонкая золотая линия + текст */
    .sr-footer-rule{height:2px;background:linear-gradient(90deg,transparent,var(--sr-accent) 15%,var(--sr-hairline) 50%,var(--sr-accent) 85%,transparent);border:none;border-radius:2px;margin:0 0 16px;}
    .sr-footer-text{text-align:center;margin:0;font-family:var(--font-serif);font-size:13.5px;letter-spacing:1.5px;color:var(--sr-footer-text);}
    /* Адаптив резюме внутри превью и в standalone-файле (этап F) */
    @media (max-width: 720px){
      .sr-header{flex-direction:column;align-items:flex-start;gap:20px;padding:28px 20px 24px;}
      .sr-name{font-size:26px;}
      .sr-rank{font-size:13px;letter-spacing:2px;margin-bottom:12px;}
      .sr-photo-ring{width:112px;height:112px;}
      .sr-section{padding:22px 20px 6px;}
      .sr-certs,.sr-info-grid{grid-template-columns:minmax(0,1fr);}
      .sr-table{font-size:12px;}
      .sr-table thead th,.sr-table tbody td{padding:9px 10px;}
      /* min-width не нужен в печати — таблица умещается на листе */
      @media print{.sr-table{min-width:0;}}
      .sr-footer{padding:0 20px 22px;}
    }
    @media print{body{background:#fff;}.sr-page{box-shadow:none;max-width:100%;margin:0;}.sr-table{min-width:0;}.sr-table-wrap{overflow:visible;}}
  `;
}

function buildResumeHtml(d, forStandalone) {
  const h = d.header || {}, p = d.personal || {};
  const t = currentTheme(); // этап G: пользовательские цвета блоков
  const name = val(h.fullName, "FULL NAME");
  const rank = val(h.rank, "RANK");
  const age = val(h.age, "AGE");
  const nat = val(h.nationality, "NATIONALITY");
  const pp = val(h.passport, "PASSPORT");
  const sb = val(h.seamanBook, "SEAMAN BOOK");

  const photoSrc = d.header.photoDataUrl || tempPhotoUrl;
  const photoHtml = photoSrc
    ? `<img src="${photoSrc}" alt="Seafarer photo" />`
    : `<div class="sr-photo-placeholder">[PHOTO]</div>`;

  const pill = (k, vObj) =>
    `<span class="sr-pill"><b>${k}:</b>${esc(vObj.text)}</span>`;

  const infoRows = [
    ["Age", age],
    ["Date of Birth", val(p.dob, "DD.MM.YYYY")],
    ["Nationality", nat],
    ["Height / Weight", val(p.heightWeight, "H/W")],
    ["English Level", val(p.englishLevel, "ENGLISH LEVEL")],
    ["Available From", val(p.availableFrom, "DD.MM.YYYY")],
    ["Phone", val(p.phone, "PHONE")],
    ["Email", val(p.email, "EMAIL")],
    ["City / Country", val(p.cityCountry, "CITY / COUNTRY")],
    ["Total Sea Service", val(p.totalSeaService, "TOTAL SEA SERVICE")]
  ].map(([k, v]) =>
    `<div class="sr-info-item"><span class="k">${esc(k)}</span><span class="v${v.empty ? " ph" : ""}">${esc(v.text)}</span></div>`
  ).join("");

  const vesselsRows = (d.vessels && d.vessels.length)
    ? d.vessels.map(v => `
        <tr>
          <td><div class="vessel-name">${esc(val(v.vesselName, "VESSEL NAME").text)}</div>
              <div class="vessel-type">${esc(val(v.vesselType, "VESSEL TYPE").text)}</div></td>
          <td class="rank-cell">${esc(val(v.rank, "RANK").text)}</td>
          <td>${esc(val(v.period, "PERIOD").text)}</td>
          <td>${esc(val(v.duration, "DURATION").text)}</td>
          <td>${esc(val(v.duties, "DUTIES").text)}</td>
        </tr>`).join("")
    : `<tr class="sr-empty-row"><td colspan="5">Sea service details to be added — [NO ENTRIES YET]</td></tr>`;

  const certsHtml = (d.certs && d.certs.length)
    ? d.certs.map(c => `
        <div class="sr-cert">
          <span class="cname">${esc(val(c.name, "CERTIFICATE NAME").text)}</span>
          <span class="cvalid">Valid until <b>${esc(val(c.validUntil, "MM.YYYY").text)}</b></span>
        </div>`).join("")
    : `<div class="placeholder-note" style="border:1px dashed ${t.borderSoft};border-radius:10px;padding:14px;text-align:center;color:${t.placeholder};font-style:italic;">No certificates listed — [ADD CERTIFICATES]</div>`;

  const about = String(d.aboutMe || "").trim();
  const aboutHtml = about
    ? `<p class="sr-about-text">${esc(about)}</p>`
    : `<p class="sr-about-text" style="color:${t.placeholder};font-style:italic;">[Tell a few words about yourself — About Me section]</p>`;

  const footerText = String(d.footerText || "").trim() || DEFAULT_FOOTER;
  // Контраст текста шапки и цвета секций/футера на фоне страницы (этап G)
  const headerTextColor = contrastRatio(t.headerText, t.headerBg) >= 2.5 ? t.headerText : "#FFFFFF";
  const titleColor = contrastRatio(t.sectionTitle, t.bodyBg) >= 2.5 ? t.sectionTitle : t.ink;
  const footColor = contrastRatio(t.footerText, t.bodyBg) >= 2.5 ? t.footerText : t.muted;

  const body = `
    <div class="sr-page" style="--sr-title:${titleColor};--sr-footer-text:${footColor};">
      <header class="sr-header" style="color:${headerTextColor};">
        <div class="sr-photo-wrap"><div class="sr-photo-ring">${photoHtml}</div></div>
        <div class="sr-id">
          <h1 class="sr-name">${esc(name.text)}</h1>
          <p class="sr-rank">${esc(rank.text)}</p>
          <div class="sr-pills">
            ${pill("Age", age)} ${pill("Nationality", nat)} ${pill("Passport", pp)} ${pill("Seaman Book", sb)}
          </div>
        </div>
      </header>
      <div class="sr-hairline"></div>

      <section class="sr-section">
        <h2 class="sr-section-title">Personal Information</h2>
        <div class="sr-section-sub"></div>
        <div class="sr-info-grid">${infoRows}</div>
      </section>

      <section class="sr-section">
        <h2 class="sr-section-title">About Me</h2>
        <div class="sr-section-sub"></div>
        ${aboutHtml}
      </section>

      <section class="sr-section">
        <h2 class="sr-section-title">Sea Service Experience</h2>
        <div class="sr-section-sub"></div>
        <!-- wrap: на узких экранах таблица скроллится горизонтально, а не ломает вёрстку -->
        <div class="sr-table-wrap">
        <table class="sr-table">
          <thead><tr>
            <th>Vessel Name / Type</th><th>Rank</th><th>Period</th><th>Duration</th><th>Duties / Remarks</th>
          </tr></thead>
          <tbody>${vesselsRows}</tbody>
        </table>
        </div>
      </section>

      <section class="sr-section">
        <h2 class="sr-section-title">Certificates</h2>
        <div class="sr-section-sub"></div>
        <div class="sr-certs">${certsHtml}</div>
      </section>

      <footer class="sr-footer">
        <div class="sr-footer-rule" role="presentation" aria-hidden="true"></div>
        <p class="sr-footer-text">${esc(footerText)}</p>
      </footer>
    </div>`;

  if (!forStandalone) {
    // Превью внутри iframe: только тело + стили
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>${resumeCss()}</style></head><body>${body}</body></html>`;
  }
  // Standalone-файл: самодостаточный, без внешних зависимостей
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(name.text)} — ${esc(rank.text)} — Seafarer CV</title>
<style>${resumeCss()}</style>
<!-- Generated locally by Premium Seafarer Resume Builder. No external resources, no tracking. -->
</head>
<body>${body}</body>
</html>`;
}

/* ---------- UI настроек цветов блоков (этап G) ---------- */
function renderThemeUI() {
  const list = document.getElementById("themeList");
  if (!list) return;
  list.innerHTML = ""; // служебная разметка; значения ставим через .value/.textContent
  THEME_BLOCKS.forEach(([key, label]) => {
    const row = document.createElement("div");
    row.className = "theme-row";

    const inp = document.createElement("input");
    inp.type = "color";
    inp.id = "themeColor-" + key;
    inp.setAttribute("aria-label", label);
    inp.value = normHex(data.theme && data.theme[key]) || DEFAULT_THEME[key];
    // input[type=color] требует #RRGGBB — нормализуем 3-значный hex
    if (!/^#[0-9a-fA-F]{6}$/.test(inp.value)) inp.value = mix(inp.value, 0);

    const lab = document.createElement("label");
    lab.htmlFor = inp.id;
    lab.textContent = label;

    const hex = document.createElement("span");
    hex.className = "theme-hex";
    hex.textContent = inp.value.toUpperCase();

    inp.addEventListener("input", () => {
      data.theme[key] = inp.value;
      hex.textContent = inp.value.toUpperCase();
      scheduleUpdate();
    });

    row.append(inp, lab, hex);
    list.appendChild(row);
  });
}

// Заполнить color-инпуты из модели (после импорта / sample / restore)
function refreshThemeInputs() {
  THEME_BLOCKS.forEach(([key]) => {
    const inp = document.getElementById("themeColor-" + key);
    if (!inp) return;
    let v = normHex(data.theme && data.theme[key]) || DEFAULT_THEME[key];
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) v = mix(v, 0);
    inp.value = v;
    const hexSpan = inp.parentElement.querySelector(".theme-hex");
    if (hexSpan) hexSpan.textContent = v.toUpperCase();
  });
}

function applyPreset(id) {
  const preset = THEME_PRESETS[id];
  if (!preset) return;
  data.theme = Object.assign(cloneDefaultTheme(), preset);
  delete data.theme.label;
  refreshThemeInputs();
  update();
  saveToStorage();
  setStatus(`Palette “${preset.label}” applied. Fine-tune any block below or on the right.`, "ok");
}

function resetTheme() {
  data.theme = cloneDefaultTheme();
  refreshThemeInputs();
  update();
  saveToStorage();
  setStatus("Block colors reset to the default Navy Gold palette.", "ok");
}

/* ---------- Live preview (Шаг 6) + скролл-синхронизация (этап UX-E) ---------- */
let updateTimer = null;
function scheduleUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => update(), 150);
  updateProgress(); // прогресс-бар обновляем сразу, без дебаунса (этап UX-P)
  saveToStorage();
}
function update() {
  const frame = document.getElementById("preview");
  try {
    frame.srcdoc = buildResumeHtml(data, false);
  } catch (e) {
    setStatus("Preview failed: " + e.message, "err");
  }
}

// Прокрутка формы плавно «ведёт» превью (коэффициент по высоте контента),
// чтобы пользователь видел ту же часть резюме, которую редактирует.
let scrollSyncGuard = false;
function initScrollSync() {
  const form = document.querySelector(".form-scroll");
  const frame = document.getElementById("preview");
  if (!form || !frame) return;
  let docHeight = 1;
  frame.addEventListener("load", () => {
    try {
      const d = frame.contentDocument;
      if (d && d.body) docHeight = Math.max(1, d.body.scrollHeight);
    } catch (e) { /* sandbox может запретить доступ — синхронизация просто отключится */ }
  });
  form.addEventListener("scroll", () => {
    if (scrollSyncGuard) return;
    scrollSyncGuard = true;
    requestAnimationFrame(() => {
      try {
        const w = frame.contentWindow;
        if (!w) return;
        const vh = frame.clientHeight;
        const max = Math.max(0, docHeight - vh);
        const ratio = form.scrollTop / Math.max(1, form.scrollHeight - form.clientHeight);
        w.scrollTo(0, ratio * max);
      } catch (e) { /* тихо: не критично */ }
      scrollSyncGuard = false;
    });
  }, { passive: true });
}

/* ---------- Автосохранение в localStorage (Шаг 7) ---------- */
function saveToStorage() {
  const write = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      showSaved();
    } catch (e) {
      // Переполнение хранилища (обычно из-за фото) — сохраняем без фото, не роняя приложение
      try {
        const copy = JSON.parse(JSON.stringify(data));
        copy.header.photoDataUrl = "";
        localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
        setStatus("Storage limit reached: photo was not auto-saved (it still appears in export this session).", "err");
      } catch (e2) { /* молча игнорируем — автосохранение не критично */ }
    }
  };
  // Дебаунс: при быстром вводе пишем в localStorage не чаще, чем раз в 400 мс
  clearTimeout(saveToStorage._t);
  saveToStorage._t = setTimeout(write, 400);
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = normalizeImported(JSON.parse(raw));
    if (!parsed) return false;
    data = parsed;
    return true;
  } catch (e) {
    return false; // повреждённые данные — стартуем с пустой формы
  }
}

/* ---------- Нормализация импортируемых данных (Шаг 8/12) ---------- */
function str(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
function normalizeImported(obj) {
  if (!obj || typeof obj !== "object") return null;
  const d = emptyData();
  const h = obj.header || {}, p = obj.personal || {};
  d.header = {
    fullName: str(h.fullName), rank: str(h.rank), age: str(h.age),
    nationality: str(h.nationality), passport: str(h.passport), seamanBook: str(h.seamanBook),
    photoDataUrl: /^data:image\/(jpeg|png|webp|gif);base64,/i.test(str(h.photoDataUrl)) ? str(h.photoDataUrl) : ""
  };
  d.personal = {
    dob: str(p.dob), heightWeight: str(p.heightWeight), englishLevel: str(p.englishLevel),
    availableFrom: str(p.availableFrom), phone: str(p.phone), email: str(p.email),
    cityCountry: str(p.cityCountry), totalSeaService: str(p.totalSeaService)
  };
  d.aboutMe = str(obj.aboutMe);
  // Тема (этап G): принимаем только валидные hex-значения, остальное — дефолт
  const th = obj.theme || {};
  d.theme = cloneDefaultTheme();
  Object.keys(DEFAULT_THEME).forEach(k => {
    const v = normHex(th[k]);
    if (v) d.theme[k] = v;
  });
  d.vessels = Array.isArray(obj.vessels) ? obj.vessels.map(v => ({
    vesselName: str(v && v.vesselName), vesselType: str(v && v.vesselType), rank: str(v && v.rank),
    period: str(v && v.period), duration: str(v && v.duration), duties: str(v && v.duties)
  })) : [];
  d.certs = Array.isArray(obj.certs) ? obj.certs.map(c => ({
    name: str(c && c.name), validUntil: str(c && c.validUntil)
  })) : [];
  d.footerText = str(obj.footerText);
  d.schemaVersion = 2;
  return d;
}

/* ---------- Экспорт/импорт JSON (Шаг 8) ---------- */
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function slugName() {
  const s = String(data.header.fullName || "seafarer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "seafarer";
}
function exportJson() {
  syncAll();
  download(slugName() + "-resume-data.json", JSON.stringify(data, null, 2), "application/json");
  setStatus("Data exported as JSON.", "ok");
}
function importJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => setStatus("Could not read the JSON file.", "err");
  reader.onload = () => {
    try {
      const parsed = normalizeImported(JSON.parse(String(reader.result)));
      if (!parsed) throw new Error("Unrecognized structure");
      data = parsed;
      fillSimpleFieldsFromModel();
      rerenderLists();
      updateProgress();
      refreshThemeInputs();
      update();
      saveToStorage();
      setStatus("JSON imported successfully.", "ok");
    } catch (e) {
      setStatus("Import failed: invalid JSON file (" + e.message + "). Your current data was kept.", "err");
    }
  };
  reader.readAsText(file);
}

/* ---------- Экспорт резюме в standalone HTML (Шаг 11) ---------- */
function exportResumeHtml() {
  syncAll();
  try {
    const html = buildResumeHtml(data, true);
    download(slugName() + "-resume.html", html, "text/html;charset=utf-8");
    setStatus("Resume downloaded as a standalone HTML file. Open it in any browser; use Print → Save as PDF if you wish.", "ok");
  } catch (e) {
    setStatus("Export failed: " + e.message, "err");
  }
}

/* ---------- Очистка и sample ---------- */
// Есть ли в данных непустые значения (для предупреждения перед очисткой)
function hasContent() {
  const d = data;
  const flat = [d.header.fullName, d.header.rank, d.header.age, d.header.nationality,
    d.header.passport, d.header.seamanBook, d.header.photoDataUrl, d.aboutMe,
    d.personal.dob, d.personal.heightWeight, d.personal.englishLevel, d.personal.availableFrom,
    d.personal.phone, d.personal.email, d.personal.cityCountry, d.personal.totalSeaService,
    d.footerText].some(s => String(s || "").trim() !== "");
  return flat || d.vessels.length > 0 || d.certs.length > 0;
}
function clearAll() {
  data = emptyData();
  tempPhotoUrl = "";
  clearUndo();
  fillSimpleFieldsFromModel();
  rerenderLists();
  refreshThemeInputs();
  update();
  updateProgress();
  saveToStorage();
  setStatus("All data cleared.", "ok");
}
function loadSample() {
  data = sampleData();
  tempPhotoUrl = "";
  clearUndo();
  fillSimpleFieldsFromModel();
  rerenderLists();
  refreshThemeInputs();
  update();
  updateProgress();
  saveToStorage();
  setStatus("Sample data loaded (all values are synthetic examples).", "ok");
}

/* ---------- Модальное окно помощи (этап UX-F) ---------- */
function openHelp() {
  const m = document.getElementById("helpModal");
  if (!m) return;
  m.hidden = false;
  document.body.classList.add("modal-open");
  const closeBtn = document.getElementById("helpCloseBtn");
  if (closeBtn) closeBtn.focus();
}
function closeHelp() {
  const m = document.getElementById("helpModal");
  if (!m) return;
  m.hidden = true;
  document.body.classList.remove("modal-open");
  const btn = document.getElementById("helpBtn");
  if (btn) btn.focus();
}

/* ---------- Инициализация ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Восстановление из localStorage
  injectProgressBar();          // прогресс-бар в статус-строку (этап UX-P)
  loadFromStorage();
  fillSimpleFieldsFromModel();
  rerenderLists();
  renderThemeUI();
  update();
  updateProgress();
  initScrollSync();

  // Автосохранение при вводе простых полей
  document.querySelectorAll("[data-key]").forEach(el => {
    el.addEventListener("input", () => { syncSimpleFieldsToModel(); scheduleUpdate(); });
    el.addEventListener("change", () => { syncSimpleFieldsToModel(); scheduleUpdate(); });
  });

  document.getElementById("addVesselBtn").addEventListener("click", () =>
    addItem("vessels", { vesselName: "", vesselType: "", rank: "", period: "", duration: "", duties: "" }));
  document.getElementById("addCertBtn").addEventListener("click", () =>
    addItem("certs", { name: "", validUntil: "" }));

  // Дублирование последней записи (этап UX-C)
  const dupV = document.getElementById("dupVesselBtn");
  if (dupV) dupV.addEventListener("click", () => { syncAll(); duplicateItem("vessels", data.vessels.length - 1); });
  const dupC = document.getElementById("dupCertBtn");
  if (dupC) dupC.addEventListener("click", () => { syncAll(); duplicateItem("certs", data.certs.length - 1); });

  // Кнопки пресетов палитр (этап G)
  document.querySelectorAll("[data-preset]").forEach(btn =>
    btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));
  const resetBtn = document.getElementById("themeResetBtn");
  if (resetBtn) resetBtn.addEventListener("click", resetTheme);

  document.getElementById("photoInput").addEventListener("change", e => {
    handlePhotoFile(e.target.files && e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("photoRemoveBtn").addEventListener("click", () => {
    data.header.photoDataUrl = ""; tempPhotoUrl = "";
    renderPhotoThumb(); update(); saveToStorage();
    setStatus("Photo removed.", "ok");
  });

  document.getElementById("sampleBtn").addEventListener("click", loadSample);
  document.getElementById("clearBtn").addEventListener("click", () => {
    // Предупреждение показываем только если действительно есть что терять (этап UX-G)
    syncAll();
    if (!hasContent()) { setStatus("There is nothing to clear.", ""); return; }
    if (confirm("Clear all resume data? This cannot be undone.\nTip: use “Export JSON” first if you want a backup.")) clearAll();
  });
  document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
  document.getElementById("importJsonInput").addEventListener("change", e => {
    importJsonFile(e.target.files && e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("downloadHtmlBtn").addEventListener("click", exportResumeHtml);

  // Верхняя кнопка скачивания (дублирует основную — этап UX-H)
  const dlTop = document.getElementById("downloadTopBtn");
  if (dlTop) dlTop.addEventListener("click", exportResumeHtml);

  // Помощь / модалка (этап UX-F) + горячие клавиши (этап UX-A)
  const helpBtn = document.getElementById("helpBtn");
  if (helpBtn) helpBtn.addEventListener("click", openHelp);
  const helpClose = document.getElementById("helpCloseBtn");
  if (helpClose) helpClose.addEventListener("click", closeHelp);
  const helpModal = document.getElementById("helpModal");
  if (helpModal) helpModal.addEventListener("click", e => { if (e.target === helpModal) closeHelp(); });

  document.addEventListener("keydown", e => {
    // Ctrl/⌘+S — скачать резюме HTML вместо системного «Сохранить страницу»
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === "s") {
      e.preventDefault();
      exportResumeHtml();
      return;
    }
    if (e.key === "Escape" && helpModal && !helpModal.hidden) closeHelp();
  });

  // Защита от случайного закрытия вкладки до записи автосохранения (этап UX-G)
  window.addEventListener("beforeunload", () => {
    // Если висит незаписанный дебаунс — синхронно дописываем данные
    if (saveToStorage._t) {
      clearTimeout(saveToStorage._t);
      saveToStorage._t = null;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (err) { /* best effort */ }
    }
  });

  document.getElementById("printPreviewBtn").addEventListener("click", () => {
    const f = document.getElementById("preview");
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch (e) { setStatus("Print is available from the downloaded HTML file instead.", "err"); }
  });
});
