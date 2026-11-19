// AJUSTES: conexión con Google Drive, datos del negocio, condición fiscal y copias de seguridad.

import * as store from '../core/store.js';
import * as drive from '../core/drive.js';
import { h, toast, field, confirmDialog, fmtDateTime } from '../core/ui.js';
import { can, currentUser } from '../core/auth.js';

const CONDICIONES = {
  monotributo: { label: 'Monotributo', comprobantes: 'Factura C (y notas de crédito/débito C)', nota: 'No discrimina IVA.' },
  responsable_inscripto: { label: 'Responsable Inscripto', comprobantes: 'Factura A (a responsables inscriptos) y Factura B (a consumidores finales)', nota: 'Discrimina IVA: el precio de venta se maneja neto + IVA.' },
  exento: { label: 'IVA Exento', comprobantes: 'Factura B', nota: 'Consultar con el contador.' },
};
const CATEGORIAS_MONO = 'ABCDEFGHIJK'.split('');

const STATUS_TXT = {
  noconfig: 'Sin configurar', disconnected: 'Desconectado', syncing: 'Sincronizando…',
  ok: 'Sincronizado', pending: 'Cambios pendientes', offline: 'Sin conexión', error: 'Error',
};

function download(filename, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: filename });
  document.body.append(a); a.click(); a.remove();
}

