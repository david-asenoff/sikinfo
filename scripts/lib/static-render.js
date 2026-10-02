/* Рисува съдържанието на помощника като обикновен HTML, без JavaScript.
   Ползва се от render-static.js (вписва го в страниците) и от check-content.js
   (проверява, че вписаното не е остаряло спрямо данните). Същите класове като в
   faq.js и guide.js, за да важат същите стилове. */
"use strict";

const fs = require("fs");
const path = require("path");

const WWW = path.resolve(__dirname, "..", "..", "src", "SikInfo.Web", "wwwroot");
const PAGES = ["index.html", "patevoditel.html", "protokol.html", "vaprosi.html", "udostoverenia.html", "poveritelnost.html"];
const GUIDE_ORDER = ["start", "tip", "mashina", "celiq_den", "final_protokol", "prekasnato", "r_78", "r_psik", "r_79", "r_80", "r_neqsno", "otkrivane", "predizboren", "opakovane"];

function loadData() {
  global.window = global;
  for (const f of ["sources", "protocols-data", "ballot-data", "guide-data", "faq-data"]) {
    delete require.cache[require.resolve(path.join(WWW, "js", "data", f + ".js"))];
    require(path.join(WWW, "js", "data", f + ".js"));
  }
  return global.SIK;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Същата логика като SIK.sourceLabel в site.js */
function sourceLabel(SIK, ref) {
  const s = SIK.sources[ref.s];
  if (!s) return ref.at || ref.s;
  if (ref.s === "ik") return ref.at ? ref.at + " ИК" : s.label;
  if (ref.s.charAt(0) === "r" && ref.s !== "resheniya") return ref.at ? ref.at + ", " + s.label : s.label;
  return ref.at ? s.label + ", " + ref.at : s.label;
}
function sourceLine(SIK, refs) {
  if (!refs || !refs.length) return "";
  const chips = refs.map((r) => {
    const s = SIK.sources[r.s];
    return s
      ? `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${esc(sourceLabel(SIK, r))}</a>`
      : `<span class="src">${esc(sourceLabel(SIK, r))}</span>`;
  });
  return `<p class="srcs"><span class="srcs-label">${refs.length > 1 ? "Източници: " : "Източник: "}</span>${chips.join("")}</p>`;
}

/* ---------- въпроси и отговори ---------- */
function renderFaq(SIK) {
  return SIK.faq.map((item, i) => {
    const steps = item.steps
      ? `<ol class="faq-steps">${item.steps.map((s) => `<li${s.unverified ? ' class="unverified"' : ""}><b>${esc(s.title)}. </b>${esc(s.text)}${s.unverified ? '<span class="badge">от предишни избори</span>' : ""}</li>`).join("")}</ol>`
      : "";
    const caveat = item.caveat ? `<p class="pending-note">${esc(item.caveat)}</p>` : "";
    const link = item.link ? `<p><a class="btn small" href="${esc(item.link.href)}">${esc(item.link.text)}</a></p>` : "";
    return `<details class="faq${item.pending ? " pending" : ""}" id="v${i + 1}" data-cat="${esc(item.cat)}">` +
      `<summary>${esc(item.q)}${item.pending ? '<span class="badge">частично</span>' : ""}</summary>` +
      `<p class="faq-a">${esc(item.a)}</p>${steps}${caveat}${link}${sourceLine(SIK, item.src)}</details>`;
  }).join("\n");
}

/* ---------- пътеводителят като текст за четене и печат ---------- */
function renderGuide(SIK) {
  const nodes = SIK.guide.nodes;
  const order = GUIDE_ORDER.concat(Object.keys(nodes).filter((id) => !GUIDE_ORDER.includes(id)));
  const sections = order.map((id) => {
    const n = nodes[id];
    let h = `<section class="guide-node" id="t-${id}"><h3>${esc(n.title)}${n.pending ? '<span class="badge">в разработка</span>' : ""}</h3>`;
    if (n.text) h += `<p>${esc(n.text)}</p>`;
    if (n.options) {
      h += `<ul class="guide-options">${n.options.map((o) => o.disabled
        ? `<li>${esc(o.label)}: <i>в разработка.</i> ${esc(o.note || "")}</li>`
        : `<li>${esc(o.label)} → <a href="#t-${esc(o.next)}">${esc(nodes[o.next].title)}</a></li>`).join("")}</ul>`;
    }
    (n.protocols || []).forEach((p) => {
      const def = SIK.protocols[p.form];
      h += `<p><b>Приложение № ${esc(def.no)}.</b> ${esc(def.title)}. ${esc(p.why)}</p>`;
    });
    (n.notes || []).forEach((x) => { h += `<p class="gnote">${esc(x)}</p>`; });
    h += sourceLine(SIK, n.src);
    if (n.steps && n.steps.length) {
      h += `<ol class="guide-steps">${n.steps.map((s) =>
        `<li>${esc(s.text)}${s.pending ? `<p class="pending-note">В разработка: ${esc(s.pending)}</p>` : ""}${sourceLine(SIK, s.src)}</li>`).join("")}</ol>`;
    }
    return h + "</section>";
  });
  return sections.join("\n");
}

/* ---------- карта на сайта ---------- */
function renderSitemap(SIK) {
  const m = SIK.asOf.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const lastmod = m ? `${m[3]}-${m[2]}-${m[1]}` : new Date().toISOString().slice(0, 10);
  const urls = PAGES.map((p) => `  <url><loc>https://sikinfo.com/${p === "index.html" ? "" : p}</loc><lastmod>${lastmod}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/* ---------- вписване между маркери ---------- */
function replaceBlock(html, name, content) {
  const open = `<!-- static:${name} -->`, close = `<!-- /static:${name} -->`;
  const a = html.indexOf(open), b = html.indexOf(close);
  if (a < 0 || b < 0 || b < a) throw new Error(`липсват маркерите ${open} … ${close}`);
  return html.slice(0, a + open.length) + "\n" + content + "\n" + html.slice(b);
}
function blockOf(html, name) {
  const open = `<!-- static:${name} -->`, close = `<!-- /static:${name} -->`;
  const a = html.indexOf(open), b = html.indexOf(close);
  if (a < 0 || b < 0) return null;
  return html.slice(a + open.length, b).trim();
}

module.exports = { WWW, PAGES, loadData, renderFaq, renderGuide, renderSitemap, replaceBlock, blockOf, esc };
