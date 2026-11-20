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
 const data=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).accounts[0].data,key);
 async function submit(kind,values={},message='Curriculum saved'){const form=page.locator(`form[data-form="${kind}"]`).first();for(const [k,v] of Object.entries(values)){const el=form.locator(`[name="${k}"]`);if(await el.evaluate(el=>el.tagName==='SELECT'))await el.selectOption(String(v));else await el.fill(String(v));}await form.locator('button:not([type="button"])').last().click();await page.locator('#notification[open]').waitFor();assert((await page.locator('#notification').textContent()).includes(message),await page.locator('#notification').textContent());await ok();}
 async function archive(id,kind='subject',message='Record archived'){await page.locator(`[data-action="curriculum-archive"][data-kind="${kind}"][data-id="${id}"]`).click();await page.locator('#notification button[value="yes"]').click();await page.locator('#notification[open]').waitFor();assert((await page.locator('#notification').textContent()).includes(message));await ok();}
 try{
  fs.mkdirSync(path.join(__dirname,'../.artifacts'),{recursive:true});await open('signup');for(const [k,v] of Object.entries({username:'curriculumadmin',password:'Test-password-123',confirm:'Test-password-123'}))await page.locator(`[name="${k}"]`).fill(v);await page.locator('form[data-form="setup"] button:not([type="button"])').click();await ok();
  await open('curriculum');assert.deepEqual(await page.locator('.curriculum-metrics strong').allTextContents(),['0','0','0','0','0']);assert.equal(await page.locator('.curriculum-tabs [role="tab"]').count(),4);
  for(const name of ['Senior High School','Academic Track','TVL Track']){await open('curriculum?mode=add-group');await submit('curriculum-save',{name,description:'Fictional test curriculum',school_year:'2026-2027',grade_level:'12'});}
  const group=(await data()).academy.curricula[0].id;
  for(let i=0;i<7;i++){await open('curriculum?tab=subjects&mode=add-subject');await submit('curriculum-save',{name:'Subject '+String(i+1).padStart(2,'0'),code:'TVL '+String(i+1).padStart(3,'0'),type:i<4?'Core':i<6?'Applied':'Specialized',units:i===6?'4':'2',periods:'2',school_year:'2026-2027',grade_level:'12',strand:'TVL',semester:'1',curriculum_id:group});}
  await open('curriculum');assert.deepEqual(await page.locator('.curriculum-metrics strong').allTextContents(),['7','4','2','1','1']);assert.equal(await page.locator('.curriculum-groups tbody tr').count(),3);assert.equal(await page.locator('.curriculum-subjects tbody tr').count(),7);
  await page.locator('.curriculum-filters [name="year"]').selectOption('2026-2027');await page.locator('.curriculum-filters [name="strand"]').selectOption('STEM');assert.equal(await page.locator('.curriculum-metrics strong').first().textContent(),'0');await page.locator('.curriculum-filters [name="strand"]').selectOption('TVL');assert.equal(await page.locator('.curriculum-metrics strong').first().textContent(),'7');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'../.artifacts/curriculum-desktop.png'),fullPage:true});
  let state=await data();const cid=state.academy.curriculum[0].id,unused=state.academy.curriculum[6].id;
  await open('curriculum?tab=subjects');await archive(unused);assert.equal((await data()).academy.curriculum.find(c=>c.id===unused).active,false);await page.locator(`[data-action="curriculum-restore"][data-id="${unused}"]`).click();await ok();assert.equal((await data()).academy.curriculum.find(c=>c.id===unused).active,true);
  await open('curriculum?tab=subjects&mode=view-subject&id='+cid);assert((await page.locator('.curriculum-editor').textContent()).includes('Subject 01'));
  await open('curriculum?tab=subjects&mode=edit-subject&id='+cid);await submit('curriculum-save',{name:'Subject 01 Revised',reason:'Approved title correction'});assert.equal((await data()).academy.curriculum.find(c=>c.id===cid).name,'Subject 01 Revised');
  await open('curriculum?tab=subjects&mode=add-subject');await submit('curriculum-save',{name:'Subject 01 Revised',code:'TVL 099',type:'Core',units:'2',periods:'2',school_year:'2026-2027',grade_level:'12',strand:'TVL',semester:'1',curriculum_id:group},'already exists');assert.equal((await data()).academy.curriculum.length,7);
  for(let i=0;i<2;i++){await open('register');const form=page.locator('form[data-form="student"]');for(const [k,v] of Object.entries({lrn:String(123456789000+i),first_name:'Learner '+i,last_name:'Sample',birth_date:'2008-01-01',section:'A',school_year:'2026-2027'}))await form.locator(`[name="${k}"]`).fill(v);await form.locator('[name="sex"]').selectOption('Female');await form.locator('[name="strand"]').selectOption('TVL');await form.locator('button').click();await ok();}
  await open('teachers');await submit('academic-member',{username:'curriculumteacher',password:'Test-password-123',role:'teacher'},'Changes saved');state=await data();const teacher=state.academy.members[0].id,enrollments=state.academy.enrollments.map(e=>e.id);
  for(const eid of enrollments){await open('curriculum?tab=assignments');await submit('academic-assign',{user_id:teacher,enrollment_id:eid,subject_id:cid},'Changes saved');}
  await open('curriculum?tab=load');assert.equal(await page.locator('.curriculum-load tbody tr').count(),1);assert.equal(await page.locator('.curriculum-load tbody td').nth(1).textContent(),'1');assert.equal(await page.locator('.curriculum-load tbody td').nth(3).textContent(),'2');
  await open('curriculum?tab=settings');await submit('curriculum-settings',{default_units:'3',default_periods:'4',max_load:'1'});await open('curriculum?tab=load');assert((await page.locator('.curriculum-load tbody').textContent()).includes('Review load'));
  await open('curriculum?tab=subjects&mode=add-subject');assert.equal(await page.locator('form[data-form="curriculum-save"] [name="units"]').inputValue(),'3');assert.equal(await page.locator('form[data-form="curriculum-save"] [name="periods"]').inputValue(),'4');
  await open('grades?enrollment='+encodeURIComponent(enrollments[0]));await submit('academic-grade',{p0:'80',p1:'90',reason:'Verified source'},'Changes saved');
  await open('curriculum?tab=subjects');await archive(cid,'subject','must be retained');assert.deepEqual((await data()).academy.grades[enrollments[0]][cid],[80,90]);
  await open('curriculum?tab=subjects&mode=edit-subject&id='+cid);await submit('curriculum-save',{periods:'4',reason:'Requested period change'},'cannot change');assert.equal((await data()).academy.curriculum.find(c=>c.id===cid).periods,2);
  await open('curriculum?tab=strands');const strandsForm=page.locator('form[data-form="curriculum-strands"]').first();await strandsForm.locator('[name="strands"][value="TVL"]').uncheck();await submit('curriculum-strands',{reason:'Attempt removal'},'Linked subjects');assert((await data()).academy.curricula[0].strands.includes('TVL'));
  await open('settings');const downloaded=page.waitForEvent('download');await page.locator('[data-action="backup"]').click();const backup=await downloaded,file=path.join(__dirname,'../.artifacts/curriculum-backup.json');await backup.saveAs(file);await ok();const saved=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(saved.academy.curricula.length,3);assert.equal(saved.academy.subjectSettings.max_load,1);await page.locator('form[data-form="restore"] input[type=file]').setInputFiles(file);await page.locator('form[data-form="restore"] button').click();await page.locator('#notification button[value="yes"]').click();await ok();await page.locator('[name="username"]').fill('curriculumadmin');await page.locator('[name="password"]').fill('Test-password-123');await page.locator('form[data-form="login"] button:not([type="button"])').click();await ok();assert.deepEqual((await data()).academy.grades[enrollments[0]][cid],[80,90]);
  await open('curriculum');await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Curriculum page must fit phone width');await page.screenshot({path:path.join(__dirname,'../.artifacts/curriculum-mobile.png'),fullPage:true});await page.setViewportSize({width:1100,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Curriculum page must fit tablet width');
  await open('curriculum?tab=assignments');await page.locator('[data-action="curriculum-unassign"]').first().click();await page.locator('#notification button[value="yes"]').click();await ok();assert.equal((await data()).academy.members[0].assignments.length,1);assert.deepEqual(errors,[]);console.log('PASS: curriculum/group creation, subject metadata and filtering, four tabs, duplicate rejection, audit corrections, archive/restore, teacher assignments, deduplicated subject load, configurable defaults, grade/strand-history protection, backup/restore, mobile/tablet layouts');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
