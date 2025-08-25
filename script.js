/****************************************************
 * ALEGREMENTE 2025 – utilidades escena (GENÉRICO)
 * Compatible con scene1 .. scene8
 * Maneja: Hero, Audio, PDF, Partituras, Filtros, Recursos, 
 * Vista previa de imágenes, UX accesible
 ****************************************************/

/* Helpers */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* Contexto de escena */
const body = document.body;
const SCENE_ID = (body?.id || 'scene').toLowerCase();   // ej: "scene8"
const LS_KEY   = `alegremente_filters_${SCENE_ID}_v1`;

/* Verifica si existe un archivo */
function existsHead(url){
  return fetch(url, { method:'HEAD' }).then(r => r.ok).catch(()=>false);
}
function bust(url){ return `${encodeURI(url)}?v=${Date.now()}`; }

/* =====================================================================================
   1) Tarjetas plegables
===================================================================================== */
function toggle(h){
  const card = h.parentElement;
  const content = card.querySelector('.content');
  const caret = h.querySelector('.caret');
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  if (caret) caret.textContent = open ? 'Expandir' : 'Contraer';
  h.setAttribute('tabindex','0'); h.focus({ preventScroll:true });
}
document.addEventListener('DOMContentLoaded', () => {
  $$('.card .content').forEach(c => c.style.display = 'block');
  $$('.card > header').forEach(h => {
    h.setAttribute('role','button'); h.setAttribute('tabindex','0');
    h.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(h); }
    });
  });
});

/* =====================================================================================
   2) Hero (imagen de portada)
===================================================================================== */
(function initHero(){
  const img = $('.hero img');
  const heroAttr = (body?.dataset?.hero || '').trim();
  if (!img) return;

  if (heroAttr) img.src = heroAttr;
  img.alt = img.alt || 'Imagen principal de la escena';

  img.addEventListener('error', () => {
    img.removeAttribute('src');
    img.style.background = 'linear-gradient(135deg,#fee2e2,#fef3c7,#dcfce7)';
    img.style.minHeight = '200px';
    img.style.display = 'block';
    img.setAttribute('aria-label','Portada no disponible');
    console.warn('[AlegreMente] No se pudo cargar la imagen HERO.');
  });
})();

/* =====================================================================================
   3) Audio con múltiples pistas (usa data-audio)
===================================================================================== */
(function initAudio(){
  const audio = $('#sceneAudio');
  const btn   = $('#btnPlay');
  const label = $('#audioLabel');
  if (!audio || !btn) return;

  const sources = (body?.dataset?.audio || '')
    .split(',').map(s=>s.trim()).filter(Boolean);

  const FALLBACK = ['Colombia Tierra Querida.mp3'];
  const tracks = sources.length ? sources : FALLBACK;

  let idx = 0;
  function setSrc(i){
    audio.src = bust(tracks[i]);
    if (label){
      const nice = tracks[i].replace(/\.(mp3|wav|m4a)$/i,'');
      label.textContent = `🎶 Audio: ${nice}`;
    }
  }
  setSrc(idx);

  async function tryPlay(){
    try{ await audio.play(); }
    catch{
      btn.style.boxShadow = '0 0 0 3px rgba(245,158,11,.25)';
      btn.title = 'Haz clic para iniciar (autoplay bloqueado).';
    }
    updateBtn();
  }
  function updateBtn(){ btn.textContent = audio.paused ? '▶ Reproducir' : '⏸️ Pausar'; }

  document.addEventListener('DOMContentLoaded', tryPlay);
  ['pointerdown','keydown','touchstart'].forEach(ev=>{
    window.addEventListener(ev, ()=> audio.play().then(updateBtn).catch(()=>{}), { once:true, capture:true });
  });

  btn.addEventListener('click', async () => {
    try{ audio.paused ? await audio.play() : audio.pause(); }catch{}
    updateBtn();
  });

  audio.addEventListener('error', () => {
    if (idx < tracks.length - 1){ idx++; setSrc(idx); tryPlay(); }
    else console.error('[AlegreMente] Ninguna pista de audio cargó.');
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/input|textarea|select/i.test(e.target.tagName)){
      e.preventDefault();
      audio.paused ? audio.play().catch(()=>{}) : audio.pause();
      updateBtn();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) audio.pause();
  });
})();

/* =====================================================================================
   4) Documentos: Guion PDF y Partituras
===================================================================================== */
(async function initDocs(){
  const pdfFrame    = $('.pdf-frame');
  const pdfView     = $('#pdfView');
  const pdfDownload = $('#pdfDownload');

  const fallbackName = {
    scene1:'Guión Escena I.pdf', scene2:'Guión Escena II.pdf', scene3:'Guión Escena III.pdf',
    scene4:'Guión Escena IV.pdf', scene5:'Guión Escena V.pdf', scene6:'Guión Escena VI.pdf',
    scene7:'Guión Escena VII.pdf', scene8:'Guión Escena VIII.pdf'
  }[SCENE_ID] || 'Guion.pdf';

  const guion = (body?.dataset?.guion || fallbackName).trim();
  const encoded = encodeURI(guion);

  if (pdfView)     pdfView.href = encoded;
  if (pdfDownload) pdfDownload.href = encoded;

  if (pdfFrame){
    const ok = await existsHead(encoded);
    if (ok) pdfFrame.src = `${encoded}#toolbar=1&navpanes=0&statusbar=0&view=FitH`;
    else pdfFrame.style.display = 'none';
  }

  const scoresUrl = (body?.dataset?.scoresUrl || '').trim();
  const link = $('#allScoresLink');
  if (link){
    link.href = scoresUrl || '#';
    if (!scoresUrl){
      link.setAttribute('aria-disabled','true');
      link.classList.add('disabled');
      link.textContent = '📂 Carpeta de partituras (pendiente)';
      link.addEventListener('click', (e)=> e.preventDefault());
    }
  }
})();

