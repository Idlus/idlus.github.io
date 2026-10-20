/* Interface des temples sur PC et mobile, hors ligne et sans compte réel.
   Lancer : node tests/temples-ui.test.js */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp" };

const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(ROOT, p);
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});


const assert=require('assert');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port+'/';let browser;
  try {
    browser=await chromium.launch(process.env.IDLUS_TEST_BROWSER ? { executablePath: process.env.IDLUS_TEST_BROWSER } : {});const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'});
    await page.route(url=>!url.href.startsWith(base),route=>route.fulfill({status:200,body:''}));
    await page.addInitScript(()=>{window.__IDLUS_OFFLINE=true;});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'load'});
    await page.waitForSelector('[data-act="startgame"]');await page.click('[data-act="startgame"]');
    await page.waitForFunction(()=>window.DX && window.DX.S);
    await page.evaluate(()=>{
      const {E,S,ui}=DX; E.tipState(S).off=true; const tip=document.querySelector('#wtip'); if(tip)tip.remove();
      document.querySelector('#sheet').innerHTML='';const c=document.querySelector('#cele');if(c)c.innerHTML='';
      ui.tab='quests';ui.qt='temples';DX.render();
    });
    assert.equal(await page.locator('[data-act="vi-tall"]').isDisabled(),true);
    await page.evaluate(()=>{const {E,S}=DX;E.startHunt(S,Object.keys(E.SUBS)[0]);DX.render();});
    await page.click('[data-act="vi-tall"]');
    await page.waitForSelector('[data-act="vi-tstop"]');
    assert.match(await page.locator('#main').innerText(),/Combat 1\/1/i);
    assert.equal(await page.locator('[data-act="vi-tfight"]').first().isDisabled(),true);
    await page.screenshot({path:'temples-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('[data-act="vi-tstop"]').isVisible(),true);
    await page.locator('[data-act="vi-tstop"]').evaluate(el=>el.scrollIntoView({block:'center'}));
    await page.screenshot({path:'temples-mobile.png',fullPage:true});
    await page.click('[data-act="vi-tstop"]');
    assert.equal(await page.evaluate(()=>DX.E.templeRun(DX.S)),null);
    assert.deepEqual(errors,[]);console.log('ok - interface temples PC et mobile, progression, arrêt, aucun accès serveur');
  } finally {if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
