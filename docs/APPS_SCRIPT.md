# Guía: backend en Google Apps Script + Google Sheets

Esta guía deja funcionando el backend que recibe los votos y alimenta el dashboard. Se hace una sola vez y toma unos 30 minutos.

## 0. Antes de empezar: ¿con qué cuenta?

Creá la hoja con una cuenta que la promoción pueda conservar, por ejemplo una cuenta compartida de los representantes. **El script corre con los permisos de quien lo publica**, y si esa persona pierde acceso a la cuenta, el backend se cae.

## 1. Crear la hoja

1. Creá una hoja nueva en Google Sheets llamada `Camiseta Promo 2027 — Votos`.
2. Abrí **Extensiones → Apps Script**. Se abre un proyecto vinculado a la hoja.
3. Cambiale el nombre al proyecto: `camiseta-promo-2027-backend`.

## 2. Pegar el código

1. En `Code.gs`, borrá lo que haya y pegá el contenido de `apps-script/Code.gs`.
2. Abrí **Configuración del proyecto** (el engranaje) y activá **Mostrar el archivo de manifiesto "appsscript.json"**.
3. Volvé al editor, abrí `appsscript.json` y reemplazá su contenido con `apps-script/appsscript.json`.
4. Guardá (Ctrl/Cmd + S).

## 3. Ejecutar `setup` una vez

1. En el selector de funciones elegí `setup` y presioná **Ejecutar**.
2. Google pide autorización: **Revisar permisos → tu cuenta → Avanzado → Ir a camiseta-promo-2027-backend → Permitir**. La advertencia aparece porque el script no está verificado por Google; es normal en scripts propios. Entre los permisos aparece "Conectarse a un servicio externo": es para verificar el inicio de sesión de los representantes con Google.

`setup` crea cuatro hojas:

| Hoja | Para qué sirve |
|---|---|
| `Votos` | Una fila por persona. Si alguien vuelve a votar, su fila se actualiza (cuenta el último voto) y `envios` aumenta. |
| `Log` | Historial de todos los envíos, incluidos los reemplazados. Sirve para auditar. |
| `Padron` | Lista oficial: `correo`, `nombre`, `carrera`. |
| `Representantes` | Quiénes pueden ver el dashboard: `correo` (la cuenta de Google con la que entran) y `nombre`. |

> **Si ya tenías el backend funcionando con la clave `ADMIN_KEY`:** pegá el `Code.gs` nuevo, ejecutá `setup` otra vez y aceptá el permiso nuevo. Si no lo aceptás, el dashboard falla con `error_interno`. `setup` no toca los votos: crea la hoja `Representantes` y borra `ADMIN_KEY`, que ya no se usa. Después seguí los pasos 4, 5 y 6 y publicá una nueva versión (paso 11).

## 4. Configurar las propiedades

En **Configuración del proyecto → Propiedades del script**:

| Propiedad | Valor | Nota |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `…apps.googleusercontent.com` | Lo obtenés en el paso 5. Sin esta propiedad el dashboard responde `acceso_sin_configurar`. |
| `VOTING_OPEN` | `false` | Ponelo en `true` el día que abra la votación. |
| `PADRON_REQUIRED` | `true` (recomendado) | Solo acepta correos que estén en `Padron`. |
| `INSCRITOS_JSON` | opcional | Solo si no llenan el padrón: `{"LEN":38,"LCJ":27,"IDN":30,"ISND":30}` |

## 5. Crear el Client ID de Google (acceso al dashboard)

Es gratis y no necesita tarjeta. Hacelo con la misma cuenta del paso 0.

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com/) y creá un proyecto: `camiseta-promo-2027`.
2. **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva: **Google Auth Platform → Branding**):
   - Tipo de usuario: **Externo**.
   - Nombre de la app: `Camiseta Promo 2027`, con tu correo como correo de asistencia y de contacto.
   - No agregues permisos (*scopes*): alcanzan los básicos (correo y perfil).
   - En **Público** (*Audience*) presioná **Publicar app**. Con solo los permisos básicos, Google no pide revisión. Si la dejás en modo "Prueba", únicamente pueden entrar las cuentas que agregués como usuarios de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth** (o **Clientes → Crear cliente**):
   - Tipo: **Aplicación web**.
   - **Orígenes autorizados de JavaScript.** Van sin ruta y sin `/` al final:
     - `https://<tu-usuario>.github.io`, o tu dominio propio, p. ej. `https://camiseta.midominio.com`.
     - `http://localhost:5173` y `http://localhost`, para `npm run dev`.
     - `http://localhost:4173`, para `npm run preview`.
   - URIs de redireccionamiento: dejalo vacío.
4. Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`). Va en dos lugares:
   - En Apps Script, como propiedad `GOOGLE_CLIENT_ID` (paso 4).
   - En el frontend, como `VITE_GOOGLE_CLIENT_ID` (paso 10).

El ID de cliente no es secreto: queda visible en el sitio. Lo que protege el dashboard es que el servidor verifica con Google que el token sea para ese ID y que el correo esté en `Representantes`.

Los cambios de orígenes pueden tardar unos minutos en aplicarse. Si ves "The given origin is not allowed for the given client ID", esperá un poco o revisá que el origen esté escrito exactamente igual.

## 6. Cargar a los representantes

En la hoja `Representantes`, una fila por persona: `correo` en minúsculas y `nombre`. Puede ser cualquier cuenta de Google (`@esen.edu.sv` o `@gmail.com`), pero tiene que ser **la misma con la que van a entrar**.

- **Agregar a alguien:** nueva fila. Funciona de inmediato, sin republicar.
- **Quitar a alguien:** borrá la fila. Si tenía el dashboard abierto, su sesión deja de funcionar al tocar "Actualizar".

## 7. Llenar el padrón (recomendado)

Pegá en la hoja `Padron` las 125 filas: `correo` (en minúsculas, `@esen.edu.sv`), `nombre` y `carrera` (`LEN`, `LCJ`, `IDN` o `ISND`).

El padrón hace tres cosas:
- Bloquea correos inventados.
- Bloquea votos con la carrera equivocada.
- Le da al dashboard el total real de personas por carrera, para calcular la participación.

## 8. Publicar como aplicación web

1. **Implementar → Nueva implementación → tipo: Aplicación web**.
2. **Ejecutar como:** Yo.
3. **Quién tiene acceso:** **Cualquier usuario** (Anyone). No elijas "Cualquier usuario con cuenta de Google": eso redirige a un login y el sitio no puede leer la respuesta.
4. **Implementar**. Copiá la URL que termina en `/exec`.
5. Abrí esa URL en el navegador: tiene que mostrar `{"ok":true,"open":false,"version":"v2"}`.

## 9. Probar

```bash
URL="https://script.google.com/macros/s/XXXX/exec"

# Estado
curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"action":"status"}' "$URL"

# Voto (necesita VOTING_OPEN=true y, si PADRON_REQUIRED=true, que el correo esté en Padron)
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"action":"vote","data":{"nombre":"Prueba","correo":"prueba@esen.edu.sv","carrera":"ISND","fondo":"negro","logo":"siglas","tipografia":"montserrat","comentario":""}}' \
  "$URL"

# Resultados sin sesión: tiene que responder {"ok":false,"error":"no_autorizado"}
curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"action":"results","idToken":""}' "$URL"
```

Los resultados con sesión se prueban desde el dashboard. Con `npm run dev` y el `.env` del paso 10, abrí `http://localhost:5173/resultados.html` y entrá con una cuenta de `Representantes`. Probá también con una cuenta que no esté: tiene que mostrar "Esa cuenta de Google no está en la lista de representantes".

El `-L` es necesario porque Apps Script responde con una redirección a `script.googleusercontent.com`.

Cuando termines de probar, borrá las filas de prueba en `Votos` y `Log`.

## 10. Conectar el frontend

En el repo, copiá `.env.example` a `.env` y poné `VITE_APPS_SCRIPT_URL=<la URL /exec>` y `VITE_GOOGLE_CLIENT_ID=<el ID del paso 5>`. En GitHub Actions, configuralas como *Repository variables* (Settings → Secrets and variables → Actions → Variables).

La URL queda visible en el JavaScript del sitio, y está bien que sea así. La protección real está en el servidor: valida el dominio del correo, el padrón, los valores permitidos y, para el dashboard, la sesión de Google contra la hoja `Representantes`.

## 11. Actualizar el código sin cambiar la URL (error muy común)

Si editás `Code.gs`, el cambio **no** se publica solo. Hacé esto:

**Implementar → Gestionar implementaciones → lápiz (editar) → Versión: Nueva versión → Implementar**.

Así se mantiene la misma URL `/exec`. Si en cambio creás una "Nueva implementación", la URL cambia y hay que actualizar el frontend.

## 12. Operación durante la votación

- **Abrir y cerrar la votación:** ejecutá `abrirVotacion` o `cerrarVotacion` desde el editor, o cambiá `VOTING_OPEN`.
- **Exportar:** **Archivo → Descargar → Microsoft Excel (.xlsx)** o **CSV** (el CSV exporta solo la hoja activa).
- **Revisar duplicados raros:** en `Votos`, ordená por `envios`. Si una persona tiene muchos envíos, revisá su historial en `Log`.

## 13. Cosas que hay que saber

- **El correo no se verifica.** Alguien podría votar con el correo de otra persona del padrón. Para una votación de camisetas entre 125 compañeros suele bastar con estas medidas:
  - El padrón limita quién puede votar.
  - Si la persona dueña del correo vota después, su voto reemplaza al anterior.
  - El `Log` permite revisar casos raros.

  Si quieren verificación real, la alternativa es servir la página desde el mismo Apps Script y restringir el acceso a cuentas `@esen.edu.sv` (ver `SPEC.md`, sección "Alternativa con identidad verificada").
- **Límites de Apps Script:** soporta unas 30 ejecuciones simultáneas, de sobra para 125 personas. El `LockService` evita que dos votos simultáneos se pisen.
- **Inyección de fórmulas:** los textos que empiezan con `=`, `+`, `-` o `@` se guardan con un apóstrofo delante, para que Excel no los ejecute al abrir el archivo.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Error de CORS en la consola | El fetch manda `Content-Type: application/json`. Tiene que ser `text/plain;charset=utf-8`. |
| La respuesta es HTML de login de Google | La implementación no está en "Cualquier usuario". |
| Dashboard: "no está en la lista de representantes" | El correo no está en `Representantes`, tiene un espacio o la persona entró con otra cuenta de Google. |
| Dashboard: `error_interno` después de actualizar `Code.gs` | Falta aceptar el permiso nuevo: ejecutá `setup` desde el editor. |
| Dashboard: "todavía no está configurado en el servidor" | Falta la propiedad `GOOGLE_CLIENT_ID`. |
| El botón de Google no aparece o dice que el origen no está permitido | Falta el origen en el Client ID (paso 5), o `VITE_GOOGLE_CLIENT_ID` no llegó al build. |
| Los cambios del código no se reflejan | Falta publicar una nueva versión (paso 11). |
| `correo_no_en_padron` | `PADRON_REQUIRED=true` y el correo no está en la hoja, o tiene mayúsculas o espacios. |
| `votacion_cerrada` | `VOTING_OPEN` no está en `true`. |
