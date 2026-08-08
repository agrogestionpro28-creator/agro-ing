# Agro Ing

Panel del ingeniero agrónomo: productores, lotes, campañas, cobranza, recorridas, análisis y recetas fitosanitarias.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · Supabase · Vercel

---

## Setup en 5 pasos

### 1. Supabase — proyecto nuevo

1. Ir a [supabase.com](https://supabase.com) → New project
2. Copiar **URL** y **anon key** de Settings → API
3. SQL Editor → pegar `supabase/schema.sql` completo → **Run**

Esto crea tablas, vistas, RLS, trigger de registro y bucket de logos.

### 2. Variables de entorno

Copiar `.env.local.example` → `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. GitHub

```bash
git init
git add .
git commit -m "feat: scaffold inicial"
git remote add origin https://github.com/TU_USUARIO/agro-ing.git
git push -u origin main
```

### 4. Vercel

Import repo → agregar las mismas env vars → Deploy.

### 5. Tipos (opcional pero recomendado)

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID --schema public > src/types/database.ts
```

---

## Campaña activa

Cada campaña va del **20/05** al **19/05** del año siguiente.

- Al registrarse, el trigger crea automáticamente la campaña correspondiente a la fecha actual
- El selector en el header permite navegar a campañas anteriores o adelantarse a la próxima
- Para crear la campaña 2027/2028 manualmente: SQL Editor → `select public.crear_campana('TU_USER_ID'::uuid, 2027);`

---

## Estructura

```
src/
├── app/
│   ├── (auth)/login/          # Login / signup
│   └── (app)/                 # Rutas autenticadas
│       ├── layout.tsx          # Carga ingeniero + campañas del servidor
│       ├── dashboard/          # Grilla de productores ← MVP
│       ├── productores/        # CRUD + lotes por campaña
│       ├── cobranza/           # (en construcción)
│       ├── recorrida/          # (en construcción)
│       ├── analisis/           # (en construcción)
│       ├── recetas/            # (en construcción)
│       ├── bitacora/           # (en construcción)
│       └── perfil/             # Editar nombre, matrícula, teléfono
├── components/
│   └── layout/
│       ├── app-header.tsx      # Header con logo, selector campaña, tabs
│       └── app-shell.tsx       # Context de campaña activa
└── lib/
    ├── supabase/               # browser / server / middleware
    └── utils.ts                # cn(), getCampanaActual()
```

---

## Diseño

| Token     | Color      | Uso |
|-----------|------------|-----|
| `base`    | `#0a0a0a`  | Fondo negro |
| `ochre`   | `#f59e0b`  | Acento principal, headers, botón activo |
| `afa`     | `#2EAA6E`  | Hectáreas, estado al día, afa green |
| `hi`      | `#f5f5f5`  | Texto primario |
| `mid`     | `#a3a3a3`  | Texto secundario |
| `lo`      | `#525252`  | Texto muted |

Panal de abejas: SVG inline en header + watermark en cards (opacidad 10%).

---

## Próximos módulos (en orden recomendado)

1. **Cobranza** — acuerdos (U$S/mes, kg/ha) + pagos + vista `vw_cobranza`
2. **Recorrida** — planilla de visitas con notas por lote
3. **Recetas** — fitosanitarias con imagen PNG para WhatsApp
4. **Análisis** — suelo + recomendaciones de fertilización
5. **Bitácora** — notas rápidas + fotos por lote/fecha
