// Módulo CATÁLOGO: proveedores de la feria, búsqueda, filtros, seguimiento (estado, favoritos, notas)
// y alta/edición de proveedores. Las compras de cada proveedor se muestran en su ficha.

import * as store from '../core/store.js';
import { h, chip, openModal, toast, confirmDialog, money, fmtDate, field, copyText } from '../core/ui.js';
import { can } from '../core/auth.js';

export const ESTADOS = {
  sin_contactar: { label: 'Sin contactar', cls: 'gray' },
  contactado: { label: 'Contactado', cls: 'blue' },
  cotizado: { label: 'Cotizado', cls: 'amber' },
  comprado: { label: 'Comprado', cls: 'green' },
  descartado: { label: 'Descartado', cls: 'red' },
};

// Los filtros se conservan al cambiar de módulo.
const view = { q: '', cat: '', estado: '', fav: false, sort: 'nombre' };

const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const standNum = p => { const n = parseInt(p.stand, 10); return Number.isNaN(n) ? 1e9 : n; };
const standKey = p => `${p.stand}|${p.pabellon}`;
const validInsta = v => /^[\w.]{1,30}$/.test(v || '');
const splitList = (txt, sep = /[,\n]/) => String(txt || '').split(sep).map(s => s.trim()).filter(Boolean);

function haystack(p) {
  return norm([p.nombre, p.categoria, p.stand, p.notas, ...(p.subcategorias || []), ...(p.materiales || []), ...(p.productos || []), ...(p.palabrasClave || [])].join(' '));
}

function duplicateStands(list) {
  const map = new Map();
  list.forEach(p => { if (p.stand) (map.get(standKey(p)) || map.set(standKey(p), []).get(standKey(p))).push(p); });
  return [...map.values()].filter(a => a.length > 1);
}

const waLink = tel => `https://wa.me/${tel.replace(/\D/g, '')}`;

function estadoPill(p) {
  const e = ESTADOS[p.estado] || ESTADOS.sin_contactar;
  return h('span', { class: 'pill ' + e.cls }, e.label);
}

