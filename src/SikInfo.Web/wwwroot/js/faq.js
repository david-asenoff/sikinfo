/* Въпроси и отговори: търсене по дума и филтър по тема. Всичко е в страницата, нищо не се изпраща. */
(function () {
  "use strict";
  var SIK = window.SIK, el = SIK.el;
  var list = document.getElementById("faq-list");
  var search = document.getElementById("faq-search");
  var cats = document.getElementById("faq-cats");
  var count = document.getElementById("faq-count");
  var activeCat = "";

  function norm(s) { return String(s).toLowerCase().replace(/ё/g, "е"); }

  var categories = [];
  SIK.faq.forEach(function (item) { if (categories.indexOf(item.cat) === -1) categories.push(item.cat); });

  function catButton(label, value) {
    var b = el("button", { type: "button", class: "chip" + (value === activeCat ? " active" : "") }, label);
    b.addEventListener("click", function () { activeCat = value; renderCats(); render(); });
    return b;
  }
  function renderCats() {
    cats.textContent = "";
    cats.appendChild(catButton("Всички", ""));
    categories.forEach(function (c) { cats.appendChild(catButton(c, c)); });
  }

  function render() {
    var words = norm(search.value).split(/\s+/).filter(Boolean);
    list.textContent = "";
    var shown = 0;
    SIK.faq.forEach(function (item, i) {
      if (activeCat && item.cat !== activeCat) return;
      var stepsText = (item.steps || []).map(function (s) { return s.title + " " + s.text; }).join(" ");
      var hay = norm(item.q + " " + item.a + " " + stepsText + " " + item.cat + " " + item.src.map(SIK.sourceLabel).join(" "));
      if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return;
      shown++;
      /* Стъпки към отговора. "unverified" = от практиката на предишни избори, още без източник за тези. */
      var steps = item.steps ? el("ol", { class: "faq-steps" }, item.steps.map(function (s) {
        return el("li", { class: s.unverified ? "unverified" : null }, [
          el("b", null, s.title + ". "), s.text,
          s.unverified ? el("span", { class: "badge" }, "от предишни избори") : null
        ]);
      })) : null;
      list.appendChild(el("details", { class: "faq" + (item.pending ? " pending" : ""), id: "v" + (i + 1) }, [
        el("summary", null, [item.q, item.pending ? el("span", { class: "badge" }, "частично") : null]),
        el("p", { class: "faq-a" }, item.a),
        steps,
        item.caveat ? el("p", { class: "pending-note" }, item.caveat) : null,
        item.link ? el("p", null, el("a", { class: "btn small", href: item.link.href }, item.link.text)) : null,
        SIK.sourceLine(item.src)
      ]));
    });
    count.textContent = shown === SIK.faq.length
      ? "Общо " + shown + " въпроса."
      : "Показани " + shown + " от " + SIK.faq.length + ".";
    if (!shown) list.appendChild(el("p", { class: "hint" }, "Няма въпрос с тези думи. Опитайте с по-кратка дума, например „печат“, „машина“, „копие“."));
    if (words.length && shown && shown <= 3) {
      Array.prototype.forEach.call(list.querySelectorAll("details"), function (d) { d.open = true; });
    }
  }

  search.addEventListener("input", render);
  renderCats();
  render();

  /* Връзка направо към въпрос: vaprosi.html#v12 */
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.tagName === "DETAILS") { target.open = true; target.scrollIntoView(); }
})();
