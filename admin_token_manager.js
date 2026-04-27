/*
╔═══════════════════════════════════════════════════════════════╗
║   🔥 TOKEN DATABASE MANAGER - VENOM X 🔥                     ║
║   👑 DEVELOPER: HeriKeyzenlocker                             ║
║   📍 BANJARAN SUDOM - LAMPUNG SELATAN                        ║
╚═══════════════════════════════════════════════════════════════╝
*/

const fs = require("fs");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const chalk = require("chalk");

// ============ KONFIGURASI ============
const ADMIN_BOT_TOKEN = "7924404404:AAGe15a0BJLh4UUIulTJUbGrX2v7CiOsbbQ";
const MAIN_OWNER = 6320809772; // ID TELEGRAM LO

// ============ KONFIGURASI GITHUB ============
const GITHUB_REPO = "HeriTezzRorw2/Token.js";
const GITHUB_FILE_PATH = "Tokens.json";
const GITHUB_BRANCH = "main";
const GITHUB_PAT = process.env.GITHUB_PAT || "";

const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}`;
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

// ============ DATABASE ROLE (LOKAL) ============
const DB_PATH = "./database/";
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

function loadDB(file) {
  try { return JSON.parse(fs.readFileSync(DB_PATH + file)); } catch { return []; }
}
function saveDB(file, data) {
  fs.writeFileSync(DB_PATH + file, JSON.stringify(data, null, 2));
}

// Init database files
const dbFiles = ["owner.json", "admin.json", "partner.json", "reseller.json", "premium.json", "banned.json"];
dbFiles.forEach(f => { if (!fs.existsSync(DB_PATH + f)) saveDB(f, []); });

let ownerUsers = loadDB("owner.json");
let adminUsers = loadDB("admin.json");
let partnerUsers = loadDB("partner.json");
let resellerUsers = loadDB("reseller.json");
let premiumUsers = loadDB("premium.json");
let bannedUsers = loadDB("banned.json");

// ============ ROLE CHECK ============
const isOwner = (id) => ownerUsers.includes(id) || id === MAIN_OWNER;
const isAdmin = (id) => isOwner(id) || adminUsers.includes(id);
const isPartner = (id) => isAdmin(id) || partnerUsers.includes(id);
const isReseller = (id) => isPartner(id) || resellerUsers.includes(id);

// ============ GITHUB TOKEN FUNCTIONS ============
async function fetchTokens() {
  try {
    const res = await axios.get(GITHUB_RAW_URL);
    return res.data?.tokens || [];
  } catch (err) {
    console.log(chalk.red("❌ Gagal ambil token:", err.message));
    return [];
  }
}

async function updateTokens(tokens) {
  try {
    const { data } = await axios.get(GITHUB_API_URL, {
      headers: { Authorization: `token ${GITHUB_PAT}` }
    });
    const content = JSON.stringify({ tokens }, null, 2);
    await axios.put(GITHUB_API_URL, {
      message: `Update token - ${new Date().toISOString()}`,
      content: Buffer.from(content).toString("base64"),
      sha: data.sha,
      branch: GITHUB_BRANCH
    }, { headers: { Authorization: `token ${GITHUB_PAT}` } });
    console.log(chalk.green("✅ Token diupdate ke GitHub!"));
    return true;
  } catch (err) {
    console.error(chalk.red("❌ Gagal update:", err.message));
    return false;
  }
}

async function loadTokens() {
  const localFile = "./tokens_local.json";
  if (fs.existsSync(localFile)) {
    try { return JSON.parse(fs.readFileSync(localFile)).tokens || []; } catch { return []; }
  }
  return await fetchTokens();
}

async function saveTokens(tokens) {
  fs.writeFileSync("./tokens_local.json", JSON.stringify({ tokens }, null, 2));
  return await updateTokens(tokens);
}

// ============ BOT ============
const bot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: true });

bot.on('polling_error', (err) => {
  console.log(chalk.red(`Error: ${err.code}`));
  if (err.code === 'EFATAL' || err.code === 'ECONNABORTED') {
    console.log(chalk.yellow('🔄 Reconnect...'));
    setTimeout(() => { bot.stopPolling(); setTimeout(() => bot.startPolling(), 1000); }, 5000);
  }
});

const userCmd = new Map();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const now = Date.now();
  if (userCmd.has(userId) && now - userCmd.get(userId) < 1000) return;
  userCmd.set(userId, now);

  const menu = `
