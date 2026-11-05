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


## Emparejamiento Canon Wi-Fi v0.7.1 (Err 11)

Se corrigió el fallo de diseño anterior: buscar solo TCP/15740 no equivale a descubrir/emparejar una cámara Canon. Demi Tether Studio ahora escucha anuncios DNS-SD/mDNS `_ptp._tcp.local` sobre UDP/5353 y, si no aparecen, utiliza la IP manual o un sondeo de la red local. Además, se crea y guarda un **GUID de cliente estable** en `camera-settings.json` y se reutiliza en los siguientes handshakes PTP/IP; FC.SDK, sin este cambio, creaba un GUID distinto en cada conexión.

**Importante:** la detección mDNS y el GUID persistente son necesarios para muchos modelos, pero por sí solos **no prueban que el EOS 6D Mark II acepte el emparejamiento**. Puede requerirse una secuencia Canon adicional todavía no implementada. Se debe comprobar en la cámara la pantalla de autorización, luego capturar una foto real. Nunca se describe conexión efectiva solo porque responda el puerto.

### Pasos de prueba
1. En Windows, conectar a la misma Wi-Fi que la cámara (para configuración directa, a su SSID que termina `_Canon0A`).
2. En la Canon, crear **nueva conexión a computadora (EOS Utility)** y permanecer en la pantalla «Iniciar emparejamiento».
3. En Demi, elegir **Solo Wi-Fi** y **Buscar cámara Wi-Fi**. Autorizar el acceso a redes privadas en el firewall de Windows si aparece el aviso (mDNS UDP 5353 y PTP/IP TCP 15740).
4. Confirmar la solicitud en la pantalla Canon si aparece. Si no aparece y da Err 11, registrar qué dice Demi; este resultado implica que falta una etapa de emparejamiento o falla mDNS. No instalar ni ejecutar EOS Utility simultáneamente.
5. Una vez conectada, realizar tres fotos JPG de prueba y verificar galería y televisor.

Fuentes: https://sg.canon/en/support/8203590200 ; https://cascable.se/help/troubleshooting/ ; https://github.com/JulianSchroden/camera_control_dart .


## v0.7.2 — Err 11, descubrir anuncios Canon EOS con SSDP + mDNS
- El menú EOS Utility de la 6D Mark II puede necesitar que el PC detecte los anuncios de descubrimiento Canon y confirme el emparejamiento. La app ahora escucha UDP 1900/SSDP, servicio `urn:schemas-canon-com:service:ICPO-WFTEOSSystemService:1`, y consulta con M-SEARCH, además de mDNS UDP 5353. Se filtra la procedencia de los anuncios a IPv4 de redes privadas y se valida el puerto TCP 15740 antes de iniciar la sesión.
- Si no se detecta, el mensaje indica que no hubo anuncios y especifica los puertos de la red. No se simula que se haya autorizado un emparejamiento: solo se considera conectada después de una sesión de cámara abierta satisfactoriamente.
- Manual Canon: https://gdlp01.c-wss.com/gds/2/0300027622/01/EOS_6D_Mark_II_Wi-Fi_Instruction_Manual_EN.pdf ; implementación documentada de descubrimiento SSDP: https://julianschroden.com/post/2023-05-10-pairing-and-initializing-a-ptp-ip-connection-with-a-canon-eos-camera/
- **No se ha comprobado físicamente con esta 6D Mark II**. Si persiste Err 11, necesitamos observar el anuncio y el handshake para determinar qué etapa falta; la compilación únicamente confirma que el programa se genera.


## v0.7.3 — Diagnóstico de emparejamiento nativo y salida Wi-Fi verificada por Canon

- La aplicación ya distingue las fases de detección PTP/IP, envío de identidad y autorización, sesión aceptada y recepción de imágenes. Guarda los eventos en un archivo local sin incluir fotografías. Puedes abrirlo desde **Abrir diagnóstico Wi-Fi**.
- Antes, un error del puente Wi-Fi se perdía al terminar el proceso y se reemplazaba por "desconectado"; ahora se conserva para identificar la fase real.
- Esta versión **no garantiza** que el Wi-Fi nativo funcione en EOS 6D Mark II sin implementar pasos adicionales específicos. Err 11 significa que la cámara no encontró el receptor esperado, y la compilación no resuelve eso por sí misma.

