/* =========================================================
   ADMIN — весь функционал роли «Администратор»
   ========================================================= */
const Admin = (() => {
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

    const ROLE_LABELS = {
        student: "Студент",
        teacher: "Преподаватель",
        admin: "Администратор",
    };

    /* Состояние фильтров */
    let userFilter = { role: "", q: "" };
    let workFilter = { status: "", type: "", q: "" };

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

    function initials(fio) {
        if (!fio) return "?";
        return fio
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    }

    function statusBadge(status) {
        const s = WORK_STATUSES[status] || WORK_STATUSES.draft;
        return `<span class="badge ${s.badge}">${s.label}</span>`;
    }

    function userName(id) {
        const u = Storage.getUserById(id);
        return u ? u.fio : "—";
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
       ДЕМО-ДАННЫЕ
       --------------------------------------------------------- */
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
            <li>3 преподавателя с разными кафедрами</li>
            <li>10 студентов на разных курсах и группах</li>
            <li>15 работ на всех стадиях (от заявки до защиты)</li>
            <li>Этапы, задачи, версии, комментарии для каждой работы</li>
            <li>Уведомления, консультации, журнал аудита</li>
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

    /* ---------------------------------------------------------
       ДАШБОРД КАФЕДРЫ
       --------------------------------------------------------- */
    VIEWS.dashboard = function () {
        const users = Storage.getUsers();
        const works = Storage.getWorks();

        const students = users.filter((u) => u.role === "student");
        const teachers = users.filter((u) => u.role === "teacher");

        const enriched = works.map((w) => {
            const res = Fuzzy.infer(buildFuzzyInputs(w));
            return { w, res, progress: calcProgress(w.id) };
        });

        const active = enriched.filter(
            (e) => e.w.status !== "rejected" && e.w.status !== "done",
        );
        const highRisk = active.filter(
            (e) => e.res.risk.term === "high",
        ).length;
        const avgRating = works.length
            ? (
                  enriched.reduce((a, e) => a + e.res.rating.value, 0) /
                  works.length
              ).toFixed(1)
            : "0";
        const avgProgress = works.length
            ? Math.round(
                  enriched.reduce((a, e) => a + e.progress, 0) / works.length,
              )
            : 0;

        return `
      <div class="grid grid-4">
        <div class="card kpi">
          <div class="kpi-num">${users.length}</div>
          <div class="kpi-lbl">Пользователей</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num">${works.length}</div>
          <div class="kpi-lbl">Работ</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num" style="color:var(--bad)">${highRisk}</div>
          <div class="kpi-lbl">Высокий риск</div>
        </div>
        <div class="card kpi">
          <div class="kpi-num">${avgRating}</div>
          <div class="kpi-lbl">Ср. рейтинг</div>
        </div>
      </div>

      <div class="metric-grid mt-16">
        <div class="metric">
          <div class="metric-lbl">Студентов</div>
          <div class="metric-val">${students.length}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Преподавателей</div>
          <div class="metric-val">${teachers.length}</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Ср. прогресс</div>
          <div class="metric-val">${avgProgress}%</div>
        </div>
        <div class="metric">
          <div class="metric-lbl">Активных работ</div>
          <div class="metric-val">${active.length}</div>
        </div>
      </div>

      <div class="grid grid-3 mt-16">
        <div class="card">
          <div class="card-title">Риски</div>
          <div class="chart-box h-220"><canvas id="adminChartRisk"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Роли</div>
          <div class="chart-box h-220"><canvas id="adminChartRoles"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Статусы работ</div>
          <div class="chart-box h-220"><canvas id="adminChartStatuses"></canvas></div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Быстрые действия</div>
        <div class="quick-actions">
          <div class="quick-action" onclick="App.navigate('users')">
            <div class="qa-ico">${SVG.users({ cls: "icon" })}</div>
            <div class="qa-lbl">Пользователи</div>
            <div class="qa-desc">Управление аккаунтами</div>
          </div>
          <div class="quick-action" onclick="App.navigate('works')">
            <div class="qa-ico">${SVG.folder({ cls: "icon" })}</div>
            <div class="qa-lbl">Все работы</div>
            <div class="qa-desc">Фильтры и детали</div>
          </div>
          <div class="quick-action" onclick="App.navigate('analytics')">
            <div class="qa-ico">${SVG.trending({ cls: "icon" })}</div>
            <div class="qa-lbl">Аналитика</div>
            <div class="qa-desc">Отчёты и экспорт</div>
          </div>
          <div class="quick-action" onclick="App.navigate('rules')">
            <div class="qa-ico">${SVG.settings({ cls: "icon" })}</div>
            <div class="qa-lbl">Правила</div>
            <div class="qa-desc">Редактор Мамдани</div>
          </div>
          <div class="quick-action" onclick="PdfReport.exportDepartment()">
            <div class="qa-ico">${SVG.fileText({ cls: "icon" })}</div>
            <div class="qa-lbl">Скачать PDF</div>
            <div class="qa-desc">Отчёт кафедры</div>
          </div>
        </div>
      </div>

      ${
          highRisk > 0
              ? `
        <div class="card mt-16">
          <div class="card-head">
            <div class="card-title">Работы с высоким риском (${highRisk})</div>
            <button class="btn-ghost btn-sm" onclick="App.navigate('works')">Все →</button>
          </div>
          ${enriched
              .filter((e) => e.res.risk.term === "high")
              .sort((a, b) => b.res.risk.value - a.res.risk.value)
              .slice(0, 5)
              .map(
                  (e) => `
              <div class="work-list-row">
                <div>
                  <div class="work-list-topic">${escapeHtml(e.w.topic)}</div>
                  <div class="work-list-sub">${escapeHtml(userName(e.w.studentId))} · ${escapeHtml(userName(e.w.teacherId))}</div>
                </div>
                <div>${statusBadge(e.w.status)}</div>
                <div style="font-size:12px;">${e.progress}%</div>
                <div><span class="badge risk-high">риск ${e.res.risk.value.toFixed(0)}</span></div>
                <div><button class="btn-ghost btn-sm" onclick="App.navigate('work-detail', {id: ${e.w.id}})">→</button></div>
              </div>
            `,
              )
              .join("")}
        </div>
      `
              : ""
      }
    `;
    };

    VIEWS.dashboard_after = function () {
        if (!Charts.hasChart()) return;

        const works = Storage.getWorks().map((w) => ({
            w,
            res: Fuzzy.infer(buildFuzzyInputs(w)),
        }));
        const low = works.filter((e) => e.res.risk.term === "low").length;
        const med = works.filter((e) => e.res.risk.term === "med").length;
        const high = works.filter((e) => e.res.risk.term === "high").length;

        Charts.doughnut(
            "adminChartRisk",
            ["Низкий", "Средний", "Высокий"],
            [low, med, high],
            [Charts.COLORS.ok, Charts.COLORS.warn, Charts.COLORS.bad],
        );

        const users = Storage.getUsers();
        Charts.doughnut(
            "adminChartRoles",
            ["Студенты", "Преподаватели", "Администраторы"],
            [
                users.filter((u) => u.role === "student").length,
                users.filter((u) => u.role === "teacher").length,
                users.filter((u) => u.role === "admin").length,
            ],
            [Charts.COLORS.accent, Charts.COLORS.purple, Charts.COLORS.bad],
        );

        const statuses = {};
        Storage.getWorks().forEach((w) => {
            statuses[w.status] = (statuses[w.status] || 0) + 1;
        });
        const statusLabels = {
            draft: "Черновик",
            pending: "На утверждении",
            active: "В работе",
            review: "На проверке",
            approved: "Допущена",
            done: "Защищена",
            rejected: "Отклонена",
        };
        Charts.doughnut(
            "adminChartStatuses",
            Object.keys(statuses).map((k) => statusLabels[k] || k),
            Object.values(statuses),
            [
                Charts.COLORS.accent,
                Charts.COLORS.warn,
                Charts.COLORS.purple,
                Charts.COLORS.ok,
                Charts.COLORS.bad,
                "#0ea5e9",
                "#64748b",
            ],
        );
    };

    /* ---------------------------------------------------------
       ПОЛЬЗОВАТЕЛИ
       --------------------------------------------------------- */
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
            return order[a.role] - order[b.role] || a.fio.localeCompare(b.fio);
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
                  ? `${escapeHtml(u.department || "")} · ${escapeHtml(u.position || "")}`
                  : `${escapeHtml(u.department || "")} · ${escapeHtml(u.accessLevel || "")}`;

        const isMe = Storage.sameId(u.id, getUser().id);

        return `
      <div class="user-row">
        <div class="user-avatar ${u.role}"
          onclick="Admin.openUserProfile(${u.id})"
          style="cursor:pointer;">${initials(u.fio)}</div>
        <div onclick="Admin.openUserProfile(${u.id})" style="cursor:pointer;">
          <div class="user-name">${escapeHtml(u.fio)}${blocked}</div>
          <div class="user-email">${escapeHtml(u.email)}</div>
          <div class="user-extra">${extra}</div>
        </div>
        <div><span class="role-chip ${u.role}">${ROLE_LABELS[u.role]}</span></div>
        <div>
          ${
              isMe
                  ? '<span class="text-muted" style="font-size:11px;">это вы</span>'
                  : `<button class="btn-ghost btn-sm" onclick="Admin.openEditUserModal(${u.id})">Изменить</button>`
          }
        </div>
        <div style="display:flex;gap:4px;">
          ${
              isMe
                  ? ""
                  : `
            <button class="btn-icon"
              title="${u.blocked ? "Разблокировать" : "Заблокировать"}"
              onclick="Admin.toggleBlock(${u.id})">
              ${u.blocked ? SVG.unlock({ cls: "icon icon-sm" }) : SVG.lock({ cls: "icon icon-sm" })}
            </button>
            <button class="btn-icon danger" title="Удалить"
              onclick="Admin.deleteUser(${u.id})">
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

    /* ---------------------------------------------------------
       СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ПОЛЬЗОВАТЕЛЯ
       --------------------------------------------------------- */
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
          <div class="field"><label>Факультет</label><input type="text" id="cu_faculty" placeholder="ФИТ"></div>
          <div class="field"><label>Группа</label><input type="text" id="cu_group" placeholder="ПИ-21-1"></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Курс</label><input type="number" id="cu_course" min="1" max="6" value="1"></div>
          <div class="field"><label>Направление</label><input type="text" id="cu_direction" placeholder="Программная инженерия"></div>
        </div>
        <div class="field"><label>Номер зачётки</label><input type="text" id="cu_recordBook" placeholder="21-1234"></div>
      `;
        } else if (createRole === "teacher") {
            box.innerHTML = `
        <div class="section-label">Данные преподавателя</div>
        <div class="row-2">
          <div class="field"><label>Кафедра</label><input type="text" id="cu_department" placeholder="Кафедра ИС"></div>
          <div class="field"><label>Должность</label><input type="text" id="cu_position" placeholder="Доцент"></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Учёная степень</label><input type="text" id="cu_degree" placeholder="к.т.н."></div>
          <div class="field"><label>Макс. нагрузка</label><input type="number" id="cu_maxLoad" value="8" min="1" max="30"></div>
        </div>
        <div class="field"><label>Научные интересы</label><input type="text" id="cu_interests" placeholder="Нечёткая логика, ИИ"></div>
      `;
        } else {
            box.innerHTML = `
        <div class="section-label">Данные администратора</div>
        <div class="row-2">
          <div class="field"><label>Подразделение</label><input type="text" id="cu_department" placeholder="Кафедра ИС"></div>
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
            roleData.faculty =
                document.getElementById("cu_faculty")?.value.trim() || "";
            roleData.group =
                document.getElementById("cu_group")?.value.trim() || "";
            roleData.course = +document.getElementById("cu_course")?.value || 1;
            roleData.direction =
                document.getElementById("cu_direction")?.value.trim() || "";
            roleData.recordBook =
                document.getElementById("cu_recordBook")?.value.trim() || "";
        } else if (createRole === "teacher") {
            roleData.department =
                document.getElementById("cu_department")?.value.trim() || "";
            roleData.position =
                document.getElementById("cu_position")?.value.trim() || "";
            roleData.degree =
                document.getElementById("cu_degree")?.value.trim() || "";
            roleData.maxLoad =
                +document.getElementById("cu_maxLoad")?.value || 8;
            roleData.interests =
                document.getElementById("cu_interests")?.value.trim() || "";
        } else {
            roleData.department =
                document.getElementById("cu_department")?.value.trim() || "";
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
            <button class="btn-primary" onclick="Admin.saveUser(${u.id})">Сохранить</button>
          </div>
        </div>
      </div>
    `;
        App.openModal(html);
    }

    function renderExtraFieldsForEdit(u) {
        if (u.role === "student") {
            return `
        <div class="row-2">
          <div class="field"><label>Факультет</label><input type="text" id="eu_faculty" value="${escapeHtml(u.faculty || "")}"></div>
          <div class="field"><label>Группа</label><input type="text" id="eu_group" value="${escapeHtml(u.group || "")}"></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Курс</label><input type="number" id="eu_course" value="${u.course || 1}" min="1" max="6"></div>
          <div class="field"><label>Направление</label><input type="text" id="eu_direction" value="${escapeHtml(u.direction || "")}"></div>
        </div>
        <div class="field"><label>Номер зачётки</label><input type="text" id="eu_recordBook" value="${escapeHtml(u.recordBook || "")}"></div>
      `;
        }
        if (u.role === "teacher") {
            return `
        <div class="row-2">
          <div class="field"><label>Кафедра</label><input type="text" id="eu_department" value="${escapeHtml(u.department || "")}"></div>
          <div class="field"><label>Должность</label><input type="text" id="eu_position" value="${escapeHtml(u.position || "")}"></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Учёная степень</label><input type="text" id="eu_degree" value="${escapeHtml(u.degree || "")}"></div>
          <div class="field"><label>Макс. нагрузка</label><input type="number" id="eu_maxLoad" value="${u.maxLoad || 8}"></div>
        </div>
        <div class="field"><label>Научные интересы</label><input type="text" id="eu_interests" value="${escapeHtml(u.interests || "")}"></div>
      `;
        }
        return `
      <div class="row-2">
        <div class="field"><label>Подразделение</label><input type="text" id="eu_department" value="${escapeHtml(u.department || "")}"></div>
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

        u.fio = document.getElementById("eu_fio")?.value.trim() || "";
        u.email =
            document.getElementById("eu_email")?.value.trim().toLowerCase() ||
            "";
        u.role = document.getElementById("eu_role")?.value || "student";
        const pass = document.getElementById("eu_pass")?.value;
        if (pass) u.pass = hashPass(pass);

        if (u.role === "student") {
            u.faculty =
                document.getElementById("eu_faculty")?.value.trim() || "";
            u.group = document.getElementById("eu_group")?.value.trim() || "";
            u.course = +document.getElementById("eu_course")?.value || 1;
            u.direction =
                document.getElementById("eu_direction")?.value.trim() || "";
            u.recordBook =
                document.getElementById("eu_recordBook")?.value.trim() || "";
        } else if (u.role === "teacher") {
            u.department =
                document.getElementById("eu_department")?.value.trim() || "";
            u.position =
                document.getElementById("eu_position")?.value.trim() || "";
            u.degree = document.getElementById("eu_degree")?.value.trim() || "";
            u.maxLoad = +document.getElementById("eu_maxLoad")?.value || 8;
            u.interests =
                document.getElementById("eu_interests")?.value.trim() || "";
        } else {
            u.department =
                document.getElementById("eu_department")?.value.trim() || "";
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

    /* ---------------------------------------------------------
       ВСЕ РАБОТЫ
       --------------------------------------------------------- */
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

        works.sort((a, b) => b.updatedAt - a.updatedAt);

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
                        `<option value="${k}" ${workFilter.type === k ? "selected" : ""}>${v}</option>`,
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
        const res = Fuzzy.infer(buildFuzzyInputs(w));
        return `
      <div class="work-list-row">
        <div>
          <div class="work-list-topic">${escapeHtml(w.topic)}</div>
          <div class="work-list-sub">
            ${escapeHtml(userName(w.studentId))} · рук. ${escapeHtml(userName(w.teacherId))}
            · ${escapeHtml(WORK_TYPES[w.type] || "")}
          </div>
        </div>
        <div>${statusBadge(w.status)}</div>
        <div style="font-size:12px;">${progress}%</div>
        <div><span class="badge risk-${res.risk.term}">риск ${res.risk.value.toFixed(0)}</span></div>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="App.navigate('work-detail', {id: ${w.id}})">
            ${SVG.eye({ cls: "icon icon-sm" })}
          </button>
          <button class="btn-icon danger" onclick="Admin.deleteWork(${w.id})">
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

    /* ---------------------------------------------------------
       ДЕТАЛЬ РАБОТЫ
       --------------------------------------------------------- */
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
        const inputs = buildFuzzyInputs(w);
        const res = Fuzzy.infer(inputs);

        return `
      <div class="back-link" onclick="App.navigate('works')">← Назад к работам</div>

      <div class="student-hero">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <div class="student-hero-name">${escapeHtml(w.topic)}</div>
            <div class="student-hero-meta">
              ${escapeHtml(WORK_TYPES[w.type] || "")} · создана ${fmtDate(w.createdAt)}
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
            <div class="num" style="color:var(--${res.risk.term === "high" ? "bad" : res.risk.term === "med" ? "warn" : "ok"})">
              ${res.risk.value.toFixed(0)}
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
                            (s) => `
            <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);">
              ${s.done ? SVG.check({ cls: "icon icon-xs" }) : "○"} ${escapeHtml(s.name)}
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
                            (t) => `
            <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);">
              • ${escapeHtml(t.title)}
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

    /* ---------------------------------------------------------
       ПРАВИЛА
       --------------------------------------------------------- */
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
              onchange="Admin.toggleRule(${r.id}, this.checked)">
            <div style="flex:1;">
              <div class="rule-if">ЕСЛИ ${r.if.join(" И ")}</div>
              <div class="rule-then">ТО ${r.then}</div>
              <input type="text" class="rule-desc" value="${escapeHtml(r.desc)}"
                onchange="Admin.updateRuleDesc(${r.id}, this.value)">
            </div>
            <button class="btn-icon danger" onclick="Admin.deleteRule(${r.id})">
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

    /* ---------------------------------------------------------
       АНАЛИТИКА
       --------------------------------------------------------- */
    VIEWS.analytics = function () {
        return `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Риски по работам</div>
          <div class="chart-wrap-lg"><canvas id="adminChartDept"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Нагрузка на руководителей</div>
          <div class="chart-wrap-lg"><canvas id="adminChartLoad"></canvas></div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">Экспорт и отчёты</div>
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
    };

    VIEWS.analytics_after = function () {
        if (!Charts.hasChart()) return;

        const works = Storage.getWorks().map((w) => ({
            w,
            res: Fuzzy.infer(buildFuzzyInputs(w)),
        }));

        Charts.bar(
            "adminChartDept",
            works.map(
                (e) =>
                    e.w.topic.slice(0, 22) + (e.w.topic.length > 22 ? "…" : ""),
            ),
            works.map((e) => e.res.risk.value),
            works.map((e) =>
                e.res.risk.term === "high"
                    ? Charts.COLORS.bad
                    : e.res.risk.term === "med"
                      ? Charts.COLORS.warn
                      : Charts.COLORS.ok,
            ),
            { label: "Риск", horizontal: true, max: 100 },
        );

        const supLoad = {};
        Storage.getWorks().forEach((w) => {
            const t = userName(w.teacherId);
            supLoad[t] = (supLoad[t] || 0) + 1;
        });

        Charts.polar(
            "adminChartLoad",
            Object.keys(supLoad),
            Object.values(supLoad),
        );
    };

    function generateReport() {
        const works = Storage.getWorks();
        const enriched = works.map((w) => ({
            w,
            res: Fuzzy.infer(buildFuzzyInputs(w)),
        }));
        const high = enriched.filter((e) => e.res.risk.term === "high");

        const box = document.getElementById("reportBox");
        if (!box) return;

        box.innerHTML = `
      <div style="background:var(--bg-soft);padding:18px;border-radius:10px;font-size:13px;line-height:1.8;">
        <h4 style="margin-bottom:10px;">Сводный отчёт кафедры</h4>
        <p><b>Дата:</b> ${new Date().toLocaleDateString("ru-RU")}</p>
        <p><b>Всего работ:</b> ${works.length}</p>
        <p><b>В зоне высокого риска:</b> ${high.length}</p>
        <p><b>Средний рейтинг:</b> ${
            works.length
                ? (
                      enriched.reduce((a, e) => a + e.res.rating.value, 0) /
                      works.length
                  ).toFixed(1)
                : "0"
        }</p>
        <p style="margin-top:10px;"><b>Требуют внимания:</b></p>
        <ul style="margin-left:20px;">
          ${
              high.length
                  ? high
                        .map(
                            (e) =>
                                `<li>${escapeHtml(userName(e.w.studentId))} — «${escapeHtml(e.w.topic)}» (риск ${e.res.risk.value.toFixed(1)})</li>`,
                        )
                        .join("")
                  : "<li>нет</li>"
          }
        </ul>
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
            const inputs = buildFuzzyInputs(w);
            const res = Fuzzy.infer(inputs);
            rows.push([
                w.id,
                userName(w.studentId),
                userName(w.teacherId),
                w.topic,
                WORK_TYPES[w.type] || w.type,
                WORK_STATUSES[w.status]?.label || w.status,
                inputs.progress,
                res.risk.value.toFixed(1),
                res.ready.value.toFixed(1),
                res.rating.value.toFixed(1),
            ]);
        });
        const csv = rows
            .map((r) =>
                r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
            )
            .join("\n");
        const blob = new Blob(["\ufeff" + csv], {
            type: "text/csv;charset=utf-8",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "fuzzyproject_works.csv";
        a.click();
        App.toast("CSV экспортирован");
    }

    /* ---------------------------------------------------------
       РЕЗЕРВНАЯ КОПИЯ
       --------------------------------------------------------- */
    function exportBackup() {
        const backup = {};
        Object.values(Storage.KEYS).forEach((key) => {
            const val = localStorage.getItem(key);
            if (val) backup[key] = JSON.parse(val);
        });
        backup.fp_mf_overrides = Storage.get("fp_mf_overrides", null);

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `fuzzyproject_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        App.toast("Резервная копия скачана");
    }

    function importBackup(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const backup = JSON.parse(e.target.result);
                Object.keys(backup).forEach((key) => {
                    if (key.startsWith("fp_")) {
                        localStorage.setItem(key, JSON.stringify(backup[key]));
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

    /* ---------------------------------------------------------
       СПРАВОЧНИКИ
       --------------------------------------------------------- */
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
              ${refs[key]
                  .map(
                      (item, i) => `
                <span class="ref-chip">
                  ${escapeHtml(item)}
                  <button onclick="Admin.deleteRef('${key}', ${i})">✕</button>
                </span>
              `,
                  )
                  .join("")}
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <input type="text" id="ref_new_${key}" placeholder="Добавить..."
                style="flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:var(--r-sm);font-size:13px;background:var(--bg-elev);color:var(--txt);">
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
        if (!refs[key].includes(val)) refs[key].push(val);
        setRefs(refs);
        App.navigate("refs");
        App.toast("Добавлено");
    }
    function deleteRef(key, i) {
        const refs = getRefs();
        refs[key].splice(i, 1);
        setRefs(refs);
        App.navigate("refs");
    }

    /* ---------------------------------------------------------
       НАСТРОЙКИ
       --------------------------------------------------------- */
    const SETTINGS_KEY = "fp_settings";

    function getSettings() {
        return Storage.get(SETTINGS_KEY, {
            systemName: "FuzzyProject",
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
                document.getElementById("set_name")?.value.trim() ||
                "FuzzyProject",
            academicYear:
                document.getElementById("set_year")?.value.trim() ||
                "2024/2025",
            defaultDeadlineDays:
                +document.getElementById("set_deadline")?.value || 30,
            notifyBeforeDays:
                +document.getElementById("set_notify")?.value || 3,
        });
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

    /* ---------------------------------------------------------
       ПРОФИЛЬ
       --------------------------------------------------------- */
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

    /* ---------------------------------------------------------
       ПРОФИЛЬ ПРЕПОДАВАТЕЛЯ
       --------------------------------------------------------- */
    VIEWS["teacher-profile"] = function (params) {
        const t = Storage.getUserById(params?.id);
        if (!t)
            return '<div class="card"><div class="empty">Преподаватель не найден</div></div>';

        const works = Storage.getWorksByTeacher(t.id);
        const active = works.filter(
            (w) => w.status !== "done" && w.status !== "rejected",
        );

        const withRisk = active.map((w) => {
            const progress = calcProgress(w.id);
            const res = Fuzzy.infer(buildFuzzyInputs(w));
            return {
                w,
                progress,
                res,
                student: Storage.getUserById(w.studentId),
            };
        });

        const avgProgress = withRisk.length
            ? Math.round(
                  withRisk.reduce((a, x) => a + x.progress, 0) /
                      withRisk.length,
              )
            : 0;
        const highRisk = withRisk.filter(
            (x) => x.res.risk.term === "high",
        ).length;

        const initials2 = t.fio
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
        const maxLoad = t.maxLoad || 8;
        const loadPct = Math.min(
            100,
            Math.round((active.length / maxLoad) * 100),
        );

        return `
      <div class="back-link" onclick="App.navigate('users')">← К пользователям</div>

      <div class="profile-hero">
        <div class="profile-hero-avatar">${initials2}</div>
        <div class="profile-hero-body">
          <div class="profile-hero-name">${escapeHtml(t.fio)}</div>
          <div class="profile-hero-sub">${escapeHtml(t.email)}</div>
          <div class="profile-hero-chips">
            <span class="role-chip teacher">Преподаватель</span>
            ${t.position ? `<span class="tag">${escapeHtml(t.position)}</span>` : ""}
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
            <div class="info-item"><div class="info-lbl">Должность</div><div class="info-val">${escapeHtml(t.position || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Учёная степень</div><div class="info-val">${escapeHtml(t.degree || "—")}</div></div>
            <div class="info-item"><div class="info-lbl">Макс. нагрузка</div><div class="info-val">${maxLoad} работ</div></div>
            <div class="info-item" style="grid-column:1/-1;">
              <div class="info-lbl">Научные интересы</div>
              <div class="info-val">${escapeHtml(t.interests || "—")}</div>
            </div>
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
                          const res = Fuzzy.infer(buildFuzzyInputs(w));
                          return `
                <div class="mini-project" onclick="App.navigate('work-detail', {id: ${w.id}})">
                  <div>
                    <div class="mini-project-title">${escapeHtml(w.topic)}</div>
                    <div class="mini-project-sub">
                      ${escapeHtml(student?.fio || "—")} · ${statusBadge(w.status)}
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

        const low = active.filter(
            (w) => Fuzzy.infer(buildFuzzyInputs(w)).risk.term === "low",
        ).length;
        const med = active.filter(
            (w) => Fuzzy.infer(buildFuzzyInputs(w)).risk.term === "med",
        ).length;
        const high = active.filter(
            (w) => Fuzzy.infer(buildFuzzyInputs(w)).risk.term === "high",
        ).length;

        Charts.doughnut(
            "adminTeacherRisk",
            ["Низкий", "Средний", "Высокий"],
            [low, med, high],
            [Charts.COLORS.ok, Charts.COLORS.warn, Charts.COLORS.bad],
        );
    };

    /* ---------------------------------------------------------
       ПРОФИЛЬ СТУДЕНТА
       --------------------------------------------------------- */
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
            totalRating += Fuzzy.infer(buildFuzzyInputs(w)).rating.value;
            cnt++;
        });
        const avg = (x) => (cnt ? Math.round(x / cnt) : 0);

        const initials3 = s.fio
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

        return `
      <div class="back-link" onclick="App.navigate('users')">← К пользователям</div>

      <div class="profile-hero">
        <div class="profile-hero-avatar">${initials3}</div>
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
          <div class="info-item"><div class="info-lbl">Направление</div><div class="info-val">${escapeHtml(s.direction || "—")}</div></div>
          <div class="info-item"><div class="info-lbl">Номер зачётки</div><div class="info-val">${escapeHtml(s.recordBook || "—")}</div></div>
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
                          const res = Fuzzy.infer(buildFuzzyInputs(w));
                          return `
                <div class="mini-project" onclick="App.navigate('work-detail', {id: ${w.id}})">
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
                      .join("")
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

        /* Пользователи */
        setUserFilter,
        toggleBlock,
        deleteUser,
        openCreateUserModal,
        pickCreateRole,
        createUser,
        openEditUserModal,
        saveUser,
        openUserProfile,

        /* Работы */
        setWorkFilter,
        deleteWork,

        /* Правила */
        toggleRule,
        updateRuleDesc,
        deleteRule,
        resetRules,

        /* Отчёты */
        generateReport,
        exportWorksCSV,
        exportBackup,
        importBackup,

        /* Справочники */
        addRef,
        deleteRef,

        /* Настройки */
        saveSettings,
        fullReset,

        /* Модалки */
        closeModal,
    };
})();
