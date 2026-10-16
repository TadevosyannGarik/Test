const Consult = (() => {
    const KEY = "fp_consults";

    const STATUS = {
        pending: "pending", // ждём преподавателя
        rescheduled: "rescheduled", // преподаватель предложил новое время, ждём студента
        approved: "approved", // согласовано
        rejected: "rejected", // отклонено
        done: "done", // проведена
    };

    const STATUS_LABELS = {
        pending: "Ожидает ответа",
        rescheduled: "Предложено время",
        approved: "Согласована",
        rejected: "Отклонена",
        done: "Проведена",
    };

    const STATUS_SHORT = {
        pending: "Ожидает",
        rescheduled: "Согласование",
        approved: "Согласована",
        rejected: "Отклонена",
        done: "Проведена",
    };

    const escapeHtml =
        typeof Utils !== "undefined" && Utils.escapeHtml
            ? Utils.escapeHtml
            : (str) => {
                  if (str === null || str === undefined) return "";
                  return String(str)
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");
              };

    function getUser() {
        return typeof Auth !== "undefined" ? Auth.getUser() : null;
    }

    /* =========================================================
       ХРАНИЛИЩЕ
       ========================================================= */
    function getAll() {
        const list = Storage.get(KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function setAll(list) {
        Storage.set(KEY, Array.isArray(list) ? list : []);
    }

    /* =========================================================
       ПАРСИНГ ДАТ
       Формат: "DD.MM.YYYY, HH:MM"
       ========================================================= */
    function parseRuDatetime(str) {
        if (!str) return null;
        const m = String(str).match(
            /^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})$/,
        );
        if (!m) return null;
        const [, d, mo, y, h, mi] = m;
        const dt = new Date(+y, +mo - 1, +d, +h, +mi, 0, 0);
        return isNaN(dt.getTime()) ? null : dt;
    }

    function daysUntilConsult(str) {
        const dt = parseRuDatetime(str);
        if (!dt) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(dt);
        target.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - now.getTime()) / 86400000);
    }

    function countdownLabel(str) {
        const days = daysUntilConsult(str);
        if (days === null) return "";
        if (days === 0) return "сегодня";
        if (days === 1) return "завтра";
        if (days > 1) return `через ${days} дн.`;
        if (days === -1) return "вчера";
        return `${Math.abs(days)} дн. назад`;
    }

    function countdownClass(str) {
        const days = daysUntilConsult(str);
        if (days === null) return "";
        if (days < 0) return "past";
        if (days <= 1) return "urgent";
        if (days <= 3) return "soon";
        return "far";
    }

    /* =========================================================
       ФИЛЬТРЫ
       ========================================================= */
    function forStudent(studentId) {
        return getAll()
            .filter((c) => Storage.sameId(c.studentId, studentId))
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    function forTeacher(teacherId) {
        return getAll()
            .filter((c) => Storage.sameId(c.teacherId, teacherId))
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    function forUser(user) {
        if (!user) return [];
        if (user.role === "student") return forStudent(user.id);
        if (user.role === "teacher") return forTeacher(user.id);
        return getAll().sort((a, b) => b.createdAt - a.createdAt);
    }

    function canModify(consult, user) {
        if (!consult || !user) return false;
        if (user.role === "admin") return true;
        if (user.role === "student")
            return Storage.sameId(consult.studentId, user.id);
        if (user.role === "teacher")
            return Storage.sameId(consult.teacherId, user.id);
        return false;
    }

    function proposedByLabel(c) {
        // Для старых данных без proposedBy — считаем, что предложил студент
        const by = c.proposedBy || "student";
        return by === "teacher" ? "Преподаватель" : "Студент";
    }

    /* =========================================================
       СОЗДАНИЕ
       ========================================================= */
    function create({ studentId, teacherId, datetime, topic, comment }) {
        if (!studentId || !teacherId || !datetime || !topic) {
            App.toast("Не все поля заполнены");
            return null;
        }

        const teacher = Storage.getUserById(teacherId);
        if (!teacher) {
            App.toast("Руководитель не найден");
            return null;
        }

        const user = getUser();
        const now = Date.now();

        const list = getAll();
        const consult = {
            id: uid(),
            studentId,
            teacherId,
            datetime,
            topic,
            comment: comment || "",
            status: STATUS.pending,
            proposedBy: user?.role === "teacher" ? "teacher" : "student",
            response: "",
            history: [
                {
                    by: user?.role === "teacher" ? "teacher" : "student",
                    datetime,
                    comment: comment || "",
                    at: now,
                },
            ],
            createdAt: now,
            updatedAt: now,
        };
        list.push(consult);
        setAll(list);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: teacherId,
                type: "info",
                title: "Новая заявка на консультацию",
                text: `Студент предлагает ${datetime}. Тема: ${topic}`,
                link: { view: "consultations" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Создана заявка на консультацию",
                datetime,
                topic,
                "info",
            );
        }

        return consult;
    }

    /* =========================================================
       ДЕЙСТВИЯ
       ========================================================= */
    function doApprove(id, response) {
        const user = getUser();
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!canModify(c, user)) {
            App.toast("Нет прав на это действие");
            return;
        }
        if (c.status !== STATUS.pending) {
            App.toast("Заявка не в статусе ожидания");
            return;
        }

        c.status = STATUS.approved;
        c.response = response || "";
        c.updatedAt = Date.now();
        setAll(list);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: c.studentId,
                type: "approve",
                title: "Консультация подтверждена",
                text: `${c.datetime} · ${c.topic}`,
                link: { view: "consultations" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Подтверждена консультация", c.datetime, "", "positive");
        }
    }

    function doReject(id, reason) {
        const user = getUser();
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!canModify(c, user)) {
            App.toast("Нет прав на это действие");
            return;
        }
        if (c.status !== STATUS.pending && c.status !== STATUS.rescheduled) {
            App.toast("Заявка уже обработана");
            return;
        }

        c.status = STATUS.rejected;
        c.response = reason || "";
        c.updatedAt = Date.now();
        setAll(list);

        const notifyUserId =
            user.role === "teacher" ? c.studentId : c.teacherId;

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: notifyUserId,
                type: "reject",
                title: "Консультация отклонена",
                text: reason || "",
                link: { view: "consultations" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Отклонена консультация",
                c.datetime,
                reason || "",
                "negative",
            );
        }
    }

    function doMarkDone(id) {
        const user = getUser();
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!canModify(c, user)) {
            App.toast("Нет прав на это действие");
            return;
        }
        if (c.status !== STATUS.approved) {
            App.toast("Можно отметить только согласованную");
            return;
        }

        c.status = STATUS.done;
        c.updatedAt = Date.now();
        setAll(list);

        if (typeof Audit !== "undefined") {
            Audit.log("Консультация проведена", c.datetime, "", "info");
        }
    }

    function doCancel(id) {
        const user = getUser();
        if (!user) return;
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!Storage.sameId(c.studentId, user.id)) {
            App.toast("Только студент может отменить свою заявку");
            return;
        }
        if (c.status !== STATUS.pending) {
            App.toast("Можно отменить только ожидающую заявку");
            return;
        }

        c.status = STATUS.rejected;
        c.response = "Отменено студентом";
        c.updatedAt = Date.now();
        setAll(list);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: c.teacherId,
                type: "info",
                title: "Заявка отменена студентом",
                text: `${c.datetime} · ${c.topic}`,
                link: { view: "consultations" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Заявка отменена", c.datetime, "", "warning");
        }
    }

    /**
     * Предложить новое время.
     * - если был pending (препод) → rescheduled
     * - если был rescheduled (студент) → pending
     */
    function proposeTime(id, datetime, comment) {
        const user = getUser();
        if (!user) return;
        if (!datetime) {
            App.toast("Укажите дату и время");
            return;
        }

        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!canModify(c, user)) {
            App.toast("Нет прав на это действие");
            return;
        }

        const isTeacher = user.role === "teacher";

        if (isTeacher && c.status !== STATUS.pending) {
            App.toast("Предложить время можно только ожидающей заявке");
            return;
        }
        if (!isTeacher && c.status !== STATUS.rescheduled) {
            App.toast("Нет активного предложения для ответа");
            return;
        }

        const now = Date.now();

        if (!Array.isArray(c.history)) c.history = [];
        c.history.push({
            by: isTeacher ? "teacher" : "student",
            datetime,
            comment: comment || "",
            at: now,
        });

        c.datetime = datetime;
        c.comment = comment || c.comment || "";
        c.proposedBy = isTeacher ? "teacher" : "student";
        c.status = isTeacher ? STATUS.rescheduled : STATUS.pending;
        c.updatedAt = now;
        setAll(list);

        const notifyUserId = isTeacher ? c.studentId : c.teacherId;

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: notifyUserId,
                type: "info",
                title: isTeacher
                    ? "Преподаватель предложил другое время"
                    : "Студент предложил другое время",
                text: `${datetime} · ${c.topic}`,
                link: { view: "consultations" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log(
                isTeacher
                    ? "Преподаватель предложил время"
                    : "Студент предложил время",
                datetime,
                c.topic,
                "info",
            );
        }
    }

    /**
     * Студент принимает предложенное преподавателем время.
     */
    function acceptTime(id) {
        const user = getUser();
        if (!user) return;
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!Storage.sameId(c.studentId, user.id)) {
            App.toast("Принять может только студент");
            return;
        }
        if (c.status !== STATUS.rescheduled) {
            App.toast("Нет предложения для подтверждения");
            return;
        }

        c.status = STATUS.approved;
        c.response = "Студент подтвердил предложенное время";
        c.updatedAt = Date.now();
        setAll(list);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: c.teacherId,
                type: "approve",
                title: "Студент подтвердил время",
                text: `${c.datetime} · ${c.topic}`,
                link: { view: "consultations" },
            });
        }

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Студент подтвердил время консультации",
                c.datetime,
                "",
                "positive",
            );
        }
    }

    /* =========================================================
       ФИЛЬТРЫ / KPI
       ========================================================= */
    let consultFilter = "all";
    let consultSearch = "";

    function setConsultFilter(f) {
        consultFilter = f;
        App.navigate("consultations");
    }

    function setConsultSearch(q) {
        consultSearch = q;
        App.navigate("consultations");
        setTimeout(() => {
            const input = document.querySelector(".consult-search");
            if (input) {
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }, 0);
    }

    function applyFilter(list) {
        let result = list;

        if (consultFilter === "active") {
            result = result.filter(
                (c) =>
                    c.status === STATUS.pending ||
                    c.status === STATUS.rescheduled,
            );
        } else if (consultFilter === "approved") {
            result = result.filter((c) => c.status === STATUS.approved);
        } else if (consultFilter === "done") {
            result = result.filter((c) => c.status === STATUS.done);
        } else if (consultFilter === "rejected") {
            result = result.filter((c) => c.status === STATUS.rejected);
        }

        if (consultSearch) {
            const q = consultSearch.toLowerCase();
            result = result.filter((c) => {
                const student = Storage.getUserById(c.studentId);
                const teacher = Storage.getUserById(c.teacherId);
                return (
                    (c.topic || "").toLowerCase().includes(q) ||
                    (c.comment || "").toLowerCase().includes(q) ||
                    (student?.fio || "").toLowerCase().includes(q) ||
                    (teacher?.fio || "").toLowerCase().includes(q)
                );
            });
        }

        // Сортировка: сначала активные, потом по дате консультации
        const priority = {
            pending: 0,
            rescheduled: 1,
            approved: 2,
            done: 3,
            rejected: 4,
        };
        return [...result].sort((a, b) => {
            const pa = priority[a.status] ?? 9;
            const pb = priority[b.status] ?? 9;
            if (pa !== pb) return pa - pb;

            const da = parseRuDatetime(a.datetime);
            const db = parseRuDatetime(b.datetime);
            if (da && db) return da - db;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function renderPage(user) {
        if (!user)
            return '<div class="card"><div class="empty">Пользователь не найден</div></div>';

        const list = forUser(user);

        const pending = list.filter((c) => c.status === STATUS.pending);
        const rescheduled = list.filter((c) => c.status === STATUS.rescheduled);
        const approved = list.filter((c) => c.status === STATUS.approved);
        const done = list.filter((c) => c.status === STATUS.done);
        const rejected = list.filter((c) => c.status === STATUS.rejected);

        const filtered = applyFilter(list);

        return `
      <!-- KPI -->
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${list.length}</div>
          <div class="kpi-lbl">Всего</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:${pending.length + rescheduled.length > 0 ? "var(--warn)" : "var(--txt-muted)"}">
            ${pending.length + rescheduled.length}
          </div>
          <div class="kpi-lbl">Ожидают</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--ok)">${approved.length}</div>
          <div class="kpi-lbl">Согласованы</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--txt-muted)">${done.length}</div>
          <div class="kpi-lbl">Проведены</div>
        </div>
      </div>

      <!-- Основная карточка -->
      <div class="card mt-16">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            Консультации
            <span class="count-chip">${filtered.length}</span>
          </div>
          ${
              user.role === "student"
                  ? `
            <button class="btn-primary btn-sm" onclick="Consult.openCreateModal()">
              ${SVG.plus({ cls: "icon icon-sm" })}
              <span>Предложить слот</span>
            </button>
          `
                  : ""
          }
        </div>

        <!-- Табы -->
        <div class="filter-tabs" style="margin-bottom:14px;">
          ${renderTab("all", "Все", list.length)}
          ${renderTab("active", "Ожидают", pending.length + rescheduled.length)}
          ${renderTab("approved", "Согласованы", approved.length)}
          ${renderTab("done", "Проведены", done.length)}
          ${renderTab("rejected", "Отклонены", rejected.length)}
        </div>

        <!-- Поиск -->
        <div class="review-toolbar">
          <input type="text"
            class="consult-search review-search"
            placeholder="Поиск по теме, студенту, преподавателю…"
            value="${escapeHtml(consultSearch)}"
            oninput="Consult.setConsultSearch(this.value)">
        </div>

        ${
            filtered.length === 0
                ? renderEmpty(user, list.length === 0)
                : filtered.map((c) => renderConsultCard(c, user)).join("")
        }
      </div>
    `;
    }

    function renderTab(id, label, count) {
        const active = consultFilter === id ? "active" : "";
        return `
      <button class="filter-tab ${active}" onclick="Consult.setConsultFilter('${id}')">
        ${escapeHtml(label)}
        <span class="count-chip" style="margin-left:6px;">${count}</span>
      </button>
    `;
    }

    function renderEmpty(user, isEmpty) {
        return `
      <div class="empty-state">
        ${SVG.calendar({ cls: "icon icon-2xl" })}
        <h3>${isEmpty ? "Заявок пока нет" : "Ничего не найдено"}</h3>
        <p>${
            isEmpty
                ? user.role === "student"
                    ? "Предложите руководителю удобное время для консультации."
                    : "Студенты пока не предлагали консультаций."
                : "Измените фильтр или запрос."
        }</p>
      </div>
    `;
    }

    function renderConsultCard(c, user) {
        const student = Storage.getUserById(c.studentId);
        const teacher = Storage.getUserById(c.teacherId);
        const isTeacher = user.role === "teacher";
        const isStudent = user.role === "student";
        const isAdmin = user.role === "admin";

        const statusLabel = STATUS_LABELS[c.status] || c.status;
        const proposedBy = proposedByLabel(c);
        const countdown = countdownLabel(c.datetime);
        const countdownCls = countdownClass(c.datetime);

        // Действия
        const actions = [];

        if ((isTeacher || isAdmin) && c.status === STATUS.pending) {
            actions.push(`
        <button class="btn-primary btn-sm" onclick="Consult.uiApprove('${c.id}')">
          ${SVG.check({ cls: "icon icon-sm" })}
          <span>Подтвердить</span>
        </button>
      `);
            actions.push(`
        <button class="btn-ghost btn-sm" onclick="Consult.openProposeModal('${c.id}')">
          ${SVG.refresh({ cls: "icon icon-sm" })}
          <span>Предложить другое время</span>
        </button>
      `);
            actions.push(`
        <button class="btn-ghost btn-sm" onclick="Consult.openRejectModal('${c.id}')">
          ${SVG.x({ cls: "icon icon-sm" })}
          <span>Отклонить</span>
        </button>
      `);
        }

        if ((isTeacher || isAdmin) && c.status === STATUS.approved) {
            actions.push(`
        <button class="btn-primary btn-sm" onclick="Consult.uiMarkDone('${c.id}')">
          ${SVG.checkCircle({ cls: "icon icon-sm" })}
          <span>Отметить проведённой</span>
        </button>
      `);
        }

        if (isStudent && c.status === STATUS.pending) {
            actions.push(`
        <button class="btn-ghost btn-sm btn-danger" onclick="Consult.uiCancel('${c.id}')">
          ${SVG.x({ cls: "icon icon-sm" })}
          <span>Отменить</span>
        </button>
      `);
        }

        if (isStudent && c.status === STATUS.rescheduled) {
            actions.push(`
        <button class="btn-primary btn-sm" onclick="Consult.uiAccept('${c.id}')">
          ${SVG.check({ cls: "icon icon-sm" })}
          <span>Принять время</span>
        </button>
      `);
            actions.push(`
        <button class="btn-ghost btn-sm" onclick="Consult.openProposeModal('${c.id}')">
          ${SVG.refresh({ cls: "icon icon-sm" })}
          <span>Предложить своё</span>
        </button>
      `);
            actions.push(`
        <button class="btn-ghost btn-sm btn-danger" onclick="Consult.openRejectModal('${c.id}')">
          ${SVG.x({ cls: "icon icon-sm" })}
          <span>Отклонить</span>
        </button>
      `);
        }

        // Блок истории предложений
        const historyBlock = renderHistory(c);

        return `
      <div class="consult-card consult-status-${c.status}">
        <div class="consult-head">
          <div style="flex:1;min-width:0;">
            <div class="consult-datetime-row">
              <span class="consult-datetime">${escapeHtml(c.datetime)}</span>
              ${
                  countdown
                      ? `<span class="consult-countdown countdown-${countdownCls}">${escapeHtml(countdown)}</span>`
                      : ""
              }
            </div>
            <div class="consult-topic">
              ${escapeHtml(c.topic)}
            </div>
          </div>
          <span class="consult-status ${c.status}">${statusLabel}</span>
        </div>

        <div class="consult-participants">
          <span class="consult-participant">
            ${isTeacher || isAdmin ? "Студент:" : "Преподаватель:"}
            <b>${escapeHtml(
                (isTeacher || isAdmin ? student?.fio : teacher?.fio) || "—",
            )}</b>
          </span>
        </div>

        ${
            c.comment
                ? `<div class="consult-comment">${escapeHtml(c.comment)}</div>`
                : ""
        }

        ${
            c.status === STATUS.rescheduled
                ? `
          <div class="consult-rescheduled-note">
            ${SVG.info({ cls: "icon icon-xs" })}
            ${
                isStudent
                    ? `Преподаватель предложил новое время. Подтвердите или предложите своё.`
                    : `Ожидается ответ студента на предложенное время.`
            }
          </div>
        `
                : ""
        }

        ${
            c.response && c.status === STATUS.rejected
                ? `
          <div class="consult-response consult-response-reject">
            <b>Причина:</b> ${escapeHtml(c.response)}
          </div>
        `
                : ""
        }

        ${
            c.status === STATUS.approved
                ? `
          <div class="consult-approved-note">
            ${SVG.check({ cls: "icon icon-xs" })}
            Согласовано. Предложил: ${escapeHtml(proposedBy.toLowerCase())}.
          </div>
        `
                : ""
        }

        <div class="consult-footer">
          <div class="consult-created">
            Создано ${fmtDateTime(c.createdAt)}
          </div>
          ${historyBlock}
        </div>

        ${actions.length > 0 ? `<div class="consult-actions">${actions.join("")}</div>` : ""}
      </div>
    `;
    }

    function renderHistory(c) {
        const history = Array.isArray(c.history) ? c.history : [];
        if (history.length <= 1) return "";

        return `
      <details class="consult-history">
        <summary>История предложений (${history.length})</summary>
        <div class="consult-history-list">
          ${history
              .slice()
              .reverse()
              .map((h) => {
                  const byLabel =
                      h.by === "teacher" ? "Преподаватель" : "Студент";
                  return `
              <div class="consult-history-item">
                <div class="consult-history-meta">
                  <b>${byLabel}</b> · ${fmtDateTime(h.at)}
                </div>
                <div class="consult-history-datetime">
                  Предложил: ${escapeHtml(h.datetime)}
                </div>
                ${h.comment ? `<div class="consult-history-comment">${escapeHtml(h.comment)}</div>` : ""}
              </div>
            `;
              })
              .join("")}
        </div>
      </details>
    `;
    }

    /* =========================================================
       МОДАЛКИ
       ========================================================= */
    function openCreateModal() {
        const user = getUser();
        if (!user || user.role !== "student") return;

        const works = Storage.getWorksByStudent(user.id);
        const work =
            works.find((w) => w.status === "active" || w.status === "review") ||
            works[0];

        if (!work) {
            App.toast("Сначала создайте работу");
            return;
        }

        const teacher = Storage.getUserById(work.teacherId);
        if (!teacher) {
            App.toast("Руководитель не найден");
            return;
        }

        const now = new Date(Date.now() + 3600000);
        const minDate = now.toISOString().slice(0, 16);

        const html = `
      <div class="modal-back" onclick="if(event.target===this) App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Предложить консультацию</h3>
            <button class="modal-close" onclick="App.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
            Руководитель: <b>${escapeHtml(teacher.fio)}</b>
          </div>

          <div class="field">
            <label>Дата и время <span class="req">*</span></label>
            <input type="datetime-local" id="c_datetime" min="${minDate}">
          </div>

          <div class="field">
            <label>Тема консультации <span class="req">*</span></label>
            <input type="text" id="c_topic" placeholder="Например: обсуждение главы 2">
          </div>

          <div class="field">
            <label>Комментарий</label>
            <textarea id="c_comment" rows="3" placeholder="Что хотите обсудить"></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="App.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Consult.saveCreate()">Отправить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveCreate() {
        const user = getUser();
        if (!user) return;

        const works = Storage.getWorksByStudent(user.id);
        const work =
            works.find((w) => w.status === "active" || w.status === "review") ||
            works[0];
        if (!work) {
            App.toast("У вас нет работы");
            return;
        }

        const datetime = document.getElementById("c_datetime")?.value || "";
        const topic = document.getElementById("c_topic")?.value.trim() || "";
        const comment =
            document.getElementById("c_comment")?.value.trim() || "";

        if (!datetime) {
            App.toast("Укажите дату и время");
            return;
        }
        if (!topic) {
            App.toast("Укажите тему");
            return;
        }

        const dt = new Date(datetime);
        if (dt.getTime() < Date.now()) {
            App.toast("Дата должна быть в будущем");
            return;
        }

        const dtStr = dt.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        create({
            studentId: user.id,
            teacherId: work.teacherId,
            datetime: dtStr,
            topic,
            comment,
        });

        App.closeModal();
        App.toast("Заявка отправлена руководителю");
        App.navigate("consultations");
    }

    function openRejectModal(id) {
        const html = `
      <div class="modal-back" onclick="if(event.target===this) App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>Отклонить консультацию</h3>
            <button class="modal-close" onclick="App.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div class="field">
            <label>Причина отклонения <span class="req">*</span></label>
            <textarea id="c_reason" rows="3" placeholder="Например: занят в это время"></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="App.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Consult.saveReject('${id}')">Отклонить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function saveReject(id) {
        const reason = document.getElementById("c_reason")?.value.trim() || "";
        if (!reason) {
            App.toast("Укажите причину");
            return;
        }
        doReject(id, reason);
        App.closeModal();
        App.toast("Консультация отклонена");
        App.navigate("consultations");
    }

    /**
     * Открыть модалку предложения времени.
     * Работает и для преподавателя (pending), и для студента (rescheduled).
     */
    function openProposeModal(id) {
        const user = getUser();
        if (!user) return;
        const c = getAll().find((x) => Storage.sameId(x.id, id));
        if (!c) return;
        if (!canModify(c, user)) {
            App.toast("Нет прав");
            return;
        }

        const now = new Date(Date.now() + 3600000);
        const minDate = now.toISOString().slice(0, 16);

        const isTeacher = user.role === "teacher";
        const title = isTeacher
            ? "Предложить другое время"
            : "Предложить своё время";

        const html = `
      <div class="modal-back" onclick="if(event.target===this) App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h3>${title}</h3>
            <button class="modal-close" onclick="App.closeModal()">
              ${SVG.x({ cls: "icon icon-sm" })}
            </button>
          </div>

          <div style="font-size:13px;color:var(--txt-muted);margin-bottom:16px;">
            Текущее предложение: <b>${escapeHtml(c.datetime)}</b>
            · ${escapeHtml(proposedByLabel(c).toLowerCase())}
          </div>

          <div class="field">
            <label>Новая дата и время <span class="req">*</span></label>
            <input type="datetime-local" id="prop_datetime" min="${minDate}">
          </div>

          <div class="field">
            <label>Комментарий (необязательно)</label>
            <textarea id="prop_comment" rows="2" placeholder="Например: в это время у меня пара"></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button class="btn-ghost" onclick="App.closeModal()">Отмена</button>
            <button class="btn-primary" onclick="Consult.savePropose('${id}')">Предложить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function savePropose(id) {
        const datetime = document.getElementById("prop_datetime")?.value || "";
        const comment =
            document.getElementById("prop_comment")?.value.trim() || "";

        if (!datetime) {
            App.toast("Укажите дату и время");
            return;
        }

        const dt = new Date(datetime);
        if (dt.getTime() < Date.now()) {
            App.toast("Дата должна быть в будущем");
            return;
        }

        const dtStr = dt.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        proposeTime(id, dtStr, comment);
        App.closeModal();
        App.toast("Время предложено");
        App.navigate("consultations");
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        create,
        approve: doApprove,
        reject: doReject,
        markDone: doMarkDone,
        cancel: doCancel,
        proposeTime,
        acceptTime,

        getAll,
        forUser,
        forStudent,
        forTeacher,

        setConsultFilter,
        setConsultSearch,

        renderPage,
        renderConsultCard,

        openCreateModal,
        saveCreate,
        openRejectModal,
        saveReject,
        openProposeModal,
        savePropose,

        uiApprove: (id) => {
            try {
                doApprove(id, "");
                App.toast("Консультация подтверждена");
                App.navigate("consultations");
            } catch (e) {
                console.warn(e);
            }
        },
        uiMarkDone: (id) => {
            try {
                doMarkDone(id);
                App.toast("Консультация проведена");
                App.navigate("consultations");
            } catch (e) {
                console.warn(e);
            }
        },
        uiCancel: (id) => {
            if (!confirm("Отменить заявку?")) return;
            try {
                doCancel(id);
                App.toast("Заявка отменена");
                App.navigate("consultations");
            } catch (e) {
                console.warn(e);
            }
        },
        uiAccept: (id) => {
            try {
                acceptTime(id);
                App.toast("Время подтверждено");
                App.navigate("consultations");
            } catch (e) {
                console.warn(e);
            }
        },
    };
})();
