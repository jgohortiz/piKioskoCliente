# Instalacion completa de TightVNC Server en Raspberry Pi OS

Esta guía cubre la instalación y configuración de TightVNC Server en Raspberry Pi OS para acceso remoto mediante escritorio grafico. El proceso incluye la configuración del entorno grafico LXDE, la inicialización del servidor VNC, y la creación de un servicio systemd que garantiza el inicio automatico del servidor cada vez que la Raspberry Pi arranca. Esta guía es compatible con Raspberry Pi 4 y Raspberry Pi 5.

TightVNC es una solución de acceso remoto ligera y estable que permite controlar el escritorio de la Raspberry Pi desde cualquier computador en la misma red local, usando clientes disponibles para Windows, Linux y macOS. A diferencia de las soluciones propietarias, TightVNC es software libre y no requiere cuenta en servicios externos para funcionar.

---

## 1. Actualizar Raspberry Pi OS

Antes de instalar cualquier paquete, es importante tener el sistema operativo completamente actualizado. Esto garantiza que las dependencias que se instalaran posteriormente sean compatibles con la versión mas reciente de los repositorios oficiales y que no existan conflictos por paquetes desactualizados.

```bash
sudo apt update
sudo apt upgrade -y
```

El proceso puede tardar varios minutos dependiendo de la cantidad de actualizaciones pendientes y la velocidad de la conexión a internet.

---

## 2. Instalar el entorno grafico LXDE (si no existe)

TightVNC necesita un gestor de escritorio para mostrar una interfaz grafica al conectarse de forma remota. Si la instalación de Raspberry Pi OS es la versión Lite (sin escritorio), sera necesario instalar el entorno grafico LXDE. Si ya se dispone de escritorio instalado, este paso puede omitirse.

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

Si el comando devuelve un numero de versión, la instalación se completo correctamente.

---

## 4. Verificar el usuario activo

TightVNC debe inicializarse y configurarse desde el usuario normal del sistema, no desde el usuario root. Ejecutar VNC como root puede generar problemas de permisos y vulnerabilidades de seguridad. Si se esta trabajando como root, es necesario salir primero.

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
guillermo@pi
```

Todos los pasos siguientes deben ejecutarse desde este usuario.

---

## 5. Inicializar TightVNC por primera vez

El primer inicio de TightVNC es necesario para que el servidor genere su estructura de archivos de configuración y solicite la creación de la contraseña de acceso. Esta contraseña sera la que se use al conectarse de forma remota desde otro dispositivo.

```bash
tightvncserver :1
```

El numero `:1` indica que se usara el display 1, que corresponde al puerto 5901 de red. El sistema solicitara:

```
Password:
Verify:
```

Ingresar y confirmar la contraseña deseada. Al finalizar aparecerá un mensaje similar a:

```
New 'X' desktop is pi:1
```

Esto confirma que el servidor inicio correctamente en el display 1.

---

## 6. Detener la sesion VNC temporal

Esta primera sesión fue creada unicamente para generar los archivos de configuración. Debe detenerse antes de continuar con la configuración del escritorio grafico, ya que de lo contrario los cambios no tendrán efecto en la sesión actual.

```bash
tightvncserver -kill :1
```

---

## 7. Configurar el escritorio grafico

Por defecto, TightVNC no sabe que entorno grafico debe iniciar cuando alguien se conecta. El archivo `~/.vnc/xstartup` controla este comportamiento. Es necesario editarlo para indicarle que use LXDE como escritorio.

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

La primera linea define que el archivo es un script de bash. La segunda carga las preferencias de pantalla del usuario. La tercera inicia el escritorio LXDE en segundo plano.

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

## 8. Crear el servicio de inicio automatico con systemd

Para que TightVNC se inicie automáticamente cada vez que la Raspberry Pi enciende, es necesario crear un servicio de systemd. Systemd es el gestor de servicios de Raspberry Pi OS y permite controlar aplicaciones que deben ejecutarse en segundo plano.

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
User=guillermo
Group=guillermo
WorkingDirectory=/home/guillermo

PIDFile=/home/guillermo/.vnc/%H:1.pid

ExecStartPre=-/usr/bin/tightvncserver -kill :1 > /dev/null 2>&1
ExecStart=/usr/bin/tightvncserver :1
ExecStop=/usr/bin/tightvncserver -kill :1

[Install]
WantedBy=multi-user.target
```

**Importante:** si el nombre de usuario no es `guillermo`, reemplazar todas las ocurrencias por el nombre de usuario correcto del sistema. Esto incluye los campos `User`, `Group`, `WorkingDirectory` y `PIDFile`.

La directiva `ExecStartPre` se encarga de limpiar cualquier sesion VNC residual antes de iniciar una nueva, lo que previene errores al reiniciar el servicio. La directiva `After=network.target` garantiza que el servicio espere a que la red este disponible antes de iniciarse.

