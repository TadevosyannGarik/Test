/* =========================================================
   AUTH — регистрация, вход, роли
   Обновлено: blocked: false при создании, валидация fio,
   проверка blocked в loginAs, безопасные вызовы
   ========================================================= */
const Auth = (() => {
    let selectedRole = "student";
    let currentUser = null;

    /* =========================================================
       ДЕМО-ПОЛЬЗОВАТЕЛИ
       Пароль "123456" (в открытом виде только для демо)
       ========================================================= */
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
                direction: "Программная инженерия",
                recordBook: "21-1234",
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
                position: "Доцент",
                degree: "к.т.н.",
                interests: "Нечёткая логика, искусственный интеллект",
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

    /* Добавляет демо-пользователей, не трогая существующих */
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

    /* =========================================================
       ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
       ========================================================= */
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

    /* =========================================================
       ВЫБОР РОЛИ
       ========================================================= */
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

    /* =========================================================
       ПОЛЯ ПОД РОЛЬ
       ========================================================= */
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
          <div class="field">
            <label>Факультет <span class="req">*</span></label>
            <input type="text" id="r_faculty" placeholder="ФИТ">
            <div class="field-err">Обязательно</div>
          </div>
          <div class="field">
            <label>Группа <span class="req">*</span></label>
            <input type="text" id="r_group" placeholder="ПИ-21-1">
            <div class="field-err">Обязательно</div>
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label>Курс <span class="req">*</span></label>
            <select id="r_course">
              <option value="">— выберите —</option>
              <option>1</option><option>2</option><option>3</option>
              <option>4</option><option>5</option><option>6</option>
            </select>
            <div class="field-err">Обязательно</div>
          </div>
          <div class="field">
            <label>Направление</label>
            <input type="text" id="r_direction" placeholder="Программная инженерия">
          </div>
        </div>
        <div class="field">
          <label>Номер зачётки</label>
          <input type="text" id="r_recordBook" placeholder="21-1234">
        </div>
      `;
        } else if (role === "teacher") {
            box.innerHTML = `
        <div class="row-2">
          <div class="field">
            <label>Кафедра <span class="req">*</span></label>
            <input type="text" id="r_department" placeholder="Кафедра информационных систем">
            <div class="field-err">Обязательно</div>
          </div>
          <div class="field">
            <label>Должность <span class="req">*</span></label>
            <input type="text" id="r_position" placeholder="Доцент">
            <div class="field-err">Обязательно</div>
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label>Учёная степень</label>
            <input type="text" id="r_degree" placeholder="к.т.н.">
          </div>
          <div class="field">
            <label>Макс. нагрузка (работ)</label>
            <input type="number" id="r_maxLoad" value="8" min="1" max="30">
          </div>
        </div>
        <div class="field">
          <label>Научные интересы</label>
          <input type="text" id="r_interests" placeholder="Нечёткая логика, ИИ">
        </div>
      `;
        } else {
            box.innerHTML = `
        <div class="row-2">
          <div class="field">
            <label>Подразделение <span class="req">*</span></label>
            <input type="text" id="r_department" placeholder="Кафедра информационных систем">
            <div class="field-err">Обязательно</div>
          </div>
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

    /* =========================================================
       ВАЛИДАЦИЯ
       ========================================================= */
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

    /* =========================================================
       РЕГИСТРАЦИЯ
       ========================================================= */
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

        /* Ролевые поля */
        const roleData = {};

        if (selectedRole === "student") {
            const f = document.getElementById("r_faculty");
            const g = document.getElementById("r_group");
            const c = document.getElementById("r_course");

            if (f) ok &= markField("r_faculty", f.value.trim().length > 0);
            if (g) ok &= markField("r_group", g.value.trim().length > 0);
            if (c) ok &= markField("r_course", c.value !== "");

            roleData.faculty = f?.value.trim() || "";
            roleData.group = g?.value.trim() || "";
            roleData.course = c ? +c.value : 1;
            roleData.direction =
                document.getElementById("r_direction")?.value.trim() || "";
            roleData.recordBook =
                document.getElementById("r_recordBook")?.value.trim() || "";
        } else if (selectedRole === "teacher") {
            const d = document.getElementById("r_department");
            const p = document.getElementById("r_position");

            if (d) ok &= markField("r_department", d.value.trim().length > 0);
            if (p) ok &= markField("r_position", p.value.trim().length > 0);

            roleData.department = d?.value.trim() || "";
            roleData.position = p?.value.trim() || "";
            roleData.degree =
                document.getElementById("r_degree")?.value.trim() || "";
            roleData.interests =
                document.getElementById("r_interests")?.value.trim() || "";
            roleData.maxLoad =
                +document.getElementById("r_maxLoad")?.value || 8;
        } else {
            const d = document.getElementById("r_department");
            const p = document.getElementById("r_position");
            const a = document.getElementById("r_accessLevel");

            if (d) ok &= markField("r_department", d.value.trim().length > 0);
            if (p) ok &= markField("r_position", p.value.trim().length > 0);
            if (a) ok &= markField("r_accessLevel", a.value !== "");

            roleData.department = d?.value.trim() || "";
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

    /* =========================================================
       ВХОД
       ========================================================= */
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

    /* =========================================================
       ДЕМО-АВТОЗАПОЛНЕНИЕ
       ========================================================= */
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

    /* =========================================================
       ВХОД В ПРИЛОЖЕНИЕ
       ========================================================= */
    function loginAs(user) {
        if (!user) return;

        /* Защита: заблокированный не входит */
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

    /* =========================================================
       ВЫХОД
       ========================================================= */
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

    /* =========================================================
       ВОССТАНОВЛЕНИЕ СЕССИИ
       ========================================================= */
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

    /* =========================================================
       ГЕТТЕР
       ========================================================= */
    function getUser() {
        return currentUser;
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
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
    };
})();

/* =========================================================
   ОБРАБОТЧИКИ ВКЛАДОК
   ========================================================= */
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
