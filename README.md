# Keep Slopping

Mobile-first meal tracking app for daily meal plan compliance.

## Features

- Daily meal plan with editable meals, ingredients, quantities, and calories.
- Focus mode to start a meal and check off cooked ingredients.
- Daily calorie totals and meal completion progress.
- Calendar showing fulfilled and partially completed days.
- Dark/light theme, accent color picker, mobile PWA icons, and Supabase sync.

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
npm run build
```
