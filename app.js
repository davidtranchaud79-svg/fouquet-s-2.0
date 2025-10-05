// FQS Frontend (PatchPlus — full)
const STATE = { lang: localStorage.getItem('lang')||'fr' };
const toastEl = document.getElementById('toast');
const modal   = document.getElementById('modal');

// ── Langue ────────────────────────────────────────────────────────────────
const langSel = document.getElementById('langSelect'); 
if (langSel){ langSel.value = STATE.lang; langSel.addEventListener('change', e=>{ STATE.lang=e.target.value; localStorage.setItem('lang',STATE.lang); location.reload(); }); }

// ── Config & helpers ──────────────────────────────────────────────────────
function qs(name){ return new URLSearchParams(location.search).get(name) }
function ENDPOINT(){
  const q = qs('apiUrl'); if(q) localStorage.setItem('apiUrl', q);
  return (localStorage.getItem('apiUrl')||'').replace(/\/$/,'');
}
function APIKEY(){
  const q = qs('apiKey'); if(q) localStorage.setItem('apiKey', q);
  return localStorage.getItem('apiKey')||'';
}
function toast(msg){ toastEl.textContent=msg; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),2600); }

async function apiGET(path, params={}){
  const base = ENDPOINT();
  if(!base) return {ok:false,error:'Endpoint manquant'};
  const qs = new URLSearchParams({ path, apiKey:APIKEY(), lang:STATE.lang, ...params }).toString();
  try{
    const r = await fetch(`${base}?${qs}`,{cache:'no-store'});
    const txt = await r.text();
    try{
      return JSON.parse(txt);
    }catch{
      return {ok:false,error:'Réponse non JSON', raw:txt};
    }
  }catch(e){
    return {ok:false,error:'Réseau indisponible'};
  }
}

// panneau de config
if (document.getElementById('btnSettings')){
  document.getElementById('btnSettings').onclick=()=>{
    modal.classList.remove('hidden');
    document.getElementById('cfgApiUrl').value = ENDPOINT();
    document.getElementById('cfgApiKey').value = APIKEY();
  };
}
if (document.getElementById('btnCfgSave')){
  document.getElementById('btnCfgSave').onclick=()=>{
    localStorage.setItem('apiUrl', document.getElementById('cfgApiUrl').value.trim());
    localStorage.setItem('apiKey', document.getElementById('cfgApiKey').value.trim());
    toast('✅ Config enregistrée'); 
    modal.classList.add('hidden');
    initAll();
  };
}
if (modal) modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.add('hidden'); });

// Alerte si API non configurée
(function(){
  const url=ENDPOINT(), key=APIKEY();
  if(!url || !key){
    const b=document.createElement('div');
    b.style.cssText='position:sticky;top:0;z-index:9999;background:#ffefc0;color:#3a2a00;padding:10px;text-align:center;font-weight:700';
    b.textContent='⚠️ API non configurée : clique sur ⚙️ et colle l’URL "/exec" + ta clé, ou ajoute ?apiUrl=...&apiKey=... à l’URL';
    document.addEventListener('DOMContentLoaded',()=>document.body.prepend(b));
  }
})();

// ── Routing ───────────────────────────────────────────────────────────────
[...document.querySelectorAll('[data-route-link]')].forEach(btn=>btn.addEventListener('click',()=>showRoute(btn.dataset.routeLink)));
const routes = [...document.querySelectorAll('[data-route]')];
function showRoute(id){
  document.querySelectorAll('.nav button').forEach(n=>n.classList.toggle('active', n.dataset.routeLink===id));
  routes.forEach(r=>r.classList.toggle('hidden', r.dataset.route!==id));
  if(id==='home') loadDashboard();
}

