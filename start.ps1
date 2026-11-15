Set-Location -LiteralPath $PSScriptRoot
php -d extension=pdo_sqlite -S localhost:8000 -t "$PSScriptRoot\public"
