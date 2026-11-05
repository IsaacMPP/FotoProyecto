# Demi Tether Studio — Windows v0.3.0

Aplicación independiente para visualizar la **última fotografía** a pantalla completa en un televisor y recorrer las anteriores con flechas, PageUp/PageDown o presentador.

## Estado real

- **Implementado:** visor, carpeta monitorizada, selección de monitor, nueva fotografía automática, navegación, instalador NSIS y EXE portátil mediante GitHub Actions.
- **No implementado:** comunicación directa USB/Wi-Fi con Canon EOS 6D Mark II. Para integración nativa Windows hay que desarrollar y probar un puente Canon EDSDK; no se incluye ni se simula el controlador.
- Por ahora, utiliza imágenes JPEG/PNG/WebP guardadas en la carpeta elegida, independientemente de su origen.

## Compilar en GitHub

En GitHub, pestaña **Actions**, selecciona **Compilar Windows**. La ejecución de la rama `feature/demi-tether-windows-actions` produce el artefacto **Demi-Tether-Studio-Windows** con instalador y portable. No necesitas Node.js instalado en tu Windows para ejecutar el EXE.

## Usar

1. Conecta el televisor a Windows y elige **Extender pantallas**.
2. Abre el EXE instalado o portátil.
3. Elige una carpeta con fotos JPG/PNG/WebP.
4. Escoge la pantalla y pulsa **Abrir visor**.
5. Las flechas izquierda/derecha, PageUp/PageDown y los controles de presentaciones compatibles navegan por la galería cuando la ventana de la aplicación está enfocada. Hay atajos globales Alt+Izquierda/Alt+Derecha/Alt+Inicio.
6. Si se crea una foto nueva en la carpeta, el visor salta a ella cuando la opción automática está activada.

No dependemos de EOS Utility para el visor; la recepción directa desde la Canon está pendiente. No garantizamos el funcionamiento del mando hasta probar el modelo concreto.
