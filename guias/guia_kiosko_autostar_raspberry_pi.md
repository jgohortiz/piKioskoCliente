# Guía de Configuración: Kiosko Autostart en Raspberry Pi

Esta guía describe el proceso completo para configurar una Raspberry Pi como kiosko de pantalla completa con inicio automático de la aplicación `piKioskoCliente`. Se cubren aspectos de instalación, seguridad del sistema, acceso remoto por SSH, monitoreo opcional con Zabbix y protección de la tarjeta SD mediante sistema de archivos en modo de solo lectura.

---

## 1. Prerequisitos

Antes de iniciar cualquier configuración, es necesario preparar el sistema operativo de la Raspberry Pi para aprovechar al máximo el almacenamiento disponible en la tarjeta SD. Por defecto, Raspberry Pi OS no utiliza la totalidad del espacio de la tarjeta; la opción de expandir el sistema de archivos corrige esto y garantiza que el sistema tenga acceso a toda la capacidad de almacenamiento disponible.

Ejecute la utilidad de configuración:

```bash
sudo raspi-config
```

En la ventana de configuración establezca:

- `Advanced Options` > `Expand Filesystem` > `Yes`

### Instalar el paquete para ocultar el cursor del mouse

En un entorno de kiosko, el cursor del mouse no debe ser visible para el usuario final, ya que puede interferir con la experiencia visual de la aplicación. El paquete `unclutter` se encarga de ocultarlo automáticamente cuando no hay actividad, logrando una presentación limpia y profesional.

```bash
sudo apt update && apt upgrade -y
sudo apt update && apt full-upgrade -y
sudo apt install unclutter -y
```

---

## 2. Instalación de la Aplicación

La aplicación `piKioskoCliente` se distribuye como un archivo AppImage, un formato portable de Linux que no requiere instalación tradicional. Solo es necesario copiar los archivos al directorio del usuario y asignar los permisos correctos de ejecución.

> **Importante:** En GitHub, descargue la versión correspondiente para arquitectura ARM64: `piKioskoCliente-x.y.z-arm64`.

Si el usuario con el que inicia la Raspberry es `pi`, copie los siguientes archivos en `/home/pi`:

1. `piKioskoCliente-1.0.0-arm64.AppImage`
2. `piKioskoCliente.conf`

Asigne permisos de ejecución al AppImage:

```bash
chmod +x /home/pi/piKioskoCliente-1.0.0-arm64.AppImage
```

### Configurar piKioskoCliente.conf

El archivo de configuración permite ajustar los parámetros de conexión y comportamiento de la aplicación según el entorno de despliegue. Edítelo con el editor de su preferencia y defina los valores adecuados para su instalación:

```bash
sudo nano /home/pi/piKioskoCliente.conf
```

---

## 3. Inicio Automático del Escritorio (LXDE)

Para que la aplicación se inicie automáticamente al arrancar el escritorio gráfico LXDE, se utiliza el mecanismo estándar de autoarranque de aplicaciones. Esto garantiza que, tras cualquier reinicio del sistema, el kiosko quede operativo sin intervención manual.

El siguiente procedimiento crea la carpeta de autoarranque y el archivo de entrada del escritorio que lanza la aplicación junto con el ocultador del cursor:

```bash
mkdir -p /home/pi/.config/autostart
nano /home/pi/.config/autostart/pikiosko.desktop
```

Copie el siguiente contenido en el archivo:

```ini
[Desktop Entry]
Type=Application
Name=piKioskoCliente
Exec=bash -c "sleep 2 && unclutter -idle 0 -root & /home/pi/piKioskoCliente-1.0.0-arm64.AppImage --no-sandbox"
Hidden=false
X-GNOME-Autostart-enabled=true
```

El retraso de 2 segundos (`sleep 2`) permite que el escritorio termine de cargarse antes de lanzar la aplicación, evitando posibles errores de inicialización. El proceso `unclutter` se ejecuta en paralelo para ocultar el cursor desde el arranque.

---

## 4. Seguridad del Sistema

En entornos de uso público o en instalaciones donde la seguridad es prioritaria, es fundamental reducir la superficie de ataque del sistema. Esto implica deshabilitar todas las interfaces de conectividad que no sean estrictamente necesarias para el funcionamiento del kiosko: puertos USB, interfaces de red y Bluetooth. Estas medidas previenen accesos no autorizados, extracción de datos y otros vectores de ataque comunes en sistemas expuestos.

