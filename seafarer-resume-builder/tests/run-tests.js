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

function makeDom() {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.eval(appJs.replace("\"use strict\";", "") + "\n;window.__app = { update: update };"); // "use strict" убран: eval-область должна быть доступной тестам
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

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("TEST RUNNER CRASH:", e); process.exit(2); });
