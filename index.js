const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const delay = require('delay');
const fetch = require('node-fetch');

const sessionDir = path.join(__dirname, 'session');
fs.ensureDirSync(sessionDir);

const { state, saveState } = useSingleFileAuthState(path.join(sessionDir, 'creds.json'));
const config = fs.readJsonSync('./config.json');

const commands = new Map();
fs.readdirSync('./commands').filter(f => f.endsWith('.js')).forEach(file => {
  const cmd = require(path.join(__dirname, 'commands', file));
  commands.set(cmd.name, cmd);
});

async function start() {
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (connection === 'open') {
      console.log('✅ Bot connected');
      sock.sendMessage(sock.user.id, { text: '🤖 Bot connected successfully!' });
    } else if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed:', code);
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...');
        start();
      } else {
        console.log('Logged out. Please delete session files and restart.');
      }
    } else if (qr) {
      console.log('Scan this QR code to connect your WhatsApp:');
      console.log(qr);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const cmdPrefix = '.';

      if (text.startsWith(cmdPrefix)) {
        const [cmdName, ...args] = text.slice(cmdPrefix.length).split(' ');
        const command = commands.get(cmdName.toLowerCase());
        if (command) {
          try {
            await command.execute({ sock, msg, args, config, sessionDir, delay, fetch });
          } catch (e) {
            console.error('Error executing command:', e);
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Error: ${e.message}` });
          }
        }
      } else {
        // Chatbot auto-reply if enabled and not disabled for this chat
        const chatbot = commands.get('chatbot');
        if (chatbot) {
          try {
            await chatbot.chat({ sock, msg, config, delay, fetch });
          } catch {}
        }
      }
    }
  });

  sock.ev.on('messages.delete', ({ keys }) => {
    if (!config.antidelete) return;
    for (const key of keys) {
      sock.sendMessage(sock.user.id, { text: `🛡️ Deleted message detected from ${key.remoteJid}` });
    }
  });

  // Periodically clear temp files
  setInterval(() => {
    fs.readdirSync(sessionDir)
      .filter(f => f.includes('tmp'))
      .forEach(f => fs.removeSync(path.join(sessionDir, f)));
  }, 30 * 60 * 1000);
}

start();
