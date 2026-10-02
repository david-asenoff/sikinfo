#!/usr/bin/env node
/* Проверка на съдържанието и на страниците. Тече при всеки push в GitHub и локално с:
     node scripts/check-content.js

   Какво проверява:
   - всеки източник, възел от пътеводителя, поле и контрола съществуват и се връзват;
   - всяка стъпка и всеки отговор имат поне един източник;
   - примерите в проверката на протокол излизат по всички контроли и имат обяснение за всяко поле;
   - бюлетината има поредни номера без прекъсване;
   - страниците сочат само към съществуващи файлове, нямат вградени скриптове и стилове,
     имат канонични адреси, статистика и връзка към поверителността;
   - списъкът за работа без интернет (sw.js) сочи към съществуващи файлове.
   Нищо не се променя. При проблем кодът за изход е 1. */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "src", "SikInfo.Web", "wwwroot");
const DOMAIN = "sikinfo.com";
const PAGES = ["index.html", "patevoditel.html", "protokol.html", "vaprosi.html", "udostoverenia.html", "poveritelnost.html"];

const problems = [];
const fail = (where, what) => problems.push(where + ": " + what);
const read = (rel) => fs.readFileSync(path.join(WWW, rel), "utf8");

/* Данните се зареждат както в браузъра: всеки файл добавя към глобалния обект SIK. */
global.window = global;
for (const f of ["sources", "protocols-data", "ballot-data", "guide-data", "faq-data"]) {
  require(path.join(WWW, "js", "data", f + ".js"));
}
const SIK = global.SIK;

