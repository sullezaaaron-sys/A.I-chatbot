const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const infoBtn = document.getElementById("infoBtn");
const banner = document.getElementById("offlineBanner");
const csrf = document.querySelector('meta[name="csrf-token"]').content;
const STORE = "ai-assistant-chat-v2";

let messages = [];            // [{role:"user"|"bot", text, time, error?}]
let busy = false;

// ---------- rendering ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function render(text) {        // small markdown: lists, bold, italic, code, headings
  let out = "", list = null, code = false;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of esc(text).split("\n")) {
    if (raw.trim().startsWith("```")) { close(); out += code ? "</pre>" : "<pre>"; code = !code; continue; }
    if (code) { out += raw + "\n"; continue; }
    let m;
    if ((m = raw.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== "ul") { close(); out += "<ul>"; list = "ul"; }
      out += `<li>${inline(m[1])}</li>`;
    } else if ((m = raw.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== "ol") { close(); out += "<ol>"; list = "ol"; }
      out += `<li>${inline(m[1])}</li>`;
    } else if ((m = raw.match(/^#{1,6}\s+(.*)/))) {
      close(); out += `<strong>${inline(m[1])}</strong><br>`;
    } else if (raw.trim() === "") {
      close(); out += '<div class="sp"></div>';
    } else {
      close(); out += inline(raw) + "<br>";
    }
  }
  close(); if (code) out += "</pre>";
  return out;
}

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function draw(m) {
  const label = document.createElement("div");
  label.className = "label mono" + (m.role === "user" ? " right" : "");
  label.textContent = (m.role === "user" ? "YOU (STUDENT)" : "CLASS ASSISTANT") + " · " + m.time;
  const b = document.createElement("div");
  b.className = "bubble " + (m.role === "user" ? "user" : "bot") + (m.error ? " error" : "");
  if (m.role === "user" || m.error) b.textContent = m.text; else b.innerHTML = render(m.text);
  chat.append(label, b);
  chat.scrollTop = chat.scrollHeight;
  return b;
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(messages.slice(-60))); } catch (e) {}
}

function addMessage(role, text, error = false) {
  const m = { role, text, time: now(), error };
  messages.push(m); save();
  return draw(m);
}

function welcome() {
  addMessage("bot", "Hi! Ready to learn today? Ask me any question to help with your worksheet.");
}

function load() {
  try { messages = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { messages = []; }
  if (!messages.length) { welcome(); return; }
  messages.forEach(draw);
}

// ---------- sending ----------
function historyForApi() {
  return messages
    .filter((m) => !m.error)
    .slice(-11, -1)                                   // exclude the message being sent
    .map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
}

async function send(text) {
  text = (text || input.value).trim();
  if (!text || busy) return;
  if (!navigator.onLine) { updateOnline(); return; }

  const history = historyForApi();
  input.value = "";
  addMessage("user", text);
  busy = true; sendBtn.disabled = true;

  const placeholder = document.createElement("div");
  placeholder.className = "bubble bot"; placeholder.textContent = "Thinking...";
  chat.append(placeholder); chat.scrollTop = chat.scrollHeight;

  let reply, isError = false;
  try {
    const res = await fetch("/api/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
      body: JSON.stringify({ message: text, history }),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      isError = true;
      reply = data.error || (res.status === 403
        ? "Page expired (403). Refresh the page and try again."
        : `Request failed (${res.status}).`);
    } else reply = data.reply;
  } catch (e) {
    isError = true;
    reply = "Could not reach the server. Is `python manage.py runserver` still running?";
  }
  placeholder.remove();
  addMessage("bot", reply, isError);
  busy = false; updateOnline();
}

sendBtn.onclick = () => send();
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
clearBtn.onclick = () => {
  messages = []; save(); chat.innerHTML = ""; input.value = ""; welcome();
};
document.querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
  input.value = c.textContent + (input.value ? ": " + input.value : ": ");
  input.focus();
}));

infoBtn.onclick = async () => {
  try {
    const s = await (await fetch("/api/status/")).json();
    const line = s.key_loaded
      ? `Server OK. API key loaded (${s.key_length} chars, starts "${s.key_prefix}"). Model: ${s.model}.`
      : "Server is running but GEMINI_API_KEY is empty. Check your .env and restart.";
    addMessage("bot", line, !s.key_loaded);
  } catch (e) {
    addMessage("bot", "Cannot reach the server right now.", true);
  }
};

// ---------- offline detection ----------
function updateOnline() {
  banner.classList.toggle("d-none", navigator.onLine);
  sendBtn.disabled = !navigator.onLine || busy;
}
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
let deferredPrompt;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredPrompt = e; installBtn.classList.remove("d-none");
});
installBtn.onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; installBtn.classList.add("d-none");
};
window.addEventListener("appinstalled", () => installBtn.classList.add("d-none"));

load();
updateOnline();
