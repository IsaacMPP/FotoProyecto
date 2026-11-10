# Demi Visor Studio 0.9.0 beta — Interfaz y velocidad de recepción

## Punto de partida conservado
Rama fuente: `feature/demi-tether-windows-actions`, commit `80698cb480accd0fdff714b0407b0266c060efc8`.
La nueva rama `feature/demi-visor-2-ui-speed` NO modifica `camera-bridge/Program.cs` ni `wifi-bridge/Program.cs`. Mantiene emparejamiento, permisos Canon, detección USB/Wi-Fi, EDSDK y PTP/IP existentes.

## Mejoras
- Interfaz oscura con acentos magenta: visor grande, bandeja lateral con las 40 imágenes recientes en miniatura, estado de conexión y controles de sesión.
- Fotografías con carga anticipada en un objeto Image, de forma que la vista anterior permanece visible hasta que la nueva termine de cargar; errores visibles.
- Zoom alrededor del puntero con rueda/trackpad, doble clic, deslizador, botón Ajustar y botón 1:1 (cuando la resolución de la imagen lo permite, limitado a 600%).
- Desplazamiento mediante clic izquierdo + arrastrar, tanto en consola como en proyección.
- Operaciones atómicas de zoom y paneo desde consola al monitor del cliente. Se limita el envío de gestos a un envío por cuadro mediante requestAnimationFrame.
- Exploración de carpeta optimizada: si la lista de archivos y sus fechas no cambiaron, se evita reconstruir el estado y la galería en cada sondeo de 400 ms.
- Galería optimizada: miniaturas/DOM se regeneran únicamente cuando cambian los archivos.
- Wi-Fi conserva la preferencia existente JPEG rápido y RAW en tarjeta; puede desactivarse para recibir JPEG y RAW. USB usa el comportamiento establecido de EDSDK, **no se anuncia un nuevo modo USB solo JPG** hasta verificar seguridad con Canon 6D Mark II.

## Pruebas sugeridas en cámara
1. USB: disparar JPEG, RAW+JPEG y disparos sucesivos; confirmar que no desaparecen RAW de la tarjeta.
2. Wi-Fi: activar JPEG rápido, disparar RAW+JPEG y comprobar JPEG en PC; comparar tiempos reales con descarga completa. Las velocidades dependen de enlace y cámara.
3. Visualización: zoom cerca del rostro, arrastre, doble clic, ajustar, 1:1, selección de fotos antiguas, llegada de una nueva foto, pantalla completa y salida con ESC.
4. Cliente: abrir segunda pantalla, mover foto ampliada en consola y comprobar sincronía en TV.
5. Reconexión, revisión de carpeta y disponibilidad sin internet.

## Estado de aceptación
Cambios de interfaz y rendimiento implementados; compilación por GitHub Actions y prueba física del usuario pendientes. Esta beta NO sustituye el instalador funcional hasta que sea probada con la cámara.
