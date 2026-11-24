// Módulo COMPRAS: pedidos a proveedores, recepción de mercadería (alimenta el stock),
// cuenta corriente con pagos y comparación de costos.

import * as store from '../core/store.js';
import { h, openModal, toast, confirmDialog, money, fmtDate, field, pedirAutorizacionConClave } from '../core/ui.js';
import { can } from '../core/auth.js';
import { hoy, num, norm, mover, findProducto, crearProducto, totalCompra, pagadoCompra, waLink } from '../core/inventario.js';

const ESTADOS = {
  pedida: { label: 'Pedida', cls: 'blue' },
  parcial: { label: 'Recibida parcial', cls: 'amber' },
  recibida: { label: 'Recibida', cls: 'green' },
  cancelada: { label: 'Cancelada', cls: 'red' },
};
const MEDIOS = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Cheque', 'Otro'];
const view = { q: '', estado: '', deuda: false };

const provName = id => store.get('proveedores', id)?.nombre || '(proveedor eliminado)';
const pill = e => h('span', { class: 'pill ' + (ESTADOS[e]?.cls || 'gray') }, ESTADOS[e]?.label || e);
const unit = i => (i.cantidad ? (Number(i.subtotal) || 0) / i.cantidad : 0);

function estadoRecepcion(c) {
  const items = c.items || [];
  if (!items.length) return c.estado;
  const rec = items.reduce((a, i) => a + (i.recibido || 0), 0);
  const tot = items.reduce((a, i) => a + i.cantidad, 0);
  return rec <= 0 ? 'pedida' : rec >= tot ? 'recibida' : 'parcial';
}

// ---------- Recepción ----------
function openRecepcion(id) {
  const c = store.get('compras', id);
  if (!c) return;
  const inputs = (c.items || []).map(i => {
    const pend = Math.max(0, i.cantidad - (i.recibido || 0));
    return { i, pend, input: h('input', { type: 'number', min: 0, max: pend, step: 'any', value: pend, disabled: !pend, style: 'width:90px' }) };
  });
  const m = openModal({
    title: `Recibir mercadería · ${c.notaPedido || ''}`, wide: true,
    body: h('div', {},
      h('p', { class: 'muted' }, 'Indicá cuánto llegó de cada ítem. Se suma al stock (se crea el producto si no existe).'),
      inputs.map(({ i, pend, input }) => h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('strong', {}, i.descripcion), h('div', { class: 'muted' }, `Pedido ${i.cantidad} · recibido ${i.recibido || 0} · pendiente ${pend}`)),
        input))),
    footer: [
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        let total = 0;
        const cur = store.get('compras', id);
        inputs.forEach(({ i, pend, input }, idx) => {
          const q = Math.min(pend, Math.max(0, num(input.value)));
          if (!q) return;
          const it = cur.items[idx];
          it.recibido = (it.recibido || 0) + q;
          let prod = findProducto(it.descripcion);
          const costo = unit(it);
          if (!prod) prod = crearProducto({ nombre: it.descripcion, costo, proveedorId: cur.proveedorId });
          else if (costo) store.put('productos', { ...prod, costo });
          mover({ productoId: prod.id, tipo: 'ingreso', cantidad: q, ref: cur.id, nota: `Compra ${cur.notaPedido || ''}` });
          total += q;
        });
        if (!total) { toast('No indicaste cantidades', 'err'); return; }
        cur.estado = estadoRecepcion(cur);
        store.put('compras', cur);
        toast(`Ingresaron ${total} unidades al stock`);
        m.close();
      } }, 'Confirmar recepción'),
    ],
  });
}

// ---------- Pago ----------
function openPago(id) {
  const c = store.get('compras', id);
  const saldo = Math.max(0, totalCompra(c) - pagadoCompra(c));
  const monto = h('input', { type: 'number', min: 0, step: '0.01', value: saldo.toFixed(2) });
  const medio = h('select', {}, MEDIOS.map(x => h('option', { value: x }, x)));
  const fecha = h('input', { type: 'date', value: hoy() });
  const m = openModal({
    title: 'Registrar pago a proveedor',
    body: h('div', {}, h('p', { class: 'muted' }, `Saldo pendiente: ${money(saldo)}`), field('Monto', monto), field('Medio', medio), field('Fecha', fecha)),
    footer: [
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        const v = num(monto.value);
        if (v <= 0) { toast('Monto inválido', 'err'); return; }
        const cur = store.get('compras', id);
        cur.pagos = [...(cur.pagos || []), { fecha: fecha.value, monto: v, medio: medio.value }];
        store.put('compras', cur);
        toast('Pago registrado'); m.close();
      } }, 'Guardar pago'),
    ],
  });
}

