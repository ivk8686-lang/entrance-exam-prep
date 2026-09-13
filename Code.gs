/**
 * PrepOne V12 — Public Courses + Student Learning Portal
 * Live Master Sheet: 1I1jdGPlN_GvOftfokf6pcKR0xCrpxMOHNnHjXOVRVmo
 *
 * Public: all active courses/content, no login required.
 * Student: password-protected personal dashboard + completion tracking + private topic notes.
 * Teacher: creates students, resets passwords, assigns courses.
 *
 * Teacher password is stored in Apps Script Script Properties, not the Sheet.
 * First setup is done from teacher.html through teacherSetup, then locked.
 */

const CONFIG = Object.freeze({
  APP_NAME: 'PrepOne',
  VERSION: '12.2-fixed-content-teacher-notes',
  MASTER_SPREADSHEET_ID: '1I1jdGPlN_GvOftfokf6pcKR0xCrpxMOHNnHjXOVRVmo',
  ENABLED_EXAMS: ['AP_EAPCET_E','AP_EAPCET_AP','NEET_UG','AP_POLYCET'],
  CACHE_SECONDS: 10,
  SESSION_SECONDS: 21600,
  SHEETS: {
    EXAMS: 'Exams',
    SYLLABUS: 'Syllabus',
    STUDENTS: 'Students',
    STUDENT_PROGRESS: 'StudentProgress',
    STUDENT_NOTES: 'StudentNotes',
    SETTINGS: 'Settings'
  }
});

function doGet(e) {
  ensureSystemSheets_();
  const p = (e && e.parameter) ? e.parameter : {};
  const action = clean_(p.action || 'health').toLowerCase();
  const callback = clean_(p.callback || '');
  try {
    let result;
    switch (action) {
      case 'health': result = health_(); break;
      case 'config': result = publicConfig_(); break;
      case 'schema': result = schema_(); break;
      case 'exams': result = getExams_(); break;
      case 'exam': result = getExam_(p.examId || p.exam || ''); break;
      case 'syllabus': result = getSyllabus_(p.examId || p.exam || ''); break;
      case 'course': result = getCourseBundle_(p.examId || p.exam || ''); break;

      case 'studentspublic': result = studentsPublic_(); break;
      case 'studentlogin': result = studentLogin_(p.studentId || '', p.passwordHash || ''); break;
      case 'studentsession': result = studentSession_(p.token || ''); break;
      case 'studentdashboard': result = studentDashboard_(p.token || ''); break;
      case 'studentcourseprogress': result = studentCourseProgress_(p.token || '', p.examId || p.exam || ''); break;
      case 'resourceprogress': result = resourceProgress_(p); break;
      case 'studentnotes': result = studentNotes_(p.token || ''); break;
      case 'studentsavenote': result = studentSaveNote_(p); break;
      case 'studentdeletenote': result = studentDeleteNote_(p); break;
      case 'studentlogout': result = logoutStudent_(p.token || ''); break;

      case 'teacherstatus': result = teacherStatus_(); break;
      case 'teachersetup': result = teacherSetup_(p.passwordHash || ''); break;
      case 'teacherlogin': result = teacherLogin_(p.passwordHash || ''); break;
      case 'teacherstudents': result = teacherStudents_(p.token || ''); break;
      case 'teachersavestudent': result = teacherSaveStudent_(p); break;
      case 'teacherdeletestudent': result = teacherDeleteStudent_(p); break;
      case 'teacherlogout': result = logoutTeacher_(p.token || ''); break;

      default:
        result = {ok:false,error:'Unknown action',action:action};
    }
    return output_(result, callback);
  } catch (err) {
    return output_({ok:false,error:err && err.message ? err.message : String(err)}, callback);
  }
}

