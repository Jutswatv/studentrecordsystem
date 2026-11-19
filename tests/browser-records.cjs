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
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({acceptDownloads:true,viewport:{width:1708,height:921}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const key='lnvs.studentrecords.browser.v1',open=async hash=>{await page.goto(url+'#'+hash);await page.waitForTimeout(60);},ok=async()=>{await page.locator('#notification[open]').waitFor();await page.locator('#notification button[value="yes"]').click();};
 try{
  fs.mkdirSync(path.join(__dirname,'../.artifacts'),{recursive:true});
  await open('signup');for(const [k,v] of Object.entries({username:'recordsadmin',password:'Test-password-123',confirm:'Test-password-123'}))await page.locator(`[name="${k}"]`).fill(v);await page.locator('form[data-form="setup"] button:not([type="button"])').click();await ok();
  await page.evaluate(key=>{const store=JSON.parse(localStorage.getItem(key)),data=store.accounts[0].data,a=data.academy={version:1,enrollments:[],curriculum:[],grades:{},audit:[],requests:[],interventions:[],reports:[],members:[]};for(const strand of ['STEM','TVL'])a.curriculum.push({id:crypto.randomUUID(),name:'Mathematics',school_year:'2026-2027',strand,grade_level:12,semester:1,periods:2});for(let i=0;i<12;i++){const s={id:crypto.randomUUID(),lrn:String(123456789000+i),first_name:'Learner '+String(i).padStart(2,'0'),last_name:'Record',middle_name:'',sex:i%2?'Male':'Female',birth_date:'2008-01-01',strand:i<6?'STEM':'TVL',section:i<6?'A':'B',school_year:'2026-2027',email:'',phone:'',address:'',guardian:'',guardian_phone:'',created_at:new Date().toISOString()};data.students.push(s);const e={id:crypto.randomUUID(),student_id:s.id,strand:s.strand,section:s.section,school_year:s.school_year,grade_level:12,semester:1,created_at:s.created_at};a.enrollments.push(e);if(i===0){const c=a.curriculum[0];a.grades[e.id]={[c.id]:[80,90]};const old={...e,id:crypto.randomUUID(),school_year:'2025-2026',section:'Old'};a.enrollments.push(old);const oldc={...c,id:crypto.randomUUID(),school_year:'2025-2026'};a.curriculum.push(oldc);a.grades[old.id]={[oldc.id]:[70,80]};}}localStorage.setItem(key,JSON.stringify(store));},key);
  await open('students');const visibleRows=()=>page.locator('.records-list tbody tr');
  assert.equal(await page.locator('.record-metric').count(),5);assert.equal(await visibleRows().count(),10);assert.equal(await page.locator('.record-metric strong').first().textContent(),'12');assert.equal(await page.locator('.record-metric strong').nth(1).textContent(),'6');assert.equal(await page.locator('.record-metric strong').nth(2).textContent(),'6');assert.equal(await page.locator('.records-list tbody .record-average').first().textContent(),'85.00');
  await page.getByRole('button',{name:'Next page'}).click();assert.equal(await visibleRows().count(),2);assert((await page.locator('.records-list-footer').textContent()).includes('Showing 11 to 12 of 12 students'));
  await page.getByRole('button',{name:'Previous page'}).click();await page.locator('[data-record-select]').first().check();assert.equal(await page.locator('[data-action="records-export"]').textContent(),'Export Selected (1)');
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="records-export"]').click();const download=await downloadPromise;const file=path.join(__dirname,'../.artifacts/records-selected.csv');await download.saveAs(file);await ok();assert.equal(fs.readFileSync(file,'utf8').trim().split('\r\n').length,2);assert(fs.readFileSync(file,'utf8').includes('123456789000'));
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.records-print-only').isVisible(),true);assert.equal(await page.locator('.records-list').isVisible(),false);assert.equal(await page.locator('.records-print-only tbody tr').count(),1);await page.emulateMedia({media:'screen'});
  await page.locator('[data-action="reset-filters"]').click();await page.locator('.records-toolbar [name="year"]').selectOption('2025-2026');assert.equal(await visibleRows().count(),1);assert.equal(await page.locator('.record-average').first().textContent(),'75.00');assert((await page.locator('.records-list tbody').textContent()).includes('Old'));
  await page.locator('[data-action="reset-filters"]').click();await page.locator('.records-toolbar [name="strand"]').selectOption('TVL');assert.equal(await visibleRows().count(),6);assert.equal(await page.locator('.record-metric strong').first().textContent(),'6');await page.locator('.records-toolbar [name="section"]').selectOption('B');assert.equal(await visibleRows().count(),6);await page.locator('.records-toolbar [name="strand"]').selectOption('STEM');assert.equal(await page.locator('.records-toolbar [name="section"]').inputValue(),'');assert.equal(await visibleRows().count(),6);
  await page.getByRole('textbox',{name:'Search students'}).fill('nonexistent');await page.waitForFunction(()=>document.querySelector('.records-list tbody').textContent.includes('No students found'));assert.equal(await page.locator('.record-metric strong').first().textContent(),'0');
  await page.locator('[data-action="reset-filters"]').click();await page.getByRole('textbox',{name:'Search students'}).fill('Learner 00');await page.waitForFunction(()=>document.querySelector('.records-list-footer').textContent.includes('of 1 student'));
  assert.equal(await page.locator('.records-hero-art').evaluate(el=>el.complete&&el.naturalWidth>0),true);
  await page.screenshot({path:path.join(__dirname,'../.artifacts/student-records-desktop.png'),fullPage:true});
  await page.locator('.view-action').first().click();await page.locator('.profile').waitFor();assert((await page.locator('.profile').textContent()).includes('Learner 00'));await open('students');await page.locator('.edit-action').first().click();await page.locator('form[data-form="student"]').waitFor();assert.equal(await page.locator('[name="first_name"]').inputValue(),'Learner 00');await open('students');await page.locator('.delete-action').first().click();await page.locator('#notification[open]').waitFor();assert((await page.locator('#notification').textContent()).includes('history must be retained'));await ok();
  for(const [text,route] of [['Add Student','register'],['Bulk Import','reports'],['Generate Report','report-cards']]){await page.locator('.records-quick').getByRole('link',{name:text,exact:true}).click();assert(new URL(page.url()).hash.startsWith('#'+route));await open('students');}
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Student records page must fit phone width');await page.screenshot({path:path.join(__dirname,'../.artifacts/student-records-mobile.png'),fullPage:true});
  await page.locator('[data-action="reset-filters"]').click();await page.setViewportSize({width:1100,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Student records page must fit tablet width');
  assert.deepEqual(errors,[]);console.log('PASS: student-record metrics, current/historical enrollment averages, pagination, live search, combined filters/reset, selected CSV export, selected print list, view/edit links, history protection, quick actions, hero asset, phone/tablet layouts');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
