const SUPABASE_URL = 'https://hkxegnjlxuscusygckqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kO22Zj703int4nZp8ha9jg_hwgz5f9X';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
async function openSecureAdmin(){
  const {data:{session}} = await supabaseClient.auth.getSession();

  if(!session){
    const email = prompt('Admin email:');
    if(!email) return;

    const password = prompt('Admin password:');
    if(!password) return;

    const {error} = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if(error){
      alert('Admin login failed: ' + error.message);
      return;
    }
  }

  adminView();
  openModal('#adminModal');
}
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const store = {
  get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
};

const defaults = [
  {id:'g63', title:'Mercedes-Benz G63', price:2.99, image:'g63.jpg', closes:'2026-09-18T20:00:00', max:10000, sold:7300, status:'live', description:'A premium Mercedes-Benz G63 prize package. Exact specification and prize terms must be confirmed before launch.'},
  {id:'iphone16', title:'iPhone 16 Pro Max', price:1.99, image:'iphone.jpg', closes:'2026-09-12T20:00:00', max:10000, sold:8200, status:'live', description:'Latest-generation smartphone prize package. Replace demo details with your final prize specification.'},
  {id:'ps5', title:'PlayStation 5 Pro', price:1.49, image:'ps5.jpg', closes:'2026-09-15T20:00:00', max:10000, sold:6800, status:'live', description:'Console prize package. Demo competition content only.'},
  {id:'rolex', title:'Rolex Submariner', price:4.99, image:'rolex.jpg', closes:'2026-09-20T20:00:00', max:10000, sold:6100, status:'live', description:'Luxury watch prize package. Verify provenance, value and exact model before publishing.'}
];
if(!localStorage.getItem('nexa_competitions')) store.set('nexa_competitions', defaults);
if(!localStorage.getItem('nexa_cart')) store.set('nexa_cart', []);
if(!localStorage.getItem('nexa_orders')) store.set('nexa_orders', []);
if(!localStorage.getItem('nexa_winners')) store.set('nexa_winners', []);

let competitions = store.get('nexa_competitions', defaults);
let cart = store.get('nexa_cart', []);
let user = store.get('nexa_user', null);
let orders = store.get('nexa_orders', []);
let winners = store.get('nexa_winners', []);
async function loadCompetitionsFromSupabase(){
  const { data, error } = await supabaseClient
    .from('competitions')
    .select('*')
    .order('created_at', { ascending: false });

  if(error){
    console.error('Supabase competitions error:', error);
    return;
  }

  if(data && data.length){
    competitions = data.map(r => ({
      id: String(r.id),
      title: r.title,
      price: Number(r.price),
      image: r.image_url,
      closes: r.closes_at,
      max: Number(r.max_entries),
      sold: Number(r.sold || 0),
      status: r.status || 'live',
    description: r.description || '',
skill_question: r.skill_question || '',
skill_option_a: r.skill_option_a || '',
skill_option_b: r.skill_option_b || '',
skill_option_c: r.skill_option_c || '',

    }));

    renderDraws();
  }
}

