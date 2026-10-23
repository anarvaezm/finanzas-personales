# 💰 Mis Finanzas

Aplicación web sencilla para manejar finanzas personales en pesos colombianos (COP).
Funciona en el navegador del computador y del celular, sin instalar nada.

## Funcionalidades (versión 1)

- **Ingresos**: monto, descripción, categoría (sueldo, extra, otro) y fecha de pago.
- **Gastos variables**: comida, transporte, entretenimiento, otro.
- **Gustos**: categoría aparte para caprichos, con el % que representan de tus ingresos.
- **Pagos fijos**: arriendo, servicios, internet, cuotas, suscripciones… con día de pago,
  estado (pagado, vencido, próximo) y botón para marcarlos como pagados cada mes.
- **Ahorros y metas**: aparta dinero (o retíralo) y sigue el avance de metas como "Viaje – $2.000.000".
- **Panel principal**: ingresos, gastos, ahorro y saldo disponible del mes, gráfica de gastos
  por categoría, próximos pagos y últimos movimientos.
- Editar y eliminar cualquier registro.
- Filtro por mes (flechas ‹ › o tocando el nombre del mes).
- Copia de seguridad: descargar / restaurar los datos (⚙️ Ajustes).

## Cómo abrirla

Opción fácil: doble clic en `index.html`. Se abre en tu navegador.

## Dónde se guardan los datos

Por ahora en el **almacenamiento local del navegador** (localStorage). Los datos no se borran al
cerrar la página, pero sí si borras los datos de navegación, y no se comparten entre el
computador y el celular. Usa ⚙️ → *Descargar copia* de vez en cuando.

Todo el acceso a los datos está en `js/storage.js`, así que más adelante se puede cambiar por una
base de datos gratuita en la nube (por ejemplo Supabase o Firebase) sin rehacer la app.

## Estructura

```
index.html      Página principal
styles.css      Diseño
js/storage.js   Guardar y cargar datos
js/app.js       Lógica de la aplicación
```
