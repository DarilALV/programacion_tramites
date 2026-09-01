# CLAUDE.md

Este archivo provee orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Comandos

Todos los comandos se ejecutan desde `programacion_tramites/tramites-plataforma/`:

```bash
npm run dev       # Servidor de desarrollo en localhost:3000
npm run build     # Build de producción
npm run lint      # ESLint (configuración flat v9)
```

Los tests usan Vitest pero no hay script `test` definido en package.json todavía. Ejecutar directamente con `npx vitest`.

## Arquitectura

**Next.js 16 App Router** con React 19, TypeScript y Tailwind CSS 4. Todas las rutas están bajo `src/app/`; la raíz `/` redirige a `/ingreso` (configurado en `next.config.ts`).

### Estado y Persistencia

Todo el estado de la aplicación vive en `src/lib/tramites-store.ts` mediante el hook `useTramitesStore()`. Este hook:
- Persiste en `localStorage` bajo la clave `gmc-tramites-mvp`
- Intenta hidratar desde Firestore al cargar, cayendo en datos semilla hardcodeados si hay error
- Exporta operaciones CRUD: `createEntry`, `updateEntry`, `updateEntryStatus`, `removeEntry`, `resetDemo`

La configuración de Firebase está en `src/lib/firebase.ts`. Las lecturas de Firestore están habilitadas; las escrituras caen en localStorage.

### Modelo de Datos Central

El tipo `Entry` (definido en `tramites-store.ts`) es la entidad principal:
- `registrationNumber`: generado automáticamente (`REG-XXXX`)
- `tramiteCode`: código de trámite de 6–10 dígitos (validado con Zod en `src/lib/validators.ts`)
- `technicianArea`: uno de `"Supervisor" | "Ruat" | "Legal" | "Revision plano"`
- `status`: `"Registrado" | "En revisión" | "Aprobado"`
- `scheduledTime` / `scheduledEndTime`: franjas de 15 min calculadas automáticamente desde las 08:00 hasta las 12:00, por técnico y fecha
- `followUp`: objeto anidado que registra llegada y atención del cliente

### Mapa de Rutas

| Ruta | Propósito |
|---|---|
| `/ingreso` | Selección de sesión de usuario; reset de demo |
| `/tramites/nuevo` | Registrar un nuevo trámite |
| `/tramites/mis-tramites` | Ver/editar los trámites del usuario actual |
| `/seguimientos` | Registrar llegadas y atención de clientes por día |
| `/seguimientos/no-programados` | Marcar trámites sin seguimiento |
| `/tecnico` | Vista de calendario/cronograma del técnico con exportación a Excel |
| `/reportes` | Analíticas por usuario/técnico con exportación a Excel |
| `/supervision` | Vista consolidada con filtros para supervisores |

### Librerías Clave

- **Zod 4** — validación de formularios (`EntryFormSchema` en `validators.ts`)
- **XLSX** — exportación a Excel en `/tecnico` y `/reportes`
- **Lucide React** — todos los íconos
- **Tailwind CSS 4** — estilos via `@tailwindcss/postcss`; el tema usa propiedades CSS personalizadas con paleta rosa/violeta

### Alias de Rutas

`@/*` apunta a `./src/*` (configurado en `tsconfig.json`).
