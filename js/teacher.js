const Teacher = (() => {
    const WORK_STATUSES = Utils.WORK_STATUSES;

    const GOST_ITEMS = Object.freeze([
        "Шрифт Times New Roman, 14 пт",
        "Поля: левое 30 мм, правое 15 мм, верх/низ 20 мм",
        "Межстрочный интервал 1.5",
        "Абзацный отступ 1.25 см",
        "Нумерация страниц внизу по центру",
        "Заголовки: без точки в конце, с прописной",
        "Таблицы и рисунки подписаны",
        "Список литературы по ГОСТ Р 7.0.5–2008",
    ]);

    const escapeHtml = Utils.escapeHtml;
    const statusBadge = Utils.statusBadge;
    const calcProgress = Utils.calcProgress;
    const emptyState = Utils.emptyState;
    const renderComment = Utils.renderComment;

    function getUser() {
        if (typeof Auth === "undefined") return null;
        try {
            return Auth.getUser();
        } catch (e) {
            return null;
        }
    }

    function requireUser() {
        const u = getUser();
        if (!u) {
            App.toast("Требуется авторизация");
            return null;
        }
        return u;
    }

    function getFuzzyResult(work, progressOverride) {
        try {
            return Utils.safeFuzzyInfer(
                Utils.buildFuzzyInputs(work, progressOverride),
            );
        } catch (e) {
            return null;
        }
    }

    function getMyStudents() {
        const u = getUser();
        if (!u) return [];
        return Storage.getWorksByTeacher(u.id)
            .map((w) => ({
                work: w,
                student: Storage.getUserById(w.studentId),
            }))
            .filter((x) => x.student);
    }

    function getMyActiveStudents() {
        return getMyStudents().filter((x) =>
            Utils.isActiveStatus(x.work.status),
        );
    }

    const VIEWS = {};

    VIEWS.dashboard = function () {
        const u = getUser();
        if (!u) return "";

        const students = getMyStudents();
        const active = getMyActiveStudents();
        const requests = students.filter((x) => x.work.status === "pending");

        const withRisk = active
            .map((x) => {
                const res = getFuzzyResult(x.work);
                if (!res) return null;
                return { ...x, progress: calcProgress(x.work.id), res };
            })
            .filter(Boolean);

        const highRisk = withRisk.filter(
            (x) => x.res.risk.term === "high",
        ).length;

        const maxLoad = u.maxLoad || 8;
        const currentLoad = active.length;
        const loadPct = Math.min(
            100,
            Math.round((currentLoad / maxLoad) * 100),
        );

        const avgProgress = active.length
            ? Math.round(
                  active.reduce((a, x) => a + calcProgress(x.work.id), 0) /
                      active.length,
              )
            : 0;

        const avgRisk = withRisk.length
            ? Math.round(
                  withRisk.reduce((a, x) => a + x.res.risk.value, 0) /
                      withRisk.length,
              )
            : 0;

        const tasksReview = getTasksForReview();
        const pendingConsults = getPendingConsults();
        const upcoming = getUpcomingDeadlines(5);

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${students.length}</div>
          <div class="kpi-lbl">Студентов</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${requests.length > 0 ? "var(--warn)" : "var(--txt-muted)"}">
            ${requests.length}
          </div>
          <div class="kpi-lbl">Новых заявок</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${tasksReview.length > 0 ? "var(--accent-viz)" : "var(--txt-muted)"}">
            ${tasksReview.length}
          </div>
          <div class="kpi-lbl">Задач на проверке</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${highRisk > 0 ? "var(--bad)" : "var(--txt-muted)"}">
            ${highRisk}
          </div>
          <div class="kpi-lbl">Высокий риск</div>
        </div>
      </div>

      <div class="metric-grid mt-16">
        <div class="metric">
          <div class="metric-lbl">Активных работ</div>
          <div class="metric-val">${active.length}</div>
          <div class="metric-sub">в работе и на проверке</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. прогресс</div>
          <div class="metric-val" style="color:var(--${Utils.progressClass(avgProgress)})">
            ${avgProgress}%
          </div>
          <div class="metric-sub">по активным студентам</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. риск</div>
          <div class="metric-val" style="color:var(--${Utils.riskClass(Fuzzy.classify(avgRisk))})">
            ${avgRisk}
          </div>
          <div class="metric-sub">${Fuzzy.termLabel(Fuzzy.classify(avgRisk), "risk")}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Загрузка</div>
          <div class="metric-val">
            ${currentLoad}<span style="font-size:14px;font-weight:400;color:var(--txt-muted);">/${maxLoad}</span>
          </div>
          <div class="metric-sub">
            <div class="progress ${loadPct > 90 ? "low" : loadPct > 70 ? "med" : "high"}" style="margin-top:6px;">
              <div style="width:${loadPct}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-title">Распределение по риску</div>
          <div class="chart-box h-220"><canvas id="teacherRiskChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Прогресс по студентам</div>
          <div class="chart-box h-220"><canvas id="teacherProgressChart"></canvas></div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Быстрые действия</div>
        <div class="quick-actions">
          <div class="quick-action" onclick="App.navigate('requests')">
            <div class="qa-ico">${SVG.clipboard({ cls: "icon" })}</div>
            <div class="qa-lbl">Заявки</div>
            <div class="qa-desc">${requests.length > 0 ? `<b style="color:var(--warn)">${requests.length} новых</b>` : "Нет новых"}</div>
          </div>
          <div class="quick-action" onclick="App.navigate('students')">
            <div class="qa-ico">${SVG.users({ cls: "icon" })}</div>
            <div class="qa-lbl">Студенты</div>
            <div class="qa-desc">${active.length} активных</div>
          </div>
          <div class="quick-action" onclick="App.navigate('tasks-review')">
            <div class="qa-ico">${SVG.check({ cls: "icon" })}</div>
            <div class="qa-lbl">Задачи</div>
            <div class="qa-desc">${tasksReview.length > 0 ? `<b style="color:var(--accent-viz)">${tasksReview.length} на проверке</b>` : "Нет на проверке"}</div>
          </div>
          <div class="quick-action" onclick="App.navigate('review')">
            <div class="qa-ico">${SVG.checkCircle({ cls: "icon" })}</div>
            <div class="qa-lbl">Проверка</div>
            <div class="qa-desc">Работы студентов</div>
          </div>
          <div class="quick-action" onclick="App.navigate('consultations')">
            <div class="qa-ico">${SVG.calendar({ cls: "icon" })}</div>
            <div class="qa-lbl">Консультации</div>
            <div class="qa-desc">${pendingConsults.length > 0 ? `<b style="color:var(--warn)">${pendingConsults.length} новых</b>` : "Нет новых"}</div>
          </div>
          <div class="quick-action" onclick="App.navigate('rankings')">
            <div class="qa-ico">${SVG.award({ cls: "icon" })}</div>
            <div class="qa-lbl">Рейтинги</div>
            <div class="qa-desc">Топ и антитоп</div>
          </div>
        </div>
      </div>

      ${
          tasksReview.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.check({ cls: "icon icon-sm" })}
              Задачи на проверке (${tasksReview.length})
            </div>
            <button class="btn-ghost btn-sm" onclick="App.navigate('tasks-review')">
              Все →
            </button>
          </div>
          ${tasksReview
              .slice(0, 5)
              .map((t) => renderTaskReviewMini(t))
              .join("")}
        </div>
      `
              : ""
      }

      ${
          upcoming.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.clock({ cls: "icon icon-sm" })}
              Ближайшие дедлайны
            </div>
          </div>
          ${upcoming.map((e) => renderUpcomingRow(e)).join("")}
        </div>
      `
              : ""
      }

      ${renderTeacherAttention(requests, pendingConsults, tasksReview, withRisk)}
    `;
    };

    VIEWS.dashboard_after = function () {
        if (!Charts.hasChart()) return;
        const active = getMyActiveStudents();
        const withRisk = active
            .map((x) => {
                const res = getFuzzyResult(x.work);
                if (!res) return null;
                return { ...x, progress: calcProgress(x.work.id), res };
            })
            .filter(Boolean);

        if (withRisk.length === 0) return;

        const low = withRisk.filter((x) => x.res.risk.term === "low").length;
        const med = withRisk.filter((x) => x.res.risk.term === "med").length;
        const high = withRisk.filter((x) => x.res.risk.term === "high").length;

        Charts.doughnut(
            "teacherRiskChart",
            ["Низкий", "Средний", "Высокий"],
            [low, med, high],
            [Charts.COLORS.ok, Charts.COLORS.warn, Charts.COLORS.bad],
        );

        Charts.bar(
            "teacherProgressChart",
            withRisk.map((x) => x.student.fio.split(" ")[0]),
            withRisk.map((x) => x.progress),
            withRisk.map((x) =>
                x.res.risk.term === "high"
                    ? Charts.COLORS.bad
                    : x.res.risk.term === "med"
                      ? Charts.COLORS.warn
                      : Charts.COLORS.ok,
            ),
            { label: "Прогресс, %", max: 100 },
        );
    };

    function getTasksForReview() {
        const u = getUser();
        if (!u) return [];
        const myWorks = Storage.getWorksByTeacher(u.id);
        const myWorkIds = myWorks.map((w) => w.id);

        const tasks = Storage.getTasks().filter(
            (t) =>
                myWorkIds.some((id) => Storage.sameId(id, t.workId)) &&
                t.col === "review",
        );

        return tasks
            .map((t) => {
                const work = Storage.getWorkById(t.workId);
                const student = work
                    ? Storage.getUserById(work.studentId)
                    : null;
                return { t, work, student };
            })
            .sort((a, b) => (b.t.updatedAt || 0) - (a.t.updatedAt || 0));
    }

    function getPendingConsults() {
        const u = getUser();
        if (!u || typeof Consult === "undefined") return [];

        return Consult.getAll()
            .filter(
                (c) =>
                    Storage.sameId(c.teacherId, u.id) && c.status === "pending",
            )
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    function getUpcomingDeadlines(limit = 5) {
        const u = getUser();
        if (!u) return [];

        const active = getMyActiveStudents();
        const events = [];

        active.forEach((x) => {
            const stages = Storage.getStagesByWork(x.work.id);
            stages
                .filter((s) => s.deadline && !s.done)
                .forEach((s) => {
                    const days = daysUntil(s.deadline);
                    if (days >= 0 && days <= 90) {
                        events.push({
                            date: s.deadline,
                            days,
                            title: s.name,
                            student: x.student,
                            kind: "stage",
                        });
                    }
                });

            if (x.work.deadline) {
                const days = daysUntil(x.work.deadline);
                if (days >= 0 && days <= 365) {
                    events.push({
                        date: x.work.deadline,
                        days,
                        title: "Защита работы",
                        student: x.student,
                        kind: "defense",
                    });
                }
            }
        });

        return events.sort((a, b) => a.days - b.days).slice(0, limit);
    }

    function renderTaskReviewMini({ t, student }) {
        return `
      <div class="mini-project" onclick="App.navigate('tasks-review')">
        <div style="flex:1;min-width:0;">
          <div class="mini-project-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(t.title)}
          </div>
          <div class="mini-project-sub">
            ${escapeHtml(student?.fio || "—")}
            ${t.deadline ? ` · до ${escapeHtml(t.deadline)}` : ""}
          </div>
        </div>
        <span class="badge review" style="font-size:10px;">Проверка</span>
      </div>
    `;
    }

    function renderUpcomingRow(e) {
        const urgencyClass = e.days <= 3 ? "bad" : e.days <= 7 ? "warn" : "";
        const urgencyLabel =
            e.days === 0
                ? "сегодня"
                : e.days === 1
                  ? "завтра"
                  : `через ${e.days} дн.`;

        return `
      <div class="mini-project">
        <div style="flex:1;min-width:0;">
          <div class="mini-project-title">
            ${e.kind === "defense" ? SVG.award({ cls: "icon icon-xs" }) : SVG.clock({ cls: "icon icon-xs" })}
            ${escapeHtml(e.title)}
          </div>
          <div class="mini-project-sub">
            ${escapeHtml(e.student?.fio || "—")} · ${fmtDate(e.date)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;font-weight:600;color:var(--${urgencyClass || "txt-muted"});">
            ${urgencyLabel}
          </div>
        </div>
      </div>
    `;
    }

    function renderTeacherAttention(requests, consults, tasks, withRisk) {
        const highRiskList = withRisk
            .filter((x) => x.res.risk.term === "high")
            .sort((a, b) => b.res.risk.value - a.res.risk.value);

        const items = [];

        if (requests.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('requests')">
          <div style="flex:1;min-width:0;">
            <div class="mini-project-title">
              ${SVG.clipboard({ cls: "icon icon-xs" })}
              Заявок на утверждение: ${requests.length}
            </div>
            <div class="mini-project-sub">Требуется ваше решение</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        if (tasks.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('tasks-review')">
          <div style="flex:1;min-width:0;">
            <div class="mini-project-title">
              ${SVG.check({ cls: "icon icon-xs" })}
              Задач на проверке: ${tasks.length}
            </div>
            <div class="mini-project-sub">Студенты ждут решения</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        if (consults.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('consultations')">
          <div style="flex:1;min-width:0;">
            <div class="mini-project-title">
              ${SVG.calendar({ cls: "icon icon-xs" })}
              Консультаций ожидают: ${consults.length}
            </div>
            <div class="mini-project-sub">Ответьте студентам</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        if (highRiskList.length > 0) {
            items.push(`
        <div class="mini-project" onclick="App.navigate('students')">
          <div style="flex:1;min-width:0;">
            <div class="mini-project-title">
              ${SVG.alertTriangle({ cls: "icon icon-xs" })}
              Высокий риск: ${highRiskList.length}
            </div>
            <div class="mini-project-sub">Свяжитесь со студентами</div>
          </div>
          <span style="color:var(--txt-muted);font-size:18px;">›</span>
        </div>
      `);
        }

        if (items.length === 0) {
            return `
        <div class="card mt-16">
          <div class="empty-state" style="padding:40px 20px;">
            ${SVG.checkCircle({ cls: "icon icon-2xl" })}
            <h3 style="margin-top:12px;">Всё в порядке</h3>
            <p style="color:var(--txt-muted);font-size:13px;">
              Нет задач, требующих вашего внимания.
            </p>
          </div>
        </div>
      `;
        }

        return `
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.alertTriangle({ cls: "icon icon-sm" })}
            Требуют внимания
          </div>
        </div>
        ${items.join("")}
      </div>
    `;
    }

    let requestFilter = "all";

    VIEWS.requests = function () {
        const students = getMyStudents();

        const requests = students.filter((x) =>
            [
                "pending",
                "active",
                "review",
                "approved",
                "done",
                "rejected",
            ].includes(x.work.status),
        );

        const pending = requests.filter((x) => x.work.status === "pending");
        const approved = requests.filter((x) =>
            ["active", "review", "approved", "done"].includes(x.work.status),
        );
        const rejected = requests.filter((x) => x.work.status === "rejected");

        let filtered = requests;
        if (requestFilter === "pending") {
            filtered = pending;
        } else if (requestFilter === "approved") {
            filtered = approved;
        } else if (requestFilter === "rejected") {
            filtered = rejected;
        } else if (requestFilter === "active") {
            filtered = requests.filter((x) =>
                ["active", "review"].includes(x.work.status),
            );
        }

        filtered = [...filtered].sort(
            (a, b) =>
                (b.work.updatedAt || b.work.createdAt || 0) -
                (a.work.updatedAt || a.work.createdAt || 0),
        );

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${requests.length}</div>
          <div class="kpi-lbl">Всего заявок</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${pending.length > 0 ? "var(--warn)" : "var(--txt-muted)"}">
            ${pending.length}
          </div>
          <div class="kpi-lbl">На утверждении</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--ok)">
            ${approved.length}
          </div>
          <div class="kpi-lbl">Одобрено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${rejected.length > 0 ? "var(--bad)" : "var(--txt-muted)"}">
            ${rejected.length}
          </div>
          <div class="kpi-lbl">Отклонено</div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${getRequestFilterLabel(requestFilter)}
            <span class="count-chip">${filtered.length}</span>
          </div>
        </div>

        <div class="filter-tabs" style="margin-bottom:16px;">
          ${renderRequestTab("all", "Все", requests.length)}
          ${renderRequestTab("pending", "На утверждении", pending.length)}
          ${renderRequestTab("approved", "Одобрено", approved.length)}
          ${renderRequestTab("rejected", "Отклонено", rejected.length)}
        </div>

        ${
            filtered.length === 0
                ? emptyState(
                      requestFilter === "all"
                          ? "Заявок пока нет"
                          : "Нет заявок в этой категории",
                      "Когда студенты будут отправлять заявки, они появятся здесь.",
                      SVG.clipboard,
                  )
                : filtered.map((x) => renderRequestCard(x)).join("")
        }
      </div>
    `;
    };

    function getRequestFilterLabel(filter) {
        const labels = {
            all: "Все заявки",
            pending: "Заявки на утверждении",
            approved: "Одобренные заявки",
            rejected: "Отклонённые заявки",
        };
        return labels[filter] || "Все заявки";
    }

    function renderRequestTab(id, label, count) {
        const active = requestFilter === id ? "active" : "";
        return `
      <button class="filter-tab ${active}" onclick="Teacher.setRequestFilter('${id}')">
        ${escapeHtml(label)}
        <span class="count-chip" style="margin-left:6px;">${count}</span>
      </button>
    `;
    }

    function setRequestFilter(filter) {
        requestFilter = filter;
        App.navigate("requests");
    }

    function renderRequestCard(x) {
        const w = x.work;
        const s = x.student;
        const isPending = w.status === "pending";
        const isRejected = w.status === "rejected";
        const isApproved = ["active", "review", "approved", "done"].includes(
            w.status,
        );

        const rejectReason = w.rejectReason
            ? `<div class="notice" style="margin-top:12px;background:var(--bad-soft);border-left:3px solid var(--bad);font-size:12px;">
            <b>Причина отклонения:</b> ${escapeHtml(w.rejectReason)}
          </div>`
            : "";

        const decisionInfo = (() => {
            if (isPending) return "";
            if (isRejected && w.updatedAt) {
                return `<span style="font-size:11px;color:var(--txt-muted);">
                Отклонена: ${fmtDateTime(w.updatedAt)}
              </span>`;
            }
            if (isApproved && w.approvedAt) {
                return `<span style="font-size:11px;color:var(--txt-muted);">
                Утверждена: ${fmtDateTime(w.approvedAt)}
              </span>`;
            }
            return "";
        })();

        return `
      <div class="request-card" style="${isRejected ? "border-left:3px solid var(--bad);" : isApproved ? "border-left:3px solid var(--ok);" : "border-left:3px solid var(--warn);"}">
        <div class="request-head">
          <div style="flex:1;min-width:220px;">
            <div class="request-topic">${escapeHtml(w.topic)}</div>
            <div class="request-meta">
              ${escapeHtml(s.fio)} · ${escapeHtml(s.group || "")} · ${escapeHtml(s.faculty || "")} · ${s.course || ""} курс
              · ${escapeHtml(Utils.workTypeLabel(w.type))}
            </div>
          </div>
          <div>${statusBadge(w.status)}</div>
        </div>

        ${w.description || w.annotation ? `<div class="request-body">${escapeHtml(w.description || w.annotation)}</div>` : ""}
${w.deadline ? `<div class="request-meta">Планируемая защита: ${escapeHtml(w.deadline)}</div>` : ""}

        ${rejectReason}

        ${
            decisionInfo
                ? `<div style="margin-top:8px;">${decisionInfo}</div>`
                : ""
        }

        <div class="request-actions">
          <button class="btn-ghost btn-sm"
            onclick="App.navigate('request-detail', {id: '${w.id}'})">
            Подробнее
          </button>
          ${
              isPending
                  ? `
            <button class="btn-ghost btn-sm" onclick="Teacher.openRejectModal('${w.id}')">
              ${SVG.x({ cls: "icon icon-sm" })}
              <span>Отклонить</span>
            </button>
            <button class="btn-primary btn-sm" onclick="Teacher.approveWork('${w.id}')">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Утвердить</span>
            </button>
          `
                  : ""
          }
        </div>
      </div>
    `;
    }

    VIEWS["request-detail"] = function (params) {
        const w = Storage.getWorkById(params?.id);
        if (!w)
            return '<div class="card"><div class="empty">Заявка не найдена</div></div>';
        const s = Storage.getUserById(w.studentId);
        if (!s)
            return '<div class="card"><div class="empty">Студент не найден</div></div>';

        return `
      <div class="back-link" onclick="App.navigate('requests')">← Назад к заявкам</div>

      <div class="student-hero">
        <div class="student-hero-name">${escapeHtml(w.topic)}</div>
        <div class="student-hero-meta">
          ${escapeHtml(s.fio)} · ${escapeHtml(s.group || "")} · ${escapeHtml(s.faculty || "")} · ${s.course || ""} курс
          ${s.recordBook ? "· зачётка " + escapeHtml(s.recordBook) : ""}
        </div>

        <div class="student-hero-grid">
          <div class="stat-mini">
            <div class="num" style="font-size:14px;">${escapeHtml(Utils.workTypeLabel(w.type))}</div>
            <div class="lbl">Тип работы</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="font-size:14px;">${escapeHtml(w.deadline || "—")}</div>
            <div class="lbl">Дата защиты</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="font-size:14px;">${fmtDate(w.createdAt)}</div>
            <div class="lbl">Создана</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="font-size:14px;">${statusBadge(w.status)}</div>
            <div class="lbl">Статус</div>
          </div>
        </div>
      </div>

      ${w.description || w.annotation ? `<div class="card mt-16"><div class="card-title">Краткое описание</div><div style="font-size:13px;line-height:1.6;">${escapeHtml(w.description || w.annotation)}</div></div>` : ""}

      ${
          w.status === "pending"
              ? `
        <div class="card mt-16">
          <div class="card-title">Решение</div>
          <div class="request-actions" style="justify-content:flex-start;">
            <button class="btn-ghost" onclick="Teacher.openRejectModal('${w.id}')">
              ${SVG.x({ cls: "icon icon-sm" })}
              <span>Отклонить</span>
            </button>
            <button class="btn-primary" onclick="Teacher.approveWork('${w.id}')">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Утвердить заявку</span>
            </button>
          </div>
        </div>
      `
              : ""
      }
    `;
    };

    function approveWork(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;

        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша заявка");
            return;
        }

        if (w.status !== "pending") {
            App.toast("Заявка уже обработана");
            return;
        }

        w.status = "active";
        w.approvedAt = Date.now();
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "approve",
                    title: "Заявка утверждена",
                    text: `«${w.topic}» принята в работу`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log("Заявка утверждена", w.topic, "", "positive");
            }
        } catch (e) {}

        App.toast("Заявка утверждена");
        App.navigate("requests");
    }

    function openRejectModal(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша заявка");
            return;
        }

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Teacher.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Отклонить заявку</h3>
            <button class="modal-close" onclick="Teacher.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Причина отклонения <span class="req">*</span></label>
            <textarea id="rj_reason" rows="3" placeholder="Что студенту нужно исправить или уточнить"></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Teacher.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Teacher.rejectWork('${workId}')">Отклонить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function rejectWork(workId) {
        const u = requireUser();
        if (!u) return;

        const reason = document.getElementById("rj_reason")?.value.trim();
        if (!reason) {
            App.toast("Укажите причину");
            return;
        }

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша заявка");
            return;
        }
        if (w.status !== "pending") {
            App.toast("Заявка уже обработана");
            return;
        }

        w.status = "rejected";
        w.rejectReason = reason;
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        Storage.saveComment({
            id: uid(),
            workId: w.id,
            authorId: u.id,
            text: "Заявка отклонена: " + reason,
            createdAt: Date.now(),
            kind: "reject",
        });

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "reject",
                    title: "Заявка отклонена",
                    text: reason,
                    link: { view: "archived" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log("Заявка отклонена", w.topic, reason, "negative");
            }
        } catch (e) {}

        closeModal();
        App.toast("Заявка отклонена");
        App.navigate("requests");
    }

    let myWorksShowActive = false;
    let myWorksType = "";
    let myWorksSearch = "";
    let myWorksSort = "date";

    VIEWS["my-works"] = function () {
        const u = getUser();
        if (!u) return "";

        const allWorks = Storage.getWorksByTeacher(u.id);

        const archived = allWorks.filter((w) =>
            ["done", "rejected"].includes(w.status),
        );
        const activeList = allWorks.filter(
            (w) => !["done", "rejected"].includes(w.status),
        );

        let list = myWorksShowActive ? allWorks : archived;

        if (myWorksType) {
            list = list.filter((w) => w.type === myWorksType);
        }

        if (myWorksSearch) {
            const q = myWorksSearch.toLowerCase();
            list = list.filter((w) => {
                const student = Storage.getUserById(w.studentId);
                const studentName = (student?.fio || "").toLowerCase();
                const group = (student?.group || "").toLowerCase();
                return (
                    w.topic.toLowerCase().includes(q) ||
                    studentName.includes(q) ||
                    group.includes(q)
                );
            });
        }

        list = [...list].sort((a, b) => {
            if (myWorksSort === "date")
                return (
                    (b.updatedAt || b.createdAt || 0) -
                    (a.updatedAt || a.createdAt || 0)
                );
            if (myWorksSort === "grade")
                return (b.finalGrade || 0) - (a.finalGrade || 0);
            if (myWorksSort === "progress")
                return calcProgress(b.id) - calcProgress(a.id);
            if (myWorksSort === "rating") {
                const ra = getFuzzyResult(a);
                const rb = getFuzzyResult(b);
                return (rb?.rating.value || 0) - (ra?.rating.value || 0);
            }
            return 0;
        });

        const doneCount = archived.filter((w) => w.status === "done").length;
        const rejectedCount = archived.filter(
            (w) => w.status === "rejected",
        ).length;
        const withGrades = archived.filter(
            (w) => w.status === "done" && w.finalGrade,
        );
        const avgGrade = withGrades.length
            ? (
                  withGrades.reduce((a, w) => a + w.finalGrade, 0) /
                  withGrades.length
              ).toFixed(1)
            : "—";

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${allWorks.length}</div>
          <div class="kpi-lbl">Всего работ</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--ok)">${doneCount}</div>
          <div class="kpi-lbl">Защищено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${rejectedCount > 0 ? "var(--bad)" : "var(--txt-muted)"}">${rejectedCount}</div>
          <div class="kpi-lbl">Отклонено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--accent-viz)">${avgGrade}</div>
          <div class="kpi-lbl">Ср. оценка</div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${myWorksShowActive ? "Все работы" : "Завершённые работы"}
            <span class="count-chip">${list.length}</span>
          </div>
          <button class="btn-ghost btn-sm" onclick="Teacher.toggleMyWorksActive()">
            ${
                myWorksShowActive
                    ? SVG.x({ cls: "icon icon-sm" }) +
                      "<span>Скрыть активные</span>"
                    : SVG.eye({ cls: "icon icon-sm" }) +
                      `<span>Показать активные (${activeList.length})</span>`
            }
          </button>
        </div>

        <div class="review-toolbar" style="margin-top:14px;">
          <input type="text"
            class="my-works-search review-search"
            placeholder="Поиск по студенту, теме, группе…"
            value="${escapeHtml(myWorksSearch)}"
            oninput="Teacher.setMyWorksSearch(this.value)">
          <select class="review-sort" onchange="Teacher.setMyWorksType(this.value)">
            <option value="">Все типы</option>
            ${Object.entries(Utils.WORK_TYPES)
                .map(
                    ([k, v]) =>
                        `<option value="${k}" ${myWorksType === k ? "selected" : ""}>${v.title}</option>`,
                )
                .join("")}
          </select>
          <select class="review-sort" onchange="Teacher.setMyWorksSort(this.value)">
            <option value="date" ${myWorksSort === "date" ? "selected" : ""}>По дате</option>
            <option value="grade" ${myWorksSort === "grade" ? "selected" : ""}>По оценке</option>
            <option value="progress" ${myWorksSort === "progress" ? "selected" : ""}>По прогрессу</option>
            <option value="rating" ${myWorksSort === "rating" ? "selected" : ""}>По рейтингу</option>
          </select>
        </div>

        ${
            list.length === 0
                ? emptyState(
                      !myWorksShowActive && archived.length === 0
                          ? "Завершённых работ пока нет"
                          : "Ничего не найдено",
                      !myWorksShowActive && archived.length === 0
                          ? "Когда студенты защитят или отклонят работы, они появятся здесь."
                          : "Измените фильтр или запрос.",
                      SVG.folder,
                  )
                : list.map((w) => renderMyWorkCard(w)).join("")
        }
      </div>
    `;
    };

    function renderMyWorkCard(w) {
        const student = Storage.getUserById(w.studentId);
        const progress = calcProgress(w.id);
        const res = getFuzzyResult(w);
        const isDone = w.status === "done";
        const isRejected = w.status === "rejected";

        const accentColor = isDone
            ? "var(--ok)"
            : isRejected
              ? "var(--bad)"
              : "var(--info)";

        const gradeLabel = (g) => {
            if (g === 5) return "отлично";
            if (g === 4) return "хорошо";
            if (g === 3) return "удовлетв.";
            if (g === 2) return "неудовлетв.";
            return "";
        };

        return `
      <div class="review-item" style="border-left-color:${accentColor};">
        <div class="review-item-head">
          <div class="review-item-title">${escapeHtml(w.topic)}</div>
          ${statusBadge(w.status)}
        </div>

        <div class="review-item-meta">
          ${escapeHtml(student?.fio || "—")}
          ${student?.group ? " · " + escapeHtml(student.group) : ""}
          · ${escapeHtml(Utils.workTypeLabel(w.type))}
        </div>

        ${
            isDone && w.finalGrade
                ? `
          <div class="review-item-grade">
            <span class="review-grade-num" style="color:var(--ok);">${w.finalGrade}</span>
            <span class="review-grade-label">${gradeLabel(w.finalGrade)}</span>
            ${w.defendedAt ? `<span class="review-info-dot">·</span><span style="font-size:11px;color:var(--txt-muted);">защищена ${fmtDate(w.defendedAt)}</span>` : ""}
          </div>
        `
                : ""
        }

        ${
            isRejected && w.rejectReason
                ? `
          <div style="margin:10px 0;padding:10px 12px;background:var(--bad-soft);border-left:3px solid var(--bad);border-radius:0 var(--r-sm) var(--r-sm) 0;font-size:12px;">
            <b>Причина:</b> ${escapeHtml(w.rejectReason)}
          </div>
        `
                : ""
        }

        ${
            res
                ? `
          <div class="review-item-stats">
            <span class="review-stat">
              <span class="review-stat-label">Прогресс</span>
              <span class="review-stat-value" style="color:var(--${Utils.progressClass(progress)});">${progress}%</span>
            </span>
            <span class="review-stat">
              <span class="review-stat-label">Риск</span>
              <span class="review-stat-value" style="color:var(--${Utils.riskClass(res.risk.term)});">${res.risk.value.toFixed(0)}</span>
            </span>
            <span class="review-stat">
              <span class="review-stat-label">Рейтинг</span>
              <span class="review-stat-value" style="color:var(--accent-viz);">${res.rating.value.toFixed(0)}</span>
            </span>
          </div>
        `
                : ""
        }

        <div class="review-item-actions">
          <button class="btn-ghost btn-sm"
            onclick="App.navigate('student-detail', {id: '${student?.id || ""}', workId: '${w.id}'})">
            ${SVG.eye({ cls: "icon icon-sm" })}
            <span>Карточка</span>
          </button>
          <button class="btn-ghost btn-sm"
            onclick="PdfReport.exportStudent('${w.id}')">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>PDF</span>
          </button>
        </div>
      </div>
    `;
    }

    function toggleMyWorksActive() {
        myWorksShowActive = !myWorksShowActive;
        App.navigate("my-works");
    }

    function setMyWorksType(type) {
        myWorksType = type;
        App.navigate("my-works");
    }

    function setMyWorksSearch(q) {
        myWorksSearch = q;
        App.navigate("my-works");
        requestAnimationFrame(() => {
            setTimeout(() => {
                const input = document.querySelector(".my-works-search");
                if (!input) return;
                input.focus();
                try {
                    const len = input.value.length;
                    input.setSelectionRange(len, len);
                } catch (e) {}
            }, 0);
        });
    }

    function setMyWorksSort(sort) {
        myWorksSort = sort;
        App.navigate("my-works");
    }

    VIEWS.students = function () {
        const students = getMyStudents();
        const active = students.filter((x) =>
            Utils.isActiveStatus(x.work.status),
        );
        const other = students.filter(
            (x) => !Utils.isActiveStatus(x.work.status),
        );

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Активные студенты (${active.length})</div>
        </div>
        ${
            active.length === 0
                ? emptyState(
                      "Пока нет активных студентов",
                      "Студенты появятся здесь после утверждения их заявок.",
                      SVG.users,
                  )
                : active.map((x) => renderStudentRow(x)).join("")
        }
      </div>

      ${
          other.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-title">Завершённые / отклонённые (${other.length})</div>
          ${other.map((x) => renderStudentRow(x)).join("")}
        </div>
      `
              : ""
      }
    `;
    };

    function renderStudentRow(x) {
        const progress = calcProgress(x.work.id);
        const res = getFuzzyResult(x.work);

        if (!res) {
            return `
        <div class="student-row" onclick="App.navigate('student-profile', {id: '${x.student.id}'})">
          <div>
            <div class="student-name">${escapeHtml(x.student.fio)}</div>
            <div class="student-sub">${escapeHtml(x.work.topic)}</div>
          </div>
          <div class="progress-mini">
            <div style="font-size:11px;color:var(--txt-muted);margin-bottom:3px;">${progress}%</div>
            <div class="progress ${Utils.progressClass(progress)}">
              <div style="width:${progress}%"></div>
            </div>
          </div>
          <div><span class="badge">нет оценки</span></div>
          <div style="color:var(--txt-muted);font-size:18px;">›</div>
        </div>
      `;
        }

        const cls = res.risk.term;
        const lbl = Fuzzy.termLabel(cls, "risk");

        return `
      <div class="student-row" onclick="App.navigate('student-profile', {id: '${x.student.id}'})">
        <div>
          <div class="student-name">${escapeHtml(x.student.fio)}</div>
          <div class="student-sub">${escapeHtml(x.work.topic)}</div>
        </div>
        <div class="progress-mini">
          <div style="font-size:11px;color:var(--txt-muted);margin-bottom:3px;">${progress}%</div>
          <div class="progress ${Utils.progressClass(progress)}">
            <div style="width:${progress}%"></div>
          </div>
        </div>
        <div><span class="badge risk-${cls}">${lbl}</span></div>
        <div style="color:var(--txt-muted);font-size:18px;">›</div>
      </div>
    `;
    }

    VIEWS["student-detail"] = function (params) {
        const workId = params?.workId;
        const studentId = params?.id;
        const w = Storage.getWorkById(workId);
        const s = Storage.getUserById(studentId);
        if (!w || !s)
            return '<div class="card"><div class="empty">Студент не найден</div></div>';

        const u = getUser();
        if (!u || !Storage.sameId(w.teacherId, u.id)) {
            return `
        <div class="card">
          ${emptyState("Это не ваш студент", "Работа относится к другому руководителю.", SVG.lock)}
        </div>
      `;
        }

        const progress = calcProgress(w.id);
        const stages = Storage.getStagesByWork(w.id);
        const tasks = Storage.getTasksByWork(w.id);
        const versions = Storage.getVersionsByWork(w.id);
        const comments = Storage.getCommentsByWork(w.id);

        const inputs = Utils.buildFuzzyInputs(w);
        const res = inputs ? Utils.safeFuzzyInfer(inputs) : null;

        if (!res) {
            return `
        <div class="card">
          ${emptyState("Не удалось рассчитать оценку", "Проверьте правила нечёткого вывода.", SVG.alertTriangle)}
        </div>
      `;
        }

        const rec = Fuzzy.recommendation(inputs, res);
        const recCls = Utils.riskClass(res.risk.term);

        const daysLeft = w.deadline ? daysUntil(w.deadline) : null;

        return `
      <div class="back-link" onclick="App.navigate('students')">← Назад к студентам</div>

      <div class="student-hero">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <div class="student-hero-name">${escapeHtml(s.fio)}</div>
            <div class="student-hero-meta">
              ${escapeHtml(s.group || "")} · ${escapeHtml(s.faculty || "")} · ${s.course || ""} курс
              ${s.recordBook ? "· зачётка " + escapeHtml(s.recordBook) : ""}
            </div>
            <div style="margin-top:10px;font-size:14px;font-weight:500;">${escapeHtml(w.topic)}</div>
            <div style="font-size:12px;color:var(--txt-muted);margin-top:4px;">
              ${escapeHtml(Utils.workTypeLabel(w.type))} · создана ${fmtDate(w.createdAt)}
              ${daysLeft !== null ? " · до дедлайна " + (daysLeft >= 0 ? daysLeft + " дн." : "просрочено") : ""}
            </div>
          </div>
          <div>${statusBadge(w.status)}</div>
        </div>

        <div class="student-hero-grid">
          <div class="stat-mini">
            <div class="num">${progress}%</div>
            <div class="lbl">Прогресс</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--${Utils.riskClass(res.risk.term)})">
              ${res.risk.value.toFixed(0)}
            </div>
            <div class="lbl">Риск</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--${Utils.readyClass(res.ready.term)})">
              ${res.ready.value.toFixed(0)}
            </div>
            <div class="lbl">Готовность</div>
          </div>
          <div class="stat-mini">
            <div class="num">${res.rating.value.toFixed(0)}</div>
            <div class="lbl">Рейтинг</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Рекомендация системы</div>
        <div class="recommendation ${recCls}">${escapeHtml(rec)}</div>
        ${
            !res.hasAnyTeacherCheck
                ? `
          <div class="notice" style="margin-top:12px;font-size:12px;background:var(--warn-soft);border-left:2px solid var(--warn);">
            ${SVG.info({ cls: "icon icon-xs" })}
            Оценка предварительная — проверка работы ещё не проводилась.
          </div>
        `
                : ""
        }
      </div>

      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-title">Этапы работы</div>
          ${
              stages.length === 0
                  ? '<div class="empty">Этапов нет</div>'
                  : stages
                        .map(
                            (st) => `
            <div class="stage-item ${st.done ? "done" : ""}">
              <div class="stage-check ${st.done ? "on" : ""}" style="cursor:default;"></div>
              <div class="stage-body">
                <div class="stage-name">${escapeHtml(st.name)}</div>
                <div class="stage-meta">${st.deadline ? "до " + escapeHtml(st.deadline) : "—"} · вес ${st.weight || 1}</div>
              </div>
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
                  ? '<div class="empty">Задач нет</div>'
                  : ["todo", "progress", "review", "done"]
                        .map((col) => {
                            const items = tasks.filter((t) => t.col === col);
                            if (!items.length) return "";
                            const titles = {
                                todo: "К выполнению",
                                progress: "В работе",
                                review: "На проверке",
                                done: "Готово",
                            };
                            return `<div style="margin-bottom:10px;">
                <div style="font-size:11px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
                  ${titles[col]} (${items.length})
                </div>
                ${items.map((t) => `<div style="font-size:13px;padding:4px 0;">• ${escapeHtml(t.title)}</div>`).join("")}
              </div>`;
                        })
                        .join("")
          }
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Версии документа (${versions.length})</div>
        ${
            versions.length === 0
                ? '<div class="empty">Версий нет</div>'
                : versions
                      .map(
                          (v) => `
          <div class="version-row">
            <span class="version-tag">v${escapeHtml(v.version)}</span>
            <div class="version-info">
              <div class="version-comment">${escapeHtml(v.comment || "Без комментария")}</div>
              <div class="version-date">${fmtDateTime(v.createdAt)}${v.filename ? " · " + escapeHtml(v.filename) : ""}</div>
            </div>
            <button class="btn-ghost btn-sm"
              onclick="Teacher.openVersionCommentModal('${v.id}')">
              ${SVG.messageCircle({ cls: "icon icon-sm" })}
              <span>Замечание</span>
            </button>
          </div>
        `,
                      )
                      .join("")
        }
      </div>

      <div class="card mt-16">
        <div class="card-title">Замечания (${comments.length})</div>
        ${
            comments.length === 0
                ? '<div class="empty">Замечаний нет</div>'
                : comments.map((c) => renderComment(c)).join("")
        }
      </div>

      ${
          w.status === "active" || w.status === "review"
              ? `
        <div class="card mt-16">
          <div class="card-title">Проверка работы</div>
          <div class="request-actions" style="justify-content:flex-start;">
            <button class="btn-primary" onclick="Teacher.openReviewModal('${w.id}')">
              ${SVG.checkCircle({ cls: "icon icon-sm" })}
              <span>Перейти к проверке</span>
            </button>
          </div>
        </div>
      `
              : ""
      }

      ${
          w.status === "approved"
              ? `
        <div class="card mt-16">
          <div class="card-title">Финальный этап</div>
          <p style="font-size:13px;color:var(--txt-muted);margin-bottom:12px;">
            Работа допущена к защите. После успешной защиты отметьте её как защищённую.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn-primary" onclick="Teacher.markAsDone('${w.id}')">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Отметить защищённой</span>
            </button>
            <button class="btn-ghost" onclick="Teacher.returnFromApproved('${w.id}')">
              ${SVG.refresh({ cls: "icon icon-sm" })}
              <span>Вернуть на доработку</span>
            </button>
          </div>
        </div>
      `
              : ""
      }
    `;
    };

    VIEWS["student-profile"] = function (params) {
        const studentId = params?.id;
        const s = Storage.getUserById(studentId);
        if (!s)
            return '<div class="card"><div class="empty">Студент не найден</div></div>';

        const u = getUser();
        const studentWorks = Storage.getWorks().filter((w) =>
            Storage.sameId(w.studentId, studentId),
        );
        const allowed =
            u && studentWorks.some((w) => Storage.sameId(w.teacherId, u.id));

        if (!allowed) {
            return `
        <div class="card">
          ${emptyState(
              "Этот студент не относится к вашим работам",
              "",
              SVG.lock,
          )}
        </div>
      `;
        }

        const activeWork =
            studentWorks.find(
                (w) => w.status === "active" || w.status === "review",
            ) || studentWorks[0];

        let totalProgress = 0,
            totalRating = 0,
            cnt = 0;
        studentWorks.forEach((w) => {
            const progress = calcProgress(w.id);
            const res = getFuzzyResult(w);
            totalProgress += progress;
            if (res) {
                totalRating += res.rating.value;
                cnt++;
            }
        });
        const avg = (x) => (cnt ? Math.round(x / cnt) : 0);

        const init = Utils.initials(s.fio);

        return `
      <div class="back-link" onclick="App.navigate('students')">← К студентам</div>

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
            <div class="num">${studentWorks.length}</div>
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

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Личные данные</div>
          <div class="info-grid">
            <div class="info-item"><div class="info-lbl">ФИО</div><div class="info-val">${escapeHtml(s.fio)}</div></div>
            <div class="info-item"><div class="info-lbl">Email</div><div class="info-val">${escapeHtml(s.email)}</div></div>
            <div class="info-item"><div class="info-lbl">Факультет</div><div class="info-val">${escapeHtml(s.faculty || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Группа</div><div class="info-val">${escapeHtml(s.group || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Курс</div><div class="info-val">${s.course || "—"}</div></div>
            <div class="info-item"><div class="info-lbl">Направление</div><div class="info-val">${escapeHtml(s.direction || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Номер зачётки</div><div class="info-val">${escapeHtml(s.recordBook || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Регистрация</div><div class="info-val">${fmtDate(s.createdAt)}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Радар по работам</div>
          <div class="chart-box h-220">
            <canvas id="teacherStudentRadar"></canvas>
          </div>
        </div>
      </div>

      ${
          activeWork
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title">Текущая работа</div>
            <button class="btn-ghost btn-sm"
              onclick="App.navigate('student-detail', {id: '${s.id}', workId: '${activeWork.id}'})">
              Полная карточка →
            </button>
          </div>
          <div style="font-size:15px;font-weight:500;margin-bottom:8px;">${escapeHtml(activeWork.topic)}</div>
          <div style="font-size:12px;color:var(--txt-muted);margin-bottom:12px;">
            ${escapeHtml(Utils.workTypeLabel(activeWork.type))} · ${statusBadge(activeWork.status)}
          </div>
          ${Utils.renderStagesMiniForTeacher(activeWork.id)}
        </div>
      `
              : ""
      }

      <div class="card mt-16">
        <div class="card-title">Все работы студента</div>
        ${studentWorks
            .map((w) => {
                const progress = calcProgress(w.id);
                const res = getFuzzyResult(w);
                return `
            <div class="mini-project"
              onclick="App.navigate('student-detail', {id: '${s.id}', workId: '${w.id}'})">
              <div>
                <div class="mini-project-title">${escapeHtml(w.topic)}</div>
                <div class="mini-project-sub">
                  ${escapeHtml(Utils.workTypeLabel(w.type))} · ${statusBadge(w.status)}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:14px;font-weight:600;">${progress}%</div>
                <div style="font-size:11px;color:var(--txt-muted);">риск ${res ? res.risk.value.toFixed(0) : "—"}</div>
              </div>
            </div>
          `;
            })
            .join("")}
      </div>
    `;
    };

    VIEWS["student-profile_after"] = function (params) {
        if (!Charts.hasChart()) return;
        const s = Storage.getUserById(params?.id);
        if (!s) return;
        const u = getUser();
        if (!u) return;

        const works = Storage.getWorks().filter((w) =>
            Storage.sameId(w.studentId, s.id),
        );
        const w =
            works.find((w) => Storage.sameId(w.teacherId, u.id)) || works[0];
        if (!w) return;

        const inputs = Utils.buildFuzzyInputs(w);
        if (!inputs) return;

        Charts.radar(
            "teacherStudentRadar",
            [
                "Прогресс",
                "Активность",
                "Объём",
                "Оригинальность",
                "ГОСТ",
                "Оценка",
            ],
            [
                {
                    label: s.fio,
                    data: [
                        inputs.progress,
                        inputs.activity * 10,
                        inputs.volume,
                        inputs.orig ?? 50,
                        inputs.gost ?? 50,
                        (inputs.supScore ?? 5) * 10,
                    ],
                    color: Charts.COLORS.purple,
                },
            ],
        );
    };

    function openVersionCommentModal(versionId) {
        const u = requireUser();
        if (!u) return;

        const version = Storage.getVersions().find((v) =>
            Storage.sameId(v.id, versionId),
        );
        if (!version) {
            App.toast("Версия не найдена");
            return;
        }
        const work = Storage.getWorkById(version.workId);
        if (!work || !Storage.sameId(work.teacherId, u.id)) {
            App.toast("Это не ваша версия");
            return;
        }

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Teacher.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Замечание к версии</h3>
            <button class="modal-close" onclick="Teacher.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Текст замечания <span class="req">*</span></label>
            <textarea id="vc_text" rows="4" placeholder="Например: нужно исправить оформление таблицы 2.1"></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Teacher.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Teacher.saveVersionComment('${versionId}')">Добавить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveVersionComment(versionId) {
        const u = requireUser();
        if (!u) return;

        const text = document.getElementById("vc_text")?.value.trim();
        if (!text) {
            App.toast("Введите текст");
            return;
        }

        const version = Storage.getVersions().find((v) =>
            Storage.sameId(v.id, versionId),
        );
        if (!version) {
            App.toast("Версия не найдена");
            return;
        }

        const work = Storage.getWorkById(version.workId);
        if (!work || !Storage.sameId(work.teacherId, u.id)) {
            App.toast("Это не ваша версия");
            return;
        }

        Storage.saveComment({
            id: uid(),
            workId: version.workId,
            versionId: version.id,
            authorId: u.id,
            text,
            createdAt: Date.now(),
            kind: "version",
        });

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "comment",
                    title: "Новое замечание к версии",
                    text: text.slice(0, 100),
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Замечание к версии",
                    work.topic,
                    text.slice(0, 60),
                    "info",
                );
            }
        } catch (e) {}

        closeModal();
        App.toast("Замечание добавлено");
    }

    let reviewFilter = "all";
    let reviewSearch = "";
    let reviewSort = "risk";

    VIEWS.review = function () {
        const students = getMyStudents();

        const all = students.filter((x) =>
            ["active", "review", "approved"].includes(x.work.status),
        );

        const enriched = all
            .map((x) => {
                const progress = calcProgress(x.work.id);
                const res = getFuzzyResult(x.work);
                if (!res) return null;
                const tasksReview = Storage.getTasksByWork(x.work.id).filter(
                    (t) => t.col === "review",
                );
                const versions = Storage.getVersionsByWork(x.work.id);
                const comments = Storage.getCommentsByWork(x.work.id);

                return {
                    ...x,
                    progress,
                    res,
                    tasksReview,
                    versions,
                    comments,
                    hasTeacherCheck: res.hasAnyTeacherCheck,
                };
            })
            .filter(Boolean);

        const active = enriched.filter((e) => e.work.status === "active");
        const review = enriched.filter((e) => e.work.status === "review");
        const approved = enriched.filter((e) => e.work.status === "approved");

        let filtered = enriched;
        if (reviewFilter === "active") filtered = active;
        else if (reviewFilter === "review") filtered = review;
        else if (reviewFilter === "approved") filtered = approved;

        if (reviewSearch) {
            const q = reviewSearch.toLowerCase();
            filtered = filtered.filter(
                (e) =>
                    e.student.fio.toLowerCase().includes(q) ||
                    e.work.topic.toLowerCase().includes(q) ||
                    (e.student.group || "").toLowerCase().includes(q),
            );
        }

        filtered = [...filtered].sort((a, b) => {
            if (reviewSort === "risk")
                return b.res.risk.value - a.res.risk.value;
            if (reviewSort === "progress") return b.progress - a.progress;
            if (reviewSort === "date")
                return (b.work.updatedAt || 0) - (a.work.updatedAt || 0);
            if (reviewSort === "name")
                return a.student.fio.localeCompare(b.student.fio);
            return 0;
        });

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Работы для проверки
            <span class="count-chip">${all.length}</span>
          </div>
        </div>

        <div class="filter-tabs" style="margin-bottom:14px;">
          ${renderReviewTab("all", "Все", all.length)}
          ${renderReviewTab("active", "В работе", active.length)}
          ${renderReviewTab("review", "На проверке", review.length)}
          ${renderReviewTab("approved", "Допущено", approved.length)}
        </div>

        <div class="review-toolbar">
          <input type="text"
            class="review-search-page"
            placeholder="Поиск по студенту, теме, группе…"
            value="${escapeHtml(reviewSearch)}"
            oninput="Teacher.setReviewSearch(this.value)">
          <select class="review-sort" onchange="Teacher.setReviewSort(this.value)">
            <option value="risk" ${reviewSort === "risk" ? "selected" : ""}>По риску</option>
            <option value="progress" ${reviewSort === "progress" ? "selected" : ""}>По прогрессу</option>
            <option value="date" ${reviewSort === "date" ? "selected" : ""}>По дате</option>
            <option value="name" ${reviewSort === "name" ? "selected" : ""}>По ФИО</option>
          </select>
        </div>

        ${
            filtered.length === 0
                ? emptyState(
                      all.length === 0
                          ? "Нет работ для проверки"
                          : "Ничего не найдено",
                      all.length === 0
                          ? "Работы появятся, когда студенты начнут работать."
                          : "Измените фильтр или запрос.",
                      SVG.fileText,
                  )
                : filtered.map((e) => renderReviewCard(e)).join("")
        }
      </div>
    `;
    };

    function renderReviewTab(id, label, count) {
        const active = reviewFilter === id ? "active" : "";
        return `
      <button class="filter-tab ${active}" onclick="Teacher.setReviewFilter('${id}')">
        ${escapeHtml(label)}
        <span class="count-chip" style="margin-left:6px;">${count}</span>
      </button>
    `;
    }

    function setReviewFilter(filter) {
        reviewFilter = filter;
        App.navigate("review");
    }

    function setReviewSearch(q) {
        reviewSearch = q;
        App.navigate("review");
        requestAnimationFrame(() => {
            setTimeout(() => {
                const input = document.querySelector(".review-search-page");
                if (!input) return;
                input.focus();
                try {
                    const len = input.value.length;
                    input.setSelectionRange(len, len);
                } catch (e) {}
            }, 0);
        });
    }

    function setReviewSort(sort) {
        reviewSort = sort;
        App.navigate("review");
    }

    function renderReviewCard(e) {
        const {
            work: w,
            student: s,
            progress,
            res,
            tasksReview,
            versions,
            comments,
            hasTeacherCheck,
        } = e;

        const isApproved = w.status === "approved";
        const isPending = w.status === "review";

        const accentColor = isApproved
            ? "var(--ok)"
            : isPending
              ? "var(--purple)"
              : "var(--info)";

        const taskAlert =
            tasksReview.length > 0
                ? `
      <button class="review-alert" onclick="App.navigate('tasks-review')">
        ${SVG.check({ cls: "icon icon-xs" })}
        <span>${tasksReview.length} ${tasksReview.length === 1 ? "задача" : "задач"} ждёт проверки</span>
        ${SVG.chevronRight({ cls: "icon icon-xs" })}
      </button>
    `
                : "";

        return `
      <div class="review-item" style="border-left-color:${accentColor};">

        <div class="review-item-head">
          <div class="review-item-title">${escapeHtml(w.topic)}</div>
          ${statusBadge(w.status)}
        </div>

        <div class="review-item-meta">
          ${escapeHtml(s.fio)}
          ${s.group ? " · " + escapeHtml(s.group) : ""}
          · ${escapeHtml(Utils.workTypeLabel(w.type))}
        </div>

        <div class="review-item-stats">
          <span class="review-stat">
            <span class="review-stat-label">Прогресс</span>
            <span class="review-stat-value" style="color:var(--${Utils.progressClass(progress)});">
              ${progress}%
            </span>
          </span>
          <span class="review-stat">
            <span class="review-stat-label">Риск</span>
            <span class="review-stat-value" style="color:var(--${Utils.riskClass(res.risk.term)});">
              ${res.risk.value.toFixed(0)}
            </span>
          </span>
          <span class="review-stat">
            <span class="review-stat-label">Готовность</span>
            <span class="review-stat-value" style="color:var(--${Utils.readyClass(res.ready.term)});">
              ${res.ready.value.toFixed(0)}
            </span>
          </span>
          <span class="review-stat">
            <span class="review-stat-label">Рейтинг</span>
            <span class="review-stat-value" style="color:var(--accent-viz);">
              ${res.rating.value.toFixed(0)}
            </span>
          </span>
        </div>

        <div class="review-item-info">
          <span>${versions.length} ${versions.length === 1 ? "версия" : "версий"}</span>
          <span class="review-info-dot">·</span>
          <span>${comments.length} ${comments.length === 1 ? "замечание" : "замечаний"}</span>
          <span class="review-info-dot">·</span>
          <span>обновлено ${fmtDate(w.updatedAt || w.createdAt)}</span>
          <span class="review-info-dot">·</span>
          <span style="color:var(--${hasTeacherCheck ? "ok" : "warn"});">
            ${hasTeacherCheck ? "проверено" : "не проверено"}
          </span>
        </div>

        ${taskAlert}

        <div class="review-item-actions">
          ${
              !isApproved
                  ? `
            <button class="btn-primary btn-sm" onclick="Teacher.openReviewModal('${w.id}')">
              ${SVG.checkCircle({ cls: "icon icon-sm" })}
              <span>Проверить</span>
            </button>
          `
                  : `
            <button class="btn-primary btn-sm" onclick="Teacher.markAsDone('${w.id}')">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Защищена</span>
            </button>
            <button class="btn-ghost btn-sm" onclick="Teacher.returnFromApproved('${w.id}')">
              ${SVG.refresh({ cls: "icon icon-sm" })}
              <span>На доработку</span>
            </button>
          `
          }
          <button class="btn-ghost btn-sm" onclick="App.navigate('student-detail', {id: '${s.id}', workId: '${w.id}'})">
            ${SVG.eye({ cls: "icon icon-sm" })}
            <span>Карточка</span>
          </button>
        </div>
      </div>
    `;
    }

    let taskFilter = "all";
    let taskSearch = "";
    let taskSort = "date";

    VIEWS["tasks-review"] = function () {
        const u = getUser();
        if (!u) return "";

        const myWorks = Storage.getWorksByTeacher(u.id);
        const myWorkIds = myWorks.map((w) => w.id);

        const allTasks = Storage.getTasks().filter((t) =>
            myWorkIds.some((id) => Storage.sameId(id, t.workId)),
        );

        const enriched = allTasks.map((t) => {
            const work = Storage.getWorkById(t.workId);
            const student = work ? Storage.getUserById(work.studentId) : null;
            const reviewer = t.reviewedBy
                ? Storage.getUserById(t.reviewedBy)
                : null;
            const deadlineDays = t.deadline ? daysUntil(t.deadline) : null;
            return { t, work, student, reviewer, deadlineDays };
        });

        const review = enriched.filter((e) => e.t.col === "review");
        const progress = enriched.filter((e) => e.t.col === "progress");
        const todo = enriched.filter((e) => e.t.col === "todo");
        const done = enriched.filter((e) => e.t.col === "done");

        let filtered = enriched;
        if (taskFilter !== "all") {
            filtered = filtered.filter((e) => e.t.col === taskFilter);
        }

        if (taskSearch) {
            const q = taskSearch.toLowerCase();
            filtered = filtered.filter(
                (e) =>
                    e.t.title.toLowerCase().includes(q) ||
                    (e.student?.fio || "").toLowerCase().includes(q) ||
                    (e.work?.topic || "").toLowerCase().includes(q),
            );
        }

        filtered = [...filtered].sort((a, b) => {
            if (taskSort === "deadline") {
                if (!a.t.deadline) return 1;
                if (!b.t.deadline) return -1;
                return (a.deadlineDays ?? 0) - (b.deadlineDays ?? 0);
            }
            if (taskSort === "title") return a.t.title.localeCompare(b.t.title);
            if (taskSort === "student")
                return (a.student?.fio || "").localeCompare(
                    b.student?.fio || "",
                );
            const priority = { review: 0, progress: 1, todo: 2, done: 3 };
            const pa = priority[a.t.col] ?? 9;
            const pb = priority[b.t.col] ?? 9;
            if (pa !== pb) return pa - pb;
            return (b.t.updatedAt || 0) - (a.t.updatedAt || 0);
        });

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${allTasks.length}</div>
          <div class="kpi-lbl">Всего задач</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${review.length > 0 ? "var(--accent-viz)" : "var(--txt-muted)"}">${review.length}</div>
          <div class="kpi-lbl">На проверке</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--info)">${progress.length}</div>
          <div class="kpi-lbl">В работе</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--ok)">${done.length}</div>
          <div class="kpi-lbl">Готово</div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Задачи
            <span class="count-chip">${allTasks.length}</span>
          </div>
        </div>

        <div class="filter-tabs" style="margin-bottom:14px;">
          ${renderTaskTab("all", "Все", allTasks.length)}
          ${renderTaskTab("review", "На проверке", review.length)}
          ${renderTaskTab("progress", "В работе", progress.length)}
          ${renderTaskTab("todo", "К выполнению", todo.length)}
          ${renderTaskTab("done", "Готово", done.length)}
        </div>

        <div class="review-toolbar">
          <input type="text"
            class="task-search-page"
            placeholder="Поиск по задаче, студенту, работе…"
            value="${escapeHtml(taskSearch)}"
            oninput="Teacher.setTaskSearch(this.value)">
          <select class="review-sort" onchange="Teacher.setTaskSort(this.value)">
            <option value="date" ${taskSort === "date" ? "selected" : ""}>Сначала на проверке</option>
            <option value="deadline" ${taskSort === "deadline" ? "selected" : ""}>По дедлайну</option>
            <option value="title" ${taskSort === "title" ? "selected" : ""}>По названию</option>
            <option value="student" ${taskSort === "student" ? "selected" : ""}>По студенту</option>
          </select>
        </div>

        ${
            filtered.length === 0
                ? emptyState(
                      allTasks.length === 0
                          ? "Задач пока нет"
                          : "Ничего не найдено",
                      allTasks.length === 0
                          ? "Задачи появятся, когда студенты начнут работать."
                          : "Измените фильтр или запрос.",
                      SVG.check,
                  )
                : filtered.map((e) => renderTaskCard(e)).join("")
        }
      </div>
    `;
    };

    function renderTaskTab(id, label, count) {
        const active = taskFilter === id ? "active" : "";
        return `
      <button class="filter-tab ${active}" onclick="Teacher.setTaskFilter('${id}')">
        ${escapeHtml(label)}
        <span class="count-chip" style="margin-left:6px;">${count}</span>
      </button>
    `;
    }

    function setTaskFilter(filter) {
        taskFilter = filter;
        App.navigate("tasks-review");
    }

    function setTaskSearch(q) {
        taskSearch = q;
        App.navigate("tasks-review");
        requestAnimationFrame(() => {
            setTimeout(() => {
                const input = document.querySelector(".task-search-page");
                if (!input) return;
                input.focus();
                try {
                    const len = input.value.length;
                    input.setSelectionRange(len, len);
                } catch (e) {}
            }, 0);
        });
    }

    function setTaskSort(sort) {
        taskSort = sort;
        App.navigate("tasks-review");
    }

    function renderTaskCard({ t, work, student, reviewer, deadlineDays }) {
        const colLabels = {
            todo: "К выполнению",
            progress: "В работе",
            review: "На проверке",
            done: "Готово",
        };
        const colBadges = {
            todo: "draft",
            progress: "active",
            review: "review",
            done: "approved",
        };
        const colBorder = {
            todo: "var(--txt-muted)",
            progress: "var(--info)",
            review: "var(--accent-viz)",
            done: "var(--ok)",
        };

        const isReview = t.col === "review";
        const isDone = t.col === "done";

        const deadlineHtml = t.deadline
            ? `
        <div class="task-deadline" style="color:var(--${
            deadlineDays < 0 ? "bad" : deadlineDays <= 3 ? "warn" : "txt-muted"
        });">
            Дедлайн: ${escapeHtml(t.deadline)}
            ${
                deadlineDays >= 0
                    ? ` · осталось ${deadlineDays} дн.`
                    : " · просрочено"
            }
        </div>
    `
            : "";

        const rejectNote = t.reviewComment
            ? `<div class="task-note">
                  <b>Замечание:</b> ${escapeHtml(t.reviewComment)}
               </div>`
            : "";

        const approvedInfo =
            isDone && reviewer
                ? `<div class="task-approved">
                      Проверено: <b>${escapeHtml(reviewer.fio)}</b>
                      ${t.reviewedAt ? ` · ${fmtDateTime(t.reviewedAt)}` : ""}
                   </div>`
                : "";

        let actions = "";
        if (isReview) {
            actions = `
                <button class="btn-primary btn-sm" onclick="Teacher.taskApprove('${t.id}')">
                    ${SVG.check({ cls: "icon icon-sm" })}
                    <span>Одобрить</span>
                </button>
                <button class="btn-ghost btn-sm" onclick="Teacher.taskReject('${t.id}')">
                    ${SVG.refresh({ cls: "icon icon-sm" })}
                    <span>Вернуть в работу</span>
                </button>
                <button class="btn-ghost btn-sm" onclick="Teacher.taskRejectWithComment('${t.id}')">
                    ${SVG.edit({ cls: "icon icon-sm" })}
                    <span>С замечанием</span>
                </button>
            `;
        } else if (isDone) {
            actions = "";
        } else {
            actions = `<span class="task-waiting">Ожидает действий студента</span>`;
        }

        return `
      <div class="task-card-row" style="border-left-color:${colBorder[t.col]};">
        <div class="task-card-head">
          <div class="task-card-title">${escapeHtml(t.title)}</div>
          <span class="badge ${colBadges[t.col]}">${colLabels[t.col]}</span>
        </div>

        <div class="task-card-meta">
          ${escapeHtml(student?.fio || "—")}
          ${student?.group ? " · " + escapeHtml(student.group) : ""}
          ${
              work
                  ? ` · <span style="opacity:0.8;">«${escapeHtml(work.topic.slice(0, 60))}${work.topic.length > 60 ? "…" : ""}»</span>`
                  : ""
          }
        </div>

        ${deadlineHtml}
        ${rejectNote}
        ${approvedInfo}

        ${actions ? `<div class="task-card-actions">${actions}</div>` : ""}
      </div>
    `;
    }

    function taskApprove(taskId) {
        const u = requireUser();
        if (!u) return;

        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        if (t.col !== "review") {
            App.toast("Задача не на проверке");
            return;
        }

        const work = Storage.getWorkById(t.workId);
        if (!work || !Storage.sameId(work.teacherId, u.id)) {
            App.toast("Это не ваша задача");
            return;
        }

        t.col = "done";
        t.reviewedBy = u.id;
        t.reviewedAt = Date.now();
        t.reviewStatus = "approved";
        t.reviewComment = "";
        Storage.setTasks(tasks);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "approve",
                    title: "Задача одобрена",
                    text: `«${t.title}» — проверено руководителем`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Задача одобрена",
                    t.title,
                    `студент: ${Storage.getUserById(work.studentId)?.fio || ""}`,
                    "positive",
                );
            }
        } catch (e) {}

        App.toast("Задача одобрена");
        App.navigate("tasks-review");
    }

    function taskReject(taskId) {
        const u = requireUser();
        if (!u) return;

        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        if (t.col !== "review") {
            App.toast("Задача не на проверке");
            return;
        }

        const work = Storage.getWorkById(t.workId);
        if (!work || !Storage.sameId(work.teacherId, u.id)) {
            App.toast("Это не ваша задача");
            return;
        }

        t.col = "progress";
        t.reviewedBy = u.id;
        t.reviewedAt = Date.now();
        t.reviewStatus = "rejected";
        t.reviewComment = "";
        Storage.setTasks(tasks);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "reject",
                    title: "Задача возвращена в работу",
                    text: `«${t.title}» — нужны доработки`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log("Задача возвращена", t.title, "", "negative");
            }
        } catch (e) {}

        App.toast("Задача возвращена в работу");
        App.navigate("tasks-review");
    }

    function taskRejectWithComment(taskId) {
        const u = requireUser();
        if (!u) return;

        const t = Storage.getTasks().find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        if (t.col !== "review") {
            App.toast("Задача не на проверке");
            return;
        }

        const work = Storage.getWorkById(t.workId);
        if (!work || !Storage.sameId(work.teacherId, u.id)) {
            App.toast("Это не ваша задача");
            return;
        }

        const html = `
      <div class="modal-back" onclick="if(event.target===this) App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Замечание к задаче</h3>
            <button class="modal-close" onclick="App.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Что нужно доработать</label>
            <textarea id="task_comment" rows="4" placeholder="Например: добавить примеры, исправить расчёты..."></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="App.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Teacher.saveTaskReject('${taskId}')">Отправить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveTaskReject(taskId) {
        const u = requireUser();
        if (!u) return;

        const comment = document.getElementById("task_comment")?.value.trim();
        if (!comment) {
            App.toast("Введите замечание");
            return;
        }

        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        if (t.col !== "review") {
            App.toast("Задача не на проверке");
            return;
        }

        const work = Storage.getWorkById(t.workId);
        if (!work || !Storage.sameId(work.teacherId, u.id)) {
            App.toast("Это не ваша задача");
            return;
        }

        t.col = "progress";
        t.reviewedBy = u.id;
        t.reviewedAt = Date.now();
        t.reviewStatus = "rejected";
        t.reviewComment = comment;
        Storage.setTasks(tasks);

        Storage.saveComment({
            id: uid(),
            workId: work.id,
            authorId: u.id,
            text: `Замечание к задаче «${t.title}»: ${comment}`,
            createdAt: Date.now(),
            kind: "task-review",
        });

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "comment",
                    title: "Замечание к задаче",
                    text: `«${t.title}»: ${comment.slice(0, 80)}`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Задача возвращена с замечанием",
                    t.title,
                    comment,
                    "warning",
                );
            }
        } catch (e) {}

        App.closeModal();
        App.toast("Замечание отправлено");
        App.navigate("tasks-review");
    }

    let pickedGrade = 5;

    function markAsDone(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;

        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "approved") {
            App.toast("Работа не допущена к защите");
            return;
        }

        const student = Storage.getUserById(w.studentId);
        pickedGrade = 5;

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Teacher.closeModal()">
        <div class="modal" style="max-width:520px;">
          <div class="modal-head">
            <h3>Оценка за защиту</h3>
            <button class="modal-close" onclick="Teacher.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
            ${escapeHtml(student?.fio || "—")} · «${escapeHtml(w.topic)}»
          </div>

          <div class="section-label">Итоговая оценка</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
            ${[5, 4, 3, 2]
                .map((g) => {
                    const labels = {
                        5: "отлично",
                        4: "хорошо",
                        3: "удовл.",
                        2: "неуд.",
                    };
                    return `
                <button class="grade-btn" data-grade="${g}" onclick="Teacher.pickGrade(${g})">
                  <div style="font-size:22px;font-weight:700;">${g}</div>
                  <div style="font-size:11px;color:var(--txt-muted);">${labels[g]}</div>
                </button>
              `;
                })
                .join("")}
          </div>

          <div class="field">
            <label>Комментарий комиссии / руководителя</label>
            <textarea id="grade_comment" rows="3"
              placeholder="Например: отличная защита, чёткие ответы на вопросы"></textarea>
          </div>

          <div class="field">
            <label>Дата защиты</label>
            <input type="date" id="grade_date" value="${new Date().toISOString().slice(0, 10)}">
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Teacher.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Teacher.saveFinalGrade('${workId}')">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Сохранить и завершить</span>
            </button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
        pickGrade(5);
    }

    function pickGrade(g) {
        const val = Number(g);
        if (![2, 3, 4, 5].includes(val)) return;
        pickedGrade = val;
        document.querySelectorAll(".grade-btn").forEach((btn) => {
            const active = +btn.dataset.grade === val;
            btn.style.borderColor = active ? "var(--accent)" : "var(--line)";
            btn.style.background = active
                ? "var(--accent-soft)"
                : "var(--bg-elev)";
            btn.style.color = active ? "var(--accent)" : "var(--txt)";
        });
    }

    function saveFinalGrade(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;

        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "approved") {
            App.toast("Работа не допущена к защите");
            return;
        }

        if (![2, 3, 4, 5].includes(pickedGrade)) pickedGrade = 5;

        const comment =
            document.getElementById("grade_comment")?.value.trim() || "";
        const date = document.getElementById("grade_date")?.value;

        w.status = "done";
        w.finalGrade = pickedGrade;
        w.gradeComment = comment;
        w.defendedAt = date ? new Date(date).getTime() : Date.now();
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "approve",
                    title: "Работа защищена",
                    text: `«${w.topic}» — оценка ${pickedGrade}. ${comment}`,
                    link: { view: "archived" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Работа защищена",
                    w.topic,
                    `оценка: ${pickedGrade}`,
                    "positive",
                );
            }
        } catch (e) {}

        pickedGrade = 5;
        closeModal();
        App.toast(`Работа защищена с оценкой ${w.finalGrade}`);
        App.navigate("students");
    }

    function returnFromApproved(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;

        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "approved") {
            App.toast("Работа не в статусе «Допущена»");
            return;
        }
        if (!confirm("Вернуть работу в статус «На проверке»?")) return;

        w.status = "review";
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "info",
                    title: "Работа возвращена на доработку",
                    text: `«${w.topic}» требует доработки`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log("Работа возвращена", w.topic, "", "warning");
            }
        } catch (e) {}

        App.toast("Работа возвращена в проверку");
        App.navigate("students");
    }

    VIEWS.rules = function () {
        const rules = Fuzzy.getRules();

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Правила нечёткого вывода (${rules.length})</div>
          <button class="btn-ghost btn-sm" onclick="Teacher.resetRules()">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Сбросить к умолчанию</span>
          </button>
        </div>
        <p style="font-size:12px;color:var(--txt-muted);margin-bottom:14px;">
          Включайте и выключайте правила, редактируйте описания. Изменения применяются мгновенно ко всем расчётам.
        </p>

        ${rules
            .map(
                (r) => `
          <div class="rule-box ${r.enabled ? "" : "off"}">
            <input type="checkbox" ${r.enabled ? "checked" : ""}
              onchange="Teacher.toggleRule('${r.id}', this.checked)">
            <div style="flex:1;">
              <div class="rule-if">ЕСЛИ ${escapeHtml(r.if.join(" И "))}</div>
              <div class="rule-then">ТО ${escapeHtml(r.then)}</div>
              <input type="text" class="rule-desc" value="${escapeHtml(r.desc)}"
                onchange="Teacher.updateRuleDesc('${r.id}', this.value)">
            </div>
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
            if (typeof Fuzzy.invalidateRulesCache === "function") {
                Fuzzy.invalidateRulesCache();
            }
            App.toast(enabled ? "Правило включено" : "Правило выключено");
        }
    }

    function updateRuleDesc(id, desc) {
        const rules = Fuzzy.getRules();
        const r = rules.find((x) => Storage.sameId(x.id, id));
        if (r) {
            r.desc = desc;
            Storage.setRules(rules);
            if (typeof Fuzzy.invalidateRulesCache === "function") {
                Fuzzy.invalidateRulesCache();
            }
        }
    }

    function resetRules() {
        if (!confirm("Сбросить все правила к значениям по умолчанию?")) return;
        Storage.setRules(null);
        if (typeof Fuzzy.invalidateRulesCache === "function") {
            Fuzzy.invalidateRulesCache();
        }
        App.toast("Правила сброшены");
        App.navigate("rules");
    }

    VIEWS.profile = function () {
        const u = getUser();
        if (!u) return "";
        const students = getMyStudents();

        return `
      <div class="card">
        <div class="card-title">Профиль</div>
        <div class="grid grid-2" style="margin-bottom:16px;">
          <div><div class="text-muted" style="font-size:12px;">ФИО</div><div>${escapeHtml(u.fio)}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Email</div><div>${escapeHtml(u.email)}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Роль</div><div>Преподаватель</div></div>
          <div><div class="text-muted" style="font-size:12px;">ID</div><div>${u.id}</div></div>
        </div>
        <div class="section-label">Профессиональные данные</div>
        <div class="grid grid-2">
          <div><div class="text-muted" style="font-size:12px;">Кафедра</div><div>${escapeHtml(u.department || "—")}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Должность</div><div>${escapeHtml(u.position || "—")}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Учёная степень</div><div>${escapeHtml(u.degree || "—")}</div></div>
          <div><div class="text-muted" style="font-size:12px;">Макс. нагрузка</div><div>${u.maxLoad || "—"} работ</div></div>
          <div style="grid-column:1/-1;">
            <div class="text-muted" style="font-size:12px;">Научные интересы</div>
            <div>${escapeHtml(u.interests || "—")}</div>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Мои студенты (${students.length})</div>
        ${
            students.length === 0
                ? '<div class="empty">Пока студентов нет</div>'
                : `<table class="table">
              <thead>
                <tr><th>Студент</th><th>Группа</th><th>Тема</th><th>Статус</th></tr>
              </thead>
              <tbody>
                ${students
                    .map(
                        (x) => `
                  <tr>
                    <td>${escapeHtml(x.student.fio)}</td>
                    <td>${escapeHtml(x.student.group || "—")}</td>
                    <td>${escapeHtml(x.work.topic)}</td>
                    <td>${statusBadge(x.work.status)}</td>
                  </tr>
                `,
                    )
                    .join("")}
              </tbody>
            </table>`
        }
      </div>
    `;
    };

    VIEWS.stats = function () {
        const students = getMyStudents();
        const active = getMyActiveStudents();

        const withRisk = active
            .map((x) => {
                const res = getFuzzyResult(x.work);
                if (!res) return null;
                return { ...x, progress: calcProgress(x.work.id), res };
            })
            .filter(Boolean);

        const avgProgress = active.length
            ? Math.round(
                  active.reduce((a, x) => a + calcProgress(x.work.id), 0) /
                      active.length,
              )
            : 0;
        const avgRisk = withRisk.length
            ? Math.round(
                  withRisk.reduce((a, x) => a + x.res.risk.value, 0) /
                      withRisk.length,
              )
            : 0;
        const avgReady = withRisk.length
            ? Math.round(
                  withRisk.reduce((a, x) => a + x.res.ready.value, 0) /
                      withRisk.length,
              )
            : 0;

        return `
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-lbl">Всего студентов</div>
          <div class="metric-val">${students.length}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Активных работ</div>
          <div class="metric-val">${active.length}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. прогресс</div>
          <div class="metric-val">${avgProgress}%</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. риск</div>
          <div class="metric-val" style="color:var(--${Utils.riskClass(avgRisk < 40 ? "low" : avgRisk < 65 ? "med" : "high")})">${avgRisk}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. готовность</div>
          <div class="metric-val">${avgReady}</div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-title">Нечёткий профиль группы</div>
          <div class="chart-box h-260"><canvas id="teacherGroupRadar"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Студенты по группам</div>
          <div class="chart-box h-260"><canvas id="teacherGroupsChart"></canvas></div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Сравнение студентов</div>
        <div class="chart-box h-300"><canvas id="teacherCompareChart"></canvas></div>
      </div>
    `;
    };

    VIEWS.stats_after = function () {
        if (!Charts.hasChart()) return;
        const active = getMyActiveStudents();
        const withData = active
            .map((x) => {
                const res = getFuzzyResult(x.work);
                if (!res) return null;
                return {
                    student: x.student,
                    work: x.work,
                    progress: calcProgress(x.work.id),
                    res,
                };
            })
            .filter(Boolean);

        if (withData.length > 0) {
            const avg = (fn) =>
                Math.round(
                    withData.reduce((a, x) => a + fn(x), 0) / withData.length,
                );
            Charts.radar(
                "teacherGroupRadar",
                ["Прогресс", "Риск", "Готовность", "Рейтинг"],
                [
                    {
                        label: "Средние значения",
                        data: [
                            avg((x) => x.progress),
                            avg((x) => x.res.risk.value),
                            avg((x) => x.res.ready.value),
                            avg((x) => x.res.rating.value),
                        ],
                        color: Charts.COLORS.accent,
                    },
                ],
            );
        }

        const groups = {};
        getMyStudents().forEach((x) => {
            const g = x.student.group || "Не указана";
            groups[g] = (groups[g] || 0) + 1;
        });
        if (Object.keys(groups).length > 0) {
            Charts.doughnut(
                "teacherGroupsChart",
                Object.keys(groups),
                Object.values(groups),
                [
                    Charts.COLORS.accent,
                    Charts.COLORS.purple,
                    Charts.COLORS.ok,
                    Charts.COLORS.warn,
                    Charts.COLORS.bad,
                ],
            );
        }

        if (withData.length > 0) {
            Charts.bar(
                "teacherCompareChart",
                withData.map((x) => x.student.fio.split(" ")[0]),
                withData.map((x) => x.progress),
                withData.map((x) =>
                    x.res.risk.term === "high"
                        ? Charts.COLORS.bad
                        : x.res.risk.term === "med"
                          ? Charts.COLORS.warn
                          : Charts.COLORS.ok,
                ),
                { label: "Прогресс, %", max: 100 },
            );
        }
    };

    VIEWS.calendar = function () {
        const students = getMyStudents();
        const events = [];

        students.forEach((x) => {
            if (x.work.deadline) {
                events.push({
                    date: x.work.deadline,
                    title: `${x.student.fio}: защита`,
                    kind: "defense",
                });
            }
            const stages = Storage.getStagesByWork(x.work.id);
            stages
                .filter((s) => s.deadline && !s.done)
                .forEach((s) => {
                    events.push({
                        date: s.deadline,
                        title: `${x.student.fio}: ${s.name}`,
                        kind: "stage",
                    });
                });
        });

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const monthNames = [
            "Январь",
            "Февраль",
            "Март",
            "Апрель",
            "Май",
            "Июнь",
            "Июль",
            "Август",
            "Сентябрь",
            "Октябрь",
            "Ноябрь",
            "Декабрь",
        ];
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const eventsByDay = {};
        events.forEach((e) => {
            const d = new Date(e.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate();
                if (!eventsByDay[day]) eventsByDay[day] = [];
                eventsByDay[day].push(e);
            }
        });

        let cells = "";
        for (let i = 0; i < startOffset; i++)
            cells += '<div class="calendar-day empty"></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = d === now.getDate();
            const hasEvents = eventsByDay[d];
            const isUrgent =
                hasEvents &&
                hasEvents.some((e) => {
                    const days = daysUntil(e.date);
                    return days <= 3 && days >= 0;
                });
            cells += `
        <div class="calendar-day ${isToday ? "today" : ""} ${hasEvents ? "has-deadline" : ""} ${isUrgent ? "urgent" : ""}">
          ${d}
        </div>
      `;
        }

        const upcoming = events
            .map((e) => ({ ...e, days: daysUntil(e.date) }))
            .filter((e) => e.days >= 0)
            .sort((a, b) => a.days - b.days)
            .slice(0, 12);

        return `
      <div class="card">
        <div class="card-title">${monthNames[month]} ${year}</div>
        <div class="calendar-grid">
          ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
              .map((d) => `<div class="calendar-head">${d}</div>`)
              .join("")}
          ${cells}
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Ближайшие события (${upcoming.length})</div>
        ${
            upcoming.length === 0
                ? '<div class="empty">Событий нет</div>'
                : `<div class="timeline">
                     ${upcoming
                         .map(
                             (e) => `
                       <div class="timeline-item ${e.days <= 3 ? "bad" : e.days <= 7 ? "warn" : ""}">
                         <div class="timeline-time">${fmtDate(e.date)} · через ${e.days} дн.</div>
                         <div class="timeline-title">${escapeHtml(e.title)}</div>
                       </div>
                     `,
                         )
                         .join("")}
                   </div>`
        }
      </div>
    `;
    };

    let reviewGostState = {};
    let reviewWorkId = null;

    function computeGostPct(checks) {
        if (!checks || typeof checks !== "object") return null;
        const keys = Object.keys(checks);
        if (keys.length === 0) return null;
        const total = GOST_ITEMS.length;
        const done = keys.filter((k) => checks[k]).length;
        return Math.round((done / total) * 100);
    }

    function openReviewModal(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "active" && w.status !== "review") {
            App.toast("Эту работу нельзя проверять в текущем статусе");
            return;
        }

        reviewWorkId = workId;
        reviewGostState = { ...(w.gostChecks || {}) };

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Teacher.closeModal()">
        <div class="modal" style="max-width:640px;">
          <div class="modal-head">
            <h3>Проверка работы</h3>
            <button class="modal-close" onclick="Teacher.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
            ${escapeHtml(w.topic)}
          </div>

          <div class="section-label">Оценка руководителя</div>
          <div class="rate-grid">
            <div class="field">
              <label>Оценка (0–10)</label>
              <input type="number" id="rv_supScore" min="0" max="10"
                value="${w.supScore ?? 5}"
                oninput="Teacher.updateFuzzyPreview()">
            </div>
            <div class="field">
              <label>Оригинальность, %</label>
              <input type="number" id="rv_orig" min="0" max="100"
                value="${w.orig ?? 65}"
                oninput="Teacher.updateFuzzyPreview()">
            </div>
          </div>

          <div class="section-label" id="gostLabel">Соответствие ГОСТу</div>
          <div class="gost-checks" id="gostList">
            ${GOST_ITEMS.map(
                (item, i) => `
              <div class="gost-item ${reviewGostState[i] ? "on" : ""}"
                data-idx="${i}"
                onclick="Teacher.toggleGost2(${i})">
                <span class="gost-check"></span>
                <span>${escapeHtml(item)}</span>
              </div>
            `,
            ).join("")}
          </div>

          <div class="section-label">Нечёткий вывод</div>
          <div id="reviewFuzzy"></div>

          <div class="field mt-16">
            <label>Общий комментарий к работе</label>
            <textarea id="rv_comment" rows="3" placeholder="Что нужно доработать, что хорошо"></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:space-between;margin-top:16px;flex-wrap:wrap;">
            <div>
              ${
                  w.status === "active"
                      ? `<button class="btn-ghost btn-sm" onclick="Teacher.markReview('${workId}')">→ На проверке</button>`
                      : ""
              }
              ${
                  w.status === "review"
                      ? `<button class="btn-ghost btn-sm" onclick="Teacher.markActive('${workId}')">← В работу</button>`
                      : ""
              }
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn-ghost" onclick="Teacher.closeModal()">Отмена</button>
              <button class="btn-primary" onclick="Teacher.saveReview('${workId}')">Сохранить</button>
            </div>
          </div>

          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
            <button class="btn-primary" style="width:100%;" onclick="Teacher.approveFinal('${workId}')">
              ${SVG.checkCircle({ cls: "icon icon-sm" })}
              <span>Допустить к защите</span>
            </button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
        recomputeReviewFuzzy();
    }

    function toggleGost2(i) {
        const idx = String(i);
        reviewGostState[idx] = !reviewGostState[idx];
        document.querySelectorAll("#gostList .gost-item").forEach((el) => {
            const k = el.dataset.idx;
            el.classList.toggle("on", !!reviewGostState[k]);
        });
        recomputeReviewFuzzy();
    }

    function recomputeReviewFuzzy() {
        const w = Storage.getWorkById(reviewWorkId);
        if (!w) return;

        const gostPct = computeGostPct(reviewGostState);
        const supScore = +(document.getElementById("rv_supScore")?.value || 5);
        const orig = +(document.getElementById("rv_orig")?.value || 65);

        const gl = document.getElementById("gostLabel");
        if (gl)
            gl.textContent =
                gostPct === null
                    ? "Соответствие ГОСТу (не оценено)"
                    : `Соответствие ГОСТу (${gostPct}%)`;

        const base = Utils.buildFuzzyInputs(w);
        if (!base) return;
        const inputs = { ...base, supScore, orig, gost: gostPct };
        const res = Utils.safeFuzzyInfer(inputs);

        const box = document.getElementById("reviewFuzzy");
        if (!box) return;
        if (!res) {
            box.innerHTML = `<div class="notice" style="background:var(--warn-soft);border-left:3px solid var(--warn);font-size:12px;">
                ${SVG.alertTriangle({ cls: "icon icon-xs" })}
                Не удалось рассчитать оценку. Проверьте правила.
            </div>`;
            return;
        }

        box.innerHTML = `
      <div class="fuzzy-panel" style="grid-template-columns:1fr 1fr 1fr;">
        <div class="fuzzy-out">
          <div class="fuzzy-out-lbl">Риск</div>
          <div class="fuzzy-out-val" style="font-size:20px;color:var(--${Utils.riskClass(res.risk.term)})">
            ${res.risk.value.toFixed(0)}
          </div>
          <div class="fuzzy-out-term">${Fuzzy.termLabel(res.risk.term, "risk")}</div>
        </div>
        <div class="fuzzy-out">
          <div class="fuzzy-out-lbl">Готовность</div>
          <div class="fuzzy-out-val" style="font-size:20px;color:var(--${Utils.readyClass(res.ready.term)})">
            ${res.ready.value.toFixed(0)}
          </div>
          <div class="fuzzy-out-term">${Fuzzy.termLabel(res.ready.term, "ready")}</div>
        </div>
        <div class="fuzzy-out">
          <div class="fuzzy-out-lbl">Рейтинг</div>
          <div class="fuzzy-out-val" style="font-size:20px;color:var(--accent)">
            ${res.rating.value.toFixed(0)}
          </div>
          <div class="fuzzy-out-term">${Fuzzy.termLabel(res.rating.term, "rating")}</div>
        </div>
      </div>
      <div class="recommendation mt-8 ${Utils.riskClass(res.risk.term)}"
        style="font-size:12px;">
        ${escapeHtml(Fuzzy.recommendation(inputs, res))}
      </div>
    `;
    }

    function updateFuzzyPreview() {
        recomputeReviewFuzzy();
    }

    function saveReview(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "active" && w.status !== "review") {
            App.toast("Работа не в том статусе для сохранения проверки");
            return;
        }

        w.supScore = Math.max(
            0,
            Math.min(10, +(document.getElementById("rv_supScore")?.value || 5)),
        );
        w.orig = Math.max(
            0,
            Math.min(100, +(document.getElementById("rv_orig")?.value || 65)),
        );
        w.gostChecks = { ...reviewGostState };
        w.gost = computeGostPct(reviewGostState);
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        const comment = document.getElementById("rv_comment")?.value.trim();
        if (comment) {
            Storage.saveComment({
                id: uid(),
                workId: w.id,
                authorId: u.id,
                text: comment,
                createdAt: Date.now(),
                kind: "review",
            });

            try {
                if (typeof Notifications !== "undefined") {
                    Notifications.add({
                        userId: w.studentId,
                        type: "comment",
                        title: "Новое замечание руководителя",
                        text: comment.slice(0, 100),
                        link: { view: "my-work" },
                    });
                }
            } catch (e) {}
        }

        try {
            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Проверка сохранена",
                    w.topic,
                    `оценка: ${w.supScore}, ГОСТ: ${w.gost === null ? "—" : w.gost + "%"}`,
                    "info",
                );
            }
        } catch (e) {}

        closeModal();
        App.toast("Проверка сохранена");
        App.navigate("students");
    }

    function markReview(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "active") return;

        w.status = "review";
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "info",
                    title: "Работа на проверке",
                    text: `«${w.topic}» — руководитель проверяет`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        App.toast("Статус: На проверке");
        App.navigate("students");
    }

    function markActive(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "review") return;

        w.status = "active";
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "info",
                    title: "Работа возвращена в работу",
                    text: `«${w.topic}»`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        App.toast("Статус: В работе");
        App.navigate("students");
    }

    function approveFinal(workId) {
        const u = requireUser();
        if (!u) return;

        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!Storage.sameId(w.teacherId, u.id)) {
            App.toast("Это не ваша работа");
            return;
        }
        if (w.status !== "active" && w.status !== "review") {
            App.toast("Работа не в том статусе");
            return;
        }
        if (!confirm("Допустить работу к защите?")) return;

        w.status = "approved";
        w.approvedFinalAt = Date.now();
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        try {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "approve",
                    title: "Работа допущена к защите",
                    text: `«${w.topic}»`,
                    link: { view: "my-work" },
                });
            }
        } catch (e) {}

        try {
            if (typeof Audit !== "undefined") {
                Audit.log("Работа допущена к защите", w.topic, "", "positive");
            }
        } catch (e) {}

        App.toast("Работа допущена к защите");
        App.navigate("students");
    }

    VIEWS.announcements = function () {
        if (typeof Announcements === "undefined") {
            return '<div class="card"><div class="empty">Модуль недоступен</div></div>';
        }
        return Announcements.renderPage(getUser());
    };

    VIEWS.mamdani = function (params) {
        return MamdaniViz.render(params);
    };
    VIEWS.simulate = function (params) {
        return Simulate.render(params);
    };
    VIEWS.consultations = function () {
        return Consult.renderPage(getUser());
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

    function closeModal() {
        App.closeModal();
    }

    return {
        VIEWS,

        setRequestFilter,

        setReviewFilter,
        setReviewSearch,
        setReviewSort,

        toggleMyWorksActive,
        setMyWorksType,
        setMyWorksSearch,
        setMyWorksSort,

        setTaskFilter,
        setTaskSearch,
        setTaskSort,

        approveWork,
        openRejectModal,
        rejectWork,

        openVersionCommentModal,
        saveVersionComment,

        openReviewModal,
        toggleGost2,
        updateFuzzyPreview,
        saveReview,
        markReview,
        markActive,
        approveFinal,

        taskApprove,
        taskReject,
        taskRejectWithComment,
        saveTaskReject,

        markAsDone,
        pickGrade,
        saveFinalGrade,
        returnFromApproved,

        toggleRule,
        updateRuleDesc,
        resetRules,

        closeModal,
    };
})();
