const MamdaniViz = (() => {
    let selectedWorkId = null;
    let currentStep = "all";

    const escapeHtml = Utils.escapeHtml;
    const emptyState = Utils.emptyState;

    const VAR_NAMES = {
        progress: "Прогресс",
        days: "Дней до дедлайна",
        activity: "Активность",
        edits: "Правок",
        volume: "Объём",
        orig: "Оригинальность",
        supScore: "Оценка руководителя",
        gost: "Соответствие ГОСТу",
    };

    const TERM_LABELS = {
        low: "низкий",
        med: "средний",
        high: "высокий",
    };

    const FACTOR_MEANING = {
        progress: {
            low: "работа идёт медленно",
            med: "работа в нормальном темпе",
            high: "работа идёт отлично",
        },
        days: {
            low: "сроки поджимают",
            med: "времени достаточно",
            high: "времени много",
        },
        activity: {
            low: "студент малоактивен",
            med: "студент работает регулярно",
            high: "студент работает активно",
        },
        edits: {
            low: "правок почти нет",
            med: "правок немного",
            high: "правок много",
        },
    };

    const TERM_EXPLAIN = {
        progress: {
            low: "Работа выполнена меньше чем на 25%",
            med: "Работа выполнена примерно наполовину",
            high: "Работа почти завершена",
        },
        days: {
            low: "До дедлайна осталось меньше 10 дней",
            med: "До дедлайна примерно 25 дней",
            high: "До дедлайна больше 40 дней",
        },
        activity: {
            low: "Очень мало действий за последнее время",
            med: "Средняя частота действий",
            high: "Много действий, студент активен",
        },
        edits: {
            low: "Мало правок — текст почти не менялся",
            med: "Среднее количество правок",
            high: "Много правок — требуется доработка",
        },
        volume: {
            low: "Маленький объём текста",
            med: "Средний объём",
            high: "Большой объём текста",
        },
        orig: {
            low: "Низкая уникальность текста",
            med: "Средняя оригинальность",
            high: "Высокая уникальность",
        },
        supScore: {
            low: "Руководитель оценил работу низко",
            med: "Руководитель оценил средне",
            high: "Руководитель доволен работой",
        },
        gost: {
            low: "Оформление не соответствует ГОСТу",
            med: "Частично соответствует",
            high: "Полностью соответствует ГОСТу",
        },
    };

    const RECOMMENDATION = {
        risk: {
            low: "Работа идёт по плану — вмешательство не требуется.",
            med: "Есть небольшие отставания — стоит ускориться на этой неделе.",
            high: "Высокий риск срыва — срочно нужны действия!",
        },
    };

    const DISPLAY_DEFAULTS = {
        orig: 65,
        supScore: 5,
        gost: 70,
    };

    function safeMF(varName, term, value) {
        const mf = Fuzzy.MF[varName];
        if (!mf || typeof mf[term] !== "function") return 0;
        if (value === null || value === undefined) return 0;
        return mf[term](value);
    }

    function getAvailableWorks(user) {
        if (!user) return [];
        if (user.role === "student") return Storage.getWorksByStudent(user.id);
        if (user.role === "teacher") return Storage.getWorksByTeacher(user.id);
        return Storage.getWorks();
    }

    /* =========================================================
       УМНЫЙ ВЫБОР РАБОТЫ ПО УМОЛЧАНИЮ

       Приоритеты:
       1. Активные работы (active / review) с максимальным прогрессом
       2. Approved / done
       3. Остальные (по updatedAt)
       ========================================================= */
    function pickDefaultWork(works) {
        if (!works || works.length === 0) return null;

        function score(w) {
            const statusOrder = {
                active: 0,
                review: 1,
                approved: 2,
                draft: 3,
                pending: 4,
                done: 5,
                rejected: 6,
            };
            const statusScore = statusOrder[w.status] ?? 99;
            const progress = Utils.calcProgress(w.id);
            // Хотим: меньше statusScore (приоритет статусу) и больше progress
            return statusScore * 1000 - progress;
        }

        const sorted = [...works].sort((a, b) => score(a) - score(b));
        return sorted[0];
    }

    /* =========================================================
       ВХОДЫ ДЛЯ РАСЧЁТА
       ========================================================= */
    function buildInputs(work) {
        if (!work) return null;
        const inputs = Utils.buildFuzzyInputs(work);
        if (!inputs) return null;

        return {
            progress: inputs.progress ?? 0,
            days: inputs.days ?? 30,
            activity: inputs.activity ?? 5,
            edits: inputs.edits ?? 0,
            volume: inputs.volume ?? 0,
            orig: inputs.orig,
            supScore: inputs.supScore,
            gost: inputs.gost,
        };
    }

    function buildInputsForDisplay(work) {
        const base = buildInputs(work);
        if (!base) return null;

        return {
            ...base,
            orig: base.orig ?? DISPLAY_DEFAULTS.orig,
            supScore: base.supScore ?? DISPLAY_DEFAULTS.supScore,
            gost: base.gost ?? DISPLAY_DEFAULTS.gost,
        };
    }

    function computeAverage(user, exceptWorkId) {
        const works = getAvailableWorks(user).filter(
            (w) => !Storage.sameId(w.id, exceptWorkId),
        );
        if (works.length === 0) return null;

        const results = works
            .map((w) => {
                const inputs = buildInputs(w);
                if (!inputs) return null;
                return Utils.safeFuzzyInfer(inputs);
            })
            .filter(Boolean);

        if (results.length === 0) return null;

        return {
            count: results.length,
            risk:
                results.reduce((a, r) => a + r.risk.value, 0) / results.length,
        };
    }

    function render(params) {
        const user = Auth.getUser();
        if (!user) return emptyState("Не авторизован", "", SVG.lock);

        const works = getAvailableWorks(user);
        if (works.length === 0) {
            return emptyState(
                "Нет работы",
                user.role === "student"
                    ? "Создайте работу, чтобы увидеть оценку."
                    : "Пока нет работ для анализа.",
                SVG.folder,
            );
        }

        if (params?.workId) selectedWorkId = params.workId;
        if (
            !selectedWorkId ||
            !works.find((w) => Storage.sameId(w.id, selectedWorkId))
        ) {
            const def = pickDefaultWork(works);
            selectedWorkId = def ? def.id : works[0].id;
        }

        const work = Storage.getWorkById(selectedWorkId);
        if (!work) return emptyState("Работа не найдена", "", SVG.folder);

        const inputs = buildInputs(work);
        if (!inputs)
            return emptyState(
                "Не удалось собрать данные",
                "",
                SVG.alertTriangle,
            );

        const result = Utils.safeFuzzyInfer(inputs);
        if (!result)
            return emptyState("Не удалось посчитать", "", SVG.alertTriangle);

        return `
      ${renderWorkSelector(works, work)}
      ${renderStatusBanner(result, work, inputs)}
      ${renderThreeNumbers(result)}
      ${renderQuickActions(result, work, inputs)}
      ${renderFactors(inputs)}
      ${renderDetailedAnalysis(inputs, result, work)}
      ${renderHistory(work)}
    `;
    }

    function renderStatusBanner(result, work, inputs) {
        const risk = result.risk.value;
        const riskTerm = result.risk.term;

        let status = {};
        if (riskTerm === "low") {
            status = {
                icon: SVG.checkCircle,
                cls: "ok",
                title: "Всё идёт хорошо",
                text: "Вы успеваете к дедлайну. Продолжайте в том же темпе.",
            };
        } else if (riskTerm === "med") {
            status = {
                icon: SVG.alertTriangle,
                cls: "warn",
                title: "Стоит ускориться",
                text: "Работа идёт, но есть отставание. Уделите ей больше времени — и всё будет в порядке.",
            };
        } else {
            status = {
                icon: SVG.zap,
                cls: "bad",
                title: "Нужно действовать срочно",
                text: "Работа может не успеть к дедлайну. Посмотрите шаги ниже и начните с самого важного.",
            };
        }

        // Дней до дедлайна
        const daysLeft = work.deadline ? daysUntil(work.deadline) : null;
        const daysText =
            daysLeft === null
                ? ""
                : daysLeft < 0
                  ? `Дедлайн прошёл ${Math.abs(daysLeft)} дней назад`
                  : daysLeft === 0
                    ? "Дедлайн — сегодня"
                    : `До дедлайна ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}`;

        return `
      <div class="status-banner status-${status.cls}">
        <div class="status-icon">
          ${status.icon({ cls: "icon icon-xl" })}
        </div>
        <div class="status-body">
          <div class="status-title">${status.title}</div>
          <div class="status-text">${status.text}</div>
          ${daysText ? `<div class="status-days">${daysText}</div>` : ""}
        </div>
      </div>
    `;
    }

    /* =========================================================
       ТРИ ГЛАВНЫЕ ЦИФРЫ — с объяснением
       ========================================================= */
    function renderThreeNumbers(result) {
        const riskTerm = result.risk.term;
        const readyTerm = result.ready.term;
        const ratingTerm = result.rating.term;

        const riskColor = Utils.riskClass(riskTerm);
        const readyColor = Utils.readyClass(readyTerm);
        const ratingColor = Utils.readyClass(ratingTerm);

        // Подписи-объяснения
        const riskExplain =
            riskTerm === "low"
                ? "Успеваете вовремя"
                : riskTerm === "med"
                  ? "Можете не успеть"
                  : "Скорее всего, не успеете";

        const readyExplain =
            readyTerm === "low"
                ? "Готово меньше половины"
                : readyTerm === "med"
                  ? "Готова наполовину"
                  : "Почти всё готово";

        const ratingExplain =
            ratingTerm === "low"
                ? "Ниже среднего"
                : ratingTerm === "med"
                  ? "Среднее качество"
                  : "Качественная работа";

        return `
      <div class="three-numbers">

        <div class="number-card ${riskColor}">
          <div class="number-label">Риск срыва</div>
          <div class="number-value" style="color:var(--${riskColor});">
            ${result.risk.value.toFixed(0)}
          </div>
          <div class="number-term">
            ${escapeHtml(Fuzzy.termLabel(riskTerm, "risk"))}
          </div>
          <div class="number-bar">
            <div class="number-bar-fill" style="width:${result.risk.value}%;background:var(--${riskColor});"></div>
          </div>
          <div class="number-explain">${riskExplain}</div>
        </div>

        <div class="number-card ${readyColor}">
          <div class="number-label">Готовность</div>
          <div class="number-value" style="color:var(--${readyColor});">
            ${result.ready.value.toFixed(0)}
          </div>
          <div class="number-term">
            ${escapeHtml(Fuzzy.termLabel(readyTerm, "ready"))}
          </div>
          <div class="number-bar">
            <div class="number-bar-fill" style="width:${result.ready.value}%;background:var(--${readyColor});"></div>
          </div>
          <div class="number-explain">${readyExplain}</div>
        </div>

        <div class="number-card ${ratingColor}">
          <div class="number-label">Оценка качества</div>
          <div class="number-value" style="color:var(--${ratingColor});">
            ${result.rating.value.toFixed(0)}
          </div>
          <div class="number-term">
            ${escapeHtml(Fuzzy.termLabel(ratingTerm, "rating"))}
          </div>
          <div class="number-bar">
            <div class="number-bar-fill" style="width:${result.rating.value}%;background:var(--${ratingColor});"></div>
          </div>
          <div class="number-explain">${ratingExplain}</div>
        </div>

      </div>
    `;
    }

    /* =========================================================
       БЫСТРЫЕ ДЕЙСТВИЯ — что делать прямо сейчас
       ========================================================= */
    function renderQuickActions(result, work, inputs) {
        const actions = [];

        // 1. Прогресс низкий → ускориться
        if (inputs.progress < 50) {
            actions.push({
                icon: SVG.trending,
                title: "Ускорить темп работы",
                text: `Сейчас прогресс ${inputs.progress}%. Закройте этапы и задачи — прогресс вырастет.`,
                btnText: "Открыть мою работу",
                onclick: `App.navigate('my-work')`,
                cls: "warn",
            });
        }

        // 2. ГОСТ низкий
        if (
            inputs.gost === null ||
            inputs.gost === undefined ||
            inputs.gost < 70
        ) {
            actions.push({
                icon: SVG.fileText,
                title:
                    inputs.gost === null || inputs.gost === undefined
                        ? "Проверить оформление ГОСТ"
                        : "Доработать оформление ГОСТ",
                text:
                    inputs.gost === null || inputs.gost === undefined
                        ? "Загрузите .docx — система проверит по 8 пунктам."
                        : `Сейчас соответствие ${inputs.gost}%. Проверьте замечания.`,
                btnText: "Проверить ГОСТ",
                onclick: `App.navigate('docx')`,
                cls: "warn",
            });
        }

        // 3. Мало дней
        if (work.deadline && daysUntil(work.deadline) <= 14) {
            actions.push({
                icon: SVG.clock,
                title: "Сроки поджимают",
                text: `До дедлайна ${daysUntil(work.deadline)} дн. Запишитесь на консультацию к руководителю.`,
                btnText: "Записаться на консультацию",
                onclick: `App.navigate('consultations')`,
                cls: "bad",
            });
        }

        // 4. Низкая активность
        if (inputs.activity < 4) {
            actions.push({
                icon: SVG.activity,
                title: "Повысить активность",
                text: "Давно не было действий по работе. Продолжите с ближайшей задачи.",
                btnText: "Открыть задачи",
                onclick: `App.navigate('my-work')`,
                cls: "warn",
            });
        }

        // 5. Оценка руководителя отсутствует
        if (inputs.supScore === null || inputs.supScore === undefined) {
            actions.push({
                icon: SVG.messageCircle,
                title: "Проверка руководителя",
                text: "Руководитель ещё не проверял работу. Напишите ему.",
                btnText: "Написать руководителю",
                onclick: `App.navigate('consultations')`,
                cls: "info",
            });
        }

        // Если ничего — поздравление
        if (actions.length === 0) {
            return `
        <div class="card quick-actions-card">
          <div class="qa-empty">
            ${SVG.checkCircle({ cls: "icon icon-xl" })}
            <div>
              <div class="qa-empty-title">Всё в порядке</div>
              <div class="qa-empty-text">
                Работа идёт по плану. Продолжайте в том же темпе — вы успеваете к защите.
              </div>
            </div>
          </div>
        </div>
      `;
        }

        return `
      <div class="quick-actions-card">
        <div class="qa-head">
          ${SVG.zap({ cls: "icon icon-sm" })}
          <span>Что делать сейчас</span>
        </div>
        <div class="qa-list">
          ${actions
              .slice(0, 4)
              .map(
                  (a) => `
            <div class="qa-item qa-item-${a.cls}">
              <div class="qa-item-icon">
                ${a.icon({ cls: "icon icon-lg" })}
              </div>
              <div class="qa-item-body">
                <div class="qa-item-title">${escapeHtml(a.title)}</div>
                <div class="qa-item-text">${escapeHtml(a.text)}</div>
              </div>
              <button class="btn-ghost btn-sm qa-item-btn"
                onclick="${a.onclick}">
                <span>${escapeHtml(a.btnText)}</span>
                ${SVG.arrowRight({ cls: "icon icon-xs" })}
              </button>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>
    `;
    }

    function renderFactors(inputs) {
        const vars = ["progress", "days", "activity", "edits"];

        return `
      <div class="card factors-card">
        <div class="factors-head">
          ${SVG.info({ cls: "icon icon-sm" })}
          <span>Что повлияло на оценку</span>
        </div>
        <div class="factors-sub">
          Система смотрит на 4 главных показателя вашей работы:
        </div>
        <div class="factors-grid">
          ${vars
              .map((v) => {
                  const val = inputs[v] ?? 0;
                  const dt = Fuzzy.dominantTerm(v, val);
                  const meaning = FACTOR_MEANING[v]?.[dt.term] || "";

                  const iconFn =
                      v === "progress"
                          ? SVG.trending
                          : v === "days"
                            ? SVG.calendar
                            : v === "activity"
                              ? SVG.activity
                              : SVG.edit;

                  return `
              <div class="factor-card factor-card-${dt.term}">
                <div class="factor-card-icon">
                  ${iconFn({ cls: "icon icon-lg" })}
                </div>
                <div class="factor-card-body">
                  <div class="factor-card-name">${escapeHtml(VAR_NAMES[v])}</div>
                  <div class="factor-card-value">${val}${v === "days" ? " дн." : v === "progress" ? "%" : ""}</div>
                  <div class="factor-card-term">${escapeHtml(TERM_LABELS[dt.term])}</div>
                  <div class="factor-card-meaning">${escapeHtml(meaning)}</div>
                </div>
              </div>
            `;
              })
              .join("")}
        </div>
      </div>
    `;
    }

    /* =========================================================
       КАК СЧИТАЛАСЬ ОЦЕНКА — разбор по шагам
       ========================================================= */
    function renderDetailedAnalysis(inputs, result, work) {
        return `
      <div class="card mt-16">
        <div class="factors-head">
          ${SVG.brain({ cls: "icon icon-sm" })}
          <span>Как считалась оценка</span>
        </div>
        <div class="factors-sub">
          Разберём по шагам, как система пришла к этим цифрам.
          Нажмите на любой шаг — увидите детали.
        </div>

        <div class="mamdani-tabs" style="margin-top:16px;">
          ${renderTab("all", "Кратко")}
          ${renderTab("fuzz", "1. Ваши данные")}
          ${renderTab("rules", "2. Проверка правил")}
          ${renderTab("aggr", "3. Объединение")}
          ${renderTab("defuzz", "4. Итоговое число")}
          ${renderTab("compare", "Сравнение методов")}
        </div>

        <div class="pipeline-v2">
          ${pipelineStepV2(1, "Ваши данные", "цифры и факты", currentStep === "fuzz")}
          ${pipelineStepV2(2, "Проверка правил", "что подходит", currentStep === "rules")}
          ${pipelineStepV2(3, "Объединение", "собираем вместе", currentStep === "aggr")}
          ${pipelineStepV2(4, "Итоговое число", "0 — 100", currentStep === "defuzz")}
          ${pipelineStepV2(5, "Готово", "результат", false)}
        </div>

        <div id="vizBody">
          ${renderStep(inputs, result, work)}
        </div>
      </div>
    `;
    }

    function pipelineStepV2(num, title, sub, active) {
        return `
      <div class="pipeline-step-v2 ${active ? "active" : ""}">
        <div class="pipeline-step-v2-num">${num}</div>
        <div class="pipeline-step-v2-title">${escapeHtml(title)}</div>
        <div class="pipeline-step-v2-sub">${escapeHtml(sub)}</div>
      </div>
    `;
    }

    /* =========================================================
       ИСТОРИЯ РАБОТЫ
       ========================================================= */
    function renderHistory(work) {
        const comments = Storage.getCommentsByWork(work.id);
        const stages = Storage.getStagesByWork(work.id);

        const events = [
            { time: work.createdAt, label: "Работа создана", icon: SVG.folder },
            ...stages
                .filter((s) => s.completedAt)
                .map((s) => ({
                    time: s.completedAt,
                    label: `Этап выполнен: ${s.name}`,
                    icon: SVG.check,
                })),
            ...comments.map((c) => ({
                time: c.createdAt,
                label: "Новое замечание руководителя",
                icon: SVG.messageCircle,
            })),
        ].sort((a, b) => a.time - b.time);

        if (events.length < 2) return "";

        const shown = events.slice(-6).reverse();

        return `
      <div class="card mt-16">
        <div class="factors-head">
          ${SVG.activity({ cls: "icon icon-sm" })}
          <span>Что происходило с работой</span>
        </div>
        <div class="factors-sub">
          Последние ${shown.length} ${shown.length === 1 ? "событие" : shown.length < 5 ? "события" : "событий"}:
        </div>
        <div class="history-list-v2">
          ${shown
              .map(
                  (e, i) => `
            <div class="history-item-v2">
              <div class="history-item-icon">
                ${e.icon({ cls: "icon icon-sm" })}
              </div>
              <div class="history-item-body">
                <div class="history-item-label">${escapeHtml(e.label)}</div>
                <div class="history-item-time">${fmtDateTime(e.time)}</div>
              </div>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>
    `;
    }

    /* =========================================================
       ВНУТРЕННИЕ ВКЛАДКИ — понятные объяснения
       ========================================================= */

    function renderOverview(inputs, result) {
        return `
      <div class="explain-box">
        <div class="explain-box-title">Коротко о вашей работе</div>
        <p>
          Система взяла данные вашей работы и через
          <b>${Fuzzy.getRules().length} правил</b> посчитала
          <b>риск срыва</b>, <b>готовность</b> и <b>оценку качества</b>.
        </p>
        <p style="margin-top:10px;">
          Нажмите на любую вкладку выше, чтобы увидеть, как это работает по шагам.
        </p>
      </div>
    `;
    }

    /* =========================================================
       ВКЛАДКА 1: ВАШИ ДАННЫЕ
       ========================================================= */
    function renderFuzzDetail(inputs) {
        const vars = [
            "progress",
            "days",
            "activity",
            "edits",
            "volume",
            "orig",
            "supScore",
            "gost",
        ];

        return `
      <div class="explain-box">
        <div class="explain-box-title">Шаг 1. Система смотрит на ваши данные</div>
        <p>
          Для каждого показателя система определяет, к какой категории он относится:
          <b>низкий</b>, <b>средний</b> или <b>высокий</b>.
          Число показывает, насколько система уверена в этой категории (от 0 до 1).
        </p>
      </div>

      <div class="fuzz-table">
        ${vars
            .map((v) => {
                const raw = inputs[v];
                const isEmpty = raw === null || raw === undefined;
                const val = isEmpty
                    ? v === "orig"
                        ? 65
                        : v === "supScore"
                          ? 5
                          : v === "gost"
                            ? 70
                            : 0
                    : raw;

                const terms = ["low", "med", "high"].map((t) => ({
                    t,
                    mu: isEmpty ? 0 : safeMF(v, t, val),
                }));
                const maxTerm = terms.reduce((a, b) => (a.mu > b.mu ? a : b));
                const explanation = isEmpty
                    ? "Руководитель ещё не проверял этот показатель"
                    : TERM_EXPLAIN[v]?.[maxTerm.t] || "";

                return `
            <div class="fuzz-row-v2 ${isEmpty ? "empty" : ""}">
              <div class="fuzz-row-v2-head">
                <div class="fuzz-row-v2-name">${escapeHtml(VAR_NAMES[v])}</div>
                <div class="fuzz-row-v2-value">${isEmpty ? "—" : val}</div>
                ${
                    isEmpty
                        ? `<span class="fuzz-row-v2-badge" style="background:var(--bg-soft);color:var(--txt-muted);">нет данных</span>`
                        : `<span class="fuzz-row-v2-badge fuzz-badge-${maxTerm.t}">
                             ${escapeHtml(TERM_LABELS[maxTerm.t])}
                           </span>`
                }
              </div>
              <div class="fuzz-row-v2-explain">${escapeHtml(explanation)}</div>
              <div class="fuzz-row-v2-bars">
                ${terms
                    .map(
                        (x) => `
                  <div class="fuzz-bar-v2-row">
                    <span class="fuzz-bar-v2-lbl">${escapeHtml(TERM_LABELS[x.t])}</span>
                    <div class="fuzz-bar-v2-track">
                      <div class="fuzz-bar-v2-fill fuzz-${x.t}" style="width:${x.mu * 100}%"></div>
                    </div>
                    <span class="fuzz-bar-v2-val">${x.mu.toFixed(2)}</span>
                  </div>
                `,
                    )
                    .join("")}
              </div>
            </div>
          `;
            })
            .join("")}
      </div>
    `;
    }

    /* =========================================================
       ВКЛАДКА 2: ПРОВЕРКА ПРАВИЛ
       ========================================================= */
    function renderRulesDetail(inputs, result) {
        const allFired = [
            ...(result.risk.fired || []),
            ...(result.ready.fired || []),
            ...(result.rating.fired || []),
        ];

        const uniq = {};
        allFired.forEach((f) => {
            const id = f.rule?.id;
            if (id === undefined) return;
            if (!uniq[id] || uniq[id].strength < f.strength) uniq[id] = f;
        });
        const fired = Object.values(uniq).sort(
            (a, b) => b.strength - a.strength,
        );

        return `
      <div class="explain-box">
        <div class="explain-box-title">Шаг 2. Система проверяет правила</div>
        <p>
          В системе <b>${Fuzzy.getRules().length} правил</b> вида
          «ЕСЛИ что-то ТО результат».
          Для вашей работы сработало <b>${fired.length}</b>
          ${fired.length === 1 ? "правило" : fired.length < 5 ? "правила" : "правил"}.
          Чем сильнее сработало правило — тем больше оно влияет на результат.
        </p>
      </div>

      ${
          fired.length === 0
              ? `<div class="empty" style="padding:30px;text-align:center;">
                  Ни одно правило не сработало для вашей работы
                 </div>`
              : fired.map((f) => renderRuleCardV2(f)).join("")
      }
    `;
    }

    function renderRuleCardV2(f) {
        const strength = f.strength;
        const level = strength > 0.7 ? "high" : strength > 0.4 ? "med" : "low";
        const word =
            strength > 0.7 ? "сильно" : strength > 0.4 ? "умеренно" : "слабо";

        const ifStr = f.rule.if
            .map((c) => {
                const [v, t] = c.split("=");
                return `${VAR_NAMES[v] || v} — ${TERM_LABELS[t] || t}`;
            })
            .join(" И ");
        const [rv, rt] = f.rule.then.split("=");
        const thenStr = `${VAR_NAMES[rv] || rv} — ${TERM_LABELS[rt] || rt}`;

        return `
      <div class="rule-v2">
        <div class="rule-v2-strength rule-strength-${level}">
          ${(strength * 100).toFixed(0)}%
        </div>
        <div class="rule-v2-body">
          <div class="rule-v2-line">
            <span class="rule-v2-tag">ЕСЛИ</span>
            <span>${escapeHtml(ifStr)}</span>
          </div>
          <div class="rule-v2-line">
            <span class="rule-v2-tag rule-v2-tag-then">ТО</span>
            <span><b>${escapeHtml(thenStr)}</b></span>
          </div>
          <div class="rule-v2-footer">
            Сработало ${word}
            ${f.rule.desc ? ` · ${escapeHtml(f.rule.desc)}` : ""}
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ВКЛАДКА 3: ОБЪЕДИНЕНИЕ
       ========================================================= */
    function renderAggrDetail(result) {
        const acc = result.risk.acc;
        const maxAcc = Math.max(acc.low, acc.med, acc.high, 0.01);

        return `
      <div class="explain-box">
        <div class="explain-box-title">Шаг 3. Система объединяет результаты</div>
        <p>
          Правил много, и некоторые дают разные ответы. Система берёт
          <b>самое сильное сработавшее правило</b> для каждого варианта:
          «риск низкий», «риск средний» или «риск высокий».
        </p>
      </div>

      <div class="aggr-grid-v2">
        ${renderAggrCardV2("Низкий риск", acc.low, maxAcc, "low")}
        ${renderAggrCardV2("Средний риск", acc.med, maxAcc, "med")}
        ${renderAggrCardV2("Высокий риск", acc.high, maxAcc, "high")}
      </div>

      <div class="explain-box" style="margin-top:16px;">
        <div class="explain-box-title">График</div>
        <p>
          Три тонкие линии — это три возможных исхода. <b>Жирная линия</b> —
          итог, который получился после объединения всех правил.
        </p>
      </div>
      <div class="chart-box h-260" style="margin-top:12px;">
        <canvas id="vizAggrChart"></canvas>
      </div>
    `;
    }

    function renderAggrCardV2(label, value, maxAcc, cls) {
        const pct = maxAcc > 0 ? (value / maxAcc) * 100 : 0;
        const active = value > 0.05;
        const word =
            value > 0.5 ? "Сильно" : value > 0 ? "Слабо" : "Не сработало";

        return `
      <div class="aggr-card-v2 aggr-v2-${cls} ${active ? "active" : ""}">
        <div class="aggr-card-v2-label">${escapeHtml(label)}</div>
        <div class="aggr-card-v2-value">${(value * 100).toFixed(0)}%</div>
        <div class="aggr-card-v2-bar">
          <div class="aggr-card-v2-fill" style="width:${pct}%"></div>
        </div>
        <div class="aggr-card-v2-word">${word}</div>
      </div>
    `;
    }

    /* =========================================================
       ВКЛАДКА 4: ИТОГОВОЕ ЧИСЛО
       ========================================================= */
    function renderDefuzzDetail(result) {
        return `
      <div class="explain-box">
        <div class="explain-box-title">Шаг 4. Система получает итоговое число</div>
        <p>
          Из графика система находит <b>среднюю точку</b> — это и есть итоговое число риска.
          Оно всегда от 0 до 100.
        </p>
      </div>

      <div class="defuzz-grid-v2">
        ${renderDefuzzCardV2("Риск срыва", result.risk, "risk")}
        ${renderDefuzzCardV2("Готовность", result.ready, "ready")}
        ${renderDefuzzCardV2("Оценка качества", result.rating, "rating")}
      </div>

      <div class="explain-box" style="margin-top:16px;">
        <div class="explain-box-title">График</div>
        <p>
          Красная линия — <b>итоговое число риска = ${result.risk.value.toFixed(0)}</b>.
          Это точка, где уверенность системы максимальна.
        </p>
      </div>
      <div class="chart-box h-260" style="margin-top:12px;">
        <canvas id="vizDefuzzChart"></canvas>
      </div>
    `;
    }

    function renderDefuzzCardV2(label, data, kind) {
        const color =
            kind === "risk"
                ? Utils.riskClass(data.term)
                : kind === "ready"
                  ? Utils.readyClass(data.term)
                  : Utils.readyClass(data.term);

        return `
      <div class="defuzz-card-v2">
        <div class="defuzz-card-v2-label">${escapeHtml(label)}</div>
        <div class="defuzz-card-v2-value" style="color:var(--${color});">
          ${data.value.toFixed(0)}
        </div>
        <div class="defuzz-card-v2-bar">
          <div class="defuzz-card-v2-fill" style="width:${data.value}%;background:var(--${color});"></div>
        </div>
        <div class="defuzz-card-v2-term">${escapeHtml(Fuzzy.termLabel(data.term, kind))}</div>
      </div>
    `;
    }

    /* =========================================================
       ВКЛАДКА 5: СРАВНЕНИЕ МЕТОДОВ
       ========================================================= */
    function renderCompareDetail(inputs, mamdani) {
        const sugeno = Fuzzy.sugenoInfer(inputs);
        const crisp = Fuzzy.crispInfer(inputs);

        return `
      <div class="explain-box">
        <div class="explain-box-title">Сравнение методов оценки</div>
        <p>
          Одну работу можно оценить <b>тремя способами</b>.
          Meridian использует <b>Мамдани</b> — самый точный метод.
          Сравните с другими:
        </p>
      </div>

      <div class="algo-compare-v2">
        <div class="algo-card-v2 selected">
          <div class="algo-card-v2-badge">Мы используем</div>
          <div class="algo-card-v2-title">Мамдани</div>
          <div class="algo-card-v2-value" style="color:var(--accent-viz);">
            ${mamdani.risk.value.toFixed(0)}
          </div>
          <div class="algo-card-v2-desc">
            Каждое правило можно прочитать и понять. Самый прозрачный метод.
          </div>
        </div>
        <div class="algo-card-v2">
          <div class="algo-card-v2-title">Сугено</div>
          <div class="algo-card-v2-value" style="color:var(--warn);">
            ${sugeno.risk.value.toFixed(0)}
          </div>
          <div class="algo-card-v2-desc">
            Упрощённая версия. Быстрее, но менее точная.
          </div>
        </div>
        <div class="algo-card-v2">
          <div class="algo-card-v2-title">Обычная формула</div>
          <div class="algo-card-v2-value" style="color:var(--txt-muted);">
            ${crisp.risk.value.toFixed(0)}
          </div>
          <div class="algo-card-v2-desc">
            Без правил. Считается по одной формуле.
          </div>
        </div>
      </div>

      <div class="explain-box" style="margin-top:16px;">
        <div class="explain-box-title">Почему Мамдани лучше?</div>
        <ul class="explain-list">
          <li><b>Понятно.</b> Каждое правило — обычными словами.</li>
          <li><b>Прозрачно.</b> Видно, какие правила сработали и почему.</li>
          <li><b>Плавно.</b> Небольшие изменения не дают резких скачков.</li>
          <li><b>Гибко.</b> Правила можно менять без переписывания программы.</li>
        </ul>
      </div>
    `;
    }

    function renderWorkSelector(works, work) {
        const student = Storage.getUserById(work.studentId);
        return `
      <div class="mamdani-work">
        <div class="mamdani-work-info">
          <div class="mamdani-work-label">Оценка работы</div>
          <div class="mamdani-work-topic">${escapeHtml(work.topic)}</div>
          <div class="mamdani-work-student">
            ${escapeHtml(student?.fio || "—")}
            ${student?.group ? `· ${escapeHtml(student.group)}` : ""}
          </div>
        </div>
        <select onchange="MamdaniViz.selectWork(this.value)" class="mamdani-select">
          ${works
              .map(
                  (w) => `
            <option value="${w.id}" ${Storage.sameId(w.id, selectedWorkId) ? "selected" : ""}>
              ${escapeHtml(w.topic.slice(0, 60))}${w.topic.length > 60 ? "…" : ""}
            </option>
          `,
              )
              .join("")}
        </select>
      </div>
    `;
    }

    function renderHero(result, avg) {
        const riskClass = Utils.riskClass(result.risk.term);
        const icon =
            result.risk.term === "high"
                ? SVG.alertTriangle
                : result.risk.term === "med"
                  ? SVG.info
                  : SVG.checkCircle;

        let trendHtml = "";
        if (avg) {
            const diff = result.risk.value - avg.risk;
            const diffText = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
            const trendClass = diff > 2 ? "up" : diff < -2 ? "down" : "flat";
            const trendArrow = diff > 2 ? "▲" : diff < -2 ? "▼" : "●";
            const trendLabel =
                diff > 2
                    ? `Выше среднего на ${diffText}`
                    : diff < -2
                      ? `Ниже среднего на ${diffText}`
                      : "На уровне среднего";

            trendHtml = `
        <div class="hero-trend ${trendClass}">
          <span class="hero-trend-arrow">${trendArrow}</span>
          <span class="hero-trend-text">${escapeHtml(trendLabel)}</span>
        </div>
      `;
        }

        return `
      <div class="mamdani-hero-final ${riskClass}">
        <div class="hero-icon">${icon({ cls: "icon icon-xl" })}</div>
        <div class="hero-body">
          <div class="hero-title">
            ${escapeHtml(RECOMMENDATION.risk[result.risk.term])}
          </div>
          ${trendHtml}
        </div>
      </div>
    `;
    }

    function renderActions(work) {
        const user = Auth.getUser();
        const role = user?.role || "student";

        const actions = [];

        // Студент — консультация + PDF
        if (role === "student") {
            actions.push(`
        <button class="action-btn" onclick="App.navigate('consultations')">
          ${SVG.calendar({ cls: "icon icon-sm" })}
          <span>Записаться на консультацию</span>
        </button>
      `);
            actions.push(`
        <button class="action-btn" onclick="PdfReport.exportStudent('${work.id}')">
          ${SVG.fileText({ cls: "icon icon-sm" })}
          <span>Скачать PDF</span>
        </button>
      `);
        } else {
            actions.push(`
        <button class="action-btn" onclick="MamdaniViz.contactStudent('${work.id}')">
          ${SVG.messageCircle({ cls: "icon icon-sm" })}
          <span>Написать студенту</span>
        </button>
      `);
            actions.push(`
        <button class="action-btn" onclick="MamdaniViz.openCommentModal('${work.id}')">
          ${SVG.edit({ cls: "icon icon-sm" })}
          <span>Добавить комментарий</span>
        </button>
      `);
            actions.push(`
        <button class="action-btn" onclick="PdfReport.exportStudent('${work.id}')">
          ${SVG.fileText({ cls: "icon icon-sm" })}
          <span>Скачать PDF</span>
        </button>
      `);
        }

        return `
      <div class="mamdani-actions" style="grid-template-columns:repeat(${actions.length}, 1fr);">
        ${actions.join("")}
      </div>
    `;
    }

    function renderMainResult(result) {
        const riskClass = Utils.riskClass(result.risk.term);
        const readyClass = Utils.readyClass(result.ready.term);
        const ratingClass = Utils.readyClass(result.rating.term);

        return `
      <div class="mamdani-main">
        <div class="main-risk ${riskClass}">
          <div class="main-risk-label">Риск срыва сроков</div>
          <div class="main-risk-value">${result.risk.value.toFixed(0)}</div>
          <div class="main-risk-term">${escapeHtml(Fuzzy.termLabel(result.risk.term, "risk"))}</div>
        </div>

        <div class="main-side">
          <div class="main-side-card ${readyClass}">
            <div class="main-side-label">Готовность</div>
            <div class="main-side-value">${result.ready.value.toFixed(0)}</div>
            <div class="main-side-term">${escapeHtml(Fuzzy.termLabel(result.ready.term, "ready"))}</div>
          </div>
          <div class="main-side-card ${ratingClass}">
            <div class="main-side-label">Рейтинг</div>
            <div class="main-side-value">${result.rating.value.toFixed(0)}</div>
            <div class="main-side-term">${escapeHtml(Fuzzy.termLabel(result.rating.term, "rating"))}</div>
          </div>
        </div>
      </div>
    `;
    }

    function renderTodo(inputs, result) {
        const todos = [];

        if (result.risk.term === "high") {
            todos.push({
                icon: "🚨",
                title: "Срочно связаться со студентом",
                text: "Обсудить план и сроки",
            });
        }
        if (inputs.progress < 50) {
            todos.push({
                icon: "📈",
                title: "Ускорить темп работы",
                text: `Прогресс ${inputs.progress}% — стоит подтянуть`,
            });
        }
        if (
            inputs.gost !== null &&
            inputs.gost !== undefined &&
            inputs.gost < 70
        ) {
            todos.push({
                icon: "📄",
                title: "Обратить внимание на ГОСТ",
                text: `Соответствие ${inputs.gost}% — нужно доработать`,
            });
        }
        if (inputs.gost === null || inputs.gost === undefined) {
            todos.push({
                icon: "📝",
                title: "Проверить оформление по ГОСТу",
                text: "Оценка ещё не проводилась",
            });
        }
        if (inputs.activity < 4) {
            todos.push({
                icon: "💬",
                title: "Проверить активность студента",
                text: "Давно не выходил на связь",
            });
        }

        if (todos.length === 0) {
            todos.push({
                icon: "✅",
                title: "Всё в порядке",
                text: "Работа идёт по плану, вмешательство не требуется",
            });
        }

        return `
      <div class="mamdani-todo">
        <div class="mamdani-section-title">
          ${SVG.zap({ cls: "icon icon-sm" })}
          Что делать прямо сейчас
        </div>
        <div class="todo-list">
          ${todos
              .slice(0, 3)
              .map(
                  (t) => `
            <div class="todo-item">
              <div class="todo-icon">${t.icon}</div>
              <div class="todo-body">
                <div class="todo-title">${escapeHtml(t.title)}</div>
                <div class="todo-text">${escapeHtml(t.text)}</div>
              </div>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>
    `;
    }

    function renderFactors(inputs) {
        const vars = ["progress", "days", "activity", "edits"];

        return `
      <div class="mamdani-factors">
        <div class="mamdani-section-title">
          ${SVG.info({ cls: "icon icon-sm" })}
          Почему такой результат?
        </div>
        <div class="factor-list">
          ${vars
              .map((v) => {
                  const val = inputs[v] ?? 0;
                  const dt = Fuzzy.dominantTerm(v, val);
                  const meaning = FACTOR_MEANING[v]?.[dt.term] || "";

                  return `
              <div class="factor-item">
                <div class="factor-item-head">
                  <span class="factor-item-name">${escapeHtml(VAR_NAMES[v])}</span>
                  <span class="factor-item-val">${val}</span>
                  <span class="factor-item-term factor-term-${dt.term}">
                    ${escapeHtml(TERM_LABELS[dt.term])}
                  </span>
                </div>
                <div class="factor-item-meaning">→ ${escapeHtml(meaning)}</div>
              </div>
            `;
              })
              .join("")}
        </div>
      </div>
    `;
    }

    function renderDetailedAnalysis(inputs, result, work) {
        return `
      <div class="card" style="margin-top:20px;">
        <div class="card-head">
          <div class="card-title">📊 Подробный разбор</div>
        </div>
        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Пошагово — как система пришла к результату.
          Нажми на любой шаг, чтобы увидеть детали.
        </p>

        <div class="mamdani-tabs">
          ${renderTab("all", "Общий обзор")}
          ${renderTab("fuzz", "1. Фаззификация")}
          ${renderTab("rules", "2. Правила")}
          ${renderTab("aggr", "3. Агрегация")}
          ${renderTab("defuzz", "4. Дефаззификация")}
          ${renderTab("compare", "Сравнение алгоритмов")}
        </div>

        <div class="pipeline">
          ${pipelineStep(1, "Фаззификация", "вход → μ", currentStep === "fuzz")}
          ${pipelineStep(2, "Правила", "min по посылке", currentStep === "rules")}
          ${pipelineStep(3, "Агрегация", "max по терму", currentStep === "aggr")}
          ${pipelineStep(4, "Дефаззификация", "центр тяжести", currentStep === "defuzz")}
          ${pipelineStep(5, "Результат", "число 0–100", false)}
        </div>

        <div id="vizBody">
          ${renderStep(inputs, result, work)}
        </div>
      </div>
    `;
    }

    function renderTab(id, label) {
        return `<button class="${currentStep === id ? "active" : ""}"
          onclick="MamdaniViz.step('${id}')">${escapeHtml(label)}</button>`;
    }

    function pipelineStep(num, title, sub, active) {
        return `
      <div class="pipeline-step ${active ? "active" : ""}">
        <div class="pipeline-step-num">${num}</div>
        <div class="pipeline-step-title">${escapeHtml(title)}</div>
        <div class="pipeline-step-sub">${escapeHtml(sub)}</div>
      </div>
    `;
    }

    function renderStep(inputs, result, work) {
        switch (currentStep) {
            case "all":
                return renderOverview(inputs, result);
            case "fuzz":
                return renderFuzzDetail(inputs);
            case "rules":
                return renderRulesDetail(inputs, result);
            case "aggr":
                return renderAggrDetail(result);
            case "defuzz":
                return renderDefuzzDetail(result);
            case "compare":
                return renderCompareDetail(inputs, result);
            default:
                return "";
        }
    }

    function renderOverview(inputs, result) {
        const ratingColor = Utils.readyClass(result.rating.term);

        return `
      <div class="mamdani-explain">
        <b>Коротко:</b> система взяла данные работы и через
        <b>${Fuzzy.getRules().length} правил</b> посчитала риск, готовность и рейтинг.
        Разберём по шагам.
      </div>

      <div class="grid grid-3">
        <div class="metric">
          <div class="metric-lbl">Риск срыва</div>
          <div class="metric-val" style="color:var(--${Utils.riskClass(result.risk.term)})">
            ${result.risk.value.toFixed(1)}
          </div>
          <div class="metric-sub">${escapeHtml(Fuzzy.termLabel(result.risk.term, "risk"))}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Готовность</div>
          <div class="metric-val" style="color:var(--${Utils.readyClass(result.ready.term)})">
            ${result.ready.value.toFixed(1)}
          </div>
          <div class="metric-sub">${escapeHtml(Fuzzy.termLabel(result.ready.term, "ready"))}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Рейтинг</div>
          <div class="metric-val" style="color:var(--${ratingColor})">
            ${result.rating.value.toFixed(1)}
          </div>
          <div class="metric-sub">${escapeHtml(Fuzzy.termLabel(result.rating.term, "rating"))}</div>
        </div>
      </div>
    `;
    }

    function renderFuzzDetail(inputs) {
        const vars = [
            "progress",
            "days",
            "activity",
            "edits",
            "volume",
            "orig",
            "supScore",
            "gost",
        ];

        return `
      <div class="mamdani-explain">
        <b>Фаззификация</b> — превращение обычных чисел в «степени уверенности».
        Например, если прогресс 42%, система говорит:
        <b>«на 60% это средний и на 40% низкий»</b>.
        <br><br>
        <b>Примечание:</b> если руководитель ещё не проверял работу,
        переменные «оригинальность», «оценка» и «ГОСТ» показаны серым —
        они не участвуют в расчёте.
      </div>

      <div class="fuzz-table">
        ${vars
            .map((v) => {
                const raw = inputs[v];
                const isEmpty = raw === null || raw === undefined;
                const val = isEmpty
                    ? v === "orig"
                        ? 65
                        : v === "supScore"
                          ? 5
                          : v === "gost"
                            ? 70
                            : 0
                    : raw;

                const terms = ["low", "med", "high"].map((t) => ({
                    t,
                    mu: isEmpty ? 0 : safeMF(v, t, val),
                }));
                const maxTerm = terms.reduce((a, b) => (a.mu > b.mu ? a : b));
                const explanation = isEmpty
                    ? "Нет данных — руководитель ещё не проверял"
                    : TERM_EXPLAIN[v]?.[maxTerm.t] || "";

                return `
            <div class="fuzz-row" style="${isEmpty ? "opacity:0.55;" : ""}">
              <div class="fuzz-name">
                <div style="font-weight:500;">${escapeHtml(VAR_NAMES[v])}</div>
                <div style="font-size:11px;color:var(--txt-muted);margin-top:2px;">
                  ${escapeHtml(explanation)}
                </div>
              </div>
              <div class="fuzz-value">${isEmpty ? "—" : val}</div>
              <div class="fuzz-term">
                ${
                    isEmpty
                        ? `<span class="fuzz-term-badge" style="background:var(--bg-soft);color:var(--txt-muted);">нет данных</span>`
                        : `<span class="fuzz-term-badge ${maxTerm.t}">
                             ${escapeHtml(TERM_LABELS[maxTerm.t])} (${maxTerm.mu.toFixed(2)})
                           </span>`
                }
              </div>
              <div class="fuzz-bars">
                ${terms
                    .map(
                        (x) => `
                  <div class="fuzz-bar-row">
                    <span class="fuzz-bar-lbl">${escapeHtml(TERM_LABELS[x.t])}</span>
                    <div class="fuzz-bar-track">
                      <div class="fuzz-bar-fill ${x.t}" style="width:${x.mu * 100}%"></div>
                    </div>
                    <span class="fuzz-bar-val">${x.mu.toFixed(2)}</span>
                  </div>
                `,
                    )
                    .join("")}
              </div>
            </div>
          `;
            })
            .join("")}
      </div>
    `;
    }

    function renderRulesDetail(inputs, result) {
        const allFired = [
            ...(result.risk.fired || []),
            ...(result.ready.fired || []),
            ...(result.rating.fired || []),
        ];

        const uniq = {};
        allFired.forEach((f) => {
            const id = f.rule?.id;
            if (id === undefined) return;
            if (!uniq[id] || uniq[id].strength < f.strength) uniq[id] = f;
        });
        const fired = Object.values(uniq).sort(
            (a, b) => b.strength - a.strength,
        );

        return `
      <div class="mamdani-explain">
        <b>Правила</b> — основа системы. Каждое правило —
        «ЕСЛИ что-то ТО результат». Система берёт только те правила,
        у которых <b>посылка истинна</b>.
        <br><br>
        Всего в базе <b>${Fuzzy.getRules().length}</b> правил.
        Ниже — только те, что сработали для текущей работы.
      </div>

      <div class="section-label">Сработавшие правила (${fired.length})</div>
      ${
          fired.length === 0
              ? '<div class="empty" style="padding:20px;">Ни одно правило не сработало</div>'
              : fired.map((f) => renderRuleClear(f)).join("")
      }
    `;
    }

    function renderRuleClear(f) {
        const mu = f.strength;
        const strengthLevel = mu > 0.7 ? "high" : mu > 0.4 ? "med" : "low";
        const strengthWord =
            mu > 0.7 ? "сильно" : mu > 0.4 ? "умеренно" : "слабо";

        const ifStr = f.rule.if
            .map((c) => {
                const [v, t] = c.split("=");
                return `${VAR_NAMES[v] || v} — ${TERM_LABELS[t] || t}`;
            })
            .join(" И ");
        const [rv, rt] = f.rule.then.split("=");
        const thenStr = `${VAR_NAMES[rv] || rv} — ${TERM_LABELS[rt] || rt}`;

        return `
      <div class="rule-clear">
        <div class="rule-clear-strength ${strengthLevel}">
          ${mu.toFixed(2)}
        </div>
        <div class="rule-clear-body">
          <div class="rule-clear-if">
            <span class="rule-clear-label">ЕСЛИ</span>
            ${escapeHtml(ifStr)}
          </div>
          <div class="rule-clear-then">
            <span class="rule-clear-label">ТО</span>
            <b>${escapeHtml(thenStr)}</b>
          </div>
          <div class="rule-clear-desc">
            Сработало <b>${strengthWord}</b> · ${escapeHtml(f.rule.desc || "")}
          </div>
        </div>
      </div>
    `;
    }

    function renderAggrDetail(result) {
        const acc = result.risk.acc;

        return `
      <div class="mamdani-explain">
        <b>Агрегация</b> — объединение сработавших правил для одного выхода.
        Система берёт <b>максимум</b> по каждому терму — то, во что верит сильнее всего.
      </div>

      <div class="grid grid-3">
        <div class="aggr-card low ${acc.low > 0 ? "active" : ""}">
          <div class="aggr-card-lbl">Терм «низкий»</div>
          <div class="aggr-card-val">${(acc.low || 0).toFixed(2)}</div>
          <div class="aggr-card-sub">
            ${acc.low > 0.5 ? "Сработало сильно" : acc.low > 0 ? "Сработало слабо" : "Не сработало"}
          </div>
        </div>
        <div class="aggr-card med ${acc.med > 0 ? "active" : ""}">
          <div class="aggr-card-lbl">Терм «средний»</div>
          <div class="aggr-card-val">${(acc.med || 0).toFixed(2)}</div>
          <div class="aggr-card-sub">
            ${acc.med > 0.5 ? "Сработало сильно" : acc.med > 0 ? "Сработало слабо" : "Не сработало"}
          </div>
        </div>
        <div class="aggr-card high ${acc.high > 0 ? "active" : ""}">
          <div class="aggr-card-lbl">Терм «высокий»</div>
          <div class="aggr-card-val">${(acc.high || 0).toFixed(2)}</div>
          <div class="aggr-card-sub">
            ${acc.high > 0.5 ? "Сработало сильно" : acc.high > 0 ? "Сработало слабо" : "Не сработало"}
          </div>
        </div>
      </div>

      <div class="section-label" style="margin-top:20px;">График агрегации</div>
      <div class="mamdani-explain-sub">
        Три тонкие линии — исходные термы. <b>Жирная линия</b> —
        итоговая функция, объединяющая все сработавшие правила.
      </div>
      <div class="chart-box h-260" style="margin-top:12px;">
        <canvas id="vizAggrChart"></canvas>
      </div>
    `;
    }

    function renderDefuzzDetail(result) {
        return `
      <div class="mamdani-explain">
        <b>Дефаззификация</b> — превращение нечёткого результата
        обратно в <b>обычное число</b>. Система берёт «центр тяжести» —
        где уверенность максимальна.
      </div>

      <div class="defuzz-grid">
        <div class="defuzz-card">
          <div class="defuzz-card-lbl">Риск срыва</div>
          <div class="defuzz-card-val" style="color:var(--${Utils.riskClass(result.risk.term)})">
            ${result.risk.value.toFixed(1)}
          </div>
          <div class="defuzz-card-term">
            ${escapeHtml(Fuzzy.termLabel(result.risk.term, "risk"))}
          </div>
        </div>
        <div class="defuzz-card">
          <div class="defuzz-card-lbl">Готовность</div>
          <div class="defuzz-card-val" style="color:var(--${Utils.readyClass(result.ready.term)})">
            ${result.ready.value.toFixed(1)}
          </div>
          <div class="defuzz-card-term">
            ${escapeHtml(Fuzzy.termLabel(result.ready.term, "ready"))}
          </div>
        </div>
        <div class="defuzz-card">
          <div class="defuzz-card-lbl">Рейтинг</div>
          <div class="defuzz-card-val" style="color:var(--accent)">
            ${result.rating.value.toFixed(1)}
          </div>
          <div class="defuzz-card-term">
            ${escapeHtml(Fuzzy.termLabel(result.rating.term, "rating"))}
          </div>
        </div>
      </div>

      <div class="section-label" style="margin-top:20px;">График дефаззификации</div>
      <div class="mamdani-explain-sub">
        Красная вертикальная линия — <b>итоговый риск = ${result.risk.value.toFixed(1)}</b>.
        Это центр тяжести итоговой функции.
      </div>
      <div class="chart-box h-260" style="margin-top:12px;">
        <canvas id="vizDefuzzChart"></canvas>
      </div>
    `;
    }

    function renderCompareDetail(inputs, mamdani) {
        const sugeno = Fuzzy.sugenoInfer(inputs);
        const crisp = Fuzzy.crispInfer(inputs);

        return `
      <div class="mamdani-explain">
        Одну работу можно оценить <b>тремя способами</b>.
        Meridian использует <b>Мамдани</b> — самый прозрачный метод.
        Сравни с другими подходами ниже.
      </div>

      <div class="algo-compare">
        <div class="algo-card selected">
          <div class="algo-card-badge">Наш выбор</div>
          <div class="algo-card-title">Мамдани</div>
          <div class="algo-card-value" style="color:var(--accent)">
            ${mamdani.risk.value.toFixed(0)}
          </div>
          <div class="algo-card-sub">
            Прозрачно: каждое правило можно прочитать.
          </div>
        </div>
        <div class="algo-card">
          <div class="algo-card-title">Сугено</div>
          <div class="algo-card-value" style="color:var(--warn)">
            ${sugeno.risk.value.toFixed(0)}
          </div>
          <div class="algo-card-sub">
            Упрощение: вместо функций — точки.
          </div>
        </div>
        <div class="algo-card">
          <div class="algo-card-title">Чёткая формула</div>
          <div class="algo-card-value" style="color:var(--txt-muted)">
            ${crisp.risk.value.toFixed(0)}
          </div>
          <div class="algo-card-sub">
            Линейная формула без правил.
          </div>
        </div>
      </div>

      <div class="section-label" style="margin-top:24px;">Детальные значения</div>
      <div style="overflow-x:auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Показатель</th>
              <th>Мамдани</th>
              <th>Сугено</th>
              <th>Чёткая</th>
            </tr>
          </thead>
          <tbody>
            ${compareRow("Риск", mamdani.risk.value, sugeno.risk.value, crisp.risk.value)}
            ${compareRow("Готовность", mamdani.ready.value, sugeno.ready.value, crisp.ready.value)}
            ${compareRow("Рейтинг", mamdani.rating.value, sugeno.rating.value, crisp.rating.value)}
          </tbody>
        </table>
      </div>

      <div class="mamdani-explain" style="margin-top:20px;">
        <b>Почему Мамдани?</b>
        <ul style="margin:10px 0 0 20px;line-height:1.7;">
          <li><b>Прозрачность.</b> Каждое правило понятно человеку.</li>
          <li><b>Объяснимость.</b> Видно, какие правила сработали и почему.</li>
          <li><b>Устойчивость.</b> Небольшие изменения входов плавно меняют вывод.</li>
          <li><b>Гибкость.</b> Правила можно добавлять без изменения кода.</li>
        </ul>
      </div>
    `;
    }

    function compareRow(label, m, s, c) {
        return `
      <tr>
        <td><b>${escapeHtml(label)}</b></td>
        <td>${m.toFixed(1)}</td>
        <td>${s.toFixed(1)}</td>
        <td>${c.toFixed(1)}</td>
      </tr>
    `;
    }

    function renderHistory(work) {
        const comments = Storage.getCommentsByWork(work.id);
        const stages = Storage.getStagesByWork(work.id);

        const events = [
            { time: work.createdAt, label: "Создана" },
            ...stages
                .filter((s) => s.completedAt)
                .map((s) => ({
                    time: s.completedAt,
                    label: `Этап: ${s.name}`,
                })),
            ...comments.map((c) => ({
                time: c.createdAt,
                label: "Комментарий",
            })),
        ].sort((a, b) => a.time - b.time);

        if (events.length < 2) return "";

        return `
      <div class="mamdani-history">
        <div class="mamdani-section-title">
          ${SVG.activity({ cls: "icon icon-sm" })}
          История работы (${events.length} событий)
        </div>
        <div class="history-list">
          ${events
              .slice(-5)
              .reverse()
              .map(
                  (e) => `
            <div class="history-item">
              <div class="history-dot"></div>
              <div class="history-time">${fmtDateTime(e.time)}</div>
              <div class="history-label">${escapeHtml(e.label)}</div>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>
    `;
    }

    function drawCharts() {
        if (typeof Charts === "undefined") return;
        if (!Charts.hasChart()) return;

        const work = Storage.getWorkById(selectedWorkId);
        if (!work) return;

        const inputs = buildInputs(work);
        if (!inputs) return;
        const result = Utils.safeFuzzyInfer(inputs);
        if (!result) return;

        const C = {
            ok: Charts.COLORS.ok,
            warn: Charts.COLORS.warn,
            bad: Charts.COLORS.bad,
            accent: Charts.COLORS.accent,
            txt: Charts.COLORS.txt,
            line: Charts.COLORS.line,
        };

        const aggrCanvas = document.getElementById("vizAggrChart");
        if (aggrCanvas) {
            if (aggrCanvas._chart) {
                try {
                    aggrCanvas._chart.destroy();
                } catch (e) {}
                aggrCanvas._chart = null;
            }

            const x = Array.from({ length: 101 }, (_, i) => i);
            const acc = result.risk.acc;
            const dataLow = x.map((v) =>
                Math.min(acc.low, Fuzzy.OUT.risk.low(v)),
            );
            const dataMed = x.map((v) =>
                Math.min(acc.med, Fuzzy.OUT.risk.med(v)),
            );
            const dataHigh = x.map((v) =>
                Math.min(acc.high, Fuzzy.OUT.risk.high(v)),
            );
            const dataMax = x.map((v, i) =>
                Math.max(dataLow[i], dataMed[i], dataHigh[i]),
            );

            aggrCanvas._chart = new Chart(aggrCanvas, {
                type: "line",
                data: {
                    labels: x,
                    datasets: [
                        {
                            label: "Низкий",
                            data: dataLow,
                            borderColor: C.ok,
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: false,
                        },
                        {
                            label: "Средний",
                            data: dataMed,
                            borderColor: C.warn,
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: false,
                        },
                        {
                            label: "Высокий",
                            data: dataHigh,
                            borderColor: C.bad,
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: false,
                        },
                        {
                            label: "Итоговая функция",
                            data: dataMax,
                            borderColor: C.accent,
                            borderWidth: 3,
                            pointRadius: 0,
                            fill: true,
                            backgroundColor: "rgba(99, 102, 241, 0.12)",
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: {
                        legend: {
                            labels: {
                                color: C.txt,
                                font: { size: 11 },
                                boxWidth: 12,
                                usePointStyle: true,
                            },
                        },
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: C.txt,
                                font: { size: 10 },
                                maxTicksLimit: 11,
                            },
                            grid: { color: C.line, drawBorder: false },
                            title: {
                                display: true,
                                text: "Риск (0 — низкий, 100 — высокий)",
                                color: C.txt,
                                font: { size: 11 },
                            },
                        },
                        y: {
                            min: 0,
                            max: 1,
                            ticks: { color: C.txt, font: { size: 10 } },
                            grid: { color: C.line, drawBorder: false },
                            title: {
                                display: true,
                                text: "Уверенность (μ)",
                                color: C.txt,
                                font: { size: 11 },
                            },
                        },
                    },
                },
            });
        }

        const defuzzCanvas = document.getElementById("vizDefuzzChart");
        if (defuzzCanvas) {
            if (defuzzCanvas._chart) {
                try {
                    defuzzCanvas._chart.destroy();
                } catch (e) {}
                defuzzCanvas._chart = null;
            }

            const x = Array.from({ length: 101 }, (_, i) => i);
            const acc = result.risk.acc;

            const dataLow = x.map((v) =>
                Math.min(acc.low, Fuzzy.OUT.risk.low(v)),
            );
            const dataMed = x.map((v) =>
                Math.min(acc.med, Fuzzy.OUT.risk.med(v)),
            );
            const dataHigh = x.map((v) =>
                Math.min(acc.high, Fuzzy.OUT.risk.high(v)),
            );
            const dataMax = x.map((v, i) =>
                Math.max(dataLow[i], dataMed[i], dataHigh[i]),
            );

            const centerValue = result.risk.value;

            defuzzCanvas._chart = new Chart(defuzzCanvas, {
                type: "line",
                data: {
                    labels: x,
                    datasets: [
                        {
                            label: "Итоговая функция",
                            data: dataMax,
                            borderColor: C.accent,
                            backgroundColor: "rgba(99, 102, 241, 0.18)",
                            borderWidth: 2.5,
                            pointRadius: 0,
                            fill: true,
                        },
                        {
                            label: `Центр тяжести = ${centerValue.toFixed(1)}`,
                            data: x.map((v) =>
                                Math.abs(v - centerValue) < 0.5
                                    ? dataMax[Math.round(v)] || 0.5
                                    : null,
                            ),
                            borderColor: C.bad,
                            borderWidth: 3,
                            pointRadius: 0,
                            fill: false,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: {
                        legend: {
                            labels: {
                                color: C.txt,
                                font: { size: 11 },
                                boxWidth: 12,
                                usePointStyle: true,
                            },
                        },
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: C.txt,
                                font: { size: 10 },
                                maxTicksLimit: 11,
                            },
                            grid: { color: C.line, drawBorder: false },
                            title: {
                                display: true,
                                text: "Риск (0 — низкий, 100 — высокий)",
                                color: C.txt,
                                font: { size: 11 },
                            },
                        },
                        y: {
                            min: 0,
                            max: 1,
                            ticks: { color: C.txt, font: { size: 10 } },
                            grid: { color: C.line, drawBorder: false },
                        },
                    },
                },
            });
        }
    }

    function step(s) {
        currentStep = s;
        renderView();
    }

    function selectWork(id) {
        if (!id) return;
        selectedWorkId = id;
        currentStep = "all";
        renderView();
    }

    function contactStudent(workId) {
        const work = Storage.getWorkById(workId);
        if (!work) return;
        const student = Storage.getUserById(work.studentId);
        if (!student) return;
        App.toast(`Написать студенту: ${student.fio} (${student.email})`);
    }

    function openCommentModal(workId) {
        const html = `
      <div class="modal-back" onclick="if(event.target===this) App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Добавить комментарий</h3>
            <button class="modal-close" onclick="App.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Текст комментария</label>
            <textarea id="mamdani_comment" rows="4" placeholder="Что нужно доработать..."></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="App.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="MamdaniViz.saveComment('${workId}')">Отправить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveComment(workId) {
        const text = document.getElementById("mamdani_comment")?.value.trim();
        if (!text) {
            App.toast("Введите текст");
            return;
        }

        const work = Storage.getWorkById(workId);
        if (!work) return;
        const user = Auth.getUser();
        if (!user) return;

        Storage.saveComment({
            id: uid(),
            workId,
            authorId: user.id,
            text,
            createdAt: Date.now(),
            kind: "review",
        });

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: work.studentId,
                type: "comment",
                title: "Новое замечание руководителя",
                text: text.slice(0, 100),
                link: { view: "my-work" },
            });
        }

        App.closeModal();
        App.toast("Комментарий добавлен");
        renderView();
    }

    function renderView() {
        const root = document.getElementById("viewRoot");
        if (!root) return;
        root.innerHTML = `<div class="view active">${render()}</div>`;

        setTimeout(() => drawCharts(), 50);
    }

    return {
        render,
        step,
        selectWork,
        contactStudent,
        openCommentModal,
        saveComment,
        renderView,
    };
})();
