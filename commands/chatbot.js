const disabledChats = new Set();

module.exports = {
  name: 'chatbot',
  async execute({ sock, msg, args }) {
    const jid = msg.key.remoteJid;
    if (!args.length) {
      await sock.sendMessage(jid, { text: 'Usage: .chatbot on/off' });
      return;
    }

    if (args[0] === 'off') {
      disabledChats.add(jid);
      await sock.sendMessage(jid, { text: '🤖 Chatbot turned OFF for this chat' });
    } else if (args[0] === 'on') {
      disabledChats.delete(jid);
      await sock.sendMessage(jid, { text: '🤖 Chatbot turned ON for this chat' });
    } else {
      await sock.sendMessage(jid, { text: 'Usage: .chatbot on/off' });
    }
  },

  async chat({ sock, msg, config, delay, fetch }) {
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || '';
    if (msg.key.fromMe || disabledChats.has(jid) || !text) return;

    await sock.sendPresenceUpdate('composing', jid);
    await delay(1200 + Math.random() * 2000);

    try {
      const url = `https://api.dreaded.site/api/chatgpt?text=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const json = await res.json();
      const reply = json.choices?.[0]?.text || json.response || 'Sorry, no response.';
      if (reply.trim() && reply.toLowerCase() !== text.toLowerCase()) {
        await sock.sendMessage(jid, { text: reply.trim() });
      }
    } catch (e) {
      // ignore fetch errors silently
    }
  }
};
