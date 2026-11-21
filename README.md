# Libertad National Vocational School - Grade 12 Student Records

Two working editions are included: an online browser-storage application for GitHub Pages, and the original PHP/SQLite application for a local or PHP-enabled server.

## Use online - no PHP hosting required

Open **https://jutswatv.github.io/studentrecordsystem/** in a normal browser window.

1. Choose **Create account** to register a local account (password: at least 12 characters), or **Login** to use an existing one.
2. Register permanent student identities, then use **Curriculum & Subjects**, **Enrollment** and **Grade Management** for academic records.
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


## Browser academic tools

Use the separate sidebar modules to configure subjects, select an enrollment to encode grades, record support follow-ups, request corrections, and issue a report. Use its reference to retrieve the frozen snapshot in the same workspace. Printing hides all other page sections.

Administrators provision local member accounts and assign teacher subjects or whole enrollments to advisers. Students are linked to one permanent student identity. These accounts work only on that browser/device. A full backup can move the complete workspace; records are never synchronized or uploaded to GitHub.

Enrollment and grade imports accept CSV UTF-8 exported from Excel; direct `.xlsx` uploads are not supported. Exact headers and import IDs appear in the workspace. Existing LRNs must match identity details. All rows validate before one localStorage save, so a failed import saves no rows. Export a full backup before importing.

Browser audit events and report references are editable by device users with developer tools; they do not provide tamper-proof certification. Official grading and school report layout still need school approval.


### Browser sidebar navigation

The original school branding is retained. Browser tools are now separated into Dashboard, Student Records, Enrollment, Curriculum & Subjects, Grade Management, Performance Analytics, Academic Interventions, Report Cards, School Years & Sections, Teachers & Advisers, Record Verification, Activity Logs, Reports & Exports, and System Settings. There is no Academic workspace sidebar entry. Old `#academic` bookmarks remain compatible. Local members see the sections available to their role.


### Dashboard styling

The browser dashboard follows the supplied premium interface reference: a teal wave hero, gold registration action, four live metric cards, strand distribution with counts/percentages, and a school-year filter for academic overview. The school name, logo, all sidebar modules and browser-local data remain intact. Decorative visuals use CSS and inline SVG, with no external image or font requests. Dashboard styles are maintained in `browser/dashboard.css` and included by `build-browser.php`.


### Student Records overview

The browser Student Records page matches the supplied overview reference, using five live summary cards, enrollment-aware year/strand/section filters, debounced name/LRN/ID search, a ten-row paginated list, selected/filtered CSV export, a printable list, quick actions, and strand distribution. A student's row uses the most recent enrollment matching the filters; its average requires all subjects in that enrollment's curriculum. Existing personal records and academic history are retained.

Use the row checkboxes to export or print selected students. With no selection, export/print includes all filtered results across pages. The School Year filter can show historical enrollment details and their grades. Changing strand/year clears an incompatible section filter. Import shortcuts open the existing verified CSV import module; backups include the full academic workspace.

Styles: `browser/records.css`. Banner artwork and generation prompt: `browser/records-art.md`. Run the isolated UI checks with `node tests/browser-records.cjs` in addition to `node tests/browser.cjs`.


### Enrollment management dashboard

The browser Enrollment page follows the supplied Grade 12 reference, with status cards, an enrollment list, progress ring, strand chart/legend, quick actions and recent enrollments. All values come from the filtered local records. The list shows one latest matching Grade 12 enrollment per permanent student identity; a student with no matching Grade 12 enrollment is shown as Not Enrolled. Older enrollment records without an explicit status remain Enrolled for compatibility. Grade 11 identities can be enrolled in Grade 12 without creating duplicate students.

- Enroll Student adds a scoped year/semester enrollment; duplicate terms are rejected.
- Re-enroll reuses an existing student identity for another semester/year. Selecting one row prefills that identity.
- Edit Enrollment corrects section, status and date with a reason; curriculum scope and existing grades stay linked.
- Sectioning updates selected enrollments together and audits each section change.
- The cancel action marks the enrollment Not Enrolled and retains student identity, grades, reports and academic history.
- Export List exports selected rows, or all filtered rows when none are selected. Search and year/strand/section filters work together.

For older records without an explicitly entered enrollment date, the list displays the record creation/import date. New enrollment forms allow an explicit date and require it for Enrolled status. Dates display in Asia/Manila time. Statuses and entered dates are included in full backups. Local role controls retain the same browser-only limitations described above.

