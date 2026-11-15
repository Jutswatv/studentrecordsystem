<?php
header('Content-Type: text/css; charset=utf-8');
readfile(dirname(__DIR__) . '/style.css');
echo "\n";
readfile(dirname(__DIR__) . '/theme.css');
