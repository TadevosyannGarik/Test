/* =========================================================
   SIMULATE — «Что если» симулятор
   ========================================================= */
const Simulate = (() => {
    let workId = null;
    let currentWork = null;
    let baseCache = null;

    /* =========================================================
       РАБОТЫ ПО РОЛИ
       ========================================================= */
    function getAvailableWorks(user) {
        if (!user) return [];
        if (user.role === "student") return Storage.getWorksByStudent(user.id);
        if (user.role === "teacher") return Storage.getWorksByTeacher(user.id);
        return Storage.getWorks();
    }

    function emptyState(title, text, iconFn) {
        return `
      <div class="card">
        <div class="empty-state">
          ${iconFn ? iconFn({ cls: "icon icon-2xl" }) : SVG.alertTriangle({ cls: "icon icon-2xl" })}
          <h3>${title}</h3>
          ${text ? `<p>${text}</p>` : ""}
        </div>
      </div>
    `;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function render(params) {
        const user = Auth.getUser();
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

        baseCache = null;

        const base = getBaseInputs(currentWork);
        const currentResult = Fuzzy.infer(base);

        baseCache = { ...base };

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Симулятор «Что если»</div>
          <select onchange="Simulate.selectWork(this.value)"
            class="filters-select"
            style="padding:8px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg-elev);font-size:13px;color:var(--txt);outline:none;max-width:340px;">
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

        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Двигайте ползунки — система мгновенно пересчитает риск, готовность и рейтинг.
          Сравнение «до / после» покажет, как изменение входов повлияло на результат.
        </p>

        <div class="sim-grid">
          <div>
            <div class="section-label">Входные параметры</div>
            ${slider("s_progress", "Прогресс", 0, 100, base.progress, "%")}
            ${slider("s_days", "Дней до дедлайна", 0, 60, base.days, "")}
            ${slider("s_activity", "Активность", 0, 10, base.activity, "")}
            ${slider("s_edits", "Число правок", 0, 20, base.edits, "")}
            ${slider("s_volume", "Объём", 0, 100, base.volume, "%")}
            ${slider("s_orig", "Оригинальность", 0, 100, base.orig, "%")}
            ${slider("s_supScore", "Оценка руководителя", 0, 10, base.supScore, "")}
            ${slider("s_gost", "Соответствие ГОСТу", 0, 100, base.gost, "%")}

            <button class="btn-ghost btn-sm mt-8" onclick="Simulate.reset()">
              ${SVG.refresh({ cls: "icon icon-sm" })}
              <span>Сбросить к исходным</span>
            </button>
          </div>

          <div>
            <div class="section-label">Результат</div>
            <div id="simResult">
              ${renderResult(base, currentResult, currentResult)}
            </div>
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ВХОДЫ
       ========================================================= */
    function getBaseInputs(work) {
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
       ПОЛЗУНОК
       ========================================================= */
    function slider(id, label, min, max, val, unit) {
        return `
      <div class="slider-row">
        <label>
          <span>${label}</span>
          <span class="val" id="v_${id}">${val}${unit}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" value="${val}"
          oninput="Simulate.onChange()">
      </div>
    `;
    }

    /* =========================================================
       ИЗМЕНЕНИЕ
       ========================================================= */
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

        const baseResult = Fuzzy.infer(baseCache);
        const currentResult = Fuzzy.infer(inputs);

        const box = document.getElementById("simResult");
        if (box) {
            box.innerHTML = renderResult(baseCache, baseResult, currentResult);
        }
    }

    /* =========================================================
       РЕЗУЛЬТАТ
       ========================================================= */
    function renderResult(inputs, baseResult, result) {
        const riskDiff = result.risk.value - baseResult.risk.value;
        const readyDiff = result.ready.value - baseResult.ready.value;
        const ratingDiff = result.rating.value - baseResult.rating.value;

        return `
      <div class="metric-grid" style="margin-bottom:16px;">
        <div class="metric">
          <div class="metric-lbl">Риск</div>
          <div class="metric-val" style="color:var(--${result.risk.term === "high" ? "bad" : result.risk.term === "med" ? "warn" : "ok"})">
            ${result.risk.value.toFixed(0)}
          </div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Готовность</div>
          <div class="metric-val" style="color:var(--${result.ready.term === "high" ? "ok" : result.ready.term === "med" ? "warn" : "bad"})">
            ${result.ready.value.toFixed(0)}
          </div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Рейтинг</div>
          <div class="metric-val" style="color:var(--accent)">
            ${result.rating.value.toFixed(0)}
          </div>
        </div>
      </div>

      <div style="font-size:12px;color:var(--txt-muted);margin-bottom:8px;">
        Изменение относительно исходных значений:
      </div>

      ${diffRow("Риск", baseResult.risk.value, result.risk.value, riskDiff, false)}
      ${diffRow("Готовность", baseResult.ready.value, result.ready.value, readyDiff, true)}
      ${diffRow("Рейтинг", baseResult.rating.value, result.rating.value, ratingDiff, true)}

      <div class="explain" style="margin-top:14px;font-size:12px;">
        <b>Сценарий:</b> ${describeChange(inputs)}
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

        return `
      <div class="sim-diff">
        <div>
          <div style="font-size:11px;color:var(--txt-muted);">${label}</div>
          <div class="sim-diff-val">${before.toFixed(0)}</div>
        </div>
        <div class="sim-diff-arrow">→</div>
        <div>
          <div style="font-size:11px;color:var(--txt-muted);">Стало</div>
          <div class="sim-diff-val ${cls}">${after.toFixed(0)}</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-size:11px;color:var(--txt-muted);">Δ</div>
          <div style="font-weight:600;color:var(--${diffColor})">
            ${diff > 0 ? "+" : ""}${diff.toFixed(0)}
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ОПИСАНИЕ
       ========================================================= */
    function describeChange(inputs) {
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

        return changes.length === 0
            ? "Изменений нет — значения совпадают с исходными."
            : changes.join(", ");
    }

    /* =========================================================
       УПРАВЛЕНИЕ
       ========================================================= */
    function reset() {
        if (!currentWork) return;
        baseCache = getBaseInputs(currentWork);

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
        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            el.value = baseCache[key];
            const lbl = document.getElementById("v_" + id);
            if (lbl) {
                const units = {
                    s_progress: "%",
                    s_volume: "%",
                    s_orig: "%",
                    s_gost: "%",
                };
                lbl.textContent = el.value + (units[id] || "");
            }
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

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        render,
        onChange,
        reset,
        selectWork,
        renderView,
    };
})();
