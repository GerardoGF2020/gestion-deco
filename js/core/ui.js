// Utilidades de interfaz compartidas. Se construye el DOM sin innerHTML para evitar inyección de HTML.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) return k.forEach(add);
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}

export const chip = (text, cls = '') => h('span', { class: 'chip ' + cls }, text);

export function toast(msg, kind = '') {
  const t = h('div', { class: 'toast ' + kind }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('hide'), 2800);
  setTimeout(() => t.remove(), 3300);
}

export function openModal({ title, body, footer, wide = false }) {
  const root = document.getElementById('modalRoot');
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (!root.children.length) document.body.classList.remove('modal-open');
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const overlay = h(
    'div',
    { class: 'overlay', onmousedown: e => { if (e.target === overlay) close(); } },
    h(
      'div',
      { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Cerrar' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, footer) : null
    )
  );
  root.append(overlay);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKey);
  return { close };
}

export function confirmDialog(message, okLabel = 'Confirmar') {
  return new Promise(resolve => {
    const m = openModal({
      title: 'Confirmar',
      body: h('p', {}, message),
      footer: [
        h('button', { class: 'btn', onclick: () => { m.close(); resolve(false); } }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: () => { m.close(); resolve(true); } }, okLabel),
      ],
    });
  });
}

const moneyFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
export const money = n => moneyFmt.format(Number(n) || 0);
export const fmtDate = iso => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
export const fmtDateTime = ms => (ms ? new Date(ms).toLocaleString('es-AR') : '—');

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
}

export function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copiado'), () => toast('No se pudo copiar', 'err'));
}
