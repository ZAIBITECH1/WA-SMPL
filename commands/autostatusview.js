const fs = require('fs-extra');

module.exports = {
  name: 'autostatusview',
  async execute({ sock, msg, config }) {
    config.autostatusview = !config.autostatusview;
    await fs.writeJson('./config.json', config, { spaces: 2 });
    await sock.sendMessage(msg.key.remoteJid, { text: `👁️ Auto-statusview turned ${config.autostatusview ? 'ON' : 'OFF'}` });
  }
};
