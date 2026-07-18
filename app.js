/* Solace — Daily Reflections
   A private, on-device journal with a Claude-powered reflective companion.
   All data lives in localStorage on this device. */
(function () {
  "use strict";

  // ---------- storage ----------
  var K = { entries: "solace.entries", chat: "solace.chat", settings: "solace.settings" };
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var entries = load(K.entries, {});          // { 'YYYY-MM-DD': {date, text, mood, updated} }
  var chat = load(K.chat, []);                // [{role, text}]
  var settings = load(K.settings, { apiKey: "", model: "claude-opus-4-8", name: "" });

  // ---------- helpers ----------
  var MOODS = [
    { key: "radiant", emoji: "✨", label: "Radiant" },
    { key: "good", emoji: "🙂", label: "Good" },
    { key: "okay", emoji: "😐", label: "Okay" },
    { key: "low", emoji: "🌧️", label: "Low" },
    { key: "heavy", emoji: "😔", label: "Heavy" }
  ];
  function moodOf(k) { for (var i = 0; i < MOODS.length; i++) if (MOODS[i].key === k) return MOODS[i]; return null; }

  var PROMPTS = [
    "How are you, really, right now?",
    "What is one thing you want to remember about today?",
    "What drained you today, and what restored you?",
    "Name a moment today that felt like yours.",
    "What are you carrying that you could set down?",
    "Who or what are you grateful for today?",
    "What did today teach you about yourself?",
    "If today had a color, what would it be — and why?",
    "What do you need more of? What do you need less of?",
    "What would you tell a friend who had the day you just had?"
  ];

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtLong(key) {
    var p = key.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  function fmtShort(key) {
    var p = key.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function greeting() {
    var h = new Date().getHours(), n = settings.name ? ", " + settings.name : "";
    if (h < 5) return "Still awake" + n + "? Be gentle with yourself.";
    if (h < 12) return "Good morning" + n + ". A quiet moment for yourself.";
    if (h < 18) return "Good afternoon" + n + ". How is your day unfolding?";
    return "Good evening" + n + ". Let's look back on the day.";
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function wordCount(s) { s = s.trim(); return s ? s.split(/\s+/).length : 0; }

  // ---------- state ----------
  var editingKey = todayKey();     // which date the Today editor is bound to
  var selectedMood = "";

  // ================= TODAY =================
  function initToday() {
    // deterministic prompt-of-the-day
    var seed = 0, tk = todayKey();
    for (var i = 0; i < tk.length; i++) seed += tk.charCodeAt(i);
    $("prompt").textContent = PROMPTS[seed % PROMPTS.length];

    // mood chips
    var mv = $("moods"); mv.innerHTML = "";
    MOODS.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "mood"; b.dataset.mood = m.key;
      b.innerHTML = '<span class="dot">' + m.emoji + "</span>" + m.label;
      b.addEventListener("click", function () { setMood(m.key); });
      mv.appendChild(b);
    });

    $("entry").addEventListener("input", function () {
      $("count").textContent = wordCount($("entry").value) + " words";
    });
    $("saveBtn").addEventListener("click", saveToday);
    bindEditor(todayKey());
  }

  function bindEditor(key) {
    editingKey = key;
    var isToday = key === todayKey();
    $("todayEyebrow").textContent = isToday ? "Today" : "Editing entry";
    $("todayDate").textContent = fmtLong(key);
    $("todayGreeting").textContent = isToday ? greeting() : "Revisiting a past reflection.";
    var e = entries[key];
    $("entry").value = e ? e.text : "";
    setMood(e ? e.mood : "");
    $("count").textContent = wordCount($("entry").value) + " words";
    $("saveBtn").textContent = isToday ? "Save today's reflection" : "Save changes";
  }

  function setMood(k) {
    selectedMood = k || "";
    var chips = document.querySelectorAll("#moods .mood");
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle("sel", chips[i].dataset.mood === selectedMood);
  }

  function saveToday() {
    var text = $("entry").value.trim();
    if (!text && !selectedMood) { flashSaved("Write a little something first ✍️"); return; }
    entries[editingKey] = { date: editingKey, text: text, mood: selectedMood, updated: Date.now() };
    save(K.entries, entries);
    flashSaved("✓ Saved to your journal");
    renderJournal();
    if (editingKey !== todayKey()) bindEditor(todayKey()); // return editor to today after editing a past entry
  }

  function flashSaved(msg) {
    var p = $("savedPill"); p.textContent = msg; p.classList.add("show");
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(function () { p.classList.remove("show"); }, 2200);
  }

  // ================= JOURNAL =================
  function renderJournal() {
    var q = ($("search").value || "").toLowerCase().trim();
    var keys = Object.keys(entries).sort().reverse();
    var total = keys.length;
    $("journalCount").textContent = total === 0 ? "Your reflections will gather here." :
      total + (total === 1 ? " reflection" : " reflections") + " · a growing record of you.";

    if (q) keys = keys.filter(function (k) {
      var e = entries[k]; return (e.text || "").toLowerCase().indexOf(q) > -1 || fmtLong(k).toLowerCase().indexOf(q) > -1;
    });

    var list = $("entryList");
    if (total === 0) {
      list.innerHTML = '<div class="empty"><div class="big">🌱</div>Nothing here yet.<br>Your first reflection is waiting on the Today page.</div>';
      return;
    }
    if (keys.length === 0) { list.innerHTML = '<div class="empty"><div class="big">🔍</div>No reflections match that search.</div>'; return; }

    list.innerHTML = keys.map(function (k) {
      var e = entries[k], m = moodOf(e.mood);
      var mtag = m ? '<span class="mtag">' + m.emoji + " " + m.label + "</span>" : "";
      var ex = e.text ? esc(e.text) : '<em style="color:var(--muted)">A quiet day — mood noted, no words.</em>';
      return '<div class="entry" data-key="' + k + '">' +
        '<div class="meta"><span class="date">' + esc(fmtShort(k)) + "</span>" + mtag + "</div>" +
        '<div class="excerpt">' + ex + "</div></div>";
    }).join("");

    Array.prototype.forEach.call(list.querySelectorAll(".entry"), function (el) {
      el.addEventListener("click", function () { openRead(el.dataset.key); });
    });
  }

  // ---- read/entry sheet ----
  var readingKey = null;
  function openRead(key) {
    readingKey = key;
    var e = entries[key], m = moodOf(e.mood);
    $("readDate").textContent = fmtLong(key);
    $("readMood").innerHTML = m ? m.emoji + " Felt " + m.label.toLowerCase() : '<span style="color:var(--muted)">No mood noted</span>';
    $("readText").innerHTML = e.text ? esc(e.text) : '<em style="color:var(--muted)">No words were written this day.</em>';
    openScrim("readScrim");
  }
  function initRead() {
    $("readClose").addEventListener("click", function () { closeScrim("readScrim"); });
    $("editEntry").addEventListener("click", function () {
      closeScrim("readScrim"); switchTab("today"); bindEditor(readingKey);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("deleteEntry").addEventListener("click", function () {
      if (!readingKey) return;
      if (confirm("Delete your reflection from " + fmtLong(readingKey) + "? This cannot be undone.")) {
        delete entries[readingKey]; save(K.entries, entries);
        closeScrim("readScrim"); renderJournal();
        if (editingKey === readingKey) bindEditor(todayKey());
      }
    });
  }

  // ================= REFLECT (chat) =================
  var STARTERS = [
    "What patterns do you notice in my reflections?",
    "How have I been feeling lately?",
    "What might I be avoiding?",
    "Help me reframe a hard day.",
    "What am I grateful for recently?"
  ];

  function initChat() {
    var cr = $("chips"); cr.innerHTML = "";
    STARTERS.forEach(function (s) {
      var c = document.createElement("button");
      c.className = "chip"; c.textContent = s;
      c.addEventListener("click", function () { $("chatInput").value = s; sendChat(); });
      cr.appendChild(c);
    });
    renderChat();
    var ta = $("chatInput");
    ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
    ta.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); sendChat(); }
    });
    $("sendBtn").addEventListener("click", sendChat);
  }

  function renderChat() {
    var box = $("chatScroll");
    if (chat.length === 0) {
      box.innerHTML = '<div class="bubble ai">Hello' + (settings.name ? " " + esc(settings.name) : "") +
        ". I'm here whenever you'd like to talk. I've read through your journal, so we can pick up anywhere — a pattern you're curious about, a hard day you want to make sense of, or just what's on your mind right now. Where shall we begin?</div>";
      return;
    }
    box.innerHTML = chat.map(function (m) {
      return '<div class="bubble ' + (m.role === "user" ? "me" : "ai") + '">' + esc(m.text) + "</div>";
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  var streaming = false;
  function sendChat() {
    if (streaming) return;
    var input = $("chatInput"), text = input.value.trim();
    if (!text) return;
    if (!settings.apiKey) { openSettings("Add your Claude API key to start reflecting together."); return; }

    chat.push({ role: "user", text: text });
    input.value = ""; input.style.height = "auto";
    save(K.chat, chat); renderChat();

    var box = $("chatScroll");
    var aiEl = document.createElement("div");
    aiEl.className = "bubble ai";
    aiEl.innerHTML = '<span class="cursor"></span>';
    box.appendChild(aiEl); box.scrollTop = box.scrollHeight;

    streaming = true; $("sendBtn").disabled = true;
    var acc = "";
    callClaude(
      function (delta) { // onDelta
        acc += delta;
        aiEl.innerHTML = esc(acc) + '<span class="cursor"></span>';
        box.scrollTop = box.scrollHeight;
      },
      function () { // onDone
        aiEl.innerHTML = esc(acc);
        chat.push({ role: "assistant", text: acc }); save(K.chat, chat);
        streaming = false; $("sendBtn").disabled = false;
      },
      function (err) { // onError
        aiEl.innerHTML = '<span style="color:#B5493B">' + esc(err) + "</span>";
        streaming = false; $("sendBtn").disabled = false;
      }
    );
  }

  function buildSystemPrompt() {
    var keys = Object.keys(entries).sort();
    var journal = keys.length ? keys.map(function (k) {
      var e = entries[k], m = moodOf(e.mood);
      return "[" + fmtShort(k) + (m ? " · mood: " + m.label : "") + "]\n" + (e.text || "(no words written)");
    }).join("\n\n") : "(The journal is empty so far.)";

    var name = settings.name ? " The person's name is " + settings.name + "." : "";
    return (
      "You are Solace, a warm, emotionally intelligent reflective companion inside a personal journaling app." + name +
      " You have been given the person's private daily reflections below. Your role is to help them understand themselves with more compassion and clarity.\n\n" +
      "How to be:\n" +
      "- Warm, present, and unhurried. Speak like a thoughtful friend, not a clinician or a chirpy assistant.\n" +
      "- Ground your observations in what they actually wrote. Quote or paraphrase specific days and moods when it helps them feel seen.\n" +
      "- Notice patterns across time — recurring themes, shifts in mood, things they return to or avoid — and offer them gently, as invitations rather than verdicts.\n" +
      "- Ask one caring, open question at a time when it would deepen their reflection. Don't interrogate.\n" +
      "- Be honest and kind. You can gently challenge, but never lecture, diagnose, or moralize.\n" +
      "- Keep replies fairly short and human — usually a few sentences to a couple of short paragraphs.\n\n" +
      "Important boundaries:\n" +
      "- You are not a therapist and this is not medical care. Don't diagnose or give clinical advice.\n" +
      "- If they express intent to harm themselves or others, or seem to be in crisis, respond with calm warmth, take it seriously, and encourage them to reach out to a crisis line or emergency services right away (e.g. 988 in the US, or local emergency services). Stay with them supportively rather than problem-solving alone.\n\n" +
      "=== THE PERSON'S JOURNAL ===\n" + journal + "\n=== END JOURNAL ==="
    );
  }

  function callClaude(onDelta, onDone, onError) {
    var msgs = chat.map(function (m) { return { role: m.role, content: m.text }; });
    var model = (settings.model || "claude-opus-4-8").trim();

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: msgs,
        stream: true
      })
    }).then(function (res) {
      if (!res.ok || !res.body) {
        return res.text().then(function (t) {
          var msg = "Something went wrong reaching Claude.";
          try { var j = JSON.parse(t); if (j.error && j.error.message) msg = j.error.message; } catch (e) {}
          if (res.status === 401) msg = "That API key was rejected. Check it in Settings.";
          else if (res.status === 429) msg = "Rate limited — please wait a moment and try again.";
          throw new Error(msg);
        });
      }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { onDone(); return; }
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split("\n"); buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf("data:") !== 0) continue;
            var data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              var ev = JSON.parse(data);
              if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") onDelta(ev.delta.text);
              else if (ev.type === "error" && ev.error) throw new Error(ev.error.message || "stream error");
            } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      var m = (err && err.message) ? err.message : "Network error — check your connection.";
      if (/Failed to fetch|NetworkError/i.test(m)) m = "Couldn't reach Claude. Check your internet connection and try again.";
      onError(m);
    });
  }

  // ================= NAV + SHEETS =================
  function switchTab(name) {
    var views = { today: "view-today", journal: "view-journal", chat: "view-chat" };
    Object.keys(views).forEach(function (k) { $(views[k]).classList.toggle("active", k === name); });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    if (name === "journal") renderJournal();
    if (name === "chat") setTimeout(function () { var b = $("chatScroll"); b.scrollTop = b.scrollHeight; }, 30);
    window.scrollTo({ top: 0 });
  }

  function openScrim(id) { $(id).classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeScrim(id) { $(id).classList.remove("open"); document.body.style.overflow = ""; }

  function openSettings(note) {
    $("apiKey").value = settings.apiKey || "";
    $("model").value = settings.model || "claude-opus-4-8";
    $("userName").value = settings.name || "";
    openScrim("settingsScrim");
    if (note) flashSaved(note);
  }
  function initSettings() {
    $("settingsBtn").addEventListener("click", function () { openSettings(); });
    $("settingsClose").addEventListener("click", function () { closeScrim("settingsScrim"); });
    $("settingsSave").addEventListener("click", function () {
      settings.apiKey = $("apiKey").value.trim();
      settings.model = ($("model").value.trim() || "claude-opus-4-8");
      settings.name = $("userName").value.trim();
      save(K.settings, settings);
      closeScrim("settingsScrim");
      $("todayGreeting").textContent = editingKey === todayKey() ? greeting() : $("todayGreeting").textContent;
      renderChat();
    });
    $("clearChatBtn").addEventListener("click", function () {
      if (confirm("Clear this conversation? Your journal entries are kept.")) {
        chat = []; save(K.chat, chat); renderChat();
      }
    });
    $("exportBtn").addEventListener("click", exportData);
  }

  function exportData() {
    var payload = { app: "Solace", exported: new Date().toISOString(), entries: entries };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "solace-journal-" + todayKey() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Close sheets by tapping the scrim background
  ["settingsScrim", "readScrim"].forEach(function (id) {
    $(id).addEventListener("click", function (e) { if (e.target === $(id)) closeScrim(id); });
  });

  // ================= INIT =================
  function init() {
    initToday();
    initRead();
    initChat();
    initSettings();
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.addEventListener("click", function () { switchTab(t.dataset.tab); });
    });
    $("search").addEventListener("input", renderJournal);
    renderJournal();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }
  init();
})();
