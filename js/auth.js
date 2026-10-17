const Auth = (() => {
    let selectedRole = "student";
    let currentUser = null;

    const escapeHtml = Utils.escapeHtml;

    const REF_KEY = "fp_refs";

    const DEFAULT_REFS = {
        faculties: ["ФИТ", "ФЭН", "ГФ"],
        departments: ["Кафедра информационных систем", "Кафедра математики"],
        groups: ["ПИ-21-1", "ПИ-21-2", "ИВТ-22-1"],
        directions: ["Программная инженерия", "Информационные системы"],
    };

    function getRefs() {
        const refs = Storage.get(REF_KEY, null);
        if (!refs || typeof refs !== "object") return DEFAULT_REFS;
        return {
            faculties: Array.isArray(refs.faculties) ? refs.faculties : [],
            departments: Array.isArray(refs.departments)
                ? refs.departments
                : [],
            groups: Array.isArray(refs.groups) ? refs.groups : [],
            directions: Array.isArray(refs.directions) ? refs.directions : [],
        };
    }

    function renderRefField({
        id,
        label,
        refKey,
        required,
        placeholder,
        cssClass = "",
    }) {
        const refs = getRefs();
        const options = refs[refKey] || [];
        const reqMark = required ? '<span class="req">*</span>' : "";
        const wrapperClass = `field ${cssClass}`.trim();

        if (options.length === 0) {
            return `
                <div class="${wrapperClass}">
                    <label>${label} ${reqMark}</label>
                    <input type="text" id="${id}" placeholder="${escapeHtml(placeholder || "")}">
                    <div class="field-err">Обязательно</div>
                </div>
            `;
        }

        const optionsHtml = options
            .map((o) => {
                const val = escapeHtml(o);
                return `<option value="${val}">${val}</option>`;
            })
            .join("");

        return `
            <div class="${wrapperClass}">
                <label>${label} ${reqMark}</label>
                <select id="${id}" onchange="Auth.onRefSelectChange(this)">
                    <option value="">— выберите —</option>
                    ${optionsHtml}
                    <option value="__custom__">+ Другое…</option>
                </select>
                <input type="text" id="${id}_custom"
                    placeholder="Введите своё значение"
                    style="display:none;margin-top:8px;">
                <div class="field-err">Обязательно</div>
            </div>
        `;
    }

    function onRefSelectChange(selectEl) {
        if (!selectEl || !selectEl.id) return;
        const custom = document.getElementById(selectEl.id + "_custom");
        if (!custom) return;

        if (selectEl.value === "__custom__") {
            custom.style.display = "block";
            custom.focus();
        } else {
            custom.style.display = "none";
            custom.value = "";
        }
    }

    function getRefValue(id) {
        const el = document.getElementById(id);
        if (!el) return "";
        if (el.tagName === "SELECT") {
            if (el.value === "__custom__") {
                const custom = document.getElementById(id + "_custom");
                return custom ? custom.value.trim() : "";
            }
            return el.value.trim();
        }
        return el.value.trim();
    }

    function validateRefField(id, required) {
        const el = document.getElementById(id);
        if (!el) return true;
        const val = getRefValue(id);
        const ok = !required || val.length > 0;
        const wrap = el.closest(".field");
        if (wrap) wrap.classList.toggle("invalid", !ok);
        return ok;
    }

    function getDemoUsers() {
        return [
            {
                id: 1,
                role: "student",
                fio: "Иванов Иван Иванович",
                email: "student@demo.ru",
                pass: hashPass("123456"),
                faculty: "ФИТ",
                group: "ПИ-21-1",
                course: 3,
                blocked: false,
                createdAt: Date.now(),
            },
            {
                id: 2,
                role: "teacher",
                fio: "Петров Пётр Петрович",
                email: "teacher@demo.ru",
                pass: hashPass("123456"),
                department: "Кафедра информационных систем",
                degree: "к.т.н.",
                maxLoad: 8,
                blocked: false,
                createdAt: Date.now(),
            },
            {
                id: 3,
                role: "admin",
                fio: "Сидорова Елена Алексеевна",
                email: "admin@demo.ru",
                pass: hashPass("123456"),
                department: "Кафедра информационных систем",
                position: "Заведующая кафедрой",
                accessLevel: "Полный",
                blocked: false,
                createdAt: Date.now(),
            },
        ];
    }

    function seedDemo() {
        const users = Storage.getUsers();
        const existingEmails = new Set(users.map((u) => u.email));
        const demo = getDemoUsers();

        let changed = false;
        demo.forEach((d) => {
            if (!existingEmails.has(d.email)) {
                users.push(d);
                changed = true;
            }
        });

        if (changed) Storage.setUsers(users);
    }

    function switchTab(mode) {
        const loginTab = document.getElementById("tabLogin");
        const registerTab = document.getElementById("tabRegister");
        const loginForm = document.getElementById("loginForm");
        const registerForm = document.getElementById("registerForm");

        if (loginTab) loginTab.classList.toggle("active", mode === "login");
        if (registerTab)
            registerTab.classList.toggle("active", mode === "register");
        if (loginForm)
            loginForm.style.display = mode === "login" ? "block" : "none";
        if (registerForm)
            registerForm.style.display = mode === "register" ? "block" : "none";

        hideMsg();
    }

    function pickRole(role) {
        if (!["student", "teacher", "admin"].includes(role)) return;
        selectedRole = role;

        const picker = document.querySelector(".role-picker");
        if (picker) {
            picker.querySelectorAll("button").forEach((b) => {
                b.classList.toggle("active", b.dataset.role === role);
            });
        }

        renderRoleFields(role);
    }

    function renderRoleFields(role) {
        const label = document.getElementById("roleSectionLabel");
        const box = document.getElementById("roleFields");
        if (!label || !box) return;

        const roleTitles = {
            student: "Данные студента",
            teacher: "Данные преподавателя",
            admin: "Данные администратора",
        };
        label.textContent = roleTitles[role] || "";

        if (role === "student") {
            box.innerHTML = `
                <div class="row-2">
                    ${renderRefField({
                        id: "r_faculty",
                        label: "Факультет",
                        refKey: "faculties",
                        required: true,
                        placeholder: "ФИТ",
                    })}
                    ${renderRefField({
                        id: "r_group",
                        label: "Группа",
                        refKey: "groups",
                        required: true,
                        placeholder: "ПИ-21-1",
                    })}
                </div>
                <div class="field">
                    <label>Курс <span class="req">*</span></label>
                    <select id="r_course">
                        <option value="">— выберите —</option>
                        <option>1</option><option>2</option><option>3</option>
                        <option>4</option><option>5</option><option>6</option>
                    </select>
                    <div class="field-err">Обязательно</div>
                </div>
            `;
        } else if (role === "teacher") {
            box.innerHTML = `
                <div class="row-2">
                    ${renderRefField({
                        id: "r_department",
                        label: "Кафедра",
                        refKey: "departments",
                        required: true,
                        placeholder: "Кафедра информационных систем",
                    })}
                    <div class="field">
                        <label>Учёная степень</label>
                        <input type="text" id="r_degree" placeholder="к.т.н.">
                    </div>
                </div>
                <div class="field">
                    <label>Макс. нагрузка (работ)</label>
                    <input type="number" id="r_maxLoad" value="8" min="1" max="30">
                </div>
            `;
        } else {
            box.innerHTML = `
                <div class="row-2">
                    ${renderRefField({
                        id: "r_department",
                        label: "Подразделение",
                        refKey: "departments",
                        required: true,
                        placeholder: "Кафедра информационных систем",
                    })}
                    <div class="field">
                        <label>Должность <span class="req">*</span></label>
                        <input type="text" id="r_position" placeholder="Заведующая кафедрой">
                        <div class="field-err">Обязательно</div>
                    </div>
                </div>
                <div class="field">
                    <label>Уровень доступа <span class="req">*</span></label>
                    <select id="r_accessLevel">
                        <option value="">— выберите —</option>
                        <option>Полный</option>
                        <option>Ограниченный</option>
                        <option>Только чтение</option>
                    </select>
                    <div class="field-err">Обязательно</div>
                </div>
            `;
        }
    }

    function markField(id, valid) {
        const el = document.getElementById(id);
        if (!el) return valid;
        const wrap = el.closest(".field");
        if (wrap) wrap.classList.toggle("invalid", !valid);
        return valid;
    }

    function showMsg(text, type = "error") {
        const m = document.getElementById("authMsg");
        if (!m) return;
        m.textContent = text;
        m.className = "auth-msg show " + type;
    }

    function hideMsg() {
        const m = document.getElementById("authMsg");
        if (!m) return;
        m.className = "auth-msg";
        m.textContent = "";
    }

    function register() {
        hideMsg();
        let ok = true;

        const fio = document.getElementById("regFio")?.value.trim() || "";
        const fioParts = fio.split(/\s+/).filter(Boolean);
        const fioOk = fio.length >= 3 && fioParts.length >= 2;
        ok &= markField("regFio", fioOk);

        const email =
            document.getElementById("regEmail")?.value.trim().toLowerCase() ||
            "";
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        ok &= markField("regEmail", emailOk);

        const pass = document.getElementById("regPass")?.value || "";
        ok &= markField("regPass", pass.length >= 6);

        const pass2 = document.getElementById("regPass2")?.value || "";
        ok &= markField("regPass2", pass === pass2 && pass2.length >= 6);

        const roleData = {};

        if (selectedRole === "student") {
            ok &= validateRefField("r_faculty", true);
            ok &= validateRefField("r_group", true);
            const c = document.getElementById("r_course");
            if (c) ok &= markField("r_course", c.value !== "");

            roleData.faculty = getRefValue("r_faculty");
            roleData.group = getRefValue("r_group");
            roleData.course = c ? +c.value : 1;
        } else if (selectedRole === "teacher") {
            ok &= validateRefField("r_department", true);

            roleData.department = getRefValue("r_department");
            roleData.degree =
                document.getElementById("r_degree")?.value.trim() || "";
            roleData.maxLoad =
                +document.getElementById("r_maxLoad")?.value || 8;
        } else {
            ok &= validateRefField("r_department", true);
            const p = document.getElementById("r_position");
            if (p) ok &= markField("r_position", p.value.trim().length > 0);
            const a = document.getElementById("r_accessLevel");
            if (a) ok &= markField("r_accessLevel", a.value !== "");

            roleData.department = getRefValue("r_department");
            roleData.position = p?.value.trim() || "";
            roleData.accessLevel = a?.value || "Полный";
        }

        if (!ok) {
            showMsg("Проверьте выделенные поля");
            return;
        }

        const users = Storage.getUsers();
        if (users.some((u) => u.email === email)) {
            showMsg("Email уже зарегистрирован");
            return;
        }

        const newUser = {
            id: uid(),
            role: selectedRole,
            fio,
            email,
            pass: hashPass(pass),
            blocked: false,
            ...roleData,
            createdAt: Date.now(),
        };
        users.push(newUser);
        Storage.setUsers(users);

        if (typeof Audit !== "undefined") {
            Audit.log("Регистрация", fio, selectedRole, "positive");
        }

        showMsg("Аккаунт создан! Выполняется вход...", "ok");
        setTimeout(() => loginAs(newUser), 600);
    }

    function login() {
        hideMsg();
        const email =
            document.getElementById("loginEmail")?.value.trim().toLowerCase() ||
            "";
        const pass = document.getElementById("loginPass")?.value || "";

        markField("loginEmail", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        markField("loginPass", pass.length > 0);
        if (!email || !pass) return;

        const users = Storage.getUsers();
        const u = users.find((x) => x.email === email);

        if (!u || u.pass !== hashPass(pass)) {
            showMsg("Неверный email или пароль");
            return;
        }

        if (u.blocked) {
            showMsg("Аккаунт заблокирован. Обратитесь к администратору.");
            return;
        }

        loginAs(u);
    }

    function fillDemo(role) {
        const emails = {
            student: "student@demo.ru",
            teacher: "teacher@demo.ru",
            admin: "admin@demo.ru",
        };

        const emailEl = document.getElementById("loginEmail");
        const passEl = document.getElementById("loginPass");
        if (emailEl) emailEl.value = emails[role] || "";
        if (passEl) passEl.value = "123456";

        document.querySelectorAll(".field.invalid").forEach((f) => {
            f.classList.remove("invalid");
        });
        hideMsg();
    }

    function loginAs(user) {
        if (!user) return;

        if (user.blocked) {
            showMsg("Аккаунт заблокирован. Обратитесь к администратору.");
            return;
        }

        currentUser = user;
        Storage.setSession({ userId: user.id, loginAt: Date.now() });

        const authScreen = document.getElementById("authScreen");
        const appEl = document.getElementById("app");
        if (authScreen) authScreen.style.display = "none";
        if (appEl) appEl.style.display = "flex";

        if (typeof Audit !== "undefined") {
            Audit.log("Вход в систему", "", user.role, "info");
        }

        if (typeof App !== "undefined" && App.boot) {
            try {
                App.boot(user);
            } catch (err) {
                console.error("[Auth] Ошибка boot:", err);
            }
        }
    }

    function logout() {
        if (currentUser && typeof Audit !== "undefined") {
            Audit.log("Выход из системы", "", currentUser.role, "info");
        }

        Storage.clearSession();
        currentUser = null;

        if (typeof Student !== "undefined" && Student.clearSelectedWork) {
            Student.clearSelectedWork();
        }

        location.reload();
    }

    function restoreSession() {
        const sess = Storage.getSession();
        if (!sess) return false;

        const u = Storage.getUsers().find(
            (x) => String(x.id) === String(sess.userId),
        );
        if (!u) {
            Storage.clearSession();
            return false;
        }

        if (u.blocked) {
            Storage.clearSession();
            return false;
        }

        loginAs(u);
        return true;
    }

    function getUser() {
        return currentUser;
    }

    return {
        seedDemo,
        switchTab,
        pickRole,
        renderRoleFields,
        register,
        login,
        fillDemo,
        logout,
        restoreSession,
        getUser,

        renderRefField,
        onRefSelectChange,
        getRefValue,
        validateRefField,
    };
})();

document.addEventListener("DOMContentLoaded", () => {
    const loginTab = document.getElementById("tabLogin");
    const registerTab = document.getElementById("tabRegister");

    if (loginTab) {
        loginTab.addEventListener("click", () => Auth.switchTab("login"));
    }
    if (registerTab) {
        registerTab.addEventListener("click", () => Auth.switchTab("register"));
    }
});
