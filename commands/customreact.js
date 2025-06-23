const fs = require('fs-extra');

module.exports = {
  name: 'customreact',
  async execute({ sock, msg, args, config }) {
    if (!args.length) {
      return sock.sendMessage(msg.key.remoteJid, { text: 'Usage: .customreact ❤️ 😂' });
    }
    config.customreact = args;
    await fs.writeJson('./config.json', config, { spaces: 2 });
    await sock.sendMessage(msg.key.remoteJid, { text: '✅ Custom react saved! Restarting bot...' });
    setTimeout(() => process.exit(0), 2000);
  }
};
