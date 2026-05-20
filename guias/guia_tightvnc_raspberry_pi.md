# Instalación completa de TightVNC Server en Raspberry Pi OS

Esta guía cubre la instalación y configuración de TightVNC Server en Raspberry Pi OS para acceso remoto mediante escritorio gráfico. El proceso incluye la configuración del entorno gráfico LXDE, la inicialización del servidor VNC, y la creación de un servicio systemd que garantiza el inicio automático del servidor cada vez que la Raspberry Pi arranca. Esta guía es compatible con Raspberry Pi 4 y Raspberry Pi 5.

TightVNC es una solución de acceso remoto ligera y estable que permite controlar el escritorio de la Raspberry Pi desde cualquier computador en la misma red local, usando clientes disponibles para Windows, Linux y macOS. A diferencia de las soluciones propietarias, TightVNC es software libre y no requiere cuenta en servicios externos para funcionar.

---

## 1. Actualizar Raspberry Pi OS

Antes de instalar cualquier paquete, es importante tener el sistema operativo completamente actualizado. Esto garantiza que las dependencias que se instalarán posteriormente sean compatibles con la versión más reciente de los repositorios oficiales y que no existan conflictos por paquetes desactualizados.

```bash
sudo apt update
sudo apt upgrade -y
```

El proceso puede tardar varios minutos dependiendo de la cantidad de actualizaciones pendientes y la velocidad de la conexión a internet.

---

## 2. Instalar el entorno gráfico LXDE (si no existe)

TightVNC necesita un gestor de escritorio para mostrar una interfaz gráfica al conectarse de forma remota. Si la instalación de Raspberry Pi OS es la versión Lite (sin escritorio), será necesario instalar el entorno gráfico LXDE. Si ya se dispone de escritorio instalado, este paso puede omitirse.

LXDE es un entorno de escritorio de bajo consumo de recursos, ideal para la Raspberry Pi, ya que no sobrecarga el procesador ni la memoria RAM.

```bash
sudo apt install lxde-core lxterminal -y
```

---

## 3. Instalar TightVNC Server

TightVNC Server es el componente principal que permite la conexión remota. Se instala desde los repositorios oficiales de Raspberry Pi OS.

```bash
sudo apt install tightvncserver -y
```

Una vez instalado, se puede verificar que la instalación fue exitosa comprobando la versión del programa:

```bash
tightvncserver -version
```

Si el comando devuelve un número de versión, la instalación se completó correctamente.

---

## 4. Verificar el usuario activo

TightVNC debe inicializarse y configurarse desde el usuario normal del sistema, no desde el usuario root. Ejecutar VNC como root puede generar problemas de permisos y vulnerabilidades de seguridad. Si se está trabajando como root, es necesario salir primero.

Si el prompt del terminal muestra esto:

```
root@pi
```

Salir del usuario root con:

```bash
exit
```

El prompt debe quedar como el usuario normal del sistema, por ejemplo:

```
pi@pi
```

Todos los pasos siguientes deben ejecutarse desde este usuario.

---

## 5. Inicializar TightVNC por primera vez

El primer inicio de TightVNC es necesario para que el servidor genere su estructura de archivos de configuración y solicite la creación de la contraseña de acceso. Esta contraseña será la que se use al conectarse de forma remota desde otro dispositivo.

```bash
tightvncserver :1
```

El número `:1` indica que se usará el display 1, que corresponde al puerto 5901 de red. El sistema solicitará:

```
Password:
Verify:
```

Ingresar y confirmar la contraseña deseada. Al finalizar aparecerá un mensaje similar a:

```
New 'X' desktop is pi:1
```

Esto confirma que el servidor inició correctamente en el display 1.

---

## 6. Detener la sesión VNC temporal

Esta primera sesión fue creada únicamente para generar los archivos de configuración. Debe detenerse antes de continuar con la configuración del escritorio gráfico, ya que de lo contrario los cambios no tendrán efecto en la sesión actual.

```bash
tightvncserver -kill :1
```

---

## 7. Configurar el escritorio gráfico

