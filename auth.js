// Athenaeum – sign in / register
// NOTE: this runs entirely in the browser (accounts are kept in localStorage).
// It is fine for a project demo, but it is not real security: a real system
// needs a server and a database to check passwords.

(() => {
  const USERS_KEY = "athenaeum-users";
  const SESSION_KEY = "athenaeum-session";
  const $ = id => document.getElementById(id);

  let failedAttempts = 0;
  let lockedUntil = 0;

  // ---------- Storage ----------
  function readUsers() {
    try {
      const v = JSON.parse(localStorage.getItem(USERS_KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeUsers(users) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); return true; }
    catch (e) { return false; }
  }

  // ---------- Password hashing (PBKDF2 with a random salt per user) ----------
  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));
  const cryptoReady = () => !!(window.crypto && crypto.subtle);

  async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", iterations: 150000, salt: enc.encode(salt) }, key, 256);
    return toHex(bits);
  }

  // ---------- Session ----------
  function saveSession(userId, remember) {
    try {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, String(userId));
    } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function currentUser() {
    try {
      const id = Number(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
      return readUsers().find(u => u.id === id) || null;
    } catch (e) { return null; }
  }

  // ---------- Screens ----------
  function greet(user) {
    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    $("greeting").textContent = `Good ${part}, ${user.name.split(/\s+/)[0]}`;
    $("avatar").textContent = initials;
    $("avatar").title = user.name;
    $("today").textContent = new Date().toLocaleDateString("en-IN",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function showApp(user) {
    $("authScreen").hidden = true;
    $("app").hidden = false;
    greet(user);
    if (typeof show === "function") show("dashboard"); // from script.js
    window.scrollTo(0, 0);
  }

  function showAuth() {
    $("app").hidden = true;
    $("authScreen").hidden = false;
    switchTab("login");
  }

  function switchTab(which) {
    const login = which === "login";
    $("loginForm").hidden = !login;
    $("registerForm").hidden = login;
    $("tabLogin").classList.toggle("active", login);
    $("tabRegister").classList.toggle("active", !login);
    $("loginMsg").textContent = ""; $("registerMsg").textContent = "";
    (login ? $("loginForm") : $("registerForm")).elements[login ? "email" : "name"].focus();
  }

  const NO_CRYPTO = "Secure sign-in isn't available here. Open the page with Live Server (127.0.0.1) or localhost.";

  // ---------- Register ----------
  $("registerForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target.elements, msg = $("registerMsg");
    const name = f.name.value.trim();
    const email = f.email.value.trim().toLowerCase();
    const password = f.password.value;

    if (name.length < 2) return msg.textContent = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg.textContent = "Enter a valid email address.";
    if (password.length < 8) return msg.textContent = "Password must be at least 8 characters.";
    if (password !== f.confirm.value) return msg.textContent = "The two passwords don't match.";
    if (!cryptoReady()) return msg.textContent = NO_CRYPTO;

    const users = readUsers();
    if (users.some(u => u.email === email)) return msg.textContent = "An account with this email already exists. Try signing in.";

    const salt = newSalt();
    const user = { id: users.reduce((m, u) => Math.max(m, u.id), 0) + 1, name, email, salt, hash: await hashPassword(password, salt) };
    users.push(user);
    if (!writeUsers(users)) return msg.textContent = "Couldn't save your account. Check that browser storage is enabled.";

    saveSession(user.id, true);
    e.target.reset();
    msg.textContent = "";
    showApp(user);
  });

  // ---------- Sign in ----------
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target.elements, msg = $("loginMsg");
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (wait > 0) return msg.textContent = `Too many attempts. Try again in ${wait} seconds.`;
    if (!f.email.value.trim() || !f.password.value) return msg.textContent = "Enter your email and password.";
    if (!cryptoReady()) return msg.textContent = NO_CRYPTO;

    const email = f.email.value.trim().toLowerCase();
    const user = readUsers().find(u => u.email === email);
    const ok = user && (await hashPassword(f.password.value, user.salt)) === user.hash;

    if (!ok) {
      failedAttempts += 1;
      if (failedAttempts >= 5) {
        failedAttempts = 0;
        lockedUntil = Date.now() + 30000;
        return msg.textContent = "Too many attempts. Try again in 30 seconds.";
      }
      return msg.textContent = "Incorrect email or password.";
    }

    failedAttempts = 0;
    saveSession(user.id, f.remember.checked);
    e.target.reset();
    msg.textContent = "";
    showApp(user);
  });

  // ---------- Tabs and sign out ----------
  $("tabLogin").addEventListener("click", () => switchTab("login"));
  $("tabRegister").addEventListener("click", () => switchTab("register"));
  $("logoutBtn").addEventListener("click", () => { clearSession(); showAuth(); });

  // ---------- Start ----------
  const user = currentUser();
  if (user) showApp(user); else showAuth();
})();