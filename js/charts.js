const Charts = (() => {
    /* =========================================================
       ЧТЕНИЕ CSS-ПЕРЕМЕННОЙ
       ========================================================= */
    function cssVar(name, fallback) {
        try {
            const v = getComputedStyle(document.documentElement)
                .getPropertyValue(name)
                .trim();
            return v || fallback;
        } catch (e) {
            return fallback;
        }
    }

    /* =========================================================
       КЭШ ЦВЕТОВ

       _colors пересобирается вызовом refreshColors().
       Автоматически сбрасывается при:
         - смене prefers-color-scheme
         - изменении размера окна (на всякий случай)
       ========================================================= */
    let _colors = null;

    function getColors() {
        if (_colors) return _colors;
        _colors = {
            accent: cssVar("--accent", "#6366f1"),
            ok: cssVar("--ok", "#10b981"),
            warn: cssVar("--warn", "#f59e0b"),
            bad: cssVar("--bad", "#ef4444"),
            info: cssVar("--info", "#3b82f6"),
            purple: "#8b5cf6",
            txt: cssVar("--txt-muted", "#71717a"),
            txtSoft: cssVar("--txt-soft", "#a1a1aa"),
            line: cssVar("--line", "#e4e4e7"),
            bg: cssVar("--bg-elev", "#ffffff"),
        };
        return _colors;
    }

    /* =========================================================
       ПРОКСИ-ОБЁРТКА — всегда читает актуальные цвета
       ========================================================= */
    const COLORS = new Proxy(
        {},
        {
            get(_, key) {
                return getColors()[key];
            },
        },
    );

    /* =========================================================
       ПРОВЕРКА НАЛИЧИЯ CHART.JS
       ========================================================= */
    function hasChart() {
        return typeof Chart !== "undefined";
    }

    /* =========================================================
       ГЛУБОКОЕ СЛИЯНИЕ ОПЦИЙ
       ========================================================= */
    function deepMerge(target, source) {
        if (!source) return target;
        const out = { ...target };
        for (const key of Object.keys(source)) {
            const tv = target[key];
            const sv = source[key];
            if (
                tv &&
                sv &&
                typeof tv === "object" &&
                typeof sv === "object" &&
                !Array.isArray(tv) &&
                !Array.isArray(sv)
            ) {
                out[key] = deepMerge(tv, sv);
            } else {
                out[key] = sv;
            }
        }
        return out;
    }

    /* =========================================================
       БАЗОВЫЕ ОПЦИИ ДЛЯ ВСЕХ ГРАФИКОВ
       ========================================================= */
    function baseOpts(extra = {}) {
        const C = getColors();
        const base = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400, easing: "easeOutQuart" },
            plugins: {
                legend: {
                    labels: {
                        color: C.txt,
                        font: { size: 12, family: "Inter, sans-serif" },
                        padding: 12,
                        boxWidth: 12,
                        boxHeight: 12,
                        usePointStyle: true,
                    },
                },
                tooltip: {
                    backgroundColor: C.bg,
                    titleColor: C.txt,
                    bodyColor: C.txt,
                    borderColor: C.line,
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 6,
                    cornerRadius: 6,
                },
            },
            scales: {
                x: {
                    ticks: { color: C.txt, font: { size: 11 } },
                    grid: { color: C.line, drawBorder: false },
                },
                y: {
                    ticks: { color: C.txt, font: { size: 11 } },
                    grid: { color: C.line, drawBorder: false },
                },
            },
        };
        return deepMerge(base, extra);
    }

    /* =========================================================
       УНИЧТОЖЕНИЕ СТАРОГО ГРАФИКА
       ========================================================= */
    function destroyOld(ctx) {
        if (!ctx) return;
        if (ctx._chart) {
            try {
                ctx._chart.destroy();
            } catch (e) {}
            ctx._chart = null;
        }
        if (hasChart()) {
            try {
                const existing = Chart.getChart(ctx);
                if (existing) existing.destroy();
            } catch (e) {}
        }
    }

    /* =========================================================
       DOUGHNUT
       ========================================================= */
    function doughnut(canvasId, labels, data, colors) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: colors || [C.ok, C.warn, C.bad],
                        borderWidth: 0,
                        hoverOffset: 6,
                    },
                ],
            },
            options: baseOpts({
                plugins: {
                    legend: { position: "bottom", labels: { color: C.txt } },
                },
                cutout: "68%",
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       BAR
       ========================================================= */
    function bar(canvasId, labels, data, colors, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: opts.label || "",
                        data,
                        backgroundColor: colors || C.accent,
                        borderRadius: 6,
                        borderSkipped: false,
                        maxBarThickness: 32,
                    },
                ],
            },
            options: baseOpts({
                indexAxis: opts.horizontal ? "y" : "x",
                plugins: {
                    legend: { display: !!opts.label, labels: { color: C.txt } },
                },
                scales: {
                    x: {
                        min: 0,
                        max: opts.max ?? undefined,
                        ticks: { color: C.txt },
                        grid: { color: C.line, drawBorder: false },
                    },
                    y: {
                        ticks: { color: C.txt },
                        grid: { display: false, drawBorder: false },
                    },
                },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       LINE
       ========================================================= */
    function line(canvasId, labels, datasets, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: datasets.map((d) => ({
                    label: d.label,
                    data: d.data,
                    borderColor: d.color || C.accent,
                    backgroundColor: d.fill
                        ? hexToRgba(d.color || C.accent, 0.12)
                        : "transparent",
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: d.color || C.accent,
                    pointBorderColor: C.bg,
                    pointBorderWidth: 2,
                    fill: !!d.fill,
                })),
            },
            options: baseOpts({
                plugins: {
                    legend: {
                        display: datasets.length > 1,
                        labels: { color: C.txt },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: C.txt },
                        grid: { color: C.line, drawBorder: false },
                    },
                    y: {
                        min: opts.min ?? 0,
                        max: opts.max ?? undefined,
                        ticks: { color: C.txt },
                        grid: { color: C.line, drawBorder: false },
                    },
                },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       POLAR AREA
       ========================================================= */
    function polar(canvasId, labels, data, colors, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "polarArea",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: colors || [
                            C.accent,
                            C.purple,
                            C.ok,
                            C.warn,
                            C.bad,
                        ],
                        borderWidth: 0,
                    },
                ],
            },
            options: baseOpts({
                plugins: {
                    legend: {
                        position: opts.legendPosition || "bottom",
                        labels: { color: C.txt },
                    },
                },
                scales: {
                    r: {
                        ticks: {
                            color: C.txt,
                            backdropColor: "transparent",
                            font: { size: 10 },
                        },
                        grid: { color: C.line },
                        angleLines: { color: C.line },
                    },
                },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       RADAR
       ========================================================= */
    function radar(canvasId, labels, datasets, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "radar",
            data: {
                labels,
                datasets: datasets.map((d) => ({
                    label: d.label,
                    data: d.data,
                    borderColor: d.color || C.accent,
                    backgroundColor: hexToRgba(d.color || C.accent, 0.15),
                    borderWidth: 2,
                    pointBackgroundColor: d.color || C.accent,
                    pointBorderColor: C.bg,
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                })),
            },
            options: baseOpts({
                plugins: {
                    legend: {
                        display: datasets.length > 1,
                        labels: { color: C.txt },
                    },
                },
                scales: {
                    r: {
                        min: opts.min ?? 0,
                        max: opts.max ?? 100,
                        ticks: {
                            color: C.txt,
                            backdropColor: "transparent",
                            stepSize: opts.stepSize ?? 25,
                            font: { size: 10 },
                        },
                        grid: { color: C.line },
                        angleLines: { color: C.line },
                        pointLabels: { color: C.txt, font: { size: 11 } },
                    },
                },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       ЦВЕТ В RGBA
       ========================================================= */
    function hexToRgba(hex, alpha = 1) {
        if (!hex) return `rgba(0,0,0,${alpha})`;
        if (hex.startsWith("rgba")) return hex;
        hex = hex.replace("#", "");
        if (hex.length === 3)
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /* =========================================================
       СБРОС КЭША ЦВЕТОВ
       ========================================================= */
    function refreshColors() {
        _colors = null;
    }

    /* =========================================================
       АВТОМАТИЧЕСКАЯ РЕАКЦИЯ НА СМЕНУ ТЕМЫ
       ========================================================= */
    function initColorListeners() {
        // 1. Смена prefers-color-scheme (dark/light)
        if (window.matchMedia) {
            try {
                const mql = window.matchMedia("(prefers-color-scheme: dark)");
                // Современные браузеры
                if (typeof mql.addEventListener === "function") {
                    mql.addEventListener("change", () => {
                        refreshColors();
                    });
                } else if (typeof mql.addListener === "function") {
                    // Safari < 14
                    mql.addListener(() => {
                        refreshColors();
                    });
                }
            } catch (e) {
                console.warn("[Charts] matchMedia error:", e);
            }
        }
    }

    /* =========================================================
       ИНИЦИАЛИЗАЦИЯ
       ========================================================= */
    function init() {
        refreshColors();
        initColorListeners();
    }

    return {
        doughnut,
        bar,
        line,
        polar,
        radar,
        hasChart,
        COLORS,
        refreshColors,
        init,
    };
})();

/* =========================================================
   АВТОЗАПУСК ПОСЛЕ ЗАГРУЗКИ DOM
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    Charts.init();
});