Guardar y cerrar el archivo con `CTRL + O`, `ENTER`, `CTRL + X`.

---

## 9. Recargar la configuracion de systemd

Cada vez que se crea o modifica un archivo de servicio en systemd, es necesario recargar el demonio para que reconozca los cambios. Sin este paso, el servicio recién creado no estará disponible.

```bash
sudo systemctl daemon-reload
```

---

## 10. Habilitar el inicio automatico

Habilitar el servicio indica a systemd que debe iniciarlo automáticamente en cada arranque del sistema. Sin este paso, el servicio solo puede iniciarse manualmente.

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

## 12. Verificar que el servicio este activo

Para confirmar que TightVNC esta funcionando correctamente, consultar el estado del servicio:

```bash
sudo systemctl status tightvnc.service
```

La salida debe indicar:

```
active (running)
```

Si el estado muestra un error, revisar el log del servicio con el comando de la sección 16 para identificar la causa.

---

## 13. Verificar el puerto de red

TightVNC utiliza el puerto 5901 para el display `:1`. Para confirmar que el servidor esta escuchando conexiones en ese puerto, ejecutar:

```bash
sudo ss -tulpn | grep 5901
```

La salida debe mostrar una linea que contenga:

```
0.0.0.0:5901
```

Esto indica que el servidor acepta conexiones desde cualquier dirección IP de la red local.

---

## 14. Obtener la dirección IP de la Raspberry Pi

Para conectarse desde otro dispositivo, es necesario conocer la dirección IP local de la Raspberry Pi. Esta puede consultarse con:

```bash
hostname -I
```

La salida sera algo similar a:

```
192.168.1.50
```

Esta es la dirección que se usara en el cliente VNC para establecer la conexión. La IP puede cambiar si el router asigna direcciones de forma dinámica; en ese caso se recomienda configurar una IP estática en el router o en la Raspberry Pi para evitar inconvenientes.

---

## 15. Conectarse desde otro dispositivo

Desde cualquier computador en la misma red local, instalar uno de los siguientes clientes VNC:

- RealVNC Viewer (disponible para Windows, Linux y macOS)
- TightVNC Viewer (disponible para Windows)

Al abrir el cliente, ingresar la siguiente dirección en el campo de conexión:

```
192.168.1.50:5901
```

Reemplazar `192.168.1.50` con la IP real obtenida en el paso anterior. El cliente solicitara la contraseña configurada en el paso 5. Una vez ingresada, se mostrara el escritorio LXDE de la Raspberry Pi.

---

## 16. Comandos de administracion

Los siguientes comandos son útiles para administrar el servicio TightVNC durante el uso cotidiano.

### Ver sesiones VNC activas

Muestra todas las sesiones VNC que están corriendo actualmente en el sistema:

```bash
tightvncserver -list
```

### Reiniciar el servicio

Util cuando se realizan cambios en la configuración o cuando la sesión presenta problemas:

```bash
sudo systemctl restart tightvnc.service
```

### Detener el servicio

Detiene TightVNC sin deshabilitarlo; el servicio se reiniciara en el próximo arranque:

```bash
sudo systemctl stop tightvnc.service
```

### Ver los registros del servicio

Muestra el log detallado del servicio, útil para diagnosticar errores:

```bash
journalctl -xeu tightvnc.service
```

---

## 17. Solucion de problemas comunes

### Error de permisos en xstartup (EACCES)

Si TightVNC no puede ejecutar el script de inicio, probablemente el archivo no tiene permisos de ejecución. Corregir con:

```bash
chmod +x ~/.vnc/xstartup
```

### Pantalla gris o negra al conectarse

Este problema ocurre cuando el entorno grafico no esta instalado correctamente o cuando el archivo `xstartup` tiene errores. Primero, verificar que `xstartup` tenga el contenido correcto según el paso 7. Si el problema persiste, reinstalar el escritorio:

```bash
sudo apt install lxde-core lxterminal -y
```

### El servicio no inicia

Si el servicio falla al iniciarse, consultar el log detallado para identificar el error especifico:

```bash
sudo systemctl status tightvnc.service -l
```

Los errores mas comunes son: nombre de usuario incorrecto en el archivo de servicio, ruta equivocada al ejecutable de TightVNC, o una sesión VNC residual que bloquea el puerto. Verificar que todos los campos del archivo de servicio correspondan al usuario y rutas correctas del sistema.

---

## Alternativa recomendada: RealVNC integrado

Raspberry Pi OS incluye RealVNC Server de forma nativa, con mejor integración con el sistema operativo y soporte oficial de Raspberry Pi Foundation. Esta es la opcion recomendada si no se requiere TightVNC específicamente.

Para activarlo, ejecutar la herramienta de configuración:

```bash
sudo raspi-config
```

Navegar a:

```
Interface Options → VNC → Enable
```

Consultar la documentacion oficial para instrucciones detalladas:
https://www.raspberrypi.com/documentation/computers/remote-access.html
