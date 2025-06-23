const fs = require('fs-extra');

module.exports = {
  name: 'autostatusreply',
  async execute({ sock, msg, config }) {
    config.autostatusreply = !config.autostatusreply;
    await fs.writeJson('./config.json', config, { spaces: 2 });
    await sock.sendMessage(msg.key.remoteJid, { text: `📝 Auto-statusreply turned ${config.autostatusreply ? 'ON' : 'OFF'}` });
  }
};