╔══════════════════════════════════════════════════════╗
║     🔥 TOKEN DATABASE MANAGER 🔥                     ║
╠══════════════════════════════════════════════════════╣
║  📌 /listtoken - Lihat semua token                  ║
║  📌 /addtoken <TOKEN> - Tambah token                ║
║  📌 /deltoken <TOKEN> - Hapus token                 ║
║  📌 /synctoken - Sync dari GitHub                   ║
╠══════════════════════════════════════════════════════╣
║  👑 OWNER MENU (Owner only)                         ║
║  /addowner <ID> /delowner <ID>                      ║
║  /addadmin <ID> /deladmin <ID>                      ║
╠══════════════════════════════════════════════════════╣
║  🤝 PARTNER MENU (Admin +)                          ║
║  /addpartner <ID> /delpartner <ID>                  ║
║  /addreseller <ID> /delreseller <ID>                ║
╠══════════════════════════════════════════════════════╣
║  💎 PREMIUM MENU (Reseller +)                       ║
║  /addprem <ID> /delprem <ID> /cekprem               ║
╠══════════════════════════════════════════════════════╣
║  🚫 /ban <ID> /unban <ID>  |  📊 /info              ║
╚══════════════════════════════════════════════════════╝

👑 Owner: @HeriKeyzenlocker | 📍 Banjaran Sudom
  `;
  bot.sendMessage(chatId, menu);
});

// ============ TOKEN MANAGEMENT ============
bot.onText(/\/listtoken/, async (msg) => {
  if (!isReseller(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Hanya Reseller ke atas!");
  const tokens = await loadTokens();
  if (!tokens.length) return bot.sendMessage(msg.chat.id, "📋 Tidak ada token!");
  let txt = "📋 *DAFTAR TOKEN:*\n\n";
  tokens.forEach((t, i) => { txt += `${i+1}. \`${t.substring(0,15)}...${t.substring(t.length-5)}\`\n`; });
  txt += `\n📊 Total: ${tokens.length}`;
  bot.sendMessage(msg.chat.id, txt, { parse_mode: "Markdown" });
});

