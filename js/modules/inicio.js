// Módulo INICIO: Pantalla principal simplificada para personas sin experiencia.
// Presenta 4 botones grandes táctiles, interruptor de Modo Práctica y guía rápida en 3 pasos.

import * as store from '../core/store.js';
import * as auth from '../core/auth.js';
import { h, openModal, toast, confirmDialog, fmtDate, money, pedirAutorizacionConClave } from '../core/ui.js';
import { stockMap, obtenerOperacionesRecientes, deshacerVenta, deshacerCompra, deshacerGasto } from '../core/inventario.js';

function abrirGuiaRapida() {
  const body = h('div', { class: 'stack', style: 'gap:16px;' },
    h('div', { style: 'display:flex; gap:12px; align-items:flex-start;' },
      h('div', { style: 'font-size:2rem; width:44px; height:44px; border-radius:12px; background:#eff6ff; display:flex; align-items:center; justify-content:center; flex-shrink:0;' }, '1️⃣'),
      h('div', {},
        h('h3', { style: 'margin:0 0 4px 0;' }, 'Carga o revisa tu mercadería'),
        h('p', { class: 'muted', style: 'margin:0;' }, 'En "Cargar mercadería" recibes los pedidos de proveedores o agregas productos nuevos. El stock se actualiza solo.'))),
    h('div', { style: 'display:flex; gap:12px; align-items:flex-start;' },
      h('div', { style: 'font-size:2rem; width:44px; height:44px; border-radius:12px; background:#ecfdf5; display:flex; align-items:center; justify-content:center; flex-shrink:0;' }, '2️⃣'),
      h('div', {},
        h('h3', { style: 'margin:0 0 4px 0;' }, 'Vende paso a paso sin miedo'),
        h('p', { class: 'muted', style: 'margin:0;' }, 'Toca "Vender". La pantalla te guía en 4 pasos sencillos: cliente, productos, forma de pago y confirmación. Tienes botón "Atrás" y "Cancelar" en todo momento.'))),
    h('div', { style: 'display:flex; gap:12px; align-items:flex-start;' },
      h('div', { style: 'font-size:2rem; width:44px; height:44px; border-radius:12px; background:#fef3c7; display:flex; align-items:center; justify-content:center; flex-shrink:0;' }, '3️⃣'),
      h('div', {},
        h('h3', { style: 'margin:0 0 4px 0;' }, '¿Cargaste algo mal? Vuelve atrás con clave'),
        h('p', { class: 'muted', style: 'margin:0;' }, 'Si una venta se cargó equivocada, entras a su detalle y tocas "Volver atrás / Anular". Se solicita la clave autorizada y se devuelven las cantidades al stock automáticamente.'))),
    h('div', { style: 'background:#f8fafc; padding:12px; border-radius:10px; font-size:0.85rem; color:#475569; border:1px solid #e2e8f0;' },
      '💡 <strong>Tip para practicar:</strong> Puedes encender el "Modo Práctica" en la parte superior para probar botones y cargar ventas falsas sin que nada quede guardado.')
  );

  openModal({
    title: '❓ Cómo usar la aplicación en 3 pasos',
    body,
    footer: [h('button', { class: 'btn primary', onclick: (e) => { e.target.closest('.overlay').remove(); document.body.classList.remove('modal-open'); } }, 'Entendido')]
  });
}