export default {
  id: 'ajustes',
  perm: null,
  label: 'Ajustes',
  icon: '🔧',
  title: 'Ajustes',
  mount(root) {
    const driveCard = h('section', { class: 'card' });
    const bizCard = h('section', { class: 'card' });
    const fiscalCard = h('section', { class: 'card' });
    const dataCard = h('section', { class: 'card' });
    root.append(h('div', { class: 'stack' }, driveCard, bizCard, fiscalCard, dataCard));

    // ----- Google Drive -----
    const clientInput = h('input', { placeholder: 'xxxx.apps.googleusercontent.com', value: store.getLocal().clientId || '' });
    function renderDrive() {
      const loc = store.getLocal();
      const st = drive.getStatus();
      driveCard.replaceChildren(
        h('h2', {}, 'Sincronización con Google Drive'),
        h('p', { class: 'muted' }, 'Los datos se guardan en un archivo de tu Drive y se comparten entre celular y PC. Para sumar a otra persona, compartí ese archivo (“gestion-deco-data.json”) con su cuenta de Google como Editor y que se conecte desde su dispositivo.'),
        field('Client ID de Google (OAuth)', clientInput, 'Se obtiene una sola vez en Google Cloud Console. Ver README.'),
        h('div', { class: 'actions wrap' },
          h('button', { class: 'btn', onclick: () => { store.setLocal({ clientId: clientInput.value.trim() }); toast('Client ID guardado'); drive.start(); renderDrive(); } }, 'Guardar Client ID'),
          loc.connected
            ? [h('button', { class: 'btn primary', onclick: () => drive.sync() }, 'Sincronizar ahora'),
               h('button', { class: 'btn danger ghost', onclick: () => { drive.disconnect(); renderDrive(); } }, 'Desconectar')]
            : h('button', { class: 'btn primary', disabled: !loc.clientId, onclick: async () => { try { await drive.connect(); } catch (e) { toast(e.message, 'err'); } renderDrive(); } }, 'Conectar con Google')),
        h('dl', { class: 'info' },
          h('dt', {}, 'Estado'), h('dd', {}, (STATUS_TXT[st.state] || st.state) + (st.msg ? ` — ${st.msg}` : '')),
          h('dt', {}, 'Cuenta'), h('dd', {}, loc.email || '—'),
          h('dt', {}, 'Última sincronización'), h('dd', {}, fmtDateTime(loc.lastSync)),
          h('dt', {}, 'Tu rol'), h('dd', {}, (() => { const u = currentUser(); return u.rol ? (store.config().roles[u.rol]?.label || u.rol) + (u.virtual ? ' (propietario, aún no hay usuarios cargados)' : '') : 'Sin acceso asignado'; })())));
    }

    // ----- Negocio -----
    function renderBiz() {
      const cfg = store.config();
      const editable = can('admin', 2);
      const name = h('input', { value: cfg.nombreNegocio, disabled: !editable });
      bizCard.replaceChildren(
        h('h2', {}, 'Negocio'),
        field('Nombre del negocio', name),
        editable ? h('button', { class: 'btn', onclick: () => { store.setConfig({ nombreNegocio: name.value.trim() || cfg.nombreNegocio }); toast('Guardado'); } }, 'Guardar') : null);
    }

    // ----- Facturación -----
    function renderFiscal() {
      const cfg = store.config();
      const f = cfg.fiscal;
      const editable = can('admin', 2);
      const cond = h('select', { disabled: !editable }, Object.entries(CONDICIONES).map(([k, v]) => h('option', { value: k, selected: k === f.condicion }, v.label)));
      const cat = h('select', { disabled: !editable }, h('option', { value: '' }, '—'), CATEGORIAS_MONO.map(c => h('option', { value: c, selected: c === f.categoria }, c)));
      const cuit = h('input', { value: f.cuit, placeholder: '20-12345678-9', disabled: !editable });
      const pv = h('input', { value: f.puntoVenta, placeholder: 'Ej. 1', disabled: !editable });
      const info = h('div', { class: 'notice' });
      const refreshInfo = () => {
        const c = CONDICIONES[cond.value];
        info.replaceChildren(h('strong', {}, 'Comprobantes: '), c.comprobantes, h('br'), c.nota);
        cat.disabled = !editable || cond.value !== 'monotributo';
      };
      cond.addEventListener('change', refreshInfo);
      fiscalCard.replaceChildren(
        h('h2', {}, 'Condición fiscal'),
        h('p', { class: 'muted' }, 'Arrancás como monotributista. Cuando cambies de condición, las ventas nuevas usan la nueva y las anteriores conservan la condición con la que se emitieron (queda un historial).'),
        h('div', { class: 'two-col' }, field('Condición frente al IVA', cond), field('Categoría de monotributo', cat)),
        h('div', { class: 'two-col' }, field('CUIT', cuit), field('Punto de venta', pv)),
        info,
        h('p', { class: 'muted' }, 'Importante: este módulo no emite facturas electrónicas por sí solo. La integración con ARCA (ex AFIP) se evalúa cuando armemos Ventas.'),
        editable ? h('button', { class: 'btn primary', onclick: () => {
          const historial = [...(f.historial || [])];
          if (cond.value !== f.condicion || !historial.length) historial.push({ desde: Date.now(), condicion: cond.value });
          store.setConfig({ fiscal: { condicion: cond.value, categoria: cond.value === 'monotributo' ? cat.value : '', cuit: cuit.value.trim(), puntoVenta: pv.value.trim(), historial } });
          toast('Condición fiscal guardada');
        } }, 'Guardar') : h('p', { class: 'muted' }, 'Solo un administrador puede modificar esto.'),
        (f.historial || []).length ? h('details', {}, h('summary', {}, 'Historial de condición fiscal'),
          f.historial.map(x => h('div', { class: 'muted' }, `${new Date(x.desde).toLocaleDateString('es-AR')} → ${CONDICIONES[x.condicion]?.label || x.condicion}`))) : null);
      refreshInfo();
    }

    // ----- Datos -----
    function renderData() {
      const file = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const res = store.merge(JSON.parse(await f.text()));
          toast(res.pulled ? 'Copia importada y fusionada' : 'La copia no tenía datos más nuevos');
        } catch { toast('Archivo inválido', 'err'); }
        e.target.value = '';
      } });
      dataCard.replaceChildren(
        h('h2', {}, 'Copias de seguridad'),
        h('p', { class: 'muted' }, 'Además de Drive, podés bajar una copia completa a tu equipo.'),
        h('div', { class: 'actions wrap' },
          h('button', { class: 'btn', onclick: () => download(`gestion-deco-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.snapshot(), null, 2)) }, 'Descargar copia'),
          h('button', { class: 'btn', disabled: !can('admin', 2), onclick: () => file.click() }, 'Importar copia'),
          h('button', { class: 'btn danger ghost', disabled: !can('admin', 2), onclick: async () => {
            if (await confirmDialog('Se borran los datos de ESTE dispositivo y se vuelve a cargar el catálogo inicial. Lo que ya está en Drive no se toca. ¿Seguir?', 'Borrar datos locales')) {
              await store.resetLocal(); location.reload();
            }
          } }, 'Reiniciar este dispositivo'),
          file));
    }

    renderDrive(); renderBiz(); renderFiscal(); renderData();
    const offStatus = drive.onStatus(() => renderDrive());
    const offStore = store.onChange(src => { if (src === 'remote') { renderBiz(); renderFiscal(); } });
    return () => { offStatus(); offStore(); };
  },
};