bot.onText(/\/addtoken (.+)/, async (msg, match) => {
  const token = match[1].trim();
  const userId = msg.from.id;
  
  if (!isPartner(userId)) return bot.sendMessage(msg.chat.id, "❌ Hanya Partner ke atas!");
  if (token.length < 30) return bot.sendMessage(msg.chat.id, "❌ Token tidak valid!");
  
  let tokens = await loadTokens();
  if (tokens.includes(token)) return bot.sendMessage(msg.chat.id, "⚠️ Token sudah ada!");
  
  tokens.push(token);
  if (await saveTokens(tokens)) {
    const masked = token.substring(0, 15) + "..." + token.substring(token.length - 5);
    bot.sendMessage(msg.chat.id, `✅ *TOKEN BERHASIL DITAMBAHKAN!*\n\n📌 Token: \`${masked}\`\n📊 Total: ${tokens.length}`, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(msg.chat.id, "❌ Gagal menambahkan token!");
  }
});

bot.onText(/\/deltoken (.+)/, async (msg, match) => {
  const token = match[1].trim();
  const userId = msg.from.id;
  
  if (!isAdmin(userId)) return bot.sendMessage(msg.chat.id, "❌ Hanya Admin ke atas!");
  
  let tokens = await loadTokens();
  if (!tokens.includes(token)) return bot.sendMessage(msg.chat.id, "⚠️ Token tidak ditemukan!");
  
  tokens = tokens.filter(t => t !== token);
  if (await saveTokens(tokens)) {
    bot.sendMessage(msg.chat.id, `✅ *TOKEN BERHASIL DIHAPUS!*\n📊 Total: ${tokens.length}`, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(msg.chat.id, "❌ Gagal menghapus token!");
  }
});

bot.onText(/\/synctoken/, async (msg) => {
  if (!isReseller(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Hanya Reseller ke atas!");
  await bot.sendMessage(msg.chat.id, "🔄 Syncing...");
  const tokens = await fetchTokens();
  fs.writeFileSync("./tokens_local.json", JSON.stringify({ tokens }, null, 2));
  bot.sendMessage(msg.chat.id, `✅ Sync berhasil! Total: ${tokens.length} token`);
});

// ============ ROLE MANAGEMENT ============
const addRole = async (msg, match, file, role, required, check, successMsg) => {
  const id = parseInt(match[1]);
  if (!required(msg.from.id)) return bot.sendMessage(msg.chat.id, `❌ Hanya ${role.split(' ')[0]} ke atas!`);
  if (check(id)) return bot.sendMessage(msg.chat.id, `⚠️ Sudah jadi ${role}!`);
  const users = loadDB(file);
  users.push(id);
  saveDB(file, users);
  if (file === "owner.json") ownerUsers = users;
  if (file === "admin.json") adminUsers = users;
  if (file === "partner.json") partnerUsers = users;
  if (file === "reseller.json") resellerUsers = users;
  if (file === "premium.json") premiumUsers = users;
  bot.sendMessage(msg.chat.id, `✅ ${successMsg} \`${id}\``, { parse_mode: "Markdown" });
};

const delRole = async (msg, match, file, role, required, check, successMsg) => {
  const id = parseInt(match[1]);
  if (!required(msg.from.id)) return bot.sendMessage(msg.chat.id, `❌ Hanya ${role.split(' ')[0]} ke atas!`);
  if (!check(id)) return bot.sendMessage(msg.chat.id, `⚠️ ${id} bukan ${role}!`);
  const users = loadDB(file).filter(i => i !== id);
  saveDB(file, users);
  if (file === "owner.json") ownerUsers = users;
  if (file === "admin.json") adminUsers = users;
  if (file === "partner.json") partnerUsers = users;
  if (file === "reseller.json") resellerUsers = users;
  if (file === "premium.json") premiumUsers = users;
  bot.sendMessage(msg.chat.id, `✅ ${successMsg} \`${id}\``, { parse_mode: "Markdown" });
};

// Owner commands
bot.onText(/\/addowner (\d+)/, (m, match) => addRole(m, match, "owner.json", "Owner", isOwner, (id) => ownerUsers.includes(id), "Owner ditambahkan:"));
bot.onText(/\/delowner (\d+)/, (m, match) => {
  const id = parseInt(match[1]);
  if (!isOwner(m.from.id)) return bot.sendMessage(m.chat.id, "❌ Hanya Owner!");
  if (id === MAIN_OWNER) return bot.sendMessage(m.chat.id, "⚠️ Tidak bisa hapus owner utama!");
  if (!ownerUsers.includes(id)) return bot.sendMessage(m.chat.id, `⚠️ ${id} bukan owner!`);
  ownerUsers = ownerUsers.filter(i => i !== id);
  saveDB("owner.json", ownerUsers);
  bot.sendMessage(m.chat.id, `✅ Owner dihapus: \`${id}\``, { parse_mode: "Markdown" });
});

// Admin commands
bot.onText(/\/addadmin (\d+)/, (m, match) => addRole(m, match, "admin.json", "Admin", isOwner, (id) => adminUsers.includes(id), "Admin ditambahkan:"));
bot.onText(/\/deladmin (\d+)/, (m, match) => delRole(m, match, "admin.json", "Admin", isOwner, (id) => adminUsers.includes(id), "Admin dihapus:"));

// Partner commands
bot.onText(/\/addpartner (\d+)/, (m, match) => addRole(m, match, "partner.json", "Partner", isAdmin, (id) => partnerUsers.includes(id), "Partner ditambahkan:"));
bot.onText(/\/delpartner (\d+)/, (m, match) => delRole(m, match, "partner.json", "Partner", isAdmin, (id) => partnerUsers.includes(id), "Partner dihapus:"));

// Reseller commands
bot.onText(/\/addreseller (\d+)/, (m, match) => addRole(m, match, "reseller.json", "Reseller", isPartner, (id) => resellerUsers.includes(id), "Reseller ditambahkan:"));
bot.onText(/\/delreseller (\d+)/, (m, match) => delRole(m, match, "reseller.json", "Reseller", isPartner, (id) => resellerUsers.includes(id), "Reseller dihapus:"));

// Premium commands
bot.onText(/\/addprem (\d+)/, (m, match) => addRole(m, match, "premium.json", "Premium", isReseller, (id) => premiumUsers.includes(id), "Premium ditambahkan:"));
bot.onText(/\/delprem (\d+)/, (m, match) => delRole(m, match, "premium.json", "Premium", isReseller, (id) => premiumUsers.includes(id), "Premium dihapus:"));

bot.onText(/\/cekprem/, (msg) => {
  if (!isReseller(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Hanya Reseller ke atas!");
  if (!premiumUsers.length) return bot.sendMessage(msg.chat.id, "📋 Belum ada premium!");
  let txt = "📋 *PREMIUM USER:*\n\n";
  premiumUsers.forEach((id, i) => { txt += `${i+1}. \`${id}\`\n`; });
  bot.sendMessage(msg.chat.id, txt, { parse_mode: "Markdown" });
});

// Ban commands
bot.onText(/\/ban (\d+)/, (msg, match) => {
  const id = parseInt(match[1]);
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Hanya Admin ke atas!");
  if (bannedUsers.includes(id)) return bot.sendMessage(msg.chat.id, "⚠️ Sudah di-ban!");
  bannedUsers.push(id);
  saveDB("banned.json", bannedUsers);
  bot.sendMessage(msg.chat.id, `✅ User \`${id}\` di-ban!`, { parse_mode: "Markdown" });
});

bot.onText(/\/unban (\d+)/, (msg, match) => {
  const id = parseInt(match[1]);
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Hanya Admin ke atas!");
  if (!bannedUsers.includes(id)) return bot.sendMessage(msg.chat.id, "⚠️ Tidak di-ban!");
  bannedUsers = bannedUsers.filter(i => i !== id);
  saveDB("banned.json", bannedUsers);
  bot.sendMessage(msg.chat.id, `✅ User \`${id}\` di-unban!`, { parse_mode: "Markdown" });
});

bot.onText(/\/info/, (msg) => {
  const tokensCount = fs.existsSync("./tokens_local.json") ? (JSON.parse(fs.readFileSync("./tokens_local.json")).tokens || []).length : 0;
  bot.sendMessage(msg.chat.id, `
╔══════════════════════════════════════╗
║   📊 DATABASE INFO - VENOM X         ║
╠══════════════════════════════════════╣
║ 👑 Owner: ${ownerUsers.length + 1}
║ 👔 Admin: ${adminUsers.length}
║ 🤝 Partner: ${partnerUsers.length}
║ 📦 Reseller: ${resellerUsers.length}
║ 💎 Premium: ${premiumUsers.length}
║ 🚫 Banned: ${bannedUsers.length}
║ 🎫 Token DB: ${tokensCount}
╚══════════════════════════════════════╝
📍 ${GITHUB_REPO} | ✅ ACTIVE
👑 HeriKeyzenlocker - Banjaran Sudom
  `);
});

console.log(chalk.green("🔥 TOKEN DATABASE MANAGER ACTIVE!"));
console.log(chalk.yellow("📍 Banjaran Sudom - Padang Cermin - Lampung"));

module.exports = { bot, isOwner, isAdmin, isPartner, isReseller };
