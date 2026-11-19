<?php
// Academic workspace: server-enforced access, enrollment-scoped grades and immutable audit events.
$db->exec('CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), school_year TEXT NOT NULL, strand TEXT NOT NULL, grade_level INTEGER NOT NULL DEFAULT 12, semester INTEGER NOT NULL DEFAULT 1, section TEXT NOT NULL, UNIQUE(student_id,school_year,grade_level,semester));
CREATE TABLE IF NOT EXISTS curriculum (id INTEGER PRIMARY KEY, name TEXT NOT NULL, strand TEXT NOT NULL, grade_level INTEGER NOT NULL, semester INTEGER NOT NULL, school_year TEXT NOT NULL, periods INTEGER NOT NULL DEFAULT 2, UNIQUE(name,strand,grade_level,semester,school_year));
CREATE TABLE IF NOT EXISTS academic_grades (enrollment_id INTEGER NOT NULL REFERENCES enrollments(id), subject_id INTEGER NOT NULL REFERENCES curriculum(id), p1 REAL, p2 REAL, p3 REAL, p4 REAL, PRIMARY KEY(enrollment_id,subject_id));
CREATE TABLE IF NOT EXISTS academic_users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, student_id INTEGER REFERENCES students(id), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS assignments (user_id INTEGER NOT NULL REFERENCES academic_users(id), enrollment_id INTEGER NOT NULL REFERENCES enrollments(id), subject_id INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,enrollment_id,subject_id));
CREATE TABLE IF NOT EXISTS academic_audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, event TEXT NOT NULL, student_id INTEGER, enrollment_id INTEGER, old_value TEXT, new_value TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS corrections (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, enrollment_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, period INTEGER NOT NULL, proposed REAL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT "Pending");
CREATE TABLE IF NOT EXISTS interventions (id INTEGER PRIMARY KEY, enrollment_id INTEGER NOT NULL REFERENCES enrollments(id), note TEXT NOT NULL, status TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS issued_reports (reference TEXT PRIMARY KEY, student_id INTEGER NOT NULL, enrollment_id INTEGER NOT NULL, snapshot TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');
// Preserve legacy records exactly; legacy subjects remain explicitly identified as four-period records.
$db->beginTransaction();
foreach(query('SELECT * FROM students') as $s) {
 if(query('SELECT id FROM enrollments WHERE student_id=?',[$s['id']])->fetchColumn()) continue;
 query('INSERT INTO enrollments(student_id,school_year,strand,section) VALUES (?,?,?,?)',[$s['id'],$s['school_year'],$s['strand'],$s['section']]); $eid=(int)$db->lastInsertId();
 foreach(query('SELECT * FROM grades WHERE student_id=?',[$s['id']])->fetchAll(PDO::FETCH_ASSOC) as $g) {
  query('INSERT OR IGNORE INTO curriculum(name,strand,grade_level,semester,school_year,periods) VALUES (?,?,12,1,?,4)',[$g['subject'],$s['strand'],$s['school_year']]);
  $sid=query('SELECT id FROM curriculum WHERE name=? AND strand=? AND grade_level=12 AND semester=1 AND school_year=?',[$g['subject'],$s['strand'],$s['school_year']])->fetchColumn();
  query('INSERT OR IGNORE INTO academic_grades VALUES (?,?,?,?,?,?)',[$eid,$sid,$g['q1'],$g['q2'],$g['q3'],$g['q4']]);
 }
}
$db->commit();
function aa(string $event, ?int $student, ?int $enrollment, $old, $new, string $reason): void {
 query('INSERT INTO academic_audit(actor,event,student_id,enrollment_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?)',[isset($_SESSION['admin'])?'admin:'.$_SESSION['admin']:'user:'.($_SESSION['academic_user']??0),$event,$student,$enrollment,json_encode($old),json_encode($new),$reason]);
}
function academic_user(): array {
 if(isset($_SESSION['admin'])) return ['role'=>'admin','id'=>0,'username'=>$_SESSION['username']];
 $user=query('SELECT * FROM academic_users WHERE id=? AND active=1',[(int)($_SESSION['academic_user']??0)])->fetch(PDO::FETCH_ASSOC);
 if(!$user || !hash_equals($user['password'],(string)($_SESSION['academic_credential']??''))) return ['role'=>'guest'];
 return $user;
}
function academic_access(array $u,array $e,?int $subject=null,bool $write=false): bool {
 if($u['role']==='admin') return true;
 if($u['role']==='student') return !$write && (int)$u['student_id']===(int)$e['student_id'];
 if(!in_array($u['role'],['teacher','adviser'],true)) return false;
 if($write && $u['role']!=='teacher') return false;
 $sql='SELECT 1 FROM assignments WHERE user_id=? AND enrollment_id=?'; $args=[$u['id'],$e['id']];
 if($subject!==null) { $sql.=$write?' AND subject_id=?':' AND (subject_id=0 OR subject_id=?)'; $args[]=$subject; }
 return (bool)query($sql,$args)->fetchColumn();
}
function academic_subjects(array $e): array { return query('SELECT * FROM curriculum WHERE strand=? AND grade_level=? AND semester=? AND school_year=? ORDER BY name',[$e['strand'],$e['grade_level'],$e['semester'],$e['school_year']])->fetchAll(PDO::FETCH_ASSOC); }
function academic_rows(array $u,array $e): array {
 $rows=[];
 foreach(academic_subjects($e) as $s) {
  if(!academic_access($u,$e,(int)$s['id'])) continue;
  $g=query('SELECT * FROM academic_grades WHERE enrollment_id=? AND subject_id=?',[$e['id'],$s['id']])->fetch(PDO::FETCH_ASSOC) ?: [];
  $values=[]; for($i=1;$i<=(int)$s['periods'];$i++) $values[]=$g['p'.$i]??null;
  $complete=!in_array(null,$values,true); $avg=$complete?array_sum($values)/count($values):null;
  $encoded=array_values(array_filter($values,fn($v)=>$v!==null)); $trend=count($encoded)>1?end($encoded)-$encoded[0]:null;
  $low=count(array_filter($encoded,fn($v)=>$v<75));
  $rows[]=['subject'=>$s,'values'=>$values,'average'=>$avg,'trend'=>$trend,'flag'=>$low?'Low grade':(!$complete?'Incomplete':'On track')];
 }
 return $rows;
}
function academic_grade(array $u,array $e,int $sid,array $values,string $reason): void {
 if(!academic_access($u,$e,$sid,true)) throw new Exception('This subject is not assigned to you.');
 $subject=null; foreach(academic_subjects($e) as $s) if((int)$s['id']===$sid) $subject=$s;
 if(!$subject) throw new Exception('Subject does not match this enrollment curriculum.');
 if(count($values)!==(int)$subject['periods']) throw new Exception('Incorrect grading period count.');
 foreach($values as $v) if($v!==null && (!is_numeric($v)||!is_finite((float)$v)||$v<0||$v>100)) throw new Exception('Grades must be between 0 and 100.');
 $old=query('SELECT * FROM academic_grades WHERE enrollment_id=? AND subject_id=?',[$e['id'],$sid])->fetch(PDO::FETCH_ASSOC);
 if($old && trim($reason)==='') throw new Exception('A reason is required when changing existing grades.');
 $v=array_pad($values,4,null);
 query('INSERT INTO academic_grades VALUES (?,?,?,?,?,?) ON CONFLICT(enrollment_id,subject_id) DO UPDATE SET p1=excluded.p1,p2=excluded.p2,p3=excluded.p3,p4=excluded.p4',[$e['id'],$sid,...$v]);
 aa('Grade saved',(int)$e['student_id'],(int)$e['id'],$old,['subject_id'=>$sid,'values'=>$values],$reason?:'Initial encoding');
}
if(($_GET['page']??'')!=='academic') return;
$u=academic_user(); $notice='';
try {
 if($_SERVER['REQUEST_METHOD']==='POST') {
  if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??''))) throw new Exception('Session expired. Reload this page.');
  $act=$_POST['academic_action']??'';
  if($act==='login') {
   $key=hash('sha256','academic:'.($_SERVER['REMOTE_ADDR']??'local')); $a=query('SELECT * FROM login_attempts WHERE key=?',[$key])->fetch(PDO::FETCH_ASSOC);
   if($a && $a['failures']>=5 && time()-$a['last_attempt']<900) throw new Exception('Too many attempts. Try again in 15 minutes.');
   $account=query('SELECT * FROM academic_users WHERE username=? AND active=1',[trim($_POST['username']??'')])->fetch(PDO::FETCH_ASSOC);
   if(!$account || !password_verify($_POST['password']??'',$account['password'])) { query('INSERT INTO login_attempts VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,last_attempt=excluded.last_attempt',[$key,$a && time()-$a['last_attempt']<900?$a['failures']+1:1,time()]); throw new Exception('Invalid username or password.'); }
   query('DELETE FROM login_attempts WHERE key=?',[$key]); session_regenerate_id(true); unset($_SESSION['admin']); $_SESSION['academic_user']=$account['id']; $_SESSION['academic_credential']=$account['password']; go('?page=academic');
  }
  if($act==='logout') { unset($_SESSION['academic_user'],$_SESSION['admin'],$_SESSION['username']); session_regenerate_id(true); go('?page=academic'); }
  if($u['role']==='guest') throw new Exception('Please sign in.');
  $db->beginTransaction();
  $eid=(int)($_POST['enrollment_id']??0); $e=$eid?query('SELECT * FROM enrollments WHERE id=?',[$eid])->fetch(PDO::FETCH_ASSOC):null;
  if($eid && (!$e || !academic_access($u,$e))) throw new Exception('Enrollment unavailable.');
  if(in_array($act,['curriculum','enroll','user','assign','review','import','revoke','reset_account'],true) && $u['role']!=='admin') throw new Exception('Administrator access required.');
  if($act==='revoke') {
   $uid=(int)($_POST['user_id']??0); query('UPDATE academic_users SET active=0 WHERE id=?',[$uid]); aa('Account disabled',null,null,null,['user_id'=>$uid],'Administrator revocation');
  } elseif($act==='reset_account') {
   $uid=(int)($_POST['user_id']??0); $password=$_POST['password']??''; if(strlen($password)<12) throw new Exception('Use at least 12 characters.'); query('UPDATE academic_users SET password=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$uid]); aa('Account password reset',null,null,null,['user_id'=>$uid],'Administrator password reset');
  } elseif($act==='curriculum') {
   $name=trim($_POST['name']??''); $year=trim($_POST['school_year']??''); $strand=$_POST['strand']??''; $level=(int)($_POST['grade_level']??0); $sem=(int)($_POST['semester']??0); $periods=(int)($_POST['periods']??0);
   if(!$name || strlen($name)>200 || !in_array($strand,$strands,true)||!in_array($level,[11,12],true)||!in_array($sem,[1,2],true)||!in_array($periods,[2,4],true)||!preg_match('/^(\d{4})-(\d{4})$/',$year,$m)||(int)$m[2]!==1+(int)$m[1]) throw new Exception('Enter a valid curriculum scope and consecutive school year.');
   query('INSERT INTO curriculum(name,strand,grade_level,semester,school_year,periods) VALUES (?,?,?,?,?,?)',[$name,$strand,$level,$sem,$year,$periods]); aa('Curriculum created',null,null,null,$_POST,'Administrator configuration');
  } elseif($act==='enroll') {
   $student=query('SELECT * FROM students WHERE id=?',[(int)($_POST['student_id']??0)])->fetch(PDO::FETCH_ASSOC); $year=trim($_POST['school_year']??''); $strand=$_POST['strand']??''; $level=(int)($_POST['grade_level']??0); $sem=(int)($_POST['semester']??0); $section=trim($_POST['section']??'');
   if(!$student||!$section||strlen($section)>100||!in_array($strand,$strands,true)||!in_array($level,[11,12],true)||!in_array($sem,[1,2],true)||!preg_match('/^(\d{4})-(\d{4})$/',$year,$m)||(int)$m[2]!==1+(int)$m[1]) throw new Exception('Invalid enrollment.');
   query('INSERT INTO enrollments(student_id,school_year,strand,grade_level,semester,section) VALUES (?,?,?,?,?,?)',[$student['id'],$year,$strand,$level,$sem,$section]); aa('Enrolled',(int)$student['id'],(int)$db->lastInsertId(),null,$_POST,'New enrollment');
  } elseif($act==='user') {
   $role=$_POST['role']??''; $username=trim($_POST['username']??''); $password=$_POST['password']??''; $student=(int)($_POST['student_id']??0);
   if(!in_array($role,['teacher','adviser','student'],true)||strlen($username)<3||strlen($username)>50||strlen($password)<12) throw new Exception('Valid role, username and password of at least 12 characters required.');
   if($role==='student' && !query('SELECT id FROM students WHERE id=?',[$student])->fetchColumn()) throw new Exception('Select the student identity for portal access.');
   query('INSERT INTO academic_users(username,password,role,student_id) VALUES (?,?,?,?)',[$username,password_hash($password,PASSWORD_DEFAULT),$role,$role==='student'?$student:null]); aa('Account created',$role==='student'?$student:null,null,null,['username'=>$username,'role'=>$role],'Administrator provisioning');
  } elseif($act==='assign') {
   $user=query('SELECT * FROM academic_users WHERE id=?',[(int)($_POST['user_id']??0)])->fetch(PDO::FETCH_ASSOC); $sid=(int)($_POST['subject_id']??0);
   if(!$e||!$user||!in_array($user['role'],['teacher','adviser'],true)) throw new Exception('Select a teacher or adviser and enrollment.');
   $ids=array_column(academic_subjects($e),'id'); if(($user['role']==='adviser' && $sid!==0)||($user['role']==='teacher' && !$sid)||($sid && !in_array($sid,$ids))) throw new Exception('Choose a subject in this enrollment curriculum.');
   query('INSERT INTO assignments VALUES (?,?,?)',[$user['id'],$eid,$sid]); aa('Assignment created',(int)$e['student_id'],$eid,null,['user'=>$user['id'],'subject'=>$sid],'Administrator assignment');
  } elseif($act==='grade') {
   if(!$e) throw new Exception('Select an enrollment.'); $sid=(int)($_POST['subject_id']??0); $values=[]; foreach($_POST['values']??[] as $v) $values[]=trim($v)===''?null:$v;
   academic_grade($u,$e,$sid,$values,trim($_POST['reason']??''));
  } elseif($act==='request') {
   $sid=(int)($_POST['subject_id']??0); $p=(int)($_POST['period']??0); $v=trim($_POST['proposed']??''); $reason=trim($_POST['reason']??''); $subject=null;
   foreach($e?academic_subjects($e):[] as $s) if((int)$s['id']===$sid && academic_access($u,$e,$sid)) $subject=$s;
   if(!$subject||$p<1||$p>$subject['periods']||!$reason||($v!==''&&(!is_numeric($v)||$v<0||$v>100))) throw new Exception('Invalid correction request.');
   query('INSERT INTO corrections(user_id,enrollment_id,subject_id,period,proposed,reason) VALUES (?,?,?,?,?,?)',[$u['id'],$eid,$sid,$p,$v===''?null:$v,$reason]); aa('Correction requested',(int)$e['student_id'],$eid,null,['subject'=>$sid,'period'=>$p,'proposed'=>$v],$reason);
  } elseif($act==='review') {
   $r=query('SELECT * FROM corrections WHERE id=? AND status="Pending"',[(int)($_POST['request_id']??0)])->fetch(PDO::FETCH_ASSOC); if(!$r) throw new Exception('Pending request not found.'); $decision=$_POST['decision']??''; if(!in_array($decision,['Approved','Rejected'],true)) throw new Exception('Invalid decision.');
   if($decision==='Approved') { $re=query('SELECT * FROM enrollments WHERE id=?',[$r['enrollment_id']])->fetch(PDO::FETCH_ASSOC); $row=null; foreach(academic_rows($u,$re) as $rr) if($rr['subject']['id']==$r['subject_id']) $row=$rr; if(!$row) throw new Exception('Subject no longer available.'); $values=$row['values']; $values[$r['period']-1]=$r['proposed']; academic_grade($u,$re,(int)$r['subject_id'],$values,'Approved request #'.$r['id'].': '.$r['reason']); }
   query('UPDATE corrections SET status=? WHERE id=?',[$decision,$r['id']]); aa('Correction '.$decision,null,(int)$r['enrollment_id'],$r,null,$r['reason']);
  } elseif($act==='intervention') {
   if(!$e||!in_array($u['role'],['admin','teacher','adviser'],true)) throw new Exception('Staff access required.'); $note=trim($_POST['note']??''); $status=$_POST['status']??'';
   if(!$note||strlen($note)>2000||!in_array($status,['Open','In progress','Resolved'],true)) throw new Exception('Enter a note and valid status.'); query('INSERT INTO interventions(enrollment_id,note,status,actor) VALUES (?,?,?,?)',[$eid,$note,$status,$u['username']]); aa('Intervention recorded',(int)$e['student_id'],$eid,null,['note'=>$note,'status'=>$status],'Academic support');
  } elseif($act==='issue') {
   if(!$e||!in_array($u['role'],['admin','adviser'],true)) throw new Exception('An administrator or assigned adviser must issue reports.'); $rows=academic_rows($u,$e); if(!$rows) throw new Exception('Configure subjects before issuing a report.');
   $student=query('SELECT * FROM students WHERE id=?',[$e['student_id']])->fetch(PDO::FETCH_ASSOC); $ref=bin2hex(random_bytes(16)); query('INSERT INTO issued_reports(reference,student_id,enrollment_id,snapshot,actor) VALUES (?,?,?,?,?)',[$ref,$e['student_id'],$eid,json_encode(['student'=>$student['last_name'].', '.$student['first_name'],'lrn'=>$student['lrn'],'enrollment'=>$e,'rows'=>$rows]),$u['username']]); aa('Report issued',(int)$e['student_id'],$eid,null,['reference'=>$ref],'Provisional academic report'); $_SESSION['issued_reference']=$ref;
  } elseif($act==='import') {
   if(($_POST['verified']??'')!=='yes') throw new Exception('Confirm that you verified the source records.'); $file=$_FILES['csv']??[];
   if(($file['error']??1)!==UPLOAD_ERR_OK||($file['size']??0)>2000000) throw new Exception('Upload a CSV smaller than 2 MB.'); $handle=fopen($file['tmp_name'],'r'); $header=fgetcsv($handle); if(!$header) throw new Exception('Missing CSV header.'); $header[0]=ltrim($header[0],"\xEF\xBB\xBF");
   if(($_POST['import_kind']??'grades')==='enrollments') {
   if($header!==['lrn','first_name','last_name','sex','birth_date','strand','section','school_year','grade_level','semester']) throw new Exception('Enrollment CSV header must be lrn,first_name,last_name,sex,birth_date,strand,section,school_year,grade_level,semester');
   $count=0;
   while(($line=fgetcsv($handle))!==false) {
    if(count($line)!==10) throw new Exception('Invalid enrollment CSV row.'); $v=array_combine($header,array_map('trim',$line));
    $date=DateTime::createFromFormat('!Y-m-d',$v['birth_date']);
    if(!preg_match('/^\d{12}$/D',$v['lrn'])||!$v['first_name']||!$v['last_name']||!in_array($v['sex'],['Male','Female'],true)||!$date||$date->format('Y-m-d')!==$v['birth_date']||$v['birth_date']>date('Y-m-d')||!in_array($v['strand'],$strands,true)||!$v['section']||!in_array($v['grade_level'],['11','12'],true)||!in_array($v['semester'],['1','2'],true)||!preg_match('/^(\d{4})-(\d{4})$/D',$v['school_year'],$m)||(int)$m[2]!==1+(int)$m[1]) throw new Exception('Invalid enrollment data at row '.($count+2));
    foreach($v as $value) if(strlen($value)>500) throw new Exception('CSV field too long.');
    $student=query('SELECT * FROM students WHERE lrn=?',[$v['lrn']])->fetch(PDO::FETCH_ASSOC);
    if($student) { foreach(['first_name','last_name','sex','birth_date'] as $key) if($student[$key]!==$v[$key]) throw new Exception('Identity mismatch for LRN '.$v['lrn']); $studentId=(int)$student['id']; }
    else { query('INSERT INTO students(lrn,first_name,last_name,sex,birth_date,strand,section,school_year) VALUES (?,?,?,?,?,?,?,?)',array_map(fn($key)=>$v[$key],['lrn','first_name','last_name','sex','birth_date','strand','section','school_year'])); $studentId=(int)$db->lastInsertId(); }
    query('INSERT INTO enrollments(student_id,school_year,strand,grade_level,semester,section) VALUES (?,?,?,?,?,?)',[$studentId,$v['school_year'],$v['strand'],$v['grade_level'],$v['semester'],$v['section']]);
    aa('Enrollment imported',$studentId,(int)$db->lastInsertId(),null,$v,'Verified CSV source'); if(++$count>5000) throw new Exception('Maximum 5000 rows.');
   }
   fclose($handle); $notice=$count.' enrollments imported.';
   } else {
   if($header!==['enrollment_id' ,'subject_id','p1','p2','p3','p4','reason']) throw new Exception('CSV header must be enrollment_id,subject_id,p1,p2,p3,p4,reason');
   $count=0; while(($line=fgetcsv($handle))!==false) { if(count($line)!==7) throw new Exception('Invalid CSV row '.($count+2)); [$ei,$si]=$line; $ie=query('SELECT * FROM enrollments WHERE id=?',[(int)$ei])->fetch(PDO::FETCH_ASSOC); if(!$ie) throw new Exception('Unknown enrollment at row '.($count+2)); $sub=null; foreach(academic_subjects($ie) as $ss) if($ss['id']==$si) $sub=$ss; if(!$sub) throw new Exception('Invalid subject at row '.($count+2)); if((int)$sub['periods']===2 && (trim($line[4])!==''||trim($line[5])!=='')) throw new Exception('Unused periods must be blank.'); $vals=array_map(fn($v)=>trim($v)===''?null:trim($v),array_slice($line,2,(int)$sub['periods'])); academic_grade($u,$ie,(int)$si,$vals,$line[6]?:'Verified CSV import'); if(++$count>5000) throw new Exception('Maximum 5000 rows.'); } fclose($handle); $notice=$count.' verified grade rows imported.'; }
  } else throw new Exception('Unknown action.');
  $db->commit(); $notice=$notice?:'Saved successfully.';
 }
} catch(Throwable $ex) { if($db->inTransaction()) $db->rollBack(); $notice=$ex instanceof PDOException?'Unable to save. Check for duplicate records and valid linked IDs.':$ex->getMessage(); }
function af(string $action): void { echo '<form method="post" enctype="multipart/form-data">'.csrf().'<input type="hidden" name="academic_action" value="'.h($action).'">'; }
function ai(string $label,string $name,string $type='text',string $value=''): void { echo '<label>'.h($label).'<input name="'.h($name).'" type="'.h($type).'" value="'.h($value).'" required></label>'; }
function ae(array $e): string { return '#'.$e['id'].' · '.$e['school_year'].' · Grade '.$e['grade_level'].' · Semester '.$e['semester'].' · '.$e['strand'].' / '.$e['section']; }
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LNVS Academic Workspace</title><link rel="stylesheet" href="style.php?v=6"></head><body><main class="content academic-content"><header class="card no-print"><h1>LNVS Academic Workspace</h1><p>Curriculum, academic history and student support</p><a href="index.php">Administrator workspace</a> · <a href="?page=academic">Academic home</a> · <a href="?page=academic&amp;verify=1">Verify a report</a><?php if($u['role']!=='guest'): ?><p><?=h($u['username'].' · '.$u['role'])?></p><?php af('logout'); ?><button class="button">Sign out of academic account</button></form><?php endif ?></header>
<?php if($notice): ?><p class="notice" role="status"><?=h($notice)?></p><?php endif ?>
<?php if(isset($_GET['verify'])): ?><section class="card"><h2>Verify issued report</h2><form method="get"><input type="hidden" name="page" value="academic"><input type="hidden" name="verify" value="1"><?php ai('Reference','reference','text',$_GET['reference']??''); ?><button class="button">Verify</button></form><?php if(!empty($_GET['reference'])): $report=query('SELECT * FROM issued_reports WHERE reference=?',[$_GET['reference']])->fetch(PDO::FETCH_ASSOC); ?><p><?=$report?'Reference exists. Issued '.h($report['created_at']).'. Compare the document with the issuing school; a reference alone does not authenticate its contents.':'Reference not found.'?></p><?php endif ?></section>
<?php elseif($u['role']==='guest'): ?><section class="card"><h2>Teacher, adviser and student sign in</h2><?php af('login'); ai('Username','username'); ai('Password','password','password'); ?><button class="button">Sign in</button></form><p>Accounts are provisioned by the school administrator.</p></section>
<?php else:
$all=query('SELECT e.*,s.first_name,s.last_name,s.lrn FROM enrollments e JOIN students s ON s.id=e.student_id ORDER BY e.school_year DESC,s.last_name,e.semester')->fetchAll(PDO::FETCH_ASSOC); $visible=array_values(array_filter($all,fn($e)=>academic_access($u,$e)));
$selected=null; foreach($visible as $e) if($e['id']==($_GET['enrollment']??0)) $selected=$e;
?>
<section class="card no-print"><h2>Enrollments and academic support</h2><div class="table-wrap"><table><thead><tr><th>Student</th><th>Enrollment</th><th>Support indicators</th></tr></thead><tbody><?php foreach($visible as $e): $rs=academic_rows($u,$e); $low=count(array_filter($rs,fn($r)=>$r['flag']==='Low grade')); $missing=count(array_filter($rs,fn($r)=>$r['average']===null)); $up=count(array_filter($rs,fn($r)=>$r['trend']!==null&&$r['trend']>0)); $down=count(array_filter($rs,fn($r)=>$r['trend']!==null&&$r['trend']<0)); ?><tr><td><?=h($e['last_name'].', '.$e['first_name'])?></td><td><a href="?page=academic&amp;enrollment=<?=$e['id']?>"><?=h(ae($e))?></a></td><td><?=h(!$rs?'Curriculum not configured':"$low low · $missing incomplete · $up improving · $down declining")?></td></tr><?php endforeach ?></tbody></table></div><p class="muted">Indicators compare first and latest encoded periods. Missing grades may be not yet due; staff should review before acting. Teacher indicators cover assigned subjects only.</p></section>
<?php if($selected): $e=$selected; $rows=academic_rows($u,$e); ?>
<section class="card"><h2><?=h($e['last_name'].', '.$e['first_name'])?></h2><p><?=h(ae($e))?></p><h3>Academic performance</h3><p>Provisional arithmetic averages; passing threshold is an unrounded 75. This is not an official DepEd report or transmutation calculation.</p><?php foreach($rows as $r): $s=$r['subject']; ?><section><h3><?=h($s['name'])?> <small>#<?=$s['id']?></small></h3><p><?=h(implode(' / ',array_map(fn($v)=>$v===null?'Unencoded':num($v),$r['values'])))?> · Average <?=num($r['average'])?> · <?=h($r['flag'])?> · Trend <?=$r['trend']===null?'Insufficient data':num($r['trend'])?></p><?php if(academic_access($u,$e,(int)$s['id'],true)): af('grade'); ?><input type="hidden" name="enrollment_id" value="<?=$e['id']?>"><input type="hidden" name="subject_id" value="<?=$s['id']?>"><div class="form-grid"><?php foreach($r['values'] as $i=>$v): ?><label>Period <?=$i+1?><input aria-label="<?=h($s['name'].' period '.($i+1))?>" name="values[]" type="number" min="0" max="100" step="0.01" value="<?=h($v)?>"></label><?php endforeach ?></div><label>Reason for change<input name="reason" maxlength="1000"></label><button class="button">Save grades</button></form><?php endif ?></section><?php endforeach ?>
<?php if($u['role']!=='teacher'): $complete=count($rows)>0&&!array_filter($rows,fn($r)=>$r['average']===null); ?><p><b>General average: <?=$complete?num(array_sum(array_column($rows,'average'))/count($rows)):'Incomplete'?></b></p><?php endif ?>
<div class="no-print"><?php af('request'); ?><h3>Request a grade correction</h3><input type="hidden" name="enrollment_id" value="<?=$e['id']?>"><?php ai('Subject ID','subject_id','number'); ai('Period','period','number'); ?><label>Proposed grade (blank to clear)<input name="proposed" type="number" min="0" max="100" step="0.01"></label><?php ai('Reason','reason'); ?><button class="button">Submit for administrator review</button></form>
<?php if(in_array($u['role'],['admin','teacher','adviser'],true)): af('intervention'); ?><h3>Record academic support</h3><input type="hidden" name="enrollment_id" value="<?=$e['id']?>"><?php ai('Support plan / follow-up','note'); ?><label>Status<select name="status"><option>Open</option><option>In progress</option><option>Resolved</option></select></label><button class="button">Record intervention</button></form><?php endif ?>
<?php if(in_array($u['role'],['admin','adviser'],true)): af('issue'); ?><input type="hidden" name="enrollment_id" value="<?=$e['id']?>"><button class="button">Issue printable provisional report</button></form><?php endif ?></div></section>
<section class="card"><h2>Student academic timeline</h2><?php foreach($visible as $history): if($history['student_id']==$e['student_id']): ?><p>Enrollment <?=h(ae($history))?></p><?php endif; endforeach ?><?php if($u['role']!=='teacher'): foreach(query('SELECT * FROM academic_audit WHERE student_id=? ORDER BY id DESC',[$e['student_id']]) as $event): ?><p><?=h($event['created_at'].' · '.$event['event'].' · '.$event['reason'])?></p><?php endforeach; endif ?><?php foreach(query('SELECT * FROM interventions WHERE enrollment_id=? ORDER BY id DESC',[$e['id']]) as $item): ?><p><?=h($item['created_at'].' · '.$item['status'].' · '.$item['note'])?></p><?php endforeach ?></section>
<?php endif ?>
<?php if(isset($_SESSION['issued_reference'])): $ref=$_SESSION['issued_reference']; $issued=query('SELECT * FROM issued_reports WHERE reference=?',[$ref])->fetch(PDO::FETCH_ASSOC); $ie=$issued?query('SELECT * FROM enrollments WHERE id=?',[$issued['enrollment_id']])->fetch(PDO::FETCH_ASSOC):null; if($ie&&academic_access($u,$ie)): $snapshot=json_decode($issued['snapshot'],true); ?><section class="card issued-report"><h2>Libertad National Vocational School</h2><h3>Provisional academic report</h3><p><?=h($snapshot['student'].' · LRN '.$snapshot['lrn'])?></p><p><?=h(ae($snapshot['enrollment']))?></p><table><thead><tr><th>Subject</th><th>Periods</th><th>Average</th><th>Remarks</th></tr></thead><tbody><?php foreach($snapshot['rows'] as $r): ?><tr><td><?=h($r['subject']['name'])?></td><td><?=h(implode(' / ',array_map(fn($v)=>$v===null?'Incomplete':num($v),$r['values'])))?></td><td><?=num($r['average'])?></td><td><?=$r['average']===null?'Incomplete':($r['average']>=75?'Passed':'Below passing')?></td></tr><?php endforeach ?></tbody></table><p>Reference: <?=h($ref)?> · Issued <?=h($issued['created_at'])?></p><p>Verify this reference through the school's Academic Workspace. Provisional arithmetic summary pending school approval of grading and report format.</p><p class="no-print">Use Ctrl+P to print this frozen report snapshot.</p></section><?php endif; endif ?>
<?php if($u['role']==='admin'): ?>
<section class="card no-print"><h2>Curriculum management</h2><?php af('curriculum'); ai('Subject name','name'); ?><label>Strand<select name="strand"><?php foreach($strands as $st) echo '<option>'.h($st).'</option>'; ?></select></label><?php ai('Grade level (11 or 12)','grade_level','number','12'); ai('Semester (1 or 2)','semester','number','1'); ai('School year','school_year','text','2026-2027'); ai('Grading periods (2 or 4)','periods','number','2'); ?><button class="button">Add scoped subject</button></form><table><tr><th>ID</th><th>Subject</th><th>Scope</th></tr><?php foreach(query('SELECT * FROM curriculum ORDER BY school_year DESC,strand,name') as $s): ?><tr><td><?=$s['id']?></td><td><?=h($s['name'])?></td><td><?=h($s['school_year'].' / '.$s['strand'].' / Grade '.$s['grade_level'].' / Semester '.$s['semester'].' / '.$s['periods'].' periods')?></td></tr><?php endforeach ?></table></section>
<section class="card no-print"><h2>Add enrollment to a permanent student identity</h2><?php af('enroll'); ?><label>Student<select name="student_id"><?php foreach(query('SELECT * FROM students ORDER BY last_name') as $s) echo '<option value="'.$s['id'].'">'.h('#'.$s['id'].' '.$s['last_name'].', '.$s['first_name'].' · '.$s['lrn']).'</option>'; ?></select></label><?php ai('School year','school_year','text','2026-2027'); ai('Grade level','grade_level','number','12'); ai('Semester','semester','number','1'); ?><label>Strand<select name="strand"><?php foreach($strands as $st) echo '<option>'.h($st).'</option>'; ?></select></label><?php ai('Section','section'); ?><button class="button">Add enrollment</button></form><p>Create new student identities using administrator registration. Existing enrollment history stays intact when identity details change.</p></section>
<section class="card no-print"><h2>Teacher, adviser and student accounts</h2><?php af('user'); ai('Username','username'); ai('Temporary password (12+ characters)','password','password'); ?><label>Role<select name="role"><option>teacher</option><option>adviser</option><option>student</option></select></label><label>Student ID (student portal accounts only)<input name="student_id" type="number"></label><button class="button">Create account</button></form><table><tr><th>ID</th><th>Username</th><th>Role</th></tr><?php foreach(query('SELECT id,username,role FROM academic_users') as $user): ?><tr><td><?=$user['id']?></td><td><?=h($user['username'])?></td><td><?=h($user['role'])?></td></tr><?php endforeach ?></table><?php af('assign'); ?><h3>Assign access</h3><?php ai('Teacher / adviser user ID','user_id','number'); ai('Enrollment ID','enrollment_id','number'); ai('Subject ID (0 for whole-enrollment adviser)','subject_id','number','0'); ?><button class="button">Assign</button></form></section>
<section class="card no-print"><h2>Account maintenance</h2><?php af('revoke'); ai('User ID to disable','user_id','number'); ?><button class="button">Disable account access</button></form><?php af('reset_account'); ai('User ID','user_id','number'); ai('New password (12+ characters)','password','password'); ?><button class="button">Reset account password</button></form></section>
<section class="card no-print"><h2>Verified enrollment and grade import</h2><p>Export Excel as CSV UTF-8. Header: enrollment_id,subject_id,p1,p2,p3,p4,reason. Leave unused periods blank. All rows are validated and saved together; any invalid row rolls back the entire file.</p><?php af('import'); ?><label>Import type<select name="import_kind"><option value="grades">Grades</option><option value="enrollments">Enrollments</option></select></label><p>Enrollment header: lrn,first_name,last_name,sex,birth_date,strand,section,school_year,grade_level,semester. Existing LRNs must match the permanent identity.</p><label>CSV<input type="file" name="csv" accept=".csv,text/csv" required></label><label><input type="checkbox" name="verified" value="yes" required> I verified these source records</label><button class="button">Import verified grades</button></form></section>
<section class="card no-print"><h2>Correction review</h2><?php foreach(query('SELECT * FROM corrections ORDER BY id DESC') as $r): ?><p><?=h('#'.$r['id'].' · Enrollment '.$r['enrollment_id'].' · Subject '.$r['subject_id'].' · Period '.$r['period'].' · Proposed '.($r['proposed']??'blank').' · '.$r['reason'].' · '.$r['status'])?></p><?php if($r['status']==='Pending'): af('review'); ?><input type="hidden" name="request_id" value="<?=$r['id']?>"><button name="decision" value="Approved" class="button">Approve</button> <button name="decision" value="Rejected" class="button secondary">Reject</button></form><?php endif; endforeach ?></section>
<section class="card no-print"><h2>Audit trail</h2><div class="table-wrap"><table><tr><th>Time / actor</th><th>Event / reason</th><th>Original</th><th>New</th></tr><?php foreach(query('SELECT * FROM academic_audit ORDER BY id DESC LIMIT 300') as $a): ?><tr><td><?=h($a['created_at'].' '.$a['actor'])?></td><td><?=h($a['event'].' · '.$a['reason'])?></td><td><pre><?=h($a['old_value'])?></pre></td><td><pre><?=h($a['new_value'])?></pre></td></tr><?php endforeach ?></table></div></section>
<?php endif; endif ?></main></body></html>
<?php exit;