function money(n){ return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n); }
function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function daysLeft(date){ const d=Math.ceil((new Date(date)-new Date())/86400000); return d>0 ? `ENDS IN ${d} DAY${d===1?'':'S'}` : 'CLOSING / CLOSED'; }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function openModal(id){ $(id).classList.add('show'); $(id).setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closeModals(){ $$('.modal').forEach(m=>{m.classList.remove('show');m.setAttribute('aria-hidden','true')}); document.body.classList.remove('modal-open'); }

function renderDraws(){
  
  const live = competitions.filter(c=>c.status==='live');
  $('#drawCards').innerHTML = live.length ? live.map(c=>{
    const pct=Math.min(100, Math.round((c.sold/c.max)*100));
    return `<article class="card" data-id="${escapeHtml(c.id)}"><div class="card-img"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}"><span>${daysLeft(c.closes)}</span></div><div class="card-body"><h3>${escapeHtml(c.title)}</h3><p>${money(c.price)} per entry</p><div class="bar"><i style="width:${pct}%"></i></div><div class="stats"><b>${pct}% sold</b><span>${c.sold.toLocaleString()} / ${c.max.toLocaleString()}</span></div><button class="enter" data-open-comp="${escapeHtml(c.id)}">ENTER NOW</button></div></article>`
  }).join('') : '<p class="empty">No live competitions right now.</p>';
  $$('[data-open-comp]').forEach(b=>b.onclick=()=>showCompetition(b.dataset.openComp));
}

let skillPassed = false;
function showCompetition(id){
  const c=competitions.find(x=>x.id===id); if(!c) return;
  const remaining=Math.max(0,c.max-c.sold);
  $('#competitionContent').innerHTML=`<div class="competition-detail"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}"><div><p class="eyebrow">LIVE COMPETITION</p><h2>${escapeHtml(c.title)}</h2><p>${escapeHtml(c.description)}</p><div class="detail-price">${money(c.price)} <small>per entry</small></div><p><strong>${remaining.toLocaleString()}</strong> entries remaining · closes ${new Date(c.closes).toLocaleString('en-GB')}</p><label class="field">Number of entries<input id="entryQty" type="number" min="1" max="100" value="1"></label><button class="btn gold full" id="addToCart">ADD TO BASKET</button><p class="micro">Demo only. No payment is processed.</p></div></div>`;
$('#addToCart').onclick=()=>openSkillQuestion(id);
  openModal('#competitionModal');
}
function openSkillQuestion(id){
  const c=competitions.find(x=>x.id===id);
  if(!c) return;

  const qty=Math.max(1,Math.min(100,Number($('#entryQty').value)||1));

  $('#skillQuestion').textContent='Which number is the result of 12 × 8?';
  $('#skillAnswers').innerHTML=`
    <button class="btn outline full" data-skill="84">84</button>
    <button class="btn outline full" data-skill="96">96</button>
    <button class="btn outline full" data-skill="108">108</button>
  `;
  $('#skillError').textContent='';

 $$('[data-skill]').forEach(b=>b.onclick=async()=>{
  $('#skillError').textContent='Checking answer...';

  const {data,error}=await supabaseClient.functions.invoke('check-skill-answer',{
    body:{answer:b.dataset.skill}
  });

  if(!error && data?.correct){
    skillPassed=true;
    addToCart(id,qty);
    closeModals();
    openCart();
  }else{
    $('#skillError').textContent='Incorrect answer. Please try again.';
  }
});

  closeModals();
  openModal('#skillModal');
}
function addToCart(id,qty){
  const found=cart.find(x=>x.id===id); if(found) found.qty+=qty; else cart.push({id,qty});
  store.set('nexa_cart',cart); updateCartCount(); toast('Entries added to your basket');
}
function updateCartCount(){ cart=store.get('nexa_cart',[]); $('#cartCount').textContent=cart.reduce((a,b)=>a+b.qty,0); }
function openCart(){
  cart=store.get('nexa_cart',[]); competitions=store.get('nexa_competitions',defaults);
  let total=0;
  $('#cartItems').innerHTML=cart.length ? cart.map((item,i)=>{ const c=competitions.find(x=>x.id===item.id); if(!c) return ''; const line=c.price*item.qty; total+=line; return `<div class="cart-line"><div><strong>${escapeHtml(c.title)}</strong><small>${item.qty} × ${money(c.price)}</small></div><div><b>${money(line)}</b><button class="remove" data-remove="${i}">Remove</button></div></div>`; }).join('') : '<p class="empty">Your basket is empty.</p>';
  $('#cartTotal').textContent=money(total);
  $$('[data-remove]').forEach(b=>b.onclick=()=>{cart.splice(Number(b.dataset.remove),1);store.set('nexa_cart',cart);updateCartCount();openCart();});
  $('#checkoutBtn').disabled=!cart.length;
  openModal('#cartModal');
}

function randomTicket(){ return 'NX-'+Math.random().toString(36).slice(2,8).toUpperCase(); }
function checkout(){
  if(!cart.length) return;
  if(!user){ closeModals(); renderAccount(true); openModal('#accountModal'); return; }
  const items=cart.map(item=>{const c=competitions.find(x=>x.id===item.id);return {...item,title:c.title,price:c.price,tickets:Array.from({length:item.qty},randomTicket)}});
  const total=items.reduce((s,x)=>s+x.price*x.qty,0);
  const order={id:'ORD-'+Date.now().toString().slice(-8), date:new Date().toISOString(), userEmail:user.email, items,total,status:'DEMO — NOT PAID'};
  orders.unshift(order);store.set('nexa_orders',orders);store.set('nexa_cart',[]);cart=[];updateCartCount();closeModals();toast(`Demo order ${order.id} created`);renderAccount(false);openModal('#accountModal');
}

function renderAccount(forceSignup=false){
  user=store.get('nexa_user',null); orders=store.get('nexa_orders',[]);
  if(!user || forceSignup){
    $('#accountContent').innerHTML=`<p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Create your demo account</h2><p>Stored only in this browser for the prototype.</p><form id="accountForm"><label class="field">Name<input name="name" required autocomplete="name"></label><label class="field">Email<input name="email" type="email" required autocomplete="email"></label><button class="btn gold full" type="submit">CREATE ACCOUNT</button></form>`;
    $('#accountForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);user={name:fd.get('name'),email:fd.get('email'),created:new Date().toISOString()};store.set('nexa_user',user);updateAccountLabel();toast('Demo account created'); if(cart.length){closeModals();openCart();} else renderAccount(false);};
    return;
  }
  const mine=orders.filter(o=>o.userEmail===user.email);
  $('#accountContent').innerHTML=`<p class="eyebrow">MY NEXA</p><h2>Welcome, ${escapeHtml(user.name)}</h2><p>${escapeHtml(user.email)}</p><div class="account-orders"><h3>Your demo orders</h3>${mine.length?mine.map(o=>`<div class="order"><div><strong>${escapeHtml(o.id)}</strong><small>${new Date(o.date).toLocaleString('en-GB')} · ${escapeHtml(o.status)}</small></div><b>${money(o.total)}</b><details><summary>View tickets</summary>${o.items.map(it=>`<p>${escapeHtml(it.title)} — ${it.tickets.map(escapeHtml).join(', ')}</p>`).join('')}</details></div>`).join(''):'<p class="empty">No orders yet.</p>'}</div><button class="btn outline full" id="logoutBtn">LOG OUT</button>`;
  $('#logoutBtn').onclick=()=>{localStorage.removeItem('nexa_user');user=null;updateAccountLabel();renderAccount(false);};
}
function updateAccountLabel(){ user=store.get('nexa_user',null); $('#accountLabel').textContent=user?user.name.split(' ')[0]:'My Account'; }

function renderWinners(){
  winners=store.get('nexa_winners',[]);
  $('#winnerGrid').innerHTML=winners.length?winners.map(w=>`<article class="winner-card"><span>🏆</span><h3>${escapeHtml(w.prize)}</h3><p>Winner: <strong>${escapeHtml(w.name)}</strong></p><small>${new Date(w.date).toLocaleDateString('en-GB')}</small></article>`).join(''):'<p class="empty">No winners have been published in this prototype yet.</p>';
}

function adminView(editId=''){
orders=store.get('nexa_orders',[]); winners=store.get('nexa_winners',[]);
  const edit=competitions.find(c=>c.id===editId);
$('#adminContent').innerHTML=`<p class="eyebrow">NEXA DRAW ADMIN</p><h2>Competition Dashboard</h2><div class="admin-stats"><div><b>${competitions.length}</b><span>Competitions</span></div><div><b>${orders.length}</b><span>Demo orders</span></div><div><b>${winners.length}</b><span>Published winners</span></div></div><div class="admin-layout"><div><h3>${edit?'Edit':'Add'} competition</h3><form id="competitionForm"><input type="hidden" name="existingId" value="${escapeHtml(edit?.id||'')}"><label class="field">Title<input name="title" required value="${escapeHtml(edit?.title||'')}"></label><label class="field">Price<input name="price" type="number" step="0.01" required value="${edit?.price||''}"></label><label class="field">Maximum entries<input name="max" type="number" required value="${edit?.max||''}"></label><label class="field">Entries sold<input name="sold" type="number" required value="${edit?.sold??0}"></label><label class="field">Closing date<input name="closes" type="datetime-local" required value="${edit?edit.closes.slice(0,16):''}"></label><label class="field">Image path / URL<input name="image" required value="${escapeHtml(edit?.image||'g63.jpg')}"></label><label class="field">Description<textarea name="description" rows="3">${escapeHtml(edit?.description||'')}</textarea></label><label class="field">Skill Question<textarea name="skill_question" rows="2">${escapeHtml(edit?.skill_question||'')}</textarea></label><label class="field">Option A<input name="skill_option_a" value="${escapeHtml(edit?.skill_option_a||'')}"></label><label class="field">Option B<input name="skill_option_b" value="${escapeHtml(edit?.skill_option_b||'')}"></label><label class="field">Option C<input name="skill_option_c" value="${escapeHtml(edit?.skill_option_c||'')}"></label><label class="field">Correct Answer<input name="skill_correct_answer" value="${escapeHtml(edit?.skill_correct_answer||'')}"></label><label class="field">Status<select name="status"><option value="live" ${edit?.status==='live'?'selected':''}>Live</option><option value="paused" ${edit?.status==='paused'?'selected':''}>Paused</option></select></label><button class="btn gold full" type="submit">${edit?'SAVE CHANGES':'ADD COMPETITION'}</button></form></div><div><h3>Manage draws</h3><div class="admin-list">${competitions.map(c=>`<div class="admin-row"><div><strong>${escapeHtml(c.title)}</strong><small>${money(c.price)} · ${escapeHtml(c.status)} · ${c.sold}/${c.max}</small></div><div><button data-edit="${escapeHtml(c.id)}">Edit</button><button data-winner="${escapeHtml(c.id)}">Winner</button><button class="danger" data-delete="${escapeHtml(c.id)}">Delete</button></div></div>`).join('')}</div></div></div>`;
$('#competitionForm').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const row={
    title:f.get('title'),
    price:Number(f.get('price')),
    image_url:f.get('image'),
    closes_at:f.get('closes'),
    max_entries:Number(f.get('max')),
    sold:Number(f.get('sold')||0),
    status:f.get('status')||'live',
    description:f.get('description')||'',
skill_question:f.get('skill_question')||'',
skill_option_a:f.get('skill_option_a')||'',
skill_option_b:f.get('skill_option_b')||'',
skill_option_c:f.get('skill_option_c')||'',
  };
  const {error}=await supabaseClient.from('competitions').insert(row);
  if(error){alert('Save failed: '+error.message);return;}
  await loadCompetitionsFromSupabase();
  adminView();
  alert('Competition saved!');
};
  $$('[data-edit]').forEach(b=>b.onclick=()=>adminView(b.dataset.edit));
  $$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this demo competition?')){store.set('nexa_competitions',competitions.filter(c=>c.id!==b.dataset.delete));renderDraws();adminView();}});
  $$('[data-winner]').forEach(b=>b.onclick=()=>publishWinner(b.dataset.winner));
}
function publishWinner(id){
  const c=competitions.find(x=>x.id===id); if(!c)return;
  const name=prompt(`Winner name to publish for ${c.title}:`); if(!name)return;
  winners.unshift({id:'win-'+Date.now(),prize:c.title,name,date:new Date().toISOString()});store.set('nexa_winners',winners);renderWinners();adminView();toast('Winner published');
}

const legal={
  terms:['Terms & Conditions','Prototype placeholder only. Add your company details, eligibility rules, entry mechanics, closing rules, prize details, winner process, refund/cancellation rules, limitation language and dispute provisions after legal review.'],
  privacy:['Privacy Policy','Prototype placeholder only. A production policy should explain the personal data you collect, purposes, lawful bases, processors, retention, cookies, customer rights and contact details.'],
  free:['Free Entry Route','Prototype placeholder only. Your final free-entry route must match the legal structure of your promotion and be displayed with equal prominence where required. Do not rely on this placeholder for a live promotion.'],
  responsible:['Responsible Play','Set clear spending/entry limits, age and eligibility requirements, support contact details and appropriate responsible participation messaging before launch.']
};
function openLegal(type){ const [title,body]=legal[type]; $('#legalContent').innerHTML=`<p class="eyebrow">NEXA DRAW</p><h2>${title}</h2><p>${body}</p><p class="micro">This is not legal advice.</p>`;openModal('#legalModal'); }

$('#menuBtn').onclick=()=>$('#nav').classList.toggle('open');
$$('nav a').forEach(a=>a.onclick=()=>$('#nav').classList.remove('open'));
$('#cartBtn').onclick=openCart; $('#checkoutBtn').onclick=checkout;
$('#accountBtn').onclick=()=>{renderAccount(false);openModal('#accountModal');};
$('#adminBtn').onclick=openSecureAdmin;
$('#viewAllBtn').onclick=()=>document.querySelector('#draws').scrollIntoView({behavior:'smooth'});
$$('[data-legal]').forEach(b=>b.onclick=()=>openLegal(b.dataset.legal));
$$('[data-close]').forEach(b=>b.onclick=closeModals); $$('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModals();});

renderDraws(); renderWinners(); updateCartCount(); updateAccountLabel();loadCompetitionsFromSupabase();
