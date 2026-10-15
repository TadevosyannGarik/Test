/* =========================================================
   MAMDANI VIZ — пошаговая визуализация нечёткого вывода
   ========================================================= */
const MamdaniViz = (() => {
    let selectedWorkId = null;
    let currentStep = "all";

    const VAR_NAMES = {
        progress: "Прогресс",
        days: "Дней до дедлайна",
        activity: "Активность",
        edits: "Правок",
        volume: "Объём",
        orig: "Оригинальность",
        supScore: "Оценка руководителя",
        gost: "ГОСТ",
    };

    /* =========================================================
       ХЕЛПЕРЫ
       ========================================================= */
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function emptyState(title, text, iconFn) {
        return `
      <div class="card">
        <div class="empty-state">
          ${iconFn ? iconFn({ cls: "icon icon-2xl" }) : SVG.alertTriangle({ cls: "icon icon-2xl" })}
          <h3>${escapeHtml(title)}</h3>
          ${text ? `<p>${text}</p>` : ""}
        </div>
      </div>
    `;
    }

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

    /* =========================================================
       ОСНОВНОЙ РЕНДЕР
       ========================================================= */
    function render(params) {
        const user = Auth.getUser();
        if (!user) return emptyState("Не авторизован", "", SVG.lock);

        const works = getAvailableWorks(user);
        if (works.length === 0) {
            return emptyState(
                "Нет работы",
                user.role === "student"
                    ? "Создайте работу, чтобы увидеть визуализацию нечёткого вывода."
                    : "Пока нет работ, по которым можно показать вывод.",
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
        const result = Fuzzy.infer(inputs);

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Живая визуализация Мамдани</div>
          <select onchange="MamdaniViz.selectWork(this.value)"
            class="filters-select"
            style="padding:8px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg-elev);font-size:13px;color:var(--txt);outline:none;max-width:340px;">
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
        <div style="font-size:12px;color:var(--txt-muted);margin-bottom:16px;">
          ${escapeHtml(work.topic)}
          · ${escapeHtml(Storage.getUserById(work.studentId)?.fio || "—")}
        </div>

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

        ${currentStep === "all" || currentStep === "defuzz" ? renderOutputSummary(inputs, result) : ""}
        ${currentStep === "all" ? Fuzzy.explain(inputs, result) : ""}
      </div>
    `;
    }

    function renderTab(id, label) {
        return `<button class="${currentStep === id ? "active" : ""}"
          onclick="MamdaniViz.step('${id}')">${label}</button>`;
    }

    function pipelineStep(num, title, sub, active) {
        return `
      <div class="pipeline-step ${active ? "active" : ""}">
        <div class="pipeline-step-num">${num}</div>
        <div class="pipeline-step-title">${title}</div>
        <div class="pipeline-step-sub">${sub}</div>
      </div>
    `;
    }

    function renderStep(inputs, result, work) {
        switch (currentStep) {
            case "all":
                return renderOverview(inputs, result);
            case "fuzz":
                return renderFuzz(inputs);
            case "rules":
                return renderRules(inputs, result);
            case "aggr":
                return renderAggr(result);
            case "defuzz":
                return renderDefuzz(result);
            case "compare":
                return renderCompare(inputs, result);
            default:
                return "";
        }
    }

    /* =========================================================
       ВХОДЫ
       ========================================================= */
    function buildInputs(work) {
        if (!work) return {};

        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);

        let progress = 0;
        if (stages.length > 0) {
            const totalW = stages.reduce((s, x) => s + (x.weight || 1), 0);
            const doneW = stages
                .filter((s) => s.done)
                .reduce((s, x) => s + (x.weight || 1), 0);
            progress = totalW > 0 ? Math.round((doneW / totalW) * 100) : 0;
        }

        const totalItems = stages.length + tasks.length;
        const doneItems =
            stages.filter((s) => s.done).length +
            tasks.filter((t) => t.col === "done").length;
        const activity =
            totalItems === 0 ? 5 : Math.round((doneItems / totalItems) * 10);

        const days = work.deadline ? Math.max(0, daysUntil(work.deadline)) : 30;

        return {
            progress,
            days,
            activity,
            edits: comments.length,
            volume: progress,
            orig: work.orig || 65,
            supScore: work.supScore || 5,
            gost: work.gost || 70,
        };
    }

    /* =========================================================
       ШАГ 1. ФАЗЗИФИКАЦИЯ
       ========================================================= */
    function renderFuzz(inputs) {
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
      <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
        Каждое входное значение превращается в степень принадлежности к термам
        <b>низкий</b>, <b>средний</b>, <b>высокий</b> (μ от 0 до 1).
      </p>
      <div style="display:grid;gap:8px;">
        ${vars
            .map((v) => {
                const val = inputs[v] ?? 0;
                const terms = ["low", "med", "high"].map((t) => ({
                    t,
                    mu: safeMF(v, t, val),
                }));
                const maxMu = Math.max(...terms.map((t) => t.mu));
                const activeTerms = terms.filter((t) => t.mu > 0.01);

                return `
            <div class="rule-fired" style="grid-template-columns: 160px 1fr 90px;">
              <div style="font-size:13px;font-weight:500;">${VAR_NAMES[v] || v}</div>
              <div>
                <div style="font-size:11px;color:var(--txt-muted);margin-bottom:4px;">
                  Значение: <b>${val}</b>
                  ${
                      activeTerms.length
                          ? " · термы: " +
                            activeTerms
                                .map((x) => `${x.t} (μ=${x.mu.toFixed(2)})`)
                                .join(", ")
                          : " · нет активных термов"
                  }
                </div>
                <div class="rule-fired-bar"><div style="width:${maxMu * 100}%"></div></div>
              </div>
              <div class="rule-mu">${maxMu.toFixed(2)}</div>
            </div>
          `;
            })
            .join("")}
      </div>
    `;
    }

    /* =========================================================
       ШАГ 2. ПРАВИЛА
       ========================================================= */
    function renderRules(inputs, result) {
        const allFired = [
            ...(result.risk.fired || []).map((f) => ({ ...f, kind: "risk" })),
            ...(result.ready.fired || []).map((f) => ({ ...f, kind: "ready" })),
            ...(result.rating.fired || []).map((f) => ({
                ...f,
                kind: "rating",
            })),
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

        const rules = Fuzzy.getRules();
        const borderline = rules
            .filter(
                (r) =>
                    r.enabled &&
                    !fired.find((f) => Storage.sameId(f.rule?.id, r.id)),
            )
            .map((r) => {
                const strengths = r.if.map((c) => {
                    const [v, t] = c.split("=");
                    return safeMF(v, t, inputs[v] ?? 0);
                });
                return {
                    rule: r,
                    minStrength: strengths.length ? Math.min(...strengths) : 0,
                };
            })
            .filter((x) => x.minStrength > 0.05 && x.minStrength < 0.3)
            .sort((a, b) => b.minStrength - a.minStrength)
            .slice(0, 5);

        return `
      <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
        Каждое правило применяется к фаззифицированным входам.
        Степень истинности — <b>минимум</b> по всем посылкам правила (оператор «И»).
      </p>

      <div class="section-label">Сработавшие правила (${fired.length})</div>
      ${
          fired.length === 0
              ? '<div class="empty" style="padding:20px;font-size:13px;">Ни одно правило не сработало с μ &gt; 0</div>'
              : fired.map((f) => renderFiredRule(f)).join("")
      }

      ${
          borderline.length > 0
              ? `
        <div class="section-label" style="margin-top:20px;">Пограничные (почти сработали)</div>
        <p style="font-size:12px;color:var(--txt-muted);margin-bottom:8px;">
          Эти правила были близки к срабатыванию. Изменение входов может их активировать.
        </p>
        ${borderline.map((b) => renderBorderlineRule(b)).join("")}
      `
              : ""
      }
    `;
    }

    function renderFiredRule(f) {
        const mu = f.strength;
        const cls = mu > 0.7 ? "high" : mu > 0.4 ? "med" : "low";
        const muCls = mu > 0.7 ? "mu-high" : mu > 0.4 ? "mu-med" : "mu-low";

        return `
      <div class="rule-fired ${cls} ${muCls}">
        <div class="rule-fired-id">#${f.rule.id}</div>
        <div class="rule-fired-body">
          <div class="rule-fired-title">${escapeHtml(f.rule.desc)}</div>
          <div class="rule-fired-if">ЕСЛИ ${f.rule.if.join(" И ")} → ТО ${f.rule.then}</div>
          <div class="rule-fired-bar"><div style="width:${mu * 100}%"></div></div>
        </div>
        <div class="rule-mu">μ = ${mu.toFixed(3)}</div>
      </div>
    `;
    }

    function renderBorderlineRule(b) {
        return `
      <div class="rule-fired borderline">
        <div class="rule-fired-id">#${b.rule.id}</div>
        <div class="rule-fired-body">
          <div class="rule-fired-title">${escapeHtml(b.rule.desc)}</div>
          <div class="rule-fired-if">ЕСЛИ ${b.rule.if.join(" И ")} → ТО ${b.rule.then}</div>
          <div class="rule-fired-bar"><div style="width:${b.minStrength * 100}%"></div></div>
        </div>
        <div class="rule-mu" style="color:var(--txt-muted)">μ = ${b.minStrength.toFixed(3)}</div>
      </div>
    `;
    }

    /* =========================================================
       ШАГ 3. АГРЕГАЦИЯ
       ========================================================= */
    function renderAggr(result) {
        const acc = result.risk.acc;
        return `
      <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
        Сработавшие правила для одного и того же выхода объединяются через оператор <b>max</b>.
      </p>

      <div class="grid grid-3">
        ${["low", "med", "high"]
            .map(
                (t) => `
          <div class="metric">
            <div class="metric-lbl">Терм «${t}»</div>
            <div class="metric-val">${(acc[t] || 0).toFixed(3)}</div>
            <div class="metric-sub">агрегированная μ</div>
          </div>
        `,
            )
            .join("")}
      </div>

      <div class="section-label" style="margin-top:16px;">Агрегированная функция риска</div>
      <div class="chart-box h-260">
        <canvas id="vizAggrChart"></canvas>
      </div>
    `;
    }

    /* =========================================================
       ШАГ 4. ДЕФАЗЗИФИКАЦИЯ
       ========================================================= */
    function renderDefuzz(result) {
        return `
      <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
        Из агрегированной функции принадлежности вычисляется <b>центр тяжести</b> —
        это и есть итоговое число риска.
      </p>

      <div class="grid grid-3">
        <div class="metric">
          <div class="metric-lbl">Итоговый риск</div>
          <div class="metric-val" style="color:var(--${result.risk.term === "high" ? "bad" : result.risk.term === "med" ? "warn" : "ok"})">
            ${result.risk.value.toFixed(1)}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(result.risk.term, "risk")}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Готовность</div>
          <div class="metric-val" style="color:var(--${result.ready.term === "high" ? "ok" : result.ready.term === "med" ? "warn" : "bad"})">
            ${result.ready.value.toFixed(1)}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(result.ready.term, "ready")}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Рейтинг</div>
          <div class="metric-val" style="color:var(--accent)">
            ${result.rating.value.toFixed(1)}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(result.rating.term, "rating")}</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:16px;">Центр тяжести</div>
      <div class="chart-box h-260">
        <canvas id="vizDefuzzChart"></canvas>
      </div>
    `;
    }

    /* =========================================================
       ШАГ 5. СРАВНЕНИЕ АЛГОРИТМОВ
       ========================================================= */
    function renderCompare(inputs, mamdani) {
        const sugeno = Fuzzy.sugenoInfer(inputs);
        const crisp = Fuzzy.crispInfer(inputs);

        return `
      <p style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
        Одна и та же работа, три разных метода оценки. Демонстрирует разницу в подходах.
      </p>

      <div class="algo-compare">
        <div class="algo-card selected">
          <div class="algo-card-badge">Наш выбор</div>
          <div class="algo-card-title">Мамдани</div>
          <div class="algo-card-value" style="color:var(--accent)">${mamdani.risk.value.toFixed(0)}</div>
          <div class="algo-card-sub">центр тяжести ФП</div>
        </div>
        <div class="algo-card">
          <div class="algo-card-title">Сугено</div>
          <div class="algo-card-value" style="color:var(--warn)">${sugeno.risk.value.toFixed(0)}</div>
          <div class="algo-card-sub">взвешенное среднее</div>
        </div>
        <div class="algo-card">
          <div class="algo-card-title">Чёткая формула</div>
          <div class="algo-card-value" style="color:var(--txt-muted)">${crisp.risk.value.toFixed(0)}</div>
          <div class="algo-card-sub">линейная комбинация</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:20px;">Детальные значения</div>
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

      <div class="explain" style="margin-top:16px;">
        <b>Почему Мамдани:</b>
        <ul>
          <li><b>Прозрачность.</b> Каждое правило читается как «ЕСЛИ... ТО...».</li>
          <li><b>Интерпретируемость.</b> Нечёткие правила учитывают нелинейные комбинации факторов.</li>
          <li><b>Устойчивость к шуму.</b> Небольшое изменение входов плавно меняет вывод.</li>
          <li><b>Гибкость.</b> Правила можно включать, выключать, добавлять без изменения кода.</li>
        </ul>
      </div>
    `;
    }

    function compareRow(label, m, s, c) {
        return `
      <tr>
        <td><b>${label}</b></td>
        <td>${m.toFixed(1)}</td>
        <td>${s.toFixed(1)}</td>
        <td>${c.toFixed(1)}</td>
      </tr>
    `;
    }

    /* =========================================================
       ИТОГОВЫЙ БЛОК
       ========================================================= */
    function renderOutputSummary(inputs, result) {
        return `
      <div class="output-summary">
        <h4>Итоговый вывод системы</h4>
        <div class="output-summary-line">
          <span>Риск срыва сроков</span>
          <b>${result.risk.value.toFixed(1)} / 100 · ${Fuzzy.termLabel(result.risk.term, "risk")}</b>
        </div>
        <div class="output-summary-line">
          <span>Готовность работы</span>
          <b>${result.ready.value.toFixed(1)} / 100 · ${Fuzzy.termLabel(result.ready.term, "ready")}</b>
        </div>
        <div class="output-summary-line">
          <span>Нечёткий рейтинг</span>
          <b>${result.rating.value.toFixed(1)} / 100 · ${Fuzzy.termLabel(result.rating.term, "rating")}</b>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ОБЗОР
       ========================================================= */
    function renderOverview(inputs, result) {
        return `
      <div class="grid grid-3">
        <div class="metric">
          <div class="metric-lbl">Риск срыва сроков</div>
          <div class="metric-val" style="color:var(--${result.risk.term === "high" ? "bad" : result.risk.term === "med" ? "warn" : "ok"})">
            ${result.risk.value.toFixed(1)}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(result.risk.term, "risk")}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Готовность</div>
          <div class="metric-val" style="color:var(--${result.ready.term === "high" ? "ok" : result.ready.term === "med" ? "warn" : "bad"})">
            ${result.ready.value.toFixed(1)}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(result.ready.term, "ready")}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Рейтинг</div>
          <div class="metric-val" style="color:var(--accent)">
            ${result.rating.value.toFixed(1)}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(result.rating.term, "rating")}</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:16px;">Ключевые факторы</div>
      <div style="display:grid;gap:6px;">
        ${["progress", "days", "activity", "edits"]
            .map((v) => {
                const val = inputs[v] ?? 0;
                const dt = Fuzzy.dominantTerm(v, val);
                const terms = ["low", "med", "high"].map((t) => ({
                    t,
                    mu: safeMF(v, t, val),
                }));
                const maxMu = Math.max(...terms.map((t) => t.mu));

                return `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;">
              <span style="width:150px;color:var(--txt-muted);">${VAR_NAMES[v] || v}</span>
              <span style="font-weight:500;width:50px;">${val}</span>
              <span style="color:var(--accent);width:80px;font-size:12px;">${dt.term}</span>
              <div class="rule-fired-bar" style="flex:1;">
                <div style="width:${maxMu * 100}%"></div>
              </div>
            </div>
          `;
            })
            .join("")}
      </div>
    `;
    }

    /* =========================================================
       ОБРАБОТЧИКИ
       ========================================================= */
    function step(s) {
        currentStep = s;
        renderView();
    }

    function selectWork(id) {
        const num = +id;
        if (isNaN(num)) return;
        selectedWorkId = num;
        renderView();
    }

    function renderView() {
        const work = Storage.getWorkById(selectedWorkId);
        if (!work) return;

        const inputs = buildInputs(work);
        const result = Fuzzy.infer(inputs);

        const root = document.getElementById("viewRoot");
        if (!root) return;

        root.innerHTML = `<div class="view active">${render()}</div>`;

        setTimeout(() => drawCharts(inputs, result), 0);
    }

    /* =========================================================
       ГРАФИКИ
       ========================================================= */
    function getChartColors() {
        const cs = getComputedStyle(document.documentElement);
        const get = (n, f) => cs.getPropertyValue(n).trim() || f;
        return {
            ok: get("--ok", "#10b981"),
            warn: get("--warn", "#f59e0b"),
            bad: get("--bad", "#ef4444"),
            accent: get("--accent", "#6366f1"),
            txt: get("--txt-muted", "#71717a"),
            line: get("--line", "#e4e4e7"),
        };
    }

    function drawCharts(inputs, result) {
        if (!Charts.hasChart()) return;
        const C = getChartColors();

        /* --- Агрегация --- */
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
                            label: "Агрегат",
                            data: dataMax,
                            borderColor: C.accent,
                            borderWidth: 2.5,
                            pointRadius: 0,
                            fill: true,
                            backgroundColor: C.accent + "20",
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: C.txt, font: { size: 11 } },
                        },
                    },
                    scales: {
                        x: {
                            ticks: { color: C.txt, maxTicksLimit: 11 },
                            grid: { color: C.line },
                        },
                        y: {
                            min: 0,
                            max: 1,
                            ticks: { color: C.txt },
                            grid: { color: C.line },
                        },
                    },
                },
            });
        }

        /* --- Дефаззификация --- */
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
            const agg = x.map((v) => {
                let mu = 0;
                for (const t of ["low", "med", "high"]) {
                    mu = Math.max(mu, Math.min(acc[t], Fuzzy.OUT.risk[t](v)));
                }
                return mu;
            });
            const cogPoint = x.map((v) =>
                Math.abs(v - result.risk.value) < 0.6 ? 1 : null,
            );

            defuzzCanvas._chart = new Chart(defuzzCanvas, {
                type: "line",
                data: {
                    labels: x,
                    datasets: [
                        {
                            label: "Агрегат",
                            data: agg,
                            borderColor: C.accent,
                            backgroundColor: C.accent + "30",
                            fill: true,
                            pointRadius: 0,
                            borderWidth: 2,
                        },
                        {
                            label: `Центр тяжести = ${result.risk.value.toFixed(1)}`,
                            data: cogPoint,
                            borderColor: C.bad,
                            pointRadius: 7,
                            pointBackgroundColor: C.bad,
                            showLine: false,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: C.txt, font: { size: 11 } },
                        },
                    },
                    scales: {
                        x: {
                            ticks: { color: C.txt, maxTicksLimit: 11 },
                            grid: { color: C.line },
                        },
                        y: {
                            min: 0,
                            max: 1,
                            ticks: { color: C.txt },
                            grid: { color: C.line },
                        },
                    },
                },
            });
        }
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        render,
        step,
        selectWork,
        renderView,
    };
})();
