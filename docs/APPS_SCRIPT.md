# Guía: backend en Google Apps Script + Google Sheets

Esta guía deja funcionando el backend que recibe los votos y alimenta el dashboard. Se hace una sola vez y toma unos 20 minutos.

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
2. Google pide autorización: **Revisar permisos → tu cuenta → Avanzado → Ir a camiseta-promo-2027-backend → Permitir**. La advertencia aparece porque el script no está verificado por Google; es normal en scripts propios.
3. En el registro de ejecución aparece `ADMIN_KEY = …`. Guardá esa clave: es la que van a usar los representantes para entrar al dashboard.

`setup` crea tres hojas:

| Hoja | Para qué sirve |
|---|---|
| `Votos` | Una fila por persona. Si alguien vuelve a votar, su fila se actualiza (cuenta el último voto) y `envios` aumenta. |
| `Log` | Historial de todos los envíos, incluidos los reemplazados. Sirve para auditar. |
| `Padron` | Lista oficial: `correo`, `nombre`, `carrera`. |

## 4. Configurar las propiedades

En **Configuración del proyecto → Propiedades del script**:

| Propiedad | Valor | Nota |
|---|---|---|
| `ADMIN_KEY` | (la generó `setup`) | Podés cambiarla por una propia, larga. |
| `VOTING_OPEN` | `false` | Ponelo en `true` el día que abra la votación. |
| `PADRON_REQUIRED` | `true` (recomendado) | Solo acepta correos que estén en `Padron`. |
| `INSCRITOS_JSON` | opcional | Solo si no llenan el padrón: `{"LEN":38,"LCJ":27,"IDN":30,"ISND":30}` |

## 5. Llenar el padrón (recomendado)

Pegá en la hoja `Padron` las 125 filas: `correo` (en minúsculas, `@esen.edu.sv`), `nombre` y `carrera` (`LEN`, `LCJ`, `IDN` o `ISND`).

El padrón hace tres cosas:
- Bloquea correos inventados.
- Bloquea votos con la carrera equivocada.
- Le da al dashboard el total real de personas por carrera, para calcular la participación.

## 6. Publicar como aplicación web

1. **Implementar → Nueva implementación → tipo: Aplicación web**.
2. **Ejecutar como:** Yo.
3. **Quién tiene acceso:** **Cualquier usuario** (Anyone). No elijas "Cualquier usuario con cuenta de Google": eso redirige a un login y el sitio no puede leer la respuesta.
4. **Implementar**. Copiá la URL que termina en `/exec`.
5. Abrí esa URL en el navegador: tiene que mostrar `{"ok":true,"open":false,"version":"v1"}`.

## 7. Probar desde la terminal

```bash
URL="https://script.google.com/macros/s/XXXX/exec"

# Estado
curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"action":"status"}' "$URL"

# Voto (necesita VOTING_OPEN=true y, si PADRON_REQUIRED=true, que el correo esté en Padron)
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"action":"vote","data":{"nombre":"Prueba","correo":"prueba@esen.edu.sv","carrera":"ISND","fondo":"negro","logo":"siglas","tipografia":"bebas","comentario":""}}' \
  "$URL"

# Resultados
curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"action":"results","key":"TU_ADMIN_KEY"}' "$URL"
```

El `-L` es necesario porque Apps Script responde con una redirección a `script.googleusercontent.com`.

Cuando termines de probar, borrá las filas de prueba en `Votos` y `Log`.

## 8. Conectar el frontend

En el repo, copiá `.env.example` a `.env` y poné `VITE_APPS_SCRIPT_URL=<la URL /exec>`. En GitHub Actions o Netlify, configurala como variable de entorno del build.

La URL queda visible en el JavaScript del sitio, y está bien que sea así. La protección real está en el servidor: valida el dominio del correo, el padrón, los valores permitidos y la clave de admin.

## 9. Actualizar el código sin cambiar la URL (error muy común)

Si editás `Code.gs`, el cambio **no** se publica solo. Hacé esto:

**Implementar → Gestionar implementaciones → lápiz (editar) → Versión: Nueva versión → Implementar**.

Así se mantiene la misma URL `/exec`. Si en cambio creás una "Nueva implementación", la URL cambia y hay que actualizar el frontend.

## 10. Operación durante la votación

- **Abrir y cerrar la votación:** ejecutá `abrirVotacion` o `cerrarVotacion` desde el editor, o cambiá `VOTING_OPEN`.
- **Exportar:** **Archivo → Descargar → Microsoft Excel (.xlsx)** o **CSV** (el CSV exporta solo la hoja activa).
- **Revisar duplicados raros:** en `Votos`, ordená por `envios`. Si una persona tiene muchos envíos, revisá su historial en `Log`.

## 11. Cosas que hay que saber

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
| Los cambios del código no se reflejan | Falta publicar una nueva versión (paso 9). |
| `correo_no_en_padron` | `PADRON_REQUIRED=true` y el correo no está en la hoja, o tiene mayúsculas o espacios. |
| `votacion_cerrada` | `VOTING_OPEN` no está en `true`. |
