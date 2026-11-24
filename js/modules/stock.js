// Módulo STOCK: productos con SKU, existencias por movimientos, stock mínimo con alertas,
// valorización del inventario y escaneo de código de barras con la cámara.

import * as store from '../core/store.js';
import { h, openModal, toast, confirmDialog, money, fmtDate, field } from '../core/ui.js';
import { can } from '../core/auth.js';
import { hoy, num, norm, stockMap, mover, nextSku } from '../core/inventario.js';

const view = { q: '', bajo: false };

// ---------- Escáner de código de barras ----------
async function escanear(onCode) {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    toast('Tu navegador no soporta escaneo. Escribí el código a mano.', 'err');
    return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
  catch { toast('No se pudo abrir la cámara', 'err'); return; }
  const video = h('video', { autoplay: true, playsinline: true, muted: true, style: 'width:100%;border-radius:12px;background:#000' });
  video.srcObject = stream;
  let alive = true;
  const stop = () => { alive = false; stream.getTracks().forEach(t => t.stop()); };
  const m = openModal({ title: 'Escaneá el código de barras', body: video, footer: [h('button', { class: 'btn', onclick: () => { stop(); m.close(); } }, 'Cerrar')] });
  const det = new BarcodeDetector();
  const loop = async () => {
    if (!alive) return;
    try {
      const codes = await det.detect(video);
      if (codes.length) { stop(); m.close(); onCode(codes[0].rawValue); return; }
    } catch { /* seguir */ }
    setTimeout(loop, 350);
  };
  video.addEventListener('playing', loop);
}

// ---------- Alta / edición ----------
function openProducto(id) {
  const p = id ? store.get('productos', id) : null;
  const sku = h('input', { value: p?.sku || nextSku() });
  const nombre = h('input', { value: p?.nombre || '', placeholder: 'Nombre del producto' });
  const cat = h('input', { value: p?.categoria || '', placeholder: 'Ej: Manteles' });
  const costo = h('input', { type: 'number', min: 0, step: '0.01', value: p?.costo ?? '' });
  const precio = h('input', { type: 'number', min: 0, step: '0.01', value: p?.precio ?? '' });
  const min = h('input', { type: 'number', min: 0, step: 'any', value: p?.stockMin ?? 0 });
  const barras = h('input', { value: p?.codigoBarras || '', placeholder: 'Código de barras (opcional)' });
  const inicial = h('input', { type: 'number', min: 0, step: 'any', value: 0 });
  const margen = h('small', { class: 'muted' });
  const calcMargen = () => { const c = num(costo.value), v = num(precio.value); margen.textContent = c && v ? `Margen: ${(((v - c) / v) * 100).toFixed(0)}% (${money(v - c)})` : ''; };
  costo.addEventListener('input', calcMargen); precio.addEventListener('input', calcMargen); calcMargen();
  const m = openModal({
    title: p ? 'Editar producto' : 'Nuevo producto',
    body: h('div', {}, field('SKU', sku), field('Nombre', nombre), field('Categoría', cat), field('Costo ($)', costo), field('Precio de venta ($)', precio, ''), margen,
      field('Stock mínimo (alerta)', min),
      field('Código de barras', h('div', { class: 'actions' }, barras, h('button', { class: 'btn', type: 'button', onclick: () => escanear(c => { barras.value = c; }) }, '📷'))),
      p ? null : field('Stock inicial', inicial)),
    footer: [
      p ? h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmDialog('¿Eliminar el producto?', 'Eliminar')) { store.remove('productos', id); m.close(); toast('Producto eliminado'); } } }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        if (!nombre.value.trim()) { toast('Falta el nombre', 'err'); return; }
        if (store.list('productos').some(x => x.id !== id && x.sku === sku.value.trim())) { toast('Ese SKU ya existe', 'err'); return; }
        const rec = store.put('productos', { ...(p || {}), sku: sku.value.trim(), nombre: nombre.value.trim(), categoria: cat.value.trim(), costo: num(costo.value), precio: num(precio.value), stockMin: num(min.value), codigoBarras: barras.value.trim(), activo: true });
        if (!p && num(inicial.value) > 0) mover({ productoId: rec.id, tipo: 'ajuste', cantidad: num(inicial.value), nota: 'Stock inicial' });
        toast('Producto guardado'); m.close();
      } }, 'Guardar'),
    ],
  });
}

// ---------- Movimiento ----------
function openMovimiento(id) {
  const p = store.get('productos', id);
  const actual = stockMap().get(id) || 0;
  const tipo = h('select', {}, h('option', { value: 'ingreso' }, '➕ Ingreso'), h('option', { value: 'egreso' }, '➖ Egreso (salida / merma)'), h('option', { value: 'ajuste' }, '⚖️ Ajuste (fijar stock real)'));
  const cant = h('input', { type: 'number', step: 'any', min: 0, value: 1 });
  const nota = h('input', { placeholder: 'Motivo (opcional)' });
  const etq = h('span', { class: 'field-label' }, 'Cantidad');
  tipo.addEventListener('change', () => { etq.textContent = tipo.value === 'ajuste' ? 'Stock real contado' : 'Cantidad'; if (tipo.value === 'ajuste') cant.value = actual; });
  const m = openModal({
    title: `Movimiento · ${p.nombre}`,
    body: h('div', {}, h('p', { class: 'muted' }, `Stock actual: ${actual}`), field('Tipo', tipo), h('label', { class: 'field' }, etq, cant), field('Motivo', nota)),
    footer: [
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        const q = num(cant.value);
        let delta = tipo.value === 'ingreso' ? q : tipo.value === 'egreso' ? -q : q - actual;
        if (!delta) { toast('No hay cambio que registrar', 'err'); return; }
        mover({ productoId: id, tipo: tipo.value, cantidad: delta, nota: nota.value.trim() });
        toast('Movimiento registrado'); m.close();
      } }, 'Registrar'),
    ],
  });
}

