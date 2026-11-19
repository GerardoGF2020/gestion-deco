// Sincronización con Google Drive.
// Un único archivo JSON ("gestion-deco-data.json") guarda todos los datos. El dueño lo crea
// y lo comparte (Editor) con los demás usuarios; cada dispositivo lo descarga, fusiona y sube.

import * as store from './store.js';

const FILE_NAME = 'gestion-deco-data.json';
const SCOPE = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

let token = null;
let tokenExp = 0;
let syncing = null;
let again = false;
let debounce = null;
let started = false;
let current = { state: 'noconfig', msg: '' };
const listeners = new Set();

export function onStatus(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
function setStatus(state, msg = '') {
  current = { state, msg };
  listeners.forEach(f => f(current));
}
export const getStatus = () => current;

function idleStatus() {
  const loc = store.getLocal();
  if (!loc.clientId) return setStatus('noconfig');
  if (!loc.connected) return setStatus('disconnected');
  if (!navigator.onLine) return setStatus('offline');
  return setStatus(loc.pending ? 'pending' : 'ok');
}

async function gisReady() {
  for (let i = 0; i < 60; i++) {
    if (globalThis.google?.accounts?.oauth2) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

function ensureToken(interactive) {
  return new Promise(async (resolve, reject) => {
    if (token && Date.now() < tokenExp - 60000) return resolve(token);
    const loc = store.getLocal();
    if (!loc.clientId) return reject(new Error('Falta el Client ID de Google (Ajustes).'));
    if (!(await gisReady())) return reject(new Error('No se pudo cargar Google (¿sin internet?).'));
    const client = google.accounts.oauth2.initTokenClient({
      client_id: loc.clientId,
      scope: SCOPE,
      hint: loc.email || undefined,
      callback: r => {
        if (r.error) return reject(new Error(r.error === 'access_denied' ? 'Permiso denegado' : r.error));
        token = r.access_token;
        tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
        resolve(token);
      },
      error_callback: e => reject(new Error(e?.type === 'popup_closed' ? 'Se cerró la ventana de Google' : 'auth')),
    });
    client.requestAccessToken({ prompt: interactive ? 'select_account' : '' });
  });
}

async function api(url, opts = {}, retry = true) {
  const t = await ensureToken(false);
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401 && retry) { token = null; return api(url, opts, false); }
  if (!r.ok) {
    const err = new Error(`Drive ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r;
}

async function findFile() {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&fields=files(id,ownedByMe)&spaces=drive`);
  const j = await r.json();
  return j.files?.[0]?.id || null;
}
const fileMeta = async id => (await api(`https://www.googleapis.com/drive/v3/files/${id}?fields=version,modifiedTime`)).json();
async function download(id) {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return null; }
}
async function createFile(data) {
  const b = 'gd' + Date.now();
  const body =
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' })}\r\n` +
    `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${b}--`;
  const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body,
  });
  return (await r.json()).id;
}
const uploadFile = (id, data) =>
  api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

async function runSync() {
  const loc = store.getLocal();
  if (!loc.clientId || !loc.connected || !navigator.onLine) return idleStatus();
  setStatus('syncing');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      let fileId = store.getLocal().fileId || (await findFile());
      if (!fileId) {
        fileId = await createFile(store.snapshot());
        store.setLocal({ fileId });
        break;
      }
      store.setLocal({ fileId });
      let before, remote;
      try {
        before = await fileMeta(fileId);
        remote = await download(fileId);
      } catch (e) {
        if (e.status === 404) { store.setLocal({ fileId: null }); continue; }
        throw e;
      }
      const res = store.merge(remote);
      if (res.needsPush) {
        const after = await fileMeta(fileId);
        if (after.version !== before.version) continue; // alguien subió en el medio: reintentar
        await uploadFile(fileId, store.snapshot());
      }
      break;
    }
    store.setLocal({ lastSync: Date.now(), pending: false });
    setStatus('ok');
  } catch (e) {
    console.error(e);
    if (e.message === 'auth' || e.message.includes('Permiso')) setStatus('disconnected', 'Tocá para reconectar con Google');
    else setStatus('error', e.message);
  }
}

export function sync() {
  if (syncing) { again = true; return syncing; }
  syncing = runSync().finally(async () => {
    syncing = null;
    if (again) { again = false; sync(); }
  });
  return syncing;
}

export async function connect() {
  await ensureToken(true);
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } });
  const info = r.ok ? await r.json() : {};
  store.setLocal({ connected: true, email: info.email || '', name: info.name || '', fileId: null });
  await sync();
}

export function disconnect() {
  try { if (token) google.accounts.oauth2.revoke(token); } catch { /* ignorar */ }
  token = null;
  store.setLocal({ connected: false, fileId: null });
  idleStatus();
}

export function start() {
  if (started) return;
  started = true;
  idleStatus();
  store.onChange(source => {
    if (source === 'remote') return;
    store.setLocal({ pending: true });
    idleStatus();
    clearTimeout(debounce);
    debounce = setTimeout(sync, 4000);
  });
  window.addEventListener('online', () => { idleStatus(); sync(); });
  window.addEventListener('offline', idleStatus);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60000);
  sync();
}