Por defecto, TightVNC no sabe qué entorno gráfico debe iniciar cuando alguien se conecta. El archivo `~/.vnc/xstartup` controla este comportamiento. Es necesario editarlo para indicarle que use LXDE como escritorio.

Abrir el archivo con el editor de texto nano:

```bash
nano ~/.vnc/xstartup
```

Borrar todo el contenido existente y reemplazarlo con lo siguiente:

```bash
#!/bin/bash
xrdb $HOME/.Xresources
startlxde &
```

La primera línea define que el archivo es un script de bash. La segunda carga las preferencias de pantalla del usuario. La tercera inicia el escritorio LXDE en segundo plano.

Guardar los cambios y cerrar el editor:

```
CTRL + O
ENTER
CTRL + X
```

Finalmente, dar permisos de ejecución al archivo para que pueda ser ejecutado por TightVNC:

```bash
chmod +x ~/.vnc/xstartup
```

---

## 8. Crear el servicio de inicio automático con systemd

Para que TightVNC se inicie automáticamente cada vez que la Raspberry Pi enciende, es necesario crear un servicio de systemd. Systemd es el gestor de servicios de Raspberry Pi OS y permite controlar aplicaciones que deben ejecutarse en segundo plano de forma persistente y controlada.

Crear el archivo del servicio:

```bash
sudo nano /etc/systemd/system/tightvnc.service
```

Pegar el siguiente contenido:

```ini
[Unit]
Description=TightVNC Server
After=syslog.target network.target

[Service]
Type=forking
User=pi
Group=pi
WorkingDirectory=/home/pi

PIDFile=/home/pi/.vnc/%H:1.pid

ExecStartPre=-/usr/bin/tightvncserver -kill :1 > /dev/null 2>&1
ExecStart=/usr/bin/tightvncserver :1
ExecStop=/usr/bin/tightvncserver -kill :1

[Install]
WantedBy=multi-user.target
```

> **Importante:** si el nombre de usuario no es `pi`, reemplazar todas las ocurrencias por el nombre de usuario correcto del sistema. Esto incluye los campos `User`, `Group`, `WorkingDirectory` y `PIDFile`.

La directiva `ExecStartPre` se encarga de limpiar cualquier sesión VNC residual antes de iniciar una nueva, lo que previene errores al reiniciar el servicio. La directiva `After=network.target` garantiza que el servicio espere a que la red esté disponible antes de iniciarse.

Guardar y cerrar el archivo con `CTRL + O`, `ENTER`, `CTRL + X`.

---

## 9. Recargar la configuración de systemd

Cada vez que se crea o modifica un archivo de servicio en systemd, es necesario recargar el demonio para que reconozca los cambios. Sin este paso, el servicio recién creado no estará disponible para el sistema.

```bash
sudo systemctl daemon-reload
```

---

## 10. Habilitar el inicio automático

Habilitar el servicio le indica a systemd que debe iniciarlo automáticamente en cada arranque del sistema. Sin este paso, el servicio solo puede iniciarse de forma manual cada vez que se reinicie la Raspberry Pi.

```bash
sudo systemctl enable tightvnc.service
```

---

## 11. Iniciar TightVNC

Con el servicio habilitado, se puede iniciar inmediatamente sin necesidad de reiniciar la Raspberry Pi:

```bash
sudo systemctl start tightvnc.service
```

---

## 12. Verificar que el servicio esté activo

Para confirmar que TightVNC está funcionando correctamente, consultar el estado del servicio. La salida de este comando proporciona información sobre el estado actual, el PID del proceso y las últimas líneas del log.

```bash
sudo systemctl status tightvnc.service
```

La salida debe indicar:

```
active (running)
```

Si el estado muestra un error, revisar el log del servicio con el comando indicado en la sección 16 para identificar la causa.

---

## 13. Verificar el puerto de red

TightVNC utiliza el puerto 5901 para el display `:1`. Para confirmar que el servidor está escuchando conexiones entrantes en ese puerto, ejecutar:

```bash
sudo ss -tulpn | grep 5901
```

La salida debe mostrar una línea que contenga:

