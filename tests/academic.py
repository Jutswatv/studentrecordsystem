"""Isolated PHP integration checks; never opens storage/records.sqlite."""
import contextlib, http.cookiejar, pathlib, re, shutil, socket, sqlite3, subprocess, tempfile, time, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='lnvs-academic-') as temp:
    root=pathlib.Path(temp)
    for name in ['app.php','index.php','academic.php','style.css','theme.css']:
        shutil.copy(ROOT/name,root/name)
    shutil.copytree(ROOT/'public',root/'public'); (root/'storage').mkdir()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}/'
    server=subprocess.Popen(['php','-d','extension=pdo_sqlite','-S',f'127.0.0.1:{port}','-t',str(root/'public')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        def client(): return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        admin=client()
        def get(c,path='index.php'): return c.open(base+path).read().decode()
        def post(c,fields,path='index.php?page=academic'):
            html=get(c,'index.php?page=register' if fields.get('action')=='save_student' else path); token=re.search(r'name="csrf" value="([a-f0-9]+)"',html)
            assert token, html[:500]
            fields={**fields,'csrf':token[1]}
            return c.open(base+path,urllib.parse.urlencode(fields,doseq=True).encode()).read().decode()
        for i in range(60):
            try: get(admin); break
            except OSError: time.sleep(.1)
        post(admin,dict(action='setup',username='schooladmin',password='test-password-1234',confirm='test-password-1234'),'index.php')
        fields=dict(action='save_student',lrn='123456789012',first_name='Test',last_name='Learner',middle_name='',sex='Female',birth_date='2008-01-01',strand='STEM',section='A',school_year='2026-2027',email='',phone='',address='',guardian='',guardian_phone='')
        post(admin,fields,'index.php')
        html=get(admin,'index.php?page=academic'); assert 'Test' in html
        db=sqlite3.connect(root/'storage/records.sqlite')
        eid=db.execute('select id from enrollments').fetchone()[0]
        def act(action,**kw): return post(admin,dict(academic_action=action,**kw))
        html=act('curriculum',name='Calculus',strand='STEM',grade_level=12,semester=1,school_year='2026-2027',periods=2); assert 'Saved successfully' in html
        sid=db.execute('select id from curriculum').fetchone()[0]
        html=act('grade',enrollment_id=eid,subject_id=sid,**{'values[]':['70','85']},reason='Initial'); assert 'Saved successfully' in html
        assert db.execute('select p1,p2 from academic_grades').fetchone()==(70,85)
        html=act('grade',enrollment_id=eid,subject_id=sid,**{'values[]':['80','85']},reason=''); assert 'reason is required' in html
        assert db.execute('select p1 from academic_grades').fetchone()[0]==70
        act('enroll',student_id=1,strand='STEM',grade_level=12,semester=2,school_year='2026-2027',section='B')
        assert db.execute('select count(*) from enrollments').fetchone()[0]==2
        assert db.execute('select count(*) from students').fetchone()[0]==1
        for role in ['teacher','adviser','student']:
            act('user',username=role+'test',password='test-password-1234',role=role,student_id=1)
        teacherid=db.execute('select id from academic_users where role="teacher"').fetchone()[0]
        act('assign',user_id=teacherid,enrollment_id=eid,subject_id=sid)
        teacher=client(); post(teacher,dict(academic_action='login',username='teachertest',password='test-password-1234'))
        html=get(teacher,'index.php?page=academic&enrollment='+str(eid)); assert 'Calculus' in html and 'Curriculum management' not in html
        html=post(teacher,dict(academic_action='curriculum',name='Unauthorized')); assert 'Administrator access required' in html
        html=post(teacher,dict(academic_action='grade',enrollment_id=eid+1,subject_id=sid,**{'values[]':['99','99']},reason='unauthorized')); assert 'Enrollment unavailable' in html
        student=client();post(student,dict(academic_action='login',username='studenttest',password='test-password-1234'))
        html=post(student,dict(academic_action='grade',enrollment_id=eid,subject_id=sid,**{'values[]':['99','99']},reason='unauthorized')); assert 'not assigned' in html
        post(student,dict(academic_action='request',enrollment_id=eid,subject_id=sid,period=1,proposed=80,reason='Verified source grade'))
        rid=db.execute('select id from corrections').fetchone()[0]
        act('review',request_id=rid,decision='Approved')
        assert db.execute('select p1 from academic_grades').fetchone()[0]==80
        act('intervention',enrollment_id=eid,note='Follow up next week',status='Open')
        html=act('issue',enrollment_id=eid); assert 'Provisional academic report' in html
        ref=db.execute('select reference from issued_reports').fetchone()[0]
        guest=client(); html=get(guest,'index.php?page=academic&verify=1&reference='+ref); assert 'Reference exists' in html and 'Learner' not in html
        assert db.execute('select count(*) from academic_audit').fetchone()[0]>=10
        # Missing CSRF never writes.
        before=db.execute('select count(*) from curriculum').fetchone()[0]
        html=admin.open(base+'index.php?page=academic',b'academic_action=curriculum&name=forged').read().decode(); assert 'Session expired' in html
        assert db.execute('select count(*) from curriculum').fetchone()[0]==before
        def upload(kind, body):
            html=get(admin,'index.php?page=academic'); token=re.search(r'name="csrf" value="([a-f0-9]+)"',html)[1]
            boundary='lnvs-test-boundary'
            chunks=[]
            for key,value in dict(csrf=token,academic_action='import',import_kind=kind,verified='yes').items():
                chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n')
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="csv"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n{body}\r\n--{boundary}--\r\n')
            req=urllib.request.Request(base+'index.php?page=academic',data=''.join(chunks).encode(),headers={'Content-Type':f'multipart/form-data; boundary={boundary}'})
            return admin.open(req).read().decode()
        header='enrollment_id,subject_id,p1,p2,p3,p4,reason\n'
        html=upload('grades',header+f'{eid},{sid},88,90,,,verified\n{eid},99999,100,100,,,invalid\n')
        assert 'Invalid subject' in html
        assert db.execute('select p1 from academic_grades').fetchone()[0]==80, 'Import must roll back valid preceding rows'
        html=upload('grades',header+f'{eid},{sid},88,90,,,verified\n'); assert '1 verified grade rows imported' in html
        header='lrn,first_name,last_name,sex,birth_date,strand,section,school_year,grade_level,semester\n'
        html=upload('enrollments',header+'123456789012,Test,Learner,Female,2008-01-01,STEM,C,2027-2028,12,1\n')
        assert '1 enrollments imported' in html
        assert db.execute('select count(*) from students').fetchone()[0]==1
        html=upload('enrollments',header+'123456789012,Wrong,Learner,Female,2008-01-01,STEM,C,2028-2029,12,1\n')
        assert 'Identity mismatch' in html
        # Simulate an untouched pre-upgrade record; migration preserves its values and is idempotent.
        db.execute("insert into students(lrn,first_name,last_name,sex,birth_date,strand,section,school_year) values ('999999999999','Legacy','Record','Male','2008-01-01','ABM','Old','2025-2026')")
        legacy=db.execute("select id from students where lrn='999999999999'").fetchone()[0]
        db.execute('insert into grades values (?,?,?,?,?,?)',(legacy,'Legacy Subject',74.99,75,80,None)); db.commit()
        get(admin,'index.php?page=academic'); get(admin,'index.php?page=academic')
        assert db.execute('select count(*) from enrollments where student_id=?',(legacy,)).fetchone()[0]==1
        assert db.execute('select p1,p2,p3,p4 from academic_grades ag join enrollments e on e.id=ag.enrollment_id where e.student_id=?',(legacy,)).fetchone()==(74.99,75,80,None)
        db.close()
        print('PASS: migration, scoped curriculum, enrollment history, audited grades, role restrictions, correction approval, intervention, frozen report, private verification, CSRF')
    finally:
        server.terminate(); server.wait(timeout=10)