### Alternativa funcional inmediata sin cable entre cámara y PC
1. Usa EOS Utility 3 oficial de Canon en Windows para emparejar la EOS 6D Mark II por Wi-Fi (conexión EOS Utility, no smartphone). En la Canon, selecciona registrar un equipo nuevo y en Windows conecta a la SSID Canon indicada o usa la misma red.
2. Dentro de EOS Utility, abre **Configuración de cámara/Disparo remoto** y configura **Preferencias → Carpeta de destino** a la misma carpeta seleccionada en Demi Tether Studio. Desactiva la creación de subcarpetas, si está activada; el visor actual monitoriza la carpeta elegida, no carpetas anidadas.
3. Si disparas RAW+JPEG, marca la opción **transferir solamente JPEG al ordenador**; así el visor puede mostrar el JPEG rápidamente mientras el CR2 se conserva en la tarjeta.
4. Configura guardar las tomas también en la tarjeta. Usa el disparador físico de Canon; EOS Utility transfiere el JPEG a Windows, Demi lo detecta y lo presenta en el televisor.
5. No conectes simultáneamente el puente USB/PTP de Demi a la cámara: dos programas de control pueden competir por la sesión. Si vas a usar el modo oficial temporal, desactiva **Conectar y reconectar automáticamente** en Demi, y usa solamente **Elegir carpeta** para visualizar.

Fuentes oficiales: https://www.usa.canon.com/support/p/eos-6d-mark-ii ;
https://cam.start.canon/en/S003/manual/html/UG-00_Before_0060.html ;
https://gdlp01.c-wss.com/gds/7/0300016207/21/EOS_Utility_3.12_Manual_Win_EN.pdf

Objetivo final: eliminar EOS Utility cuando se valide el emparejamiento nativo en la 6D Mark II.


## v0.7.4 — modo Wi-Fi asistido para trabajar sin cable
Este modo se diseñó para la Canon EOS 6D Mark II, mientras se investiga el emparejamiento nativo. El Wi-Fi y la transferencia los gestiona el programa oficial Canon EOS Utility 3; Demi Tether Studio recibe sus JPEG mediante la carpeta de destino y los presenta en la vista principal y en el televisor. **No es comunicación PTP/IP directa de Demi con la cámara**.

