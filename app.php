<?php
declare(strict_types=1);
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off','samesite'=>'Lax']);
session_start();
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
header('Cache-Control: no-store');
$db = new PDO('sqlite:'.__DIR__.'/storage/records.sqlite');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('PRAGMA journal_mode=PERSIST; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
$db->exec('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, lrn TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, middle_name TEXT NOT NULL DEFAULT "", sex TEXT NOT NULL, birth_date TEXT NOT NULL, strand TEXT NOT NULL, section TEXT NOT NULL, school_year TEXT NOT NULL, email TEXT NOT NULL DEFAULT "", phone TEXT NOT NULL DEFAULT "", address TEXT NOT NULL DEFAULT "", guardian TEXT NOT NULL DEFAULT "", guardian_phone TEXT NOT NULL DEFAULT "", created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS grades (student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, subject TEXT NOT NULL, q1 REAL, q2 REAL, q3 REAL, q4 REAL, PRIMARY KEY(student_id,subject));
CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, last_attempt INTEGER NOT NULL);');
$strands = ['STEM','ABM','HUMSS','GAS','TVL'];
$subjects = ['Contemporary Philippine Arts','Media and Information Literacy','Physical Education and Health','Practical Research 2','English for Academic Purposes','Entrepreneurship','Work Immersion'];
function h($v): string { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8'); }
function query(string $sql, array $args=[]): PDOStatement { global $db; $s=$db->prepare($sql); $s->execute($args); return $s; }
function go(string $url): never { header('Location: '.$url); exit; }
function csrf(): string { return '<input type="hidden" name="csrf" value="'.h($_SESSION['csrf']).'">'; }
function flash(string $s, string $title='Changes saved'): void { $_SESSION['flash']=['message'=>$s,'title'=>$title]; }
function average(array $g): ?float { $a=[]; foreach(['q1','q2','q3','q4'] as $q) if($g[$q]!==null && $g[$q]!=='') $a[]=(float)$g[$q]; return count($a)===4 ? array_sum($a)/4 : null; }
function num($n): string { return $n===null ? '—' : number_format((float)$n,2); }
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$error='';
$setup=(int)query('SELECT COUNT(*) FROM admins')->fetchColumn()===0;
$page=$_GET['page']??'dashboard';
if($_SERVER['REQUEST_METHOD']==='POST') {
 try {
  if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??''))) throw new Exception('Your session expired. Reload the page and try again.');
  $action=$_POST['action']??'';
  if($action==='setup' && $setup) {
   $u=trim($_POST['username']??''); $p=$_POST['password']??'';
   if(strlen($u)<3 || strlen($u)>50 || strlen($p)<12) throw new Exception('Use a username of 3–50 characters and a password of at least 12 characters.');
   if($p!==($_POST['confirm']??'')) throw new Exception('Passwords do not match.');
   $db->exec('BEGIN IMMEDIATE');
   if((int)query('SELECT COUNT(*) FROM admins')->fetchColumn()!==0) throw new Exception('An administrator has already been created.');
   query('INSERT INTO admins(username,password) VALUES (?,?)',[$u,password_hash($p,PASSWORD_DEFAULT)]); $db->exec('COMMIT');
   session_regenerate_id(true); $_SESSION['admin']=(int)$db->lastInsertId(); $_SESSION['username']=$u; flash('Your administrator account is ready. Welcome to Gradebook.', 'Account created'); go('index.php');
  }
  if($action==='login' && !$setup) {
   $key=hash('sha256',$_SERVER['REMOTE_ADDR']??'local'); $attempt=query('SELECT * FROM login_attempts WHERE key=?',[$key])->fetch(PDO::FETCH_ASSOC);
   if($attempt && $attempt['failures']>=5 && time()-(int)$attempt['last_attempt']<900) throw new Exception('Too many login attempts. Try again in 15 minutes.');
   $admin=query('SELECT * FROM admins WHERE username=?',[trim($_POST['username']??'')])->fetch(PDO::FETCH_ASSOC);
   if(!$admin || !password_verify($_POST['password']??'', $admin['password'])) {
    $n=($attempt && time()-(int)$attempt['last_attempt']<900)?(int)$attempt['failures']+1:1;
    query('INSERT INTO login_attempts VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,last_attempt=excluded.last_attempt',[$key,$n,time()]);
    throw new Exception('Invalid username or password.');
   }
   query('DELETE FROM login_attempts WHERE key=?',[$key]); session_regenerate_id(true); $_SESSION['admin']=$admin['id']; $_SESSION['username']=$admin['username']; flash('Welcome back! You are signed in to your workspace.', 'Login successful'); go('index.php');
  }
  if(!isset($_SESSION['admin'])) throw new Exception('Please sign in to continue.');
  if($action==='logout') {
   $_SESSION=[];
   session_regenerate_id(true);
   flash('You have been signed out safely. See you next time!', 'Logout successful');
   go('index.php');
  }
  if($action==='save_student') {
   $fields=['lrn','first_name','last_name','middle_name','sex','birth_date','strand','section','school_year','email','phone','address','guardian','guardian_phone']; $v=[];
   foreach($fields as $f) { $v[$f]=trim($_POST[$f]??''); if(strlen($v[$f])>500) throw new Exception('A field is too long.'); }
   if(!preg_match('/^\d{12}$/D',$v['lrn'])) throw new Exception('LRN must contain exactly 12 digits.');
   if($v['first_name']==='' || $v['last_name']==='' || $v['section']==='') throw new Exception('Complete all required fields.');
   if(!in_array($v['strand'],$strands,true) || !in_array($v['sex'],['Male','Female'],true)) throw new Exception('Choose a valid strand and sex.');
   $d=DateTime::createFromFormat('!Y-m-d',$v['birth_date']);
   if(!$d || $d->format('Y-m-d')!==$v['birth_date'] || $v['birth_date']>date('Y-m-d')) throw new Exception('Enter a valid birth date.');
   if(!preg_match('/^(\d{4})-(\d{4})$/D',$v['school_year'],$m) || (int)$m[2] !== (int)$m[1]+1) throw new Exception('School year must be consecutive, for example 2026-2027.');
   if($v['email']!=='' && !filter_var($v['email'],FILTER_VALIDATE_EMAIL)) throw new Exception('Enter a valid email address.');
   $id=(int)($_POST['id']??0); $creating=$id===0;
   if($id) { if(!query('SELECT id FROM students WHERE id=?',[$id])->fetchColumn()) throw new Exception('Student not found.'); query('UPDATE students SET '.implode(',',array_map(fn($f)=>$f.'=?',$fields)).' WHERE id=?',[...array_values($v),$id]); }
   else { query('INSERT INTO students('.implode(',',$fields).') VALUES ('.implode(',',array_fill(0,count($fields),'?')).')',array_values($v)); $id=(int)$db->lastInsertId(); }
   flash($creating?'The new student has been registered successfully.':'The student information has been updated successfully.', $creating?'Student created':'Record updated'); go('index.php?page=profile&id='.$id);
  }
  if($action==='delete') { $deleted=query('DELETE FROM students WHERE id=?',[(int)$_POST['id']]); if(!$deleted->rowCount()) throw new Exception('Student not found.'); flash('The student record and associated grades have been deleted.', 'Student deleted'); go('index.php?page=students'); }
  if($action==='grades') {
   $id=(int)$_POST['id']; if(!query('SELECT id FROM students WHERE id=?',[$id])->fetchColumn()) throw new Exception('Student not found.');
   $rows=[]; foreach($subjects as $i=>$subject) { $row=[$id,$subject]; foreach(['q1','q2','q3','q4'] as $q) { $value=trim($_POST['grade'][$i][$q]??''); if($value!=='' && (!is_numeric($value) || (float)$value<0 || (float)$value>100)) throw new Exception('Grades must be between 0 and 100.'); $row[]=$value===''?null:(float)$value; } $rows[]=$row; }
   $db->beginTransaction(); foreach($rows as $row) query('INSERT INTO grades VALUES (?,?,?,?,?,?) ON CONFLICT(student_id,subject) DO UPDATE SET q1=excluded.q1,q2=excluded.q2,q3=excluded.q3,q4=excluded.q4',$row); $db->commit(); flash('Quarterly grades saved.', 'Grades saved'); go('index.php?page=grades&id='.$id);
  }
  if($action==='password') { $admin=query('SELECT * FROM admins WHERE id=?',[$_SESSION['admin']])->fetch(PDO::FETCH_ASSOC); if(!password_verify($_POST['current']??'',$admin['password'])) throw new Exception('Current password is incorrect.'); $p=$_POST['password']??''; if(strlen($p)<12) throw new Exception('Use at least 12 characters.'); if($p!==($_POST['confirm']??'')) throw new Exception('Passwords do not match.'); query('UPDATE admins SET password=? WHERE id=?',[password_hash($p,PASSWORD_DEFAULT),$_SESSION['admin']]); session_regenerate_id(true); flash('Your administrator password has been changed successfully.', 'Password updated'); go('index.php?page=settings'); }
 } catch(Throwable $e) { if($db->inTransaction()) $db->rollBack(); $error=$e instanceof PDOException ? ($e->getCode()==='23000'?'That LRN is already registered.':'Unable to save the record. Please try again.') : $e->getMessage(); }
}
$logged=isset($_SESSION['admin']);
$search=trim($_GET['search']??''); $strand=$_GET['strand']??''; $year=trim($_GET['year']??'');
$where=[]; $args=[];
if($search!=='') { $where[]="(first_name LIKE ? OR last_name LIKE ? OR lrn LIKE ? OR section LIKE ?)"; for($i=0;$i<4;$i++) $args[]='%'.$search.'%'; }
if($strand!=='') { $where[]='strand=?'; $args[]=$strand; }
if($year!=='') { $where[]='school_year=?'; $args[]=$year; }
$filter=$where?' WHERE '.implode(' AND ',$where):'';
if($logged && $page==='export') {
 header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="grade12-students.csv"'); $out=fopen('php://output','w'); fputcsv($out,['LRN','First name','Last name','Middle name','Sex','Birth date','Strand','Section','School year','Email','Phone','Address','Guardian','Guardian phone']);
 foreach(query('SELECT * FROM students'.$filter.' ORDER BY last_name,first_name',$args) as $s) { $r=[]; foreach(['lrn','first_name','last_name','middle_name','sex','birth_date','strand','section','school_year','email','phone','address','guardian','guardian_phone'] as $f) { $value=$s[$f]; $r[]=preg_match('/^[\s]*[=+@\-]/u',$value)?"'".$value:$value; } fputcsv($out,$r); } fclose($out); exit;
}
