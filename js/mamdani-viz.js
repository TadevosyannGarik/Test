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

    function safeMF(varName, term, value) {
        const mf = Fuzzy.MF[varName];
        if (!mf || typeof mf[term] !== "function") return 0;
        return mf[term](value);
    }

    function getAvailableWorks(user) {
        if (!user) return [];
        if (user.role === "student") return Storage.getWorksByStudent(user.id);
        if (user.role === "teacher") return Storage.getWorksByTeacher(user.id);
        return Storage.getWorks();
    }

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
            orig: inputs.orig ?? 65,
            supScore: inputs.supScore ?? 5,
            gost: inputs.gost ?? 70,
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

        if (params?.workId) selectedWorkId = +params.workId;
        if (
            !selectedWorkId ||
            !works.find((w) => Storage.sameId(w.id, selectedWorkId))
        ) {
            selectedWorkId = works[0].id;
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

        const avg = computeAverage(user, selectedWorkId);

        return `
      ${renderWorkSelector(works, work)}
      ${renderHero(result, avg)}
      ${renderActions(work)}
      ${renderMainResult(result)}
      ${renderTodo(inputs, result)}
      ${renderFactors(inputs)}
      ${renderDetailedAnalysis(inputs, result, work)}
      ${renderHistory(work)}
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
        return `
      <div class="mamdani-actions">
        <button class="action-btn" onclick="MamdaniViz.contactStudent(${work.id})">
          ${SVG.messageCircle({ cls: "icon icon-sm" })}
          <span>Написать студенту</span>
        </button>
        <button class="action-btn" onclick="MamdaniViz.openCommentModal(${work.id})">
          ${SVG.edit({ cls: "icon icon-sm" })}
          <span>Добавить комментарий</span>
        </button>
        <button class="action-btn" onclick="PdfReport.exportStudent(${work.id})">
          ${SVG.fileText({ cls: "icon icon-sm" })}
          <span>Скачать PDF</span>
        </button>
      </div>
    `;
    }

    function renderMainResult(result) {
        const riskClass = Utils.riskClass(result.risk.term);
        const readyClass = Utils.readyClass(result.ready.term);

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
          <div class="main-side-card">
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
        if (inputs.gost < 70) {
            todos.push({
                icon: "📄",
                title: "Обратить внимание на ГОСТ",
                text: `Соответствие ${inputs.gost}% — нужно доработать`,
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
          <div class="metric-val" style="color:var(--accent)">
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
      </div>

      <div class="fuzz-table">
        ${vars
            .map((v) => {
                const val = inputs[v] ?? 0;
                const terms = ["low", "med", "high"].map((t) => ({
                    t,
                    mu: safeMF(v, t, val),
                }));
                const maxTerm = terms.reduce((a, b) => (a.mu > b.mu ? a : b));
                const explanation = TERM_EXPLAIN[v]?.[maxTerm.t] || "";

                return `
            <div class="fuzz-row">
              <div class="fuzz-name">
                <div style="font-weight:500;">${escapeHtml(VAR_NAMES[v])}</div>
                <div style="font-size:11px;color:var(--txt-muted);margin-top:2px;">
                  ${escapeHtml(explanation)}
                </div>
              </div>
              <div class="fuzz-value">${val}</div>
              <div class="fuzz-term">
                <span class="fuzz-term-badge ${maxTerm.t}">
                  ${escapeHtml(TERM_LABELS[maxTerm.t])} (${maxTerm.mu.toFixed(2)})
                </span>
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
        const num = +id;
        if (isNaN(num)) return;
        selectedWorkId = num;
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
            <button class="btn-primary" onclick="MamdaniViz.saveComment(${workId})">Отправить</button>
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
