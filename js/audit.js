const Audit = (() => {
    const KEY = "fp_audit";
    const MAX_ENTRIES = 500;

    let currentFilter = {
        type: "",
        q: "",
        role: "",
        dateFrom: "",
        dateTo: "",
    };

    const ROLE_LABELS = {
        student: "Студент",
        teacher: "Преподаватель",
        admin: "Администратор",
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

    function log(action, target, details, type) {
        if (typeof Auth === "undefined") return;
        const user = Auth.getUser();
        if (!user || !user.id) return;

        const list = Storage.get(KEY, []);
        const arr = Array.isArray(list) ? list : [];

        arr.push({
            id: uid(),
            userId: user.id,
            userFio: user.fio || "",
            userRole: user.role || "",
            action: action || "",
            target: target || "",
            details: details || "",
            type: type || "info",
            createdAt: Date.now(),
        });

        if (arr.length > MAX_ENTRIES) {
            arr.splice(0, arr.length - MAX_ENTRIES);
        }
        Storage.set(KEY, arr);
    }

    function getAll() {
        const list = Storage.get(KEY, []);
        return (Array.isArray(list) ? list : []).sort(
            (a, b) => b.createdAt - a.createdAt,
        );
    }

    function getForUser(userId) {
        if (!userId) return [];
        return getAll().filter((x) => Storage.sameId(x.userId, userId));
    }

    function clear() {
        Storage.remove(KEY);
        currentFilter = {
            type: "",
            q: "",
            role: "",
            dateFrom: "",
            dateTo: "",
        };
    }

    function filter(list, opts = {}) {
        let res = list;

        if (opts.userId)
            res = res.filter((x) => Storage.sameId(x.userId, opts.userId));

        if (opts.type) res = res.filter((x) => x.type === opts.type);

        if (opts.role) res = res.filter((x) => x.userRole === opts.role);

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

        if (opts.dateFrom) {
            const from = new Date(opts.dateFrom).getTime();
            if (!isNaN(from)) {
                res = res.filter((x) => x.createdAt >= from);
            }
        }

        if (opts.dateTo) {
            const to = new Date(opts.dateTo).getTime();
            if (!isNaN(to)) {
                const endOfDay = to + 86400000 - 1;
                res = res.filter((x) => x.createdAt <= endOfDay);
            }
        }

        return res;
    }

    function renderAuditPage() {
        const all = getAll();
        const list = filter(all, currentFilter);

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Журнал действий (${all.length})</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-ghost btn-sm" onclick="Audit.exportCSV()">
              ${SVG.download({ cls: "icon icon-sm" })}
              <span>CSV</span>
            </button>
            <button class="btn-ghost btn-sm" onclick="Audit.confirmClear()">
              ${SVG.trash({ cls: "icon icon-sm" })}
              <span>Очистить</span>
            </button>
          </div>
        </div>

        <div class="admin-filters" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
          <select onchange="Audit.filterBy(this.value, 'type')">
            <option value=""         ${currentFilter.type === "" ? "selected" : ""}>Все действия</option>
            <option value="info"     ${currentFilter.type === "info" ? "selected" : ""}>Обычные</option>
            <option value="positive" ${currentFilter.type === "positive" ? "selected" : ""}>Успешные</option>
            <option value="negative" ${currentFilter.type === "negative" ? "selected" : ""}>Отклонения</option>
            <option value="warning"  ${currentFilter.type === "warning" ? "selected" : ""}>Предупреждения</option>
          </select>

          <select onchange="Audit.filterBy(this.value, 'role')">
            <option value=""        ${currentFilter.role === "" ? "selected" : ""}>Все роли</option>
            <option value="student" ${currentFilter.role === "student" ? "selected" : ""}>Студенты</option>
            <option value="teacher" ${currentFilter.role === "teacher" ? "selected" : ""}>Преподаватели</option>
            <option value="admin"   ${currentFilter.role === "admin" ? "selected" : ""}>Администраторы</option>
          </select>

          <input type="date" value="${currentFilter.dateFrom || ""}"
            onchange="Audit.filterBy(this.value, 'dateFrom')"
            title="С даты">

          <input type="date" value="${currentFilter.dateTo || ""}"
            onchange="Audit.filterBy(this.value, 'dateTo')"
            title="По дату">

          <input type="text" placeholder="Поиск..."
            value="${escapeHtml(currentFilter.q || "")}"
            oninput="Audit.filterBy(this.value, 'q')">
        </div>

        <div style="font-size:12px;color:var(--txt-muted);margin-bottom:10px;">
          Найдено: <b>${list.length}</b>
          ${list.length !== all.length ? `из ${all.length}` : ""}
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
          <span class="audit-action ${e.type || "info"}">${escapeHtml(e.action || "—")}</span>
          ${e.target ? `<span style="color:var(--txt-muted);font-size:11px;"> · ${escapeHtml(e.target)}</span>` : ""}
          ${e.details ? `<div style="font-size:11px;color:var(--txt-muted);margin-top:2px;">${escapeHtml(e.details)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <span class="role-chip ${e.userRole}">${roleLabel}</span>
        </div>
      </div>
    `;
    }

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

    function exportCSV() {
        const list = filter(getAll(), currentFilter);
        if (list.length === 0) {
            App.toast("Нет записей для экспорта");
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
                "Дата",
                "Пользователь",
                "Роль",
                "Действие",
                "Объект",
                "Детали",
                "Тип",
            ],
        ];

        list.forEach((e) => {
            rows.push([
                fmtDateTime(e.createdAt),
                e.userFio || "",
                ROLE_LABELS[e.userRole] || e.userRole || "",
                e.action || "",
                e.target || "",
                e.details || "",
                e.type || "info",
            ]);
        });

        const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 500);

        if (typeof App !== "undefined" && App.toast) {
            App.toast(`Экспортировано ${list.length} записей`);
        }
    }

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
        exportCSV,
    };
})();
