require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const cron = require('node-cron');

const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
  session: sessionCfg,
  puppeteer: {
    headless: true, // Set to true for containerized environments without display
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-infobars',
      '--start-maximized'
    ]
  }
});

// Store conversation history per user
const conversationHistory = new Map();
const MAX_HISTORY = 10; // Limit to last 10 messages per user

client.on('qr', (qr) => {
  if (process.env.RAILWAY_ENVIRONMENT) {
    qrcode.toFile('qr.png', qr, (err) => {
      if (err) console.error('Error generating QR PNG:', err);
      console.log('QR Code saved to qr.png');
    });
    qrcode.toDataURL(qr, (err, url) => {
      if (err) console.error('Error generating QR URL:', err);
      console.log('QR Code URL:', url);
    });
  } else {
    qrcodeTerminal.generate(qr, { small: true });
  }
});



client.on('loading_screen', (percent, message) => {
  console.log('Loading screen:', percent, message);
});

client.on('authenticated', (session) => {
  console.log('Authenticated!');
  if (session) {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
  }
});

client.on('ready', () => {
  console.log('WhatsApp Bot is ready!');
  // Start auto chat cron job every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    if (client.info) {
      client.sendMessage(client.info.wid._serialized, 'Auto keep-alive message');
      console.log('Sent auto keep-alive message at', new Date().toISOString());
    }
  });
});

client.on('disconnected', (reason) => {
  console.log('Client was disconnected:', reason);
  // Optionally, reinitialize after a delay
  setTimeout(() => {
    console.log('Reinitializing client...');
    client.initialize();
  }, 5000);
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failure:', msg);
  // Handle auth failure, perhaps reinitialize
  setTimeout(() => {
    console.log('Reinitializing client after auth failure...');
    client.initialize();
  }, 5000);
});

client.on('message', async (msg) => {
  console.log(`Received message from ${msg.from}: ${msg.body || 'media'}`);
  // Ignore messages from the bot itself
  if (msg.from === client.info.wid._serialized) return;
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (media.mimetype.startsWith('image/')) {
        console.log('Creating sticker...');
        await client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
        console.log('Sticker sent.');
      }
    } catch (error) {
      console.error('Error creating sticker:', error);
    }
  } else {
    try {
      const userId = msg.from;
      if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
      }
      const history = conversationHistory.get(userId);

      // Add user message to history
      history.push({ role: 'user', content: msg.body });

      // Limit history
      if (history.length > MAX_HISTORY) {
        history.shift();
      }

      console.log('Sending to AI...');
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable is not set');
      }
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: history
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const reply = response.data.choices[0].message.content;
      console.log('AI response:', reply);

      // Add AI response to history
      history.push({ role: 'assistant', content: reply });

      // Limit again
      if (history.length > MAX_HISTORY) {
        history.shift();
      }

      msg.reply(reply);
    } catch (error) {
      console.error('Error with AI response:', error);
      msg.reply('Sorry, I encountered an error processing your message.');
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // If it's a ProtocolError, reinitialize
  if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
    console.log('ProtocolError detected, reinitializing client...');
    setTimeout(() => {
      client.initialize();
    }, 5000);
  }
});

// Express server for keep-alive
const app = express();
app.get("/", (req, res) => {
  console.log('Ping received at', new Date().toISOString());
  res.send("Bot aktif 🚀");
});
app.get("/status", (req, res) => {
  const status = client.info ? 'ready' : 'initializing';
  res.json({ status, uptime: process.uptime() });
});
app.listen(3000, () => console.log("Keep-alive server aktif di port 3000"));

console.log('Initializing client...');
client.initialize();
