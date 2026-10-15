/* =========================================================
   TEACHER — весь функционал роли «Преподаватель»
   ========================================================= */
const Teacher = (() => {
    /* =========================================================
       КОНСТАНТЫ
       ========================================================= */
    const WORK_STATUSES = {
        draft: { label: "Черновик", badge: "draft" },
        pending: { label: "На утверждении", badge: "pending" },
        active: { label: "В работе", badge: "active" },
        review: { label: "На проверке", badge: "review" },
        approved: { label: "Допущена", badge: "approved" },
        done: { label: "Защищена", badge: "done" },
        rejected: { label: "Отклонена", badge: "rejected" },
    };

    const WORK_TYPES = {
        course: "Курсовая работа",
        diploma: "Дипломная работа",
        vkr: "ВКР (бакалавриат)",
        master: "Магистерская диссертация",
    };

    const GOST_ITEMS = [
        "Шрифт Times New Roman, 14 пт",
        "Поля: левое 30 мм, правое 15 мм, верх/низ 20 мм",
        "Межстрочный интервал 1.5",
        "Абзацный отступ 1.25 см",
        "Нумерация страниц внизу по центру",
        "Заголовки: без точки в конце, с прописной",
        "Таблицы и рисунки подписаны",
        "Список литературы по ГОСТ Р 7.0.5–2008",
    ];

    /* =========================================================
       ХЕЛПЕРЫ
       ========================================================= */
    function getUser() {
        return Auth.getUser();
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
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
        return getMyStudents().filter(
            (x) => x.work.status !== "rejected" && x.work.status !== "done",
        );
    }

    function statusBadge(status) {
        const s = WORK_STATUSES[status] || WORK_STATUSES.draft;
        return `<span class="badge ${s.badge}">${s.label}</span>`;
    }

    function calcProgress(workId) {
        const stages = Storage.getStagesByWork(workId);
        if (stages.length === 0) return 0;
        const total = stages.reduce((s, x) => s + (x.weight || 1), 0);
        const done = stages
            .filter((s) => s.done)
            .reduce((s, x) => s + (x.weight || 1), 0);
        return total === 0 ? 0 : Math.round((done / total) * 100);
    }

    function buildFuzzyInputs(work) {
        const progress = calcProgress(work.id);
        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);

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

    function emptyState(title, text, iconFn, actionHtml) {
        return `
      <div class="empty-state">
        ${iconFn ? iconFn({ cls: "icon icon-2xl" }) : SVG.folder({ cls: "icon icon-2xl" })}
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${text}</p>` : ""}
        ${actionHtml || ""}
      </div>
    `;
    }

    /* =========================================================
       VIEWS
       ========================================================= */
    const VIEWS = {};

    /* ---------------------------------------------------------
       ДАШБОРД
       --------------------------------------------------------- */
    VIEWS.dashboard = function () {
        const u = getUser();
        if (!u) return "";

        const students = getMyStudents();
        const active = getMyActiveStudents();
        const requests = students.filter((x) => x.work.status === "pending");

        const withRisk = active.map((x) => ({
            ...x,
            progress: calcProgress(x.work.id),
            risk: Fuzzy.infer(buildFuzzyInputs(x.work)).risk,
        }));

        const highRisk = withRisk.filter((x) => x.risk.term === "high").length;

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

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${students.length}</div>
          <div class="kpi-lbl">Студентов</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--warn)">${requests.length}</div>
          <div class="kpi-lbl">Новых заявок</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--bad)">${highRisk}</div>
          <div class="kpi-lbl">Высокий риск</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num">${avgProgress}%</div>
          <div class="kpi-lbl">Ср. прогресс</div>
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
        <div class="card-title">Загрузка</div>
        <div class="stat-row">
          <span class="stat-lbl">${currentLoad} из ${maxLoad} работ</span>
          <span class="stat-val">${loadPct}%</span>
        </div>
        <div class="progress ${loadPct > 90 ? "low" : loadPct > 70 ? "med" : "high"}">
          <div style="width:${loadPct}%"></div>
        </div>
      </div>

      ${
          requests.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title">
              Новые заявки <span class="count-chip">${requests.length}</span>
            </div>
            <button class="btn-ghost btn-sm" onclick="App.navigate('requests')">Все →</button>
          </div>
          ${requests
              .slice(0, 3)
              .map((x) => renderRequestMini(x))
              .join("")}
        </div>
      `
              : ""
      }

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title">Студенты в зоне риска</div>
          <button class="btn-ghost btn-sm" onclick="App.navigate('students')">Все →</button>
        </div>
        ${
            withRisk
                .filter((x) => x.risk.term !== "low")
                .sort((a, b) => b.risk.value - a.risk.value)
                .slice(0, 5)
                .map((x) => renderRiskRow(x))
                .join("") || '<div class="empty">Никто не в зоне риска</div>'
        }
      </div>
    `;
    };

    VIEWS.dashboard_after = function () {
        if (!Charts.hasChart()) return;
        const active = getMyActiveStudents();
        const withRisk = active.map((x) => ({
            ...x,
            progress: calcProgress(x.work.id),
            risk: Fuzzy.infer(buildFuzzyInputs(x.work)).risk,
        }));

        const low = withRisk.filter((x) => x.risk.term === "low").length;
        const med = withRisk.filter((x) => x.risk.term === "med").length;
        const high = withRisk.filter((x) => x.risk.term === "high").length;

        Charts.doughnut(
            "teacherRiskChart",
            ["Низкий", "Средний", "Высокий"],
            [low, med, high],
            [Charts.COLORS.ok, Charts.COLORS.warn, Charts.COLORS.bad],
        );

        if (withRisk.length > 0) {
            Charts.bar(
                "teacherProgressChart",
                withRisk.map((x) => x.student.fio.split(" ")[0]),
                withRisk.map((x) => x.progress),
                withRisk.map((x) =>
                    x.risk.term === "high"
                        ? Charts.COLORS.bad
                        : x.risk.term === "med"
                          ? Charts.COLORS.warn
                          : Charts.COLORS.ok,
                ),
                { label: "Прогресс, %", max: 100 },
            );
        }
    };

    function renderRequestMini(x) {
        return `
      <div class="request-card">
        <div class="request-head">
          <div style="flex:1;min-width:200px;">
            <div class="request-topic">${escapeHtml(x.work.topic)}</div>
            <div class="request-meta">
              ${escapeHtml(x.student.fio)} · ${escapeHtml(x.student.group || "")} · ${escapeHtml(x.student.faculty || "")}
              · ${escapeHtml(WORK_TYPES[x.work.type] || "")}
            </div>
          </div>
          <div>${statusBadge(x.work.status)}</div>
        </div>
        <div class="request-actions">
          <button class="btn-ghost btn-sm"
            onclick="App.navigate('request-detail', {id: ${x.work.id}})">
            Подробнее
          </button>
        </div>
      </div>
    `;
    }

    function renderRiskRow(x) {
        const cls = x.risk.term;
        const lbl = Fuzzy.termLabel(cls, "risk");
        return `
      <div class="student-row"
        onclick="App.navigate('student-detail', {id: ${x.student.id}, workId: ${x.work.id}})">
        <div>
          <div class="student-name">${escapeHtml(x.student.fio)}</div>
          <div class="student-sub">${escapeHtml(x.work.topic)}</div>
        </div>
        <div class="progress-mini">
          <div style="font-size:11px;color:var(--txt-muted);margin-bottom:3px;">${x.progress}%</div>
          <div class="progress ${x.progress < 40 ? "low" : x.progress < 70 ? "med" : "high"}">
            <div style="width:${x.progress}%"></div>
          </div>
        </div>
        <div><span class="badge risk-${cls}">${lbl}</span></div>
        <div style="color:var(--txt-muted);font-size:18px;">›</div>
      </div>
    `;
    }

    /* ---------------------------------------------------------
       ЗАЯВКИ
       --------------------------------------------------------- */
    VIEWS.requests = function () {
        const students = getMyStudents();
        const requests = students.filter((x) => x.work.status === "pending");

        return `
      <div class="card">
        <div class="card-title">Входящие заявки (${requests.length})</div>
        ${
            requests.length === 0
                ? emptyState(
                      "Новых заявок нет",
                      "Когда студент отправит заявку на утверждение, она появится здесь.",
                      SVG.clipboard,
                  )
                : requests.map((x) => renderRequestCard(x)).join("")
        }
      </div>
    `;
    };

    function renderRequestCard(x) {
        const w = x.work;
        const s = x.student;
        return `
      <div class="request-card">
        <div class="request-head">
          <div style="flex:1;min-width:220px;">
            <div class="request-topic">${escapeHtml(w.topic)}</div>
            <div class="request-meta">
              ${escapeHtml(s.fio)} · ${escapeHtml(s.group || "")} · ${escapeHtml(s.faculty || "")} · ${s.course || ""} курс
              · ${escapeHtml(WORK_TYPES[w.type] || "")}
            </div>
          </div>
          <div>${statusBadge(w.status)}</div>
        </div>

        ${w.annotation ? `<div class="request-body"><b>Аннотация:</b> ${escapeHtml(w.annotation)}</div>` : ""}
        ${w.goal ? `<div class="request-body"><b>Цель:</b> ${escapeHtml(w.goal)}</div>` : ""}
        ${w.deadline ? `<div class="request-meta">Планируемая защита: ${w.deadline}</div>` : ""}

        <div class="request-actions">
          <button class="btn-ghost btn-sm"
            onclick="App.navigate('request-detail', {id: ${w.id}})">
            Подробнее
          </button>
          <button class="btn-ghost btn-sm" onclick="Teacher.openRejectModal(${w.id})">
            ${SVG.x({ cls: "icon icon-sm" })}
            <span>Отклонить</span>
          </button>
          <button class="btn-primary btn-sm" onclick="Teacher.approveWork(${w.id})">
            ${SVG.check({ cls: "icon icon-sm" })}
            <span>Утвердить</span>
          </button>
        </div>
      </div>
    `;
    }

    /* ---------------------------------------------------------
       ДЕТАЛЬ ЗАЯВКИ
       --------------------------------------------------------- */
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
            <div class="num" style="font-size:14px;">${escapeHtml(WORK_TYPES[w.type] || "—")}</div>
            <div class="lbl">Тип работы</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="font-size:14px;">${w.deadline || "—"}</div>
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

      ${w.annotation ? `<div class="card"><div class="card-title">Аннотация</div><div style="font-size:13px;line-height:1.6;">${escapeHtml(w.annotation)}</div></div>` : ""}
      ${w.keywords ? `<div class="card mt-16"><div class="card-title">Ключевые слова</div><div style="font-size:13px;">${escapeHtml(w.keywords)}</div></div>` : ""}
      ${w.goal ? `<div class="card mt-16"><div class="card-title">Цель работы</div><div style="font-size:13px;">${escapeHtml(w.goal)}</div></div>` : ""}
      ${w.tasksText ? `<div class="card mt-16"><div class="card-title">Задачи</div><div style="font-size:13px;white-space:pre-line;line-height:1.6;">${escapeHtml(w.tasksText)}</div></div>` : ""}

      ${
          w.status === "pending"
              ? `
        <div class="card mt-16">
          <div class="card-title">Решение</div>
          <div class="request-actions" style="justify-content:flex-start;">
            <button class="btn-ghost" onclick="Teacher.openRejectModal(${w.id})">
              ${SVG.x({ cls: "icon icon-sm" })}
              <span>Отклонить</span>
            </button>
            <button class="btn-primary" onclick="Teacher.approveWork(${w.id})">
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
        const w = Storage.getWorkById(workId);
        if (!w) return;

        w.status = "active";
        w.approvedAt = Date.now();
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "approve",
                title: "Заявка утверждена",
                text: `«${w.topic}» принята в работу`,
                link: { view: "my-work" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Заявка утверждена", w.topic, "", "positive");
        }

        App.toast("Заявка утверждена");
        App.navigate("requests");
    }

    function openRejectModal(workId) {
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
            <button class="btn-primary" onclick="Teacher.rejectWork(${workId})">Отклонить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function rejectWork(workId) {
        const reason = document.getElementById("rj_reason")?.value.trim();
        if (!reason) {
            App.toast("Укажите причину");
            return;
        }

        const w = Storage.getWorkById(workId);
        if (!w) return;

        w.status = "rejected";
        w.rejectReason = reason;
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        Storage.saveComment({
            id: uid(),
            workId: w.id,
            authorId: getUser().id,
            text: "Заявка отклонена: " + reason,
            createdAt: Date.now(),
            kind: "reject",
        });

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "reject",
                title: "Заявка отклонена",
                text: reason,
                link: { view: "archived" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Заявка отклонена", w.topic, reason, "negative");
        }

        closeModal();
        App.toast("Заявка отклонена");
        App.navigate("requests");
    }

    /* ---------------------------------------------------------
       МОИ СТУДЕНТЫ
       --------------------------------------------------------- */
    VIEWS.students = function () {
        const students = getMyStudents();
        const active = students.filter(
            (x) => x.work.status !== "rejected" && x.work.status !== "done",
        );
        const other = students.filter(
            (x) => x.work.status === "rejected" || x.work.status === "done",
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
        const res = Fuzzy.infer(buildFuzzyInputs(x.work));
        const cls = res.risk.term;
        const lbl = Fuzzy.termLabel(cls, "risk");

        return `
      <div class="student-row" onclick="App.navigate('student-profile', {id: ${x.student.id}})">
        <div>
          <div class="student-name">${escapeHtml(x.student.fio)}</div>
          <div class="student-sub">${escapeHtml(x.work.topic)}</div>
        </div>
        <div class="progress-mini">
          <div style="font-size:11px;color:var(--txt-muted);margin-bottom:3px;">${progress}%</div>
          <div class="progress ${progress < 40 ? "low" : progress < 70 ? "med" : "high"}">
            <div style="width:${progress}%"></div>
          </div>
        </div>
        <div><span class="badge risk-${cls}">${lbl}</span></div>
        <div style="color:var(--txt-muted);font-size:18px;">›</div>
      </div>
    `;
    }

    /* ---------------------------------------------------------
       ДЕТАЛЬ СТУДЕНТА
       --------------------------------------------------------- */
    VIEWS["student-detail"] = function (params) {
        const workId = params?.workId;
        const studentId = params?.id;
        const w = Storage.getWorkById(workId);
        const s = Storage.getUserById(studentId);
        if (!w || !s)
            return '<div class="card"><div class="empty">Студент не найден</div></div>';

        const progress = calcProgress(w.id);
        const stages = Storage.getStagesByWork(w.id);
        const tasks = Storage.getTasksByWork(w.id);
        const versions = Storage.getVersionsByWork(w.id);
        const comments = Storage.getCommentsByWork(w.id);

        const inputs = buildFuzzyInputs(w);
        const res = Fuzzy.infer(inputs);
        const rec = Fuzzy.recommendation(inputs, res);
        const recClass =
            res.risk.term === "high"
                ? "bad"
                : res.risk.term === "med"
                  ? "warn"
                  : "ok";

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
              ${escapeHtml(WORK_TYPES[w.type] || "")} · создана ${fmtDate(w.createdAt)}
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
            <div class="num" style="color:var(--${res.risk.term === "high" ? "bad" : res.risk.term === "med" ? "warn" : "ok"})">
              ${res.risk.value.toFixed(0)}
            </div>
            <div class="lbl">Риск</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--${res.ready.term === "high" ? "ok" : res.ready.term === "med" ? "warn" : "bad"})">
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
        <div class="recommendation ${recClass}">${rec}</div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-title">Этапы работы</div>
          ${
              stages.length === 0
                  ? '<div class="empty">Этапов нет</div>'
                  : stages
                        .map(
                            (s) => `
            <div class="stage-item ${s.done ? "done" : ""}">
              <div class="stage-check ${s.done ? "on" : ""}" style="cursor:default;"></div>
              <div class="stage-body">
                <div class="stage-name">${escapeHtml(s.name)}</div>
                <div class="stage-meta">${s.deadline ? "до " + s.deadline : "—"} · вес ${s.weight || 1}</div>
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
              onclick="Teacher.openVersionCommentModal(${v.id})">
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
            <button class="btn-primary" onclick="Teacher.openReviewModal(${w.id})">
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
            <button class="btn-primary" onclick="Teacher.markAsDone(${w.id})">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Отметить защищённой</span>
            </button>
            <button class="btn-ghost" onclick="Teacher.returnFromApproved(${w.id})">
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

    /* ---------------------------------------------------------
       ПРОФИЛЬ СТУДЕНТА
       --------------------------------------------------------- */
    VIEWS["student-profile"] = function (params) {
        const studentId = params?.id;
        const s = Storage.getUserById(studentId);
        if (!s)
            return '<div class="card"><div class="empty">Студент не найден</div></div>';

        const u = getUser();
        const studentWorks = Storage.getWorks().filter((w) =>
            Storage.sameId(w.studentId, studentId),
        );
        const allowed = studentWorks.some((w) =>
            Storage.sameId(w.teacherId, u.id),
        );

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
            totalProgress += calcProgress(w.id);
            totalRating += Fuzzy.infer(buildFuzzyInputs(w)).rating.value;
            cnt++;
        });
        const avg = (x) => (cnt ? Math.round(x / cnt) : 0);

        const initials = s.fio
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

        return `
      <div class="back-link" onclick="App.navigate('students')">← К студентам</div>

      <div class="profile-hero">
        <div class="profile-hero-avatar">${initials}</div>
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
              onclick="App.navigate('student-detail', {id: ${s.id}, workId: ${activeWork.id}})">
              Полная карточка →
            </button>
          </div>
          <div style="font-size:15px;font-weight:500;margin-bottom:8px;">${escapeHtml(activeWork.topic)}</div>
          <div style="font-size:12px;color:var(--txt-muted);margin-bottom:12px;">
            ${escapeHtml(WORK_TYPES[activeWork.type] || "")} · ${statusBadge(activeWork.status)}
          </div>
          ${renderStagesMiniForTeacher(activeWork.id)}
        </div>
      `
              : ""
      }

      <div class="card mt-16">
        <div class="card-title">Все работы студента</div>
        ${studentWorks
            .map((w) => {
                const progress = calcProgress(w.id);
                const res = Fuzzy.infer(buildFuzzyInputs(w));
                return `
            <div class="mini-project"
              onclick="App.navigate('student-detail', {id: ${s.id}, workId: ${w.id}})">
              <div>
                <div class="mini-project-title">${escapeHtml(w.topic)}</div>
                <div class="mini-project-sub">
                  ${escapeHtml(WORK_TYPES[w.type] || "")} · ${statusBadge(w.status)}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:14px;font-weight:600;">${progress}%</div>
                <div style="font-size:11px;color:var(--txt-muted);">риск ${res.risk.value.toFixed(0)}</div>
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

        const works = Storage.getWorks().filter((w) =>
            Storage.sameId(w.studentId, s.id),
        );
        const w =
            works.find((w) => Storage.sameId(w.teacherId, u.id)) || works[0];
        if (!w) return;

        const inputs = buildFuzzyInputs(w);

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
                        inputs.orig,
                        inputs.gost,
                        inputs.supScore * 10,
                    ],
                    color: Charts.COLORS.purple,
                },
            ],
        );
    };

    function renderStagesMiniForTeacher(workId) {
        const stages = Storage.getStagesByWork(workId);
        if (stages.length === 0) return '<div class="empty">Этапов нет</div>';
        const done = stages.filter((s) => s.done).length;
        return `
      <div style="font-size:12px;color:var(--txt-muted);margin-bottom:8px;">
        Выполнено ${done} из ${stages.length}
      </div>
      ${stages
          .map(
              (s) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;border-bottom:1px solid var(--line);">
          <span style="color:var(--${s.done ? "ok" : "txt-soft"})">
            ${s.done ? SVG.check({ cls: "icon icon-xs" }) : "○"}
          </span>
          <span style="${s.done ? "text-decoration:line-through;opacity:.6;" : ""}">
            ${escapeHtml(s.name)}
          </span>
          <span style="margin-left:auto;color:var(--txt-muted);font-size:11px;">вес ${s.weight || 1}</span>
        </div>
      `,
          )
          .join("")}
    `;
    }

    function renderComment(c) {
        const author = Storage.getUserById(c.authorId);
        return `
      <div class="comment">
        <div class="comment-head">
          <span class="comment-author">${escapeHtml(author?.fio || "Неизвестный")}</span>
          <span>${fmtDateTime(c.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    `;
    }

    function openVersionCommentModal(versionId) {
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
            <button class="btn-primary" onclick="Teacher.saveVersionComment(${versionId})">Добавить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveVersionComment(versionId) {
        const text = document.getElementById("vc_text")?.value.trim();
        if (!text) {
            App.toast("Введите текст");
            return;
        }

        const version = Storage.getVersions().find((v) =>
            Storage.sameId(v.id, versionId),
        );
        if (!version) return;

        Storage.saveComment({
            id: uid(),
            workId: version.workId,
            versionId: version.id,
            authorId: getUser().id,
            text,
            createdAt: Date.now(),
            kind: "version",
        });

        const work = Storage.getWorkById(version.workId);
        if (work && typeof Notifications !== "undefined") {
            Notifications.add({
                userId: work.studentId,
                type: "comment",
                title: "Новое замечание к версии",
                text: text.slice(0, 100),
                link: { view: "my-work" },
            });
        }

        closeModal();
        App.toast("Замечание добавлено");
    }
    /* ---------------------------------------------------------
       ПРОВЕРКА РАБОТЫ
       --------------------------------------------------------- */
    VIEWS.review = function () {
        const students = getMyStudents();
        const inReview = students.filter(
            (x) =>
                x.work.status === "active" ||
                x.work.status === "review" ||
                x.work.status === "approved",
        );

        return `
      <div class="card">
        <div class="card-title">Работы на проверку (${inReview.length})</div>
        ${
            inReview.length === 0
                ? emptyState(
                      "Нет работ, ожидающих проверки",
                      "Работы появятся здесь, когда студенты начнут работу.",
                      SVG.fileText,
                  )
                : inReview
                      .map((x) => {
                          const progress = calcProgress(x.work.id);
                          const isApproved = x.work.status === "approved";
                          return `
            <div style="border:1px solid var(--line);border-radius:var(--r-md);padding:14px;margin-bottom:10px;background:var(--bg-elev);">
              <div class="student-row" style="border:none;padding:0;margin:0;cursor:pointer;"
                onclick="Teacher.openReviewModal(${x.work.id})">
                <div>
                  <div class="student-name">${escapeHtml(x.student.fio)}</div>
                  <div class="student-sub">${escapeHtml(x.work.topic)}</div>
                </div>
                <div class="progress-mini">
                  <div style="font-size:11px;color:var(--txt-muted);margin-bottom:3px;">${progress}%</div>
                  <div class="progress ${progress < 40 ? "low" : progress < 70 ? "med" : "high"}">
                    <div style="width:${progress}%"></div>
                  </div>
                </div>
                <div>${statusBadge(x.work.status)}</div>
                <div style="color:var(--txt-muted);font-size:18px;">›</div>
              </div>

              ${
                  isApproved
                      ? `
                <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
                  <button class="btn-primary btn-sm"
                    onclick="event.stopPropagation(); Teacher.markAsDone(${x.work.id})">
                    ${SVG.check({ cls: "icon icon-sm" })}
                    <span>Отметить защищённой</span>
                  </button>
                  <button class="btn-ghost btn-sm"
                    onclick="event.stopPropagation(); Teacher.returnFromApproved(${x.work.id})">
                    ${SVG.refresh({ cls: "icon icon-sm" })}
                    <span>Вернуть на доработку</span>
                  </button>
                </div>
              `
                      : ""
              }
            </div>
          `;
                      })
                      .join("")
        }
      </div>
    `;
    };

    /* =========================================================
       МОДАЛКА ПРОВЕРКИ РАБОТЫ
       ========================================================= */
    let reviewGostState = {};
    let reviewWorkId = null;

    function openReviewModal(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;

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
                <span>${item}</span>
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
                      ? `<button class="btn-ghost btn-sm" onclick="Teacher.markReview(${workId})">→ На проверке</button>`
                      : ""
              }
              ${
                  w.status === "review"
                      ? `<button class="btn-ghost btn-sm" onclick="Teacher.markActive(${workId})">← В работу</button>`
                      : ""
              }
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn-ghost" onclick="Teacher.closeModal()">Отмена</button>
              <button class="btn-primary" onclick="Teacher.saveReview(${workId})">Сохранить</button>
            </div>
          </div>

          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
            <button class="btn-primary" style="width:100%;" onclick="Teacher.approveFinal(${workId})">
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
        reviewGostState[i] = !reviewGostState[i];
        document.querySelectorAll("#gostList .gost-item").forEach((el) => {
            const idx = +el.dataset.idx;
            el.classList.toggle("on", !!reviewGostState[idx]);
        });
        recomputeReviewFuzzy();
    }

    function computeGostPct(checks) {
        if (!checks || typeof checks !== "object") return 0;
        const total = GOST_ITEMS.length;
        const done = GOST_ITEMS.filter((_, i) => checks[i]).length;
        return Math.round((done / total) * 100);
    }

    function recomputeReviewFuzzy() {
        const w = Storage.getWorkById(reviewWorkId);
        if (!w) return;

        const gostPct = computeGostPct(reviewGostState);
        const supScore = +(document.getElementById("rv_supScore")?.value || 5);
        const orig = +(document.getElementById("rv_orig")?.value || 65);

        const gl = document.getElementById("gostLabel");
        if (gl) gl.textContent = `Соответствие ГОСТу (${gostPct}%)`;

        const base = buildFuzzyInputs(w);
        const inputs = { ...base, supScore, orig, gost: gostPct };
        const res = Fuzzy.infer(inputs);

        const box = document.getElementById("reviewFuzzy");
        if (!box) return;

        box.innerHTML = `
      <div class="fuzzy-panel" style="grid-template-columns:1fr 1fr 1fr;">
        <div class="fuzzy-out">
          <div class="fuzzy-out-lbl">Риск</div>
          <div class="fuzzy-out-val" style="font-size:20px;color:var(--${res.risk.term === "high" ? "bad" : res.risk.term === "med" ? "warn" : "ok"})">
            ${res.risk.value.toFixed(0)}
          </div>
          <div class="fuzzy-out-term">${Fuzzy.termLabel(res.risk.term, "risk")}</div>
        </div>
        <div class="fuzzy-out">
          <div class="fuzzy-out-lbl">Готовность</div>
          <div class="fuzzy-out-val" style="font-size:20px;color:var(--${res.ready.term === "high" ? "ok" : res.ready.term === "med" ? "warn" : "bad"})">
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
      <div class="recommendation mt-8 ${res.risk.term === "high" ? "bad" : res.risk.term === "med" ? "warn" : "ok"}"
        style="font-size:12px;">
        ${Fuzzy.recommendation(inputs, res)}
      </div>
    `;
    }

    function updateFuzzyPreview() {
        recomputeReviewFuzzy();
    }

    function saveReview(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;

        w.supScore = +(document.getElementById("rv_supScore")?.value || 5);
        w.orig = +(document.getElementById("rv_orig")?.value || 65);
        w.gostChecks = { ...reviewGostState };
        w.gost = computeGostPct(reviewGostState);
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        const comment = document.getElementById("rv_comment")?.value.trim();
        if (comment) {
            Storage.saveComment({
                id: uid(),
                workId: w.id,
                authorId: getUser().id,
                text: comment,
                createdAt: Date.now(),
                kind: "review",
            });

            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: w.studentId,
                    type: "comment",
                    title: "Новое замечание руководителя",
                    text: comment.slice(0, 100),
                    link: { view: "my-work" },
                });
            }
        }

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Проверка сохранена",
                w.topic,
                `оценка: ${w.supScore}, ГОСТ: ${w.gost}%`,
                "info",
            );
        }

        closeModal();
        App.toast("Проверка сохранена");
        App.navigate("students");
    }

    function markReview(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;
        w.status = "review";
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "info",
                title: "Работа на проверке",
                text: `«${w.topic}» — руководитель проверяет`,
                link: { view: "my-work" },
            });
        }

        App.toast("Статус: На проверке");
        App.navigate("students");
    }

    function markActive(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;
        w.status = "active";
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "info",
                title: "Работа возвращена в работу",
                text: `«${w.topic}»`,
                link: { view: "my-work" },
            });
        }

        App.toast("Статус: В работе");
        App.navigate("students");
    }

    function approveFinal(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!confirm("Допустить работу к защите?")) return;

        w.status = "approved";
        w.approvedFinalAt = Date.now();
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "approve",
                title: "Работа допущена к защите",
                text: `«${w.topic}»`,
                link: { view: "my-work" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Работа допущена к защите", w.topic, "", "positive");
        }

        App.toast("Работа допущена к защите");
        App.navigate("students");
    }

    /* ---------------------------------------------------------
       РЕДАКТОР ПРАВИЛ
       --------------------------------------------------------- */
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
              onchange="Teacher.toggleRule(${r.id}, this.checked)">
            <div style="flex:1;">
              <div class="rule-if">ЕСЛИ ${r.if.join(" И ")}</div>
              <div class="rule-then">ТО ${r.then}</div>
              <input type="text" class="rule-desc" value="${escapeHtml(r.desc)}"
                onchange="Teacher.updateRuleDesc(${r.id}, this.value)">
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
            App.toast(enabled ? "Правило включено" : "Правило выключено");
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

    function resetRules() {
        if (!confirm("Сбросить все правила к значениям по умолчанию?")) return;
        Storage.setRules(null);
        App.toast("Правила сброшены");
        App.navigate("rules");
    }

    /* ---------------------------------------------------------
       ПРОФИЛЬ
       --------------------------------------------------------- */
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

    /* ---------------------------------------------------------
       СТАТИСТИКА
       --------------------------------------------------------- */
    VIEWS.stats = function () {
        const students = getMyStudents();
        const active = getMyActiveStudents();

        const withRisk = active.map((x) => ({
            ...x,
            progress: calcProgress(x.work.id),
            res: Fuzzy.infer(buildFuzzyInputs(x.work)),
        }));

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
          <div class="metric-val" style="color:var(--${avgRisk > 60 ? "bad" : avgRisk > 40 ? "warn" : "ok"})">${avgRisk}</div>
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
        const withData = active.map((x) => ({
            student: x.student,
            work: x.work,
            progress: calcProgress(x.work.id),
            res: Fuzzy.infer(buildFuzzyInputs(x.work)),
        }));

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

    /* ---------------------------------------------------------
       КАЛЕНДАРЬ ПРЕПОДАВАТЕЛЯ
       --------------------------------------------------------- */
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

    /* ---------------------------------------------------------
       ПРОВЕРКА ЗАДАЧ
       --------------------------------------------------------- */
    VIEWS["tasks-review"] = function () {
        const u = getUser();
        const myWorks = Storage.getWorksByTeacher(u.id);
        const myWorkIds = myWorks.map((w) => w.id);

        const allTasks = Storage.getTasks().filter(
            (t) =>
                myWorkIds.some((id) => Storage.sameId(id, t.workId)) &&
                t.col === "review",
        );

        const enriched = allTasks.map((t) => {
            const work = Storage.getWorkById(t.workId);
            const student = work ? Storage.getUserById(work.studentId) : null;
            return { t, work, student };
        });

        const done = Storage.getTasks()
            .filter(
                (t) =>
                    myWorkIds.some((id) => Storage.sameId(id, t.workId)) &&
                    t.col === "done" &&
                    t.reviewedBy,
            )
            .sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0))
            .slice(0, 10)
            .map((t) => {
                const work = Storage.getWorkById(t.workId);
                const student = work
                    ? Storage.getUserById(work.studentId)
                    : null;
                return { t, work, student };
            });

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">
            Задачи на проверке
            ${enriched.length > 0 ? `<span class="count-chip">${enriched.length}</span>` : ""}
          </div>
        </div>

        ${
            enriched.length === 0
                ? emptyState(
                      "Нет задач на проверке",
                      "Когда студент перетащит задачу в колонку «На проверке», она появится здесь.",
                      SVG.checkCircle,
                  )
                : enriched.map((e) => renderTaskReviewCard(e)).join("")
        }
      </div>

      ${
          done.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-title">Недавно проверенные</div>
          ${done.map((e) => renderTaskDoneRow(e)).join("")}
        </div>
      `
              : ""
      }
    `;
    };

    function renderTaskReviewCard({ t, work, student }) {
        return `
      <div class="consult-card" style="border-left:3px solid var(--warn);">
        <div class="consult-head">
          <div>
            <div style="font-weight:600;font-size:14px;">${escapeHtml(t.title)}</div>
            <div class="consult-topic">
              ${escapeHtml(student?.fio || "—")}
              ${student?.group ? " · " + escapeHtml(student.group) : ""}
              · «${escapeHtml((work?.topic || "").slice(0, 50))}${(work?.topic?.length || 0) > 50 ? "…" : ""}»
            </div>
          </div>
          <span class="consult-status pending">На проверке</span>
        </div>

        ${
            t.deadline
                ? `
          <div style="font-size:12px;color:var(--txt-muted);margin:6px 0;">
            Дедлайн задачи: <b>${t.deadline}</b>
            (${daysUntil(t.deadline) >= 0 ? "осталось " + daysUntil(t.deadline) + " дн." : "просрочено"})
          </div>
        `
                : ""
        }

        ${t.comment ? `<div class="consult-comment">${escapeHtml(t.comment)}</div>` : ""}

        <div class="consult-actions">
          <button class="btn-primary btn-sm" onclick="Teacher.taskApprove(${t.id})">
            ${SVG.check({ cls: "icon icon-sm" })}
            <span>Одобрить</span>
          </button>
          <button class="btn-ghost btn-sm" onclick="Teacher.taskReject(${t.id})">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Вернуть в работу</span>
          </button>
          <button class="btn-ghost btn-sm" onclick="Teacher.taskRejectWithComment(${t.id})">
            ${SVG.edit({ cls: "icon icon-sm" })}
            <span>С замечанием</span>
          </button>
        </div>
      </div>
    `;
    }

    function renderTaskDoneRow({ t, student }) {
        const reviewer = t.reviewedBy
            ? Storage.getUserById(t.reviewedBy)
            : null;
        return `
      <div class="rank-row" style="grid-template-columns: 1fr 140px 140px 100px;">
        <div>
          <div style="font-weight:500;">${escapeHtml(t.title)}</div>
          <div style="font-size:11px;color:var(--txt-muted);">${escapeHtml(student?.fio || "—")}</div>
        </div>
        <div style="font-size:11px;color:var(--txt-muted);">
          ${reviewer ? "проверил " + escapeHtml(reviewer.fio.split(" ")[0]) : ""}
        </div>
        <div style="font-size:11px;color:var(--txt-muted);">
          ${t.reviewedAt ? fmtDateTime(t.reviewedAt) : ""}
        </div>
        <div style="text-align:right;">
          <span class="badge approved" style="font-size:11px;">
            ${SVG.check({ cls: "icon icon-xs" })} Готово
          </span>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ДЕЙСТВИЯ С ЗАДАЧАМИ
       ========================================================= */
    function taskApprove(taskId) {
        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        t.col = "done";
        t.reviewedBy = getUser().id;
        t.reviewedAt = Date.now();
        t.reviewStatus = "approved";
        Storage.setTasks(tasks);

        const work = Storage.getWorkById(t.workId);
        if (work) {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "approve",
                    title: "Задача одобрена",
                    text: `«${t.title}» — проверено руководителем`,
                    link: { view: "my-work" },
                });
            }
            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Задача одобрена",
                    t.title,
                    `студент: ${Storage.getUserById(work.studentId)?.fio || ""}`,
                    "positive",
                );
            }
        }

        App.toast("Задача одобрена");
        App.navigate("tasks-review");
    }

    function taskReject(taskId) {
        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        t.col = "progress";
        t.reviewedBy = getUser().id;
        t.reviewedAt = Date.now();
        t.reviewStatus = "rejected";
        Storage.setTasks(tasks);

        const work = Storage.getWorkById(t.workId);
        if (work) {
            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "reject",
                    title: "Задача возвращена в работу",
                    text: `«${t.title}» — нужны доработки`,
                    link: { view: "my-work" },
                });
            }
            if (typeof Audit !== "undefined") {
                Audit.log("Задача возвращена", t.title, "", "negative");
            }
        }

        App.toast("Задача возвращена в работу");
        App.navigate("tasks-review");
    }

    function taskRejectWithComment(taskId) {
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
            <button class="btn-primary" onclick="Teacher.saveTaskReject(${taskId})">Отправить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveTaskReject(taskId) {
        const comment = document.getElementById("task_comment")?.value.trim();
        if (!comment) {
            App.toast("Введите замечание");
            return;
        }

        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, taskId));
        if (!t) return;

        t.col = "progress";
        t.reviewedBy = getUser().id;
        t.reviewedAt = Date.now();
        t.reviewStatus = "rejected";
        t.reviewComment = comment;
        Storage.setTasks(tasks);

        const work = Storage.getWorkById(t.workId);
        if (work) {
            Storage.saveComment({
                id: uid(),
                workId: work.id,
                authorId: getUser().id,
                text: `Замечание к задаче «${t.title}»: ${comment}`,
                createdAt: Date.now(),
                kind: "task-review",
            });

            if (typeof Notifications !== "undefined") {
                Notifications.add({
                    userId: work.studentId,
                    type: "comment",
                    title: "Замечание к задаче",
                    text: `«${t.title}»: ${comment.slice(0, 80)}`,
                    link: { view: "my-work" },
                });
            }

            if (typeof Audit !== "undefined") {
                Audit.log(
                    "Задача возвращена с замечанием",
                    t.title,
                    comment,
                    "warning",
                );
            }
        }

        App.closeModal();
        App.toast("Замечание отправлено");
        App.navigate("tasks-review");
    }

    /* =========================================================
       ФИНАЛЬНАЯ ОЦЕНКА ЗА ЗАЩИТУ
       ========================================================= */
    let pickedGrade = 5;

    function markAsDone(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;

        const student = Storage.getUserById(w.studentId);

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
            <button class="btn-primary" onclick="Teacher.saveFinalGrade(${workId})">
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
        pickedGrade = g;
        document.querySelectorAll(".grade-btn").forEach((btn) => {
            const active = +btn.dataset.grade === g;
            btn.style.borderColor = active ? "var(--accent)" : "var(--line)";
            btn.style.background = active
                ? "var(--accent-soft)"
                : "var(--bg-elev)";
            btn.style.color = active ? "var(--accent)" : "var(--txt)";
        });
    }

    function saveFinalGrade(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;

        const comment =
            document.getElementById("grade_comment")?.value.trim() || "";
        const date = document.getElementById("grade_date")?.value;

        w.status = "done";
        w.finalGrade = pickedGrade;
        w.gradeComment = comment;
        w.defendedAt = date ? new Date(date).getTime() : Date.now();
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "approve",
                title: "Работа защищена",
                text: `«${w.topic}» — оценка ${pickedGrade}. ${comment}`,
                link: { view: "archived" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Работа защищена",
                w.topic,
                `оценка: ${pickedGrade}`,
                "positive",
            );
        }

        pickedGrade = 5;
        closeModal();
        App.toast(`Работа защищена с оценкой ${w.finalGrade}`);
        App.navigate("students");
    }

    function returnFromApproved(workId) {
        const w = Storage.getWorkById(workId);
        if (!w) return;
        if (!confirm("Вернуть работу в статус «На проверке»?")) return;

        w.status = "review";
        w.updatedAt = Date.now();
        Storage.saveWork(w);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: w.studentId,
                type: "info",
                title: "Работа возвращена на доработку",
                text: `«${w.topic}» требует доработки`,
                link: { view: "my-work" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Работа возвращена", w.topic, "", "warning");
        }

        App.toast("Работа возвращена в проверку");
        App.navigate("students");
    }

    /* ---------------------------------------------------------
       ОБЁРТКИ МОДУЛЕЙ
       --------------------------------------------------------- */
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

    /* ---------------------------------------------------------
       ЗАКРЫТИЕ МОДАЛОК
       --------------------------------------------------------- */
    function closeModal() {
        App.closeModal();
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        VIEWS,

        /* Заявки */
        approveWork,
        openRejectModal,
        rejectWork,

        /* Замечания */
        openVersionCommentModal,
        saveVersionComment,

        /* Проверка работы */
        openReviewModal,
        toggleGost2,
        updateFuzzyPreview,
        saveReview,
        markReview,
        markActive,
        approveFinal,

        /* Задачи */
        taskApprove,
        taskReject,
        taskRejectWithComment,
        saveTaskReject,

        /* Финал */
        markAsDone,
        pickGrade,
        saveFinalGrade,
        returnFromApproved,

        /* Правила */
        toggleRule,
        updateRuleDesc,
        resetRules,

        /* Модалки */
        closeModal,
    };
})();
