/* Пътеводител: показва по един екран според адреса след # (patevoditel.html#tip).
   Всеки избор е обикновена връзка, така че бутонът „назад“ на браузъра работи. */
(function () {
  "use strict";
  var SIK = window.SIK, el = SIK.el;
  var root = document.getElementById("guide");
  var nodes = SIK.guide.nodes;

  function stored(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }
  function store(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* без запомняне */ }
  }

  function badge(text) { return el("span", { class: "badge" }, text); }

  function renderOptions(node) {
    var list = el("div", { class: "options" });
    node.options.forEach(function (o) {
      var body = [el("span", { class: "option-label" }, o.label)];
      if (o.sub) body.push(el("span", { class: "option-sub" }, o.sub));
      if (o.disabled) {
        body.push(badge("в разработка"));
        if (o.note) body.push(el("span", { class: "option-note" }, o.note));
        list.appendChild(el("div", { class: "option disabled", "aria-disabled": "true" }, body));
      } else {
        if (o.partial) body.push(badge("частично"));
        list.appendChild(el("a", { class: "option", href: "#" + o.next }, body));
      }
    });
    return list;
  }

  function renderProtocols(node) {
    if (!node.protocols) return null;
    var wrap = el("div", { class: "protocols" });
    node.protocols.forEach(function (p) {
      var def = SIK.protocols[p.form], s = SIK.sources[def.source];
      wrap.appendChild(el("div", { class: "protocol" }, [
        el("p", { class: "protocol-no" }, "Приложение № " + def.no),
        el("p", { class: "protocol-title" }, def.title),
        el("p", { class: "protocol-why" }, p.why),
        el("p", { class: "protocol-actions" }, [
          el("a", { class: "btn primary", href: "protokol.html#" + p.form }, "Провери числата"),
          " ",
          el("a", { class: "btn", href: s.url, target: "_blank", rel: "noopener" }, "Образецът от ЦИК")
        ])
      ]));
    });
    return wrap;
  }

  function renderSteps(id, node) {
    if (!node.steps || !node.steps.length) return null;
    var key = "sik-steps-" + id, done = stored(key);
    var list = el("ol", { class: "steps" });
    node.steps.forEach(function (step, i) {
      var box = el("input", { type: "checkbox", id: "st" + i, checked: !!done[i] });
      var item = el("li", { class: "step" + (done[i] ? " done" : "") }, [
        el("label", { class: "step-main", "for": "st" + i }, [box, el("span", { class: "step-text" }, step.text)]),
        SIK.sourceLine(step.src),
        step.check ? el("p", { class: "step-check" },
          el("a", { class: "btn small", href: "protokol.html#" + step.check }, "Провери числата на Приложение № " + SIK.protocols[step.check].no)) : null,
        step.pending ? el("p", { class: "pending-note" }, [badge("в разработка"), " " + step.pending]) : null
      ]);
      box.addEventListener("change", function () {
        done[i] = box.checked;
        store(key, done);
        item.classList.toggle("done", box.checked);
      });
      list.appendChild(item);
    });
    return el("div", null, [el("h3", null, "Стъпки"), list,
      el("p", { class: "hint" }, "Отметките се пазят само в този раздел на браузъра и изчезват, когато го затворите.")]);
  }

  function render() {
    var id = (location.hash || "").replace(/^#/, "") || SIK.guide.start;
    var node = nodes[id];
    if (!node) { id = SIK.guide.start; node = nodes[id]; }
    root.textContent = "";

    if (id !== SIK.guide.start) {
      root.appendChild(el("p", { class: "crumbs" }, [
        el("a", { href: "#" + SIK.guide.start }, "Начало на пътеводителя"),
        " · ",
        el("a", { href: "#", id: "back" }, "← Назад")
      ]));
      document.getElementById("back").addEventListener("click", function (e) { e.preventDefault(); history.back(); });
    }

    var card = el("section", { class: "card" + (node.pending ? " pending" : "") });
    card.appendChild(el("h2", null, node.title));
    if (node.pending) card.appendChild(el("p", { class: "pending-note" }, [badge("в разработка"), " Тази част чака публикуването на Методическите указания на ЦИК."]));
    if (node.text) card.appendChild(el("p", null, node.text));
    if (node.type === "question") card.appendChild(renderOptions(node));
    var protocols = renderProtocols(node);
    if (protocols) card.appendChild(protocols);
    (node.notes || []).forEach(function (n) { card.appendChild(el("p", { class: "gnote" }, n)); });
    var srcLine = SIK.sourceLine(node.src);
    if (srcLine) card.appendChild(srcLine);
    var steps = renderSteps(id, node);
    if (steps) card.appendChild(steps);
    root.appendChild(card);

    document.title = node.title + " · Помощник за СИК";
    window.scrollTo(0, 0);
    var h = card.querySelector("h2");
    h.setAttribute("tabindex", "-1");
    if (id !== SIK.guide.start) h.focus();
  }

  window.addEventListener("hashchange", render);
  render();
})();
