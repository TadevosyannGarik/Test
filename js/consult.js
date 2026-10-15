/* =========================================================
   CONSULT — заявки на консультации
   ========================================================= */
const Consult = (() => {
    const KEY = "fp_consults";

    const STATUS = {
        pending: "pending",
        approved: "approved",
        rejected: "rejected",
        done: "done",
    };

    const STATUS_LABELS = {
        pending: "Ожидает",
        approved: "Подтверждена",
        rejected: "Отклонена",
        done: "Проведена",
    };

    /* =========================================================
       БАЗОВЫЕ ОПЕРАЦИИ
       ========================================================= */
    function getAll() {
        return Storage.get(KEY, []);
    }
    function setAll(list) {
        Storage.set(KEY, list);
    }

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

    /* =========================================================
       СОЗДАНИЕ
       ========================================================= */
    function create({ studentId, teacherId, datetime, topic, comment }) {
        const teacher = Storage.getUserById(teacherId);
        if (!teacher) {
            App.toast("Руководитель не найден");
            return null;
        }

        const list = getAll();
        const consult = {
            id: uid(),
            studentId,
            teacherId,
            datetime,
            topic,
            comment: comment || "",
            status: STATUS.pending,
            response: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
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
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;

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
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;

        c.status = STATUS.rejected;
        c.response = reason || "";
        c.updatedAt = Date.now();
        setAll(list);

        if (typeof Notifications !== "undefined") {
            Notifications.add({
                userId: c.studentId,
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
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;

        c.status = STATUS.done;
        c.updatedAt = Date.now();
        setAll(list);

        if (typeof Audit !== "undefined") {
            Audit.log("Консультация проведена", c.datetime, "", "info");
        }
    }

    function doCancel(id) {
        const list = getAll();
        const c = list.find((x) => Storage.sameId(x.id, id));
        if (!c) return;

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

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function renderPage(user) {
        if (!user)
            return '<div class="card"><div class="empty">Пользователь не найден</div></div>';

        const list = forUser(user);
        const pending = list.filter((c) => c.status === STATUS.pending);
        const approved = list.filter((c) => c.status === STATUS.approved);
        const done = list.filter((c) => c.status === STATUS.done);
        const rejected = list.filter((c) => c.status === STATUS.rejected);

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Заявки на консультации (${list.length})</div>
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

        ${
            list.length === 0
                ? renderEmpty(user)
                : `
          ${
              pending.length > 0
                  ? `
            <div class="section-label">Ожидают ответа (${pending.length})</div>
            ${pending.map((c) => renderConsultCard(c, user)).join("")}
          `
                  : ""
          }
          ${
              approved.length > 0
                  ? `
            <div class="section-label" style="margin-top:20px;">Подтверждены (${approved.length})</div>
            ${approved.map((c) => renderConsultCard(c, user)).join("")}
          `
                  : ""
          }
          ${
              done.length > 0
                  ? `
            <div class="section-label" style="margin-top:20px;">Проведены (${done.length})</div>
            ${done.map((c) => renderConsultCard(c, user)).join("")}
          `
                  : ""
          }
          ${
              rejected.length > 0
                  ? `
            <div class="section-label" style="margin-top:20px;">Отклонены (${rejected.length})</div>
            ${rejected.map((c) => renderConsultCard(c, user)).join("")}
          `
                  : ""
          }
        `
        }
      </div>
    `;
    }

    function renderEmpty(user) {
        return `
      <div class="empty-state">
        ${SVG.calendar({ cls: "icon icon-2xl" })}
        <h3>Заявок пока нет</h3>
        <p>${
            user.role === "student"
                ? "Предложите руководителю удобное время для консультации."
                : "Студенты пока не предлагали консультаций."
        }</p>
      </div>
    `;
    }

    function renderConsultCard(c, user) {
        const student = Storage.getUserById(c.studentId);
        const teacher = Storage.getUserById(c.teacherId);
        const isTeacher = user.role === "teacher";
        const isStudent = user.role === "student";
        const statusLabel = STATUS_LABELS[c.status] || c.status;

        return `
      <div class="consult-card">
        <div class="consult-head">
          <div>
            <div class="consult-time">${escapeHtml(c.datetime)}</div>
            <div class="consult-topic">
              ${
                  isTeacher
                      ? `Студент: ${escapeHtml(student?.fio || "—")}`
                      : `Руководитель: ${escapeHtml(teacher?.fio || "—")}`
              }
              · ${escapeHtml(c.topic)}
            </div>
          </div>
          <span class="consult-status ${c.status}">${statusLabel}</span>
        </div>

        ${c.comment ? `<div class="consult-comment">${escapeHtml(c.comment)}</div>` : ""}

        ${
            c.response
                ? `
          <div style="font-size:12px;color:var(--txt-muted);margin-top:6px;">
            <b>Ответ:</b> ${escapeHtml(c.response)}
          </div>
        `
                : ""
        }

        <div style="font-size:11px;color:var(--txt-soft);margin-top:8px;">
          Создано: ${fmtDateTime(c.createdAt)}
        </div>

        ${
            isTeacher && c.status === STATUS.pending
                ? `
          <div class="consult-actions">
            <button class="btn-primary btn-sm" onclick="Consult.uiApprove(${c.id})">
              ${SVG.check({ cls: "icon icon-sm" })}
              <span>Подтвердить</span>
            </button>
            <button class="btn-ghost btn-sm" onclick="Consult.openRejectModal(${c.id})">
              ${SVG.x({ cls: "icon icon-sm" })}
              <span>Отклонить</span>
            </button>
          </div>
        `
                : ""
        }

        ${
            isTeacher && c.status === STATUS.approved
                ? `
          <div class="consult-actions">
            <button class="btn-ghost btn-sm" onclick="Consult.uiMarkDone(${c.id})">
              ${SVG.checkCircle({ cls: "icon icon-sm" })}
              <span>Отметить проведённой</span>
            </button>
          </div>
        `
                : ""
        }

        ${
            isStudent && c.status === STATUS.pending
                ? `
          <div class="consult-actions">
            <button class="btn-ghost btn-sm btn-danger" onclick="Consult.uiCancel(${c.id})">
              ${SVG.x({ cls: "icon icon-sm" })}
              <span>Отменить</span>
            </button>
          </div>
        `
                : ""
        }
      </div>
    `;
    }

    /* =========================================================
       МОДАЛКА СОЗДАНИЯ
       ========================================================= */
    function openCreateModal() {
        const user = Auth.getUser();
        if (!user || user.role !== "student") return;

        const works = Storage.getWorksByStudent(user.id);
        const work = works[0];
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
        const user = Auth.getUser();
        if (!user) return;

        const works = Storage.getWorksByStudent(user.id);
        const work = works[0];
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

    /* =========================================================
       МОДАЛКА ОТКЛОНЕНИЯ
       ========================================================= */
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
            <button class="btn-primary" onclick="Consult.saveReject(${id})">Отклонить</button>
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

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        create,
        approve: doApprove,
        reject: doReject,
        markDone: doMarkDone,
        cancel: doCancel,

        getAll,
        forUser,
        forStudent,
        forTeacher,

        renderPage,
        renderConsultCard,

        openCreateModal,
        saveCreate,
        openRejectModal,
        saveReject,

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
    };
})();
