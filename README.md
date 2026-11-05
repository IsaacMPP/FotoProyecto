# Demi Tether Studio v0.5.0 — Windows

## Canon USB directo

Se ha integrado un puente nativo de .NET 8 para **Canon EDSDK**. Al pulsar **Conectar Canon 6D Mark II**, abre sesión con la cámara, configura destino en PC y recibe eventos de transferencia tras cada disparo físico. Guarda imágenes en la carpeta de sesión; la aplicación las presenta automáticamente en pantalla completa.

**Dependencia de fabricante:** Canon EDSDK.dll y sus DLL auxiliares no se pueden redistribuir aquí ni descargar anónimamente. Solicítalas en https://developercommunity.usa.canon.com/s/ (gratis, puede requerir aprobación). Copia las DLL **Windows x64** junto al archivo `DemiCameraBridge.exe` del programa instalado, dentro de `resources/camera-bridge/`. En la versión portátil, los recursos se extraen en una ubicación temporal; para pruebas usa el instalador. Si faltan las DLL, la app muestra el error de dependencia. No instales EOS Utility ni es necesario abrirlo.

### Cómo probar la cámara
1. Descarga el SDK oficial Canon EDSDK Windows x64. Instala la aplicación compilada por Actions.
2. Coloca `EDSDK.dll` y los binarios complementarios oficiales junto a `DemiCameraBridge.exe`.
3. Conecta la cámara por USB, desactiva Wi-Fi en la Canon y cierra EOS Utility / otras apps que usen la cámara.
4. En la cámara usa **JPEG** o **RAW+JPEG** (el visor admite JPG, PNG, WebP; los RAW descargados no se muestran).
5. Abre Demi Tether Studio, elige carpeta y pulsa **Conectar Canon 6D Mark II**.
6. Dispara físicamente, comprueba que el archivo llega a la carpeta y se proyecta en el televisor.

**Estado de pruebas:** el código puente es una implementación preliminar sin prueba física con la Canon 6D Mark II. El SDK tiene versiones y estructuras nativas que deben validarse con el paquete que proporciona Canon. Si hay errores de inicialización, no se considerará funcional hasta resolverlos.

## Wi-Fi
Aún no implementado. La compatibilidad inalámbrica 6D Mark II no queda validada mediante CCAPI. No hay botón Wi-Fi ficticio.

## Compilación
El flujo GitHub Actions genera ejecutables Windows con Electron y un puente C# .NET 8 incorporado; no contiene DLL propietarias de Canon. Los ejecutables se publican en **Artifacts**.

## Galería Canon mejorada (v0.5.0)
Se recorren todas las carpetas visibles mediante EDSDK. Se cuentan JPEG y RAW CR2; los RAW utilizan miniaturas JPEG obtenidas desde la propia cámara. Las últimas 30 JPEG se importan a resolución completa y las anteriores como vistas previas, con fecha original de captura para ordenarlas. Ya no existe límite de 30 archivos visibles. Los RAW nuevos generan una previsualización cuando lo permite la cámara. Esta funcionalidad se ha compilado pero requiere prueba real; el SDK puede rechazar miniaturas o transferencias en determinadas configuraciones. No se borra ningún archivo de la tarjeta. **Importante**: importar una tarjeta con muchas fotos puede tardar y consumir espacio, y el visor muestra miniaturas para fotos antiguas.

## Nueva interfaz v0.6.0
- Interfaz juvenil oscura con acentos celestes, tarjetas y controles más visibles.
- ESC en el televisor sale de pantalla completa sin cerrar el visor; botón ⛶ para volver a pantalla completa.
- Zoom de 100% a 600% con gesto de pellizcar (según cómo Windows envíe el evento), desplazamiento del touchpad/rueda, deslizador y botones +/-.
- Arrastrar con mouse o touchpad para recorrer la fotografía ampliada; el zoom y desplazamiento están sincronizados con la pantalla del cliente.
- Navegación ←/→, PageUp/PageDown y mandos que envíen estas teclas. Al cambiar de foto se reajusta el zoom.
- El motor de cámara EDSDK permanece sin cambios respecto a v0.5.0. Es necesario probar gestos y atajos con el touchpad y presentador concretos.


