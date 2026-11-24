// Módulo VENTAS: presupuestos y pedidos (tienda online, WhatsApp, Instagram), cobros, envíos,
// margen por venta y comprobante según la condición fiscal vigente. Incluye cartera de clientes.

import * as store from '../core/store.js';
import { h, openModal, toast, confirmDialog, money, fmtDate, field, pedirAutorizacionConClave } from '../core/ui.js';
import { can, currentUser } from '../core/auth.js';
import { hoy, num, norm, stockMap, mover, totalVenta, totalItemsVenta, pagadoVenta, margenVenta, waLink } from '../core/inventario.js';

const ESTADOS = {
  presupuesto: { label: 'Presupuesto', cls: 'gray' },
  pedido: { label: 'Pedido', cls: 'blue' },
  enviado: { label: 'Enviado', cls: 'amber' },
  entregado: { label: 'Entregado', cls: 'green' },
  cancelado: { label: 'Cancelado', cls: 'red' },
};
const CANALES = ['Tienda online', 'WhatsApp', 'Instagram', 'Local / presencial', 'Otro'];
const MEDIOS = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Otro'];
const COMPROBANTE = { monotributo: 'Factura C', responsable_inscripto: 'Factura A / B', exento: 'Factura B' };
const view = { tab: 'ventas', q: '', estado: '', qc: '' };

const cliente = id => store.get('clientes', id);
const clienteNombre = id => cliente(id)?.nombre || 'Consumidor final';
const pill = e => h('span', { class: 'pill ' + (ESTADOS[e]?.cls || 'gray') }, ESTADOS[e]?.label || e);
const consumeStock = e => e === 'pedido' || e === 'enviado' || e === 'entregado';

function nextNumero() {
  const n = store.list('ventas').map(v => v.numero || 0);
  return (n.length ? Math.max(...n) : 0) + 1;
}

// Sincroniza el stock con el estado de la venta (descuenta al confirmar, repone al cancelar).
function aplicarStock(v, nuevoEstado) {
  const debe = consumeStock(nuevoEstado);
  if (debe && !v.stockDescontado) {
    v.items.forEach(i => i.productoId && mover({ productoId: i.productoId, tipo: 'egreso', cantidad: -i.cantidad, ref: v.id, nota: `Venta #${v.numero}` }));
    v.stockDescontado = true;
  } else if (!debe && v.stockDescontado) {
    v.items.forEach(i => i.productoId && mover({ productoId: i.productoId, tipo: 'ingreso', cantidad: i.cantidad, ref: v.id, nota: `Anulación venta #${v.numero}` }));
    v.stockDescontado = false;
  }
}

function cambiarEstado(id, estado) {
  const v = structuredClone(store.get('ventas', id));
  aplicarStock(v, estado);
  v.estado = estado;
  store.put('ventas', v);
  toast(`Venta #${v.numero}: ${ESTADOS[estado].label}`);
}

function resumenTexto(v) {
  const fis = COMPROBANTE[store.config().fiscal.condicion] || '';
  return [`*${store.config().nombreNegocio}* — ${ESTADOS[v.estado].label} #${v.numero}`, `Fecha: ${fmtDate(v.fecha)}`, '',
    ...v.items.map(i => `• ${i.cantidad} × ${i.descripcion} — ${money(i.cantidad * i.precio)}`), '',
    v.descuento ? `Descuento: -${money(v.descuento)}` : null, v.envio ? `Envío: ${money(v.envio)}` : null,
    `*Total: ${money(totalVenta(v))}*`, `Pagado: ${money(pagadoVenta(v))}`, `Saldo: ${money(totalVenta(v) - pagadoVenta(v))}`,
    fis ? `\nComprobante: ${fis}` : null].filter(x => x !== null).join('\n');
}

