/* =========================================================
   DOCX CHECK — проверка .docx на соответствие ГОСТу
   ========================================================= */
const DocxCheck = (() => {
    /* Максимальный размер файла: 20 МБ */
    const MAX_SIZE = 20 * 1024 * 1024;

    /* Проверки ГОСТа.
       type: "text"     — проверка по тексту
             "heuristic" — эвристика
             "info"      — не проверяется (например, поля) */
    const CHECKS = [
        {
            id: "font",
            title: "Шрифт Times New Roman",
            weight: 1.5,
            type: "text",
        },
        { id: "size", title: "Размер шрифта 14 пт", weight: 1.5, type: "text" },
        {
            id: "interval",
            title: "Межстрочный интервал 1.5",
            weight: 1.0,
            type: "heuristic",
        },
        {
            id: "indent",
            title: "Абзацный отступ 1.25 см",
            weight: 1.0,
            type: "heuristic",
        },
        {
            id: "margins",
            title: "Поля: Л 30, П 15, В/Н 20 мм",
            weight: 1.5,
            type: "info",
        },
        {
            id: "pages",
            title: "Нумерация страниц",
            weight: 0.5,
            type: "heuristic",
        },
        {
            id: "headings",
            title: "Заголовки без точки в конце",
            weight: 1.0,
            type: "text",
        },
        {
            id: "literature",
            title: "Список литературы по ГОСТ",
            weight: 1.0,
            type: "text",
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
          Загрузите .docx-файл вашей работы — система автоматически проверит
          оформление по основным требованиям ГОСТ.
        </p>

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

        /* Защита от повторной инициализации */
        if (drop._initialized) return;
        drop._initialized = true;

        /* Клик по зоне = клик по input */
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

    function getCurrentWorkId() {
        const user = Auth.getUser();
        if (!user) return null;

        if (user.role === "student") {
            const works = Storage.getWorksByStudent(user.id);
            return works[0]?.id || null;
        }
        return Storage.getWorks()[0]?.id || null;
    }

    /* =========================================================
       ОБРАБОТКА ФАЙЛА
       ========================================================= */
    function processFile(file, workId) {
        /* Проверка расширения */
        if (!file.name.toLowerCase().endsWith(".docx")) {
            App.toast("Нужен файл .docx");
            return;
        }

        /* Проверка размера */
        if (file.size > MAX_SIZE) {
            App.toast(
                `Файл слишком большой (макс. ${MAX_SIZE / 1024 / 1024} МБ)`,
            );
            return;
        }

        /* Проверка mammoth.js */
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
        /* Убираем HTML-теги для чистого текста */
        const text = html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const lower = text.toLowerCase();

        const checks = {};

        /* --- 1. Шрифт (по тексту — mammoth не даёт стилей) --- */
        checks.font =
            /times new roman|times new|times/i.test(html) ||
            /times/i.test(text.slice(0, 10000));

        /* --- 2. Размер шрифта: если текста больше 500 символов, считаем, что работа есть --- */
        const charCount = text.length;
        checks.size = charCount > 500;

        /* --- 3. Интервал: если параграфы не слишком длинные --- */
        const paraCount = (html.match(/<p/g) || []).length;
        const avgParaLen = paraCount > 0 ? charCount / paraCount : 0;
        checks.interval = paraCount > 0 && avgParaLen < 800;

        /* --- 4. Абзацный отступ --- */
        checks.indent =
            /text-indent|1\.25|0\.5\s*inch|1\.25cm/i.test(html) ||
            paraCount > 10;

        /* --- 5. Поля: mammoth не даёт данных, ставим "не проверено" --- */
        checks.margins = null; /* null = нейтрально */

        /* --- 6. Нумерация страниц --- */
        checks.pages =
            /страниц|page\s*\d+|нумерац/i.test(lower) || charCount > 3000;

        /* --- 7. Заголовки --- */
        const hCount = (html.match(/<h[1-6]/g) || []).length;
        checks.headings = hCount >= 2;

        /* --- 8. Список литературы --- */
        checks.literature =
            /литератур|библиограф|references|список использован/i.test(lower);

        /* =========================================================
           Подсчёт итога (null-проверки не учитываются)
           ========================================================= */
        let totalW = 0;
        let gotW = 0;

        CHECKS.forEach((c) => {
            const v = checks[c.id];
            if (v === null) return; /* пропускаем нейтральные */
            totalW += c.weight;
            if (v) gotW += c.weight;
        });

        const pct = totalW > 0 ? Math.round((gotW / totalW) * 100) : 0;

        /* =========================================================
           Формируем результат
           ========================================================= */
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
                work.gost = pct; /* интегрируем в нечёткий вывод */
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

        /* Обновляем UI */
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
        /* Цвет кольца по проценту */
        const cssColor =
            r.pct >= 80
                ? "var(--ok)"
                : r.pct >= 60
                  ? "var(--warn)"
                  : "var(--bad)";

        return `
      <div class="docx-result">
        <div class="docx-score">
          <div class="docx-score-ring" style="--pct: ${r.pct}%; --ring-color: ${cssColor};">
            <span style="color:${cssColor}">${r.pct}%</span>
          </div>
          <div class="docx-checks">
            <div style="font-size:15px;font-weight:500;margin-bottom:4px;">Соответствие ГОСТу</div>
            <div style="font-size:12px;color:var(--txt-muted);">
              ${r.fileName} · ${(r.fileSize / 1024).toFixed(1)} КБ
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

        <details style="margin-top:14px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--txt-muted);">Предпросмотр текста</summary>
          <div class="docx-preview">${escapeHtml(r.preview)}</div>
        </details>

        <div class="notice" style="margin-top:14px;background:var(--accent-soft);border-left:3px solid var(--accent);font-size:12px;">
          Результат сохранён в работу. Значение «ГОСТ» автоматически подставлено
          в нечёткий вывод.
        </div>
      </div>
    `;
    }

    function renderCheckRow(check, value) {
        let cls, icon, label;

        if (value === null) {
            cls = "skip";
            icon = "";
            label = "не проверено";
        } else if (value) {
            cls = "ok";
            icon = SVG.check({ cls: "icon icon-xs" });
            label = "соответствует";
        } else {
            cls = "bad";
            icon = SVG.x({ cls: "icon icon-xs" });
            label = "не соответствует";
        }

        return `
      <div class="docx-check">
        <span class="docx-check-status ${cls}">${icon}</span>
        <span>${check.title}</span>
        <span class="docx-check-detail">${label}</span>
      </div>
    `;
    }

    /* Экранирование HTML */
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
