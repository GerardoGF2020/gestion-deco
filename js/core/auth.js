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
    store.put('usuarios', DEFAULT_ADMIN);
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

export async function solicitarRegistro({ nombre, email, telefono, username, password, rolDeseado }) {
  asegurarAdminInicial();
  const uNorm = (username || '').trim().toLowerCase();
  const eNorm = (email || '').trim().toLowerCase();

  if (!nombre?.trim()) throw new Error('El nombre completo es obligatorio.');
  if (!eNorm) throw new Error('El correo electrónico es obligatorio.');
  if (!uNorm) throw new Error('El nombre de usuario es obligatorio.');
  if (!password || password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');

  const users = store.list('usuarios');
  if (users.some(u => (u.username || '').toLowerCase() === uNorm)) {
    throw new Error('El nombre de usuario ya está en uso. Elija otro.');
  }
  if (users.some(u => (u.email || '').toLowerCase() === eNorm)) {
    throw new Error('Ese correo electrónico ya tiene una cuenta o solicitud.');
  }

  const { hash, salt } = await hashPassword(password);
  const nuevo = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username: uNorm,
    nombre: nombre.trim(),
    email: eNorm,
    telefono: (telefono || '').trim(),
    rol: rolDeseado || 'vendedor',
    estado: 'pendiente_aprobacion',
    activo: false,
    fecha_registro: new Date().toISOString(),
    salt,
    hash
  };

  store.put('usuarios', nuevo);
  return nuevo;
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

// 0 = sin acceso, 1 = ver, 2 = editar
export function level(mod) {
  const u = currentUser();
  if (!u || !u.rol) return 0;
  if (u.rol === 'admin') return 2;
  return store.config().roles?.[u.rol]?.perms?.[mod] ?? 0;
}

export const can = (mod, min = 1) => level(mod) >= min;
