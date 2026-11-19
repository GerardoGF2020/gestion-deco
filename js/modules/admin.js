// Módulo de Administración, Gestión de Usuarios y Bandeja de Aprobaciones
// Inspirado en el diseño del Mercado Inmobiliario (Tasaciones Pro) con integración a WhatsApp.

import * as store from '../core/store.js';
import * as auth from '../core/auth.js';
import { h, toast, confirmDialog, fmtDate } from '../core/ui.js';

const APP_URL = 'https://gerardogf2020.github.io/gestion-deco/';

const ROLES_INFO = {
  admin:    { label: '👑 Administrador', cls: 'purple' },
  vendedor: { label: '💰 Vendedor', cls: 'blue' },
  deposito: { label: '📦 Depósito', cls: 'amber' },
  compras:  { label: '🛒 Compras', cls: 'green' },
  lectura:  { label: '📄 Solo lectura', cls: 'gray' },
};

function waLink(tel, mensaje) {
  const cleanTel = (tel || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(mensaje);
  return cleanTel ? `https://wa.me/${cleanTel}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

export default {
  id: 'admin',
  perm: 'admin',
  label: 'Administración',
  icon: '⚙️',
  title: 'Administración y Seguridad',
  mount(root) {
    let subtab = 'solicitudes'; // 'solicitudes' | 'usuarios' | 'alta'

    const container = h('div', { class: 'stack' });
    root.append(container);

    function render() {
      container.replaceChildren();

      const users = store.list('usuarios');
      const pendientes = users.filter(u => u.estado === 'pendiente_aprobacion');
      const activos = users.filter(u => u.estado === 'activo');

      // Banner superior
      const banner = h('div', { class: 'card', style: 'border-left: 4px solid #7c3aed; background: #faf5ff;' },
        h('div', { style: 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;' },
          h('div', {},
            h('h2', { style: 'color: #581c87; margin: 0 0 4px 0;' }, '👑 Control de Usuarios & Aprobaciones'),
            h('p', { class: 'muted', style: 'margin: 0;' }, 'Autoriza nuevos colaboradores, gestiona roles y comparte accesos directamente por WhatsApp.')),
          h('a', {
            class: 'btn wa',
            target: '_blank',
            rel: 'noopener',
            href: waLink('', `¡Hola! Te comparto la aplicación de Gestión Deco para que puedas ingresar desde tu celular o computadora:\n🔗 ${APP_URL}\n(Regístrate tocando "Solicitar Registro" para que te habilite tu cuenta).`)
          }, '📱 Compartir App por WhatsApp')
        )
      );

      // Selector de Subtabs
      const tabNav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap;' },
        h('button', {
          class: `btn ${subtab === 'solicitudes' ? 'primary' : ''}`,
          onclick: () => { subtab = 'solicitudes'; render(); }
        }, `⏳ Solicitudes Pendientes (${pendientes.length})`),
        h('button', {
          class: `btn ${subtab === 'usuarios' ? 'primary' : ''}`,
          onclick: () => { subtab = 'usuarios'; render(); }
        }, `👥 Usuarios Activos (${activos.length})`),
        h('button', {
          class: `btn ${subtab === 'alta' ? 'primary' : ''}`,
          onclick: () => { subtab = 'alta'; render(); }
        }, '➕ Dar de Alta Directo')
      );

      container.append(banner, tabNav);

      if (subtab === 'solicitudes') {
        renderSolicitudes(container, pendientes);
      } else if (subtab === 'usuarios') {
        renderUsuarios(container, activos);
      } else if (subtab === 'alta') {
        renderAltaDirecta(container);
      }
    }

    // ---------- VISTA 1: SOLICITUDES PENDIENTES ----------
    function renderSolicitudes(parent, pendientes) {
      const card = h('div', { class: 'card' });

      if (!pendientes.length) {
        card.append(
          h('div', { style: 'text-align: center; padding: 32px 16px;' },
            h('div', { style: 'font-size: 2.5rem; margin-bottom: 8px;' }, '✅'),
            h('h3', {}, 'No hay solicitudes pendientes'),
            h('p', { class: 'muted' }, 'Cuando un nuevo usuario complete el formulario de registro desde su celular o PC, aparecerá aquí para que lo apruebes.'))
        );
        parent.append(card);
        return;
      }

      card.append(
        h('div', { class: 'p-3 bg-amber-50 border border-amber-300 rounded-xl mb-4', style: 'background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px; margin-bottom: 16px;' },
          h('strong', { style: 'color: #92400e;' }, '⏳ Solicitudes de Alta en Espera:'),
          h('p', { style: 'color: #b45309; font-size: 0.85rem; margin: 4px 0 0 0;' },
            'Revisa los datos, selecciona el rol correspondiente y presiona "Autorizar". Luego podrás avisarle directamente por WhatsApp.')
        )
      );

      const tableWrap = h('div', { style: 'overflow-x: auto;' });
      const table = h('table', { style: 'width: 100%; border-collapse: collapse; font-size: 0.9rem;' });

      table.append(
        h('thead', {},
          h('tr', { style: 'background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;' },
            h('th', { style: 'padding: 10px;' }, 'Fecha'),
            h('th', { style: 'padding: 10px;' }, 'Solicitante'),
            h('th', { style: 'padding: 10px;' }, 'Email / WhatsApp'),
            h('th', { style: 'padding: 10px;' }, 'Rol a Otorgar'),
            h('th', { style: 'padding: 10px; text-align: center;' }, 'Acción Directa')
          )
        )
      );

      const tbody = h('tbody', {});

      pendientes.forEach(u => {
        const rolSelect = h('select', { style: 'padding: 6px 8px; font-size: 0.85rem; width: auto;' },
          h('option', { value: 'vendedor', selected: u.rol === 'vendedor' }, '💰 Vendedor'),
          h('option', { value: 'deposito', selected: u.rol === 'deposito' }, '📦 Depósito'),
          h('option', { value: 'compras', selected: u.rol === 'compras' }, '🛒 Compras'),
          h('option', { value: 'lectura', selected: u.rol === 'lectura' }, '📄 Solo lectura'),
          h('option', { value: 'admin', selected: u.rol === 'admin' }, '👑 Administrador')
        );

        const btnAutorizar = h('button', {
          class: 'btn primary small',
          style: 'background: #16a34a; border-color: #16a34a; color: white;',
          onclick: () => {
            auth.autorizarUsuario(u.id, rolSelect.value);
            toast(`Usuario ${u.nombre} autorizado con éxito.`);
            render();
          }
        }, '🟢 Autorizar');

        const msgWA = `¡Hola ${u.nombre}! Tu cuenta en Gestión Deco ha sido autorizada con éxito con el rol de ${rolSelect.value}.\nYa puedes ingresar con tu correo y contraseña en:\n🔗 ${APP_URL}`;
        const btnWA = h('a', {
          class: 'btn wa small',
          target: '_blank',
          rel: 'noopener',
          href: waLink(u.telefono, msgWA),
          title: 'Notificar al usuario por WhatsApp'
        }, '📲 WhatsApp');

        const btnRechazar = h('button', {
          class: 'btn danger ghost small',
          onclick: async () => {
            const ok = await confirmDialog(`¿Rechazar la solicitud de ${u.nombre}?`);
            if (ok) {
              auth.rechazarUsuario(u.id);
              toast('Solicitud rechazada');
              render();
            }
          }
        }, '🔴 Rechazar');

        tbody.append(
          h('tr', { style: 'border-bottom: 1px solid #e2e8f0;' },
            h('td', { style: 'padding: 10px; font-size: 0.8rem; color: #64748b;' }, fmtDate(u.fecha_registro)),
            h('td', { style: 'padding: 10px;' },
              h('div', { style: 'font-weight: 600;' }, u.nombre),
              h('div', { class: 'mono muted', style: 'font-size: 0.75rem;' }, `@${u.username}`)),
            h('td', { style: 'padding: 10px;' },
              h('div', {}, u.email),
              h('div', { style: 'font-size: 0.8rem; color: #2563eb;' }, u.telefono ? `📞 ${u.telefono}` : '—')),
            h('td', { style: 'padding: 10px;' }, rolSelect),
            h('td', { style: 'padding: 10px; text-align: center;' },
              h('div', { style: 'display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;' },
                btnAutorizar, btnWA, btnRechazar))
          )
        );
      });

      table.append(tbody);
      tableWrap.append(table);
      card.append(tableWrap);
      parent.append(card);
    }

    // ---------- VISTA 2: USUARIOS ACTIVOS ----------
    function renderUsuarios(parent, activos) {
      const card = h('div', { class: 'card' });

      const tableWrap = h('div', { style: 'overflow-x: auto;' });
      const table = h('table', { style: 'width: 100%; border-collapse: collapse; font-size: 0.9rem;' });

      table.append(
        h('thead', {},
          h('tr', { style: 'background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;' },
            h('th', { style: 'padding: 10px;' }, 'Usuario'),
            h('th', { style: 'padding: 10px;' }, 'Nombre Completo'),
            h('th', { style: 'padding: 10px;' }, 'Email / WhatsApp'),
            h('th', { style: 'padding: 10px;' }, 'Rol Asignado'),
            h('th', { style: 'padding: 10px; text-align: center;' }, 'Acciones')
          )
        )
      );

      const tbody = h('tbody', {});

      activos.forEach(u => {
        const esAdminPrincipal = u.username === 'admin';

        const rolSelect = h('select', {
          style: 'padding: 6px 8px; font-size: 0.85rem; width: auto;',
          disabled: esAdminPrincipal,
          onchange: e => {
            auth.autorizarUsuario(u.id, e.target.value);
            toast('Rol actualizado');
            render();
          }
        },
          h('option', { value: 'admin', selected: u.rol === 'admin' }, '👑 Administrador'),
          h('option', { value: 'vendedor', selected: u.rol === 'vendedor' }, '💰 Vendedor'),
          h('option', { value: 'deposito', selected: u.rol === 'deposito' }, '📦 Depósito'),
          h('option', { value: 'compras', selected: u.rol === 'compras' }, '🛒 Compras'),
          h('option', { value: 'lectura', selected: u.rol === 'lectura' }, '📄 Solo lectura')
        );

        const msgWA = `¡Hola ${u.nombre}! Te recordamos el acceso al sistema de Gestión Deco:\n🔗 ${APP_URL}\nTu usuario es: ${u.username}`;
        const btnWA = h('a', {
          class: 'btn wa small',
          target: '_blank',
          rel: 'noopener',
          href: waLink(u.telefono, msgWA),
          title: 'Enviar datos por WhatsApp'
        }, '📲 WA');

        const btnReset = h('button', {
          class: 'btn small',
          title: 'Resetear contraseña a 123456',
          onclick: async () => {
            const ok = await confirmDialog(`¿Resetear la contraseña de ${u.nombre} a "123456"?`);
            if (ok) {
              await auth.cambiarPasswordUsuario(u.id, '123456');
              toast(`Contraseña de ${u.nombre} reseteada a: 123456`);
            }
          }
        }, '🔑 Reset Clave');

        const btnBorrar = esAdminPrincipal ? null : h('button', {
          class: 'btn danger ghost small',
          title: 'Dar de baja / Eliminar usuario',
          onclick: async () => {
            const ok = await confirmDialog(`¿Eliminar al usuario ${u.nombre}?`);
            if (ok) {
              auth.eliminarUsuario(u.id);
              toast('Usuario eliminado');
              render();
            }
          }
        }, '🗑️');

        tbody.append(
          h('tr', { style: 'border-bottom: 1px solid #e2e8f0;' },
            h('td', { style: 'padding: 10px;' },
              h('span', { class: 'mono font-bold' }, u.username),
              esAdminPrincipal ? h('span', { style: 'font-size: 0.75rem; background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 99px; margin-left: 6px;' }, 'Dueño') : null),
            h('td', { style: 'padding: 10px;' }, u.nombre),
            h('td', { style: 'padding: 10px;' },
              h('div', {}, u.email),
              h('div', { style: 'font-size: 0.8rem; color: #2563eb;' }, u.telefono ? `📞 ${u.telefono}` : '—')),
            h('td', { style: 'padding: 10px;' }, rolSelect),
            h('td', { style: 'padding: 10px; text-align: center;' },
              h('div', { style: 'display: flex; gap: 6px; justify-content: center;' },
                btnWA, btnReset, btnBorrar))
          )
        );
      });

      table.append(tbody);
      tableWrap.append(table);
      card.append(tableWrap);
      parent.append(card);
    }

    // ---------- VISTA 3: ALTA DIRECTA ----------
    function renderAltaDirecta(parent) {
      const card = h('div', { class: 'card', style: 'max-width: 600px;' },
        h('h3', {}, 'Dar de Alta Directo a un Nuevo Colaborador'),
        h('p', { class: 'muted' }, 'Usa este formulario si prefieres crear tú mismo la cuenta de alguien sin que tenga que solicitarla.')
      );

      const inNombre = h('input', { placeholder: 'Ej: Martín Gómez' });
      const inEmail = h('input', { type: 'email', placeholder: 'martin@ejemplo.com' });
      const inTel = h('input', { type: 'tel', placeholder: 'Ej: 381-5123456' });
      const inUser = h('input', { placeholder: 'Ej: mgomez' });
      const inPass = h('input', { type: 'password', placeholder: 'Mínimo 4 caracteres' });
      const inRol = h('select', {},
        h('option', { value: 'vendedor' }, '💰 Vendedor'),
        h('option', { value: 'deposito' }, '📦 Depósito'),
        h('option', { value: 'compras' }, '🛒 Compras'),
        h('option', { value: 'lectura' }, '📄 Solo lectura'),
        h('option', { value: 'admin' }, '👑 Administrador')
      );

      const btnGuardar = h('button', {
        class: 'btn primary',
        style: 'margin-top: 12px;',
        onclick: async () => {
          try {
            const u = await auth.solicitarRegistro({
              nombre: inNombre.value,
              email: inEmail.value,
              telefono: inTel.value,
              username: inUser.value,
              password: inPass.value,
              rolDeseado: inRol.value
            });
            // Activar de inmediato
            auth.autorizarUsuario(u.id, inRol.value);
            toast(`¡Usuario ${u.nombre} creado y activado!`);
            subtab = 'usuarios';
            render();
          } catch (e) {
            toast(e.message, 'err');
          }
        }
      }, 'Crear y Habilitar Usuario');

      card.append(
        h('div', { class: 'stack', style: 'gap: 12px; margin-top: 14px;' },
          h('label', {}, 'Nombre Completo:', inNombre),
          h('label', {}, 'Correo Electrónico:', inEmail),
          h('label', {}, 'Teléfono / WhatsApp:', inTel),
          h('label', {}, 'Nombre de Usuario:', inUser),
          h('label', {}, 'Contraseña Inicial:', inPass),
          h('label', {}, 'Rol / Permisos:', inRol),
          btnGuardar
        )
      );

      parent.append(card);
    }

    render();
  }
};
