// Athenaeum – library management
// Catalogue (add/edit/delete), members, issue & return, reservations, fines, reports.
// Data is kept in the browser's localStorage, so it survives a refresh.

const FINE_PER_DAY = 5;
const COLORS = ["#2f4b7c", "#b8892f", "#8a3b32", "#2d6a5a"];
const $ = id => document.getElementById(id);

// ---------- Helpers ----------
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const plus = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
const fmtDate = s => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const esc = t => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; };
const nextId = list => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;

function load(key, seed) {
  try { const v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v)) return v; } catch (e) {}
  return seed();
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function flash(el, text, isError) {
  el.textContent = text;
  el.classList.toggle("error", !!isError);
}

// ---------- Data ----------
let books = load("athenaeum-books", () => [
  { id: 1, title: "Introduction to Algorithms", author: "Thomas H. Cormen", isbn: "9780262046305", genre: "Engineering & technology", copies: 6 },
  { id: 2, title: "Operating System Concepts", author: "Abraham Silberschatz", isbn: "9781119800361", genre: "Engineering & technology", copies: 5 },
  { id: 3, title: "The Discovery of India", author: "Jawaharlal Nehru", isbn: "9780143031031", genre: "History & politics", copies: 3 },
  { id: 4, title: "Wings of Fire", author: "A. P. J. Abdul Kalam", isbn: "9788173711466", genre: "Other", copies: 8 },
  { id: 5, title: "Godaan", author: "Premchand", isbn: "9788171672509", genre: "Fiction", copies: 4 }
]);
let members = load("athenaeum-members", () => [
  { id: 1, name: "Aarav Mehta", dept: "Computer Science, 3rd yr" },
  { id: 2, name: "Sneha Kulkarni", dept: "History, 2nd yr" },
  { id: 3, name: "Rohan Desai", dept: "Information Technology, 2nd yr" },
  { id: 4, name: "Priya Nair", dept: "Mechanical, 1st yr" },
  { id: 5, name: "Kabir Shah", dept: "Electronics, 3rd yr" }
]);
let loans = load("athenaeum-loans", () => {
  const t = today();
  const mk = (id, bookId, memberId, dueOffset) =>
    ({ id, bookId, memberId, issued: plus(t, dueOffset - 14), due: plus(t, dueOffset), returned: null });
  return [mk(1, 1, 1, 0), mk(2, 3, 2, 0), mk(3, 2, 3, -5), mk(4, 5, 4, -12), mk(5, 4, 5, 7)];
});
let reservations = load("athenaeum-reservations", () => []);

const bookOf = id => books.find(b => b.id === id);
const memberOf = id => members.find(m => m.id === id);
const active = () => loans.filter(l => !l.returned && bookOf(l.bookId) && memberOf(l.memberId));
const copiesOut = bookId => loans.filter(l => !l.returned && l.bookId === bookId).length;
const available = b => b.copies - copiesOut(b.id);
const lateDays = l => Math.max(0, daysBetween(l.due, today()));
const saveAll = () => {
  save("athenaeum-books", books); save("athenaeum-members", members);
  save("athenaeum-loans", loans); save("athenaeum-reservations", reservations);
  renderAll();
};

// ---------- Navigation ----------
function show(view) {
  document.querySelectorAll("[data-view]").forEach(el => { el.hidden = el.dataset.view !== view; });
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === view));
  currentView = view;
}
let currentView = "dashboard";

document.querySelector(".sidebar nav").addEventListener("click", e => {
  const link = e.target.closest("[data-nav]");
  if (!link) return;
  e.preventDefault();
  show(link.dataset.nav);
});

// ---------- Render ----------
function fillSelect(select, items, label) {
  const previous = select.value;
  select.innerHTML = items.length
    ? items.map(i => `<option value="${i.id}">${esc(label(i))}</option>`).join("")
    : `<option value="">None available</option>`;
  if (items.some(i => String(i.id) === previous)) select.value = previous;
}

