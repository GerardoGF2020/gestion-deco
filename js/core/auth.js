// Sistema de Autenticación, Hashing Criptográfico y Gestión de Roles (RBAC)
// Inspirado en el Sistema del Mercado Inmobiliario (Tasaciones Pro).

import * as store from './store.js';

// Hashing seguro SHA-256 usando Web Crypto API nativa del navegador
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const s = salt || (Math.random().toString(36).slice(2) + Date.now().toString(36));
  const hash = await sha256(password + ':' + s);
  return { hash, salt: s };
}

export async function verifyPassword(password, hash, salt) {
  const check = await sha256(password + ':' + salt);
  return check === hash;
}

// Administrador por defecto: Gerardo (gerardocggf@gmail.com / admin / tasaciones2026)
const DEFAULT_ADMIN = {
  id: 'usr_admin_default',
  username: 'admin',
  nombre: 'Gerardo (Administrador)',
  email: 'gerardocggf@gmail.com',
  telefono: '',
  rol: 'admin',
  estado: 'activo',
  activo: true,
  fecha_registro: '2026-11-19T00:00:00.000Z',
  salt: 's_deco_admin_2026',
  // hash de 'tasaciones2026' con salt 's_deco_admin_2026'
  hash: '8fc32ccc0fff9b7afda95dc88e52ce0c8bc869a8d8cdb2cb24e9a56fd083c9b3'
};

export function asegurarAdminInicial() {
  const users = store.list('usuarios');
  const adminExiste = users.some(u => (u.username || '').toLowerCase() === 'admin' || (u.email || '').toLowerCase() === 'gerardocggf@gmail.com');
  if (!adminExiste) {
    store.put('usuarios', { ...DEFAULT_ADMIN, updatedAt: 1 }, { keepStamp: true, silent: true });
  }
}

export function currentUser() {
  const loc = store.getLocal();
  const userId = loc.sessionUserId;
  const users = store.list('usuarios');

  if (userId) {
    const found = users.find(u => u.id === userId && u.activo !== false && u.estado === 'activo');
    if (found) return found;
  }

  // Si no hay sesión iniciada
  return null;
}

export function isLoggedIn() {
  return currentUser() !== null;
}

export async function login(identificador, password) {
  asegurarAdminInicial();
  const norm = (identificador || '').trim().toLowerCase();
  if (!norm || !password) throw new Error('Complete usuario y contraseña.');

  const users = store.list('usuarios');
  const user = users.find(u => 
    (u.username || '').toLowerCase() === norm || 
    (u.email || '').toLowerCase() === norm
  );

  if (!user) {
    throw new Error('Usuario o correo no encontrado.');
  }

  if (user.estado === 'pendiente_aprobacion' || (!user.activo && user.estado !== 'activo')) {
    throw new Error('Tu cuenta fue registrada pero aún se encuentra pendiente de autorización por el Administrador (gerardocggf@gmail.com).');
  }

  if (user.estado === 'rechazado') {
    throw new Error('Tu solicitud de acceso fue rechazada por el Administrador.');
  }

  // Verificación de clave
  const ok = await verifyPassword(password, user.hash, user.salt);
  if (!ok) {
    throw new Error('Contraseña incorrecta.');
  }

  // Guardar sesión local
  store.setLocal({
    sessionUserId: user.id,
    email: user.email,
    name: user.nombre,
    rol: user.rol
  });

  return user;
}

export function logout() {
  store.setLocal({ sessionUserId: null });
}

