PREPONE — TOPIC WORKSPACE RESOURCE EDITION
==========================================

Enabled exams:
1. AP EAPCET – Engineering
2. AP EAPCET – Agriculture & Pharmacy
3. NEET UG
4. AP POLYCET

MAIN CONTENT MODEL
------------------
Every syllabus topic is one row in the Syllabus sheet.
Core columns A:K remain the syllabus metadata.
Resource URLs start at column L and can continue to the right.

Recommended headers:
L  Video 1
M  Video 2
N  Video 3
O  PDF 1
P  PDF 2
Q  Website 1
R  Website 2
S  Audio 1
T  Audio 2
U  Image 1
V  Image 2
W  MCQ Quiz

You may add more columns after W, for example:
Video 4, PDF 3, Website 3, Audio 3, Image 3, Formula Sheet, Notes PDF, PYQ PDF.
The backend discovers non-empty resource columns automatically.

IMPORTANT
---------
- Leave a resource cell blank when the topic does not have that resource.
- Blank resources are hidden completely from the UI.
- Keep the MCQ Quiz column at the end if you want the MCQ item shown last.
- Column I (MCQURL) remains only for backward compatibility. New data should use the MCQ Quiz resource column.
- Use HTTPS URLs whenever possible.

TOPIC PAGE BEHAVIOR
-------------------
Click a topic -> the topic workspace expands on the same page.
The topic name is displayed at the top.
Only resource URLs that exist are listed.
Every resource is collapsed by default.
Click a resource -> it opens inline.

Supported inline resource types:
- YouTube / video links
- Direct MP4/WebM video files
- PDF files
- Google Drive previews
- Web pages
- MP3/WAV/M4A/OGG audio
- Images (PNG/JPG/WebP/GIF)
- Apps Script MCQ quiz pages

For third-party websites that explicitly prohibit iframe embedding, the browser cannot override that provider restriction. An Open separately fallback is always present.

MCQ APPS SCRIPT
---------------
For an Apps Script quiz to appear inside PrepOne, its HtmlService response must include:

.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)

Then redeploy the MCQ web app as a new version.

BACKEND
-------
Replace Apps Script Code.gs with the Code.gs in this package.
It is configured for Master Sheet ID:
1I1jdGPlN_GvOftfokf6pcKR0xCrpxMOHNnHjXOVRVmo

Deploy -> Manage deployments -> Edit -> New version -> Deploy.
Keep the resulting PrepOne /exec URL in config.js.

GITHUB
------
Replace the website files in GitHub, especially:
assets/app.js
assets/styles.css
study.html
exam.html
diagnostics.html

Then hard refresh with Ctrl+Shift+R.

DIAGNOSTICS
-----------
Open diagnostics.html to verify that topics and ResourceLinks are being returned by the backend.

V6 RESOURCE SCHEMA
------------------
Use PrepOne_Resource_Schema_V6.xlsx as the model for the Syllabus sheet.
K = Active, L = MCQ Quiz, M onward = dynamic resource URL columns.
The old Syllabus Notes and MCQURL columns are not required in V6.
MCQ Quiz is intentionally stored near Active but always rendered last in the topic workspace.


V12.2 IMPORTANT FIX
====================
The Web App must read the same live Google Sheet that contains the PrepOne master data.
If the Apps Script is bound to the master Sheet, the code uses the active spreadsheet automatically.
If it is standalone, set Script Properties:
PREPONE_MASTER_SPREADSHEET_ID = <LIVE GOOGLE SHEET ID>
Then create a NEW Web App deployment/version.

Use diagnostics.html after deployment. It must show the expected spreadsheet name, exams, syllabus rows and active students.
