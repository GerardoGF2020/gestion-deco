import * as store from './core/store.js';
import * as drive from './core/drive.js';
import * as auth from './core/auth.js';
import { h, toast, openModal } from './core/ui.js';
import { buildSeed } from './data/seed-catalogo.js';
import catalogo from './modules/catalogo.js';
import ajustes from './modules/ajustes.js';
import admin from './modules/admin.js';
import { compras, stock, ventas } from './modules/pendientes.js';

const APP_URL = 'https://gerardogf2020.github.io/gestion-deco/';

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

function waLink(tel, mensaje) {
  const cleanTel = (tel || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(mensaje);
  return cleanTel ? `https://wa.me/${cleanTel}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

// ---------- Barra lateral y perfil de usuario ----------
function buildNav() {
  const id = currentId();
  const cur = auth.currentUser();

  // Módulos según permisos
  const allowedModules = MODULES.filter(m => !m.perm || auth.can(m.perm, 1));

  // Footer con el perfil del usuario conectado (Autoservicio)
  const userFooter = cur ? h('div', { class: 'user-sidebar-card' },
    h('div', { style: 'display: flex; align-items: center; gap: 8px;' },
      h('div', { class: 'user-avatar' }, cur.rol === 'admin' ? '👑' : '👤'),
      h('div', { style: 'min-width: 0; flex: 1;' },
        h('div', { class: 'user-name', title: cur.nombre }, cur.nombre),
        h('div', { class: 'user-role' }, cur.rol === 'admin' ? 'Administrador' : (cur.rol || 'Operador')))
    ),
    h('div', { style: 'display: flex; gap: 6px; margin-top: 10px;' },
      h('button', {
        class: 'btn-user-action',
        title: 'Cambiar mi contraseña',
        onclick: abrirModalCambiarPassword
      }, '🔑 Clave'),
      h('button', {
        class: 'btn-user-action danger',
        title: 'Cerrar sesión',
        onclick: () => {
          auth.logout();
          toast('Sesión finalizada.');
          mostrarPantallaLogin();
        }
      }, '🚪 Salir')
    )
  ) : null;

  nav.replaceChildren(
    h('div', { class: 'brand' },
      h('span', { class: 'logo' }, '🏺'),
      h('div', {},
        h('div', { style: 'font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em;' }, 'Gestión Deco'),
        h('div', { style: 'font-size: 0.72rem; color: #a8a29e; font-weight: 500;' }, store.config().nombreNegocio)
      )
    ),
    h('div', { class: 'nav-list' },
      ...allowedModules.map(m =>
        h('a', { href: `#/${m.id}`, class: 'nav-item' + (m.id === id ? ' active' : '') },
          h('span', { class: 'ico' }, m.icon),
          h('span', { class: 'lbl' }, m.label)
        )
      )
    ),
    userFooter
  );
}

// ---------- Ruteador ----------
function route() {
  if (!auth.isLoggedIn()) {
    mostrarPantallaLogin();
    return;
  }

  // Ocultar modal de login si estuviera abierto
  document.getElementById('loginOverlay')?.remove();

  const m = MODULES.find(x => x.id === currentId()) || MODULES[0];
  cleanup?.();
  cleanup = null;
  view.replaceChildren();
  title.textContent = m.title;
  buildNav();

  if (m.perm && !auth.can(m.perm, 1)) {
    view.append(
      h('div', { class: 'card placeholder' },
        h('h2', {}, 'Sin acceso'),
        h('p', {}, 'Tu usuario no tiene permiso para este módulo. Pídele autorización a un administrador.')
      )
    );
    return;
  }

  cleanup = m.mount(view) || null;
}

// ---------- Topbar & WhatsApp Button ----------
function initTopbar() {
  // Botón verde de WhatsApp en la barra superior
  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('btnCompartirWA')) {
    const btnWA = h('a', {
      id: 'btnCompartirWA',
      class: 'btn-wa-topbar',
      target: '_blank',
      rel: 'noopener',
      href: waLink('', `¡Hola! Te comparto la aplicación de Gestión Deco:\n🔗 ${APP_URL}\n(Regístrate en "Solicitar Cuenta" para habilitar tu acceso).`),
      title: 'Compartir enlace por WhatsApp con nuevos usuarios'
    },
      h('span', {}, '📱'),
      h('span', { class: 'wa-btn-label' }, 'Compartir por WhatsApp')
    );

    // Insertar antes del botón de sincronización
    topbar.insertBefore(btnWA, syncBtn);
  }
}