/* =====================================================================================
   5) Filtros + búsqueda + recursos
===================================================================================== */
(function initFilters(){
  const chips = $$('.chip');
  const cards = $$('.card');
  const q     = $('#q');

  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch{}
  if (saved){
    chips.forEach(ch => {
      const t = ch.dataset.type;
      if (t === 'area'   && saved.areas?.includes(ch.dataset.area))     ch.classList.add('active');
      if (t === 'centro' && saved.centros?.includes(ch.dataset.centro)) ch.classList.add('active');
      if (t === 'log'    && saved.logs?.includes(ch.dataset.log))       ch.classList.add('active');
    });
    if (q && typeof saved.query === 'string') q.value = saved.query;
  }

  const RESOURCES = [
    { title: 'Guion (PDF)', href: encodeURI(body?.dataset?.guion || ''), areas: ['teatro','produccion'], type: 'pdf' },
    { title: 'Carpeta de partituras', href: (body?.dataset?.scoresUrl || '#'), areas: ['musica'], type: 'link' },
    { title: 'Fondo proyectado (JPG)', href: encodeURI(body?.dataset?.fondo || ''), areas: ['plastica','luces'], type: 'link' }
  ];
  const ICON = { pdf:'📄', audio:'🎵', sheet:'📊', doc:'📝', link:'🔗' };

  function getState(){
    const areas = chips.filter(c => c.dataset.type==='area'   && c.classList.contains('active')).map(c => c.dataset.area);
    const centros = chips.filter(c => c.dataset.type==='centro' && c.classList.contains('active')).map(c => c.dataset.centro);
    const logs = chips.filter(c => c.dataset.type==='log'    && c.classList.contains('active')).map(c => c.dataset.log);
    return { areas, centros, logs, query: (q?.value?.trim() || '') };
  }

  function cardMatches(card, st){
    const tags = (card.dataset.tags || 'general').split(/\s+/);
    const areaOk = (st.areas.length === 0) || st.areas.some(a => tags.includes(a));

    const centrosCard = (card.dataset.centros || '').split(/\s+/).filter(Boolean);
    const centroOk = (st.centros.length === 0) || st.centros.some(c => centrosCard.includes(c));

    const logsCard = (card.dataset.log || '').split(/\s+/).filter(Boolean);
    const logOk = (st.logs.length === 0) || st.logs.some(l => logsCard.includes(l));

    const textOk = (card.textContent||'').toLowerCase().includes(st.query.toLowerCase());
    return areaOk && centroOk && logOk && textOk;
  }

  function ensureResourcesCard(){
    let ul = $('#res-list');
    if (!ul){
      const section = document.querySelector('main section');
      if (!section) return null;
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-tags','produccion general');
      card.innerHTML = `
        <header onclick="toggle(this)"><h2>🔗 Recursos de esta escena</h2><span class="caret">Contraer</span></header>
        <div class="content"><ul id="res-list"></ul></div>`;
      section.appendChild(card);
      ul = $('#res-list');
    }
    return ul;
  }

  function renderResources(st){
    const ul = ensureResourcesCard();
    if (!ul) return;

    const items = RESOURCES
      .filter(r => r.href && r.href !== '#')
      .filter(r => (!st.areas.length || r.areas.some(a => st.areas.includes(a))));

    ul.innerHTML = items.map(r =>
      `<li><a href="${r.href}" target="_blank" rel="noreferrer">${ICON[r.type]||ICON.link} ${r.title}</a>
       <small class="muted"> (${r.areas.join(', ')})</small></li>`
    ).join('') || `<li class="muted">No hay recursos para este filtro.</li>`;
  }

  function apply(){
    const st = getState();
    $$('.card').forEach(card => { card.style.display = cardMatches(card, st) ? '' : 'none'; });
    localStorage.setItem(LS_KEY, JSON.stringify(st));
    renderResources(st);
  }

  chips.forEach(chip => chip.addEventListener('click', () => { chip.classList.toggle('active'); apply(); }));
  if (q) q.addEventListener('input', apply);

  document.addEventListener('DOMContentLoaded', apply);
})();

/* =====================================================================================
   6) Vista previa de imágenes
===================================================================================== */
(function initImagePreview(){
  function ensureOverlay(){
    let o = $('#imgPreviewOverlay');
    if (!o){
      o = document.createElement('div');
      o.id = 'imgPreviewOverlay';
      Object.assign(o.style, {
        position:'fixed', inset:'0', display:'none', zIndex:'9999',
        background:'rgba(0,0,0,.85)', alignItems:'center', justifyContent:'center'
      });
      const img = document.createElement('img');
      img.alt = 'Vista previa';
      Object.assign(img.style, {
        maxWidth:'90vw', maxHeight:'90vh', borderRadius:'12px',
        boxShadow:'0 10px 30px rgba(0,0,0,.5)'
      });
      o.appendChild(img);
      document.body.appendChild(o);

      o.addEventListener('click', () => o.style.display='none');
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') o.style.display='none'; });
    }
    return o;
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-preview]');
    if (!a) return;
    e.preventDefault();
    const overlay = ensureOverlay();
    overlay.querySelector('img').src = a.getAttribute('href');
    overlay.style.display = 'flex';
  });
})();

/* =====================================================================================
   7) Mejoras UX
===================================================================================== */
(function enhanceUX(){
  $$('a[aria-disabled="true"]').forEach(a => { a.style.opacity = '0.6'; a.style.cursor = 'not-allowed'; });
})();