function contactLinks(p) {
  const links = [];
  (p.telefonos || []).slice(0, 1).forEach(t =>
    links.push(h('a', { class: 'btn small wa', href: waLink(t), target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, 'WhatsApp')));
  if (validInsta(p.instagram))
    links.push(h('a', { class: 'btn small', href: `https://instagram.com/${p.instagram}`, target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, 'Instagram'));
  return links;
}

// ---------- Ficha de proveedor ----------
function openDetail(id) {
  const p = store.get('proveedores', id);
  if (!p) return;
  const editable = can('catalogo', 2);
  const compras = store.list('compras').filter(c => c.proveedorId === id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const save = patch => store.put('proveedores', { ...store.get('proveedores', id), ...patch });

  const estadoSel = h('select', { disabled: !editable, onchange: e => { save({ estado: e.target.value }); toast('Estado actualizado'); } },
    Object.entries(ESTADOS).map(([k, v]) => h('option', { value: k, selected: k === p.estado }, v.label)));
  const notas = h('textarea', { rows: 3, placeholder: 'Condiciones, mínimos, plazos, con quién hablaste…', disabled: !editable, onchange: e => { save({ notas: e.target.value }); toast('Nota guardada'); } });
  notas.value = p.notas || '';

  const phoneRows = (p.telefonos || []).map(t =>
    h('div', { class: 'row' }, h('span', { class: 'mono' }, t),
      h('button', { class: 'btn small', onclick: () => copyText(t) }, 'Copiar'),
      h('a', { class: 'btn small wa', href: waLink(t), target: '_blank', rel: 'noopener' }, 'WhatsApp')));

  const body = h('div', { class: 'detail' },
    h('div', { class: 'detail-top' },
      h('div', { class: 'stand-badge' }, h('small', {}, 'Stand'), h('strong', {}, p.stand || '—'), h('small', {}, p.pabellon || '')),
      h('div', {}, h('div', { class: 'chips' }, chip(p.categoria, 'cat'), (p.subcategorias || []).map(s => chip(s))),
        h('div', { class: 'muted' }, 'Pabellón ' + (p.pabellon || '—')))),
    h('div', { class: 'two-col' },
      field('Estado', estadoSel),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Favorito'),
        h('button', { class: 'btn', disabled: !editable, onclick: e => { const n = !store.get('proveedores', id).favorito; save({ favorito: n }); e.currentTarget.textContent = n ? '★ Quitar de favoritos' : '☆ Marcar favorito'; } },
          p.favorito ? '★ Quitar de favoritos' : '☆ Marcar favorito'))),
    h('h4', {}, 'Productos'),
    h('ul', { class: 'bullets' }, (p.productos || []).map(x => h('li', {}, x))),
    (p.materiales || []).length ? [h('h4', {}, 'Materiales'), h('div', { class: 'chips' }, p.materiales.map(m => chip(m)))] : null,
    (p.palabrasClave || []).length ? [h('h4', {}, 'Palabras clave'), h('div', { class: 'chips' }, p.palabrasClave.map(m => chip(m, 'soft')))] : null,
    h('h4', {}, 'Contacto'),
    phoneRows.length ? phoneRows : h('p', { class: 'muted' }, 'Sin teléfono cargado.'),
    p.instagram
      ? h('div', { class: 'row' }, h('span', {}, '@' + p.instagram),
          validInsta(p.instagram) ? h('a', { class: 'btn small', href: `https://instagram.com/${p.instagram}`, target: '_blank', rel: 'noopener' }, 'Abrir Instagram')
            : h('span', { class: 'pill red' }, 'Usuario inválido: revisar'))
      : h('p', { class: 'muted' }, 'Sin Instagram.'),
    h('h4', {}, 'Notas'), notas,
    h('h4', {}, `Compras (${compras.length})`),
    compras.length
      ? compras.map(c => h('div', { class: 'row purchase' },
          h('div', {}, h('strong', {}, c.notaPedido || 'Compra'), h('div', { class: 'muted' }, `${fmtDate(c.fecha)} · ${c.items?.length || 0} ítems · ${c.estado || ''}`)),
          h('strong', {}, money(c.total))))
      : h('p', { class: 'muted' }, 'Todavía no hay compras a este proveedor.'));

  const footer = editable ? [
    h('button', { class: 'btn danger ghost', onclick: async () => {
      if (await confirmDialog(`¿Eliminar a "${p.nombre}" del catálogo?`, 'Eliminar')) { store.remove('proveedores', id); m.close(); toast('Proveedor eliminado'); }
    } }, 'Eliminar'),
    h('button', { class: 'btn primary', onclick: () => { m.close(); openForm(store.get('proveedores', id)); } }, 'Editar datos'),
  ] : null;

  const m = openModal({ title: p.nombre, body, footer, wide: true });
}

// ---------- Alta / edición ----------
function openForm(existing) {
  const p = existing || { nombre: '', stand: '', pabellon: 'Azul', categoria: '', subcategorias: [], materiales: [], productos: [], palabrasClave: [], telefonos: [], instagram: '', estado: 'sin_contactar', favorito: false, notas: '' };
  const cats = [...new Set(store.list('proveedores').map(x => x.categoria).filter(Boolean))].sort();
  const i = {
    nombre: h('input', { value: p.nombre, required: true, placeholder: 'Nombre de la marca' }),
    stand: h('input', { value: p.stand, placeholder: 'Ej. 126' }),
    pabellon: h('input', { value: p.pabellon, list: 'pabellones' }),
    categoria: h('input', { value: p.categoria, list: 'categorias', placeholder: 'Ej. Textil' }),
    subs: h('input', { value: (p.subcategorias || []).join(', '), placeholder: 'Separadas por coma' }),
    mats: h('input', { value: (p.materiales || []).join(', '), placeholder: 'Separados por coma' }),
    prods: h('textarea', { rows: 4, placeholder: 'Un producto por línea' }),
    tels: h('input', { value: (p.telefonos || []).join(', '), placeholder: '+5491112345678, separados por coma' }),
    insta: h('input', { value: p.instagram || '', placeholder: 'usuario sin @' }),
    kw: h('input', { value: (p.palabrasClave || []).join(', '), placeholder: 'Separadas por coma' }),
  };
  i.prods.value = (p.productos || []).join('\n');

  const submit = () => {
    if (!i.nombre.value.trim()) return toast('Falta el nombre', 'err');
    const rec = {
      ...p,
      nombre: i.nombre.value.trim(),
      stand: i.stand.value.trim(),
      pabellon: i.pabellon.value.trim(),
      categoria: i.categoria.value.trim() || 'Sin categoría',
      subcategorias: splitList(i.subs.value),
      materiales: splitList(i.mats.value),
      productos: splitList(i.prods.value, /\n/),
      telefonos: splitList(i.tels.value),
      instagram: i.insta.value.trim().replace(/^@/, '') || null,
      palabrasClave: splitList(i.kw.value),
    };
    if (!rec.id) rec.id = store.uid();
    store.put('proveedores', rec);
    toast(existing ? 'Proveedor actualizado' : 'Proveedor agregado');
    m.close();
  };

  const body = h('form', { class: 'form', onsubmit: e => { e.preventDefault(); submit(); } },
    h('datalist', { id: 'categorias' }, cats.map(c => h('option', { value: c }))),
    h('datalist', { id: 'pabellones' }, ['Azul', 'Verde', 'Rojo', 'Amarillo'].map(c => h('option', { value: c }))),
    field('Nombre *', i.nombre),
    h('div', { class: 'two-col' }, field('Stand', i.stand), field('Pabellón', i.pabellon)),
    field('Categoría principal', i.categoria),
    field('Subcategorías', i.subs),
    field('Materiales', i.mats),
    field('Productos', i.prods),
    field('Teléfonos', i.tels),
    field('Instagram', i.insta),
    field('Palabras clave', i.kw),
    h('button', { type: 'submit', hidden: true }));

  const m = openModal({
    title: existing ? 'Editar proveedor' : 'Nuevo proveedor',
    body,
    wide: true,
    footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: submit }, 'Guardar')],
  });
}