Sources: `browser/enrollment.js` and `browser/enrollment.css`. Banner artwork and exact prompt: `browser/enrollment-art.md`. Run `node tests/browser-enrollment.cjs` for isolated enrollment checks.


### Curriculum & Subjects dashboard

The browser curriculum page follows the supplied teal reference, with live subject-type metrics, Curriculum Setup and Subject List panels, Subject Assignment and Subject Load tabs, quick actions, and strand coverage. The original school branding and saved subject records remain intact; the banner reuses the existing generated enrollment artwork.

Curriculum groups define a school year, grade, description and offered strands. Subjects retain their year/grade/semester/strand scope and may optionally link to a compatible group. Subject codes, types, units and grading periods are editable with an audit reason. Existing records without types or units remain unclassified. The page starts with real stored records; it does not seed the reference image's sample curriculum or totals.

Subjects with grade records, correction requests, issued reports or teacher assignments cannot be archived. Grading period counts cannot change after grade records exist. Unused subjects and curriculum groups can be archived and restored. Curriculum scope/strand edits cannot invalidate linked subjects. Metadata corrections preserve subject IDs, grades and frozen report snapshots.

Subject Assignment uses the existing local teacher access controls. Subject Load counts a subject/class/term once rather than once per assigned student, keeps unknown units explicit, and compares known units with a configurable review threshold. Subject Settings changes defaults for new subjects only; use school-approved units and load limits. Full backups preserve curriculum groups, subject metadata, settings and audit history, while older backups remain supported.

Sources: `browser/curriculum.js` and `browser/curriculum.css`. Run `node tests/browser-curriculum.cjs` for isolated curriculum UI checks, along with the existing academic, records and enrollment checks.


### Grade Management dashboard

The browser Grade Management page follows the supplied reference, with live class metrics, year/strand/section/subject filters, per-student grade encoding, save/reset controls, student information, subject grades, summaries, and an accessible final-grade distribution chart. It reuses the existing banner artwork and preserves the school branding and sidebar modules.

Four-period subjects show Q1-Q4; two-period subjects show P1-P2. Complete subject finals use the existing unrounded arithmetic mean and passing threshold of 75. A student's general average requires all configured subjects in that enrollment to be complete. Section/class averages use completed student averages; teacher views label their partial view as Assigned Average. Highest/lowest summaries use encoded period values; distribution bands use completed subject finals. These remain provisional calculations, not an official DepEd transmutation implementation.

Typing previews a final and updates the summaries without writing records. Save writes that row through the existing audited grade handler; changes to existing grades require a reason. Reset on a row reloads its stored values. Filter changes/reset preserve in-session row drafts; reload, sign-out and account changes discard unsaved drafts. Saved values are compared against the form's baseline to reject stale edits rather than overwrite another tab's changes.

Grade-page CSV export and Print Grades include stored values only, across every filtered page. The export can be imported back into the same class/subject. Exact CSV header: `lrn,p1,p2,p3,p4,reason`. Leave unused periods blank. Imports require verified source records and commit once only after every row validates; unknown or unauthorized LRNs, duplicate rows, invalid grades and missing correction reasons save no rows. Use Reports & Exports for the broader enrollment-ID/subject-ID import format.

Local teachers can encode only their assigned enrollment/subject pairs. Students and advisers see authorized records without encoding controls. The student panel links to correction requests, which administrators review through Activity Logs. Browser roles retain the local-only limitations described above.

Sources: `browser/grades.js` and `browser/grades.css`. Run `node tests/browser-grades.cjs` for grade-entry, preview, stale-edit, import/export, role and responsive-layout checks alongside the existing browser suites.

### Performance Analytics dashboard

The browser Performance Analytics page follows the supplied reference with five live metrics, year/semester, strand, section, subject and period filters, a grade-trend chart, performance distribution, subject comparisons, student rankings and contextual insights. School branding, sidebar modules and local storage are retained. Student details link to the selected enrollment and subject in Grade Management.

Analytics use saved grades only. Incomplete selected records remain unranked and are excluded from averages and distribution, rather than counted as zero. Ranking ties share a rank. Improvement compares adjacent complete student period averages; unavailable comparisons display a dash. Each trend point reports its complete student count because cohorts can differ. Mixed two/four-period subjects use their shared periods. Teacher averages cover assigned subjects and are labeled accordingly; student accounts show only their own authorized records.

