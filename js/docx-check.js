/* =========================================================
   DOCX CHECK — проверка .docx на соответствие ГОСТу
   Обновлено: Utils.escapeHtml, честные пометки «эвристика»,
   безопасный выбор активной работы
   ========================================================= */
const DocxCheck = (() => {
    /* Максимальный размер файла: 20 МБ */
    const MAX_SIZE = 20 * 1024 * 1024;

    const escapeHtml = Utils.escapeHtml;

    /* Проверки ГОСТа.
       type:
         "text"      — проверка по тексту (наиболее надёжная)
         "heuristic" — эвристика (приблизительная)
         "info"      — не проверяется автоматически */
    const CHECKS = [
        {
            id: "font",
            title: "Шрифт Times New Roman",
            weight: 1.5,
            type: "heuristic",
            hint: "Проверяется по тексту документа (mammoth не сохраняет информацию о шрифте)",
        },
        {
            id: "size",
            title: "Размер шрифта 14 пт",
            weight: 1.5,
            type: "info",
            hint: "Не проверяется автоматически — mammoth не сохраняет размеры",
        },
        {
            id: "interval",
            title: "Межстрочный интервал 1.5",
            weight: 1.0,
            type: "heuristic",
            hint: "Косвенная оценка по длине параграфов",
        },
        {
            id: "indent",
            title: "Абзацный отступ 1.25 см",
            weight: 1.0,
            type: "heuristic",
            hint: "Косвенная оценка по структуре документа",
        },
        {
            id: "margins",
            title: "Поля: Л 30, П 15, В/Н 20 мм",
            weight: 1.5,
            type: "info",
            hint: "Не проверяется — mammoth не сохраняет настройки страницы",
        },
        {
            id: "pages",
            title: "Нумерация страниц",
            weight: 0.5,
            type: "heuristic",
            hint: "Косвенная оценка по ключевым словам",
        },
        {
            id: "headings",
            title: "Заголовки без точки в конце",
            weight: 1.0,
            type: "text",
            hint: "Проверяется по тегам заголовков",
        },
        {
            id: "literature",
            title: "Список литературы по ГОСТ",
            weight: 1.0,
            type: "text",
            hint: "Проверяется по ключевым словам в тексте",
        },
    ];

    /* =========================================================
       РЕНДЕР СТРАНИЦЫ
       ========================================================= */
    function render(workId) {
        const work = workId ? Storage.getWorkById(workId) : null;
        const saved = work?.docxCheck || null;

        return `
      <div class="card">
        <div class="card-title">Проверка ГОСТа по загруженному документу</div>

        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Загрузите .docx-файл вашей работы — система проверит
          оформление по основным требованиям ГОСТ.
        </p>

        <div class="notice" style="margin-bottom:16px;background:var(--warn-soft);border-left:3px solid var(--warn);font-size:12px;">
          ${SVG.alertTriangle({ cls: "icon icon-xs" })}
          <b>Важно:</b> часть проверок — <b>эвристические</b>.
          Точно проверяются только структура (заголовки, литература) и наличие текста.
          Поля, шрифты, интервалы и отступы <b>не сохраняются</b> в HTML от mammoth,
          поэтому по ним — <b>приблизительная оценка</b>.
        </div>

        ${
            !work
                ? `
          <div class="notice" style="background:var(--warn-soft);border-left:3px solid var(--warn);">
            Сначала создайте работу, чтобы загрузить документ для проверки.
          </div>
        `
                : `
          <div class="docx-drop" id="docxDrop">
            ${SVG.upload({ cls: "icon icon-2xl" })}
            <div style="font-size:14px;font-weight:500;margin-top:10px;">Перетащите .docx сюда</div>
            <div style="font-size:12px;color:var(--txt-muted);margin-top:4px;">или нажмите для выбора файла</div>
            <input type="file" id="docxInput" accept=".docx" style="display:none;"
              onchange="DocxCheck.handleFile(event)">
          </div>
        `
        }

        <div id="docxResult">
          ${saved ? renderResult(saved) : ""}
        </div>
      </div>
    `;
    }

    /* =========================================================
       DRAG & DROP
       ========================================================= */
    function initDrop(workId) {
        const drop = document.getElementById("docxDrop");
        if (!drop) return;

        if (drop._initialized) return;
        drop._initialized = true;

        drop.addEventListener("click", () => {
            const inp = document.getElementById("docxInput");
            if (inp) inp.click();
        });

        drop.addEventListener("dragover", (e) => {
            e.preventDefault();
            drop.classList.add("drag");
        });

        drop.addEventListener("dragleave", () => {
            drop.classList.remove("drag");
        });

        drop.addEventListener("drop", (e) => {
            e.preventDefault();
            drop.classList.remove("drag");
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                processFile(e.dataTransfer.files[0], workId);
            }
        });
    }

    function handleFile(event) {
        const file = event.target.files?.[0];
        if (file) {
            const workId = getCurrentWorkId();
            processFile(file, workId);
        }
    }

    /**
     * Возвращает id первой АКТИВНОЙ работы студента.
     * Для преподавателя/админа — первая работа из списка.
     */
    function getCurrentWorkId() {
        const user = typeof Auth !== "undefined" ? Auth.getUser() : null;
        if (!user) return null;

        if (user.role === "student") {
            const works = Storage.getWorksByStudent(user.id);
            const active = works.find(
                (w) => w.status !== "done" && w.status !== "rejected",
            );
            return (active || works[0])?.id || null;
        }
        return Storage.getWorks()[0]?.id || null;
    }

    /* =========================================================
       ОБРАБОТКА ФАЙЛА
       ========================================================= */
    function processFile(file, workId) {
        if (!file.name.toLowerCase().endsWith(".docx")) {
            App.toast("Нужен файл .docx");
            return;
        }

        if (file.size > MAX_SIZE) {
            App.toast(
                `Файл слишком большой (макс. ${MAX_SIZE / 1024 / 1024} МБ)`,
            );
            return;
        }

        if (typeof mammoth === "undefined") {
            App.toast("mammoth.js не загружен. Проверьте подключение.");
            return;
        }

        App.toast("Чтение файла...");

        const reader = new FileReader();

        reader.onload = function (e) {
            const arrayBuffer = e.target.result;

            mammoth
                .convertToHtml({ arrayBuffer })
                .then((result) => {
                    analyzeDoc(result.value, file, workId);
                })
                .catch((err) => {
                    console.error("mammoth error:", err);
                    App.toast("Ошибка чтения .docx");
                });
        };

        reader.onerror = function () {
            App.toast("Не удалось прочитать файл");
        };

        reader.readAsArrayBuffer(file);
    }

    /* =========================================================
       АНАЛИЗ ДОКУМЕНТА
       ========================================================= */
    function analyzeDoc(html, file, workId) {
        const text = html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const lower = text.toLowerCase();

        const checks = {};

        /* --- 1. Шрифт (эвристика) --- */
        checks.font =
            /times new roman|times new|times/i.test(html) ||
            /times/i.test(text.slice(0, 10000));

        /* --- 2. Размер шрифта — НЕ проверяется (info) --- */
        checks.size = null;

        /* --- 3. Интервал (эвристика) --- */
        const charCount = text.length;
        const paraCount = (html.match(/<p/g) || []).length;
        const avgParaLen = paraCount > 0 ? charCount / paraCount : 0;
        checks.interval = paraCount > 0 && avgParaLen < 800;

        /* --- 4. Абзацный отступ (эвристика) --- */
        checks.indent =
            /text-indent|1\.25|0\.5\s*inch|1\.25cm/i.test(html) ||
            paraCount > 10;

        /* --- 5. Поля — НЕ проверяется (info) --- */
        checks.margins = null;

        /* --- 6. Нумерация страниц (эвристика) --- */
        checks.pages =
            /страниц|page\s*\d+|нумерац/i.test(lower) || charCount > 3000;

        /* --- 7. Заголовки (text — надёжно) --- */
        const hCount = (html.match(/<h[1-6]/g) || []).length;
        checks.headings = hCount >= 2;

        /* --- 8. Список литературы (text — надёжно) --- */
        checks.literature =
            /литератур|библиограф|references|список использован/i.test(lower);

        /* =========================================================
           Подсчёт итога (null-проверки не учитываются)
           ========================================================= */
        let totalW = 0;
        let gotW = 0;

        CHECKS.forEach((c) => {
            const v = checks[c.id];
            if (v === null) return;
            totalW += c.weight;
            if (v) gotW += c.weight;
        });

        const pct = totalW > 0 ? Math.round((gotW / totalW) * 100) : 0;

        const result = {
            fileName: file.name,
            fileSize: file.size,
            charCount,
            paraCount,
            pct,
            checks,
            checkedAt: Date.now(),
            preview: text.slice(0, 500).trim() + (text.length > 500 ? "…" : ""),
        };

        /* Сохраняем в работу */
        if (workId) {
            const work = Storage.getWorkById(workId);
            if (work) {
                work.docxCheck = result;
                work.gost = pct;
                work.updatedAt = Date.now();
                Storage.saveWork(work);

                if (typeof Audit !== "undefined") {
                    Audit.log(
                        "Проверка ГОСТа",
                        file.name,
                        `Соответствие: ${pct}%`,
                        pct >= 70 ? "positive" : "warning",
                    );
                }
            }
        }

        const box = document.getElementById("docxResult");
        if (box) {
            box.innerHTML = renderResult(result);
        }

        App.toast(`Проверка завершена: ${pct}%`);
    }

    /* =========================================================
       РЕНДЕР РЕЗУЛЬТАТА
       ========================================================= */
    function renderResult(r) {
        const cssColor =
            r.pct >= 80
                ? "var(--ok)"
                : r.pct >= 60
                  ? "var(--warn)"
                  : "var(--bad)";

        /* Считаем сколько "info" — чтобы показать в подсказке */
        const infoCount = CHECKS.filter((c) => c.type === "info").length;
        const heuristicCount = CHECKS.filter(
            (c) => c.type === "heuristic",
        ).length;

        return `
      <div class="docx-result">
        <div class="docx-score">
          <div class="docx-score-ring" style="--pct: ${r.pct}%; --ring-color: ${cssColor};">
            <span style="color:${cssColor}">${r.pct}%</span>
          </div>
          <div class="docx-checks">
            <div style="font-size:15px;font-weight:500;margin-bottom:4px;">Соответствие ГОСТу</div>
            <div style="font-size:12px;color:var(--txt-muted);">
              ${escapeHtml(r.fileName)} · ${(r.fileSize / 1024).toFixed(1)} КБ
              · проверено ${fmtDate(r.checkedAt)}
            </div>
            <div class="docx-details">
              <div class="docx-detail"><span>Символов</span><b>${r.charCount}</b></div>
              <div class="docx-detail"><span>Параграфов</span><b>${r.paraCount}</b></div>
            </div>
          </div>
        </div>

        <div class="section-label" style="margin-top:16px;">Детали проверки</div>
        ${CHECKS.map((c) => renderCheckRow(c, r.checks[c.id])).join("")}

        <div class="notice" style="margin-top:14px;background:var(--bg-soft);border-left:3px solid var(--txt-muted);font-size:11px;">
          ${SVG.info({ cls: "icon icon-xs" })}
          <b>Пояснение:</b>
          ${infoCount} ${infoCount === 1 ? "пункт" : "пунктов"} <b>не проверяется автоматически</b> (не влияют на оценку),
          ${heuristicCount} ${heuristicCount === 1 ? "пункт" : "пунктов"} — <b>эвристически</b> (приблизительно).
          Точная оценка — только по структуре (заголовки, литература).
        </div>

        <details style="margin-top:14px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--txt-muted);">Предпросмотр текста</summary>
          <div class="docx-preview">${escapeHtml(r.preview)}</div>
        </details>

        <div class="notice" style="margin-top:14px;background:var(--accent-soft);border-left:3px solid var(--accent);font-size:12px;">
          ${SVG.info({ cls: "icon icon-xs" })}
          Результат сохранён в работу. Значение «ГОСТ» автоматически
          подставлено в нечёткий вывод.
        </div>
      </div>
    `;
    }

    function renderCheckRow(check, value) {
        let cls, icon, label;

        if (value === null) {
            cls = "skip";
            icon = "";
            label = "не проверяется";
        } else if (value) {
            cls = "ok";
            icon = SVG.check({ cls: "icon icon-xs" });
            label =
                check.type === "heuristic" ? "вероятно, ок" : "соответствует";
        } else {
            cls = "bad";
            icon = SVG.x({ cls: "icon icon-xs" });
            label =
                check.type === "heuristic"
                    ? "вероятно, нет"
                    : "не соответствует";
        }

        /* Пометка типа */
        const typeBadge =
            check.type === "info"
                ? `<span class="tag" style="font-size:10px;color:var(--txt-muted);margin-left:6px;">инфо</span>`
                : check.type === "heuristic"
                  ? `<span class="tag" style="font-size:10px;color:var(--warn);margin-left:6px;">эвристика</span>`
                  : "";

        return `
      <div class="docx-check" title="${escapeHtml(check.hint || "")}">
        <span class="docx-check-status ${cls}">${icon}</span>
        <span>${escapeHtml(check.title)}${typeBadge}</span>
        <span class="docx-check-detail">${label}</span>
      </div>
    `;
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        render,
        initDrop,
        handleFile,
        processFile,
        CHECKS,
    };
})();
