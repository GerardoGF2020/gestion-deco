// Lógica compartida de inventario: el stock es la suma de los movimientos de cada producto.
// movimiento = { id, productoId, tipo: ingreso|egreso|ajuste, cantidad (con signo), fecha, ref, nota }

import * as store from './store.js';

export const hoy = () => new Date().toISOString().slice(0, 10);
export const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export function stockMap() {
  const m = new Map();
  store.list('movimientos').forEach(x => m.set(x.productoId, (m.get(x.productoId) || 0) + (Number(x.cantidad) || 0)));
  return m;
}
export const stockOf = id => stockMap().get(id) || 0;

export function mover({ productoId, tipo, cantidad, ref = '', nota = '', fecha }) {
  const qty = Number(cantidad) || 0;
  if (!qty) return null;
  return store.put('movimientos', { productoId, tipo, cantidad: qty, ref, nota, fecha: fecha || hoy() });
}

export function nextSku() {
  const nums = store.list('productos').map(p => parseInt(String(p.sku || '').replace(/\D/g, ''), 10)).filter(Number.isFinite);
  return 'DEC-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

export function findProducto(nombre) {
  const n = norm(nombre);
  return store.list('productos').find(p => norm(p.nombre) === n);
}

export function crearProducto(data) {
  return store.put('productos', {
    sku: data.sku || nextSku(), nombre: data.nombre, categoria: data.categoria || '',
    costo: Number(data.costo) || 0, precio: Number(data.precio) || 0, stockMin: Number(data.stockMin) || 0,
    codigoBarras: data.codigoBarras || '', proveedorId: data.proveedorId || '', activo: true,
  });
}

export const totalCompra = c => Number(c.total) || (c.items || []).reduce((a, i) => a + (Number(i.subtotal) || 0), 0);
export const pagadoCompra = c => (c.pagos || []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
export const totalItemsVenta = v => (v.items || []).reduce((a, i) => a + i.cantidad * i.precio, 0);
export const totalVenta = v => Math.max(0, totalItemsVenta(v) - (Number(v.descuento) || 0) + (Number(v.envio) || 0));
export const pagadoVenta = v => (v.pagos || []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
export const margenVenta = v => totalItemsVenta(v) - (Number(v.descuento) || 0) - (v.items || []).reduce((a, i) => a + i.cantidad * (i.costo || 0), 0);

export const waLink = (tel, msg) => {
  const t = String(tel || '').replace(/\D/g, '');
  return `https://wa.me/${t}?text=${encodeURIComponent(msg)}`;
};

export function csvDownload(filename, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = '\ufeff' + rows.map(r => r.map(esc).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
}

// ---------- Operaciones de Deshacer / Anular Seguras ----------
export function deshacerVenta(id, autorizante) {
  const v = structuredClone(store.get('ventas', id));
  if (!v || v.estado === 'cancelado') return false;
  // Reponer stock si fue descontado
  if (v.stockDescontado) {
    (v.items || []).forEach(i => {
      if (i.productoId) {
        mover({ productoId: i.productoId, tipo: 'ingreso', cantidad: i.cantidad, ref: v.id, nota: `Anulación venta #${v.numero}` });
      }
    });
    v.stockDescontado = false;
  }
  v.estado = 'cancelado';
  v.anuladoPor = autorizante?.nombre || 'Administrador';
  v.fechaAnulacion = new Date().toISOString();
  store.put('ventas', v);
  store.log('ANULAR_VENTA', `Venta #${v.numero} anulada por ${autorizante?.nombre || 'Admin'}`);
  return true;
}

export function deshacerCompra(id, autorizante) {
  const c = structuredClone(store.get('compras', id));
  if (!c || c.estado === 'cancelada') return false;
  // Restar de inventario la cantidad recibida
  (c.items || []).forEach(i => {
    const recibido = Number(i.recibido) || 0;
    if (recibido > 0) {
      const p = store.list('productos').find(prod => norm(prod.nombre) === norm(i.descripcion));
      if (p) {
        mover({ productoId: p.id, tipo: 'egreso', cantidad: -recibido, ref: c.id, nota: `Anulación compra ${c.notaPedido || ''}` });
      }
      i.recibido = 0;
    }
  });
  c.estado = 'cancelada';
  c.anuladoPor = autorizante?.nombre || 'Administrador';
  c.fechaAnulacion = new Date().toISOString();
  store.put('compras', c);
  store.log('ANULAR_COMPRA', `Compra "${c.notaPedido || id}" anulada por ${autorizante?.nombre || 'Admin'}`);
  return true;
}

export function deshacerGasto(id, autorizante) {
  const g = store.get('gastos', id);
  if (!g) return false;
  store.remove('gastos', id);
  store.log('ANULAR_GASTO', `Gasto "${g.concepto}" ($${g.monto}) anulado por ${autorizante?.nombre || 'Admin'}`);
  return true;
}

export function obtenerOperacionesRecientes(limite = 20) {
  const ops = [];
  // Ventas no canceladas
  store.list('ventas').filter(v => v.estado !== 'cancelado').forEach(v => {
    const cl = store.get('clientes', v.clienteId)?.nombre || 'Consumidor final';
    ops.push({
      id: v.id,
      tipo: 'venta',
      icon: '🛍️',
      tipoLabel: 'Venta #' + v.numero,
      titulo: `Venta #${v.numero} a ${cl}`,
      detalle: `${(v.items || []).length} productos · Estado: ${v.estado}`,
      monto: totalVenta(v),
      fecha: v.fecha || v.updatedAt,
      raw: v
    });
  });

  // Compras no canceladas
  store.list('compras').filter(c => c.estado !== 'cancelada').forEach(c => {
    const prov = store.get('proveedores', c.proveedorId)?.nombre || 'Proveedor';
    ops.push({
      id: c.id,
      tipo: 'compra',
      icon: '📥',
      tipoLabel: 'Compra: ' + (c.notaPedido || prov),
      titulo: `Pedido a ${prov}`,
      detalle: `${(c.items || []).length} ítems · Estado: ${c.estado}`,
      monto: totalCompra(c),
      fecha: c.fecha || c.updatedAt,
      raw: c
    });
  });

  // Gastos
  store.list('gastos').forEach(g => {
    ops.push({
      id: g.id,
      tipo: 'gasto',
      icon: '💵',
      tipoLabel: 'Gasto de caja',
      titulo: `Gasto: ${g.concepto}`,
      detalle: g.categoria || 'Caja general',
      monto: Number(g.monto) || 0,
      fecha: g.fecha,
      raw: g
    });
  });

  ops.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return ops.slice(0, limite);
}
