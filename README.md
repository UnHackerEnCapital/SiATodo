# 🛡️ SiATodo: Google SSO Awareness PoC

<img width="290" height="263" alt="siatodo" src="https://github.com/user-attachments/assets/22a06b71-b180-44be-bf82-7183dc663d20" />

**SiATodo** es un laboratorio de ciberseguridad diseñado para realizar **Pruebas de Concepto (PoC)** de concientización. Demuestra visualmente cómo un atacante puede obtener acceso casi total a una cuenta de Google (Gmail, Drive, Fotos, Ubicación) si un usuario acepta permisos de OAuth2 sin revisarlos.

---

## 🧐 Análisis Técnico: ¿Qué hace el código?

La herramienta se divide en dos componentes principales:

1.  **`app.js` (El Servidor de Captura):** * Levanta un servidor Express que gestiona el flujo de **OAuth2**.
    * Utiliza `googleapis` para interactuar con los servicios de la víctima.
    * **Persistencia:** Guarda las cuentas capturadas en un archivo local `data/users.json` (incluyendo los *Refresh Tokens* para acceso persistente).
    * **Dashboard:** Incluye un panel administrativo protegido por contraseña (hash SHA-256) para visualizar los datos capturados.

2.  **`setup.js` (El Asistente de Configuración):**
    * Es un script interactivo que utiliza `readline` y `child_process`.
    * **Automatización de Navegador:** Abre automáticamente las secciones específicas de Google Cloud Platform (GCP) para que no tengas que buscarlas.
    * **Generador de Entorno:** Al finalizar el proceso, crea automáticamente el archivo `.env` con las credenciales obtenidas.

---

## 🛠️ Guía de Implementación Paso a Paso

El script `setup.js` te guiará por estos 10 pasos críticos:

### Paso 1 al 3: Preparación del Proyecto
* **Consola de GCP:** Abre el panel principal de Google Cloud.
* **Creación del Proyecto:** Te indica cómo crear el proyecto "Si-A-Todo".
* **Habilitación de APIs:** Abre los enlaces directos para activar:
    * `Google People API` (Identidad)
    * `Gmail API` (Lectura de correos)
    * `Google Drive API` (Acceso a archivos/fotos)
    * `Cloud Resource Manager API` (Gestión interna)

### Paso 4 y 5: Configuración de Identidad
* **Pantalla de Consentimiento (OAuth):** Configura la app como "Externa" y define los *Scopes* (permisos) solicitados.
* **Usuarios de Prueba:** Agrega los emails de las "víctimas" de prueba (necesario mientras la app esté en modo *Testing*).

### Paso 6 y 7: Credenciales
* **OAuth 2.0 Client ID:** Crea las llaves para una "Aplicación Web".
* **URI de Redirección:** Configura `http://localhost:3000/auth/google/callback` para que Google sepa a dónde enviar los tokens capturados.

### Paso 8 al 10: Finalización
* **Maps API (Opcional):** Genera una API Key para visualizar la ubicación GPS en un mapa real.
* **Generación de `.env`:** El script escribe todas las variables en el archivo de configuración.
* **Resumen:** Te brinda los comandos finales para iniciar el laboratorio.

---

## 🚀 Cómo ponerlo en marcha

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```
2.  **Ejecutar el Setup:**
    ```bash
    node setup.js
    ```
3.  **Iniciar el servidor:**
    ```bash
    node app.js
    ```
![Deploy-SiATodo](https://github.com/user-attachments/assets/f26cf1cf-09c8-4dbd-a9aa-137af44eb350)

##
    
4.  **Acceder al Dashboard (Tu panel):** `http://localhost:3000/dashboard`
5.  **Enviar el Link de Login (Víctima):** `http://localhost:3000/`

##

![ataque](https://github.com/user-attachments/assets/8f25ccd1-a445-4c82-9c14-e1ba1d87c979)

---

## ⚠️ Descargo de Responsabilidad (Disclaimer)

Esta herramienta ha sido creada exclusivamente para la comunidad de ciberseguridad. El autor no promueve ni se responsabiliza por el uso de **SiATodo** para actividades que infrinjan los Términos de Servicio de cualquier plataforma o que violen leyes locales de acceso a sistemas informáticos.

La ética es el pilar fundamental del analista de seguridad.