// ---------- Código de recuperación (para olvidar la clave sin molestar al administrador) ----------
function nuevoCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const c = Array.from(b, x => letras[x % letras.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}
const limpiarCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function generarCodigoRecuperacion(userId) {
  const u = store.get('usuarios', userId);
  if (!u) throw new Error('Usuario no encontrado.');
  const codigo = nuevoCodigo();
  const { hash, salt } = await hashPassword(limpiarCodigo(codigo));
  store.put('usuarios', { ...u, recHash: hash, recSalt: salt });
  return codigo;
}

export async function recuperarConCodigo(identificador, codigo, nuevaPassword) {
  const norm = (identificador || '').trim().toLowerCase();
  const u = store.list('usuarios').find(x => (x.username || '').toLowerCase() === norm || (x.email || '').toLowerCase() === norm);
  if (!u || !u.recHash || !(await verifyPassword(limpiarCodigo(codigo), u.recHash, u.recSalt))) {
    throw new Error('El usuario o el código de recuperación no son correctos.');
  }
  if (u.estado !== 'activo') throw new Error('Tu cuenta todavía no está autorizada.');
  await cambiarPasswordUsuario(u.id, nuevaPassword);
  return generarCodigoRecuperacion(u.id); // el código usado deja de servir: se entrega uno nuevo
}

export function actualizarPerfil(userId, { nombre, telefono }) {
  const u = store.get('usuarios', userId);
  if (!u) throw new Error('Usuario no encontrado.');
  if (!nombre?.trim()) throw new Error('El nombre no puede quedar vacío.');
  store.put('usuarios', { ...u, nombre: nombre.trim(), telefono: (telefono || '').trim() });
  store.setLocal({ name: nombre.trim() });
}

export async function verificarClave(password) {
  const cur = currentUser();
  return !!cur && (await verifyPassword(password || '', cur.hash, cur.salt));
}

// Valida si la clave ingresada pertenece a un usuario autorizado para anular/revertir operaciones.
// Si el usuario actual tiene permiso o es admin, basta con su clave.
// Si no, cualquier administrador puede ingresar su usuario y clave para autorizar.
export async function validarClaveAutorizacion(password, usuarioOAdmin) {
  const users = store.list('usuarios').filter(u => u.activo !== false && u.estado === 'activo');
  if (usuarioOAdmin) {
    const norm = usuarioOAdmin.trim().toLowerCase();
    const target = users.find(u => (u.username || '').toLowerCase() === norm || (u.email || '').toLowerCase() === norm);
    if (!target) return null;
    const puede = target.rol === 'admin' || target.permisos?.anular === 2;
    if (!puede) return null;
    const ok = await verifyPassword(password, target.hash, target.salt);
    return ok ? target : null;
  }
  const cur = currentUser();
  if (cur && (cur.rol === 'admin' || cur.permisos?.anular === 2)) {
    if (await verifyPassword(password, cur.hash, cur.salt)) return cur;
  }
  for (const adm of users.filter(u => u.rol === 'admin')) {
    if (await verifyPassword(password, adm.hash, adm.salt)) return adm;
  }
  return null;
}

export async function solicitarRegistro({ nombre, email, telefono, username, password, rolDeseado }) {
  asegurarAdminInicial();
  const eNorm = (email || '').trim().toLowerCase();
  if (!nombre?.trim()) throw new Error('Escribí tu nombre.');
  if (!/^\S+@\S+\.\S+$/.test(eNorm)) throw new Error('Escribí un correo válido (ej: nombre@gmail.com).');
  if (!password || password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');

  const users = store.list('usuarios');
  if (users.some(u => (u.email || '').toLowerCase() === eNorm)) {
    throw new Error('Ese correo ya tiene una cuenta o una solicitud en espera.');
  }
  let uNorm = (username || '').trim().toLowerCase() || eNorm.split('@')[0].replace(/[^a-z0-9._-]/g, '');
  let base = uNorm, n = 2;
  while (users.some(u => (u.username || '').toLowerCase() === uNorm)) uNorm = base + n++;

  const { hash, salt } = await hashPassword(password);
  const codigo = nuevoCodigo();
  const rec = await hashPassword(limpiarCodigo(codigo));
  const nuevo = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username: uNorm, nombre: nombre.trim(), email: eNorm, telefono: (telefono || '').trim(),
    rol: rolDeseado || 'vendedor', estado: 'pendiente_aprobacion', activo: false,
    fecha_registro: new Date().toISOString(), salt, hash, recSalt: rec.salt, recHash: rec.hash,
  };
  store.put('usuarios', nuevo);
  return { ...nuevo, codigoRecuperacion: codigo };
}
export function autorizarUsuario(userId, rolAsignado) {
  const u = store.get('usuarios', userId);
  if (!u) throw new Error('Usuario no encontrado.');
  const rol = rolAsignado || u.rol || 'vendedor';
  store.put('usuarios', {
    ...u,
    rol,
    estado: 'activo',
    activo: true,
    fecha_aprobacion: new Date().toISOString()
  });
}

export function rechazarUsuario(userId) {
  const u = store.get('usuarios', userId);
  if (!u) throw new Error('Usuario no encontrado.');
  store.put('usuarios', {
    ...u,
    estado: 'rechazado',
    activo: false,
    fecha_rechazo: new Date().toISOString()
  });
}

export function eliminarUsuario(userId) {
  const u = store.get('usuarios', userId);
  if (!u) return;
  if (u.username === 'admin') throw new Error('No se puede eliminar la cuenta principal de administrador.');
  store.remove('usuarios', userId);
}

export async function cambiarPasswordUsuario(userId, nuevaPassword) {
  if (!nuevaPassword || nuevaPassword.length < 4) throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
  const u = store.get('usuarios', userId);
  if (!u) throw new Error('Usuario no encontrado.');
  const { hash, salt } = await hashPassword(nuevaPassword);
  store.put('usuarios', { ...u, hash, salt, updatedAt: Date.now() });
}

export async function cambiarPasswordPropia(actualPassword, nuevaPassword) {
  const cur = currentUser();
  if (!cur) throw new Error('No hay sesión activa.');
  const ok = await verifyPassword(actualPassword, cur.hash, cur.salt);
  if (!ok) throw new Error('La contraseña actual es incorrecta.');
  await cambiarPasswordUsuario(cur.id, nuevaPassword);
}

// 0 = sin acceso, 1 = ver, 2 = editar. Los permisos propios del usuario (los que decide el administrador)
// tienen prioridad sobre los del rol. Funciones especiales: costos, anular, eliminar.
export function level(mod) {
  const u = currentUser();
  if (!u || !u.rol) return 0;
  if (u.rol === 'admin') return 2;
  const propio = u.permisos?.[mod];
  if (propio !== undefined) return propio;
  return store.config().roles?.[u.rol]?.perms?.[mod] ?? 0;
}

export const can = (mod, min = 1) => level(mod) >= min;

export function permisosEfectivos(u) {
  const base = store.config().roles?.[u.rol]?.perms || {};
  return { ...base, ...(u.permisos || {}) };
}

export function guardarPermisos(userId, permisos, rol) {
  const u = store.get('usuarios', userId);
  if (!u) throw new Error('Usuario no encontrado.');
  store.put('usuarios', { ...u, rol: rol || u.rol, permisos });
}