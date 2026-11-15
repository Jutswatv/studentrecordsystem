# Libertad National Vocational School - Grade 12 Student Records

Two working editions are included: an online browser-storage application for GitHub Pages, and the original PHP/SQLite application for a local or PHP-enabled server.

## Use online - no PHP hosting required

Open **https://jutswatv.github.io/studentrecordsystem/** in a normal browser window.

1. Choose **Create account** to register a local account (password: at least 12 characters), or **Login** to use an existing one.
2. Register students, manage quarterly grades, and view reports.
3. Go to **Account & backups** and download a full JSON backup regularly.

The online version starts empty. It supports registration, editing, confirmed deletion, searching and filtering, quarterly grades, averages, reports, CSV export, printing, local password changes, and logout confirmation. It uses HTML, CSS, and JavaScript with localStorage; no external database, tracking, or API is used. Student information is not uploaded to GitHub.

### What browser storage means

- Records are saved on this browser profile for this website. They persist through refresh and signing out.
- Different browsers, devices, or profiles have separate workspaces. There is no automatic sharing or synchronization.
- Multiple local accounts can use this browser. Each has its own students and grades; usernames must be unique on this browser. Existing single-account records and passwords are preserved when upgrading.
- Clearing site data, uninstalling the browser, private browsing, storage eviction, or losing the device may erase records. Data on localhost is separate from data on the GitHub Pages address.
- Local sign-in is a convenience lock, not server authentication. Passwords are hashed with PBKDF2, but student records are **not encrypted**. Someone with access to this browser, developer tools, or other scripts on the same origin may access them. Use a trusted device.
- There is no password-recovery server. Keep your local password and backups safe.

### Backups and moving to another browser

**Download full backup** exports the local account, students, and grades as a JSON file. Store it privately. CSV export contains student information only, not grades or account settings.

To move records, create a local account in the destination browser, then open **Account & backups > Restore a backup**. Choose your JSON backup and confirm replacement. Log in using the username and password from that backup. Restoring replaces only the current account's workspace, so export its existing backup first if needed. Other local accounts are kept. A backup cannot replace the current account with a username already used by another local account.

### Build the GitHub Pages version

Editable sources are in browser/ with shared styling in style.css and theme.css.

```powershell
php build-browser.php
```

Commit generated docs/ files and push to main. GitHub Pages publishes main / docs. Old demo URLs redirect to the working browser application. Do not upload contents of storage/.

## Run the PHP/SQLite edition locally

Requires PHP 8.2+ and pdo_sqlite. From the project folder:

```powershell
php -d extension=pdo_sqlite -S localhost:8000 -t public
```

On this Windows installation you can also double-click OPEN-SYSTEM.bat. Keep the server window open, visit http://localhost:8000, and create the first administrator account. There are no default credentials.

The PHP edition uses HTML, CSS, and PHP without JavaScript. Its data is stored in storage/records.sqlite, independently of the online browser edition. PHP must have write access to storage/. Set the web server document root to public/ and enable HTTPS when deploying to PHP hosting. Complete administrator setup before exposing a new installation publicly.

The Git repository excludes the PHP database and administrator accounts. Each PHP installation creates its own database. Back up the database while the application is stopped.

## Grading rules

Shared subjects are defined separately in app.php (PHP edition) and browser/app.js (browser edition). Adapt them to your school's curriculum before using the application.

Grades accept 0-100 with two decimal places. Blank means unencoded. Subject averages require all four quarters; general averages require all seven subjects. Passing is an unrounded average of at least 75. Reports average completed subject averages across all years. This is a simple arithmetic average, not an official DepEd transmutation implementation.

## Checks

```powershell
php -l app.php
php -l index.php
php -l build-browser.php
node --check browser/app.js
```

The isolated browser test uses Playwright and installed Chrome. It starts a temporary local server and disposable browser profiles with fictional test data, without touching the live website's browser storage:

```powershell
npm.cmd install --prefix "$env:TEMP/lnvs-browser-qa" playwright --no-audit --no-fund
node tests/browser.cjs
```

Set PLAYWRIGHT_MODULE or CHROME_PATH if your installations differ. Screenshots are saved under the ignored .artifacts/ directory.
