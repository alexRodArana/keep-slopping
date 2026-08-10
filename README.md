# Keep Slopping

Aplicacion PWA mobile-first para seguir un plan alimenticio y registrar calorias con la misma cuenta de The Goy Project.

## Features

- Plan diario editable con comidas, ingredientes, cantidades y calorias.
- Varias opciones por comida con seleccion al iniciar y progreso independiente.
- Tab dedicada para registrar alimentos mediante busqueda o escaneo de codigo de barras.
- Calculo automatico de calorias y macronutrientes segun los gramos de la porcion.
- Modo de enfoque para iniciar una comida y marcar sus ingredientes.
- Progreso persistente sin duplicar una comida al rehacerla el mismo dia.
- Calendario de cumplimiento, recordatorio de creatina y totales diarios.
- Tema claro/oscuro, acentos configurables, PWA movil y sincronizacion con Supabase.

Los datos nutricionales provienen de [Open Food Facts](https://world.openfoodfacts.org/) y deben verificarse contra la etiqueta del producto. El escaner usa [`@zxing/browser`](https://github.com/zxing-js/browser) y se carga bajo demanda para no aumentar la descarga inicial.

## Supabase

Keep Slopping usa el mismo proyecto de Supabase y las mismas cuentas que The Goy Project. Los datos se guardan bajo la clave `keepSlopping`; las funciones atomicas de Postgres leen y actualizan solo esa seccion para evitar consultas redundantes y conflictos con el historial de entrenamiento.

Required environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```
