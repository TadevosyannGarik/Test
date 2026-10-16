const DocxCheck = (() => {
    const MAX_SIZE = 20 * 1024 * 1024;
    const HISTORY_KEY = "fp_docx_history";
    const MAX_HISTORY = 30;

    const escapeHtml = Utils.escapeHtml;

    const CHECKS = [
        {
            id: "font",
            title: "Шрифт Times New Roman",
            weight: 1.5,
            type: "heuristic",
            hint: "Проверяется по тексту документа (mammoth не сохраняет информацию о шрифте)",
            fix: "Установите шрифт Times New Roman для всего текста (в Word: Ctrl+A → выбрать шрифт).",
        },
        {
            id: "size",
            title: "Размер шрифта 14 пт",
            weight: 1.5,
            type: "info",
            hint: "Не проверяется автоматически — mammoth не сохраняет размеры",
            fix: "Основной текст — 14 пт, заголовки — крупнее, подписи к рисункам — 12 пт.",
        },
        {
            id: "interval",
            title: "Межстрочный интервал 1.5",
            weight: 1.0,
            type: "heuristic",
            hint: "Косвенная оценка по длине параграфов",
            fix: "Установите межстрочный интервал 1.5 (в Word: Формат → Абзац → Интервал).",
        },
        {
            id: "indent",
            title: "Абзацный отступ 1.25 см",
            weight: 1.0,
            type: "heuristic",
            hint: "Косвенная оценка по структуре документа",
            fix: "Первую строку абзаца — с отступом 1.25 см (Формат → Абзац → Первая строка).",
        },
        {
            id: "margins",
            title: "Поля: Л 30, П 15, В/Н 20 мм",
            weight: 1.5,
            type: "info",
            hint: "Не проверяется — mammoth не сохраняет настройки страницы",
            fix: "Поля: левое 30 мм, правое 15 мм, верхнее и нижнее — 20 мм.",
        },
        {
            id: "pages",
            title: "Нумерация страниц",
            weight: 0.5,
            type: "heuristic",
            hint: "Косвенная оценка по ключевым словам",
            fix: "Вставьте номера страниц внизу по центру (Вставка → Номер страницы).",
        },
        {
            id: "headings",
            title: "Заголовки без точки в конце",
            weight: 1.0,
            type: "text",
            hint: "Проверяется по тегам заголовков",
            fix: "В конце заголовков точку не ставят. Заголовки должны быть с прописной буквы.",
        },
        {
            id: "literature",
            title: "Список литературы по ГОСТ",
            weight: 1.0,
            type: "text",
            hint: "Проверяется по ключевым словам в тексте",
            fix: "Добавьте раздел «Список литературы» и оформите источники по ГОСТ Р 7.0.5–2008.",
        },
    ];

    /* =========================================================
       ИСТОРИЯ ПРОВЕРОК
       ========================================================= */
    function getAllHistory() {
        const list = Storage.get(HISTORY_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function setAllHistory(list) {
        Storage.set(HISTORY_KEY, Array.isArray(list) ? list : []);
    }

    function getHistoryForWork(workId) {
        if (!workId) return [];
        return getAllHistory()
            .filter((h) => Storage.sameId(h.workId, workId))
            .sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0));
    }

    function addToHistory(workId, result) {
        if (!workId || !result) return;
        const list = getAllHistory();
        list.push({
            id: uid(),
            workId,
            fileName: result.fileName,
            fileSize: result.fileSize,
            charCount: result.charCount,
            paraCount: result.paraCount,
            pct: result.pct,
            checks: result.checks,
            checkedAt: result.checkedAt,
        });

        // Ограничиваем историю
        const trimmed = list.slice(-MAX_HISTORY);
        setAllHistory(trimmed);
    }

    function deleteHistoryItem(id) {
        if (!id) return;
        const list = getAllHistory().filter((h) => !Storage.sameId(h.id, id));
        setAllHistory(list);
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function render(workId) {
        const work = workId ? Storage.getWorkById(workId) : null;
        const saved = work?.docxCheck || null;
        const history = getHistoryForWork(workId);

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Проверка ГОСТа
            ${history.length > 0 ? `<span class="count-chip">${history.length}</span>` : ""}
          </div>
        </div>

        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;line-height:1.6;">
          Загрузите .docx-файл — система проверит оформление по основным
          требованиям ГОСТ.
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
            Сначала создайте работу, чтобы загрузить документ.
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
          ${saved ? renderResult(saved, workId) : ""}
        </div>
      </div>

      ${
          history.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.trending({ cls: "icon icon-sm" })}
              Динамика проверок
            </div>
            <button class="btn-ghost btn-sm" onclick="DocxCheck.exportFullReport('${workId}')">
              ${SVG.download({ cls: "icon icon-sm" })}
              <span>Скачать отчёт</span>
            </button>
          </div>
          <div class="chart-box h-260">
            <canvas id="docxHistoryChart"></canvas>
          </div>
        </div>

        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.clock({ cls: "icon icon-sm" })}
              История проверок
            </div>
          </div>
          ${history.map((h) => renderHistoryRow(h)).join("")}
        </div>
      `
              : ""
      }
    `;
    }

    function renderHistoryRow(h) {
        const color =
            h.pct >= 80
                ? "var(--ok)"
                : h.pct >= 60
                  ? "var(--warn)"
                  : "var(--bad)";

        return `
      <div class="docx-history-row" onclick="DocxCheck.openHistoryItem('${h.id}')">
        <div class="docx-history-score" style="color:${color};">
          ${h.pct}%
        </div>
        <div class="docx-history-body">
          <div class="docx-history-file">${escapeHtml(h.fileName)}</div>
          <div class="docx-history-meta">
            ${(h.fileSize / 1024).toFixed(1)} КБ ·
            ${h.charCount} символов ·
            ${h.paraCount} параграфов ·
            ${fmtDateTime(h.checkedAt)}
          </div>
        </div>
        <button class="btn-icon danger"
          onclick="event.stopPropagation(); DocxCheck.deleteHistory('${h.id}', '${h.workId}')"
          title="Удалить из истории">
          ${SVG.trash({ cls: "icon icon-sm" })}
        </button>
      </div>
    `;
    }

    function openHistoryItem(id) {
        const h = getAllHistory().find((x) => Storage.sameId(x.id, id));
        if (!h) return;
        const box = document.getElementById("docxResult");
        if (box) {
            box.innerHTML = renderResult(h, h.workId);
            box.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function deleteHistory(id, workId) {
        if (!confirm("Удалить запись из истории проверок?")) return;
        deleteHistoryItem(id);
        App.navigate("docx");
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

    function analyzeDoc(html, file, workId) {
        const text = html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const lower = text.toLowerCase();

        const checks = {};

        checks.font =
            /times new roman|times new|times/i.test(html) ||
            /times/i.test(text.slice(0, 10000));

        checks.size = null;

        const charCount = text.length;
        const paraCount = (html.match(/<p/g) || []).length;
        const avgParaLen = paraCount > 0 ? charCount / paraCount : 0;
        checks.interval = paraCount > 0 && avgParaLen < 800;

        checks.indent =
            /text-indent|1\.25|0\.5\s*inch|1\.25cm/i.test(html) ||
            paraCount > 10;

        checks.margins = null;

        checks.pages =
            /страниц|page\s*\d+|нумерац/i.test(lower) || charCount > 3000;

        const hCount = (html.match(/<h[1-6]/g) || []).length;
        checks.headings = hCount >= 2;

        checks.literature =
            /литератур|библиограф|references|список использован/i.test(lower);

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

            // Добавляем в историю
            addToHistory(workId, result);
        }

        const box = document.getElementById("docxResult");
        if (box) {
            box.innerHTML = renderResult(result, workId);
        }

        App.toast(`Проверка завершена: ${pct}%`);

        // Перерисовываем страницу чтобы обновить историю и график
        setTimeout(() => {
            App.navigate("docx");
        }, 800);
    }

    /* =========================================================
       РЕЗУЛЬТАТ ПРОВЕРКИ
       ========================================================= */
    function renderResult(r, workId) {
        const cssColor =
            r.pct >= 80
                ? "var(--ok)"
                : r.pct >= 60
                  ? "var(--warn)"
                  : "var(--bad)";

        const infoCount = CHECKS.filter((c) => c.type === "info").length;
        const heuristicCount = CHECKS.filter(
            (c) => c.type === "heuristic",
        ).length;

        // Список "что исправить"
        const problems = CHECKS.filter((c) => r.checks[c.id] === false);

        return `
      <div class="docx-result">
        <div class="docx-score">
          <div class="docx-score-ring" style="--pct: ${r.pct}%; --ring-color: ${cssColor};">
            <span style="color:${cssColor}">${r.pct}%</span>
          </div>
          <div class="docx-checks">
            <div style="font-size:15px;font-weight:500;margin-bottom:4px;">
              Соответствие ГОСТу
            </div>
            <div style="font-size:12px;color:var(--txt-muted);">
              ${escapeHtml(r.fileName)} · ${(r.fileSize / 1024).toFixed(1)} КБ
              · проверено ${fmtDate(r.checkedAt)}
            </div>
            <div class="docx-details">
              <div class="docx-detail"><span>Символов</span><b>${r.charCount}</b></div>
              <div class="docx-detail"><span>Параграфов</span><b>${r.paraCount}</b></div>
            </div>
            ${
                workId
                    ? `
              <div style="margin-top:10px;">
                <button class="btn-ghost btn-sm" onclick="DocxCheck.exportReport('${workId}')">
                  ${SVG.download({ cls: "icon icon-sm" })}
                  <span>Скачать отчёт</span>
                </button>
              </div>
            `
                    : ""
            }
          </div>
        </div>

        <div class="section-label" style="margin-top:16px;">Детали проверки</div>
        ${CHECKS.map((c) => renderCheckRow(c, r.checks[c.id])).join("")}

        ${
            problems.length > 0
                ? `
          <div class="section-label" style="margin-top:20px;">
            Что исправить (${problems.length})
          </div>
          <div class="docx-fixes">
            ${problems
                .map(
                    (c) => `
              <div class="docx-fix">
                <div class="docx-fix-icon">${SVG.alertTriangle({ cls: "icon icon-sm" })}</div>
                <div>
                  <div class="docx-fix-title">${escapeHtml(c.title)}</div>
                  <div class="docx-fix-text">${escapeHtml(c.fix)}</div>
                </div>
              </div>
            `,
                )
                .join("")}
          </div>
        `
                : `
          <div class="notice" style="margin-top:16px;background:var(--ok-soft);border-left:3px solid var(--ok);font-size:13px;">
            ${SVG.checkCircle({ cls: "icon icon-sm" })}
            <b>Все проверяемые пункты соответствуют.</b>
            Осталось проверить невидимые параметры (шрифт, отступы).
          </div>
        `
        }

        <div class="notice" style="margin-top:14px;background:var(--bg-soft);border-left:3px solid var(--txt-muted);font-size:11px;">
          ${SVG.info({ cls: "icon icon-xs" })}
          <b>Пояснение:</b>
          ${infoCount} ${infoCount === 1 ? "пункт" : "пунктов"} <b>не проверяется автоматически</b>,
          ${heuristicCount} ${heuristicCount === 1 ? "пункт" : "пунктов"} — <b>эвристически</b>.
        </div>

        <details style="margin-top:14px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--txt-muted);">Предпросмотр текста</summary>
          <div class="docx-preview">${escapeHtml(r.preview)}</div>
        </details>
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
       ГРАФИК ДИНАМИКИ
       ========================================================= */
    function drawHistoryChart(workId) {
        if (typeof Charts === "undefined" || !Charts.hasChart()) return;

        const history = getHistoryForWork(workId);
        if (history.length === 0) return;

        const canvas = document.getElementById("docxHistoryChart");
        if (!canvas) return;

        // Уничтожаем старый график
        if (canvas._chart) {
            try {
                canvas._chart.destroy();
            } catch (e) {}
            canvas._chart = null;
        }

        // Сортируем по возрастанию даты (старые слева)
        const sorted = [...history].sort(
            (a, b) => (a.checkedAt || 0) - (b.checkedAt || 0),
        );

        const labels = sorted.map((h) => {
            const d = new Date(h.checkedAt);
            return d.toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
            });
        });

        const data = sorted.map((h) => h.pct);

        const C = Charts.COLORS;

        canvas._chart = new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Соответствие ГОСТ, %",
                        data,
                        borderColor: C.accent,
                        backgroundColor: "rgba(99, 102, 241, 0.15)",
                        borderWidth: 2.5,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: data.map((v) =>
                            v >= 80 ? C.ok : v >= 60 ? C.warn : C.bad,
                        ),
                        pointBorderColor: "#fff",
                        pointBorderWidth: 2,
                        tension: 0.3,
                        fill: true,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#fff",
                        titleColor: C.txt,
                        bodyColor: C.txt,
                        borderColor: C.line,
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => {
                                const h = sorted[ctx.dataIndex];
                                return [
                                    `Соответствие: ${h.pct}%`,
                                    `Файл: ${h.fileName}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            color: C.txt,
                            stepSize: 20,
                            callback: (v) => v + "%",
                        },
                        grid: { color: C.line, drawBorder: false },
                    },
                    x: {
                        ticks: { color: C.txt },
                        grid: { color: C.line, drawBorder: false },
                    },
                },
            },
        });
    }

    /* =========================================================
       ЭКСПОРТ ОТЧЁТА (печать PDF)
       ========================================================= */
    function exportReport(workId) {
        const work = Storage.getWorkById(workId);
        if (!work) return;

        const r = work.docxCheck;
        if (!r) {
            App.toast("Нет данных проверки");
            return;
        }

        const html = buildReportHTML(work, r, [r]);
        openPrintWindow(html, `Отчёт ГОСТ — ${work.topic.slice(0, 40)}`);
    }

    function exportFullReport(workId) {
        const work = Storage.getWorkById(workId);
        if (!work) return;

        const history = getHistoryForWork(workId);
        if (history.length === 0) {
            App.toast("Нет истории проверок");
            return;
        }

        const latest = history[0];
        const html = buildReportHTML(work, latest, history);
        openPrintWindow(
            html,
            `Отчёт ГОСТ — ${work.topic.slice(0, 40)} (${history.length} проверок)`,
        );
    }

    function buildReportHTML(work, latest, history) {
        const student = Storage.getUserById(work.studentId);
        const teacher = Storage.getUserById(work.teacherId);

        return `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8">
<title>Отчёт проверки ГОСТа</title>
<style>
    body { font-family: 'Times New Roman', serif; padding: 40px; color: #1a1f29; line-height: 1.5; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin: 20px 0 10px; border-bottom: 2px solid #111; padding-bottom: 6px; }
    .sub { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
    .info-item { padding: 10px; background: #f5f6f8; border-radius: 6px; font-size: 12px; }
    .info-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .score { display: flex; align-items: center; gap: 20px; padding: 20px; background: #f5f6f8; border-radius: 8px; margin: 16px 0; }
    .score-num { font-size: 48px; font-weight: 700; line-height: 1; }
    .score-lbl { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e5ea; }
    th { background: #f5f6f8; font-size: 11px; text-transform: uppercase; color: #6b7280; }
    .ok { color: #16a34a; font-weight: 600; }
    .bad { color: #dc2626; font-weight: 600; }
    .skip { color: #9ca3af; }
    .fix { padding: 10px 14px; background: #fef3c7; border-left: 3px solid #d97706; border-radius: 0 6px 6px 0; margin: 8px 0; font-size: 12px; }
    .fix b { color: #92400e; }
    footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 11px; color: #9aa3b0; }
    @media print { body { padding: 20px; } }
</style>
</head><body>

<h1>Отчёт проверки ГОСТа</h1>
<div class="sub">
    Сформирован ${new Date().toLocaleString("ru-RU")}
    · Meridian
</div>

<h2>Информация о работе</h2>
<div class="info-grid">
    <div class="info-item"><div class="info-lbl">Студент</div>${escapeHtml(student?.fio || "—")}</div>
    <div class="info-item"><div class="info-lbl">Группа</div>${escapeHtml(student?.group || "—")}</div>
    <div class="info-item"><div class="info-lbl">Руководитель</div>${escapeHtml(teacher?.fio || "—")}</div>
    <div class="info-item"><div class="info-lbl">Тип работы</div>${escapeHtml(Utils.workTypeLabel(work.type))}</div>
</div>
<p style="font-size:14px;"><b>Тема:</b> ${escapeHtml(work.topic)}</p>

<h2>Итоговая оценка</h2>
<div class="score">
    <div class="score-num" style="color:${latest.pct >= 80 ? "#16a34a" : latest.pct >= 60 ? "#d97706" : "#dc2626"};">
        ${latest.pct}%
    </div>
    <div>
        <div class="score-lbl">Соответствие ГОСТу</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;">
            Файл: ${escapeHtml(latest.fileName)} (${(latest.fileSize / 1024).toFixed(1)} КБ)
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">
            Проверено: ${new Date(latest.checkedAt).toLocaleString("ru-RU")}
        </div>
    </div>
</div>

<h2>Детали проверки</h2>
<table>
    <thead><tr><th>Пункт</th><th>Результат</th></tr></thead>
    <tbody>
        ${CHECKS.map((c) => {
            const v = latest.checks[c.id];
            let cls = v === null ? "skip" : v ? "ok" : "bad";
            let label =
                v === null
                    ? "не проверяется"
                    : v
                      ? c.type === "heuristic"
                          ? "вероятно, ок"
                          : "соответствует"
                      : c.type === "heuristic"
                        ? "вероятно, нет"
                        : "не соответствует";
            return `<tr>
                <td>${escapeHtml(c.title)}</td>
                <td class="${cls}">${label}</td>
            </tr>`;
        }).join("")}
    </tbody>
</table>

${
    CHECKS.filter((c) => latest.checks[c.id] === false).length > 0
        ? `
    <h2>Что нужно исправить</h2>
    ${CHECKS.filter((c) => latest.checks[c.id] === false)
        .map(
            (c) =>
                `<div class="fix">
                    <b>${escapeHtml(c.title)}</b><br>
                    ${escapeHtml(c.fix)}
                 </div>`,
        )
        .join("")}
`
        : ""
}

${
    history.length > 1
        ? `
    <h2>История проверок (${history.length})</h2>
    <table>
        <thead><tr><th>Дата</th><th>Файл</th><th>Соответствие</th></tr></thead>
        <tbody>
            ${[...history]
                .sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0))
                .map(
                    (h) => `<tr>
                        <td>${new Date(h.checkedAt).toLocaleString("ru-RU")}</td>
                        <td>${escapeHtml(h.fileName)}</td>
                        <td class="${h.pct >= 80 ? "ok" : h.pct >= 60 ? "" : "bad"}"><b>${h.pct}%</b></td>
                    </tr>`,
                )
                .join("")}
        </tbody>
    </table>
`
        : ""
}

<footer>
    Отчёт сгенерирован автоматически системой Meridian.<br>
    Часть проверок выполняется эвристически — точная проверка возможна
    только по исходному .docx с сохранением форматирования.
</footer>

</body></html>`;
    }

    function openPrintWindow(html, title) {
        try {
            const blob = new Blob([html], {
                type: "text/html;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);

            const w = window.open(url, "_blank");
            if (!w) {
                App.toast("Разрешите всплывающие окна для экспорта");
                URL.revokeObjectURL(url);
                return;
            }

            const cleanup = () => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {}
            };

            w.onload = () => {
                setTimeout(() => {
                    try {
                        w.print();
                    } catch (e) {}
                    cleanup();
                }, 300);
            };

            if (typeof Audit !== "undefined") {
                Audit.log("Экспорт отчёта ГОСТ", title || "", "", "info");
            }
        } catch (err) {
            console.error("[DocxCheck] Ошибка:", err);
            App.toast("Не удалось открыть отчёт");
        }
    }

    return {
        render,
        initDrop,
        handleFile,
        processFile,
        drawHistoryChart,
        exportReport,
        exportFullReport,
        openHistoryItem,
        deleteHistory,
        CHECKS,
    };
})();
