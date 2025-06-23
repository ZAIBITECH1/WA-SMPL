module.exports = {
  name: 'ping',
  async execute({ sock, msg }) {
    const uptime = process.uptime().toFixed(0);
    const now = new Date().toLocaleString();
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🏓 Pong!\nUptime: ${uptime} seconds\nTime: ${now}`
    });
  }
};