// ---------- Listado ----------
function card(p, editable) {
  return h('article', { class: 'card prov', tabindex: 0, onclick: () => openDetail(p.id), onkeydown: e => { if (e.key === 'Enter') openDetail(p.id); } },
    h('div', { class: 'card-head' },
      h('div', {}, h('h3', {}, p.nombre), h('div', { class: 'muted' }, `Stand ${p.stand || '—'} · ${p.pabellon || '—'}`)),
      h('button', { class: 'icon-btn star' + (p.favorito ? ' on' : ''), disabled: !editable, 'aria-label': 'Favorito',
        onclick: e => { e.stopPropagation(); store.put('proveedores', { ...p, favorito: !p.favorito }); } }, p.favorito ? '★' : '☆')),
    h('div', { class: 'chips' }, chip(p.categoria, 'cat'), (p.subcategorias || []).slice(0, 2).map(s => chip(s))),
    h('p', { class: 'prods' }, (p.productos || []).slice(0, 3).join(' · ')),
    h('div', { class: 'card-foot' }, estadoPill(p), h('div', { class: 'actions' }, contactLinks(p))));
}

export default {
  id: 'catalogo',
  perm: 'catalogo',
  label: 'Catálogo',
  icon: '📒',
  title: 'Catálogo de proveedores',
  mount(root) {
    const editable = () => can('catalogo', 2);

    const q = h('input', { type: 'search', class: 'grow', placeholder: 'Buscar proveedor, producto, material, stand…', value: view.q, oninput: e => { view.q = e.target.value; renderResults(); } });
    const catSel = h('select', { onchange: e => { view.cat = e.target.value; renderResults(); } });
    const estSel = h('select', { onchange: e => { view.estado = e.target.value; renderResults(); } },
      h('option', { value: '' }, 'Todos los estados'),
      Object.entries(ESTADOS).map(([k, v]) => h('option', { value: k, selected: view.estado === k }, v.label)));
    const sortSel = h('select', { onchange: e => { view.sort = e.target.value; renderResults(); } },
      [['nombre', 'Orden: nombre'], ['stand', 'Orden: stand (recorrido)'], ['categoria', 'Orden: categoría']].map(([k, l]) => h('option', { value: k, selected: view.sort === k }, l)));
    const favBtn = h('button', { class: 'btn' + (view.fav ? ' primary' : ''), onclick: () => { view.fav = !view.fav; favBtn.classList.toggle('primary', view.fav); renderResults(); } }, '★ Favoritos');
    const addBtn = h('button', { class: 'btn primary', onclick: () => openForm(null) }, '+ Proveedor');

    const summary = h('div', { class: 'summary muted' });
    const alerts = h('div', {});
    const grid = h('div', { class: 'grid' });

    function fillCats() {
      const cats = [...new Set(store.list('proveedores').map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      if (view.cat && !cats.includes(view.cat)) view.cat = '';
      catSel.replaceChildren(h('option', { value: '' }, 'Todas las categorías'), ...cats.map(c => h('option', { value: c, selected: c === view.cat }, c)));
    }

    function renderResults() {
      const all = store.list('proveedores');
      fillCats();
      const terms = norm(view.q).split(/\s+/).filter(Boolean);
      let res = all.filter(p =>
        (!view.cat || p.categoria === view.cat) &&
        (!view.estado || p.estado === view.estado) &&
        (!view.fav || p.favorito) &&
        terms.every(t => haystack(p).includes(t)));
      const sorters = {
        nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
        stand: (a, b) => standNum(a) - standNum(b) || a.nombre.localeCompare(b.nombre, 'es'),
        categoria: (a, b) => (a.categoria || '').localeCompare(b.categoria || '', 'es') || a.nombre.localeCompare(b.nombre, 'es'),
      };
      res.sort(sorters[view.sort]);

      summary.textContent = `${res.length} de ${all.length} proveedores`;
      const dups = duplicateStands(all);
      alerts.replaceChildren(...(dups.length ? [h('details', { class: 'notice warn' },
        h('summary', {}, `⚠ ${dups.length} stand(s) con más de un proveedor: revisar datos`),
        dups.map(g => h('div', {}, `Stand ${g[0].stand} (${g[0].pabellon}): `, g.map((p, idx) => [idx ? ' · ' : '', h('a', { href: '#', onclick: e => { e.preventDefault(); openDetail(p.id); } }, p.nombre)]))))] : []));

      grid.replaceChildren(...(res.length ? res.map(p => card(p, editable())) : [h('div', { class: 'empty' }, 'No hay proveedores con esos filtros.')]));
    }

    root.append(
      h('div', { class: 'toolbar' }, q, catSel, estSel, sortSel, favBtn, editable() ? addBtn : null),
      summary, alerts, grid);
    renderResults();

    return store.onChange(() => renderResults());
  },
};
