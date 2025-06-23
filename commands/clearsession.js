const fs = require('fs-extra');
const path = require('path');

module.exports = {
  name: 'clearsession',
  async execute({ sock, msg, sessionDir }) {
    const files = await fs.readdir(sessionDir);
    for (const file of files) {
      if (file !== 'creds.json') {
        await fs.remove(path.join(sessionDir, file));
      }
    }
    await sock.sendMessage(msg.key.remoteJid, { text: '✅ Session cleared except creds.json' });
  }
};
