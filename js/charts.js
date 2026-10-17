/* =========================================================
   CHARTS — Chart.js с ярким minimal-дизайном
   ========================================================= */

const Charts = (() => {
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

    /* ---------- Яркая палитра (как на референсе) ---------- */
    const PALETTE = {
        green: "#34d399",
        emerald: "#10b981",
        teal: "#14b8a6",
        cyan: "#22d3ee",
        sky: "#0ea5e9",
        blue: "#60a5fa",
        indigo: "#6366f1",
        purple: "#a78bfa",
        violet: "#8b5cf6",
        pink: "#f472b6",
        rose: "#f43f5e",
        red: "#f87171",
        orange: "#fb923c",
        amber: "#fbbf24",
        yellow: "#facc15",
        lime: "#a3e635",
    };

    /* ---------- Пары [светлый, тёмный] для градиентов ---------- */
    const GRADIENTS = [
        ["#34d399", "#059669"], // green
        ["#60a5fa", "#2563eb"], // blue
        ["#fb923c", "#ea580c"], // orange
        ["#f472b6", "#db2777"], // pink
        ["#a78bfa", "#7c3aed"], // purple
        ["#22d3ee", "#0891b2"], // cyan
        ["#fbbf24", "#d97706"], // amber
        ["#f87171", "#dc2626"], // red
        ["#14b8a6", "#0d9488"], // teal
        ["#a3e635", "#65a30d"], // lime
    ];

    /* ---------- Плоская палитра из пар ---------- */
    const FLAT_PALETTE = GRADIENTS.map((g) => g[0]);

    let _colors = null;
    function getColors() {
        if (_colors) return _colors;
        _colors = {
            txt: cssVar("--txt", "#18181b"),
            txtMuted: cssVar("--txt-muted", "#71717a"),
            txtSoft: cssVar("--txt-soft", "#a1a1aa"),
            accent: cssVar("--accent", "#5b5bd6"),
            ok: cssVar("--ok", "#059669"),
            warn: cssVar("--warn", "#d97706"),
            bad: cssVar("--bad", "#dc2626"),
            info: cssVar("--info", "#2563eb"),
        };
        return _colors;
    }

    const COLORS = new Proxy(
        {},
        {
            get(_, key) {
                return getColors()[key];
            },
        },
    );

    function hasChart() {
        return typeof Chart !== "undefined";
    }

    /* ---------- Глубокое слияние ---------- */
    function deepMerge(t, s) {
        if (!s) return t;
        const out = { ...t };
        for (const k of Object.keys(s)) {
            const tv = t[k];
            const sv = s[k];
            if (
                tv &&
                sv &&
                typeof tv === "object" &&
                typeof sv === "object" &&
                !Array.isArray(tv) &&
                !Array.isArray(sv)
            ) {
                out[k] = deepMerge(tv, sv);
            } else {
                out[k] = sv;
            }
        }
        return out;
    }

    /* ---------- Базовые опции ---------- */
    function baseOpts(extra = {}) {
        const C = getColors();
        const base = {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 8, right: 12, bottom: 4, left: 6 },
            },
            animation: {
                duration: 750,
                easing: "easeOutQuart",
            },
            interaction: { mode: "nearest", intersect: false },
            plugins: {
                legend: {
                    labels: {
                        color: C.txtMuted,
                        font: {
                            size: 11,
                            family: "Inter, sans-serif",
                            weight: "600",
                        },
                        padding: 14,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: "circle",
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(15, 15, 25, 0.94)",
                    titleColor: "#fff",
                    bodyColor: "rgba(255, 255, 255, 0.92)",
                    borderColor: "rgba(255, 255, 255, 0.14)",
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: true,
                    boxWidth: 8,
                    boxHeight: 8,
                    boxPadding: 4,
                    usePointStyle: true,
                    titleFont: {
                        size: 12.5,
                        weight: "700",
                        family: "Inter, sans-serif",
                    },
                    bodyFont: {
                        size: 12,
                        weight: "500",
                        family: "Inter, sans-serif",
                    },
                    titleMarginBottom: 6,
                    caretSize: 5,
                },
            },
            // По умолчанию всё скрыто — графикам даём только данные
            scales: {
                x: {
                    display: false,
                    grid: { display: false, drawBorder: false },
                    border: { display: false },
                },
                y: {
                    display: false,
                    grid: { display: false, drawBorder: false },
                    border: { display: false },
                },
            },
        };
        return deepMerge(base, extra);
    }

    /* ---------- Уничтожение ---------- */
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
                const ex = Chart.getChart(ctx);
                if (ex) ex.destroy();
            } catch (e) {}
        }
    }

    /* ---------- hex → rgba ---------- */
    function hexToRgba(hex, a = 1) {
        if (!hex) return `rgba(0,0,0,${a})`;
        if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("");
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    /* ---------- Защита от NaN ---------- */
    function sanitizeData(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.map((v) => {
            const n = Number(v);
            return isFinite(n) ? n : 0;
        });
    }

    /* ---------- Получить пару цветов по индексу ---------- */
    function getPair(i) {
        return GRADIENTS[i % GRADIENTS.length];
    }
    function getFlat(i) {
        return FLAT_PALETTE[i % FLAT_PALETTE.length];
    }

    /* ---------- Плагин: центральный текст в doughnut ---------- */
    const centerTextPlugin = {
        id: "mCenterText",
        afterDraw(chart) {
            const opts = chart.options?.plugins?.mCenterText;
            if (!opts || !opts.display) return;
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const C = getColors();
            const value = opts.value;
            const label = opts.label;
            if (value !== undefined && value !== null && value !== "") {
                ctx.font = "700 34px Inter, -apple-system, sans-serif";
                ctx.fillStyle = C.txt;
                ctx.fillText(String(value), cx, cy - (label ? 10 : 0));
            }
            if (label) {
                ctx.font = "700 10px Inter, -apple-system, sans-serif";
                ctx.fillStyle = C.txtMuted;
                ctx.fillText(String(label).toUpperCase(), cx, cy + 20);
            }
            ctx.restore();
        },
    };

    if (hasChart()) {
        try {
            if (!Chart.registry.plugins.get("mCenterText")) {
                Chart.register(centerTextPlugin);
            }
        } catch (e) {}
    }

    /* =========================================================
       DOUGHNUT — яркое кольцо со скруглениями и зазорами
       ========================================================= */
    function doughnut(canvasId, labels, data, colors, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx || ctx.tagName !== "CANVAS") return null;

        destroyOld(ctx);
        const C = getColors();
        const safeData = sanitizeData(data);

        let palette;
        if (colors && colors.length) {
            palette = colors;
        } else {
            palette = safeData.map((_, i) => getFlat(i));
        }

        const sum = safeData.reduce((a, v) => a + v, 0);
        const centerValue =
            opts.center?.value !== undefined ? opts.center.value : sum;
        const centerLabel = opts.center?.label || opts.centerLabel || "";

        const hideLegend = opts.hideLegend === true;

        const legendCfg = hideLegend
            ? { display: false }
            : {
                  display: true,
                  position: "bottom",
                  labels: {
                      color: C.txtMuted,
                      font: {
                          size: 11,
                          family: "Inter, sans-serif",
                          weight: "600",
                      },
                      padding: 14,
                      boxWidth: 8,
                      boxHeight: 8,
                      usePointStyle: true,
                      pointStyle: "circle",
                  },
              };

        ctx._chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        data: safeData,
                        backgroundColor: palette,
                        borderColor: "rgba(255, 255, 255, 0.95)",
                        borderWidth: 3,
                        hoverOffset: 10,
                        hoverBorderColor: "#ffffff",
                        hoverBorderWidth: 4,
                        spacing: 3,
                    },
                ],
            },
            options: baseOpts({
                cutout: opts.cutout || "72%",
                plugins: {
                    legend: legendCfg,
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const v = item.parsed;
                                const pct =
                                    sum > 0 ? Math.round((v / sum) * 100) : 0;
                                return ` ${item.label}: ${v} (${pct}%)`;
                            },
                        },
                    },
                    mCenterText: {
                        display:
                            opts.center?.display !== false &&
                            centerValue !== undefined,
                        value: centerValue,
                        label: centerLabel,
                    },
                },
                scales: { x: { display: false }, y: { display: false } },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       BAR — яркие скруглённые столбики с gradient
       ========================================================= */
    function bar(canvasId, labels, data, colors, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx || ctx.tagName !== "CANVAS") return null;

        destroyOld(ctx);
        const C = getColors();
        const horizontal = !!opts.horizontal;
        const safeData = sanitizeData(data);

        // Каждому столбику — свой цвет из палитры (или gradient-пара)
        const useGradient = opts.gradient !== false;

        function bgColor(c) {
            const i = c.dataIndex;
            const chart = c.chart;
            const area = chart.chartArea;

            const pair = getPair(i);
            const light = pair[0];
            const dark = pair[1];

            // Если пользователь передал явные цвета — используем их
            let baseColor;
            if (Array.isArray(colors)) {
                baseColor = colors[i] || light;
            } else if (typeof colors === "string") {
                baseColor = colors;
            } else {
                baseColor = light;
            }

            if (!area) return baseColor;

            const g = horizontal
                ? chart.ctx.createLinearGradient(area.left, 0, area.right, 0)
                : chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);

            if (useGradient) {
                g.addColorStop(0, horizontal ? light : baseColor);
                g.addColorStop(
                    1,
                    horizontal
                        ? baseColor
                        : typeof colors === "string"
                          ? hexToRgba(baseColor, 0.65)
                          : dark,
                );
            } else {
                g.addColorStop(0, baseColor);
                g.addColorStop(1, baseColor);
            }
            return g;
        }

        ctx._chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: opts.label || "",
                        data: safeData,
                        backgroundColor: bgColor,
                        borderRadius: opts.borderRadius ?? 10,
                        borderSkipped: false,
                        maxBarThickness: opts.maxBarThickness || 34,
                        categoryPercentage: 0.72,
                        barPercentage: 0.85,
                    },
                ],
            },
            options: baseOpts({
                indexAxis: horizontal ? "y" : "x",
                layout: {
                    padding: horizontal
                        ? { top: 4, right: 12, bottom: 4, left: 6 }
                        : { top: 12, right: 12, bottom: 4, left: 6 },
                },
                plugins: {
                    legend: {
                        display: !!opts.label,
                        labels: { color: C.txtMuted },
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const v = item.parsed[horizontal ? "x" : "y"];
                                const unit = opts.unit || "";
                                return ` ${opts.label || "Значение"}: ${v}${unit}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        display: horizontal ? false : true,
                        ticks: {
                            color: C.txtMuted,
                            font: { size: 10.5, weight: "500" },
                            padding: 6,
                            maxRotation: 0,
                            autoSkip: true,
                        },
                        grid: { display: false },
                        border: { display: false },
                    },
                    y: {
                        // Вертикальный bar → скрываем Y
                        // Горизонтальный bar → показываем подписи категорий
                        display: horizontal ? true : false,
                        ticks: horizontal
                            ? {
                                  color: C.txtMuted,
                                  font: { size: 10.5, weight: "500" },
                                  padding: 8,
                              }
                            : { display: false },
                        grid: { display: false },
                        border: { display: false },
                        beginAtZero: true,
                    },
                },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       LINE (area с gradient) — толстые линии, точки, без осей
       ========================================================= */
    function line(canvasId, labels, datasets, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx || ctx.tagName !== "CANVAS") return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: datasets.map((d, i) => {
                    const pair = getPair(i);
                    const color = d.color || pair[0];
                    const dark = pair[1];
                    const safe = sanitizeData(d.data);

                    return {
                        label: d.label,
                        data: safe,
                        borderColor: color,
                        borderWidth: d.borderWidth ?? 3,
                        backgroundColor: (c) => {
                            if (!d.fill) return "transparent";
                            const area = c.chart.chartArea;
                            if (!area) return hexToRgba(color, 0.15);
                            const g = c.chart.ctx.createLinearGradient(
                                0,
                                area.top,
                                0,
                                area.bottom,
                            );
                            g.addColorStop(
                                0,
                                hexToRgba(color, d.fillAlpha ?? 0.35),
                            );
                            g.addColorStop(1, hexToRgba(color, 0.01));
                            return g;
                        },
                        tension: d.tension ?? 0.4,
                        fill: !!d.fill,
                        pointRadius: d.pointRadius ?? 4,
                        pointHoverRadius: d.pointHoverRadius ?? 7,
                        pointBackgroundColor: color,
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: color,
                        pointHoverBorderColor: "#ffffff",
                        pointHoverBorderWidth: 3,
                        showLine: d.showLine !== false,
                        spanGaps: d.spanGaps ?? false,
                        borderDash: d.borderDash || undefined,
                        order: d.order ?? 0,
                    };
                }),
            },
            options: baseOpts({
                plugins: {
                    legend: {
                        display:
                            opts.plugins?.legend?.display ??
                            datasets.length > 1,
                        labels: {
                            color: C.txtMuted,
                            filter:
                                opts.plugins?.legend?.labels?.filter ||
                                (() => true),
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const unit = opts.unit || "";
                                return ` ${item.dataset.label}: ${item.parsed.y}${unit}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        // X-категории видны — но очень минимально
                        display: opts.showXAxis !== false,
                        ticks: {
                            color: C.txtMuted,
                            font: { size: 10.5, weight: "500" },
                            maxTicksLimit: opts.maxTicksLimit || 8,
                            padding: 6,
                            maxRotation: 0,
                            autoSkip: true,
                        },
                        grid: { display: false },
                        border: { display: false },
                    },
                    y: {
                        // Y скрыт полностью — только tooltip
                        display: false,
                        beginAtZero: true,
                        min: opts.min ?? 0,
                        max: opts.max ?? undefined,
                    },
                },
            }),
        });
        return ctx._chart;
    }

    /* =========================================================
       POLAR
       ========================================================= */
    function polar(canvasId, labels, data, colors, opts = {}) {
        if (!hasChart()) return null;
        const ctx = document.getElementById(canvasId);
        if (!ctx || ctx.tagName !== "CANVAS") return null;

        destroyOld(ctx);
        const C = getColors();
        const safeData = sanitizeData(data);

        const palette =
            colors && colors.length
                ? colors
                : safeData.map((_, i) => hexToRgba(getFlat(i), 0.8));

        ctx._chart = new Chart(ctx, {
            type: "polarArea",
            data: {
                labels,
                datasets: [
                    {
                        data: safeData,
                        backgroundColor: palette,
                        borderColor: "rgba(255, 255, 255, 0.9)",
                        borderWidth: 2,
                    },
                ],
            },
            options: baseOpts({
                plugins: {
                    legend: {
                        position: opts.legendPosition || "bottom",
                        labels: { color: C.txtMuted },
                    },
                },
                scales: {
                    r: {
                        ticks: {
                            color: C.txtMuted,
                            backdropColor: "transparent",
                            font: { size: 10 },
                            padding: 6,
                        },
                        grid: { color: "rgba(15,15,25,0.06)" },
                        angleLines: { color: "rgba(15,15,25,0.06)" },
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
        if (!ctx || ctx.tagName !== "CANVAS") return null;

        destroyOld(ctx);
        const C = getColors();

        ctx._chart = new Chart(ctx, {
            type: "radar",
            data: {
                labels,
                datasets: datasets.map((d, i) => {
                    const pair = getPair(i);
                    const color = d.color || pair[0];
                    return {
                        label: d.label,
                        data: sanitizeData(d.data),
                        borderColor: color,
                        backgroundColor: hexToRgba(color, d.fillAlpha ?? 0.22),
                        borderWidth: 2.5,
                        pointBackgroundColor: color,
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: color,
                        pointHoverBorderColor: "#ffffff",
                        pointHoverBorderWidth: 2.5,
                    };
                }),
            },
            options: baseOpts({
                plugins: {
                    legend: {
                        display: datasets.length > 1,
                        labels: { color: C.txtMuted },
                    },
                },
                scales: {
                    r: {
                        min: opts.min ?? 0,
                        max: opts.max ?? 100,
                        ticks: {
                            color: C.txtMuted,
                            backdropColor: "transparent",
                            stepSize: opts.stepSize ?? 25,
                            font: { size: 9.5 },
                            showLabelBackdrop: false,
                        },
                        grid: { color: "rgba(15,15,25,0.06)", lineWidth: 1 },
                        angleLines: {
                            color: "rgba(15,15,25,0.06)",
                            lineWidth: 1,
                        },
                        pointLabels: {
                            color: C.txtMuted,
                            font: {
                                size: 11,
                                family: "Inter, sans-serif",
                                weight: "600",
                            },
                            padding: 10,
                        },
                    },
                },
            }),
        });
        return ctx._chart;
    }

    function refreshColors() {
        _colors = null;
    }
    function init() {
        refreshColors();
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
        hexToRgba,
        PALETTE,
        GRADIENTS,
    };
})();

document.addEventListener("DOMContentLoaded", () => {
    Charts.init();
});