// ---------- Cobro ----------
function openCobro(id) {
  const v = store.get('ventas', id);
  const saldo = Math.max(0, totalVenta(v) - pagadoVenta(v));
  const monto = h('input', { type: 'number', min: 0, step: '0.01', value: saldo.toFixed(2) });
  const medio = h('select', {}, MEDIOS.map(x => h('option', { value: x }, x)));
  const m = openModal({
    title: 'Registrar cobro',
    body: h('div', {}, h('p', { class: 'muted' }, `Saldo a cobrar: ${money(saldo)}`), field('Monto', monto), field('Medio de pago', medio)),
    footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        const x = num(monto.value);
        if (x <= 0) { toast('Monto inválido', 'err'); return; }
        const cur = structuredClone(store.get('ventas', id));
        cur.pagos = [...(cur.pagos || []), { fecha: hoy(), monto: x, medio: medio.value }];
        store.put('ventas', cur); toast('Cobro registrado'); m.close();
      } }, 'Guardar cobro')],
  });
}

// ---------- Detalle ----------
function openDetail(id) {
  const v = store.get('ventas', id);
  if (!v) return;
  const editable = can('ventas', 2);
  const total = totalVenta(v), pagado = pagadoVenta(v), saldo = total - pagado;
  const c = cliente(v.clienteId);
  const acciones = [];
  if (editable) {
    if (v.estado === 'presupuesto') acciones.push(h('button', { class: 'btn primary', onclick: () => { m.close(); confirmarPedido(id); } }, '✅ Confirmar pedido'));
    if (v.estado === 'pedido') acciones.push(h('button', { class: 'btn primary', onclick: () => { cambiarEstado(id, 'enviado'); m.close(); } }, '🚚 Marcar enviado'));
    if (v.estado === 'enviado') acciones.push(h('button', { class: 'btn primary', onclick: () => { cambiarEstado(id, 'entregado'); m.close(); } }, '🎁 Marcar entregado'));
    if (v.estado !== 'cancelado' && saldo > 0.5) acciones.push(h('button', { class: 'btn', onclick: () => { m.close(); openCobro(id); } }, '💵 Registrar cobro'));
    if (v.estado !== 'cancelado') acciones.push(h('button', { class: 'btn danger ghost', onclick: () => {
      m.close();
      pedirAutorizacionConClave({
        titulo: `Anular Venta #${v.numero}`,
        detalle: `Se anulará la Venta #${v.numero} (${clienteNombre(v.clienteId)} por ${money(totalVenta(v))}) y se devolverá el stock al inventario.`,
        onAutorizado: (autorizante) => {
          cambiarEstado(id, 'cancelado');
          store.log('ANULAR_VENTA', `Venta #${v.numero} anulada por ${autorizante.nombre} (${autorizante.rol})`);
          toast(`Venta #${v.numero} anulada con éxito y stock repuesto.`);
        }
      });
    } }, '↩️ Volver atrás / Anular venta'));
  }
  const m = openModal({
    title: `Venta #${v.numero}`, wide: true,
    body: h('div', {},
      h('div', { class: 'row' }, pill(v.estado), h('span', { class: 'muted' }, `${clienteNombre(v.clienteId)} · ${v.canal} · ${fmtDate(v.fecha)}`)),
      h('h4', {}, 'Productos'),
      v.items.map(i => h('div', { class: 'row purchase' }, h('span', {}, `${i.cantidad} × ${i.descripcion} (${money(i.precio)})`), h('strong', {}, money(i.cantidad * i.precio)))),
      v.descuento ? h('div', { class: 'row purchase' }, h('span', {}, 'Descuento'), h('strong', {}, '-' + money(v.descuento))) : null,
      v.envio ? h('div', { class: 'row purchase' }, h('span', {}, 'Envío'), h('strong', {}, money(v.envio))) : null,
      h('dl', { class: 'info' },
        h('dt', {}, 'Total'), h('dd', {}, h('strong', {}, money(total))),
        h('dt', {}, 'Cobrado'), h('dd', {}, money(pagado)),
        h('dt', {}, 'Saldo'), h('dd', {}, h('strong', { style: saldo > 0.5 ? 'color:#c0392b' : 'color:#2e7d4f' }, money(saldo))),
        h('dt', {}, 'Margen'), h('dd', {}, money(margenVenta(v))),
        h('dt', {}, 'Comprobante'), h('dd', {}, COMPROBANTE[store.config().fiscal.condicion] || '—')),
      (v.pagos || []).map(p => h('div', { class: 'row' }, h('span', {}, `${fmtDate(p.fecha)} · ${p.medio}`), h('strong', {}, money(p.monto)))),
      v.notas ? [h('h4', {}, 'Notas'), h('p', {}, v.notas)] : null),
    footer: [
      h('a', { class: 'btn wa', target: '_blank', rel: 'noopener', href: waLink(c?.telefono || '', resumenTexto(v)) }, '📲 Enviar por WhatsApp'),
      h('button', { class: 'btn', onclick: () => window.print() }, '🖨️ Imprimir'),
      ...acciones,
    ],
  });
}

