# Keep Slopping

Aplicacion PWA mobile-first para seguir un plan alimenticio y registrar calorias con la misma cuenta de The Goy Project.

## Features

- Plan diario editable con comidas, ingredientes, cantidades y calorias.
- Registro rapido mediante busqueda o escaneo de codigo de barras.
- Calculo automatico de calorias y macronutrientes segun los gramos de la porcion.
- Modo de enfoque para iniciar una comida y marcar sus ingredientes.
- Progreso persistente sin duplicar una comida al rehacerla el mismo dia.
- Calendario de cumplimiento, recordatorio de creatina y totales diarios.
- Tema claro/oscuro, acentos configurables, PWA movil y sincronizacion con Supabase.

Los datos nutricionales provienen de [Open Food Facts](https://world.openfoodfacts.org/) y deben verificarse contra la etiqueta del producto. El escaner usa [`@zxing/browser`](https://github.com/zxing-js/browser) y se carga bajo demanda para no aumentar la descarga inicial.

## Supabase

Keep Slopping uses the same Supabase project and authenticated users as The Goy Project. Meal data is stored inside the existing `goy_app_state` row under the `keepSlopping` key, so training data and meal plans stay tied to the same account without requiring another table.

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
