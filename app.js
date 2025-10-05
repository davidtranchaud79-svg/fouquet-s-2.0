// FQS Frontend (PatchPlus)
const STATE = { lang: localStorage.getItem('lang')||'fr' };
const modal = document.getElementById('modal');
const toastEl = document.getElementById('toast');

const langSel = document.getElementById('langSelect'); langSel.value = STATE.lang;
langSel.addEventListener('change', e=>{ STATE.lang=e.target.value; localStorage.setItem('lang',STATE.lang); location.reload(); });

document.getElementById('btnSettings').onclick=()=>{
  modal.classList.remove('hidden');
  document.getElementById('cfgApiUrl').value = localStorage.getItem('apiUrl')||'';
  document.getElementById('cfgApiKey').value = localStorage.getItem('apiKey')||'';
};
document.getElementById('btnCfgSave').onclick=()=>{
  localStorage.setItem('apiUrl', document.getElementById('cfgApiUrl').value.trim());
  localStorage.setItem('apiKey', document.getElementById('cfgApiKey').value.trim());
  toast('✅ Config enregistrée'); modal.classList.add('hidden');
  loadDashboard(); loadLookups();
};
modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.add('hidden'); });

[...document.querySelectorAll('[data-route-link]')].forEach(btn=>btn.addEventListener('click',()=>showRoute(btn.dataset.routeLink)));
const routes=[...document.querySelectorAll('[data-route]')];
function showRoute(id){
  document.querySelectorAll('.nav button').forEach(n=>n.classList.toggle('active', n.dataset.routeLink===id));
  routes.forEach(r=>r.classList.toggle('hidden', r.dataset.route!==id));
  if(id==='home') loadDashboard();
}
function toast(msg){ toastEl.textContent=msg; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),2000); }

function ENDPOINT(){ return (localStorage.getItem('apiUrl')||'').replace(/\/$/,'') }
function APIKEY(){ return localStorage.getItem('apiKey')||'' }
async function apiGET(path, params={}){ const base=ENDPOINT(); if(!base) return {ok:false,error:'Endpoint manquant'};
  const qs=new URLSearchParams({ path, apiKey:APIKEY(), lang:STATE.lang, ...params }).toString();
  const r = await fetch(`${base}?${qs}`); return await r.json();
}

// Datalists
function fillDL(id, items){ const dl=document.getElementById(id); if(!dl) return; dl.innerHTML=(items||[]).map(v=>`<option value="${v}">`).join(''); }
async function loadLookups(){
  try {
    const p = await apiGET('produits'); if(p.ok) {
      const produits=[...new Set(p.data.map(x=>x.produit).filter(Boolean))].sort();
      const unites=[...new Set(p.data.map(x=>x.unite).filter(Boolean))].sort();
      fillDL('dlProduits', produits); fillDL('dlUnites', unites);
    }
    const z = await apiGET('zones'); if(z.ok) fillDL('dlZones', z.data);
    const s = await apiGET('stock_live'); if(s.ok) {
      const fams=[...new Set((s.data.rows||[]).map(r=>r.famille).filter(Boolean))].sort();
      fillDL('dlFamilles', fams);
    }
  } catch(e){ console.error(e); }
}

// Dashboard
let CHARTS={};
async function loadDashboard(){
  const sj = await apiGET('stock_journalier');
  if(sj.ok){
    const d=sj.data||{};
    document.getElementById('kpiStockJour').textContent=(d.totalNow||0).toLocaleString(undefined,{style:'currency',currency:'EUR'});
    const delta=d.deltaToday||0; const sign=delta>0?'+':'';
    document.getElementById('kpiStockDelta').textContent=`Δ jour : ${sign}${(delta||0).toLocaleString(undefined,{style:'currency',currency:'EUR'})}`;
    if(window.Chart){ if(CHARTS.stockZones) CHARTS.stockZones.destroy();
      const labels=(d.zones||[]).map(z=>z.zone); const values=(d.zones||[]).map(z=>Math.round((z.valeur||0)*100)/100);
      CHARTS.stockZones=new Chart(document.getElementById('chartStockZones'),{type:'bar',data:{labels,datasets:[{label:'€',data:values}]},options:{responsive:true,maintainAspectRatio:false}});
    }
    if(Array.isArray(d.rows)) renderStockTable(d.rows);
  }
}
function renderStockTable(list){
  const wrap=document.getElementById('stockTableWrap'); if(!wrap) return;
  if(!list||!list.length){ wrap.innerHTML='—'; return; }
  const q=document.getElementById('stockSearch').value?.toLowerCase()||'';
  const filtered = !q?list:list.filter(r=>`${r.produit||''} ${r.zone||''}`.toLowerCase().includes(q));
  const tr=filtered.map(r=>`<tr><td>${r.produit||''}</td><td>${r.zone||''}</td><td>${(r.qte||0).toLocaleString()}</td><td>${r.unite||''}</td><td>${(r.valeur||0).toLocaleString(undefined,{style:'currency',currency:'EUR'})}</td></tr>`).join('');
  wrap.innerHTML=`<table><thead><tr><th>Produit</th><th>Zone</th><th>Qté</th><th>Unité</th><th>Valeur</th></tr></thead><tbody>${tr}</tbody></table>`;
}
document.getElementById('stockSearch').addEventListener('input',()=>loadDashboard());
document.getElementById('btnExportStock').onclick=()=>{
  const rows=[...document.querySelectorAll('#stockTableWrap tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent));
  const csv = ['Produit;Zone;Qte;Unite;Valeur'].concat(rows.map(r=>r.join(';'))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='stock.csv'; a.click(); URL.revokeObjectURL(url);
};

// Pertes & Journalier
document.getElementById('btnPerteSave').onclick = async ()=>{
  const body={ type:'PERTE',
    produit: document.getElementById('perteProduit').value.trim(),
    qte: parseFloat(document.getElementById('perteQte').value)||0,
    unite: document.getElementById('perteUnite').value.trim(),
    motif: document.getElementById('perteMotif').value.trim(),
    zone:  document.getElementById('perteZone').value.trim()
  };
  if(!body.produit || body.qte<=0) return toast('⛔ Produit et quantité requises');
  const r = await apiGET('mouvement', body);
  toast(r.ok? '✅ Perte enregistrée' : ('⚠️ '+(r.error||'Erreur')));
  loadDashboard();
};

document.getElementById('btnJSave').onclick = async ()=>{
  const type=(document.getElementById('jFlux').value||'').toUpperCase();
  const body={ type,
    produit: document.getElementById('jProduit').value.trim(),
    qte: parseFloat(document.getElementById('jQte').value)||0,
    unite: document.getElementById('jUnite').value.trim(),
    zone:  document.getElementById('jZone').value.trim()
  };
  if(!body.produit || body.qte<=0 || !['ENTREE','SORTIE','PERTE'].includes(type)) return toast('⛔ Flux/Produit/Qté');
  const r = await apiGET('mouvement', body);
  toast(r.ok? '✅ Mouvement enregistré' : ('⚠️ '+(r.error||'Erreur')));
  loadDashboard();
};

// Init
showRoute('home'); loadDashboard(); loadLookups();