## Corrección RAW y visor v0.6.1
- Se aceptan disparos RAW CR2 y CR3: Canon EDSDK intenta extraer una miniatura, y si la cámara no ofrece una JPEG válida se descarga el RAW original y se obtiene su JPEG incrustado con ExifTool. **No se convierten los datos RAW revelándolos**, se usa su previsualización existente; el tamaño depende del RAW.
- ExifTool oficial 13.60 de Windows se descarga en GitHub Actions desde SourceForge, comprueba SHA-256 y se incluye junto al puente. Licencia ExifTool: https://exiftool.org/ . No requiere instalación separada ni EOS Utility.
- El visor utiliza un protocolo interno que entrega bytes de la imagen, evitando fallos y lentitud de imágenes base64 en la comunicación Electron. Si una imagen no se puede abrir, se muestra error legible en vez de una vista negra con imagen rota.
- Si el RAW carece de previsualización incrustada, la app informa del error y conserva el original. No se asegura revelado de CR2/CR3 ni su edición.
- Cámara y zoom originales sin cambios. **Falta probar con Canon física los dos formatos y la carga real en el televisor.**


## Ajuste de pantalla v0.6.2
- Ventana de trabajo adaptativa a la resolución: la fotografía utiliza el espacio libre entre la barra superior, el zoom y la galería, sin scroll general vertical. Si la altura es reducida, solo el panel lateral puede desplazarse.
- El visor usa **object-fit: contain** en todo momento para preservar la fotografía completa sin recortes ni deformaciones; al ampliar con zoom sí se pueden inspeccionar detalles.
- Botón **Ampliar vista** y atajo F11 para maximizar el área de trabajo; ESC sale de ese modo. En la ventana del cliente, ESC sale de pantalla completa sin cerrar la proyección.
- Proyección: usa todos los píxeles disponibles del JPEG original recibido, sin reducción deliberada de resolución; la calidad máxima **está limitada por la resolución del archivo origen**. Un CR2/CR3 mostrado mediante JPEG incrustado no equivale a un revelado RAW a resolución completa.
- Mantiene la conexión Canon y controles existentes.


## Detección de cámara USB/Wi-Fi v0.7.0
- Inicio automático: intenta USB y, si no hay cámara, busca Wi-Fi en la red local IPv4 /24. La búsqueda detecta TCP PTP/IP en el puerto 15740; encontrar el puerto **no garantiza** un emparejamiento autorizado.
- Si la Canon se desconecta, el visor mantiene la última imagen recibida y se intenta reconectar. El usuario recibe aviso dentro de la aplicación y notificación del sistema (si Windows la permite).
- Preferencias persistentes: Automática / Solo USB / Solo Wi-Fi, activación de autoconexión y dirección IP manual para redes no descubiertas.
- Wi-Fi implementado mediante biblioteca [FC.SDK](https://github.com/SharpAstro/FC.SDK), MIT, versión fijada `0800943d2d4aaaa8ffc5da11b5ce57bfed9614a7`; no necesita EDSDK para Wi-Fi. PTP/IP en puerto TCP 15740.
- El conector Wi-Fi recibe eventos de nuevos disparos y descarga RAW/JPEG; los RAW usan la vista JPEG incorporada cuando Canon la ofrece. Se conservan los originales en el directorio de sesión.
- USB continúa con el puente Canon EDSDK de las versiones anteriores.

### Primer emparejamiento Wi-Fi EOS 6D Mark II
1. Enciende Wi-Fi de la Canon, abre **Ajustes de comunicación inalámbrica → Función Wi-Fi → Conectar con computadora (EOS Utility)**, y selecciona la red del estudio o la conexión directa según el menú de Canon.
2. Conecta Windows a la misma red que la cámara. Revisa que ambas direcciones IP correspondan a la red local; si el modo directo requiere cambiar de red, hazlo desde Windows.
3. En la aplicación, selecciona **Solo Wi-Fi** para probarla sin interferencia USB y pulsa **Buscar cámara Wi-Fi**. Si la detección no funciona, introduce la IP de la Canon y pulsa **Conectar por Wi-Fi**.
4. Confirma en la cámara cualquier solicitud de autorización/emparejamiento si aparece.
5. Dispara desde el botón físico de la cámara y comprueba que llega un JPEG a la galería y al televisor.

**Estado de compatibilidad:** el motor PTP/IP está implementado, pero sus autores solo reportan pruebas físicas con EOS 6D original, no con la EOS 6D Mark II. Tampoco hemos podido probar la 6D Mark II físicamente en este entorno. Puede ser necesario añadir el protocolo de emparejamiento EOS específico si la Canon no autoriza la sesión. No se considera validado hasta recibir una fotografía real por Wi-Fi, aunque GitHub Actions compile exitosamente.

Documentación oficial de Canon sobre conexión a computadora: https://ph.canon/en/support/8203590200