// ---------- Sincronización con Google Drive ----------
const SYNC_LABEL = {
  noconfig: ['Drive sin configurar', 'warn'],
  disconnected: ['Conectar Drive', 'warn'],
  syncing: ['Sincronizando…', 'busy'],
  ok: ['Sincronizado', 'ok'],
  pending: ['Pendiente', 'busy'],
  offline: ['Sin conexión', 'warn'],
  error: ['Error de sync', 'err'],
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

// ---------- MODAL PROFESIONAL DE LOGIN / REGISTRO ----------
function mostrarPantallaLogin() {
  document.getElementById('loginOverlay')?.remove();

  const overlay = h('div', { id: 'loginOverlay', class: 'login-modal-overlay' });
  const card = h('div', { class: 'login-modal-card animate-fadeIn' });

  let tabActiva = 'login'; // 'login' | 'registro'

  function renderModal() {
    card.replaceChildren();

    // Encabezado
    const header = h('div', { class: 'login-modal-header' },
      h('div', { class: 'login-modal-logo' }, '🏺'),
      h('h2', { style: 'margin: 0; font-size: 1.3rem; font-weight: 800; color: #1e293b;' }, 'Gestión Deco'),
      h('p', { style: 'margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;' }, 'Sistema de Catálogo, Ventas y Administración')
    );

    // Pestañas
    const tabs = h('div', { class: 'login-modal-tabs' },
      h('button', {
        class: `login-tab-btn ${tabActiva === 'login' ? 'active' : ''}`,
        onclick: () => { tabActiva = 'login'; renderModal(); }
      }, '🔑 Iniciar Sesión'),
      h('button', {
        class: `login-tab-btn ${tabActiva === 'registro' ? 'active' : ''}`,
        onclick: () => { tabActiva = 'registro'; renderModal(); }
      }, '📝 Solicitar Cuenta Nueva')
    );

    card.append(header, tabs);

    if (tabActiva === 'login') {
      // Formulario Login
      const inUser = h('input', { type: 'text', placeholder: 'admin o correo@ejemplo.com', value: 'admin', style: 'margin-bottom: 10px;' });
      const inPass = h('input', { type: 'password', placeholder: '••••••••', value: 'tasaciones2026', style: 'margin-bottom: 14px;' });
      const errorMsg = h('div', { class: 'login-error-box', style: 'display: none;' });

      const btnEntrar = h('button', {
        class: 'btn primary',
        style: 'width: 100%; height: 46px; font-weight: bold; font-size: 0.95rem; border-radius: 10px;',
        onclick: async () => {
          try {
            errorMsg.style.display = 'none';
            btnEntrar.disabled = true;
            btnEntrar.textContent = 'Verificando…';
            await auth.login(inUser.value, inPass.value);
            overlay.remove();
            toast('¡Bienvenido!');
            route();
          } catch (e) {
            errorMsg.textContent = e.message;
            errorMsg.style.display = 'block';
            btnEntrar.disabled = false;
            btnEntrar.textContent = 'Ingresar al Sistema →';
          }
        }
      }, 'Ingresar al Sistema →');

      // Botón de Acceso Rápido Administrador (1 clic para pruebas)
      const accesoRapido = h('div', { style: 'margin-top: 18px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; text-align: left;' },
        h('div', { style: 'font-weight: 700; font-size: 0.78rem; color: #475569; margin-bottom: 6px; display: flex; justify-content: space-between;' },
          h('span', {}, 'Acceso rápido con 1 Clic:'),
          h('span', { style: 'color: #7c3aed; font-size: 0.72rem;' }, '👑 Administrador')
        ),
        h('button', {
          type: 'button',
          style: 'width: 100%; padding: 8px 10px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; text-align: left; font-size: 0.8rem;',
          onclick: () => {
            inUser.value = 'admin';
            inPass.value = 'tasaciones2026';
            btnEntrar.click();
          }
        },
          h('div', { style: 'font-weight: 700; color: #1e293b;' }, '👑 Administrador General (Gerardo)'),
          h('div', { class: 'mono muted', style: 'font-size: 0.72rem;' }, 'admin  •  gerardocggf@gmail.com')
        )
      );

      card.append(
        h('div', { style: 'text-align: left;' },
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;' }, 'Usuario o Correo:'),
          inUser,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;' }, 'Contraseña:'),
          inPass,
          errorMsg,
          btnEntrar,
          accesoRapido
        )
      );

    } else {
      // Formulario Registro Público
      const inNombre = h('input', { type: 'text', placeholder: 'Ej: Laura Gómez', style: 'margin-bottom: 10px;' });
      const inEmail = h('input', { type: 'email', placeholder: 'laura@ejemplo.com', style: 'margin-bottom: 10px;' });
      const inTel = h('input', { type: 'tel', placeholder: 'Ej: 381-5123456 (para avisarte por WhatsApp)', style: 'margin-bottom: 10px;' });
      const inUser = h('input', { type: 'text', placeholder: 'Ej: laurag', style: 'margin-bottom: 10px;' });
      const inPass = h('input', { type: 'password', placeholder: '••••••••', style: 'margin-bottom: 10px;' });
      const inRol = h('select', { style: 'margin-bottom: 14px;' },
        h('option', { value: 'vendedor' }, '💰 Vendedor'),
        h('option', { value: 'deposito' }, '📦 Depósito'),
        h('option', { value: 'compras' }, '🛒 Compras'),
        h('option', { value: 'lectura' }, '📄 Solo lectura')
      );

      const msgBox = h('div', { style: 'display: none; padding: 10px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 12px;' });

      const infoAviso = h('div', { style: 'background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px; border-radius: 8px; font-size: 0.78rem; margin-bottom: 12px; text-align: left;' },
        h('strong', {}, 'ℹ️ Aprobación Requerida: '),
        'Al enviar tus datos, el Administrador (gerardocggf@gmail.com) recibirá la solicitud para darte el alta y habilitar tu acceso.'
      );

      const btnSolicitar = h('button', {
        class: 'btn primary',
        style: 'width: 100%; height: 46px; font-weight: bold; border-radius: 10px;',
        onclick: async () => {
          try {
            msgBox.style.display = 'none';
            btnSolicitar.disabled = true;
            btnSolicitar.textContent = 'Enviando solicitud…';

            await auth.solicitarRegistro({
              nombre: inNombre.value,
              email: inEmail.value,
              telefono: inTel.value,
              username: inUser.value,
              password: inPass.value,
              rolDeseado: inRol.value
            });

            msgBox.className = 'login-success-box';
            msgBox.innerHTML = '<strong>✅ ¡Solicitud enviada con éxito!</strong><br>El Administrador revisará tus datos para autorizar tu cuenta.';
            msgBox.style.display = 'block';

            inNombre.value = ''; inEmail.value = ''; inTel.value = ''; inUser.value = ''; inPass.value = '';
            btnSolicitar.disabled = false;
            btnSolicitar.textContent = 'Solicitud Enviada';
          } catch (e) {
            msgBox.className = 'login-error-box';
            msgBox.textContent = e.message;
            msgBox.style.display = 'block';
            btnSolicitar.disabled = false;
            btnSolicitar.textContent = '📨 Enviar Solicitud';
          }
        }
      }, '📨 Enviar Solicitud de Registro');

      card.append(
        h('div', { style: 'text-align: left;' },
          infoAviso,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Nombre Completo: *'),
          inNombre,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Correo Electrónico: *'),
          inEmail,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Teléfono / WhatsApp:'),
          inTel,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Usuario deseado: *'),
          inUser,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Contraseña deseada: *'),
          inPass,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Área / Rol solicitado: *'),
          inRol,
          msgBox,
          btnSolicitar
        )
      );
    }
  }

  renderModal();
  overlay.append(card);
  document.body.append(overlay);
}

// ---------- Modal Autoservicio: Cambiar contraseña propia ----------
function abrirModalCambiarPassword() {
  const cur = auth.currentUser();
  if (!cur) return;

  const inOld = h('input', { type: 'password', placeholder: 'Tu contraseña actual' });
  const inNew = h('input', { type: 'password', placeholder: 'Nueva contraseña (mínimo 4 caracteres)' });
  const inConfirm = h('input', { type: 'password', placeholder: 'Repite la nueva contraseña' });

  const modalBody = h('div', { class: 'stack', style: 'gap: 12px;' },
    h('p', { class: 'muted', style: 'margin: 0;' }, `Actualiza la clave de acceso para tu cuenta (${cur.username}).`),
    h('label', {}, 'Contraseña actual:', inOld),
    h('label', {}, 'Nueva contraseña:', inNew),
    h('label', {}, 'Confirmar nueva contraseña:', inConfirm)
  );

  const close = openModal('🔑 Cambiar mi contraseña', modalBody, [
    h('button', {
      class: 'btn primary',
      onclick: async () => {
        if (!inNew.value || inNew.value.length < 4) {
          toast('La contraseña debe tener al menos 4 caracteres.', 'err');
          return;
        }
        if (inNew.value !== inConfirm.value) {
          toast('Las nuevas contraseñas no coinciden.', 'err');
          return;
        }
        try {
          await auth.cambiarPasswordPropia(inOld.value, inNew.value);
          toast('¡Contraseña actualizada con éxito!');
          close();
        } catch (e) {
          toast(e.message, 'err');
        }
      }
    }, 'Guardar Nueva Clave'),
    h('button', { class: 'btn', onclick: () => close() }, 'Cancelar')
  ]);
}

// ---------- Arranque ----------
async function boot() {
  await store.load();
  auth.asegurarAdminInicial();
  seedIfEmpty();
  initTopbar();

  window.addEventListener('hashchange', route);
  store.onChange(src => { if (src === 'remote') route(); });

  route();
  drive.start();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
