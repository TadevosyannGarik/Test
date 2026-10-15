/* =========================================================
   AUDIT — журнал действий пользователей
   ========================================================= */
const Audit = (() => {
    const KEY = "fp_audit";
    const MAX_ENTRIES = 500;

    let currentFilter = { type: "", q: "" };

    const ROLE_LABELS = {
        student: "Студент",
        teacher: "Преподаватель",
        admin: "Администратор",
    };

    /* =========================================================
       ЛОГИРОВАНИЕ
       ========================================================= */
    function log(action, target, details, type) {
        if (typeof Auth === "undefined") return;
        const user = Auth.getUser();
        if (!user) return;

        const list = Storage.get(KEY, []);
        list.push({
            id: uid(),
            userId: user.id,
            userFio: user.fio,
            userRole: user.role,
            action: action || "",
            target: target || "",
            details: details || "",
            type: type || "info",
            createdAt: Date.now(),
        });

        if (list.length > MAX_ENTRIES) {
            list.splice(0, list.length - MAX_ENTRIES);
        }
        Storage.set(KEY, list);
    }

    /* =========================================================
       ЧТЕНИЕ
       ========================================================= */
    function getAll() {
        return Storage.get(KEY, []).sort((a, b) => b.createdAt - a.createdAt);
    }

    function getForUser(userId) {
        return getAll().filter((x) => Storage.sameId(x.userId, userId));
    }

    function clear() {
        Storage.remove(KEY);
        currentFilter = { type: "", q: "" };
    }

    /* =========================================================
       ФИЛЬТРАЦИЯ
       ========================================================= */
    function filter(list, opts = {}) {
        let res = list;
        if (opts.userId)
            res = res.filter((x) => Storage.sameId(x.userId, opts.userId));
        if (opts.type) res = res.filter((x) => x.type === opts.type);
        if (opts.q) {
            const q = opts.q.toLowerCase();
            res = res.filter(
                (x) =>
                    (x.action || "").toLowerCase().includes(q) ||
                    (x.userFio || "").toLowerCase().includes(q) ||
                    (x.target || "").toLowerCase().includes(q) ||
                    (x.details || "").toLowerCase().includes(q),
            );
        }
        return res;
    }

    /* =========================================================
       ОТРИСОВКА
       ========================================================= */
    function renderAuditPage() {
        const all = getAll();
        const list = filter(all, currentFilter);

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Журнал действий (${all.length})</div>
          <button class="btn-ghost btn-sm" onclick="Audit.confirmClear()">
            ${SVG.trash({ cls: "icon icon-sm" })}
            <span>Очистить</span>
          </button>
        </div>

        <div class="admin-filters">
          <select onchange="Audit.filterBy(this.value, 'type')">
            <option value=""         ${currentFilter.type === "" ? "selected" : ""}>Все действия</option>
            <option value="info"     ${currentFilter.type === "info" ? "selected" : ""}>Обычные</option>
            <option value="positive" ${currentFilter.type === "positive" ? "selected" : ""}>Успешные</option>
            <option value="negative" ${currentFilter.type === "negative" ? "selected" : ""}>Отклонения</option>
            <option value="warning"  ${currentFilter.type === "warning" ? "selected" : ""}>Предупреждения</option>
          </select>
          <input type="text" placeholder="Поиск..."
            value="${escapeHtml(currentFilter.q || "")}"
            oninput="Audit.filterBy(this.value, 'q')">
        </div>

        <div id="auditList">
          ${
              list.length === 0
                  ? renderEmpty()
                  : list
                        .slice(0, 100)
                        .map((e) => renderAuditRow(e))
                        .join("")
          }
        </div>

        ${
            list.length > 100
                ? `
          <div style="text-align:center;padding:14px;color:var(--txt-muted);font-size:12px;">
            Показаны последние 100 из ${list.length}
          </div>
        `
                : ""
        }
      </div>
    `;
    }

    function renderEmpty() {
        return `
      <div class="empty-state">
        ${SVG.log({ cls: "icon icon-2xl" })}
        <h3>Записей нет</h3>
        <p>Здесь будут отображаться все значимые действия пользователей.</p>
      </div>
    `;
    }

    function renderAuditRow(e) {
        const roleLabel = ROLE_LABELS[e.userRole] || e.userRole || "—";
        return `
      <div class="audit-row">
        <div class="audit-time">${fmtDateTime(e.createdAt)}</div>
        <div class="audit-user">${escapeHtml(e.userFio || "—")}</div>
        <div>
          <span class="audit-action ${e.type}">${escapeHtml(e.action || "—")}</span>
          ${e.target ? `<span style="color:var(--txt-muted);font-size:11px;"> · ${escapeHtml(e.target)}</span>` : ""}
          ${e.details ? `<div style="font-size:11px;color:var(--txt-muted);margin-top:2px;">${escapeHtml(e.details)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <span class="role-chip ${e.userRole}">${roleLabel}</span>
        </div>
      </div>
    `;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* =========================================================
       УПРАВЛЕНИЕ
       ========================================================= */
    function filterBy(val, key) {
        currentFilter[key] = val;
        const list = filter(getAll(), currentFilter);
        const box = document.getElementById("auditList");
        if (!box) return;

        box.innerHTML =
            list.length === 0
                ? renderEmpty()
                : list
                      .slice(0, 100)
                      .map((e) => renderAuditRow(e))
                      .join("");
    }

    function confirmClear() {
        if (!confirm("Очистить весь журнал действий?")) return;
        clear();
        App.navigate("audit");
        App.toast("Журнал очищен");
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        log,
        getAll,
        getForUser,
        clear,
        filter,
        renderAuditPage,
        renderAuditRow,
        filterBy,
        confirmClear,
    };
})();