// ---------- Detalle ----------
function openDetail(id) {
  const c = store.get('compras', id);
  if (!c) return;
  const editable = can('compras', 2);
  const total = totalCompra(c), pagado = pagadoCompra(c), saldo = total - pagado;
  const prov = store.get('proveedores', c.proveedorId);
  const tel = prov?.telefonos?.[0];
  const m = openModal({
    title: `Pedido ${c.notaPedido || '(sin número)'}`, wide: true,
    body: h('div', {},
      h('div', { class: 'row' }, pill(c.estado), h('span', { class: 'muted' }, `${provName(c.proveedorId)} · ${fmtDate(c.fecha)}`)),
      h('h4', {}, 'Ítems'),
      (c.items || []).map(i => h('div', { class: 'row purchase' },
        h('span', {}, `${i.cantidad} × ${i.descripcion}`, i.recibido ? h('small', { class: 'muted' }, `  (recibido ${i.recibido})`) : null),
        h('strong', {}, money(i.subtotal)))),
      h('h4', {}, 'Cuenta corriente'),
      h('dl', { class: 'info' },
        h('dt', {}, 'Total'), h('dd', {}, money(total)),
        h('dt', {}, 'Pagado'), h('dd', {}, money(pagado)),
        h('dt', {}, 'Saldo'), h('dd', {}, h('strong', { style: saldo > 0.5 ? 'color:#c0392b' : 'color:#2e7d4f' }, money(saldo)))),
      (c.pagos || []).map(p => h('div', { class: 'row' }, h('span', {}, `${fmtDate(p.fecha)} · ${p.medio}`), h('strong', {}, money(p.monto)))),
      c.notas ? [h('h4', {}, 'Notas'), h('p', {}, c.notas)] : null),
    footer: [
      editable ? h('button', { class: 'btn danger ghost', onclick: async () => {
        if (await confirmDialog('¿Eliminar este pedido? (El stock ya ingresado no se revierte)', 'Eliminar')) { store.remove('compras', id); m.close(); toast('Pedido eliminado'); }
      } }, 'Eliminar') : null,
      tel ? h('a', { class: 'btn wa', target: '_blank', rel: 'noopener', href: waLink(tel, `Hola! Te escribo por el pedido ${c.notaPedido || ''}.`) }, 'WhatsApp proveedor') : null,
      editable && c.estado !== 'cancelada' ? h('button', { class: 'btn', onclick: () => { m.close(); openPago(id); } }, '💵 Registrar pago') : null,
      editable && c.estado !== 'recibida' && c.estado !== 'cancelada' ? h('button', { class: 'btn primary', onclick: () => { m.close(); openRecepcion(id); } }, '📦 Recibir mercadería') : null,
      editable && c.estado !== 'cancelada' ? h('button', { class: 'btn danger ghost', onclick: () => {
        m.close();
        pedirAutorizacionConClave({
          titulo: `Anular Pedido ${c.notaPedido || ''}`,
          detalle: `Se anulará el pedido de compra a ${provName(c.proveedorId)} y se revertirá del stock cualquier cantidad que ya se haya recibido.`,
          onAutorizado: (autorizante) => {
            const cur = store.get('compras', id);
            (cur.items || []).forEach(it => {
              if (it.recibido > 0) {
                const prod = findProducto(it.descripcion);
                if (prod) {
                  mover({ productoId: prod.id, tipo: 'egreso', cantidad: -it.recibido, ref: cur.id, nota: `Anulación compra por ${autorizante.nombre}` });
                }
              }
            });
            cur.estado = 'cancelada';
            store.put('compras', cur);
            store.log('ANULAR_COMPRA', `Pedido ${cur.notaPedido || id} anulado por ${autorizante.nombre} (${autorizante.rol})`);
            toast('Pedido anulado y stock revertido.');
          }
        });
      } }, '↩️ Volver atrás / Anular compra') : null,
    ],
  });
}

// ---------- Nueva compra ----------
function openNueva() {
  const provs = store.list('proveedores').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const prov = h('select', {}, h('option', { value: '' }, '— elegí proveedor —'), provs.map(p => h('option', { value: p.id }, p.nombre)));
  const nota = h('input', { placeholder: 'N° de nota de pedido (opcional)' });
  const fecha = h('input', { type: 'date', value: hoy() });
  const notas = h('textarea', { rows: 2, placeholder: 'Notas' });
  const rows = [];
  const itemsBox = h('div', {});
  const totalEl = h('strong', {}, money(0));
  const recalc = () => { totalEl.textContent = money(rows.reduce((a, r) => a + num(r.sub.value), 0)); };
  const addRow = () => {
    const r = {
      desc: h('input', { placeholder: 'Descripción', class: 'grow' }),
      cant: h('input', { type: 'number', min: 1, step: 'any', value: 1, style: 'width:70px', oninput: recalc }),
      sub: h('input', { type: 'number', min: 0, step: '0.01', placeholder: 'Subtotal $', style: 'width:120px', oninput: recalc }),
    };
    r.el = h('div', { class: 'row' }, r.desc, r.cant, r.sub, h('button', { class: 'icon-btn', onclick: () => { rows.splice(rows.indexOf(r), 1); r.el.remove(); recalc(); } }, '✕'));
    rows.push(r); itemsBox.append(r.el);
  };
  addRow();
  const m = openModal({
    title: 'Nuevo pedido a proveedor', wide: true,
    body: h('div', {}, field('Proveedor', prov), field('Nota de pedido', nota), field('Fecha', fecha),
      h('h4', {}, 'Ítems'), itemsBox, h('button', { class: 'btn small', onclick: addRow }, '+ Agregar ítem'),
      h('div', { class: 'row purchase' }, h('span', {}, 'Total'), totalEl), field('Notas', notas)),
    footer: [
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        if (!prov.value) { toast('Elegí un proveedor', 'err'); return; }
        const items = rows.filter(r => r.desc.value.trim()).map(r => ({ cantidad: num(r.cant.value) || 1, descripcion: r.desc.value.trim(), subtotal: num(r.sub.value), recibido: 0 }));
        if (!items.length) { toast('Agregá al menos un ítem', 'err'); return; }
        store.put('compras', { proveedorId: prov.value, notaPedido: nota.value.trim(), fecha: fecha.value, items, total: items.reduce((a, i) => a + i.subtotal, 0), estado: 'pedida', pagos: [], notas: notas.value.trim() });
        toast('Pedido creado'); m.close();
      } }, 'Guardar pedido'),
    ],
  });
}

