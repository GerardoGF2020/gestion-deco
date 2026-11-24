// Módulo de Administración, Gestión de Usuarios y Bandeja de Aprobaciones
// Inspirado en el diseño del Mercado Inmobiliario (Tasaciones Pro) con integración a WhatsApp.

import * as store from '../core/store.js';
import * as auth from '../core/auth.js';
import { h, toast, confirmDialog, fmtDate, money, field, openModal, pedirAutorizacionConClave } from '../core/ui.js';
import { hoy, num, totalVenta, pagadoVenta, margenVenta, totalCompra, pagadoCompra, stockMap, csvDownload } from '../core/inventario.js';

const PUBLIC_APP_URL = 'https://is.gd/gestiondeco';
const getAppUrl = () => {
  if (location.origin.includes('github.io')) {
    return 'https://is.gd/gestiondeco';
  }
  return PUBLIC_APP_URL;
};

const ROLES_INFO = {
  admin:          { label: '👑 Administrador', cls: 'purple' },
  operador_total: { label: '⭐ Todos los roles (Excepto Admin)', cls: 'blue' },
  vendedor:       { label: '💰 Vendedor', cls: 'blue' },
  deposito:       { label: '📦 Depósito', cls: 'amber' },
  compras:        { label: '🛒 Compras', cls: 'green' },
  lectura:        { label: '📄 Solo lectura', cls: 'gray' },
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
    let subtab = 'resumen'; // 'resumen' | 'caja' | 'solicitudes' | 'usuarios' | 'alta'

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
            href: waLink('', `¡Hola! Te comparto la aplicación de Gestión Deco para que puedas ingresar desde tu celular o computadora:\n🔗 ${getAppUrl()}\n(Regístrate tocando "Solicitar Registro" para que te habilite tu cuenta).`)
          }, '📱 Compartir App por WhatsApp')
        )
      );

      // Selector de Subtabs
      const tabNav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap;' },
        h('button', { class: `btn ${subtab === 'resumen' ? 'primary' : ''}`, onclick: () => { subtab = 'resumen'; render(); } }, '📊 Resumen'),
        h('button', { class: `btn ${subtab === 'caja' ? 'primary' : ''}`, onclick: () => { subtab = 'caja'; render(); } }, '💵 Caja y gastos'),
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
        }, '➕ Dar de Alta Directo'),
        h('button', {
          class: `btn ${subtab === 'copias' ? 'primary' : ''}`,
          onclick: () => { subtab = 'copias'; render(); }
        }, '☁️ Copias Drive'),
        h('button', {
          class: `btn ${subtab === 'auditoria' ? 'primary' : ''}`,
          onclick: () => { subtab = 'auditoria'; render(); }
        }, `📜 Auditoría (${store.list('auditoria').length})`)
      );

      container.append(banner, tabNav);

      if (subtab === 'resumen') {
        renderResumen(container);
      } else if (subtab === 'caja') {
        renderCaja(container);
      } else if (subtab === 'solicitudes') {
        renderSolicitudes(container, pendientes);
      } else if (subtab === 'usuarios') {
        renderUsuarios(container, activos);
      } else if (subtab === 'alta') {
        renderAltaDirecta(container);
      } else if (subtab === 'copias') {
        renderCopiasDrive(container);
      } else if (subtab === 'auditoria') {
        renderAuditoria(container);
      }
    }

    // ---------- DASHBOARD ----------
    function renderResumen(parent) {
      const mes = hoy().slice(0, 7);
      const ventas = store.list('ventas').filter(v => v.estado !== 'cancelado' && v.estado !== 'presupuesto');
      const delMes = ventas.filter(v => String(v.fecha).startsWith(mes));
      const compras = store.list('compras').filter(c => c.estado !== 'cancelada');
      const sm = stockMap();
      const prods = store.list('productos');
      const valorStock = prods.reduce((a, p) => a + Math.max(0, sm.get(p.id) || 0) * (p.costo || 0), 0);
      const bajos = prods.filter(p => (p.stockMin || 0) > 0 && (sm.get(p.id) || 0) <= p.stockMin);
      const porCobrar = ventas.reduce((a, v) => a + Math.max(0, totalVenta(v) - pagadoVenta(v)), 0);
      const deuda = compras.reduce((a, c) => a + Math.max(0, totalCompra(c) - pagadoCompra(c)), 0);
      const top = new Map();
      ventas.forEach(v => v.items.forEach(i => top.set(i.descripcion, (top.get(i.descripcion) || 0) + i.cantidad)));
      const topList = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const kpi = (l, v, color) => h('div', { class: 'card' }, h('div', { class: 'muted' }, l), h('h2', { style: `margin:4px 0 0;${color ? 'color:' + color : ''}` }, v));

      const card = h('div', { class: 'stack', style: 'max-width:none' },
        h('div', { class: 'grid' },
          kpi('Ventas del mes', money(delMes.reduce((a, v) => a + totalVenta(v), 0))),
          kpi('Margen del mes', money(delMes.reduce((a, v) => a + margenVenta(v), 0)), '#2e7d4f'),
          kpi('Por cobrar a clientes', money(porCobrar), porCobrar ? '#b7791f' : ''),
          kpi('Deuda con proveedores', money(deuda), deuda ? '#c0392b' : ''),
          kpi('Valor del stock (costo)', money(valorStock)),
          kpi('Productos bajo mínimo', String(bajos.length), bajos.length ? '#c0392b' : '')),
        h('div', { class: 'card' }, h('h3', {}, '🏆 Más vendidos'),
          topList.length ? topList.map(([n, q]) => h('div', { class: 'row purchase' }, h('span', {}, n), h('strong', {}, `${q} u.`))) : h('p', { class: 'muted' }, 'Aún no hay ventas confirmadas.')),
        bajos.length ? h('div', { class: 'card' }, h('h3', {}, '⚠️ Reponer'), bajos.map(p => h('div', { class: 'row purchase' }, h('span', {}, p.nombre), h('strong', {}, `${sm.get(p.id) || 0} / mín. ${p.stockMin}`)))) : null,
        h('div', { class: 'card' }, h('h3', {}, '📥 Exportar reportes (Excel / CSV)'),
          h('div', { class: 'actions wrap' },
            h('button', { class: 'btn', onclick: () => csvDownload('ventas.csv', [['N°', 'Fecha', 'Cliente', 'Canal', 'Estado', 'Total', 'Cobrado', 'Margen'], ...store.list('ventas').map(v => [v.numero, v.fecha, store.get('clientes', v.clienteId)?.nombre || 'Consumidor final', v.canal, v.estado, totalVenta(v), pagadoVenta(v), margenVenta(v)])]) }, 'Ventas'),
            h('button', { class: 'btn', onclick: () => csvDownload('compras.csv', [['Nota', 'Fecha', 'Proveedor', 'Estado', 'Total', 'Pagado'], ...store.list('compras').map(c => [c.notaPedido, c.fecha, store.get('proveedores', c.proveedorId)?.nombre, c.estado, totalCompra(c), pagadoCompra(c)])]) }, 'Compras'),
            h('button', { class: 'btn', onclick: () => csvDownload('stock.csv', [['SKU', 'Producto', 'Stock', 'Costo', 'Precio'], ...prods.map(p => [p.sku, p.nombre, sm.get(p.id) || 0, p.costo, p.precio])]) }, 'Stock'))));
      parent.append(card);
    }

    // ---------- CAJA Y GASTOS ----------
    function renderCaja(parent) {
      const movs = [];
      store.list('ventas').forEach(v => (v.pagos || []).forEach(p => movs.push({ fecha: p.fecha, tipo: 'in', txt: `Cobro venta #${v.numero} (${p.medio})`, monto: p.monto })));
      store.list('compras').forEach(c => (c.pagos || []).forEach(p => movs.push({ fecha: p.fecha, tipo: 'out', txt: `Pago a ${store.get('proveedores', c.proveedorId)?.nombre || 'proveedor'} (${p.medio})`, monto: p.monto })));
      store.list('gastos').forEach(g => movs.push({ fecha: g.fecha, tipo: 'out', txt: `Gasto: ${g.concepto}${g.categoria ? ' · ' + g.categoria : ''}`, monto: g.monto, gastoId: g.id }));
      movs.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const ing = movs.filter(x => x.tipo === 'in').reduce((a, x) => a + x.monto, 0);
      const egr = movs.filter(x => x.tipo === 'out').reduce((a, x) => a + x.monto, 0);

      const addGasto = () => {
        const concepto = h('input', { placeholder: 'Ej: Flete, embalaje, publicidad' });
        const cat = h('input', { placeholder: 'Categoría (opcional)' });
        const monto = h('input', { type: 'number', min: 0, step: '0.01' });
        const fecha = h('input', { type: 'date', value: hoy() });
        const mo = openModal({
          title: 'Registrar gasto',
          body: h('div', {}, field('Concepto', concepto), field('Categoría', cat), field('Monto ($)', monto), field('Fecha', fecha)),
          footer: [h('button', { class: 'btn', onclick: () => mo.close() }, 'Cancelar'),
            h('button', { class: 'btn primary', onclick: () => {
              if (!concepto.value.trim() || num(monto.value) <= 0) { toast('Completá concepto y monto', 'err'); return; }
              store.put('gastos', { concepto: concepto.value.trim(), categoria: cat.value.trim(), monto: num(monto.value), fecha: fecha.value });
              mo.close(); toast('Gasto registrado'); render();
            } }, 'Guardar')],
        });
      };

      parent.append(h('div', { class: 'stack', style: 'max-width:none' },
        h('div', { class: 'grid' },
          h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Ingresos (cobros)'), h('h2', { style: 'margin:4px 0 0;color:#2e7d4f' }, money(ing))),
          h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Egresos (pagos y gastos)'), h('h2', { style: 'margin:4px 0 0;color:#c0392b' }, money(egr))),
          h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Saldo de caja'), h('h2', { style: 'margin:4px 0 0' }, money(ing - egr)))),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', {}, 'Movimientos'), h('button', { class: 'btn primary small', onclick: addGasto }, '+ Gasto')),
          movs.length ? movs.map(x => h('div', { class: 'row purchase' },
            h('span', {}, `${fmtDate(x.fecha)} · ${x.txt}`),
            h('span', { class: 'actions' }, h('strong', { style: x.tipo === 'in' ? 'color:#2e7d4f' : 'color:#c0392b' }, (x.tipo === 'in' ? '+' : '-') + money(x.monto)),
              x.gastoId ? h('button', { class: 'icon-btn', title: 'Eliminar gasto', onclick: async () => { if (await confirmDialog('¿Eliminar este gasto?', 'Eliminar')) { store.remove('gastos', x.gastoId); render(); } } }, '🗑️') : null)))
            : h('p', { class: 'muted' }, 'Todavía no hay movimientos de caja.'))));
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
          h('option', { value: 'operador_total', selected: u.rol === 'operador_total' }, '⭐ Todos los roles (Excepto Admin)'),
          h('option', { value: 'vendedor', selected: u.rol === 'vendedor' }, '💰 Vendedor'),
          h('option', { value: 'deposito', selected: u.rol === 'deposito' }, '📦 Depósito'),
          h('option', { value: 'compras', selected: u.rol === 'compras' }, '🛒 Compras'),
          h('option', { value: 'lectura', selected: u.rol === 'lectura' }, '📄 Solo lectura'),
          h('option', { value: 'admin', selected: u.rol === 'admin' }, '👑 Administrador')
        );

        const btnAprobarTodos = h('button', {
          class: 'btn small',
          style: 'background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; font-weight: 700;',
          title: 'Habilitar acceso total a Ventas, Compras, Stock, Caja y Anulación (sin ser Administrador)',
          onclick: () => {
            auth.autorizarUsuario(u.id, 'operador_total');
            toast(`¡${u.nombre} autorizado con TODOS LOS ROLES (excepto admin)!`);
            render();
          }
        }, '⭐ Dar todos los roles');

        const btnAutorizar = h('button', {
          class: 'btn primary small',
          style: 'background: #16a34a; border-color: #16a34a; color: white;',
          onclick: () => {
            auth.autorizarUsuario(u.id, rolSelect.value);
            toast(`Usuario ${u.nombre} autorizado con éxito.`);
            render();
          }
        }, '🟢 Autorizar');

        const msgWA = `¡Hola ${u.nombre}! Tu cuenta en Gestión Deco ha sido autorizada con éxito con el rol de ${rolSelect.value === 'operador_total' ? 'Todos los roles' : rolSelect.value}.\nYa puedes ingresar con tu correo y contraseña en:\n🔗 ${getAppUrl()}`;
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
                btnAprobarTodos, btnAutorizar, btnWA, btnRechazar))
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
          h('option', { value: 'operador_total', selected: u.rol === 'operador_total' }, '⭐ Todos los roles (Excepto Admin)'),
          h('option', { value: 'vendedor', selected: u.rol === 'vendedor' }, '💰 Vendedor'),
          h('option', { value: 'deposito', selected: u.rol === 'deposito' }, '📦 Depósito'),
          h('option', { value: 'compras', selected: u.rol === 'compras' }, '🛒 Compras'),
          h('option', { value: 'lectura', selected: u.rol === 'lectura' }, '📄 Solo lectura')
        );

        const msgWA = `¡Hola ${u.nombre}! Te recordamos el acceso al sistema de Gestión Deco:\n🔗 ${getAppUrl()}\nTu usuario es: ${u.username}`;
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
                btnPermisos, btnWA, btnReset, btnBorrar))
          )
        );
      });

      table.append(tbody);
      tableWrap.append(table);
      card.append(tableWrap);
      parent.append(card);
    }

    // Modal de Permisos Granulares y Autoservicio
    function abrirModalPermisos(u) {
      const perms = auth.permisosEfectivos(u);

      const makeSelect = (val, opts) => {
        const sel = h('select', { style: 'padding:6px; font-size:0.85rem;' });
        opts.forEach(([v, l]) => sel.append(h('option', { value: v, selected: Number(val) === Number(v) }, l)));
        return sel;
      };

      const selVentas = makeSelect(perms.ventas ?? 0, [[0, '0 - Sin acceso'], [1, '1 - Solo ver ventas'], [2, '2 - Cargar y cobrar ventas']]);
      const selCompras = makeSelect(perms.compras ?? 0, [[0, '0 - Sin acceso'], [1, '1 - Solo ver compras'], [2, '2 - Cargar compras y recibir']]);
      const selStock = makeSelect(perms.stock ?? 0, [[0, '0 - Sin acceso'], [1, '1 - Solo ver stock'], [2, '2 - Ajustar inventario']]);
      const selCatalogo = makeSelect(perms.catalogo ?? 0, [[0, '0 - Sin acceso'], [1, '1 - Solo ver catálogo'], [2, '2 - Editar proveedores']]);
      const selCostos = makeSelect(perms.costos ?? 0, [[0, 'Ocultos (no ve márgenes ni costos)'], [2, 'Visibles']]);
      const selAnular = makeSelect(perms.anular ?? 0, [[0, 'No autorizado (debe pedir clave a admin)'], [2, 'Autorizado (su clave puede anular operaciones)']]);
      const selEliminar = makeSelect(perms.eliminar ?? 0, [[0, 'No'], [2, 'Sí']]);

      let codigoBox = null;
      const recBtn = h('button', {
        class: 'btn small',
        type: 'button',
        onclick: async () => {
          recBtn.disabled = true;
          recBtn.textContent = 'Generando…';
          try {
            const cod = await auth.generarCodigoRecuperacion(u.id);
            codigoBox.replaceChildren(
              h('div', { style: 'margin-top:8px; padding:8px 12px; background:#fef3c7; border:1px solid #f59e0b; border-radius:8px;' },
                h('div', { style: 'font-size:0.78rem; color:#92400e;' }, 'Código de recuperación nuevo (1 solo uso):'),
                h('div', { class: 'mono font-bold', style: 'font-size:1.1rem; color:#78350f; letter-spacing:1px;' }, cod),
                h('div', { style: 'display:flex; gap:8px; margin-top:6px;' },
                  h('a', {
                    class: 'btn wa small',
                    target: '_blank',
                    rel: 'noopener',
                    href: waLink(u.telefono, `¡Hola ${u.nombre}! Tu código de recuperación de clave para Gestión Deco es: ${cod}`)
                  }, '📲 Enviar por WhatsApp')
                )
              )
            );
          } catch (e) {
            toast(e.message, 'err');
          } finally {
            recBtn.disabled = false;
            recBtn.textContent = '🔑 Generar nuevo código de recuperación';
          }
        }
      }, '🔑 Generar nuevo código de recuperación');

      codigoBox = h('div', {}, recBtn);

      const body = h('div', { class: 'stack', style: 'gap:12px; max-height:75vh; overflow-y:auto;' },
        h('div', { style: 'background:#f8fafc; padding:10px; border-radius:8px;' },
          h('div', { style: 'font-weight:bold;' }, u.nombre),
          h('div', { class: 'mono muted', style: 'font-size:0.8rem;' }, `@${u.username} • Rol base: ${u.rol}`)
        ),
        h('h4', {}, 'Permisos granulares del usuario'),
        field('🛍️ Ventas', selVentas),
        field('📥 Compras', selCompras),
        field('📦 Stock', selStock),
        field('📒 Catálogo', selCatalogo),
        field('👁️ Ver Costos y Márgenes', selCostos),
        field('↩️ Autorizado para Anular con su Clave', selAnular, 'Permite volver atrás operaciones cargadas por error'),
        field('🗑️ Eliminar Registros', selEliminar),
        h('hr', { style: 'border:0; border-top:1px solid #e2e8f0; margin:12px 0;' }),
        h('h4', {}, 'Autoservicio de Clave'),
        h('p', { class: 'muted', style: 'margin:0; font-size:0.8rem;' }, 'El usuario puede cambiar su clave él mismo o usar su código de recuperación si la olvidó.'),
        codigoBox
      );

      const m = openModal({
        title: `🛠️ Permisos: ${u.nombre}`,
        body,
        footer: [
          h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
          h('button', {
            class: 'btn primary',
            onclick: () => {
              const nuevosPermisos = {
                ventas: Number(selVentas.value),
                compras: Number(selCompras.value),
                stock: Number(selStock.value),
                catalogo: Number(selCatalogo.value),
                costos: Number(selCostos.value),
                anular: Number(selAnular.value),
                eliminar: Number(selEliminar.value),
              };
              auth.guardarPermisos(u.id, nuevosPermisos, u.rol);
              toast('Permisos actualizados con éxito');
              m.close();
              render();
            }
          }, 'Guardar Permisos')
        ]
      });
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
        h('option', { value: 'operador_total' }, '⭐ Todos los roles (Excepto Admin)'),
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

    // ---------- VISTA: COPIAS DRIVE Y SEGURIDAD ----------
    async function renderCopiasDrive(parent) {
      const card = h('div', { class: 'stack', style: 'max-width:none' });
      parent.append(card);

      const banner = h('div', { class: 'card', style: 'border-left: 4px solid #0284c7; background: #f0f9ff;' },
        h('div', { style: 'font-weight:bold; color:#0369a1; font-size:1.05rem; margin-bottom:4px;' }, '☁️ Sincronización y Copias Seguras en Drive'),
        h('p', { class: 'muted', style: 'margin:0; font-size:0.85rem;' },
          'Tus datos se guardan en tu equipo y se replican automáticamente en la carpeta de Google Drive (Gestion_Deco/copias). ' +
          'Los datos están completamente separados de los archivos de la app: ninguna actualización o cambio en el código afectará tus registros.')
      );

      const btnCrear = h('button', {
        class: 'btn primary',
        onclick: async () => {
          btnCrear.disabled = true;
          btnCrear.textContent = 'Creando copia…';
          try {
            const res = await fetch('/api/backups', { method: 'POST' });
            if (!res.ok) throw new Error('No se pudo crear la copia en el servidor');
            const data = await res.json();
            toast(`Copia creada: ${data.name}`);
            render();
          } catch (e) {
            toast(e.message, 'err');
          } finally {
            btnCrear.disabled = false;
            btnCrear.textContent = '💾 Crear Copia Manual Ahora';
          }
        }
      }, '💾 Crear Copia Manual Ahora');

      const toolbar = h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;' },
        h('h3', {}, 'Copias de seguridad disponibles'),
        btnCrear
      );

      const tableCard = h('div', { class: 'card' });
      tableCard.append(toolbar);

      try {
        const res = await fetch('/api/backups');
        if (!res.ok) throw new Error('Servidor no disponible');
        const data = await res.json();
        const backups = data.backups || [];

        if (!backups.length) {
          tableCard.append(h('p', { class: 'muted', style: 'margin-top:12px;' }, 'Aún no hay copias registradas. Se crearán automáticamente con el uso.'));
        } else {
          const table = h('table', { style: 'width:100%; border-collapse:collapse; margin-top:12px; font-size:0.88rem;' },
            h('thead', {},
              h('tr', { style: 'background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;' },
                h('th', { style: 'padding:8px;' }, 'Archivo'),
                h('th', { style: 'padding:8px;' }, 'Tipo'),
                h('th', { style: 'padding:8px;' }, 'Fecha / Hora'),
                h('th', { style: 'padding:8px;' }, 'Tamaño'),
                h('th', { style: 'padding:8px; text-align:center;' }, 'Acción')
              )
            )
          );
          const tbody = h('tbody', {});
          backups.forEach(b => {
            const tipo = b.name.startsWith('diaria') ? 'Diaria' : b.name.startsWith('arranque') ? 'Al arrancar' : 'Manual';
            const btnRestaurar = h('button', {
              class: 'btn small danger ghost',
              title: 'Restaurar esta versión de datos',
              onclick: () => {
                pedirAutorizacionConClave({
                  titulo: 'Restaurar Copia de Seguridad',
                  detalle: `¿Restaurar los datos desde "${b.name}"? Los datos actuales se reemplazarán por los de la copia y se creará un resguardo previo.`,
                  onAutorizado: async (adminUser) => {
                    try {
                      const r = await fetch('/api/restore?name=' + encodeURIComponent(b.name), { method: 'POST' });
                      if (!r.ok) throw new Error('No se pudo restaurar la copia');
                      const restored = await r.json();
                      store.replaceState(restored);
                      store.log('Restauración de copia', `Copia: ${b.name} autorizada por ${adminUser.nombre}`);
                      toast('¡Copia restaurada con éxito!');
                      render();
                    } catch (e) {
                      toast(e.message, 'err');
                    }
                  }
                });
              }
            }, '↩️ Restaurar');

            tbody.append(
              h('tr', { style: 'border-bottom:1px solid #e2e8f0;' },
                h('td', { style: 'padding:8px;' }, h('span', { class: 'mono' }, b.name)),
                h('td', { style: 'padding:8px;' }, tipo),
                h('td', { style: 'padding:8px;' }, fmtDate(b.date)),
                h('td', { style: 'padding:8px;' }, `${Math.round(b.size / 1024)} KB`),
                h('td', { style: 'padding:8px; text-align:center;' }, btnRestaurar)
              )
            );
          });
          table.append(tbody);
          tableCard.append(table);
        }
      } catch (err) {
        tableCard.append(h('p', { class: 'muted', style: 'margin-top:12px;' }, 'Nota: El servidor local de datos no está respondiendo o se está ejecutando en modo offline. Las copias locales se mantienen en el almacenamiento del navegador.'));
      }

      card.append(banner, tableCard);
    }

    // ---------- VISTA: AUDITORÍA ----------
    function renderAuditoria(parent) {
      const logs = store.list('auditoria').slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

      const card = h('div', { class: 'card', style: 'max-width:none' },
        h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;' },
          h('div', {},
            h('h3', {}, '📜 Registro de Auditoría de Operaciones'),
            h('p', { class: 'muted', style: 'margin:0;' }, 'Historial inmutable de anulaciones, cancelaciones autorizadas con clave y restauraciones.')
          ),
          h('button', {
            class: 'btn',
            onclick: () => csvDownload('auditoria.csv', [
              ['Fecha', 'Usuario', 'Acción', 'Detalle'],
              ...logs.map(l => [l.fecha, l.usuario, l.accion, l.detalle])
            ])
          }, '📥 Exportar a Excel (CSV)')
        )
      );

      if (!logs.length) {
        card.append(h('p', { class: 'muted' }, 'No hay operaciones anuladas o eventos especiales registrados. Todo está en orden.'));
      } else {
        const tableWrap = h('div', { style: 'overflow-x:auto;' });
        const table = h('table', { style: 'width:100%; border-collapse:collapse; font-size:0.88rem;' },
          h('thead', {},
            h('tr', { style: 'background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;' },
              h('th', { style: 'padding:8px;' }, 'Fecha y Hora'),
              h('th', { style: 'padding:8px;' }, 'Usuario / Autorizado por'),
              h('th', { style: 'padding:8px;' }, 'Acción'),
              h('th', { style: 'padding:8px;' }, 'Detalle')
            )
          )
        );
        const tbody = h('tbody', {});
        logs.forEach(l => {
          tbody.append(
            h('tr', { style: 'border-bottom:1px solid #e2e8f0;' },
              h('td', { style: 'padding:8px;' }, fmtDate(l.fecha)),
              h('td', { style: 'padding:8px; font-weight:600;' }, l.usuario || '—'),
              h('td', { style: 'padding:8px;' }, h('span', { class: 'pill amber' }, l.accion)),
              h('td', { style: 'padding:8px;' }, l.detalle || '—')
            )
          );
        });
        table.append(tbody);
        tableWrap.append(table);
        card.append(tableWrap);
      }

      parent.append(card);
    }

    render();
  }
};