Low selected averages or latest selected grades below 75 prompt academic review; missing records appear separately in insights. These are provisional arithmetic summaries, not official grading or transmutation rules. No reference-image sample students or grades are added to user records.

Sources: `browser/analytics.js` and `browser/analytics.css`. Banner artwork and exact generation prompt: `browser/analytics-art.md`. Run `node tests/browser-analytics.cjs` for calculations, filters, ranking, stored-only analytics, account visibility, drill-downs and responsive layouts.

### Academic Interventions dashboard

The browser Academic Interventions page follows the supplied reference, with five live metrics, term/strand/section/status filters, a paginated student list, selected plan details and support actions, status distribution, saved grade progress, and quick actions. The school branding and browser-local storage remain intact. The banner reuses the existing enrollment illustration.

Low-grade indicators use a complete average or latest subject grade below 75. Missing records are shown separately, never treated as zero. Identify At-Risk Students filters the list to low-grade indicators; Reset restores all students. Improved counts students with plans whose latest two adjacent complete period averages increased. Completed means all visible plans for that student were marked complete by staff, not that a grade target was automatically verified.

Select a student to create or update a plan. Plans support action checklists, an optional target average, a follow-up due date, remedial session scheduling, and completion outcomes. Updates append dated history and audit entries; a stale form cannot overwrite a newer entry. Existing intervention notes remain available and their latest status represents the legacy follow-up stream. New plans can be created after existing active plans are completed. Multiple staff plans are summarized as active until all visible plans are completed.

Teachers work with their assigned enrollments and see their own plans; assigned advisers and administrators can manage the visible plans. Students can review their own saved information without editing. Progress charts use saved grades across shared periods, without joining missing periods. Guardian notes are printable drafts for staff review and delivery; the application does not send notifications. Reports use current saved data. Full backups preserve plan metadata and history, while older notes remain compatible.

Sources: `browser/interventions.js` and `browser/interventions.css`. Run `node tests/browser-interventions.cjs` for plan lifecycle, legacy notes, audit history, stale-edit protection, scheduling, filters, pagination, backup metadata, role visibility, report/print and responsive-layout checks.

### Report Cards dashboard

The browser Report Cards page follows the supplied reference with five live metrics, student selection, term/strand/section filters, name/LRN search, a paginated list, an academic report preview, batch actions, and three printable layouts. School branding and local browser storage are preserved. The banner reuses the existing enrollment illustration.

Administrators and assigned advisers can generate frozen snapshots of saved grades, identity, enrollment and subject metadata. Choose Final for all configured periods or a specific period. Older reports remain compatible. Use Report Source to switch between a saved snapshot and live saved grades; later corrections do not alter snapshots. A generated report has a unique local verification reference. Teachers see live assigned-subject previews only; students can see their own previews and snapshots.

LNVS Standard shows period grades and averages, Compact Summary shows subject averages and remarks, and Detailed Grades adds available codes/types/units. Layout changes affect presentation only. These are provisional arithmetic reports, not approved official DepEd forms. Signature lines are blank. Passed requires every applicable subject grade to reach the unrounded threshold of 75; it does not determine promotion. Missing grades stay incomplete, and periods outside a subject's configuration display N/A.

Generate All Filtered includes every filtered page; Generate Selected uses checked students across pages. Generation is atomic: an invalid enrollment or period saves no snapshots or audit entries from that batch. Narrow batches to at most 500 students. Print Selected and Save Selected PDF require matching generated snapshots for every selected student and use each student's latest snapshot for the chosen period. Single-report printing can also print a clearly labeled live preview. Save as PDF opens the browser print dialog; choose its Save as PDF destination. CSV exports the displayed source and neutralizes spreadsheet formulas. Copy Reference copies a local reference and sends no student records externally.

Sources: `browser/report-cards.js` and `browser/report-cards.css`. Run `node tests/browser-report-cards.cjs` for snapshot preservation, period and two/four-period reports, atomic batches, selection across pages, CSV, print/PDF output, legacy and backup compatibility, roles, filters and responsive layouts.

### School Years & Sections dashboard

