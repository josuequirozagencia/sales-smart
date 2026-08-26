# vendor

## xlsx-0.20.3.tgz

SheetJS dejó de publicar `xlsx` en el registro de npm. La última versión que
queda allí es la 0.18.5, que arrastra dos fallos con arreglo conocido:

- Prototype Pollution — GHSA-4r6h-8v6p-xvw6 (corregido en 0.19.3)
- ReDoS — GHSA-5pgg-2g8v-p4x9 (corregido en 0.20.2)

Ambos se disparan al **parsear** una hoja de cálculo, y este backend parsea
archivos que suben los usuarios en `ImportContacts.ts` e
`ImportContactsService.ts`. En un proceso Node multi-tenant eso es más grave
que en el navegador.

El paquete oficial vive ahora en `https://cdn.sheetjs.com/`. Se guarda una copia
local en vez de apuntar la dependencia a esa URL porque el despliegue corre
`docker compose build` en VPS de clientes: si el CDN no responde durante una
instalación, falla con un error confuso. La propia documentación de SheetJS
recomienda esta práctica.

Origen: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

### Actualizar

Descargar el nuevo `.tgz` desde el CDN, dejarlo en esta carpeta, actualizar la
referencia en `package.json` y borrar el archivo anterior.
