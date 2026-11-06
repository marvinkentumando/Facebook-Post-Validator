'use strict';
// Lumad Lingua: Human annotations are deliberately separate from AI predictions.
const state = {posts: [], index: 0, view: 'dashboard', textMode: 'original', saving: false};
const $ = id => document.getElementById(id);
const show = (el, visible) => el.classList.toggle('hidden', !visible);
const clean = value => (value == null ? '' : String(value));
function htmlEscape(value) {return clean(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(message) {const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),3600);}
async function api(path, options={}) {
  const method=options.method||'GET';
  const res=await fetch(path, {credentials:'same-origin', ...options, headers:{...(method!=='GET'?{'X-Lumad-Request':'1'}:{}), ...options.headers}});
  const type=res.headers.get('Content-Type')||'';
  const data=type.includes('application/json')?await res.json():null;
  if(!res.ok){
    if(res.status===401 && path!=='/api/login'){showLogin();}
    throw new Error(data?.error || `Request failed (${res.status}).`);
  }
  return data;
}
function showLogin(){show($('loading'), false);show($('app'),false);show($('login'),true);$('password').focus();}
function showWorkspace(){show($('loading'),false);show($('login'),false);show($('app'),true);}
async function initialize(){
 try{
   const session=await api('/api/session');
   if(!session.authenticated){showLogin();return;}
   await loadPosts();showWorkspace();navigate('dashboard');
 }catch(e){show($('loading'),false);showLogin();$('login-error').textContent=e.message;show($('login-error'),true);}
}
async function loadPosts(){const out=await api('/api/posts');state.posts=out.posts||[]; if(state.index>=state.posts.length)state.index=Math.max(0,state.posts.length-1); refreshOverview();renderQueue();}
function summarize(){const s={total:state.posts.length,validated:0,pending:0,excluded:0,needs_review:0,skipped:0,Positive:0,Negative:0,Neutral:0};for(const p of state.posts){const key=p.human_status||'pending';s[key]=(s[key]||0)+1;if(key==='validated'&&p.human_sentiment in s)s[p.human_sentiment]++;}return s;}
function refreshOverview(){const s=summarize(), done=s.total-s.pending, percent=s.total?Math.round(done*100/s.total):0;
 $('hero-done').textContent=done; $('hero-total').textContent=s.total; $('hero-progress').style.width=`${percent}%`;$('hero-percent').textContent=`${percent}% complete`;$('hero-remaining').textContent=`${s.pending} still pending`;
 $('stat-validated').textContent=s.validated;$('stat-pending').textContent=s.pending;$('stat-excluded').textContent=s.excluded;$('stat-attention').textContent=s.needs_review+s.skipped;
 $('nav-pending').textContent=s.pending;$('count-positive').textContent=s.Positive;$('count-negative').textContent=s.Negative;$('count-neutral').textContent=s.Neutral;
 const max=Math.max(s.Positive,s.Negative,s.Neutral,1);for(const k of ['positive','negative','neutral'])$('bar-'+k).style.width=`${s[k[0].toUpperCase()+k.slice(1)]/max*100}%`;
 $('export-ready-count').textContent=s.validated;$('export-total-count').textContent=s.total;
}
const views={dashboard:'Overview',review:'Validate posts',queue:'Post library',export:'Data & export'};
function navigate(view){state.view=view;for(const v of Object.keys(views))show($('view-'+v),v===view);document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('topbar-current').textContent=views[view];$('sidebar').classList.remove('open');if(view==='review')renderPost();if(view==='queue')renderQueue();if(view==='dashboard')refreshOverview();window.scrollTo(0,0);}
function current(){return state.posts[state.index]||null;}
function goTo(index){if(!state.posts.length){toast('There are no posts yet. Import a CSV to begin.');navigate('export');return;}state.index=Math.max(0,Math.min(state.posts.length-1,index));state.textMode='original';navigate('review');}
function nextPending(){const start=state.index;for(let step=1;step<=state.posts.length;step++){const i=(start+step)%state.posts.length;if(state.posts[i].human_status==='pending'){goTo(i);return;}}toast('No pending posts remain. Review the library for unresolved or skipped posts.');navigate('queue');}
function firstPending(){const index=state.posts.findIndex(p=>p.human_status==='pending');if(index>=0)goTo(index);else if(state.posts.length){toast('All posts have been reviewed at least once.');navigate('queue');}else navigate('export');}
function displayStatus(status){return ({pending:'Pending',validated:'Validated',excluded:'Not Mansaka',needs_review:'Needs review',skipped:'Skipped'})[status]||'Pending';}
function radio(name, value){document.querySelectorAll(`input[name="${name}"]`).forEach(el=>el.checked=el.value===value);}
function selected(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||null;}
function languageChanged(){const lang=selected('language'),active=(lang==='mansaka'||lang==='mixed');document.querySelectorAll('.sentiment-card').forEach(el=>el.classList.toggle('disabled',!active));$('sentiment-disabled').classList.toggle('hidden',active);if(!active)radio('sentiment','');clearFormFeedback();}
function clearFormFeedback(){show($('review-error'),false);$('saved-indicator').textContent='';}
function renderPost(){const p=current();if(!p){$('review-number').textContent='0';return;}
 const total=state.posts.length;$('review-number').textContent=String(state.index+1).padStart(3,'0');$('review-total').textContent=total;$('review-progress-fill').style.width=`${(state.index+1)/total*100}%`;
 $('review-jump').value=state.index+1;$('review-jump').max=total;
 $('post-source').textContent=p.source_category==='group_post'?'Group post':'Public/page post';
 $('post-id').textContent=p.research_post_id;
 $('post-auto-language').textContent=p.language_classification||'—';$('post-confidence').textContent=clean(p.language_confidence)?`${p.language_confidence}/100 (uncalibrated)`: '—';
 $('post-evidence').textContent=p.mansaka_matching_evidence||'None recorded';$('post-grammar').textContent=p.grammar_evidence||'None recorded';$('post-sources').textContent=p.supporting_linguistic_sources||'None recorded';
 const badge=$('post-status-badge');badge.className='review-badge '+(p.human_status||'pending');badge.textContent='● '+displayStatus(p.human_status);
 radio('language',p.human_language||'');radio('sentiment',p.human_sentiment||'');$('review-notes').value=p.human_notes||'';
 languageChanged();setTextMode('original');
 show($('ai-panel'),p.human_status==='validated' && !!p.ai_reviewed_sentiment);
 $('ai-sentiment').textContent=p.ai_reviewed_sentiment||'';$('ai-rationale').textContent=p.ai_review_justification||'';
 $('saved-indicator').textContent=p.validated_at?`Last saved: ${formatTime(p.validated_at)} · revision ${p.revision}`:'';
 $('previous-post').disabled=state.index===0;$('next-post').disabled=state.index===total-1;
}
function setTextMode(mode){state.textMode=mode;const p=current();if(!p)return;$('post-body').textContent=(mode==='original'?(p.anonymized_text||p.cleaned_text):(p.cleaned_text||p.anonymized_text))||'[No text provided]';document.querySelectorAll('.switch-option').forEach(b=>b.classList.toggle('active',b.dataset.text===mode));}
function formatTime(raw){if(!raw)return'';const d=new Date(raw);return Number.isNaN(d.getTime())?raw:d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
async function saveValidation({next=false,skip=false}={}){
 const p=current();if(!p||state.saving)return;
 const language=selected('language'),sentiment=selected('sentiment'),notes=$('review-notes').value;
 if(!skip){
  if(!language){$('review-error').textContent='Please select a Mansaka language judgment.';show($('review-error'),true);return;}
  if((language==='mansaka'||language==='mixed')&&!sentiment){$('review-error').textContent='Please select Positive, Negative, or Neutral.';show($('review-error'),true);return;}
 }
 state.saving=true;$('save-next').disabled=true;$('save-stay').disabled=true;$('skip-post').disabled=true;clearFormFeedback();
 try{
  const saved=await api('/api/validation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({post_id:p.research_post_id,language,sentiment,notes,skip})});
  Object.assign(p,{human_language:saved.language,human_sentiment:saved.sentiment,human_notes:saved.notes,human_status:saved.status,validated_at:saved.validated_at,revision:saved.revision});
  refreshOverview();toast(skip?'Post skipped and marked for later.':'Human review saved successfully.');
  if(next){
    const pendingIdx=state.posts.findIndex((q,i)=>i>state.index&&q.human_status==='pending');
    if(pendingIdx>=0)goTo(pendingIdx);else{const earlier=state.posts.findIndex(q=>q.human_status==='pending');if(earlier>=0)goTo(earlier);else if(state.index<state.posts.length-1)goTo(state.index+1);else renderPost();}
  }else renderPost();
 }catch(e){$('review-error').textContent=e.message;show($('review-error'),true);}finally{state.saving=false;$('save-next').disabled=false;$('save-stay').disabled=false;$('skip-post').disabled=false;}
}
function renderQueue(){const search=$('search-posts').value.trim().toLocaleLowerCase(),status=$('filter-status').value,priority=$('filter-priority').value;
 const filtered=state.posts.map((p,i)=>({p,i})).filter(({p})=>(status==='all'||p.human_status===status)&&(priority==='all'||p.sentiment_review_priority===priority)&&(!search||`${p.research_post_id} ${p.anonymized_text} ${p.cleaned_text}`.toLocaleLowerCase().includes(search)));
 $('library-result-count').textContent=`${filtered.length} of ${state.posts.length} posts`;show($('no-library-results'),!filtered.length);
 const tbody=$('post-table-body');tbody.replaceChildren();const frag=document.createDocumentFragment();
 for(const {p,i} of filtered){const tr=document.createElement('tr');tr.tabIndex=0;tr.setAttribute('role','button');tr.setAttribute('aria-label',`Open ${p.research_post_id}`);
  const id=document.createElement('td');id.textContent=p.research_post_id;
  const excerpt=document.createElement('td');const span=document.createElement('span');span.className='table-excerpt';span.textContent=p.anonymized_text||p.cleaned_text;excerpt.append(span);
  const pri=document.createElement('td');pri.innerHTML=`<span class="priority-tag ${htmlEscape((p.sentiment_review_priority||'').toLowerCase())}">${htmlEscape(p.sentiment_review_priority||'Unrated')}</span>`;
  const statusEl=document.createElement('td');statusEl.innerHTML=`<span class="table-status ${htmlEscape(p.human_status)}">${htmlEscape(displayStatus(p.human_status))}</span>`;
  const open=document.createElement('td');open.textContent='↗';open.style.color='#447e6c';tr.append(id,excerpt,pri,statusEl,open);
  tr.addEventListener('click',()=>goTo(i));tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goTo(i);}});frag.append(tr);
 }tbody.append(frag);
}
async function exportCsv(mode){try{
 const res=await fetch(`/api/export?mode=${encodeURIComponent(mode)}`,{credentials:'same-origin'});
 if(!res.ok){const info=await res.json().catch(()=>({}));throw new Error(info.error||'Export failed.');}
 const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=({training:'lumad_lingua_validated_training.csv',all:'lumad_lingua_full_reviewed_dataset.csv',history:'lumad_lingua_validation_history.csv'})[mode];document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('CSV export prepared.');
}catch(e){toast(e.message);}}
async function importFile(file){if(!file)return;const label=$('import-message');if(file.size>6_000_000){label.textContent='File exceeds the 6 MB limit.';return;}label.textContent='Reading and importing CSV…';try{const csv=await file.text();const result=await api('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv})});await loadPosts();label.textContent=`Imported ${result.inserted} new posts · ${result.duplicates} duplicates ignored · ${result.invalid} invalid rows.`;toast('Import complete. Existing annotations were preserved.');}catch(e){label.textContent=e.message;}finally{$('csv-file').value='';}}
function bindEvents(){
 $('login-form').addEventListener('submit',async e=>{e.preventDefault();show($('login-error'),false);$('login-button').disabled=true;try{await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';await loadPosts();showWorkspace();navigate('dashboard');}catch(err){$('login-error').textContent=err.message;show($('login-error'),true);}finally{$('login-button').disabled=false;}});
 $('toggle-password').addEventListener('click',()=>{$('password').type=$('password').type==='password'?'text':'password';});
 $('logout-button').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});}catch{}showLogin();});
 $('mobile-menu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 document.querySelectorAll('.nav-link').forEach(x=>x.addEventListener('click',()=>navigate(x.dataset.view)));
 $('continue-button').addEventListener('click',firstPending);$('queue-next-pending').addEventListener('click',firstPending);
 $('previous-post').addEventListener('click',()=>goTo(state.index-1));$('next-post').addEventListener('click',()=>goTo(state.index+1));$('next-pending').addEventListener('click',nextPending);
 $('jump-button').addEventListener('click',()=>{const n=Number($('review-jump').value);if(Number.isInteger(n)&&n>=1&&n<=state.posts.length)goTo(n-1);else toast('Enter a valid post number.');});
 $('review-jump').addEventListener('keydown',e=>{if(e.key==='Enter'){$('jump-button').click();}});
 $('copy-post-id').addEventListener('click',async()=>{const id=current()?.research_post_id||'';try{await navigator.clipboard.writeText(id);toast('Post ID copied.');}catch{toast('Unable to copy ID in this browser.');}});
 document.querySelectorAll('.switch-option').forEach(el=>el.addEventListener('click',()=>setTextMode(el.dataset.text)));
 document.querySelectorAll('input[name="language"]').forEach(el=>el.addEventListener('change',languageChanged));
 document.querySelectorAll('input[name="sentiment"]').forEach(el=>el.addEventListener('change',clearFormFeedback));
 $('review-notes').addEventListener('input',clearFormFeedback);
 $('review-form').addEventListener('submit',e=>{e.preventDefault();saveValidation({next:true});});
 $('save-stay').addEventListener('click',()=>saveValidation());
 $('skip-post').addEventListener('click',()=>saveValidation({next:true,skip:true}));
 for(const id of ['search-posts','filter-status','filter-priority'])$(id).addEventListener(id==='search-posts'?'input':'change',renderQueue);
 document.querySelectorAll('.download').forEach(el=>el.addEventListener('click',()=>exportCsv(el.dataset.mode)));
 $('csv-file').addEventListener('change',e=>importFile(e.target.files?.[0]));
 document.addEventListener('keydown',e=>{if(state.view!=='review'||$('app').classList.contains('hidden'))return;
   const active=document.activeElement;if(active && (['INPUT','TEXTAREA','SELECT'].includes(active.tagName)||active.isContentEditable))return;
   if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveValidation({next:true});return;}
   if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['1','2','3'].includes(e.key)){
     const lang=selected('language');if(!['mansaka','mixed'].includes(lang))return;
     radio('sentiment',({'1':'Positive','2':'Negative','3':'Neutral'})[e.key]);clearFormFeedback();e.preventDefault();
   }
 });
}
bindEvents();initialize();
