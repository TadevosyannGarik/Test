const Simulate = (() => {
    let workId = null;
    let currentWork = null;
    let baseCache = null;

    const escapeHtml = Utils.escapeHtml;
    const emptyState = Utils.emptyState;

    const SLIDER_ICONS = {
        s_progress: SVG.trending,
        s_days: SVG.calendar,
        s_activity: SVG.activity,
        s_edits: SVG.edit,
        s_volume: SVG.book,
        s_orig: SVG.search,
        s_supScore: SVG.graduation,
        s_gost: SVG.fileText,
    };

    function getUser() {
        return Auth.getUser();
    }

    function getAvailableWorks(user) {
        if (!user) return [];
        if (user.role === "student") return Storage.getWorksByStudent(user.id);
        if (user.role === "teacher") return Storage.getWorksByTeacher(user.id);
        return Storage.getWorks();
    }

    function getBaseInputs(work) {
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

    function render(params) {
        const user = getUser();
        if (!user) return emptyState("Не авторизован", "", SVG.lock);

        const works = getAvailableWorks(user);
        if (works.length === 0) {
            return emptyState(
                "Нет работы",
                user.role === "student"
                    ? "Создайте работу, чтобы запустить симулятор."
                    : "Пока нет работ, по которым можно провести симуляцию.",
                SVG.folder,
            );
        }

        if (params?.workId) workId = +params.workId;
        if (!workId || !works.find((w) => Storage.sameId(w.id, workId))) {
            workId = works[0].id;
        }

        currentWork = Storage.getWorkById(workId);
        if (!currentWork)
            return emptyState("Работа не найдена", "", SVG.folder);

        const base = getBaseInputs(currentWork);
        if (!base)
            return emptyState(
                "Не удалось собрать данные",
                "",
                SVG.alertTriangle,
            );

        baseCache = { ...base };
        const baseResult = Utils.safeFuzzyInfer(base);
        const currentResult = baseResult;

        return `
      <div class="sim-hero">
        <div class="sim-hero-icon">${SVG.sliders({ cls: "icon icon-xl" })}</div>
        <div class="sim-hero-body">
          <div class="sim-hero-title">Симулятор «Что если»</div>
          <div class="sim-hero-text">
            Двигайте ползунки — результат <b>пересчитывается мгновенно</b>.
            Можно понять, что будет, если студент ускорится или пропустит неделю.
          </div>
        </div>
      </div>

      <div class="sim-work">
        <div class="sim-work-info">
          <div class="sim-work-label">Работа</div>
          <div class="sim-work-topic">${escapeHtml(currentWork.topic)}</div>
        </div>
        <select onchange="Simulate.selectWork(this.value)" class="sim-select">
          ${works
              .map(
                  (w) => `
            <option value="${w.id}" ${Storage.sameId(w.id, workId) ? "selected" : ""}>
              ${escapeHtml(w.topic.slice(0, 60))}${w.topic.length > 60 ? "…" : ""}
            </option>
          `,
              )
              .join("")}
        </select>
      </div>

      <div class="sim-scenarios">
        <div class="sim-scenarios-label">
          ${SVG.zap({ cls: "icon icon-sm" })}
          Быстрые сценарии
        </div>
        <div class="sim-scenarios-grid">
          <button class="sim-scenario" onclick="Simulate.applyScenario('faster')">
            <div class="sim-scenario-icon">${SVG.trending({ cls: "icon" })}</div>
            <div class="sim-scenario-body">
              <div class="sim-scenario-title">Студент ускорится</div>
              <div class="sim-scenario-desc">Прогресс +20%, активность +3</div>
            </div>
          </button>
          <button class="sim-scenario" onclick="Simulate.applyScenario('miss')">
            <div class="sim-scenario-icon">${SVG.clock({ cls: "icon" })}</div>
            <div class="sim-scenario-body">
              <div class="sim-scenario-title">Пропустит неделю</div>
              <div class="sim-scenario-desc">Дней −7, активность −2</div>
            </div>
          </button>
          <button class="sim-scenario" onclick="Simulate.applyScenario('better')">
            <div class="sim-scenario-icon">${SVG.star({ cls: "icon" })}</div>
            <div class="sim-scenario-body">
              <div class="sim-scenario-title">Лучше оформит</div>
              <div class="sim-scenario-desc">ГОСТ +20%, оригинальность +10%</div>
            </div>
          </button>
        </div>
      </div>

      <div class="sim-grid">
        <div class="sim-controls">
          <div class="sim-controls-title">
            ${SVG.sliders({ cls: "icon icon-sm" })}
            Входные параметры
          </div>
          ${slider("s_progress", "Прогресс", 0, 100, base.progress, "%")}
          ${slider("s_days", "Дней до дедлайна", 0, 60, base.days, "")}
          ${slider("s_activity", "Активность", 0, 10, base.activity, "")}
          ${slider("s_edits", "Число правок", 0, 20, base.edits, "")}
          ${slider("s_volume", "Объём", 0, 100, base.volume, "%")}
          ${slider("s_orig", "Оригинальность", 0, 100, base.orig, "%")}
          ${slider("s_supScore", "Оценка руководителя", 0, 10, base.supScore, "")}
          ${slider("s_gost", "Соответствие ГОСТу", 0, 100, base.gost, "%")}

          <button class="btn-ghost sim-reset" onclick="Simulate.reset()">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Сбросить к исходным</span>
          </button>
        </div>

        <div class="sim-result-panel">
          <div class="sim-result-title">
            ${SVG.target({ cls: "icon icon-sm" })}
            Результат
          </div>
          <div id="simResult">
            ${renderResult(base, baseResult, currentResult)}
          </div>
        </div>
      </div>
    `;
    }

    function slider(id, label, min, max, val, unit) {
        const IconFn = SLIDER_ICONS[id];
        return `
      <div class="sim-slider">
        <div class="sim-slider-head">
          <span class="sim-slider-label">
            ${IconFn ? IconFn({ cls: "icon icon-sm" }) : ""}
            ${escapeHtml(label)}
          </span>
          <span class="sim-slider-val" id="v_${id}">${val}${unit}</span>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" value="${val}"
          oninput="Simulate.onChange()">
      </div>
    `;
    }

    function renderResult(inputs, baseResult, result) {
        if (!baseResult || !result) return "";

        const riskDiff = result.risk.value - baseResult.risk.value;
        const readyDiff = result.ready.value - baseResult.ready.value;
        const ratingDiff = result.rating.value - baseResult.rating.value;

        return `
      <div class="sim-metrics">
        ${renderMetricCard("Риск", result.risk, riskDiff, false)}
        ${renderMetricCard("Готовность", result.ready, readyDiff, true)}
        ${renderMetricCard("Рейтинг", result.rating, ratingDiff, true)}
      </div>

      <div class="sim-compare">
        <div class="sim-compare-title">
          ${SVG.barChart({ cls: "icon icon-sm" })}
          Сравнение «до / после»
        </div>
        ${diffRow("Риск", baseResult.risk.value, result.risk.value, riskDiff, false)}
        ${diffRow("Готовность", baseResult.ready.value, result.ready.value, readyDiff, true)}
        ${diffRow("Рейтинг", baseResult.rating.value, result.rating.value, ratingDiff, true)}
      </div>

      <div class="sim-comment ${getCommentClass(riskDiff)}">
        <div class="sim-comment-icon">
            ${getCommentIcon(riskDiff)}
        </div>
        <div class="sim-comment-text">
            ${escapeHtml(describeChange(inputs, riskDiff))}
        </div>
      </div>
    `;
    }

    function renderMetricCard(label, data, diff, higherIsBetter) {
        const term = data.term;
        const valueColor =
            label === "Риск"
                ? Utils.riskClass(term)
                : label === "Готовность"
                  ? Utils.readyClass(term)
                  : "accent";

        const diffArrow = diff > 2 ? "up" : diff < -2 ? "down" : "";
        const diffClass =
            diffArrow === "up"
                ? higherIsBetter
                    ? "good"
                    : "bad"
                : diffArrow === "down"
                  ? higherIsBetter
                      ? "bad"
                      : "good"
                  : "";

        return `
      <div class="sim-metric">
        <div class="sim-metric-label">${escapeHtml(label)}</div>
        <div class="sim-metric-value" style="color:var(--${valueColor})">
          ${data.value.toFixed(0)}
        </div>
        <div class="sim-metric-term">${escapeHtml(Fuzzy.termLabel(term, label === "Риск" ? "risk" : label === "Готовность" ? "ready" : "rating"))}</div>
        ${
            diffArrow
                ? `
            <div class="sim-metric-diff ${diffClass}">
                ${diffArrow === "up" ? "▲" : "▼"} ${Math.abs(diff).toFixed(0)}
            </div>
        `
                : ""
        }
      </div>
    `;
    }

    function diffRow(label, before, after, diff, higherIsBetter) {
        const improved = higherIsBetter ? diff > 5 : diff < -5;
        const worsened = higherIsBetter ? diff < -5 : diff > 5;

        let cls = "";
        if (improved) cls = "better";
        else if (worsened) cls = "worse";

        const diffColor = improved ? "ok" : worsened ? "bad" : "txt-muted";
        const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
        const arrowColor = improved ? "ok" : worsened ? "bad" : "txt-muted";

        return `
      <div class="sim-diff">
        <div class="sim-diff-label">${escapeHtml(label)}</div>
        <div class="sim-diff-before">${before.toFixed(0)}</div>
        <div class="sim-diff-arrow">${SVG.arrowRight({ cls: "icon icon-xs" })}</div>
        <div class="sim-diff-after ${cls}">${after.toFixed(0)}</div>
        <div class="sim-diff-delta" style="color:var(--${diffColor})">
          <span class="sim-diff-delta-arrow" style="color:var(--${arrowColor})">${arrow}</span>
          <span>${diff > 0 ? "+" : ""}${diff.toFixed(0)}</span>
        </div>
      </div>
    `;
    }

    function getCommentClass(riskDiff) {
        if (riskDiff > 5) return "worse";
        if (riskDiff < -5) return "better";
        return "neutral";
    }

    function getCommentIcon(riskDiff) {
        if (riskDiff > 5) return SVG.alertTriangle({ cls: "icon" });
        if (riskDiff < -5) return SVG.checkCircle({ cls: "icon" });
        return SVG.info({ cls: "icon" });
    }

    function describeChange(inputs, riskDiff) {
        if (!baseCache) return "—";

        const changes = [];
        const labels = {
            progress: "прогресс",
            days: "дни до дедлайна",
            activity: "активность",
            edits: "правки",
            volume: "объём",
            orig: "оригинальность",
            supScore: "оценка руководителя",
            gost: "соответствие ГОСТу",
        };

        for (const k of Object.keys(inputs)) {
            const diff = inputs[k] - (baseCache[k] ?? 0);
            if (Math.abs(diff) >= 1) {
                const sign = diff > 0 ? "+" : "";
                changes.push(`${labels[k] || k}: ${sign}${diff.toFixed(0)}`);
            }
        }

        if (changes.length === 0) {
            return "Изменений нет — значения совпадают с исходными.";
        }

        let verdict = "";
        if (riskDiff > 5) verdict = "Риск вырос — стало хуже.";
        else if (riskDiff < -5) verdict = "Риск снизился — стало лучше.";
        else verdict = "Риск почти не изменился.";

        return `${verdict} Изменения: ${changes.join(", ")}.`;
    }

    function onChange() {
        const sliderIds = [
            "s_progress",
            "s_days",
            "s_activity",
            "s_edits",
            "s_volume",
            "s_orig",
            "s_supScore",
            "s_gost",
        ];
        const units = {
            s_progress: "%",
            s_days: "",
            s_activity: "",
            s_edits: "",
            s_volume: "%",
            s_orig: "%",
            s_supScore: "",
            s_gost: "%",
        };

        const inputs = {};
        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            inputs[key] = +el.value;
            const lbl = document.getElementById("v_" + id);
            if (lbl) lbl.textContent = el.value + (units[id] || "");
        });

        if (!baseCache && currentWork) {
            baseCache = getBaseInputs(currentWork);
        }
        if (!baseCache) return;

        const baseResult = Utils.safeFuzzyInfer(baseCache);
        const currentResult = Utils.safeFuzzyInfer(inputs);

        const box = document.getElementById("simResult");
        if (box) {
            box.innerHTML = renderResult(baseCache, baseResult, currentResult);
        }
    }

    function applyScenario(type) {
        if (!baseCache) return;

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const s = { ...baseCache };

        if (type === "faster") {
            s.progress = clamp(s.progress + 20, 0, 100);
            s.volume = clamp(s.volume + 20, 0, 100);
            s.activity = clamp(s.activity + 3, 0, 10);
        } else if (type === "miss") {
            s.days = clamp(s.days - 7, 0, 60);
            s.activity = clamp(s.activity - 2, 0, 10);
        } else if (type === "better") {
            s.gost = clamp(s.gost + 20, 0, 100);
            s.orig = clamp(s.orig + 10, 0, 100);
        }

        const sliderIds = [
            "s_progress",
            "s_days",
            "s_activity",
            "s_edits",
            "s_volume",
            "s_orig",
            "s_supScore",
            "s_gost",
        ];
        const units = {
            s_progress: "%",
            s_volume: "%",
            s_orig: "%",
            s_gost: "%",
        };

        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            el.value = s[key];
            const lbl = document.getElementById("v_" + id);
            if (lbl) lbl.textContent = s[key] + (units[id] || "");
        });

        onChange();

        const labels = {
            faster: "Сценарий применён: студент ускорился",
            miss: "Сценарий применён: пропуск недели",
            better: "Сценарий применён: лучшее оформление",
        };
        if (typeof App !== "undefined" && App.toast) {
            App.toast(labels[type] || "Сценарий применён");
        }
    }

    function reset() {
        if (!currentWork) return;
        baseCache = getBaseInputs(currentWork);
        if (!baseCache) return;

        const sliderIds = [
            "s_progress",
            "s_days",
            "s_activity",
            "s_edits",
            "s_volume",
            "s_orig",
            "s_supScore",
            "s_gost",
        ];
        const units = {
            s_progress: "%",
            s_volume: "%",
            s_orig: "%",
            s_gost: "%",
        };

        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            el.value = baseCache[key];
            const lbl = document.getElementById("v_" + id);
            if (lbl) lbl.textContent = baseCache[key] + (units[id] || "");
        });

        onChange();
        if (typeof App !== "undefined" && App.toast) {
            App.toast("Значения сброшены");
        }
    }

    function selectWork(id) {
        const num = +id;
        if (isNaN(num)) return;
        workId = num;
        baseCache = null;
        renderView();
    }

    function renderView() {
        const root = document.getElementById("viewRoot");
        if (!root) return;
        root.innerHTML = `<div class="view active">${render()}</div>`;
    }

    return {
        render,
        onChange,
        reset,
        selectWork,
        applyScenario,
        renderView,
    };
})();