async function confirmarPedido(id) {
  const v = store.get('ventas', id);
  const sm = stockMap();
  const faltan = v.items.filter(i => i.productoId && (sm.get(i.productoId) || 0) < i.cantidad);
  if (faltan.length && !(await confirmDialog(`Stock insuficiente de: ${faltan.map(i => i.descripcion).join(', ')}. ¿Confirmar igual?`, 'Confirmar igual'))) return;
  cambiarEstado(id, 'pedido');
}

// ---------- Asistente Visual de Venta Paso a Paso (Wizard) ----------
// Cada paso tiene botón Atrás y Cancelar. NADA se guarda hasta la confirmación final.
function openWizardVenta() {
  const prods = store.list('productos').filter(p => p.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const sm = stockMap();
  const clientes = store.list('clientes').sort((a, b) => a.nombre.localeCompare(b.nombre));

  const draft = {
    step: 1,
    clienteId: '',
    clienteNombre: 'Consumidor final',
    clienteTel: '',
    canal: 'Local / presencial',
    fecha: hoy(),
    items: new Map(), // productoId -> { productoId, descripcion, cantidad, precio, costo }
    descuento: 0,
    envio: 0,
    medioPago: 'Efectivo',
    pagoCompleto: true,
    notas: ''
  };

  const modalBody = h('div', { class: 'stack', style: 'gap:14px; min-height:360px;' });
  const modalFooter = h('div', { class: 'actions wrap', style: 'width:100%; justify-content:space-between;' });

  const modal = openModal({
    title: '🛍️ Nueva Venta Paso a Paso',
    wide: true,
    body: modalBody,
    footer: modalFooter
  });

  function renderStep() {
    modalBody.replaceChildren();
    modalFooter.replaceChildren();

    // 1. Barra de progreso visual
    const stepsNames = ['1. Cliente', '2. Productos', '3. Pago y Envío', '4. Confirmar'];
    const progressBar = h('div', { style: 'display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;' },
      stepsNames.map((n, idx) => {
        const num = idx + 1;
        const activo = draft.step === num;
        const pasado = draft.step > num;
        return h('div', {
          style: `font-size:0.8rem; font-weight:700; color:${activo ? '#2563eb' : pasado ? '#16a34a' : '#94a3b8'}; display:flex; align-items:center; gap:4px;`
        }, pasado ? `✓ ${n}` : n);
      })
    );
    modalBody.append(progressBar);

    // ---------- PASO 1: CLIENTE ----------
    if (draft.step === 1) {
      modalBody.append(
        h('h3', { style: 'margin:0;' }, 'Paso 1: ¿A quién le estás vendiendo?'),
        h('p', { class: 'muted', style: 'margin:0;' }, 'Elige el cliente. Si es una venta rápida de mostrador, toca "Consumidor final".'),
        h('div', { style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-top:10px;' },
          h('button', {
            type: 'button',
            class: 'btn',
            style: `height:56px; font-weight:700; justify-content:flex-start; ${!draft.clienteId ? 'border-color:#2563eb; background:#eff6ff;' : ''}`,
            onclick: () => {
              draft.clienteId = '';
              draft.clienteNombre = 'Consumidor final';
              draft.clienteTel = '';
              draft.step = 2;
              renderStep();
            }
          }, '👤 Consumidor final (Venta rápida)'),
          ...clientes.map(c =>
            h('button', {
              type: 'button',
              class: 'btn',
              style: `height:56px; font-weight:600; justify-content:flex-start; ${draft.clienteId === c.id ? 'border-color:#2563eb; background:#eff6ff;' : ''}`,
              onclick: () => {
                draft.clienteId = c.id;
                draft.clienteNombre = c.nombre;
                draft.clienteTel = c.telefono || '';
                draft.step = 2;
                renderStep();
              }
            }, `👥 ${c.nombre}`)
          )
        )
      );

      modalFooter.append(
        h('button', { class: 'btn danger ghost', onclick: () => modal.close() }, '✕ Cancelar'),
        h('button', {
          class: 'btn primary',
          onclick: () => { draft.step = 2; renderStep(); }
        }, 'Siguiente: Productos →')
      );
    }

    // ---------- PASO 2: PRODUCTOS ----------
    else if (draft.step === 2) {
      let filtroTexto = '';
      const listaProdsBox = h('div', { style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; max-height:280px; overflow-y:auto; padding:4px;' });
      const resumenItemsBox = h('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; font-size:0.85rem;' });

      function actualizarLista() {
        listaProdsBox.replaceChildren();
        const q = norm(filtroTexto);
        const filtrados = prods.filter(p => !q || norm(`${p.nombre} ${p.sku} ${p.categoria}`).includes(q));

        if (!filtrados.length) {
          listaProdsBox.append(h('div', { class: 'empty', style: 'grid-column:1/-1; padding:20px;' }, 'No se encontraron productos.'));
        } else {
          filtrados.forEach(p => {
            const stockActual = sm.get(p.id) || 0;
            const itemActual = draft.items.get(p.id) || { cantidad: 0 };
            const card = h('div', {
              style: `border:1px solid ${itemActual.cantidad > 0 ? '#3b82f6' : '#e2e8f0'}; background:${itemActual.cantidad > 0 ? '#eff6ff' : '#ffffff'}; border-radius:10px; padding:10px; display:flex; flex-direction:column; justify-content:space-between;`
            },
              h('div', {},
                h('strong', { style: 'font-size:0.88rem; display:block;' }, p.nombre),
                h('div', { class: 'muted', style: 'font-size:0.75rem;' }, `${money(p.precio)} · Stock: ${stockActual} u.`)),
              h('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-top:8px;' },
                h('button', {
                  type: 'button',
                  class: 'btn small',
                  style: 'width:34px; padding:0; font-size:1.1rem; font-weight:bold;',
                  onclick: () => {
                    if (itemActual.cantidad > 1) {
                      itemActual.cantidad--;
                      draft.items.set(p.id, itemActual);
                    } else {
                      draft.items.delete(p.id);
                    }
                    actualizarLista();
                    actualizarResumen();
                  }
                }, '–'),
                h('span', { style: 'font-weight:700; font-size:0.95rem;' }, itemActual.cantidad || 0),
                h('button', {
                  type: 'button',
                  class: 'btn primary small',
                  style: 'width:34px; padding:0; font-size:1.1rem; font-weight:bold;',
                  onclick: () => {
                    if (itemActual.cantidad > 0) {
                      itemActual.cantidad++;
                    } else {
                      draft.items.set(p.id, {
                        productoId: p.id,
                        descripcion: p.nombre,
                        cantidad: 1,
                        precio: p.precio || 0,
                        costo: p.costo || 0
                      });
                    }
                    actualizarLista();
                    actualizarResumen();
                  }
                }, '+')
              )
            );
            listaProdsBox.append(card);
          });
        }
      }

      function actualizarResumen() {
        const itemsArr = Array.from(draft.items.values());
        const totalItems = itemsArr.reduce((a, i) => a + i.cantidad, 0);
        const subtotal = itemsArr.reduce((a, i) => a + i.cantidad * i.precio, 0);

        resumenItemsBox.replaceChildren(
          h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' },
            h('span', {}, `Seleccionados: <strong>${totalItems} unidades</strong> (${itemsArr.length} productos)`),
            h('strong', { style: 'font-size:1rem; color:#2563eb;' }, `Subtotal: ${money(subtotal)}`))
        );
      }

      const inputBuscador = h('input', {
        type: 'search',
        placeholder: '🔍 Buscar producto por nombre o categoría…',
        style: 'margin-bottom:8px;',
        oninput: e => { filtroTexto = e.target.value; actualizarLista(); }
      });

      actualizarLista();
      actualizarResumen();

      modalBody.append(
        h('h3', { style: 'margin:0;' }, 'Paso 2: Elige los productos'),
        h('p', { class: 'muted', style: 'margin:0;' }, 'Toca "+" o "–" para indicar las cantidades que lleva el cliente.'),
        inputBuscador,
        listaProdsBox,
        resumenItemsBox
      );

      modalFooter.append(
        h('div', { style: 'display:flex; gap:8px;' },
          h('button', { class: 'btn', onclick: () => { draft.step = 1; renderStep(); } }, '← Atrás'),
          h('button', { class: 'btn danger ghost', onclick: () => modal.close() }, '✕ Cancelar')),
        h('button', {
          class: 'btn primary',
          disabled: draft.items.size === 0,
          onclick: () => {
            if (draft.items.size === 0) {
              toast('Selecciona al menos un producto', 'err');
              return;
            }
            draft.step = 3;
            renderStep();
          }
        }, 'Siguiente: Forma de Pago →')
      );
    }

    // ---------- PASO 3: PAGO Y ENVÍO ----------
    else if (draft.step === 3) {
      const mediosBtns = MEDIOS.map(m =>
        h('button', {
          type: 'button',
          class: 'btn',
          style: `height:50px; font-weight:700; ${draft.medioPago === m ? 'border-color:#16a34a; background:#f0fdf4; color:#16a34a;' : ''}`,
          onclick: () => { draft.medioPago = m; renderStep(); }
        }, m === 'Efectivo' ? '💵 Efectivo' : m === 'Transferencia' ? '💳 Transferencia' : m === 'Mercado Pago' ? '📱 Mercado Pago' : m === 'Tarjeta' ? '💳 Tarjeta' : '⏳ A Cuenta Corriente')
      );

      const inDesc = h('input', { type: 'number', min: 0, step: 'any', value: draft.descuento || 0 });
      const inEnvio = h('input', { type: 'number', min: 0, step: 'any', value: draft.envio || 0 });
      const inCanal = h('select', {}, CANALES.map(c => h('option', { value: c, selected: draft.canal === c }, c)));
      const inNotas = h('input', { placeholder: 'Ej: Entrega por la tarde, empaque regalo', value: draft.notas || '' });

      modalBody.append(
        h('h3', { style: 'margin:0;' }, 'Paso 3: Forma de Pago y Envío'),
        h('p', { class: 'muted', style: 'margin:0;' }, '¿Cómo te abona la compra el cliente?'),
        h('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin:10px 0;' }, mediosBtns),
        h('div', { class: 'two-col' },
          field('Descuento ($)', inDesc),
          field('Costo de Envío ($)', inEnvio)),
        h('div', { class: 'two-col' },
          field('Canal de venta', inCanal),
          field('Notas / Observaciones', inNotas))
      );

      modalFooter.append(
        h('div', { style: 'display:flex; gap:8px;' },
          h('button', { class: 'btn', onclick: () => { draft.step = 2; renderStep(); } }, '← Atrás'),
          h('button', { class: 'btn danger ghost', onclick: () => modal.close() }, '✕ Cancelar')),
        h('button', {
          class: 'btn primary',
          onclick: () => {
            draft.descuento = num(inDesc.value);
            draft.envio = num(inEnvio.value);
            draft.canal = inCanal.value;
            draft.notas = inNotas.value.trim();
            draft.step = 4;
            renderStep();
          }
        }, 'Siguiente: Revisar y Confirmar →')
      );
    }

    // ---------- PASO 4: REVISIÓN Y CONFIRMACIÓN FINAL ----------
    else if (draft.step === 4) {
      const itemsArr = Array.from(draft.items.values());
      const subtotal = itemsArr.reduce((a, i) => a + i.cantidad * i.precio, 0);
      const totalFinal = Math.max(0, subtotal - draft.descuento + draft.envio);

      modalBody.append(
        h('div', { style: 'background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:12px; text-align:center;' },
          h('h3', { style: 'margin:0; color:#166534;' }, 'Paso 4: Revisa los datos antes de guardar'),
          h('p', { style: 'margin:4px 0 0 0; color:#15803d; font-size:0.85rem;' }, 'Nada se ha guardado todavía. Si algo está mal, toca "Atrás para corregir".')),

        h('div', { class: 'card', style: 'background:#ffffff; border-radius:12px; padding:16px;' },
          h('div', { style: 'display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:10px;' },
            h('span', { class: 'muted' }, 'Cliente:'),
            h('strong', {}, draft.clienteNombre)),
          h('div', { style: 'display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:10px;' },
            h('span', { class: 'muted' }, 'Canal y Medio de Pago:'),
            h('span', {}, `${draft.canal} · <strong>${draft.medioPago}</strong>`)),

          h('h4', { style: 'margin:12px 0 6px 0;' }, 'Productos a entregar:'),
          itemsArr.map(i =>
            h('div', { class: 'row purchase', style: 'padding:4px 0;' },
              h('span', {}, `${i.cantidad} × ${i.descripcion}`),
              h('span', {}, money(i.cantidad * i.precio)))
          ),

          draft.descuento ? h('div', { class: 'row purchase', style: 'color:#c0392b;' }, h('span', {}, 'Descuento:'), h('span', {}, `-${money(draft.descuento)}`)) : null,
          draft.envio ? h('div', { class: 'row purchase' }, h('span', {}, 'Envío:'), h('span', {}, money(draft.envio))) : null,

          h('div', { style: 'display:flex; justify-content:space-between; align-items:center; border-top:2px solid #e2e8f0; margin-top:12px; padding-top:10px;' },
            h('span', { style: 'font-size:1.1rem; font-weight:800;' }, 'TOTAL A PAGAR:'),
            h('span', { style: 'font-size:1.4rem; font-weight:800; color:#16a34a;' }, money(totalFinal)))
        )
      );

      modalFooter.append(
        h('div', { style: 'display:flex; gap:8px;' },
          h('button', { class: 'btn', onclick: () => { draft.step = 3; renderStep(); } }, '← Atrás para corregir'),
          h('button', { class: 'btn danger ghost', onclick: () => modal.close() }, '✕ Cancelar todo')),
        h('button', {
          class: 'btn primary',
          style: 'background:#16a34a; border-color:#16a34a; font-size:1rem; font-weight:800; padding:10px 20px;',
          onclick: () => {
            // AQUÍ Y SOLO AQUÍ SE GUARDA LA VENTA
            const numeroVenta = nextNumero();
            const nuevaVenta = {
              numero: numeroVenta,
              fecha: draft.fecha,
              clienteId: draft.clienteId,
              canal: draft.canal,
              items: itemsArr,
              descuento: draft.descuento,
              envio: draft.envio,
              estado: 'pedido',
              pagos: [{ fecha: draft.fecha, monto: totalFinal, medio: draft.medioPago }],
              notas: draft.notas,
              stockDescontado: false,
              vendedor: currentUser()?.nombre || ''
            };

            // Aplicar descuento de stock
            itemsArr.forEach(i => {
              if (i.productoId) {
                mover({ productoId: i.productoId, tipo: 'egreso', cantidad: -i.cantidad, ref: `venta_${numeroVenta}`, nota: `Venta #${numeroVenta}` });
              }
            });
            nuevaVenta.stockDescontado = true;

            store.put('ventas', nuevaVenta);
            modal.close();
            toast(`¡Venta #${numeroVenta} guardada con éxito!`, 'ok');

            // Modal de confirmación con botón de WhatsApp
            const cObj = cliente(draft.clienteId);
            openModal({
              title: '🎉 ¡Venta Registrada Exitosamente!',
              body: h('div', { class: 'stack', style: 'text-align:center; padding:10px;' },
                h('div', { style: 'font-size:3rem;' }, '✅'),
                h('h2', { style: 'margin:0;' }, money(totalFinal)),
                h('p', { class: 'muted' }, `Se registró la Venta #${numeroVenta} y se descontaron los productos del stock.`),
                h('div', { style: 'background:#f8fafc; padding:10px; border-radius:10px; font-size:0.85rem;' },
                  'Si cometiste algún error, puedes buscar esta venta en la lista y tocar <strong>"Volver atrás / Anular"</strong> con la clave de autorización.')),
              footer: [
                cObj?.telefono
                  ? h('a', { class: 'btn wa', target: '_blank', rel: 'noopener', href: waLink(cObj.telefono, resumenTexto(nuevaVenta)) }, '📲 Enviar comprobante por WhatsApp')
                  : null,
                h('button', { class: 'btn primary', onclick: (e) => { e.target.closest('.overlay').remove(); document.body.classList.remove('modal-open'); } }, 'Listo')
              ]
            });
          }
        }, '✅ Confirmar y Guardar Venta')
      );
    }
  }

  renderStep();
}

