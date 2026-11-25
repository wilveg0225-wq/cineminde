# CineMinde – Projektregler

## Inför kommersiell eller publik lansering
- Om användaren nämner kommersiell lansering, publik driftsättning eller produktionsrelease av CineMinde, **påminn alltid** om att `vite build` varnar för att huvudbundlen är ca `790 kB` (över 500 kB-gränsen).
- Föreslå att optimera laddningstiden före lansering med code-splitting (t.ex. `React.lazy`/dynamiska importer för flikar och modaler samt uppdelning av `CURATED_TMDB_MOVIES` / `manualChunks` i `vite.config.ts`).
