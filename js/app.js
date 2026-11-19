import * as store from './core/store.js';
import * as drive from './core/drive.js';
import { can } from './core/auth.js';
import { h } from './core/ui.js';
import { buildSeed } from './data/seed-catalogo.js';
import catalogo from './modules/catalogo.js';
import ajustes from './modules/ajustes.js';
import { compras, stock, ventas, admin } from './modules/pendientes.js';

const MODULES = [catalogo, compras, stock, ventas, admin, ajustes];

const nav = document.getElementById('nav');
const view = document.getElementById('view');
const title = document.getElementById('title');
const syncBtn = document.getElementById('syncBtn');
let cleanup = null;

function seedIfEmpty() {
  if (store.getLocal().seeded) return;
  if (!store.all('proveedores').length) {
    const seed = buildSeed();
    store.putMany('proveedores', seed.proveedores, { keepStamp: true });
    store.putMany('compras', seed.compras, { keepStamp: true });
  }
  store.setLocal({ seeded: true });
}

const currentId = () => location.hash.replace(/^#\//, '') || 'catalogo';

function buildNav() {
  const id = currentId();
  nav.replaceChildren(
    h('div', { class: 'brand' }, h('span', { class: 'logo' }, '🏺'), h('span', {}, store.config().nombreNegocio)),
    ...MODULES.filter(m => !m.perm || can(m.perm, 1)).map(m =>
      h('a', { href: `#/${m.id}`, class: 'nav-item' + (m.id === id ? ' active' : '') },
        h('span', { class: 'ico' }, m.icon), h('span', { class: 'lbl' }, m.label))));
}

function route() {
  const m = MODULES.find(x => x.id === currentId()) || MODULES[0];
  cleanup?.();
  cleanup = null;
  view.replaceChildren();
  title.textContent = m.title;
  buildNav();
  if (m.perm && !can(m.perm, 1)) {
    view.append(h('div', { class: 'card placeholder' }, h('h2', {}, 'Sin acceso'), h('p', {}, 'Tu usuario no tiene permiso para este módulo. Pedile acceso a un administrador.')));
    return;
  }
  cleanup = m.mount(view) || null;
}

const SYNC_LABEL = {
  noconfig: ['Drive sin configurar', 'warn'], disconnected: ['Conectar Drive', 'warn'], syncing: ['Sincronizando…', 'busy'],
  ok: ['Sincronizado', 'ok'], pending: ['Pendiente', 'busy'], offline: ['Sin conexión', 'warn'], error: ['Error de sync', 'err'],
};
drive.onStatus(s => {
  const [txt, cls] = SYNC_LABEL[s.state] || [s.state, ''];
  syncBtn.className = 'sync ' + cls;
  syncBtn.replaceChildren(h('span', { class: 'dot' }), h('span', { class: 'sync-txt' }, txt));
  syncBtn.title = s.msg || txt;
});
syncBtn.addEventListener('click', () => {
  const st = drive.getStatus().state;
  if (st === 'noconfig' || st === 'disconnected') location.hash = '#/ajustes';
  else drive.sync();
});

async function boot() {
  await store.load();
  seedIfEmpty();
  window.addEventListener('hashchange', route);
  // Si cambian roles/usuarios por sincronización, refrescar menú y pantalla.
  store.onChange(src => { if (src === 'remote') route(); });
  route();
  drive.start();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
