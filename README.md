# Libertad National Vocational School - Grade 12 Student Records

Two working editions are included: an online browser-storage application for GitHub Pages, and the original PHP/SQLite application for a local or PHP-enabled server.

## Use online - no PHP hosting required

Open **https://jutswatv.github.io/studentrecordsystem/** in a normal browser window.

1. Choose **Create account** to register a local account (password: at least 12 characters), or **Login** to use an existing one.
2. Register permanent student identities, then open **Academic workspace** to configure curriculum subjects and encode enrollment-scoped grades.
3. Go to **Account & backups** and download a full JSON backup regularly.

The online version starts empty. It supports configurable curricula, enrollment history, performance trends, early support notes, local teacher/adviser/student accounts, correction requests and audit trails, verified enrollment/grade CSV imports, and printable frozen reports with local reference verification. Registration, editing, searching, CSV export, full backups, local password changes and logout confirmation remain available. Students with academic history are retained. It uses HTML, CSS, and JavaScript with localStorage; no external database, tracking, or API is used. Student information is not uploaded to GitHub.

### What browser storage means

- Records are saved on this browser profile for this website. They persist through refresh and signing out.
- Different browsers, devices, or profiles have separate workspaces. There is no automatic sharing or synchronization.
- Multiple local accounts can use this browser. Each administrator has its own school workspace; assigned teacher/adviser/student accounts use that workspace through local role controls. Usernames must be unique on this browser. Existing single-account records and passwords are preserved when upgrading.
- Clearing site data, uninstalling the browser, private browsing, storage eviction, or losing the device may erase records. Data on localhost is separate from data on the GitHub Pages address.
- Local sign-in is a convenience lock, not server authentication. Passwords are hashed with PBKDF2, but student records are **not encrypted**. Someone with access to this browser, developer tools, or other scripts on the same origin may access them. Use a trusted device.
- There is no password-recovery server. Keep your local password and backups safe.

### Backups and moving to another browser

**Download full backup** exports the administrator account, students, legacy grades, curriculum, enrollments, academic grades, local member accounts, audit events, correction requests, interventions and report snapshots as a JSON file. Store it privately. CSV export contains student information only, not grades or account settings.

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

Both Academic Workspaces scope subjects by strand, grade 11/12, semester and school year. New subjects use two or four configured grading periods. A subject average requires all configured periods; the enrollment general average requires every matching subject. Passing is an unrounded arithmetic average of at least 75. This is provisional and does not implement official DepEd transmutation.

Existing browser records migrate without discarding legacy grades: initial enrollments are assigned grade 12, semester 1, with the legacy four-period subject list. The school must verify historical curriculum and semester assignments. New browser workspaces begin with an empty configurable curriculum. Legacy profile tables remain read-only archives; current grades and reports are in Academic Workspace.

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


## Academic Workspace (PHP edition)

Open `index.php?page=academic` after administrator sign-in. The login page also links to the teacher, adviser and student portal. This edition enforces permissions on the PHP server. The GitHub Pages edition now includes the same academic workflow using local browser storage, where roles and verification are convenience controls rather than server-enforced security.

- Curriculum subjects are scoped to school year, strand, grade 11/12 and semester, with two or four grading periods. Configure them before encoding.
- Permanent student identities keep one LRN. Add subsequent enrollments in Academic Workspace. Enrollment-scoped grades preserve previous years and semesters.
- Existing PHP student records migrate to semester 1, grade 12. Existing grade rows retain four periods and their exact values. This is a compatibility migration; the school must check historical semester assignments. Original tables remain intact.
- Teachers can read and encode only their assigned enrollment/subject combinations. Advisers can read assigned enrollments and issue reports; students can read only enrollments linked to their identity. Provision, assign, disable and reset accounts as administrator.
- Indicators identify low encoded grades, incomplete subjects and the difference between first/latest encoded periods. Missing periods are review prompts, not predictions. Support notes record follow-up and resolution status.
- Grade writes capture the actor, before/after values, timestamp and reason. Existing grades require a correction reason. Users can request a correction, which administrators approve or reject. Historical identities cannot be deleted through the legacy screen, and legacy grade writes are disabled.
- CSV imports support enrollment and grades, with exact headers shown in the workspace. Export Excel to CSV UTF-8 first. Imports validate and commit as one transaction; any invalid row rolls back the file. Existing LRNs must match identity details. Back up the database first.
- Issued reports freeze the student/enrollment/grade snapshot and receive a random reference. Print the issued report using Ctrl+P. Public reference lookup confirms issuance without exposing student information. Authorized school staff must compare document contents with the issued snapshot.

Grading remains explicitly provisional: arithmetic average of the configured periods, with an unrounded passing threshold of 75. School-approved grading/transmutation rules, historical curriculum mapping, and official report layout still require LNVS validation. No report is labeled official.

Legacy dashboard, profile and CSV screens read the original tables and therefore do not summarize new enrollment-scoped grades. Use Academic Workspace for current academic decisions and reports. Back up the entire SQLite database to preserve all academic data.

Run isolated academic integration checks with `python tests/academic.py`. They use a disposable server/database, never the live records.


## Browser Academic Workspace

Use the sidebar **Academic workspace** or `#academic`. Configure subjects, select an enrollment to encode grades, record support follow-ups, request corrections, and issue a report. Use its reference to retrieve the frozen snapshot in the same workspace. Printing hides all other page sections.

Administrators provision local member accounts and assign teacher subjects or whole enrollments to advisers. Students are linked to one permanent student identity. These accounts work only on that browser/device. A full backup can move the complete workspace; records are never synchronized or uploaded to GitHub.

Enrollment and grade imports accept CSV UTF-8 exported from Excel; direct `.xlsx` uploads are not supported. Exact headers and import IDs appear in the workspace. Existing LRNs must match identity details. All rows validate before one localStorage save, so a failed import saves no rows. Export a full backup before importing.

Browser audit events and report references are editable by device users with developer tools; they do not provide tamper-proof certification. Official grading and school report layout still need school approval.
