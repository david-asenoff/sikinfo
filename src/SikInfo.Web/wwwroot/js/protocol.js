/* Проверка на протокол: въвеждате числата от черновата и виждате коя контрола не е спазена.
   Контролите са тези, които са записани в самия образец. Числата остават в браузъра:
   пазят се само в този раздел (sessionStorage) и изчезват при затварянето му.
   Има и режим „Пример с обяснения“: попълнен измислен протокол, под всяко число пише
   откъде идва. Примерът е отделен от числата на потребителя и не ги променя. */
(function () {
  "use strict";
  var SIK = window.SIK, el = SIK.el;
  var root = document.getElementById("protocol");
  var picker = document.getElementById("form-picker");
  var ballot = SIK.ballot;  // кандидатските листи по номерата им в бюлетината (Решение № 268-ПВР)
  var current = null;      // определението на избрания образец
  var mine = null;         // числата на потребителя: { values: {ключ: "число"}, lists: {ключ: [...]}, n, opts }
  var state = null;        // данните на екрана: числата на потребителя или примерът
  var mode = "mine";       // "mine" = моите числа, "example" = пример с обяснения

  try { if (sessionStorage.getItem("sik-protocol-mode") === "example") mode = "example"; } catch (e) { /* остава "mine" */ }

  function load(id) {
    try { return JSON.parse(sessionStorage.getItem("sik-protocol-" + id)) || null; } catch (e) { return null; }
  }
  /* Пазят се само числата на потребителя. Примерът никога не ги пипа. */
  function save(id) {
    if (mode !== "mine") return;
    try { sessionStorage.setItem("sik-protocol-" + id, JSON.stringify(mine)); } catch (e) { /* без запомняне */ }
  }

  /* Примерът от данните на образеца, в същия вид като числата на потребителя. */
  function exampleState() {
    var ex = current.example, n = ballot ? ballot.lists.length : 0, values = {}, lists = {};
    Object.keys(ex.values).forEach(function (k) { values[k] = String(ex.values[k]); });
    Object.keys(ex.perList || {}).forEach(function (k) {
      lists[k] = [];
      for (var i = 0; i < n; i++) lists[k].push(String(ex.perList[k]));
    });
    return { values: values, lists: lists, n: n, opts: ex.opts || {} };
  }
  function isExample() { return mode === "example" && !!current.example; }
  function activate() { state = isExample() ? exampleState() : mine; }
  function setMode(next) {
    mode = next;
    try { sessionStorage.setItem("sik-protocol-mode", mode); } catch (e) { /* без запомняне */ }
    activate();
    render();
  }

  function num(text) {
    if (text === undefined || text === null) return null;
    var t = String(text).trim();
    if (!/^\d+$/.test(t)) return null;
    return parseInt(t, 10);
  }

  function visible(item) { return !item.onlyIf || !!state.opts[item.onlyIf]; }

  /* „т. 7.1“, „буква „А““ или „сумата по т. 8“ за показване в обяснението */
  function termLabel(key) {
    if (key.charAt(0) === "@") {
      var list = current.sections.filter(function (s) { return s.list === key.slice(1); })[0];
      var m = list.title.match(/^(\d+)\./);
      return m ? "сумата по т. " + m[1] : "сумата по част II";
    }
    var found = null;
    current.sections.forEach(function (s) {
      (s.fields || []).forEach(function (f) { if (f.key === key) found = f; });
    });
    if (!found) return key;
    return found.no === "А" ? "буква „А“" : "т. " + found.no;
  }

  /* Стойност на член от контролата; null, ако липсва число */
  function termValue(key) {
    if (key.charAt(0) === "@") {
      var rows = state.lists[key.slice(1)] || [], sum = 0;
      if (state.n < 1) return null;
      for (var i = 0; i < state.n; i++) {
        var v = num(rows[i]);
        if (v === null) return null;
        sum += v;
      }
      return sum;
    }
    return num(state.values[key]);
  }

  function isHidden(key) {
    var hidden = false;
    current.sections.forEach(function (s) {
      if (s.list && "@" + s.list === key && !visible(s)) hidden = true;
      (s.fields || []).forEach(function (f) { if (f.key === key && !visible(s)) hidden = true; });
    });
    return hidden;
  }

  function evaluate(control) {
    var left = termValue(control.left), sum = 0, missing = left === null, parts = [];
    control.right.forEach(function (key) {
      if (isHidden(key)) return;                 // напр. т. 11.1, когато няма втора машина
      var v = termValue(key);
      if (v === null) missing = true; else sum += v;
      parts.push({ key: key, label: termLabel(key), value: v });
    });
    if (missing) return { status: "empty", left: left, sum: null, parts: parts };
    var ok = control.op === "eq" ? left === sum : left <= sum;
    return { status: ok ? "ok" : "bad", left: left, sum: sum, parts: parts };
  }

  /* „т. 2 и т. 3“, „т. 6, т. 7 и сумата по т. 8“ */
  function joinLabels(labels) {
    if (labels.length < 2) return labels.join("");
    return labels.slice(0, -1).join(", ") + " и " + labels[labels.length - 1];
  }

  /* Подсказка до конкретното поле: каква стойност би оправила неспазената контрола.
     Не казва кое число е грешното, само какво би трябвало да е това, ако останалите са верни. */
  function hintFor(key, c, r) {
    /* „Ако т. 5 е вярно“, „Ако сумата по т. 8 е вярна“, „Ако т. 6 и т. 7 са верни“ */
    function ifTrue(labels) {
      if (labels.length > 1) return "Ако " + joinLabels(labels) + " са верни";
      return "Ако " + labels[0] + (labels[0].indexOf("сумата") === 0 ? " е вярна" : " е вярно");
    }
    var partLabels = r.parts.map(function (p) { return p.label; });
    if (key === c.left) {
      if (c.op === "le") return "Тук не може да е повече от " + r.sum + " (" + joinLabels(partLabels) + ").";
      return ifTrue(partLabels) + ", тук трябва да е " + r.sum + ".";
    }
    var me = r.parts.filter(function (p) { return p.key === key; })[0];
    var expected = r.left - (r.sum - me.value);
    if (c.op === "le") return "Сборът на " + joinLabels(partLabels) + " трябва да е поне " + r.left + " (" + termLabel(c.left) + ").";
    if (key.charAt(0) === "@") return "Сборът на редовете е " + me.value + ", а трябва да е " + expected + ".";
    if (expected < 0) return "Не излиза: " + termLabel(c.left) + " е " + r.left + ", а останалите вече дават повече.";
    var others = [termLabel(c.left)].concat(r.parts.filter(function (p) { return p.key !== key; }).map(function (p) { return p.label; }));
    return ifTrue(others) + ", тук трябва да е " + expected + ".";
  }

  /* Стойността, която би оправила контролата, ако се смени само това поле; null, ако няма такава. */
  function expectedFor(key, c, r) {
    if (key === c.left) return r.sum;
    var me = r.parts.filter(function (p) { return p.key === key; })[0];
    var expected = r.left - (r.sum - me.value);
    return expected < 0 ? null : expected;
  }

  /* Отбелязва до всяко поле контролите, в които участва: червено с подсказка, или зелено. */
  function annotate(results) {
    Array.prototype.forEach.call(root.querySelectorAll(".field-msg"), function (n) { n.remove(); });
    Array.prototype.forEach.call(root.querySelectorAll("[data-key]"), function (n) { n.classList.remove("bad", "good"); });
    var seen = {};
    results.forEach(function (x) {
      if (x.r.status === "empty") return;
      [x.c.left].concat(x.r.parts.map(function (p) { return p.key; })).forEach(function (key) {
        if (!root.querySelector('[data-key="' + key + '"]')) return;
        seen[key] = seen[key] || { bad: [], ok: 0 };
        if (x.r.status === "ok") { seen[key].ok++; return; }
        seen[key].bad.push({ expected: x.c.op === "eq" ? expectedFor(key, x.c, x.r) : null, hint: hintFor(key, x.c, x.r), quote: "Контрола: „" + x.c.quote + "“. " + x.detail });
      });
    });
    Object.keys(seen).forEach(function (key) {
      var node = root.querySelector('[data-key="' + key + '"]'), bad = seen[key].bad;
      node.classList.add(bad.length ? "bad" : "good");
      if (!bad.length) return;
      /* Когато няколко контроли искат една и съща стойност тук, казваме го с едно съобщение. */
      var same = bad.length > 1 && bad[0].expected !== null && bad.every(function (b) { return b.expected === bad[0].expected; });
      if (same) {
        node.appendChild(el("p", { class: "field-msg" }, [
          el("span", { class: "field-msg-hint" }, "✗ " + bad.length + " контроли сочат едно и също: тук вероятно трябва да е " + bad[0].expected + "."),
          bad.map(function (b) { return el("span", { class: "field-msg-quote" }, b.quote); })
        ].reduce(function (a, b) { return a.concat(b); }, [])));
        return;
      }
      bad.forEach(function (b) {
        node.appendChild(el("p", { class: "field-msg" }, [
          el("span", { class: "field-msg-hint" }, "✗ " + b.hint),
          el("span", { class: "field-msg-quote" }, b.quote)
        ]));
      });
    });
    /* текущ сбор под всяка таблица с листи */
    Array.prototype.forEach.call(root.querySelectorAll("[data-sum]"), function (n) {
      var rows = state.lists[n.getAttribute("data-sum")] || [], sum = 0, filled = 0;
      for (var i = 0; i < state.n; i++) { var v = num(rows[i]); if (v !== null) { sum += v; filled++; } }
      n.textContent = "Сбор на редовете: " + sum + (filled < state.n ? " (попълнени " + filled + " от " + state.n + ")" : "") + ".";
    });
  }

  function renderResults() {
    var box = document.getElementById("results");
    box.textContent = "";
    var bad = 0, ok = 0, empty = 0, list = el("ul", { class: "controls" }), results = [];
    current.controls.forEach(function (c) {
      if (c.onlyIf && !state.opts[c.onlyIf]) return;
      var r = evaluate(c);
      if (r.status === "ok") ok++; else if (r.status === "bad") bad++; else empty++;
      var detail;
      if (r.status === "empty") {
        detail = "Липсват числа за тази контрола.";
      } else {
        var right = r.parts.map(function (p) { return p.label + " = " + p.value; }).join("; ");
        detail = termLabel(c.left) + " = " + r.left + ". " + right +
          (r.parts.length > 1 ? "; сбор " + r.sum : "") + ". " +
          (r.status === "ok" ? "Спазена." : (c.op === "eq" ? "Разлика: " + Math.abs(r.left - r.sum) + "." : "Превишение с " + (r.left - r.sum) + "."));
      }
      results.push({ c: c, r: r, detail: detail });
      var mark = r.status === "ok" ? "✓" : r.status === "bad" ? "✗" : "…";
      var jump = null;
      if (r.status === "bad") {
        jump = el("button", { type: "button", class: "control-jump" }, "Към полето");
        jump.addEventListener("click", function () {
          var node = root.querySelector('[data-key="' + c.left + '"]'), input = node && node.querySelector("input");
          if (node) node.scrollIntoView({ block: "center" });
          if (input) input.focus({ preventScroll: true });
        });
      }
      list.appendChild(el("li", { class: "control " + r.status }, [
        el("span", { class: "control-mark", "aria-hidden": "true" }, mark),
        el("span", { class: "control-body" }, [
          el("span", { class: "control-quote" }, "„" + c.quote + "“"),
          el("span", { class: "control-detail" }, detail),
          jump
        ])
      ]));
    });
    var summary = bad
      ? el("p", { class: "summary bad" }, "Неспазени контроли: " + bad + ". Грешките са отбелязани и до самите полета. Проверете числата в черновата, преди да попълните формуляра.")
      : empty
        ? el("p", { class: "summary empty" }, "Въведете всички числа, за да се проверят контролите. Проверени: " + ok + ", чакат числа: " + empty + ".")
        : el("p", { class: "summary ok" }, isExample() ? "В примера всички контроли от образеца са спазени. Вижте как се получава всяка." : "Всички контроли от образеца са спазени.");
    box.appendChild(summary);
    box.appendChild(list);
    box.appendChild(SIK.sourceLine([{ s: current.source, at: "контролите в образеца" }]));
    annotate(results);
  }

  function onInput() { save(current.id); renderResults(); }

  function numberInput(id, value, onChange) {
    var example = isExample();
    var input = el("input", { type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "off", id: id,
      class: "num" + (example ? " example" : ""), readonly: example });
    input.value = value || "";
    if (example) return input;        // числата от примера не се редактират
    input.addEventListener("input", function () {
      input.classList.toggle("invalid", input.value.trim() !== "" && num(input.value) === null);
      onChange(input.value);
    });
    return input;
  }

  /* Обяснение към число от примера: откъде идва, с източника */
  function whyNote(note) {
    if (!note) return null;
    var p = el("p", { class: "field-why" }, [el("b", null, "Откъде идва: "), note.text + " "]);
    (note.src || []).forEach(function (r) { p.appendChild(SIK.sourceChip(r)); });
    return p;
  }

  function renderFields(section) {
    var wrap = el("div", { class: "fields" }), example = isExample();
    section.fields.forEach(function (f) {
      var id = "f-" + f.key;
      wrap.appendChild(el("div", { class: "field", "data-key": f.key }, [
        el("label", { "for": id }, [el("span", { class: "field-no" }, f.no), el("span", { class: "field-label" }, f.label)]),
        numberInput(id, state.values[f.key], function (v) { state.values[f.key] = v; onInput(); }),
        f.hint && !example ? el("p", { class: "field-hint" }, f.hint) : null,
        example ? whyNote(current.example.notes[f.key]) : null
      ]));
    });
    return wrap;
  }

  function renderList(section) {
    var key = section.list, rows = state.lists[key] = state.lists[key] || [];
    var wrap = el("div", { class: "fields" }), example = isExample();
    if (example) {
      wrap.appendChild(whyNote(current.example.notes["@" + key]));
    } else if (ballot) {
      wrap.appendChild(el("p", { class: "hint" }, "Редовете са кандидатските листи по номерата им в бюлетината, както са отпечатани в протокола."));
      wrap.appendChild(SIK.sourceLine([{ s: ballot.source }]));
    }
    for (var i = 0; i < state.n; i++) {
      (function (i) {
        var id = "l-" + key + "-" + i;
        var list = ballot && !example ? ballot.lists[i] : null;   // в примера имената нарочно не се показват
        var label = list
          ? [el("span", { class: "list-names" }, list.president + " и " + list.vice), el("span", { class: "list-by" }, list.by)]
          : "Кандидатска листа № " + (i + 1);
        wrap.appendChild(el("div", { class: "field" }, [
          el("label", { "for": id }, [el("span", { class: "field-no" }, "№ " + (list ? list.no : i + 1)), el("span", { class: "field-label" }, label)]),
          numberInput(id, rows[i], function (v) { rows[i] = v; onInput(); })
        ]));
      })(i);
    }
    /* сборът на таблицата и съобщението, ако не излиза с контролата */
    wrap.appendChild(el("div", { class: "list-total", "data-key": "@" + key }, el("p", { class: "list-sum", "data-sum": key }, "")));
    return wrap;
  }

  function render() {
    root.textContent = "";
    var s = SIK.sources[current.source];

    root.appendChild(el("div", { class: "card" }, [
      el("h2", null, "Приложение № " + current.no),
      el("p", null, current.title + "."),
      el("p", { class: "hint" }, "Кога: " + current.when),
      el("p", null, el("a", { class: "btn small", href: s.url, target: "_blank", rel: "noopener" }, "Образецът от ЦИК")),
      SIK.sourceLine([{ s: current.source }, { s: "r262" }, { s: "r288" }])
    ]));

    var example = isExample();
    var form = el("div", { class: "card" + (example ? " example-mode" : "") });

    /* Превключвател: моите числа / пример с обяснения. Примерът не пипа въведеното. */
    if (current.example) {
      var mineBtn = el("button", { type: "button", class: "mode" + (example ? "" : " active"), "aria-pressed": example ? "false" : "true" }, "Моите числа");
      var exBtn = el("button", { type: "button", class: "mode" + (example ? " active" : ""), "aria-pressed": example ? "true" : "false" }, "Пример с обяснения");
      mineBtn.addEventListener("click", function () { if (mode !== "mine") setMode("mine"); });
      exBtn.addEventListener("click", function () { if (mode !== "example") setMode("example"); });
      form.appendChild(el("div", { class: "modes", role: "group", "aria-label": "Режим" }, [mineBtn, exBtn]));
      form.appendChild(example
        ? el("div", { class: "example-banner" }, [
            el("p", null, [el("b", null, "Пример за обучение. "), current.example.story]),
            el("p", null, "Числата са измислени и не се редактират. Под всяко пише откъде идва. Вашите числа са запазени: върнете се към тях с „Моите числа“.")
          ])
        : el("p", { class: "hint" }, "Не сте сигурни какво се пише в някое поле? „Пример с обяснения“ показва попълнен протокол. Въведеното от вас се пази и се връща, когато превключите обратно."));
    }

    (current.options || []).forEach(function (o) {
      var box = el("input", { type: "checkbox", id: "opt-" + o.key, checked: !!state.opts[o.key], disabled: example });
      box.addEventListener("change", function () { state.opts[o.key] = box.checked; save(current.id); render(); });
      form.appendChild(el("p", { class: "option-check" }, el("label", { "for": "opt-" + o.key }, [box, " " + o.label])));
    });

    current.sections.forEach(function (section) {
      if (!visible(section)) return;
      form.appendChild(el("h3", null, section.title));
      form.appendChild(section.list ? renderList(section) : renderFields(section));
    });

    if (!example) {
      var clear = el("button", { type: "button", class: "btn" }, "Изчисти моите числа");
      clear.addEventListener("click", function () {
        mine = { values: {}, lists: {}, n: mine.n, opts: mine.opts };
        activate();
        save(current.id);
        render();
      });
      form.appendChild(el("p", null, clear));
    }
    root.appendChild(form);

    root.appendChild(el("div", { class: "card", id: "results-card" }, [
      el("h2", null, "Контроли"),
      el("div", { id: "results", "aria-live": "polite" })
    ]));
    renderResults();
  }

  function select(id) {
    if (!SIK.protocols[id]) id = "78";
    current = SIK.protocols[id];
    current.id = id;
    mine = load(id) || { values: {}, lists: {}, n: 0, opts: {} };
    mine.n = ballot ? ballot.lists.length : 0;   // редовете по листи са тези от бюлетината
    activate();
    Array.prototype.forEach.call(picker.querySelectorAll("a"), function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + id);
    });
    document.title = "Проверка на Приложение № " + current.no + " · Помощник за СИК";
    render();
  }

  Object.keys(SIK.protocols).forEach(function (id) {
    picker.appendChild(el("a", { href: "#" + id, class: "tab" }, [
      el("b", null, SIK.protocols[id].no), el("span", null, shortName(id))
    ]));
  });
  function shortName(id) {
    return { "78": "хартиени бюлетини", "79": "машина", "80": "преустановено машинно", "81": "контролни разписки" }[id] || "";
  }

  window.addEventListener("hashchange", function () { select((location.hash || "").replace(/^#/, "")); });
  select((location.hash || "").replace(/^#/, ""));
})();