- Instalar y emparejar [EOS Utility 3 oficial](https://www.usa.canon.com/support/p/eos-6d-mark-ii). En Canon: Control remoto (EOS Utility) → Registrar dispositivo para conexión. PC y cámara deben utilizar la red correcta.
- En EOS Utility configurar *Remote Shooting / Disparo remoto* → Preferencias → Carpeta de destino a una carpeta conocida, preferiblemente sin subcarpetas adicionales. Elegir descarga JPG o disparar RAW+JPG para visualización inmediata; guardar RAW originales en tarjeta si se desea.
- En Demi pulsar **Usar fotos recibidas por Wi-Fi**, seleccionar la misma carpeta, y proyectar la última fotografía en monitor secundario. El programa desactiva autoconexión directa USB/PTP/IP para evitar competir con EOS Utility. Conserva la carpeta entre reinicios.
- El botón **Finalizar modo asistido** desactiva este modo; no modifica las fotos ni desinstala EOS Utility. Esta modalidad puede mostrar imágenes ya existentes en la carpeta.
- Para diagnosticar el emparejamiento nativo, el botón **Abrir diagnóstico Wi-Fi** sigue disponible. Pruebas físicas con Canon pendientes.


## v0.7.5 — corrección dirigida a los rechazos TCP de la Canon
El diagnóstico físico EOS 6D Mark II de 2026-11-05 confirma el anuncio SSDP de `192.168.1.59` pero registra `connection refused`, `connection reset by peer` y timeout antes de que se complete el handshake PTP/IP. El problema no es la ausencia de IP. En versiones anteriores, `portOpen()` abría y cerraba TCP/15740 **antes** del intento real de emparejamiento (tanto con IP manual como con descubrimiento SSDP/mDNS); esto es especialmente arriesgado para equipos que solo admiten un cliente en la fase de asociación.

- Se eliminó totalmente `portOpen` de la detección y la búsqueda por barrido de 254 direcciones que abría conexiones temporales a 15740.
- La app descubre la IP por UDP SSDP/mDNS (o usa la IP manual) **sin conectarse al TCP**. El primer socket TCP abierto hacia la Canon corresponde al puente FC.SDK, que envía `InitCommandRequest` por esa misma conexión.
- Después de un fallo Wi-Fi, la app **espera 120 segundos** antes de un nuevo intento automático en lugar de repetir el handshake cada 30 segundos. El botón Conectar Wi-Fi permite probar manualmente antes; no se requiere reconectar el USB.
- Sigue pendiente la confirmación física: es una corrección de un problema observable en nuestro código, **no** prueba de que el protocolo Canon acepte el cliente. Las conexiones SSDP detectadas no cuentan como sesiones emparejadas.

Para la prueba: usar modo **Solo Wi-Fi**, desactivar temporalmente la reconexión automática, cerrar EOS Utility si se está intentando conexión **nativa**, crear una conexión nueva en menú Canon y pulsar **Buscar cámara Wi-Fi** una sola vez mientras espera asociación. Si vuelve a Err 11, abrir el diagnóstico y copiar la nueva secuencia; no repetir decenas de intentos en rápida sucesión.


## v0.8.0 — Emparejar directamente Demi (experimental)

**Objetivo:** crear una asociación propia y persistente con la EOS 6D Mark II, sin utilizar EOS Utility para establecer ni mantener la sesión. El SDK usado para la conexión nativa es FC.SDK con identidad de cliente persistente; la funcionalidad todavía necesita validación física con este modelo.

**Prueba controlada:**
1. En Windows, salir por completo de EOS Utility, incluido su proceso de asociación en segundo plano.
2. En Demi Tether Studio, apagar **Conectar y reconectar automáticamente**.
3. En Canon: función Wi-Fi → **Control remoto (EOS Utility)** → **Registrar dispositivo para conexión**. Crear una asociación nueva; no elegir la conexión guardada de EOS Utility.
4. Unirse desde Windows a la misma red de la cámara.
5. En Demi pulsar **Emparejar Demi con Canon (sin EOS Utility)** una sola vez. La aplicación genera un nuevo GUID local de cliente, lo guarda y utiliza el nombre *Demi Tether Studio*. No se borra ni suplanta la identidad de EOS Utility.
6. Si la Canon pide permiso para la conexión con el ordenador, confirmar. Si completa la sesión, disparar tres JPG de prueba.
7. Si falla, pulsar **Abrir diagnóstico Wi-Fi**. Se registran por separado: apertura del TCP de comandos, envío InitCommandRequest, tipo de respuesta, apertura del canal de eventos, envío InitEventRequest y respuesta. El registro no imprime el GUID.

**Limitación:** la respuesta TCP rechazada puede aparecer si EOS Utility sigue usando la cámara, si se reutiliza un perfil anterior o si el firmware de la 6D II requiere otro paso de asociación. El código y la compilación por sí solos no prueban compatibilidad Wi-Fi completa; solo una sesión física aceptada y una fotografía recibida pueden confirmarla.


## v0.8.1 — Corregir ambigüedad entre SSDP y mDNS
En la prueba aportada por el usuario (2026-11-05 06:48 UTC), mDNS devolvió `192.168.1.60` y SSDP `192.168.1.47`. La versión anterior seleccionaba **siempre SSDP** primero y conectaba a `.47`, donde se rechazó el socket TCP. **No se puede afirmar cuál de ambas IP representa a la EOS 6D Mark II sin verificar el dispositivo**.

- La búsqueda ahora recoge todas las direcciones anunciadas con origen y nombre del servicio; las muestra bajo **Dispositivos detectados**.
- Si hay direcciones contradictorias, Demi no intentará una conexión automática a una IP arbitraria: exige seleccionar la dirección y pulsar **Conectar a dirección elegida**. El registro incluirá la dirección seleccionada y el método de detección.
- No se abre ningún TCP previo solo para comprobar el puerto. La selección conecta mediante PTP/IP; si la cámara la rechaza, no se afirma que el emparejamiento se haya completado.
- Si hay una sola dirección anunciada, sigue disponible la prueba automática. Con la sesión oficial de Canon activa, cierra EOS Utility antes de probar el modo nativo de Demi.
- En una asociación nueva, el botón **Emparejar Demi con Canon** prepara el GUID y realiza descubrimiento. Si existen varias IP, debes seleccionar una antes de continuar.

**Prueba sugerida:** vuelve a iniciar una nueva asociación en la Canon, pulsa el botón de emparejamiento, examina nombre/origen de las dos IP y elige la correspondiente a la Canon. Si no hay certeza, puedes probarlas de una en una con la cámara esperando y registrar las fases PTP/IP. Si sigue apareciendo `SocketException: connection refused`, necesitamos el registro de la IP concreta para distinguir selección incorrecta de problema del protocolo de asociación.


## v0.8.2 — Corregir OpenSession después de los dos ACK PTP/IP
El registro de la Canon EOS 6D Mark II de 2026-11-05 07:00:31 y 07:02:25 confirma que la cámara `192.168.1.60` aceptó **InitCommandAck** y **InitEventAck**. El fallo siguiente `InternalError` sucede al comenzar las operaciones PTP. El transporte Wi-Fi del FC.SDK fijado construía `OperationRequest` con 6 bytes de sobra y devolvía `OperationResponse`/paquetes de datos sin reconstruir la cabecera PTP estándar que exige su `PtpSession`. Como consecuencia, el propio motor trataba respuestas válidas como un error genérico.

El script `ptpip-framing-patch.py` corrige en el checkout fijado de FC.SDK:
- El tamaño y campos de **OperationRequest** (op code, transaction id, data phase, parámetros) y el envío de datos de escritura.
- La adaptación **OperationResponse → PTP Response** y **StartData / DataPacket / EndDataPacket → PTP Data**, con tamaño/código/transacción correctos.
- La adaptación de eventos de PTP/IP a PTP y respuesta al paquete de keepalive ProbeRequest.
- El buffer de descarga para CanonGetObject hasta 96 MiB (sin aumentar el buffer de consultas normales).
- Se conservan el GUID estable, el descubrimiento mDNS de `192.168.1.60`, las trazas y el modo Wi-Fi asistido anterior.

**Validación pendiente con el hardware real:** la compilación exitosa no garantiza todavía que se complete `OpenSession`, que el firmware acepte `SetRemoteMode`, o que la transferencia de fotos sea correcta. El diagnóstico registra `[PTP-IP] OperationRequest opcode=...`, `OperationResponse code=...` y `DataReceived` para detectar el siguiente punto con precisión. El cambio solo se aplica al motor **Wi-Fi**, sin alterar el puente USB EDSDK.

Para probar: deja la cámara esperando nueva asociación, cierra EOS Utility, entra en Solo Wi-Fi y selecciona **192.168.1.60 — mDNS** si la cámara sigue anunciándose con esa dirección; evita usar `192.168.1.47` solo por aparecer en SSDP. Inicia una conexión y envía únicamente las nuevas líneas del diagnóstico posteriores a `Traza PTP/IP`.


## v0.8.3 — Inicialización Wi-Fi EOS 6D Mark II
La prueba física detectó OpenSession 0x1002 (OK), SetRemoteMode 0x9114 (OK), SetEventMode 0x9115 (OK) y volcado de eventos 0x9116 (OK). La inicialización se bloqueaba en la transacción 13: solicitud opcional 0x9127 que no respondía.

El script wifi-startup-patch.py omite exclusivamente las peticiones opcionales 0x9127 durante el arranque Wi-Fi y preserva las operaciones esenciales. Se activa solo en wifi-bridge, con DEMI_WIFI_SKIP_OPTIONAL_STARTUP=1; el puente USB no cambia. El tiempo máximo de apertura pasa a 35 segundos. La traza incluye "Essential session initialized; skipping optional property reads 0x9127".

Pendiente: validar sesión abierta y descarga de una foto real. No se considera conexión comprobada solo por compilar. Para la prueba, cerrar EOS Utility, conservar el perfil/GUID actual y seleccionar la IP de la Canon 192.168.1.60 si sigue siendo la anunciada por mDNS.


## v0.8.4 — Fotografía Wi-Fi más rápida sin bajar la calidad
- Los JPEG y RAW originales se descargan **sin recompresión ni reducción de resolución**; el puente guarda temporalmente como `.part`, realiza el cambio de nombre a su formato final cuando la descarga termina y notifica de inmediato a la interfaz. Evita mostrar imágenes incompletas.
- La galería confía en la confirmación del propio puente Wi-Fi para mostrar el archivo terminado inmediatamente, en lugar de esperar dos comprobaciones sucesivas de tamaño/fecha; para archivos externos se conserva la validación de estabilidad.
- La revisión periódica de carpeta baja de 850 a 400 ms y la recepción de eventos Canon pasa de 250 a 120 ms. Se elimina el registro excesivo de consultas sin novedades `0x9116`; se conservan los errores y respuestas útiles.
- Después de cada transferencia se muestra su duración en el estado (`Foto original ... descargada en ... s`). Así podemos separar la latencia propia de Wi-Fi del tiempo perdido en la aplicación.
- La copia RAW/JPEG y el modo Wi-Fi nativo permanecen disponibles, sin requerir EOS Utility. La velocidad real depende del tamaño del archivo, las interferencias y el enlace de la Canon.

**Nota:** no se garantiza una transferencia más rápida del archivo completo por encima del límite de Wi-Fi de la cámara. La mejora de interfaz puede ahorrar parte de la espera entre el final de la transferencia y su aparición en pantalla. Validar con tres disparos JPG en una sesión real.


## v0.8.5 — Modo de sesión JPEG rápida (RAW solo en tarjeta)
**Motivo medido:** Canon EOS 6D Mark II descarga JPEG de 4–5 MB en aproximadamente 1–1.3 s, mientras RAW de 29–30 MB tardan 7.5–8.2 s y bloquean el JPEG siguiente en la misma conexión de control. Es un límite real de transferencia, no un retraso principal de la galería.

- Nueva opción **JPEG rápido al PC · RAW en tarjeta Canon**, activada por defecto en nuevas instalaciones. Enciende la sesión con la cámara en **RAW+JPEG** y verifica que se guardan ambos en la tarjeta.
- Con esta opción activada, Demi descarga el JPEG original completo al PC y al visor, sin recompresión. **Omite la transferencia RAW al ordenador** y confirma el evento de transferencia en el canal Canon. Los RAW permanecen en la tarjeta si la cámara está configurada para guardar en tarjeta y PC. Antes de trabajar con clientes, realizar una prueba verificando físicamente que se conservan los CR2 en la tarjeta.
- En modo completo (casilla desactivada), Demi seguirá descargando JPEG y RAW al PC, tardando lo correspondiente al tamaño de los RAW. Cambiar la casilla mientras está conectado requiere desconectar y volver a conectar.
- Los objetos cuyo nombre falla en la consulta CanonGetObjectInfo se ignoran en modo rápido; su contenido no se elimina de la tarjeta. Si se dispara **solo RAW**, el modo rápido NO descarga RAW al PC ni ofrece vista JPEG completa; es imprescindible **RAW+JPEG**.
- No se prometen tiempos exactos para cada disparo, ni se afirma que aumentar la frecuencia de polling acelere el enlace. Verificar los mensajes "Foto original ... descargada en ... s" tras realizar tres disparos separados.
