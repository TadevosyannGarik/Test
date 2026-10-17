const Storage = (() => {
    const KEYS = {
        users: "fp_users",
        session: "fp_session",
        works: "fp_works",
        stages: "fp_stages",
        tasks: "fp_tasks",
        versions: "fp_versions",
        comments: "fp_comments",
        rules: "fp_rules",
        audit: "fp_audit",
        notif: "fp_notifications",
        consults: "fp_consults",
        refs: "fp_refs",
        settings: "fp_settings",
        mfOverrides: "fp_mf_overrides",
    };

    function get(key, def = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : def;
        } catch (e) {
            console.warn("[Storage] get error:", key, e);
            return def;
        }
    }

    function set(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) {
            console.warn("[Storage] set error:", key, e);
            if (typeof App !== "undefined" && App.toast) {
                App.toast("Не удалось сохранить данные (переполнение)");
            }
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn("[Storage] remove error:", key, e);
        }
    }

    function sameId(a, b) {
        if (a === null || a === undefined) return false;
        if (b === null || b === undefined) return false;
        return String(a) === String(b);
    }

    function getUsers() {
        const u = get(KEYS.users, []);
        return Array.isArray(u) ? u : [];
    }
    function setUsers(u) {
        set(KEYS.users, Array.isArray(u) ? u : []);
    }
    function getUserById(id) {
        return getUsers().find((u) => sameId(u.id, id)) || null;
    }
    function getTeachers() {
        return getUsers().filter((u) => u.role === "teacher");
    }
    function getStudents() {
        return getUsers().filter((u) => u.role === "student");
    }
    function saveUser(user) {
        if (!user || !user.id) return;
        const users = getUsers();
        const i = users.findIndex((u) => sameId(u.id, user.id));
        if (i >= 0) users[i] = user;
        else users.push(user);
        setUsers(users);
    }

    function getSession() {
        return get(KEYS.session, null);
    }
    function setSession(s) {
        set(KEYS.session, s);
    }
    function clearSession() {
        remove(KEYS.session);
    }

    function getWorks() {
        const w = get(KEYS.works, []);
        return Array.isArray(w) ? w : [];
    }
    function setWorks(w) {
        set(KEYS.works, Array.isArray(w) ? w : []);
    }
    function getWorksByStudent(studentId) {
        return getWorks().filter((w) => sameId(w.studentId, studentId));
    }
    function getWorksByTeacher(teacherId) {
        return getWorks().filter((w) => sameId(w.teacherId, teacherId));
    }
    function getWorkById(id) {
        return getWorks().find((w) => sameId(w.id, id)) || null;
    }
    function saveWork(work) {
        if (!work || !work.id) return;
        const works = getWorks();
        const i = works.findIndex((w) => sameId(w.id, work.id));
        if (i >= 0) works[i] = work;
        else works.push(work);
        setWorks(works);
    }

    function deleteWork(id) {
        if (id === null || id === undefined) return;

        setWorks(getWorks().filter((w) => !sameId(w.id, id)));
        setStages(getStages().filter((s) => !sameId(s.workId, id)));
        setTasks(getTasks().filter((t) => !sameId(t.workId, id)));
        setVersions(getVersions().filter((v) => !sameId(v.workId, id)));
        setComments(getComments().filter((c) => !sameId(c.workId, id)));

        const notifs = get(KEYS.notif, []);
        if (Array.isArray(notifs)) {
            const filtered = notifs.filter((n) => {
                const link = n && n.link;
                if (!link || !link.params) return true;
                return !sameId(link.params.id, id);
            });
            set(KEYS.notif, filtered);
        }
    }

    function getStages() {
        const s = get(KEYS.stages, []);
        return Array.isArray(s) ? s : [];
    }
    function setStages(s) {
        set(KEYS.stages, Array.isArray(s) ? s : []);
    }
    function getStagesByWork(workId) {
        return getStages()
            .filter((s) => sameId(s.workId, workId))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    function saveStage(stage) {
        if (!stage || !stage.id) return;
        const stages = getStages();
        const i = stages.findIndex((s) => sameId(s.id, stage.id));
        if (i >= 0) stages[i] = stage;
        else stages.push(stage);
        setStages(stages);
    }
    function deleteStage(id) {
        setStages(getStages().filter((s) => !sameId(s.id, id)));
    }

    function getTasks() {
        const t = get(KEYS.tasks, []);
        return Array.isArray(t) ? t : [];
    }
    function setTasks(t) {
        set(KEYS.tasks, Array.isArray(t) ? t : []);
    }
    function getTasksByWork(workId) {
        return getTasks().filter((t) => sameId(t.workId, workId));
    }
    function saveTask(task) {
        if (!task || !task.id) return;
        const tasks = getTasks();
        const i = tasks.findIndex((t) => sameId(t.id, task.id));
        if (i >= 0) tasks[i] = task;
        else tasks.push(task);
        setTasks(tasks);
    }
    function deleteTask(id) {
        setTasks(getTasks().filter((t) => !sameId(t.id, id)));
    }

    function getVersions() {
        const v = get(KEYS.versions, []);
        return Array.isArray(v) ? v : [];
    }
    function setVersions(v) {
        set(KEYS.versions, Array.isArray(v) ? v : []);
    }
    function getVersionsByWork(workId) {
        return getVersions()
            .filter((v) => sameId(v.workId, workId))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    function saveVersion(v) {
        if (!v || !v.id) return;
        const versions = getVersions();
        const i = versions.findIndex((x) => sameId(x.id, v.id));
        if (i >= 0) versions[i] = v;
        else versions.push(v);
        setVersions(versions);
    }
    function deleteVersion(id) {
        setVersions(getVersions().filter((v) => !sameId(v.id, id)));
    }

    function getComments() {
        const c = get(KEYS.comments, []);
        return Array.isArray(c) ? c : [];
    }
    function setComments(c) {
        set(KEYS.comments, Array.isArray(c) ? c : []);
    }
    function getCommentsByWork(workId) {
        return getComments()
            .filter((c) => sameId(c.workId, workId))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    function getCommentsByVersion(versionId) {
        return getComments()
            .filter((c) => sameId(c.versionId, versionId))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }
    function saveComment(c) {
        if (!c || !c.id) return;
        const comments = getComments();
        const i = comments.findIndex((x) => sameId(x.id, c.id));
        if (i >= 0) comments[i] = c;
        else comments.push(c);
        setComments(comments);
    }
    function deleteComment(id) {
        setComments(getComments().filter((c) => !sameId(c.id, id)));
    }

    function getRules() {
        const r = get(KEYS.rules, null);
        return Array.isArray(r) ? r : null;
    }
    function setRules(r) {
        set(KEYS.rules, r);
    }

    function clearAll() {
        try {
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("fp_")) localStorage.removeItem(key);
            });
        } catch (e) {
            console.warn("[Storage] clearAll error:", e);
        }
    }

    function getSizeBytes() {
        let bytes = 0;
        try {
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("fp_")) {
                    const value = localStorage[key] || "";
                    bytes += new Blob([key + value]).size;
                }
            });
        } catch (e) {
            console.warn("[Storage] getSizeBytes error:", e);
        }
        return bytes;
    }

    function getSizeKB() {
        return Math.round(getSizeBytes() / 1024);
    }

    return {
        KEYS,
        get,
        set,
        remove,
        sameId,

        getUsers,
        setUsers,
        getUserById,
        getTeachers,
        getStudents,
        saveUser,
        getSession,
        setSession,
        clearSession,

        getWorks,
        setWorks,
        getWorksByStudent,
        getWorksByTeacher,
        getWorkById,
        saveWork,
        deleteWork,

        getStages,
        setStages,
        getStagesByWork,
        saveStage,
        deleteStage,

        getTasks,
        setTasks,
        getTasksByWork,
        saveTask,
        deleteTask,

        getVersions,
        setVersions,
        getVersionsByWork,
        saveVersion,
        deleteVersion,

        getComments,
        setComments,
        getCommentsByWork,
        getCommentsByVersion,
        saveComment,
        deleteComment,

        getRules,
        setRules,

        clearAll,
        getSizeKB,
        getSizeBytes,
    };
})();

function hashPass(p) {
    if (!p) return "h0";

    const SALT = "meridian-fuzzy-2024";
    let str = SALT + String(p) + SALT;

    let hash = 2166136261;
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = (hash * 16777619) >>> 0;
            hash ^= hash >>> 13;
        }
        str = hash.toString(36) + str + hash;
    }

    return "h" + hash.toString(36);
}
let _uidCounter = 0;
function uid() {
    _uidCounter = (_uidCounter + 1) % 1000000;
    return String(Date.now()) + String(_uidCounter).padStart(6, "0");
}

function fmtDate(ts) {
    if (ts === null || ts === undefined) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch (e) {
        return "—";
    }
}

function fmtDateTime(ts) {
    if (ts === null || ts === undefined) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch (e) {
        return "—";
    }
}

function daysUntil(dateStr) {
    if (!dateStr) return 0;

    const str = String(dateStr).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return 0;

    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (!y || !m || !d) return 0;

    const target = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (isNaN(target.getTime())) return 0;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
    return isNaN(diff) ? 0 : diff;
}