The browser School Years & Sections page follows the supplied reference with live metrics, School Years/Strands/Sections/Section Assignment tabs, year and section tables, strand cards, filters, pagination and a calendar illustration. Original branding and browser-local storage remain intact. Existing enrollment and curriculum years appear as unconfigured years; existing enrollment section names appear as inferred sections. Viewing the page does not create sample records or configure those entries automatically.

Administrators can configure school-year dates, select one active year, archive years, and create or edit Grade 12 sections. Copy School Year Setup creates empty sections and strand offerings with new IDs and no adviser assignments. The active year is the default for new enrollment forms unless an explicit year filter or re-enrollment term takes precedence. Archived years retain their history and reject new or moved enrollments. Inactive sections reject incoming enrollments; existing records remain readable.

Manage Strands edits descriptions, display labels and offered status for the five supported curriculum codes per school year. Strand codes remain stable across the curriculum and grades. Disabling an offering requires its enrolled students to be transferred or cancelled and its configured sections to be deactivated. Sections can be created before students are enrolled. Counts use unique enrolled identities across both semesters; role-specific views count only visible enrollments.

Section Assignment moves checked enrollments within a matching year, strand and semester, with an audit reason. Selections span pages, and target/reason fields remain available while paging. Invalid mixed-scope batches save no changes. Renaming a section updates matching enrollment labels while preserving enrollment IDs, grades and issued report snapshots. Configuration edits reject stale form baselines.

A section can link to an active local adviser account. Automatically managed whole-enrollment access follows matching existing and future enrollments, transfers, adviser changes and account disabling. Explicit manual access assignments remain intact. Teachers, advisers and students have read-only scoped setup views; setup and assignments require an administrator. Full backups retain school-year, section and strand metadata, while older backups remain compatible.

Sources: `browser/school-years.js`, `browser/school-years.css`, and shared enrollment/access rules in `browser/school-structure.js`. Banner: `public/assets/school-years-hero.svg`. Run `node tests/browser-school-years.cjs` alongside the existing browser and enrollment suites for setup, transfers, role/access behavior, archived/inactive guards, history, copying, backup validation, pagination and responsive layouts.

### Teachers & Advisers dashboard

The browser Teachers & Advisers page follows the supplied reference with live metrics, staff/adviser tabs, profile management, an advisory-section distribution chart, assignment filters, subject handling, quick actions and printable/CSV assignment reports. Branding and local storage are unchanged. Existing usernames remain usable, and profiles without names or designations show their actual username and an explicit missing designation.

Administrators can create local teacher, adviser and linked student accounts using Local Account Setup. Optional staff fields include full name, designation, employee ID, email and phone. Employee IDs are unique within the workspace. Profile edits retain the account's username, role, grades and audit history and reject stale edits. Deactivation retains history and blocks sign-in; reactivation restores applicable class access. Password reset changes local credentials, invalidates old sessions and records an audit event without storing credentials in the audit log. Staff contact profiles remain administrator-only.

Class subject assignments link an active teacher, a saved Grade 12 section, semester and compatible curriculum subject. Existing inferred sections are configured when needed. These rules grant access to current and future matching enrollments and follow section renames and transfers. Explicit individual assignments remain separate. Removing a class rule removes its managed access while retaining manual access; manual access can be removed separately. Subjects referenced by class rules cannot be archived, including rules for empty classes. School-year setup copies do not copy teaching rules; assign staff for the new year separately.

Adviser assignment uses the same section records as School Years & Sections. The table distinguishes section adviser rules from manual enrollment permissions and supports separate removal. The overview counts distinct sections with an active adviser in the filtered scope. Total Teachers and Total Advisers count active accounts. Subject totals count a class/semester/subject once across co-teachers; each teacher's load counts its own distinct offerings. The ratio uses filtered unique enrolled students per active teacher account and shows a dash when no teacher exists.

Assignment reports use current saved records. CSV neutralizes spreadsheet formulas and excludes passwords, password hashes and staff contact details. Profile and teaching-rule metadata are included in full backups, with validation and support for older backups. Existing per-enrollment account and assignment tools remain available for student accounts and explicit exceptions.

Sources: `browser/teachers.js`, `browser/teachers.css`, and shared access synchronization in `browser/school-structure.js`. Banner: `public/assets/staff-hero.svg`. Run `node tests/browser-teachers.cjs` with the existing browser and curriculum suites for profiles, session revocation, class and manual permissions, future enrollments, transfers, removal, metadata, CSV/print, pagination and responsive layouts.
