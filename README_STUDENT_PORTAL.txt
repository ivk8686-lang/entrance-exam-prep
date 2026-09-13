PREPONE V12 — PUBLIC COURSES + PASSWORD-PROTECTED STUDENT PORTAL
================================================================

PUBLIC MODE
-----------
All active courses and topic resources remain available without login.
Public visitors do not see progress controls or private note-taking.

STUDENT MODE
------------
1. Teacher creates the student from teacher.html.
2. Teacher assigns one or more courses and creates a password.
3. Student opens the home page, selects their name and enters the password.
4. Student dashboard shows only assigned courses and learning completion.
5. Inside an assigned course, resources can be marked Complete / Incomplete.
6. Topic progress = completed resources / available resources.
7. Course progress = completed resources / all available resources.
8. Private note-taking appears ONLY inside an opened topic for a logged-in
   student with that course assigned.
9. The compact topic note area is inserted immediately BEFORE the MCQ Quiz
   resource(s), when an MCQ exists for that topic.
10. Notes are tied to Exam + Subject + Chapter + Topic and are visible only
    to the logged-in student who created them.
11. There is no separate Personal Notes / Study Notes dashboard section.

TEACHER MODE
------------
Open teacher.html.
On the first visit, create the teacher password. This can happen only while no
teacher password is configured. The teacher password hash is stored in Apps
Script Script Properties, not in Google Sheets.

The teacher can:
- Add student
- Edit student name
- Reset password
- Assign/unassign courses
- Activate/deactivate student
- Delete student

SHEETS REQUIRED
---------------
Exams
Syllabus
Students
StudentProgress
StudentNotes
Settings

Use PrepOne_Student_Portal_Master_V12.xlsx as the canonical V12 workbook.
The live Sheet ID remains the one hard-coded in Code.gs.

DEPLOYMENT
----------
1. Replace Code.gs in Apps Script.
2. Confirm the Google Sheet tabs/headers match the V12 workbook.
3. Deploy Apps Script -> Manage deployments -> Edit -> New version -> Deploy.
4. Keep the existing /exec URL in config.js if the deployment URL did not change.
5. Replace GitHub files with this package.
6. Hard refresh the website (Ctrl+Shift+R).

V12 FEATURE UPDATE
------------------
- Strong chapter/topic visual separation.
- Course Navigator with search, subject filter and chapter filter.
- Official Website buttons on course cards and course header.
- Private topic notes for logged-in students only.
- Notes are displayed inside the topic workspace, immediately before MCQ.
- Removed the large global Personal Notes / Study Notes dashboard section.
- Note save/edit/delete operations validate the student's assigned course and
  the selected syllabus topic on the server.
- Note and progress writes use Apps Script LockService to reduce concurrent
  Google Sheets write collisions.
