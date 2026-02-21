#!/usr/bin/env node
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const OUT_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadAttachments() {
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'subject:"Next Project" has:attachment',
    maxResults: 5,
  });

  if (!list.data.messages?.length) {
    console.log('No matching email found');
    return;
  }

  const msgId = list.data.messages[0].id;
  console.log('Found email ID:', msgId);

  const msg = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
  
  const allParts = [];
  function collectParts(parts) {
    if (!parts) return;
    for (const part of parts) {
      allParts.push(part);
      if (part.parts) collectParts(part.parts);
    }
  }
  collectParts(msg.data.payload.parts || [msg.data.payload]);

  for (const part of allParts) {
    if (!part.filename || !part.body?.attachmentId) continue;
    console.log(`Downloading: ${part.filename} (${part.mimeType})`);

    const att = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: msgId,
      id: part.body.attachmentId,
    });

    const data = att.data.data.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(data, 'base64');
    const outPath = path.join(OUT_DIR, part.filename);
    fs.writeFileSync(outPath, buf);
    console.log(`  ✓ Saved ${buf.length} bytes → ${path.basename(outPath)}`);
  }

  console.log('\nAll attachments downloaded!');
}

downloadAttachments().catch(e => { console.error('Error:', e.message); process.exit(1); });
