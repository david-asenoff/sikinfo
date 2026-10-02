#!/usr/bin/env node
/* Вписва съдържанието като обикновен HTML в страниците, за да го виждат търсачките и
   хората без JavaScript, и прави картата на сайта. Пуска се след всяка промяна в данните:
     node scripts/render-static.js
   check-content.js после проверява, че вписаното съвпада с данните. */
"use strict";

const fs = require("fs");
const path = require("path");
const R = require("./lib/static-render");

const SIK = R.loadData();
let changed = 0;

function update(file, name, content) {
  const p = path.join(R.WWW, file);
  const before = fs.readFileSync(p, "utf8");
  const after = R.replaceBlock(before, name, content);
  if (after !== before) { fs.writeFileSync(p, after); changed++; console.log("обновен:", file, "(" + name + ")"); }
  else console.log("без промяна:", file, "(" + name + ")");
}

update("vaprosi.html", "faq", R.renderFaq(SIK));
update("patevoditel.html", "guide", R.renderGuide(SIK));

const sitemapPath = path.join(R.WWW, "sitemap.xml");
const sitemap = R.renderSitemap(SIK);
if (!fs.existsSync(sitemapPath) || fs.readFileSync(sitemapPath, "utf8") !== sitemap) {
  fs.writeFileSync(sitemapPath, sitemap); changed++; console.log("обновен: sitemap.xml");
} else console.log("без промяна: sitemap.xml");

console.log(changed ? "Готово, променени файлове: " + changed : "Всичко вече беше актуално.");