/* ---------- източници ---------- */
for (const [id, s] of Object.entries(SIK.sources)) {
  if (!s.label || !s.title || !/^https:\/\//.test(s.url || "")) fail("sources." + id, "липсва етикет, заглавие или https адрес");
}
function checkRefs(refs, where) {
  if (!refs || !refs.length) { fail(where, "без източник"); return; }
  for (const r of refs) {
    if (!SIK.sources[r.s]) fail(where, "непознат източник " + r.s);
    if (r.s === "ik" && !/^чл\. \d+/.test(r.at || "")) fail(where, "цитат от ИК без член: " + JSON.stringify(r.at));
  }
}
if (!/^\d{2}\.\d{2}\.\d{4}$/.test(SIK.asOf || "")) fail("sources.asOf", "датата трябва да е във вид ДД.ММ.ГГГГ");

/* ---------- бюлетина ---------- */
const lists = (SIK.ballot && SIK.ballot.lists) || [];
if (lists.length < 2) fail("ballot", "няма кандидатски листи");
lists.forEach((l, i) => {
  if (l.no !== i + 1) fail("ballot", "номерата не са поредни при " + l.no);
  if (!l.by || !l.president || !l.vice) fail("ballot", "непълна листа № " + l.no);
});
if (!SIK.sources[SIK.ballot.source]) fail("ballot", "непознат източник " + SIK.ballot.source);

/* ---------- протоколи и примери ---------- */
for (const [id, p] of Object.entries(SIK.protocols)) {
  const where = "protocols." + id;
  if (!SIK.sources[p.source]) fail(where, "непознат източник " + p.source);
  const keys = new Set();
  p.sections.forEach((s) => { (s.fields || []).forEach((f) => keys.add(f.key)); if (s.list) keys.add("@" + s.list); });
  p.controls.forEach((c) => {
    [c.left, ...c.right].forEach((k) => { if (!keys.has(k)) fail(where, "контролата сочи към несъществуващо поле " + k); });
    if (!c.quote) fail(where, "контрола без цитат от образеца");
  });
  const ex = p.example;
  if (!ex) { fail(where, "няма пример за обучение"); continue; }
  const opts = ex.opts || {};
  const hidden = (k) => p.sections.some((s) => s.onlyIf && !opts[s.onlyIf] && ((s.list && "@" + s.list === k) || (s.fields || []).some((f) => f.key === k)));
  const val = (k) => (k[0] === "@" ? lists.length * ex.perList[k.slice(1)] : ex.values[k]);
  for (const c of p.controls) {
    if (c.onlyIf && !opts[c.onlyIf]) continue;
    const sum = c.right.filter((k) => !hidden(k)).reduce((a, k) => a + val(k), 0);
    const left = val(c.left);
    const ok = c.op === "eq" ? left === sum : left <= sum;
    if (!ok || !Number.isFinite(left) || !Number.isFinite(sum)) fail(where + ".example", "не излиза контролата „" + c.quote + "“ (" + left + " спрямо " + sum + ")");
  }
  for (const s of p.sections) {
    if (s.onlyIf && !opts[s.onlyIf]) continue;
    for (const f of s.fields || []) {
      if (ex.values[f.key] === undefined) fail(where + ".example", "няма стойност за " + f.key);
      if (!ex.notes[f.key]) fail(where + ".example", "няма обяснение за " + f.key); else checkRefs(ex.notes[f.key].src, where + ".example.notes." + f.key);
    }
    if (s.list) {
      if (!ex.perList || ex.perList[s.list] === undefined) fail(where + ".example", "няма стойност за таблицата " + s.list);
      if (!ex.notes["@" + s.list]) fail(where + ".example", "няма обяснение за таблицата " + s.list); else checkRefs(ex.notes["@" + s.list].src, where + ".example.notes.@" + s.list);
    }
  }
  if (!ex.story) fail(where + ".example", "няма история");
}

/* ---------- пътеводител ---------- */
const nodes = SIK.guide.nodes;
if (!nodes[SIK.guide.start]) fail("guide", "началният възел не съществува");
const reachable = new Set();
(function walk(id) {
  if (reachable.has(id) || !nodes[id]) return;
  reachable.add(id);
  (nodes[id].options || []).forEach((o) => { if (!o.disabled) walk(o.next); });
})(SIK.guide.start);
for (const [id, n] of Object.entries(nodes)) {
  const where = "guide." + id;
  if (!n.title) fail(where, "без заглавие");
  if (!reachable.has(id)) fail(where, "недостижим от началото");
  if (n.src) checkRefs(n.src, where);
  (n.options || []).forEach((o, i) => {
    if (o.disabled) { if (!o.note) fail(where, "изключен избор без обяснение: " + o.label); return; }
    if (!nodes[o.next]) fail(where, "избор " + (i + 1) + " сочи към несъществуващ възел " + o.next);
  });
  (n.protocols || []).forEach((pr) => { if (!SIK.protocols[pr.form]) fail(where, "непознат протокол " + pr.form); if (!pr.why) fail(where, "протокол без обяснение защо"); });
  (n.steps || []).forEach((st, i) => {
    if (!st || !st.text) { fail(where, "празна стъпка " + (i + 1)); return; }
    checkRefs(st.src, where + ".steps[" + (i + 1) + "]");
    if (st.check && !SIK.protocols[st.check]) fail(where, "стъпка " + (i + 1) + " сочи към непознат протокол " + st.check);
  });
  if (n.type === "question" && !(n.options || []).length) fail(where, "въпрос без избори");
}

/* ---------- въпроси и отговори ---------- */
const seenQ = new Set();
SIK.faq.forEach((item, i) => {
  const where = "faq[" + (i + 1) + "]";
  if (!item.q || !item.a || !item.cat) fail(where, "липсва въпрос, отговор или тема");
  if (seenQ.has(item.q)) fail(where, "повторен въпрос: " + item.q);
  seenQ.add(item.q);
  checkRefs(item.src, where);
  if (item.link && !fs.existsSync(path.join(WWW, item.link.href.split("#")[0]))) fail(where, "връзката сочи към липсваща страница " + item.link.href);
  if ((item.steps || []).some((s) => s.unverified) && !item.caveat) fail(where, "има непотвърдени стъпки без бележка");
});

/* ---------- страници ---------- */
for (const page of PAGES) {
  const where = "wwwroot/" + page;
  if (!fs.existsSync(path.join(WWW, page))) { fail(where, "липсва"); continue; }
  const html = read(page);
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|data:|mailto:|#)/.test(u)) continue;
    const file = u.split("#")[0].split("?")[0];
    if (!fs.existsSync(path.join(WWW, file)) && !fs.existsSync(path.join(ROOT, file))) fail(where, "връзка към липсващ файл " + u);
  }
  if (/<script(?![^>]*\ssrc=)/.test(html)) fail(where, "вграден скрипт; политиката за сигурност ще го блокира");
  if (/\sstyle="/.test(html)) fail(where, "вграден style атрибут; политиката за сигурност ще го блокира");
  if (/\son[a-z]+="/.test(html)) fail(where, "вграден обработчик на събитие");
  if (!html.includes('<link rel="canonical" href="https://' + DOMAIN + "/")) fail(where, "каноничният адрес не е на " + DOMAIN);
  if (!html.includes('data-domains="' + DOMAIN + ",www." + DOMAIN + '"')) fail(where, "статистиката не е ограничена до " + DOMAIN);
  for (const tag of ["og:title", "og:description", "og:image", "og:url"]) {
    if (!html.includes('property="' + tag + '"')) fail(where, "липсва " + tag + " за споделяне");
  }
  if (!/<meta name="twitter:card" content="summary_large_image">/.test(html)) fail(where, "липсва twitter:card");
  const title = (html.match(/<title>([^<]*)<\/title>/) || ["", ""])[1];
  if (title.length < 20 || title.length > 110) fail(where, "заглавието е " + title.length + " знака; очаква се между 20 и 110");
  if (!html.includes('href="poveritelnost.html"')) fail(where, "няма връзка към поверителността");
  if (!html.includes('<html lang="bg">')) fail(where, "езикът на страницата не е български");
  if (!/<meta name="viewport"/.test(html)) fail(where, "няма viewport за телефон");
}
/* ---------- вписаното съдържание за търсачки, картата на сайта, robots ---------- */
const R = require("./lib/static-render");
const fresh = { faq: R.renderFaq(SIK), guide: R.renderGuide(SIK) };
for (const [page, name] of [["vaprosi.html", "faq"], ["patevoditel.html", "guide"]]) {
  const block = R.blockOf(read(page), name);
  if (block === null) fail("wwwroot/" + page, "липсват маркерите за вписаното съдържание (" + name + ")");
  else if (block !== fresh[name].trim()) fail("wwwroot/" + page, "вписаното съдържание е остаряло; пуснете node scripts/render-static.js");
}
if (!fs.existsSync(path.join(WWW, "sitemap.xml"))) fail("sitemap.xml", "липсва; пуснете node scripts/render-static.js");
else if (read("sitemap.xml") !== R.renderSitemap(SIK)) fail("sitemap.xml", "остаряла; пуснете node scripts/render-static.js");
if (!fs.existsSync(path.join(WWW, "robots.txt")) || !read("robots.txt").includes("Sitemap: https://" + DOMAIN + "/sitemap.xml")) fail("robots.txt", "липсва или не сочи към картата на сайта");
if (!fs.existsSync(path.join(WWW, "assets", "og.png"))) fail("assets/og.png", "липсва картинката за споделяне");

const sw = read("sw.js");
const core = JSON.parse("[" + (sw.match(/var CORE = \[([\s\S]*?)\];/) || ["", ""])[1] + "]");
if (!core.length) fail("sw.js", "празен списък CORE");
core.forEach((f) => { if (f !== "./" && !fs.existsSync(path.join(WWW, f))) fail("sw.js", "CORE сочи към липсващ файл " + f); });
PAGES.forEach((p) => { if (!core.includes(p)) fail("sw.js", "страницата " + p + " не е в CORE и няма да работи без интернет"); });
if (!/var CACHE = "sik-pomoshtnik-v\d+"/.test(sw)) fail("sw.js", "името на кеша не е във вид sik-pomoshtnik-vN");

/* ---------- резултат ---------- */
const stats = {
  "източници": Object.keys(SIK.sources).length,
  "възли в пътеводителя": Object.keys(nodes).length,
  "стъпки": Object.values(nodes).reduce((a, n) => a + (n.steps || []).length, 0),
  "протоколи": Object.keys(SIK.protocols).length,
  "въпроси": SIK.faq.length,
  "кандидатски листи": lists.length,
  "страници": PAGES.length
};
console.log(Object.entries(stats).map(([k, v]) => k + ": " + v).join(" | "));
if (problems.length) {
  console.error("\nПРОБЛЕМИ: " + problems.length);
  problems.forEach((p) => console.error(" - " + p));
  process.exit(1);
}
console.log("Съдържанието е последователно: всички източници, възли, полета, примери и страници са наред.");
