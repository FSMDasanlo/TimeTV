import { MIEMBROS, Storage } from './storage.js';

const $ = id => document.getElementById(id);

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
const COLORES = { papa: '#3b82f6', mama: '#ec4899', dani: '#f59e0b', sandra: '#a855f7', lorena: '#3ddc84' };
const avisados = new Set();

function tiempoHoy(id) {
  const ini = new Date().setHours(0, 0, 0, 0);
  const a = Storage.activa();
  const lista = Storage.sesiones();
  if (a) lista.push({ miembro: a.miembro, inicio: a.inicio, fin: Date.now() });
  return lista.filter(s => s.miembro === id)
    .reduce((t, s) => t + Math.max(0, s.fin - Math.max(s.inicio, ini)), 0);
}

const fmtFecha = t => new Date(t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const nombreDe = id => (MIEMBROS.find(m => m.id === id) || {}).nombre || id;
const aISO = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Sesiones filtradas (solapamiento con el rango, recortando al rango)
function consultar() {
  const desde = $('desde').value ? new Date($('desde').value + 'T00:00:00').getTime() : -Infinity;
  const hasta = $('hasta').value ? new Date($('hasta').value + 'T23:59:59.999').getTime() : Infinity;
  const persona = $('persona').value;
  const lista = Storage.sesiones();
  const a = Storage.activa();
  if (a) lista.push({ id: null, miembro: a.miembro, inicio: a.inicio, fin: Date.now() });
  return lista
    .filter(s => (!persona || s.miembro === persona) && s.fin >= desde && s.inicio <= hasta)
    .map(s => ({ ...s, dur: Math.min(s.fin, hasta) - Math.max(s.inicio, desde) }))
    .sort((x, y) => y.inicio - x.inicio);
}

function crearCajas() {
  $('cajas').innerHTML = MIEMBROS.map(m => `
    <button class="caja" data-id="${m.id}" style="background-image:url('img/${m.id}.jpg')">
      <span class="info"><b>${m.nombre}</b><span class="total">00:00:00</span><span class="hoy"></span></span>
    </button>`).join('');
  $('persona').innerHTML += MIEMBROS.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
  $('leyenda').innerHTML = MIEMBROS.map(m => `<span><b style="background:${COLORES[m.id]}"></b>${m.nombre}</span>`).join('');
  $('limites').innerHTML = MIEMBROS.map(m =>
    `<label>${m.nombre}<input type="number" min="0" step="5" data-id="${m.id}" value="0"></label>`).join('');
  $('limites').addEventListener('change', e => {
    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
    avisados.delete(e.target.dataset.id);
    Storage.guardarLimite(e.target.dataset.id, v);
  });
  $('cajas').addEventListener('click', e => {
    const caja = e.target.closest('.caja');
    if (!caja) return;
    const a = Storage.activa();
    if (a && a.miembro === caja.dataset.id) Storage.parar();
    else Storage.iniciar(caja.dataset.id);
    refrescar();
  });
}

// Totales de todos los tiempos para las cajas (+ sesión activa en vivo)
function pintarCajas() {
  const tot = {};
  Storage.sesiones().forEach(s => tot[s.miembro] = (tot[s.miembro] || 0) + s.fin - s.inicio);
  const a = Storage.activa();
  document.querySelectorAll('.caja').forEach(c => {
    const id = c.dataset.id;
    const activa = a && a.miembro === id;
    c.classList.toggle('activa', !!activa);
    c.querySelector('.total').textContent = fmt((tot[id] || 0) + (activa ? Date.now() - a.inicio : 0));

    const hoy = tiempoHoy(id);
    const lim = (Storage.limites()[id] || 0) * 60000;
    const excedido = lim > 0 && hoy >= lim;
    c.classList.toggle('excedido', excedido);
    c.querySelector('.hoy').textContent = `Hoy ${fmt(hoy)}` + (lim ? ` / ${fmt(lim)}` : '');
    if (excedido && activa && !avisados.has(id)) {
      avisados.add(id);
      setTimeout(() => alert(`${nombreDe(id)} ha agotado su límite diario de TV.`), 50);
    }
  });
  document.querySelectorAll('#limites input').forEach(i => {
    if (document.activeElement !== i) i.value = Storage.limites()[i.dataset.id] || 0;
  });
  $('btnParar').hidden = !a;
  $('estado').textContent = a ? `${nombreDe(a.miembro)} tiene el mando: ${fmt(Date.now() - a.inicio)}` : 'Nadie tiene el mando';
}

function pintarConsulta() {
  const datos = consultar();
  const tot = {};
  datos.forEach(s => tot[s.miembro] = (tot[s.miembro] || 0) + s.dur);
  const rank = MIEMBROS.map(m => ({ ...m, t: tot[m.id] || 0 })).sort((a, b) => b.t - a.t);
  const max = rank[0].t || 1;
  const suma = rank.reduce((x, r) => x + r.t, 0);
  $('ranking').innerHTML = rank.map((r, i) => `
    <div class="fila">
      <span class="pos">${i + 1}º</span><span class="nom">${r.nombre}</span>
      <span class="barra"><i style="width:${(r.t / max) * 100}%"></i></span>
      <span class="tt">${fmt(r.t)} (${suma ? Math.round(r.t / suma * 100) : 0}%)</span>
    </div>`).join('');
  const dias = {};
  datos.forEach(s => {
    const k = aISO(new Date(s.inicio));
    (dias[k] = dias[k] || {})[s.miembro] = ((dias[k] || {})[s.miembro] || 0) + s.dur;
  });
  const claves = Object.keys(dias).sort().slice(-31);
  const totDia = k => Object.values(dias[k]).reduce((x, y) => x + y, 0);
  const maxDia = Math.max(1, ...claves.map(totDia));
  $('grafica').innerHTML = claves.map(k => `
    <div class="dia" title="${k}: ${fmt(totDia(k))}">
      <div class="pila">${MIEMBROS.filter(m => dias[k][m.id]).map(m =>
        `<i style="height:${dias[k][m.id] / maxDia * 100}%;background:${COLORES[m.id]}" title="${m.nombre}: ${fmt(dias[k][m.id])}"></i>`).join('')}</div>
      ${k.slice(8)}/${k.slice(5, 7)}
    </div>`).join('') || 'Sin datos';
  $('historial').innerHTML = datos.map(s => `
    <tr><td>${nombreDe(s.miembro)}</td><td>${fmtFecha(s.inicio)}</td>
    <td>${s.id === null ? 'en curso' : fmtFecha(s.fin)}</td><td>${fmt(s.dur)}</td>
    <td>${s.id === null ? '' : `<button class="del" data-id="${s.id}" title="Borrar">✕</button>`}</td></tr>`).join('')
    || '<tr><td colspan="5">Sin datos</td></tr>';
}

function refrescar() { pintarCajas(); pintarConsulta(); }

function rango(desde, hasta) {
  $('desde').value = desde ? aISO(desde) : '';
  $('hasta').value = hasta ? aISO(hasta) : '';
  pintarConsulta();
}

function exportarCsv() {
  const filas = [['Persona', 'Inicio', 'Fin', 'Segundos']].concat(
    consultar().filter(s => s.id !== null).map(s =>
      [nombreDe(s.miembro), new Date(s.inicio).toISOString(), new Date(s.fin).toISOString(), Math.round(s.dur / 1000)]));
  const blob = new Blob([filas.map(f => f.join(';')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'timetv.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

crearCajas();
$('btnParar').onclick = () => { Storage.parar(); refrescar(); };
['desde', 'hasta', 'persona'].forEach(id => $(id).addEventListener('change', pintarConsulta));
$('btnHoy').onclick = () => rango(new Date(), new Date());
$('btnSemana').onclick = () => rango(new Date(Date.now() - 6 * 864e5), new Date());
$('btnMes').onclick = () => { const h = new Date(); rango(new Date(h.getFullYear(), h.getMonth(), 1), h); };
$('btnTodo').onclick = () => rango(null, null);
$('btnCsv').onclick = exportarCsv;
$('btnHistorial').onclick = () => {
  const contenido = $('historialContenido');
  contenido.hidden = !contenido.hidden;
  $('btnHistorial').textContent = contenido.hidden ? 'Mostrar historial' : 'Ocultar historial';
  $('btnHistorial').setAttribute('aria-expanded', String(!contenido.hidden));
};
$('historial').addEventListener('click', e => {
  const b = e.target.closest('.del');
  if (b && confirm('¿Borrar este registro?')) { Storage.borrar(Number(b.dataset.id)); refrescar(); }
});

Storage.alCambiar(refrescar);
refrescar();
setInterval(refrescar, 1000);
