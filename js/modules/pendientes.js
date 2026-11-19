// Módulos que se construyen a continuación (uno por vez). Quedan registrados con su alcance previsto.

import { h } from '../core/ui.js';

function pendiente({ id, perm, label, icon, title, descripcion, funciones }) {
  return {
    id, perm, label, icon, title,
    mount(root) {
      root.append(
        h('div', { class: 'card placeholder' },
          h('span', { class: 'pill amber' }, 'Próximo módulo'),
          h('h2', {}, label),
          h('p', {}, descripcion),
          h('h4', {}, 'Alcance previsto'),
          h('ul', { class: 'bullets' }, funciones.map(f => h('li', {}, f)))));
    },
  };
}

export const compras = pendiente({
  id: 'compras', perm: 'compras', label: 'Compras', icon: '🛒', title: 'Compras',
  descripcion: 'Pedidos a proveedores desde el catálogo, recepción de mercadería y cuenta corriente.',
  funciones: ['Orden de compra / nota de pedido por proveedor', 'Recepción total o parcial (alimenta el stock)', 'Cuenta corriente y pagos a proveedores', 'Historial y comparación de costos'],
});

export const stock = pendiente({
  id: 'stock', perm: 'stock', label: 'Stock', icon: '📦', title: 'Stock',
  descripcion: 'Productos con SKU, existencias y movimientos.',
  funciones: ['Productos, variantes y fotos', 'Movimientos: ingreso, egreso y ajuste', 'Stock mínimo con alertas', 'Costo y valorización del inventario', 'Escaneo de código de barras con la cámara del celular'],
});

export const ventas = pendiente({
  id: 'ventas', perm: 'ventas', label: 'Ventas', icon: '💰', title: 'Ventas',
  descripcion: 'Pedidos de la tienda online, WhatsApp e Instagram; cobros y envíos.',
  funciones: ['Presupuestos y pedidos con estados', 'Cobros y medios de pago', 'Envíos y devoluciones', 'Margen por venta', 'Comprobante según condición fiscal vigente (hoy: monotributo / Factura C)'],
});

export const admin = pendiente({
  id: 'admin', perm: 'admin', label: 'Administración', icon: '⚙️', title: 'Administración',
  descripcion: 'Gestión del negocio: equipo, caja y reportes.',
  funciones: ['Usuarios y asignación de roles a medida que crece el equipo', 'Caja y gastos', 'Clientes', 'Dashboard y reportes exportables'],
});
