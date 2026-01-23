#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const prompt = process.argv[2] || 'A 2D side-scrolling adventure game background';
const outputPath = process.argv[3] || '/home/gorkolas/www/anima/docs/art/openrouter-output.png';

const data = JSON.stringify({
  model: 'openai/gpt-5-image',
  modalities: ['image', 'text'],
  messages: [
    {
      role: 'user',
      content: prompt
    }
  ]
});

const options = {
  hostname: 'openrouter.ai',
  port: 443,
  path: '/api/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Starting request to OpenRouter...');
console.log('Prompt:', prompt);

const req = https.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response received, status:', res.statusCode);

    try {
      const response = JSON.parse(body);

      if (response.error) {
        console.error('API Error:', response.error);
        process.exit(1);
      }

      const content = response.choices?.[0]?.message?.content;

      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            const base64Match = item.image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
            if (base64Match) {
              const imageData = Buffer.from(base64Match[2], 'base64');
              fs.writeFileSync(outputPath, imageData);
              console.log('Image saved to:', outputPath);
            } else {
              console.log('Image URL:', item.image_url.url);
            }
          } else if (item.type === 'text') {
            console.log('Text:', item.text);
          }
        }
      } else if (typeof content === 'string') {
        console.log('Response:', content);
      }

      // Always log full response for debugging
      console.log('Full response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw body:', body.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end();