function renderDashboard() {
  const act = active(), t = today();
  const late = act.filter(l => lateDays(l) > 0).sort((a, b) => lateDays(b) - lateDays(a));
  $("bookCount").textContent = books.reduce((s, b) => s + b.copies, 0).toLocaleString("en-IN");
  $("issuedToday").textContent = loans.filter(l => l.issued === t).length;
  $("memberCount").textContent = members.length.toLocaleString("en-IN");
  $("overdueCount").textContent = late.length;

  const due = act.filter(l => l.due === t).slice(0, 4);
  $("dueSlips").innerHTML = due.length ? due.map(l => {
    const b = bookOf(l.bookId), m = memberOf(l.memberId);
    return `<li class="slip">
      <div class="spine" style="--c:${COLORS[b.id % 4]}"></div>
      <div class="info"><strong>${esc(b.title)}</strong><span>${esc(b.author)}</span></div>
      <div class="who">${esc(m.name)}<small>${esc(m.dept)}</small></div>
      <button class="btn ghost" type="button" data-return="${l.id}">Mark returned</button>
    </li>`;
  }).join("") : `<li class="empty">Nothing is due back today.</li>`;

  $("overdueRows").innerHTML = late.length ? late.slice(0, 4).map(l =>
    `<tr><td>${esc(memberOf(l.memberId).name)}</td><td>${esc(bookOf(l.bookId).title)}</td>
     <td class="r late">${lateDays(l)}</td><td class="r">₹${lateDays(l) * FINE_PER_DAY}</td></tr>`
  ).join("") : `<tr><td colspan="4" class="empty-cell">No overdue books.</td></tr>`;
}

function renderCatalogue() {
  const q = $("searchInput").value.trim().toLowerCase();
  const list = books.filter(b => [b.title, b.author, b.isbn].some(v => (v || "").toLowerCase().includes(q)));
  $("bookRows").innerHTML = list.map(b => `
    <tr>
      <td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${esc(b.isbn || "–")}</td><td>${esc(b.genre)}</td>
      <td class="r">${available(b)} / ${b.copies}</td>
      <td class="r"><div class="row-actions">
        <button class="link-btn" data-action="edit" data-id="${b.id}" type="button">Edit</button>
        <button class="link-btn danger" data-action="delete" data-id="${b.id}" type="button">Delete</button>
      </div></td>
    </tr>`).join("");
  $("emptyMsg").hidden = list.length > 0;
  $("emptyMsg").textContent = books.length === 0
    ? "The catalogue is empty. Select “Add a book” to insert the first one."
    : "No books match your search.";
}

function renderIssue() {
  fillSelect($("issueMember"), members, m => m.name);
  fillSelect($("issueBook"), books.filter(b => available(b) > 0), b => `${b.title} (${available(b)} available)`);
  const t = today();
  const rows = active().sort((a, b) => a.due.localeCompare(b.due));
  $("loanRows").innerHTML = rows.length ? rows.map(l => {
    const late = lateDays(l);
    const status = late > 0 ? `<span class="late">${late} day${late > 1 ? "s" : ""} late</span>`
      : l.due === t ? "Due today" : `<span class="status-ok">On time</span>`;
    return `<tr><td>${esc(bookOf(l.bookId).title)}</td><td>${esc(memberOf(l.memberId).name)}</td>
      <td>${fmtDate(l.issued)}</td><td>${fmtDate(l.due)}</td><td>${status}</td>
      <td class="r"><button class="link-btn" type="button" data-return="${l.id}">Return</button></td></tr>`;
  }).join("") : `<tr><td colspan="6" class="empty-cell">No books are currently issued.</td></tr>`;
}

function renderMembers() {
  $("memberRows").innerHTML = members.map(m => `
    <tr><td>${esc(m.name)}</td><td>${esc(m.dept)}</td>
    <td class="r">${active().filter(l => l.memberId === m.id).length}</td>
    <td class="r"><button class="link-btn danger" type="button" data-del-member="${m.id}">Delete</button></td></tr>`
  ).join("") || `<tr><td colspan="4" class="empty-cell">No members yet.</td></tr>`;
}