### 4.1 Deshabilitar Puertos USB, Ethernet y Wi-Fi

El siguiente bloque de configuración en crontab desvincula los puertos USB del sistema en cada arranque y deshabilita la interfaz inalámbrica. Si alguna interfaz es necesaria para el funcionamiento del sistema (por ejemplo, Ethernet para la conexión de red), comente la línea correspondiente con `#`.

Ejecute el editor de crontab del usuario root:

```bash
sudo crontab -e
```

Agregue al final del archivo:

```
@reboot echo 'usb1' | tee /sys/bus/usb/drivers/usb/unbind
@reboot echo 'usb2' | tee /sys/bus/usb/drivers/usb/unbind
@reboot echo 'usb3' | tee /sys/bus/usb/drivers/usb/unbind
@reboot echo 'usb4' | tee /sys/bus/usb/drivers/usb/unbind
#@reboot sudo ifconfig eth0 down
@reboot sudo ifconfig wlan0 down
* */6 * * * reboot now >/dev/null 2>&1
@reboot date >> /home/pi/date.log
```

> **Nota:** Comente con `#` la línea de los puertos o interfaces que deban permanecer habilitados. La línea de `eth0` ya está comentada por defecto para conservar la conexión Ethernet.

La regla `* */6 * * *` programa un reinicio automático del sistema cada 6 horas, lo que ayuda a mantener la estabilidad del kiosko en entornos de operación continua.

### 4.2 Desactivar Bluetooth

El Bluetooth representa un vector de ataque inalámbrico que, en la mayoría de los kioskos, no tiene ningún uso legítimo. Desactivarlo a nivel de firmware mediante un overlay es la forma más segura y eficiente de hacerlo, ya que impide su inicialización desde el arranque del sistema.

Edite el archivo de configuración del firmware:

```bash
sudo nano /boot/firmware/config.txt
```

Agregue al final del archivo:

```
# Desactivar bluetooth
dtoverlay=disable-bt
```

> **Nota:** Para volver a habilitarlo, comente la línea `dtoverlay=disable-bt` y reinicie el sistema.

---

## 5. Configuración de SSH

El acceso remoto por SSH es la vía principal de administración de la Raspberry Pi en producción. Una configuración adecuada del servidor SSH reduce significativamente el riesgo de accesos no autorizados, limitando los intentos de autenticación, deshabilitando el inicio de sesión directo como root y restringiendo el número de sesiones concurrentes.

> **Importante:** Para conectarse por SSH utilice un cliente como PuTTY. Ingrese el nombre de host o la dirección IP del dispositivo. El puerto por defecto es el 22.

Edite el archivo de configuración del servidor SSH:

```bash
sudo nano /etc/ssh/sshd_config
```

Establezca los siguientes parámetros:

```
LoginGraceTime 1m
PermitRootLogin prohibit-password
StrictModes yes
MaxAuthTries 3
MaxSessions 2
PasswordAuthentication yes
PermitEmptyPasswords no
KbdInteractiveAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Banner /etc/issue
```

> El parámetro `Banner` es opcional. Si se activa, muestra un mensaje personalizado antes de solicitar las credenciales de acceso.

### 5.1 Banner de Bienvenida (Opcional)

El banner de entrada es el primer texto que ve cualquier usuario que intente conectarse por SSH. Puede utilizarse para mostrar avisos legales o advertencias de uso no autorizado, lo que tiene valor tanto disuasorio como legal en muchos entornos corporativos.

Edite el archivo del banner:

```bash
sudo nano /etc/issue
```

Agregue el contenido deseado. A continuación se muestra un ejemplo con arte ASCII y aviso de uso autorizado:

```
██████╗ ██╗██╗  ██╗██╗ ██████╗ ███████╗██╗  ██╗ ██████╗  ██████╗██╗     ██╗███████╗███╗   ██╗████████╗███████╗
██╔══██╗██║██║ ██╔╝██║██╔═══██╗██╔════╝██║ ██╔╝██╔═══██╗██╔════╝██║     ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝
██████╔╝██║█████╔╝ ██║██║   ██║███████╗█████╔╝ ██║   ██║██║     ██║     ██║█████╗  ██╔██╗ ██║   ██║   █████╗  
██╔═══╝ ██║██╔═██╗ ██║██║   ██║╚════██║██╔═██╗ ██║   ██║██║     ██║     ██║██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  
██║     ██║██║  ██╗██║╚██████╔╝███████║██║  ██╗╚██████╔╝╚██████╗███████╗██║███████╗██║ ╚████║   ██║   ███████╗
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚══════╝╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝


***     AVISO   DE   USO   AUTORIZADO     ***

Este sistema es un recurso privado, reservado  exclusivamente para
usuarios autorizados. Todo acceso no autorizado está estrictamente
prohibido y puede ser objeto de sanciones civiles o penales.
Si  usted   no  está expresamente  autorizado,  debe desconectarse
inmediatamente.
```