function openHistorial(id) {
  const p = store.get('productos', id);
  const movs = store.list('movimientos').filter(x => x.productoId === id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  openModal({
    title: `Historial · ${p.nombre}`, wide: true,
    body: movs.length ? movs.map(x => h('div', { class: 'row purchase' },
      h('span', {}, `${fmtDate(x.fecha)} · ${x.tipo}`, x.nota ? h('small', { class: 'muted' }, ` — ${x.nota}`) : null),
      h('strong', { style: x.cantidad < 0 ? 'color:#c0392b' : 'color:#2e7d4f' }, (x.cantidad > 0 ? '+' : '') + x.cantidad))) : h('p', { class: 'muted' }, 'Sin movimientos.'),
  });
}

export default {
  id: 'stock', perm: 'stock', label: 'Stock', icon: '📦', title: 'Stock',
  mount(root) {
    const editable = can('stock', 2);
    const body = h('div', {});
    const toolbar = h('div', { class: 'toolbar' },
      h('input', { class: 'grow', type: 'search', placeholder: 'Buscar por nombre, SKU o código…', value: view.q, oninput: e => { view.q = e.target.value; render(); } }),
      h('button', { class: 'btn', type: 'button', onclick: () => escanear(c => { view.q = c; toolbar.querySelector('input').value = c; render(); }) }, '📷 Escanear'),
      h('label', { class: 'btn' }, h('input', { type: 'checkbox', style: 'width:auto;min-height:0', checked: view.bajo, onchange: e => { view.bajo = e.target.checked; render(); } }), ' Bajo mínimo'),
      editable ? h('button', { class: 'btn primary', onclick: () => openProducto() }, '+ Producto') : null);
    root.append(toolbar, body);
    const render = () => {
      const sm = stockMap();
      const prods = store.list('productos');
      const q = norm(view.q);
      const bajoMin = p => (p.stockMin || 0) > 0 && (sm.get(p.id) || 0) <= p.stockMin;
      const list = prods.filter(p => (!view.bajo || bajoMin(p)) && (!q || norm(`${p.nombre} ${p.sku} ${p.categoria} ${p.codigoBarras}`).includes(q)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      const unidades = prods.reduce((a, p) => a + Math.max(0, sm.get(p.id) || 0), 0);
      const vCosto = prods.reduce((a, p) => a + Math.max(0, sm.get(p.id) || 0) * (p.costo || 0), 0);
      const vVenta = prods.reduce((a, p) => a + Math.max(0, sm.get(p.id) || 0) * (p.precio || 0), 0);
      const alertas = prods.filter(bajoMin).length;

      body.replaceChildren(
        h('div', { class: 'grid', style: 'margin-bottom:14px' },
          [['Productos', prods.length], ['Unidades', unidades], ['Valor a costo', money(vCosto)], ['Valor a precio de venta', money(vVenta)], ['Bajo mínimo', alertas]].map(([l, v], i) =>
            h('div', { class: 'card' }, h('div', { class: 'muted' }, l), h('h2', { style: i === 4 && alertas ? 'color:#c0392b;margin:4px 0 0' : 'margin:4px 0 0' }, String(v))))),
        list.length ? h('div', { class: 'grid' }, list.map(p => {
          const s = sm.get(p.id) || 0;
          const low = bajoMin(p);
          return h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, p.nombre), h('div', { class: 'muted mono' }, `${p.sku}${p.categoria ? ' · ' + p.categoria : ''}`)),
              h('span', { class: 'pill ' + (s <= 0 ? 'red' : low ? 'amber' : 'green') }, `${s} u.`)),
            h('div', { class: 'muted' }, `Costo ${money(p.costo)} · Precio ${money(p.precio)}`, low ? h('strong', { style: 'color:#b7791f' }, `  ⚠ mínimo ${p.stockMin}`) : null),
            h('div', { class: 'card-foot' },
              h('button', { class: 'btn small', onclick: () => openHistorial(p.id) }, 'Historial'),
              editable ? h('div', { class: 'actions' }, h('button', { class: 'btn small', onclick: () => openMovimiento(p.id) }, '± Movimiento'), h('button', { class: 'btn small', onclick: () => openProducto(p.id) }, '✏️')) : null));
        })) : h('div', { class: 'empty' }, prods.length ? 'Ningún producto coincide.' : 'Todavía no hay productos. Se crean solos al recibir una compra, o con “+ Producto”.'));
    };
    render();
    return store.onChange(() => render());
  },
};