function getMasterSpreadsheetId_(){
  const props=PropertiesService.getScriptProperties();
  const propId=clean_(props.getProperty('PREPONE_MASTER_SPREADSHEET_ID'));
  if(propId)return propId;
  try{ const active=SpreadsheetApp.getActiveSpreadsheet(); if(active)return active.getId(); }catch(_){}
  return CONFIG.MASTER_SPREADSHEET_ID;
}
function getSS_(){
  const id=getMasterSpreadsheetId_();
  try{return SpreadsheetApp.openById(id)}catch(err){
    throw new Error('Cannot open the PrepOne Master Sheet. Set Script Property PREPONE_MASTER_SPREADSHEET_ID to the live Google Sheet ID, or bind this Apps Script to the master Sheet.');
  }
}

function ensureSystemSheets_(){
  const ss=getSS_();
  ensureSheetHeaders_(ss,CONFIG.SHEETS.STUDENTS,['StudentID','StudentName','PasswordHash','AssignedCourses','Active','CreatedAt','LastLogin']);
  ensureSheetHeaders_(ss,CONFIG.SHEETS.STUDENT_PROGRESS,['ProgressID','StudentID','ExamID','SyllabusID','Subject','Chapter','Topic','ResourceKey','ResourceLabel','ResourceType','Completed','CompletedAt','LastOpenedAt']);
  ensureSheetHeaders_(ss,CONFIG.SHEETS.STUDENT_NOTES,['NoteID','StudentID','ExamID','Subject','Chapter','Topic','NoteTitle','NoteText','UpdatedAt']);
  ensureSheetHeaders_(ss,CONFIG.SHEETS.SETTINGS,['Key','Value','Description']);
}
function ensureSheetHeaders_(ss,name,headers){
  let sh=ss.getSheetByName(name);
  if(!sh)sh=ss.insertSheet(name);
  if(sh.getLastRow()===0 || sh.getLastColumn()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);return;}
  const existing=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getDisplayValues()[0].map(clean_);
  if(existing.filter(Boolean).length===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);}
}

function requireSheet_(name){ const sh=getSS_().getSheetByName(name); if(!sh) throw new Error('Missing sheet: '+name); return sh; }
function clean_(v){ return String(v === null || v === undefined ? '' : v).trim(); }
function num_(v,f){ const n=Number(v); return isFinite(n)?n:(f===undefined?0:f); }
function enabled_(v){ const s=clean_(v).toLowerCase(); return s==='' || !['false','0','no','off','inactive'].includes(s); }
function bool_(v){ return ['true','1','yes','on'].includes(clean_(v).toLowerCase()); }
function safeHash_(v){ const s=clean_(v).toLowerCase(); if(!/^[a-f0-9]{64}$/.test(s)) throw new Error('Invalid password hash'); return s; }
function sha256Hex_(text){ const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8); return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join(''); }
function credentialPepper_(){ const p=PropertiesService.getScriptProperties(); let v=p.getProperty('STUDENT_CREDENTIAL_PEPPER'); if(!v){v=Utilities.getUuid()+Utilities.getUuid();p.setProperty('STUDENT_CREDENTIAL_PEPPER',v)} return v; }
function studentCredential_(studentId,clientHash){ return sha256Hex_(clean_(studentId)+'|'+safeHash_(clientHash)+'|'+credentialPepper_()); }
function ensureExamAllowed_(id){ id=clean_(id); if(!id) throw new Error('examId is required'); if(CONFIG.ENABLED_EXAMS.indexOf(id)<0) throw new Error('Exam not enabled: '+id); return id; }
function indexMap_(headers){ const x={}; headers.forEach((h,i)=>x[h]=i); return x; }

function rowsAsObjects_(sheetName){
  const cache=CacheService.getScriptCache(), key='rows:'+sheetName, cached=cache.get(key);
  if(cached){ try{return JSON.parse(cached)}catch(_){} }
  const sh=requireSheet_(sheetName), vals=sh.getDataRange().getDisplayValues();
  if(!vals.length) return [];
  const heads=vals[0].map(clean_), rows=[];
  for(let r=1;r<vals.length;r++){
    if(vals[r].every(v=>clean_(v)==='')) continue;
    const o={}; heads.forEach((h,i)=>{if(h)o[h]=vals[r][i]!==undefined?vals[r][i]:''}); rows.push(o);
  }
  try{cache.put(key,JSON.stringify(rows),CONFIG.CACHE_SECONDS)}catch(_){}
  return rows;
}
function clearCache_(){ const c=CacheService.getScriptCache(); Object.keys(CONFIG.SHEETS).forEach(k=>{try{c.remove('rows:'+CONFIG.SHEETS[k])}catch(_){}}); }

