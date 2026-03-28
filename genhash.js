/**
 * genhash.js — Generador de hash para la contraseña del dashboard
 * Uso: node genhash.js
 */
require('dotenv').config();
const crypto   = require('crypto');
const readline = require('readline');
const fs       = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q, hidden = false) {
  return new Promise(resolve => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(q);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      let password = '';
      process.stdin.on('data', function handler(ch) {
        ch = ch.toString();
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          resolve(password);
        } else if (ch === '\u007f') {
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(q + '*'.repeat(password.length));
        } else {
          password += ch;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(q, resolve);
    }
  });
}

async function main() {
  console.log('\n\x1b[36m\x1b[1m  SiATodo — Generador de contraseña del dashboard\x1b[0m\n');

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error('\x1b[31m  ✗ SESSION_SECRET no está en el .env. Corré primero node setup.js\x1b[0m\n');
    process.exit(1);
  }

  const password = await ask('  Ingresá la contraseña para el dashboard: ', true);

  if (password.length < 8) {
    console.error('\x1b[31m\n  ✗ La contraseña debe tener al menos 8 caracteres.\x1b[0m\n');
    rl.close();
    process.exit(1);
  }

  const hash = crypto.createHash('sha256').update(password + sessionSecret).digest('hex');

  console.log('\n\x1b[32m  ✅ Hash generado correctamente.\x1b[0m');
  console.log('\n\x1b[1m  Agregá esta línea a tu .env:\x1b[0m\n');
  console.log('\x1b[33m  DASHBOARD_PASSWORD_HASH=' + hash + '\x1b[0m\n');

  // Agregar automáticamente al .env si existe
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf-8');

    if (envContent.includes('DASHBOARD_PASSWORD_HASH=')) {
      // Reemplazar línea existente
      envContent = envContent.replace(/DASHBOARD_PASSWORD_HASH=.*/g, 'DASHBOARD_PASSWORD_HASH=' + hash);
      console.log('  \x1b[36m→ Hash actualizado en .env automáticamente.\x1b[0m\n');
    } else {
      // Agregar al final
      envContent += '\n# Contraseña del dashboard (generada con genhash.js)\nDASHBOARD_PASSWORD_HASH=' + hash + '\n';
      console.log('  \x1b[36m→ Hash agregado al .env automáticamente.\x1b[0m\n');
    }

    fs.writeFileSync(envPath, envContent);
  } else {
    console.log('  \x1b[33m→ No encontré .env — copiá la línea de arriba manualmente.\x1b[0m\n');
  }

  rl.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});
