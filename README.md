# Keep Slopping

Aplicación PWA mobile-first para seguir el plan alimenticio diario de Alejandro con la misma cuenta de The Goy Project.

## Features

- Checklist diario de comidas, ingredientes y creatina.
- Plan de 2,600 kcal con cantidades y macronutrientes por comida.
- Edición manual de comidas, ingredientes y objetivos.
- Progreso persistente por día.
- Tema claro/oscuro, acentos configurables, PWA móvil y sincronización con Supabase.

## Supabase

Keep Slopping usa el mismo proyecto de Supabase y las mismas cuentas que The Goy Project. Los datos se guardan bajo la clave `keepSlopping`; las funciones atómicas de Postgres leen y actualizan solo esa sección para evitar consultas redundantes y conflictos con el historial de entrenamiento.

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
