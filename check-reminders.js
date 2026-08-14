const admin = require('firebase-admin');

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!encoded) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is missing');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')))
});

const db = admin.firestore();

function nextOccurrence(r) {
  const next = new Date(r.targetUTC);
  switch (r.recurring) {
    case 'daily': next.setDate(next.getDate() + 1); break;
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'weekdays': do next.setDate(next.getDate() + 1); while ([0, 6].includes(next.getDay())); break;
    case 'weekends': do next.setDate(next.getDate() + 1); while (![0, 6].includes(next.getDay())); break;
    default: return null;
  }
  return next.getTime();
}

async function run() {
  const tokenDoc = await db.collection('device').doc('main').get();
  const token = tokenDoc.data()?.fcmToken;
  if (!token) return console.log('No device token yet. Open the app and tap Arm background.');

  const snap = await db.collection('reminders').where('enabled', '==', true).get();
  const now = Date.now();
  let fired = 0;

  for (const doc of snap.docs) {
    const r = doc.data();
    if (!r.targetUTC || r.targetUTC > now) continue;
    await admin.messaging().send({
      token,
      notification: { title: '⏰ Reminder', body: String(r.text || 'Your reminder is due') },
      data: { id: doc.id, text: String(r.text || ''), date: String(r.date || ''), time: String(r.time || '') },
      webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: 'https://taniad2169.github.io/Reminder/' } }
    });
    const next = nextOccurrence(r);
    await doc.ref.update(next ? { targetUTC: next } : { enabled: false });
    fired++;
  }
  console.log(`Sent ${fired} reminder(s).`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
