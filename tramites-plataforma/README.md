# GAMC Trámites

Plataforma web para programar trámites por usuario, publicar esos registros en una vista general y dar seguimiento por roles.

## Qué contiene hoy

- Inicio como mapa de navegación para ubicar cada módulo.
- Pantalla de ingreso y cambio de usuario para pruebas.
- Formulario de alta de trámites desde el perfil activo.
- Vista de mis trámites por usuario.
- Vista consolidada para supervisión con filtros por fecha, estado y búsqueda.
- Acciones de prueba para publicar, volver a borrador, aprobar, revisar y eliminar registros.
- Persistencia local en el navegador con localStorage.

## Stack técnico

- Next.js 16 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Persistencia temporal en el navegador con localStorage.

## Cómo ejecutarlo

Desde la carpeta del proyecto:

1. Instalar dependencias si hace falta:

```bash
npm install
```

2. Ejecutar en modo desarrollo:

```bash
npm run dev
```

3. Abrir el navegador en:

http://localhost:3000

## Cómo probarlo

1. Entra a la página inicial y abre el módulo que quieras probar.
2. Ve a Ingreso y cambia el usuario activo.
3. Entra a Nuevo trámite y guarda un borrador.
4. Abre Mis trámites para publicarlo o devolverlo a borrador.
5. Entra a Supervisión para ver lo publicado por todos.
6. Usa los filtros de fecha, estado y búsqueda para validar el seguimiento.
7. Recarga la página y confirma que los datos permanecen guardados en el navegador.

## Rutas principales

- `/` Inicio con el mapa de navegación.
- `/ingreso` Selección de usuario y reinicio de la demo.
- `/tramites/nuevo` Registro de trámites.
- `/tramites/mis-tramites` Gestión de los trámites del usuario activo.
- `/supervision` Vista consolidada para seguimiento.

## Cómo compilar para validar

```bash
npm run build
```

## Cómo ejecutar en modo producción local

```bash
npm run build
npm run start
```

## Cómo está pensada la plataforma

La versión actual es un MVP funcional orientado a demostrar el flujo real del negocio:

- El usuario entra con un perfil definido.
- Registra su programación sin mezclarla con otros usuarios.
- La información se reparte por páginas para evitar una interfaz cargada.
- La información publicada se ve en una vista única para supervisión.
- La persistencia local sirve para pruebas rápidas antes de conectar una base de datos real.

## Cómo defender la solución

Si te preguntan en qué está hecha, puedes decirlo así:

- Frontend con Next.js 16 y React 19.
- Tipado con TypeScript.
- Estilos con Tailwind CSS 4.
- Navegación por rutas del App Router.
- Estado compartido en localStorage para simular una base de datos durante las pruebas.
- Diseño separado por módulos para simplificar el uso por parte de usuarios operativos y supervisores.

## Siguiente paso recomendado

La siguiente etapa técnica debería ser:

1. Autenticación real por roles.
2. Base de datos centralizada.
3. Endpoints o acciones de servidor para guardar trámites.
4. Separar panel de usuario y panel de supervisor.
5. Historial de estados y bitácora de cambios.

## Estado actual

La app ya compila y puede probarse localmente. La base funcional está lista para evolucionar a autenticación y base de datos.
