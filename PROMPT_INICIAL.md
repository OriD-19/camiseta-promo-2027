# Prompt para arrancar en Claude Code

Pegá esto en Claude Code desde la raíz del repo, después de copiar este kit adentro:

---

Vamos a construir la versión final del visualizador y la votación de la camiseta Promo 2027.

1. Leé `CLAUDE.md`, `docs/SPEC.md` y `reference/prototipo/README.md`, y revisá los tres archivos `.dc.html` del prototipo.
2. Antes de escribir código, mostrame un plan corto: la estructura de archivos, el orden de implementación y cualquier duda sobre la spec.
3. Implementá por etapas, con un commit por etapa:
   1. Scaffold: Vite + TS multi-página, `tsconfig`, Vitest, `.env.example`, `src/config.ts`, `src/colors.ts` con tests.
   2. `src/shirt.ts`, portando la silueta boxy y las 4 variantes de logo del prototipo, con `LOGO_POSITION` como variables CSS.
   3. Página de votación completa, con `api.ts` (y su mock cuando no hay URL), validación, estados y `localStorage`.
   4. `src/aggregate.ts` con tests, y después el dashboard `resultados.html`.
   5. Workflow de GitHub Pages (`.github/workflows/deploy.yml`) y `public/CNAME` opcional.
4. Al final, corré `npm run typecheck`, `npm test` y `npm run build`, y revisá los criterios de aceptación de `docs/SPEC.md` §9 uno por uno.

No modifiques `apps-script/` salvo que encuentres una inconsistencia con la spec; en ese caso, avisame primero.

---
