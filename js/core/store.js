// Almacenamiento local (IndexedDB) + fusión de datos para sincronización.
// Cada registro tiene: id, updatedAt (ms), updatedBy y opcionalmente deleted:true (tombstone).
// La fusión es por registro: gana el que tenga updatedAt más nuevo.

const DB_NAME = 'gestion-deco';
const STORE = 'kv';

export const SCHEMA = 2; // Subir cuando cambie la estructura; load() migra sin perder datos.
export const COLLECTIONS = ['proveedores', 'productos', 'compras', 'movimientos', 'clientes', 'ventas', 'usuarios', 'gastos', 'auditoria'];

// Permisos por módulo: 0 = sin acceso, 1 = ver, 2 = editar.
// Funciones especiales (0 = no, 2 = sí): costos (ver costos y márgenes), anular (anular operaciones con clave), eliminar.
export const ROLES_DEFAULT = {
  admin:          { label: '👑 Administrador',                         perms: { catalogo: 2, compras: 2, stock: 2, ventas: 2, admin: 2, caja: 2, costos: 2, anular: 2, eliminar: 2 } },
  operador_total: { label: '⭐ Todos los roles (Excepto Admin)',      perms: { catalogo: 2, compras: 2, stock: 2, ventas: 2, admin: 0, caja: 2, costos: 2, anular: 2, eliminar: 0 } },
  vendedor:       { label: '💰 Vendedor',                              perms: { catalogo: 1, compras: 0, stock: 1, ventas: 2, admin: 0, caja: 0, costos: 0, anular: 0, eliminar: 0 } },
  compras:        { label: '🛒 Compras',                               perms: { catalogo: 2, compras: 2, stock: 1, ventas: 0, admin: 0, caja: 0, costos: 2, anular: 0, eliminar: 0 } },
  deposito:       { label: '📦 Depósito',                              perms: { catalogo: 1, compras: 1, stock: 2, ventas: 1, admin: 0, caja: 0, costos: 0, anular: 0, eliminar: 0 } },
  lectura:        { label: '📄 Solo lectura',                          perms: { catalogo: 1, compras: 1, stock: 1, ventas: 1, admin: 0, caja: 0, costos: 0, anular: 0, eliminar: 0 } },
};

export const CONFIG_DEFAULT = {
  nombreNegocio: 'Mi tienda de decoración',
  moneda: 'ARS',
  fiscal: {
    condicion: 'monotributo', // monotributo | responsable_inscripto | exento
    categoria: '',
    cuit: '',
    puntoVenta: '',
    historial: [],           // [{ desde: ms, condicion }]
  },
  roles: ROLES_DEFAULT,
  updatedAt: 0,
};

let state = null;
const listeners = new Set();
let saveTimer = null;

// ---------- Ajustes locales del dispositivo (no se sincronizan) ----------
export function getLocal() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem('gd_local')) || {};
  } catch { return {}; }
}
export function setLocal(patch) {
  const v = { ...getLocal(), ...patch };
  try { globalThis.localStorage?.setItem('gd_local', JSON.stringify(v)); } catch { /* sin storage */ }
  return v;
}

// ---------- IndexedDB ----------
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ---------- Estado ----------
export function initEmpty() {
  state = { schema: SCHEMA, config: structuredClone(CONFIG_DEFAULT) };
  COLLECTIONS.forEach(c => (state[c] = []));
  return state;
}

// Migración: solo AGREGA lo que falta. Nunca borra ni reescribe datos existentes.
function migrate() {
  COLLECTIONS.forEach(c => { if (!Array.isArray(state[c])) state[c] = []; });
  if (!state.config) state.config = structuredClone(CONFIG_DEFAULT);
  if ((state.schema || 1) < SCHEMA) state.schema = SCHEMA;
}

export async function load() {
  const saved = await idbGet('state').catch(() => null);
  if (saved) { state = saved; migrate(); } else initEmpty();
  if (typeof fetch === 'function' && typeof location !== 'undefined' && location.protocol.startsWith('http')) {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const remote = await res.json();
        if (remote && remote.schema) merge(remote);
      }
    } catch (e) {}
  }
  return state;
}

export async function syncServer() {
  if (practica || typeof fetch !== 'function' || typeof location === 'undefined' || !location.protocol.startsWith('http')) return;
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (res.ok) {
      const remote = await res.json();
      if (remote && remote.schema) merge(remote);
    }
  } catch (e) {}
}