// ---------- Clientes ----------
function openCliente(id) {
  const c = id ? cliente(id) : null;
  const nombre = h('input', { value: c?.nombre || '' });
  const tel = h('input', { type: 'tel', value: c?.telefono || '', placeholder: 'Ej: 381 5123456' });
  const email = h('input', { type: 'email', value: c?.email || '' });
  const dir = h('input', { value: c?.direccion || '' });
  const doc = h('input', { value: c?.documento || '', placeholder: 'CUIT / DNI (para facturar)' });
  const notas = h('textarea', { rows: 2, value: c?.notas || '' });
  const m = openModal({
    title: c ? 'Editar cliente' : 'Nuevo cliente',
    body: h('div', {}, field('Nombre', nombre), field('WhatsApp / teléfono', tel), field('Email', email), field('Dirección', dir), field('CUIT / DNI', doc), field('Notas', notas)),
    footer: [
      c ? h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmDialog('¿Eliminar cliente?', 'Eliminar')) { store.remove('clientes', id); m.close(); } } }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        if (!nombre.value.trim()) { toast('Falta el nombre', 'err'); return; }
        store.put('clientes', { ...(c || {}), nombre: nombre.value.trim(), telefono: tel.value.trim(), email: email.value.trim(), direccion: dir.value.trim(), documento: doc.value.trim(), notas: notas.value.trim() });
        toast('Cliente guardado'); m.close();
      } }, 'Guardar')],
  });
}

