# Demi Tether Studio v0.4.0 — Windows

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
