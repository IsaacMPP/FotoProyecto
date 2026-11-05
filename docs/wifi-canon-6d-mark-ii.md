# Wi-Fi Canon EOS 6D Mark II — evaluación técnica

## Objetivo
Recepción automática de la fotografía al disparar físicamente, proyección de la última captura, navegación por flechas o presentador. Sin EOS Utility u otra app residente.

## Confirmado por Canon
- La EOS 6D Mark II ofrece modo punto de acceso y modo infraestructura Wi-Fi, 2.4 GHz (802.11 b/g/n).
- Admite conexión inalámbrica con una computadora utilizando EOS Utility; esto **no prueba** que una app de terceros pueda emparejarse sin implementar el protocolo.
- Canon EDSDK documenta control USB. Canon CCAPI es Wi-Fi pero la EOS 6D Mark II no aparece en su lista de modelos compatibles.

Fuentes:
- https://sg.canon/en/support/8203590200
- https://ph.canon/en/support/6200470100
- https://asia.canon/en/campaign/developerresources/sdk

## Biblioteca candidata: FC.SDK
- https://github.com/SharpAstro/FC.SDK
- C# administrado, licencia MIT, no requiere EDSDK.dll.
- Windows: WPD ioctl / WPD COM, sin cambio de driver.
- Wi-Fi: PTP/IP TCP puerto 15740; requiere solucionar descubrimiento y emparejamiento Canon EOS Utility.
- Descargas JPEG/RAW y recepción de eventos documentadas por el proyecto.
- **Probado físicamente por sus autores en EOS 6D original, NO en EOS 6D Mark II.** No afirmar compatibilidad confirmada.

## Siguiente implementación que necesita pruebas reales
1. Crear conector experimental separado PTP/IP sobre FC.SDK para diagnosticar descubrimiento, conexión, autorización y eventos.
2. Investigar modo 'Control remoto (EOS Utility)' de la cámara, no confundir con modo smartphone.
3. Detectar cámara en misma LAN (o conectarse a su AP), implementar asociación y obtener IP / puerto 15740.
4. Descargar JPEG al disparar (sin activar disparo remoto) y enviarlo al visor existente.
5. Probar series de 30 disparos, reconexión, ahorro de energía, latencia, pérdida de conexión, foto nueva mientras usuario consulta antiguas.
6. Solo habilitar Wi-Fi como opción estable tras validación en EOS 6D Mark II física.

## Estado
Investigación; no se ha agregado integración Wi-Fi funcional. La integración USB EDSDK ya está en la rama, pero requiere SDK de Canon y prueba física.
