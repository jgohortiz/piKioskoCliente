# piKioskoCliente

[![License: MIT](https://img.shields.io/badge/License-MIT-C51A4A.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-jgohortiz%2FpiKioskoCliente-C51A4A.svg)](https://github.com/jgohortiz/piKioskoCliente)

**piKioskoCliente** es una aplicación de kiosco digital que reproduce videos de forma continua y desatendida en pantalla completa. Está construida sobre [Electron](https://www.electronjs.org/), lo que le permite ejecutarse de forma nativa en Windows y en Raspberry Pi OS de 64 bits sin modificar el código fuente.

La aplicación consulta un endpoint configurable que devuelve un listado JSON de recursos, los descarga localmente y los reproduce en bucle. La URL incluye automáticamente la fecha del día en curso, el identificador de pantalla y el token de autenticación. Al terminar el último video vuelve a consultar el servidor para actualizar la lista: descarga los recursos nuevos y elimina los obsoletos del disco. Si la conexión falla, la reproducción continúa sin interrupciones con los archivos en caché local y se muestra un indicador **OFFLINE** hasta recuperar la conexión.

---

## Características

- Espera configurable al arrancar (`STARTUP_DELAY`) para dar tiempo al dispositivo de conectarse a la red, con cuenta regresiva visible.
- Reproducción a pantalla completa y bucle continuo, sin intervención del usuario.
- Consulta al API con fecha automática del día en cada sincronización.
- Sincronización al final de cada ciclo: descarga nuevos recursos y elimina los obsoletos del disco.
- Items con `enabled: 0` en el JSON son ignorados y eliminados del caché local.
- Indicador **OFFLINE** en la esquina superior derecha cuando el servidor no responde; desaparece al recuperar la conexión. Los videos en caché siguen reproduciéndose sin cortes.
- Reintentos silenciosos en segundo plano cada 60 segundos mientras esté offline.
- Al volver de un estado offline, la reproducción reinicia desde el primer video.
- Panel de ajustes organizado en pestañas: Conexion, Apariencia, Visualizacion, Sistema.
- Botones de cierre y ajustes en la esquina superior derecha, siempre visibles incluso sobre la pantalla de carga.
- Vista previa en tiempo real de la URL generada al editar los parámetros de conexión.
- Nombre y descripción del video en la esquina superior izquierda durante 5 segundos al cambiar de video.
- Barra inferior con el nombre del recurso en reproducción y su posición (`3 / 5`).
- Barra de progreso tenue en el borde inferior de la pantalla.
- Botón de cierre con confirmación para evitar cierres accidentales en modo kiosco.
- Modo kiosco real: bloquea Alt+F4, sin bordes, siempre en primer plano.
- Registro de eventos en archivo de log con rotación automática al superar 2 MB.
- Ruta del `.conf` resuelta correctamente en AppImage (usa `$APPIMAGE`, no la ruta dentro del squashfs de solo lectura).
- Tipografía multiplataforma: Segoe UI (Windows) / DejaVu Sans (Raspberry Pi OS).
- Paleta de colores basada en el logo de Raspberry Pi (frambuesa #C51A4A, hoja #6AB023).

---

## Estructura del proyecto

```
piKioskoCliente/
├── assets/
│   └── icon.png             <- Icono de la aplicacion (logo Raspberry Pi)
├── src/
│   ├── main.js              <- Proceso principal Electron (ventana, red, IPC, log)
│   ├── config.js            <- Lectura, escritura y construccion de URL del .conf
│   ├── preload.js           <- Puente IPC seguro (contextBridge)
│   └── index.html           <- Toda la UI: reproductor, HUD, badge offline, panel de ajustes
├── test-videos/
│   ├── .gitkeep             <- Mantiene la carpeta en el repositorio
│   ├── a.mp4                <- Video de prueba A (no incluido en el repo)
│   └── b.mp4                <- Video de prueba B (no incluido en el repo)
├── piKioskoCliente.conf     <- Archivo de configuracion principal
├── test-server.js           <- Servidor HTTP local para desarrollo
├── package.json
├── LICENSE                  <- Licencia MIT
└── README.md
```

El proceso principal (`main.js`) maneja la lógica de red, archivos y sistema. El renderer (`index.html`) gestiona la reproducción y la UI. Se comunican exclusivamente a través del puente seguro definido en `preload.js`, sin que el renderer tenga acceso directo a Node.js.

---

## Archivo de configuración: `piKioskoCliente.conf`

El archivo `piKioskoCliente.conf` es el único punto de configuración de la aplicación. Debe estar en el mismo directorio que el ejecutable. También puede editarse desde el panel de ajustes sin reiniciar.

```ini
# piKioskoCliente.conf

# URL completa del endpoint del API (sin query params).
# Los parametros ?type=, &date=, &screen= y &token= se anaden automaticamente.
API_BASE_URL = https://mi-servidor.com/media/resources

# Identificador unico de esta pantalla (parametro screen= en la URL).
SCREEN_ID = pantalla1

# Token de autenticacion (parametro token= en la URL).
TOKEN = mi-token-secreto

# Tipo de contenido a solicitar: video | image | mixed
MEDIA_TYPE = video

# Color de fondo detras del video y en la pantalla de carga.
BACKGROUND_COLOR = #000000

# Imagen de fondo opcional (ruta absoluta, relativa al .conf, o URL http/https).
# Dejar en blanco para no usar imagen.
BACKGROUND_IMAGE =

# Muestra el nombre del video en la esquina superior izquierda durante 5 segundos.
SHOW_NAME = true

# Muestra la descripcion del video junto al nombre (requiere SHOW_NAME = true).
SHOW_DESCRIPTION = true

# Muestra la barra de progreso en el borde inferior de la pantalla.
SHOW_PROGRESS = true

# Segundos de espera al arrancar antes de intentar la primera sincronizacion.
# Permite que el dispositivo se conecte a la red. Minimo: 0. Por defecto: 5.
STARTUP_DELAY = 5
```

### URL generada automaticamente

En cada sincronizacion, `config.js` construye la URL con la fecha del dia actual:

```
https://mi-servidor.com/media/resources?type=video&date=2026-05-18&screen=pantalla1&token=mi-token-secreto
```

Si `API_BASE_URL` incluye query params por error, se eliminan antes de añadir los propios.

### Parametros disponibles

| Parametro          | Descripcion                                             | Ejemplo                                      |
|--------------------|---------------------------------------------------------|----------------------------------------------|
| `API_BASE_URL`     | URL del endpoint incluyendo el path, sin query params   | `https://mi-servidor.com/media/resources`    |
| `SCREEN_ID`        | Identificador de pantalla (`screen=` en la URL)         | `pantalla1`                                  |
| `TOKEN`            | Token de autenticacion (`token=` en la URL)             | `abc123`                                     |
| `MEDIA_TYPE`       | Tipo de contenido: `video`, `image` o `mixed`           | `video`                                      |
| `BACKGROUND_COLOR` | Color de fondo (CSS)                                    | `#000000`, `rgb(20,20,30)`                   |
| `BACKGROUND_IMAGE` | Imagen de fondo (ruta local o URL remota)               | `/home/pi/fondo.jpg`                         |
| `SHOW_NAME`        | Mostrar nombre del video al cambiar: `true` o `false`   | `true`                                       |
| `SHOW_DESCRIPTION` | Mostrar descripcion junto al nombre: `true` o `false`   | `true`                                       |
| `SHOW_PROGRESS`    | Mostrar barra de progreso: `true` o `false`             | `true`                                       |
| `STARTUP_DELAY`    | Segundos de espera al arrancar antes de sincronizar     | `5`                                          |

### Donde busca el archivo

`config.js` busca `piKioskoCliente.conf` en este orden:

1. **Junto al ejecutable real en disco**
   - Windows: directorio donde esta el `.exe`
   - Linux AppImage: directorio donde esta el `.AppImage`, resuelto mediante `process.env.APPIMAGE` y no mediante `process.execPath`, que apunta al squashfs montado en `/tmp` (de solo lectura)
2. **Directorio de trabajo actual** — cubre el desarrollo con `npm start`

Las rutas dentro del paquete Electron o del AppImage no se usan porque son de solo lectura.

---

## Panel de ajustes

Los botones de ajustes y cierre estan en la **esquina superior derecha**, siempre visibles por encima de cualquier otra capa de la interfaz, incluyendo la pantalla de carga y el indicador OFFLINE.

El panel esta organizado en cuatro pestañas:

**Conexion**
- URL del endpoint del API (`API_BASE_URL`)
- Screen ID y Token (en la misma fila)
- Tipo de contenido: selector entre Video, Imagen o Mixto
- Vista previa en tiempo real de la URL completa que se generara (se actualiza al escribir)

**Apariencia**
- Color de fondo con selector visual y campo de texto libre
- Imagen de fondo (ruta local o URL remota)

**Visualizacion**
- Mostrar nombre del video al cambiar (esquina superior izquierda, 5 segundos)
- Mostrar descripcion del video junto al nombre
- Mostrar barra de progreso en el borde inferior
- Espera al iniciar en segundos (`STARTUP_DELAY`)

**Sistema**
- Ruta del archivo `piKioskoCliente.conf` activo
- Ruta del archivo de log activo

Al pulsar **Guardar**, el `.conf` se reescribe en disco, la configuracion se recarga en memoria y los cambios visuales se aplican al instante.

---

## Arranque y espera de red

Al iniciar, la aplicacion espera `STARTUP_DELAY` segundos antes de intentar la primera sincronizacion. Durante ese tiempo muestra una cuenta regresiva en la pantalla de carga:

```
Iniciando en 5 segundos...
Iniciando en 4 segundos...
...
Conectando...
```

Esto permite que dispositivos como la Raspberry Pi, que pueden tardar varios segundos en conectarse a la red Wi-Fi tras arrancar, establezcan la conexion antes de que la app intente consultar el servidor.

Con `STARTUP_DELAY = 0` la sincronizacion comienza de inmediato.

---

## Indicador OFFLINE

Cuando la solicitud al API falla (sin red, servidor caido, token invalido, respuesta no valida), aparece en la esquina superior derecha una pildora roja con el texto **OFFLINE** y un punto pulsante. El badge queda desplazado a la izquierda de los botones de ajustes y cierre.

La reproduccion continua con los videos en cache. Cada 60 segundos se reintenta la sincronizacion de forma silenciosa, sin interrumpir el video en curso. Al recuperar la conexion, el badge desaparece y la lista se actualiza. Si el reproductor se habia detenido, reinicia desde el primer video.

---

## Informacion en pantalla

| Posicion               | Contenido                                                          |
|------------------------|--------------------------------------------------------------------|
| Esquina superior izq.  | Nombre y descripcion del video, durante 5 segundos al cambiar     |
| Esquina superior der.  | Badge **OFFLINE** + botones de ajustes y cierre (siempre visibles) |
| Esquina inferior izq.  | Nombre del video + posicion en la lista (`3 / 5`)                  |
| Borde inferior         | Barra de progreso del video actual (tenue, un solo color)          |

---

## Formato del JSON de playlist

El servidor apuntado por `API_BASE_URL` debe devolver uno de estos formatos. La deteccion es automatica.

### Formato A — Array de objetos (API pikiosko)

```json
[
  {
    "id": 16,
    "category": "Tecnico Laboral",
    "type": "video",
    "name": "Nombre del video",
    "description": "Descripcion opcional",
    "file_name": "nombre-del-archivo.mp4",
    "url_path": "https://mi-servidor.com/storage/multimedia/nombre-del-archivo.mp4",
    "start_date": "2026-02-27",
    "end_date": "2026-10-30",
    "enabled": 1
  }
]
```

Los items con `enabled: 0` son filtrados. Si ya estaban descargados, se eliminan del disco en la siguiente sincronizacion.

### Formato B — Objeto con propiedad `videos` o `data`

```json
{ "videos": [ { "id": 1, "name": "...", "file_name": "...", "url_path": "..." } ] }
```

### Formato C — Array de URLs directas

```json
[ "https://servidor.com/video1.mp4", "https://servidor.com/video2.mp4" ]
```

---

## Log de eventos

Todos los eventos relevantes se registran en un archivo de texto:

| Sistema    | Ruta                                               |
|------------|----------------------------------------------------|
| Windows    | `%APPDATA%\piKioskoCliente\piKioskoCliente.log`    |
| Linux / Pi | `~/.config/piKioskoCliente/piKioskoCliente.log`    |

Rotacion automatica: al superar 2 MB el log activo se renombra a `.bak.log` y se crea uno nuevo.

Eventos registrados: arranque de la app (version, plataforma, configuracion, delay), cuenta regresiva de inicio, cada sincronizacion con la URL consultada, cada video que inicia reproduccion, descargas y eliminaciones del cache, errores de red y del reproductor, apertura del panel de ajustes.

La ruta del log se muestra en la pestana **Sistema** del panel de ajustes.

---

## Servidor de prueba local (`test-server.js`)

Simula el API en local para desarrollo. Sirve los videos `a.mp4` y `b.mp4` desde `test-videos/` con soporte de Range requests, y responde en el mismo endpoint que el API real.

```bash
node test-server.js
```

Coloca los videos de prueba en `test-videos/`:

```
piKioskoCliente/
├── test-server.js
└── test-videos/
    ├── a.mp4
    └── b.mp4
```

El servidor responde en:
```
http://localhost:3000/media/resources?type=video&date=AAAA-MM-DD&screen=1&token=test
```

Configura `piKioskoCliente.conf` para el servidor local:

```ini
API_BASE_URL  = http://localhost:3000/media/resources
SCREEN_ID     = 1
TOKEN         = test
MEDIA_TYPE    = video
STARTUP_DELAY = 0
```

Con `STARTUP_DELAY = 0` se evita esperar durante el desarrollo.

---

## Instalar el sistema operativo Raspberry Pi OS de 64 bits

Antes de instalar piKioskoCliente en una Raspberry Pi es necesario preparar el sistema operativo. Raspberry Pi OS es la distribucion oficial basada en Debian. La version de 64 bits es la recomendada para Raspberry Pi 3, 4 y 5.

### Que necesitas

- Una Raspberry Pi 3, 4 o 5
- Una tarjeta microSD de al menos 16 GB (clase 10 o superior)
- Un lector de tarjetas microSD
- Un ordenador con Windows, macOS o Linux

### Paso 1 — Descargar Raspberry Pi Imager

Descarga la herramienta oficial desde [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/) e instalala.

### Paso 2 — Seleccionar dispositivo y sistema operativo

1. Abre Raspberry Pi Imager.
2. Pulsa **Choose Device** y selecciona tu modelo de Pi.
3. Pulsa **Choose OS**, luego `Raspberry Pi OS (other)` y `Raspberry Pi OS (64-bit)`.
4. Pulsa **Choose Storage** y selecciona tu microSD.

### Paso 3 — Configuracion avanzada (recomendado)

Pulsa el icono de engranaje antes de grabar para preconfigurar: nombre del equipo, usuario y contrasena, red Wi-Fi y SSH habilitado.

### Paso 4 — Grabar y arrancar

Pulsa **Write**, espera a que termine y luego inserta la microSD en la Raspberry Pi. Al arrancar ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
```

---

> **Tip**
>
> En el siguiente enlace puedes ver como instalar el sistema operativo en detalle: [Install an operating system](https://www.raspberrypi.com/documentation/computers/getting-started.html#installing-the-operating-system)

---

## Configurar el entorno de desarrollo en Windows con VSCode

### Componentes necesarios

| Herramienta | Version minima | Para que se usa |
|-------------|----------------|-----------------|
| Git         | 2.40 o superior | Clonar y gestionar el repositorio |
| Node.js     | 18.x LTS        | Ejecutar Electron y npm |
| VSCode      | Ultima estable  | Editor con soporte de depuracion |

### Paso 1 — Instalar Git

Descarga desde [https://git-scm.com/download/win](https://git-scm.com/download/win). Durante la instalacion selecciona *Git from the command line and also from 3rd-party software* y *Checkout Windows-style, commit Unix-style line endings*.

```powershell
git --version
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### Paso 2 — Instalar Node.js

Descarga el instalador LTS desde [https://nodejs.org](https://nodejs.org). Asegurate de que la opcion *Add to PATH* este marcada.

```powershell
node --version   # debe mostrar v18.x.x o superior
npm --version
```

### Paso 3 — Instalar VSCode

Descarga el *System Installer* de 64 bits desde [https://code.visualstudio.com](https://code.visualstudio.com). Marca *Add to PATH* durante la instalacion.

### Paso 4 — Extensiones recomendadas de VSCode

Instala desde el panel de extensiones (`Ctrl + Shift + X`):

- `dbaeumer.vscode-eslint` — ESLint (errores de JavaScript en tiempo real)
- `esbenp.prettier-vscode` — Prettier (formato automatico al guardar)
- `eamodio.gitlens` — GitLens (historial de Git en el editor)
- `usernamehw.errorlens` — Error Lens (errores inline)
- `mikestead.dotenv` — resaltado de `.env` y `.conf`

### Paso 5 — Clonar el repositorio

```powershell
cd C:\Proyectos
git clone https://github.com/jgohortiz/piKioskoCliente.git
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

# Terminal 2: lanzar la aplicacion
npm start

# Con DevTools abiertos (o F5 en VSCode)
npm run dev
```

---

## Compilar para produccion

### Windows — Instalador `.exe`

```bash
npm install
npm run build:win
# → dist/piKioskoCliente Setup 1.0.0.exe
```

El instalador NSIS permite elegir el directorio de instalacion y crea acceso directo en el escritorio. Tras instalar, coloca `piKioskoCliente.conf` junto al ejecutable y configura `API_BASE_URL`, `SCREEN_ID` y `TOKEN`.

### Raspberry Pi OS 64-bit — AppImage

El AppImage **debe compilarse directamente en la Raspberry Pi**. No es posible generarlo desde Windows porque `electron-builder` requiere la herramienta `mksquashfs`, que solo existe en Linux.

```bash
# 1. Instalar Node.js 20 si la version de apt es anterior a la 18
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar version (debe ser >= 18)
node --version

# 2. Clonar el repositorio en la Pi
git clone https://github.com/jgohortiz/piKioskoCliente.git
cd piKioskoCliente

# O copiar los archivos desde Windows por SCP:
#   scp -r ./piKioskoCliente pi@192.168.1.X:/home/pi/

# 3. Instalar dependencias
npm install

# 4. Compilar
npm run build:linux
# → dist/piKioskoCliente-1.0.0-arm64.AppImage

# 5. Dar permisos de ejecucion y copiar a la ubicacion definitiva
chmod +x dist/piKioskoCliente-*.AppImage
cp dist/piKioskoCliente-*.AppImage ~/
cp piKioskoCliente.conf ~/
```

---

## Ejecutar en Raspberry Pi

El archivo `.conf` debe estar en el mismo directorio que el `.AppImage` en el disco. No dentro del AppImage ni en `/tmp`.

```
/home/pi/
├── piKioskoCliente-1.0.0-arm64.AppImage
└── piKioskoCliente.conf
```

```bash
./piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox
```

Si hay problemas graficos:

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
Description=piKioskoCliente - Reproductor de kiosco
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

| Sistema    | Ubicacion                                  |
|------------|--------------------------------------------|
| Windows    | `%APPDATA%\piKioskoCliente\videos\`        |
| Linux / Pi | `~/.config/piKioskoCliente/videos/`        |

---

## Atajos de teclado

| Tecla           | Accion                                                |
|-----------------|-------------------------------------------------------|
| `F5`            | Forzar re-sincronizacion inmediata                    |
| Flecha derecha  | Saltar al siguiente video                             |
| Flecha izquierda| Volver al video anterior                              |
| `Escape`        | Cerrar el panel de ajustes o la confirmacion de cierre|
| `Ctrl + Escape` | Cerrar la aplicacion (solo en modo desarrollo)        |

---

## Solucion de problemas

| Problema                                | Solucion                                                                              |
|-----------------------------------------|---------------------------------------------------------------------------------------|
| `Cannot find module 'electron'`         | Ejecuta `npm install`                                                                 |
| Pantalla negra sin video                | Formato no soportado. Usa MP4/H.264                                                   |
| Badge OFFLINE permanente                | Verifica `API_BASE_URL`, `SCREEN_ID` y `TOKEN` en el `.conf`                         |
| La app no sincroniza al arrancar        | Aumenta `STARTUP_DELAY` para dar mas tiempo a la conexion de red                     |
| `.conf` no se aplica                    | Debe estar junto al ejecutable real en disco, no dentro del AppImage                  |
| Error `EROFS: read-only file system`    | El `.conf` esta dentro del AppImage. Colocarlo junto al `.AppImage` en disco          |
| Error `mksquashfs` al compilar          | No se puede compilar el AppImage desde Windows. Compilar en la Raspberry Pi           |
| AppImage no arranca en la Pi            | Añade `--no-sandbox` al comando de ejecucion                                          |
| Pantalla parpadea en la Pi              | Añade `ELECTRON_DISABLE_GPU=1` antes del comando                                      |
| Imagen de fondo no aparece              | Usa ruta absoluta en `BACKGROUND_IMAGE`                                               |
| El panel de ajustes no guarda           | Verifica permisos de escritura en el directorio del `.conf`                           |
| Video sin audio                         | El MP4 debe incluir pista de audio AAC                                                |

---

## Licencia

Este proyecto se distribuye bajo la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para el texto completo.

La licencia MIT permite el uso, copia, modificacion, distribucion y venta del software, tanto en proyectos de codigo abierto como cerrado, con la unica condicion de mantener el aviso de copyright en todas las copias.
