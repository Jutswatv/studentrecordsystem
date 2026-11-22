'use strict';
(() => {
  const KEY = 'lnvs.studentrecords.browser.v1';
  const SESSION = KEY + '.session';
  const ACTIVE = KEY + '.active-account';
  const STRANDS = ['STEM', 'ABM', 'HUMSS', 'GAS', 'TVL'];
  const SUBJECTS = ['Contemporary Philippine Arts', 'Media and Information Literacy', 'Physical Education and Health', 'Practical Research 2', 'English for Academic Purposes', 'Entrepreneurship', 'Work Immersion'];
  const FIELDS = ['lrn','first_name','last_name','middle_name','sex','birth_date','strand','section','school_year','email','phone','address','guardian','guardian_phone'];
  const app = document.querySelector('#app');
  const dialog = document.querySelector('#notification');
  let filters = {search:'', strand:'', year:''};
  let busy = false;
  let overviewYear = '';
  let recordsPage=1;
  const recordsSelection=new Set();
  let searchTimer;
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blank = () => ({version:1, admin:null, students:[], grades:{}});
  const num = value => value === null ? '—' : Number(value).toFixed(2);
  const fullName = s => `${s.last_name}, ${s.first_name}${s.middle_name ? ' '+s.middle_name : ''}`;
  const academic=createAcademicWorkspace({h,input,select,STRANDS,LEGACY:SUBJECTS,makeAdmin,validateStudent,FIELDS});
  const enrollmentPage=createEnrollmentPage({h,icon,input,select,STRANDS,academic,fullName});
  const curriculumPage=createCurriculumPage({h,icon,input,select,STRANDS,academic,fullName});
  const gradesPage=createGradesPage({h,icon,STRANDS,academic,fullName});
  const analyticsPage=createAnalyticsPage({h,icon,STRANDS,academic,fullName});
  const interventionsPage=createInterventionsPage({h,icon,STRANDS,academic,fullName,input});
  const reportCardsPage=createReportCardsPage({h,icon,STRANDS,academic,fullName});
  const schoolYearsPage=createSchoolYearsPage({h,icon,input,STRANDS,academic,fullName});
  const teachersPage=createTeachersPage({h,icon,input,STRANDS,academic,fullName,makeAdmin});
  const verificationPage=createVerificationPage({h,icon,input,STRANDS,academic,fullName});
  const identity=data=>academic.member(data,sessionStorage.getItem(SESSION));
  function readStore() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {version:2, accounts:[]};
    const store = JSON.parse(raw);
    const valid = data => data && data.version===1 && data.admin && typeof data.admin.username==='string' && typeof data.admin.hash==='string' && Array.isArray(data.students) && data.grades && typeof data.grades==='object';
    // Older single-account workspaces remain readable without changing their data.
    if (store.version===1 && valid(store)) return {version:2, accounts:[{id:'legacy', data:store}]};
    if (store.version!==2 || !Array.isArray(store.accounts) || store.accounts.some(account=>!account || typeof account.id!=='string' || !valid(account.data))) throw new Error('Your browser data could not be read. Do not clear storage. Restore a backup from another browser profile if needed.');
    return store;
  }
  function currentAccount(store) {
    const id=sessionStorage.getItem(ACTIVE);
    return store.accounts.find(account=>account.id===id) || (!id ? store.accounts.find(account=>account.data.admin.hash===sessionStorage.getItem(SESSION)) : null);
  }
  function read() {
    const store=readStore();
    return academic.normalize((currentAccount(store)||store.accounts[0])?.data || blank());
  }
  function saveStore(store) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (_) { throw new Error('Unable to save in this browser. Storage may be full or disabled. Export a backup and free some browser storage before trying again.'); }
  }
  function write(data) {
    const store=readStore(), account=currentAccount(store);
    if(!account || !academic.member(account.data,sessionStorage.getItem(SESSION))) throw new Error('Please sign in before saving changes.');
    if(store.accounts.some(other=>other.id!==account.id && [other.data.admin,...(other.data.academy?.members||[])].some(m=>[data.admin,...(data.academy?.members||[])].some(n=>m.username.toLowerCase()===n.username.toLowerCase())))) throw new Error('Another local account already uses the username in this backup. Sign in to that account before restoring it.');
    account.data=data;
    saveStore(store);
    sessionStorage.setItem(ACTIVE,account.id);
  }
  function logged(data) {
    return !!data.admin && !!currentAccount(readStore()) && !!identity(data);
  }
  function route() {
    const [name='dashboard', query=''] = location.hash.slice(1).split('?');
    return {name:name || 'dashboard', params:new URLSearchParams(query)};
  }
  function go(name) {
    if (location.hash === '#'+name) render();
    else location.hash = name;
  }
  function schoolBrand() {
    return '<img class="school-logo" src="assets/school-logo.png" alt="Libertad National Vocational School logo" width="56" height="56"><span class="school-name">Libertad National Vocational School<small>GRADE 12 STUDENT RECORDS</small></span>';
  }
  function popup(title, message, type='success', confirm=false, yes='OK, got it', no='Cancel') {
    return new Promise(resolve => {
      if (dialog.open) dialog.close();
      dialog.className = `feedback-dialog app-dialog feedback-${type}`;
      dialog.innerHTML = `<div class="feedback-icon" aria-hidden="true">${type==='success'?'&#10003;':type==='warning'?'?':'!'}</div><span class="eyebrow">${confirm?'PLEASE CONFIRM':type==='success'?'ALL DONE':'PLEASE NOTE'}</span><h2 id="notification-title">${h(title)}</h2><p id="notification-message">${h(message)}</p><form method="dialog" class="dialog-actions">${confirm?`<button class="button secondary" value="no" autofocus>${h(no)}</button>`:''}<button class="button" value="yes" ${confirm?'':'autofocus'}>${h(yes)}</button></form>`;
      dialog.returnValue = '';
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), {once:true});
      dialog.showModal();
    });
  }
  function average(values) {
    return Array.isArray(values) && values.length===4 && values.every(v => typeof v==='number' && Number.isFinite(v)) ? values.reduce((a,b)=>a+b,0)/4 : null;
  }
  function studentAverages(data, id) {
    const rows = data.grades[id] || {};
    return SUBJECTS.map(subject => average(rows[subject]));
  }
  function completeAverages(data) {
    return data.academy.enrollments.flatMap(e=>academic.rows(data,{role:'admin'},e).map(r=>r.average)).filter(v=>v!==null);
  }
  function generalAverage(data, id) {
    const a=studentAverages(data,id);
    return a.every(v=>v!==null) ? a.reduce((x,y)=>x+y,0)/a.length : null;
  }
  function sorted(students) {
    return [...students].sort((a,b)=>fullName(a).localeCompare(fullName(b)));
  }
  function recordEnrollment(data,s) {
    return data.academy.enrollments.filter(e=>e.student_id===s.id&&(!filters.year||e.school_year===filters.year)&&(!filters.strand||e.strand===filters.strand)&&(!filters.section||e.section===filters.section)).sort((a,b)=>b.school_year.localeCompare(a.school_year)||b.grade_level-a.grade_level||b.semester-a.semester||b.created_at.localeCompare(a.created_at))[0];
  }
  function filtered(data) {
    const term=filters.search.toLowerCase().trim(),rows=[];
    for(const s of data.students) {const e=recordEnrollment(data,s);if(!e)continue;const row={...s,strand:e.strand,section:e.section,school_year:e.school_year,_enrollment:e.id};if(!term||`${s.first_name} ${s.last_name} ${s.middle_name} ${s.lrn} ${s.id} ${e.section}`.toLowerCase().includes(term))rows.push(row);}
    return sorted(rows);
  }
  function input(label, name, value='', type='text', required=false, extra='') {
    if(type==='password') {
      const id='password-'+name;
      return `<div class="password-field"><label for="${h(id)}">${h(label)}${required?' *':''}</label><div class="password-control"><input id="${h(id)}" data-password-input type="password" name="${h(name)}" value="${h(value)}" ${required?'required':''} ${extra} maxlength="500"><button type="button" class="password-toggle" data-action="toggle-password" data-label="${h(label.toLowerCase())}" aria-controls="${h(id)}" aria-label="Show ${h(label.toLowerCase())}" aria-pressed="false" title="Show ${h(label.toLowerCase())}">${passwordIcon(false)}</button></div></div>`;
    }
    return `<label>${h(label)}${required?' *':''}<input type="${type}" name="${h(name)}" value="${h(value)}" ${required?'required':''} ${extra} maxlength="500"></label>`;
  }
  function passwordIcon(visible) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible?'<path d="m3 3 18 18"/>':''}</svg>`;
  }
  function select(label,name,options,value='',all='Select an option',required=false) {
    return `<label>${h(label)}${required?' *':''}<select name="${h(name)}" ${required?'required':''}><option value="">${h(all)}</option>${options.map(v=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(v)}</option>`).join('')}</select></label>`;
  }
  function auth(data) {
    const setup=route().name==='signup';
    document.title=(setup?'Create account':'Login')+' | LNVS';
    app.innerHTML=`<main class="auth"><div class="brand">${schoolBrand()}</div><section class="card"><div class="auth-tabs" aria-label="Account access"><a href="#login" class="${setup?'':'active'}" ${setup?'':'aria-current="page"'}>Login</a><a href="#signup" class="${setup?'active':''}" ${setup?'aria-current="page"':''}>Create account</a></div><span class="eyebrow">BROWSER WORKSPACE</span><h1>${setup?'Create your account':'Welcome back'}</h1><p class="muted">${setup?'Create a local account with its own student records and grades.':'Log in to your saved account on this browser.'}</p><form data-form="${setup?'setup':'login'}">${input('Username','username','','text',true,'autocomplete="username" minlength="3" maxlength="50"')}${input('Password','password','','password',true,`${setup?'minlength="12"':''} autocomplete="${setup?'new-password':'current-password'}"`)}${setup?input('Confirm password','confirm','','password',true,'minlength="12" autocomplete="new-password"'):''}<button class="button wide">${setup?'Create account':'Login'} &rarr;</button></form><p class="auth-prompt">${setup?'Already have an account? <a href="#login">Login</a>':'New here? <a href="#signup">Create an account</a>'}</p>${logged(data)?'<p class="auth-prompt"><a href="#dashboard">Back to your workspace</a></p>':''}<p class="local-note"><b>Accounts stay on this browser.</b> Each administrator has a separate workspace. Assigned teacher, adviser and student accounts open that workspace through local role controls. Local login is a convenience lock, not server security; records are not encrypted. Export backups regularly.</p></section><p class="muted center">Your records are never sent to GitHub or a database server.</p></main>`;
  }
  function icon(name) {
    const paths={
      dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
      students:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/><path d="M4 11a3 3 0 0 0-1 5m17-5a3 3 0 0 1 1 5"/>',
      enrollment:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7v10m-5-5h10"/>',
      curriculum:'<path d="M12 5C9 2 5 2 2 4v15c3-2 7-2 10 1 3-3 7-3 10-1V4c-3-2-7-2-10 1Zm0 0v15"/>',
      grades:'<rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
      analytics:'<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>',
      interventions:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
      'report-cards':'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8m-8 5h8m-8 5h4"/>',
      'school-years':'<path d="m12 2 10 5-10 5L2 7Zm-10 10 10 5 10-5M2 17l10 5 10-5"/>',
      teachers:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2Zm15-17a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
      verification:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-5 10 3 3 7-7"/>',
      logs:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>',
      reports:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
      settings:'<path d="m9 3-1 3-3 1-2 4 2 3v4l4 2 3-1 4 1 3-3v-4l2-3-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
      home:'<path d="m3 10 9-8 9 8M5 9v12h14V9m-10 12v-8h6v8"/>',
      register:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 10-6m7 0v8m-4-4h8"/>',
      graduation:'<path d="m2 8 10-5 10 5-10 5Zm4 3v6c4 3 8 3 12 0v-6m4-3v9"/>',
      check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      cross:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
      plus:'<path d="M12 4v16M4 12h16"/>',
      mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
      trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v5m-4 3h8m-8-3h8"/>',
      bulb:'<path d="M9 18h6m-6 3h6m-3-19V0M4 5 2 3m18 2 2-2M2 12H0m24 0h-2m-16 0a6 6 0 1 1 12 0c0 3-3 4-3 6H9c0-2-3-3-3-6Z"/>',
      distribution:'<path d="M3 21V8h18v13Zm5-13V3h8v5M7 17v-3m5 3v-6m5 6v-3"/>',
      save:'<path d="M3 3h15l3 3v15H3Zm4 0v7h10V3M7 21v-7h10v7"/>',
      warning:'<path d="m12 3 10 18H2Zm0 6v5m0 3h.01"/>',
      information:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
      clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/>',
      calendar:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-14 4h3"/>',
      search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
      male:'<circle cx="9" cy="15" r="6"/><path d="m13 11 8-8m-6 0h6v6"/>',
      female:'<circle cx="12" cy="8" r="6"/><path d="M12 14v8m-4-4h8"/>',
      reset:'<path d="M4 4v6h6M4 10a8 8 0 1 1 0 6"/>',
      upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',
      print:'<path d="M6 8V2h12v6M6 18H3V8h18v10h-3M6 14h12v8H6Zm11-3h1"/>',
      eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      edit:'<path d="m15 3 6 6M3 21l5-1L21 7a3 3 0 0 0-4-4L4 16Z"/>',
      delete:'<path d="M3 6h18M9 6V2h6v4M5 6l1 16h12l1-16M10 10v8m4-8v8"/>',
      bolt:'<path d="M13 2 4 14h7l-1 8 10-13h-7Z"/>',
      database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
      logout:'<path d="M10 3H3v18h7m4-15 6 6-6 6m-7-6h13"/>'
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.dashboard}</svg>`;
  }
  function layout(data,title,active,body,action='') {
    const allNav=[['dashboard','&#9707;','Dashboard'],['students','&#9636;','Student Records'],['enrollment','&#65291;','Enrollment'],['curriculum','&#9637;','Curriculum & Subjects'],['grades','&#9638;','Grade Management'],['analytics','&#8599;','Performance Analytics'],['interventions','&#9825;','Academic Interventions'],['report-cards','&#9706;','Report Cards'],['school-years','&#9635;','School Years & Sections'],['teachers','&#9817;','Teachers & Advisers'],['verification','&#10003;','Record Verification'],['logs','&#9719;','Activity Logs'],['reports','&#8659;','Reports & Exports'],['settings','&#9881;','System Settings']];
    const iconForNav=key=>icon(key);
    const user=identity(data), nav=allNav.filter(([key])=>user.role==='admin'||['grades','analytics','interventions','report-cards','school-years','verification'].includes(key));
    document.title=title+' | LNVS Student Records';
    app.innerHTML=`<aside class="sidebar premium-sidebar"><a class="brand" href="#dashboard">${schoolBrand()}</a><span class="nav-label">LOCAL WORKSPACE</span><nav>${nav.map(([key,icon,label])=>`<a class="${active===key?'active':''}" ${active===key?'aria-current="page"':''} href="#${key}"><span class="nav-icon">${iconForNav(key)}</span>${label}</a>`).join('')}</nav><div class="sidebar-bottom"><button class="logout" data-action="logout">${icon('logout')} Sign out</button><div class="admin"><b>${h(user.username.slice(0,1).toUpperCase())}</b><span>${h(user.username)}<small>${h(user.role==='admin'?'Local administrator':user.role)}</small></span></div></div></aside><main class="main app-main"><header class="topbar"><span class="breadcrumb">${icon('home')}<span>Browser workspace / <b>${h(title)}</b></span></span><span class="badge">Grade 12</span></header><div class="content ${active==='dashboard'?'dashboard-content':active==='students'?'records-content':active==='enrollment'?'enrollment-content':active==='curriculum'?'curriculum-content':active==='grades'?'grades-content':active==='analytics'?'analytics-content':active==='interventions'?'analytics-content intervention-content':active==='report-cards'?'analytics-content report-content':active==='school-years'?'analytics-content school-content':active==='teachers'?'analytics-content school-content staff-content':active==='verification'?'analytics-content school-content verification-content':''}"><div class="page-heading ${active==='dashboard'?'dashboard-hero':active==='students'?'records-hero':active==='enrollment'?'enrollment-hero':active==='curriculum'?'curriculum-hero':active==='grades'?'grades-hero':active==='analytics'?'analytics-hero':active==='interventions'?'analytics-hero intervention-hero':active==='report-cards'?'analytics-hero report-hero':active==='school-years'?'analytics-hero school-hero':active==='teachers'?'analytics-hero staff-hero':active==='verification'?'analytics-hero verification-hero':''}"><div><span class="eyebrow">${active==='enrollment'?'ENROLLMENT MANAGEMENT':active==='curriculum'?'CURRICULUM MANAGEMENT':active==='grades'?'GRADE MANAGEMENT':active==='analytics'?'PERFORMANCE ANALYTICS':active==='interventions'?'ACADEMIC INTERVENTIONS':active==='report-cards'?'REPORT CARD MANAGEMENT':active==='school-years'?'SCHOOL YEAR & SECTION MANAGEMENT':active==='teachers'?'TEACHERS & ADVISERS MANAGEMENT':active==='verification'?'RECORD VERIFICATION':'STUDENT RECORD MANAGEMENT'}</span><h1>${h(title)}</h1><p>${active==='students'?'Manage, view, update, and organize Grade 12 student information and academic records.':active==='enrollment'?'Manage student enrollment, sectioning, and academic registration for Grade 12.':active==='curriculum'?'Manage the curriculum, strands, and subject offerings for Grade 12.':active==='grades'?'Encode, compute, validate, and manage Grade 12 student grades per subject and grading period.':active==='analytics'?'Analyze student performance, grade trends, and academic standing for Grade 12.':active==='interventions'?'Identify, monitor, and support students who need academic assistance to improve their performance.':active==='report-cards'?'Generate, preview, and print Grade 12 report cards from saved grades and frozen academic records.':active==='school-years'?'Create, manage, and organize school years, strands, and sections for Grade 12.':active==='teachers'?'Manage teacher profiles, adviser assignments, and subject handling for Grade 12.':active==='verification'?'Review student records and supporting documents with saved sources and local review history.':'Libertad National Vocational School &middot; Your local Grade 12 workspace'}</p></div>${active==='students'?'<img class="records-hero-art" src="assets/student-records-hero.png" alt="" aria-hidden="true">':active==='enrollment'?'<img class="enrollment-hero-art" src="assets/enrollment-hero.png" alt="" aria-hidden="true">':active==='curriculum'?'<img class="curriculum-hero-art" src="assets/enrollment-hero.png" alt="" aria-hidden="true">':active==='grades'?'<img class="grades-hero-art" src="assets/enrollment-hero.png" alt="" aria-hidden="true"><span class="grades-hero-score" aria-hidden="true">A<sup>+</sup></span>':active==='analytics'?'<img class="analytics-hero-art" src="assets/analytics-hero.png" alt="" aria-hidden="true">':active==='interventions'?'<img class="intervention-hero-art" src="assets/enrollment-hero.png" alt="" aria-hidden="true">':active==='report-cards'?'<img class="report-hero-art" src="assets/enrollment-hero.png" alt="" aria-hidden="true">':active==='school-years'?'<img class="school-hero-art" src="assets/school-years-hero.svg" alt="" aria-hidden="true">':active==='teachers'?'<img class="staff-hero-art" src="assets/staff-hero.svg" alt="" aria-hidden="true">':active==='verification'?'<img class="verification-hero-art" src="assets/verification-hero.svg" alt="" aria-hidden="true">':action}${active==='dashboard'?'<span class="hero-dots" aria-hidden="true"></span>':''}</div>${body}<footer>LNVS Gradebook <span>Browser storage &middot; No server database</span></footer></div></main>`;
  }
  function table(students,grades=false) {
    if (!students.length) return '<div class="empty"><h3>No students found</h3><p>Register a student or adjust your filters.</p><a class="button secondary" href="#register">Register a student</a></div>';
    return `<div class="table-wrap"><table><thead><tr><th>Student name</th><th>LRN</th><th>Strand / Section</th><th>School year</th><th>Actions</th></tr></thead><tbody>${students.map(s=>`<tr><td><b>${h(fullName(s))}</b><small>${h(s.email)}</small></td><td>${h(s.lrn)}</td><td><span class="badge">${h(s.strand)}</span> ${h(s.section)}</td><td>${h(s.school_year)}</td><td class="actions"><a href="#${grades?'encode':'profile'}?id=${encodeURIComponent(s.id)}">${grades?'Encode grades':'View'}</a><a href="#edit?id=${encodeURIComponent(s.id)}">Edit</a><a class="danger" href="#profile?id=${encodeURIComponent(s.id)}" data-action="delete" data-id="${h(s.id)}">Delete</a></td></tr>`).join('')}</tbody></table></div>`;
  }
  function stats(data) {
    const averages=completeAverages(data),mean=averages.length?averages.reduce((a,b)=>a+b,0)/averages.length:null;
    const sections=new Set(data.academy.enrollments.map(e=>e.section)).size;
    return `<div class="stats dashboard-stats">${[['Total students',data.students.length,'Registered in Grade 12','students','teal'],['Active strands',new Set(data.students.map(s=>s.strand)).size,'Academic & career pathways','graduation','purple'],['Sections',sections,'Across all school years','dashboard','amber'],['Average grade',num(mean),'Completed subject averages','grades','blue']].map(([label,value,help,symbol,tone])=>`<article class="card stat metric-card tone-${tone}"><div class="metric-icon">${icon(symbol)}</div><div class="metric-content"><span class="metric-label">${h(label)}</span><strong>${h(value)}</strong><small>${h(help)}</small></div></article>`).join('')}</div>`;
  }
  function insights(data) {
    const enrollments=data.academy.enrollments.filter(e=>!overviewYear||e.school_year===overviewYear);
    const academicRows=enrollments.flatMap(e=>academic.rows(data,{role:'admin'},e));
    const averages=academicRows.map(r=>r.average).filter(v=>v!==null),passing=averages.filter(v=>v>=75).length;
    const years=[...new Set(data.academy.enrollments.map(e=>e.school_year))].sort().reverse();
    return `<div class="two-cols dashboard-panels"><section class="card distribution-card"><div class="card-heading"><h2>${icon('grades')}Strand distribution</h2><span class="badge">${data.students.length} ${data.students.length===1?'student':'students'}</span></div><div class="strand-rows">${STRANDS.map((strand,i)=>{const count=data.students.filter(s=>s.strand===strand).length,percent=data.students.length?Math.round(count/data.students.length*100):0;return `<div class="strand-row strand-${i}"><span class="strand-name"><i aria-hidden="true"></i>${h(strand)}</span><meter min="0" max="${Math.max(1,data.students.length)}" value="${count}" aria-label="${h(strand)} enrollment: ${count} students, ${percent}%">${count}</meter><span class="strand-count">${count} <small>(${percent}%)</small></span></div>`;}).join('')}</div></section><section class="card academic-overview"><div class="card-heading"><h2>${icon('school-years')}Academic overview</h2><select data-overview-year aria-label="Academic overview school year"><option value="">All years</option>${years.map(year=>`<option value="${h(year)}" ${year===overviewYear?'selected':''}>${h(year)}</option>`).join('')}</select></div><div class="overview-rows">${[['Completed subject grades',averages.length,'graduation','teal'],['Passing subjects (≥ 75)',passing,'check','teal'],['Below passing (< 75)',averages.length-passing,'cross','rose'],['Incomplete curriculum subjects',academicRows.length-averages.length,'report-cards','blue']].map(([label,value,symbol,tone])=>`<div class="overview-row"><span class="overview-icon tone-${tone}">${icon(symbol)}</span><span>${h(label)}</span><strong>${value}</strong></div>`).join('')}</div><a class="text-link overview-link" href="#analytics">View performance analytics ${icon('analytics')}</a></section></div>`;
  }
  function recordAverage(data,s) {
    const e=data.academy.enrollments.find(e=>e.id===s._enrollment),rs=e?academic.rows(data,{role:'admin'},e):[];
    return rs.length&&rs.every(r=>r.average!==null)?rs.reduce((sum,r)=>sum+r.average,0)/rs.length:null;
  }
  function recordsTable(data,rows,printing=false) {
    return `<div class="table-wrap records-table-wrap"><table class="records-table"><thead><tr>${printing?'':'<th class="record-check"><input type="checkbox" data-record-select-all aria-label="Select all students on this page" '+(rows.length&&rows.every(s=>recordsSelection.has(s.id))?'checked':'')+'></th>'}<th>LRN</th><th>Student Name</th><th>Sex</th><th>Strand</th><th>Section</th><th>School Year</th><th>General Average</th><th>Status</th>${printing?'':'<th>Actions</th>'}</tr></thead><tbody>${rows.map(s=>{const avg=recordAverage(data,s),status=data.academy.enrollments.find(e=>e.id===s._enrollment)?.status||'Enrolled';return `<tr>${printing?'':`<td class="record-check"><input type="checkbox" data-record-select="${h(s.id)}" aria-label="Select ${h(fullName(s))}" ${recordsSelection.has(s.id)?'checked':''}></td>`}<td class="lrn-cell">${h(s.lrn)}</td><td><div class="record-person"><span class="record-avatar" aria-hidden="true">${icon('students')}</span><b>${h(fullName(s))}</b></div></td><td><span class="record-sex ${s.sex==='Male'?'sex-male':'sex-female'}">${h(s.sex)}</span></td><td><span class="record-strand strand-${STRANDS.indexOf(s.strand)}">${h(s.strand)}</span></td><td>${h(s.section)}</td><td class="record-year">${h(s.school_year)}</td><td><span class="record-average ${avg===null?'average-missing':avg<75?'average-low':''}">${avg===null?'Incomplete':num(avg)}</span></td><td><span class="record-status status-${status==='Enrolled'?'enrolled':status==='Pending'?'pending':'not-enrolled'}">${icon(status==='Enrolled'?'check':status==='Pending'?'logs':'cross')}${h(status)}</span></td>${printing?'':`<td><div class="record-actions"><a class="record-action view-action" href="#profile?id=${encodeURIComponent(s.id)}" aria-label="View ${h(fullName(s))}" title="View student">${icon('eye')}</a><a class="record-action edit-action" href="#edit?id=${encodeURIComponent(s.id)}" aria-label="Edit ${h(fullName(s))}" title="Edit student">${icon('edit')}</a><button class="record-action delete-action" data-action="delete" data-id="${h(s.id)}" aria-label="Delete ${h(fullName(s))}" title="Delete student">${icon('delete')}</button></div></td>`}</tr>`;}).join('')||`<tr><td colspan="${printing?8:10}" class="empty"><h3>No students found</h3><p>Try another filter or add a student record.</p></td></tr>`}</tbody></table></div>`;
  }
  function studentRecords(data) {
    const rows=filtered(data),total=rows.length,male=rows.filter(s=>s.sex==='Male').length,female=rows.filter(s=>s.sex==='Female').length;
    const years=[...new Set(data.academy.enrollments.map(e=>e.school_year))].sort().reverse(),sections=[...new Set(data.academy.enrollments.filter(e=>(!filters.year||e.school_year===filters.year)&&(!filters.strand||e.strand===filters.strand)).map(e=>e.section))].sort();
    const pages=Math.max(1,Math.ceil(total/10));recordsPage=Math.min(recordsPage,pages);const offset=(recordsPage-1)*10,pageRows=rows.slice(offset,offset+10);
    const selected=rows.filter(s=>recordsSelection.has(s.id)),printRows=selected.length?selected:rows;
    const dropdown=(label,key,values,all,symbol)=>`<label class="records-select">${icon(symbol)}<span><small>${h(label)}</small><select name="${key}" aria-label="${h(label)}"><option value="">${h(all)}</option>${values.map(v=>`<option value="${h(v)}" ${filters[key]===v?'selected':''}>${h(v)}</option>`).join('')}</select></span></label>`;
    return `<div class="records-summary">${[['Total Students',total,filters.search||filters.year||filters.strand||filters.section?'Matching records':'Registered students','students','teal'],['Male Students',male,`${total?Math.round(male/total*100):0}% of total`,'male','blue'],['Female Students',female,`${total?Math.round(female/total*100):0}% of total`,'female','rose'],['Strands',new Set(rows.map(s=>s.strand)).size,'Active strands','school-years','purple'],['Sections',new Set(rows.map(s=>s.section)).size,'Active sections','dashboard','amber']].map(([title,count,help,symbol,tone])=>`<article class="card record-metric tone-${tone}"><span class="record-metric-icon">${icon(symbol)}</span><div><span>${h(title)}</span><strong>${count}</strong><small>${h(help)}</small></div><svg class="record-spark" viewBox="0 0 180 70" aria-hidden="true"><path d="M0 70Q22 43 44 48T85 35T120 26T150 17T180 0V70Z"/></svg></article>`).join('')}</div><form data-form="filter" class="records-toolbar no-print"><label class="records-search">${icon('search')}<input name="search" aria-label="Search students" placeholder="Search student (LRN, name, or ID)..." value="${h(filters.search)}"></label>${dropdown('School Year','year',years,'All School Years','logs')}${dropdown('Strand','strand',STRANDS,'All Strands','school-years')}${dropdown('Section','section',sections,'All Sections','dashboard')}<button class="button secondary records-reset" type="button" data-action="reset-filters">${icon('reset')}Reset</button><a class="button records-add" href="#register">${icon('register')}Add Student</a><button type="submit" class="records-apply">Apply filters</button></form><section class="card records-list"><div class="records-list-heading"><div class="records-title"><span class="record-title-icon">${icon('report-cards')}</span><div><h2>Student Records List</h2><p>View, edit, and manage all Grade 12 student records.</p></div></div><div class="records-table-tools no-print"><a class="button secondary" href="#reports">${icon('upload')}Import (CSV)</a><button class="button secondary" data-action="records-export">${icon('reports')}${selected.length?'Export Selected ('+selected.length+')':'Export (CSV)'}</button><button class="button secondary" data-action="print">${icon('print')}Print List</button></div></div>${recordsTable(data,pageRows)}<div class="records-list-footer no-print"><span role="status">Showing ${total?offset+1:0} to ${Math.min(offset+10,total)} of ${total} ${total===1?'student':'students'}${selected.length?' · '+selected.length+' selected':''}</span><div class="records-pagination" aria-label="Student list pagination"><button data-action="records-page" data-page="${recordsPage-1}" aria-label="Previous page" ${recordsPage===1?'disabled':''}>‹</button><span aria-current="page">${recordsPage}</span><button data-action="records-page" data-page="${recordsPage+1}" aria-label="Next page" ${recordsPage===pages?'disabled':''}>›</button></div></div></section><div class="records-bottom"><section class="card records-quick"><div class="records-title"><span class="quick-bolt">${icon('bolt')}</span><div><h2>Quick Actions</h2><p>Common tasks for student records.</p></div></div><div class="records-quick-grid"><a class="quick-tile tone-teal" href="#register">${icon('register')}<span>Add Student</span></a><a class="quick-tile tone-purple" href="#reports">${icon('upload')}<span>Bulk Import</span></a><a class="quick-tile tone-blue" href="#report-cards">${icon('report-cards')}<span>Generate Report</span></a><button class="quick-tile tone-amber" data-action="backup">${icon('database')}<span>Backup Records</span></button></div></section><section class="card records-distribution"><div class="card-heading"><h2>${icon('grades')}Student Distribution by Strand</h2><span class="badge">Total: ${total}</span></div>${STRANDS.map((strand,i)=>{const count=rows.filter(s=>s.strand===strand).length,pct=total?(count/total*100).toFixed(1):'0.0';return `<div class="strand-row strand-${i}"><span class="strand-name"><i aria-hidden="true"></i>${h(strand)}</span><meter min="0" max="${Math.max(1,total)}" value="${count}" aria-label="${h(strand)}: ${count} students">${count}</meter><span class="strand-count">${count} <small>(${pct}%)</small></span></div>`;}).join('')}</section></div><section class="records-print-only"><h1>Libertad National Vocational School</h1><h2>Student Records List</h2><p>${printRows.length} student records${selected.length?' · Selected records':''}</p>${recordsTable(data,printRows,true)}</section>`;
  }
  function filterForm() {
    return `<form data-form="filter" class="filters"><label class="grow">Search students<input name="search" placeholder="Name, LRN, or section" value="${h(filters.search)}"></label>${select('Strand','strand',STRANDS,filters.strand,'All strands')}${input('School year','year',filters.year,'text',false,'placeholder="2026-2027"')}<button class="button">Apply filters</button><button type="button" class="button secondary" data-action="reset-filters">Reset</button></form>`;
  }
  function studentForm(student={}) {
    const year=new Date().getFullYear();
    return `<form data-form="student" class="card student-form"><input type="hidden" name="id" value="${h(student.id)}"><h2>Personal information</h2><p class="muted">Fields marked * are required.</p><div class="form-grid">${input('Learner Reference Number (12 digits)','lrn',student.lrn,'text',true,'inputmode="numeric" pattern="[0-9]{12}" title="Exactly 12 digits"')}${input('First name','first_name',student.first_name,'text',true)}${input('Last name','last_name',student.last_name,'text',true)}${input('Middle name','middle_name',student.middle_name)}${select('Sex','sex',['Male','Female'],student.sex,'Select sex',true)}${input('Birth date','birth_date',student.birth_date,'date',true,`max="${new Date().toISOString().slice(0,10)}"`)}${input('Email address','email',student.email,'email')}${input('Contact number','phone',student.phone,'tel')}${input('Home address','address',student.address)}</div><hr><h2>Enrollment details</h2><div class="form-grid">${select('Strand','strand',STRANDS,student.strand,'Select strand',true)}${input('Section','section',student.section,'text',true)}${input('School year','school_year',student.school_year||`${year}-${year+1}`,'text',true,'pattern="[0-9]{4}-[0-9]{4}"')}</div><hr><h2>Parent / guardian</h2><div class="form-grid">${input('Guardian name','guardian',student.guardian)}${input('Guardian contact number','guardian_phone',student.guardian_phone,'tel')}</div><div class="form-footer"><a class="button secondary" href="#students">Cancel</a><button class="button">${student.id?'Save changes':'Register student'} &rarr;</button></div></form>`;
  }
  function gradeTable(data,student,editing=false) {
    const rows=data.grades[student.id]||{};
    return `<div class="table-wrap"><table class="grades-table"><thead><tr><th>Subject</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Average</th><th>Remarks</th></tr></thead><tbody>${SUBJECTS.map((subject,i)=>{ const values=rows[subject]||[null,null,null,null], avg=average(values); return `<tr><td>${h(subject)}</td>${values.map((v,q)=>`<td>${editing?`<input type="number" aria-label="${h(subject)} Q${q+1}" name="g${i}_${q}" min="0" max="100" step="0.01" value="${v===null?'':h(v)}">`:num(v)}</td>`).join('')}<td><b>${num(avg)}</b></td><td><span class="badge ${avg!==null&&avg<75?'fail':''}">${avg===null?'Incomplete':avg>=75?'Passed':'Failed'}</span></td></tr>`; }).join('')}</tbody><tfoot><tr><th colspan="5">General average (all subjects complete)</th><th>${num(generalAverage(data,student.id))}</th><td></td></tr></tfoot></table></div>`;
  }
  function profile(data,student,editing=false) {
    const id=encodeURIComponent(student.id);
    return `<div class="print-heading">${schoolBrand()}</div><section class="card profile"><div class="card-heading"><div><span class="eyebrow">GRADE 12 &middot; ${h(student.school_year)}</span><h2>${h(fullName(student))}</h2><p class="muted">LRN ${h(student.lrn)} &middot; ${h(student.strand+' / '+student.section)}</p></div><div class="actions no-print"><a class="button secondary" href="#edit?id=${id}">Edit student</a><a class="button secondary" href="#${editing?'profile':'encode'}?id=${id}">${editing?'View profile':'Encode grades'}</a>${editing?'':'<button class="button secondary" data-action="print">Print profile</button>'}</div></div>${editing?'':`<div class="details">${[['sex','Sex'],['birth_date','Birth date'],['email','Email'],['phone','Contact number'],['address','Address'],['guardian','Guardian'],['guardian_phone','Guardian contact']].map(([key,label])=>`<div><small>${h(label)}</small><b>${h(student[key]||'—')}</b></div>`).join('')}</div>`}</section><section class="card"><h2>Legacy quarterly grade archive</h2><p><a href="#grades">Open current curriculum-based grades and academic reports</a></p><p class="muted">Average = (Q1 + Q2 + Q3 + Q4) / 4. Passing grade: 75.</p>${editing?`<form data-form="grades"><input type="hidden" name="id" value="${h(student.id)}">`:''}${gradeTable(data,student,editing)}${editing?'<div class="form-footer"><span class="muted">Leave unencoded quarters blank.</span><button class="button">Save quarterly grades</button></div></form>':''}</section>`;
  }
  function reports(data) {
    const groups=new Map();
    for(const s of data.students) { const key=s.school_year+'|'+s.strand; const row=groups.get(key)||{year:s.school_year,strand:s.strand,male:0,female:0,total:0}; row[s.sex==='Male'?'male':'female']++; row.total++; groups.set(key,row); }
    return stats(data)+insights(data)+`<section class="card"><div class="card-heading"><h2>Enrollment summary</h2><button class="button secondary" data-action="csv-all">Export all students</button></div><div class="table-wrap"><table><thead><tr><th>School year</th><th>Strand</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>${[...groups.values()].sort((a,b)=>b.year.localeCompare(a.year)||a.strand.localeCompare(b.strand)).map(r=>`<tr><td>${h(r.year)}</td><td>${h(r.strand)}</td><td>${r.male}</td><td>${r.female}</td><td>${r.total}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Register students to see enrollment summaries.</td></tr>'}</tbody></table></div></section>`;
  }
  function settings(data) {
    return `<div class="settings-stack"><section class="card"><h2>Back up your workspace</h2><p class="muted">A full JSON backup includes your local account, students, grades, curriculum, enrollments, issued reports, audit history and local member accounts. Store it privately. CSV is useful for student lists, but it does not include your account or grades.</p><div class="backup-actions"><button class="button" data-action="backup">Download full backup</button><button class="button secondary" data-action="csv-all">Download students CSV</button></div><hr><h2>Restore a backup</h2><p class="muted">Restore a backup on this browser or a new device. Restoring replaces this account?s records and signs you out. Other local accounts are kept. Use the password from the restored backup to sign in.</p><form data-form="restore"><label>Gradebook backup (.json)<input type="file" name="backup" accept="application/json,.json" required></label><button class="button secondary">Restore backup</button></form></section><section class="card"><h2>Change local password</h2><p class="muted">Signed in as ${h(data.admin.username)}. Use at least 12 characters.</p><form data-form="password">${input('Current password','current','','password',true,'autocomplete="current-password"')}${input('New password','password','','password',true,'minlength="12" autocomplete="new-password"')}${input('Confirm new password','confirm','','password',true,'minlength="12" autocomplete="new-password"')}<button class="button">Update password</button></form></section><section class="card"><h2>Account access</h2><p class="muted">Switch accounts or create another local account with a separate student workspace.</p><div class="backup-actions"><a class="button secondary" href="#login">Login to another account</a><a class="button secondary" href="#signup">Create account</a></div></section><section class="card"><h2>About browser storage</h2><p class="muted">This is a working local application, not a server database. Your information stays in this browser profile on this site. It is not shared with other devices, browsers, or administrators. The local sign-in does not encrypt the records or protect them from someone with access to this browser or its developer tools. Keep backups and use a trusted device.</p></section></div>`;
  }
  function render() {
    try {
      const data=read();
      if(!logged(data) || ['login','signup'].includes(route().name)) { auth(data); return; }
      const {name,params}=route();
      const user=identity(data);
      const sectionTitles={enrollment:'Enrollment',curriculum:'Curriculum & Subjects',grades:'Grade Management',analytics:'Performance Analytics',interventions:'Academic Interventions','report-cards':'Report Cards','school-years':'School Years & Sections',teachers:'Teachers & Advisers',verification:'Record Verification',logs:'Activity Logs',reports:'Reports & Exports'};
      // Old links remain readable, but no longer appear in the sidebar.
      if(name==='academic'&&params.has('report')&&data.academy.reports.some(r=>r.reference===params.get('report')&&r.enrollment?.grade_level===12)){go('report-cards?report='+encodeURIComponent(params.get('report')));return;}
      if(name==='academic') {layout(data,'Grade Management','grades',academic.view(data,user,params));app.querySelector('.content').classList.add('academic-browser');return;}
      if(name==='encode') {const enrollment=data.academy.enrollments.find(e=>e.student_id===params.get('id'));go('grades'+(enrollment?'?enrollment='+encodeURIComponent(enrollment.id):''));return;}
      if(name==='enrollment'){layout(data,'Enrollment','enrollment',enrollmentPage.view(data,user,params));return;}
      if(name==='curriculum'){layout(data,'Curriculum & Subjects','curriculum',curriculumPage.view(data,user,params));return;}
      if(name==='grades'){layout(data,'Grade Management','grades',gradesPage.view(data,user,params));return;}
      if(name==='verification'){layout(data,'Record Verification','verification',verificationPage.view(data,user,params));return;}
      if(name==='teachers'){layout(data,'Teachers & Advisers','teachers',teachersPage.view(data,user,params));return;}
      if(name==='school-years'){layout(data,'School Years & Sections','school-years',schoolYearsPage.view(data,user,params));return;}
      if(name==='report-cards'){layout(data,'Report Cards','report-cards',reportCardsPage.view(data,user,params));return;}
      if(name==='interventions'){layout(data,'Academic Interventions','interventions',interventionsPage.view(data,user,params));return;}
      if(name==='analytics'){layout(data,'Performance Analytics','analytics',analyticsPage.view(data,user,params));return;}
      if(sectionTitles[name]) {layout(data,sectionTitles[name],name,academic.sectionView(data,user,params,name));app.querySelector('.content').classList.add('academic-browser');return;}
      if(user.role!=='admin') {go('grades');return;}
      const student=data.students.find(s=>s.id===params.get('id'));
      const add='<a class="button register-button" href="#register">'+icon('register')+'Register student</a>';
      if(name==='dashboard') layout(data,'Dashboard','dashboard',stats(data)+insights(data),add);
      else if(name==='students') layout(data,'Student Records','students',studentRecords(data));
      else if(name==='register'||name==='edit') layout(data,name==='edit'?'Edit student':'Student registration','register',name==='edit'&&!student?'<section class="card"><h2>Student not found</h2><a href="#students">Return to records</a></section>':studentForm(student));
      else if(name==='profile'||name==='encode') layout(data,name==='encode'?'Grades management':'Student profile',name==='encode'?'grades':'students',student?profile(data,student,name==='encode'):'<section class="card"><h2>Student not found</h2><a href="#students">Return to records</a></section>');

      else if(name==='settings') layout(data,'System Settings','settings',settings(data));
      else layout(data,'Page not found','', '<section class="card"><a href="#dashboard">Return to dashboard</a></section>');
    } catch(error) {
      app.innerHTML=`<main class="auth"><section class="card"><h1>Storage unavailable</h1><p class="muted">${h(error.message)}</p><p class="local-note">Allow site storage in your browser and use a normal browsing window. Existing data has not been overwritten.</p></section></main>`;
    }
  }
  function validateStudent(s) {
    if(!/^\d{12}$/.test(s.lrn)) throw new Error('LRN must contain exactly 12 digits.');
    if(!s.first_name || !s.last_name || !s.section) throw new Error('Complete the student name and section.');
    if(!STRANDS.includes(s.strand) || !['Male','Female'].includes(s.sex)) throw new Error('Select a valid strand and sex.');
    const date=new Date(s.birth_date+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s.birth_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==s.birth_date || s.birth_date>new Date().toISOString().slice(0,10)) throw new Error('Enter a valid birth date.');
    const years=/^(\d{4})-(\d{4})$/.exec(s.school_year);
    if(!years || Number(years[2])!==Number(years[1])+1) throw new Error('Enter consecutive school years, for example 2026-2027.');
    if(s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) throw new Error('Enter a valid email address.');
    if(FIELDS.some(key=>typeof s[key]!=='string'||s[key].length>500)) throw new Error('A student field is invalid or too long.');
  }
  function bytesHex(bytes) { return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join(''); }
  async function passwordHash(password,salt) {
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const saltBytes=Uint8Array.from(salt.match(/.{2}/g),s=>parseInt(s,16));
    return bytesHex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:210000,hash:'SHA-256'},key,256)));
  }
  async function makeAdmin(username,password) {
    const salt=bytesHex(crypto.getRandomValues(new Uint8Array(16)));
    return {username,salt,hash:await passwordHash(password,salt)};
  }
  function download(filename,body,type) {
    const url=URL.createObjectURL(new Blob([body],{type}));
    const link=document.createElement('a'); link.href=url; link.download=filename; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csv(students) {
    const quote=value=>{ let v=String(value??''); if(/^[\s]*[=+@\-]/.test(v)) v="'"+v; return '"'+v.replace(/"/g,'""')+'"'; };
    const lines=[FIELDS.map(quote).join(','),...students.map(s=>FIELDS.map(key=>quote(s[key])).join(','))];
    download('lnvs-students-'+new Date().toISOString().slice(0,10)+'.csv','\uFEFF'+lines.join('\r\n'),'text/csv;charset=utf-8');
  }
  function validateBackup(data) {
    if(!data || data.version!==1 || !data.admin || !Array.isArray(data.students) || !data.grades || typeof data.grades!=='object' || Array.isArray(data.grades)) throw new Error('This is not a supported Gradebook backup.');
    if(typeof data.admin.username!=='string'||data.admin.username.length<3||data.admin.username.length>50||!/^[a-f0-9]{32}$/.test(data.admin.salt)||!/^[a-f0-9]{64}$/.test(data.admin.hash)) throw new Error('The backup account information is invalid.');
    const ids=new Set(),lrns=new Set(), clean=blank();
    clean.admin={username:data.admin.username,salt:data.admin.salt,hash:data.admin.hash};
    for(const original of data.students) {
      if(!original||typeof original.id!=='string'||!/^[a-f0-9-]{36}$/.test(original.id)||ids.has(original.id)||lrns.has(original.lrn)) throw new Error('The backup has invalid or duplicate student records.');
      const s={id:original.id}; for(const key of FIELDS) s[key]=original[key]; validateStudent(s);
      s.created_at=typeof original.created_at==='string'?original.created_at:new Date().toISOString();
      ids.add(s.id); lrns.add(s.lrn); clean.students.push(s);
      const rows=data.grades[s.id]||{}; clean.grades[s.id]={};
      for(const subject of Object.keys(rows)) if(Object.hasOwn(rows,subject)) {
        const values=rows[subject];
        if(!Array.isArray(values)||values.length!==4||values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100))) throw new Error('The backup contains invalid quarterly grades.');
        clean.grades[s.id][subject]=[...values];
      }
    }
    if(data.academy) clean.academy=academic.validate(data.academy,clean.students);
    return academic.normalize(clean);
  }
  function updateRecordFilters(form) {
    const fd=new FormData(form);filters={search:String(fd.get('search')||'').trim(),strand:String(fd.get('strand')||''),year:String(fd.get('year')||''),section:String(fd.get('section')||'')};if(filters.section&&!read().academy.enrollments.some(e=>(!filters.year||e.school_year===filters.year)&&(!filters.strand||e.strand===filters.strand)&&e.section===filters.section))filters.section='';recordsPage=1;recordsSelection.clear();render();
  }
  app.addEventListener('input',event=>{if(event.target.matches('form[data-form="verification-search"] [name="search"]')){clearTimeout(searchTimer);const position=event.target.selectionStart;searchTimer=setTimeout(()=>{if(route().name!=='verification')return;const form=app.querySelector('form[data-form="verification-search"]');if(!form)return;verificationPage.search(new FormData(form));render();const field=app.querySelector('form[data-form="verification-search"] [name="search"]');field.focus({preventScroll:true});field.setSelectionRange(position,position);},220);return;}if(event.target.matches('form[data-form="staff-subject"] [name="reason"]')){teachersPage.capture(new FormData(event.target.form));return;}if(event.target.matches('form[data-form="staff-search"] [name="search"]')){clearTimeout(searchTimer);const position=event.target.selectionStart;searchTimer=setTimeout(()=>{if(route().name!=='teachers')return;const form=app.querySelector('form[data-form="staff-search"]');if(!form)return;teachersPage.search(new FormData(form));render();const field=app.querySelector('form[data-form="staff-search"] [name="search"]');field.focus({preventScroll:true});field.setSelectionRange(position,position);},220);return;}if(event.target.matches('form[data-form="school-assignment"] [name="reason"]')){schoolYearsPage.captureAssignment(new FormData(event.target.form));return;}if(event.target.matches('form[data-form="report-filter"] [name="search"]')){clearTimeout(searchTimer);const position=event.target.selectionStart;searchTimer=setTimeout(()=>{if(route().name!=='report-cards')return;const form=app.querySelector('form[data-form="report-filter"]');if(!form)return;reportCardsPage.filter(new FormData(form));render();const field=app.querySelector('form[data-form="report-filter"] [name="search"]');field.focus({preventScroll:true});field.setSelectionRange(position,position);},220);return;}if(event.target.matches('[data-grade-period],[data-grade-reason]')){const data=read();if(logged(data))gradesPage.inputEvent(event.target,app,data,identity(data),route().params);return;}if(event.target.matches('form[data-form="enrollment-filter"] [name="search"]')){clearTimeout(searchTimer);const position=event.target.selectionStart;searchTimer=setTimeout(()=>{if(route().name!=='enrollment')return;const form=app.querySelector('form[data-form="enrollment-filter"]');if(!form)return;const data=read();if(!logged(data))return;enrollmentPage.filter(new FormData(form),data);render();const field=app.querySelector('form[data-form="enrollment-filter"] [name="search"]');field.focus({preventScroll:true});field.setSelectionRange(position,position);},220);return;}if(event.target.matches('.records-search input')){clearTimeout(searchTimer);const position=event.target.selectionStart;searchTimer=setTimeout(()=>{if(route().name!=='students')return;const form=app.querySelector('.records-toolbar');if(!form)return;updateRecordFilters(form);const field=app.querySelector('.records-search input');field.focus({preventScroll:true});field.setSelectionRange(position,position);},220);}});
  app.addEventListener('change',event=>{
    if(event.target.matches('form[data-form="verification-filter"] select')){verificationPage.filter(new FormData(event.target.form));render();return;}
    if(event.target.matches('[data-verification-select],[data-verification-all]')){const data=read();verificationPage.toggle(event.target.hasAttribute('data-verification-all')?'all':event.target.dataset.verificationSelect,event.target.checked,data,identity(data));render();return;}

    if(event.target.matches('form[data-form="staff-filter"] select')){teachersPage.filter(new FormData(event.target.form));render();return;}
    if(event.target.matches('form[data-form="staff-search"] select')){teachersPage.search(new FormData(event.target.form));render();return;}
    if(event.target.matches('form[data-form="staff-subject"] select')){teachersPage.capture(new FormData(event.target.form));render();return;}
    if(event.target.matches('[data-staff-adviser-target]')){const data=read();teachersPage.action('adviser-target','',event.target.value,data,identity(data));render();return;}

    if(event.target.matches('form[data-form="school-assignment"] [name="target"]')){schoolYearsPage.captureAssignment(new FormData(event.target.form));return;}

    if(event.target.matches('form[data-form="school-filter"] select')){schoolYearsPage.filter(new FormData(event.target.form));render();return;}
    if(event.target.matches('[data-school-select],[data-school-select-all]')){try{const data=read();schoolYearsPage.captureAssignment(new FormData(event.target.form));schoolYearsPage.toggle(event.target.hasAttribute('data-school-select-all')?'all':event.target.dataset.schoolSelect,event.target.checked,data,identity(data));render();}catch(error){popup('Assignment unavailable',error.message,'error');}return;}

    if(event.target.matches('form[data-form="report-filter"] select')){reportCardsPage.filter(new FormData(event.target.form));render();return;}
    if(event.target.matches('[data-report-select],[data-report-select-all],[data-report-period],[data-report-source],[data-report-template]')){try{const data=read(),user=identity(data);if(!user)return;if(event.target.hasAttribute('data-report-select'))reportCardsPage.toggle(event.target.dataset.reportSelect,event.target.checked,data,user,route().params);else if(event.target.hasAttribute('data-report-select-all'))reportCardsPage.toggle('all',event.target.checked,data,user,route().params);else if(event.target.hasAttribute('data-report-period'))reportCardsPage.setPeriod(event.target.value);else if(event.target.hasAttribute('data-report-source'))reportCardsPage.setSource(event.target.value,data,user,route().params);else reportCardsPage.setTemplate(event.target.value);render();}catch(error){popup('Report unavailable',error.message,'error');}return;}

    if(event.target.matches('form[data-form="intervention-filter"] select')){interventionsPage.filter(new FormData(event.target.form));render();return;}
    if(event.target.matches('form[data-form="analytics-filter"] select')){analyticsPage.filter(new FormData(event.target.closest('form')));render();return;}
    if(event.target.matches('form[data-form="grades-filter"] select')){gradesPage.filter(new FormData(event.target.closest('form')));render();return;}
    if(event.target.matches('form[data-form="curriculum-filter"] select')){const data=read();if(logged(data)&&identity(data).role==='admin'){curriculumPage.filter(new FormData(event.target.closest('form')));render();}return;}
    if(event.target.matches('form[data-form="enrollment-filter"] select')){clearTimeout(searchTimer);const data=read();if(logged(data)){enrollmentPage.filter(new FormData(event.target.closest('form')),data);render();}return;}
    if(event.target.matches('[data-enrollment-select],[data-enrollment-select-all]')){const data=read();if(logged(data)){enrollmentPage.selection(data,identity(data),event.target.dataset.enrollmentSelect,event.target.checked,event.target.hasAttribute('data-enrollment-select-all'));render();}return;}
    if(event.target.matches('form[data-form="enrollment-save"] [name="student_id"]')&&route().params.get('mode')==='re-enroll'){go('enrollment?mode=re-enroll&student='+encodeURIComponent(event.target.value));return;}
    if(event.target.matches('form[data-form="enrollment-save"] [name="status"]')){const form=event.target.closest('form'),date=form.querySelector('[name="enrolled_on"]');date.required=event.target.value==='Enrolled';if(event.target.value!=='Enrolled'&&!form.querySelector('[name="enrollment_id"]').value)date.value='';return;}
    if(event.target.matches('[data-overview-year]')){overviewYear=event.target.value;render();}
    else if(event.target.matches('.records-toolbar select')){clearTimeout(searchTimer);updateRecordFilters(event.target.closest('form'));}
    else if(event.target.matches('[data-record-select]')){event.target.checked?recordsSelection.add(event.target.dataset.recordSelect):recordsSelection.delete(event.target.dataset.recordSelect);render();}
    else if(event.target.matches('[data-record-select-all]')){const data=read();if(!logged(data)||identity(data).role!=='admin')return;const rows=filtered(data).slice((recordsPage-1)*10,recordsPage*10);for(const s of rows)event.target.checked?recordsSelection.add(s.id):recordsSelection.delete(s.id);render();}
  });
  app.addEventListener('submit', async event => {
    const form=event.target.closest('form[data-form]'); if(!form) return;
    event.preventDefault(); if(busy) return;
    busy=true; const submit=form.querySelector('button:not([type="button"])'); if(submit) submit.disabled=true;
    const fd=new FormData(form), kind=form.dataset.form;
    try {
      let data=read();
      if(kind==='setup') {
        const username=String(fd.get('username')).trim(), password=String(fd.get('password'));
        if(username.length<3||username.length>50||password.length<12) throw new Error('Use a username of 3-50 characters and a password of at least 12 characters.');
        if(password!==fd.get('confirm')) throw new Error('Passwords do not match.');
        if(readStore().accounts.some(account=>[account.data.admin,...(account.data.academy?.members||[])].some(m=>m.username.toLowerCase()===username.toLowerCase()))) throw new Error('That username already exists on this browser. Choose another username or log in.');
        const admin=await makeAdmin(username,password);
        const store=readStore();
        if(store.accounts.some(account=>[account.data.admin,...(account.data.academy?.members||[])].some(m=>m.username.toLowerCase()===username.toLowerCase()))) throw new Error('That username was just registered in another tab. Choose another username or log in.');
        data=blank(); data.admin=admin;
        const id=crypto.randomUUID(); store.accounts.push({id,data}); saveStore(store);
        sessionStorage.setItem(ACTIVE,id); sessionStorage.setItem(SESSION,admin.hash); verificationPage.reset(); teachersPage.reset(); schoolYearsPage.reset(); reportCardsPage.reset(); interventionsPage.reset(); analyticsPage.reset(); gradesPage.reset(); curriculumPage.reset(); enrollmentPage.reset(); overviewYear=''; recordsPage=1; recordsSelection.clear(); filters={search:'',strand:'',year:'',section:''}; go('dashboard'); render(); await popup('Account created','Your local account is ready with an empty student workspace.'); return;
      }
      if(kind==='login') {
        const username=String(fd.get('username')).trim().toLowerCase();
        const store=readStore(); let found=null;
        for(const account of store.accounts) {const user=[account.data.admin,...(account.data.academy?.members||[])].find(m=>m.username.toLowerCase()===username&&m.active!==false);if(user)found={account,user};}
        if(!found || await passwordHash(String(fd.get('password')),found.user.salt)!==found.user.hash) throw new Error('Invalid username or password.');
        const latest=readStore().accounts.find(item=>item.id===found.account.id);
        if(!latest||![latest.data.admin,...(latest.data.academy?.members||[])].some(m=>m.hash===found.user.hash&&m.active!==false))throw new Error('This account changed in another tab. Try again.');
        sessionStorage.setItem(ACTIVE,found.account.id); sessionStorage.setItem(SESSION,found.user.hash); verificationPage.reset(); teachersPage.reset(); schoolYearsPage.reset(); reportCardsPage.reset(); interventionsPage.reset(); analyticsPage.reset(); gradesPage.reset(); curriculumPage.reset(); enrollmentPage.reset(); overviewYear=''; recordsPage=1; recordsSelection.clear(); filters={search:'',strand:'',year:'',section:''}; go(found.user.role?'grades':'dashboard'); render(); await popup('Login successful','Welcome back to your local student workspace.'); return;
      }
      if(!logged(data)) throw new Error('Please sign in before making changes.');
      const user=identity(data);
      if(kind==='verification-filter'){verificationPage.filter(fd);render();return;}
      if(kind==='verification-search'){clearTimeout(searchTimer);verificationPage.search(fd);render();return;}
      if(['verification-create','verification-review','verification-bulk'].includes(kind)){const original=localStorage.getItem(KEY);if(kind==='verification-create')await verificationPage.create(data,user,fd);else if(kind==='verification-review')await verificationPage.review(data,user,fd);else verificationPage.bulk(data,user,fd);if(localStorage.getItem(KEY)!==original)throw Error('Another tab changed the workspace. No verification changes were saved. Reopen the form.');write(data);render();await popup('Verification saved','The local request and review history were saved on this browser.');return;}
      if(kind==='staff-filter'){teachersPage.filter(fd);render();return;}
      if(kind==='staff-search'){clearTimeout(searchTimer);teachersPage.search(fd);render();return;}
      if(['staff-profile','staff-password','staff-adviser','staff-subject','staff-remove'].includes(kind)){const original=localStorage.getItem(KEY);if(kind==='staff-profile')teachersPage.saveProfile(data,user,fd);else if(kind==='staff-password')await teachersPage.resetPassword(data,user,fd);else if(kind==='staff-adviser')teachersPage.saveAdviser(data,user,fd);else if(kind==='staff-subject')teachersPage.saveSubject(data,user,fd);else teachersPage.remove(data,user,fd);if(localStorage.getItem(KEY)!==original)throw Error('Another tab changed the workspace. No staff changes were saved. Reopen the form.');write(data);render();await popup('Staff changes saved','Profiles and assignments were saved on this browser with audit history.');return;}
      if(kind==='school-filter'){schoolYearsPage.filter(fd);render();return;}
      if(kind==='school-save'||kind==='school-assignment'){if(kind==='school-save')schoolYearsPage.save(data,user,fd);else schoolYearsPage.assign(data,user,fd);write(data);render();await popup('School setup saved','School configuration and assignments were saved on this browser with audit history.');return;}
      if(kind==='report-filter'){clearTimeout(searchTimer);reportCardsPage.filter(fd);render();return;}
      if(kind==='report-generate'){await generateReportCards(data,'single');return;}
      if(kind==='intervention-filter'){interventionsPage.filter(fd);render();return;}
      if(kind==='intervention-save'){interventionsPage.save(data,user,fd);write(data);render();await popup('Intervention saved','A dated support plan entry was saved on this browser.');return;}
      if(kind==='analytics-filter'){analyticsPage.filter(fd);render();return;}
      if(kind==='grades-filter'){gradesPage.filter(fd);render();return;}
      if(kind==='academic-grade'&&form.hasAttribute('data-grade-editor')){const original=localStorage.getItem(KEY);await gradesPage.save(data,user,fd,route().params);if(localStorage.getItem(KEY)!==original)throw Error('Another tab changed the workspace. Reset the row and try again.');write(data);gradesPage.didSave(fd);render();await popup('Grades saved','Changes saved to this local workspace with an audit event.');return;}
      if(kind==='grades-import'){const original=localStorage.getItem(KEY),keys=await gradesPage.importCSV(data,user,fd,route().params);if(localStorage.getItem(KEY)!==original)throw Error('Another tab changed the workspace. No grades were imported.');write(data);gradesPage.didImport(keys);go('grades');render();await popup('Grades imported',keys.length+' grade records were verified and saved together.');return;}
      if(kind==='curriculum-filter'){curriculumPage.filter(fd);render();return;}
      if(['curriculum-save','curriculum-strands','curriculum-settings'].includes(kind)){if(kind==='curriculum-save')curriculumPage.save(data,user,fd);else if(kind==='curriculum-strands')curriculumPage.saveStrands(data,user,fd);else curriculumPage.saveSettings(data,user,fd);write(data);const tab=route().params.get('tab')||'setup';go('curriculum?tab='+tab);render();await popup('Curriculum saved','Curriculum and subject records were updated on this browser.');return;}
      if(kind==='enrollment-filter'){clearTimeout(searchTimer);enrollmentPage.filter(fd,data);render();return;}
      if(kind==='enrollment-save'||kind==='enrollment-sectioning'){if(kind==='enrollment-save')enrollmentPage.save(data,user,fd);else enrollmentPage.sectioning(data,user,fd);write(data);go('enrollment');render();await popup('Enrollment saved','Enrollment records were updated on this browser. Existing academic history was retained.');return;}
      if(kind.startsWith('academic-')) {const original=localStorage.getItem(KEY);const next=await academic.submit(data,user,kind.slice(9),fd,readStore().accounts);if(localStorage.getItem(KEY)!==original)throw new Error('Another tab changed this workspace. Reload and try again.');write(data);if(next)go(next.replace('academic?report=','report-cards?report='));render();if(kind!=='academic-verify')await popup('Changes saved','Academic records updated on this browser.');return;}
      if(user.role!=='admin') throw new Error('Use your assigned Grade Management page.');
      if(kind==='filter') {clearTimeout(searchTimer);updateRecordFilters(form);return;}
      if(kind==='student') {
        const id=String(fd.get('id')||''), s={};
        for(const key of FIELDS) s[key]=String(fd.get(key)||'').trim();
        validateStudent(s);
        if(data.students.some(student=>student.lrn===s.lrn&&student.id!==id)) throw new Error('That LRN is already registered.');
        if(id) { const index=data.students.findIndex(student=>student.id===id); if(index<0) throw new Error('Student not found.'); data.students[index]={...data.students[index],...s}; }
        else { s.id=crypto.randomUUID(); s.created_at=new Date().toISOString(); data.students.push(s); }
        academic.normalize(data); if(!id)academic.school.check(data,data.academy.enrollments.find(e=>e.student_id===s.id)); academic.school.sync(data); academic.audit(data,user,id?'Student identity updated':'Student registered',data.academy.enrollments.find(e=>e.student_id===(id||s.id)),null,s,'Student record saved');
        write(data); go('profile?id='+encodeURIComponent(id||s.id)); render(); await popup(id?'Record updated':'Student created',id?'Student information has been saved on this browser.':'The student has been registered on this browser.'); return;
      }
      if(kind==='grades') throw new Error('Encode curriculum-based grades in Academic Workspace.');
      if(kind==='password') {
        if(await passwordHash(String(fd.get('current')),data.admin.salt)!==data.admin.hash) throw new Error('Current password is incorrect.');
        const password=String(fd.get('password')); if(password.length<12) throw new Error('Use at least 12 characters.'); if(password!==fd.get('confirm')) throw new Error('Passwords do not match.');
        const oldHash=data.admin.hash, admin=await makeAdmin(data.admin.username,password); data=read(); if(data.admin.hash!==oldHash) throw new Error('The account changed in another tab. Sign in again.'); data.admin=admin; write(data); sessionStorage.setItem(SESSION,admin.hash); render(); await popup('Password updated','Your local account password has been changed. Download a new backup to include this change.'); return;
      }
      if(kind==='restore') {
        const file=fd.get('backup'); if(!(file instanceof File)||!file.size) throw new Error('Choose a Gradebook backup file.'); if(file.size>10*1024*1024) throw new Error('Choose a backup smaller than 10 MB.');
        let restored; try {restored=validateBackup(JSON.parse(await file.text()));} catch(error) {throw new Error('Backup was not restored: '+error.message);}
        if(!await popup('Replace current workspace?',`This will replace your current account, students, and grades with ${restored.students.length} student records from the backup. Download your current backup first if you need it.`,'warning',true,'Yes, restore backup','No, keep current data')) return;
        write(restored); sessionStorage.removeItem(SESSION); sessionStorage.removeItem(ACTIVE); go('login'); render(); await popup('Backup restored','Log in using the username and password from the restored backup.'); return;
      }
    } catch(error) { await popup('Please try again',error.message,'error'); }
    finally { busy=false; if(submit) submit.disabled=false; }
  });
  app.addEventListener('click', async event => {
    const button=event.target.closest('[data-action]'); if(!button) return;
    event.preventDefault();
    if(button.dataset.action==='toggle-password') {
      const field=document.getElementById(button.getAttribute('aria-controls'));
      if(!field?.hasAttribute('data-password-input')) return;
      const visible=field.type==='password';
      field.type=visible?'text':'password';
      const label=(visible?'Hide ':'Show ')+button.dataset.label;
      button.setAttribute('aria-label',label);
      button.setAttribute('aria-pressed',String(visible));
      button.title=label;
      button.innerHTML=passwordIcon(visible);
      return;
    }
    if(busy) return;
    try {
      const data=read(); if(!logged(data)) {render(); return;}
      const action=button.dataset.action;
      if(identity(data).role!=='admin'&&!['logout','print','enrollment-export','enrollment-reset','enrollment-page','grades-export','grades-student','grades-subject','grades-page','grades-reset-row','grades-reset-filters','analytics-reset','analytics-page','analytics-student','analytics-subject','analytics-close-detail','intervention-reset','intervention-page','intervention-select','intervention-edit','intervention-create','intervention-plan','intervention-history','intervention-close','intervention-risk','intervention-monitor','intervention-schedule','intervention-guardian','intervention-report','report-reset','report-page','report-student','report-print','report-pdf','report-print-selected','report-pdf-selected','report-csv','report-copy','report-generate-all','report-generate-selected','school-tab','school-reset','school-page','school-strand','school-close','verification-new','verification-close','verification-reset','verification-select','verification-decision','verification-check','verification-receipt','verification-document','verification-page','verification-bulk','verification-csv','verification-print'].includes(action))throw new Error('Administrator access required.');
      if(action==='logout') { if(!await popup('Sign out?','Are you sure you want to sign out of your local account?','warning',true,'Yes, sign out','No, stay signed in')) return; sessionStorage.removeItem(SESSION); sessionStorage.removeItem(ACTIVE); verificationPage.reset(); teachersPage.reset(); schoolYearsPage.reset(); reportCardsPage.reset(); interventionsPage.reset(); analyticsPage.reset(); gradesPage.reset(); curriculumPage.reset(); enrollmentPage.reset(); overviewYear=''; recordsPage=1; recordsSelection.clear(); filters={search:'',strand:'',year:'',section:''}; go('login'); render(); await popup('Logout successful','You have been signed out. Your saved records remain on this browser.'); }
      else if(action==='reset-filters') {verificationPage.reset(); teachersPage.reset(); schoolYearsPage.reset(); reportCardsPage.reset(); interventionsPage.reset(); analyticsPage.reset(); gradesPage.reset(); curriculumPage.reset(); enrollmentPage.reset(); overviewYear=''; recordsPage=1; recordsSelection.clear(); filters={search:'',strand:'',year:'',section:''}; render();}
      else if(action==='verification-page'){verificationPage.setPage(button.dataset.kind,button.dataset.page);render();}
      else if(action==='verification-check'){await verificationPage.check(data,identity(data),button.dataset.id);render();}
      else if(action==='verification-document'){const doc=verificationPage.document(data,identity(data),button.dataset.id);download(doc.name,doc.bytes,doc.type);}
      else if(action==='verification-print'){const html=verificationPage.print(data,identity(data));app.querySelector('.verification-print-area').innerHTML=html;window.print();}
      else if(action==='verification-csv'){const quote=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';download('lnvs-verification-summary.csv','\uFEFF'+verificationPage.csv(data,identity(data)).map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');await popup('Verification CSV prepared','The selected or filtered request summary was exported. Attachments and review notes are excluded.');}
      else if(action.startsWith('verification-')){verificationPage.action(action.slice(13),button.dataset.id||'',button.dataset.status||'',data,identity(data));render();(app.querySelector('.verification-editor')||app.querySelector('.verification-receipt'))?.scrollIntoView({block:'start',behavior:'smooth'});}
      else if(action==='staff-page'){teachersPage.setPage(button.dataset.kind,button.dataset.page);render();}
      else if(action==='staff-print'){render();window.print();}
      else if(action==='staff-csv'){const quote=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';download('lnvs-staff-assignments.csv','\uFEFF'+teachersPage.csv(data,identity(data)).map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');await popup('Assignment CSV prepared','The filtered assignment report was exported. Login credentials and contact details are excluded.');}
      else if(action.startsWith('staff-')){const target=teachersPage.action(action.slice(6),button.dataset.id||'',button.dataset.key||'',data,identity(data),button.dataset.role);render();if(target==='accounts')app.querySelector('#staff-accounts')?.scrollIntoView({block:'start',behavior:'smooth'});else (app.querySelector('.staff-editor')||app.querySelector('.staff-report'))?.scrollIntoView({block:'start',behavior:'smooth'});}
      else if(action.startsWith('school-')){schoolYearsPage.action(action.slice(7),button.dataset.id||button.dataset.page||'',data,identity(data),button.dataset.kind);render();app.querySelector('.school-editor')?.scrollIntoView({block:'start',behavior:'smooth'});}
      else if(action==='report-reset'){clearTimeout(searchTimer);reportCardsPage.reset();go('report-cards');render();}
      else if(action==='report-student'){reportCardsPage.select(button.dataset.id,data,identity(data),route().params);render();}
      else if(action==='report-page'){reportCardsPage.setPage(button.dataset.page);render();}
      else if(action==='report-generate-all'||action==='report-generate-selected'){await generateReportCards(data,action==='report-generate-all'?'all':'selected');}
      else if(['report-print','report-pdf','report-print-selected','report-pdf-selected'].includes(action)){app.querySelector('.report-print-area').innerHTML=reportCardsPage.print(data,identity(data),route().params,action.endsWith('-selected'));window.print();}
      else if(action==='report-copy'){const ref=reportCardsPage.copyReference(data,identity(data),route().params);try{await navigator.clipboard.writeText(ref);await popup('Reference copied',ref+' - Verify in the original local workspace or its backup.');}catch(_){await popup('Report reference',ref+' - Copy this reference and verify it in the original local workspace or its backup.');}}
      else if(action==='report-csv'){const quote=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';download('lnvs-report-card.csv','\uFEFF'+reportCardsPage.csv(data,identity(data),route().params).map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');await popup('CSV download started','The displayed report was exported using saved grades or its frozen snapshot.');}
      else if(action.startsWith('intervention-')){interventionsPage.action(action.slice(13),button.dataset.id||button.dataset.page||'',data,identity(data),route().params);render();if(['intervention-create','intervention-edit','intervention-schedule'].includes(action))app.querySelector('.intervention-editor')?.scrollIntoView({block:'start',behavior:'smooth'});if(action==='intervention-monitor')app.querySelector('#intervention-progress')?.scrollIntoView({block:'center',behavior:'smooth'});}
      else if(action==='analytics-reset'){analyticsPage.reset();go('analytics');render();}
      else if(action==='analytics-page'){analyticsPage.setPage(button.dataset.page);render();}
      else if(action==='analytics-student'){analyticsPage.setStudent(button.dataset.id);render();}
      else if(action==='analytics-subject'){analyticsPage.setSubject(button.dataset.id);render();}
      else if(action==='analytics-close-detail'){analyticsPage.closeDetail();render();}
      else if(action==='grades-reset-filters'){gradesPage.resetFilters();go('grades');render();}
      else if(action==='grades-reset-row'){gradesPage.resetRow(button.dataset.enrollment,button.dataset.subject);render();}
      else if(action==='grades-student'){gradesPage.setStudent(button.dataset.id);render();}
      else if(action==='grades-subject'){gradesPage.setSubject(button.dataset.id);render();}
      else if(action==='grades-page'){gradesPage.setPage(button.dataset.page);render();}
      else if(action==='grades-export'){const quote=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';download('lnvs-grades.csv','\uFEFF'+gradesPage.exportRows(data,identity(data),route().params).map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');await popup('CSV download started','Stored grades for the selected subject/class were exported. Unsaved previews were excluded.');}
      else if(action==='curriculum-page'){curriculumPage.setPage(button.dataset.kind,button.dataset.page);render();}
      else if(action==='curriculum-archive'){if(!await popup('Archive this record?','Unused records can be archived. Subjects with academic history or assignments must be retained.','warning',true,'Archive record','Keep record'))return;const latest=read();if(!logged(latest))throw new Error('Please sign in again.');curriculumPage.archive(latest,identity(latest),button.dataset.kind,button.dataset.id);write(latest);render();await popup('Record archived','The record is retained in the local workspace and the change was logged.');}
      else if(action==='curriculum-restore'){curriculumPage.restore(data,identity(data),button.dataset.kind,button.dataset.id);write(data);render();await popup('Record restored','The curriculum or subject is active again.');}
      else if(action==='curriculum-unassign'){if(!await popup('Remove this assignment?','The teacher will no longer have this enrollment/subject assignment. Grades are retained.','warning',true,'Remove assignment','Keep assignment'))return;const latest=read();if(!logged(latest))throw new Error('Please sign in again.');curriculumPage.unassign(latest,identity(latest),button.dataset.user,button.dataset.enrollment,button.dataset.subject);write(latest);render();await popup('Assignment removed','The access change was logged.');}
      else if(action==='enrollment-reset'){clearTimeout(searchTimer);enrollmentPage.reset();go('enrollment');render();}
      else if(action==='enrollment-page'){enrollmentPage.setPage(button.dataset.page);render();}
      else if(action==='enrollment-export'){const quote=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';const rows=[['LRN','Student Name','Strand','Section','School Year','Semester','Enrollment Status','Date Enrolled'],...enrollmentPage.exportRows(data,identity(data))];download('lnvs-enrollments.csv','\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');await popup('CSV download started','The selected or filtered enrollment list has been exported.');}
      else if(action==='enrollment-cancel'){if(!await popup('Cancel this enrollment?','The enrollment will be marked Not Enrolled. Student identity, grades and academic history will be kept.','warning',true,'Yes, cancel enrollment','Keep enrollment'))return;const latest=read();if(!logged(latest))throw Error('Please sign in again.');enrollmentPage.cancel(latest,identity(latest),button.dataset.id);write(latest);render();await popup('Enrollment cancelled','Academic history was retained and the cancellation was logged.');}
      else if(action==='records-page') {recordsPage=Math.max(1,Number(button.dataset.page)||1);render();}
      else if(action==='records-export') {const rows=filtered(data),selected=rows.filter(s=>recordsSelection.has(s.id));csv(selected.length?selected:rows);await popup('CSV download started','The selected or filtered student records have been exported. Use a full backup to preserve grades and academic history.');}
      else if(action==='print') window.print();
      else if(action==='csv'||action==='csv-all') {csv(action==='csv'?filtered(data):sorted(data.students)); await popup('CSV download started','Your student list has been prepared. CSV does not include grades; use a full backup to preserve your workspace.');}
      else if(action==='backup') {download('lnvs-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json'); await popup('Backup download started','Keep this JSON file privately. It contains your students, grades, and local account information.');}
      else if(action==='delete') {
        const student=data.students.find(s=>s.id===button.dataset.id); if(!student) throw new Error('Student not found.');
        if((data.academy.verifications||[]).some(r=>r.student.id===student.id)||data.academy.enrollments.some(e=>e.student_id===student.id&&(Object.keys(data.academy.grades[e.id]||{}).length||data.academy.reports.some(r=>r.enrollment_id===e.id)))||data.academy.enrollments.filter(e=>e.student_id===student.id).length>1)throw new Error('Students with academic history must be retained.');
        if(!await popup('Delete student?',`Delete ${fullName(student)} and all associated grades? This cannot be undone without restoring a backup.`,'warning',true,'Yes, delete student','No, keep student')) return;
        const latest=read(); if(!logged(latest)) throw new Error('Please sign in again.'); latest.students=latest.students.filter(s=>s.id!==student.id); delete latest.grades[student.id]; latest.academy.enrollments=latest.academy.enrollments.filter(e=>e.student_id!==student.id); latest.academy.members=latest.academy.members.filter(m=>m.student_id!==student.id); academic.audit(latest,identity(latest),'Student deleted',null,student,null,'Administrator deletion of record without academic history'); write(latest); go('students'); render(); await popup('Student deleted','The student record and associated grades have been removed from this browser.');
      }
    } catch(error) {await popup('Action unavailable',error.message,'error');}
  });
  async function generateReportCards(data,kind){const original=localStorage.getItem(KEY),refs=await reportCardsPage.generate(data,identity(data),route().params,kind);if(localStorage.getItem(KEY)!==original)throw Error('Another tab changed the workspace. No reports were saved. Try again.');write(data);reportCardsPage.generated(refs);render();await popup('Report cards generated',refs.length+' frozen report snapshots saved on this browser.');}
  window.addEventListener('afterprint',()=>{if(route().name==='report-cards')render();});
  window.addEventListener('hashchange',()=>{verificationPage.resetFocus();teachersPage.resetFocus();schoolYearsPage.resetFocus();reportCardsPage.resetFocus();interventionsPage.resetFocus();analyticsPage.resetFocus();gradesPage.resetFocus();render(); window.scrollTo(0,0);});
  window.addEventListener('storage',event=>{
    if(event.key===KEY) {
      try { if(!logged(read())) {render(); return;} } catch(_) {render(); return;}
      if(app.querySelector('form[data-form="student"],form[data-form="grades"],form[data-form="password"]')) {popup('Workspace changed','Another tab changed the saved workspace. Your current form has been kept open. Check the latest records before saving.','warning');}
      else render();
    }
  });
  render();
})();
