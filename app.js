/* Solace — Daily Reflections
   Private, on-device journal with a Claude-powered reflective companion.
   All journal data lives in localStorage on this device. */
(function () {
  "use strict";

  var K = { entries: "solace.entries", chat: "solace.chat", settings: "solace.settings" };
  function load(key, fb) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var entries = load(K.entries, {});
  var chat = load(K.chat, []);
  var settings = load(K.settings, { apiKey: "", model: "claude-opus-4-8", name: "", pinHash: "", lastExport: 0 });

  // ---- moods (bold, distinct colors used across chips, calendar, mood mix) ----
  var MOODS = [
    { key: "radiant", emoji: "✨", label: "Radiant", color: "#FF9F1C" },
    { key: "good",    emoji: "🙂", label: "Good",    color: "#19C37D" },
    { key: "okay",    emoji: "😐", label: "Okay",    color: "#2AA9E0" },
    { key: "low",     emoji: "🌧️", label: "Low",     color: "#7A5CF0" },
    { key: "heavy",   emoji: "😔", label: "Heavy",   color: "#F5325B" }
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

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayKey() { return keyOf(new Date()); }
  function dateOf(key) { var p = key.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtLong(key) { return dateOf(key).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
  function fmtShort(key) { return dateOf(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
  function greeting() {
    var h = new Date().getHours(), n = settings.name ? ", " + settings.name : "";
    if (h < 5) return "Still awake" + n + "? Be gentle with yourself.";
    if (h < 12) return "Good morning" + n + ". A moment for yourself.";
    if (h < 18) return "Good afternoon" + n + ". How is your day unfolding?";
    return "Good evening" + n + ". Let's look back on the day.";
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function wordCount(s) { s = s.trim(); return s ? s.split(/\s+/).length : 0; }

  // simple non-cryptographic hash — a deterrent for casual snoopers, not encryption
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(16); }

  var editingKey = todayKey();
  var selectedMood = "";

  // ---- streak: consecutive days ending today or yesterday ----
  function streak() {
    var d = new Date(), count = 0;
    if (!entries[keyOf(d)]) d.setDate(d.getDate() - 1); // allow "yesterday" so today isn't required yet
    while (entries[keyOf(d)]) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }

  // =============== TODAY ===============
  function initToday() {
    var seed = 0, tk = todayKey();
    for (var i = 0; i < tk.length; i++) seed += tk.charCodeAt(i);
    $("prompt").textContent = PROMPTS[seed % PROMPTS.length];

    var mv = $("moods"); mv.innerHTML = "";
    MOODS.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "mood"; b.dataset.mood = m.key;
      b.innerHTML = '<span class="dot">' + m.emoji + "</span>" + m.label;
      b.addEventListener("click", function () { setMood(m.key); });
      mv.appendChild(b);
    });
    $("entry").addEventListener("input", function () { $("count").textContent = wordCount($("entry").value) + " words"; });
    $("saveBtn").addEventListener("click", saveToday);
    bindEditor(todayKey());
    renderStreak();
    renderMemory();
  }

  function renderStreak() {
    var s = streak(), pill = $("streakPill");
    pill.textContent = "🔥 " + s;
    pill.className = "streak" + (s === 0 ? " zero" : "");
    pill.title = s + " day streak";
  }

  function renderMemory() {
    var host = $("memoryCard"); host.innerHTML = "";
    var now = new Date(), cands = [];
    [[1, "A month ago"], [3, "Three months ago"], [12, "A year ago"]].forEach(function (p) {
      var d = new Date(now.getFullYear(), now.getMonth() - p[0], now.getDate());
      var e = entries[keyOf(d)];
      if (e && e.text) cands.push({ label: p[1], key: keyOf(d), text: e.text });
    });
    if (!cands.length) return;
    var m = cands[cands.length - 1];
    var el = document.createElement("div");
    el.className = "memory";
    el.innerHTML = '<div class="ml">✦ ' + m.label + '</div><div class="mt">' + esc(m.text) + "</div>";
    el.addEventListener("click", function () { openRead(m.key); });
    host.appendChild(el);
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
    Array.prototype.forEach.call(document.querySelectorAll("#moods .mood"), function (c) {
      var on = c.dataset.mood === selectedMood, m = moodOf(c.dataset.mood);
      c.classList.toggle("sel", on);
      c.style.background = on ? m.color : ""; c.style.borderColor = on ? m.color : "";
    });
  }

  function saveToday() {
    var text = $("entry").value.trim();
    if (!text && !selectedMood) { flashSaved("Write a little something first ✍️"); return; }
    entries[editingKey] = { date: editingKey, text: text, mood: selectedMood, updated: Date.now() };
    save(K.entries, entries);
    flashSaved("✓ Saved to your journal");
    renderStreak(); renderJournal();
    if (editingKey !== todayKey()) bindEditor(todayKey());
  }

  function flashSaved(msg) {
    var p = $("savedPill"); p.textContent = msg; p.classList.add("show");
    clearTimeout(flashSaved._t); flashSaved._t = setTimeout(function () { p.classList.remove("show"); }, 2200);
  }

  // =============== JOURNAL + INSIGHTS ===============
  var calCursor = new Date(); calCursor.setDate(1);

  function renderInsights() {
    var keys = Object.keys(entries);
    $("stStreak").textContent = streak();
    $("stTotal").textContent = keys.length;
    var ym = new Date().getFullYear() + "-" + pad(new Date().getMonth() + 1);
    $("stMonth").textContent = keys.filter(function (k) { return k.indexOf(ym) === 0; }).length;

    // mood mix
    var counts = {}, withMood = 0;
    keys.forEach(function (k) { var m = entries[k].mood; if (m) { counts[m] = (counts[m] || 0) + 1; withMood++; } });
    var bar = $("moodBar"), keyEl = $("moodKey");
    if (withMood === 0) {
      bar.innerHTML = ""; keyEl.innerHTML = '<span style="color:var(--muted)">Note a mood to see your mix.</span>';
    } else {
      bar.innerHTML = MOODS.map(function (m) {
        var c = counts[m.key] || 0; if (!c) return "";
        return '<span style="width:' + (c / withMood * 100) + '%;background:' + m.color + '"></span>';
      }).join("");
      keyEl.innerHTML = MOODS.filter(function (m) { return counts[m.key]; }).map(function (m) {
        return '<span><b style="background:' + m.color + '"></b>' + m.label + " " + counts[m.key] + "</span>";
      }).join("");
    }
    renderCalendar();
    renderBackupNote();
  }

  function renderCalendar() {
    var y = calCursor.getFullYear(), mo = calCursor.getMonth();
    $("calLabel").textContent = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    var first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    var grid = $("calGrid"); grid.innerHTML = "";
    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d) {
      var el = document.createElement("div"); el.className = "cal-dow"; el.textContent = d; grid.appendChild(el);
    });
    for (var b = 0; b < first; b++) { var e0 = document.createElement("div"); e0.className = "cal-cell empty"; grid.appendChild(e0); }
    var tk = todayKey();
    for (var d = 1; d <= days; d++) {
      var key = y + "-" + pad(mo + 1) + "-" + pad(d), en = entries[key], m = en ? moodOf(en.mood) : null;
      var cell = document.createElement("div");
      cell.className = "cal-cell" + (en ? " has" : "") + (key === tk ? " today" : "");
      cell.textContent = d;
      if (en) {
        cell.style.background = m ? m.color : "var(--accent-deep)";
        (function (kk) { cell.addEventListener("click", function () { openRead(kk); }); })(key);
      }
      grid.appendChild(cell);
    }
  }

  function renderBackupNote() {
    var n = Object.keys(entries).length, note = $("backupNote");
    if (n >= 5 && !settings.lastExport) {
      note.innerHTML = 'You have ' + n + " reflections and haven't backed up yet. <button id=\"bkNow\">Export a backup</button> to keep them safe.";
      $("bkNow").addEventListener("click", exportData);
    } else if (settings.lastExport) {
      note.textContent = "Last backup: " + new Date(settings.lastExport).toLocaleDateString();
    } else { note.textContent = ""; }
  }

  function renderJournal() {
    renderInsights();
    var q = ($("search").value || "").toLowerCase().trim();
    var keys = Object.keys(entries).sort().reverse();
    var total = keys.length;
    $("journalCount").textContent = total === 0 ? "Your reflections will gather here." :
      total + (total === 1 ? " reflection" : " reflections") + " · a growing record of you.";
    $("insights").style.display = total === 0 ? "none" : "";

    if (q) keys = keys.filter(function (k) {
      var e = entries[k]; return (e.text || "").toLowerCase().indexOf(q) > -1 || fmtLong(k).toLowerCase().indexOf(q) > -1;
    });

    var list = $("entryList");
    if (total === 0) { list.innerHTML = '<div class="empty"><div class="big">🌱</div>Nothing here yet.<br>Your first reflection is waiting on the Today page.</div>'; return; }
    if (keys.length === 0) { list.innerHTML = '<div class="empty"><div class="big">🔍</div>No reflections match that search.</div>'; return; }

    list.innerHTML = keys.map(function (k) {
      var e = entries[k], m = moodOf(e.mood);
      var mtag = m ? '<span class="mtag">' + m.emoji + " " + m.label + "</span>" : "";
      var ex = e.text ? esc(e.text) : '<em style="color:var(--muted)">A quiet day — mood noted, no words.</em>';
      return '<div class="entry" data-key="' + k + '" style="--mc:' + (m ? m.color : "var(--line)") + '">' +
        '<div class="meta"><span class="date">' + esc(fmtShort(k)) + "</span>" + mtag + "</div>" +
        '<div class="excerpt">' + ex + "</div></div>";
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll(".entry"), function (el) {
      el.addEventListener("click", function () { openRead(el.dataset.key); });
    });
  }

  // ---- read sheet ----
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
      closeScrim("readScrim"); switchTab("today"); bindEditor(readingKey); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("deleteEntry").addEventListener("click", function () {
      if (!readingKey) return;
      if (confirm("Delete your reflection from " + fmtLong(readingKey) + "? This cannot be undone.")) {
        delete entries[readingKey]; save(K.entries, entries);
        closeScrim("readScrim"); renderStreak(); renderMemory(); renderJournal();
        if (editingKey === readingKey) bindEditor(todayKey());
      }
    });
    $("calPrev").addEventListener("click", function () { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
    $("calNext").addEventListener("click", function () { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
  }

  // =============== REFLECT (chat) ===============
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
      var c = document.createElement("button"); c.className = "chip"; c.textContent = s;
      c.addEventListener("click", function () { $("chatInput").value = s; sendChat(); });
      cr.appendChild(c);
    });
    renderChat();
    var ta = $("chatInput");
    ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
    ta.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); sendChat(); } });
    $("sendBtn").addEventListener("click", sendChat);
  }
  function renderChat() {
    var box = $("chatScroll");
    if (chat.length === 0) {
      box.innerHTML = '<div class="bubble ai">Hello' + (settings.name ? " " + esc(settings.name) : "") +
        ". I'm here whenever you'd like to talk. I've read through your journal, so we can pick up anywhere — a pattern you're curious about, a hard day you want to make sense of, or just what's on your mind right now. Where shall we begin?</div>";
      return;
    }
    box.innerHTML = chat.map(function (m) { return '<div class="bubble ' + (m.role === "user" ? "me" : "ai") + '">' + esc(m.text) + "</div>"; }).join("");
    box.scrollTop = box.scrollHeight;
  }
  var streaming = false;
  function sendChat() {
    if (streaming) return;
    var input = $("chatInput"), text = input.value.trim();
    if (!text) return;
    if (!settings.apiKey) { openSettings("Add your Claude API key to start reflecting together."); return; }
    chat.push({ role: "user", text: text });
    input.value = ""; input.style.height = "auto"; save(K.chat, chat); renderChat();
    var box = $("chatScroll"), aiEl = document.createElement("div");
    aiEl.className = "bubble ai"; aiEl.innerHTML = '<span class="cursor"></span>';
    box.appendChild(aiEl); box.scrollTop = box.scrollHeight;
    streaming = true; $("sendBtn").disabled = true;
    var acc = "";
    callClaude(
      function (d) { acc += d; aiEl.innerHTML = esc(acc) + '<span class="cursor"></span>'; box.scrollTop = box.scrollHeight; },
      function () { aiEl.innerHTML = esc(acc); chat.push({ role: "assistant", text: acc }); save(K.chat, chat); streaming = false; $("sendBtn").disabled = false; },
      function (err) { aiEl.innerHTML = '<span style="color:#E0245E">' + esc(err) + "</span>"; streaming = false; $("sendBtn").disabled = false; }
    );
  }
  function buildSystemPrompt() {
    var keys = Object.keys(entries).sort();
    var journal = keys.length ? keys.map(function (k) {
      var e = entries[k], m = moodOf(e.mood);
      return "[" + fmtShort(k) + (m ? " · mood: " + m.label : "") + "]\n" + (e.text || "(no words written)");
    }).join("\n\n") : "(The journal is empty so far.)";
    var name = settings.name ? " The person's name is " + settings.name + "." : "";
    return "You are Solace, a warm, emotionally intelligent reflective companion inside a personal journaling app." + name +
      " You have been given the person's private daily reflections below. Your role is to help them understand themselves with more compassion and clarity.\n\n" +
      "How to be:\n- Warm, present, and unhurried. Speak like a thoughtful friend, not a clinician or a chirpy assistant.\n" +
      "- Ground your observations in what they actually wrote. Quote or paraphrase specific days and moods when it helps them feel seen.\n" +
      "- Notice patterns across time and offer them gently, as invitations rather than verdicts.\n" +
      "- Ask one caring, open question at a time when it would deepen their reflection. Don't interrogate.\n" +
      "- Be honest and kind. You can gently challenge, but never lecture, diagnose, or moralize.\n" +
      "- Keep replies fairly short and human — usually a few sentences to a couple of short paragraphs.\n\n" +
      "Important boundaries:\n- You are not a therapist and this is not medical care. Don't diagnose or give clinical advice.\n" +
      "- If they express intent to harm themselves or others, or seem to be in crisis, respond with calm warmth, take it seriously, and encourage them to reach out to a crisis line or emergency services right away (e.g. 988 in the US, or local emergency services). Stay with them supportively rather than problem-solving alone.\n\n" +
      "=== THE PERSON'S JOURNAL ===\n" + journal + "\n=== END JOURNAL ===";
  }
  function callClaude(onDelta, onDone, onError) {
    var msgs = chat.map(function (m) { return { role: m.role, content: m.text }; });
    var model = (settings.model || "claude-opus-4-8").trim();
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: model, max_tokens: 1024, system: buildSystemPrompt(), messages: msgs, stream: true })
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
            var line = lines[i].trim(); if (line.indexOf("data:") !== 0) continue;
            var data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
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

  // =============== NAV / SHEETS ===============
  function switchTab(name) {
    var v = { today: "view-today", journal: "view-journal", chat: "view-chat" };
    Object.keys(v).forEach(function (k) { $(v[k]).classList.toggle("active", k === name); });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    if (name === "journal") renderJournal();
    if (name === "today") { renderStreak(); renderMemory(); }
    if (name === "chat") setTimeout(function () { var b = $("chatScroll"); b.scrollTop = b.scrollHeight; }, 30);
    window.scrollTo({ top: 0 });
  }
  function openScrim(id) { $(id).classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeScrim(id) { $(id).classList.remove("open"); document.body.style.overflow = ""; }

  function openSettings(note) {
    $("apiKey").value = settings.apiKey || "";
    $("model").value = settings.model || "claude-opus-4-8";
    $("userName").value = settings.name || "";
    refreshPinUI();
    openScrim("settingsScrim");
    if (note) flashSaved(note);
  }
  function refreshPinUI() {
    var on = !!settings.pinHash;
    $("pinStatus").textContent = on ? "Passcode lock is on. Solace asks for it each time you open." : "Passcode lock is off.";
    $("setPinBtn").textContent = on ? "Change passcode" : "Set passcode";
    $("removePinBtn").style.display = on ? "" : "none";
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
      if (editingKey === todayKey()) $("todayGreeting").textContent = greeting();
      renderChat();
    });
    $("clearChatBtn").addEventListener("click", function () {
      if (confirm("Clear this conversation? Your journal entries are kept.")) { chat = []; save(K.chat, chat); renderChat(); }
    });
    $("exportBtn").addEventListener("click", exportData);
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", importData);
    $("setPinBtn").addEventListener("click", function () { closeScrim("settingsScrim"); startSetPin(); });
    $("removePinBtn").addEventListener("click", function () {
      settings.pinHash = ""; save(K.settings, settings); refreshPinUI();
    });
  }

  // ---- data export / import ----
  function exportData() {
    var payload = { app: "Solace", version: 2, exported: new Date().toISOString(), entries: entries };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "solace-journal-" + todayKey() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    settings.lastExport = Date.now(); save(K.settings, settings); renderBackupNote();
  }
  function importData(ev) {
    var file = ev.target.files && ev.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var imported = data.entries || (data.app ? {} : data); // tolerate raw entries map
        if (!imported || typeof imported !== "object") throw new Error("no entries");
        var added = 0, keys = Object.keys(imported);
        keys.forEach(function (k) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
          var e = imported[k]; if (!e) return;
          var incoming = { date: k, text: e.text || "", mood: e.mood || "", updated: e.updated || Date.now() };
          var cur = entries[k];
          if (!cur || (incoming.updated || 0) >= (cur.updated || 0)) { entries[k] = incoming; added++; }
        });
        save(K.entries, entries);
        renderStreak(); renderMemory(); renderJournal(); bindEditor(todayKey());
        alert("Restored " + added + " reflection" + (added === 1 ? "" : "s") + " into your journal.");
      } catch (e) { alert("That file couldn't be read as a Solace backup."); }
      $("importFile").value = "";
    };
    reader.readAsText(file);
  }

  // =============== PASSCODE LOCK ===============
  var pinBuf = "", pinMode = "unlock", pinFirst = "";
  function buildKeypad(onKey) {
    var kp = $("keypad"); kp.innerHTML = "";
    var layout = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "blank", "0", "del"];
    layout.forEach(function (v) {
      var b = document.createElement("button");
      if (v === "blank") { b.className = "key blank"; b.disabled = true; }
      else if (v === "del") { b.className = "key act"; b.textContent = "⌫"; b.addEventListener("click", function () { onKey("del"); }); }
      else { b.className = "key"; b.textContent = v; b.addEventListener("click", function () { onKey(v); }); }
      kp.appendChild(b);
    });
  }
  function drawDots() {
    Array.prototype.forEach.call($("lockDots").children, function (d, i) { d.className = i < pinBuf.length ? "on" : ""; });
  }
  function onPinKey(v) {
    $("lockErr").textContent = "";
    if (v === "del") { pinBuf = pinBuf.slice(0, -1); drawDots(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += v; drawDots();
    if (pinBuf.length === 4) setTimeout(handlePinComplete, 120);
  }
  function handlePinComplete() {
    if (pinMode === "unlock") {
      if (hash(pinBuf) === settings.pinHash) { hideLock(); }
      else { failPin("Wrong passcode. Try again."); }
    } else if (pinMode === "set-first") {
      pinFirst = pinBuf; pinBuf = ""; drawDots();
      $("lockTitle").textContent = "Confirm passcode"; $("lockPrompt").textContent = "Enter it once more";
      pinMode = "set-confirm";
    } else if (pinMode === "set-confirm") {
      if (pinBuf === pinFirst) {
        settings.pinHash = hash(pinBuf); save(K.settings, settings);
        hideLock(); openSettings("✓ Passcode set");
      } else {
        pinFirst = ""; pinMode = "set-first";
        $("lockTitle").textContent = "Set a passcode"; $("lockPrompt").textContent = "Choose a 4-digit passcode";
        failPin("Those didn't match. Start again.");
      }
    }
  }
  function failPin(msg) {
    pinBuf = ""; drawDots(); $("lockErr").textContent = msg;
    var s = $("lockScreen"); s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake");
  }
  function showLock() { pinBuf = ""; drawDots(); $("lockErr").textContent = ""; $("lockScreen").classList.add("show"); document.body.style.overflow = "hidden"; }
  function hideLock() { $("lockScreen").classList.remove("show"); document.body.style.overflow = ""; }
  function startUnlock() {
    pinMode = "unlock"; pinFirst = "";
    $("lockTitle").textContent = "Welcome back"; $("lockPrompt").textContent = "Enter your passcode";
    buildKeypad(onPinKey); showLock();
  }
  function startSetPin() {
    pinMode = "set-first"; pinFirst = "";
    $("lockTitle").textContent = "Set a passcode"; $("lockPrompt").textContent = "Choose a 4-digit passcode";
    buildKeypad(onPinKey); showLock();
  }

  // =============== INIT ===============
  function init() {
    initToday(); initRead(); initChat(); initSettings();
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.addEventListener("click", function () { switchTab(t.dataset.tab); });
    });
    $("search").addEventListener("input", renderJournal);
    ["settingsScrim", "readScrim"].forEach(function (id) {
      $(id).addEventListener("click", function (e) { if (e.target === $(id)) closeScrim(id); });
    });
    renderJournal();

    if (settings.pinHash) startUnlock();

    // request durable storage so the OS is less likely to ever evict entries
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  init();
})();