export default {
  id: 'inicio',
  perm: null,
  label: 'Inicio',
  icon: '🏠',
  title: 'Panel Principal',
  mount(root) {
    const container = h('div', { class: 'stack', style: 'max-width:900px; margin:0 auto; gap:20px;' });
    root.append(container);

    function render() {
      container.replaceChildren();

      const cur = auth.currentUser();
      const esAdmin = cur?.rol === 'admin';
      const practica = store.isPractica();

      // 1. Saludo y barra superior de estado
      const header = h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;' },
        h('div', {},
          h('h1', { style: 'font-size:1.5rem; margin:0; font-weight:800; color:#1e293b;' }, `¡Hola, ${cur?.nombre ? cur.nombre.split(' ')[0] : 'Bienvenido'}! 👋`),
          h('p', { class: 'muted', style: 'margin:2px 0 0 0;' }, `${store.config().nombreNegocio} · ¿Qué deseas hacer hoy?`)),
        h('button', {
          class: 'btn',
          style: 'font-size:0.85rem; border-radius:99px; padding:6px 14px;',
          onclick: abrirGuiaRapida
        }, '❓ ¿Cómo se usa?')
      );

      // 2. Banner de MODO PRÁCTICA
      const bannerPractica = practica
        ? h('div', { style: 'background:#fef3c7; border:2px dashed #f59e0b; border-radius:14px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;' },
            h('div', { style: 'display:flex; align-items:center; gap:10px;' },
              h('span', { style: 'font-size:1.8rem;' }, '⚠️'),
              h('div', {},
                h('strong', { style: 'color:#92400e; font-size:0.95rem; display:block;' }, 'ESTÁS EN MODO PRÁCTICA'),
                h('span', { style: 'color:#b45309; font-size:0.82rem;' }, 'Puedes probar y registrar ventas o compras libremente. Nada de lo que hagas se guardará ni afectará a Drive.'))),
            h('button', {
              class: 'btn primary small',
              style: 'background:#b45309; border-color:#b45309; color:white;',
              onclick: () => {
                store.endPractica();
                toast('Modo práctica finalizado. Volviendo a los datos reales.');
                render();
              }
            }, 'Salir del Modo Práctica')
          )
        : h('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;' },
            h('div', { style: 'display:flex; align-items:center; gap:8px; font-size:0.85rem; color:#475569;' },
              h('span', { style: 'font-size:1.2rem;' }, '🎓'),
              h('span', {}, '¿Quieres probar o enseñar sin tocar los datos reales?')),
            h('button', {
              class: 'btn small',
              style: 'background:#fffbeb; border-color:#fde68a; color:#b45309; font-weight:700;',
              onclick: () => {
                store.startPractica();
                toast('Modo práctica activado. Nada de lo que hagas se guardará.');
                render();
              }
            }, '🟡 Activar Modo Práctica')
          );

      // 3. LOS 4 BOTONES GRANDES (Acciones Principales)
      const bigButtons = h('div', { class: 'grid', style: 'grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap:16px;' });

      // Botón 1: VENDER
      if (auth.can('ventas', 1)) {
        bigButtons.append(
          h('div', {
            class: 'card prov',
            style: 'background:#ffffff; border:2px solid #93c5fd; cursor:pointer; padding:20px; border-radius:18px; box-shadow:0 4px 14px rgba(37,99,235,0.08); transition:all 0.15s ease;',
            tabindex: 0,
            onclick: () => { location.hash = '#/ventas'; setTimeout(() => document.getElementById('btnNuevaVentaVisual')?.click(), 100); }
          },
            h('div', { style: 'display:flex; align-items:center; gap:14px;' },
              h('div', { style: 'width:60px; height:60px; border-radius:16px; background:#eff6ff; display:flex; align-items:center; justify-content:center; font-size:2.2rem; flex-shrink:0;' }, '🛍️'),
              h('div', {},
                h('h2', { style: 'margin:0; font-size:1.25rem; font-weight:800; color:#1e40af;' }, 'VENDER'),
                h('p', { class: 'muted', style: 'margin:3px 0 0 0; font-size:0.85rem; line-height:1.3;' }, 'Cargar pedido paso a paso con cliente, productos y cobro.'))),
            h('div', { style: 'margin-top:14px; text-align:right;' },
              h('span', { class: 'btn primary small', style: 'border-radius:99px;' }, 'Comenzar venta →'))
          )
        );
      }

      // Botón 2: CARGAR MERCADERÍA (Compras/Recepción)
      if (auth.can('compras', 1)) {
        bigButtons.append(
          h('div', {
            class: 'card prov',
            style: 'background:#ffffff; border:2px solid #a7f3d0; cursor:pointer; padding:20px; border-radius:18px; box-shadow:0 4px 14px rgba(16,185,129,0.08); transition:all 0.15s ease;',
            tabindex: 0,
            onclick: () => { location.hash = '#/compras'; }
          },
            h('div', { style: 'display:flex; align-items:center; gap:14px;' },
              h('div', { style: 'width:60px; height:60px; border-radius:16px; background:#ecfdf5; display:flex; align-items:center; justify-content:center; font-size:2.2rem; flex-shrink:0;' }, '📥'),
              h('div', {},
                h('h2', { style: 'margin:0; font-size:1.25rem; font-weight:800; color:#065f46;' }, 'CARGAR MERCADERÍA'),
                h('p', { class: 'muted', style: 'margin:3px 0 0 0; font-size:0.85rem; line-height:1.3;' }, 'Recibir pedidos de proveedores y sumar existencias al stock.'))),
            h('div', { style: 'margin-top:14px; text-align:right;' },
              h('span', { class: 'btn small', style: 'border-radius:99px; background:#ecfdf5; color:#065f46; font-weight:700;' }, 'Abrir compras →'))
          )
        );
      }

      // Botón 3: VER STOCK
      if (auth.can('stock', 1)) {
        const sm = stockMap();
        const prods = store.list('productos');
        const bajos = prods.filter(p => (p.stockMin || 0) > 0 && (sm.get(p.id) || 0) <= p.stockMin).length;

        bigButtons.append(
          h('div', {
            class: 'card prov',
            style: 'background:#ffffff; border:2px solid #fed7aa; cursor:pointer; padding:20px; border-radius:18px; box-shadow:0 4px 14px rgba(249,115,22,0.08); transition:all 0.15s ease;',
            tabindex: 0,
            onclick: () => { location.hash = '#/stock'; }
          },
            h('div', { style: 'display:flex; align-items:center; gap:14px;' },
              h('div', { style: 'width:60px; height:60px; border-radius:16px; background:#fff7ed; display:flex; align-items:center; justify-content:center; font-size:2.2rem; flex-shrink:0;' }, '📦'),
              h('div', {},
                h('h2', { style: 'margin:0; font-size:1.25rem; font-weight:800; color:#9a3412;' }, 'VER STOCK'),
                h('p', { class: 'muted', style: 'margin:3px 0 0 0; font-size:0.85rem; line-height:1.3;' }, 'Consultar cantidades, precios y productos por agotar.'))),
            h('div', { style: 'margin-top:14px; display:flex; justify-content:space-between; align-items:center;' },
              bajos ? h('span', { class: 'pill red' }, `⚠️ ${bajos} por reponer`) : h('span', { class: 'pill green' }, 'Stock en orden'),
              h('span', { class: 'btn small', style: 'border-radius:99px; background:#fff7ed; color:#9a3412; font-weight:700;' }, 'Ver productos →'))
          )
        );
      }

      // Botón 4: COBROS Y CAJA
      if (auth.can('ventas', 1) || auth.can('admin', 1)) {
        bigButtons.append(
          h('div', {
            class: 'card prov',
            style: 'background:#ffffff; border:2px solid #ddd6fe; cursor:pointer; padding:20px; border-radius:18px; box-shadow:0 4px 14px rgba(124,58,237,0.08); transition:all 0.15s ease;',
            tabindex: 0,
            onclick: () => {
              if (auth.can('admin', 1)) {
                location.hash = '#/admin';
                setTimeout(() => {
                  const b = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Caja'));
                  b?.click();
                }, 100);
              } else {
                location.hash = '#/ventas';
              }
            }
          },
            h('div', { style: 'display:flex; align-items:center; gap:14px;' },
              h('div', { style: 'width:60px; height:60px; border-radius:16px; background:#f5f3ff; display:flex; align-items:center; justify-content:center; font-size:2.2rem; flex-shrink:0;' }, '💵'),
              h('div', {},
                h('h2', { style: 'margin:0; font-size:1.25rem; font-weight:800; color:#5b21b6;' }, 'COBROS Y CAJA'),
                h('p', { class: 'muted', style: 'margin:3px 0 0 0; font-size:0.85rem; line-height:1.3;' }, 'Registrar cobranzas a clientes, gastos diarios y balance.'))),
            h('div', { style: 'margin-top:14px; text-align:right;' },
              h('span', { class: 'btn small', style: 'border-radius:99px; background:#f5f3ff; color:#5b21b6; font-weight:700;' }, 'Abrir caja →'))
          )
        );
      }

      // 4. SECCIÓN VISUAL: DESHACER / VOLVER ATRÁS OPERACIONES (Para personas sin experiencia)
      const recientes = obtenerOperacionesRecientes(8);

      function ejecutarDeshacer(op) {
        pedirAutorizacionConClave({
          titulo: `Deshacer ${op.tipoLabel}`,
          detalle: `¿Anular "${op.titulo}" por ${money(op.monto)}? Esta acción cancela la operación y repondrá el inventario automáticamente.`,
          onAutorizado: (autorizante) => {
            if (op.tipo === 'venta') deshacerVenta(op.id, autorizante);
            else if (op.tipo === 'compra') deshacerCompra(op.id, autorizante);
            else deshacerGasto(op.id, autorizante);
            toast(`✅ Operación "${op.titulo}" anulada y stock restablecido.`);
            render();
          }
        });
      }

      function abrirModalDeshacerVarias() {
        const todas = obtenerOperacionesRecientes(15);
        if (!todas.length) {
          toast('No hay operaciones recientes para anular.', 'warn');
          return;
        }

        const seleccionadas = new Set();
        const listaEl = h('div', { class: 'stack', style: 'gap:8px; max-height:60vh; overflow-y:auto;' });

        const btnConfirmarLote = h('button', {
          class: 'btn danger',
          disabled: true,
          onclick: () => {
            if (!seleccionadas.size) return;
            m.close();
            pedirAutorizacionConClave({
              titulo: `Deshacer ${seleccionadas.size} operaciones`,
              detalle: `Se anularán ${seleccionadas.size} operaciones seleccionadas y se devolverá todo el stock al inventario.`,
              onAutorizado: (autorizante) => {
                let count = 0;
                seleccionadas.forEach(id => {
                  const target = todas.find(x => x.id === id);
                  if (target) {
                    if (target.tipo === 'venta') deshacerVenta(target.id, autorizante);
                    else if (target.tipo === 'compra') deshacerCompra(target.id, autorizante);
                    else deshacerGasto(target.id, autorizante);
                    count++;
                  }
                });
                toast(`✅ Se anularon ${count} operaciones con éxito y se recuperó el stock.`);
                render();
              }
            });
          }
        }, `↩️ Deshacer seleccionadas (0)`);

        function renderListaLote() {
          listaEl.replaceChildren();
          todas.forEach(op => {
            const chk = h('input', {
              type: 'checkbox',
              style: 'width:20px; height:20px; cursor:pointer;',
              checked: seleccionadas.has(op.id),
              onchange: (e) => {
                if (e.target.checked) seleccionadas.add(op.id);
                else seleccionadas.delete(op.id);
                btnConfirmarLote.disabled = seleccionadas.size === 0;
                btnConfirmarLote.textContent = `↩️ Deshacer seleccionadas (${seleccionadas.size})`;
              }
            });

            listaEl.append(
              h('label', {
                style: 'display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; background:#fff;',
                onmouseover: e => e.currentTarget.style.background = '#f8fafc',
                onmouseout: e => e.currentTarget.style.background = '#fff'
              },
                chk,
                h('div', { style: 'font-size:1.4rem;' }, op.icon),
                h('div', { style: 'flex:1; min-width:0;' },
                  h('div', { style: 'font-weight:700; font-size:0.9rem;' }, op.titulo),
                  h('div', { class: 'muted', style: 'font-size:0.78rem;' }, `${op.detalle} • ${fmtDate(op.fecha)}`)),
                h('strong', { style: 'font-size:0.95rem; color:#1e293b;' }, money(op.monto))
              )
            );
          });
        }

        renderListaLote();

        const m = openModal({
          title: '☑️ Deshacer varias operaciones a la vez',
          body: h('div', { class: 'stack', style: 'gap:12px;' },
            h('p', { class: 'muted', style: 'margin:0; font-size:0.85rem;' },
              'Selecciona las operaciones que cargaste por error o de prueba para anularlas todas juntas de una sola vez.'),
            listaEl
          ),
          footer: [
            h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
            btnConfirmarLote
          ]
        });
      }

      const seccionDeshacer = h('div', {
        class: 'card',
        style: 'background:#fffdfa; border:1px solid #fed7aa; border-radius:16px; padding:18px;'
      },
        h('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;' },
          h('div', {},
            h('h3', { style: 'color:#9a3412; margin:0 0 2px 0; display:flex; align-items:center; gap:8px;' },
              h('span', {}, '↩️'), h('span', {}, '¿Te equivocaste al cargar? Vuelve atrás')),
            h('p', { class: 'muted', style: 'margin:0; font-size:0.83rem;' },
              'Anula una o varias operaciones erróneas. El stock se repone automáticamente y queda todo asentado en auditoría.')),
          h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' },
            recientes.length ? h('button', {
              class: 'btn small',
              style: 'background:#ffedd5; border-color:#fed7aa; color:#9a3412; font-weight:700;',
              onclick: () => ejecutarDeshacer(recientes[0])
            }, '↩️ Deshacer última operación') : null,
            recientes.length > 1 ? h('button', {
              class: 'btn small',
              style: 'background:#fff; border-color:#cbd5e1; font-weight:600;',
              onclick: abrirModalDeshacerVarias
            }, '☑️ Deshacer varias…') : null
          )
        )
      );

      if (recientes.length) {
        const miniLista = h('div', { class: 'stack', style: 'gap:8px;' });
        recientes.slice(0, 4).forEach(op => {
          miniLista.append(
            h('div', {
              style: 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#fff; border:1px solid #f1f5f9; border-radius:10px; flex-wrap:wrap; gap:8px;'
            },
              h('div', { style: 'display:flex; align-items:center; gap:10px; min-width:0; flex:1;' },
                h('span', { style: 'font-size:1.3rem;' }, op.icon),
                h('div', { style: 'min-width:0;' },
                  h('div', { style: 'font-weight:700; font-size:0.88rem; color:#1e293b;' }, op.titulo),
                  h('div', { class: 'muted', style: 'font-size:0.75rem;' }, `${fmtDate(op.fecha)} · ${op.detalle}`))),
              h('div', { style: 'display:flex; align-items:center; gap:12px;' },
                h('strong', { style: 'font-size:0.9rem;' }, money(op.monto)),
                h('button', {
                  class: 'btn small danger ghost',
                  title: 'Anular esta operación y reponer stock',
                  onclick: () => ejecutarDeshacer(op)
                }, '↩️ Deshacer')
              )
            )
          );
        });
        seccionDeshacer.append(miniLista);
      } else {
        seccionDeshacer.append(h('p', { class: 'muted', style: 'margin:0; font-size:0.82rem;' }, 'No hay operaciones recientes registradas para anular. Todo tu historial está en orden.'));
      }

      // 5. Accesos directos secundarios
      const otros = h('div', { class: 'card', style: 'background:#f8fafc; border-radius:14px;' },
        h('div', { style: 'font-weight:700; font-size:0.85rem; color:#475569; margin-bottom:10px;' }, 'Otras secciones del sistema:'),
        h('div', { style: 'display:flex; gap:10px; flex-wrap:wrap;' },
          h('a', { href: '#/catalogo', class: 'btn' }, '📖 Catálogo de Proveedores'),
          esAdmin ? h('a', { href: '#/admin', class: 'btn' }, '⚙️ Administración y Usuarios') : null,
          h('a', { href: '#/ajustes', class: 'btn' }, '🔧 Ajustes y Google Drive')
        )
      );

      container.append(header, bannerPractica, bigButtons, seccionDeshacer, otros);
    }

    render();
    return store.onChange(() => render());
  }
};
