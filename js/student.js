/* =========================================================
   STUDENT — весь функционал роли «Студент»
   Обновлено: использует Utils для общих хелперов
   ========================================================= */
const Student = (() => {
    /* =========================================================
       КОНСТАНТЫ (алиасы на Utils)
       ========================================================= */
    const WORK_TYPES = Utils.WORK_TYPES_LIST; // массив для UI
    const WORK_STATUSES = Utils.WORK_STATUSES;
    const TASK_COLS = Utils.TASK_COLS;

    /* =========================================================
       ХЕЛПЕРЫ (алиасы на Utils)
       ========================================================= */
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

    /* =========================================================
       ВЫБОР РАБОТЫ
       ========================================================= */
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

    /* =========================================================
       FUZZY
       ========================================================= */
    function getFuzzyInputs(work, progressOverride) {
        return Utils.buildFuzzyInputs(work, progressOverride);
    }

    function getFuzzyResult(work, progressOverride) {
        return Utils.safeFuzzyInfer(
            Utils.buildFuzzyInputs(work, progressOverride),
        );
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

        const header = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--txt);">
            Мои работы <span class="count-chip">${activeWorks.length}</span>
          </div>
          <div style="font-size:12px;color:var(--txt-muted);margin-top:4px;">
            ${escapeHtml(u.fio.split(" ").slice(0, 2).join(" "))}
            ${u.group ? " · " + escapeHtml(u.group) : ""}
          </div>
        </div>
        <button class="btn-primary btn-sm" onclick="App.navigate('create-work')">
          ${SVG.plus({ cls: "icon icon-sm" })}
          <span>Создать работу</span>
        </button>
      </div>
    `;

        return header + activeWorks.map((w) => renderWorkCard(w)).join("");
    };

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
        onclick="Student.selectWork(${work.id})">

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
          <button class="btn-ghost btn-sm" onclick="event.stopPropagation(); Student.selectWork(${work.id})">
            Открыть →
          </button>
        </div>

        <div class="pbar" style="margin-top:16px;">
          <div class="pbar-track">
            <div class="pbar-fill ${Utils.progressClass(progress)}" style="width:${progress}%"></div>
          </div>
          <div class="pbar-val">${progress}%</div>
        </div>

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

    /* ---------------------------------------------------------
       СОЗДАНИЕ РАБОТЫ
       --------------------------------------------------------- */
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
           onclick="Student.pickTeacher(${t.id})">
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
    /* ---------------------------------------------------------
       МОЯ РАБОТА
       --------------------------------------------------------- */
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
      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--txt-muted);margin-bottom:10px;">
          Активные работы (${allActive.length}) — выберите:
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${allActive
              .map(
                  (w) => `
            <button class="btn-ghost btn-sm"
              style="${Storage.sameId(w.id, work.id) ? "border-color:var(--accent);color:var(--accent);background:var(--accent-soft);" : ""}"
              onclick="Student.selectWork(${w.id})">
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
        const versions = Storage.getVersionsByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);
        const canEdit = work.status === "draft" || work.status === "pending";

        return `
      ${workSelector}

      <div class="card">
        <div class="card-head">
          <div class="card-title">Информация о работе</div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${statusBadge(work.status)}
            <button class="btn-ghost btn-sm" onclick="App.navigate('create-work')">
              ${SVG.plus({ cls: "icon icon-sm" })}
              <span>Работа</span>
            </button>
          </div>
        </div>

        <div class="form-grid">
          <div class="field full">
            <label>Тип работы</label>
            <input type="text" value="${escapeHtml(workTypeLabel(work.type))}" readonly>
          </div>
          <div class="field full">
            <label>Тема</label>
            <input type="text" value="${escapeHtml(work.topic)}" ${!canEdit ? "readonly" : ""}
              onchange="Student.updateWork('topic', this.value)">
          </div>
          <div class="field full">
            <label>Аннотация</label>
            <textarea rows="3" ${!canEdit ? "readonly" : ""}
              onchange="Student.updateWork('annotation', this.value)">${escapeHtml(work.annotation || "")}</textarea>
          </div>
          <div class="field">
            <label>Цель</label>
            <input type="text" value="${escapeHtml(work.goal || "")}" ${!canEdit ? "readonly" : ""}
              onchange="Student.updateWork('goal', this.value)">
          </div>
          <div class="field">
            <label>Дата защиты</label>
            <input type="date" value="${work.deadline || ""}" ${!canEdit ? "readonly" : ""}
              onchange="Student.updateWork('deadline', this.value)">
          </div>
          <div class="field full">
            <label>Руководитель</label>
            <input type="text" value="${escapeHtml(teacherName(work.teacherId))}" readonly>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:12px;">
          ${
              work.status === "pending"
                  ? `<button class="btn-ghost" onclick="Student.withdrawWork()">Отозвать заявку</button>`
                  : ""
          }
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title">Этапы работы</div>
          <div style="display:flex;gap:8px;">
            <button class="btn-ghost btn-sm" onclick="PdfReport.exportStudent(${work.id})">
              ${SVG.fileText({ cls: "icon icon-sm" })}
              <span>PDF</span>
            </button>
            <button class="btn-primary btn-sm" onclick="Student.openStageModal()">
              ${SVG.plus({ cls: "icon icon-sm" })}
              <span>Добавить этап</span>
            </button>
          </div>
        </div>

        <div class="pbar" style="margin-bottom:16px;">
          <div class="pbar-track">
            <div class="pbar-fill ${Utils.progressClass(progress)}"
              style="width:${progress}%"></div>
          </div>
          <div class="pbar-val">${progress}%</div>
        </div>

        <div id="stagesList">
          ${
              stages.length === 0
                  ? emptyState(
                        "Этапов пока нет",
                        "Добавьте первый этап работы — например, «Глава 1. Теоретическая часть».",
                        SVG.layers,
                        `<button class="btn-primary" onclick="Student.openStageModal()">
                           ${SVG.plus({ cls: "icon icon-sm" })}
                           <span>Добавить этап</span>
                         </button>`,
                    )
                  : stages.map((s) => renderStageItem(s)).join("")
          }
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title">Задачи</div>
          <button class="btn-primary btn-sm" onclick="Student.openTaskModal()">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Добавить задачу</span>
          </button>
        </div>
        ${renderKanban(work.id)}
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title">Версии документа</div>
          <button class="btn-primary btn-sm" onclick="Student.openVersionModal()">
            ${SVG.upload({ cls: "icon icon-sm" })}
            <span>Загрузить версию</span>
          </button>
        </div>
        ${
            versions.length === 0
                ? emptyState(
                      "Версий пока нет",
                      "Загрузите первую версию документа, чтобы отслеживать прогресс.",
                      SVG.fileText,
                      `<button class="btn-primary" onclick="Student.openVersionModal()">
                         ${SVG.upload({ cls: "icon icon-sm" })}
                         <span>Загрузить версию</span>
                       </button>`,
                  )
                : versions.map((v) => renderVersionRow(v)).join("")
        }
      </div>

      <div class="card mt-16">
        <div class="card-title">Замечания руководителя</div>
        ${
            comments.length === 0
                ? emptyState(
                      "Замечаний пока нет",
                      "Здесь будут появляться комментарии и замечания от руководителя.",
                      SVG.messageCircle,
                  )
                : comments.map((c) => renderComment(c)).join("")
        }
      </div>
    `;
    };

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

    /* ---------------------------------------------------------
       ЗАВЕРШЁННЫЕ РАБОТЫ
       --------------------------------------------------------- */
    VIEWS.archived = function () {
        const works = getArchivedWorks();

        if (works.length === 0) {
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

        works.sort((a, b) => {
            if (a.status !== b.status) return a.status === "done" ? -1 : 1;
            return (
                (b.defendedAt || b.updatedAt || 0) -
                (a.defendedAt || a.updatedAt || 0)
            );
        });

        const doneCount = works.filter((w) => w.status === "done").length;
        const rejectedCount = works.filter(
            (w) => w.status === "rejected",
        ).length;

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Завершённые работы (${works.length})</div>
          <button class="btn-primary btn-sm" onclick="App.navigate('create-work')">
            ${SVG.plus({ cls: "icon icon-sm" })}
            <span>Создать работу</span>
          </button>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
          ${
              doneCount > 0
                  ? `<span class="badge done">${SVG.check({ cls: "icon icon-xs" })} Защищено: ${doneCount}</span>`
                  : ""
          }
          ${
              rejectedCount > 0
                  ? `<span class="badge rejected">${SVG.x({ cls: "icon icon-xs" })} Отклонено: ${rejectedCount}</span>`
                  : ""
          }
        </div>

        ${works.map((w) => renderArchivedCard(w)).join("")}
      </div>
    `;
    };

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
          <button class="btn-ghost btn-sm" onclick="PdfReport.exportStudent(${work.id})">
            ${SVG.fileText({ cls: "icon icon-sm" })}
            <span>Скачать PDF</span>
          </button>
          ${
              !isDone
                  ? `
            <button class="btn-primary btn-sm" onclick="Student.recreateFromRejected(${work.id})">
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

    /* ---------------------------------------------------------
       ЭТАПЫ
       --------------------------------------------------------- */
    function renderStageItem(s) {
        return `
      <div class="stage-item ${s.done ? "done" : ""}">
        <div class="stage-check ${s.done ? "on" : ""}" onclick="Student.toggleStage(${s.id})"></div>
        <div class="stage-body">
          <div class="stage-name">${escapeHtml(s.name)}</div>
          <div class="stage-meta">
            ${s.deadline ? `до ${escapeHtml(s.deadline)}` : "без дедлайна"}
            · вес ${s.weight || 1}
            ${s.description ? " · " + escapeHtml(s.description) : ""}
          </div>
        </div>
        <div class="stage-actions">
          <button class="btn-icon" onclick="Student.openStageModal(${s.id})" title="Редактировать">
            ${SVG.edit({ cls: "icon icon-sm" })}
          </button>
          <button class="btn-icon danger" onclick="Student.deleteStage(${s.id})" title="Удалить">
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
            <button class="btn-primary" onclick="Student.saveStage(${id || "null"})">
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

        if (id) {
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

    /* ---------------------------------------------------------
       КАНБАН
       --------------------------------------------------------- */
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
      <div class="task-card" draggable="true" ondragstart="Student.dragTask(event, ${t.id})">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span style="${deadlineCls}">
            ${t.deadline ? (deadline >= 0 ? "до " + escapeHtml(t.deadline) : "просрочено") : "—"}
          </span>
          <span>
            <button class="btn-icon" onclick="event.stopPropagation();Student.openTaskModal(${t.id})" title="Редактировать">
              ${SVG.edit({ cls: "icon icon-xs" })}
            </button>
            <button class="btn-icon danger" onclick="event.stopPropagation();Student.deleteTask(${t.id})" title="Удалить">
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

        /* Нельзя двигать из review/done */
        if (t.col === "review" || t.col === "done") {
            App.toast("Эту задачу проверяет руководитель");
            dragTaskId = null;
            return;
        }

        /* Нельзя сразу в done — только через review */
        if (col === "done") {
            App.toast("Задача попадёт в «Готово» после проверки руководителем");
            dragTaskId = null;
            return;
        }

        /* Нельзя в review, если задача в todo (нужно сначала «в работу») */
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
            <button class="btn-primary" onclick="Student.saveTask(${id || "null"})">
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

        if (id) {
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

    /* ---------------------------------------------------------
       ВЕРСИИ
       --------------------------------------------------------- */
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
        <button class="btn-icon" onclick="Student.viewVersionComments(${v.id})" title="Замечания">
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

    /* ---------------------------------------------------------
       КОММЕНТАРИИ К ВЕРСИЯМ
       --------------------------------------------------------- */
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
    /* ---------------------------------------------------------
       ПРОФИЛЬ
       --------------------------------------------------------- */
    VIEWS.profile = function () {
        const u = getUser();
        if (!u) return "";
        const works = getMyWorks();

        let totalProgress = 0;
        let totalRating = 0;
        let cnt = 0;

        works.forEach((w) => {
            const progress = calcProgress(w.id);
            const res = getFuzzyResult(w, progress);
            totalProgress += progress;
            totalRating += res.rating.value;
            cnt++;
        });

        const avgProgress = cnt ? Math.round(totalProgress / cnt) : 0;
        const avgRating = cnt ? Math.round(totalRating / cnt) : 0;

        const init = Utils.initials(u.fio);

        return `
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
          </div>
        </div>
        <div class="profile-hero-stats">
          <div class="stat-mini">
            <div class="num">${works.length}</div>
            <div class="lbl">Работ</div>
          </div>
          <div class="stat-mini">
            <div class="num">${avgProgress}%</div>
            <div class="lbl">Ср. прогресс</div>
          </div>
          <div class="stat-mini">
            <div class="num" style="color:var(--accent)">${avgRating}</div>
            <div class="lbl">Ср. рейтинг</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Личные данные</div>
          <div class="info-grid">
            <div class="info-item"><div class="info-lbl">ФИО</div><div class="info-val">${escapeHtml(u.fio)}</div></div>
            <div class="info-item"><div class="info-lbl">Email</div><div class="info-val">${escapeHtml(u.email)}</div></div>
            <div class="info-item"><div class="info-lbl">Факультет</div><div class="info-val">${escapeHtml(u.faculty || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Группа</div><div class="info-val">${escapeHtml(u.group || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Курс</div><div class="info-val">${u.course || "—"}</div></div>
            <div class="info-item"><div class="info-lbl">Направление</div><div class="info-val">${escapeHtml(u.direction || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Номер зачётки</div><div class="info-val">${escapeHtml(u.recordBook || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Дата регистрации</div><div class="info-val">${fmtDate(u.createdAt)}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Нечёткий профиль</div>
          <div class="chart-box h-220">
            <canvas id="studentProfileRadar"></canvas>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Мои работы (${works.length})</div>
        ${
            works.length === 0
                ? '<div class="empty">Работ пока нет</div>'
                : works
                      .map((w) => {
                          const progress = calcProgress(w.id);
                          const res = getFuzzyResult(w, progress);
                          return `
                <div class="mini-project" onclick="Student.selectWork(${w.id})">
                  <div>
                    <div class="mini-project-title">${escapeHtml(w.topic)}</div>
                    <div class="mini-project-sub">
                      ${escapeHtml(workTypeLabel(w.type))} · ${statusBadge(w.status)}
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:14px;font-weight:600;">${progress}%</div>
                    <div style="font-size:11px;color:var(--txt-muted);">риск ${res.risk.value.toFixed(0)}</div>
                  </div>
                </div>
              `;
                      })
                      .join("")
        }
      </div>

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

    /* ---------------------------------------------------------
       КАЛЕНДАРЬ
       --------------------------------------------------------- */
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

        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);

        const events = [];
        stages
            .filter((s) => s.deadline && !s.done)
            .forEach((s) =>
                events.push({ date: s.deadline, title: s.name, kind: "stage" }),
            );
        tasks
            .filter((t) => t.deadline && t.col !== "done")
            .forEach((t) =>
                events.push({ date: t.deadline, title: t.title, kind: "task" }),
            );
        if (work.deadline) {
            events.push({
                date: work.deadline,
                title: "Защита работы",
                kind: "defense",
            });
        }

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
        for (let i = 0; i < startOffset; i++) {
            cells += '<div class="calendar-day empty"></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = d === now.getDate();
            const hasEvents = eventsByDay[d];
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const days = daysUntil(dateStr);
            const isUrgent = hasEvents && days <= 3 && days >= 0;
            const tooltip = hasEvents
                ? hasEvents.map((e) => e.title).join("\n")
                : "";
            cells += `
        <div class="calendar-day ${isToday ? "today" : ""} ${hasEvents ? "has-deadline" : ""} ${isUrgent ? "urgent" : ""}"
          title="${escapeHtml(tooltip)}">
          ${d}
        </div>
      `;
        }

        const upcoming = events
            .map((e) => ({ ...e, days: daysUntil(e.date) }))
            .filter((e) => e.days >= 0)
            .sort((a, b) => a.days - b.days)
            .slice(0, 8);

        return `
      <div class="card">
        <div class="card-title">${monthNames[month]} ${year}</div>
        <div class="calendar-grid">
          ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
              .map((d) => `<div class="calendar-head">${d}</div>`)
              .join("")}
          ${cells}
        </div>
        <div class="calendar-legend">
          <div class="calendar-legend-item">
            <span class="calendar-legend-dot warn"></span>
            <span>Есть дедлайны</span>
          </div>
          <div class="calendar-legend-item">
            <span class="calendar-legend-dot bad"></span>
            <span>Срочно (≤3 дня)</span>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Ближайшие события</div>
        ${
            upcoming.length === 0
                ? '<div class="empty">Событий нет</div>'
                : upcoming
                      .map(
                          (e) => `
              <div class="timeline-item ${e.days <= 3 ? "bad" : e.days <= 7 ? "warn" : ""}">
                <div class="timeline-time">${fmtDate(e.date)} · через ${e.days} дн.</div>
                <div class="timeline-title">${escapeHtml(e.title)}</div>
              </div>
            `,
                      )
                      .join("")
        }
      </div>
    `;
    };

    /* ---------------------------------------------------------
       СТАТИСТИКА
       --------------------------------------------------------- */
    VIEWS.stats = function () {
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

        const progress = calcProgress(work.id);
        const stagesDone = stages.filter((s) => s.done).length;
        const tasksDone = tasks.filter((t) => t.col === "done").length;

        const inputs = Utils.buildFuzzyInputs(work, progress);
        const res = Utils.safeFuzzyInfer(inputs);

        return `
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-lbl">Прогресс</div>
          <div class="metric-val">${progress}%</div>
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

      <div class="card mt-16">
        <div class="card-title">Итоговые показатели (Мамдани)</div>
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
    `;
    };

    VIEWS.stats_after = function () {
        if (!Charts.hasChart()) return;
        const work = getActiveWork();
        if (!work) return;

        const stages = Storage.getStagesByWork(work.id);
        const inputs = Utils.buildFuzzyInputs(work, calcProgress(work.id));
        if (!inputs) return;

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
    };

    /* ---------------------------------------------------------
       АКТИВНОСТЬ
       --------------------------------------------------------- */
    VIEWS.activity = function () {
        const u = getUser();
        if (!u) return "";

        const events = [];

        /* Все работы студента */
        const works = getMyWorks();
        works.forEach((w) => {
            /* Создание работы */
            events.push({
                time: w.createdAt,
                title: `Создана работа: ${w.topic.slice(0, 60)}`,
                text: workTypeLabel(w.type),
                kind: "info",
            });

            /* Одобрение заявки */
            if (w.approvedAt) {
                events.push({
                    time: w.approvedAt,
                    title: `Заявка утверждена: ${w.topic.slice(0, 50)}`,
                    text: "Руководитель одобрил заявку",
                    kind: "done",
                });
            }

            /* Отклонение */
            if (w.status === "rejected" && w.rejectReason) {
                events.push({
                    time: w.updatedAt || w.createdAt,
                    title: `Заявка отклонена: ${w.topic.slice(0, 50)}`,
                    text: w.rejectReason,
                    kind: "warn",
                });
            }

            /* Защита */
            if (w.status === "done" && w.defendedAt) {
                events.push({
                    time: w.defendedAt,
                    title: `Работа защищена: ${w.topic.slice(0, 50)}`,
                    text: w.finalGrade ? `Оценка: ${w.finalGrade}` : "",
                    kind: "done",
                });
            }

            /* Версии */
            Storage.getVersionsByWork(w.id).forEach((v) => {
                events.push({
                    time: v.createdAt,
                    title: `Загружена версия v${v.version}`,
                    text: v.comment || "",
                    kind: "info",
                });
            });

            /* Комментарии */
            Storage.getCommentsByWork(w.id).forEach((c) => {
                const author = Storage.getUserById(c.authorId);
                events.push({
                    time: c.createdAt,
                    title: `Комментарий от ${author?.fio || "—"}`,
                    text: c.text,
                    kind: "warn",
                });
            });

            /* Выполненные этапы */
            Storage.getStagesByWork(w.id)
                .filter((s) => s.completedAt)
                .forEach((s) => {
                    events.push({
                        time: s.completedAt,
                        title: `Этап выполнен: ${s.name}`,
                        text: "",
                        kind: "done",
                    });
                });
        });

        events.sort((a, b) => b.time - a.time);
        const shown = events.slice(0, 100);

        return `
      <div class="card">
        <div class="card-title">История активности (${events.length})</div>
        ${
            events.length === 0
                ? '<div class="empty">Активности пока нет</div>'
                : `<div class="timeline">
                     ${shown
                         .map(
                             (e) => `
                       <div class="timeline-item ${e.kind === "done" ? "done" : e.kind === "warn" ? "warn" : ""}">
                         <div class="timeline-time">${fmtDateTime(e.time)}</div>
                         <div class="timeline-title">${escapeHtml(e.title)}</div>
                         ${e.text ? `<div class="timeline-text">${escapeHtml(e.text)}</div>` : ""}
                       </div>
                     `,
                         )
                         .join("")}
                     ${
                         events.length > 100
                             ? `<div class="empty" style="padding:12px;font-size:11px;">Показаны последние 100 из ${events.length}</div>`
                             : ""
                     }
                   </div>`
        }
      </div>
    `;
    };

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
        if (work) DocxCheck.initDrop(work.id);
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

        /* Стейт */
        selectWork,
        clearSelectedWork,
        getActiveWork,
        getArchivedWorks,

        /* Создание */
        pickType,
        pickTeacher,
        filterTeachers,
        saveDraft,
        recreateFromRejected,

        /* Работа */
        updateWork,
        withdrawWork,

        /* Этапы */
        toggleStage,
        openStageModal,
        saveStage,
        deleteStage,

        /* Задачи */
        dragTask,
        dropTask,
        openTaskModal,
        saveTask,
        deleteTask,

        /* Версии */
        openVersionModal,
        saveVersion,
        viewVersionComments,

        /* Утилиты */
        closeModal,
    };
})();