// ── Datalists (produits / unités / zones / familles) ─────────────────────
function fillDL(id, items){ const dl=document.getElementById(id); if(!dl) return; dl.innerHTML=(items||[]).map(v=>`<option value="${v}">`).join(''); }
async function loadLookups(){
  try {
    const p = await apiGET('produits'); 
    if(p.ok) {
      const produits=[...new Set((p.data||[]).map(x=>x.produit).filter(Boolean))].sort();
      const unites=[...new Set((p.data||[]).map(x=>x.unite).filter(Boolean))].sort();
      fillDL('dlProduits', produits); 
      fillDL('dlUnites', unites);
    }
    const z = await apiGET('zones'); if(z.ok) fillDL('dlZones', z.data||[]);
    const s = await apiGET('stock_live'); 
    if(s.ok) {
      const fams=[...new Set(((s.data&&s.data.rows)||[]).map(r=>r.famille).filter(Boolean))].sort();
      fillDL('dlFamilles', fams);
    }
  } catch(e){ console.error(e); }
}

// ── Dashboard ─────────────────────────────────────────────────────────────
let CHARTS={};
async function loadDashboard(){
  const sj = await apiGET('stock_journalier');
  if(!sj || !sj.ok){
    document.getElementById('kpiStockJour').textContent='—';
    document.getElementById('kpiStockDelta').textContent='Δ jour : —';
    if (CHARTS.stockZones) CHARTS.stockZones.destroy();
    const el = document.getElementById('chartStockZones');
    el.replaceWith(el.cloneNode(true));
    return;
  }
  const d=sj.data||{};
  document.getElementById('kpiStockJour').textContent=(d.totalNow||0).toLocaleString(undefined,{style:'currency',currency:'EUR'});
  const delta=d.deltaToday||0; const sign=delta>0?'+':'';
  document.getElementById('kpiStockDelta').textContent=`Δ jour : ${sign}${(delta||0).toLocaleString(undefined,{style:'currency',currency:'EUR'})}`;
  // Graph zones
  const labels=(d.zones||[]).map(z=>z.zone||'(Sans zone)'); 
  const values=(d.zones||[]).map(z=>Math.round((z.valeur||0)*100)/100);
  if(window.Chart){ if(CHARTS.stockZones) CHARTS.stockZones.destroy();
    CHARTS.stockZones=new Chart(document.getElementById('chartStockZones'),{
      type:'bar',data:{labels,datasets:[{label:'€',data:values}]},
      options:{responsive:true,maintainAspectRatio:false}
    });
  }
  // Table
  if(Array.isArray(d.rows)) renderStockTable(d.rows);
}
function renderStockTable(list){
  const wrap=document.getElementById('stockTableWrap'); if(!wrap) return;
  if(!list||!list.length){ wrap.innerHTML='—'; return; }
  const q=(document.getElementById('stockSearch').value||'').toLowerCase();
  const filtered = !q?list:list.filter(r=>(`${r.produit||''} ${r.zone||''} ${r.famille||''}`).toLowerCase().includes(q));
  const tr=filtered.map(r=>`<tr>
      <td>${r.produit||''}</td><td>${r.zone||''}</td>
      <td style="text-align:right">${(r.qte||0).toLocaleString()}</td>
      <td>${r.unite||''}</td>
      <td style="text-align:right">${(r.valeur||0).toLocaleString(undefined,{style:'currency',currency:'EUR'})}</td>
      <td>${r.famille||''}</td>
    </tr>`).join('');
  wrap.innerHTML=`<table><thead><tr><th>Produit</th><th>Zone</th><th>Qté</th><th>Unité</th><th>Valeur</th><th>Famille</th></tr></thead><tbody>${tr}</tbody></table>`;
}
const stockSearchEl = document.getElementById('stockSearch'); if (stockSearchEl) stockSearchEl.addEventListener('input',()=>loadDashboard());
const btnExportStock = document.getElementById('btnExportStock');
if (btnExportStock){
  btnExportStock.onclick=()=>{
    const rows=[...document.querySelectorAll('#stockTableWrap tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent));
    const csv = ['Produit;Zone;Qte;Unite;Valeur;Famille'].concat(rows.map(r=>r.join(';'))).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='stock.csv'; a.click(); URL.revokeObjectURL(url);
  };
}

// ── Pertes & Inventaire journalier (route: mouvement) ─────────────────────
const btnPerteSave = document.getElementById('btnPerteSave');
if (btnPerteSave){
  btnPerteSave.onclick = async ()=>{
    const body={ type:'PERTE',
      produit: (document.getElementById('perteProduit')||{}).value?.trim()||'',
      qte: parseFloat((document.getElementById('perteQte')||{}).value)||0,
      unite: (document.getElementById('perteUnite')||{}).value?.trim()||'',
      motif: (document.getElementById('perteMotif')||{}).value?.trim()||'',
      zone:  (document.getElementById('perteZone')||{}).value?.trim()||''
    };
    if(!body.produit || body.qte<=0) return toast('⛔ Produit et quantité requises');
    const r = await apiGET('mouvement', body);
    toast(r.ok? '✅ Perte enregistrée' : ('⚠️ '+(r.error||'Erreur')));
    loadDashboard();
  };
}
const btnJSave = document.getElementById('btnJSave');
if (btnJSave){
  btnJSave.onclick = async ()=>{
    const type=(document.getElementById('jFlux')||{}).value?.toUpperCase()||'';
    const body={ type,
      produit: (document.getElementById('jProduit')||{}).value?.trim()||'',
      qte: parseFloat((document.getElementById('jQte')||{}).value)||0,
      unite: (document.getElementById('jUnite')||{}).value?.trim()||'',
      zone:  (document.getElementById('jZone')||{}).value?.trim()||''
    };
    if(!body.produit || body.qte<=0 || !['ENTREE','SORTIE','PERTE'].includes(type)) return toast('⛔ Flux/Produit/Qté');
    const r = await apiGET('mouvement', body);
    toast(r.ok? '✅ Mouvement enregistré' : ('⚠️ '+(r.error||'Erreur')));
    loadDashboard();
  };
}

// ── Inventaire mensuel ─────────────────────────────────────────────────────
const mUI = {
  month: document.getElementById('mMonth'),
  zone:  document.getElementById('mZone'),
  fam:   document.getElementById('mFam'),
  gen:   document.getElementById('btnMGen'),
  box:   document.getElementById('mGrouped')
};
if (mUI.gen){
  mUI.gen.onclick = async ()=>{
    const mois=(mUI.month.value||'').trim();
    const zone=(mUI.zone.value||'').trim();
    const famille=(mUI.fam.value||'').trim();
    if(!mois) return toast('⛔ Choisis un mois');

    const res = await apiGET('inv_m_get',{ mois, zone, famille });
    if(!res.ok){ mUI.box.innerHTML='⚠️ API inv_m_get indisponible'; return; }
    const groups = (res.data && res.data.groups)||[];
    if(!groups.length){ mUI.box.innerHTML='Aucun article pour ces filtres.'; return; }

    const html = groups.map(g=>{
      const rows = g.items.map(it=>`
        <tr>
          <td>${it.produit}</td>
          <td style="text-align:right">${(it.quantite||0).toLocaleString()}</td>
          <td>${it.unite||''}</td>
          <td style="text-align:right">${(it.prix||0).toLocaleString(undefined,{style:'currency',currency:'EUR'})}</td>
          <td><input type="number" min="0" step="0.01" data-prod="${it.produit}" data-unit="${it.unite||''}" data-prix="${it.prix||0}" class="m-count"/></td>
          <td><button class="btn" data-prod="${it.produit}" data-unit="${it.unite||''}" data-prix="${it.prix||0}" data-fam="${g.famille}" data-action="saveLine">✅</button></td>
        </tr>`).join('');
      return `<details open><summary><b>${g.famille||'(Sans famille)'}</b></summary>
                <table>
                  <thead><tr><th>Produit</th><th>Théorique</th><th>Unité</th><th>PU</th><th>Compté</th><th>Action</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
              </details>`;
    }).join('');
    mUI.box.innerHTML = html;

    // enregistrer les lignes
    mUI.box.querySelectorAll('button[data-action="saveLine"]').forEach(btn=>{
      btn.onclick = async ()=>{
        const prod = btn.dataset.prod;
        const unit = btn.dataset.unit;
        const prix = parseFloat(btn.dataset.prix||0)||0;
        const fam  = btn.dataset.fam||'';
        const inp  = btn.closest('tr').querySelector('.m-count');
        const qte  = parseFloat(inp.value||'0')||0;
        if(qte<0) return toast('⛔ Quantité invalide');

        const r = await apiGET('inv_m_post',{ mois:(mUI.month.value||''), zone:(mUI.zone.value||''), famille:fam, produit:prod, qte, unite:unit, prix });
        toast(r.ok? '✅ Ligne inventaire enregistrée' : ('⚠️ '+(r.error||'Erreur inventaire')));
      };
    });
  };
}

// ── Recettes ───────────────────────────────────────────────────────────────
const rUI = {
  list: document.getElementById('rList'),
  search: document.getElementById('rSearch'),
  mul: document.getElementById('rMul'),
  btnProd: document.getElementById('btnProduire')
};
let RECETTES_CACHE = [], RECETTE_SELECTED = null;

async function recettesLoad(){
  if(!rUI.list) return;
  const q = (rUI.search && rUI.search.value||'').trim();
  const res = await apiGET('recettes_list',{ q });
  if(!res.ok){ rUI.list.innerHTML='⚠️ API recettes_list indisponible'; return; }
  RECETTES_CACHE = res.data||[];
  renderRecettesList(RECETTES_CACHE);
}
function renderRecettesList(arr){
  if(!rUI.list) return;
  if(!arr.length){ rUI.list.innerHTML='Aucune recette'; return; }
  const html = arr.map(r=>`
    <details>
      <summary><b>${r.nom}</b> — <i>${r.categorie||''}</i> (code: ${r.code})</summary>
      <div class="small">Portions de base: ${r.portions||'—'} | Allergènes: ${r.allergenes||'—'}</div>
      <button class="btn" data-code="${r.code}" data-action="showIng">Voir ingrédients</button>
      <button class="btn gold" data-code="${r.code}" data-action="choose">Choisir</button>
      <div id="ing-${r.code}" class="small" style="margin-top:8px"></div>
    </details>`).join('');
  rUI.list.innerHTML = html;

  rUI.list.querySelectorAll('button[data-action="showIng"]').forEach(b=>b.onclick=()=>recetteShowIng(b.dataset.code));
  rUI.list.querySelectorAll('button[data-action="choose"]').forEach(b=>b.onclick=()=>{RECETTE_SELECTED=b.dataset.code; toast('✅ Recette sélectionnée');});
}
async function recetteShowIng(code){
  const resp = await apiGET('recette_ingredients',{ code });
  const box = document.getElementById(`ing-${code}`);
  if(!box) return; 
  if(!resp.ok){ box.textContent='⚠️ Impossible de charger les ingrédients'; return; }
  const mul = parseFloat((rUI.mul&&rUI.mul.value)||1)||1;
  const rows = (resp.data||[]).map(i=>`
    <tr><td>${i.ingredient}</td><td style="text-align:right">${(Number(i.quantite||0)*mul).toLocaleString()}</td><td>${i.unite||''}</td></tr>
  `).join('');
  box.innerHTML = `<table><thead><tr><th>Ingrédient</th><th>Quantité</th><th>Unité</th></tr></thead><tbody>${rows}</tbody></table>`;
}
if (rUI.search) rUI.search.addEventListener('input', ()=>recettesLoad());
if (rUI.mul)    rUI.mul.addEventListener('input', ()=>{ if(RECETTE_SELECTED) recetteShowIng(RECETTE_SELECTED); });
if (rUI.btnProd){
  rUI.btnProd.onclick = async ()=>{
    if(!RECETTE_SELECTED) return toast('⛔ Choisis une recette');
    const mul = parseFloat((rUI.mul&&rUI.mul.value)||1)||1;
    const zone = prompt('Zone de production ? (ex. Cuisine)') || '';
    const res = await apiGET('recette_produire', { code:RECETTE_SELECTED, mul, zone });
    toast(res.ok? '✅ Production enregistrée' : ('⚠️ '+(res.error||'Erreur production')));
    loadDashboard();
  };
}

// ── Init ──────────────────────────────────────────────────────────────────
function initAll(){
  showRoute('home'); 
  loadDashboard(); 
  loadLookups();
  recettesLoad();
}
initAll();