// ---------- Modo práctica: nada de lo que se haga se guarda ni se sincroniza ----------
let practica = null;
export const isPractica = () => !!practica;
export function startPractica() {
  if (practica) return;
  practica = structuredClone(state);
  notify('practica');
}
export function endPractica() {
  if (!practica) return;
  state = practica; practica = null;
  notify('practica');
}

function persist() {
  if (practica) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    idbSet('state', state).catch(e => console.warn('No se pudo guardar localmente', e));
    syncServer();
  }, 250);
}

// Reemplaza todo por una copia de seguridad. Se renueva la fecha de cada registro
// para que la restauración gane sobre lo que tengan los demás dispositivos.
export function replaceState(s) {
  state = s; migrate();
  const now = Date.now();
  COLLECTIONS.forEach(c => state[c].forEach(r => { r.updatedAt = now; }));
  state.config.updatedAt = now;
  persist(); notify('remote');
}

// Registro de auditoría (quién anuló o restauró qué).
export function log(accion, detalle = '') {
  return put('auditoria', { fecha: new Date().toISOString(), usuario: getLocal().name || getLocal().email || '', accion, detalle }, { silent: true });
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(source = 'local') {
  listeners.forEach(fn => { try { fn(source); } catch (e) { console.error(e); } });
}

export const snapshot = () => state;
export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

// ---------- CRUD ----------
export const all = c => state[c];
export const list = c => state[c].filter(r => !r.deleted);
export const get = (c, id) => state[c].find(r => r.id === id && !r.deleted);

export function put(c, rec, opts = {}) {
  if (!rec.id) rec.id = uid();
  if (!opts.keepStamp) {
    rec.updatedAt = Date.now();
    rec.updatedBy = getLocal().email || '';
  }
  const i = state[c].findIndex(r => r.id === rec.id);
  if (i >= 0) state[c][i] = rec; else state[c].push(rec);
  persist();
  if (!opts.silent) notify('local');
  return rec;
}

export function putMany(c, recs, opts = {}) {
  recs.forEach(r => put(c, r, { ...opts, silent: true }));
  notify('local');
}

export function remove(c, id) {
  const r = state[c].find(x => x.id === id);
  if (!r) return;
  r.deleted = true;
  r.updatedAt = Date.now();
  r.updatedBy = getLocal().email || '';
  persist();
  notify('local');
}

// ---------- Configuración (un solo registro, gana el más nuevo) ----------
export function config() {
  const c = state.config || {};
  return {
    ...CONFIG_DEFAULT,
    ...c,
    fiscal: { ...CONFIG_DEFAULT.fiscal, ...(c.fiscal || {}) },
    roles: c.roles || ROLES_DEFAULT,
  };
}
export function setConfig(patch) {
  state.config = { ...config(), ...patch, updatedAt: Date.now() };
  persist();
  notify('local');
}

// ---------- Fusión con datos remotos ----------
// Devuelve { pulled, needsPush }: pulled = el estado local cambió; needsPush = hay datos locales más nuevos que los remotos.
export function merge(remote) {
  if (practica) return { pulled: false, needsPush: false };
  if (!remote || typeof remote !== 'object') return { pulled: false, needsPush: true };
  let pulled = false;
  let needsPush = false;

  for (const c of COLLECTIONS) {
    const remoteList = Array.isArray(remote[c]) ? remote[c] : [];
    const localList = state[c];
    const byId = new Map(localList.map(r => [r.id, r]));
    const seen = new Set();

    for (const r of remoteList) {
      seen.add(r.id);
      const l = byId.get(r.id);
      if (!l) {
        localList.push(r);
        pulled = true;
      } else if ((r.updatedAt || 0) > (l.updatedAt || 0)) {
        localList[localList.indexOf(l)] = r;
        pulled = true;
      } else if ((l.updatedAt || 0) > (r.updatedAt || 0)) {
        needsPush = true;
      }
    }
    for (const l of localList) if (!seen.has(l.id)) needsPush = true;
  }

  const rc = remote.config;
  if (rc) {
    const lu = state.config?.updatedAt || 0;
    if ((rc.updatedAt || 0) > lu) { state.config = rc; pulled = true; }
    else if (lu > (rc.updatedAt || 0)) needsPush = true;
  } else {
    needsPush = true;
  }

  if (pulled) { persist(); notify('remote'); }
  return { pulled, needsPush };
}

export async function resetLocal() {
  initEmpty();
  await idbSet('state', state);
  setLocal({ seeded: false, pending: false, lastSync: null });
}
