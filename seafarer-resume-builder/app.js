/* ============================================================
   Premium Seafarer Resume Builder — логика конструктора.
   Полностью локально: localStorage + Blob-скачивания.
   Итоговый формат резюме: ТОЛЬКО автономный HTML (без DOCX/PDF-веток).
   ============================================================ */
"use strict";

/* ---------- Константы ---------- */
const STORAGE_KEY = "seafarer_resume_v1";
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;      // порог «разумного» фото для localStorage
const PHOTO_RESIZE_LIMIT = 900;               // максимальная сторона после сжатия
const DEFAULT_FOOTER = "References and original documents available upon request.";

/* ---------- JSON-схема данных резюме (Шаг 2) ----------
   {
     schemaVersion: 1,
     header:   { fullName, rank, age, nationality, passport, seamanBook, photoDataUrl },
     personal: { dob, heightWeight, englishLevel, availableFrom, phone, email, cityCountry, totalSeaService },
     aboutMe:  string,
     vessels:  [{ vesselName, vesselType, rank, period, duration, duties }],
     certs:    [{ name, validUntil }],
     footerText: string
   }
----------------------------------------------------------- */

function emptyData() {
  return {
    schemaVersion: 1,
    header: { fullName: "", rank: "", age: "", nationality: "", passport: "", seamanBook: "", photoDataUrl: "" },
    personal: { dob: "", heightWeight: "", englishLevel: "", availableFrom: "", phone: "", email: "", cityCountry: "", totalSeaService: "" },
    aboutMe: "",
    vessels: [],
    certs: [],
    footerText: ""
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
  el.textContent = msg;
  el.className = "status-line" + (kind ? " " + kind : "");
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
      f.className = "field" + (key === "duration" ? "" : "");
      const lab = document.createElement("label");
      lab.textContent = label;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = ph;
      inp.value = v[key] || "";
      inp.addEventListener("input", () => { v[key] = inp.value; scheduleUpdate(); });
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
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "icon-btn danger";
    rm.textContent = "✕";
    rm.title = "Remove certificate";
    rm.addEventListener("click", () => { syncAll(); removeItem("certs", i); });
    actions.appendChild(rm);
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
      inp.addEventListener("input", () => { c[key] = inp.value; scheduleUpdate(); });
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
}
function removeItem(listKey, index) {
  data[listKey].splice(index, 1);
  rerenderLists();
  update();
}
function addItem(listKey, template) {
  syncSimpleFieldsToModel();
  data[listKey].push(Object.assign({}, template));
  rerenderLists();
  update();
}
function rerenderLists() { renderVessels(); renderCerts(); }

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

/* ---------- Генерация HTML резюме (Шаги 9, 10, 6) ----------
   Весь видимый текст резюме — на английском. Пользовательский ввод экранируется. */
function resumeCss() {
  // Инлайним стили резюме в экспорт: берём блок .sr-* из загруженного styles.css,
  // а также дублируем критичные переменные, чтобы файл был самодостаточным.
  return `
    :root{--navy-deep:#0B1F3A;--navy-2:#12305A;--gold:#C9A227;--gold-soft:#E3C56A;
      --cream:#F5F2E8;--ink:#1c2430;--muted:#6b7686;
      --font-serif:Georgia,"Times New Roman","PT Serif",serif;
      --font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}
    body{margin:0;background:#EDEFF3;font-family:var(--font-sans);}
    .sr-page{max-width:900px;margin:24px auto;background:#fff;color:var(--ink);border-radius:6px;overflow:hidden;box-shadow:0 18px 50px rgba(11,31,58,.18);}
    .sr-header{background:radial-gradient(1200px 400px at 85% -40%,rgba(201,162,39,.22),transparent 60%),linear-gradient(135deg,#0B1F3A 0%,#14315C 55%,#0B1F3A 100%);color:#fff;padding:44px 48px 38px;display:flex;gap:34px;align-items:center;}
    /* Кольцо фото — linear-градиент (conic-gradient убран: не поддерживается старыми Safari/Chrome) */
    .sr-photo-ring{width:150px;height:150px;border-radius:50%;padding:5px;background:linear-gradient(135deg,var(--gold-soft),var(--gold) 45%,#8a6d1c 75%,var(--gold-soft));box-shadow:0 10px 26px rgba(0,0,0,.35);flex:0 0 auto;}
    .sr-photo-ring img,.sr-photo-placeholder{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;background:var(--cream);}
    .sr-photo-placeholder{display:flex;align-items:center;justify-content:center;color:#9aa4b2;font-size:12px;letter-spacing:1px;text-transform:uppercase;}
    .sr-id{flex:1;min-width:0;}
    .sr-name{font-family:var(--font-serif);font-size:34px;font-weight:600;letter-spacing:1px;margin:0 0 6px;}
    .sr-rank{color:var(--gold-soft);font-size:16px;letter-spacing:3px;text-transform:uppercase;margin:0 0 18px;}
    .sr-pills{display:flex;flex-wrap:wrap;gap:8px;}
    .sr-pill{border:1px solid rgba(201,162,39,.55);background:rgba(255,255,255,.06);color:#eef2f7;border-radius:999px;padding:6px 14px;font-size:12.5px;}
    .sr-pill b{color:var(--gold-soft);font-weight:600;margin-right:6px;}
    .sr-hairline{height:3px;background:linear-gradient(90deg,transparent,var(--gold) 15%,var(--gold-soft) 50%,var(--gold) 85%,transparent);}
    .sr-section{padding:30px 48px 8px;}
    .sr-section-title{font-family:var(--font-serif);font-size:18px;letter-spacing:2.5px;text-transform:uppercase;color:var(--navy-deep);margin:0 0 4px;}
    .sr-section-sub{height:2px;width:56px;background:linear-gradient(90deg,var(--gold),var(--gold-soft));border-radius:2px;margin:8px 0 18px;}
    .sr-about-text{font-size:14.5px;line-height:1.75;color:#33404f;margin:0;white-space:pre-line;}
    .sr-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 26px;}
    .sr-info-item{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dotted #dfe3ea;padding:7px 2px;font-size:13.5px;}
    .sr-info-item .k{color:var(--muted);letter-spacing:.4px;text-transform:uppercase;font-size:11.5px;padding-top:2px;}
    .sr-info-item .v{color:var(--ink);font-weight:600;text-align:right;}
    .sr-info-item .v.ph{color:#aab2bf;font-weight:400;font-style:italic;}
    table.sr-table{width:100%;border-collapse:collapse;font-size:13px;border:1px solid #dbe0e8;}
    .sr-table thead th{background:linear-gradient(180deg,var(--navy-2),var(--navy-deep));color:#f3ead0;text-align:left;font-weight:600;letter-spacing:.8px;text-transform:uppercase;font-size:11px;padding:12px 14px;}
    .sr-table tbody td{padding:12px 14px;border-top:1px solid #e7ebf1;vertical-align:top;line-height:1.5;}
    .sr-table tbody tr:nth-child(even){background:#f7f9fc;}
    .sr-table .vessel-name{font-weight:700;color:var(--navy-deep);}
    .sr-table .vessel-type{color:var(--muted);font-size:12px;}
    .sr-table .rank-cell{color:#a3801a;font-weight:600;}
    .sr-empty-row td{text-align:center;color:#aab2bf;font-style:italic;padding:22px;}
    .sr-certs{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;}
    .sr-cert{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #e4e0cf;background:linear-gradient(180deg,#fffdf6,#f8f5ea);border-radius:10px;padding:12px 16px;font-size:13.5px;}
    .sr-cert .cname{font-weight:600;color:var(--navy-deep);}
    .sr-cert .cvalid{color:var(--muted);font-size:12px;white-space:nowrap;}
    .sr-cert .cvalid b{color:#a3801a;}
    .sr-footer{margin-top:34px;padding:0 48px 34px;}
    /* Стальной канат убран по решению владельца проекта (этап F): футер = тонкая золотая линия + текст */
    .sr-footer-rule{height:2px;background:linear-gradient(90deg,transparent,var(--gold) 15%,var(--gold-soft) 50%,var(--gold) 85%,transparent);border:none;border-radius:2px;margin:0 0 16px;}
    .sr-footer-text{text-align:center;margin:0;font-family:var(--font-serif);font-size:13.5px;letter-spacing:1.5px;color:var(--muted);}
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
      .sr-footer{padding:0 20px 22px;}
    }
    @media print{body{background:#fff;}.sr-page{box-shadow:none;max-width:100%;margin:0;}}
  `;
}

function buildResumeHtml(d, forStandalone) {
  const h = d.header || {}, p = d.personal || {};
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
    : `<div class="placeholder-note" style="border:1px dashed #d8d3bb;border-radius:10px;padding:14px;text-align:center;color:#9aa4b2;font-style:italic;">No certificates listed — [ADD CERTIFICATES]</div>`;

  const about = String(d.aboutMe || "").trim();
  const aboutHtml = about
    ? `<p class="sr-about-text">${esc(about)}</p>`
    : `<p class="sr-about-text" style="color:#aab2bf;font-style:italic;">[Tell a few words about yourself — About Me section]</p>`;

  const footerText = String(d.footerText || "").trim() || DEFAULT_FOOTER;

  const body = `
    <div class="sr-page">
      <header class="sr-header">
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
        <table class="sr-table">
          <thead><tr>
            <th>Vessel Name / Type</th><th>Rank</th><th>Period</th><th>Duration</th><th>Duties / Remarks</th>
          </tr></thead>
          <tbody>${vesselsRows}</tbody>
        </table>
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

/* ---------- Live preview (Шаг 6) ---------- */
let updateTimer = null;
function scheduleUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => update(), 150);
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

/* ---------- Автосохранение в localStorage (Шаг 7) ---------- */
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Переполнение хранилища (обычно из-за фото) — сохраняем без фото, не роняя приложение
    try {
      const copy = JSON.parse(JSON.stringify(data));
      copy.header.photoDataUrl = "";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
      setStatus("Storage limit reached: photo was not auto-saved (it still appears in export this session).", "err");
    } catch (e2) { /* молча игнорируем — автосохранение не критично */ }
  }
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
  d.vessels = Array.isArray(obj.vessels) ? obj.vessels.map(v => ({
    vesselName: str(v && v.vesselName), vesselType: str(v && v.vesselType), rank: str(v && v.rank),
    period: str(v && v.period), duration: str(v && v.duration), duties: str(v && v.duties)
  })) : [];
  d.certs = Array.isArray(obj.certs) ? obj.certs.map(c => ({
    name: str(c && c.name), validUntil: str(c && c.validUntil)
  })) : [];
  d.footerText = str(obj.footerText);
  d.schemaVersion = 1;
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
function clearAll() {
  data = emptyData();
  tempPhotoUrl = "";
  fillSimpleFieldsFromModel();
  rerenderLists();
  update();
  saveToStorage();
  setStatus("All data cleared.", "ok");
}
function loadSample() {
  data = sampleData();
  tempPhotoUrl = "";
  fillSimpleFieldsFromModel();
  rerenderLists();
  update();
  saveToStorage();
  setStatus("Sample data loaded (all values are synthetic examples).", "ok");
}

/* ---------- Инициализация ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Восстановление из localStorage
  loadFromStorage();
  fillSimpleFieldsFromModel();
  rerenderLists();
  update();

  // Автосохранение при вводе простых полей
  document.querySelectorAll("[data-key]").forEach(el => {
    el.addEventListener("input", () => { syncSimpleFieldsToModel(); scheduleUpdate(); });
    el.addEventListener("change", () => { syncSimpleFieldsToModel(); scheduleUpdate(); });
  });

  document.getElementById("addVesselBtn").addEventListener("click", () =>
    addItem("vessels", { vesselName: "", vesselType: "", rank: "", period: "", duration: "", duties: "" }));
  document.getElementById("addCertBtn").addEventListener("click", () =>
    addItem("certs", { name: "", validUntil: "" }));

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
    if (confirm("Clear all resume data? This cannot be undone.")) clearAll();
  });
  document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
  document.getElementById("importJsonInput").addEventListener("change", e => {
    importJsonFile(e.target.files && e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("downloadHtmlBtn").addEventListener("click", exportResumeHtml);
  document.getElementById("printPreviewBtn").addEventListener("click", () => {
    const f = document.getElementById("preview");
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch (e) { setStatus("Print is available from the downloaded HTML file instead.", "err"); }
  });
});
