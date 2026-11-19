# Gestión Deco

App web (PWA) para gestionar una tienda online de decoración: **Catálogo, Compras, Stock, Ventas y Administración**.
Funciona en celular y PC, anda sin internet y sincroniza por Google Drive.

## Estado de los módulos
| Módulo | Estado |
|---|---|
| Núcleo (datos locales, sync con Drive, roles, condición fiscal) | ✅ |
| Catálogo de proveedores | ✅ |
| Compras · Stock · Ventas · Administración | ⏳ uno por vez |

## Probar en la PC
```
python -m http.server 8080
```
Abrir http://localhost:8080 (los datos del catálogo se cargan solos la primera vez).
Pruebas de lógica: `node test/test-core.mjs`

## Activar la sincronización con Google Drive (una sola vez)
1. https://console.cloud.google.com → crear un proyecto.
2. **APIs y servicios → Biblioteca** → habilitar **Google Drive API**.
3. **Pantalla de consentimiento de OAuth** → tipo *Externo* → dejar en modo **Prueba** y agregar como *usuarios de prueba* los mails de Google de cada persona que va a usar la app.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   En *Orígenes autorizados de JavaScript* agregar `http://localhost:8080` y la URL pública donde publiques la app (ver abajo).
5. Copiar el **Client ID** → en la app: **Ajustes → Client ID → Guardar → Conectar con Google**.

La primera conexión crea el archivo `gestion-deco-data.json` en el Drive del dueño.
Para sumar gente: compartir ese archivo (Editor) con su cuenta; esa persona instala la app, pega el mismo Client ID y se conecta.

## Usar en el celular
Google solo permite iniciar sesión desde `localhost` o desde **HTTPS**, así que para el celular hay que publicar la carpeta como sitio estático
(GitHub Pages, Netlify, Cloudflare Pages: gratis). Después, en el navegador del celular: *Agregar a pantalla de inicio*.
Agregá esa URL a los orígenes autorizados del paso 4.

## Cómo funciona la sincronización
- Cada dispositivo guarda todo localmente (IndexedDB) y trabaja offline.
- Al reconectar (y cada minuto) descarga el archivo de Drive, **fusiona por registro** (gana el cambio más reciente) y sube si hay novedades.
- Los borrados se propagan como marcas, no se pierden entre dispositivos.
- Si dos personas editan **el mismo registro** a la vez, queda el último en guardarse.

## Roles y permisos
Definidos en `js/core/store.js` (`ROLES_DEFAULT`): Administrador, Compras, Depósito, Vendedor, Solo lectura, con nivel por módulo (sin acceso / ver / editar).
Mientras no haya usuarios cargados, quien usa la app es administrador. La pantalla para dar de alta usuarios y asignar roles va en el módulo Administración.
> Los permisos se aplican en la interfaz. La protección real de los datos es con quién compartís el archivo de Drive.

## Condición fiscal
Ajustes → Condición fiscal: arranca en **Monotributo** (Factura C). Se puede pasar a Responsable Inscripto o IVA Exento; se guarda historial para que las ventas viejas conserven su condición.
La emisión electrónica con ARCA no está incluida todavía.

## Estructura
```
index.html · sw.js · manifest.webmanifest
css/styles.css
js/app.js                 router, menú, estado de sync
js/core/{store,drive,auth,ui}.js
js/data/seed-catalogo.js  catálogo inicial normalizado
js/modules/{catalogo,ajustes,pendientes}.js
```
Cada módulo exporta `{ id, perm, label, icon, title, mount(root) }`.
