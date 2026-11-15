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
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blank = () => ({version:1, admin:null, students:[], grades:{}});
  const num = value => value === null ? '—' : Number(value).toFixed(2);
  const fullName = s => `${s.last_name}, ${s.first_name}${s.middle_name ? ' '+s.middle_name : ''}`;
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
    return (currentAccount(store)||store.accounts[0])?.data || blank();
  }
  function saveStore(store) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (_) { throw new Error('Unable to save in this browser. Storage may be full or disabled. Export a backup and free some browser storage before trying again.'); }
  }
  function write(data) {
    const store=readStore(), account=currentAccount(store);
    if(!account || account.data.admin.hash!==sessionStorage.getItem(SESSION)) throw new Error('Please sign in before saving changes.');
    if(store.accounts.some(other=>other.id!==account.id && other.data.admin.username.toLowerCase()===data.admin.username.toLowerCase())) throw new Error('Another local account already uses the username in this backup. Sign in to that account before restoring it.');
    account.data=data;
    saveStore(store);
    sessionStorage.setItem(ACTIVE,account.id);
  }
  function logged(data) {
    return !!data.admin && !!currentAccount(readStore()) && sessionStorage.getItem(SESSION) === data.admin.hash;
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
    return data.students.flatMap(s => studentAverages(data,s.id)).filter(v => v!==null);
  }
  function generalAverage(data, id) {
    const a=studentAverages(data,id);
    return a.every(v=>v!==null) ? a.reduce((x,y)=>x+y,0)/a.length : null;
  }
  function sorted(students) {
    return [...students].sort((a,b)=>fullName(a).localeCompare(fullName(b)));
  }
  function filtered(data) {
    const term=filters.search.toLowerCase().trim();
    return sorted(data.students.filter(s => (!term || `${s.first_name} ${s.last_name} ${s.lrn} ${s.section}`.toLowerCase().includes(term)) && (!filters.strand || s.strand===filters.strand) && (!filters.year || s.school_year===filters.year)));
  }
  function input(label, name, value='', type='text', required=false, extra='') {
    return `<label>${h(label)}${required?' *':''}<input type="${type}" name="${h(name)}" value="${h(value)}" ${required?'required':''} ${extra} maxlength="500"></label>`;
  }
  function select(label,name,options,value='',all='Select an option',required=false) {
    return `<label>${h(label)}${required?' *':''}<select name="${h(name)}" ${required?'required':''}><option value="">${h(all)}</option>${options.map(v=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(v)}</option>`).join('')}</select></label>`;
  }
  function auth(data) {
    const setup=route().name==='signup';
    document.title=(setup?'Create account':'Login')+' | LNVS';
    app.innerHTML=`<main class="auth"><div class="brand">${schoolBrand()}</div><section class="card"><div class="auth-tabs" aria-label="Account access"><a href="#login" class="${setup?'':'active'}" ${setup?'':'aria-current="page"'}>Login</a><a href="#signup" class="${setup?'active':''}" ${setup?'aria-current="page"':''}>Create account</a></div><span class="eyebrow">BROWSER WORKSPACE</span><h1>${setup?'Create your account':'Welcome back'}</h1><p class="muted">${setup?'Create a local account with its own student records and grades.':'Log in to your saved account on this browser.'}</p><form data-form="${setup?'setup':'login'}">${input('Username','username','','text',true,'autocomplete="username" minlength="3" maxlength="50"')}${input('Password','password','','password',true,`${setup?'minlength="12"':''} autocomplete="${setup?'new-password':'current-password'}"`)}${setup?input('Confirm password','confirm','','password',true,'minlength="12" autocomplete="new-password"'):''}<button class="button wide">${setup?'Create account':'Login'} &rarr;</button></form><p class="auth-prompt">${setup?'Already have an account? <a href="#login">Login</a>':'New here? <a href="#signup">Create an account</a>'}</p>${logged(data)?'<p class="auth-prompt"><a href="#dashboard">Back to your workspace</a></p>':''}<p class="local-note"><b>Accounts stay on this browser.</b> Each local account has separate records. Local login is a convenience lock, not server security; records are not encrypted. Export backups regularly.</p></section><p class="muted center">Your records are never sent to GitHub or a database server.</p></main>`;
  }
  function layout(data,title,active,body,action='') {
    const nav=[['dashboard','&#9707;','Dashboard'],['students','&#9636;','Student records'],['register','&#65291;','Registration'],['grades','&#9638;','Grades management'],['reports','&#9719;','Reports']];
    document.title=title+' | LNVS Student Records';
    app.innerHTML=`<aside class="sidebar"><a class="brand" href="#dashboard">${schoolBrand()}</a><span class="nav-label">LOCAL WORKSPACE</span><nav>${nav.map(([key,icon,label])=>`<a class="${active===key?'active':''}" href="#${key}"><span>${icon}</span>${label}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="#settings">&#9881; Account &amp; backups</a><button class="logout" data-action="logout">&#8599; Sign out</button><div class="admin"><b>${h(data.admin.username.slice(0,1).toUpperCase())}</b><span>${h(data.admin.username)}<small>Local administrator</small></span></div></div></aside><main class="main"><header class="topbar"><span>Browser workspace / ${h(title)}</span><span class="badge">Grade 12</span></header><div class="content"><div class="page-heading"><div><span class="eyebrow">STUDENT RECORD MANAGEMENT</span><h1>${h(title)}</h1><p>Libertad National Vocational School &middot; Your local Grade 12 workspace</p></div>${action}</div>${body}<footer>LNVS Gradebook <span>Browser storage &middot; No server database</span></footer></div></main>`;
  }
  function table(students,grades=false) {
    if (!students.length) return '<div class="empty"><h3>No students found</h3><p>Register a student or adjust your filters.</p><a class="button secondary" href="#register">Register a student</a></div>';
    return `<div class="table-wrap"><table><thead><tr><th>Student name</th><th>LRN</th><th>Strand / Section</th><th>School year</th><th>Actions</th></tr></thead><tbody>${students.map(s=>`<tr><td><b>${h(fullName(s))}</b><small>${h(s.email)}</small></td><td>${h(s.lrn)}</td><td><span class="badge">${h(s.strand)}</span> ${h(s.section)}</td><td>${h(s.school_year)}</td><td class="actions"><a href="#${grades?'encode':'profile'}?id=${encodeURIComponent(s.id)}">${grades?'Encode grades':'View'}</a><a href="#edit?id=${encodeURIComponent(s.id)}">Edit</a><a class="danger" href="#profile?id=${encodeURIComponent(s.id)}" data-action="delete" data-id="${h(s.id)}">Delete</a></td></tr>`).join('')}</tbody></table></div>`;
  }
  function stats(data) {
    const averages=completeAverages(data);
    const mean=averages.length?averages.reduce((a,b)=>a+b,0)/averages.length:null;
    return `<div class="stats">${[['Total students',data.students.length,'Registered in Grade 12','&#9817;'],['Active strands',new Set(data.students.map(s=>s.strand)).size,'Academic & career pathways','&#9637;'],['Sections',new Set(data.students.map(s=>s.section)).size,'Across all school years','&#9638;'],['Average grade',num(mean),'Completed subject averages','&#8599;']].map(([label,value,help,icon])=>`<article class="card stat"><span>${h(label)}<b>${icon}</b></span><strong>${h(value)}</strong><small>${h(help)}</small></article>`).join('')}</div>`;
  }
  function insights(data) {
    const averages=completeAverages(data), passing=averages.filter(v=>v>=75).length;
    const encoded=data.students.reduce((count,s)=>count+Object.values(data.grades[s.id]||{}).filter(v=>v.some(g=>g!==null)).length,0);
    return `<div class="two-cols"><section class="card"><div class="card-heading"><h2>Strand distribution</h2><span class="muted">${data.students.length} students</span></div>${STRANDS.map(strand=>{ const count=data.students.filter(s=>s.strand===strand).length; return `<div class="distribution"><div><span>${h(strand)}</span><b>${count}</b></div><meter min="0" max="${Math.max(1,data.students.length)}" value="${count}">${count}</meter></div>`; }).join('')}</section><section class="card"><div class="card-heading"><h2>Academic overview</h2><span class="badge">All years</span></div>${[['Completed subject grades',averages.length],['Passing subjects (≥ 75)',passing],['Below passing (< 75)',averages.length-passing],['Incomplete encoded subjects',encoded-averages.length]].map(([label,v])=>`<div class="summary-item"><span>${h(label)}</span><strong>${v}</strong></div>`).join('')}<p class="muted help">A subject average requires four quarterly grades. General averages require all seven subjects. Blank grades are unencoded.</p><a class="text-link" href="#grades">Manage grades &rarr;</a></section></div>`;
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
    return `<div class="print-heading">${schoolBrand()}</div><section class="card profile"><div class="card-heading"><div><span class="eyebrow">GRADE 12 &middot; ${h(student.school_year)}</span><h2>${h(fullName(student))}</h2><p class="muted">LRN ${h(student.lrn)} &middot; ${h(student.strand+' / '+student.section)}</p></div><div class="actions no-print"><a class="button secondary" href="#edit?id=${id}">Edit student</a><a class="button secondary" href="#${editing?'profile':'encode'}?id=${id}">${editing?'View profile':'Encode grades'}</a>${editing?'':'<button class="button secondary" data-action="print">Print profile</button>'}</div></div>${editing?'':`<div class="details">${[['sex','Sex'],['birth_date','Birth date'],['email','Email'],['phone','Contact number'],['address','Address'],['guardian','Guardian'],['guardian_phone','Guardian contact']].map(([key,label])=>`<div><small>${h(label)}</small><b>${h(student[key]||'—')}</b></div>`).join('')}</div>`}</section><section class="card"><h2>Quarterly grades</h2><p class="muted">Average = (Q1 + Q2 + Q3 + Q4) / 4. Passing grade: 75.</p>${editing?`<form data-form="grades"><input type="hidden" name="id" value="${h(student.id)}">`:''}${gradeTable(data,student,editing)}${editing?'<div class="form-footer"><span class="muted">Leave unencoded quarters blank.</span><button class="button">Save quarterly grades</button></div></form>':''}</section>`;
  }
  function reports(data) {
    const groups=new Map();
    for(const s of data.students) { const key=s.school_year+'|'+s.strand; const row=groups.get(key)||{year:s.school_year,strand:s.strand,male:0,female:0,total:0}; row[s.sex==='Male'?'male':'female']++; row.total++; groups.set(key,row); }
    return stats(data)+insights(data)+`<section class="card"><div class="card-heading"><h2>Enrollment summary</h2><button class="button secondary" data-action="csv-all">Export all students</button></div><div class="table-wrap"><table><thead><tr><th>School year</th><th>Strand</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>${[...groups.values()].sort((a,b)=>b.year.localeCompare(a.year)||a.strand.localeCompare(b.strand)).map(r=>`<tr><td>${h(r.year)}</td><td>${h(r.strand)}</td><td>${r.male}</td><td>${r.female}</td><td>${r.total}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Register students to see enrollment summaries.</td></tr>'}</tbody></table></div></section>`;
  }
  function settings(data) {
    return `<div class="settings-stack"><section class="card"><h2>Back up your workspace</h2><p class="muted">A full JSON backup includes your local account, students, and grades. Store it privately. CSV is useful for student lists, but it does not include your account or grades.</p><div class="backup-actions"><button class="button" data-action="backup">Download full backup</button><button class="button secondary" data-action="csv-all">Download students CSV</button></div><hr><h2>Restore a backup</h2><p class="muted">Restore a backup on this browser or a new device. Restoring replaces this account?s records and signs you out. Other local accounts are kept. Use the password from the restored backup to sign in.</p><form data-form="restore"><label>Gradebook backup (.json)<input type="file" name="backup" accept="application/json,.json" required></label><button class="button secondary">Restore backup</button></form></section><section class="card"><h2>Change local password</h2><p class="muted">Signed in as ${h(data.admin.username)}. Use at least 12 characters.</p><form data-form="password">${input('Current password','current','','password',true,'autocomplete="current-password"')}${input('New password','password','','password',true,'minlength="12" autocomplete="new-password"')}${input('Confirm new password','confirm','','password',true,'minlength="12" autocomplete="new-password"')}<button class="button">Update password</button></form></section><section class="card"><h2>Account access</h2><p class="muted">Switch accounts or create another local account with a separate student workspace.</p><div class="backup-actions"><a class="button secondary" href="#login">Login to another account</a><a class="button secondary" href="#signup">Create account</a></div></section><section class="card"><h2>About browser storage</h2><p class="muted">This is a working local application, not a server database. Your information stays in this browser profile on this site. It is not shared with other devices, browsers, or administrators. The local sign-in does not encrypt the records or protect them from someone with access to this browser or its developer tools. Keep backups and use a trusted device.</p></section></div>`;
  }
  function render() {
    try {
      const data=read();
      if(!logged(data) || ['login','signup'].includes(route().name)) { auth(data); return; }
      const {name,params}=route();
      const student=data.students.find(s=>s.id===params.get('id'));
      const add='<a class="button" href="#register">&#65291; Register student</a>';
      if(name==='dashboard') layout(data,'Dashboard','dashboard',stats(data)+insights(data)+`<section class="card"><div class="card-heading"><h2>Recently registered</h2><a class="text-link" href="#students">View all students &rarr;</a></div>${table([...data.students].reverse().slice(0,5))}</section>`,add);
      else if(name==='students'||name==='grades') { const rows=filtered(data); layout(data,name==='grades'?'Grades management':'Student records',name,`<section class="card">${filterForm()}<div class="card-heading"><span class="muted">${rows.length} students</span><button class="button secondary" data-action="csv">Export filtered CSV</button></div>${table(rows,name==='grades')}</section>`,add); }
      else if(name==='register'||name==='edit') layout(data,name==='edit'?'Edit student':'Student registration','register',name==='edit'&&!student?'<section class="card"><h2>Student not found</h2><a href="#students">Return to records</a></section>':studentForm(student));
      else if(name==='profile'||name==='encode') layout(data,name==='encode'?'Grades management':'Student profile',name==='encode'?'grades':'students',student?profile(data,student,name==='encode'):'<section class="card"><h2>Student not found</h2><a href="#students">Return to records</a></section>');
      else if(name==='reports') layout(data,'Reports','reports',reports(data));
      else if(name==='settings') layout(data,'Account & backups','settings',settings(data));
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
      for(const subject of SUBJECTS) if(Object.hasOwn(rows,subject)) {
        const values=rows[subject];
        if(!Array.isArray(values)||values.length!==4||values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100))) throw new Error('The backup contains invalid quarterly grades.');
        clean.grades[s.id][subject]=[...values];
      }
    }
    return clean;
  }
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
        if(readStore().accounts.some(account=>account.data.admin.username.toLowerCase()===username.toLowerCase())) throw new Error('That username already exists on this browser. Choose another username or log in.');
        const admin=await makeAdmin(username,password);
        const store=readStore();
        if(store.accounts.some(account=>account.data.admin.username.toLowerCase()===username.toLowerCase())) throw new Error('That username was just registered in another tab. Choose another username or log in.');
        data=blank(); data.admin=admin;
        const id=crypto.randomUUID(); store.accounts.push({id,data}); saveStore(store);
        sessionStorage.setItem(ACTIVE,id); sessionStorage.setItem(SESSION,admin.hash); filters={search:'',strand:'',year:''}; go('dashboard'); render(); await popup('Account created','Your local account is ready with an empty student workspace.'); return;
      }
      if(kind==='login') {
        const username=String(fd.get('username')).trim().toLowerCase();
        const account=readStore().accounts.find(account=>account.data.admin.username.toLowerCase()===username);
        if(!account || await passwordHash(String(fd.get('password')),account.data.admin.salt)!==account.data.admin.hash) throw new Error('Invalid username or password.');
        const latest=readStore().accounts.find(item=>item.id===account.id);
        if(!latest || latest.data.admin.hash!==account.data.admin.hash) throw new Error('This account changed in another tab. Try logging in again.');
        sessionStorage.setItem(ACTIVE,account.id); sessionStorage.setItem(SESSION,account.data.admin.hash); filters={search:'',strand:'',year:''}; go('dashboard'); render(); await popup('Login successful','Welcome back to your local student workspace.'); return;
      }
      if(!logged(data)) throw new Error('Please sign in before making changes.');
      if(kind==='filter') { filters={search:String(fd.get('search')).trim(),strand:String(fd.get('strand')),year:String(fd.get('year')).trim()}; render(); return; }
      if(kind==='student') {
        const id=String(fd.get('id')||''), s={};
        for(const key of FIELDS) s[key]=String(fd.get(key)||'').trim();
        validateStudent(s);
        if(data.students.some(student=>student.lrn===s.lrn&&student.id!==id)) throw new Error('That LRN is already registered.');
        if(id) { const index=data.students.findIndex(student=>student.id===id); if(index<0) throw new Error('Student not found.'); data.students[index]={...data.students[index],...s}; }
        else { s.id=crypto.randomUUID(); s.created_at=new Date().toISOString(); data.students.push(s); }
        write(data); go('profile?id='+encodeURIComponent(id||s.id)); render(); await popup(id?'Record updated':'Student created',id?'Student information has been saved on this browser.':'The student has been registered on this browser.'); return;
      }
      if(kind==='grades') {
        const id=String(fd.get('id')); if(!data.students.some(s=>s.id===id)) throw new Error('Student not found.');
        const rows={};
        SUBJECTS.forEach((subject,i)=>{rows[subject]=[0,1,2,3].map(q=>{const raw=String(fd.get(`g${i}_${q}`)||'').trim(); if(raw==='') return null; const value=Number(raw); if(!Number.isFinite(value)||value<0||value>100) throw new Error('Grades must be between 0 and 100.'); return Math.round(value*100)/100;});});
        data.grades[id]=rows; write(data); render(); await popup('Grades saved','Quarterly grades and averages have been saved on this browser.'); return;
      }
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
    event.preventDefault(); if(busy) return;
    try {
      const data=read(); if(!logged(data)) {render(); return;}
      const action=button.dataset.action;
      if(action==='logout') { if(!await popup('Sign out?','Are you sure you want to sign out of your local account?','warning',true,'Yes, sign out','No, stay signed in')) return; sessionStorage.removeItem(SESSION); sessionStorage.removeItem(ACTIVE); filters={search:'',strand:'',year:''}; go('login'); render(); await popup('Logout successful','You have been signed out. Your saved records remain on this browser.'); }
      else if(action==='reset-filters') {filters={search:'',strand:'',year:''}; render();}
      else if(action==='print') window.print();
      else if(action==='csv'||action==='csv-all') {csv(action==='csv'?filtered(data):sorted(data.students)); await popup('CSV download started','Your student list has been prepared. CSV does not include grades; use a full backup to preserve your workspace.');}
      else if(action==='backup') {download('lnvs-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json'); await popup('Backup download started','Keep this JSON file privately. It contains your students, grades, and local account information.');}
      else if(action==='delete') {
        const student=data.students.find(s=>s.id===button.dataset.id); if(!student) throw new Error('Student not found.');
        if(!await popup('Delete student?',`Delete ${fullName(student)} and all associated grades? This cannot be undone without restoring a backup.`,'warning',true,'Yes, delete student','No, keep student')) return;
        const latest=read(); if(!logged(latest)) throw new Error('Please sign in again.'); latest.students=latest.students.filter(s=>s.id!==student.id); delete latest.grades[student.id]; write(latest); go('students'); render(); await popup('Student deleted','The student record and associated grades have been removed from this browser.');
      }
    } catch(error) {await popup('Action unavailable',error.message,'error');}
  });
  window.addEventListener('hashchange',()=>{render(); window.scrollTo(0,0);});
  window.addEventListener('storage',event=>{
    if(event.key===KEY) {
      try { if(!logged(read())) {render(); return;} } catch(_) {render(); return;}
      if(app.querySelector('form[data-form="student"],form[data-form="grades"],form[data-form="password"]')) {popup('Workspace changed','Another tab changed the saved workspace. Your current form has been kept open. Check the latest records before saving.','warning');}
      else render();
    }
  });
  render();
})();