function health_(){
  const ss=getSS_(), existing=ss.getSheets().map(s=>s.getName()), required=Object.values(CONFIG.SHEETS), missing=required.filter(x=>existing.indexOf(x)<0);
  const exams=existing.includes(CONFIG.SHEETS.EXAMS)?rowsAsObjects_(CONFIG.SHEETS.EXAMS).length:0;
  const syllabus=existing.includes(CONFIG.SHEETS.SYLLABUS)?rowsAsObjects_(CONFIG.SHEETS.SYLLABUS).length:0;
  const students=existing.includes(CONFIG.SHEETS.STUDENTS)?rowsAsObjects_(CONFIG.SHEETS.STUDENTS).filter(r=>enabled_(r.Active)).length:0;
  return {ok:missing.length===0,app:CONFIG.APP_NAME,version:CONFIG.VERSION,spreadsheetId:getMasterSpreadsheetId_(),spreadsheetName:ss.getName(),missingSheets:missing,counts:{exams,syllabus,students},teacherConfigured:teacherConfigured_(),serverTime:new Date().toISOString()};
}
function publicConfig_(){ return {ok:true,app:CONFIG.APP_NAME,version:CONFIG.VERSION,enabledExams:CONFIG.ENABLED_EXAMS.slice(),publicCourses:true,studentTracking:true,resourceColumns:['MCQ Quiz','Video 1','Video 2','Video 3','PDF 1','PDF 2','Website 1','Website 2','Audio 1','Audio 2','Image 1','Image 2']}; }
function schema_(){
  const sh=requireSheet_(CONFIG.SHEETS.SYLLABUS), heads=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(clean_);
  return {ok:true,syllabusHeaders:heads,studentHeaders:requireSheet_(CONFIG.SHEETS.STUDENTS).getRange(1,1,1,requireSheet_(CONFIG.SHEETS.STUDENTS).getLastColumn()).getDisplayValues()[0]};
}

