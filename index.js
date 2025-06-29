const {
  default: makeWASocket,
  useSingleFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs-extra");
const pino = require("pino");

// === Setup Paths and Auto-Creation ===
const sessionPath = './creds.json';
const { state, saveState } = useSingleFileAuthState(sessionPath);
const USERS_FILE = './data/users.json';
const TASKS_FILE = './data/tasks.json';
const TEMP_FOLDER = './data/temp';

fs.ensureDirSync('./data');
fs.ensureDirSync(TEMP_FOLDER);
fs.ensureFileSync(USERS_FILE);
fs.ensureFileSync(TASKS_FILE);

let users = fs.readJsonSync(USERS_FILE, { throws: false }) || {};
let tasks = fs.readJsonSync(TASKS_FILE, { throws: false }) || {};

function saveAll() {
  fs.writeJsonSync(USERS_FILE, users);
  fs.writeJsonSync(TASKS_FILE, tasks);
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

// === Replace with your actual group JIDs ===
const submissionGroupJid = '1111111111@g.us';
const resultsGroupJid = '2222222222@g.us';
const withdrawGroupJid = '3333333333@g.us';

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Disconnected. Reconnecting...", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot connected");
    }
  });

  // Welcome users on join
  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    if (id === submissionGroupJid && action === "add") {
      for (const user of participants) {
        if (!users[user]) {
          users[user] = {
            balance: 0,
            completedTasks: [],
            account: "",
            taskHistory: {}
          };
          saveAll();
        }
        await sock.sendMessage(id, {
          text: `👋 Welcome @${user.split('@')[0]}!\nUse these:\n/balance, /withdraw, /account, /done, /work`,
          mentions: [user]
        });
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    // 🔁 Print Group or DM JID
    console.log(`📥 Message received from JID: ${from}`);

    const command = text.trim();
    const prefix = ["/", ".", "!"].find((p) => command.startsWith(p));
    if (!prefix) return;

    const args = command.slice(1).split(" ");
    const cmd = args.shift().toLowerCase();

    users[sender] = users[sender] || {
      balance: 0,
      completedTasks: [],
      account: "",
      taskHistory: {}
    };

    if (cmd === "work") {
      return await sock.sendMessage(from, {
        text: `🛠 *How to Work:*
1. Admin posts: !task <url> <task_id>
2. You submit proof with !done (with media)
3. Admin approves via !g <task_id>

💰 Earn Rs.3/day for 7 days/task
📌 Commands:
/balance /withdraw /account /done /work`
      });
    }

    if (cmd === "balance") {
      const u = users[sender];
      return await sock.sendMessage(from, {
        text: `💰 Balance: Rs.${u.balance}\n📌 Tasks: ${u.completedTasks.length}`
      });
    }

    if (cmd === "account") {
      const acc = args.join(" ");
      if (!acc) return await sock.sendMessage(from, { text: `❌ Example:\n!account Jazzcash Ali 03001234567` });
      users[sender].account = acc;
      saveAll();
      return await sock.sendMessage(from, { text: `✅ Account saved.` });
    }

    if (cmd === "withdraw") {
      const u = users[sender];
      if (!u.account) return await sock.sendMessage(from, { text: `⚠️ Set account first using !account` });
      if (u.balance < 100) return await sock.sendMessage(from, { text: `❌ Minimum Rs.100 required to withdraw.` });

      await sock.sendMessage(withdrawGroupJid, {
        text: `💸 Withdraw Request:\n• User: wa.me/${sender.split("@")[0]}\n• Account: ${u.account}\n• Amount: Rs.${u.balance}`
      });
      return await sock.sendMessage(from, { text: `🕒 Withdraw request sent. You'll be paid in 1 hour.` });
    }

    if (cmd === "task" && from === resultsGroupJid) {
      const url = args[0];
      const taskId = args[1];
      if (!url || !taskId) return;

      tasks[taskId] = { url, created: todayDate() };
      saveAll();

      return await sock.sendMessage(resultsGroupJid, {
        text: `📢 *New Task ${taskId}*\n🔗 ${url}`
      });
    }

    if (cmd === "done") {
      if (!msg.message.imageMessage && !msg.message.videoMessage) {
        return await sock.sendMessage(from, { text: "⚠️ Please attach screenshot or video with !done" });
      }

      const media = msg.message.imageMessage || msg.message.videoMessage;
      const caption = `📩 Task submission by @${sender.split('@')[0]}\nReply with !g <task_id> or !reject <task_id>`;
      return await sock.sendMessage(resultsGroupJid, {
        image: media,
        caption,
        mentions: [sender]
      });
    }

    if ((cmd === "g" || cmd === "reject") && msg.message.extendedTextMessage?.contextInfo?.participant) {
      const taskId = args[0];
      const userId = msg.message.extendedTextMessage.contextInfo.participant;
      if (!taskId || !tasks[taskId] || !users[userId]) return;

      const today = todayDate();
      let history = users[userId].taskHistory[taskId] || [];

      if (cmd === "g") {
        if (history.includes(today) || history.length >= 7) {
          return await sock.sendMessage(from, { text: `⚠️ Already credited or 7 days complete.` });
        }
        history.push(today);
        users[userId].taskHistory[taskId] = history;
        users[userId].balance += 3;
        users[userId].completedTasks.push(taskId);
        saveAll();

        return await sock.sendMessage(resultsGroupJid, {
          text: `✅ @${userId.split("@")[0]} earned Rs.3 for Task ${taskId}`,
          mentions: [userId]
        });
      } else {
        return await sock.sendMessage(resultsGroupJid, {
          text: `❌ @${userId.split("@")[0]} your Task ${taskId} was rejected.`,
          mentions: [userId]
        });
      }
    }

    if (cmd === "wap" && from === withdrawGroupJid && msg.message.extendedTextMessage?.contextInfo?.participant) {
      const userId = msg.message.extendedTextMessage.contextInfo.participant;
      if (users[userId]) {
        users[userId].balance = 0;
        saveAll();
        return await sock.sendMessage(resultsGroupJid, {
          text: `🎉 @${userId.split("@")[0]} your withdrawal was approved.`,
          mentions: [userId]
        });
      }
    }

    if (cmd === "cleartemp") {
      fs.emptyDirSync(TEMP_FOLDER);
      return await sock.sendMessage(from, { text: "🧹 Cleared temporary folder!" });
    }
  });
}

startBot();