export default {
  id: 'ventas', perm: 'ventas', label: 'Ventas', icon: '💰', title: 'Ventas',
  mount(root) {
    const editable = can('ventas', 2);
    const top = h('div', {});
    const body = h('div', {});
    root.append(top, body);
    const render = () => {
      const tabs = h('div', { class: 'toolbar' },
        h('button', { class: 'btn ' + (view.tab === 'ventas' ? 'primary' : ''), onclick: () => { view.tab = 'ventas'; render(); } }, '💰 Ventas'),
        h('button', { class: 'btn ' + (view.tab === 'clientes' ? 'primary' : ''), onclick: () => { view.tab = 'clientes'; render(); } }, '👥 Clientes'));
      top.replaceChildren(tabs);
      view.tab === 'ventas' ? renderVentas() : renderClientes();
    };

    function renderVentas() {
      const q = norm(view.q);
      const all = store.list('ventas');
      const list = all.filter(v => (!view.estado || v.estado === view.estado) && (!q || norm(`${v.numero} ${clienteNombre(v.clienteId)} ${v.canal} ${v.items.map(i => i.descripcion).join(' ')}`).includes(q)))
        .sort((a, b) => b.numero - a.numero);
      const vivas = all.filter(v => v.estado !== 'cancelado' && v.estado !== 'presupuesto');
      const mes = hoy().slice(0, 7);
      const delMes = vivas.filter(v => String(v.fecha).startsWith(mes));
      const porCobrar = vivas.reduce((a, v) => a + Math.max(0, totalVenta(v) - pagadoVenta(v)), 0);
      body.replaceChildren(
        h('div', { class: 'toolbar' },
          h('input', { class: 'grow', type: 'search', placeholder: 'Buscar por cliente, canal o producto…', value: view.q, oninput: e => { view.q = e.target.value; renderVentas(); } }),
          h('select', { onchange: e => { view.estado = e.target.value; renderVentas(); } }, h('option', { value: '' }, 'Todos los estados'), Object.entries(ESTADOS).map(([k, x]) => h('option', { value: k, selected: view.estado === k }, x.label))),
          editable ? h('button', { id: 'btnNuevaVentaVisual', class: 'btn primary', onclick: openWizardVenta }, '🛍️ + Vender paso a paso') : null),
        h('div', { class: 'grid', style: 'margin-bottom:14px' },
          [['Ventas del mes', money(delMes.reduce((a, v) => a + totalVenta(v), 0))], ['Margen del mes', money(delMes.reduce((a, v) => a + margenVenta(v), 0))], ['Por cobrar', money(porCobrar)]].map(([l, x]) =>
            h('div', { class: 'card' }, h('div', { class: 'muted' }, l), h('h2', { style: 'margin:4px 0 0' }, x)))),
        list.length ? h('div', { class: 'grid' }, list.map(v => {
          const saldo = totalVenta(v) - pagadoVenta(v);
          return h('div', { class: 'card prov', tabindex: 0, onclick: () => openDetail(v.id), onkeydown: e => { if (e.key === 'Enter') openDetail(v.id); } },
            h('div', { class: 'card-head' }, h('h3', {}, `#${v.numero} · ${clienteNombre(v.clienteId)}`), pill(v.estado)),
            h('div', { class: 'muted' }, `${fmtDate(v.fecha)} · ${v.canal} · ${v.items.length} productos`),
            h('div', { class: 'card-foot' }, h('strong', {}, money(totalVenta(v))),
              v.estado === 'cancelado' ? null : saldo > 0.5 ? h('span', { class: 'pill red' }, `Cobrar ${money(saldo)}`) : h('span', { class: 'pill green' }, 'Cobrada')));
        })) : h('div', { class: 'empty' }, 'No hay ventas para mostrar.'));
    }

    function renderClientes() {
      const q = norm(view.qc);
      const list = store.list('clientes').filter(c => !q || norm(`${c.nombre} ${c.telefono} ${c.email}`).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre));
      body.replaceChildren(
        h('div', { class: 'toolbar' },
          h('input', { class: 'grow', type: 'search', placeholder: 'Buscar cliente…', value: view.qc, oninput: e => { view.qc = e.target.value; renderClientes(); } }),
          editable ? h('button', { class: 'btn primary', onclick: () => openCliente() }, '+ Cliente') : null),
        list.length ? h('div', { class: 'grid' }, list.map(c => {
          const vs = store.list('ventas').filter(v => v.clienteId === c.id && v.estado !== 'cancelado' && v.estado !== 'presupuesto');
          return h('div', { class: 'card prov', onclick: () => editable && openCliente(c.id) },
            h('div', { class: 'card-head' }, h('h3', {}, c.nombre), h('span', { class: 'pill gray' }, `${vs.length} compras`)),
            h('div', { class: 'muted' }, [c.telefono, c.email, c.direccion].filter(Boolean).join(' · ') || 'Sin datos de contacto'),
            h('div', { class: 'card-foot' }, h('strong', {}, money(vs.reduce((a, v) => a + totalVenta(v), 0))),
              c.telefono ? h('a', { class: 'btn small wa', target: '_blank', rel: 'noopener', href: waLink(c.telefono, `Hola ${c.nombre}!`), onclick: e => e.stopPropagation() }, 'WhatsApp') : null));
        })) : h('div', { class: 'empty' }, 'Todavía no hay clientes cargados.'));
    }

    render();
    return store.onChange(() => (view.tab === 'ventas' ? renderVentas() : renderClientes()));
  },
};
