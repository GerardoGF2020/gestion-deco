// Usuario actual y permisos. Los roles viven en la configuración (editable desde Administración).
// Mientras no haya usuarios cargados, quien usa la app es el propietario (administrador).
// OJO: los permisos se aplican en la interfaz; la protección real de los datos es quién tiene
// acceso al archivo compartido en Google Drive.

import * as store from './store.js';

export function currentUser() {
  const loc = store.getLocal();
  const email = (loc.email || '').toLowerCase();
  const users = store.list('usuarios');
  if (!users.length || !email) {
    return { nombre: loc.name || 'Propietario', email, rol: 'admin', virtual: true };
  }
  return (
    users.find(u => (u.email || '').toLowerCase() === email && u.activo !== false) ||
    { nombre: loc.name || email, email, rol: null }
  );
}

// 0 = sin acceso, 1 = ver, 2 = editar
export function level(mod) {
  const u = currentUser();
  if (!u.rol) return 0;
  return store.config().roles?.[u.rol]?.perms?.[mod] ?? 0;
}
export const can = (mod, min = 1) => level(mod) >= min;