function renderReservations() {
  fillSelect($("resMember"), members, m => m.name);
  fillSelect($("resBook"), books, b => b.title);
  const rows = reservations.filter(r => bookOf(r.bookId) && memberOf(r.memberId));
  $("resRows").innerHTML = rows.length ? rows.map(r => `
    <tr><td>${esc(bookOf(r.bookId).title)}</td><td>${esc(memberOf(r.memberId).name)}</td><td>${fmtDate(r.date)}</td>
    <td class="r"><button class="link-btn danger" type="button" data-cancel-res="${r.id}">Cancel</button></td></tr>`
  ).join("") : `<tr><td colspan="4" class="empty-cell">No reservations yet.</td></tr>`;
}

function renderFines() {
  const late = active().filter(l => lateDays(l) > 0).sort((a, b) => lateDays(b) - lateDays(a));
  const total = late.reduce((s, l) => s + lateDays(l) * FINE_PER_DAY, 0);
  $("fineTotal").textContent = `₹${FINE_PER_DAY} per day · total ₹${total}`;
  $("fineRows").innerHTML = late.length ? late.map(l => `
    <tr><td>${esc(memberOf(l.memberId).name)}</td><td>${esc(bookOf(l.bookId).title)}</td><td>${fmtDate(l.due)}</td>
    <td class="r late">${lateDays(l)}</td><td class="r">₹${lateDays(l) * FINE_PER_DAY}</td></tr>`
  ).join("") : `<tr><td colspan="5" class="empty-cell">No fines are due.</td></tr>`;
}

function renderReports() {
  const act = active();
  const totalCopies = books.reduce((s, b) => s + b.copies, 0);
  const counts = {};
  loans.forEach(l => { counts[l.bookId] = (counts[l.bookId] || 0) + 1; });
  const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(Number).find(bookOf);
  const fines = act.reduce((s, l) => s + lateDays(l) * FINE_PER_DAY, 0);
  const lines = [
    ["Titles in catalogue", books.length],
    ["Total copies", totalCopies],
    ["Copies on loan", act.length],
    ["Copies on the shelf", totalCopies - act.length],
    ["Members", members.length],
    ["Overdue loans", act.filter(l => lateDays(l) > 0).length],
    ["Fines outstanding", "₹" + fines],
    ["Most issued title", topId ? bookOf(topId).title : "–"]
  ];
  $("reportList").innerHTML = lines.map(([k, v]) => `<li><span>${k}</span><strong>${esc(String(v))}</strong></li>`).join("");
}

function renderAll() {
  renderDashboard(); renderCatalogue(); renderIssue();
  renderMembers(); renderReservations(); renderFines(); renderReports();
}

// ---------- Issue & return ----------
function issueBook(bookId, memberId, days) {
  const book = bookOf(bookId), member = memberOf(memberId);
  if (!book || !member) return "Choose a member and a book.";
  if (available(book) < 1) return "No copies of this book are available.";
  if (loans.some(l => !l.returned && l.bookId === bookId && l.memberId === memberId))
    return `${member.name} already has this book.`;
  const t = today();
  loans.push({ id: nextId(loans), bookId, memberId, issued: t, due: plus(t, days), returned: null });
  return null;
}

$("issueForm").addEventListener("submit", e => {
  e.preventDefault();
  const bookId = Number($("issueBook").value), memberId = Number($("issueMember").value);
  const days = Math.min(60, Math.max(1, parseInt($("issueDays").value, 10) || 14));
  const error = issueBook(bookId, memberId, days);
  if (error) return flash($("issueMsg"), error, true);
  const b = bookOf(bookId), m = memberOf(memberId);
  saveAll();
  flash($("issueMsg"), `Issued “${b.title}” to ${m.name}. Due ${fmtDate(plus(today(), days))}.`);
});

function returnLoan(id) {
  const loan = loans.find(l => l.id === id);
  if (!loan) return;
  loan.returned = today();
  saveAll();
}

$("issueTopBtn").addEventListener("click", () => { show("issue"); $("issueBook").focus(); });
$("dueAll").addEventListener("click", e => { e.preventDefault(); show("issue"); });

