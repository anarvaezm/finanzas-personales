/* =========================================================
   Mis Finanzas — lógica principal
   ========================================================= */

// ---------- Categorías ----------
const CAT = {
  ingreso: {
    sueldo: ['💼', 'Sueldo'],
    extra: ['⭐', 'Extra'],
    otro: ['💵', 'Otro'],
  },
  gasto: {
    comida: ['🍔', 'Comida'],
    transporte: ['🚌', 'Transporte'],
    entretenimiento: ['🎬', 'Entretenimiento'],
    otro: ['📦', 'Otro'],
  },
  gusto: {
    ropa: ['👕', 'Ropa y accesorios'],
    salidas: ['🍻', 'Salidas'],
    antojos: ['🍫', 'Antojos'],
    tecnologia: ['📱', 'Tecnología'],
    otro: ['✨', 'Otro capricho'],
  },
  fijo: {
    arriendo: ['🏠', 'Arriendo'],
    servicios: ['💡', 'Servicios'],
    internet: ['🌐', 'Internet / celular'],
    cuotas: ['💳', 'Cuotas / créditos'],
    suscripciones: ['📺', 'Suscripciones'],
    otro: ['📌', 'Otro'],
  },
};

const COLORES = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#84cc16', '#f97316', '#64748b'];

// ---------- Estado ----------
let datos = Storage.cargar();
let mes = hoyISO().slice(0, 7);
let tab = 'resumen';

// ---------- Utilidades ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function miles(n) {
  return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Formato COP: $1.250.000
function cop(n) {
  return (n < 0 ? '-$' : '$') + miles(n);
}

function parseMonto(texto) {
  return Number(String(texto).replace(/\D/g, '')) || 0;
}

const mesDe = (fecha) => (fecha || '').slice(0, 7);
const suma = (lista) => lista.reduce((s, x) => s + Number(x.monto || 0), 0);
const signoAhorro = (a) => (a.tipo === 'retiro' ? -1 : 1);

