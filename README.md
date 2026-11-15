# Libertad National Vocational School - Grade 12 Student Record Management System

A PHP 8.2+ application using HTML, CSS, and PHP only. No JavaScript, framework, or package installation is required. Student data is stored locally in SQLite.

## Online demonstration

Explore the [GitHub Pages demo](https://jutswatv.github.io/studentrecordsystem/). It contains fictional students and grades only. Registration is a disabled visual preview; saving, authentication, live search, and export require the PHP application.

The static demo is published from `main` / `docs`. Rebuild it after changing the design with `php build-demo.php`, then commit the updated `docs/` files. The generator uses hard-coded fictional records and never reads the database.

## Run locally

Enable the `pdo_sqlite` extension in PHP, then run from this folder:

```powershell
php -S localhost:8000 -t public
```

Open http://localhost:8000 and create the first administrator account. There are no default credentials. Complete setup before making the server accessible to others. PHP must be able to write to `storage/`.

On this Windows installation, SQLite is installed but disabled by default. Double-click `OPEN-SYSTEM.bat`, or run `php -d extension=pdo_sqlite -S localhost:8000 -t public` in PowerShell. Keep the server window open and enter the URL in your browser.

## Features

- First-run administrator setup, hashed passwords, login throttling, logout, and password changes.
- Dashboard with enrollment totals, sections, strand distribution, and academic summaries.
- Registration with unique 12-digit LRN, personal, enrollment, and guardian details.
- Search by name, LRN, or section; filter by strand and school year; edit and confirmed deletion.
- Seven shared Grade 12 subjects with four quarterly grades, subject averages, and general average.
- Enrollment summaries by year, strand, and sex; completed, passing, failed, and incomplete subject statistics.
- Filtered CSV export and printable student profile including grades. Use Ctrl+P on the profile.
- School branding, responsive navy and teal interface, and PHP/HTML notification popups.
- Sign-out confirmation with Yes/No choices and a logout success notification.

## Grading rules

Grades accept 0–100 with up to two decimal places in the form. Blank means unencoded. Subject averages require all four quarters. General averages require all seven completed subjects. Reports average completed subject averages across all years. Passing is an unrounded average of at least 75. The shared subject list is defined in `app.php`; adapt it to your school's curriculum before encoding grades. This is a simple quarterly average system, not an official DepEd transmutation implementation.

## Hosting and data

Use HTTPS and a PHP-enabled web server with SQLite for deployment. Set the web server document root to the `public/` folder, so the database and private application files remain outside the public directory. PHP must have write access to `storage/`. The built-in PHP server is for local development.

GitHub stores the source code. GitHub Pages cannot run this PHP application; running it online requires PHP hosting.

The database is `storage/records.sqlite`. Protect it as student personal information. Back up this file while the application is stopped. Deleting a student also deletes their grades. The app starts empty and does not fabricate student data. There is one administrator setup flow and no password recovery feature; retain your administrator credentials securely.

## Verification

```powershell
php -l app.php
php -l index.php
php -l public/index.php
```

Manually verify setup, login, registration, duplicate LRN rejection, editing, filtering, grade persistence, CSV download, print preview, password change, and deletion before real use.

PHP syntax checks passed, and local HTTP checks confirmed that the setup page, styles, and school logo load successfully using the `public/` document root. Complete the manual checks above before using real student information.

The Git repository excludes all contents of `storage/` except `.gitkeep`, so student records and local administrator accounts are not uploaded. Each installation creates its own database and administrator account.
