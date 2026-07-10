const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// 從環境變數讀取資料
const TOKEN = process.env.DISCORD_TOKEN;
const GAS_WEBAPP_URL = process.env.GAS_URL; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot 已經線上登入：${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // 排除機器人自己的訊息
    if (message.author.bot) return;

    // 檢查是否有附件 (圖片/檔案)
    if (message.attachments.size > 0) {
        const attachmentArray = Array.from(message.attachments.values());
        
        // 封裝要丟給 Google Apps Script 的資料
        const payload = {
            channel_id: message.channelId,
            attachments: attachmentArray.map(att => ({
                url: att.url,
                filename: att.name
            }))
        };

        try {
            // 轉發給 GAS WebApp 處理
            await axios.post(GAS_WEBAPP_URL, payload);
            await message.react('✅'); // 成功就在 Discord 該訊息刷個勾勾
        } catch (error) {
            console.error('發送給 GAS 失敗:', error.message);
            await message.react('❌');
        }
    }
});

client.login(TOKEN);
