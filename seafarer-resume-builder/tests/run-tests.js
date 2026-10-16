/* Регрессионные тесты конструктора (jsdom). Запуск: node tests/run-tests.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  PASS:", msg); }
  else { fail++; console.log("  FAIL:", msg); }
}

// Синхронный вызов update() из области eval (function-декларации в eval не попадают в window)
function forceUpdate(w) { w.eval("update();"); }
// Принудительная синхронная запись в localStorage (тесты не ждут дебаунс 400 мс)
function flushStorage(w) { w.__app.flush(); }

async function waitFor(pred, ms = 3000) {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) return false;
    await new Promise(r => setTimeout(r, 25));
  }
  return true;
}

function makeDom() {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.eval(appJs.replace("\"use strict\";", "") + "\n;window.__app = { update: update, flush: () => { clearTimeout(saveToStorage._t); saveToStorage._t = null; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, setDataVesselNames: (a, b) => { data.vessels[0].vesselName = a; if (data.vessels[1]) data.vessels[1].vesselName = b; }, computeProgress: () => computeProgress(), setSimple: (path, val) => { setByPath(data, path, val); updateProgress(); }, setVesselName: (i, v) => { data.vessels[i].vesselName = v; rerenderLists(); }, vesselKeysCount: () => VESSEL_KEYS.length };"); // "use strict" убран: eval-область должна быть доступной тестам
  w.document.dispatchEvent(new w.Event("DOMContentLoaded", { bubbles: true }));
  return { dom, w, d: w.document };
}

function importFile(w, d, inputId, file) {
  // FileReader в jsdom асинхронный — дожидаемся статуса
  const input = d.getElementById(inputId);
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  return new Promise(res => {
    const st = d.getElementById("statusLine");
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (/imported|failed/i.test(st.textContent) || Date.now() - t0 > 3000) { clearInterval(iv); res(); }
    }, 30);
  });
}

(async () => {
  console.log("== Тест 1. Пустые данные не ломают UI ==");
  {
    const { d } = makeDom();
    const frame = d.getElementById("preview");
    ok(!!frame.srcdoc && frame.srcdoc.includes("[FULL NAME]"), "placeholder [FULL NAME] в превью");
    ok(frame.srcdoc.includes("[NO ENTRIES YET]"), "пустая таблица судов показывает placeholder");
    ok(frame.srcdoc.includes("[ADD CERTIFICATES]"), "пустые сертификаты показывают placeholder");
    ok(d.querySelectorAll(".theme-row").length === 12, "отрендерены 12 строк выбора цвета блоков");
  }

  console.log("== Тест 2. Тема по умолчанию = Navy Gold, resumeCss подставляет переменные ==");
  {
    const { d } = makeDom();
    const srcdoc = d.getElementById("preview").srcdoc;
    ok(srcdoc.includes("--sr-header-bg:#0B1F3A"), "дефолтный фон шапки #0B1F3A");
    ok(srcdoc.includes("--sr-accent:#C9A227"), "дефолтный акцент #C9A227");
    ok(!/conic-gradient/.test(srcdoc), "нет conic-gradient (совместимость)");
    ok(!/sr-rope|repeating-linear-gradient\(115deg/.test(srcdoc), "канат отсутствует в резюме");
  }

  console.log("== Тест 3. Выбор цвета блока меняет превью и сохраняется ==");
  {
    const { w, d } = makeDom();
    const inp = d.getElementById("themeColor-headerBg");
    ok(!!inp && inp.value.toLowerCase() === "#0b1f3a", "color-инпут headerBg инициализирован");
    inp.value = "#204060";
    inp.dispatchEvent(new w.Event("input", { bubbles: true }));
    forceUpdate(w);
    ok(d.getElementById("preview").srcdoc.includes("--sr-header-bg:#204060"), "цвет блока применён в превью");
    flushStorage(w);   // автосейв дебаунсится 400 мс — в тесте записываем синхронно
    const saved = JSON.parse(w.localStorage.getItem("seafarer_resume_v1"));
    ok(saved.theme && saved.theme.headerBg === "#204060", "цвет сохранён в localStorage");
  }

  console.log("== Тест 4. Пресеты палитр ==");
  {
    const { w, d } = makeDom();
    d.querySelector('[data-preset="black-champagne"]').click();
    ok(d.getElementById("preview").srcdoc.includes("--sr-header-bg:#16110D"), "Black Champagne применена");
    d.querySelector('[data-preset="ocean-platinum"]').click();
    ok(d.getElementById("preview").srcdoc.includes("--sr-header-bg:#1E2B3A"), "Ocean Platinum применена");
    d.getElementById("themeResetBtn").click();
    ok(d.getElementById("preview").srcdoc.includes("--sr-header-bg:#0B1F3A"), "Reset возвращает Navy Gold");
    const inp = d.getElementById("themeColor-accent");
    ok(inp.value.toLowerCase() === "#c9a227", "color-инпут синхронизирован после Reset");
  }

  console.log("== Тест 5. Sample data + экспорт standalone HTML ==");
  {
    const { w, d } = makeDom();
    d.getElementById("sampleBtn").click();
    let downloaded = null;
    w.URL.createObjectURL = (blob) => { blob.text().then(t => { downloaded = t; }); return "blob:x"; };
    w.URL.revokeObjectURL = () => {};
    d.getElementById("downloadHtmlBtn").click();
    await new Promise(r => setTimeout(r, 300));
    ok(!!downloaded, "standalone HTML скачан (симуляция Blob)");
    ok(/--sr-header-bg:#0B1F3A/.test(downloaded), "экспорт содержит тему");
    ok(downloaded.includes("John A. Sample") && downloaded.includes("Second Engineer"), "sample-данные в экспорте");
    ok(downloaded.includes("References and original documents available upon request."), "дефолтный футер");
    ok(!/<link\b/i.test(downloaded) && !/src="http/i.test(downloaded), "нет внешних зависимостей в экспорте");
  }

  console.log("== Тест 6. Импорт JSON с битой темой не роняет приложение ==");
  {
    const { w, d } = makeDom();
    const bad = JSON.stringify({ header: { fullName: "Test Import" }, theme: { headerBg: "red;evil", accent: "#123abc" } });
    const file = new w.File([bad], "x.json", { type: "application/json" });
    await importFile(w, d, "importJsonInput", file);
    ok(d.getElementById("fullName").value === "Test Import", "импорт применил имя");
    const src2 = d.getElementById("preview").srcdoc;
    ok(src2.includes("--sr-header-bg:#0B1F3A"), "битый цвет заменён дефолтом");
    ok(src2.includes("--sr-accent:#123ABC"), "валидный hex принят");
    ok(d.getElementById("themeColor-accent").value === "#123abc", "color-инпут обновлён из импорта");
  }

  console.log("== Тест 7. XSS-экранирование пользовательского ввода ==");
  {
    const { w, d } = makeDom();
    const evil = '<img src=x onerror=alert(1)>';
    d.getElementById("fullName").value = evil;
    d.getElementById("fullName").dispatchEvent(new w.Event("input", { bubbles: true }));
    forceUpdate(w);
    const src3 = d.getElementById("preview").srcdoc;
    ok(src3.includes("&lt;img"), "вредоносный ввод экранирован");
    ok(!/<h1 class="sr-name"><img/.test(src3), "inline-HTML не попадает в разметку");
  }

  console.log("== Тест 8. Контраст-защита: низкоконтрастные цвета заменяются ==");
  {
    const { w, d } = makeDom();
    d.getElementById("themeColor-headerBg").value = "#FAFAFA";
    d.getElementById("themeColor-headerBg").dispatchEvent(new w.Event("input", { bubbles: true }));
    d.getElementById("themeColor-headerText").value = "#F5F5F5"; // почти белый на почти белом
    d.getElementById("themeColor-headerText").dispatchEvent(new w.Event("input", { bubbles: true }));
    forceUpdate(w);
    const src4 = d.getElementById("preview").srcdoc;
    ok(/class="sr-header" style="color:#FFFFFF;"/.test(src4), "низкоконтрастный цвет шапки заменён безопасным");
    ok(src4.includes("--sr-header-bg:#FAFAFA"), "выбранный фон при этом сохранён");
  }

  console.log("== Тест 9. Add/move/remove судов и сертификатов (регрессия) ==");
  {
    const { d } = makeDom();
    d.getElementById("addVesselBtn").click();
    d.getElementById("addVesselBtn").click();
    ok(d.querySelectorAll("#vesselsList .item-card").length === 2, "добавлено 2 судна");
    d.getElementById("addCertBtn").click();
    ok(d.querySelectorAll("#certsList .item-card").length === 1, "добавлен сертификат");
    d.querySelectorAll("#vesselsList .icon-btn")[1].click(); // ↓ первой карточки
    ok(d.querySelectorAll("#vesselsList .item-card").length === 2, "после перемещения записей 2");
    d.querySelector("#vesselsList .icon-btn.danger").click();
    ok(d.querySelectorAll("#vesselsList .item-card").length === 1, "удаление работает");
  }

  console.log("== Тест 10. UX-H: Undo удаления возвращает запись на место ==");
  {
    const { w, d } = makeDom();
    d.getElementById("addVesselBtn").click();
    d.getElementById("addVesselBtn").click();
    const inputs = d.querySelectorAll("#vesselsList input[type=text]");
    // 5 текстовых полей на карточку: [0..4] — судно 1, [5..9] — судно 2
    inputs[0].value = "MV First";
    inputs[5].value = "MV Second";
    w.__app.setDataVesselNames("MV First", "MV Second"); // значения в модели (input-события не шлем, чтобы не перерисовать DOM)
    d.querySelector("#vesselsList .icon-btn.danger").click(); // удалить первую запись
    ok(d.querySelectorAll("#vesselsList .item-card").length === 1, "запись удалена");
    const undoBtn = d.querySelector("#undoSlot .undo-btn") || d.querySelector("#statusLine .undo-btn");
    ok(!!undoBtn, "в статус-баре появилась кнопка Undo");
    undoBtn.click();
    ok(d.querySelectorAll("#vesselsList .item-card").length === 2, "Undo вернул количество записей");
    const after = d.querySelectorAll("#vesselsList input[type=text]");
    ok(after[0].value === "MV First" && after[5].value === "MV Second", "порядок и содержимое восстановлены");
  }

  console.log("== Тест 11. UX-H: Duplicate создаёт копию сразу после оригинала ==");
  {
    const { w, d } = makeDom();
    d.getElementById("addVesselBtn").click();
    const inp = d.querySelector("#vesselsList input[type=text]");
    inp.value = "MV Dup";
    inp.dispatchEvent(new w.Event("input", { bubbles: true }));
    const dupBtn = d.querySelectorAll("#vesselsList .icon-btn")[2]; // ⧉ в карточке
    ok(!!dupBtn, "кнопка дублирования есть в карточке судна");
    dupBtn.click();
    const cards = d.querySelectorAll("#vesselsList .item-card");
    ok(cards.length === 2, "создана копия");
    ok(cards[1].querySelector("input[type=text]").value === "MV Dup", "копия содержит те же данные");
    // Кнопка «Duplicate last» под списком активна при непустом списке
    ok(!d.getElementById("dupVesselBtn").disabled, "Duplicate last активна");
    d.getElementById("dupVesselBtn").click();
    ok(d.querySelectorAll("#vesselsList .item-card").length === 3, "дублирование сработало и снизу списка");
  }

  console.log("== Тест 12. UX-H: Ctrl+S скачивает standalone HTML ==");
  {
    const { w, d } = makeDom();
    d.getElementById("sampleBtn").click();
    let downloaded = null;
    w.URL.createObjectURL = (blob) => { blob.text().then(t => { downloaded = t; }); return "blob:y"; };
    w.URL.revokeObjectURL = () => {};
    const ev = new w.KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    d.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 300));
    ok(ev.defaultPrevented, "стандартное поведение Ctrl+S перехвачено");
    ok(!!downloaded && /<!DOCTYPE html>/i.test(downloaded), "Ctrl+S сформировал HTML-файл");
  }

  console.log("== Тест 13. UX-H: модалка помощи открывается/закрывается (Esc) ==");
  {
    const { w, d } = makeDom();
    const m = d.getElementById("helpModal");
    ok(m.hidden, "модалка скрыта по умолчанию");
    d.getElementById("helpBtn").click();
    ok(!m.hidden, "открылась по кнопке Shortcuts");
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ok(m.hidden, "закрылась по Esc");
    d.getElementById("helpBtn").click();
    d.getElementById("helpCloseBtn").click();
    ok(m.hidden, "закрылась по кнопке ✕");
  }

  console.log("== Тест 14. UX-H: save-индикатор появляется после автосохранения ==");
  {
    const { w, d } = makeDom();
    d.getElementById("fullName").value = "Pill Test";
    d.getElementById("fullName").dispatchEvent(new w.Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));   // дебаунс localStorage 400 мс
    ok(d.getElementById("savePill").classList.contains("show"), "показан индикатор Saved ✓");
    ok(JSON.parse(w.localStorage.getItem("seafarer_resume_v1")).header.fullName === "Pill Test", "данные записаны (дебаунс)");
  }

  console.log("== Тест 15. UX-H: Clear на пустой форме не показывает confirm ==");
  {
    const { w, d } = makeDom();
    let asked = false;
    w.confirm = () => { asked = true; return true; };
    d.getElementById("clearBtn").click();
    ok(!asked, "confirm не вызван — чистить нечего");
    ok(d.getElementById("statusLine").textContent.includes("nothing to clear"), "понятное сообщение");
    d.getElementById("addVesselBtn").click();
    d.getElementById("addVesselBtn").click();
    d.querySelector("#vesselsList .icon-btn.danger").click(); // удалить единственную? нет: 2 записи → останется 1
    w.confirm = () => { asked = true; return false; };        // пользователь отменил очистку
    d.getElementById("clearBtn").click();
    ok(asked, "при наличии данных confirm показан");
    ok(d.querySelectorAll("#vesselsList .item-card").length === 1, "отмена очистки сохранила данные");
  }

  console.log("== Тест 16. UX-P: прогресс-бар заполнения ==");
  {
    const { w, d } = makeDom();
    // Панель вставлена в статус-строку при init
    ok(!!d.getElementById("progressWrap"), "прогресс-бар присутствует в статус-строке");
    ok(d.getElementById("progressLabel").textContent.includes("Completion: 0%"), "пустая форма → 0%");
    ok(d.getElementById("progressFill").style.width === "0%", "полоса на нуле");

    const p0 = w.__app.computeProgress();
    ok(p0.total >= 16 && p0.filled === 0, "счётчик: пустая форма — 0 заполненных из базовых полей");

    // Заполняем часть простых полей через модель + обновление прогресса
    w.__app.setSimple("header.fullName", "Test");
    w.__app.setSimple("header.rank", "Chief Officer");
    const label = d.getElementById("progressLabel").textContent;
    ok(/Completion: \d+%/ .test(label) || /Completion: \d+%/.test(label), "после ввода процент вырос и виден в подписи: " + label);
    const p1 = w.__app.computeProgress();
    ok(p1.filled === 2 && p1.pct > 0, "заполнено ровно 2 поля (fullName, rank)");

    /* Поведение (этап UX-P): полностью пустые карточки НЕ учитываются вообще
       (ни filled, ни total), чтобы «Add vessel» без данных не обнулял процент. */
    d.getElementById("addVesselBtn").click();
    const p2 = w.__app.computeProgress();
    ok(p2.filled === p1.filled && p2.total === p1.total, "пустая карточка судна игнорируется (total не растёт)");
    // Заполняем vesselName напрямую в модели + перерисовка (input-событие перерисовало бы DOM)
    w.__app.setVesselName(0, "MV Test");
    const p3 = w.__app.computeProgress();
    ok(p3.filled === p1.filled + 1 && p3.total === p1.total + w.__app.vesselKeysCount(),
      "заполненная карточка добавляет свои ключи в счётчик (+1 filled)");

    // Sample data → высокий процент и полоса шире
    d.getElementById("sampleBtn").click();
    const ps = w.__app.computeProgress();
    ok(ps.pct >= 90, "sample data даёт >= 90% (получено " + ps.pct + "%)");
    ok(parseFloat(d.getElementById("progressFill").style.width) === ps.pct, "ширина полосы соответствует проценту");
  }

  console.log("== Тест 17. UX-P: Undo живёт внутри панели и не ломает статус-текст ==");
  {
    const { w, d } = makeDom();
    d.getElementById("addVesselBtn").click();
    d.getElementById("addVesselBtn").click();
    d.querySelector("#vesselsList .icon-btn.danger").click(); // удалить первую запись
    const undoBtn = d.querySelector("#undoSlot .undo-btn");
    ok(!!undoBtn, "кнопка Undo появилась в слоте панели прогресса");
    ok(d.querySelector(".status-text").textContent.includes("Entry removed"), "статус-текст отделён от панели");
    undoBtn.click();
    ok(d.querySelectorAll("#vesselsList .item-card").length === 2, "Undo вернул запись");
    ok(!d.querySelector("#undoSlot .undo-btn"), "после Undo кнопка скрыта");
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("TEST RUNNER CRASH:", e); process.exit(2); });
