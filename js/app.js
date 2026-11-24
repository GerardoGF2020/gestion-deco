import * as store from './core/store.js';
import * as drive from './core/drive.js';
import * as auth from './core/auth.js';
import { h, toast, openModal } from './core/ui.js';
import { buildSeed } from './data/seed-catalogo.js';
import inicio from './modules/inicio.js';
import ventas from './modules/ventas.js';
import stock from './modules/stock.js';
import compras from './modules/compras.js';
import catalogo from './modules/catalogo.js';
import admin from './modules/admin.js';
import ajustes from './modules/ajustes.js';

const PUBLIC_APP_URL = 'https://is.gd/gestiondeco';
const getAppUrl = () => {
  if (location.origin.includes('github.io')) {
    return 'https://is.gd/gestiondeco';
  }
  return PUBLIC_APP_URL;
};

const MODULES = [inicio, ventas, stock, compras, catalogo, admin, ajustes];

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

const currentId = () => location.hash.replace(/^#\//, '') || 'inicio';

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
      href: waLink('', `¡Hola! Te comparto la aplicación de Gestión Deco:\n🔗 ${getAppUrl()}\n(Regístrate en "Solicitar Cuenta" para habilitar tu acceso).`),
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

// ---------- MODAL PROFESIONAL DE LOGIN / REGISTRO / AUTOSERVICIO ----------
function mostrarPantallaLogin() {
  document.getElementById('loginOverlay')?.remove();

  const overlay = h('div', { id: 'loginOverlay', class: 'login-modal-overlay' });
  const card = h('div', { class: 'login-modal-card animate-fadeIn' });

  let tabActiva = 'login'; // 'login' | 'registro' | 'recuperar'

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
      }, '📝 Solicitar Cuenta'),
      h('button', {
        class: `login-tab-btn ${tabActiva === 'recuperar' ? 'active' : ''}`,
        onclick: () => { tabActiva = 'recuperar'; renderModal(); }
      }, '❓ Olvidé mi Clave')
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

      const linkOlvido = h('div', { style: 'margin-top: 12px; text-align: center;' },
        h('a', {
          href: '#',
          style: 'font-size: 0.82rem; color: #64748b; text-decoration: underline;',
          onclick: (e) => {
            e.preventDefault();
            tabActiva = 'recuperar';
            renderModal();
          }
        }, '¿Olvidaste tu contraseña? Recuperar con código')
      );

      card.append(
        h('div', { style: 'text-align: left;' },
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;' }, 'Usuario o Correo:'),
          inUser,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;' }, 'Contraseña:'),
          inPass,
          errorMsg,
          btnEntrar,
          linkOlvido,
          accesoRapido
        )
      );

    } else if (tabActiva === 'registro') {
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

      const msgBox = h('div', { style: 'display: none; padding: 12px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 12px;' });

      const infoAviso = h('div', { style: 'background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px; border-radius: 8px; font-size: 0.78rem; margin-bottom: 12px; text-align: left;' },
        h('strong', {}, 'ℹ️ Aprobación Requerida: '),
        'El Administrador autorizará tu cuenta la primera vez. Una vez aprobada, podrás gestionar tu clave tú mismo.'
      );

      const btnSolicitar = h('button', {
        class: 'btn primary',
        style: 'width: 100%; height: 46px; font-weight: bold; border-radius: 10px;',
        onclick: async () => {
          try {
            msgBox.style.display = 'none';
            btnSolicitar.disabled = true;
            btnSolicitar.textContent = 'Enviando solicitud…';

            const nuevoUser = await auth.solicitarRegistro({
              nombre: inNombre.value,
              email: inEmail.value,
              telefono: inTel.value,
              username: inUser.value,
              password: inPass.value,
              rolDeseado: inRol.value
            });

            msgBox.className = 'login-success-box';
            msgBox.replaceChildren(
              h('div', { style: 'font-weight:bold; font-size:0.95rem; margin-bottom:4px;' }, '✅ ¡Solicitud enviada con éxito!'),
              h('div', {}, `Usuario asignado: <strong>${nuevoUser.username}</strong>`),
              h('div', { style: 'margin-top:10px; padding:10px; background:#fef3c7; border:1px solid #f59e0b; border-radius:8px; color:#92400e;' },
                h('div', { style: 'font-weight:bold; font-size:0.8rem;' }, '🔑 TU CÓDIGO DE RECUPERACIÓN PERSONAL:'),
                h('div', { class: 'mono font-bold', style: 'font-size:1.15rem; color:#78350f; letter-spacing:1px; margin:4px 0;' }, nuevoUser.codigoRecuperacion),
                h('div', { style: 'font-size:0.75rem;' }, 'Anota este código. Si olvidas tu clave, te permitirá recuperarla por ti mismo sin molestar al administrador.')
              )
            );
            msgBox.style.display = 'block';

            inNombre.value = ''; inEmail.value = ''; inTel.value = ''; inUser.value = ''; inPass.value = '';
            btnSolicitar.disabled = false;
            btnSolicitar.textContent = 'Solicitud Enviada ✓';
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

    } else if (tabActiva === 'recuperar') {
      // Formulario Recuperar Clave con Código de Autoservicio
      const inUserRec = h('input', { type: 'text', placeholder: 'Tu usuario o correo', style: 'margin-bottom: 10px;' });
      const inCodRec = h('input', { type: 'text', placeholder: 'ABCD-EFGH-JKLM', class: 'mono', style: 'margin-bottom: 10px; text-transform: uppercase;' });
      const inNuevaPass = h('input', { type: 'password', placeholder: 'Nueva contraseña (mínimo 4 caracteres)', style: 'margin-bottom: 10px;' });
      const inConfirmPass = h('input', { type: 'password', placeholder: 'Repite la nueva contraseña', style: 'margin-bottom: 14px;' });
      const msgRec = h('div', { style: 'display: none; padding: 10px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 12px;' });

      const infoRec = h('div', { style: 'background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 0.78rem; margin-bottom: 12px; text-align: left; color: #475569;' },
        'Ingresa tu usuario y el código de 12 dígitos que te fue asignado para redefinir tu contraseña de forma autónoma.'
      );

      const btnRecuperar = h('button', {
        class: 'btn primary',
        style: 'width: 100%; height: 46px; font-weight: bold; border-radius: 10px;',
        onclick: async () => {
          try {
            msgRec.style.display = 'none';
            if (!inNuevaPass.value || inNuevaPass.value.length < 4) {
              throw new Error('La contraseña debe tener al menos 4 caracteres.');
            }
            if (inNuevaPass.value !== inConfirmPass.value) {
              throw new Error('Las nuevas contraseñas no coinciden.');
            }
            btnRecuperar.disabled = true;
            btnRecuperar.textContent = 'Actualizando contraseña…';

            const nuevoCod = await auth.recuperarConCodigo(inUserRec.value, inCodRec.value, inNuevaPass.value);

            msgRec.className = 'login-success-box';
            msgRec.replaceChildren(
              h('div', { style: 'font-weight:bold;' }, '✅ ¡Contraseña restablecida con éxito!'),
              h('div', { style: 'margin-top:6px; font-size:0.8rem;' }, 'Ya puedes iniciar sesión con tu nueva clave.'),
              h('div', { style: 'margin-top:8px; padding:8px; background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; color:#92400e; font-size:0.75rem;' },
                'Tu nuevo código de recuperación para la próxima vez es: ',
                h('span', { class: 'mono font-bold' }, nuevoCod)
              )
            );
            msgRec.style.display = 'block';
            btnRecuperar.textContent = 'Ir a Iniciar Sesión';
            btnRecuperar.disabled = false;
            btnRecuperar.onclick = () => { tabActiva = 'login'; renderModal(); };
          } catch (e) {
            msgRec.className = 'login-error-box';
            msgRec.textContent = e.message;
            msgRec.style.display = 'block';
            btnRecuperar.disabled = false;
            btnRecuperar.textContent = 'Restablecer Contraseña';
          }
        }
      }, 'Restablecer Contraseña');

      card.append(
        h('div', { style: 'text-align: left;' },
          infoRec,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Usuario o Correo:'),
          inUserRec,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Código de Recuperación:'),
          inCodRec,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Nueva Contraseña:'),
          inNuevaPass,
          h('label', { style: 'font-size: 0.8rem; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;' }, 'Confirmar Nueva Contraseña:'),
          inConfirmPass,
          msgRec,
          btnRecuperar
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

  const modal = openModal({
    title: '🔑 Cambiar mi contraseña',
    body: modalBody,
    footer: [
      h('button', { class: 'btn', onclick: () => modal.close() }, 'Cancelar'),
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
            modal.close();
          } catch (e) {
            toast(e.message, 'err');
          }
        }
      }, 'Guardar Nueva Clave')
    ]
  });
}

// ---------- Arranque y Seguridad ----------
window.addEventListener('error', e => {
  console.error('Error de aplicación:', e);
  toast(`Error: ${e.message || 'Ocurrió un problema inesperado'}`, 'err');
});

window.addEventListener('unhandledrejection', e => {
  console.error('Promesa no controlada:', e.reason);
  toast(`Error: ${e.reason?.message || e.reason || 'Fallo de red o sincronización'}`, 'err');
});

async function boot() {
  try {
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
  } catch (err) {
    console.error('Error durante arranque:', err);
    toast(`Error al inicializar la app: ${err.message}`, 'err');
  }
}

boot();