// ---------------- PUBLIC COURSE CONTENT ----------------
function getExams_(){
  const rows=rowsAsObjects_(CONFIG.SHEETS.EXAMS).filter(r=>CONFIG.ENABLED_EXAMS.includes(clean_(r.ExamID))).filter(r=>enabled_(r.Active));
  rows.sort((a,b)=>num_(a.DisplayOrder,999)-num_(b.DisplayOrder,999));
  return {ok:true,exams:rows};
}
function getExam_(examId){
  const id=ensureExamAllowed_(examId), exam=rowsAsObjects_(CONFIG.SHEETS.EXAMS).find(r=>clean_(r.ExamID)===id && enabled_(r.Active));
  return exam?{ok:true,exam}:{ok:false,error:'Exam not found',examId:id};
}
function getSyllabus_(examId){
  const id=ensureExamAllowed_(examId);
  const rows=rowsAsObjects_(CONFIG.SHEETS.SYLLABUS).filter(r=>clean_(r.ExamID)===id && enabled_(r.Active)).sort((a,b)=>num_(a.UnitOrder,999)-num_(b.UnitOrder,999)||num_(a.ChapterOrder,999)-num_(b.ChapterOrder,999)||num_(a.TopicOrder,999)-num_(b.TopicOrder,999));
  const optionalResources=optionalResourceRows_();
  return {ok:true,examId:id,syllabus:rows.map(r=>normalizeTopic_(r,optionalResources)),count:rows.length};
}
function optionalResourceRows_(){
  try{
    const ss=getSS_(),sh=ss.getSheetByName('Resources');
    if(!sh)return [];
    return rowsAsObjects_('Resources').filter(r=>enabled_(r.Active));
  }catch(_){return []}
}
function getCourseBundle_(examId){
  const e=getExam_(examId); if(!e.ok)return e; const s=getSyllabus_(examId); return {ok:true,exam:e.exam,syllabus:s.syllabus,summary:buildCourseSummary_(s.syllabus)};
}
function normalizeTopic_(row,optionalResources=[]){
  const links=extractTopicResources_(row,optionalResources);
  return {...row,ResourceLinks:links,HasMCQ:links.some(x=>x.Type==='MCQ')};
}
function extractTopicResources_(row,optionalResources=[]){
  const resourceColumns=['Video 1','Video 2','Video 3','PDF 1','PDF 2','Website 1','Website 2','Audio 1','Audio 2','Image 1','Image 2','MCQ Quiz','MCQURL'];
  const out=[],seen=new Set();
  resourceColumns.forEach((label,i)=>{
    const u=normalizeUrl_(row[label]);
    if(!u || !/^https?:\/\//i.test(u))return;
    const type=label==='MCQ Quiz'||label==='MCQURL'?'MCQ':resourceType_(label,u);
    const key=label==='MCQURL'?'MCQ Quiz':label;
    const d=(key+'|'+u).toLowerCase(); if(seen.has(d))return; seen.add(d);
    out.push({Key:key,Label:key,URL:u,Type:type,Order:i});
  });
  (optionalResources||[]).filter(r=>clean_(r.SyllabusID)===clean_(row.SyllabusID) || (clean_(r.ExamID)===clean_(row.ExamID)&&clean_(r.Subject)===clean_(row.Subject)&&clean_(r.Chapter)===clean_(row.Chapter)&&clean_(r.Topic)===clean_(row.Topic))).forEach((r,i)=>{
    const u=normalizeUrl_(r.ResourceURL||r.URL||r.Link); if(!u || !/^https?:\/\//i.test(u))return;
    const label=clean_(r.ResourceTitle||r.Title||r.Label||r.ResourceType||'Resource '+(i+1));
    const key=clean_(r.ResourceID)||label, d=(key+'|'+u).toLowerCase(); if(seen.has(d))return; seen.add(d);
    out.push({Key:key,Label:label,URL:u,Type:clean_(r.ResourceType)||resourceType_(label,u),Order:1000+num_(r.ResourceOrder,i)});
  });
  out.sort((a,b)=>{const am=a.Type==='MCQ',bm=b.Type==='MCQ';if(am!==bm)return am?1:-1;return num_(a.Order,9999)-num_(b.Order,9999)});
  return out;
}
function normalizeUrl_(v){ let u=clean_(v); if(/^http:\/\/script\.google\.com\//i.test(u))u='https://'+u.slice(7); return u; }
function resourceType_(label,url){ const s=(clean_(label)+' '+clean_(url)).toLowerCase(); if(/mcq|quiz|test/.test(s))return'MCQ'; if(/youtube|youtu\.be/.test(s))return'YOUTUBE'; if(/video|\.mp4|\.webm|\.m4v/.test(s))return'VIDEO'; if(/pdf|\.pdf/.test(s))return'PDF'; if(/audio|\.mp3|\.wav|\.m4a|\.ogg|\.aac/.test(s))return'AUDIO'; if(/image|photo|diagram|\.png|\.jpe?g|\.webp|\.gif/.test(s))return'IMAGE'; return'WEBSITE'; }
function buildCourseSummary_(syllabus){
  const subjects={}; let resources=0;
  syllabus.forEach(t=>{const s=t.Subject||'General',c=t.Chapter||'General'; if(!subjects[s])subjects[s]={topicCount:0,resourceCount:0,chapters:{}}; if(!subjects[s].chapters[c])subjects[s].chapters[c]={topicCount:0,resourceCount:0}; const n=(t.ResourceLinks||[]).length; resources+=n; subjects[s].topicCount++;subjects[s].resourceCount+=n;subjects[s].chapters[c].topicCount++;subjects[s].chapters[c].resourceCount+=n;});
  return {subjectCount:Object.keys(subjects).length,topicCount:syllabus.length,resourceCount:resources,subjects};
}

// ---------------- STUDENTS ----------------
function studentsPublic_(){
  const rows=rowsAsObjects_(CONFIG.SHEETS.STUDENTS).filter(r=>enabled_(r.Active)).map(r=>({StudentID:clean_(r.StudentID),StudentName:clean_(r.StudentName)})).filter(r=>r.StudentID&&r.StudentName).sort((a,b)=>a.StudentName.localeCompare(b.StudentName));
  return {ok:true,students:rows};
}
function studentLogin_(studentId,passwordHash){
  const id=clean_(studentId), hash=safeHash_(passwordHash); if(!id)throw new Error('Select a student');
  const sh=requireSheet_(CONFIG.SHEETS.STUDENTS), vals=sh.getDataRange().getValues(), heads=vals[0].map(clean_), ix=indexMap_(heads);
  for(let i=1;i<vals.length;i++){
    if(clean_(vals[i][ix.StudentID])===id && enabled_(vals[i][ix.Active])){
      if(clean_(vals[i][ix.PasswordHash]).toLowerCase()!==studentCredential_(id,hash)) return {ok:false,error:'Incorrect password'};
      if(ix.LastLogin!==undefined){vals[i][ix.LastLogin]=new Date();sh.getRange(i+1,1,1,heads.length).setValues([vals[i]])}
      clearCache_(); const token=createSession_('student',id); return {ok:true,token:token,student:studentSafe_(objectFromRow_(heads,vals[i]))};
    }
  }
  return {ok:false,error:'Student not found'};
}
function studentSession_(token){ const id=requireSession_('student',token); const s=findStudent_(id); return {ok:true,student:studentSafe_(s)}; }
function logoutStudent_(token){ deleteSession_('student',token); return {ok:true}; }
function findStudent_(studentId){ const s=rowsAsObjects_(CONFIG.SHEETS.STUDENTS).find(r=>clean_(r.StudentID)===clean_(studentId)&&enabled_(r.Active)); if(!s)throw new Error('Student account is inactive or missing'); return s; }
function studentSafe_(s){ return {StudentID:clean_(s.StudentID),StudentName:clean_(s.StudentName),AssignedCourses:courseIds_(s.AssignedCourses),Active:enabled_(s.Active),CreatedAt:s.CreatedAt||'',LastLogin:s.LastLogin||''}; }
function courseIds_(csv){ return clean_(csv).split(',').map(clean_).filter(x=>CONFIG.ENABLED_EXAMS.includes(x)); }
function assertAssigned_(student,examId){ const id=ensureExamAllowed_(examId), ids=courseIds_(student.AssignedCourses); if(ids.indexOf(id)<0)throw new Error('This course is not assigned to the student'); return id; }
function studentCourseProgress_(token,examId){ const sid=requireSession_('student',token), student=findStudent_(sid), id=assertAssigned_(student,examId); return {ok:true,student:studentSafe_(student),examId:id,progress:progressRows_(sid,id)}; }
function studentDashboard_(token){
  const sid=requireSession_('student',token), student=findStudent_(sid), assigned=courseIds_(student.AssignedCourses), exams=getExams_().exams.filter(e=>assigned.includes(clean_(e.ExamID))), allProgress=progressRows_(sid,'');
  const courses=exams.map(e=>{
    const sy=getSyllabus_(e.ExamID).syllabus, progress=allProgress.filter(p=>clean_(p.ExamID)===e.ExamID), completedMap=completedMap_(progress); let totalRes=0,doneRes=0,totalTopics=0,doneTopics=0;
    sy.forEach(t=>{const links=t.ResourceLinks||[]; if(!links.length)return; totalTopics++; let td=0; links.forEach(r=>{totalRes++; if(completedMap[progressKey_(t.SyllabusID,r.Key)]){doneRes++;td++;}}); if(td===links.length)doneTopics++;});
    return {ExamID:e.ExamID,ExamName:e.ExamName,ShortName:e.ShortName,Category:e.Category,OfficialURL:e.OfficialURL||'',totalResources:totalRes,completedResources:doneRes,totalTopics:totalTopics,completedTopics:doneTopics,percent:totalRes?Math.round(doneRes/totalRes*100):0};
  });
  const recent=allProgress.filter(p=>clean_(p.LastOpenedAt)).sort((a,b)=>new Date(b.LastOpenedAt)-new Date(a.LastOpenedAt)).slice(0,8);
  const totals=courses.reduce((a,c)=>({resources:a.resources+c.totalResources,completed:a.completed+c.completedResources,topics:a.topics+c.totalTopics,topicsDone:a.topicsDone+c.completedTopics}),{resources:0,completed:0,topics:0,topicsDone:0});
  return {ok:true,student:studentSafe_(student),courses:courses,recent:recent,totals:{...totals,percent:totals.resources?Math.round(totals.completed/totals.resources*100):0}};
}
function progressRows_(studentId,examId){ let rows=rowsAsObjects_(CONFIG.SHEETS.STUDENT_PROGRESS).filter(r=>clean_(r.StudentID)===clean_(studentId)); if(examId)rows=rows.filter(r=>clean_(r.ExamID)===clean_(examId)); return rows; }
function completedMap_(rows){ const m={}; rows.forEach(r=>{if(bool_(r.Completed))m[progressKey_(r.SyllabusID,r.ResourceKey)]=true}); return m; }
function progressKey_(syllabusId,resourceKey){ return clean_(syllabusId)+'::'+clean_(resourceKey); }
function resourceProgress_(p){
  const sid=requireSession_('student',p.token||''), student=findStudent_(sid), examId=assertAssigned_(student,p.examId||p.exam||''), syllabusId=clean_(p.syllabusId), resourceKey=clean_(p.resourceKey), completed=clean_(p.completed); if(!syllabusId||!resourceKey)throw new Error('Missing resource identity');
  const topic=getSyllabus_(examId).syllabus.find(t=>clean_(t.SyllabusID)===syllabusId); if(!topic)throw new Error('Topic not found'); const resource=(topic.ResourceLinks||[]).find(r=>clean_(r.Key)===resourceKey); if(!resource)throw new Error('Resource not found');
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const sh=requireSheet_(CONFIG.SHEETS.STUDENT_PROGRESS), vals=sh.getDataRange().getValues(), heads=vals[0].map(clean_), ix=indexMap_(heads); let row=-1;
    for(let i=1;i<vals.length;i++){if(clean_(vals[i][ix.StudentID])===sid&&clean_(vals[i][ix.ExamID])===examId&&clean_(vals[i][ix.SyllabusID])===syllabusId&&clean_(vals[i][ix.ResourceKey])===resourceKey){row=i;break;}}
    const now=new Date(), existing=row>=0?objectFromRow_(heads,vals[row]):{}; const isComplete=completed===''?bool_(existing.Completed):bool_(completed);
    const obj={ProgressID:existing.ProgressID||Utilities.getUuid(),StudentID:sid,ExamID:examId,SyllabusID:syllabusId,Subject:topic.Subject,Chapter:topic.Chapter,Topic:topic.Topic,ResourceKey:resourceKey,ResourceLabel:resource.Label,ResourceType:resource.Type,Completed:isComplete,CompletedAt:isComplete?(existing.CompletedAt||now):'',LastOpenedAt:now};
    if(row>=0)writeObjectToRow_(sh,heads,row+1,obj);else appendObject_(sh,heads,obj); clearCache_(); return {ok:true,progress:obj};
  } finally {try{lock.releaseLock()}catch(_) {}}
}

// ---------------- TEACHER ----------------
function teacherConfigured_(){ return !!clean_(PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD_HASH')); }
function teacherStatus_(){ return {ok:true,configured:teacherConfigured_()}; }
function teacherSetup_(passwordHash){ if(teacherConfigured_())return {ok:false,error:'Teacher password is already configured'}; const hash=safeHash_(passwordHash); PropertiesService.getScriptProperties().setProperty('TEACHER_PASSWORD_HASH',hash); const token=createSession_('teacher','teacher'); return {ok:true,configured:true,token:token}; }
function teacherLogin_(passwordHash){ if(!teacherConfigured_())return {ok:false,error:'Teacher account has not been configured yet'}; const hash=safeHash_(passwordHash), stored=clean_(PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD_HASH')).toLowerCase(); if(hash!==stored)return {ok:false,error:'Incorrect teacher password'}; return {ok:true,token:createSession_('teacher','teacher')}; }
function logoutTeacher_(token){ deleteSession_('teacher',token); return {ok:true}; }
function requireTeacher_(token){ return requireSession_('teacher',token); }
function teacherStudents_(token){ requireTeacher_(token); const students=rowsAsObjects_(CONFIG.SHEETS.STUDENTS).map(studentSafe_).sort((a,b)=>a.StudentName.localeCompare(b.StudentName)); return {ok:true,students:students,exams:getExams_().exams}; }
function teacherSaveStudent_(p){
  requireTeacher_(p.token||''); const id=clean_(p.studentId), name=clean_(p.studentName), pass=clean_(p.passwordHash), courses=clean_(p.assignedCourses), active=clean_(p.active)===''?true:bool_(p.active); if(!name)throw new Error('Student name is required'); if(!id&&!pass)throw new Error('Password is required for a new student'); if(pass)safeHash_(pass);
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const courseIds=courseIds_(courses); const sh=requireSheet_(CONFIG.SHEETS.STUDENTS), vals=sh.getDataRange().getValues(), heads=vals[0].map(clean_), ix=indexMap_(heads); let row=-1;
    if(id){for(let i=1;i<vals.length;i++){if(clean_(vals[i][ix.StudentID])===id){row=i;break;}}}
    const existing=row>=0?objectFromRow_(heads,vals[row]):{}; const studentId=id||('STU-'+Utilities.getUuid().slice(0,8).toUpperCase());
    const storedPass=pass?studentCredential_(studentId,pass):(existing.PasswordHash||''); const obj={StudentID:studentId,StudentName:name,PasswordHash:storedPass,AssignedCourses:courseIds.join(','),Active:active,CreatedAt:existing.CreatedAt||new Date(),LastLogin:existing.LastLogin||''};
    if(row>=0)writeObjectToRow_(sh,heads,row+1,obj);else appendObject_(sh,heads,obj); clearCache_(); return {ok:true,student:studentSafe_(obj)};
  } finally {try{lock.releaseLock()}catch(_) {}}
}
function teacherDeleteStudent_(p){ requireTeacher_(p.token||''); const id=clean_(p.studentId); if(!id)throw new Error('studentId is required'); const lock=LockService.getScriptLock();lock.waitLock(5000);try{const sh=requireSheet_(CONFIG.SHEETS.STUDENTS), vals=sh.getDataRange().getValues(), heads=vals[0].map(clean_), ix=heads.indexOf('StudentID'); for(let i=1;i<vals.length;i++){if(clean_(vals[i][ix])===id){sh.deleteRow(i+1); clearCache_(); return {ok:true,deleted:true}}} return {ok:true,deleted:false};} finally {try{lock.releaseLock()}catch(_) {}} }

// ---------------- SESSION / ROW HELPERS ----------------
function createSession_(kind,value){ const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'').slice(0,12); CacheService.getScriptCache().put('session:'+kind+':'+token,clean_(value),CONFIG.SESSION_SECONDS); return token; }
function requireSession_(kind,token){ token=clean_(token); if(!token)throw new Error('Login required'); const v=CacheService.getScriptCache().get('session:'+kind+':'+token); if(!v)throw new Error('Session expired. Please log in again.'); return v; }
function deleteSession_(kind,token){ try{CacheService.getScriptCache().remove('session:'+kind+':'+clean_(token))}catch(_){} }
function objectFromRow_(heads,row){ const o={}; heads.forEach((h,i)=>{if(h)o[h]=row[i]}); return o; }
function appendObject_(sheet,heads,obj){ sheet.appendRow(heads.map(h=>Object.prototype.hasOwnProperty.call(obj,h)?obj[h]:'')); }
function writeObjectToRow_(sheet,heads,rowNumber,obj){ const current=sheet.getRange(rowNumber,1,1,heads.length).getValues()[0]; heads.forEach((h,i)=>{if(Object.prototype.hasOwnProperty.call(obj,h))current[i]=obj[h]}); sheet.getRange(rowNumber,1,1,heads.length).setValues([current]); }
function output_(payload,callback){ const json=JSON.stringify(payload); if(callback){ if(!/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback))return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Invalid callback'})).setMimeType(ContentService.MimeType.JSON); return ContentService.createTextOutput(callback+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);} return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON); }


// ---------------- STUDENT NOTES ----------------
function studentNotes_(token){
  const sid=requireSession_('student',token);
  const rows=rowsAsObjects_(CONFIG.SHEETS.STUDENT_NOTES).filter(r=>clean_(r.StudentID)===sid);
  rows.sort((a,b)=>String(b.UpdatedAt||'').localeCompare(String(a.UpdatedAt||'')));
  return {ok:true,notes:rows};
}
function assertAssignedTopic_(student,examId,subject,chapter,topic){
  const id=assertAssigned_(student,examId), wantedSubject=clean_(subject), wantedChapter=clean_(chapter), wantedTopic=clean_(topic);
  if(!wantedSubject||!wantedChapter||!wantedTopic)throw new Error('Choose subject, chapter and topic');
  const match=getSyllabus_(id).syllabus.find(r=>clean_(r.Subject)===wantedSubject&&clean_(r.Chapter)===wantedChapter&&clean_(r.Topic)===wantedTopic);
  if(!match)throw new Error('Selected topic is not available in this course');
  return match;
}
function studentSaveNote_(p){
  const sid=requireSession_('student',p.token||''), id=clean_(p.noteId||''), examId=ensureExamAllowed_(p.examId||p.exam||'');
  const subject=clean_(p.subject),chapter=clean_(p.chapter),topic=clean_(p.topic),title=clean_(p.noteTitle).slice(0,120),text=clean_(p.noteText).slice(0,2000);
  if(!text)throw new Error('Note text is required');
  const student=findStudent_(sid), topicRow=assertAssignedTopic_(student,examId,subject,chapter,topic);
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const sh=requireSheet_(CONFIG.SHEETS.STUDENT_NOTES),vals=sh.getDataRange().getValues(),heads=vals[0].map(clean_),ix=indexMap_(heads);let row=-1,existing={};
    if(id){for(let i=1;i<vals.length;i++){if(clean_(vals[i][ix.NoteID])===id&&clean_(vals[i][ix.StudentID])===sid){row=i;existing=objectFromRow_(heads,vals[i]);break}}}
    const note={NoteID:id||('NOTE-'+Utilities.getUuid().slice(0,12).toUpperCase()),StudentID:sid,ExamID:examId,Subject:topicRow.Subject,Chapter:topicRow.Chapter,Topic:topicRow.Topic,NoteTitle:title,NoteText:text,UpdatedAt:new Date()};
    if(row>=0)writeObjectToRow_(sh,heads,row+1,note);else appendObject_(sh,heads,note);clearCache_();
    return {ok:true,note:{...note,UpdatedAt:new Date(note.UpdatedAt).toISOString()}};
  } finally {try{lock.releaseLock()}catch(_) {}}
}
function studentDeleteNote_(p){
  const sid=requireSession_('student',p.token||''),id=clean_(p.noteId||'');if(!id)throw new Error('noteId is required');
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const sh=requireSheet_(CONFIG.SHEETS.STUDENT_NOTES),vals=sh.getDataRange().getValues(),heads=vals[0].map(clean_),ix=indexMap_(heads);
    for(let i=1;i<vals.length;i++){if(clean_(vals[i][ix.NoteID])===id&&clean_(vals[i][ix.StudentID])===sid){sh.deleteRow(i+1);clearCache_();return {ok:true,deleted:true}}}
    return {ok:true,deleted:false};
  } finally {try{lock.releaseLock()}catch(_) {}}
}
