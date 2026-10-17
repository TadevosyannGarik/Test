const Notifications = (() => {
    const KEY = "fp_notifications";
    const MAX_PER_USER = 200;

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

    function safeUser() {
        if (typeof Auth === "undefined") return null;
        try {
            const u = Auth.getUser();
            if (!u || !u.id) return null;
            return u;
        } catch (e) {
            return null;
        }
    }

    function getAll() {
        const list = Storage.get(KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function setAll(list) {
        Storage.set(KEY, Array.isArray(list) ? list : []);
    }

    function refresh() {
        try {
            if (typeof App !== "undefined" && App.refreshNotifications) {
                App.refreshNotifications();
            }
        } catch (e) {
            console.warn("[Notifications] refresh error:", e);
        }
    }

    function add({ userId, type, title, text, link }) {
        if (!userId) return null;

        const list = getAll();

        const notif = {
            id: uid(),
            userId,
            type: type || "info",
            title: title || "",
            text: text || "",
            link: link || null,
            read: false,
            createdAt: Date.now(),
        };
        list.push(notif);

        const userNotifs = list.filter((n) => Storage.sameId(n.userId, userId));

        let finalList = list;

        if (userNotifs.length > MAX_PER_USER) {
            const sorted = [...userNotifs].sort(
                (a, b) => a.createdAt - b.createdAt,
            );
            const toRemove = new Set(
                sorted
                    .slice(0, userNotifs.length - MAX_PER_USER)
                    .map((n) => n.id),
            );
            finalList = list.filter((n) => !toRemove.has(n.id));
        }

        setAll(finalList);
        refresh();

        return notif;
    }

    function getForUser(userId) {
        if (!userId) return [];
        return getAll()
            .filter((n) => Storage.sameId(n.userId, userId))
            .sort((a, b) => {
                if (a.read !== b.read) return a.read ? 1 : -1;
                return b.createdAt - a.createdAt;
            });
    }

    function unreadCount(userId) {
        if (!userId) return 0;
        let count = 0;
        const list = getAll();
        for (let i = 0; i < list.length; i++) {
            const n = list[i];
            if (Storage.sameId(n.userId, userId) && !n.read) count++;
        }
        return count;
    }

    function markRead(id) {
        if (!id) return null;
        const list = getAll();
        const n = list.find((x) => Storage.sameId(x.id, id));
        if (!n) return null;
        if (!n.read) {
            n.read = true;
            setAll(list);
            refresh();
        }
        return n;
    }

    function markAllRead(userId) {
        if (!userId) return;
        const list = getAll();
        let changed = false;
        for (const n of list) {
            if (Storage.sameId(n.userId, userId) && !n.read) {
                n.read = true;
                changed = true;
            }
        }
        if (changed) {
            setAll(list);
            refresh();
        }
    }

    function deleteNotif(id) {
        if (!id) return false;
        const list = getAll();
        const filtered = list.filter((n) => !Storage.sameId(n.id, id));
        if (filtered.length === list.length) return false;
        setAll(filtered);
        refresh();
        return true;
    }

    function clearAllForUser(userId) {
        if (!userId) return;
        const list = getAll();
        const filtered = list.filter((n) => !Storage.sameId(n.userId, userId));
        setAll(filtered);
        refresh();
    }

    function iconFor(type) {
        if (typeof SVG === "undefined") return "";
        switch (type) {
            case "work":
                return SVG.folder({ cls: "icon icon-xs" });
            case "comment":
                return SVG.messageCircle({ cls: "icon icon-xs" });
            case "risk":
                return SVG.alertTriangle({ cls: "icon icon-xs" });
            case "approve":
                return SVG.check({ cls: "icon icon-xs" });
            case "reject":
                return SVG.x({ cls: "icon icon-xs" });
            default:
                return SVG.bell({ cls: "icon icon-xs" });
        }
    }

    function renderPanel(userId) {
        const closeBtn = (id) => `
            <button onclick="Notifications.closePanel()" title="Закрыть" class="notif-close" aria-label="Закрыть">
              ${typeof SVG !== "undefined" ? SVG.x({ cls: "icon icon-xs" }) : "×"}
            </button>
        `;

        if (!userId) {
            return `
        <div class="notif-panel" id="notifPanel" role="dialog" aria-modal="true" aria-label="Уведомления">
          <div class="notif-panel-head">
            <h4>Уведомления</h4>
            ${closeBtn()}
          </div>
          <div class="notif-empty">
            ${typeof SVG !== "undefined" ? SVG.bell({ cls: "icon icon-lg" }) : ""}
            <div style="margin-top:8px;">Нет данных</div>
          </div>
        </div>
      `;
        }

        const list = getForUser(userId);
        const unread = unreadCount(userId);

        if (list.length === 0) {
            return `
        <div class="notif-panel" id="notifPanel" role="dialog" aria-modal="true" aria-label="Уведомления">
          <div class="notif-panel-head">
            <h4>Уведомления</h4>
            ${closeBtn()}
          </div>
          <div class="notif-empty">
            ${typeof SVG !== "undefined" ? SVG.bell({ cls: "icon icon-lg" }) : ""}
            <div style="margin-top:8px;">Уведомлений нет</div>
          </div>
        </div>
      `;
        }

        return `
      <div class="notif-panel" id="notifPanel" role="dialog" aria-modal="true" aria-label="Уведомления">
        <div class="notif-panel-head">
          <h4>
            Уведомления
            ${unread > 0 ? `<span class="count-chip">${unread}</span>` : ""}
          </h4>
          <div style="display:flex;gap:8px;align-items:center;">
            ${
                unread > 0
                    ? `<button onclick="Notifications.markAll()" class="notif-action">Прочитать все</button>`
                    : ""
            }
            ${closeBtn()}
          </div>
        </div>
        <div class="notif-list">
          ${list.map((n) => renderItem(n)).join("")}
        </div>
      </div>
    `;
    }

    function renderItem(n) {
        return `
      <div class="notif-item ${n.read ? "" : "unread"}"
        role="button"
        tabindex="0"
        onclick="Notifications.openItem('${n.id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();Notifications.openItem('${n.id}')}">
        <div class="notif-item-head">
          <span class="notif-item-ico">${iconFor(n.type)}</span>
          <span class="notif-item-title">${escapeHtml(n.title)}</span>
        </div>
        ${n.text ? `<div class="notif-item-text">${escapeHtml(n.text)}</div>` : ""}
        <div class="notif-item-time">${fmtDateTime(n.createdAt)}</div>
      </div>
    `;
    }

    function closePanel() {
        const el = document.getElementById("notifPanel");
        if (el) el.remove();
    }

    function openItem(id) {
        if (!id) return;
        const n = markRead(id);
        closePanel();

        if (typeof App !== "undefined" && n && n.link && n.link.view) {
            App.navigate(n.link.view, n.link.params);
        }
    }

    function markAll() {
        const u = safeUser();
        if (u) markAllRead(u.id);
        closePanel();
        refresh();
    }

    function toggle() {
        const existing = document.getElementById("notifPanel");
        if (existing) {
            closePanel();
            return;
        }

        const u = safeUser();
        const userId = u ? u.id : null;
        const html = renderPanel(userId);

        const bell = document.getElementById("notifBell");
        let host = null;

        if (bell) {
            host = bell.closest(".notif-wrap") || bell.parentElement;
        }

        if (!host) {
            const wrapper = document.createElement("div");
            wrapper.style.position = "fixed";
            wrapper.style.top = "56px";
            wrapper.style.right = "16px";
            wrapper.style.zIndex = "500";
            wrapper.innerHTML = html;
            document.body.appendChild(wrapper);
            return;
        }

        if (host.querySelector("#notifPanel")) {
            closePanel();
            return;
        }

        host.insertAdjacentHTML("beforeend", html);
    }

    return {
        add,
        getAll,
        getForUser,
        unreadCount,
        markRead,
        markAllRead,
        deleteNotif,
        clearAllForUser,
        renderPanel,
        closePanel,
        openItem,
        markAll,
        toggle,
        refresh,
    };
})();
