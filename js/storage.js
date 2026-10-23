/*
 * Capa de almacenamiento.
 * Hoy guarda todo en el navegador (localStorage). Si más adelante usamos una
 * base de datos en la nube (Supabase, Firebase...), solo hay que cambiar este
 * archivo: el resto de la app usa únicamente Storage.cargar() y Storage.guardar().
 */
const Storage = (() => {
  const CLAVE = 'mis-finanzas-v1';

  const vacio = () => ({
    version: 1,
    ingresos: [],   // { id, monto, descripcion, categoria, fecha }
    gastos: [],     // { id, monto, descripcion, categoria, fecha, tipo: 'variable' | 'gusto' }
    fijos: [],      // { id, nombre, monto, categoria, dia, activo }
    pagosFijos: [], // { id, fijoId, mes: 'AAAA-MM', monto, fecha }
    metas: [],      // { id, nombre, objetivo }
    ahorros: [],    // { id, monto, descripcion, metaId, fecha, tipo: 'aporte' | 'retiro' }
  });

  function cargar() {
    try {
      const texto = localStorage.getItem(CLAVE);
      if (!texto) return vacio();
      return { ...vacio(), ...JSON.parse(texto) };
    } catch (e) {
      console.error('No se pudieron leer los datos', e);
      return vacio();
    }
  }

  function guardar(datos) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
      return true;
    } catch (e) {
      console.error('No se pudieron guardar los datos', e);
      return false;
    }
  }

  return { cargar, guardar, vacio };
})();
