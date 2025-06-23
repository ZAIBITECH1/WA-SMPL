const fs = require('fs-extra');

module.exports = {
  name: 'autoreact',
  async execute({ sock, msg, args, config }) {
    config.autoreact = args[0] || 'off';
    await fs.writeJson('./config.json', config, { spaces: 2 });
    await sock.sendMessage(msg.key.remoteJid, { text: `🎨 Autoreact set to ${config.autoreact}` });
  }
};
