# Instalación completa de TightVNC Server en Raspberry Pi OS

Esta guía permite instalar y configurar TightVNC Server en Raspberry Pi OS con:

- Acceso remoto VNC
- Inicio automático al arrancar
- Escritorio LXDE
- Compatible con Raspberry Pi 4 y Raspberry Pi 5

---

# 1. Actualizar Raspberry Pi OS

Abrir terminal y ejecutar:

```bash
sudo apt update
sudo apt upgrade -y
```

---

# 2. Instalar entorno gráfico (si no existe)

```bash
sudo apt install lxde-core lxterminal -y
```

---

# 3. Instalar TightVNC Server

```bash
sudo apt install tightvncserver -y
```

Verificar instalación:

```bash
tightvncserver -version
```

---

# 4. Salir del usuario root (IMPORTANTE)

Si estás así:

```text
root@pi
```

sal con:

```bash
exit
```

Debes quedar como tu usuario normal:

```text
guillermo@pi
```

---

# 5. Inicializar TightVNC

Ejecutar:

```bash
tightvncserver :1
```

Te pedirá:

```text
Password:
Verify:
```

Esa será la contraseña VNC.

Al finalizar aparecerá algo parecido a:

```text
New 'X' desktop is pi:1
```

---

# 6. Detener sesión VNC temporal

```bash
tightvncserver -kill :1
```

---

# 7. Configurar escritorio gráfico

Editar archivo:

```bash
nano ~/.vnc/xstartup
```

Borrar TODO y dejar:

```bash
#!/bin/bash
xrdb $HOME/.Xresources
startlxde &
```

Guardar:

```text
CTRL + O
ENTER
CTRL + X
```

Dar permisos:

```bash
chmod +x ~/.vnc/xstartup
```

---

# 8. Crear servicio automático systemd

Crear archivo:

```bash
sudo nano /etc/systemd/system/tightvnc.service
```

Pegar esto:

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

IMPORTANTE:

Si tu usuario NO es `guillermo`, reemplázalo por el correcto.

Guardar y salir.

---

# 9. Recargar systemd

```bash
sudo systemctl daemon-reload
```

---

# 10. Habilitar inicio automático

```bash
sudo systemctl enable tightvnc.service
```

---

# 11. Iniciar TightVNC

```bash
sudo systemctl start tightvnc.service
```

---

# 12. Verificar estado

```bash
sudo systemctl status tightvnc.service
```

Debe decir:

```text
active (running)
```

---

# 13. Verificar puerto VNC

```bash
sudo ss -tulpn | grep 5901
```

Debe aparecer:

```text
0.0.0.0:5901
```

---

# 14. Obtener IP Raspberry

```bash
hostname -I
```

Ejemplo:

```text
192.168.1.50
```

---

# 15. Conectarse desde Windows/Linux/Mac

Instalar:

- RealVNC Viewer
- TightVNC Viewer

Conectarse usando:

```text
192.168.1.50:5901
```

---

# 16. Comandos útiles

## Ver sesiones activas

```bash
tightvncserver -list
```

## Reiniciar servicio

```bash
sudo systemctl restart tightvnc.service
```

## Detener servicio

```bash
sudo systemctl stop tightvnc.service
```

## Ver logs

```bash
journalctl -xeu tightvnc.service
```

---

# 17. Problemas comunes

## Error EACCES

Corregir permisos:

```bash
chmod +x ~/.vnc/xstartup
```

## Pantalla gris o negra

Reinstalar escritorio:

```bash
sudo apt install lxde-core lxterminal -y
```

## Servicio no inicia

Ver detalles:

```bash
sudo systemctl status tightvnc.service -l
```

---

# Alternativa recomendada

RealVNC Server viene mejor integrado en Raspberry Pi OS.

Activar:

```bash
sudo raspi-config
```

Luego:

```text
Interface Options → VNC → Enable
```

Documentación oficial:

https://www.raspberrypi.com/documentation/computers/remote-access.html