// ---------- Comparación de costos ----------
function openCostos() {
  const map = new Map();
  store.list('compras').filter(c => c.estado !== 'cancelada').forEach(c => (c.items || []).forEach(i => {
    const k = norm(i.descripcion);
    if (!map.has(k)) map.set(k, { desc: i.descripcion, regs: [] });
    map.get(k).regs.push({ fecha: c.fecha, prov: provName(c.proveedorId), costo: unit(i) });
  }));
  const multi = [...map.values()].filter(x => x.regs.length > 1);
  openModal({
    title: 'Historial de costos', wide: true,
    body: multi.length
      ? multi.map(x => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('strong', {}, x.desc), x.regs.sort((a, b) => String(a.fecha).localeCompare(b.fecha)).map(r => h('div', { class: 'muted' }, `${fmtDate(r.fecha)} · ${r.prov} · ${money(r.costo)}`)))))
      : h('p', { class: 'muted' }, 'Todavía no hay productos comprados más de una vez. Cuando repitas una compra vas a ver acá cómo evolucionó el costo.'),
  });
}

export default {
  id: 'compras', perm: 'compras', label: 'Compras', icon: '🛒', title: 'Compras',
  mount(root) {
    const editable = can('compras', 2);
    const body = h('div', {});
    const toolbar = h('div', { class: 'toolbar' },
      h('input', { class: 'grow', type: 'search', placeholder: 'Buscar por proveedor, nota o producto…', value: view.q, oninput: e => { view.q = e.target.value; render(); } }),
      h('select', { onchange: e => { view.estado = e.target.value; render(); } }, h('option', { value: '' }, 'Todos los estados'), Object.entries(ESTADOS).map(([k, v]) => h('option', { value: k, selected: view.estado === k }, v.label))),
      h('label', { class: 'btn' }, h('input', { type: 'checkbox', style: 'width:auto;min-height:0', checked: view.deuda, onchange: e => { view.deuda = e.target.checked; render(); } }), ' Con saldo'),
      h('button', { class: 'btn', onclick: openCostos }, '📈 Costos'),
      editable ? h('button', { class: 'btn primary', onclick: openNueva }, '+ Nuevo pedido') : null);
    root.append(toolbar, body);
    const render = () => {
      const all = store.list('compras');
      const q = norm(view.q);
      const list = all.filter(c => (!view.estado || c.estado === view.estado) && (!view.deuda || totalCompra(c) - pagadoCompra(c) > 0.5 && c.estado !== 'cancelada')
        && (!q || norm(`${c.notaPedido} ${provName(c.proveedorId)} ${(c.items || []).map(i => i.descripcion).join(' ')}`).includes(q)))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const vivas = all.filter(c => c.estado !== 'cancelada');
      const deuda = vivas.reduce((a, c) => a + Math.max(0, totalCompra(c) - pagadoCompra(c)), 0);
      const pendRec = all.filter(c => c.estado === 'pedida' || c.estado === 'parcial').length;

      body.replaceChildren(
        h('div', { class: 'summary muted' }, `${list.length} pedidos · pendientes de recibir: ${pendRec} · deuda con proveedores: `, h('strong', {}, money(deuda))),
        list.length ? h('div', { class: 'grid' }, list.map(c => {
          const total = totalCompra(c), saldo = total - pagadoCompra(c);
          return h('div', { class: 'card prov', tabindex: 0, onclick: () => openDetail(c.id), onkeydown: e => { if (e.key === 'Enter') openDetail(c.id); } },
            h('div', { class: 'card-head' }, h('h3', {}, provName(c.proveedorId)), pill(c.estado)),
            h('div', { class: 'muted' }, `${c.notaPedido || 'Sin nota'} · ${fmtDate(c.fecha)} · ${(c.items || []).length} ítems`),
            h('div', { class: 'card-foot' }, h('strong', {}, money(total)), saldo > 0.5 && c.estado !== 'cancelada' ? h('span', { class: 'pill red' }, `Debe ${money(saldo)}`) : h('span', { class: 'pill green' }, 'Al día')));
        })) : h('div', { class: 'empty' }, 'No hay pedidos con esos filtros.'));
    };
    render();
    return store.onChange(() => render());
  },
};
