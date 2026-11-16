# Prototipo de referencia

Estos archivos son el prototipo de diseño aprobado. Están en un formato de componentes propio del canvas donde se diseñaron y **no se sirven ni se compilan**: son solo referencia.

| Archivo | Qué tomar de ahí |
|---|---|
| `Main.dc.html` | Layout, textos y estados de la página de votación. |
| `Shirt.dc.html` | Rutas SVG exactas de la silueta boxy, posición y proporciones (en `cqw`) de cada variante de logo, y el contenido de la espalda. |
| `Resultados.dc.html` | Layout del dashboard y la lógica de agregación (`tally`, `combos`, desglose por carrera). |

Cómo leer la sintaxis:
- `{{ x }}` es un valor que se calcula en `renderVals()`.
- `<sc-for list=… as=…>` es un bucle.
- `<sc-if value=…>` es un condicional.
- `<dc-import name="Shirt" …>` monta `Shirt.dc.html` con esos atributos como props.
- `class Component extends DCLogic` es la lógica, con `state` y `setState` al estilo de React.

**Ajustes ya decididos que el prototipo todavía no refleja del todo:** la posición del logo se va a afinar a mano. Por eso va en `LOGO_POSITION` (`src/config.ts`) como variables CSS, y no fija en el markup.

Los datos del dashboard del prototipo son de ejemplo.