function nombreMes(m) {
  const [a, mm] = m.split('-').map(Number);
  const t = new Date(a, mm - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function diasDelMes(m) {
  const [a, mm] = m.split('-').map(Number);
  return new Date(a, mm, 0).getDate();
}

function moverMes(m, delta) {
  const [a, mm] = m.split('-').map(Number);
  const d = new Date(a, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Si estoy viendo el mes actual, la fecha por defecto es hoy; si no, el día 1 de ese mes.
function fechaPorDefecto() {
  const hoy = hoyISO();
  return mesDe(hoy) === mes ? hoy : `${mes}-01`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cat(tipo, clave) {
  return CAT[tipo][clave] || CAT[tipo].otro;
}

function persistir() {
  if (!Storage.guardar(datos)) toast('⚠️ No se pudo guardar. Revisa el espacio del navegador.');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Cálculos ----------
function estadoFijos(m) {
  const hoy = hoyISO();
  const mesHoy = mesDe(hoy);
  const pagosMes = datos.pagosFijos.filter((p) => p.mes === m);

  const filas = datos.fijos
    .filter((f) => f.activo !== false)
    .map((f) => {
      const dia = Math.min(Number(f.dia) || 1, diasDelMes(m));
      const vence = `${m}-${String(dia).padStart(2, '0')}`;
      const pago = pagosMes.find((p) => p.fijoId === f.id);
      let estado, texto;
      if (pago) {
        estado = 'pagado'; texto = `Pagado el ${fechaCorta(pago.fecha)}`;
      } else if (m < mesHoy || (m === mesHoy && vence < hoy)) {
        estado = 'vencido'; texto = `Vencido (día ${dia})`;
      } else if (m === mesHoy) {
        const faltan = Math.round((new Date(vence) - new Date(hoy)) / 86400000);
        estado = faltan <= 5 ? 'proximo' : 'pendiente';
        texto = faltan === 0 ? 'Vence hoy' : faltan === 1 ? 'Vence mañana' : `Vence en ${faltan} días`;
      } else {
        estado = 'pendiente'; texto = `Vence el día ${dia}`;
      }
      return { fijo: f, nombre: f.nombre, categoria: f.categoria, monto: pago ? pago.monto : f.monto, dia, pago, estado, texto };
    });

  // Pagos de fijos que ya se eliminaron: se siguen mostrando como pagados
  pagosMes
    .filter((p) => !datos.fijos.some((f) => f.id === p.fijoId))
    .forEach((p) => filas.push({ fijo: null, nombre: p.nombre, categoria: p.categoria, monto: p.monto, dia: Number(p.fecha.slice(8)), pago: p, estado: 'pagado', texto: `Pagado el ${fechaCorta(p.fecha)}` }));

  return filas.sort((a, b) => (!!a.pago - !!b.pago) || a.dia - b.dia);
}

function calcular(m) {
  const ingresos = datos.ingresos.filter((x) => mesDe(x.fecha) === m);
  const gastos = datos.gastos.filter((x) => mesDe(x.fecha) === m);
  const variables = gastos.filter((g) => g.tipo !== 'gusto');
  const gustos = gastos.filter((g) => g.tipo === 'gusto');
  const pagos = datos.pagosFijos.filter((p) => p.mes === m);
  const ahorros = datos.ahorros.filter((a) => mesDe(a.fecha) === m);
  const fijos = estadoFijos(m);

  const tIngresos = suma(ingresos);
  const tVariables = suma(variables);
  const tGustos = suma(gustos);
  const tFijos = suma(pagos);
  const tAhorro = ahorros.reduce((s, a) => s + signoAhorro(a) * a.monto, 0);
  const tGastos = tVariables + tGustos + tFijos;
  const tPendiente = suma(fijos.filter((f) => !f.pago));
  const saldo = tIngresos - tGastos - tAhorro;

  return { ingresos, variables, gustos, pagos, ahorros, fijos, tIngresos, tVariables, tGustos, tFijos, tAhorro, tGastos, tPendiente, saldo };
}

function totalAhorrado(metaId) {
  return datos.ahorros
    .filter((a) => metaId === undefined || a.metaId === metaId)
    .reduce((s, a) => s + signoAhorro(a) * a.monto, 0);
}

function saldoAcumulado() {
  return suma(datos.ingresos) - suma(datos.gastos) - suma(datos.pagosFijos) - totalAhorrado();
}

// ---------- Componentes de vista ----------
function itemHTML({ icono, titulo, sub, monto, clase = '', col, id, extra = '' }) {
  return `
    <li class="item">
      <div class="item-icon">${icono}</div>
      <div class="item-main">
        <div class="item-title">${esc(titulo)}</div>
        <div class="item-sub">${sub}</div>
      </div>
      <div class="item-right">
        <div class="item-amount ${clase}">${monto}</div>
        <div class="item-actions">
          ${extra}
          <button class="mini" data-action="editar" data-col="${col}" data-id="${id}" aria-label="Editar">✏️</button>
          <button class="mini" data-action="eliminar" data-col="${col}" data-id="${id}" aria-label="Eliminar">🗑️</button>
        </div>
      </div>
    </li>`;
}

function listaVacia(texto) {
  return `<div class="empty">${texto}</div>`;
}

function ordenarPorFecha(lista) {
  return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function donut(segmentos) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  if (!total) return listaVacia('Aún no hay gastos este mes.');
  let acumulado = 0;
  const arcos = segmentos.map((s, i) => {
    const pct = (s.valor / total) * 100;
    const arco = `<circle r="15.915" cx="21" cy="21" fill="none" stroke="${COLORES[i % COLORES.length]}" stroke-width="6"
      stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${25 - acumulado}"></circle>`;
    acumulado += pct;
    return arco;
  }).join('');
  const leyenda = segmentos.map((s, i) => `
    <li><span class="dot" style="background:${COLORES[i % COLORES.length]}"></span>
      <span class="ley-nombre">${s.icono} ${esc(s.nombre)}</span>
      <span class="ley-valor">${cop(s.valor)} <small>${Math.round((s.valor / total) * 100)}%</small></span></li>`).join('');
  return `
    <div class="chart">
      <svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Gastos por categoría">
        <circle r="15.915" cx="21" cy="21" fill="none" stroke="var(--line)" stroke-width="6"></circle>
        ${arcos}
        <text x="21" y="20" class="donut-label">Total</text>
        <text x="21" y="25.5" class="donut-total">${cop(total)}</text>
      </svg>
      <ul class="legend">${leyenda}</ul>
    </div>`;
}

function gastosPorCategoria(c) {
  const mapa = {};
  const add = (clave, icono, nombre, valor) => {
    mapa[clave] = mapa[clave] || { icono, nombre, valor: 0 };
    mapa[clave].valor += Number(valor);
  };
  c.variables.forEach((g) => { const [i, n] = cat('gasto', g.categoria); add('g-' + g.categoria, i, n, g.monto); });
  if (c.tGustos) add('gustos', '🎁', 'Gustos', c.tGustos);
  c.pagos.forEach((p) => { const [i, n] = cat('fijo', p.categoria); add('f-' + p.categoria, i, n, p.monto); });
  return Object.values(mapa).sort((a, b) => b.valor - a.valor);
}

function barras(segmentos) {
  const max = Math.max(...segmentos.map((s) => s.valor), 1);
  return `<ul class="bars">${segmentos.map((s, i) => `
    <li><div class="bar-top"><span>${s.icono} ${esc(s.nombre)}</span><b>${cop(s.valor)}</b></div>
    <div class="bar"><span style="width:${(s.valor / max) * 100}%;background:${COLORES[i % COLORES.length]}"></span></div></li>`).join('')}</ul>`;
}

function badge(estado, texto) {
  return `<span class="badge ${estado}">${texto}</span>`;
}

function filaFijo(f) {
  const [icono] = cat('fijo', f.categoria);
  const accion = f.pago
    ? `<button class="btn small ghost" data-action="desmarcarPago" data-id="${f.pago.id}">Deshacer</button>`
    : `<button class="btn small primary" data-action="marcarPago" data-id="${f.fijo.id}">✓ Pagar</button>`;
  const editar = f.fijo
    ? `<button class="mini" data-action="editar" data-col="fijos" data-id="${f.fijo.id}" aria-label="Editar">✏️</button>
       <button class="mini" data-action="eliminar" data-col="fijos" data-id="${f.fijo.id}" aria-label="Eliminar">🗑️</button>`
    : '';
  const editarPago = f.pago
    ? `<button class="mini" data-action="editar" data-col="pagosFijos" data-id="${f.pago.id}" aria-label="Editar pago">✏️</button>` : '';
  return `
    <li class="item ${f.pago ? 'pagado' : ''}">
      <div class="item-icon">${icono}</div>
      <div class="item-main">
        <div class="item-title">${esc(f.nombre)}</div>
        <div class="item-sub">${badge(f.estado, f.texto)}</div>
      </div>
      <div class="item-right">
        <div class="item-amount">${cop(f.monto)}</div>
        <div class="item-actions">${accion}${f.fijo ? editar : editarPago}</div>
      </div>
    </li>`;
}

// ---------- Vistas ----------
const vistas = {
  resumen() {
    const c = calcular(mes);
    const proximos = c.fijos.filter((f) => !f.pago).slice(0, 4);
    const ultimos = ordenarPorFecha([
      ...c.ingresos.map((x) => ({ ...x, _t: 'ingreso' })),
      ...c.variables.map((x) => ({ ...x, _t: 'gasto' })),
      ...c.gustos.map((x) => ({ ...x, _t: 'gusto' })),
    ]).slice(0, 5);
    const pctGustos = c.tIngresos ? Math.round((c.tGustos / c.tIngresos) * 100) : 0;

    return `
      <section class="hero ${c.saldo < 0 ? 'negativo' : ''}">
        <div class="hero-label">Saldo disponible · ${nombreMes(mes)}</div>
        <div class="hero-valor">${cop(c.saldo)}</div>
        <div class="hero-sub">
          ${c.tPendiente ? `Después de pagos pendientes: <b>${cop(c.saldo - c.tPendiente)}</b><br>` : ''}
          Saldo acumulado (todos los meses): ${cop(saldoAcumulado())}
        </div>
      </section>

      <section class="stats">
        <div class="stat ingreso"><span>💵 Ingresos</span><b>${cop(c.tIngresos)}</b></div>
        <div class="stat gasto"><span>🛒 Gastos</span><b>${cop(c.tGastos)}</b></div>
        <div class="stat ahorro"><span>🐷 Ahorrado</span><b>${cop(c.tAhorro)}</b></div>
        <div class="stat gusto"><span>🎁 Gustos</span><b>${cop(c.tGustos)}</b><small>${pctGustos}% de tus ingresos</small></div>
      </section>

      <section class="quick">
        <button class="btn quick-btn ingreso" data-action="nuevo" data-col="ingresos">＋ Ingreso</button>
        <button class="btn quick-btn gasto" data-action="nuevo" data-col="gastos">＋ Gasto</button>
        <button class="btn quick-btn gusto" data-action="nuevo" data-col="gustos">＋ Gusto</button>
        <button class="btn quick-btn ahorro" data-action="nuevo" data-col="ahorros">＋ Ahorro</button>
      </section>

      <section class="card">
        <div class="card-head"><h3>📅 Próximos pagos</h3><button class="link" data-tab-go="fijos">Ver todos</button></div>
        ${proximos.length ? `<ul class="list">${proximos.map(filaFijo).join('')}</ul>`
          : listaVacia(c.fijos.length ? '🎉 ¡Todos los pagos fijos de este mes están al día!' : 'Registra tus pagos fijos en la pestaña “Fijos”.')}
      </section>

      <section class="card">
        <div class="card-head"><h3>📊 Gastos por categoría</h3></div>
        ${donut(gastosPorCategoria(c))}
      </section>

      <section class="card">
        <div class="card-head"><h3>🕒 Últimos movimientos</h3></div>
        ${ultimos.length ? `<ul class="list">${ultimos.map((x) => {
          const tipo = x._t;
          const [icono, nombre] = cat(tipo, x.categoria);
          const col = tipo === 'ingreso' ? 'ingresos' : tipo === 'gusto' ? 'gustos' : 'gastos';
          return itemHTML({ icono, titulo: x.descripcion || nombre, sub: `${nombre} · ${fechaCorta(x.fecha)}`,
            monto: (tipo === 'ingreso' ? '+' : '-') + cop(x.monto), clase: tipo === 'ingreso' ? 'pos' : 'neg', col, id: x.id });
        }).join('')}</ul>` : listaVacia('Todavía no hay movimientos en este mes.')}
      </section>`;
  },

  ingresos() {
    const c = calcular(mes);
    const lista = ordenarPorFecha(c.ingresos);
    return `
      <section class="section-head">
        <div><h2>Ingresos</h2><p class="muted">${nombreMes(mes)}</p></div>
        <div class="total pos">${cop(c.tIngresos)}</div>
      </section>
      <button class="btn primary block" data-action="nuevo" data-col="ingresos">＋ Agregar ingreso</button>
      <section class="card">
        ${lista.length ? `<ul class="list">${lista.map((x) => {
          const [icono, nombre] = cat('ingreso', x.categoria);
          return itemHTML({ icono, titulo: x.descripcion || nombre, sub: `${nombre} · ${fechaCorta(x.fecha)}`, monto: '+' + cop(x.monto), clase: 'pos', col: 'ingresos', id: x.id });
        }).join('')}</ul>` : listaVacia('No hay ingresos registrados en este mes.')}
      </section>`;
  },

  gastos() {
    const c = calcular(mes);
    const lista = ordenarPorFecha(c.variables);
    const porCat = {};
    c.variables.forEach((g) => { porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.monto); });
    const segs = Object.entries(porCat).map(([k, v]) => { const [i, n] = cat('gasto', k); return { icono: i, nombre: n, valor: v }; }).sort((a, b) => b.valor - a.valor);
    return `
      <section class="section-head">
        <div><h2>Gastos variables</h2><p class="muted">${nombreMes(mes)}</p></div>
        <div class="total neg">${cop(c.tVariables)}</div>
      </section>
      <button class="btn primary block" data-action="nuevo" data-col="gastos">＋ Agregar gasto</button>
      ${segs.length ? `<section class="card">${barras(segs)}</section>` : ''}
      <section class="card">
        ${lista.length ? `<ul class="list">${lista.map((x) => {
          const [icono, nombre] = cat('gasto', x.categoria);
          return itemHTML({ icono, titulo: x.descripcion || nombre, sub: `${nombre} · ${fechaCorta(x.fecha)}`, monto: '-' + cop(x.monto), clase: 'neg', col: 'gastos', id: x.id });
        }).join('')}</ul>` : listaVacia('No hay gastos registrados en este mes.')}
      </section>`;
  },

  gustos() {
    const c = calcular(mes);
    const lista = ordenarPorFecha(c.gustos);
    const porCat = {};
    c.gustos.forEach((g) => { porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.monto); });
    const segs = Object.entries(porCat).map(([k, v]) => { const [i, n] = cat('gusto', k); return { icono: i, nombre: n, valor: v }; }).sort((a, b) => b.valor - a.valor);
    const pctIng = c.tIngresos ? Math.round((c.tGustos / c.tIngresos) * 100) : 0;
    const pctGas = c.tGastos ? Math.round((c.tGustos / c.tGastos) * 100) : 0;
    return `
      <section class="section-head">
        <div><h2>Gustos y caprichos</h2><p class="muted">${nombreMes(mes)}</p></div>
        <div class="total gusto-c">${cop(c.tGustos)}</div>
      </section>
      <section class="stats two">
        <div class="stat gusto"><span>De tus ingresos</span><b>${pctIng}%</b></div>
        <div class="stat gusto"><span>De tus gastos</span><b>${pctGas}%</b></div>
      </section>
      <button class="btn primary block" data-action="nuevo" data-col="gustos">＋ Agregar gusto</button>
      ${segs.length ? `<section class="card">${barras(segs)}</section>` : ''}
      <section class="card">
        ${lista.length ? `<ul class="list">${lista.map((x) => {
          const [icono, nombre] = cat('gusto', x.categoria);
          return itemHTML({ icono, titulo: x.descripcion || nombre, sub: `${nombre} · ${fechaCorta(x.fecha)}`, monto: '-' + cop(x.monto), clase: 'neg', col: 'gustos', id: x.id });
        }).join('')}</ul>` : listaVacia('Sin gustos este mes. ¡Bien ahí! 😄')}
      </section>`;
  },

  fijos() {
    const c = calcular(mes);
    const total = suma(c.fijos);
    return `
      <section class="section-head">
        <div><h2>Pagos fijos</h2><p class="muted">${nombreMes(mes)}</p></div>
        <div class="total">${cop(total)}</div>
      </section>
      <section class="stats two">
        <div class="stat ingreso"><span>✅ Pagado</span><b>${cop(c.tFijos)}</b></div>
        <div class="stat gasto"><span>⏳ Por pagar</span><b>${cop(c.tPendiente)}</b></div>
      </section>
      <button class="btn primary block" data-action="nuevo" data-col="fijos">＋ Agregar pago fijo</button>
      <section class="card">
        ${c.fijos.length ? `<ul class="list">${c.fijos.map(filaFijo).join('')}</ul>`
          : listaVacia('Agrega pagos que se repiten cada mes: arriendo, servicios, internet, cuotas, suscripciones…')}
      </section>`;
  },

  ahorros() {
    const c = calcular(mes);
    const lista = ordenarPorFecha(c.ahorros);
    const metas = datos.metas.map((m) => {
      const llevo = totalAhorrado(m.id);
      const pct = m.objetivo ? Math.min(100, Math.round((llevo / m.objetivo) * 100)) : 0;
      return `
        <li class="meta">
          <div class="meta-top">
            <b>🎯 ${esc(m.nombre)}</b>
            <span class="item-actions">
              <button class="btn small primary" data-action="aportar" data-id="${m.id}">＋ Aportar</button>
              <button class="mini" data-action="editar" data-col="metas" data-id="${m.id}" aria-label="Editar meta">✏️</button>
              <button class="mini" data-action="eliminar" data-col="metas" data-id="${m.id}" aria-label="Eliminar meta">🗑️</button>
            </span>
          </div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="meta-sub"><span>${cop(llevo)} de ${cop(m.objetivo)}</span><b>${pct >= 100 ? '🎉 ¡Meta cumplida!' : pct + '%'}</b></div>
        </li>`;
    }).join('');
    return `
      <section class="hero ahorro">
        <div class="hero-label">Total ahorrado</div>
        <div class="hero-valor">${cop(totalAhorrado())}</div>
        <div class="hero-sub">Apartado en ${nombreMes(mes)}: <b>${cop(c.tAhorro)}</b></div>
      </section>
      <div class="row-btns">
        <button class="btn primary" data-action="nuevo" data-col="ahorros">＋ Apartar ahorro</button>
        <button class="btn ghost" data-action="nuevo" data-col="metas">🎯 Nueva meta</button>
      </div>
      <section class="card">
        <div class="card-head"><h3>🎯 Metas</h3></div>
        ${metas ? `<ul class="metas">${metas}</ul>` : listaVacia('Crea una meta, por ejemplo: “Viaje – $2.000.000”.')}
      </section>
      <section class="card">
        <div class="card-head"><h3>Movimientos de ${nombreMes(mes)}</h3></div>
        ${lista.length ? `<ul class="list">${lista.map((x) => {
          const meta = datos.metas.find((m) => m.id === x.metaId);
          const retiro = x.tipo === 'retiro';
          return itemHTML({ icono: retiro ? '↩️' : '🐷', titulo: x.descripcion || (retiro ? 'Retiro de ahorro' : 'Ahorro'),
            sub: `${meta ? '🎯 ' + esc(meta.nombre) : 'Ahorro libre'} · ${fechaCorta(x.fecha)}`,
            monto: (retiro ? '-' : '+') + cop(x.monto), clase: retiro ? 'neg' : 'pos', col: 'ahorros', id: x.id });
        }).join('')}</ul>` : listaVacia('No has apartado ahorro este mes.')}
      </section>`;
  },

  ajustes() {
    return `
      <section class="section-head"><div><h2>Ajustes</h2><p class="muted">Tus datos se guardan solo en este navegador.</p></div></section>
      <section class="card stack">
        <p>💾 <b>Copia de seguridad.</b> Descarga tus datos a un archivo para no perderlos (por ejemplo si borras el historial del navegador) o para pasarlos a otro dispositivo.</p>
        <button class="btn primary" data-action="exportar">⬇️ Descargar copia</button>
        <label class="btn ghost file-btn">⬆️ Restaurar copia<input type="file" accept="application/json,.json" id="archivoImportar"></label>
      </section>
      <section class="card stack">
        <p>🧪 ¿Quieres ver cómo funciona? Carga algunos datos de ejemplo.</p>
        <button class="btn ghost" data-action="ejemplo">Cargar datos de ejemplo</button>
      </section>
      <section class="card stack">
        <p>⚠️ Borrar todo elimina todos tus registros de este navegador.</p>
        <button class="btn danger" data-action="borrarTodo">Borrar todos los datos</button>
      </section>
      <button class="btn ghost block" data-tab-go="resumen">← Volver al inicio</button>`;
  },
};

// ---------- Formularios ----------
function opciones(tipo) {
  return Object.entries(CAT[tipo]).map(([v, [i, n]]) => ({ valor: v, texto: `${i} ${n}` }));
}

function formulario(col, item) {
  switch (col) {
    case 'ingresos':
      return { titulo: item ? 'Editar ingreso' : 'Agregar ingreso', campos: [
        { name: 'monto', label: 'Monto', type: 'money', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Sueldo de octubre' },
        { name: 'categoria', label: 'Categoría', type: 'select', options: opciones('ingreso') },
        { name: 'fecha', label: 'Fecha de pago', type: 'date', required: true },
      ] };
    case 'gastos':
      return { titulo: item ? 'Editar gasto' : 'Agregar gasto', campos: [
        { name: 'monto', label: 'Monto', type: 'money', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Mercado' },
        { name: 'categoria', label: 'Categoría', type: 'select', options: opciones('gasto') },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ] };
    case 'gustos':
      return { titulo: item ? 'Editar gusto' : 'Agregar gusto', campos: [
        { name: 'monto', label: 'Monto', type: 'money', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Tenis nuevos' },
        { name: 'categoria', label: 'Tipo de gusto', type: 'select', options: opciones('gusto') },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ] };
    case 'fijos':
      return { titulo: item ? 'Editar pago fijo' : 'Agregar pago fijo', campos: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Arriendo apartamento' },
        { name: 'monto', label: 'Monto mensual', type: 'money', required: true },
        { name: 'categoria', label: 'Categoría', type: 'select', options: opciones('fijo') },
        { name: 'dia', label: 'Día de pago (1 a 31)', type: 'number', min: 1, max: 31, required: true },
      ] };
    case 'pagosFijos':
      return { titulo: item && item.id ? 'Editar pago' : `Pagar: ${item.nombre}`, campos: [
        { name: 'monto', label: 'Monto pagado', type: 'money', required: true },
        { name: 'fecha', label: 'Fecha en que pagaste', type: 'date', required: true },
      ] };
    case 'metas':
      return { titulo: item ? 'Editar meta' : 'Nueva meta de ahorro', campos: [
        { name: 'nombre', label: 'Nombre de la meta', type: 'text', required: true, placeholder: 'Ej: Viaje' },
        { name: 'objetivo', label: 'Valor de la meta', type: 'money', required: true },
      ] };
    case 'ahorros':
      return { titulo: item && item.id ? 'Editar ahorro' : 'Apartar ahorro', campos: [
        { name: 'tipo', label: 'Movimiento', type: 'select', options: [
          { valor: 'aporte', texto: '🐷 Guardar dinero' }, { valor: 'retiro', texto: '↩️ Sacar dinero del ahorro' }] },
        { name: 'monto', label: 'Monto', type: 'money', required: true },
        { name: 'metaId', label: 'Meta', type: 'select', options: [
          { valor: '', texto: 'Ahorro libre (sin meta)' }, ...datos.metas.map((m) => ({ valor: m.id, texto: '🎯 ' + m.nombre }))] },
        { name: 'descripcion', label: 'Nota (opcional)', type: 'text', placeholder: 'Ej: Ahorro de la quincena' },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ] };
  }
}

// Las colecciones de la vista se guardan en estas listas de "datos"
const COLECCION = { ingresos: 'ingresos', gastos: 'gastos', gustos: 'gastos', fijos: 'fijos', pagosFijos: 'pagosFijos', metas: 'metas', ahorros: 'ahorros' };

function campoHTML(c, valor) {
  const v = valor ?? '';
  const req = c.required ? 'required' : '';
  let input;
  if (c.type === 'select') {
    input = `<select name="${c.name}">${c.options.map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(v) ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
  } else if (c.type === 'money') {
    input = `<div class="money"><span>$</span><input name="${c.name}" inputmode="numeric" autocomplete="off" placeholder="0" value="${v ? miles(v) : ''}" ${req}></div>`;
  } else {
    const extra = c.type === 'number' ? `min="${c.min}" max="${c.max}" inputmode="numeric"` : '';
    input = `<input type="${c.type}" name="${c.name}" value="${esc(v)}" placeholder="${esc(c.placeholder || '')}" ${extra} ${req}>`;
  }
  return `<label class="field"><span>${c.label}</span>${input}</label>`;
}

let alGuardarModal = null;

function abrirModal(titulo, campos, valores, alGuardar) {
  document.getElementById('modalTitulo').textContent = titulo;
  document.getElementById('modalCampos').innerHTML = campos.map((c) => campoHTML(c, valores[c.name])).join('');
  alGuardarModal = (form) => {
    const vals = {};
    for (const c of campos) {
      const el = form.elements[c.name];
      vals[c.name] = c.type === 'money' ? parseMonto(el.value) : c.type === 'number' ? Number(el.value) : el.value.trim();
      if (c.type === 'money' && c.required && vals[c.name] <= 0) {
        el.focus(); toast('Escribe un monto mayor a cero'); return false;
      }
    }
    alGuardar(vals);
    return true;
  };
  const modal = document.getElementById('modal');
  modal.showModal();
  const primero = modal.querySelector('input, select');
  if (primero && window.matchMedia('(pointer: fine)').matches) primero.focus();
}

function abrirFormulario(col, item, valoresIniciales = {}) {
  const { titulo, campos } = formulario(col, item);
  const valores = item ? { ...item, ...valoresIniciales } : {
    fecha: fechaPorDefecto(), categoria: Object.keys(CAT[{ ingresos: 'ingreso', gastos: 'gasto', gustos: 'gusto', fijos: 'fijo' }[col] || 'gasto'])[0],
    tipo: 'aporte', metaId: '', ...valoresIniciales,
  };
  abrirModal(titulo, campos, valores, (vals) => {
    const lista = datos[COLECCION[col]];
    if (col === 'ahorros') vals.metaId = vals.metaId || null;
    if (col === 'pagosFijos') vals.mes = vals.mes || valores.mes;

    if (item && item.id) {
      Object.assign(lista.find((x) => x.id === item.id), vals);
      toast('✅ Cambios guardados');
    } else {
      const nuevo = { id: uid(), ...valores, ...vals };
      if (col === 'gustos') nuevo.tipo = 'gusto';
      if (col === 'gastos') nuevo.tipo = 'variable';
      if (col === 'fijos') nuevo.activo = true;
      lista.push(nuevo);
      toast('✅ Guardado');
    }
    persistir();
    render();
  });
}

// ---------- Acciones ----------
function buscar(col, id) {
  return datos[COLECCION[col]].find((x) => x.id === id);
}

const acciones = {
  nuevo: ({ col }) => abrirFormulario(col, null),

  editar: ({ col, id }) => {
    const item = buscar(col, id);
    // Un gasto puede ser variable o gusto: usar el formulario correcto
    const colReal = col === 'gastos' || col === 'gustos' ? (item.tipo === 'gusto' ? 'gustos' : 'gastos') : col;
    abrirFormulario(colReal, item);
  },

  eliminar: ({ col, id }) => {
    const item = buscar(col, id);
    const nombre = item.descripcion || item.nombre || 'este registro';
    if (col === 'fijos') {
      if (!confirm(`¿Eliminar el pago fijo “${nombre}”?\nLos pagos que ya registraste se conservan en el historial.`)) return;
    } else if (col === 'metas') {
      if (!confirm(`¿Eliminar la meta “${nombre}”?\nEl dinero aportado queda como ahorro libre.`)) return;
      datos.ahorros.forEach((a) => { if (a.metaId === id) a.metaId = null; });
    } else if (!confirm(`¿Eliminar “${nombre}” por ${cop(item.monto)}?`)) return;
    const lista = datos[COLECCION[col]];
    lista.splice(lista.indexOf(item), 1);
    persistir();
    render();
    toast('🗑️ Eliminado');
  },

  // Registra el pago de un fijo para el mes que se está viendo
  marcarPago: ({ id }) => {
    const f = datos.fijos.find((x) => x.id === id);
    const dia = Math.min(Number(f.dia) || 1, diasDelMes(mes));
    const hoy = hoyISO();
    const fecha = mesDe(hoy) === mes ? hoy : `${mes}-${String(dia).padStart(2, '0')}`;
    const { campos } = formulario('pagosFijos', { nombre: f.nombre });
    abrirModal(`Pagar: ${f.nombre}`, campos, { monto: f.monto, fecha }, (vals) => {
      datos.pagosFijos.push({ id: uid(), fijoId: f.id, nombre: f.nombre, categoria: f.categoria, mes, ...vals });
      persistir();
      render();
      toast('✅ Pago registrado');
    });
  },

  desmarcarPago: ({ id }) => {
    datos.pagosFijos = datos.pagosFijos.filter((p) => p.id !== id);
    persistir();
    render();
    toast('Pago marcado como pendiente');
  },

  aportar: ({ id }) => abrirFormulario('ahorros', null, { metaId: id }),

  exportar: () => {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mis-finanzas-${hoyISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  ejemplo: () => {
    if (!confirm('Se agregarán datos de ejemplo al mes que estás viendo. ¿Continuar?')) return;
    cargarEjemplo();
    persistir();
    tab = 'resumen';
    render();
    toast('🧪 Datos de ejemplo cargados');
  },

  borrarTodo: () => {
    if (!confirm('¿Seguro que quieres borrar TODOS tus datos? Esto no se puede deshacer.')) return;
    datos = Storage.vacio();
    persistir();
    tab = 'resumen';
    render();
    toast('Datos borrados');
  },
};

function cargarEjemplo() {
  const d = (dia) => `${mes}-${String(Math.min(dia, diasDelMes(mes))).padStart(2, '0')}`;
  const meta = { id: uid(), nombre: 'Viaje', objetivo: 2000000 };
  const arriendo = { id: uid(), nombre: 'Arriendo', monto: 900000, categoria: 'arriendo', dia: 5, activo: true };
  datos.ingresos.push(
    { id: uid(), monto: 3500000, descripcion: 'Sueldo', categoria: 'sueldo', fecha: d(1) },
    { id: uid(), monto: 250000, descripcion: 'Trabajo independiente', categoria: 'extra', fecha: d(12) });
  datos.gastos.push(
    { id: uid(), monto: 320000, descripcion: 'Mercado', categoria: 'comida', fecha: d(3), tipo: 'variable' },
    { id: uid(), monto: 120000, descripcion: 'Recargas transporte', categoria: 'transporte', fecha: d(4), tipo: 'variable' },
    { id: uid(), monto: 45000, descripcion: 'Cine', categoria: 'entretenimiento', fecha: d(9), tipo: 'variable' },
    { id: uid(), monto: 180000, descripcion: 'Tenis', categoria: 'ropa', fecha: d(10), tipo: 'gusto' },
    { id: uid(), monto: 38000, descripcion: 'Helado y postres', categoria: 'antojos', fecha: d(14), tipo: 'gusto' });
  datos.fijos.push(arriendo,
    { id: uid(), nombre: 'Internet hogar', monto: 95000, categoria: 'internet', dia: 15, activo: true },
    { id: uid(), nombre: 'Luz y agua', monto: 160000, categoria: 'servicios', dia: 20, activo: true },
    { id: uid(), nombre: 'Netflix', monto: 38900, categoria: 'suscripciones', dia: 28, activo: true });
  datos.pagosFijos.push({ id: uid(), fijoId: arriendo.id, nombre: arriendo.nombre, categoria: arriendo.categoria, mes, monto: 900000, fecha: d(5) });
  datos.metas.push(meta);
  datos.ahorros.push({ id: uid(), monto: 400000, descripcion: 'Ahorro quincena', metaId: meta.id, fecha: d(2), tipo: 'aporte' });
}

// ---------- Render y eventos ----------
function render() {
  document.getElementById('mesTexto').textContent = nombreMes(mes);
  document.getElementById('mesInput').value = mes;
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('vista').innerHTML = vistas[tab]();
}

function irA(nuevaTab) {
  tab = nuevaTab;
  render();
  window.scrollTo({ top: 0 });
}

document.getElementById('tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) irA(b.dataset.tab);
});

document.getElementById('vista').addEventListener('click', (e) => {
  const ir = e.target.closest('[data-tab-go]');
  if (ir) return irA(ir.dataset.tabGo);
  const b = e.target.closest('[data-action]');
  if (b && acciones[b.dataset.action]) acciones[b.dataset.action](b.dataset);
});

document.getElementById('vista').addEventListener('change', (e) => {
  if (e.target.id !== 'archivoImportar' || !e.target.files[0]) return;
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const importado = JSON.parse(lector.result);
      if (!importado || !Array.isArray(importado.ingresos)) throw new Error('formato');
      if (!confirm('Esto reemplazará tus datos actuales por los de la copia. ¿Continuar?')) return;
      datos = { ...Storage.vacio(), ...importado };
      persistir();
      tab = 'resumen';
      render();
      toast('✅ Copia restaurada');
    } catch {
      toast('⚠️ El archivo no es una copia válida');
    }
  };
  lector.readAsText(e.target.files[0]);
});

document.getElementById('btnAjustes').addEventListener('click', () => irA('ajustes'));
document.getElementById('mesAnterior').addEventListener('click', () => { mes = moverMes(mes, -1); render(); });
document.getElementById('mesSiguiente').addEventListener('click', () => { mes = moverMes(mes, 1); render(); });
document.getElementById('mesInput').addEventListener('change', (e) => { if (e.target.value) { mes = e.target.value; render(); } });

// Modal
const modal = document.getElementById('modal');
document.getElementById('modalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (alGuardarModal && alGuardarModal(e.target)) modal.close();
});
document.getElementById('modalCancelar').addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

// Formato de miles mientras se escribe el monto
modal.addEventListener('input', (e) => {
  if (!e.target.closest('.money')) return;
  const n = parseMonto(e.target.value);
  e.target.value = n ? miles(n) : '';
});

render();
