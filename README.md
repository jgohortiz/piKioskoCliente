# piKioskoCliente

[![License: MIT](https://img.shields.io/badge/License-MIT-C51A4A.svg)](LICENSE)

**piKioskoCliente** es una aplicación de kiosco digital diseñada para reproducir listas de videos de forma continua y desatendida. Está construida sobre [Electron](https://www.electronjs.org/), lo que le permite ejecutarse de forma nativa tanto en Windows como en Raspberry Pi OS de 64 bits sin modificar el código fuente.

La aplicación consulta una URL configurable que devuelve un listado JSON de videos, los descarga localmente y los reproduce en bucle a pantalla completa. Al terminar el último video vuelve a consultar la URL para actualizar la lista: descarga los videos nuevos y elimina del disco los que ya no aparecen. Si la conexión no está disponible, continúa reproduciendo la caché local y muestra un indicador de estado **OFFLINE** hasta que la sincronización vuelva a tener éxito.

Toda la configuración —URL de la lista, color e imagen de fondo— se gestiona mediante un único archivo de texto (`piKioskoCliente.conf`) que se coloca junto al ejecutable, y también puede editarse en tiempo de ejecución desde el panel de ajustes integrado sin necesidad de reiniciar la aplicación.

---

## Características

- Reproducción en pantalla completa y bucle continuo sin intervención del usuario.
- Sincronización automática al finalizar cada ciclo: descarga videos nuevos y elimina los obsoletos.
- Indicador **OFFLINE** visible en la esquina superior derecha cuando la URL no responde; desaparece automáticamente al recuperar la conexión.
- Toda la configuración centralizada en `piKioskoCliente.conf`, editable tanto en texto plano como desde el panel de ajustes de la propia aplicación.
- Barra inferior con el nombre del video en reproducción y su posición en la lista (`3 / 5`).
- Barra de progreso del video en el borde inferior de la pantalla.
- Modo kiosco real: bloquea Alt+F4, siempre en primer plano, sin bordes de ventana.
- Compatible con HTTP y HTTPS tanto para la playlist como para los archivos de video.
- Tipografía multiplataforma (Segoe UI en Windows, DejaVu Sans en Raspberry Pi OS).
- Paleta de colores basada en el logo de Raspberry Pi (frambuesa #C51A4A, hoja #6AB023).

---

## Estructura del proyecto

```
piKioskoCliente/
├── assets/
│   └── icon.png             ← Ícono de la aplicación (logo Raspberry Pi)
├── src/
│   ├── main.js              ← Proceso principal Electron: ventana, descargas, IPC
│   ├── config.js            ← Lectura y escritura de piKioskoCliente.conf
│   ├── preload.js           ← Puente IPC seguro entre main y renderer (contextBridge)
│   └── index.html           ← Toda la UI: reproductor, HUD, badge offline, panel de ajustes
├── piKioskoCliente.conf     ← ★ Archivo de configuración principal
├── test-server.js           ← Servidor HTTP local para probar la app en desarrollo
├── package.json             ← Dependencias y scripts de build
├── LICENSE                  ← Licencia MIT
└── README.md
```

El proceso principal (`main.js`) se encarga de la lógica pesada: leer el archivo `.conf`, abrir la ventana a pantalla completa, descargar los videos y servir de intermediario (IPC) entre el sistema de archivos y la interfaz. El renderer (`index.html`) gestiona toda la reproducción y la UI, comunicándose con el proceso principal exclusivamente a través del puente seguro definido en `preload.js`.

---

## Archivo de configuración: `piKioskoCliente.conf`

El archivo `piKioskoCliente.conf` es el único punto de configuración de la aplicación. Debe estar ubicado en el mismo directorio que el ejecutable (o en la raíz del proyecto al trabajar en modo desarrollo). Se lee al arrancar y puede modificarse desde el panel de ajustes integrado sin reiniciar.

```ini
# ─────────────────────────────────────────────
# piKioskoCliente.conf — Configuración del kiosco
# ─────────────────────────────────────────────

# URL del endpoint JSON con la lista de videos a reproducir.
PLAYLIST_URL = https://tu-servidor.com/playlist.json

# Color de fondo mostrado detrás del video y en la pantalla de carga.
# Acepta cualquier valor CSS válido: #RRGGBB, rgb(), nombre de color…
BACKGROUND_COLOR = #000000

# Imagen de fondo opcional (se adapta al tamaño de pantalla con object-fit: cover).
# Puede ser una ruta absoluta, relativa al .conf, o una URL http/https.
# Dejar en blanco para no usar imagen de fondo.
BACKGROUND_IMAGE =
```

### Parámetros disponibles

| Parámetro          | Descripción                               | Ejemplo                                 |
|--------------------|-------------------------------------------|-----------------------------------------|
| `PLAYLIST_URL`     | URL del JSON con la lista de videos       | `https://mi-servidor.com/playlist.json` |
| `BACKGROUND_COLOR` | Color de fondo (CSS)                      | `#000000`, `rgb(20,20,30)`, `navy`      |
| `BACKGROUND_IMAGE` | Imagen de fondo (ruta local o URL remota) | `/home/pi/fondo.jpg`                    |

Las líneas que comienzan con `#` son comentarios y se ignoran. El formato es `CLAVE = valor`; los espacios alrededor del `=` son opcionales.

### Dónde busca el archivo

`config.js` busca `piKioskoCliente.conf` en el siguiente orden de prioridad. Se usa el primero que se encuentre:

1. Directorio del ejecutable empaquetado (junto al `.exe` o al `AppImage`)
2. Directorio de trabajo actual —útil al lanzar con `npm start` durante el desarrollo—
3. Un nivel por encima de `resources/` —ruta estándar de electron-builder—
4. Raíz del paquete Electron

Si no se encuentra el archivo en ninguna ubicación, la aplicación arranca con los valores por defecto y creará el `.conf` en el directorio de trabajo la primera vez que se guarde desde el panel de ajustes.

---

## Panel de ajustes (botón ⚙)

El botón ⚙ en la esquina inferior derecha permite cambiar la configuración en caliente, sin salir de la aplicación ni editar archivos manualmente. Al pulsarlo se abre un panel modal con los tres parámetros del `.conf`.

El campo de color incluye tanto una entrada de texto libre (acepta cualquier valor CSS) como un selector visual de color nativo del sistema operativo; ambos están sincronizados entre sí.

Al pulsar **Guardar**:
- El archivo `piKioskoCliente.conf` se reescribe en disco con la nueva configuración y una marca de fecha.
- El color e imagen de fondo se aplican al instante en la pantalla sin reiniciar.
- La nueva URL de playlist se usará en la siguiente sincronización (al terminar el ciclo actual o al pulsar F5).

---

## Indicador de estado de red (OFFLINE)

Cuando la solicitud a `PLAYLIST_URL` falla —por cualquier motivo: sin red, servidor caído, URL incorrecta, respuesta no válida— aparece en la esquina superior derecha una píldora roja con el texto **OFFLINE** y un punto pulsante. El indicador permanece visible mientras el problema persista.

La aplicación no se detiene: sigue reproduciendo los videos descargados previamente. Cada vez que termina el ciclo de reproducción vuelve a intentar contactar la URL. En cuanto la respuesta sea exitosa el indicador desaparece automáticamente y la lista se sincroniza con normalidad.

---

## Información en pantalla durante la reproducción

| Posición               | Contenido                                            |
|------------------------|------------------------------------------------------|
| Esquina superior der.  | Badge **OFFLINE** (solo visible cuando hay error de red) |
| Esquina inferior izq.  | Nombre del video en reproducción + posición `3 / 5`  |
| Esquina inferior der.  | Botón ⚙ para abrir el panel de ajustes              |
| Borde inferior         | Barra de progreso del video actual                   |

El nombre del video y el contador aparecen al cambiar de video y también al mover el ratón; se ocultan solos a los 5 segundos de inactividad para no interferir con el contenido.

---

## Formato del JSON de playlist

El servidor apuntado por `PLAYLIST_URL` debe devolver un JSON con la lista de videos en uno de estos tres formatos. La aplicación detecta automáticamente cuál se está usando.

### Opción A — Array de objetos (recomendado)

Permite control total sobre el nombre local del archivo y el orden de reproducción.

```json
[
  { "id": "1", "filename": "video-corporativo.mp4", "url": "https://cdn.ejemplo.com/v1.mp4" },
  { "id": "2", "filename": "spot-publicitario.mp4", "url": "https://cdn.ejemplo.com/v2.mp4" },
  { "id": "3", "filename": "pantalla-bienvenida.mp4","url": "https://cdn.ejemplo.com/v3.mp4" }
]
```

### Opción B — Objeto con propiedad `videos`

Útil si el endpoint ya devuelve otros metadatos junto a la lista.

```json
{
  "updated": "2024-01-15",
  "videos": [
    { "id": "1", "filename": "video.mp4", "url": "https://..." }
  ]
}
```

### Opción C — Array de URLs directas

La opción más simple. El nombre del archivo se extrae del último segmento de la URL.

```json
[
  "https://cdn.ejemplo.com/video1.mp4",
  "https://cdn.ejemplo.com/video2.mp4"
]
```

---

## Instalar el sistema operativo Raspberry Pi OS de 64 bits

Antes de instalar piKioskoCliente en una Raspberry Pi es necesario preparar el sistema operativo. Raspberry Pi OS es la distribución oficial basada en Debian, mantenida por la Raspberry Pi Foundation. La versión de 64 bits aprovecha al máximo el procesador ARM64 presente en los modelos Raspberry Pi 3, 4 y 5, y es la recomendada para ejecutar Electron y aplicaciones modernas.

### Qué necesitas

- Una Raspberry Pi 3, 4 o 5
- Una tarjeta microSD de al menos 16 GB (clase 10 o superior recomendada)
- Un lector de tarjetas microSD (muchos portátiles lo incluyen o se consigue un adaptador USB)
- Un ordenador Windows, macOS o Linux para preparar la tarjeta
- Conexión a Internet

### Paso 1 — Descargar Raspberry Pi Imager

**Raspberry Pi Imager** es la herramienta oficial para escribir el sistema operativo en la tarjeta microSD. Descárgala desde:

[https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/)

Está disponible para Windows, macOS y Ubuntu/Debian. Instálala en tu ordenador como cualquier otra aplicación.

### Paso 2 — Seleccionar dispositivo y sistema operativo

1. Abre Raspberry Pi Imager.
2. Pulsa **"Choose Device"** y selecciona el modelo de tu Raspberry Pi (p. ej. *Raspberry Pi 4*).
3. Pulsa **"Choose OS"** y selecciona:
   - `Raspberry Pi OS (other)` → `Raspberry Pi OS (64-bit)`
   - Esta versión incluye escritorio gráfico, que es necesario para ejecutar piKioskoCliente en modo kiosco visual.
4. Pulsa **"Choose Storage"** y selecciona tu tarjeta microSD. Asegúrate de seleccionar la correcta, ya que el proceso borrará todo su contenido.

### Paso 3 — Configuración avanzada (opcional pero recomendado)

Antes de escribir, pulsa el icono de engranaje ⚙ (o **"Edit Settings"**) para preconfigurar:

- **Nombre del equipo** (hostname): p. ej. `pikiosko`
- **Usuario y contraseña**: evita usar el usuario por defecto `pi` sin contraseña en entornos de producción
- **Red Wi-Fi**: SSID y contraseña de tu red, para que la Pi se conecte automáticamente al primer arranque
- **SSH habilitado**: útil para administrar la Pi de forma remota sin necesidad de teclado ni monitor

### Paso 4 — Escribir la imagen en la tarjeta

1. Pulsa **"Write"**.
2. Confirma la advertencia de que se borrarán todos los datos de la tarjeta.
3. Espera a que el proceso termine (puede tardar entre 5 y 15 minutos según la velocidad de la tarjeta).
4. Cuando Imager muestre el mensaje de verificación completada, retira la tarjeta de forma segura.

### Paso 5 — Primer arranque

1. Inserta la microSD en la Raspberry Pi.
2. Conecta el monitor (HDMI), teclado y ratón.
3. Conecta la alimentación. La Pi arrancará automáticamente desde la tarjeta.
4. En el primer arranque aparecerá el asistente de configuración inicial (idioma, zona horaria, actualización del sistema). Complétalo.
5. Una vez en el escritorio, abre una terminal y actualiza el sistema:

```bash
sudo apt update && sudo apt upgrade -y
```

La Raspberry Pi ya está lista para instalar piKioskoCliente.

---

> 💡 **Tip**
>
> En el siguiente enlace puedes ver cómo instalar el sistema operativo en detalle → [Install an operating system](https://www.raspberrypi.com/documentation/computers/getting-started.html#installing-the-operating-system)

---

## Instalación y uso en Windows (desarrollo)

Para trabajar con el código fuente en Windows se necesita Node.js y, opcionalmente, VSCode. La configuración de depuración incluida en `.vscode/launch.json` permite lanzar la app directamente con F5 con DevTools abiertos.

### Requisitos previos

- **Node.js** ≥ 18.x — [https://nodejs.org](https://nodejs.org)
- **npm** — viene incluido con Node.js
- **VSCode** (recomendado) — [https://code.visualstudio.com](https://code.visualstudio.com)

### Pasos

```bash
# Situarse en el directorio del proyecto
cd piKioskoCliente

# Instalar dependencias (solo la primera vez)
npm install
```

```bash
# Terminal 1 — arrancar el servidor JSON de prueba
node test-server.js
# → Sirve http://localhost:3000/playlist.json con 3 videos de muestra
```

```bash
# Terminal 2 — lanzar la aplicación en modo desarrollo
npm start

# Con DevTools abiertos (o pulsar F5 en VSCode)
npm run dev
```

En modo desarrollo el modo kiosco está desactivado: la ventana tiene borde, puede redimensionarse y se puede cerrar con Ctrl+Esc. Esto facilita iterar sin tener que matar el proceso desde el administrador de tareas.

---

## Compilar para producción

La compilación genera ejecutables autocontenidos que no requieren Node.js ni ninguna dependencia instalada en el equipo destino. El proceso usa [electron-builder](https://www.electron.build/), que se descarga automáticamente como dependencia de desarrollo.

### Preparación (ambas plataformas)

Antes de compilar, asegúrate de que `npm install` se ha ejecutado al menos una vez en el proyecto para que electron-builder esté disponible:

```bash
cd piKioskoCliente
npm install
```

---

### Windows — Instalador `.exe`

Genera un instalador NSIS para Windows x64. Permite elegir el directorio de instalación, crea un acceso directo en el escritorio y registra la aplicación en "Agregar o quitar programas".

```bash
npm run build:win
```

**Resultado:** `dist/piKioskoCliente Setup 1.0.0.exe`

Una vez instalada la aplicación, el archivo de configuración debe colocarse en el mismo directorio donde quedó el ejecutable. En una instalación típica con la ruta por defecto:

```
C:\Program Files\piKioskoCliente\
├── piKioskoCliente.exe
└── piKioskoCliente.conf     ← crear este archivo manualmente tras la instalación
```

> **Nota:** Windows puede requerir privilegios de administrador para escribir en `C:\Program Files\`. Si se prefiere evitarlo, durante la instalación se puede elegir una ruta dentro del perfil del usuario (p. ej. `C:\Users\TuUsuario\piKioskoCliente\`).

---

### Raspberry Pi OS 64-bit — AppImage

El formato AppImage es un ejecutable portable: no requiere instalación, no modifica el sistema y puede ejecutarse directamente desde cualquier directorio. Soporta Raspberry Pi OS de 64 bits (basado en Debian ARM64).

#### Opción 1 — Compilar directamente en la Raspberry Pi (recomendado)

Es la forma más fiable, ya que el binario se genera para la arquitectura exacta del hardware.

```bash
# Actualizar el sistema e instalar Node.js
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm

# Verificar versión de Node.js (debe ser ≥ 18)
node --version

# Instalar dependencias del proyecto
cd piKioskoCliente
npm install

# Compilar
npm run build:linux

# Dar permisos de ejecución al AppImage generado
chmod +x dist/piKioskoCliente-*.AppImage
```

**Resultado:** `dist/piKioskoCliente-1.0.0-arm64.AppImage`

Si la versión de Node.js del repositorio de apt es inferior a 18, instalar desde NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Opción 2 — Cross-compilar desde Windows

Permite generar el AppImage en un equipo Windows sin necesidad de tener la Raspberry Pi conectada durante la compilación. Requiere que electron-builder descargue las herramientas de compilación cruzada (ocurre automáticamente la primera vez).

```bash
# En Windows, desde el directorio del proyecto
npm run build:rpi
```

**Resultado:** `dist/piKioskoCliente-1.0.0-armv7l.AppImage`

Una vez generado, copiar el AppImage a la Raspberry Pi (por SCP, USB, o cualquier otro medio) y dar permisos de ejecución:

```bash
# Desde Windows, copiar por SCP (requiere SSH habilitado en la Pi)
scp dist/piKioskoCliente-*.AppImage pi@192.168.1.X:/home/pi/

# En la Raspberry Pi
chmod +x /home/pi/piKioskoCliente-*.AppImage
```

> **Nota sobre arm64 vs armv7l:** `build:linux` genera un binario ARM64 nativo (más eficiente en Raspberry Pi 4 y 5 con OS de 64 bits). `build:rpi` genera ARMv7l (32-bit), compatible con más modelos pero menos eficiente. Para Raspberry Pi OS de 64 bits, usar siempre `build:linux`.

---

## Ejecutar en Raspberry Pi

El AppImage y el archivo de configuración deben estar en el mismo directorio:

```
/home/pi/
├── piKioskoCliente-1.0.0-arm64.AppImage
└── piKioskoCliente.conf
```

Ejecutar con la bandera `--no-sandbox`, requerida en Linux cuando se ejecuta como usuario sin privilegios especiales de espacio de nombres:

```bash
./piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
```

Si la pantalla parpadea o hay problemas con la aceleración gráfica (frecuente en Raspberry Pi con ciertos drivers):

```bash
ELECTRON_DISABLE_GPU=1 ./piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
```

---

## Autostart en Raspberry Pi (modo kiosco permanente)

Para que la aplicación arranque automáticamente al encender la Raspberry Pi sin intervención del usuario, hay dos métodos según el entorno de escritorio.

### Con systemd (recomendado para entornos de producción)

Crea el archivo de servicio:

```bash
sudo nano /etc/systemd/system/pikiosko.service
```

Contenido del archivo:

```ini
[Unit]
Description=piKioskoCliente — Reproductor de kiosco
After=graphical-session.target network-online.target
Wants=graphical-session.target network-online.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
WorkingDirectory=/home/pi
ExecStart=/home/pi/piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
Restart=always
RestartSec=5

[Install]
WantedBy=graphical-session.target
```

Activar e iniciar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pikiosko
sudo systemctl start pikiosko

# Comprobar estado
sudo systemctl status pikiosko

# Ver logs en tiempo real
journalctl -u pikiosko -f
```

Con `Restart=always` y `RestartSec=5`, si la aplicación se cierra por cualquier motivo se relanzará automáticamente a los 5 segundos.

### Con autostart de escritorio (LXDE / Raspberry Pi OS Desktop)

Apropiado para instalaciones de escritorio estándar sin systemd configurado para sesiones gráficas:

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/pikiosko.desktop
```

Contenido del archivo:

```ini
[Desktop Entry]
Type=Application
Name=piKioskoCliente
Exec=/home/pi/piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
Hidden=false
X-GNOME-Autostart-enabled=true
```

---

## Videos descargados

Los videos se almacenan localmente en el directorio de datos del usuario de Electron. Esto garantiza que persistan entre actualizaciones de la aplicación y que la app no necesite permisos de escritura en su propio directorio de instalación.

| Sistema       | Ubicación                                    |
|---------------|----------------------------------------------|
| Windows       | `%APPDATA%\piKioskoCliente\videos\`          |
| Linux / Pi    | `~/.config/piKioskoCliente/videos/`          |

Al sincronizar, la aplicación compara la lista remota con los archivos presentes en esa carpeta: elimina los que ya no están en la lista y descarga únicamente los que faltan, evitando descargas innecesarias si el archivo ya existe.

---

## Atajos de teclado

Estos atajos están disponibles en todo momento, excepto cuando el panel de ajustes está abierto (en ese caso solo funciona Escape para cerrarlo).

| Tecla           | Acción                                         |
|-----------------|------------------------------------------------|
| `F5`            | Forzar re-sincronización inmediata             |
| `→`             | Saltar al siguiente video                      |
| `←`             | Volver al video anterior                       |
| `Escape`        | Cerrar el panel de ajustes (si está abierto)   |
| `Ctrl + Escape` | Cerrar la aplicación (solo en modo desarrollo) |

---

## Solución de problemas

| Problema                              | Causa probable / Solución                                                          |
|---------------------------------------|------------------------------------------------------------------------------------|
| `Cannot find module 'electron'`       | Las dependencias no están instaladas. Ejecuta `npm install`.                       |
| Pantalla negra sin video              | El archivo de video puede estar corrupto o en formato no soportado. Usar MP4/H.264.|
| Badge OFFLINE siempre visible         | Verificar que `PLAYLIST_URL` es correcta y accesible desde el dispositivo.         |
| `.conf` no se aplica                  | El archivo no está junto al ejecutable. Ver la sección "Dónde busca el archivo".   |
| AppImage no arranca en la Pi          | Añadir `--no-sandbox` al comando de ejecución.                                     |
| Pantalla parpadea o se ve corrupta    | Añadir `ELECTRON_DISABLE_GPU=1` antes del comando de ejecución.                    |
| Imagen de fondo no aparece            | Usar ruta absoluta en `BACKGROUND_IMAGE` o verificar que el archivo existe.        |
| El panel ⚙ no guarda                  | El proceso no tiene permisos de escritura en el directorio del `.conf`.            |
| Video sin audio                       | Verificar que el archivo MP4 incluye pista de audio en formato AAC.                |
| La Pi muestra la aplicación en ventana| Verificar que no se lanzó con `--dev`. En producción se activa el modo kiosco.     |

---

## Licencia

Este proyecto se distribuye bajo la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para el texto completo.

La licencia MIT es una de las licencias de código abierto más permisivas. Permite el uso, copia, modificación, fusión, publicación, distribución, sublicencia y venta del software, tanto en proyectos de código abierto como cerrado, con la única condición de que el aviso de copyright y el texto de la licencia se incluyan en todas las copias o partes sustanciales del software.