// ---------- Members ----------
$("memberForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("memberName").value.trim(), dept = $("memberDept").value.trim();
  if (!name || !dept) return;
  members.push({ id: nextId(members), name, dept });
  e.target.reset();
  saveAll();
});

function deleteMember(id) {
  const m = memberOf(id);
  if (!m) return;
  if (active().some(l => l.memberId === id)) return alert(`${m.name} still has books issued. Return them first.`);
  if (!confirm(`Delete member “${m.name}”?`)) return;
  members = members.filter(x => x.id !== id);
  reservations = reservations.filter(r => r.memberId !== id);
  saveAll();
}

// ---------- Reservations ----------
$("resForm").addEventListener("submit", e => {
  e.preventDefault();
  const bookId = Number($("resBook").value), memberId = Number($("resMember").value);
  if (!bookOf(bookId) || !memberOf(memberId)) return flash($("resMsg"), "Choose a member and a book.", true);
  if (reservations.some(r => r.bookId === bookId && r.memberId === memberId))
    return flash($("resMsg"), "This reservation already exists.", true);
  reservations.push({ id: nextId(reservations), bookId, memberId, date: today() });
  saveAll();
  flash($("resMsg"), "Reservation added.");
});

// ---------- Catalogue: insert, update, delete ----------
const dialog = $("bookDialog"), form = $("bookForm");
let editingId = null; // null = adding, otherwise the id being updated

function openAddForm() {
  editingId = null;
  $("dialogTitle").textContent = "Add a book";
  form.reset();
  dialog.showModal();
  form.elements.title.focus();
}

function openEditForm(id) {
  const b = bookOf(id);
  if (!b) return;
  editingId = id;
  $("dialogTitle").textContent = "Edit book";
  form.elements.title.value = b.title;
  form.elements.author.value = b.author;
  form.elements.isbn.value = b.isbn;
  form.elements.genre.value = b.genre;
  form.elements.copies.value = b.copies;
  dialog.showModal();
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const data = {
    title: form.elements.title.value.trim(),
    author: form.elements.author.value.trim(),
    isbn: form.elements.isbn.value.trim(),
    genre: form.elements.genre.value,
    copies: Math.max(1, parseInt(form.elements.copies.value, 10) || 1)
  };
  if (!data.title || !data.author) return;

  if (editingId === null) {
    books.push({ id: nextId(books), ...data });                              // INSERT
  } else {
    const out = copiesOut(editingId);
    if (data.copies < out) return alert(`${out} copies are on loan, so total copies can't be lower than ${out}.`);
    books = books.map(b => (b.id === editingId ? { ...b, ...data } : b));    // UPDATE
  }
  saveAll();
  dialog.close();
});

function deleteBook(id) {
  const b = bookOf(id);
  if (!b) return;
  if (copiesOut(id) > 0) return alert(`“${b.title}” has copies on loan. Return them before deleting it.`);
  if (!confirm(`Delete “${b.title}” from the catalogue?`)) return;
  books = books.filter(x => x.id !== id);                                    // DELETE
  reservations = reservations.filter(r => r.bookId !== id);
  saveAll();
}

$("bookRows").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit") openEditForm(id);
  if (btn.dataset.action === "delete") deleteBook(id);
});
$("addBtn").addEventListener("click", openAddForm);
$("addLink").addEventListener("click", e => { e.preventDefault(); openAddForm(); });
$("cancelBtn").addEventListener("click", () => dialog.close());
$("searchInput").addEventListener("input", () => {
  if (currentView !== "catalogue") show("catalogue");
  renderCatalogue();
});

// ---------- Buttons that appear in several places ----------
document.addEventListener("click", e => {
  const ret = e.target.closest("[data-return]");
  if (ret) return returnLoan(Number(ret.dataset.return));
  const del = e.target.closest("[data-del-member]");
  if (del) return deleteMember(Number(del.dataset.delMember));
  const cancel = e.target.closest("[data-cancel-res]");
  if (cancel) {
    reservations = reservations.filter(r => r.id !== Number(cancel.dataset.cancelRes));
    saveAll();
  }
});

show("dashboard");
renderAll();