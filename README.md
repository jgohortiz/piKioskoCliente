# piKioskoCliente

[![License: MIT](https://img.shields.io/badge/License-MIT-C51A4A.svg)](LICENSE)

**piKioskoCliente** es una aplicación de kiosco digital que reproduce videos de forma continua y desatendida en pantalla completa. Está construida sobre [Electron](https://www.electronjs.org/), lo que le permite ejecutarse de forma nativa en Windows y en Raspberry Pi OS de 64 bits sin modificar el código fuente.

La aplicación consulta una URL configurable que devuelve un listado JSON de recursos (videos, imágenes o mixto), los descarga localmente y los reproduce en bucle. La URL incluye automáticamente la fecha del día en curso, el identificador de pantalla y el token de autenticación, todos configurables. Al terminar el último video vuelve a consultar el servidor para actualizar la lista: descarga los recursos nuevos y elimina los obsoletos del disco. Si la conexión falla, la reproducción continúa sin interrupciones con los archivos en caché local y se muestra un indicador **OFFLINE** hasta recuperar la conexión.

---

## Características

- Reproducción a pantalla completa y bucle continuo, sin intervención del usuario.
- Consulta al API con fecha automática del día en cada sincronización.
- Sincronización al final de cada ciclo: descarga nuevos recursos y elimina los obsoletos del disco.
- Indicador **OFFLINE** en la esquina superior derecha cuando el servidor no responde; desaparece automáticamente al recuperar la conexión. Los videos en caché siguen reproduciéndose sin cortes.
- Reintentos silenciosos en segundo plano cada 60 segundos mientras esté offline.
- Al volver de un estado offline, la reproducción siempre reinicia desde el primer video.
- Configuración centralizada en `piKioskoCliente.conf`, editable también desde el panel ⚙ integrado.
- Panel de ajustes con vista previa en tiempo real de la URL generada.
- Barra inferior con el nombre del recurso en reproducción y su posición (`3 / 5`).
- Barra de progreso tenue en el borde inferior de la pantalla.
- Botón de cierre con confirmación para evitar cierres accidentales en modo kiosco.
- Modo kiosco real: bloquea Alt+F4, sin bordes, siempre en primer plano.
- Registro de eventos en archivo de log con rotación automática al superar 2 MB.
- Tipografía multiplataforma: Segoe UI (Windows) / DejaVu Sans (Raspberry Pi OS).
- Paleta de colores basada en el logo de Raspberry Pi (frambuesa #C51A4A, hoja #6AB023).

---

## Estructura del proyecto

```
piKioskoCliente/
├── assets/
│   └── icon.png             ← Ícono de la aplicación (logo Raspberry Pi)
├── src/
│   ├── main.js              ← Proceso principal Electron (ventana, red, IPC, log)
│   ├── config.js            ← Lectura, escritura y construcción de URL del .conf
│   ├── preload.js           ← Puente IPC seguro (contextBridge)
│   └── index.html           ← Toda la UI: reproductor, HUD, badge offline, panel ⚙
├── test-videos/
│   ├── .gitkeep             ← Mantiene la carpeta en el repositorio
│   ├── a.mp4                ← Video de prueba A (no incluido en el repo)
│   └── b.mp4                ← Video de prueba B (no incluido en el repo)
├── piKioskoCliente.conf     ← ★ Archivo de configuración principal
├── test-server.js           ← Servidor HTTP local para desarrollo
├── package.json
├── LICENSE                  ← Licencia MIT
└── README.md
```

El proceso principal (`main.js`) maneja la lógica de red, archivos y sistema. El renderer (`index.html`) gestiona la reproducción y la UI. Se comunican exclusivamente a través del puente seguro definido en `preload.js`, sin que el renderer tenga acceso directo a Node.js.

---

## Archivo de configuración: `piKioskoCliente.conf`

El archivo `piKioskoCliente.conf` es el único punto de configuración de la aplicación. Debe estar en el mismo directorio que el ejecutable. También puede editarse desde el panel ⚙ sin reiniciar.

```ini
# ──────────────────────────────────────────────────────────────────────────────
# piKioskoCliente.conf
# ──────────────────────────────────────────────────────────────────────────────

# URL completa del endpoint del API (sin query params).
# Los parámetros ?type=, &date=, &screen= y &token= se añaden automáticamente.
API_BASE_URL = https://mi-servidor.com/media/resources

# Identificador único de esta pantalla (parámetro screen= en la URL).
SCREEN_ID = pantalla1

# Token de autenticación (parámetro token= en la URL).
TOKEN = mi-token-secreto

# Tipo de contenido a solicitar: video | image | mixed
MEDIA_TYPE = video

# Color de fondo detrás del video y en la pantalla de carga.
BACKGROUND_COLOR = #000000

# Imagen de fondo opcional (ruta absoluta, relativa al .conf, o URL http/https).
# Dejar en blanco para no usar imagen.
BACKGROUND_IMAGE =
```

### URL generada automáticamente

En cada sincronización, `config.js` construye la URL combinando los parámetros del `.conf` con la fecha del día actual en formato `AAAA-MM-DD`:

```
https://mi-servidor.com/media/resources?type=video&date=2026-05-16&screen=pantalla1&token=mi-token-secreto
```

Si el usuario incluye por error query params en `API_BASE_URL`, se eliminan antes de añadir los propios, evitando duplicados.

### Parámetros disponibles

| Parámetro          | Descripción                                              | Ejemplo                                          |
|--------------------|----------------------------------------------------------|--------------------------------------------------|
| `API_BASE_URL`     | URL del endpoint sin query params                        | `https://mi-servidor.com/media/resources`     |
| `SCREEN_ID`        | Identificador de pantalla (`screen=` en la URL)          | `pantalla1`                                         |
| `TOKEN`            | Token de autenticación (`token=` en la URL)              | `abc123`                                         |
| `MEDIA_TYPE`       | Tipo de contenido: `video` \| `image` \| `mixed`         | `video`                                          |
| `BACKGROUND_COLOR` | Color de fondo (CSS)                                     | `#000000`, `rgb(20,20,30)`                        |
| `BACKGROUND_IMAGE` | Imagen de fondo (ruta local o URL remota)                | `/home/pi/fondo.jpg`                             |

### Dónde busca el archivo

`config.js` busca `piKioskoCliente.conf` en este orden:

1. Directorio del ejecutable empaquetado (junto al `.exe` o al `AppImage`)
2. Directorio de trabajo actual (útil con `npm start` en desarrollo)
3. Un nivel por encima de `resources/` (electron-builder)
4. Raíz del paquete Electron

---

## Panel de ajustes (botón ⚙)

El botón ⚙ en la esquina inferior derecha abre un panel modal con dos secciones:

**Conexión al servidor**
- URL base del servidor (`API_BASE_URL`)
- Screen ID y Token (en la misma fila)
- Tipo de contenido: selector entre Video / Imagen / Mixto
- Vista previa en tiempo real de la URL que se generará (se actualiza al escribir)

**Apariencia**
- Color de fondo con selector visual y campo de texto libre
- Imagen de fondo

Al pulsar **Guardar**, el archivo `.conf` se reescribe en disco y la configuración se recarga en memoria. El fondo se aplica al instante; los cambios de URL/screen/token se usan en la siguiente sincronización.

El panel también muestra las rutas del archivo de configuración y del archivo de log activo.

---

## Formato del JSON de playlist

El servidor apuntado por `API_BASE_URL` debe devolver uno de estos formatos. La detección es automática.

### Formato A — Array de objetos (API pikiosko)

Estructura devuelta por el API real. Los campos clave son `name`, `file_name`, `url_path` y `enabled`.

```json
[
  {
    "id": 16,
    "category": "Técnico Laboral",
    "type": "video",
    "name": "2 APT TL 2026",
    "description": "N/A",
    "file_name": "kZIgXiGWq7PDk...mp4",
    "url_path": "https://mi-servidor.com/storage/multimedia/nombre-del-archivo.mp4",
    "start_date": "2026-02-27",
    "end_date": "2026-10-30",
    "enabled": 1
  }
]
```

Los items con `enabled: 0` son filtrados antes de descargar. Si ya estaban descargados, se eliminan del disco en el siguiente ciclo.

### Formato B — Objeto con propiedad `videos` o `data`

```json
{ "videos": [ { "id": 1, "name": "...", "file_name": "...", "url_path": "..." } ] }
```

### Formato C — Array de URLs directas

```json
[ "https://servidor.com/video1.mp4", "https://servidor.com/video2.mp4" ]
```

---

## Servidor de prueba local (`test-server.js`)

Simula el API pikiosko en local para desarrollo. Sirve los videos `a.mp4` y `b.mp4` desde la carpeta `test-videos/` y responde en el mismo endpoint que el API real.

```bash
node test-server.js
```

Coloca tus videos de prueba en `test-videos/`:
```
piKioskoCliente/
├── test-server.js
└── test-videos/
    ├── a.mp4    ← video de prueba A
    └── b.mp4    ← video de prueba B
```

El servidor responde en:
```
http://localhost:3000/media/resources?type=video&date=AAAA-MM-DD&screen=1&token=test
```

Y sirve los archivos de video con soporte de Range requests:
```
http://localhost:3000/test-videos/a.mp4
http://localhost:3000/test-videos/b.mp4
```

Configura `piKioskoCliente.conf` para el servidor local:

```ini
API_BASE_URL = http://localhost:3000/media/resources
SCREEN_ID    = 1
TOKEN        = test
MEDIA_TYPE   = video
```

---

## Indicador OFFLINE

Cuando la solicitud al API falla por cualquier motivo (sin red, servidor caído, token inválido, respuesta no válida), aparece en la esquina superior derecha una píldora roja con el texto **OFFLINE** y un punto pulsante.

La reproducción continúa con los videos en caché. Cada 60 segundos se reintenta la sincronización de forma silenciosa, sin interrumpir el video en curso. Al volver de un estado offline, la reproducción reinicia desde el primer video de la lista actualizada.

---

## Log de eventos

Todos los eventos relevantes se registran en un archivo de texto:

| Sistema       | Ruta                                                        |
|---------------|-------------------------------------------------------------|
| Windows       | `%APPDATA%\piKioskoCliente\piKioskoCliente.log`             |
| Linux / Pi    | `~/.config/piKioskoCliente/piKioskoCliente.log`             |

Rotación automática: al superar 2 MB el log activo se renombra a `.bak.log` y se crea uno nuevo.

Eventos registrados: arranque de la app (versión, plataforma, config), cada sincronización con la URL consultada, cada video que inicia reproducción, descargas y eliminaciones del caché, errores de red, errores del reproductor y apertura del panel de ajustes.

La ruta del log también se muestra en el panel de ajustes ⚙.

---

## Información en pantalla

| Posición               | Contenido                                                |
|------------------------|----------------------------------------------------------|
| Esquina superior der.  | Badge **OFFLINE** (visible solo cuando hay error de red) |
| Esquina inferior izq.  | Nombre del video + posición en la lista (`3 / 5`)        |
| Esquina inferior der.  | Botón ✕ (cerrar con confirmación) + botón ⚙ (ajustes)   |
| Borde inferior         | Barra de progreso del video actual (tenue, un color)     |

---

## Instalar el sistema operativo Raspberry Pi OS de 64 bits

Antes de instalar piKioskoCliente en una Raspberry Pi es necesario preparar el sistema operativo. Raspberry Pi OS es la distribución oficial basada en Debian. La versión de 64 bits es la recomendada para Raspberry Pi 3, 4 y 5.

### Qué necesitas

- Una Raspberry Pi 3, 4 o 5
- Una tarjeta microSD de al menos 16 GB (clase 10 o superior)
- Un lector de tarjetas microSD
- Un ordenador con Windows, macOS o Linux

### Paso 1 — Descargar Raspberry Pi Imager

Descarga la herramienta oficial desde [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/) e instálala.

### Paso 2 — Seleccionar dispositivo y sistema operativo

1. Abre Raspberry Pi Imager.
2. Pulsa **Choose Device** → selecciona tu modelo de Pi.
3. Pulsa **Choose OS** → `Raspberry Pi OS (other)` → `Raspberry Pi OS (64-bit)`.
4. Pulsa **Choose Storage** → selecciona tu microSD.

### Paso 3 — Configuración avanzada (recomendado)

Pulsa el icono ⚙ antes de grabar para preconfigurar: nombre del equipo, usuario/contraseña, red Wi-Fi y SSH habilitado.

### Paso 4 — Grabar y arrancar

Pulsa **Write**, espera a que termine y luego inserta la microSD en la Raspberry Pi. Al arrancar ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
```

---

> 💡 **Tip**
>
> En el siguiente enlace puedes ver cómo instalar el sistema operativo en detalle → [Install an operating system](https://www.raspberrypi.com/documentation/computers/getting-started.html#installing-the-operating-system)

---

## Configurar el entorno de desarrollo en Windows con VSCode

### Componentes necesarios

| Herramienta | Versión mínima | Para qué se usa |
|-------------|----------------|-----------------|
| Git         | 2.40 o superior | Clonar y gestionar el repositorio |
| Node.js     | 18.x LTS        | Ejecutar Electron y npm |
| VSCode      | Última estable  | Editor con soporte de depuración |

### Paso 1 — Instalar Git

Descarga desde [https://git-scm.com/download/win](https://git-scm.com/download/win). Durante la instalación selecciona *Git from the command line and also from 3rd-party software* y *Checkout Windows-style, commit Unix-style line endings*.

```powershell
git --version
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### Paso 2 — Instalar Node.js

Descarga el instalador LTS desde [https://nodejs.org](https://nodejs.org). Asegúrate de que la opción *Add to PATH* esté marcada.

```powershell
node --version   # debe mostrar v18.x.x o superior
npm --version
```

### Paso 3 — Instalar VSCode

Descarga el *System Installer* de 64 bits desde [https://code.visualstudio.com](https://code.visualstudio.com). Marca *Add to PATH* durante la instalación.

### Paso 4 — Extensiones recomendadas de VSCode

Instala desde el panel de extensiones (`Ctrl + Shift + X`):

- `dbaeumer.vscode-eslint` — ESLint (errores de JavaScript en tiempo real)
- `esbenp.prettier-vscode` — Prettier (formato automático al guardar)
- `eamodio.gitlens` — GitLens (historial de Git en el editor)
- `usernamehw.errorlens` — Error Lens (errores inline)
- `mikestead.dotenv` — resaltado de `.env` y `.conf`

### Paso 5 — Clonar el repositorio

```powershell
cd C:\Proyectos
git clone https://github.com/tu-usuario/piKioskoCliente.git
cd piKioskoCliente
code .
```

### Paso 6 — Instalar dependencias

```powershell
npm install
```

### Paso 7 — Ejecutar en desarrollo

```powershell
# Terminal 1: servidor de prueba local
node test-server.js

# Terminal 2: lanzar la aplicación
npm start

# Con DevTools abiertos (o F5 en VSCode)
npm run dev
```

---

## Instalación y uso en Windows

```bash
npm install
npm run build:win
# → dist/piKioskoCliente Setup 1.0.0.exe
```

Tras instalar, coloca `piKioskoCliente.conf` en el mismo directorio que el ejecutable y configura `API_BASE_URL`, `SCREEN_ID` y `TOKEN`.

---

## Compilar

### Preparación

```bash
npm install   # solo la primera vez
```

### Windows — Instalador `.exe`

```bash
npm run build:win
# → dist/piKioskoCliente Setup 1.0.0.exe
```

El instalador NSIS permite elegir el directorio de instalación y crea acceso directo en el escritorio. Tras instalar, coloca `piKioskoCliente.conf` junto al ejecutable.

### Raspberry Pi OS 64-bit — AppImage

**Compilar en la Raspberry Pi (recomendado):**

```bash
# Instalar Node.js 20 si la versión de apt es inferior a 18
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

cd piKioskoCliente
npm install
npm run build:linux
chmod +x dist/piKioskoCliente-*.AppImage
```

**Cross-compile desde Windows:**

```bash
npm run build:rpi
# Copiar el .AppImage a la Pi por SCP
scp dist/piKioskoCliente-*.AppImage pi@192.168.1.X:/home/pi/
```

---

## Ejecutar en Raspberry Pi

```
/home/pi/
├── piKioskoCliente-1.0.0-arm64.AppImage
└── piKioskoCliente.conf
```

```bash
./piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
```

Si hay problemas gráficos:

```bash
ELECTRON_DISABLE_GPU=1 ./piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
```

---

## Autostart en Raspberry Pi

### Con systemd

```bash
sudo nano /etc/systemd/system/pikiosko.service
```

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

```bash
sudo systemctl daemon-reload
sudo systemctl enable pikiosko
sudo systemctl start pikiosko
journalctl -u pikiosko -f   # ver logs en tiempo real
```

### Con autostart de escritorio (LXDE)

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/pikiosko.desktop
```

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

| Sistema       | Ubicación                                    |
|---------------|----------------------------------------------|
| Windows       | `%APPDATA%\piKioskoCliente\videos\`          |
| Linux / Pi    | `~/.config/piKioskoCliente/videos/`          |

---

## Atajos de teclado

| Tecla           | Acción                                            |
|-----------------|---------------------------------------------------|
| `F5`            | Forzar re-sincronización inmediata                |
| `→`             | Saltar al siguiente video                         |
| `←`             | Volver al video anterior                          |
| `Escape`        | Cerrar el panel de ajustes o confirmación abiertos|
| `Ctrl + Escape` | Cerrar la aplicación (solo en modo desarrollo)    |

---

## Solución de problemas

| Problema                              | Solución                                                                          |
|---------------------------------------|-----------------------------------------------------------------------------------|
| `Cannot find module 'electron'`       | Ejecuta `npm install`                                                             |
| Pantalla negra sin video              | Formato no soportado. Usa MP4/H.264                                               |
| Badge OFFLINE permanente              | Verifica `API_BASE_URL`, `SCREEN_ID` y `TOKEN` en el `.conf`                     |
| `.conf` no se aplica                  | El archivo no está junto al ejecutable. Ver "Dónde busca el archivo"              |
| AppImage no arranca en la Pi          | Añade `--no-sandbox` al comando de ejecución                                      |
| Pantalla parpadea en la Pi            | Añade `ELECTRON_DISABLE_GPU=1` antes del comando                                  |
| Imagen de fondo no aparece            | Usa ruta absoluta en `BACKGROUND_IMAGE`                                           |
| El panel ⚙ no guarda                  | Verifica permisos de escritura en el directorio del `.conf`                       |
| Video sin audio                       | El MP4 debe incluir pista de audio AAC                                            |
| La app se queda en el último video    | Corregido: al volver de offline siempre reinicia desde el primer video             |

---

## Licencia

Este proyecto se distribuye bajo la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para el texto completo.

La licencia MIT permite el uso, copia, modificación, distribución y venta del software —tanto en proyectos de código abierto como cerrado— con la única condición de mantener el aviso de copyright en todas las copias.
