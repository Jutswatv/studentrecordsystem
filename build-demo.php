<?php
// Generates the GitHub Pages demo from fictional data; never opens the database.
declare(strict_types=1);
$out=__DIR__.'/docs';
if(!is_dir($out.'/assets')) mkdir($out.'/assets',0777,true);
copy(__DIR__.'/public/assets/school-logo.png',$out.'/assets/school-logo.png');
file_put_contents($out.'/style.css',file_get_contents(__DIR__.'/style.css')."\n".file_get_contents(__DIR__.'/theme.css')."\n".file_get_contents(__DIR__.'/demo.css'));
file_put_contents($out.'/.nojekyll','');
$students=[
 ['name'=>'Alex Rivera','lrn'=>'DEMO-0001','strand'=>'STEM','section'=>'Einstein','sex'=>'Male'],
 ['name'=>'Jamie Santos','lrn'=>'DEMO-0002','strand'=>'ABM','section'=>'Keynes','sex'=>'Female'],
 ['name'=>'Taylor Cruz','lrn'=>'DEMO-0003','strand'=>'HUMSS','section'=>'Rizal','sex'=>'Female'],
 ['name'=>'Morgan Reyes','lrn'=>'DEMO-0004','strand'=>'GAS','section'=>'Plato','sex'=>'Male'],
 ['name'=>'Casey Garcia','lrn'=>'DEMO-0005','strand'=>'TVL','section'=>'Edison','sex'=>'Female'],
 ['name'=>'Jordan Lopez','lrn'=>'DEMO-0006','strand'=>'STEM','section'=>'Einstein','sex'=>'Male'],
];
$strands=['STEM','ABM','HUMSS','GAS','TVL'];
$subjects=['Contemporary Philippine Arts','Media and Information Literacy','Physical Education and Health','Practical Research 2','English for Academic Purposes','Entrepreneurship','Work Immersion'];
$base=[90,88,91,87,89,92,90];
function e($v): string { return htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8'); }
function page(string $file,string $title,string $active,string $body): void {
 global $out;
 $nav='';
 foreach(['index.html'=>['dashboard','&#9707;','Dashboard'],'students.html'=>['students','&#9636;','Student records'],'register.html'=>['register','&#65291;','Registration'],'grades.html'=>['grades','&#9638;','Grades management'],'reports.html'=>['reports','&#9719;','Reports']] as $url=>$item) $nav.='<a class="'.($active===$item[0]?'active':'').'" href="'.$url.'"><span>'.$item[1].'</span>'.$item[2].'</a>';
 $brand='<img class="school-logo" src="assets/school-logo.png" alt="Libertad National Vocational School logo" width="56" height="56"><span class="school-name">Libertad National Vocational School<small>GRADE 12 STUDENT RECORDS</small></span>';
 $html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Read-only Grade 12 student record system demonstration using fictional data."><title>'.e($title).' | LNVS Demo</title><link rel="stylesheet" href="style.css"></head><body><aside class="sidebar"><a class="brand" href="index.html">'.$brand.'</a><span class="nav-label">DEMO WORKSPACE</span><nav>'.$nav.'</nav><div class="sidebar-bottom"><a href="about.html">About this demo</a><div class="admin"><b>D</b><span>Demo visitor<small>Read-only preview</small></span></div></div></aside><main class="main"><header class="topbar"><span>Academic workspace / '.e($title).'</span><span class="badge">Grade 12</span></header><div class="content"><div class="demo-banner"><strong>DEMO ONLY</strong><span>Fictional sample data. Changes cannot be saved here.</span><a href="https://github.com/Jutswatv/studentrecordsystem">View PHP project &rarr;</a></div><div class="page-heading"><div><span class="eyebrow">LIBERTAD NATIONAL VOCATIONAL SCHOOL</span><h1>'.e($title).'</h1><p>Explore the Grade 12 student record management interface.</p></div><span class="badge demo-year">School year 2026-2027</span></div>'.$body.'<footer>LNVS Gradebook <span>Static demonstration &middot; Sample data only</span></footer></div></main></body></html>';
 file_put_contents($out.'/'.$file,$html);
}
function table(array $rows, bool $grades=false): string {
 $html='<div class="table-wrap"><table><thead><tr><th>Student name</th><th>Demo ID</th><th>Strand / Section</th><th>School year</th><th>Action</th></tr></thead><tbody>';
 foreach($rows as $i=>$s) $html.='<tr><td><b>'.e($s['name']).'</b><small>Fictional student</small></td><td>'.e($s['lrn']).'</td><td><span class="badge">'.e($s['strand']).'</span> '.e($s['section']).'</td><td>2026-2027</td><td><a class="text-link" href="profile-'.($i+1).'.html">'.($grades?'View sample grades':'View profile').' &rarr;</a></td></tr>';
 return $html.'</tbody></table></div>';
}
$mean=number_format(array_sum($base)/7-2.5,2);
$stats='<div class="stats">';
foreach([['Total students','6','Fictional Grade 12 students','&#9817;'],['Active strands','5','Academic &amp; career pathways','&#9637;'],['Sections','5','Sample class sections','&#9638;'],['Average grade',$mean,'Completed sample subject averages','&#8599;']] as $item) $stats.='<article class="card stat"><span>'.$item[0].'<b>'.$item[3].'</b></span><strong>'.$item[1].'</strong><small>'.$item[2].'</small></article>';
$stats.='</div>';
$distribution='<section class="card"><div class="card-heading"><h2>Strand distribution</h2><span class="muted">6 sample students</span></div>';
foreach($strands as $strand) { $count=count(array_filter($students,fn($s)=>$s['strand']===$strand)); $distribution.='<div class="distribution"><div><span>'.e($strand).'</span><b>'.$count.'</b></div><meter min="0" max="6" value="'.$count.'">'.$count.' of 6 students</meter></div>'; }
$distribution.='</section>';
$summary='<section class="card"><div class="card-heading"><h2>Academic overview</h2><span class="badge">Sample data</span></div><div class="summary-item"><span>Completed subject grades</span><strong>42</strong></div><div class="summary-item"><span>Passing subjects (&ge; 75)</span><strong>42</strong></div><div class="summary-item"><span>Below passing</span><strong>0</strong></div><p class="muted help">These statistics are calculated from fictional records. The PHP application calculates them from your own student data.</p><a class="text-link" href="grades.html">Explore sample grades &rarr;</a></section>';
page('index.html','Dashboard','dashboard',$stats.'<div class="two-cols">'.$distribution.$summary.'</div><section class="card"><div class="card-heading"><h2>Sample student records</h2><a class="text-link" href="students.html">View all students &rarr;</a></div>'.table($students).'</section>');
foreach([null,...$strands] as $filter) {
 $links='<div class="demo-filters"><a class="button '.($filter===null?'':'secondary').'" href="students.html">All strands</a>';
 foreach($strands as $strand) $links.='<a class="button '.($filter===$strand?'':'secondary').'" href="students-'.strtolower($strand).'.html">'.e($strand).'</a>';
 $links.='</div>';
 $rows=$filter===null?$students:array_filter($students,fn($s)=>$s['strand']===$filter);
 page($filter===null?'students.html':'students-'.strtolower($filter).'.html','Student records','students','<section class="card"><div class="card-heading"><h2>Browse sample students</h2><span class="badge">'.count($rows).' students</span></div>'.$links.table($rows).'<p class="muted help">Live search, editing, deletion, and CSV export are available in the PHP application.</p></section>');
}
page('grades.html','Grades management','grades','<section class="card"><h2>Quarterly performance</h2><p class="muted">Select a sample student to see quarterly grades, final subject averages, and a general average.</p>'.table($students,true).'</section>');
foreach($students as $i=>$s) {
 $body='<section class="card profile"><div class="card-heading"><div><span class="eyebrow">FICTIONAL STUDENT PROFILE</span><h2>'.e($s['name']).'</h2><p class="muted">'.e($s['lrn']).' &middot; '.e($s['strand'].' / '.$s['section']).'</p></div><a class="button secondary" href="students.html">Back to records</a></div><div class="details"><div><small>Sex</small><b>'.e($s['sex']).'</b></div><div><small>Grade level</small><b>Grade 12</b></div><div><small>School year</small><b>2026-2027</b></div></div></section><section class="card"><h2>Quarterly grades</h2><p class="muted">Final average = (Q1 + Q2 + Q3 + Q4) / 4. Passing grade: 75.</p><div class="table-wrap"><table><thead><tr><th>Subject</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Average</th><th>Remarks</th></tr></thead><tbody>';
 foreach($subjects as $j=>$subject) { $v=$base[$j]-$i; $body.='<tr><td>'.e($subject).'</td><td>'.($v-2).'</td><td>'.($v-1).'</td><td>'.($v+1).'</td><td>'.($v+2).'</td><td><b>'.number_format($v,2).'</b></td><td><span class="badge">Passed</span></td></tr>'; }
 $body.='</tbody><tfoot><tr><th colspan="5">General average</th><th>'.number_format(array_sum($base)/7-$i,2).'</th><td></td></tr></tfoot></table></div></section>';
 page('profile-'.($i+1).'.html','Student profile','students',$body);
}
$enrollment='<section class="card"><h2>Enrollment summary</h2><div class="table-wrap"><table><thead><tr><th>Strand</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>';
foreach($strands as $strand) { $rows=array_filter($students,fn($s)=>$s['strand']===$strand); $male=count(array_filter($rows,fn($s)=>$s['sex']==='Male')); $enrollment.='<tr><td>'.e($strand).'</td><td>'.$male.'</td><td>'.(count($rows)-$male).'</td><td>'.count($rows).'</td></tr>'; }
$enrollment.='</tbody></table></div></section>';
page('reports.html','Reports','reports',$stats.'<div class="two-cols">'.$distribution.$summary.'</div>'.$enrollment);
$form='<section class="card student-form"><h2>Registration preview</h2><p class="muted help">This form is a visual preview. Data entry and saving are disabled on GitHub Pages. Use the PHP application for real student registration.</p><fieldset disabled><div class="form-grid">';
foreach(['Learner Reference Number','First name','Last name','Middle name','Birth date','Section','School year','Email address','Contact number','Home address','Guardian name','Guardian contact number'] as $label) $form.='<label>'.e($label).'<input type="text" placeholder="'.e($label).'" aria-label="'.e($label).'"></label>';
$form.='<label>Strand<select><option>Select strand</option>'; foreach($strands as $strand) $form.='<option>'.e($strand).'</option>';
$form.='</select></label></div><button class="button" disabled>Saving unavailable in demo</button></fieldset></section>';
page('register.html','Student registration','register',$form);
page('about.html','About this demo','','<section class="card"><h2>A preview you can explore anywhere</h2><p class="muted">This GitHub Pages site demonstrates the interface of the Grade 12 Student Record Management System. All student names, demo IDs, grades, and statistics are fictional. No administrator accounts or real student records are published.</p><h2>Run the complete application</h2><p class="muted">The full HTML, CSS, and PHP application includes secure login, registration, editing, deletion, quarterly grades, CSV export, printable profiles, and account settings. It requires PHP 8.2+ and SQLite; GitHub Pages serves static files only.</p><a class="button" href="https://github.com/Jutswatv/studentrecordsystem">Open the source project &rarr;</a></section>');
echo "Built static demo in docs/ using fictional records only.\n";
