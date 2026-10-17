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
            return statusScore * 1000 - progress;
        }

        const sorted = [...works].sort((a, b) => score(a) - score(b));
        return sorted[0];
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

    /* ---------- Склонение слова «день» ---------- */
    function pluralDays(n) {
        const n10 = n % 10;
        const n100 = n % 100;
        if (n10 === 1 && n100 !== 11) return "день";
        if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "дня";
        return "дней";
    }

    /* =========================================================
       ГЛАВНЫЙ РЕНДЕР
       ========================================================= */
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
  <div class="mamdani-header-row">
    ${renderWorkSelector(works, work)}
    ${renderStatusBanner(result, work, inputs)}
  </div>
  ${renderHowItWorks()}
  ${renderThreeNumbers(result)}
  ${renderForecast(result, work, inputs)}
  <div class="mamdani-two-col">
    ${renderQuickActions(result, work, inputs)}
    ${renderFactors(inputs, work)}
  </div>
  ${renderDetailedAnalysis(inputs, result, work)}
  ${renderHistory(work)}
`;
    }

    /* =========================================================
       БЛОК «КАК ЭТО РАБОТАЕТ»
       ========================================================= */
    function renderHowItWorks() {
        return `
      <div class="how-it-works">
        <div class="how-head">
          ${SVG.brain({ cls: "icon icon-lg" })}
          <div>
            <div class="how-title">Как система считает оценку</div>
            <div class="how-sub">Не нужно разбираться в нечёткой логике — просто поймите идею</div>
          </div>
          <button class="how-toggle" onclick="MamdaniViz.toggleHowItWorks(this)" type="button">
            Показать
          </button>
        </div>
        <div class="how-body" style="display:none;">
          <div class="how-grid">
            <div class="how-step">
              <div class="how-step-num">1</div>
              <div class="how-step-title">Смотрим на ваши цифры</div>
              <div class="how-step-text">
                Система берёт <b>прогресс, дни до дедлайна, активность,
                число правок</b> и ещё несколько показателей.
              </div>
            </div>
            <div class="how-step">
              <div class="how-step-num">2</div>
              <div class="how-step-title">Оцениваем «на глаз»</div>
              <div class="how-step-text">
                Например, прогресс 73% — это «<b>высокий</b>».
                А 12 дней до дедлайна — это «<b>мало</b>». Так же,
                как вы бы сказали вслух.
              </div>
            </div>
            <div class="how-step">
              <div class="how-step-num">3</div>
              <div class="how-step-title">Применяем правила</div>
              <div class="how-step-text">
                В системе <b>46 правил</b> вида: <i>«ЕСЛИ прогресс высокий
                И дней мало — ТО риск высокий»</i>. Одни правила
                срабатывают сильно, другие — слабо.
              </div>
            </div>
            <div class="how-step">
              <div class="how-step-num">4</div>
              <div class="how-step-title">Получаем итог</div>
              <div class="how-step-text">
                Система объединяет все сработавшие правила и получает
                три числа: <b>риск</b>, <b>готовность</b>, <b>рейтинг</b> —
                каждое от 0 до 100.
              </div>
            </div>
          </div>
          <div class="how-example">
            <b>Пример:</b> если прогресс высокий (73%) и до дедлайна много дней
            — риск будет низким. А если прогресс низкий и дней мало — риск
            высокий. Это и есть «нечёткий вывод по Мамдани» — он работает
            примерно так, как рассуждает человек.
          </div>
        </div>
      </div>
    `;
    }

    function toggleHowItWorks(btn) {
        const body = btn.closest(".how-it-works").querySelector(".how-body");
        const isHidden = body.style.display === "none";
        body.style.display = isHidden ? "block" : "none";
        btn.textContent = isHidden ? "Скрыть" : "Показать";
    }

    /* =========================================================
       БАННЕР СТАТУСА (с фиксом просрочки)
       ========================================================= */
    function renderStatusBanner(result, work, inputs) {
        const riskTerm = result.risk.term;
        const daysLeft = work.deadline ? daysUntil(work.deadline) : null;
        const isOverdue = daysLeft !== null && daysLeft < 0;

        let status = {};

        if (isOverdue) {
            status = {
                icon: SVG.alertTriangle,
                cls: "bad",
                title: "Дедлайн просрочен",
                text: `Работа должна была быть сдана ${Math.abs(daysLeft)} ${pluralDays(Math.abs(daysLeft))} назад. Срочно свяжитесь с руководителем и обсудите новые сроки.`,
            };
        } else if (riskTerm === "low") {
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

        let daysText = "";
        if (daysLeft !== null) {
            if (daysLeft < 0) {
                daysText = `Просрочено на ${Math.abs(daysLeft)} ${pluralDays(Math.abs(daysLeft))}`;
            } else if (daysLeft === 0) {
                daysText = "Дедлайн — сегодня";
            } else if (daysLeft <= 7) {
                daysText = `До дедлайна ${daysLeft} ${pluralDays(daysLeft)} — осталось мало времени`;
            } else {
                daysText = `До дедлайна ${daysLeft} ${pluralDays(daysLeft)}`;
            }
        }

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
       ТРИ ГЛАВНЫЕ ЦИФРЫ
       ========================================================= */
    function renderThreeNumbers(result) {
        const riskTerm = result.risk.term;
        const readyTerm = result.ready.term;
        const ratingTerm = result.rating.term;

        const riskColor = Utils.riskClass(riskTerm);
        const readyColor = Utils.readyClass(readyTerm);
        const ratingColor = Utils.readyClass(ratingTerm);

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
       ПРОГНОЗ НА НЕДЕЛЮ (NEW)
       ========================================================= */
    function renderForecast(result, work, inputs) {
        const futureInputs = {
            ...inputs,
            days: Math.max(0, (inputs.days || 0) - 7),
        };
        const future = Utils.safeFuzzyInfer(futureInputs);
        if (!future) return "";

        const riskDiff = future.risk.value - result.risk.value;
        const isWorse = riskDiff > 3;
        const isBetter = riskDiff < -3;

        let verdict, verdictCls, iconFn;
        if (isWorse) {
            verdict = `Через неделю риск вырастет на ${riskDiff.toFixed(0)} — до ${future.risk.value.toFixed(0)}`;
            verdictCls = "bad";
            iconFn = SVG.alertTriangle;
        } else if (isBetter) {
            verdict = `Через неделю риск снизится на ${Math.abs(riskDiff).toFixed(0)} — до ${future.risk.value.toFixed(0)}`;
            verdictCls = "ok";
            iconFn = SVG.trending;
        } else {
            verdict = "Если ничего не менять — риск останется примерно тем же";
            verdictCls = "neutral";
            iconFn = SVG.info;
        }

        return `
      <div class="forecast-card forecast-${verdictCls}">
        <div class="forecast-icon">
          ${iconFn({ cls: "icon icon-lg" })}
        </div>
        <div class="forecast-body">
          <div class="forecast-title">Прогноз на неделю</div>
          <div class="forecast-text">${verdict}</div>
        </div>
        <div class="forecast-nums">
          <div class="forecast-num">
            <div class="forecast-num-lbl">сейчас</div>
            <div class="forecast-num-val">${result.risk.value.toFixed(0)}</div>
          </div>
          <div class="forecast-num-arrow">→</div>
          <div class="forecast-num">
            <div class="forecast-num-lbl">через 7 дней</div>
            <div class="forecast-num-val forecast-num-val--${verdictCls}">${future.risk.value.toFixed(0)}</div>
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       БЫСТРЫЕ ДЕЙСТВИЯ (с фиксом просрочки)
       ========================================================= */
    function renderQuickActions(result, work, inputs) {
        const actions = [];

        // 1. Просрочен дедлайн — самая срочная проблема
        if (work.deadline && daysUntil(work.deadline) < 0) {
            actions.push({
                icon: SVG.alertTriangle,
                title: "Дедлайн уже прошёл",
                text: `Свяжитесь с руководителем — обсудите новые сроки и план действий.`,
                btnText: "Написать руководителю",
                onclick: `App.navigate('consultations')`,
                cls: "bad",
            });
        } else if (work.deadline && daysUntil(work.deadline) <= 7) {
            const d = daysUntil(work.deadline);
            actions.push({
                icon: SVG.clock,
                title: "Сроки поджимают",
                text: `До дедлайна ${d} ${pluralDays(d)}. Запишитесь на консультацию.`,
                btnText: "Записаться на консультацию",
                onclick: `App.navigate('consultations')`,
                cls: "bad",
            });
        }

        // 2. Прогресс низкий
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

        // 3. ГОСТ
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

        // 4. Активность низкая
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

        // 5. Нет оценки руководителя
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
          <span class="qa-head-count">${actions.length}</span>
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

    /* =========================================================
       ФАКТОРЫ (с показом реальных дней)
       ========================================================= */
    function renderFactors(inputs, work) {
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
                  let val = inputs[v] ?? 0;
                  let displayVal = val;
                  let unit = "";

                  // Для «дней до дедлайна» показываем реальное значение
                  if (v === "days" && work.deadline) {
                      const realDays = daysUntil(work.deadline);
                      displayVal = realDays;
                      val = Math.max(0, realDays);
                  }

                  const dt = Fuzzy.dominantTerm(v, val);
                  let meaning = FACTOR_MEANING[v]?.[dt.term] || "";
                  let termLabel = TERM_LABELS[dt.term];
                  let termCls = `factor-term-${dt.term}`;

                  // Переопределяем смысл и цвет для просроченного дедлайна
                  if (v === "days" && displayVal < 0) {
                      meaning = `просрочено на ${Math.abs(displayVal)} ${pluralDays(Math.abs(displayVal))}`;
                      termLabel = "просрочено";
                      termCls = "factor-term-high";
                  }

                  if (v === "progress") unit = "%";
                  if (v === "days") unit = " дн.";

                  return `
              <div class="factor-item">
                <div class="factor-item-head">
                  <span class="factor-item-name">${escapeHtml(VAR_NAMES[v])}</span>
                  <span class="factor-item-val">${displayVal}${unit}</span>
                  <span class="factor-item-term ${termCls}">
                    ${escapeHtml(termLabel)}
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

    /* =========================================================
       ПОДРОБНЫЙ РАЗБОР
       ========================================================= */
    function renderDetailedAnalysis(inputs, result, work) {
        return `
      <div class="mamdani-detailed-card">
    <div class="card-head">
      <div class="card-title">Подробный разбор</div>
    </div>
        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Пошагово — как система пришла к результату.
          Нажми на любой шаг, чтобы увидеть детали.
        </p>

        <div class="mamdani-tabs">
          ${renderTab("all", "Общий обзор")}
          ${renderTab("fuzz", "1. Оценка показателей")}
          ${renderTab("rules", "2. Сработавшие правила")}
          ${renderTab("aggr", "3. Агрегация")}
          ${renderTab("defuzz", "4. Дефаззификация")}
          ${renderTab("compare", "Сравнение алгоритмов")}
        </div>

        <div class="pipeline">
          ${pipelineStep(1, "Оценка", "числа → категории", currentStep === "fuzz")}
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

    /* =========================================================
       ОБЗОР
       ========================================================= */
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

    /* =========================================================
       ФАЗЗИФИКАЦИЯ
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
      <div class="mamdani-explain">
        <b>Шаг 1. Как система оценила каждый показатель</b>
        <br><br>
        Каждый показатель система относит к категории — <b>низкий</b>,
        <b>средний</b> или <b>высокий</b>. Рядом — «уверенность»
        от 0 до 1: чем ближе к 1, тем сильнее система склоняется
        к этой категории. Например, прогресс 73% — это уверенно
        «высокий», а 45% — «средний, с наклоном в низкий».
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

    /* =========================================================
       ПРАВИЛА
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
      <div class="mamdani-explain">
        <b>Шаг 2. Сработавшие правила</b>
        <br><br>
        Правила — основа системы. Каждое правило — «ЕСЛИ что-то ТО результат».
        Система берёт только те правила, у которых <b>посылка истинна</b>.
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

    /* =========================================================
       АГРЕГАЦИЯ
       ========================================================= */
    function renderAggrDetail(result) {
        const acc = result.risk.acc;

        return `
      <div class="mamdani-explain">
        <b>Шаг 3. Агрегация</b>
        <br><br>
        Агрегация — объединение сработавших правил для одного выхода.
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

    /* =========================================================
       ДЕФАЗЗИФИКАЦИЯ
       ========================================================= */
    function renderDefuzzDetail(result) {
        return `
      <div class="mamdani-explain">
        <b>Шаг 4. Дефаззификация</b>
        <br><br>
        Дефаззификация — превращение нечёткого результата обратно в
        <b>обычное число</b>. Система берёт «центр тяжести» —
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

    /* =========================================================
       СРАВНЕНИЕ
       ========================================================= */
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

    /* =========================================================
       ИСТОРИЯ
       ========================================================= */
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

    /* =========================================================
       СЕЛЕКТОР РАБОТЫ
       ========================================================= */
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

    /* =========================================================
       ГРАФИКИ
       ========================================================= */
    function drawCharts() {
        if (typeof Charts === "undefined" || !Charts.hasChart()) return;

        const work = Storage.getWorkById(selectedWorkId);
        if (!work) return;

        const inputs = buildInputs(work);
        if (!inputs) return;
        const result = Utils.safeFuzzyInfer(inputs);
        if (!result) return;

        const C = Charts.COLORS;

        /* ---------- График агрегации ---------- */
        const x = Array.from({ length: 101 }, (_, i) => i);
        const acc = result.risk.acc;

        const dataLow = x.map((v) => Math.min(acc.low, Fuzzy.OUT.risk.low(v)));
        const dataMed = x.map((v) => Math.min(acc.med, Fuzzy.OUT.risk.med(v)));
        const dataHigh = x.map((v) =>
            Math.min(acc.high, Fuzzy.OUT.risk.high(v)),
        );
        const dataMax = x.map((v, i) =>
            Math.max(dataLow[i], dataMed[i], dataHigh[i]),
        );

        Charts.line(
            "vizAggrChart",
            x,
            [
                {
                    label: "Низкий",
                    data: dataLow,
                    color: C.ok,
                    borderWidth: 1.5,
                    tension: 0,
                    fill: false,
                },
                {
                    label: "Средний",
                    data: dataMed,
                    color: C.warn,
                    borderWidth: 1.5,
                    tension: 0,
                    fill: false,
                },
                {
                    label: "Высокий",
                    data: dataHigh,
                    color: C.bad,
                    borderWidth: 1.5,
                    tension: 0,
                    fill: false,
                },
                {
                    label: "Итоговая функция",
                    data: dataMax,
                    color: C.accent,
                    borderWidth: 3,
                    tension: 0,
                    fill: true,
                    fillAlpha: 0.15,
                    order: -1,
                },
            ],
            {
                min: 0,
                max: 1,
                scales: {
                    x: {
                        ticks: {
                            color: C.txtMuted,
                            font: { size: 10 },
                            maxTicksLimit: 11,
                        },
                    },
                    y: {
                        min: 0,
                        max: 1,
                        ticks: { stepSize: 0.25 },
                    },
                },
            },
        );

        /* ---------- График дефаззификации ---------- */
        const centerValue = result.risk.value;
        const centerIndex = Math.round(centerValue);
        const centerY = dataMax[centerIndex] || 0.5;

        Charts.line(
            "vizDefuzzChart",
            x,
            [
                {
                    label: "Итоговая функция",
                    data: dataMax,
                    color: C.accent,
                    borderWidth: 2.5,
                    tension: 0,
                    fill: true,
                    fillAlpha: 0.2,
                },
                {
                    label: `Центр тяжести = ${centerValue.toFixed(1)}`,
                    data: x.map((v) => (v === centerIndex ? centerY : null)),
                    color: C.bad,
                    borderWidth: 0,
                    showLine: false,
                    pointRadius: 8,
                    pointBackgroundColor: C.bad,
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 3,
                    pointHoverRadius: 10,
                    spanGaps: true,
                },
            ],
            {
                min: 0,
                max: 1,
                scales: {
                    x: {
                        ticks: {
                            color: C.txtMuted,
                            font: { size: 10 },
                            maxTicksLimit: 11,
                        },
                    },
                    y: {
                        min: 0,
                        max: 1,
                        ticks: { stepSize: 0.25 },
                    },
                },
            },
        );
    }

    /* =========================================================
       ДЕЙСТВИЯ
       ========================================================= */
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
        toggleHowItWorks,
    };
})();
