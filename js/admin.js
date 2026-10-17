const Admin = (() => {
    const WORK_STATUSES = Utils.WORK_STATUSES;
    const WORK_TYPES = Utils.WORK_TYPES;

    const ROLE_LABELS = {
        student: "Студент",
        teacher: "Преподаватель",
        admin: "Администратор",
    };

    const escapeHtml = Utils.escapeHtml;
    const initials = Utils.initials;
    const statusBadge = Utils.statusBadge;
    const calcProgress = Utils.calcProgress;
    const emptyState = Utils.emptyState;

    let userFilter = { role: "", q: "" };
    let workFilter = { status: "", type: "", q: "" };
    let analyticsFilter = { status: "", type: "", teacherId: "" };

    /* ---------- Пагинация дашборда ---------- */
    let adminPage = {
        departments: 0,
        attention: 0,
        activity: 0,
        works: 0,
    };

    function nextPage(key, totalPages) {
        if (adminPage[key] < totalPages - 1) {
            adminPage[key]++;
            App.navigate("dashboard");
        }
    }

    function prevPage(key) {
        if (adminPage[key] > 0) {
            adminPage[key]--;
            App.navigate("dashboard");
        }
    }

    function getUser() {
        return Auth.getUser();
    }

    function userName(id) {
        const u = Storage.getUserById(id);
        return u ? u.fio : "—";
    }

    function getFuzzyResult(work) {
        return Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(work));
    }

    const VIEWS = {};

    /* =========================================================
       ДЕМО-ДАННЫЕ
       ========================================================= */
    VIEWS.demo = function () {
        const users = Storage.getUsers();
        const works = Storage.getWorks();
        const stages = Storage.getStages();
        const tasks = Storage.getTasks();
        const sizeKB = Storage.getSizeKB ? Storage.getSizeKB() : 0;

        const stats = {
            students: users.filter((u) => u.role === "student").length,
            teachers: users.filter((u) => u.role === "teacher").length,
            admins: users.filter((u) => u.role === "admin").length,
            works: works.length,
            stages: stages.length,
            tasks: tasks.length,
            size: sizeKB,
        };

        return `
      <div class="card">
        <div class="card-title">Демо-данные</div>

        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Генерация тестовых данных для демонстрации системы.
          Одна кнопка создаст <b>преподавателей, студентов, работы, этапы,
          задачи, версии, комментарии, уведомления и консультации</b> —
          всё, что нужно, чтобы показать систему «живой».
        </p>

        <div class="metric-grid" style="margin-bottom:20px;">
          <div class="metric">
            <div class="metric-lbl">Студентов</div>
            <div class="metric-val">${stats.students}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Преподавателей</div>
            <div class="metric-val">${stats.teachers}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Работ</div>
            <div class="metric-val">${stats.works}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Этапов</div>
            <div class="metric-val">${stats.stages}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Задач</div>
            <div class="metric-val">${stats.tasks}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Размер БД</div>
            <div class="metric-val">${stats.size} КБ</div>
          </div>
        </div>

        <button class="btn-primary" onclick="DemoData.generate()">
          ${SVG.rocket({ cls: "icon icon-sm" })}
          <span>Загрузить демо-данные</span>
        </button>

        <div class="notice" style="margin-top:20px;">
    <b>Что будет создано:</b>
    <ul style="margin:8px 0 0 20px;line-height:1.7;">
        <li><b>8 преподавателей</b> с разными кафедрами и научными степенями</li>
        <li><b>35 студентов</b> на разных курсах и группах</li>
        <li><b>70 работ</b> на всех стадиях — от заявки до защиты</li>
        <li><b>500+ этапов и задач</b>, распределённых по работам</li>
        <li><b>300+ версий документов</b> с комментариями к изменениям</li>
        <li><b>400+ замечаний</b> от руководителей</li>
        <li><b>15 консультаций</b> на разных этапах согласования</li>
        <li><b>80 записей</b> в журнале аудита</li>
        <li>Уведомления, справочники и настройки системы</li>
    </ul>
</div>
      </div>

      <div class="card danger-zone" style="margin-top:20px;">
        <div class="card-title">Опасная зона</div>
        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
          Полное удаление всех данных. Это действие необратимо.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn-ghost" onclick="Admin.exportBackup()">
            ${SVG.download({ cls: "icon icon-sm" })}
            <span>Скачать резервную копию</span>
          </button>
          <button class="btn-ghost" onclick="document.getElementById('backupInput').click()">
            ${SVG.upload({ cls: "icon icon-sm" })}
            <span>Восстановить из файла</span>
          </button>
          <input type="file" id="backupInput" accept=".json" style="display:none"
            onchange="Admin.importBackup(event)">
          <button class="btn-ghost btn-danger" onclick="DemoData.clearAll()">
            ${SVG.trash({ cls: "icon icon-sm" })}
            <span>Удалить все данные</span>
          </button>
        </div>
      </div>
    `;
    };

    /* =========================================================
       DASHBOARD
       ========================================================= */
    VIEWS.dashboard = function () {
        const users = Storage.getUsers();
        const works = Storage.getWorks();
        const audit = typeof Audit !== "undefined" ? Audit.getAll() : [];

        const students = users.filter((u) => u.role === "student");
        const teachers = users.filter((u) => u.role === "teacher");
        const blocked = users.filter((u) => u.blocked);

        const weekAgo = Date.now() - 7 * 86400000;
        const twoWeeksAgo = Date.now() - 14 * 86400000;
        const newUsersWeek = users.filter((u) => (u.createdAt || 0) > weekAgo);
        const newUsersPrevWeek = users.filter(
            (u) =>
                (u.createdAt || 0) > twoWeeksAgo &&
                (u.createdAt || 0) <= weekAgo,
        );
        const usersTrend = newUsersWeek.length - newUsersPrevWeek.length;

        const activeWorks = works.filter(
            (w) => w.status === "active" || w.status === "review",
        );
        const pendingWorks = works.filter((w) => w.status === "pending");

        const newWorksWeek = works.filter((w) => (w.createdAt || 0) > weekAgo);
        const newWorksPrevWeek = works.filter(
            (w) =>
                (w.createdAt || 0) > twoWeeksAgo &&
                (w.createdAt || 0) <= weekAgo,
        );
        const worksTrend = newWorksWeek.length - newWorksPrevWeek.length;

        const withRisk = works
            .map((w) => {
                const res = Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(w));
                return res ? { w, res } : null;
            })
            .filter(Boolean);

        const highRisk = withRisk.filter((x) => x.res.risk.term === "high");
        const avgRisk = withRisk.length
            ? Math.round(
                  withRisk.reduce((a, x) => a + x.res.risk.value, 0) /
                      withRisk.length,
              )
            : 0;

        const dayAgo = Date.now() - 86400000;
        const auditToday = audit.filter((e) => (e.createdAt || 0) > dayAgo);

        let week7Total = 0;
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dEnd = new Date(d);
            dEnd.setHours(23, 59, 59, 999);
            const count = audit.filter((e) => {
                const t = e.createdAt || 0;
                return t >= d.getTime() && t <= dEnd.getTime();
            }).length;
            week7Total += count;
        }

        const overdue = works.filter((w) => {
            if (!w.deadline) return false;
            if (w.status === "done" || w.status === "rejected") return false;
            return daysUntil(w.deadline) < 0;
        });

        return `
      <!-- KPI -->
      <div class="kpi-row" style="margin-bottom:20px;">
        ${renderKpiTile({
            label: "Пользователей",
            value: users.length,
            iconFn: SVG.users,
            iconCls: "blue",
            trend: usersTrend,
            foot: `+${newUsersWeek.length} за неделю`,
        })}
        ${renderKpiTile({
            label: "Активных работ",
            value: activeWorks.length,
            iconFn: SVG.folder,
            iconCls: "green",
            trend: worksTrend,
            foot: `+${newWorksWeek.length} за неделю`,
        })}
        ${renderKpiTile({
            label: "Средний риск",
            value: avgRisk,
            iconFn: SVG.alertTriangle,
            iconCls: "orange",
            foot: `${highRisk.length} с высоким риском`,
        })}
        ${renderKpiTile({
            label: "Действий за 24ч",
            value: auditToday.length,
            iconFn: SVG.activity,
            iconCls: "purple",
            foot: `${newUsersWeek.length + newWorksWeek.length} новых объектов`,
        })}
      </div>

      <!-- АКТИВНОСТЬ -->
      <div class="card activity-hero-card">
        <div class="card-head" style="margin-bottom:16px;">
          <div class="card-title" style="margin-bottom:0;display:flex;align-items:center;gap:8px;">
            ${SVG.activity({ cls: "icon icon-sm" })}
            Активность системы
          </div>
          <span style="font-size:11px;color:var(--txt-muted);">
            ${audit.length} записей в журнале
          </span>
        </div>

        <div class="activity-hero">
          <div class="activity-hero-heatmap">
            ${renderHeatmap(audit)}
          </div>

          <div class="activity-hero-side">
            <div class="activity-stat">
              <span class="activity-stat-label">Сегодня</span>
              <span class="activity-stat-val">${auditToday.length}</span>
            </div>
            <div class="activity-stat">
              <span class="activity-stat-label">За 7 дней</span>
              <span class="activity-stat-val">${week7Total}</span>
            </div>
            <div class="activity-stat">
              <span class="activity-stat-label">Всего</span>
              <span class="activity-stat-val">${audit.length}</span>
            </div>
            <div class="chart-box" style="height:130px;margin-top:10px;">
              <canvas id="adminChartActivity"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- 3 КРУГЛЫХ ГРАФИКА -->
      <div class="dash-grid" style="margin-bottom:20px;">
        <div class="card col-4">
          <div class="card-title" style="font-size:14px;">По рискам</div>
          <div class="chart-box chart-box--round"><canvas id="adminChartRisk"></canvas></div>
        </div>
        <div class="card col-4">
          <div class="card-title" style="font-size:14px;">По статусам</div>
          <div class="chart-box chart-box--round"><canvas id="adminChartStatuses"></canvas></div>
        </div>
        <div class="card col-4">
          <div class="card-title" style="font-size:14px;">По типам</div>
          <div class="chart-box chart-box--round"><canvas id="adminChartTypes"></canvas></div>
        </div>
      </div>

      <!-- ТРИ КАРТОЧКИ С ПАГИНАЦИЕЙ -->
      <div class="dash-grid" style="margin-bottom:20px;">
        <div class="card col-4 dash-card-fixed">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;display:flex;align-items:center;gap:8px;">
              ${SVG.book({ cls: "icon icon-sm" })}
              Топ кафедр
            </div>
          </div>
          ${renderTopDepartments(teachers, works)}
        </div>

        <div class="card col-4 dash-card-fixed">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;display:flex;align-items:center;gap:8px;">
              ${SVG.alertTriangle({ cls: "icon icon-sm" })}
              Требуют внимания
            </div>
          </div>
          ${renderAttentionList({ pendingWorks, highRisk, overdue, blocked, noTeacher: [] })}
        </div>

        <div class="card col-4 dash-card-fixed">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;display:flex;align-items:center;gap:8px;">
              ${SVG.activity({ cls: "icon icon-sm" })}
              Последние действия
            </div>
            <button class="btn-ghost btn-sm" onclick="App.navigate('audit')">→</button>
          </div>
          ${renderMiniActivity(audit)}
        </div>
      </div>

      <!-- ТОП РАБОТ -->
      <div class="dash-table-card">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;display:flex;align-items:center;gap:8px;">
            ${SVG.folder({ cls: "icon icon-sm" })}
            Топ работ
          </div>
          <button class="btn-ghost btn-sm" onclick="App.navigate('works')">
            Все →
          </button>
        </div>
        ${renderTopWorksTable(works)}
      </div>
    `;
    };

    VIEWS.dashboard_after = function () {
        if (!Charts.hasChart()) return;

        const audit = typeof Audit !== "undefined" ? Audit.getAll() : [];
        const labels = [];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dEnd = new Date(d);
            dEnd.setHours(23, 59, 59, 999);
            const count = audit.filter((e) => {
                const t = e.createdAt || 0;
                return t >= d.getTime() && t <= dEnd.getTime();
            }).length;
            labels.push(
                d.toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                }),
            );
            data.push(count);
        }
        Charts.bar(
            "adminChartActivity",
            labels,
            data,
            [
                "#6366f1",
                "#8b5cf6",
                "#a855f7",
                "#d946ef",
                "#ec4899",
                "#f43f5e",
                "#f97316",
            ],
            { maxBarThickness: 22 },
        );

        const works = Storage.getWorks()
            .map((w) => ({ w, res: getFuzzyResult(w) }))
            .filter((e) => e.res);
        const low = works.filter((e) => e.res.risk.term === "low").length;
        const med = works.filter((e) => e.res.risk.term === "med").length;
        const high = works.filter((e) => e.res.risk.term === "high").length;

        Charts.doughnut(
            "adminChartRisk",
            ["Низкий", "Средний", "Высокий"],
            [low, med, high],
            ["#34d399", "#fbbf24", "#f87171"],
            { center: { label: "работ" }, hideLegend: true },
        );

        const statusLabels = {
            draft: "Черновик",
            pending: "На утверждении",
            active: "В работе",
            review: "На проверке",
            approved: "Допущена",
            done: "Защищена",
            rejected: "Отклонена",
        };
        const statuses = {};
        Storage.getWorks().forEach((w) => {
            statuses[w.status] = (statuses[w.status] || 0) + 1;
        });
        Charts.doughnut(
            "adminChartStatuses",
            Object.keys(statuses).map((k) => statusLabels[k] || k),
            Object.values(statuses),
            null,
            { center: { label: "работ" }, hideLegend: true },
        );

        const typeLabels = {
            course: "Курсовая",
            diploma: "Диплом",
            vkr: "ВКР",
            master: "Магистерская",
        };
        const types = {};
        Storage.getWorks().forEach((w) => {
            types[w.type] = (types[w.type] || 0) + 1;
        });
        Charts.doughnut(
            "adminChartTypes",
            Object.keys(types).map((k) => typeLabels[k] || k),
            Object.values(types),
            ["#6366f1", "#8b5cf6", "#06b6d4", "#ec4899"],
            { center: { label: "работ" }, hideLegend: true },
        );
    };

    /* =========================================================
       ХЕЛПЕРЫ ДАШБОРДА
       ========================================================= */
    function renderKpiTile({ label, value, iconFn, iconCls, trend, foot }) {
        let trendHtml = "";
        if (trend !== undefined) {
            const cls = trend > 0 ? "up" : trend < 0 ? "down" : "flat";
            const arrow = trend > 0 ? "▲" : trend < 0 ? "▼" : "—";
            trendHtml = `<span class="kpi-trend ${cls}">${arrow} ${Math.abs(trend)}</span>`;
        }
        return `
      <div class="kpi-tile">
        <div class="kpi-tile-head">
          <div class="kpi-tile-label">${escapeHtml(label)}</div>
          <div class="kpi-tile-icon ${iconCls}">${iconFn({ cls: "icon" })}</div>
        </div>
        <div class="kpi-tile-value">${value}</div>
        <div class="kpi-tile-foot">
          ${trendHtml}
          <span>${escapeHtml(foot)}</span>
        </div>
      </div>
    `;
    }

    function renderHeatmap(audit) {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 52 * 7);
        start.setHours(0, 0, 0, 0);
        const dow = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - dow);

        const days = [];
        const d = new Date(start);
        while (d <= now) {
            days.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }

        const counts = {};
        audit.forEach((e) => {
            const dt = new Date(e.createdAt || 0);
            if (dt < start) return;
            const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        const max = Math.max(1, ...Object.values(counts));

        const cells = days
            .map((day) => {
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const c = counts[key] || 0;
                let level = "";
                if (c > 0) {
                    const r = c / max;
                    if (r < 0.25) level = "l1";
                    else if (r < 0.5) level = "l2";
                    else if (r < 0.8) level = "l3";
                    else level = "l4";
                }
                const label = day.toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                });
                return `<div class="heatmap-cell ${level}" title="${label}: ${c} действий"></div>`;
            })
            .join("");

        return `
      <div class="heatmap-wrap">
        <div class="heatmap-grid">${cells}</div>
        <div class="heatmap-legend">
          <span>Меньше</span>
          <div class="heatmap-legend-cell"></div>
          <div class="heatmap-legend-cell l1"></div>
          <div class="heatmap-legend-cell l2"></div>
          <div class="heatmap-legend-cell l3"></div>
          <div class="heatmap-legend-cell l4"></div>
          <span>Больше</span>
        </div>
      </div>
    `;
    }

    function renderPagination(page, totalPages, key) {
        if (totalPages <= 1) {
            return `<div class="dash-panel-footer">
                <button class="pg-btn" disabled>‹</button>
                <span class="pg-info">1 / 1</span>
                <button class="pg-btn" disabled>›</button>
            </div>`;
        }
        return `<div class="dash-panel-footer">
            <button class="pg-btn" onclick="Admin.prevPage('${key}')" ${page === 0 ? "disabled" : ""}>‹</button>
            <span class="pg-info">${page + 1} / ${totalPages}</span>
            <button class="pg-btn" onclick="Admin.nextPage('${key}', ${totalPages})" ${page >= totalPages - 1 ? "disabled" : ""}>›</button>
        </div>`;
    }

    function renderTopDepartments(teachers, works) {
        const byDept = {};
        teachers.forEach((t) => {
            const dept = t.department || "Без кафедры";
            if (!byDept[dept]) byDept[dept] = { name: dept, count: 0 };
        });
        works.forEach((w) => {
            if (w.status !== "active" && w.status !== "review") return;
            const t = Storage.getUserById(w.teacherId);
            if (!t) return;
            const dept = t.department || "Без кафедры";
            if (!byDept[dept]) byDept[dept] = { name: dept, count: 0 };
            byDept[dept].count++;
        });

        const rows = Object.values(byDept).sort((a, b) => b.count - a.count);
        const max = Math.max(1, ...rows.map((r) => r.count));

        const perPage = 3;
        const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
        const page = Math.min(adminPage.departments, totalPages - 1);
        const slice = rows.slice(page * perPage, (page + 1) * perPage);

        if (rows.length === 0) {
            return `<div style="flex:1;display:flex;flex-direction:column;">
                <div class="empty" style="padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">Нет данных</div>
                ${renderPagination(0, 1, "departments")}
            </div>`;
        }

        return `<div style="flex:1;display:flex;flex-direction:column;">
            <div style="flex:1;">
                ${slice
                    .map(
                        (r) => `
                    <div class="dash-top-row">
                        <div class="dash-top-label">
                            <span>${escapeHtml(r.name.replace("Кафедра ", ""))}</span>
                        </div>
                        <div class="dash-top-bar">
                            <div class="dash-top-fill" style="width:${(r.count / max) * 100}%;"></div>
                        </div>
                        <div class="dash-top-val">${r.count}</div>
                    </div>
                `,
                    )
                    .join("")}
            </div>
            ${renderPagination(page, totalPages, "departments")}
        </div>`;
    }

    function renderAttentionList({
        pendingWorks,
        highRisk,
        overdue,
        noTeacher,
        blocked,
    }) {
        const items = [];

        if (pendingWorks.length > 0) {
            items.push({
                icon: SVG.clipboard,
                text: `<b>${pendingWorks.length}</b> заявок на утверждении`,
                link: "works",
                tone: "warn",
            });
        }
        if (highRisk.length > 0) {
            items.push({
                icon: SVG.alertTriangle,
                text: `<b>${highRisk.length}</b> работ с высоким риском`,
                link: "analytics",
                tone: "bad",
            });
        }
        if (overdue.length > 0) {
            items.push({
                icon: SVG.clock,
                text: `<b>${overdue.length}</b> просроченных работ`,
                link: "works",
                tone: "bad",
            });
        }
        if (noTeacher.length > 0) {
            items.push({
                icon: SVG.users,
                text: `<b>${noTeacher.length}</b> работ без руководителя`,
                link: "works",
                tone: "warn",
            });
        }
        if (blocked.length > 0) {
            items.push({
                icon: SVG.lock,
                text: `<b>${blocked.length}</b> заблокированных аккаунтов`,
                link: "users",
                tone: "warn",
            });
        }

        if (items.length === 0) {
            return `<div style="flex:1;display:flex;flex-direction:column;">
                <div style="flex:1;text-align:center;padding:20px;color:var(--txt-muted);font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
                    ${SVG.checkCircle({ cls: "icon icon-xl", style: "opacity:0.5;" })}
                    <div>Всё в порядке</div>
                </div>
                ${renderPagination(0, 1, "attention")}
            </div>`;
        }

        const perPage = 3;
        const totalPages = Math.max(1, Math.ceil(items.length / perPage));
        const page = Math.min(adminPage.attention, totalPages - 1);
        const slice = items.slice(page * perPage, (page + 1) * perPage);

        return `<div style="flex:1;display:flex;flex-direction:column;">
            <div style="flex:1;">
                ${slice
                    .map(
                        (it) => `
                    <div class="dash-activity-item" style="cursor:pointer;" onclick="App.navigate('${it.link}')">
                        <div class="dash-activity-avatar" style="background:rgba(15,15,25,.06);color:${it.tone === "bad" ? "#dc2626" : "#d97706"};">
                            ${it.icon({ cls: "icon icon-sm" })}
                        </div>
                        <div class="dash-activity-body">
                            <div class="dash-activity-text">${it.text}</div>
                        </div>
                        <span style="color:var(--txt-muted);font-size:16px;">›</span>
                    </div>
                `,
                    )
                    .join("")}
            </div>
            ${renderPagination(page, totalPages, "attention")}
        </div>`;
    }

    function renderMiniActivity(audit) {
        const items = audit.slice(0, 30);

        if (items.length === 0) {
            return `<div style="flex:1;display:flex;flex-direction:column;">
                <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;color:var(--txt-muted);font-size:12px;">
                    Пока нет действий
                </div>
                ${renderPagination(0, 1, "activity")}
            </div>`;
        }

        const perPage = 3;
        const totalPages = Math.max(1, Math.ceil(items.length / perPage));
        const page = Math.min(adminPage.activity, totalPages - 1);
        const slice = items.slice(page * perPage, (page + 1) * perPage);

        return `<div style="flex:1;display:flex;flex-direction:column;">
            <div style="flex:1;">
                ${slice
                    .map((e) => {
                        const user = Storage.getUserById(e.userId);
                        const ini = user
                            ? user.fio
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((w) => w[0])
                                  .join("")
                            : "?";
                        const ago = timeAgo(e.createdAt);
                        return `
                            <div class="dash-activity-item">
                                <div class="dash-activity-avatar">${ini}</div>
                                <div class="dash-activity-body">
                                    <div class="dash-activity-text">
                                        <b>${escapeHtml(user?.fio || "—")}</b>
                                        ${escapeHtml(e.action || "—")}
                                    </div>
                                    <div class="dash-activity-time">${ago}</div>
                                </div>
                            </div>
                        `;
                    })
                    .join("")}
            </div>
            ${renderPagination(page, totalPages, "activity")}
        </div>`;
    }

    function renderTopWorksTable(works) {
        const enriched = works
            .map((w) => {
                const res = Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(w));
                return res ? { w, res } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.res.rating.value - a.res.rating.value);

        if (enriched.length === 0) {
            return `<div>
                <div class="empty" style="padding:20px;">Работ пока нет</div>
                ${renderPagination(0, 1, "works")}
            </div>`;
        }

        const perPage = 5;
        const totalPages = Math.max(1, Math.ceil(enriched.length / perPage));
        const page = Math.min(adminPage.works, totalPages - 1);
        const slice = enriched.slice(page * perPage, (page + 1) * perPage);

        return `<div>
            ${slice
                .map((e, i) => {
                    const rank = page * perPage + i + 1;
                    const student = Storage.getUserById(e.w.studentId);
                    const teacher = Storage.getUserById(e.w.teacherId);
                    const rankCls =
                        rank === 1
                            ? "gold"
                            : rank === 2
                              ? "silver"
                              : rank === 3
                                ? "bronze"
                                : "";
                    const progress = Utils.calcProgress(e.w.id);
                    const riskCls =
                        e.res.risk.term === "high"
                            ? "bad"
                            : e.res.risk.term === "med"
                              ? "warn"
                              : "ok";
                    return `
                        <div class="dash-table-row" onclick="App.navigate('work-detail', {id: '${e.w.id}'})" style="cursor:pointer;">
                            <div class="dash-table-rank ${rankCls}">${rank}</div>
                            <div style="min-width:0;">
                                <div class="dash-table-name">${escapeHtml(e.w.topic)}</div>
                                <div class="dash-table-sub">
                                    ${escapeHtml(student?.fio || "—")} · рук. ${escapeHtml(teacher?.fio?.split(" ").slice(0, 2).join(" ") || "—")}
                                </div>
                            </div>
                            <div class="dash-table-chip ${riskCls}">${progress}%</div>
                            <div class="dash-table-val">${e.res.rating.value.toFixed(0)}</div>
                        </div>
                    `;
                })
                .join("")}
            ${renderPagination(page, totalPages, "works")}
        </div>`;
    }

    function timeAgo(ts) {
        if (!ts) return "—";
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        if (min < 1) return "только что";
        if (min < 60) return `${min} мин. назад`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} ч. назад`;
        const d = Math.floor(hr / 24);
        if (d < 7) return `${d} дн. назад`;
        return new Date(ts).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "short",
        });
    }

    /* =========================================================
       ПОЛЬЗОВАТЕЛИ
       ========================================================= */
    VIEWS.users = function () {
        let users = Storage.getUsers();

        if (userFilter.role)
            users = users.filter((u) => u.role === userFilter.role);
        if (userFilter.q) {
            const q = userFilter.q.toLowerCase();
            users = users.filter(
                (u) =>
                    u.fio.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q),
            );
        }

        users.sort((a, b) => {
            const order = { student: 0, teacher: 1, admin: 2 };
            return (
                (order[a.role] || 0) - (order[b.role] || 0) ||
                a.fio.localeCompare(b.fio)
            );
        });

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Пользователи (${users.length})</div>
          <button class="btn-primary btn-sm" onclick="Admin.openCreateUserModal()">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Добавить</span>
          </button>
        </div>

        <div class="admin-filters">
          <select onchange="Admin.setUserFilter('role', this.value)">
            <option value="">Все роли</option>
            <option value="student" ${userFilter.role === "student" ? "selected" : ""}>Студенты</option>
            <option value="teacher" ${userFilter.role === "teacher" ? "selected" : ""}>Преподаватели</option>
            <option value="admin"   ${userFilter.role === "admin" ? "selected" : ""}>Администраторы</option>
          </select>
          <input type="text" placeholder="Поиск по ФИО или email..."
            value="${escapeHtml(userFilter.q)}"
            oninput="Admin.setUserFilter('q', this.value)">
        </div>

        ${
            users.length === 0
                ? '<div class="empty">Нет пользователей по заданным фильтрам</div>'
                : users.map((u) => renderUserRow(u)).join("")
        }
      </div>
    `;
    };

    function renderUserRow(u) {
        const blocked = u.blocked
            ? '<span class="blocked-chip">заблокирован</span>'
            : "";
        const extra =
            u.role === "student"
                ? `${escapeHtml(u.faculty || "")} · ${escapeHtml(u.group || "")} · ${u.course || ""} курс`
                : u.role === "teacher"
                  ? `${escapeHtml(u.department || "")}${u.degree ? " · " + escapeHtml(u.degree) : ""}`
                  : `${escapeHtml(u.department || "")} · ${escapeHtml(u.accessLevel || "")}`;

        const isMe = Storage.sameId(u.id, getUser().id);

        return `
      <div class="user-row">
        <div class="user-avatar ${u.role}"
          onclick="Admin.openUserProfile('${u.id}')"
          style="cursor:pointer;">${initials(u.fio)}</div>
        <div onclick="Admin.openUserProfile('${u.id}')" style="cursor:pointer;">
          <div class="user-name">${escapeHtml(u.fio)}${blocked}</div>
          <div class="user-email">${escapeHtml(u.email)}</div>
          <div class="user-extra">${extra}</div>
        </div>
        <div><span class="role-chip ${u.role}">${ROLE_LABELS[u.role] || u.role}</span></div>
        <div>
          ${
              isMe
                  ? '<span class="text-muted" style="font-size:11px;">это вы</span>'
                  : `<button class="btn-ghost btn-sm" onclick="Admin.openEditUserModal('${u.id}')">Изменить</button>`
          }
        </div>
        <div style="display:flex;gap:4px;">
          ${
              isMe
                  ? ""
                  : `
            <button class="btn-icon"
              title="${u.blocked ? "Разблокировать" : "Заблокировать"}"
              onclick="Admin.toggleBlock('${u.id}')">
              ${u.blocked ? SVG.unlock({ cls: "icon icon-sm" }) : SVG.lock({ cls: "icon icon-sm" })}
            </button>
            <button class="btn-icon danger" title="Удалить"
              onclick="Admin.deleteUser('${u.id}')">
              ${SVG.trash({ cls: "icon icon-sm" })}
            </button>
          `
          }
        </div>
      </div>
    `;
    }

    function setUserFilter(key, val) {
        userFilter[key] = val;
        App.navigate("users");
    }

    function toggleBlock(id) {
        const me = getUser();
        if (Storage.sameId(me.id, id)) {
            App.toast("Нельзя заблокировать себя");
            return;
        }

        const users = Storage.getUsers();
        const u = users.find((x) => Storage.sameId(x.id, id));
        if (!u) return;
        u.blocked = !u.blocked;
        Storage.setUsers(users);

        if (typeof Audit !== "undefined") {
            Audit.log(
                u.blocked
                    ? "Пользователь заблокирован"
                    : "Пользователь разблокирован",
                u.fio,
                "",
                u.blocked ? "negative" : "positive",
            );
        }

        App.toast(
            u.blocked
                ? "Пользователь заблокирован"
                : "Пользователь разблокирован",
        );
        App.navigate("users");
    }

    function deleteUser(id) {
        const me = getUser();
        if (Storage.sameId(me.id, id)) {
            App.toast("Нельзя удалить себя");
            return;
        }

        const u = Storage.getUserById(id);
        if (!u) return;
        if (
            !confirm(
                `Удалить пользователя ${u.fio}? Все его работы также будут удалены.`,
            )
        )
            return;

        Storage.setUsers(
            Storage.getUsers().filter((x) => !Storage.sameId(x.id, id)),
        );

        const works = Storage.getWorks();
        works
            .filter(
                (w) =>
                    Storage.sameId(w.studentId, id) ||
                    Storage.sameId(w.teacherId, id),
            )
            .forEach((w) => {
                try {
                    Storage.deleteWork(w.id);
                } catch (e) {
                    console.warn(e);
                }
            });

        if (typeof Audit !== "undefined") {
            Audit.log("Пользователь удалён", u.fio, u.role, "negative");
        }

        App.toast("Пользователь удалён");
        App.navigate("users");
    }

    function openUserProfile(id) {
        const u = Storage.getUserById(id);
        if (!u) return;
        if (u.role === "student") App.navigate("student-profile", { id });
        else if (u.role === "teacher") App.navigate("teacher-profile", { id });
        else App.navigate("profile");
    }

    let createRole = "student";

    function openCreateUserModal() {
        createRole = "student";
        renderCreateUserModal();
    }

    function renderCreateUserModal() {
        const html = `
      <div class="modal-back" onclick="if(event.target===this) Admin.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Новый пользователь</h3>
            <button class="modal-close" onclick="Admin.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div class="section-label">Роль</div>
          <div class="role-picker">
            <button type="button" data-role="student" class="${createRole === "student" ? "active" : ""}"
              onclick="Admin.pickCreateRole('student')">
              ${SVG.graduation({ cls: "icon icon-xl" })}
              <span class="role-lbl">Студент</span>
            </button>
            <button type="button" data-role="teacher" class="${createRole === "teacher" ? "active" : ""}"
              onclick="Admin.pickCreateRole('teacher')">
              ${SVG.users({ cls: "icon icon-xl" })}
              <span class="role-lbl">Преподаватель</span>
            </button>
            <button type="button" data-role="admin" class="${createRole === "admin" ? "active" : ""}"
              onclick="Admin.pickCreateRole('admin')">
              ${SVG.shield({ cls: "icon icon-xl" })}
              <span class="role-lbl">Администратор</span>
            </button>
          </div>

          <div class="field">
            <label>ФИО <span class="req">*</span></label>
            <input type="text" id="cu_fio" placeholder="Иванов Иван Иванович">
          </div>
          <div class="field">
            <label>Email <span class="req">*</span></label>
            <input type="email" id="cu_email" placeholder="user@example.com">
          </div>
          <div class="field">
            <label>Пароль <span class="req">*</span></label>
            <input type="text" id="cu_pass" value="123456" placeholder="мин. 6 символов">
          </div>

          <div id="cu_roleFields"></div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Admin.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Admin.createUser()">Создать</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
        renderCreateRoleFields();
    }

    function pickCreateRole(role) {
        createRole = role;
        document
            .querySelectorAll("#modalHost .role-picker button")
            .forEach((b) => {
                b.classList.toggle("active", b.dataset.role === role);
            });
        renderCreateRoleFields();
    }

    function renderCreateRoleFields() {
        const box = document.getElementById("cu_roleFields");
        if (!box) return;

        if (createRole === "student") {
            box.innerHTML = `
        <div class="section-label">Данные студента</div>
        <div class="row-2">
          ${Auth.renderRefField({
              id: "cu_faculty",
              label: "Факультет",
              refKey: "faculties",
              required: false,
              placeholder: "ФИТ",
          })}
          ${Auth.renderRefField({
              id: "cu_group",
              label: "Группа",
              refKey: "groups",
              required: false,
              placeholder: "ПИ-21-1",
          })}
        </div>
        <div class="field"><label>Курс</label><input type="number" id="cu_course" min="1" max="6" value="1"></div>
      `;
        } else if (createRole === "teacher") {
            box.innerHTML = `
        <div class="section-label">Данные преподавателя</div>
        <div class="row-2">
          ${Auth.renderRefField({
              id: "cu_department",
              label: "Кафедра",
              refKey: "departments",
              required: false,
              placeholder: "Кафедра ИС",
          })}
          <div class="field"><label>Учёная степень</label><input type="text" id="cu_degree" placeholder="к.т.н."></div>
        </div>
        <div class="field"><label>Макс. нагрузка</label><input type="number" id="cu_maxLoad" value="8" min="1" max="30"></div>
      `;
        } else {
            box.innerHTML = `
        <div class="section-label">Данные администратора</div>
        <div class="row-2">
          ${Auth.renderRefField({
              id: "cu_department",
              label: "Подразделение",
              refKey: "departments",
              required: false,
              placeholder: "Кафедра ИС",
          })}
          <div class="field"><label>Должность</label><input type="text" id="cu_position" placeholder="Заведующий"></div>
        </div>
        <div class="field"><label>Уровень доступа</label>
          <select id="cu_accessLevel">
            <option>Полный</option>
            <option>Ограниченный</option>
            <option>Только чтение</option>
          </select>
        </div>
      `;
        }
    }

    function createUser() {
        const fio = document.getElementById("cu_fio")?.value.trim() || "";
        const email =
            document.getElementById("cu_email")?.value.trim().toLowerCase() ||
            "";
        const pass = document.getElementById("cu_pass")?.value || "";

        if (fio.length < 3) {
            App.toast("Введите ФИО");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            App.toast("Некорректный email");
            return;
        }
        if (pass.length < 6) {
            App.toast("Пароль минимум 6 символов");
            return;
        }

        const users = Storage.getUsers();
        if (users.some((u) => u.email === email)) {
            App.toast("Email уже занят");
            return;
        }

        const roleData = {};
        if (createRole === "student") {
            roleData.faculty = Auth.getRefValue("cu_faculty");
            roleData.group = Auth.getRefValue("cu_group");
            roleData.course = +document.getElementById("cu_course")?.value || 1;
        } else if (createRole === "teacher") {
            roleData.department = Auth.getRefValue("cu_department");
            roleData.degree =
                document.getElementById("cu_degree")?.value.trim() || "";
            roleData.maxLoad =
                +document.getElementById("cu_maxLoad")?.value || 8;
        } else {
            roleData.department = Auth.getRefValue("cu_department");
            roleData.position =
                document.getElementById("cu_position")?.value.trim() || "";
            roleData.accessLevel =
                document.getElementById("cu_accessLevel")?.value || "Полный";
        }

        users.push({
            id: uid(),
            role: createRole,
            fio,
            email,
            pass: hashPass(pass),
            blocked: false,
            ...roleData,
            createdAt: Date.now(),
        });
        Storage.setUsers(users);

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Создан пользователь",
                fio,
                ROLE_LABELS[createRole],
                "positive",
            );
        }

        closeModal();
        App.toast("Пользователь создан");
        App.navigate("users");
    }

    function openEditUserModal(id) {
        const u = Storage.getUserById(id);
        if (!u) return;

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Admin.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Редактировать пользователя</h3>
            <button class="modal-close" onclick="Admin.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div class="field">
            <label>ФИО</label>
            <input type="text" id="eu_fio" value="${escapeHtml(u.fio)}">
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" id="eu_email" value="${escapeHtml(u.email)}">
          </div>
          <div class="field">
            <label>Роль</label>
            <select id="eu_role">
              <option value="student" ${u.role === "student" ? "selected" : ""}>Студент</option>
              <option value="teacher" ${u.role === "teacher" ? "selected" : ""}>Преподаватель</option>
              <option value="admin"   ${u.role === "admin" ? "selected" : ""}>Администратор</option>
            </select>
          </div>
          <div class="field">
            <label>Новый пароль (оставьте пустым, чтобы не менять)</label>
            <input type="text" id="eu_pass" placeholder="••••••">
          </div>

          <div class="section-label">Доп. данные</div>
          ${renderExtraFieldsForEdit(u)}

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Admin.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Admin.saveUser('${u.id}')">Сохранить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
        setTimeout(() => {
            ["eu_faculty", "eu_group", "eu_department"].forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                const cur = el.dataset.current;
                if (!cur) return;
                if (el.tagName === "SELECT") {
                    const hasOpt = Array.from(el.options).some(
                        (o) => o.value === cur,
                    );
                    if (hasOpt) {
                        el.value = cur;
                    } else {
                        el.value = "__custom__";
                        const custom = document.getElementById(id + "_custom");
                        if (custom) {
                            custom.style.display = "block";
                            custom.value = cur;
                        }
                    }
                } else {
                    el.value = cur;
                }
            });
        }, 0);
    }

    function renderExtraFieldsForEdit(u) {
        const escapeHtml = Utils.escapeHtml;

        if (u.role === "student") {
            return `
        <div class="row-2">
          ${Auth.renderRefField({
              id: "eu_faculty",
              label: "Факультет",
              refKey: "faculties",
              required: false,
              placeholder: "ФИТ",
          }).replace(
              'id="eu_faculty"',
              `id="eu_faculty" data-current="${escapeHtml(u.faculty || "")}"`,
          )}
          ${Auth.renderRefField({
              id: "eu_group",
              label: "Группа",
              refKey: "groups",
              required: false,
              placeholder: "ПИ-21-1",
          }).replace(
              'id="eu_group"',
              `id="eu_group" data-current="${escapeHtml(u.group || "")}"`,
          )}
        </div>
        <div class="field"><label>Курс</label><input type="number" id="eu_course" value="${u.course || 1}" min="1" max="6"></div>
      `;
        }
        if (u.role === "teacher") {
            return `
        <div class="row-2">
          ${Auth.renderRefField({
              id: "eu_department",
              label: "Кафедра",
              refKey: "departments",
              required: false,
              placeholder: "Кафедра ИС",
          }).replace(
              'id="eu_department"',
              `id="eu_department" data-current="${escapeHtml(u.department || "")}"`,
          )}
          <div class="field"><label>Учёная степень</label><input type="text" id="eu_degree" value="${escapeHtml(u.degree || "")}"></div>
        </div>
        <div class="field"><label>Макс. нагрузка</label><input type="number" id="eu_maxLoad" value="${u.maxLoad || 8}"></div>
      `;
        }
        return `
      <div class="row-2">
        ${Auth.renderRefField({
            id: "eu_department",
            label: "Подразделение",
            refKey: "departments",
            required: false,
            placeholder: "Кафедра ИС",
        }).replace(
            'id="eu_department"',
            `id="eu_department" data-current="${escapeHtml(u.department || "")}"`,
        )}
        <div class="field"><label>Должность</label><input type="text" id="eu_position" value="${escapeHtml(u.position || "")}"></div>
      </div>
      <div class="field"><label>Уровень доступа</label>
        <select id="eu_accessLevel">
          <option ${u.accessLevel === "Полный" ? "selected" : ""}>Полный</option>
          <option ${u.accessLevel === "Ограниченный" ? "selected" : ""}>Ограниченный</option>
          <option ${u.accessLevel === "Только чтение" ? "selected" : ""}>Только чтение</option>
        </select>
      </div>
    `;
    }

    function saveUser(id) {
        const users = Storage.getUsers();
        const u = users.find((x) => Storage.sameId(x.id, id));
        if (!u) return;

        const newEmail =
            document.getElementById("eu_email")?.value.trim().toLowerCase() ||
            "";
        if (
            users.some((x) => !Storage.sameId(x.id, id) && x.email === newEmail)
        ) {
            App.toast("Email уже занят");
            return;
        }

        u.fio = document.getElementById("eu_fio")?.value.trim() || "";
        u.email = newEmail;
        u.role = document.getElementById("eu_role")?.value || "student";
        const pass = document.getElementById("eu_pass")?.value;
        if (pass) u.pass = hashPass(pass);

        if (u.role === "student") {
            u.faculty = Auth.getRefValue("eu_faculty");
            u.group = Auth.getRefValue("eu_group");
            u.course = +document.getElementById("eu_course")?.value || 1;
        } else if (u.role === "teacher") {
            u.department = Auth.getRefValue("eu_department");
            u.degree = document.getElementById("eu_degree")?.value.trim() || "";
            u.maxLoad = +document.getElementById("eu_maxLoad")?.value || 8;
        } else {
            u.department = Auth.getRefValue("eu_department");
            u.position =
                document.getElementById("eu_position")?.value.trim() || "";
            u.accessLevel =
                document.getElementById("eu_accessLevel")?.value || "Полный";
        }

        Storage.setUsers(users);

        if (typeof Audit !== "undefined") {
            Audit.log("Пользователь обновлён", u.fio, "", "info");
        }

        closeModal();
        App.toast("Пользователь обновлён");
        App.navigate("users");
    }

    /* =========================================================
       РАБОТЫ
       ========================================================= */
    VIEWS.works = function () {
        let works = Storage.getWorks();

        if (workFilter.status)
            works = works.filter((w) => w.status === workFilter.status);
        if (workFilter.type)
            works = works.filter((w) => w.type === workFilter.type);
        if (workFilter.q) {
            const q = workFilter.q.toLowerCase();
            works = works.filter(
                (w) =>
                    w.topic.toLowerCase().includes(q) ||
                    userName(w.studentId).toLowerCase().includes(q) ||
                    userName(w.teacherId).toLowerCase().includes(q),
            );
        }

        works.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Все работы (${works.length})</div>
          <button class="btn-ghost btn-sm" onclick="Admin.exportWorksCSV()">
            ${SVG.download({ cls: "icon icon-sm" })}
            <span>CSV</span>
          </button>
        </div>

        <div class="admin-filters">
          <select onchange="Admin.setWorkFilter('status', this.value)">
            <option value="">Все статусы</option>
            ${Object.entries(WORK_STATUSES)
                .map(
                    ([k, v]) =>
                        `<option value="${k}" ${workFilter.status === k ? "selected" : ""}>${v.label}</option>`,
                )
                .join("")}
          </select>
          <select onchange="Admin.setWorkFilter('type', this.value)">
            <option value="">Все типы</option>
            ${Object.entries(WORK_TYPES)
                .map(
                    ([k, v]) =>
                        `<option value="${k}" ${workFilter.type === k ? "selected" : ""}>${v.title || v}</option>`,
                )
                .join("")}
          </select>
          <input type="text" placeholder="Поиск по теме или автору..."
            value="${escapeHtml(workFilter.q)}"
            oninput="Admin.setWorkFilter('q', this.value)">
        </div>

        ${
            works.length === 0
                ? '<div class="empty">Нет работ по заданным фильтрам</div>'
                : works.map((w) => renderWorkRow(w)).join("")
        }
      </div>
    `;
    };

    function renderWorkRow(w) {
        const progress = calcProgress(w.id);
        const res = getFuzzyResult(w);
        const riskTerm = res ? res.risk.term : "low";
        const riskValue = res ? res.risk.value.toFixed(0) : "—";
        return `
      <div class="work-list-row">
        <div>
          <div class="work-list-topic">${escapeHtml(w.topic)}</div>
          <div class="work-list-sub">
            ${escapeHtml(userName(w.studentId))} · рук. ${escapeHtml(userName(w.teacherId))}
            · ${escapeHtml(Utils.workTypeLabel(w.type))}
          </div>
        </div>
        <div>${statusBadge(w.status)}</div>
        <div style="font-size:12px;">${progress}%</div>
        <div><span class="badge risk-${riskTerm}">риск ${riskValue}</span></div>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="App.navigate('work-detail', {id: '${w.id}'})">
            ${SVG.eye({ cls: "icon icon-sm" })}
          </button>
          <button class="btn-icon danger" onclick="Admin.deleteWork('${w.id}')">
            ${SVG.trash({ cls: "icon icon-sm" })}
          </button>
        </div>
      </div>
    `;
    }

    function setWorkFilter(key, val) {
        workFilter[key] = val;
        App.navigate("works");
    }

    function deleteWork(id) {
        if (!confirm("Удалить работу со всеми этапами, задачами и версиями?"))
            return;
        Storage.deleteWork(id);

        if (typeof Audit !== "undefined") {
            Audit.log("Работа удалена", "", `ID: ${id}`, "negative");
        }

        App.toast("Работа удалена");
        App.navigate("works");
    }

    VIEWS["work-detail"] = function (params) {
        const w = Storage.getWorkById(params?.id);
        if (!w)
            return '<div class="card"><div class="empty">Работа не найдена</div></div>';

        const s = Storage.getUserById(w.studentId);
        const t = Storage.getUserById(w.teacherId);
        const progress = calcProgress(w.id);
        const stages = Storage.getStagesByWork(w.id);
        const tasks = Storage.getTasksByWork(w.id);
        const versions = Storage.getVersionsByWork(w.id);
        const comments = Storage.getCommentsByWork(w.id);
        const res = getFuzzyResult(w);

        return `
      <div class="back-link" onclick="App.navigate('works')">← Назад к работам</div>

      <div class="student-hero">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <div class="student-hero-name">${escapeHtml(w.topic)}</div>
            <div class="student-hero-meta">
              ${escapeHtml(Utils.workTypeLabel(w.type))} · создана ${fmtDate(w.createdAt)}
              · обновлена ${fmtDate(w.updatedAt)}
            </div>
          </div>
          <div>${statusBadge(w.status)}</div>
        </div>

        <div class="student-hero-grid">
          <div class="stat-mini">
            <div class="num" style="font-size:13px;">${escapeHtml(s ? s.fio : "—")}</div>
            <div class="lbl">Студент</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="font-size:13px;">${escapeHtml(t ? t.fio : "—")}</div>
            <div class="lbl">Руководитель</div>
          </div>
          <div class="stat-mini">
            <div class="num">${progress}%</div>
            <div class="lbl">Прогресс</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--${res ? Utils.riskClass(res.risk.term) : "txt-muted"})">
              ${res ? res.risk.value.toFixed(0) : "—"}
            </div>
            <div class="lbl">Риск</div>
          </div>
        </div>
      </div>

      <div class="grid grid-3 mt-16">
        <div class="card">
          <div class="card-title">Этапы (${stages.length})</div>
          ${
              stages.length === 0
                  ? '<div class="empty">—</div>'
                  : stages
                        .map(
                            (st) => `
            <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);">
              ${st.done ? SVG.check({ cls: "icon icon-xs" }) : "○"} ${escapeHtml(st.name)}
            </div>
          `,
                        )
                        .join("")
          }
        </div>
        <div class="card">
          <div class="card-title">Задачи (${tasks.length})</div>
          ${
              tasks.length === 0
                  ? '<div class="empty">—</div>'
                  : tasks
                        .map(
                            (tk) => `
            <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);">
              • ${escapeHtml(tk.title)}
            </div>
          `,
                        )
                        .join("")
          }
        </div>
        <div class="card">
          <div class="card-title">Версии (${versions.length})</div>
          ${
              versions.length === 0
                  ? '<div class="empty">—</div>'
                  : versions
                        .map(
                            (v) => `
            <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);">
              v${escapeHtml(v.version)} · ${fmtDate(v.createdAt)}
            </div>
          `,
                        )
                        .join("")
          }
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Замечания (${comments.length})</div>
        ${
            comments.length === 0
                ? '<div class="empty">—</div>'
                : comments
                      .map((c) => {
                          const a = Storage.getUserById(c.authorId);
                          return `
            <div class="comment">
              <div class="comment-head">
                <span class="comment-author">${escapeHtml(a ? a.fio : "—")}</span>
                <span>${fmtDateTime(c.createdAt)}</span>
              </div>
              <div class="comment-text">${escapeHtml(c.text)}</div>
            </div>
          `;
                      })
                      .join("")
        }
      </div>
    `;
    };

    /* =========================================================
       ПРАВИЛА
       ========================================================= */
    VIEWS.rules = function () {
        const rules = Fuzzy.getRules();
        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Правила нечёткого вывода (${rules.length})</div>
          <button class="btn-ghost btn-sm" onclick="Admin.resetRules()">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Сбросить</span>
          </button>
        </div>
        <p style="font-size:12px;color:var(--txt-muted);margin-bottom:14px;">
          Полный редактор. Изменения влияют на все расчёты в системе.
        </p>

        ${rules
            .map(
                (r) => `
          <div class="rule-box ${r.enabled ? "" : "off"}">
            <input type="checkbox" ${r.enabled ? "checked" : ""}
              onchange="Admin.toggleRule('${r.id}', this.checked)">
            <div style="flex:1;">
              <div class="rule-if">ЕСЛИ ${escapeHtml(r.if.join(" И "))}</div>
              <div class="rule-then">ТО ${escapeHtml(r.then)}</div>
              <input type="text" class="rule-desc" value="${escapeHtml(r.desc)}"
                onchange="Admin.updateRuleDesc('${r.id}', this.value)">
            </div>
            <button class="btn-icon danger" onclick="Admin.deleteRule('${r.id}')">
              ${SVG.trash({ cls: "icon icon-sm" })}
            </button>
          </div>
        `,
            )
            .join("")}
      </div>
    `;
    };

    function toggleRule(id, enabled) {
        const rules = Fuzzy.getRules();
        const r = rules.find((x) => Storage.sameId(x.id, id));
        if (r) {
            r.enabled = enabled;
            Storage.setRules(rules);
            App.toast("Правило обновлено");
        }
    }

    function updateRuleDesc(id, desc) {
        const rules = Fuzzy.getRules();
        const r = rules.find((x) => Storage.sameId(x.id, id));
        if (r) {
            r.desc = desc;
            Storage.setRules(rules);
        }
    }

    function deleteRule(id) {
        if (!confirm("Удалить правило?")) return;
        const rules = Fuzzy.getRules().filter((r) => !Storage.sameId(r.id, id));
        Storage.setRules(rules);
        App.navigate("rules");
        App.toast("Правило удалено");
    }

    function resetRules() {
        if (!confirm("Сбросить все правила к значениям по умолчанию?")) return;
        Storage.setRules(null);
        App.toast("Правила сброшены");
        App.navigate("rules");
    }

    /* =========================================================
       АНАЛИТИКА
       ========================================================= */
    VIEWS.analytics = function () {
        const filtered = getFilteredWorksForAnalytics();
        const metrics = calcAnalyticsMetrics(filtered);
        const teachers = Storage.getUsers().filter((u) => u.role === "teacher");

        return `
      ${renderAnalyticsHero(metrics)}
      ${renderAnalyticsKpi(metrics)}
      ${renderAnalyticsFilters(teachers)}
      ${metrics.total === 0 ? renderAnalyticsEmpty() : ""}
      ${
          metrics.total > 0
              ? `
        ${renderAnalyticsCharts()}
        ${renderAnalyticsBars(metrics)}
        ${renderAnalyticsTops(metrics)}
        ${renderAnalyticsTables(metrics)}
      `
              : ""
      }
      ${renderAnalyticsExport()}
    `;
    };

    function renderAnalyticsHero(m) {
        return `
      <div class="mf-hero" style="margin-bottom:20px;">
        <div class="mf-hero-icon">
          ${SVG.trending({ cls: "icon icon-xl" })}
        </div>
        <div class="mf-hero-body">
          <div class="mf-hero-title">Аналитика по работам</div>
          <div class="mf-hero-text">
            Полная картина по всем курсовым и дипломным работам:
            <b>риски, прогресс, нагрузка на преподавателей</b>.
            Фильтруйте данные по статусу, типу или руководителю.
          </div>
        </div>
      </div>
    `;
    }

    function renderAnalyticsKpi(m) {
        const riskColor =
            m.avgRisk < 40 ? "ok" : m.avgRisk < 65 ? "warn" : "bad";
        const progressColor =
            m.avgProgress < 40 ? "bad" : m.avgProgress < 70 ? "warn" : "ok";

        return `
      <div class="metric-grid" style="margin-bottom:20px;">
        <div class="metric">
          <div class="metric-lbl">Всего работ</div>
          <div class="metric-val">${m.total}</div>
          <div class="metric-sub">в выборке</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Активных</div>
          <div class="metric-val" style="color:var(--info)">${m.active}</div>
          <div class="metric-sub">в работе / на проверке</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Высокий риск</div>
          <div class="metric-val" style="color:var(--bad)">${m.highRisk}</div>
          <div class="metric-sub">${m.total ? Math.round((m.highRisk / m.total) * 100) : 0}% от всех</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. прогресс</div>
          <div class="metric-val" style="color:var(--${progressColor})">${m.avgProgress}%</div>
          <div class="metric-sub">по всем работам</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. риск</div>
          <div class="metric-val" style="color:var(--${riskColor})">${m.avgRisk}</div>
          <div class="metric-sub">${Fuzzy.termLabel(Fuzzy.classify(m.avgRisk), "risk")}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. рейтинг</div>
          <div class="metric-val" style="color:var(--accent-viz)">${m.avgRating}</div>
          <div class="metric-sub">интегральный</div>
        </div>
      </div>
    `;
    }

    function renderAnalyticsFilters(teachers) {
        const hasFilter =
            analyticsFilter.status ||
            analyticsFilter.type ||
            analyticsFilter.teacherId;

        return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-head" style="margin-bottom:14px;">
          <div class="card-title" style="margin-bottom:0;">Фильтры</div>
          ${
              hasFilter
                  ? `
            <button class="btn-ghost btn-sm" onclick="Admin.resetAnalyticsFilter()">
              ${SVG.x({ cls: "icon icon-xs" })}
              <span>Сбросить</span>
            </button>
          `
                  : ""
          }
        </div>
        <div class="admin-filters" style="margin-bottom:0;">
          <select onchange="Admin.setAnalyticsFilter('status', this.value)">
            <option value="">Все статусы</option>
            ${Object.entries(Utils.WORK_STATUSES)
                .map(
                    ([k, v]) =>
                        `<option value="${k}" ${analyticsFilter.status === k ? "selected" : ""}>${v.label}</option>`,
                )
                .join("")}
          </select>
          <select onchange="Admin.setAnalyticsFilter('type', this.value)">
            <option value="">Все типы</option>
            ${Object.entries(Utils.WORK_TYPES)
                .map(
                    ([k, v]) =>
                        `<option value="${k}" ${analyticsFilter.type === k ? "selected" : ""}>${v.title}</option>`,
                )
                .join("")}
          </select>
          <select onchange="Admin.setAnalyticsFilter('teacherId', this.value)">
            <option value="">Все преподаватели</option>
            ${teachers
                .map(
                    (t) =>
                        `<option value="${t.id}" ${Storage.sameId(analyticsFilter.teacherId, t.id) ? "selected" : ""}>${escapeHtml(t.fio)}</option>`,
                )
                .join("")}
          </select>
        </div>
      </div>
    `;
    }

    function renderAnalyticsEmpty() {
        const hasFilter =
            analyticsFilter.status ||
            analyticsFilter.type ||
            analyticsFilter.teacherId;

        return `
      <div class="card" style="padding:40px 24px;text-align:center;">
        <div style="font-size:40px;opacity:0.4;margin-bottom:16px;">
          ${SVG.trending({ cls: "icon icon-2xl" })}
        </div>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px;">
          ${hasFilter ? "Нет данных по выбранным фильтрам" : "Работ пока нет"}
        </div>
        <div style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
          ${hasFilter ? "Попробуйте сбросить фильтры" : "Создайте или загрузите демо-данные"}
        </div>
        ${
            hasFilter
                ? `<button class="btn-ghost" onclick="Admin.resetAnalyticsFilter()">Сбросить фильтры</button>`
                : ""
        }
      </div>
    `;
    }

    function renderAnalyticsCharts() {
        return `
      <div class="grid grid-2" style="margin-bottom:20px;">
        <div class="card">
          <div class="card-title">Распределение по рискам</div>
          <div class="chart-box h-220"><canvas id="anChartRisk"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Распределение по статусам</div>
          <div class="chart-box h-220"><canvas id="anChartStatus"></canvas></div>
        </div>
      </div>
      <div class="grid grid-2" style="margin-bottom:20px;">
        <div class="card">
          <div class="card-title">Типы работ</div>
          <div class="chart-box h-220"><canvas id="anChartType"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Готовность к защите</div>
          <div class="chart-box h-220"><canvas id="anChartReady"></canvas></div>
        </div>
      </div>
    `;
    }

    function renderAnalyticsBars(m) {
        return `
      <div class="grid grid-2" style="margin-bottom:20px;">
        <div class="card">
          <div class="card-title">Нагрузка на преподавателей (Топ-10)</div>
          <div class="chart-box h-300"><canvas id="anChartLoad"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Средний прогресс по группам</div>
          <div class="chart-box h-300"><canvas id="anChartGroups"></canvas></div>
        </div>
      </div>
    `;
    }

    function renderAnalyticsTops(m) {
        const highRisk = [...m.enriched]
            .filter((e) => e.res.risk.term === "high" || e.res.risk.value > 50)
            .sort((a, b) => b.res.risk.value - a.res.risk.value)
            .slice(0, 5);

        const topProgress = [...m.enriched]
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5);

        return `
      <div class="grid grid-2" style="margin-bottom:20px;">
        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.alertTriangle({ cls: "icon icon-sm" })}
              Требуют внимания
            </div>
            <span class="count-chip">${highRisk.length}</span>
          </div>
          ${
              highRisk.length === 0
                  ? '<div class="empty" style="padding:20px;">Нет работ с высоким риском</div>'
                  : highRisk
                        .map(
                            (e) => `
            <div class="mini-project" onclick="App.navigate('work-detail', {id: '${e.w.id}'})">
              <div style="flex:1;min-width:0;">
                <div class="mini-project-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${escapeHtml(e.w.topic)}
                </div>
                <div class="mini-project-sub">
                  ${escapeHtml(e.student?.fio || "—")}
                  · рук. ${escapeHtml(e.teacher?.fio?.split(" ")[0] || "—")}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:14px;font-weight:600;color:var(--bad);">
                  ${e.res.risk.value.toFixed(0)}
                </div>
                <div style="font-size:11px;color:var(--txt-muted);">риск</div>
              </div>
            </div>
          `,
                        )
                        .join("")
          }
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.award({ cls: "icon icon-sm" })}
              Лучший прогресс
            </div>
            <span class="count-chip">${topProgress.length}</span>
          </div>
          ${
              topProgress.length === 0
                  ? '<div class="empty" style="padding:20px;">Нет данных</div>'
                  : topProgress
                        .map(
                            (e) => `
            <div class="mini-project" onclick="App.navigate('work-detail', {id: '${e.w.id}'})">
              <div style="flex:1;min-width:0;">
                <div class="mini-project-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${escapeHtml(e.w.topic)}
                </div>
                <div class="mini-project-sub">
                  ${escapeHtml(e.student?.fio || "—")}
                  · рук. ${escapeHtml(e.teacher?.fio?.split(" ")[0] || "—")}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:14px;font-weight:600;color:var(--ok);">
                  ${e.progress}%
                </div>
                <div style="font-size:11px;color:var(--txt-muted);">прогресс</div>
              </div>
            </div>
          `,
                        )
                        .join("")
          }
        </div>
      </div>
    `;
    }

    function renderAnalyticsTables(m) {
        const groups = groupAnalyticsByStudentGroup(m.enriched);
        const teachers = groupAnalyticsByTeacher(m.enriched);

        return `
      <div class="grid grid-2" style="margin-bottom:20px;">
        <div class="card analytics-summary-card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">Сводка по группам</div>
            <span class="count-chip">${groups.length}</span>
          </div>
          ${
              groups.length === 0
                  ? '<div class="empty" style="padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">Нет данных о группах</div>'
                  : `
            <div class="analytics-summary-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>Группа</th>
                    <th style="text-align:right;">Работ</th>
                    <th style="text-align:right;">Ср. прогресс</th>
                    <th style="text-align:right;">Ср. риск</th>
                  </tr>
                </thead>
                <tbody>
                  ${groups
                      .map(
                          (g) => `
                    <tr>
                      <td><b>${escapeHtml(g.name)}</b></td>
                      <td style="text-align:right;">${g.count}</td>
                      <td style="text-align:right;">
                        <span style="color:var(--${Utils.progressClass(g.avgProgress)});font-weight:600;">
                          ${g.avgProgress}%
                        </span>
                      </td>
                      <td style="text-align:right;">
                        <span style="color:var(--${Utils.riskClass(Fuzzy.classify(g.avgRisk))});font-weight:600;">
                          ${g.avgRisk}
                        </span>
                      </td>
                    </tr>
                  `,
                      )
                      .join("")}
                </tbody>
              </table>
            </div>
          `
          }
        </div>

        <div class="card analytics-summary-card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">Сводка по преподавателям</div>
            <span class="count-chip">${teachers.length}</span>
          </div>
          ${
              teachers.length === 0
                  ? '<div class="empty" style="padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">Нет данных</div>'
                  : `
            <div class="analytics-summary-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>Преподаватель</th>
                    <th style="text-align:right;">Работ</th>
                    <th style="text-align:right;">Ср. прогресс</th>
                    <th style="text-align:right;">Ср. риск</th>
                  </tr>
                </thead>
                <tbody>
                  ${teachers
                      .map(
                          (t) => `
                    <tr>
                      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        <b>${escapeHtml(t.name)}</b>
                      </td>
                      <td style="text-align:right;">${t.count}</td>
                      <td style="text-align:right;">
                        <span style="color:var(--${Utils.progressClass(t.avgProgress)});font-weight:600;">
                          ${t.avgProgress}%
                        </span>
                      </td>
                      <td style="text-align:right;">
                        <span style="color:var(--${Utils.riskClass(Fuzzy.classify(t.avgRisk))});font-weight:600;">
                          ${t.avgRisk}
                        </span>
                      </td>
                    </tr>
                  `,
                      )
                      .join("")}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      </div>
    `;
    }

    function renderAnalyticsExport() {
        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.download({ cls: "icon icon-sm" })}
            Экспорт и отчёты
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn-primary" onclick="Admin.exportWorksCSV()">
            ${SVG.download({ cls: "icon icon-sm" })}
            <span>Excel (CSV)</span>
          </button>
          <button class="btn-ghost" onclick="PdfReport.exportDepartment()">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>PDF-отчёт</span>
          </button>
          <button class="btn-ghost" onclick="Admin.generateReport()">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>Сводный отчёт</span>
          </button>
        </div>
        <div id="reportBox" style="margin-top:16px;"></div>
      </div>
    `;
    }

    VIEWS.analytics_after = function () {
        if (!Charts.hasChart()) return;

        const filtered = getFilteredWorksForAnalytics();
        const metrics = calcAnalyticsMetrics(filtered);
        if (metrics.total === 0) return;

        const { enriched } = metrics;

        const riskLow = enriched.filter(
            (e) => e.res.risk.term === "low",
        ).length;
        const riskMed = enriched.filter(
            (e) => e.res.risk.term === "med",
        ).length;
        const riskHigh = enriched.filter(
            (e) => e.res.risk.term === "high",
        ).length;

        Charts.doughnut(
            "anChartRisk",
            ["Низкий", "Средний", "Высокий"],
            [riskLow, riskMed, riskHigh],
            [Charts.COLORS.ok, Charts.COLORS.warn, Charts.COLORS.bad],
        );

        const statusLabels = {
            draft: "Черновик",
            pending: "На утверждении",
            active: "В работе",
            review: "На проверке",
            approved: "Допущена",
            done: "Защищена",
            rejected: "Отклонена",
        };
        const statusCounts = {};
        enriched.forEach((e) => {
            statusCounts[e.w.status] = (statusCounts[e.w.status] || 0) + 1;
        });
        const statusKeys = Object.keys(statusCounts);

        Charts.doughnut(
            "anChartStatus",
            statusKeys.map((k) => statusLabels[k] || k),
            statusKeys.map((k) => statusCounts[k]),
            [
                "#94a3b8",
                Charts.COLORS.warn,
                Charts.COLORS.info,
                Charts.COLORS.purple,
                Charts.COLORS.ok,
                "#16a34a",
                Charts.COLORS.bad,
            ],
        );

        const typeCounts = {};
        enriched.forEach((e) => {
            typeCounts[e.w.type] = (typeCounts[e.w.type] || 0) + 1;
        });
        const typeKeys = Object.keys(typeCounts);

        Charts.doughnut(
            "anChartType",
            typeKeys.map((k) => Utils.workTypeLabel(k)),
            typeKeys.map((k) => typeCounts[k]),
            [
                Charts.COLORS.accent,
                Charts.COLORS.purple,
                Charts.COLORS.info,
                "#0ea5e9",
            ],
        );

        const readyLow = enriched.filter(
            (e) => e.res.ready.term === "low",
        ).length;
        const readyMed = enriched.filter(
            (e) => e.res.ready.term === "med",
        ).length;
        const readyHigh = enriched.filter(
            (e) => e.res.ready.term === "high",
        ).length;

        Charts.doughnut(
            "anChartReady",
            ["Низкая", "Средняя", "Высокая"],
            [readyLow, readyMed, readyHigh],
            [Charts.COLORS.bad, Charts.COLORS.warn, Charts.COLORS.ok],
        );

        const teacherLoad = groupAnalyticsByTeacher(enriched).slice(0, 10);

        Charts.bar(
            "anChartLoad",
            teacherLoad.map((t) => {
                const parts = t.name.split(" ");
                return parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
            }),
            teacherLoad.map((t) => t.count),
            teacherLoad.map((t) =>
                t.count > 15
                    ? Charts.COLORS.bad
                    : t.count > 8
                      ? Charts.COLORS.warn
                      : Charts.COLORS.ok,
            ),
            { label: "Работ", horizontal: true },
        );

        const groupProgress = groupAnalyticsByStudentGroup(enriched);

        if (groupProgress.length > 0) {
            Charts.bar(
                "anChartGroups",
                groupProgress.map((g) => g.name),
                groupProgress.map((g) => g.avgProgress),
                groupProgress.map((g) =>
                    g.avgProgress < 40
                        ? Charts.COLORS.bad
                        : g.avgProgress < 70
                          ? Charts.COLORS.warn
                          : Charts.COLORS.ok,
                ),
                { label: "Ср. прогресс, %", horizontal: true, max: 100 },
            );
        }
    };

    function generateReport() {
        const filtered = getFilteredWorksForAnalytics();
        const m = calcAnalyticsMetrics(filtered);
        const box = document.getElementById("reportBox");
        if (!box) return;

        const high = m.enriched
            .filter((e) => e.res.risk.term === "high")
            .sort((a, b) => b.res.risk.value - a.res.risk.value);

        const groups = groupAnalyticsByStudentGroup(m.enriched);
        const teachers = groupAnalyticsByTeacher(m.enriched);

        const filterDesc = [];
        if (analyticsFilter.status)
            filterDesc.push(
                `статус: ${Utils.WORK_STATUSES[analyticsFilter.status]?.label || analyticsFilter.status}`,
            );
        if (analyticsFilter.type)
            filterDesc.push(
                `тип: ${Utils.workTypeLabel(analyticsFilter.type)}`,
            );
        if (analyticsFilter.teacherId) {
            const t = Storage.getUserById(analyticsFilter.teacherId);
            filterDesc.push(`руководитель: ${t?.fio || "—"}`);
        }

        box.innerHTML = `
      <div style="background:var(--bg-soft);padding:20px;border-radius:10px;font-size:13px;line-height:1.7;">
        <h4 style="margin-bottom:14px;font-size:15px;">Сводный отчёт</h4>

        <p style="color:var(--txt-muted);margin-bottom:12px;">
          <b>Дата:</b> ${new Date().toLocaleString("ru-RU")}<br>
          ${filterDesc.length ? `<b>Фильтры:</b> ${filterDesc.join(", ")}` : "<b>Фильтры:</b> нет (все работы)"}
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
          <div><b>Всего работ:</b> ${m.total}</div>
          <div><b>Активных:</b> ${m.active}</div>
          <div><b>Высокий риск:</b> <span style="color:var(--bad)">${m.highRisk}</span></div>
          <div><b>Ср. прогресс:</b> ${m.avgProgress}%</div>
          <div><b>Ср. риск:</b> ${m.avgRisk}</div>
          <div><b>Ср. рейтинг:</b> ${m.avgRating}</div>
        </div>

        ${
            high.length
                ? `
          <p style="margin-top:14px;"><b>Требуют внимания (${high.length}):</b></p>
          <ul style="margin-left:20px;margin-top:6px;">
            ${high
                .slice(0, 10)
                .map(
                    (e) =>
                        `<li>${escapeHtml(e.student?.fio || "—")} — «${escapeHtml(e.w.topic)}» (риск ${e.res.risk.value.toFixed(1)})</li>`,
                )
                .join("")}
            ${high.length > 10 ? `<li style="color:var(--txt-muted);">... и ещё ${high.length - 10}</li>` : ""}
          </ul>
        `
                : '<p style="color:var(--ok);margin-top:14px;">✓ Работ с высоким риском нет</p>'
        }

        ${
            groups.length
                ? `
          <p style="margin-top:14px;"><b>По группам:</b></p>
          <ul style="margin-left:20px;margin-top:6px;">
            ${groups
                .slice(0, 5)
                .map(
                    (g) =>
                        `<li><b>${escapeHtml(g.name)}</b> — ${g.count} работ, ср. прогресс ${g.avgProgress}%, ср. риск ${g.avgRisk}</li>`,
                )
                .join("")}
          </ul>
        `
                : ""
        }

        ${
            teachers.length
                ? `
          <p style="margin-top:14px;"><b>По преподавателям (Топ-5 по нагрузке):</b></p>
          <ul style="margin-left:20px;margin-top:6px;">
            ${teachers
                .slice(0, 5)
                .map(
                    (t) =>
                        `<li><b>${escapeHtml(t.name)}</b> — ${t.count} работ, ср. прогресс ${t.avgProgress}%, ср. риск ${t.avgRisk}</li>`,
                )
                .join("")}
          </ul>
        `
                : ""
        }
      </div>
    `;
        App.toast("Отчёт сформирован");
    }

    function exportWorksCSV() {
        const works = Storage.getWorks();
        if (works.length === 0) {
            App.toast("Нет данных для экспорта");
            return;
        }

        const escapeCSV = (v) => {
            const s = String(v === null || v === undefined ? "" : v);
            if (s.includes('"') || s.includes(",") || s.includes("\n")) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };

        const rows = [
            [
                "ID",
                "Студент",
                "Руководитель",
                "Тема",
                "Тип",
                "Статус",
                "Прогресс",
                "Риск",
                "Готовность",
                "Рейтинг",
            ],
        ];

        works.forEach((w) => {
            const inputs = Utils.buildFuzzyInputs(w);
            const res = Utils.safeFuzzyInfer(inputs);
            if (!res) return;
            rows.push([
                w.id,
                userName(w.studentId),
                userName(w.teacherId),
                w.topic,
                Utils.workTypeLabel(w.type),
                WORK_STATUSES[w.status]?.label || w.status,
                inputs.progress ?? 0,
                res.risk.value.toFixed(1),
                res.ready.value.toFixed(1),
                res.rating.value.toFixed(1),
            ]);
        });

        const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `fuzzyproject_works_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 500);

        App.toast(`CSV экспортирован (${works.length} работ)`);
    }

    function exportBackup() {
        const backup = {};
        Object.values(Storage.KEYS).forEach((key) => {
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    backup[key] = JSON.parse(val);
                } catch (e) {
                    backup[key] = val;
                }
            }
        });

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `fuzzyproject_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 500);

        if (typeof Audit !== "undefined") {
            Audit.log("Экспорт резервной копии", "", "", "info");
        }

        App.toast("Резервная копия скачана");
    }

    function importBackup(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (
            !confirm(
                "Восстановить из резервной копии? Текущие данные будут перезаписаны.",
            )
        ) {
            event.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const backup = JSON.parse(e.target.result);

                Object.keys(backup).forEach((key) => {
                    if (key.startsWith("fp_")) {
                        const val = backup[key];
                        localStorage.setItem(
                            key,
                            typeof val === "string" ? val : JSON.stringify(val),
                        );
                    }
                });

                App.toast("Данные восстановлены. Перезагрузка...");
                setTimeout(() => location.reload(), 800);
            } catch (err) {
                console.error(err);
                App.toast("Ошибка чтения файла");
            }
        };
        reader.readAsText(file);
    }

    /* =========================================================
       СПРАВОЧНИКИ
       ========================================================= */
    const REF_KEY = "fp_refs";

    function getRefs() {
        return Storage.get(REF_KEY, {
            faculties: ["ФИТ", "ФЭН", "ГФ"],
            departments: [
                "Кафедра информационных систем",
                "Кафедра математики",
            ],
            groups: ["ПИ-21-1", "ПИ-21-2", "ИВТ-22-1"],
            directions: ["Программная инженерия", "Информационные системы"],
        });
    }
    function setRefs(refs) {
        Storage.set(REF_KEY, refs);
    }

    VIEWS.refs = function () {
        const refs = getRefs();
        const titles = {
            faculties: "Факультеты",
            departments: "Кафедры",
            groups: "Группы",
            directions: "Направления",
        };

        return `
      <div class="card">
        <div class="card-title">Справочники</div>
        <p style="font-size:12px;color:var(--txt-muted);margin-bottom:14px;">
          Используются для выпадающих списков при регистрации и создании пользователей.
        </p>
        ${Object.keys(titles)
            .map(
                (key) => `
          <div style="margin-bottom:18px;">
            <div class="section-label">${titles[key]}</div>
            <div class="ref-list">
              ${(refs[key] || [])
                  .map(
                      (item, i) => `
                <span class="ref-chip">
                  ${escapeHtml(item)}
                  <button onclick="Admin.deleteRef('${key}', ${i})" title="Удалить">✕</button>
                </span>
              `,
                  )
                  .join("")}
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <input type="text" id="ref_new_${key}" placeholder="Добавить..."
                style="flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:var(--r-sm);font-size:13px;background:var(--bg-elev);color:var(--txt);"
                onkeydown="if(event.key==='Enter') Admin.addRef('${key}')">
              <button class="btn-ghost btn-sm" onclick="Admin.addRef('${key}')">+ Добавить</button>
            </div>
          </div>
        `,
            )
            .join("")}
      </div>
    `;
    };

    function addRef(key) {
        const inp = document.getElementById("ref_new_" + key);
        const val = inp?.value.trim();
        if (!val) return;
        const refs = getRefs();
        if (!Array.isArray(refs[key])) refs[key] = [];
        if (!refs[key].includes(val)) refs[key].push(val);
        setRefs(refs);
        App.navigate("refs");
        App.toast("Добавлено");
    }
    function deleteRef(key, i) {
        if (!confirm("Удалить значение из справочника?")) return;
        const refs = getRefs();
        if (!Array.isArray(refs[key])) return;
        refs[key].splice(i, 1);
        setRefs(refs);
        App.navigate("refs");
    }

    /* =========================================================
       НАСТРОЙКИ
       ========================================================= */
    const SETTINGS_KEY = "fp_settings";

    function getSettings() {
        return Storage.get(SETTINGS_KEY, {
            systemName: "Meridian",
            academicYear: "2024/2025",
            defaultDeadlineDays: 30,
            notifyBeforeDays: 3,
        });
    }
    function setSettings(s) {
        Storage.set(SETTINGS_KEY, s);
    }

    VIEWS.settings = function () {
        const s = getSettings();
        return `
      <div class="card">
        <div class="card-title">Настройки системы</div>
        <div class="form-grid">
          <div class="field">
            <label>Название системы</label>
            <input type="text" id="set_name" value="${escapeHtml(s.systemName)}">
          </div>
          <div class="field">
            <label>Учебный год</label>
            <input type="text" id="set_year" value="${escapeHtml(s.academicYear)}">
          </div>
          <div class="field">
            <label>Дедлайн по умолчанию (дней)</label>
            <input type="number" id="set_deadline" value="${s.defaultDeadlineDays}" min="1" max="365">
          </div>
          <div class="field">
            <label>Напоминать за N дней</label>
            <input type="number" id="set_notify" value="${s.notifyBeforeDays}" min="1" max="30">
          </div>
        </div>
        <button class="btn-primary mt-16" onclick="Admin.saveSettings()">Сохранить</button>
      </div>

      <div class="card mt-16 danger-zone">
        <div class="card-title">Опасная зона</div>
        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
          Полный сброс удалит всех пользователей, работы, этапы, задачи, версии, правила и настройки.
        </p>
        <button class="btn-ghost btn-danger" onclick="Admin.fullReset()">
          ${SVG.trash({ cls: "icon icon-sm" })}
          <span>Полный сброс системы</span>
        </button>
      </div>
    `;
    };

    function saveSettings() {
        setSettings({
            systemName:
                document.getElementById("set_name")?.value.trim() || "Meridian",
            academicYear:
                document.getElementById("set_year")?.value.trim() ||
                "2024/2025",
            defaultDeadlineDays:
                +document.getElementById("set_deadline")?.value || 30,
            notifyBeforeDays:
                +document.getElementById("set_notify")?.value || 3,
        });

        if (typeof Audit !== "undefined") {
            Audit.log("Настройки сохранены", "", "", "info");
        }

        App.toast("Настройки сохранены");
    }

    function fullReset() {
        if (!confirm("ВНИМАНИЕ! Все данные будут удалены. Продолжить?")) return;
        if (!confirm("Вы точно уверены? Это действие необратимо.")) return;

        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("fp_")) localStorage.removeItem(key);
        });

        location.reload();
    }

    /* =========================================================
       ПРОФИЛЬ
       ========================================================= */
    VIEWS.profile = function () {
        const u = getUser();
        if (!u) return "";
        return `
      <div class="card">
        <div class="card-title">Профиль</div>
        <div class="grid grid-2">
          <div><div class="text-muted" style="font-size:12px;">ФИО</div><div>${escapeHtml(u.fio)}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Email</div><div>${escapeHtml(u.email)}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Роль</div><div>Администратор</div></div>
          <div><div class="text-muted" style="font-size:12px;">Подразделение</div><div>${escapeHtml(u.department || "—")}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Должность</div><div>${escapeHtml(u.position || "—")}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Уровень доступа</div><div>${escapeHtml(u.accessLevel || "—")}</div></div>
        </div>
      </div>
    `;
    };

    /* =========================================================
       ПРОФИЛЬ ПРЕПОДАВАТЕЛЯ
       ========================================================= */
    VIEWS["teacher-profile"] = function (params) {
        const t = Storage.getUserById(params?.id);
        if (!t)
            return '<div class="card"><div class="empty">Преподаватель не найден</div></div>';

        const works = Storage.getWorksByTeacher(t.id);
        const active = works.filter(
            (w) => w.status !== "done" && w.status !== "rejected",
        );

        const withRisk = active
            .map((w) => {
                const progress = calcProgress(w.id);
                const res = getFuzzyResult(w);
                if (!res) return null;
                return {
                    w,
                    progress,
                    res,
                    student: Storage.getUserById(w.studentId),
                };
            })
            .filter(Boolean);

        const avgProgress = withRisk.length
            ? Math.round(
                  withRisk.reduce((a, x) => a + x.progress, 0) /
                      withRisk.length,
              )
            : 0;
        const highRisk = withRisk.filter(
            (x) => x.res.risk.term === "high",
        ).length;

        const init = Utils.initials(t.fio);
        const maxLoad = t.maxLoad || 8;
        const loadPct = Math.min(
            100,
            Math.round((active.length / maxLoad) * 100),
        );

        return `
      <div class="back-link" onclick="App.navigate('users')">← К пользователям</div>

      <div class="profile-hero">
        <div class="profile-hero-avatar">${init}</div>
        <div class="profile-hero-body">
          <div class="profile-hero-name">${escapeHtml(t.fio)}</div>
          <div class="profile-hero-sub">${escapeHtml(t.email)}</div>
          <div class="profile-hero-chips">
            <span class="role-chip teacher">Преподаватель</span>
            ${t.degree ? `<span class="tag">${escapeHtml(t.degree)}</span>` : ""}
            ${t.department ? `<span class="tag">${escapeHtml(t.department)}</span>` : ""}
          </div>
        </div>
        <div class="profile-hero-stats">
          <div class="stat-mini">
            <div class="num">${active.length}/${maxLoad}</div>
            <div class="lbl">Загрузка</div>
          </div>
          <div class="stat-mini">
            <div class="num">${avgProgress}%</div>
            <div class="lbl">Ср. прогресс</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--${highRisk > 0 ? "bad" : "ok"})">${highRisk}</div>
            <div class="lbl">Высокий риск</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Профессиональные данные</div>
          <div class="info-grid">
            <div class="info-item"><div class="info-lbl">ФИО</div><div class="info-val">${escapeHtml(t.fio)}</div></div>
            <div class="info-item"><div class="info-lbl">Email</div><div class="info-val">${escapeHtml(t.email)}</div></div>
            <div class="info-item"><div class="info-lbl">Кафедра</div><div class="info-val">${escapeHtml(t.department || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Учёная степень</div><div class="info-val">${escapeHtml(t.degree || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Макс. нагрузка</div><div class="info-val">${maxLoad} работ</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Загрузка и активность</div>
          <div style="margin-bottom:12px;">
            <div class="stat-row">
              <span class="stat-lbl">Текущая загрузка</span>
              <span class="stat-val">${active.length} / ${maxLoad}</span>
            </div>
            <div class="progress ${loadPct > 90 ? "low" : loadPct > 70 ? "med" : "high"}">
              <div style="width:${loadPct}%"></div>
            </div>
          </div>
          <div class="chart-box h-180">
            <canvas id="adminTeacherRisk"></canvas>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title">Студенты и работы (${works.length})</div>
        </div>
        ${
            works.length === 0
                ? '<div class="empty">Работ нет</div>'
                : works
                      .map((w) => {
                          const student = Storage.getUserById(w.studentId);
                          const progress = calcProgress(w.id);
                          const res = getFuzzyResult(w);
                          const riskValue = res
                              ? res.risk.value.toFixed(0)
                              : "—";
                          return `
                <div class="mini-project" onclick="App.navigate('work-detail', {id: '${w.id}'})">
                  <div>
                    <div class="mini-project-title">${escapeHtml(w.topic)}</div>
                    <div class="mini-project-sub">
                      ${escapeHtml(student?.fio || "—")} · ${statusBadge(w.status)}
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:14px;font-weight:600;">${progress}%</div>
                    <div style="font-size:11px;color:var(--txt-muted);">риск ${riskValue}</div>
                  </div>
                </div>
              `;
                      })
                      .join("")
        }
      </div>
    `;
    };

    VIEWS["teacher-profile_after"] = function (params) {
        if (!Charts.hasChart()) return;
        const t = Storage.getUserById(params?.id);
        if (!t) return;

        const works = Storage.getWorksByTeacher(t.id);
        const active = works.filter(
            (w) => w.status !== "done" && w.status !== "rejected",
        );

        let low = 0,
            med = 0,
            high = 0;
        active.forEach((w) => {
            const res = getFuzzyResult(w);
            if (!res) return;
            if (res.risk.term === "low") low++;
            else if (res.risk.term === "med") med++;
            else high++;
        });

        Charts.doughnut(
            "adminTeacherRisk",
            ["Низкий", "Средний", "Высокий"],
            [low, med, high],
            [Charts.COLORS.ok, Charts.COLORS.warn, Charts.COLORS.bad],
        );
    };

    /* =========================================================
       ПРОФИЛЬ СТУДЕНТА
       ========================================================= */
    VIEWS["student-profile"] = function (params) {
        const s = Storage.getUserById(params?.id);
        if (!s)
            return '<div class="card"><div class="empty">Студент не найден</div></div>';

        const works = Storage.getWorksByStudent(s.id);

        let totalProgress = 0,
            totalRating = 0,
            cnt = 0;
        works.forEach((w) => {
            totalProgress += calcProgress(w.id);
            const res = getFuzzyResult(w);
            if (res) {
                totalRating += res.rating.value;
                cnt++;
            }
        });
        const avg = (x) => (cnt ? Math.round(x / cnt) : 0);

        const init = Utils.initials(s.fio);

        return `
      <div class="back-link" onclick="App.navigate('users')">← К пользователям</div>

      <div class="profile-hero">
        <div class="profile-hero-avatar">${init}</div>
        <div class="profile-hero-body">
          <div class="profile-hero-name">${escapeHtml(s.fio)}</div>
          <div class="profile-hero-sub">${escapeHtml(s.email)}</div>
          <div class="profile-hero-chips">
            <span class="role-chip student">Студент</span>
            ${s.group ? `<span class="tag">${escapeHtml(s.group)}</span>` : ""}
            ${s.faculty ? `<span class="tag">${escapeHtml(s.faculty)}</span>` : ""}
            ${s.course ? `<span class="tag">${s.course} курс</span>` : ""}
          </div>
        </div>
        <div class="profile-hero-stats">
          <div class="stat-mini">
            <div class="num">${works.length}</div>
            <div class="lbl">Работ</div>
          </div>
          <div class="stat-mini">
            <div class="num">${avg(totalProgress)}%</div>
            <div class="lbl">Прогресс</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--accent)">${avg(totalRating)}</div>
            <div class="lbl">Рейтинг</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Личные данные</div>
        <div class="info-grid">
          <div class="info-item"><div class="info-lbl">ФИО</div><div class="info-val">${escapeHtml(s.fio)}</div></div>
          <div class="info-item"><div class="info-lbl">Email</div><div class="info-val">${escapeHtml(s.email)}</div></div>
          <div class="info-item"><div class="info-lbl">Факультет</div><div class="info-val">${escapeHtml(s.faculty || "—")}</div></div>
          <div class="info-item"><div class="info-lbl">Группа</div><div class="info-val">${escapeHtml(s.group || "—")}</div></div>
          <div class="info-item"><div class="info-lbl">Курс</div><div class="info-val">${s.course || "—"}</div></div>
          <div class="info-item"><div class="info-lbl">Регистрация</div><div class="info-val">${fmtDate(s.createdAt)}</div></div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Работы студента (${works.length})</div>
        ${
            works.length === 0
                ? '<div class="empty">Работ нет</div>'
                : works
                      .map((w) => {
                          const progress = calcProgress(w.id);
                          const res = getFuzzyResult(w);
                          const riskValue = res
                              ? res.risk.value.toFixed(0)
                              : "—";
                          return `
                <div class="mini-project" onclick="App.navigate('work-detail', {id: '${w.id}'})">
                  <div>
                    <div class="mini-project-title">${escapeHtml(w.topic)}</div>
                    <div class="mini-project-sub">
                      ${escapeHtml(Utils.workTypeLabel(w.type))} · ${statusBadge(w.status)}
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:14px;font-weight:600;">${progress}%</div>
                    <div style="font-size:11px;color:var(--txt-muted);">риск ${riskValue}</div>
                  </div>
                </div>
              `;
                      })
                      .join("")
        }
      </div>
    `;
    };

    /* =========================================================
       ПОДКЛЮЧЕНИЕ ВНЕШНИХ МОДУЛЕЙ
       ========================================================= */
    VIEWS.mamdani = function (params) {
        return MamdaniViz.render(params);
    };
    VIEWS.simulate = function (params) {
        return Simulate.render(params);
    };
    VIEWS.audit = function () {
        return Audit.renderAuditPage();
    };
    VIEWS.mfEditor = function () {
        return MFEditor.render();
    };
    VIEWS.mfEditor_after = function () {
        MFEditor.applyOverrides();
    };
    VIEWS.rankings = function () {
        return Ranking.renderRankingSection();
    };
    VIEWS.consultations = function () {
        return Consult.renderPage(getUser());
    };
    VIEWS.announcements = function () {
        const list = Announcements.getAll().sort(
            (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        );

        const activeCount = list.filter(
            (a) =>
                a.active !== false &&
                (!a.expiresAt || a.expiresAt > Date.now()),
        ).length;

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Объявления
            <span class="count-chip">${list.length}</span>
          </div>
          <button class="btn-primary btn-sm" onclick="Admin.openCreateAnnouncement()">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Создать</span>
          </button>
        </div>

        <div class="metric-grid" style="margin-bottom:16px;">
          <div class="metric">
            <div class="metric-lbl">Всего</div>
            <div class="metric-val">${list.length}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Активных</div>
            <div class="metric-val" style="color:var(--ok)">${activeCount}</div>
          </div>
          <div class="metric">
            <div class="metric-lbl">Отключено</div>
            <div class="metric-val" style="color:var(--txt-muted)">
              ${list.length - activeCount}
            </div>
          </div>
        </div>

        ${
            list.length === 0
                ? emptyState(
                      "Объявлений пока нет",
                      "Создайте объявление — оно появится у выбранных пользователей на дашборде.",
                      SVG.bell,
                  )
                : list.map((a) => renderAnnouncementRow(a)).join("")
        }
      </div>
    `;
    };

    function renderAnnouncementRow(a) {
        const isActive =
            a.active !== false && (!a.expiresAt || a.expiresAt > Date.now());
        const isExpired = a.expiresAt && a.expiresAt <= Date.now();

        const IconFn =
            a.priority === "urgent"
                ? SVG.alertTriangle
                : a.priority === "important"
                  ? SVG.info
                  : SVG.bell;

        const priorityLabel = Announcements.PRIORITY_LABELS[a.priority] || "";

        return `
      <div class="ann-admin-row ${isActive ? "" : "off"} ann-${a.priority}">
        <div class="ann-admin-icon">
          ${IconFn({ cls: "icon icon-lg" })}
        </div>
        <div class="ann-admin-body">
          <div class="ann-admin-head">
            <div class="ann-admin-title">${escapeHtml(a.title)}</div>
            <div class="ann-admin-badges">
              <span class="ann-priority ann-priority-${a.priority}">${priorityLabel}</span>
              ${
                  isExpired
                      ? '<span class="badge rejected" style="font-size:10px;">истекло</span>'
                      : isActive
                        ? '<span class="badge approved" style="font-size:10px;">активно</span>'
                        : '<span class="badge draft" style="font-size:10px;">выключено</span>'
              }
            </div>
          </div>
          <div class="ann-admin-text">${escapeHtml(a.text)}</div>
          <div class="ann-admin-meta">
            ${escapeHtml(Announcements.describeAudience(a))}
            · создано ${fmtDateTime(a.createdAt)}
            ${a.expiresAt ? ` · до ${fmtDate(a.expiresAt)}` : ""}
          </div>
        </div>
        <div class="ann-admin-actions">
          <button class="btn-ghost btn-sm"
            onclick="Admin.toggleAnnouncementActive('${a.id}')">
            ${isActive ? SVG.x({ cls: "icon icon-sm" }) : SVG.check({ cls: "icon icon-sm" })}
            <span>${isActive ? "Выключить" : "Включить"}</span>
          </button>
          <button class="btn-icon danger"
            onclick="Admin.deleteAnnouncement('${a.id}')" title="Удалить">
            ${SVG.trash({ cls: "icon icon-sm" })}
          </button>
        </div>
      </div>
    `;
    }

    let annAudience = "all";

    function openCreateAnnouncement() {
        annAudience = "all";
        renderCreateAnnouncementModal();
    }

    function renderCreateAnnouncementModal() {
        const teachers = Storage.getTeachers();
        const students = Storage.getStudents();
        const refs = Storage.get("fp_refs", { groups: [] });
        const groups = Array.isArray(refs.groups) ? refs.groups : [];

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Admin.closeModal()">
        <div class="modal" style="max-width:560px;">
          <div class="modal-head">
            <h3>Новое объявление</h3>
            <button class="modal-close" onclick="Admin.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div class="field">
            <label>Заголовок <span class="req">*</span></label>
            <input type="text" id="ann_title" placeholder="Например: Перенос даты защиты">
          </div>

          <div class="field">
            <label>Текст объявления <span class="req">*</span></label>
            <textarea id="ann_text" rows="4"
              placeholder="Опишите подробности — все выбранные пользователи увидят это на дашборде"></textarea>
          </div>

          <div class="section-label">Кому показать</div>
          <div class="role-picker ann-audience-picker">
            <button type="button" data-aud="all"
              class="${annAudience === "all" ? "active" : ""}"
              onclick="Admin.pickAnnAudience('all')">
              ${SVG.users({ cls: "icon icon-xl" })}
              <span class="role-lbl">Всем</span>
            </button>
            <button type="button" data-aud="students"
              class="${annAudience === "students" ? "active" : ""}"
              onclick="Admin.pickAnnAudience('students')">
              ${SVG.graduation({ cls: "icon icon-xl" })}
              <span class="role-lbl">Студентам</span>
            </button>
            <button type="button" data-aud="teachers"
              class="${annAudience === "teachers" ? "active" : ""}"
              onclick="Admin.pickAnnAudience('teachers')">
              ${SVG.users({ cls: "icon icon-xl" })}
              <span class="role-lbl">Преподавателям</span>
            </button>
          </div>

          <div class="role-picker ann-audience-picker" style="grid-template-columns:1fr 1fr;">
            <button type="button" data-aud="user"
              class="${annAudience === "user" ? "active" : ""}"
              onclick="Admin.pickAnnAudience('user')">
              ${SVG.user({ cls: "icon icon-xl" })}
              <span class="role-lbl">Пользователю</span>
            </button>
            <button type="button" data-aud="group"
              class="${annAudience === "group" ? "active" : ""}"
              onclick="Admin.pickAnnAudience('group')">
              ${SVG.grid({ cls: "icon icon-xl" })}
              <span class="role-lbl">Группе</span>
            </button>
          </div>

          <div id="ann_audienceFields"></div>

          <div class="section-label">Приоритет</div>
          <div class="role-picker ann-priority-picker">
            <button type="button" data-pri="normal"
              class="active"
              onclick="Admin.pickAnnPriority('normal')">
              ${SVG.bell({ cls: "icon icon-xl" })}
              <span class="role-lbl">Обычное</span>
            </button>
            <button type="button" data-pri="important"
              onclick="Admin.pickAnnPriority('important')">
              ${SVG.info({ cls: "icon icon-xl" })}
              <span class="role-lbl">Важное</span>
            </button>
            <button type="button" data-pri="urgent"
              onclick="Admin.pickAnnPriority('urgent')">
              ${SVG.alertTriangle({ cls: "icon icon-xl" })}
              <span class="role-lbl">Срочное</span>
            </button>
          </div>

          <div class="field">
            <label>Действует до (необязательно)</label>
            <input type="date" id="ann_expires">
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Admin.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Admin.createAnnouncement()">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Опубликовать</span>
            </button>
          </div>
        </div>
      </div>
    `;

        App.openModal(html);
        renderAnnAudienceFields();
    }

    function pickAnnAudience(aud) {
        annAudience = aud;
        document
            .querySelectorAll(".ann-audience-picker button")
            .forEach((b) => {
                b.classList.toggle("active", b.dataset.aud === aud);
            });
        renderAnnAudienceFields();
    }

    let annPriority = "normal";
    function pickAnnPriority(pri) {
        annPriority = pri;
        document
            .querySelectorAll(".ann-priority-picker button")
            .forEach((b) => {
                b.classList.toggle("active", b.dataset.pri === pri);
            });
    }

    function renderAnnAudienceFields() {
        const box = document.getElementById("ann_audienceFields");
        if (!box) return;

        if (annAudience === "user") {
            const users = Storage.getUsers().sort((a, b) =>
                a.fio.localeCompare(b.fio),
            );
            box.innerHTML = `
        <div class="field">
          <label>Выберите пользователя <span class="req">*</span></label>
          <select id="ann_audienceId">
            <option value="">— выберите —</option>
            ${users
                .map(
                    (u) =>
                        `<option value="${u.id}">${escapeHtml(u.fio)} (${ROLE_LABELS[u.role] || u.role})</option>`,
                )
                .join("")}
          </select>
        </div>
      `;
        } else if (annAudience === "group") {
            const refs = Storage.get("fp_refs", { groups: [] });
            const groups = Array.isArray(refs.groups) ? refs.groups : [];
            box.innerHTML = `
        <div class="field">
          <label>Выберите группу <span class="req">*</span></label>
          <select id="ann_audienceId">
            <option value="">— выберите —</option>
            ${groups
                .map(
                    (g) =>
                        `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`,
                )
                .join("")}
          </select>
        </div>
      `;
        } else {
            box.innerHTML = "";
        }
    }

    function createAnnouncement() {
        const title = document.getElementById("ann_title")?.value.trim();
        const text = document.getElementById("ann_text")?.value.trim();
        const expires = document.getElementById("ann_expires")?.value || null;
        const audienceId =
            document.getElementById("ann_audienceId")?.value || null;

        if (!title) {
            App.toast("Введите заголовок");
            return;
        }
        if (!text) {
            App.toast("Введите текст объявления");
            return;
        }
        if (
            (annAudience === "user" || annAudience === "group") &&
            !audienceId
        ) {
            App.toast("Выберите получателя");
            return;
        }

        const expiresAt = expires
            ? new Date(expires).getTime() + 86400000 - 1
            : null;

        Announcements.add({
            title,
            text,
            audience: annAudience,
            audienceId,
            priority: annPriority,
            expiresAt,
        });

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Создано объявление",
                title,
                Announcements.AUDIENCE_LABELS[annAudience] || annAudience,
                annPriority === "urgent" ? "warning" : "info",
            );
        }

        closeModal();
        App.toast("Объявление опубликовано");
        App.navigate("announcements");
    }

    function toggleAnnouncementActive(id) {
        Announcements.toggleActive(id);
        App.toast("Статус объявления изменён");
        App.navigate("announcements");
    }

    function deleteAnnouncement(id) {
        if (!confirm("Удалить объявление?")) return;
        Announcements.remove(id);
        if (typeof Audit !== "undefined") {
            Audit.log("Удалено объявление", "", `ID: ${id}`, "negative");
        }
        App.toast("Объявление удалено");
        App.navigate("announcements");
    }

    function closeModal() {
        App.closeModal();
    }

    function getFilteredWorksForAnalytics() {
        let works = Storage.getWorks();
        if (analyticsFilter.status)
            works = works.filter((w) => w.status === analyticsFilter.status);
        if (analyticsFilter.type)
            works = works.filter((w) => w.type === analyticsFilter.type);
        if (analyticsFilter.teacherId)
            works = works.filter((w) =>
                Storage.sameId(w.teacherId, analyticsFilter.teacherId),
            );
        return works;
    }

    function calcAnalyticsMetrics(works) {
        const enriched = works
            .map((w) => {
                const res = Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(w));
                if (!res) return null;
                return {
                    w,
                    res,
                    progress: Utils.calcProgress(w.id),
                    student: Storage.getUserById(w.studentId),
                    teacher: Storage.getUserById(w.teacherId),
                };
            })
            .filter(Boolean);

        const total = enriched.length;
        if (total === 0) {
            return {
                enriched: [],
                total: 0,
                active: 0,
                highRisk: 0,
                avgProgress: 0,
                avgRisk: 0,
                avgReady: 0,
                avgRating: 0,
            };
        }

        const active = enriched.filter(
            (e) => e.w.status === "active" || e.w.status === "review",
        ).length;

        const highRisk = enriched.filter(
            (e) => e.res.risk.term === "high",
        ).length;

        const avgProgress = Math.round(
            enriched.reduce((a, e) => a + e.progress, 0) / total,
        );
        const avgRisk = Math.round(
            enriched.reduce((a, e) => a + e.res.risk.value, 0) / total,
        );
        const avgReady = Math.round(
            enriched.reduce((a, e) => a + e.res.ready.value, 0) / total,
        );
        const avgRating = Math.round(
            enriched.reduce((a, e) => a + e.res.rating.value, 0) / total,
        );

        return {
            enriched,
            total,
            active,
            highRisk,
            avgProgress,
            avgRisk,
            avgReady,
            avgRating,
        };
    }

    function groupAnalyticsByStudentGroup(enriched) {
        const groups = {};
        enriched.forEach((e) => {
            const g = e.student?.group || "Не указана";
            if (!groups[g]) {
                groups[g] = {
                    count: 0,
                    sumProgress: 0,
                    sumRisk: 0,
                };
            }
            groups[g].count++;
            groups[g].sumProgress += e.progress;
            groups[g].sumRisk += e.res.risk.value;
        });
        return Object.entries(groups)
            .map(([name, data]) => ({
                name,
                count: data.count,
                avgProgress: Math.round(data.sumProgress / data.count),
                avgRisk: Math.round(data.sumRisk / data.count),
            }))
            .sort((a, b) => b.avgProgress - a.avgProgress);
    }

    function groupAnalyticsByTeacher(enriched) {
        const teachers = {};
        enriched.forEach((e) => {
            const id = e.teacher?.id || "unknown";
            const name = e.teacher?.fio || "Неизвестный";
            if (!teachers[id]) {
                teachers[id] = { name, count: 0, sumProgress: 0, sumRisk: 0 };
            }
            teachers[id].count++;
            teachers[id].sumProgress += e.progress;
            teachers[id].sumRisk += e.res.risk.value;
        });
        return Object.values(teachers)
            .map((t) => ({
                name: t.name,
                count: t.count,
                avgProgress: Math.round(t.sumProgress / t.count),
                avgRisk: Math.round(t.sumRisk / t.count),
            }))
            .sort((a, b) => b.count - a.count);
    }

    function setAnalyticsFilter(key, value) {
        analyticsFilter[key] = value;
        App.navigate("analytics");
    }

    function resetAnalyticsFilter() {
        analyticsFilter = { status: "", type: "", teacherId: "" };
        App.navigate("analytics");
    }

    function renderRecentAudit() {
        if (typeof Audit === "undefined") {
            return '<div class="empty" style="padding:20px;">Журнал недоступен</div>';
        }

        const items = Audit.getAll().slice(0, 7);

        if (items.length === 0) {
            return `
        <div class="empty" style="padding:30px;">
          ${SVG.log({ cls: "icon icon-2xl" })}
          <div style="margin-top:8px;">Активности пока нет</div>
        </div>
      `;
        }

        return items
            .map((e) => {
                const roleLabel =
                    e.userRole === "student"
                        ? "Студент"
                        : e.userRole === "teacher"
                          ? "Преподаватель"
                          : "Админ";

                return `
        <div class="audit-row" style="grid-template-columns: 90px 1fr auto; padding:10px 0;">
          <div class="audit-time" style="font-size:10px;">
            ${fmtDateTime(e.createdAt).slice(0, 10)}
          </div>
          <div>
            <span class="audit-action ${e.type || "info"}" style="font-size:12px;">
              ${escapeHtml(e.action || "—")}
            </span>
            ${
                e.target
                    ? `<span style="color:var(--txt-muted);font-size:11px;"> · ${escapeHtml(e.target.slice(0, 40))}${e.target.length > 40 ? "…" : ""}</span>`
                    : ""
            }
          </div>
          <div style="text-align:right;">
            <span class="role-chip ${e.userRole}" style="font-size:10px;">
              ${roleLabel}
            </span>
          </div>
        </div>
      `;
            })
            .join("");
    }

    function renderNeedsAttention(users, works) {
        const items = [];

        const pending = works.filter((w) => w.status === "pending");
        if (pending.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('works')">
          <div>
            <div class="mini-project-title">
              ${SVG.clipboard({ cls: "icon icon-xs" })}
              Заявок на утверждении: ${pending.length}
            </div>
            <div class="mini-project-sub">Ждут решения руководителя</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        const blocked = users.filter((u) => u.blocked);
        if (blocked.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('users')">
          <div>
            <div class="mini-project-title">
              ${SVG.lock({ cls: "icon icon-xs" })}
              Заблокировано: ${blocked.length}
            </div>
            <div class="mini-project-sub">Проверьте аккаунты</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        const rejected = works.filter((w) => w.status === "rejected");
        if (rejected.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('works')">
          <div>
            <div class="mini-project-title">
              ${SVG.x({ cls: "icon icon-xs" })}
              Отклонено: ${rejected.length}
            </div>
            <div class="mini-project-sub">Требуют пересмотра</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        const noTeacher = works.filter(
            (w) => !w.teacherId || !Storage.getUserById(w.teacherId),
        );
        if (noTeacher.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('works')">
          <div>
            <div class="mini-project-title">
              ${SVG.alertTriangle({ cls: "icon icon-xs" })}
              Без руководителя: ${noTeacher.length}
            </div>
            <div class="mini-project-sub">Требуют назначения</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        if (items.length === 0) {
            return `
        <div class="empty-state" style="padding:40px 20px;">
          ${SVG.checkCircle({ cls: "icon icon-2xl" })}
          <h3 style="margin-top:12px;">Всё в порядке</h3>
          <p style="color:var(--txt-muted);font-size:13px;">
            Нет задач, требующих внимания администратора.
          </p>
        </div>
      `;
        }

        return items.join("");
    }

    return {
        VIEWS,

        setUserFilter,
        toggleBlock,
        deleteUser,
        openCreateUserModal,
        pickCreateRole,
        createUser,
        openEditUserModal,
        saveUser,
        openUserProfile,

        setAnalyticsFilter,
        resetAnalyticsFilter,

        setWorkFilter,
        deleteWork,

        toggleRule,
        updateRuleDesc,
        deleteRule,
        resetRules,

        generateReport,
        exportWorksCSV,
        exportBackup,
        importBackup,

        addRef,
        deleteRef,

        saveSettings,
        fullReset,

        openCreateAnnouncement,
        pickAnnAudience,
        pickAnnPriority,
        createAnnouncement,
        toggleAnnouncementActive,
        deleteAnnouncement,

        nextPage,
        prevPage,

        closeModal,
    };
})();
