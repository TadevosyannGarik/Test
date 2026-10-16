const Student = (() => {
    const WORK_TYPES = Utils.WORK_TYPES_LIST;
    const WORK_STATUSES = Utils.WORK_STATUSES;
    const TASK_COLS = Utils.TASK_COLS;

    const escapeHtml = Utils.escapeHtml;
    const workTypeLabel = Utils.workTypeLabel;
    const statusBadge = Utils.statusBadge;
    const calcProgress = Utils.calcProgress;
    const emptyState = Utils.emptyState;
    const renderComment = Utils.renderComment;

    function getUser() {
        return Auth.getUser();
    }

    function getMyWorks() {
        const u = getUser();
        return u ? Storage.getWorksByStudent(u.id) : [];
    }

    function teacherName(id) {
        const u = Storage.getUserById(id);
        return u ? u.fio : "—";
    }

    let selectedWorkId = null;

    function getActiveWork() {
        const u = getUser();
        if (!u) return null;
        return Utils.getActiveWorkForStudent(u.id, selectedWorkId);
    }

    function getArchivedWorks() {
        const u = getUser();
        if (!u) return [];
        return Utils.getArchivedWorksForStudent(u.id);
    }

    function selectWork(id) {
        selectedWorkId = id;
        App.navigate("my-work");
    }

    function clearSelectedWork() {
        selectedWorkId = null;
    }

    function getFuzzyInputs(work, progressOverride) {
        return Utils.buildFuzzyInputs(work, progressOverride);
    }

    function getFuzzyResult(work, progressOverride) {
        return Utils.safeFuzzyInfer(
            Utils.buildFuzzyInputs(work, progressOverride),
        );
    }

    const VIEWS = {};

    /* =========================================================
       ДАШБОРД — KPI, дедлайны, задачи, комментарии, работы
       ========================================================= */
    VIEWS.dashboard = function () {
        const u = getUser();
        if (!u) return "";

        const activeWorks = getMyWorks().filter((w) =>
            Utils.isActiveStatus(w.status),
        );

        if (activeWorks.length === 0) {
            const archived = getArchivedWorks();
            return `
        <div class="card">
          ${emptyState(
              "У вас нет активной работы",
              archived.length > 0
                  ? "Все ваши работы завершены. Создайте новую, чтобы начать."
                  : "Создайте свою первую курсовую или дипломную работу, выберите руководителя — и можно начинать.",
              SVG.folder,
              `<button class="btn-primary" onclick="App.navigate('create-work')">
                 ${SVG.plus({ cls: "icon icon-sm" })}
                 <span>Создать работу</span>
               </button>`,
          )}
        </div>
      `;
        }

        const kpi = calcStudentKpi(activeWorks);
        const upcoming = getStudentUpcomingDeadlines(activeWorks, 6);
        const tasksInProgress = getStudentTasksInProgress(activeWorks);
        const recentComments = getRecentTeacherComments(activeWorks, 4);

        return `
      ${renderStudentKpi(kpi, u)}
      ${upcoming.length > 0 ? renderStudentUpcoming(upcoming) : ""}
      ${tasksInProgress.length > 0 ? renderStudentTasks(tasksInProgress) : ""}
      ${renderStudentWorksList(activeWorks)}
      ${recentComments.length > 0 ? renderStudentComments(recentComments) : ""}
      ${renderStudentQuickActions()}
    `;
    };

    function calcStudentKpi(works) {
        let totalProgress = 0;
        let totalRisk = 0;
        let cnt = 0;

        works.forEach((w) => {
            const progress = calcProgress(w.id);
            const res = getFuzzyResult(w, progress);
            totalProgress += progress;
            if (res) {
                totalRisk += res.risk.value;
                cnt++;
            }
        });

        const avgProgress = works.length
            ? Math.round(totalProgress / works.length)
            : 0;
        const avgRisk = cnt ? Math.round(totalRisk / cnt) : 0;

        let tasksInProgress = 0;
        works.forEach((w) => {
            const tasks = Storage.getTasksByWork(w.id);
            tasksInProgress += tasks.filter(
                (t) => t.col === "progress" || t.col === "review",
            ).length;
        });

        let nearestDeadline = null;
        let minDays = Infinity;
        works.forEach((w) => {
            if (w.deadline) {
                const days = daysUntil(w.deadline);
                if (days < minDays && days >= -365) {
                    minDays = days;
                    nearestDeadline = { days, date: w.deadline, work: w };
                }
            }
        });

        return {
            avgProgress,
            avgRisk,
            tasksInProgress,
            nearestDeadline,
            worksCount: works.length,
        };
    }

    function renderStudentKpi(kpi, u) {
        const progressColor = Utils.progressClass(kpi.avgProgress);
        const riskColor = Utils.riskClass(Fuzzy.classify(kpi.avgRisk));

        const deadlineLabel = kpi.nearestDeadline
            ? kpi.nearestDeadline.days >= 0
                ? kpi.nearestDeadline.days === 0
                    ? "сегодня"
                    : `${kpi.nearestDeadline.days} дн.`
                : "просрочен"
            : "—";

        const deadlineColor = kpi.nearestDeadline
            ? kpi.nearestDeadline.days < 0
                ? "bad"
                : kpi.nearestDeadline.days <= 7
                  ? "warn"
                  : "txt"
            : "txt-muted";

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--${progressColor})">
            ${kpi.avgProgress}%
          </div>
          <div class="kpi-lbl">Ср. прогресс</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--${riskColor})">
            ${kpi.avgRisk}
          </div>
          <div class="kpi-lbl">Ср. риск</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--accent-viz)">
            ${kpi.tasksInProgress}
          </div>
          <div class="kpi-lbl">Задач в работе</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--${deadlineColor})">
            ${deadlineLabel}
          </div>
          <div class="kpi-lbl">До защиты</div>
        </div>
      </div>
    `;
    }
    function renderStagesProgressBar(workId) {
        const stages = Storage.getStagesByWork(workId);
        if (stages.length === 0) return "";

        const doneCount = stages.filter((s) => s.done).length;
        const total = stages.length;
        const pct = Math.round((doneCount / total) * 100);

        // Сегменты
        const segments = stages
            .map((s) => {
                const cls = s.done
                    ? "stage-seg-done"
                    : s.deadline && daysUntil(s.deadline) < 0
                      ? "stage-seg-overdue"
                      : "stage-seg-todo";
                const title = `${s.name}${s.done ? " — выполнено" : ""}`;
                return `<div class="stage-seg ${cls}" title="${escapeHtml(title)}"></div>`;
            })
            .join("");

        return `
      <div class="stages-bar">
        <div class="stages-bar-head">
          <span class="stages-bar-label">Этапы работы</span>
          <span class="stages-bar-count">
            ${doneCount}/${total} · ${pct}%
          </span>
        </div>
        <div class="stages-bar-track">
          ${segments}
        </div>
      </div>
    `;
    }

    function getStudentUpcomingDeadlines(works, limit = 6) {
        const events = [];

        works.forEach((w) => {
            const stages = Storage.getStagesByWork(w.id);
            stages
                .filter((s) => s.deadline && !s.done)
                .forEach((s) => {
                    const days = daysUntil(s.deadline);
                    if (days >= -30 && days <= 90) {
                        events.push({
                            date: s.deadline,
                            days,
                            title: s.name,
                            kind: "stage",
                            work: w,
                            workTopic: w.topic,
                        });
                    }
                });

            const tasks = Storage.getTasksByWork(w.id);
            tasks
                .filter((t) => t.deadline && t.col !== "done")
                .forEach((t) => {
                    const days = daysUntil(t.deadline);
                    if (days >= -30 && days <= 90) {
                        events.push({
                            date: t.deadline,
                            days,
                            title: t.title,
                            kind: "task",
                            work: w,
                            workTopic: w.topic,
                        });
                    }
                });

            if (w.deadline) {
                const days = daysUntil(w.deadline);
                if (days >= -30 && days <= 365) {
                    events.push({
                        date: w.deadline,
                        days,
                        title: "Защита работы",
                        kind: "defense",
                        work: w,
                        workTopic: w.topic,
                    });
                }
            }
        });

        return events
            .filter((e) => e.days >= 0)
            .sort((a, b) => a.days - b.days)
            .slice(0, limit);
    }

    function renderStudentUpcoming(events) {
        return `
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.clock({ cls: "icon icon-sm" })}
            Ближайшие дедлайны
          </div>
          <span class="count-chip">${events.length}</span>
        </div>
        ${events.map((e) => renderStudentDeadlineRow(e)).join("")}
      </div>
    `;
    }

    function renderStudentDeadlineRow(e) {
        const cls = e.days <= 3 ? "bad" : e.days <= 7 ? "warn" : "";
        const label =
            e.days === 0
                ? "сегодня"
                : e.days === 1
                  ? "завтра"
                  : `через ${e.days} дн.`;

        const iconFn =
            e.kind === "defense"
                ? SVG.award
                : e.kind === "task"
                  ? SVG.check
                  : SVG.clock;

        return `
      <div class="mini-project" onclick="Student.selectWork('${e.work.id}')">
        <div style="flex:1;min-width:0;">
          <div class="mini-project-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${iconFn({ cls: "icon icon-xs" })}
            ${escapeHtml(e.title)}
          </div>
          <div class="mini-project-sub">
            ${escapeHtml(e.workTopic.slice(0, 50))}${e.workTopic.length > 50 ? "…" : ""}
            · ${fmtDate(e.date)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;font-weight:600;color:var(--${cls || "txt-muted"});">
            ${label}
          </div>
        </div>
      </div>
    `;
    }

    function getStudentTasksInProgress(works) {
        const tasks = [];
        works.forEach((w) => {
            const list = Storage.getTasksByWork(w.id);
            list.filter(
                (t) => t.col === "progress" || t.col === "review",
            ).forEach((t) => {
                tasks.push({
                    ...t,
                    work: w,
                    workTopic: w.topic,
                });
            });
        });
        return tasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function renderStudentTasks(tasks) {
        return `
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.check({ cls: "icon icon-sm" })}
            Задачи в работе
          </div>
          <span class="count-chip">${tasks.length}</span>
        </div>
        ${tasks
            .slice(0, 6)
            .map((t) => renderStudentTaskRow(t))
            .join("")}
      </div>
    `;
    }

    function renderStudentTaskRow(t) {
        const isReview = t.col === "review";
        const badgeLabel = isReview ? "На проверке" : "В работе";
        const badgeCls = isReview ? "review" : "active";

        const deadlineDays = t.deadline ? daysUntil(t.deadline) : null;
        const deadlineHtml =
            t.deadline && deadlineDays !== null
                ? `<span style="color:var(--${
                      deadlineDays < 0
                          ? "bad"
                          : deadlineDays <= 3
                            ? "warn"
                            : "txt-muted"
                  });">
                      до ${escapeHtml(t.deadline)}
                      ${deadlineDays >= 0 ? " · " + deadlineDays + " дн." : " · просрочено"}
                   </span>`
                : "";

        return `
      <div class="mini-project" onclick="Student.selectWork('${t.work.id}')">
        <div style="flex:1;min-width:0;">
          <div class="mini-project-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(t.title)}
          </div>
          <div class="mini-project-sub">
            ${escapeHtml(t.workTopic.slice(0, 50))}${t.workTopic.length > 50 ? "…" : ""}
            ${deadlineHtml ? " · " + deadlineHtml : ""}
          </div>
        </div>
        <div style="flex-shrink:0;">
          <span class="badge ${badgeCls}">${badgeLabel}</span>
        </div>
      </div>
    `;
    }

    function renderStudentWorksList(works) {
        return `
      <div class="mt-16" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div class="card-title" style="margin-bottom:0;">
          Мои работы <span class="count-chip">${works.length}</span>
        </div>
        <button class="btn-ghost btn-sm" onclick="App.navigate('create-work')">
          ${SVG.plus({ cls: "icon icon-sm" })}
          <span>Создать</span>
        </button>
      </div>
      ${works.map((w) => renderWorkCard(w)).join("")}
    `;
    }

    function getRecentTeacherComments(works, limit = 4) {
        const comments = [];
        works.forEach((w) => {
            const list = Storage.getCommentsByWork(w.id);
            list.forEach((c) => {
                comments.push({ ...c, work: w, workTopic: w.topic });
            });
        });
        return comments
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, limit);
    }

    function renderStudentComments(comments) {
        return `
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.messageCircle({ cls: "icon icon-sm" })}
            Последние замечания
          </div>
          <span class="count-chip">${comments.length}</span>
        </div>
        ${comments.map((c) => renderStudentCommentRow(c)).join("")}
      </div>
    `;
    }

    function renderStudentCommentRow(c) {
        const author = Storage.getUserById(c.authorId);
        return `
      <div class="mini-project" onclick="Student.selectWork('${c.work.id}')">
        <div style="flex:1;min-width:0;">
          <div class="mini-project-sub" style="margin-bottom:2px;">
            <b style="color:var(--txt);">${escapeHtml(author?.fio || "—")}</b>
            · ${fmtDateTime(c.createdAt)}
          </div>
          <div style="font-size:12px;color:var(--txt);line-height:1.4;">
            ${escapeHtml((c.text || "").slice(0, 120))}${(c.text || "").length > 120 ? "…" : ""}
          </div>
          <div class="mini-project-sub" style="margin-top:2px;">
            ${escapeHtml(c.workTopic.slice(0, 50))}${c.workTopic.length > 50 ? "…" : ""}
          </div>
        </div>
      </div>
    `;
    }

    function renderStudentQuickActions() {
        return `
      <div class="card mt-16">
        <div class="card-title">Быстрые действия</div>
        <div class="quick-actions">
          <div class="quick-action" onclick="App.navigate('my-work')">
            <div class="qa-ico">${SVG.folder({ cls: "icon" })}</div>
            <div class="qa-lbl">Моя работа</div>
            <div class="qa-desc">Этапы, задачи, версии</div>
          </div>
          <div class="quick-action" onclick="App.navigate('mamdani')">
            <div class="qa-ico">${SVG.brain({ cls: "icon" })}</div>
            <div class="qa-lbl">Мамдани</div>
            <div class="qa-desc">Разбор оценки</div>
          </div>
          <div class="quick-action" onclick="App.navigate('simulate')">
            <div class="qa-ico">${SVG.sliders({ cls: "icon" })}</div>
            <div class="qa-lbl">Симулятор</div>
            <div class="qa-desc">Что если…</div>
          </div>
          <div class="quick-action" onclick="App.navigate('docx')">
            <div class="qa-ico">${SVG.fileText({ cls: "icon" })}</div>
            <div class="qa-lbl">Проверка ГОСТа</div>
            <div class="qa-desc">Загрузить .docx</div>
          </div>
          <div class="quick-action" onclick="App.navigate('consultations')">
            <div class="qa-ico">${SVG.calendar({ cls: "icon" })}</div>
            <div class="qa-lbl">Консультации</div>
            <div class="qa-desc">Запись к руководителю</div>
          </div>
          <div class="quick-action" onclick="App.navigate('stats')">
            <div class="qa-ico">${SVG.trending({ cls: "icon" })}</div>
            <div class="qa-lbl">Статистика</div>
            <div class="qa-desc">Графики и метрики</div>
          </div>
        </div>
      </div>
    `;
    }

    function renderWorkCard(work) {
        const progress = calcProgress(work.id);
        const res = getFuzzyResult(work, progress);
        const daysLeft = work.deadline ? daysUntil(work.deadline) : null;
        const isSelected = Storage.sameId(work.id, selectedWorkId);

        const riskCls = Utils.riskClass(res.risk.term);
        const readyCls = Utils.readyClass(res.ready.term);

        return `
      <div class="work-hero"
        style="cursor:pointer;${isSelected ? "border-color:var(--accent);" : ""}"
        onclick="Student.selectWork('${work.id}')">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--txt-muted);margin-bottom:6px;">
              ${escapeHtml(workTypeLabel(work.type))}
              ${isSelected ? ' · <span style="color:var(--accent);">ВЫБРАНА</span>' : ""}
            </div>
            <div class="work-hero-title">${escapeHtml(work.topic)}</div>
            <div class="work-hero-meta">
              <span>Руководитель: <b>${escapeHtml(teacherName(work.teacherId))}</b></span>
              ${
                  daysLeft !== null
                      ? `<span>До дедлайна: <b>${daysLeft >= 0 ? daysLeft + " дн." : "просрочено"}</b></span>`
                      : ""
              }
              <span>${statusBadge(work.status)}</span>
            </div>
          </div>
          <button class="btn-ghost btn-sm" onclick="event.stopPropagation(); Student.selectWork('${work.id}')">
            Открыть →
          </button>
        </div>

        <div class="pbar" style="margin-top:16px;">
          <div class="pbar-track">
            <div class="pbar-fill ${Utils.progressClass(progress)}" style="width:${progress}%"></div>
          </div>
          <div class="pbar-val">${progress}%</div>
        </div>

        ${renderStagesProgressBar(work.id)}

        <div class="fuzzy-panel" style="margin-top:14px;">
          <div class="fuzzy-out">
            <div class="fuzzy-out-lbl">Риск</div>
            <div class="fuzzy-out-val" style="color:var(--${riskCls})">
              ${res.risk.value.toFixed(0)}
            </div>
            <div class="fuzzy-out-term">${Fuzzy.termLabel(res.risk.term, "risk")}</div>
          </div>
          <div class="fuzzy-out">
            <div class="fuzzy-out-lbl">Готовность</div>
            <div class="fuzzy-out-val" style="color:var(--${readyCls})">
              ${res.ready.value.toFixed(0)}
            </div>
            <div class="fuzzy-out-term">${Fuzzy.termLabel(res.ready.term, "ready")}</div>
          </div>
          <div class="fuzzy-out">
            <div class="fuzzy-out-lbl">Рейтинг</div>
            <div class="fuzzy-out-val" style="color:var(--accent)">
              ${res.rating.value.toFixed(0)}
            </div>
            <div class="fuzzy-out-term">${Fuzzy.termLabel(res.rating.term, "rating")}</div>
          </div>
        </div>

        ${
            !res.hasAnyTeacherCheck
                ? `
          <div class="notice" style="margin-top:12px;font-size:11px;background:var(--warn-soft);border-left:2px solid var(--warn);">
            ${SVG.info({ cls: "icon icon-xs" })}
            Оценка предварительная — руководитель ещё не проверял работу.
          </div>
        `
                : ""
        }
      </div>
    `;
    }

    let draftWorkType = "course";
    let draftTeacherId = null;

    VIEWS["create-work"] = function () {
        const teachers = Storage.getTeachers();

        return `
      <div class="card">
        <div class="card-title">Создание работы</div>

        <div class="section-label">Тип работы</div>
        <div class="work-type-picker" id="typePicker">
          ${WORK_TYPES.map(
              (t) => `
            <button type="button" data-type="${t.id}"
              class="${draftWorkType === t.id ? "selected" : ""}"
              onclick="Student.pickType('${t.id}')">
              <div class="wt-title">${escapeHtml(t.title)}</div>
              <div class="wt-desc">${escapeHtml(t.desc)}</div>
            </button>
          `,
          ).join("")}
        </div>

        <div class="section-label">Тема и описание</div>
        <div class="form-grid">
          <div class="field full">
            <label>Тема работы <span class="req">*</span></label>
            <input type="text" id="w_topic"
              placeholder="Например: Информационная система управления проектами на основе нечёткой логики">
            <div class="field-err">Укажите тему (минимум 10 символов)</div>
          </div>
          <div class="field full">
            <label>Аннотация</label>
            <textarea id="w_annotation" rows="3"
              placeholder="Краткое описание работы (2–4 предложения)"></textarea>
          </div>
          <div class="field full">
            <label>Ключевые слова</label>
            <input type="text" id="w_keywords" placeholder="нечёткая логика, Мамдани, управление проектами">
          </div>
          <div class="field">
            <label>Цель работы</label>
            <input type="text" id="w_goal" placeholder="Разработать ИС...">
          </div>
          <div class="field">
            <label>Планируемая дата защиты</label>
            <input type="date" id="w_deadline">
          </div>
          <div class="field full">
            <label>Задачи (по одной на строку)</label>
            <textarea id="w_tasks" rows="3"
              placeholder="Изучить предметную область&#10;Спроектировать архитектуру&#10;Реализовать прототип"></textarea>
          </div>
        </div>

        <div class="section-label">Выбор руководителя</div>
        ${
            teachers.length === 0
                ? `<div class="empty">В системе нет преподавателей. Обратитесь к администратору.</div>`
                : `
          <div class="filters">
            <input type="text" id="teacherSearch"
              placeholder="Поиск по ФИО или кафедре..."
              oninput="Student.filterTeachers()">
          </div>
          <div class="teacher-pick" id="teacherList">
            ${teachers.map((t) => renderTeacherOption(t)).join("")}
          </div>
        `
        }

        <div class="mt-24" style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn-ghost" onclick="App.navigate('dashboard')">Отмена</button>
          <button class="btn-primary" onclick="Student.saveDraft()">
            ${SVG.check({ cls: "icon icon-sm" })}
            <span>Создать работу</span>
          </button>
        </div>
      </div>
    `;
    };

    function renderTeacherOption(t) {
        const load = Storage.getWorksByTeacher(t.id).filter((w) =>
            Utils.isActiveStatus(w.status),
        ).length;
        const maxLoad = t.maxLoad || 8;
        const full = load >= maxLoad;
        const selected = Storage.sameId(draftTeacherId, t.id);

        return `
      <div class="teacher-item ${selected ? "selected" : ""} ${full ? "full" : ""}"
           data-id="${t.id}"
           data-name="${escapeHtml((t.fio || "").toLowerCase())}"
           data-dept="${escapeHtml((t.department || "").toLowerCase())}"
           onclick="Student.pickTeacher('${t.id}')">
        <div>
          <span class="teacher-name">${escapeHtml(t.fio)}</span>
          <span class="teacher-load ${full ? "full" : ""}">${load}/${maxLoad}</span>
          ${full ? '<span style="font-size:10px;color:var(--bad);margin-left:6px;">перегружен</span>' : ""}
        </div>
        <div class="teacher-meta">
          ${escapeHtml(t.position || "")} · ${escapeHtml(t.department || "")}
          ${t.interests ? " · " + escapeHtml(t.interests) : ""}
        </div>
      </div>
    `;
    }

    function pickType(type) {
        if (!Utils.WORK_TYPES[type]) return;
        draftWorkType = type;
        document.querySelectorAll("#typePicker button").forEach((b) => {
            b.classList.toggle("selected", b.dataset.type === type);
        });
    }

    function pickTeacher(id) {
        draftTeacherId = id;
        document
            .querySelectorAll("#teacherList .teacher-item")
            .forEach((el) => {
                el.classList.toggle(
                    "selected",
                    Storage.sameId(el.dataset.id, id),
                );
            });
    }

    function filterTeachers() {
        const q =
            document
                .getElementById("teacherSearch")
                ?.value.trim()
                .toLowerCase() || "";
        document
            .querySelectorAll("#teacherList .teacher-item")
            .forEach((el) => {
                const match =
                    !q ||
                    el.dataset.name.includes(q) ||
                    el.dataset.dept.includes(q);
                el.style.display = match ? "" : "none";
            });
    }

    function saveDraft() {
        const topic = document.getElementById("w_topic")?.value.trim() || "";
        if (topic.length < 10) {
            document
                .getElementById("w_topic")
                ?.closest(".field")
                ?.classList.add("invalid");
            return;
        }
        if (!draftTeacherId) {
            App.toast("Выберите руководителя");
            return;
        }

        const u = getUser();
        if (!u) return;

        const work = {
            id: uid(),
            studentId: u.id,
            teacherId: draftTeacherId,
            type: draftWorkType,
            topic,
            annotation:
                document.getElementById("w_annotation")?.value.trim() || "",
            keywords: document.getElementById("w_keywords")?.value.trim() || "",
            goal: document.getElementById("w_goal")?.value.trim() || "",
            tasksText: document.getElementById("w_tasks")?.value.trim() || "",
            deadline: document.getElementById("w_deadline")?.value || null,
            status: "pending",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        Storage.saveWork(work);
        selectedWorkId = work.id;

        if (typeof Notifications !== "undefined" && draftTeacherId) {
            Notifications.add({
                userId: draftTeacherId,
                type: "work",
                title: "Новая заявка на руководство",
                text: `Студент ${u.fio} — «${topic.slice(0, 60)}»`,
                link: { view: "requests" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Создана работа", topic.slice(0, 60), "", "positive");
        }

        draftWorkType = "course";
        draftTeacherId = null;

        App.toast("Работа создана и отправлена руководителю");
        App.navigate("my-work");
    }

    VIEWS["my-work"] = function () {
        const work = getActiveWork();

        if (!work) {
            return `
        <div class="card">
          ${emptyState(
              "У вас нет активной работы",
              "Все ваши работы завершены или ещё не созданы. Создайте новую, чтобы начать.",
              SVG.folder,
              `<button class="btn-primary" onclick="App.navigate('create-work')">
                 ${SVG.plus({ cls: "icon icon-sm" })}
                 <span>Создать работу</span>
               </button>`,
          )}
        </div>
      `;
        }

        const allActive = getMyWorks().filter((w) =>
            Utils.isActiveStatus(w.status),
        );

        const workSelector =
            allActive.length > 1
                ? `
      <div class="card" style="margin-bottom:12px;">
        <div style="font-size:12px;color:var(--txt-muted);margin-bottom:8px;">
          Активные работы (${allActive.length}) — выберите:
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${allActive
              .map(
                  (w) => `
            <button class="btn-ghost btn-sm"
              style="${Storage.sameId(w.id, work.id) ? "border-color:var(--accent);color:var(--accent);background:var(--accent-soft);" : ""}"
              onclick="Student.selectWork('${w.id}')">
              ${escapeHtml(workTypeLabel(w.type))}: ${escapeHtml(w.topic.slice(0, 40))}${w.topic.length > 40 ? "…" : ""}
            </button>
          `,
              )
              .join("")}
        </div>
      </div>
    `
                : "";

        const progress = calcProgress(work.id);
        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const versions = Storage.getVersionsByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);
        const canEdit = work.status === "draft" || work.status === "pending";

        const stagesDone = stages.filter((s) => s.done).length;
        const tasksDone = tasks.filter((t) => t.col === "done").length;

        const upcoming = getWorkUpcomingDeadlines(work, 6);

        return `
      ${workSelector}

      <!-- Сводка -->
      ${renderWorkSummary(work, {
          progress,
          stages,
          stagesDone,
          tasks,
          tasksDone,
          versions,
          comments,
      })}

      <!-- Информация о работе (компактно) -->
      <div class="card mt-12">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">Информация</div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${statusBadge(work.status)}
            ${
                canEdit
                    ? `<button class="btn-ghost btn-sm" onclick="Student.toggleEditForm()">
                         ${SVG.edit({ cls: "icon icon-sm" })}
                         <span>Редактировать</span>
                       </button>`
                    : ""
            }
          </div>
        </div>

        <div id="workInfoForm" style="display:none;">
          <div class="form-grid">
            <div class="field full">
              <label>Тема</label>
              <input type="text" value="${escapeHtml(work.topic)}"
                onchange="Student.updateWork('topic', this.value)">
            </div>
            <div class="field full">
              <label>Аннотация</label>
              <textarea rows="3"
                onchange="Student.updateWork('annotation', this.value)">${escapeHtml(work.annotation || "")}</textarea>
            </div>
            <div class="field">
              <label>Цель</label>
              <input type="text" value="${escapeHtml(work.goal || "")}"
                onchange="Student.updateWork('goal', this.value)">
            </div>
            <div class="field">
              <label>Дата защиты</label>
              <input type="date" value="${work.deadline || ""}"
                onchange="Student.updateWork('deadline', this.value)">
            </div>
          </div>
        </div>

        <div id="workInfoPreview" style="font-size:13px;line-height:1.6;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="tag">${escapeHtml(workTypeLabel(work.type))}</span>
            <span class="tag">Руководитель: ${escapeHtml(teacherName(work.teacherId))}</span>
            ${work.deadline ? `<span class="tag">Защита: ${escapeHtml(work.deadline)}</span>` : ""}
          </div>
          ${work.annotation ? `<div style="color:var(--txt-muted);">${escapeHtml(work.annotation)}</div>` : ""}
          ${work.goal ? `<div style="margin-top:6px;"><b>Цель:</b> ${escapeHtml(work.goal)}</div>` : ""}
        </div>

        ${
            work.status === "pending"
                ? `<div style="margin-top:12px;">
                     <button class="btn-ghost btn-sm" onclick="Student.withdrawWork()">Отозвать заявку</button>
                   </div>`
                : ""
        }
      </div>

      <!-- Основная сетка: этапы + дедлайны -->
      <div class="work-grid mt-12">
        <!-- Этапы -->
        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              Этапы <span class="count-chip">${stages.length}</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${
                  stages.length > 0 && stagesDone < stages.length
                      ? `<button class="btn-ghost btn-sm" onclick="Student.markAllStagesDone()">
                           ${SVG.check({ cls: "icon icon-sm" })}
                           <span>Отметить все</span>
                         </button>`
                      : ""
              }
              <button class="btn-primary btn-sm" onclick="Student.openStageModal()">
                ${SVG.plus({ cls: "icon icon-sm" })}
                <span>Этап</span>
              </button>
            </div>
          </div>

          ${
              stages.length === 0
                  ? emptyState(
                        "Этапов пока нет",
                        "Добавьте первый этап работы.",
                        SVG.layers,
                        `<button class="btn-primary" onclick="Student.openStageModal()">
                           ${SVG.plus({ cls: "icon icon-sm" })}
                           <span>Добавить этап</span>
                         </button>`,
                    )
                  : `<div id="stagesList">${stages.map((s) => renderStageItem(s)).join("")}</div>`
          }
        </div>

        <!-- Таймлайн дедлайнов -->
        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.clock({ cls: "icon icon-sm" })}
              Дедлайны
            </div>
          </div>
          ${
              upcoming.length === 0
                  ? '<div class="empty" style="padding:20px;">Нет дедлайнов</div>'
                  : upcoming.map((e) => renderWorkDeadlineRow(e)).join("")
          }
        </div>
      </div>

      <!-- Задачи -->
      <div class="card mt-12">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Задачи <span class="count-chip">${tasks.length}</span>
          </div>
          <button class="btn-primary btn-sm" onclick="Student.openTaskModal()">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Задача</span>
          </button>
        </div>
        ${renderKanban(work.id)}
      </div>

      <!-- Версии -->
      <div class="card mt-12">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Версии <span class="count-chip">${versions.length}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-ghost btn-sm" onclick="PdfReport.exportStudent('${work.id}')">
              ${SVG.fileText({ cls: "icon icon-sm" })}
              <span>PDF</span>
            </button>
            <button class="btn-primary btn-sm" onclick="Student.openVersionModal()">
              ${SVG.upload({ cls: "icon icon-sm" })}
              <span>Версия</span>
            </button>
          </div>
        </div>
        ${
            versions.length === 0
                ? '<div class="empty" style="padding:20px;">Версий пока нет</div>'
                : versions.map((v) => renderVersionRow(v)).join("")
        }
      </div>

      <!-- Замечания -->
      <div class="card mt-12">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Замечания руководителя
            ${comments.length > 0 ? `<span class="count-chip">${comments.length}</span>` : ""}
          </div>
        </div>
        ${
            comments.length === 0
                ? '<div class="empty" style="padding:20px;">Замечаний пока нет</div>'
                : comments.map((c) => renderComment(c)).join("")
        }
      </div>
    `;
    };

    /* =========================================================
       СВОДКА «МОЯ РАБОТА»
       ========================================================= */
    function renderWorkSummary(work, data) {
        const { progress, stages, stagesDone, tasks, tasksDone, versions } =
            data;

        const stagesPct = stages.length
            ? Math.round((stagesDone / stages.length) * 100)
            : 0;
        const tasksPct = tasks.length
            ? Math.round((tasksDone / tasks.length) * 100)
            : 0;

        const daysLeft = work.deadline ? daysUntil(work.deadline) : null;
        const deadlineLabel =
            daysLeft === null
                ? "—"
                : daysLeft < 0
                  ? "просрочена"
                  : daysLeft === 0
                    ? "сегодня"
                    : `${daysLeft} дн.`;
        const deadlineColor =
            daysLeft === null
                ? "txt-muted"
                : daysLeft < 0
                  ? "bad"
                  : daysLeft <= 7
                    ? "warn"
                    : "ok";

        return `
      <div class="card work-summary">
        <div class="work-summary-head">
          <div>
            <div class="work-summary-title">${escapeHtml(work.topic)}</div>
            <div class="work-summary-meta">
              ${escapeHtml(workTypeLabel(work.type))}
              · рук. ${escapeHtml(teacherName(work.teacherId))}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${statusBadge(work.status)}
          </div>
        </div>

        <div class="work-summary-stats">
          <div class="ws-stat">
            <div class="ws-stat-lbl">Прогресс</div>
            <div class="ws-stat-val" style="color:var(--${Utils.progressClass(progress)})">
              ${progress}%
            </div>
          </div>
          <div class="ws-stat">
            <div class="ws-stat-lbl">Этапы</div>
            <div class="ws-stat-val">
              ${stagesDone}<span class="ws-stat-sub">/${stages.length}</span>
            </div>
          </div>
          <div class="ws-stat">
            <div class="ws-stat-lbl">Задачи</div>
            <div class="ws-stat-val">
              ${tasksDone}<span class="ws-stat-sub">/${tasks.length}</span>
            </div>
          </div>
          <div class="ws-stat">
            <div class="ws-stat-lbl">Версии</div>
            <div class="ws-stat-val">${versions.length}</div>
          </div>
          <div class="ws-stat">
            <div class="ws-stat-lbl">До защиты</div>
            <div class="ws-stat-val" style="color:var(--${deadlineColor})">
              ${deadlineLabel}
            </div>
          </div>
        </div>

        ${
            stages.length > 0
                ? `
          <div class="work-summary-bars">
            <div class="ws-bar">
              <span class="ws-bar-lbl">Этапы</span>
              <div class="ws-bar-track">
                <div class="ws-bar-fill" style="width:${stagesPct}%;background:var(--accent-viz);"></div>
              </div>
              <span class="ws-bar-val">${stagesPct}%</span>
            </div>
            ${
                tasks.length > 0
                    ? `
              <div class="ws-bar">
                <span class="ws-bar-lbl">Задачи</span>
                <div class="ws-bar-track">
                  <div class="ws-bar-fill" style="width:${tasksPct}%;background:var(--info);"></div>
                </div>
                <span class="ws-bar-val">${tasksPct}%</span>
              </div>
            `
                    : ""
            }
          </div>
        `
                : ""
        }
    </div>
    `;
    }

    /* =========================================================
       ДЕДЛАЙНЫ РАБОТЫ (для правой колонки)
       ========================================================= */
    function getWorkUpcomingDeadlines(work, limit = 6) {
        const events = [];

        Storage.getStagesByWork(work.id)
            .filter((s) => s.deadline && !s.done)
            .forEach((s) => {
                const days = daysUntil(s.deadline);
                if (days >= -30 && days <= 180) {
                    events.push({
                        date: s.deadline,
                        days,
                        title: s.name,
                        kind: "stage",
                    });
                }
            });

        Storage.getTasksByWork(work.id)
            .filter((t) => t.deadline && t.col !== "done")
            .forEach((t) => {
                const days = daysUntil(t.deadline);
                if (days >= -30 && days <= 180) {
                    events.push({
                        date: t.deadline,
                        days,
                        title: t.title,
                        kind: "task",
                    });
                }
            });

        if (work.deadline) {
            const days = daysUntil(work.deadline);
            if (days >= -30 && days <= 365) {
                events.push({
                    date: work.deadline,
                    days,
                    title: "Защита работы",
                    kind: "defense",
                });
            }
        }

        return events
            .filter((e) => e.days >= 0)
            .sort((a, b) => a.days - b.days)
            .slice(0, limit);
    }

    function renderWorkDeadlineRow(e) {
        const cls = e.days <= 3 ? "bad" : e.days <= 7 ? "warn" : "";
        const label =
            e.days === 0
                ? "сегодня"
                : e.days === 1
                  ? "завтра"
                  : `${e.days} дн.`;

        const iconFn =
            e.kind === "defense"
                ? SVG.award
                : e.kind === "task"
                  ? SVG.check
                  : SVG.clock;

        return `
      <div class="deadline-row ${cls}">
        <div class="deadline-row-head">
          <span class="deadline-row-icon">
            ${iconFn({ cls: "icon icon-xs" })}
          </span>
          <span class="deadline-row-title">${escapeHtml(e.title)}</span>
        </div>
        <div class="deadline-row-foot">
          <span>${fmtDate(e.date)}</span>
          <span class="deadline-row-days">через ${label}</span>
        </div>
      </div>
    `;
    }

    /* =========================================================
       МАССОВОЕ ДЕЙСТВИЕ — отметить все этапы
       ========================================================= */
    function markAllStagesDone() {
        const work = getActiveWork();
        if (!work) return;

        if (
            !confirm(
                "Отметить все этапы работы как выполненные? Это действие нельзя отменить.",
            )
        )
            return;

        const stages = Storage.getStages();
        const now = Date.now();
        let changed = 0;

        stages.forEach((s) => {
            if (Storage.sameId(s.workId, work.id) && !s.done) {
                s.done = true;
                s.completedAt = now;
                changed++;
            }
        });

        if (changed === 0) {
            App.toast("Все этапы уже выполнены");
            return;
        }

        Storage.setStages(stages);

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Отмечены все этапы",
                work.topic,
                `${changed} этапов`,
                "positive",
            );
        }

        App.toast(`Отмечено этапов: ${changed}`);
        App.navigate("my-work");
    }

    /* =========================================================
       РЕДАКТИРОВАНИЕ ИНФОРМАЦИИ — toggle
       ========================================================= */
    function toggleEditForm() {
        const form = document.getElementById("workInfoForm");
        const preview = document.getElementById("workInfoPreview");
        if (!form || !preview) return;

        const isHidden = form.style.display === "none";
        form.style.display = isHidden ? "block" : "none";
        preview.style.display = isHidden ? "none" : "block";
    }

    function updateWork(field, value) {
        const work = getActiveWork();
        if (!work) {
            App.toast("Работа не найдена");
            return;
        }
        if (work.status !== "draft" && work.status !== "pending") {
            App.toast("Работу нельзя редактировать в этом статусе");
            return;
        }
        work[field] = value;
        work.updatedAt = Date.now();
        Storage.saveWork(work);
        App.toast("Сохранено");
    }

    function withdrawWork() {
        const work = getActiveWork();
        if (!work) return;
        if (!confirm("Отозвать заявку? Работа вернётся в черновик.")) return;
        work.status = "draft";
        work.updatedAt = Date.now();
        Storage.saveWork(work);
        App.toast("Заявка отозвана");
        App.navigate("my-work");
    }

    let archivedFilter = "all"; // all | done | rejected
    let archivedType = "";
    let archivedSearch = "";
    let archivedSort = "date";

    VIEWS.archived = function () {
        const allWorks = getArchivedWorks();

        if (allWorks.length === 0) {
            return `
        <div class="card">
          ${emptyState(
              "Завершённых работ нет",
              "Здесь будут появляться защищённые и отклонённые работы.",
              SVG.archive,
          )}
        </div>
      `;
        }

        const doneWorks = allWorks.filter((w) => w.status === "done");
        const rejectedWorks = allWorks.filter((w) => w.status === "rejected");

        // Средняя оценка
        const graded = doneWorks.filter((w) => w.finalGrade);
        const avgGrade = graded.length
            ? (
                  graded.reduce((a, w) => a + w.finalGrade, 0) / graded.length
              ).toFixed(1)
            : "—";

        // Фильтр
        let list = allWorks;
        if (archivedFilter === "done") list = doneWorks;
        else if (archivedFilter === "rejected") list = rejectedWorks;

        // Тип
        if (archivedType) {
            list = list.filter((w) => w.type === archivedType);
        }

        // Поиск
        if (archivedSearch) {
            const q = archivedSearch.toLowerCase();
            list = list.filter(
                (w) =>
                    w.topic.toLowerCase().includes(q) ||
                    teacherName(w.teacherId).toLowerCase().includes(q),
            );
        }

        // Сортировка
        list = [...list].sort((a, b) => {
            if (archivedSort === "grade") {
                return (b.finalGrade || 0) - (a.finalGrade || 0);
            }
            if (archivedSort === "type") {
                return (a.type || "").localeCompare(b.type || "");
            }
            if (archivedSort === "title") {
                return a.topic.localeCompare(b.topic);
            }
            // date — по дате защиты/отклонения
            return (
                (b.defendedAt || b.updatedAt || b.createdAt || 0) -
                (a.defendedAt || a.updatedAt || a.createdAt || 0)
            );
        });

        return `
      <!-- KPI -->
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${allWorks.length}</div>
          <div class="kpi-lbl">Всего работ</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--ok)">
            ${doneWorks.length}
          </div>
          <div class="kpi-lbl">Защищено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${rejectedWorks.length > 0 ? "var(--bad)" : "var(--txt-muted)"}">
            ${rejectedWorks.length}
          </div>
          <div class="kpi-lbl">Отклонено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--accent-viz)">
            ${avgGrade}
          </div>
          <div class="kpi-lbl">Ср. оценка</div>
        </div>
      </div>

      <!-- Список -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Работы
            <span class="count-chip">${list.length}</span>
          </div>
          <button class="btn-primary btn-sm" onclick="App.navigate('create-work')">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Создать работу</span>
          </button>
        </div>

        <!-- Табы -->
        <div class="filter-tabs" style="margin-bottom:14px;">
          ${renderArchivedTab("all", "Все", allWorks.length)}
          ${renderArchivedTab("done", "Защищено", doneWorks.length)}
          ${renderArchivedTab("rejected", "Отклонено", rejectedWorks.length)}
        </div>

        <!-- Поиск + фильтры -->
        <div class="review-toolbar">
          <input type="text"
            class="archived-search review-search"
            placeholder="Поиск по теме или руководителю…"
            value="${escapeHtml(archivedSearch)}"
            oninput="Student.setArchivedSearch(this.value)">
          <select class="review-sort" onchange="Student.setArchivedType(this.value)">
            <option value="">Все типы</option>
            ${Object.entries(Utils.WORK_TYPES)
                .map(
                    ([k, v]) =>
                        `<option value="${k}" ${archivedType === k ? "selected" : ""}>${v.title}</option>`,
                )
                .join("")}
          </select>
          <select class="review-sort" onchange="Student.setArchivedSort(this.value)">
            <option value="date" ${archivedSort === "date" ? "selected" : ""}>По дате</option>
            <option value="grade" ${archivedSort === "grade" ? "selected" : ""}>По оценке</option>
            <option value="type" ${archivedSort === "type" ? "selected" : ""}>По типу</option>
            <option value="title" ${archivedSort === "title" ? "selected" : ""}>По теме</option>
          </select>
        </div>

        ${
            list.length === 0
                ? emptyState(
                      "Ничего не найдено",
                      "Измените фильтр или запрос.",
                      SVG.archive,
                  )
                : list.map((w) => renderArchivedCard(w)).join("")
        }
      </div>
    `;
    };

    function renderArchivedTab(id, label, count) {
        const active = archivedFilter === id ? "active" : "";
        return `
      <button class="filter-tab ${active}" onclick="Student.setArchivedFilter('${id}')">
        ${escapeHtml(label)}
        <span class="count-chip" style="margin-left:6px;">${count}</span>
      </button>
    `;
    }

    function setArchivedFilter(f) {
        archivedFilter = f;
        App.navigate("archived");
    }

    function setArchivedType(t) {
        archivedType = t;
        App.navigate("archived");
    }

    function setArchivedSearch(q) {
        archivedSearch = q;
        App.navigate("archived");
        setTimeout(() => {
            const input = document.querySelector(".archived-search");
            if (input) {
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }, 0);
    }

    function setArchivedSort(s) {
        archivedSort = s;
        App.navigate("archived");
    }

    function renderArchivedCard(work) {
        const progress = calcProgress(work.id);
        const stages = Storage.getStagesByWork(work.id);
        const versions = Storage.getVersionsByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);
        const isDone = work.status === "done";

        const gradeLabel = (g) => {
            if (g === 5) return "отлично";
            if (g === 4) return "хорошо";
            if (g === 3) return "удовлетв.";
            if (g === 2) return "неудовл.";
            return "";
        };

        const accentColor = isDone ? "var(--ok)" : "var(--bad)";
        const stagesDone = stages.filter((s) => s.done).length;

        return `
      <div class="archived-card" style="border-left-color:${accentColor};">

        <!-- Заголовок -->
        <div class="archived-head">
          <div style="flex:1;min-width:0;">
            <div class="archived-title">${escapeHtml(work.topic)}</div>
            <div class="archived-meta">
              ${escapeHtml(workTypeLabel(work.type))}
              · рук. ${escapeHtml(teacherName(work.teacherId))}
              · ${stagesDone}/${stages.length} этапов
              · ${versions.length} версий
            </div>
          </div>
          <div>${statusBadge(work.status)}</div>
        </div>

        <!-- Оценка (для защищённых) -->
        ${
            isDone && work.finalGrade
                ? `
          <div class="archived-grade">
            <div class="archived-grade-num">${work.finalGrade}</div>
            <div class="archived-grade-body">
              <div class="archived-grade-label">${gradeLabel(work.finalGrade)}</div>
              ${
                  work.defendedAt
                      ? `<div class="archived-grade-date">Защищена ${fmtDate(work.defendedAt)}</div>`
                      : ""
              }
            </div>
            ${
                work.gradeComment
                    ? `<div class="archived-grade-comment">«${escapeHtml(work.gradeComment)}»</div>`
                    : ""
            }
          </div>
        `
                : ""
        }

        <!-- Причина отклонения -->
        ${
            !isDone && work.rejectReason
                ? `
          <div class="archived-reject">
            <b>Причина:</b> ${escapeHtml(work.rejectReason)}
          </div>
        `
                : ""
        }

        <!-- Аннотация -->
        ${
            work.annotation
                ? `<div class="archived-annotation">${escapeHtml(work.annotation)}</div>`
                : ""
        }

        <!-- Прогресс -->
        <div class="pbar" style="margin-top:12px;">
          <div class="pbar-track">
            <div class="pbar-fill ${Utils.progressClass(progress)}" style="width:${progress}%"></div>
          </div>
          <div class="pbar-val">${progress}%</div>
        </div>

        <!-- Действия -->
        <div class="archived-actions">
          <button class="btn-ghost btn-sm" onclick="PdfReport.exportStudent('${work.id}')">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>PDF</span>
          </button>
          ${
              !isDone
                  ? `
            <button class="btn-primary btn-sm" onclick="Student.recreateFromRejected('${work.id}')">
              ${SVG.refresh({ cls: "icon icon-sm" })}
              <span>Создать заново</span>
            </button>
          `
                  : ""
          }
        </div>
      </div>
    `;
    }

    function renderArchivedCard(work) {
        const progress = calcProgress(work.id);
        const stages = Storage.getStagesByWork(work.id);
        const versions = Storage.getVersionsByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);
        const isDone = work.status === "done";

        const gradeLabel = (g) => {
            if (g === 5) return "отлично";
            if (g === 4) return "хорошо";
            if (g === 3) return "удовлетворительно";
            if (g === 2) return "неудовлетворительно";
            return "";
        };

        const borderColor = isDone ? "var(--ok)" : "var(--bad)";

        return `
      <div style="border:1px solid var(--line);border-left:3px solid ${borderColor};border-radius:var(--r-md);padding:18px;margin-bottom:12px;background:var(--bg-elev);">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--txt-muted);margin-bottom:6px;">
              ${escapeHtml(workTypeLabel(work.type))}
            </div>
            <div style="font-size:15px;font-weight:500;margin-bottom:8px;line-height:1.4;color:var(--txt);">
              ${escapeHtml(work.topic)}
            </div>
            <div style="font-size:12px;color:var(--txt-muted);display:flex;gap:14px;flex-wrap:wrap;">
              <span>Руководитель: <b>${escapeHtml(teacherName(work.teacherId))}</b></span>
              <span>Прогресс: <b>${progress}%</b></span>
              ${
                  isDone && work.defendedAt
                      ? `<span>Защищена: <b>${fmtDate(work.defendedAt)}</b></span>`
                      : ""
              }
              ${
                  !isDone
                      ? `<span>Отклонена: <b>${fmtDate(work.updatedAt)}</b></span>`
                      : ""
              }
            </div>
          </div>
          <div>${statusBadge(work.status)}</div>
        </div>

        ${
            work.rejectReason
                ? `
          <div class="notice" style="margin-top:12px;background:var(--bad-soft);border-left:3px solid var(--bad);font-size:12px;">
            <b>Причина отклонения:</b> ${escapeHtml(work.rejectReason)}
          </div>
        `
                : ""
        }

        ${
            work.annotation
                ? `
          <div style="margin-top:12px;font-size:13px;color:var(--txt-muted);line-height:1.6;">
            ${escapeHtml(work.annotation)}
          </div>
        `
                : ""
        }

        <div class="pbar" style="margin-top:14px;">
          <div class="pbar-track">
            <div class="pbar-fill ${Utils.progressClass(progress)}"
              style="width:${progress}%"></div>
          </div>
          <div class="pbar-val">${progress}%</div>
        </div>

        ${
            isDone && work.finalGrade
                ? `
          <div style="margin-top:14px;padding:14px;background:var(--ok-soft);border:1px solid rgba(74,222,128,.3);border-radius:var(--r-md);">
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
              <div style="text-align:center;min-width:80px;">
                <div style="font-size:32px;font-weight:700;color:var(--ok);line-height:1;">
                  ${work.finalGrade}
                </div>
                <div style="font-size:11px;color:var(--txt-muted);margin-top:4px;">
                  ${gradeLabel(work.finalGrade)}
                </div>
              </div>
              <div style="flex:1;min-width:200px;">
                <div style="font-size:11px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
                  Оценка за защиту
                </div>
                ${
                    work.gradeComment
                        ? `<div style="font-size:13px;line-height:1.5;color:var(--txt);">«${escapeHtml(work.gradeComment)}»</div>`
                        : `<div style="font-size:13px;color:var(--txt-muted);">Комментарий не указан</div>`
                }
              </div>
            </div>
          </div>
        `
                : ""
        }

        ${
            isDone && !work.finalGrade
                ? `
          <div class="notice" style="margin-top:14px;background:var(--warn-soft);border-left:3px solid var(--warn);font-size:12px;">
            ${SVG.alertTriangle({ cls: "icon icon-sm" })}
            Оценка за защиту не выставлена
          </div>
        `
                : ""
        }

        ${
            stages.length > 0
                ? `
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line);">
            <div style="font-size:11px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
              Этапы (${stages.filter((s) => s.done).length}/${stages.length} выполнено)
            </div>
            ${stages
                .map(
                    (s) => `
              <div style="display:flex;gap:8px;padding:4px 0;font-size:13px;align-items:center;">
                <span style="color:var(--${s.done ? "ok" : "txt-muted"})">
                  ${s.done ? SVG.check({ cls: "icon icon-xs" }) : "○"}
                </span>
                <span style="${s.done ? "" : "color:var(--txt-muted);"}">
                  ${escapeHtml(s.name)}
                </span>
                ${
                    s.done && s.completedAt
                        ? `<span style="margin-left:auto;font-size:11px;color:var(--txt-muted);">${fmtDate(s.completedAt)}</span>`
                        : ""
                }
              </div>
            `,
                )
                .join("")}
          </div>
        `
                : ""
        }

        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line);display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--txt-muted);">
          <span>Версий: <b>${versions.length}</b></span>
          <span>Замечаний: <b>${comments.length}</b></span>
          <span>Создана: <b>${fmtDate(work.createdAt)}</b></span>
        </div>

        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-ghost btn-sm" onclick="PdfReport.exportStudent('${work.id}')">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>Скачать PDF</span>
          </button>
          ${
              !isDone
                  ? `
            <button class="btn-primary btn-sm" onclick="Student.recreateFromRejected('${work.id}')">
              ${SVG.refresh({ cls: "icon icon-sm" })}
              <span>Создать заново</span>
            </button>
          `
                  : ""
          }
        </div>
      </div>
    `;
    }

    function recreateFromRejected(workId) {
        const old = Storage.getWorkById(workId);
        if (!old) return;

        if (
            !confirm(
                "Создать новую работу на основе этой? Старая останется в архиве.",
            )
        )
            return;

        const newWork = {
            id: uid(),
            studentId: old.studentId,
            teacherId: old.teacherId,
            type: old.type,
            topic: old.topic + " (v2)",
            annotation: old.annotation || "",
            keywords: old.keywords || "",
            goal: old.goal || "",
            tasksText: old.tasksText || "",
            deadline: old.deadline || null,
            status: "draft",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        Storage.saveWork(newWork);
        selectedWorkId = newWork.id;

        App.toast("Новая работа создана (черновик)");
        App.navigate("my-work");
    }

    function renderStageItem(s) {
        return `
      <div class="stage-item ${s.done ? "done" : ""}">
        <div class="stage-check ${s.done ? "on" : ""}" onclick="Student.toggleStage('${s.id}')"></div>
        <div class="stage-body">
          <div class="stage-name">${escapeHtml(s.name)}</div>
          <div class="stage-meta">
            ${s.deadline ? `до ${escapeHtml(s.deadline)}` : "без дедлайна"}
            · вес ${s.weight || 1}
            ${s.description ? " · " + escapeHtml(s.description) : ""}
          </div>
        </div>
        <div class="stage-actions">
          <button class="btn-icon" onclick="Student.openStageModal('${s.id}')" title="Редактировать">
            ${SVG.edit({ cls: "icon icon-sm" })}
          </button>
          <button class="btn-icon danger" onclick="Student.deleteStage('${s.id}')" title="Удалить">
            ${SVG.trash({ cls: "icon icon-sm" })}
          </button>
        </div>
      </div>
    `;
    }

    function toggleStage(id) {
        const work = getActiveWork();
        if (!work) {
            App.toast("Нет активной работы");
            return;
        }

        const stages = Storage.getStages();
        const s = stages.find((x) => Storage.sameId(x.id, id));
        if (!s) return;
        if (!Storage.sameId(s.workId, work.id)) {
            App.toast("Этот этап не относится к текущей работе");
            return;
        }
        s.done = !s.done;
        s.completedAt = s.done ? Date.now() : null;
        Storage.setStages(stages);
        App.navigate("my-work");
    }

    function openStageModal(id) {
        const work = getActiveWork();
        if (!work) {
            App.toast("Сначала создайте работу");
            return;
        }

        const stages = Storage.getStages();
        const editing = id
            ? stages.find((s) => Storage.sameId(s.id, id))
            : null;

        if (id && !editing) {
            App.toast("Этап не найден");
            return;
        }
        if (editing && !Storage.sameId(editing.workId, work.id)) {
            App.toast("Этот этап не относится к текущей работе");
            return;
        }

        const isEdit = !!editing;

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Student.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>${isEdit ? "Редактировать этап" : "Новый этап"}</h3>
            <button class="modal-close" onclick="Student.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Название <span class="req">*</span></label>
            <input type="text" id="st_name" value="${escapeHtml(editing?.name || "")}"
              placeholder="Например: Глава 1. Теоретическая часть">
          </div>
          <div class="field">
            <label>Описание</label>
            <textarea id="st_desc" rows="2" placeholder="Что нужно сделать в этом этапе">${escapeHtml(editing?.description || "")}</textarea>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Дедлайн</label>
              <input type="date" id="st_deadline" value="${editing?.deadline || ""}">
            </div>
            <div class="field">
              <label>Вес (1–5)</label>
              <input type="number" id="st_weight" min="1" max="5" value="${editing?.weight || 1}">
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Student.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Student.saveStage('${id || ""}')">
              ${isEdit ? "Сохранить" : "Создать"}
            </button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveStage(id) {
        const name = document.getElementById("st_name")?.value.trim();
        if (!name) {
            App.toast("Введите название");
            return;
        }
        const work = getActiveWork();
        if (!work) {
            App.toast("Нет активной работы");
            return;
        }

        const stages = Storage.getStages();
        let stage;

        if (id && id !== "" && id !== "null") {
            stage = stages.find((s) => Storage.sameId(s.id, id));
            if (!stage) {
                App.toast("Этап не найден");
                return;
            }
            if (!Storage.sameId(stage.workId, work.id)) {
                App.toast("Этот этап не относится к текущей работе");
                return;
            }
        } else {
            stage = {
                id: uid(),
                workId: work.id,
                done: false,
                createdAt: Date.now(),
                order:
                    stages.filter((s) => Storage.sameId(s.workId, work.id))
                        .length + 1,
            };
            stages.push(stage);
        }

        stage.name = name;
        stage.description =
            document.getElementById("st_desc")?.value.trim() || "";
        stage.deadline = document.getElementById("st_deadline")?.value || null;
        stage.weight = Math.max(
            1,
            Math.min(5, +document.getElementById("st_weight")?.value || 1),
        );
        Storage.setStages(stages);

        closeModal();
        App.navigate("my-work");
        App.toast(id ? "Этап обновлён" : "Этап создан");
    }

    function deleteStage(id) {
        if (!confirm("Удалить этап?")) return;
        Storage.deleteStage(id);
        App.navigate("my-work");
    }

    function renderKanban(workId) {
        const tasks = Storage.getTasksByWork(workId);
        return `
      <div class="kanban">
        ${TASK_COLS.map(
            (col) => `
          <div class="kanban-col" data-col="${col.id}"
            ondragover="event.preventDefault(); this.classList.add('drag-over')"
            ondragleave="this.classList.remove('drag-over')"
            ondrop="Student.dropTask(event, '${col.id}')">
            <h5>${col.title} <span>${tasks.filter((t) => t.col === col.id).length}</span></h5>
            ${tasks
                .filter((t) => t.col === col.id)
                .map((t) => renderTaskCard(t))
                .join("")}
          </div>
        `,
        ).join("")}
      </div>
    `;
    }

    function renderTaskCard(t) {
        const deadline = t.deadline ? daysUntil(t.deadline) : null;
        const deadlineCls =
            deadline === null
                ? ""
                : deadline < 0
                  ? "color:var(--bad)"
                  : deadline <= 3
                    ? "color:var(--warn)"
                    : "color:var(--txt-muted)";

        const rejectBadge =
            t.reviewStatus === "rejected" && t.reviewComment
                ? `
          <div class="notice" style="margin-top:6px;padding:6px 8px;font-size:11px;background:var(--bad-soft);border-left:2px solid var(--bad);">
            <b>Замечание:</b> ${escapeHtml(t.reviewComment.slice(0, 100))}${t.reviewComment.length > 100 ? "…" : ""}
          </div>`
                : "";

        const approvedBadge =
            t.col === "done" && t.reviewedBy
                ? `
          <div style="color:var(--ok);font-size:11px;margin-top:6px;display:flex;align-items:center;gap:4px;">
            ${SVG.check({ cls: "icon icon-xs" })}
            <span>Проверено руководителем</span>
          </div>`
                : "";

        return `
      <div class="task-card" draggable="true" ondragstart="Student.dragTask(event, '${t.id}')">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span style="${deadlineCls}">
            ${t.deadline ? (deadline >= 0 ? "до " + escapeHtml(t.deadline) : "просрочено") : "—"}
          </span>
          <span>
            <button class="btn-icon" onclick="event.stopPropagation();Student.openTaskModal('${t.id}')" title="Редактировать">
              ${SVG.edit({ cls: "icon icon-xs" })}
            </button>
            <button class="btn-icon danger" onclick="event.stopPropagation();Student.deleteTask('${t.id}')" title="Удалить">
              ${SVG.trash({ cls: "icon icon-xs" })}
            </button>
          </span>
        </div>
        ${rejectBadge}
        ${approvedBadge}
      </div>
    `;
    }

    let dragTaskId = null;
    function dragTask(e, id) {
        dragTaskId = id;
    }

    function dropTask(e, col) {
        e.preventDefault();
        document
            .querySelectorAll(".kanban-col")
            .forEach((c) => c.classList.remove("drag-over"));
        if (!dragTaskId) return;

        const tasks = Storage.getTasks();
        const t = tasks.find((x) => Storage.sameId(x.id, dragTaskId));
        if (!t) {
            dragTaskId = null;
            return;
        }

        if (t.col === "review" || t.col === "done") {
            App.toast("Эту задачу проверяет руководитель");
            dragTaskId = null;
            return;
        }

        if (col === "done") {
            App.toast("Задача попадёт в «Готово» после проверки руководителем");
            dragTaskId = null;
            return;
        }

        if (col === "review" && t.col === "todo") {
            App.toast("Сначала переведите задачу в «В работе»");
            dragTaskId = null;
            return;
        }

        t.col = col;
        t.updatedAt = Date.now();
        Storage.setTasks(tasks);

        if (col === "review") {
            const work = Storage.getWorkById(t.workId);
            if (
                work &&
                work.teacherId &&
                typeof Notifications !== "undefined"
            ) {
                Notifications.add({
                    userId: work.teacherId,
                    type: "info",
                    title: "Задача на проверке",
                    text: `«${t.title}» — от студента`,
                    link: { view: "tasks-review" },
                });
            }
        }

        App.navigate("my-work");
        dragTaskId = null;
    }

    function openTaskModal(id) {
        const work = getActiveWork();
        if (!work) {
            App.toast("Сначала создайте работу");
            return;
        }

        const tasks = Storage.getTasks();
        const editing = id ? tasks.find((t) => Storage.sameId(t.id, id)) : null;

        if (id && !editing) {
            App.toast("Задача не найдена");
            return;
        }
        if (editing && !Storage.sameId(editing.workId, work.id)) {
            App.toast("Эта задача не относится к текущей работе");
            return;
        }

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Student.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>${editing ? "Редактировать задачу" : "Новая задача"}</h3>
            <button class="modal-close" onclick="Student.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Задача <span class="req">*</span></label>
            <input type="text" id="tk_title" value="${escapeHtml(editing?.title || "")}"
              placeholder="Например: Написать обзор литературы">
          </div>
          <div class="field">
            <label>Дедлайн</label>
            <input type="date" id="tk_deadline" value="${editing?.deadline || ""}">
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Student.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Student.saveTask('${id || ""}')">
              ${editing ? "Сохранить" : "Создать"}
            </button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveTask(id) {
        const title = document.getElementById("tk_title")?.value.trim();
        if (!title) {
            App.toast("Введите задачу");
            return;
        }
        const work = getActiveWork();
        if (!work) {
            App.toast("Нет активной работы");
            return;
        }

        const tasks = Storage.getTasks();
        let task;

        if (id && id !== "" && id !== "null") {
            task = tasks.find((t) => Storage.sameId(t.id, id));
            if (!task) {
                App.toast("Задача не найдена");
                return;
            }
            if (!Storage.sameId(task.workId, work.id)) {
                App.toast("Эта задача не относится к текущей работе");
                return;
            }
        } else {
            task = {
                id: uid(),
                workId: work.id,
                col: "todo",
                createdAt: Date.now(),
            };
            tasks.push(task);
        }
        task.title = title;
        task.deadline = document.getElementById("tk_deadline")?.value || null;
        task.updatedAt = Date.now();
        Storage.setTasks(tasks);

        closeModal();
        App.navigate("my-work");
    }

    function deleteTask(id) {
        if (!confirm("Удалить задачу?")) return;
        Storage.deleteTask(id);
        App.navigate("my-work");
    }

    function renderVersionRow(v) {
        const comments = Storage.getCommentsByVersion(v.id);
        return `
      <div class="version-row">
        <span class="version-tag">v${escapeHtml(v.version)}</span>
        <div class="version-info">
          <div class="version-comment">${escapeHtml(v.comment || "Без комментария")}</div>
          <div class="version-date">
            ${fmtDateTime(v.createdAt)}
            ${v.filename ? " · " + escapeHtml(v.filename) : ""}
            ${comments.length ? " · 💬 " + comments.length : ""}
          </div>
        </div>
        <button class="btn-icon" onclick="Student.viewVersionComments('${v.id}')" title="Замечания">
          ${SVG.messageCircle({ cls: "icon icon-sm" })}
        </button>
      </div>
    `;
    }

    function openVersionModal() {
        const work = getActiveWork();
        if (!work) {
            App.toast("Сначала создайте работу");
            return;
        }

        const versions = Storage.getVersionsByWork(work.id);
        const nextVersion = (versions.length + 1).toFixed(1);

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Student.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Загрузить версию</h3>
            <button class="modal-close" onclick="Student.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          <div class="field">
            <label>Номер версии <span class="req">*</span></label>
            <input type="text" id="v_version" value="${nextVersion}" placeholder="1.0">
          </div>
          <div class="field">
            <label>Имя файла (имитация загрузки)</label>
            <input type="text" id="v_filename" placeholder="chapter1.docx">
          </div>
          <div class="field">
            <label>Что изменилось</label>
            <textarea id="v_comment" rows="2" placeholder="Например: добавлена глава 2"></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="Student.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Student.saveVersion()">Загрузить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveVersion() {
        const version = document.getElementById("v_version")?.value.trim();
        if (!version) {
            App.toast("Укажите версию");
            return;
        }
        const work = getActiveWork();
        if (!work) {
            App.toast("Нет активной работы");
            return;
        }

        Storage.saveVersion({
            id: uid(),
            workId: work.id,
            version,
            filename: document.getElementById("v_filename")?.value.trim() || "",
            comment: document.getElementById("v_comment")?.value.trim() || "",
            createdAt: Date.now(),
        });

        closeModal();
        App.navigate("my-work");
        App.toast("Версия загружена");
    }

    function viewVersionComments(versionId) {
        const comments = Storage.getCommentsByVersion(versionId);

        const html = `
      <div class="modal-back" onclick="if(event.target===this) Student.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Замечания к версии</h3>
            <button class="modal-close" onclick="Student.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>
          ${
              comments.length === 0
                  ? emptyState(
                        "Замечаний нет",
                        "Руководитель пока не оставил замечаний к этой версии.",
                        SVG.messageCircle,
                    )
                  : comments.map((c) => renderComment(c)).join("")
          }
        </div>
      </div>
    `;
        App.openModal(html);
    }

    /* =========================================================
       ПРОФИЛЬ — hero с KPI, достижения, работы
       ========================================================= */
    VIEWS.profile = function () {
        const u = getUser();
        if (!u) return "";

        const works = getMyWorks();

        const activeWorks = works.filter((w) => Utils.isActiveStatus(w.status));
        const doneWorks = works.filter((w) => w.status === "done");
        const rejectedWorks = works.filter((w) => w.status === "rejected");

        // Метрики
        let totalProgress = 0;
        let totalRating = 0;
        let cnt = 0;
        works.forEach((w) => {
            const progress = calcProgress(w.id);
            const res = getFuzzyResult(w, progress);
            totalProgress += progress;
            if (res) {
                totalRating += res.rating.value;
                cnt++;
            }
        });
        const avgProgress = works.length
            ? Math.round(totalProgress / works.length)
            : 0;
        const avgRating = cnt ? Math.round(totalRating / cnt) : 0;

        // Этапы / задачи / версии
        let totalStages = 0;
        let doneStages = 0;
        let totalTasks = 0;
        let doneTasks = 0;
        let totalVersions = 0;

        works.forEach((w) => {
            const stages = Storage.getStagesByWork(w.id);
            const tasks = Storage.getTasksByWork(w.id);
            const versions = Storage.getVersionsByWork(w.id);
            totalStages += stages.length;
            doneStages += stages.filter((s) => s.done).length;
            totalTasks += tasks.length;
            doneTasks += tasks.filter((t) => t.col === "done").length;
            totalVersions += versions.length;
        });

        // Достижения
        const achievements = buildAchievements(
            u,
            works,
            doneWorks,
            activeWorks,
            { totalStages, doneStages, totalTasks, doneTasks, totalVersions },
        );

        const init = Utils.initials(u.fio);

        return `
      <!-- HERO -->
      <div class="profile-hero">
        <div class="profile-hero-avatar">${init}</div>
        <div class="profile-hero-body">
          <div class="profile-hero-name">${escapeHtml(u.fio)}</div>
          <div class="profile-hero-sub">${escapeHtml(u.email)}</div>
          <div class="profile-hero-chips">
            <span class="role-chip student">Студент</span>
            ${u.group ? `<span class="tag">${escapeHtml(u.group)}</span>` : ""}
            ${u.faculty ? `<span class="tag">${escapeHtml(u.faculty)}</span>` : ""}
            ${u.course ? `<span class="tag">${u.course} курс</span>` : ""}
            ${u.direction ? `<span class="tag">${escapeHtml(u.direction)}</span>` : ""}
          </div>
        </div>
      </div>

      <!-- KPI-панель -->
      <div class="grid grid-4 mt-16">
        <div class="card kpi">
          <div class="kpi-num">${activeWorks.length}</div>
          <div class="kpi-lbl">Активных работ</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--ok)">${doneWorks.length}</div>
          <div class="kpi-lbl">Защищено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${rejectedWorks.length > 0 ? "var(--bad)" : "var(--txt-muted)"}">
            ${rejectedWorks.length}
          </div>
          <div class="kpi-lbl">Отклонено</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--accent-viz)">${avgRating}</div>
          <div class="kpi-lbl">Ср. рейтинг</div>
        </div>
      </div>

      <!-- Достижения -->
      ${
          achievements.length > 0
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.award({ cls: "icon icon-sm" })}
              Достижения
            </div>
            <span class="count-chip">${achievements.length}</span>
          </div>
          <div class="achievements-grid">
            ${achievements.map((a) => renderAchievement(a)).join("")}
          </div>
        </div>
      `
              : ""
      }

      <!-- Личные данные + Сводка -->
      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-title">Личные данные</div>
          <div class="info-grid">
            <div class="info-item"><div class="info-lbl">ФИО</div><div class="info-val">${escapeHtml(u.fio)}</div></div>
            <div class="info-item"><div class="info-lbl">Email</div><div class="info-val">${escapeHtml(u.email)}</div></div>
            <div class="info-item"><div class="info-lbl">Факультет</div><div class="info-val">${escapeHtml(u.faculty || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Группа</div><div class="info-val">${escapeHtml(u.group || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Курс</div><div class="info-val">${u.course || "—"}</div></div>
            <div class="info-item"><div class="info-lbl">Направление</div><div class="info-val">${escapeHtml(u.direction || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Зачётка</div><div class="info-val">${escapeHtml(u.recordBook || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Регистрация</div><div class="info-val">${fmtDate(u.createdAt)}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Сводка по работе</div>
          <div class="profile-summary">
            ${renderProfileSummaryBar("Этапы", doneStages, totalStages, "accent-viz")}
            ${renderProfileSummaryBar("Задачи", doneTasks, totalTasks, "info")}
            ${renderProfileSummaryBar("Средний прогресс", avgProgress, 100, Utils.progressClass(avgProgress))}
          </div>

          <div class="profile-summary-footer">
            <div class="psf-item">
              <div class="psf-val">${totalStages}</div>
              <div class="psf-lbl">этапов</div>
            </div>
            <div class="psf-item">
              <div class="psf-val">${totalTasks}</div>
              <div class="psf-lbl">задач</div>
            </div>
            <div class="psf-item">
              <div class="psf-val">${totalVersions}</div>
              <div class="psf-lbl">версий</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Нечёткий профиль -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.brain({ cls: "icon icon-sm" })}
            Нечёткий профиль
          </div>
          <span style="font-size:11px;color:var(--txt-muted);">
            по активной работе
          </span>
        </div>
        <div class="chart-box h-260">
          <canvas id="studentProfileRadar"></canvas>
        </div>
      </div>

      <!-- Мои работы -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Мои работы
            <span class="count-chip">${works.length}</span>
          </div>
          <button class="btn-primary btn-sm" onclick="App.navigate('create-work')">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Создать</span>
          </button>
        </div>

        ${
            works.length === 0
                ? `<div class="empty" style="padding:20px;">Работ пока нет</div>`
                : `
          ${
              activeWorks.length > 0
                  ? `
            <div class="section-label" style="margin-top:0;">
              Активные (${activeWorks.length})
            </div>
            ${activeWorks.map((w) => renderProfileWorkRow(w)).join("")}
          `
                  : ""
          }
          ${
              doneWorks.length + rejectedWorks.length > 0
                  ? `
            <div class="section-label">
              Завершённые (${doneWorks.length + rejectedWorks.length})
            </div>
            ${[...doneWorks, ...rejectedWorks].map((w) => renderProfileWorkRow(w)).join("")}
          `
                  : ""
          }
        `
        }
      </div>

      <!-- Быстрые ссылки -->
      <div class="card mt-16">
        <div class="card-title">Быстрые ссылки</div>
        <div class="quick-actions">
          <div class="quick-action" onclick="App.navigate('my-work')">
            <div class="qa-ico">${SVG.folder({ cls: "icon" })}</div>
            <div class="qa-lbl">Моя работа</div>
            <div class="qa-desc">Этапы, задачи, версии</div>
          </div>
          <div class="quick-action" onclick="App.navigate('stats')">
            <div class="qa-ico">${SVG.trending({ cls: "icon" })}</div>
            <div class="qa-lbl">Статистика</div>
            <div class="qa-desc">Графики и метрики</div>
          </div>
          <div class="quick-action" onclick="App.navigate('calendar')">
            <div class="qa-ico">${SVG.calendar({ cls: "icon" })}</div>
            <div class="qa-lbl">Календарь</div>
            <div class="qa-desc">Дедлайны и события</div>
          </div>
          <div class="quick-action" onclick="App.navigate('activity')">
            <div class="qa-ico">${SVG.log({ cls: "icon" })}</div>
            <div class="qa-lbl">Активность</div>
            <div class="qa-desc">История действий</div>
          </div>
        </div>
      </div>
    `;
    };

    /* =========================================================
       ДОСТИЖЕНИЯ
       ========================================================= */
    function buildAchievements(u, works, doneWorks, activeWorks, stats) {
        const list = [];

        // Первая созданная работа
        if (works.length >= 1) {
            list.push({
                icon: SVG.rocket,
                title: "Первая работа",
                text: "Создана первая работа в системе",
            });
        }

        // Первая защита
        if (doneWorks.length >= 1) {
            list.push({
                icon: SVG.graduation,
                title: "Первая защита",
                text: "Успешно защищена первая работа",
            });
        }

        // Много работ
        if (works.length >= 3) {
            list.push({
                icon: SVG.book,
                title: "Опытный исследователь",
                text: `Создано ${works.length} работ`,
            });
        }

        // Отличная оценка
        const excellentWorks = doneWorks.filter((w) => w.finalGrade === 5);
        if (excellentWorks.length >= 1) {
            list.push({
                icon: SVG.star,
                title: "Отличник",
                text: `Оценка «отлично» · ${excellentWorks.length} ${excellentWorks.length === 1 ? "работа" : "работ"}`,
            });
        }

        // Полностью закрытая работа
        const completedWorks = works.filter((w) => {
            const stages = Storage.getStagesByWork(w.id);
            return stages.length > 0 && stages.every((s) => s.done);
        });
        if (completedWorks.length >= 1) {
            list.push({
                icon: SVG.checkCircle,
                title: "Все этапы выполнены",
                text: `Полностью закрыто ${completedWorks.length} ${completedWorks.length === 1 ? "работа" : "работ"}`,
            });
        }

        // Много версий
        if (stats.totalVersions >= 10) {
            list.push({
                icon: SVG.fileText,
                title: "Продуктивный автор",
                text: `${stats.totalVersions} версий документов`,
            });
        }

        // Много задач закрыто
        if (stats.doneTasks >= 20) {
            list.push({
                icon: SVG.target,
                title: "Исполнительный",
                text: `Закрыто ${stats.doneTasks} задач`,
            });
        }

        return list;
    }

    function renderAchievement(a) {
        const IconFn = a.icon || SVG.award;
        return `
      <div class="achievement">
        <div class="achievement-icon">
          ${IconFn({ cls: "icon icon-lg" })}
        </div>
        <div class="achievement-body">
          <div class="achievement-title">${escapeHtml(a.title)}</div>
          <div class="achievement-text">${escapeHtml(a.text)}</div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       СВОДКА ПРОФИЛЯ
       ========================================================= */
    function renderProfileSummaryBar(label, current, total, color) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        return `
      <div class="ps-bar">
        <div class="ps-bar-head">
          <span class="ps-bar-lbl">${escapeHtml(label)}</span>
          <span class="ps-bar-val">${current} / ${total}</span>
        </div>
        <div class="ps-bar-track">
          <div class="ps-bar-fill" style="width:${pct}%;background:var(--${color || "accent"});"></div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       РАБОТА В ПРОФИЛЕ
       ========================================================= */
    function renderProfileWorkRow(w) {
        const progress = calcProgress(w.id);
        const res = getFuzzyResult(w, progress);
        const isDone = w.status === "done";
        const isRejected = w.status === "rejected";

        const accent = isDone
            ? "var(--ok)"
            : isRejected
              ? "var(--bad)"
              : "var(--info)";

        return `
      <div class="profile-work-row"
        style="border-left-color:${accent};"
        onclick="Student.selectWork('${w.id}')">
        <div style="flex:1;min-width:0;">
          <div class="profile-work-topic">${escapeHtml(w.topic)}</div>
          <div class="profile-work-meta">
            ${escapeHtml(workTypeLabel(w.type))}
            ${isDone && w.finalGrade ? ` · оценка ${w.finalGrade}` : ""}
            ${isRejected && w.rejectReason ? ` · отклонена` : ""}
          </div>
        </div>
        <div class="profile-work-right">
          <div class="profile-work-progress">${progress}%</div>
          ${statusBadge(w.status)}
        </div>
      </div>
    `;
    }

    VIEWS.profile_after = function () {
        if (!Charts.hasChart()) return;
        const u = getUser();
        const works = getMyWorks();
        if (works.length === 0) return;

        const w = works.find((x) => Utils.isActiveStatus(x.status)) || works[0];
        const inputs = Utils.buildFuzzyInputs(w, calcProgress(w.id));
        if (!inputs) return;

        Charts.radar(
            "studentProfileRadar",
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
                    label: u.fio,
                    data: [
                        inputs.progress,
                        inputs.activity * 10,
                        inputs.volume,
                        inputs.orig ?? 50,
                        inputs.gost ?? 50,
                        (inputs.supScore ?? 5) * 10,
                    ],
                    color: Charts.COLORS.accent,
                },
            ],
        );
    };

    let calYear = null;
    let calMonth = null;
    let calSelectedDate = null; // "YYYY-MM-DD"
    let calFilter = { stage: true, task: true, defense: true };

    VIEWS.calendar = function () {
        const work = getActiveWork();
        if (!work) {
            return `
        <div class="card">
          ${emptyState(
              "Нет работы",
              "Создайте работу, чтобы увидеть дедлайны в календаре.",
              SVG.calendar,
              `<button class="btn-primary" onclick="App.navigate('create-work')">Создать работу</button>`,
          )}
        </div>
      `;
        }

        // Инициализация текущего месяца
        const now = new Date();
        if (calYear === null) calYear = now.getFullYear();
        if (calMonth === null) calMonth = now.getMonth();

        // Построение событий
        const events = buildCalendarEvents(work);
        const filteredEvents = events.filter((e) => calFilter[e.kind]);

        // Группировка по дате
        const eventsByDate = {};
        filteredEvents.forEach((e) => {
            if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
            eventsByDate[e.date].push(e);
        });

        // Данные выбранного дня
        const selectedEvents = calSelectedDate
            ? eventsByDate[calSelectedDate] || []
            : [];

        // Сетка месяца
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
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

        // Статистика месяца
        let monthStats = { stage: 0, task: 0, defense: 0 };
        filteredEvents.forEach((e) => {
            const d = new Date(e.date);
            if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
                monthStats[e.kind]++;
            }
        });

        let cells = "";
        for (let i = 0; i < startOffset; i++) {
            cells += '<div class="calendar-day empty"></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const isToday =
                d === now.getDate() &&
                calMonth === now.getMonth() &&
                calYear === now.getFullYear();
            const dayEvents = eventsByDate[dateStr] || [];
            const hasEvents = dayEvents.length > 0;
            const isSelected = calSelectedDate === dateStr;

            const days = daysUntil(dateStr);
            const isUrgent = hasEvents && days <= 3 && days >= 0;

            const hasStage = dayEvents.some((e) => e.kind === "stage");
            const hasTask = dayEvents.some((e) => e.kind === "task");
            const hasDefense = dayEvents.some((e) => e.kind === "defense");

            cells += `
        <div class="calendar-day
          ${isToday ? "today" : ""}
          ${hasEvents ? "has-deadline" : ""}
          ${isUrgent ? "urgent" : ""}
          ${isSelected ? "selected" : ""}"
          onclick="Student.selectCalendarDay('${dateStr}')">
          <div class="calendar-day-num">${d}</div>
          <div class="calendar-day-dots">
            ${hasDefense ? '<span class="cal-dot defense"></span>' : ""}
            ${hasStage ? '<span class="cal-dot stage"></span>' : ""}
            ${hasTask ? '<span class="cal-dot task"></span>' : ""}
          </div>
        </div>
      `;
        }

        return `
      <div class="cal-layout">
        <!-- Левая колонка: календарь -->
        <div class="card">
          <!-- Заголовок с навигацией -->
          <div class="cal-nav">
            <button class="btn-ghost btn-sm" onclick="Student.calPrevMonth()" title="Предыдущий месяц">
              ${SVG.arrowLeft({ cls: "icon icon-sm" })}
            </button>
            <div class="cal-nav-title">
              ${monthNames[calMonth]} ${calYear}
            </div>
            <button class="btn-ghost btn-sm" onclick="Student.calNextMonth()" title="Следующий месяц">
              ${SVG.arrowRight({ cls: "icon icon-sm" })}
            </button>
            <button class="btn-ghost btn-sm" onclick="Student.calToday()" title="Сегодня">
              Сегодня
            </button>
          </div>

          <!-- Фильтры -->
          <div class="cal-filters">
            <label class="cal-filter">
              <input type="checkbox" ${calFilter.stage ? "checked" : ""}
                onchange="Student.calToggleFilter('stage')">
              <span class="cal-filter-dot stage"></span>
              <span>Этапы</span>
            </label>
            <label class="cal-filter">
              <input type="checkbox" ${calFilter.task ? "checked" : ""}
                onchange="Student.calToggleFilter('task')">
              <span class="cal-filter-dot task"></span>
              <span>Задачи</span>
            </label>
            <label class="cal-filter">
              <input type="checkbox" ${calFilter.defense ? "checked" : ""}
                onchange="Student.calToggleFilter('defense')">
              <span class="cal-filter-dot defense"></span>
              <span>Защита</span>
            </label>
          </div>

          <!-- Сетка -->
          <div class="calendar-grid">
            ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
                .map((d) => `<div class="calendar-head">${d}</div>`)
                .join("")}
            ${cells}
          </div>

          <!-- Статистика месяца -->
          <div class="cal-month-stats">
            <span>В этом месяце:</span>
            ${monthStats.stage > 0 ? `<b>${monthStats.stage} этапов</b>` : ""}
            ${monthStats.task > 0 ? `<b>${monthStats.task} задач</b>` : ""}
            ${monthStats.defense > 0 ? `<b>${monthStats.defense} защита</b>` : ""}
            ${
                monthStats.stage + monthStats.task + monthStats.defense === 0
                    ? '<span style="color:var(--txt-muted);">нет событий</span>'
                    : ""
            }
          </div>
        </div>

        <!-- Правая колонка: события выбранного дня -->
        <div class="card">
          ${
              !calSelectedDate
                  ? `
            <div class="empty-state" style="padding:40px 20px;">
              ${SVG.calendar({ cls: "icon icon-2xl" })}
              <h3 style="margin-top:12px;font-size:14px;">Выберите день</h3>
              <p style="color:var(--txt-muted);font-size:12px;">
                Кликните по дню в календаре, чтобы увидеть события.
              </p>
            </div>
          `
                  : `
            <div class="card-head">
              <div class="card-title" style="margin-bottom:0;">
                ${fmtDate(calSelectedDate)}
                <span class="count-chip">${selectedEvents.length}</span>
              </div>
              <button class="btn-ghost btn-sm" onclick="Student.openQuickTaskModal('${calSelectedDate}')">
                ${SVG.plus({ cls: "icon icon-sm" })}
                <span>Задача</span>
              </button>
            </div>

            ${
                selectedEvents.length === 0
                    ? `
              <div class="empty" style="padding:30px 20px;text-align:center;">
                <p style="font-size:12px;color:var(--txt-muted);margin-bottom:12px;">
                  На этот день событий нет.
                </p>
                <button class="btn-ghost btn-sm" onclick="Student.openQuickTaskModal('${calSelectedDate}')">
                  ${SVG.plus({ cls: "icon icon-sm" })}
                  <span>Добавить задачу</span>
                </button>
              </div>
            `
                    : selectedEvents.map((e) => renderDayEventRow(e)).join("")
            }
          `
          }
        </div>
      </div>

      <!-- Ближайшие события -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.clock({ cls: "icon icon-sm" })}
            Ближайшие события
          </div>
        </div>
        ${
            filteredEvents
                .filter((e) => daysUntil(e.date) >= 0)
                .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
                .slice(0, 8)
                .map((e) => renderUpcomingEventRow(e))
                .join("") ||
            '<div class="empty" style="padding:20px;">Событий нет</div>'
        }
      </div>
    `;
    };

    /* =========================================================
       СОБЫТИЯ КАЛЕНДАРЯ
       ========================================================= */
    function buildCalendarEvents(work) {
        const events = [];

        // Этапы
        Storage.getStagesByWork(work.id)
            .filter((s) => s.deadline && !s.done)
            .forEach((s) => {
                events.push({
                    date: s.deadline,
                    kind: "stage",
                    title: s.name,
                    subtitle: "Этап работы",
                    id: s.id,
                    done: s.done,
                });
            });

        // Задачи
        Storage.getTasksByWork(work.id)
            .filter((t) => t.deadline && t.col !== "done")
            .forEach((t) => {
                const colLabels = {
                    todo: "К выполнению",
                    progress: "В работе",
                    review: "На проверке",
                };
                events.push({
                    date: t.deadline,
                    kind: "task",
                    title: t.title,
                    subtitle: colLabels[t.col] || "Задача",
                    id: t.id,
                    col: t.col,
                });
            });

        // Защита
        if (work.deadline) {
            events.push({
                date: work.deadline,
                kind: "defense",
                title: "Защита работы",
                subtitle: work.topic.slice(0, 60),
                id: work.id,
            });
        }

        return events;
    }

    function renderDayEventRow(e) {
        const kindCls = e.kind;
        const iconFn =
            e.kind === "defense"
                ? SVG.award
                : e.kind === "task"
                  ? SVG.check
                  : SVG.layers;

        const days = daysUntil(e.date);
        const label =
            days === 0
                ? "сегодня"
                : days === 1
                  ? "завтра"
                  : days > 0
                    ? `через ${days} дн.`
                    : `${Math.abs(days)} дн. назад`;

        return `
      <div class="day-event day-event-${kindCls}" onclick="Student.selectWork('${e.workId || ""}')">
        <div class="day-event-icon">
          ${iconFn({ cls: "icon icon-sm" })}
        </div>
        <div class="day-event-body">
          <div class="day-event-title">${escapeHtml(e.title)}</div>
          <div class="day-event-sub">${escapeHtml(e.subtitle)}</div>
        </div>
        <div class="day-event-badge">${label}</div>
      </div>
    `;
    }

    function renderUpcomingEventRow(e) {
        const days = daysUntil(e.date);
        const cls = days <= 3 ? "bad" : days <= 7 ? "warn" : "";
        const label =
            days === 0
                ? "сегодня"
                : days === 1
                  ? "завтра"
                  : `через ${days} дн.`;

        const iconFn =
            e.kind === "defense"
                ? SVG.award
                : e.kind === "task"
                  ? SVG.check
                  : SVG.layers;

        return `
      <div class="mini-project ${cls}">
        <div style="flex:1;min-width:0;">
          <div class="mini-project-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${iconFn({ cls: "icon icon-xs" })}
            ${escapeHtml(e.title)}
          </div>
          <div class="mini-project-sub">
            ${escapeHtml(e.subtitle)} · ${fmtDate(e.date)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;font-weight:600;color:var(--${cls || "txt-muted"});">
            ${label}
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       УПРАВЛЕНИЕ КАЛЕНДАРЁМ
       ========================================================= */
    function calPrevMonth() {
        if (calMonth === 0) {
            calMonth = 11;
            calYear--;
        } else {
            calMonth--;
        }
        calSelectedDate = null;
        App.navigate("calendar");
    }

    function calNextMonth() {
        if (calMonth === 11) {
            calMonth = 0;
            calYear++;
        } else {
            calMonth++;
        }
        calSelectedDate = null;
        App.navigate("calendar");
    }

    function calToday() {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        calSelectedDate = now.toISOString().slice(0, 10);
        App.navigate("calendar");
    }

    function selectCalendarDay(dateStr) {
        if (calSelectedDate === dateStr) {
            calSelectedDate = null;
        } else {
            calSelectedDate = dateStr;
        }
        App.navigate("calendar");
    }

    function calToggleFilter(kind) {
        calFilter[kind] = !calFilter[kind];
        App.navigate("calendar");
    }

    /* =========================================================
       БЫСТРОЕ ДОБАВЛЕНИЕ ЗАДАЧИ НА ДЕНЬ
       ========================================================= */
    function openQuickTaskModal(dateStr) {
        const work = getActiveWork();
        if (!work) {
            App.toast("Сначала создайте работу");
            return;
        }

        const html = `
      <div class="modal-back" onclick="if(event.target===this) App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Новая задача</h3>
            <button class="modal-close" onclick="App.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
            Дедлайн: <b>${fmtDate(dateStr)}</b>
          </div>

          <div class="field">
            <label>Задача <span class="req">*</span></label>
            <input type="text" id="qt_title" placeholder="Например: написать введение">
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="App.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Student.saveQuickTask('${dateStr}')">Создать</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveQuickTask(dateStr) {
        const title = document.getElementById("qt_title")?.value.trim();
        if (!title) {
            App.toast("Введите задачу");
            return;
        }

        const work = getActiveWork();
        if (!work) {
            App.toast("Нет активной работы");
            return;
        }

        Storage.saveTask({
            id: uid(),
            workId: work.id,
            title,
            col: "todo",
            deadline: dateStr,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        App.closeModal();
        App.toast("Задача создана на " + fmtDate(dateStr));
        App.navigate("calendar");
    }

    VIEWS.stats = function () {
        const u = getUser();
        const work = getActiveWork();
        if (!work) {
            return `
        <div class="card">
          ${emptyState("Нет активной работы", "", SVG.folder)}
        </div>
      `;
        }

        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const versions = Storage.getVersionsByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);

        const progress = calcProgress(work.id);
        const stagesDone = stages.filter((s) => s.done).length;
        const tasksDone = tasks.filter((t) => t.col === "done").length;

        const inputs = Utils.buildFuzzyInputs(work, progress);
        const res = Utils.safeFuzzyInfer(inputs);

        // Сравнение со средним
        const comparison = getStudentComparison(u, work);

        return `
      <!-- KPI -->
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-lbl">Прогресс</div>
          <div class="metric-val" style="color:var(--${Utils.progressClass(progress)})">
            ${progress}%
          </div>
          <div class="metric-sub">по весам этапов</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Этапы</div>
          <div class="metric-val">${stagesDone}/${stages.length}</div>
          <div class="metric-sub">выполнено</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Задачи</div>
          <div class="metric-val">${tasksDone}/${tasks.length}</div>
          <div class="metric-sub">закрыто</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Версии</div>
          <div class="metric-val">${versions.length}</div>
          <div class="metric-sub">загружено</div>
        </div>
      </div>

      <!-- Итоговые показатели Мамдани -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.brain({ cls: "icon icon-sm" })}
            Итоговые показатели (Мамдани)
          </div>
          <button class="btn-ghost btn-sm" onclick="Student.exportStatsPdf()">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>Экспорт PDF</span>
          </button>
        </div>
        <div class="fuzzy-panel" style="grid-template-columns:1fr 1fr 1fr;">
          <div class="fuzzy-out">
            <div class="fuzzy-out-lbl">Риск</div>
            <div class="fuzzy-out-val" style="color:var(--${Utils.riskClass(res.risk.term)})">
              ${res.risk.value.toFixed(0)}
            </div>
            <div class="fuzzy-out-term">${Fuzzy.termLabel(res.risk.term, "risk")}</div>
          </div>
          <div class="fuzzy-out">
            <div class="fuzzy-out-lbl">Готовность</div>
            <div class="fuzzy-out-val" style="color:var(--${Utils.readyClass(res.ready.term)})">
              ${res.ready.value.toFixed(0)}
            </div>
            <div class="fuzzy-out-term">${Fuzzy.termLabel(res.ready.term, "ready")}</div>
          </div>
          <div class="fuzzy-out">
            <div class="fuzzy-out-lbl">Рейтинг</div>
            <div class="fuzzy-out-val" style="color:var(--accent)">
              ${res.rating.value.toFixed(0)}
            </div>
            <div class="fuzzy-out-term">${Fuzzy.termLabel(res.rating.term, "rating")}</div>
          </div>
        </div>

        ${
            !res.hasAnyTeacherCheck
                ? `
          <div class="notice" style="margin-top:12px;font-size:12px;background:var(--warn-soft);border-left:2px solid var(--warn);">
            ${SVG.info({ cls: "icon icon-xs" })}
            Оценка предварительная — руководитель ещё не проверял работу.
          </div>
        `
                : ""
        }
      </div>

      <!-- Линия времени прогресса -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${SVG.trending({ cls: "icon icon-sm" })}
            Прогресс за 30 дней
          </div>
        </div>
        <div class="chart-box h-260">
          <canvas id="studentTimelineChart"></canvas>
        </div>
      </div>

      <!-- Активность и сравнение -->
      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.activity({ cls: "icon icon-sm" })}
              Активность по дням недели
            </div>
          </div>
          <div class="chart-box h-260">
            <canvas id="studentActivityChart"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${SVG.users({ cls: "icon icon-sm" })}
              Сравнение с группой
            </div>
          </div>
          ${renderComparisonBlock(comparison)}
        </div>
      </div>

      <!-- Радар и этапы -->
      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="card-title">Нечёткий профиль работы</div>
          <div class="chart-box h-260">
            <canvas id="studentRadarChart"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Прогресс по этапам</div>
          <div class="chart-box h-260">
            <canvas id="studentStagesChart"></canvas>
          </div>
        </div>
      </div>
    `;
    };

    function getStudentComparison(user, work) {
        if (!user || !work) return null;

        const myProgress = calcProgress(work.id);
        const myInputs = Utils.buildFuzzyInputs(work, myProgress);
        const myRes = Utils.safeFuzzyInfer(myInputs);
        if (!myRes) return null;

        // Все работы других студентов той же группы (или всех, если группы нет)
        const allWorks = Storage.getWorks().filter((w) => {
            if (Storage.sameId(w.id, work.id)) return false;
            const student = Storage.getUserById(w.studentId);
            if (!student) return false;
            if (!Utils.isActiveStatus(w.status)) return false;
            if (user.group) {
                return student.group === user.group;
            }
            return true;
        });

        if (allWorks.length === 0) return null;

        const others = allWorks
            .map((w) => {
                const p = calcProgress(w.id);
                const r = Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(w, p));
                if (!r) return null;
                return {
                    progress: p,
                    risk: r.risk.value,
                    rating: r.rating.value,
                };
            })
            .filter(Boolean);

        if (others.length === 0) return null;

        const avg = (key) =>
            others.reduce((a, o) => a + o[key], 0) / others.length;

        return {
            count: others.length,
            my: {
                progress: myProgress,
                risk: myRes.risk.value,
                rating: myRes.rating.value,
            },
            avg: {
                progress: Math.round(avg("progress")),
                risk: Math.round(avg("risk")),
                rating: Math.round(avg("rating")),
            },
        };
    }

    function renderComparisonBlock(cmp) {
        if (!cmp) {
            return `
        <div class="empty-state" style="padding:30px 20px;">
          ${SVG.users({ cls: "icon icon-2xl" })}
          <p style="color:var(--txt-muted);font-size:12px;margin-top:8px;">
            Недостаточно данных для сравнения.
            <br>Нужны другие студенты в вашей группе с активными работами.
          </p>
        </div>
      `;
        }

        const rows = [
            {
                label: "Прогресс",
                mine: cmp.my.progress,
                avg: cmp.avg.progress,
                higherIsBetter: true,
                unit: "%",
            },
            {
                label: "Риск",
                mine: Math.round(cmp.my.risk),
                avg: cmp.avg.risk,
                higherIsBetter: false,
                unit: "",
            },
            {
                label: "Рейтинг",
                mine: Math.round(cmp.my.rating),
                avg: cmp.avg.rating,
                higherIsBetter: true,
                unit: "",
            },
        ];

        return `
      <div class="compare-block">
        ${rows
            .map((r) => {
                const diff = r.mine - r.avg;
                const better = r.higherIsBetter ? diff > 0 : diff < 0;
                const worse = r.higherIsBetter ? diff < 0 : diff > 0;
                const diffCls = better ? "better" : worse ? "worse" : "same";
                const diffText =
                    diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "0";

                const maxVal = Math.max(r.mine, r.avg, 1);
                const minePct = (r.mine / maxVal) * 100;
                const avgPct = (r.avg / maxVal) * 100;

                return `
            <div class="compare-row">
              <div class="compare-head">
                <span class="compare-label">${escapeHtml(r.label)}</span>
                <span class="compare-diff ${diffCls}">
                  ${diffText}${r.unit}
                </span>
              </div>
              <div class="compare-bars">
                <div class="compare-bar">
                  <span class="compare-bar-lbl">Вы</span>
                  <div class="compare-bar-track">
                    <div class="compare-bar-fill mine" style="width:${minePct}%"></div>
                  </div>
                  <span class="compare-bar-val">${r.mine}${r.unit}</span>
                </div>
                <div class="compare-bar">
                  <span class="compare-bar-lbl">Ср.</span>
                  <div class="compare-bar-track">
                    <div class="compare-bar-fill avg" style="width:${avgPct}%"></div>
                  </div>
                  <span class="compare-bar-val">${r.avg}${r.unit}</span>
                </div>
              </div>
            </div>
          `;
            })
            .join("")}

        <div class="compare-note">
          ${SVG.info({ cls: "icon icon-xs" })}
          Сравнение с ${cmp.count} ${cmp.count === 1 ? "работой" : "работами"} других студентов${getUser().group ? ` группы ${escapeHtml(getUser().group)}` : ""}.
        </div>
      </div>
    `;
    }

    /* =========================================================
       ЛИНИЯ ВРЕМЕНИ — прогресс за 30 дней
       ========================================================= */
    function buildTimelineData(work, days = 30) {
        const stages = Storage.getStagesByWork(work.id);
        const start = Date.now() - days * 86400000;

        // Текущий прогресс
        const totalWeight = stages.reduce((s, x) => s + (x.weight || 1), 0);

        const data = [];
        const labels = [];

        for (let i = days - 1; i >= 0; i--) {
            const dayTs = Date.now() - i * 86400000;
            const dayEnd = new Date(dayTs);
            dayEnd.setHours(23, 59, 59, 999);

            // Прогресс на конец этого дня = все этапы, completed до дня
            const doneByDay = stages
                .filter(
                    (s) =>
                        s.done &&
                        s.completedAt &&
                        s.completedAt <= dayEnd.getTime(),
                )
                .reduce((sum, s) => sum + (s.weight || 1), 0);

            const pct = totalWeight
                ? Math.round((doneByDay / totalWeight) * 100)
                : 0;

            data.push(pct);
            labels.push(
                new Date(dayTs).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                }),
            );
        }

        return { labels, data };
    }

    /* =========================================================
       АКТИВНОСТЬ ПО ДНЯМ НЕДЕЛИ
       ========================================================= */
    function buildActivityData(work) {
        const dowLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
        const counts = [0, 0, 0, 0, 0, 0, 0];

        function dowIndex(ts) {
            const d = new Date(ts).getDay(); // 0=вс, 1=пн...
            return d === 0 ? 6 : d - 1;
        }

        // Этапы
        Storage.getStagesByWork(work.id).forEach((s) => {
            if (s.completedAt) counts[dowIndex(s.completedAt)]++;
            if (s.createdAt) counts[dowIndex(s.createdAt)]++;
        });

        // Задачи
        Storage.getTasksByWork(work.id).forEach((t) => {
            if (t.createdAt) counts[dowIndex(t.createdAt)]++;
            if (t.updatedAt && t.col === "done")
                counts[dowIndex(t.updatedAt)]++;
        });

        // Версии
        Storage.getVersionsByWork(work.id).forEach((v) => {
            if (v.createdAt) counts[dowIndex(v.createdAt)]++;
        });

        // Комментарии
        Storage.getCommentsByWork(work.id).forEach((c) => {
            if (c.createdAt) counts[dowIndex(c.createdAt)]++;
        });

        return { labels: dowLabels, data: counts };
    }

    VIEWS.stats_after = function () {
        if (!Charts.hasChart()) return;
        const work = getActiveWork();
        if (!work) return;

        const stages = Storage.getStagesByWork(work.id);
        const inputs = Utils.buildFuzzyInputs(work, calcProgress(work.id));
        if (!inputs) return;

        /* 1. Радар */
        Charts.radar(
            "studentRadarChart",
            [
                "Прогресс",
                "Активность",
                "Объём",
                "Оригинальность",
                "ГОСТ",
                "Оценка рук.",
            ],
            [
                {
                    label: "Текущие значения",
                    data: [
                        inputs.progress,
                        inputs.activity * 10,
                        inputs.volume,
                        inputs.orig ?? 50,
                        inputs.gost ?? 50,
                        (inputs.supScore ?? 5) * 10,
                    ],
                    color: Charts.COLORS.accent,
                },
            ],
        );

        /* 2. Прогресс по этапам */
        if (stages.length > 0) {
            Charts.bar(
                "studentStagesChart",
                stages.map((s) => s.name.slice(0, 15)),
                stages.map((s) => s.weight || 1),
                stages.map((s) =>
                    s.done ? Charts.COLORS.ok : Charts.COLORS.accent,
                ),
                { label: "Вес этапа", max: 5 },
            );
        }

        /* 3. Линия времени */
        const timeline = buildTimelineData(work, 30);
        const canvasT = document.getElementById("studentTimelineChart");
        if (canvasT) {
            if (canvasT._chart) {
                try {
                    canvasT._chart.destroy();
                } catch (e) {}
                canvasT._chart = null;
            }

            const C = Charts.COLORS;
            canvasT._chart = new Chart(canvasT, {
                type: "line",
                data: {
                    labels: timeline.labels,
                    datasets: [
                        {
                            label: "Прогресс, %",
                            data: timeline.data,
                            borderColor: C.accent,
                            backgroundColor: "rgba(99, 102, 241, 0.15)",
                            borderWidth: 2.5,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            tension: 0.35,
                            fill: true,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: "#fff",
                            titleColor: C.txt,
                            bodyColor: C.txt,
                            borderColor: C.line,
                            borderWidth: 1,
                        },
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                color: C.txt,
                                stepSize: 20,
                                callback: (v) => v + "%",
                            },
                            grid: { color: C.line, drawBorder: false },
                        },
                        x: {
                            ticks: {
                                color: C.txt,
                                maxTicksLimit: 8,
                            },
                            grid: { display: false },
                        },
                    },
                },
            });
        }

        /* 4. Активность по дням недели */
        const activity = buildActivityData(work);
        const canvasA = document.getElementById("studentActivityChart");
        if (canvasA) {
            if (canvasA._chart) {
                try {
                    canvasA._chart.destroy();
                } catch (e) {}
                canvasA._chart = null;
            }

            const C = Charts.COLORS;
            canvasA._chart = new Chart(canvasA, {
                type: "bar",
                data: {
                    labels: activity.labels,
                    datasets: [
                        {
                            label: "События",
                            data: activity.data,
                            backgroundColor: activity.data.map((v) =>
                                v === 0
                                    ? C.line
                                    : v >= 8
                                      ? C.ok
                                      : v >= 4
                                        ? C.accent
                                        : C.warn,
                            ),
                            borderRadius: 6,
                            maxBarThickness: 40,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: C.txt,
                                precision: 0,
                            },
                            grid: { color: C.line, drawBorder: false },
                        },
                        x: {
                            ticks: { color: C.txt },
                            grid: { display: false },
                        },
                    },
                },
            });
        }
    };

    function exportStatsPdf() {
        const u = getUser();
        const work = getActiveWork();
        if (!work) {
            App.toast("Нет активной работы");
            return;
        }

        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const versions = Storage.getVersionsByWork(work.id);
        const progress = calcProgress(work.id);
        const inputs = Utils.buildFuzzyInputs(work, progress);
        const res = Utils.safeFuzzyInfer(inputs);

        const student = Storage.getUserById(work.studentId);
        const teacher = Storage.getUserById(work.teacherId);

        const html = `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8">
<title>Статистика работы</title>
<style>
    body { font-family: 'Times New Roman', serif; padding: 40px; color: #1a1f29; line-height: 1.5; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin: 20px 0 10px; border-bottom: 2px solid #111; padding-bottom: 6px; }
    .sub { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0; }
    .kpi { padding: 14px; border: 1px solid #e2e5ea; border-radius: 8px; text-align: center; }
    .kpi-val { font-size: 24px; font-weight: 700; }
    .kpi-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e5ea; }
    th { background: #f5f6f8; font-size: 11px; text-transform: uppercase; color: #6b7280; }
    footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 11px; color: #9aa3b0; }
</style>
</head><body>

<h1>Статистика работы</h1>
<div class="sub">Сформирован ${new Date().toLocaleString("ru-RU")} · Meridian</div>

<h2>Работа</h2>
<p style="font-size:14px;"><b>${escapeHtml(work.topic)}</b></p>
<p style="font-size:12px;color:#6b7280;">
    ${escapeHtml(Utils.workTypeLabel(work.type))} ·
    Студент: ${escapeHtml(student?.fio || "—")} ·
    Руководитель: ${escapeHtml(teacher?.fio || "—")}
</p>

<h2>Ключевые показатели</h2>
<div class="grid">
    <div class="kpi"><div class="kpi-val">${progress}%</div><div class="kpi-lbl">Прогресс</div></div>
    <div class="kpi"><div class="kpi-val">${stages.filter((s) => s.done).length}/${stages.length}</div><div class="kpi-lbl">Этапы</div></div>
    <div class="kpi"><div class="kpi-val">${tasks.filter((t) => t.col === "done").length}/${tasks.length}</div><div class="kpi-lbl">Задачи</div></div>
    <div class="kpi"><div class="kpi-val">${versions.length}</div><div class="kpi-lbl">Версии</div></div>
</div>

<h2>Нечёткая оценка (Мамдани)</h2>
<div class="grid">
    <div class="kpi">
        <div class="kpi-val" style="color:${res.risk.term === "high" ? "#dc2626" : res.risk.term === "med" ? "#d97706" : "#16a34a"};">${res.risk.value.toFixed(0)}</div>
        <div class="kpi-lbl">Риск · ${Fuzzy.termLabel(res.risk.term, "risk")}</div>
    </div>
    <div class="kpi">
        <div class="kpi-val">${res.ready.value.toFixed(0)}</div>
        <div class="kpi-lbl">Готовность · ${Fuzzy.termLabel(res.ready.term, "ready")}</div>
    </div>
    <div class="kpi">
        <div class="kpi-val">${res.rating.value.toFixed(0)}</div>
        <div class="kpi-lbl">Рейтинг · ${Fuzzy.termLabel(res.rating.term, "rating")}</div>
    </div>
</div>

<h2>Этапы</h2>
<table>
    <thead><tr><th>Название</th><th>Вес</th><th>Статус</th><th>Дедлайн</th></tr></thead>
    <tbody>
        ${stages
            .map(
                (s) => `
            <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${s.weight || 1}</td>
                <td>${s.done ? "Выполнен" : "В работе"}</td>
                <td>${s.deadline || "—"}</td>
            </tr>
        `,
            )
            .join("")}
    </tbody>
</table>

<footer>
    Отчёт сгенерирован автоматически системой Meridian.
</footer>

</body></html>`;

        openPrintWindow(html, `Статистика — ${work.topic.slice(0, 40)}`);
    }

    function openPrintWindow(html, title) {
        try {
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const w = window.open(url, "_blank");
            if (!w) {
                App.toast("Разрешите всплывающие окна");
                URL.revokeObjectURL(url);
                return;
            }
            w.onload = () => {
                setTimeout(() => {
                    try {
                        w.print();
                    } catch (e) {}
                    URL.revokeObjectURL(url);
                }, 300);
            };
            if (typeof Audit !== "undefined") {
                Audit.log("Экспорт статистики", title || "", "", "info");
            }
        } catch (err) {
            console.error("[Student] Ошибка экспорта:", err);
            App.toast("Ошибка экспорта");
        }
    }

    /* =========================================================
       АКТИВНОСТЬ — фильтры, группировка по дате, поиск, экспорт
       ========================================================= */
    let actFilter = "all";
    let actSearch = "";

    VIEWS.activity = function () {
        const u = getUser();
        if (!u) return "";

        const allEvents = buildActivityEvents(u);

        // Фильтр по типу
        let filtered = allEvents;
        if (actFilter !== "all") {
            filtered = filtered.filter((e) => e.kind === actFilter);
        }

        // Поиск
        if (actSearch) {
            const q = actSearch.toLowerCase();
            filtered = filtered.filter(
                (e) =>
                    (e.title || "").toLowerCase().includes(q) ||
                    (e.text || "").toLowerCase().includes(q),
            );
        }

        // Сортировка (новые сверху)
        filtered = [...filtered].sort((a, b) => (b.time || 0) - (a.time || 0));

        // KPI по типам (все события, не фильтрованные)
        const counts = {
            work: allEvents.filter((e) => e.kind === "work").length,
            stage: allEvents.filter((e) => e.kind === "stage").length,
            task: allEvents.filter((e) => e.kind === "task").length,
            version: allEvents.filter((e) => e.kind === "version").length,
            comment: allEvents.filter((e) => e.kind === "comment").length,
            defense: allEvents.filter((e) => e.kind === "defense").length,
        };

        return `
      <!-- KPI по типам -->
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-lbl">Всего событий</div>
          <div class="metric-val">${allEvents.length}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Этапы</div>
          <div class="metric-val" style="color:var(--accent-viz)">${counts.stage}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Версии</div>
          <div class="metric-val" style="color:var(--info)">${counts.version}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Комментарии</div>
          <div class="metric-val" style="color:var(--warn)">${counts.comment}</div>
        </div>
      </div>

      <!-- Список активности -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            История активности
            <span class="count-chip">${filtered.length}</span>
          </div>
          ${
              allEvents.length > 0
                  ? `<button class="btn-ghost btn-sm" onclick="Student.exportActivity()">
                       ${SVG.download({ cls: "icon icon-sm" })}
                       <span>CSV</span>
                     </button>`
                  : ""
          }
        </div>

        <!-- Табы -->
        <div class="filter-tabs" style="margin-bottom:14px;">
          ${renderActTab("all", "Все", allEvents.length)}
          ${renderActTab("work", "Работы", counts.work)}
          ${renderActTab("stage", "Этапы", counts.stage)}
          ${renderActTab("task", "Задачи", counts.task)}
          ${renderActTab("version", "Версии", counts.version)}
          ${renderActTab("comment", "Комментарии", counts.comment)}
          ${renderActTab("defense", "Защита", counts.defense)}
        </div>

        <!-- Поиск -->
        <div class="review-toolbar">
          <input type="text"
            class="activity-search review-search"
            placeholder="Поиск по событиям…"
            value="${escapeHtml(actSearch)}"
            oninput="Student.setActivitySearch(this.value)">
        </div>

        ${
            filtered.length === 0
                ? emptyState(
                      allEvents.length === 0
                          ? "Активности пока нет"
                          : "Ничего не найдено",
                      allEvents.length === 0
                          ? "Здесь будут события вашей работы."
                          : "Измените фильтр или запрос.",
                      SVG.log,
                  )
                : renderActivityGrouped(filtered)
        }
      </div>
    `;
    };

    /* =========================================================
       ПОСТРОЕНИЕ СОБЫТИЙ
       ========================================================= */
    function buildActivityEvents(u) {
        const events = [];
        const works = getMyWorks();

        works.forEach((w) => {
            // Создание работы
            if (w.createdAt) {
                events.push({
                    time: w.createdAt,
                    kind: "work",
                    title: "Создана работа",
                    text: w.topic,
                });
            }

            // Утверждение
            if (w.approvedAt) {
                events.push({
                    time: w.approvedAt,
                    kind: "work",
                    title: "Заявка утверждена",
                    text: w.topic,
                });
            }

            // Отклонение
            if (w.status === "rejected" && w.rejectReason) {
                events.push({
                    time: w.updatedAt || w.createdAt,
                    kind: "work",
                    title: "Заявка отклонена",
                    text: w.rejectReason,
                });
            }

            // Защита
            if (w.status === "done" && w.defendedAt) {
                events.push({
                    time: w.defendedAt,
                    kind: "defense",
                    title: `Работа защищена${w.finalGrade ? ` · оценка ${w.finalGrade}` : ""}`,
                    text: w.gradeComment || w.topic,
                });
            }

            // Этапы
            Storage.getStagesByWork(w.id)
                .filter((s) => s.completedAt)
                .forEach((s) => {
                    events.push({
                        time: s.completedAt,
                        kind: "stage",
                        title: `Этап выполнен: ${s.name}`,
                        text: w.topic,
                    });
                });

            // Задачи (созданы + закрыты)
            Storage.getTasksByWork(w.id).forEach((t) => {
                if (t.createdAt) {
                    events.push({
                        time: t.createdAt,
                        kind: "task",
                        title: `Задача: ${t.title}`,
                        text: w.topic,
                    });
                }
                if (t.col === "done" && t.updatedAt && t.reviewedBy) {
                    const reviewer = Storage.getUserById(t.reviewedBy);
                    events.push({
                        time: t.reviewedAt || t.updatedAt,
                        kind: "task",
                        title: `Задача одобрена: ${t.title}`,
                        text: `Проверил: ${reviewer?.fio || "руководитель"}`,
                    });
                }
            });

            // Версии
            Storage.getVersionsByWork(w.id).forEach((v) => {
                events.push({
                    time: v.createdAt,
                    kind: "version",
                    title: `Версия v${v.version}`,
                    text: v.comment || v.filename || w.topic,
                });
            });

            // Комментарии
            Storage.getCommentsByWork(w.id).forEach((c) => {
                const author = Storage.getUserById(c.authorId);
                events.push({
                    time: c.createdAt,
                    kind: "comment",
                    title: `Комментарий от ${author?.fio || "руководителя"}`,
                    text: c.text,
                });
            });
        });

        return events;
    }

    /* =========================================================
       ГРУППИРОВКА ПО ДАТЕ
       ========================================================= */
    function getDateGroupLabel(ts) {
        const now = new Date();
        const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();
        const yesterdayStart = todayStart - 86400000;
        const weekStart = todayStart - 7 * 86400000;
        const monthStart = todayStart - 30 * 86400000;

        if (ts >= todayStart) return "Сегодня";
        if (ts >= yesterdayStart) return "Вчера";
        if (ts >= weekStart) return "На этой неделе";
        if (ts >= monthStart) return "В этом месяце";
        return "Раньше";
    }

    function renderActivityGrouped(events) {
        // Группировка
        const groups = {};
        const order = [
            "Сегодня",
            "Вчера",
            "На этой неделе",
            "В этом месяце",
            "Раньше",
        ];

        events.forEach((e) => {
            const label = getDateGroupLabel(e.time);
            if (!groups[label]) groups[label] = [];
            groups[label].push(e);
        });

        return order
            .filter((label) => groups[label] && groups[label].length > 0)
            .map(
                (label) => `
          <div class="activity-group">
            <div class="activity-group-label">${label}</div>
            <div class="activity-group-list">
              ${groups[label].map((e) => renderActivityRow(e)).join("")}
            </div>
          </div>
        `,
            )
            .join("");
    }

    function renderActivityRow(e) {
        const kindCls = e.kind;
        const iconFn =
            e.kind === "defense"
                ? SVG.award
                : e.kind === "comment"
                  ? SVG.messageCircle
                  : e.kind === "version"
                    ? SVG.fileText
                    : e.kind === "task"
                      ? SVG.check
                      : e.kind === "stage"
                        ? SVG.layers
                        : SVG.folder;

        return `
      <div class="activity-row activity-row-${kindCls}">
        <div class="activity-icon">
          ${iconFn({ cls: "icon icon-sm" })}
        </div>
        <div class="activity-body">
          <div class="activity-title">${escapeHtml(e.title)}</div>
          ${e.text ? `<div class="activity-text">${escapeHtml(e.text.slice(0, 140))}${e.text.length > 140 ? "…" : ""}</div>` : ""}
        </div>
        <div class="activity-time">
          ${fmtDateTime(e.time).split(", ")[1] || ""}
        </div>
      </div>
    `;
    }

    /* =========================================================
       УПРАВЛЕНИЕ
       ========================================================= */
    function renderActTab(id, label, count) {
        const active = actFilter === id ? "active" : "";
        return `
      <button class="filter-tab ${active}" onclick="Student.setActivityFilter('${id}')">
        ${escapeHtml(label)}
        <span class="count-chip" style="margin-left:6px;">${count}</span>
      </button>
    `;
    }

    function setActivityFilter(f) {
        actFilter = f;
        App.navigate("activity");
    }

    function setActivitySearch(q) {
        actSearch = q;
        App.navigate("activity");
        setTimeout(() => {
            const input = document.querySelector(".activity-search");
            if (input) {
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }, 0);
    }

    /* =========================================================
       ЭКСПОРТ CSV
       ========================================================= */
    function exportActivity() {
        const u = getUser();
        if (!u) return;

        const events = buildActivityEvents(u);
        if (events.length === 0) {
            App.toast("Нет событий");
            return;
        }

        const escapeCSV = (v) => {
            const s = String(v === null || v === undefined ? "" : v);
            if (s.includes('"') || s.includes(",") || s.includes("\n")) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };

        const rows = [["Дата", "Тип", "Событие", "Описание"]];
        events
            .sort((a, b) => b.time - a.time)
            .forEach((e) => {
                rows.push([fmtDateTime(e.time), e.kind, e.title, e.text || ""]);
            });

        const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `activity_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 500);

        App.toast(`Экспортировано ${events.length} событий`);
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

    VIEWS.docx = function () {
        const work = getActiveWork();
        if (!work) {
            return `
        <div class="card">
          ${emptyState(
              "Нет работы",
              "Создайте работу, чтобы проверить оформление по ГОСТу.",
              SVG.fileText,
              `<button class="btn-primary" onclick="App.navigate('create-work')">Создать работу</button>`,
          )}
        </div>
      `;
        }
        return DocxCheck.render(work.id);
    };

    VIEWS.docx_after = function () {
        const work = getActiveWork();
        if (!work) return;
        DocxCheck.initDrop(work.id);
        setTimeout(() => {
            DocxCheck.drawHistoryChart(work.id);
        }, 50);
    };

    function closeModal() {
        App.closeModal();
    }

    return {
        VIEWS,

        selectWork,
        clearSelectedWork,
        getActiveWork,
        getArchivedWorks,

        pickType,
        pickTeacher,
        filterTeachers,
        saveDraft,
        recreateFromRejected,

        updateWork,
        withdrawWork,
        toggleEditForm,
        markAllStagesDone,

        setArchivedFilter,
        setArchivedType,
        setArchivedSearch,
        setArchivedSort,
        exportStatsPdf,

        calPrevMonth,
        calNextMonth,
        calToday,
        selectCalendarDay,
        calToggleFilter,
        openQuickTaskModal,
        saveQuickTask,
        setActivityFilter,
        setActivitySearch,
        exportActivity,

        toggleStage,
        openStageModal,
        saveStage,
        deleteStage,

        dragTask,
        dropTask,
        openTaskModal,
        saveTask,
        deleteTask,

        openVersionModal,
        saveVersion,
        viewVersionComments,

        closeModal,
    };
})();
