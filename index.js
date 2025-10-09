const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');

const SESSION_FILE_PATH = './session.json';

let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
  session: sessionCfg,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't work in Windows
      '--disable-gpu'
    ]
  }
});

// Store conversation history per user
const conversationHistory = new Map();
const MAX_HISTORY = 10; // Limit to last 10 messages per user

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', (session) => {
  console.log('Authenticated!');
  sessionCfg = session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
    if (err) console.error(err);
  });
});

client.on('ready', () => {
  console.log('WhatsApp Bot is ready!');
});

client.on('message', async (msg) => {
  console.log(`Received message from ${msg.from}: ${msg.body || 'media'}`);
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
      const apiKey = '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';
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

client.initialize();
