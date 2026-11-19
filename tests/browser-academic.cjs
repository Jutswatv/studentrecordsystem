/* Isolated end-to-end checks. Never touches the real GitHub Pages browser data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.tmpdir(), 'lnvs-browser-qa/node_modules/playwright'));
const root = path.resolve(__dirname, '../docs');
const errors = [];
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (file === root) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
async function run() {
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const key='lnvs.studentrecords.browser.v1';
 const data=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).accounts[0].data,key);
 const open=async hash=>{await page.goto(url+'#'+hash);await page.waitForTimeout(80);};
 const ok=async()=>{await page.locator('#notification[open]').waitFor();await page.locator('#notification button[value="yes"]').click();};
 async function save(kind,values={},message='Changes saved') {const form=page.locator(`form[data-form="academic-${kind}"]`).first();for(const [k,v] of Object.entries(values)){const el=form.locator(`[name="${k}"]`);if(await el.evaluate(el=>el.tagName==='SELECT'))await el.selectOption(String(v));else await el.fill(String(v));}await form.locator('button').last().click();await page.locator('#notification[open]').waitFor();assert((await page.locator('#notification').textContent()).includes(message),await page.locator('#notification').textContent());await ok();}
 async function login(username){await open('login');await page.locator('[name="username"]').fill(username);await page.locator('[name="password"]').fill('Test-password-123');await page.locator('form[data-form="login"] button:not([type="button"])').click();await ok();}
 try {
  await open('signup');await page.locator('[name="username"]').fill('localadmin');await page.locator('[name="password"]').fill('Test-password-123');await page.locator('[name="confirm"]').fill('Test-password-123');await page.locator('form[data-form="setup"] button:not([type="button"])').click();await ok();
  await open('register');const form=page.locator('form[data-form="student"]');for(const [k,v] of Object.entries({lrn:'123456789012',first_name:'Alex',last_name:'Test',birth_date:'2008-01-01',section:'A',school_year:'2026-2027'}))await form.locator(`[name="${k}"]`).fill(v);await form.locator('[name="sex"]').selectOption('Female');await form.locator('[name="strand"]').selectOption('STEM');await form.locator('button').click();await ok();
  await open('academic');assert.equal((await data()).academy.curriculum.length,0,'New workspace must not inherit hardcoded subjects');
  await save('curriculum',{name:'Calculus',strand:'STEM',school_year:'2026-2027',grade_level:12,semester:1,periods:2});
  let state=await data();const sid=state.students[0].id,eid=state.academy.enrollments[0].id,cid=state.academy.curriculum[0].id;
  await open('academic?enrollment='+encodeURIComponent(eid));await save('grade',{p0:70,p1:85});
  assert.deepEqual((await data()).academy.grades[eid][cid],[70,85]);
  await save('grade',{p0:80,p1:85},'reason is required');assert.equal((await data()).academy.grades[eid][cid][0],70);
  await save('grade',{p0:80,p1:85,reason:'Verified source'});
  await save('enroll',{student_id:sid,strand:'STEM',school_year:'2026-2027',grade_level:12,semester:2,section:'B'});
  assert.equal((await data()).academy.enrollments.length,2);assert.equal((await data()).students.length,1);
  for(const role of ['teacher','adviser','student'])await save('member',{username:role+'test',password:'Test-password-123',role,student_id:sid});
  state=await data();await save('assign',{user_id:state.academy.members.find(m=>m.role==='teacher').id,enrollment_id:eid,subject_id:cid});
  await save('intervention',{note:'Review next week',status:'Open'});
  await save('issue');const ref=(await data()).academy.reports[0].reference;assert.equal(await page.locator('.local-report').count(),1);
  await open('academic?enrollment='+encodeURIComponent(eid));await save('grade',{p0:90,p1:90,reason:'New correction'});
  await open('academic?report='+ref);assert((await page.locator('.local-report').textContent()).includes('82.50'),'Issued report must remain frozen');
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.local-report').isVisible(),true);assert.equal(await page.locator('.content > .no-print').first().isVisible(),false);await page.emulateMedia({media:'screen'});
  fs.mkdirSync(path.join(__dirname,'../.artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../.artifacts/academic-browser-desktop.png'),fullPage:true});
  await login('teachertest');await open('academic?enrollment='+encodeURIComponent(eid));assert.equal(await page.locator('form[data-form="academic-curriculum"]').count(),0);assert.equal(await page.locator('form[data-form="academic-grade"]').count(),1);await save('grade',{p0:72,p1:84,reason:'Teacher source record'});
  await login('studenttest');await open('academic?enrollment='+encodeURIComponent(eid));assert.equal(await page.locator('form[data-form="academic-grade"]').count(),0);await save('request',{subject_id:cid,period:1,proposed:80,reason:'Please check original'});
  await login('localadmin');await open('academic');await save('review',{decision:'Approved'});assert.equal((await data()).academy.grades[eid][cid][0],80);
  // Failed file imports must never save valid preceding rows.
  let f=page.locator('form[data-form="academic-import"]');await f.locator('[name="kind"]').selectOption('grades');await f.locator('[name="verified"]').check();await f.locator('[name="csv"]').setInputFiles({name:'grades.csv',mimeType:'text/csv',buffer:Buffer.from(`enrollment_id,subject_id,p1,p2,p3,p4,reason\n${eid},${cid},99,99,,,verified\n${eid},bad,100,100,,,bad\n`.replaceAll('\\n','\n'))});await f.locator('button').click();await page.locator('#notification[open]').waitFor();assert((await page.locator('#notification').textContent()).includes('No rows were saved'));await ok();assert.equal((await data()).academy.grades[eid][cid][0],80);
  // Full backup/restore retains the academic archive and local members.
  await open('settings');const dl=page.waitForEvent('download');await page.locator('[data-action="backup"]').click();const download=await dl;const file=path.join(__dirname,'../.artifacts/academic-test-backup.json');await download.saveAs(file);await ok();const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.academy.reports.length,1);assert.equal(saved.academy.members.length,3);
  await page.locator('form[data-form="restore"] input[type="file"]').setInputFiles(file);await page.locator('form[data-form="restore"] button').click();await page.locator('#notification button[value="yes"]').click();await ok();await login('localadmin');assert.equal((await data()).academy.reports.length,1);
  await open('academic?enrollment='+encodeURIComponent(eid));await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'../.artifacts/academic-browser-mobile.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page must not overflow horizontally');
  const legacyContext=await browser.newContext(),legacyPage=await legacyContext.newPage();await legacyPage.goto(url);
  const legacy=structuredClone(saved);delete legacy.academy;legacy.grades[sid]={'Legacy Subject':[74.99,75,80,null]};
  await legacyPage.evaluate(({key,legacy})=>localStorage.setItem(key,JSON.stringify(legacy)),{key,legacy});await legacyPage.reload();
  await legacyPage.locator('[name="username"]').fill('localadmin');await legacyPage.locator('[name="password"]').fill('Test-password-123');await legacyPage.locator('form[data-form="login"] button:not([type="button"])').click();await legacyPage.locator('#notification[open]').waitFor();await legacyPage.locator('#notification button[value="yes"]').click();
  await legacyPage.goto(url+'#academic');await legacyPage.locator('form[data-form="academic-curriculum"]').waitFor();
  assert((await legacyPage.locator('body').textContent()).includes('Legacy Subject'));
  await legacyContext.close();
  assert.deepEqual(errors,[]);console.log('PASS: local curriculum, scoped grades, correction reasons, enrollment history, role login and assignment, interventions, frozen reports, print layout, correction review, atomic imports, full backup/restore, mobile render, no runtime errors');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
