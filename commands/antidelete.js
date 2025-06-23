const fs = require('fs-extra');

module.exports = {
  name: 'antidelete',
  async execute({ sock, msg, config }) {
    config.antidelete = !config.antidelete;
    await fs.writeJson('./config.json', config, { spaces: 2 });
    await sock.sendMessage(msg.key.remoteJid, { text: `🛡️ Antidelete turned ${config.antidelete ? 'ON' : 'OFF'}` });
  }
};