Una vez realizados todos los cambios, reinicie el servicio SSH para que surtan efecto:

```bash
sudo systemctl restart ssh
```

---

## 6. Monitoreo con Zabbix (Opcional)

Zabbix es una plataforma de monitoreo de infraestructura de código abierto que permite supervisar el estado y el rendimiento de los dispositivos en la red. Instalar el agente de Zabbix en la Raspberry Pi permite centralizar el monitoreo del kiosko junto con el resto de la infraestructura, recibir alertas ante fallos y llevar un historial de disponibilidad.

Referencia oficial: https://www.zabbix.com/documentation/7.4/es/manual/guides/monitor_linux

### 6.1 Instalación

Instale el agente de Zabbix:

```bash
apt install zabbix-agent -y
```

Inicie y habilite el servicio para que arranque automáticamente con el sistema:

```bash
systemctl restart zabbix-agent
systemctl enable zabbix-agent
```

### 6.2 Configuración

Edite el archivo de configuración del agente:

```bash
nano /etc/zabbix/zabbix_agentd.conf
```

Especifique la dirección IP del servidor Zabbix. Esta dirección debe corresponder al servidor central donde se centraliza el monitoreo:

```
Server=192.168.x.y
...
ServerActive=192.168.x.y
```

Reemplace `192.168.x.y` con la dirección IP real del servidor Zabbix en su red.

Reinicie el agente y verifique que el servicio esté activo:

```bash
systemctl restart zabbix-agent
systemctl status zabbix-agent
```

---
## 7. Configuración de la pantalla

Edite la configuración del escritorio.
```bash
nano /home/pi/.config/pcmanfm/default/desktop-items-HDMI-A-1.conf
```

Defina los parámetros de la siguiente forma para quitar iconos, fondo y establecer colores.
```
[*]
desktop_bg=#000000
desktop_shadow=#000000
desktop_fg=#E8E8E8
desktop_font=Nunito Sans Light 12
wallpaper=
wallpaper_mode=color
show_home=0
show_trash=0
show_mounts=0
folder=/home/pi/Desktop
```

Para actualizar ejecute las siguientes instrucciones.
```bash
pcmanfm --reconfigure
pcmanfm --desktop-off
```

---

## 8. Modo de Solo Lectura de la Tarjeta SD

En equipos que operan de forma continua y sin supervisión constante, las escrituras frecuentes sobre la tarjeta SD pueden reducir su vida útil y, en caso de un corte de energía repentino, provocar corrupción del sistema de archivos. El sistema de archivos superpuesto (Overlay File System) de Raspberry Pi OS soluciona este problema redirigiendo todas las escrituras a la memoria RAM, dejando la tarjeta SD en modo de solo lectura.

Esto garantiza que el sistema siempre arranque en un estado limpio y conocido, independientemente de lo que haya ocurrido en la sesión anterior.

Si lo desea, antes de activar el modo de solo lectura puede limpiar el historial de comandos del usuario para evitar que queden registros de sesiones anteriores:

```bash
history -c && history -w
```

Antes de "congelar la SD" borre los videos que se hayan descargado, para tal fin detenga la aplicación y elimine los videos:

```bash
kill $(pgrep -f "piKioskoCliente")
rm /home/pi/.config/piKioskoCliente/videos/*.mp4
```


A continuación, abra la utilidad de configuración:

```bash
sudo raspi-config
```

Navegue hasta `Performance Options` > `Overlay File System` y seleccione `Yes` para habilitarlo.

> **Nota:** Para volver a permitir escritura en la tarjeta SD, repita el proceso en `raspi-config` y deshabilite el `Overlay File System`. Esto es necesario, por ejemplo, para actualizar la aplicación o modificar archivos de configuración.

Una vez completada la configuración, reinicie la Raspberry Pi. Puede verificar el estado del sistema de archivos con el siguiente comando:

```bash
sudo cat /etc/fstab
```