```
0.0.0.0:5901
```

Esto indica que el servidor acepta conexiones desde cualquier dirección IP de la red local. Si no aparece ningún resultado, el servicio no está activo o hay un error en la configuración.

---

## 14. Obtener la dirección IP de la Raspberry Pi

Para conectarse desde otro dispositivo, es necesario conocer la dirección IP local de la Raspberry Pi. Esta puede consultarse con:

```bash
hostname -I
```

La salida será algo similar a:

```
192.168.1.50
```

Esta es la dirección que se usará en el cliente VNC para establecer la conexión. La IP puede cambiar si el router asigna direcciones de forma dinámica; en ese caso se recomienda configurar una IP estática en el router o en la Raspberry Pi para evitar inconvenientes al momento de conectarse.

---

## 15. Conectarse desde otro dispositivo

Desde cualquier computador en la misma red local, instalar uno de los siguientes clientes VNC:

- RealVNC Viewer (disponible para Windows, Linux y macOS)
- TightVNC Viewer (disponible para Windows)

Al abrir el cliente, ingresar la siguiente dirección en el campo de conexión:

```
192.168.1.50:5901
```

Reemplazar `192.168.1.50` con la IP real obtenida en el paso anterior. El cliente solicitará la contraseña configurada en el paso 5. Una vez ingresada, se mostrará el escritorio LXDE de la Raspberry Pi listo para ser utilizado de forma remota.

---

## 16. Comandos de administración

Los siguientes comandos son útiles para administrar el servicio TightVNC durante el uso cotidiano del sistema.

### Ver sesiones VNC activas

Muestra todas las sesiones VNC que están corriendo actualmente en el sistema:

```bash
tightvncserver -list
```

### Reiniciar el servicio

Útil cuando se realizan cambios en la configuración o cuando la sesión presenta problemas de respuesta:

```bash
sudo systemctl restart tightvnc.service
```

### Detener el servicio

Detiene TightVNC sin deshabilitarlo; el servicio se reiniciará en el próximo arranque del sistema:

```bash
sudo systemctl stop tightvnc.service
```

### Ver los registros del servicio

Muestra el log detallado del servicio, útil para diagnosticar errores de inicio o comportamientos inesperados:

```bash
journalctl -xeu tightvnc.service
```

---

## 17. Solución de problemas comunes

### Error de permisos en xstartup (EACCES)

Si TightVNC no puede ejecutar el script de inicio, probablemente el archivo no tiene permisos de ejecución. Este es el error más común tras una instalación nueva. Corregir con:

```bash
chmod +x ~/.vnc/xstartup
```

### Pantalla gris o negra al conectarse

Este problema ocurre cuando el entorno gráfico no está instalado correctamente o cuando el archivo `xstartup` tiene errores en su contenido. Primero, verificar que `xstartup` tenga el contenido correcto según el paso 7. Si el problema persiste, reinstalar el escritorio:

```bash
sudo apt install lxde-core lxterminal -y
```

### El servicio no inicia

Si el servicio falla al iniciarse, consultar el log detallado para identificar el error específico:

```bash
sudo systemctl status tightvnc.service -l
```

Los errores más comunes son: nombre de usuario incorrecto en el archivo de servicio, ruta equivocada al ejecutable de TightVNC, o una sesión VNC residual que bloquea el puerto. Verificar que todos los campos del archivo de servicio correspondan al usuario y rutas correctas del sistema.

---

## Alternativa recomendada: RealVNC integrado

Raspberry Pi OS incluye RealVNC Server de forma nativa, con mejor integración con el sistema operativo y soporte oficial de Raspberry Pi Foundation. Esta es la opción recomendada si no se requiere TightVNC específicamente, ya que su configuración es más sencilla y no requiere crear un servicio de systemd manualmente.

Para activarlo, ejecutar la herramienta de configuración:

```bash
sudo raspi-config
```

Navegar a:

```
Interface Options > VNC > Enable
```

Consultar la documentación oficial para instrucciones detalladas:
https://www.raspberrypi.com/documentation/computers/remote-access.html
