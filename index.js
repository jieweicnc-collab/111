const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');
const convert = require('heic-convert'); // ✨ 載入 HEIC 轉檔工具

const TOKEN = process.env.DISCORD_TOKEN;
const GAS_WEBAPP_URL = process.env.GAS_URL; 

// --- 建立小型伺服器讓 GAS 可以喚醒它防休眠 ---
const app = express();
app.get('/', (req, res) => res.send('Bot 正常運作中！已防止睡眠。'));
app.listen(process.env.PORT || 3000, () => {
    console.log('網頁伺服器已啟動，等待 GAS 喚醒訊號...');
});
// ------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot 已經線上登入：${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: '出貨單自動辨識中 🧾', type: 0 }],
        status: 'online',
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.attachments.size > 0) {
        const attachmentArray = Array.from(message.attachments.values());
        let processedAttachments = [];

        // 在 Discord 訊息先給一個 🔄 符號表示處理中
        await message.react('🔄');

        for (const att of attachmentArray) {
            let filename = att.name;
            let url = att.url;
            let base64Data = null;

            // ✨ 如果偵測到是 HEIC 檔案，直接在 Render 進行轉檔
            if (filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif')) {
                try {
                    console.log(`收到 HEIC 檔案，正在轉換為 JPG: ${filename}`);
                    
                    // 下載 HEIC 圖片
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    
                    // 轉檔成 JPEG
                    const outputBuffer = await convert({
                        buffer: response.data,
                        format: 'JPEG',
                        quality: 1
                    });
                    
                    // 將轉好的圖片編碼為 Base64 準備傳給 GAS
                    base64Data = outputBuffer.toString('base64');
                    // 將副檔名改為 jpg
                    filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
                    console.log(`轉換成功: ${filename}`);

                } catch (error) {
                    console.error('HEIC 轉檔失敗:', error.message);
                    await message.reply('⚠️ HEIC 圖片轉檔失敗，請確認圖片是否損毀。');
                    await message.react('❌');
                    return;
                }
            }

            processedAttachments.push({
                url: url, // 原本網址
                filename: filename, 
                base64: base64Data // 如果有轉檔，這裡會有資料；沒有則是 null
            });
        }

        const payload = {
            channel_id: message.channelId,
            attachments: processedAttachments
        };

        try {
            // 轉發給 GAS 處理
            await axios.post(GAS_WEBAPP_URL, payload);
            
            // 處理完成，把 🔄 換成 ✅
            await message.reactions.cache.get('🔄')?.remove();
            await message.react('✅'); 
        } catch (error) {
            console.error('發送給 GAS 失敗:', error.message);
            await message.reactions.cache.get('🔄')?.remove();
            await message.react('❌');
        }
    }
});

client.login(TOKEN);
