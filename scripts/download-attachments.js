#!/usr/bin/env node
/**
 * Download email attachments from Gmail using Gmail API
 * For the "Next Project" email (ID varies - we'll search for it)
 */
require('dotenv').config({ path: '/home/omhja/.openclaw/workspace/.env.waitlist' });

const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const OUT_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadAttachments() {
  // Search for the "Next Project" email
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'subject:"Next Project" from:dave@overmountainholdings.com',
    maxResults: 5,
  });

  if (!list.data.messages?.length) {
    console.log('No matching email found');
    return;
  }

  const msgId = list.data.messages[0].id;
  console.log('Found email ID:', msgId);

  const msg = await gmail.users.messages.get({ userId: 'me', id: msgId });
  const parts = msg.data.payload.parts || [];

  for (const part of parts) {
    if (!part.filename || !part.body?.attachmentId) continue;
    console.log(`Downloading: ${part.filename}`);

    const att = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: msgId,
      id: part.body.attachmentId,
    });

    // Gmail returns base64url-encoded data
    const data = att.data.data.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(data, 'base64');
    const outPath = path.join(OUT_DIR, part.filename);
    fs.writeFileSync(outPath, buf);
    console.log(`  Saved ${buf.length} bytes → ${outPath}`);
  }

  console.log('Done!');
}

downloadAttachments().catch(console.error);
