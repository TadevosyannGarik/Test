/* =========================================================
   MF EDITOR — визуальный редактор функций принадлежности
   ========================================================= */
const MFEditor = (() => {
    const STORAGE_KEY = "fp_mf_overrides";

    const VAR_LABELS = {
        progress: "Прогресс",
        days: "Дни до дедлайна",
        activity: "Активность",
        edits: "Число правок",
        volume: "Объём",
        orig: "Оригинальность",
        supScore: "Оценка руководителя",
        gost: "Соответствие ГОСТу",
    };

    const DEFAULTS = {
        progress: { low: [0, 0, 50], med: [25, 50, 75], high: [50, 100, 100] },
        days: { low: [0, 0, 20], med: [10, 25, 40], high: [30, 60, 60] },
        activity: { low: [0, 0, 5], med: [3, 5, 8], high: [6, 10, 10] },
        edits: { low: [0, 0, 5], med: [3, 8, 13], high: [10, 20, 20] },
        volume: { low: [0, 0, 50], med: [30, 55, 80], high: [70, 100, 100] },
        orig: { low: [0, 0, 55], med: [40, 65, 85], high: [75, 100, 100] },
        supScore: { low: [0, 0, 5], med: [3, 5, 8], high: [6, 10, 10] },
        gost: { low: [0, 0, 60], med: [45, 70, 85], high: [75, 100, 100] },
    };

    let selectedVar = "progress";

    /* =========================================================
       OVERRIDES
       ========================================================= */
    function getOverrides() {
        const o = Storage.get(STORAGE_KEY, {});
        return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    }

    function setOverrides(o) {
        Storage.set(STORAGE_KEY, o);
        applyOverrides();
    }

    /* Используем trimf из Fuzzy (с корректной обработкой границ) */
    function _trimf(x, a, b, c) {
        if (typeof Fuzzy !== "undefined" && Fuzzy.trimf) {
            return Fuzzy.trimf(x, a, b, c);
        }
        if (x === a && a === b) return 1;
        if (x === c && b === c) return 1;
        if (x <= a || x >= c) return 0;
        if (x === b) return 1;
        return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
    }

    /* Применить все overrides */
    function applyOverrides() {
        const overrides = getOverrides();

        /* Сброс к DEFAULTS */
        for (const v in DEFAULTS) {
            if (!Fuzzy.MF[v]) continue;
            for (const t in DEFAULTS[v]) {
                const [a, b, c] = DEFAULTS[v][t];
                Fuzzy.MF[v][t] = (x) => _trimf(x, a, b, c);
            }
        }

        /* Применение overrides */
        for (const varName in overrides) {
            if (!Fuzzy.MF[varName]) continue;
            for (const term in overrides[varName]) {
                if (typeof Fuzzy.MF[varName][term] !== "function") continue;
                const tri = overrides[varName][term];
                if (!Array.isArray(tri) || tri.length !== 3) continue;
                const [a, b, c] = tri;
                Fuzzy.MF[varName][term] = (x) => _trimf(x, a, b, c);
            }
        }
    }

    function restoreVarDefaults(varName) {
        if (!Fuzzy.MF[varName] || !DEFAULTS[varName]) return;
        for (const t in DEFAULTS[varName]) {
            const [a, b, c] = DEFAULTS[varName][t];
            Fuzzy.MF[varName][t] = (x) => _trimf(x, a, b, c);
        }
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function render() {
        const overrides = getOverrides();
        const currentDef = JSON.parse(JSON.stringify(DEFAULTS[selectedVar]));
        if (overrides[selectedVar]) {
            for (const t in overrides[selectedVar]) {
                currentDef[t] = overrides[selectedVar][t];
            }
        }

        return `
      <div class="card">
        <div class="card-title">Редактор функций принадлежности</div>

        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Настройте треугольные функции принадлежности для каждой переменной.
          Изменения применяются мгновенно ко всем расчётам системы.
        </p>

        <div class="section-label">Переменная</div>
        <div class="mf-vars">
          ${Object.keys(DEFAULTS)
              .map(
                  (v) => `
            <div class="mf-var-card ${selectedVar === v ? "active" : ""}"
              onclick="MFEditor.selectVar('${v}')">
              <div class="mf-var-name">${VAR_LABELS[v] || v}</div>
              <div class="mf-var-terms">low / med / high</div>
            </div>
          `,
              )
              .join("")}
        </div>

        <div class="section-label" style="margin-top:24px;">
          Функции принадлежности для «${VAR_LABELS[selectedVar] || selectedVar}»
        </div>

        <div class="mf-canvas-wrap">
          <canvas id="mfCanvas"></canvas>
        </div>

        <div class="grid grid-3 mt-16">
          ${["low", "med", "high"].map((t) => renderTermCard(t, currentDef[t])).join("")}
        </div>

        <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;">
          <button class="btn-ghost btn-sm" onclick="MFEditor.resetVar()">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Сбросить переменную</span>
          </button>
          <button class="btn-ghost btn-sm btn-danger" onclick="MFEditor.resetAll()">
            ${SVG.trash({ cls: "icon icon-sm" })}
            <span>Сбросить все ФП</span>
          </button>
        </div>
      </div>
    `;
    }

    function renderTermCard(term, tri) {
        const colors = {
            low: "var(--ok)",
            med: "var(--warn)",
            high: "var(--bad)",
        };
        return `
      <div class="stat-card">
        <div class="stat-card-row">
          <span class="stat-card-label">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colors[term]};margin-right:6px;"></span>
            ${term}
          </span>
        </div>
        <div style="font-size:11px;color:var(--txt-muted);margin-bottom:8px;">
          Треугольник: (a=${tri[0]}, b=${tri[1]}, c=${tri[2]})
        </div>
        <div class="row-2" style="gap:6px;">
          <div>
            <label style="font-size:10px;color:var(--txt-muted);">a</label>
            <input type="number" value="${tri[0]}" min="0" max="100"
              onchange="MFEditor.updateTri('${term}', 0, +this.value)"
              style="width:100%;padding:5px 8px;font-size:12px;">
          </div>
          <div>
            <label style="font-size:10px;color:var(--txt-muted);">b</label>
            <input type="number" value="${tri[1]}" min="0" max="100"
              onchange="MFEditor.updateTri('${term}', 1, +this.value)"
              style="width:100%;padding:5px 8px;font-size:12px;">
          </div>
          <div>
            <label style="font-size:10px;color:var(--txt-muted);">c</label>
            <input type="number" value="${tri[2]}" min="0" max="100"
              onchange="MFEditor.updateTri('${term}', 2, +this.value)"
              style="width:100%;padding:5px 8px;font-size:12px;">
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ДЕЙСТВИЯ
       ========================================================= */
    function selectVar(v) {
        if (!DEFAULTS[v]) return;
        selectedVar = v;
        renderView();
    }

    function updateTri(term, idx, val) {
        val = Math.max(0, Math.min(100, isNaN(+val) ? 0 : +val));

        const overrides = getOverrides();
        if (!overrides[selectedVar]) {
            overrides[selectedVar] = JSON.parse(
                JSON.stringify(DEFAULTS[selectedVar]),
            );
        }

        overrides[selectedVar][term][idx] = val;

        const tri = overrides[selectedVar][term];
        tri[1] = Math.max(0, Math.min(100, tri[1]));
        tri[0] = Math.max(0, Math.min(tri[1], tri[0]));
        tri[2] = Math.max(tri[1], Math.min(100, tri[2]));

        setOverrides(overrides);
        renderView();
    }

    function resetVar() {
        const overrides = getOverrides();
        delete overrides[selectedVar];
        setOverrides(overrides);
        restoreVarDefaults(selectedVar);
        renderView();
        if (typeof App !== "undefined" && App.toast) {
            App.toast(`Сброшено: ${VAR_LABELS[selectedVar] || selectedVar}`);
        }
    }

    function resetAll() {
        if (
            !confirm(
                "Сбросить все функции принадлежности к значениям по умолчанию?",
            )
        )
            return;

        Storage.remove(STORAGE_KEY);

        for (const v in DEFAULTS) {
            restoreVarDefaults(v);
        }

        renderView();
        if (typeof App !== "undefined" && App.toast) {
            App.toast("Все ФП сброшены к значениям по умолчанию");
        }
    }

    /* =========================================================
       РЕНДЕР CANVAS
       ========================================================= */
    function renderView() {
        const root = document.getElementById("viewRoot");
        if (!root) return;
        root.innerHTML = `<div class="view active">${render()}</div>`;
        setTimeout(drawCanvas, 0);
    }

    function drawCanvas() {
        const canvas = document.getElementById("mfCanvas");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.offsetWidth;
        const cssH = canvas.offsetHeight;

        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const w = cssW;
        const h = cssH;

        const cs = getComputedStyle(document.documentElement);
        const get = (n, f) => cs.getPropertyValue(n).trim() || f;
        const colorLine = get("--line", "#e4e4e7");
        const colorTxt = get("--txt-muted", "#71717a");
        const colorTxtSoft = get("--txt-soft", "#a1a1aa");
        const colors = {
            low: get("--ok", "#10b981"),
            med: get("--warn", "#f59e0b"),
            high: get("--bad", "#ef4444"),
        };

        ctx.clearRect(0, 0, w, h);

        /* Сетка */
        ctx.strokeStyle = colorLine;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (w * i) / 10;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let i = 0; i <= 4; i++) {
            const y = (h * i) / 4;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        /* Оси */
        ctx.strokeStyle = colorTxtSoft;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, h - 1);
        ctx.lineTo(w, h - 1);
        ctx.moveTo(1, 0);
        ctx.lineTo(1, h);
        ctx.stroke();

        /* Треугольники */
        const overrides = getOverrides();
        const currentDef = JSON.parse(JSON.stringify(DEFAULTS[selectedVar]));
        if (overrides[selectedVar]) {
            for (const t in overrides[selectedVar]) {
                currentDef[t] = overrides[selectedVar][t];
            }
        }

        for (const term of ["low", "med", "high"]) {
            const [a, b, c] = currentDef[term];
            const xA = (a / 100) * w;
            const xB = (b / 100) * w;
            const xC = (c / 100) * w;

            ctx.beginPath();
            ctx.moveTo(xA, h);
            ctx.lineTo(xB, 0);
            ctx.lineTo(xC, h);
            ctx.strokeStyle = colors[term];
            ctx.lineWidth = 2.5;
            ctx.lineJoin = "round";
            ctx.stroke();

            ctx.fillStyle = colors[term];

            ctx.beginPath();
            ctx.arc(xB, 0, 5, 0, Math.PI * 2);
            ctx.fill();

            const bottomY = h - 2;
            ctx.beginPath();
            ctx.arc(xA, bottomY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(xC, bottomY, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = colors[term];
            ctx.font = "11px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(term, xB, 15);
        }

        /* Ось X */
        ctx.fillStyle = colorTxt;
        ctx.font = "10px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        for (let i = 0; i <= 10; i++) {
            ctx.fillText(i * 10, (w * i) / 10 + 3, h - 4);
        }
    }

    /* =========================================================
       АВТОПРИМЕНЕНИЕ
       ========================================================= */
    function init() {
        applyOverrides();
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        render,
        selectVar,
        updateTri,
        resetVar,
        resetAll,
        renderView,
        applyOverrides,
        init,
        DEFAULTS,
        VAR_LABELS,
        getOverrides,
        setOverrides,
    };
})();

document.addEventListener("DOMContentLoaded", () => {
    MFEditor.init();
});
