<?php
declare(strict_types=1);
// Publishes only static application files, never the PHP database or accounts.
$out=__DIR__.'/docs';
if(!is_dir($out.'/assets')) mkdir($out.'/assets',0777,true);
copy(__DIR__.'/browser/index.html',$out.'/index.html');
copy(__DIR__.'/browser/app.js',$out.'/app.js');
copy(__DIR__.'/browser/academic.js',$out.'/academic.js');
$logo=__DIR__.'/public/assets/school-logo.png';
if(!is_file($out.'/assets/school-logo.png') || hash_file('sha256',$logo)!==hash_file('sha256',$out.'/assets/school-logo.png')) {
 if(!copy($logo,$out.'/assets/school-logo.png')) throw new RuntimeException('Unable to publish the school logo.');
}
file_put_contents($out.'/style.css',file_get_contents(__DIR__.'/style.css')."\n".file_get_contents(__DIR__.'/theme.css')."\n".file_get_contents(__DIR__.'/browser/browser.css'));
file_put_contents($out.'/.nojekyll','');
// Keep old demo URLs usable without retaining sample student pages.
$routes=['about.html'=>'settings','students.html'=>'students','register.html'=>'register','grades.html'=>'grades','reports.html'=>'reports'];
foreach(['stem','abm','humss','gas','tvl'] as $strand) $routes['students-'.$strand.'.html']='students';
for($i=1;$i<=6;$i++) $routes['profile-'.$i.'.html']='students';
foreach($routes as $file=>$route) file_put_contents($out.'/'.$file,'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=index.html#'.$route.'"><title>LNVS Student Records</title></head><body><p><a href="index.html#'.$route.'">Open student records</a></p></body></html>');
echo "Built browser application in docs/ without database or sample records.\n";
