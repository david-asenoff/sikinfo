/* Общи помощни функции за страниците на помощника.
   Нищо тук не изпраща данни: няма заявки към сървър, освен зареждането на самите страници. */
(function () {
  "use strict";
  var SIK = window.SIK = window.SIK || {};

  /* Създава елемент: el("p", {class: "x"}, "текст" | възел | [възли]) */
  SIK.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, v);
      });
    }
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  /* Етикет на източник: „чл. 229, ал. 1 ИК“, „т. 5, Решение № 216-ПВР“, „Приложение № 78-ПВР-х, т. 2“ */
  SIK.sourceLabel = function (ref) {
    var s = SIK.sources[ref.s];
    if (!s) return ref.at || ref.s;
    if (ref.s === "ik") return ref.at ? ref.at + " ИК" : s.label;
    if (ref.s.charAt(0) === "r" && ref.s !== "resheniya") return ref.at ? ref.at + ", " + s.label : s.label;
    return ref.at ? s.label + ", " + ref.at : s.label;
  };

  SIK.sourceChip = function (ref) {
    var s = SIK.sources[ref.s];
    if (!s) return SIK.el("span", { class: "src" }, SIK.sourceLabel(ref));
    return SIK.el("a", { class: "src", href: s.url, target: "_blank", rel: "noopener", title: s.title }, SIK.sourceLabel(ref));
  };

  /* Ред „Източник: …“ с връзки към документите */
  SIK.sourceLine = function (refs) {
    if (!refs || !refs.length) return null;
    var line = SIK.el("p", { class: "srcs" }, SIK.el("span", { class: "srcs-label" }, refs.length > 1 ? "Източници: " : "Източник: "));
    refs.forEach(function (r) { line.appendChild(SIK.sourceChip(r)); });
    return line;
  };

  /* „Актуално към …“ навсякъде, където има елемент с data-asof */
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-asof]"), function (n) {
      n.textContent = SIK.asOf || "";
    });
  });

  /* Работа без интернет: страниците се пазят в кеша на браузъра след първото отваряне. */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* без офлайн режим, сайтът работи и така */ });
    });
  }
})();
