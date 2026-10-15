/* =========================================================
   PDF REPORT — экспорт отчёта в PDF (через печать)
   Обновлено: Utils.* вместо дублирующих функций,
   проверка прав при экспорте работы студента
   ========================================================= */
const PdfReport = (() => {
    /* Алиасы на Utils */
    const escapeHtml = Utils.escapeHtml;
    const calcProgress = Utils.calcProgress;
    const workTypeLabel = Utils.workTypeLabel;

    function getUser() {
        return typeof Auth !== "undefined" ? Auth.getUser() : null;
    }

    /* =========================================================
       ВХОДЫ (через Utils)
       ========================================================= */
    function getInputs(work) {
        return Utils.buildFuzzyInputs(work);
    }

    function getFuzzyResult(work) {
        return Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(work));
    }

    /* =========================================================
       ЭКСПОРТ КАФЕДРЫ
       ========================================================= */
    function exportDepartment() {
        const user = getUser();
        if (!user) {
            App.toast("Требуется авторизация");
            return;
        }

        /* Только преподаватель или админ */
        if (user.role !== "teacher" && user.role !== "admin") {
            App.toast(
                "Экспорт отчёта кафедры доступен только преподавателям и администраторам",
            );
            return;
        }

        const works = Storage.getWorks();
        if (works.length === 0) {
            App.toast("Нет работ для отчёта");
            return;
        }

        /* Если преподаватель — только его работы */
        const filtered =
            user.role === "teacher"
                ? works.filter((w) => Storage.sameId(w.teacherId, user.id))
                : works;

        if (filtered.length === 0) {
            App.toast("Нет работ для отчёта");
            return;
        }

        const enriched = filtered
            .map((w) => {
                const student = Storage.getUserById(w.studentId);
                const teacher = Storage.getUserById(w.teacherId);
                const res = getFuzzyResult(w);
                if (!res) return null;
                return {
                    w,
                    student,
                    teacher,
                    res,
                    progress: calcProgress(w.id),
                };
            })
            .filter(Boolean);

        const html = buildReportHTML(enriched);
        openPrintWindow(html, "Отчёт по работам кафедры");
    }

    /* =========================================================
       ЭКСПОРТ СТУДЕНТА
       ========================================================= */
    function exportStudent(workId) {
        const user = getUser();
        if (!user) {
            App.toast("Требуется авторизация");
            return;
        }

        const w = Storage.getWorkById(workId);
        if (!w) {
            App.toast("Работа не найдена");
            return;
        }

        /* Проверка прав: владелец, преподаватель или админ */
        const allowed = Utils.ensureOwnerWork(w, user);
        if (!allowed) {
            App.toast("Нет доступа к этой работе");
            return;
        }

        const student = Storage.getUserById(w.studentId);
        const teacher = Storage.getUserById(w.teacherId);
        const inputs = getInputs(w);
        const res = Utils.safeFuzzyInfer(inputs);
        const progress = calcProgress(w.id);
        const stages = Storage.getStagesByWork(w.id);

        const html = buildStudentReport(
            w,
            student,
            teacher,
            inputs,
            res,
            progress,
            stages,
        );
        openPrintWindow(html, `Отчёт по работе — ${student?.fio || ""}`);
    }

    /* =========================================================
       HTML — ОТЧЁТ КАФЕДРЫ
       ========================================================= */
    function buildReportHTML(enriched) {
        const high = enriched.filter((e) => e.res.risk.term === "high").length;
        const med = enriched.filter((e) => e.res.risk.term === "med").length;
        const low = enriched.filter((e) => e.res.risk.term === "low").length;

        const avgRating = enriched.length
            ? (
                  enriched.reduce((a, e) => a + e.res.rating.value, 0) /
                  enriched.length
              ).toFixed(1)
            : "0";

        const total = enriched.length || 1;
        const pctLow = (low / total) * 100;
        const pctMed = (med / total) * 100;
        const pctHigh = (high / total) * 100;

        return `
      <!DOCTYPE html>
      <html lang="ru"><head>
      <meta charset="UTF-8">
      <title>Отчёт по работам — FuzzyProject</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 40px; color: #1a1f29; line-height: 1.55; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 24px 0 12px; border-bottom: 2px solid #111111; padding-bottom: 6px; }
        .sub { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
        .kpi-row { display: flex; gap: 20px; margin-bottom: 24px; }
        .kpi { flex: 1; padding: 16px; border: 1px solid #e2e5ea; border-radius: 8px; text-align: center; }
        .kpi-val { font-size: 28px; font-weight: 700; }
        .kpi-lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
        th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e5ea; }
        th { background: #f5f6f8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
        .risk-high { color: #dc2626; font-weight: 700; }
        .risk-med  { color: #d97706; font-weight: 600; }
        .risk-low  { color: #16a34a; font-weight: 600; }
        .chart-row { display: flex; gap: 24px; margin: 20px 0; align-items: center; }
        .legend { font-size: 13px; }
        .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
        footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 11px; color: #9aa3b0; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>

      <h1>Отчёт по работам кафедры</h1>
      <div class="sub">Сформирован ${new Date().toLocaleString("ru-RU")} · FuzzyProject</div>

      <div class="kpi-row">
        <div class="kpi"><div class="kpi-val">${enriched.length}</div><div class="kpi-lbl">Работ</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#dc2626">${high}</div><div class="kpi-lbl">Высокий риск</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#d97706">${med}</div><div class="kpi-lbl">Средний риск</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#16a34a">${low}</div><div class="kpi-lbl">Низкий риск</div></div>
      </div>

      <h2>Распределение рисков</h2>
      <div class="chart-row">
        <svg width="180" height="180" viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#16a34a" stroke-width="6"
            stroke-dasharray="${pctLow.toFixed(2)} ${(100 - pctLow).toFixed(2)}" stroke-dashoffset="0" />
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#d97706" stroke-width="6"
            stroke-dasharray="${pctMed.toFixed(2)} ${(100 - pctMed).toFixed(2)}" stroke-dashoffset="${(-pctLow).toFixed(2)}" />
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#dc2626" stroke-width="6"
            stroke-dasharray="${pctHigh.toFixed(2)} ${(100 - pctHigh).toFixed(2)}" stroke-dashoffset="${(-pctLow - pctMed).toFixed(2)}" />
          <text x="21" y="21" text-anchor="middle" dominant-baseline="middle" font-size="5" font-weight="700">${total}</text>
        </svg>
        <div class="legend">
          <div class="legend-item"><div class="legend-dot" style="background:#16a34a"></div> Низкий: ${low} (${pctLow.toFixed(0)}%)</div>
          <div class="legend-item"><div class="legend-dot" style="background:#d97706"></div> Средний: ${med} (${pctMed.toFixed(0)}%)</div>
          <div class="legend-item"><div class="legend-dot" style="background:#dc2626"></div> Высокий: ${high} (${pctHigh.toFixed(0)}%)</div>
        </div>
      </div>

      <h2>Детализация по работам</h2>
      <table>
        <thead>
          <tr>
            <th>Студент</th>
            <th>Тема</th>
            <th>Руководитель</th>
            <th>Прогресс</th>
            <th>Риск</th>
            <th>Готовность</th>
          </tr>
        </thead>
        <tbody>
          ${enriched
              .map((e) => {
                  const riskCls =
                      e.res.risk.term === "high"
                          ? "risk-high"
                          : e.res.risk.term === "med"
                            ? "risk-med"
                            : "risk-low";
                  return `<tr>
              <td>${escapeHtml(e.student?.fio || "—")}</td>
              <td>${escapeHtml((e.w.topic || "").slice(0, 60))}</td>
              <td>${escapeHtml(e.teacher?.fio || "—")}</td>
              <td>${e.progress}%</td>
              <td class="${riskCls}">${e.res.risk.value.toFixed(0)}</td>
              <td>${e.res.ready.value.toFixed(0)}</td>
            </tr>`;
              })
              .join("")}
        </tbody>
      </table>

      <h2>Выводы</h2>
      <p style="font-size:13px;line-height:1.7;">
        Средний рейтинг по работам: <b>${avgRating}</b>. В зоне высокого риска находятся
        <b>${high}</b> работ из <b>${enriched.length}</b>. Рекомендуется обратить
        внимание на студентов с высоким риском и назначить дополнительные консультации.
      </p>

      <footer>
        Отчёт сгенерирован автоматически системой FuzzyProject
        на основе нечёткого логического вывода Мамдани.
      </footer>

      </body></html>
    `;
    }

    /* =========================================================
       HTML — ОТЧЁТ СТУДЕНТА
       ========================================================= */
    function buildStudentReport(
        w,
        student,
        teacher,
        inputs,
        res,
        progress,
        stages,
    ) {
        const riskTerm =
            res.risk.term === "high"
                ? "высокий"
                : res.risk.term === "med"
                  ? "средний"
                  : "низкий";
        const readyTerm =
            res.ready.term === "high"
                ? "высокая"
                : res.ready.term === "med"
                  ? "средняя"
                  : "низкая";

        const gradeBlock = w.finalGrade
            ? `
          <h2>Оценка за защиту</h2>
          <p style="font-size:15px;">
            <b>${w.finalGrade}</b> —
            ${
                w.finalGrade === 5
                    ? "отлично"
                    : w.finalGrade === 4
                      ? "хорошо"
                      : w.finalGrade === 3
                        ? "удовлетворительно"
                        : "неудовлетворительно"
            }
          </p>
          ${w.gradeComment ? `<p style="font-size:13px;color:#374151;">«${escapeHtml(w.gradeComment)}»</p>` : ""}
          ${w.defendedAt ? `<p style="font-size:12px;color:#6b7280;">Дата защиты: ${new Date(w.defendedAt).toLocaleDateString("ru-RU")}</p>` : ""}
        `
            : "";

        return `
      <!DOCTYPE html>
      <html lang="ru"><head>
      <meta charset="UTF-8">
      <title>Отчёт по работе — ${escapeHtml(student?.fio || "")}</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 40px; color: #1a1f29; line-height: 1.6; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 20px 0 10px; border-bottom: 2px solid #111111; padding-bottom: 6px; }
        .sub { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .info-block { padding: 12px; background: #f5f6f8; border-radius: 6px; font-size: 13px; }
        .info-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .metric-row { display: flex; gap: 12px; margin: 16px 0; }
        .metric { flex: 1; padding: 14px; border: 1px solid #e2e5ea; border-radius: 8px; text-align: center; }
        .metric-val { font-size: 26px; font-weight: 700; }
        .metric-lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top: 4px; }
        .stage-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e5ea; font-size: 13px; }
        footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 11px; color: #9aa3b0; }
      </style>
      </head><body>

      <h1>Отчёт по курсовой / дипломной работе</h1>
      <div class="sub">Сформирован ${new Date().toLocaleString("ru-RU")}</div>

      <div class="grid">
        <div class="info-block"><div class="info-lbl">Студент</div>${escapeHtml(student?.fio || "—")}</div>
        <div class="info-block"><div class="info-lbl">Группа</div>${escapeHtml(student?.group || "—")}</div>
        <div class="info-block"><div class="info-lbl">Руководитель</div>${escapeHtml(teacher?.fio || "—")}</div>
        <div class="info-block"><div class="info-lbl">Тип работы</div>${escapeHtml(workTypeLabel(w.type))}</div>
      </div>

      <h2>Тема</h2>
      <p style="font-size:14px;"><b>${escapeHtml(w.topic || "")}</b></p>

      ${w.annotation ? `<p style="font-size:13px;color:#374151;">${escapeHtml(w.annotation)}</p>` : ""}

      <h2>Нечёткая оценка (Мамдани)</h2>
      <div class="metric-row">
        <div class="metric">
          <div class="metric-val" style="color:${res.risk.term === "high" ? "#dc2626" : res.risk.term === "med" ? "#d97706" : "#16a34a"}">
            ${res.risk.value.toFixed(0)}
          </div>
          <div class="metric-lbl">Риск (${riskTerm})</div>
        </div>
        <div class="metric">
          <div class="metric-val">${res.ready.value.toFixed(0)}</div>
          <div class="metric-lbl">Готовность (${readyTerm})</div>
        </div>
        <div class="metric">
          <div class="metric-val" style="color:#111111">${res.rating.value.toFixed(0)}</div>
          <div class="metric-lbl">Рейтинг</div>
        </div>
      </div>

      <h2>Прогресс по этапам</h2>
      <p style="font-size:13px;">Общий прогресс: <b>${progress}%</b></p>
      ${
          stages.length === 0
              ? '<p style="font-size:13px;color:#6b7280;">Этапы не добавлены</p>'
              : stages
                    .map(
                        (s) => `
            <div class="stage-row">
              <span>${s.done ? "✓" : "○"} ${escapeHtml(s.name)}</span>
              <span style="color:#6b7280;">вес ${s.weight || 1}</span>
            </div>
          `,
                    )
                    .join("")
      }

      ${gradeBlock}

      <h2>Рекомендация</h2>
      <p style="font-size:13px;">${escapeHtml(Fuzzy.recommendation(inputs, res))}</p>

      <footer>
        Отчёт сгенерирован автоматически системой FuzzyProject
        на основе нечёткого логического вывода Мамдани.
      </footer>

      </body></html>
    `;
    }

    /* =========================================================
       ОКНО ПЕЧАТИ
       ========================================================= */
    function openPrintWindow(html, title) {
        try {
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
                Audit.log("Экспорт PDF", title || "", "", "info");
            }
        } catch (err) {
            console.error("[PdfReport] Ошибка:", err);
            fallbackPrint(html, title);
        }
    }

    function fallbackPrint(html, title) {
        const w = window.open("", "_blank");
        if (!w) {
            App.toast("Разрешите всплывающие окна для экспорта");
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();

        setTimeout(() => {
            try {
                w.print();
            } catch (e) {}
        }, 500);

        if (typeof Audit !== "undefined") {
            Audit.log("Экспорт PDF", title || "", "", "info");
        }
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        exportDepartment,
        exportStudent,
    };
})();
