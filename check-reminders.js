// netlify/functions/check-reminders.js
//
// Runs every minute (see netlify.toml / the schedule() wrapper below).
// Reads reminders from Firestore, and for anything due "now", sends a real
// FCM push notification straight to the phone — this is what wakes the
// notification even if the screen is off or the app is fully closed.

const { schedule } = require('@netlify/functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    )
  });
}

const db = admin.firestore();

// Given a fired reminder, compute the next time it should fire if it repeats
function nextOccurrence(r) {
  const cur = new Date(r.targetUTC);
  const next = new Date(cur);

  switch (r.recurring) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next.getTime();
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next.getTime();
    case 'weekdays':
      do { next.setDate(next.getDate() + 1); } while (next.getDay() === 0 || next.getDay() === 6);
      return next.getTime();
    case 'weekends':
      do { next.setDate(next.getDate() + 1); } while (next.getDay() !== 0 && next.getDay() !== 6);
      return next.getTime();
    default:
      return null; // 'none' — doesn't repeat
  }
}

const handler = async function () {
  const now = Date.now();

  // Grab the device token — single-user app, one token doc
  const tokenDoc = await db.collection('device').doc('main').get();
  const token = tokenDoc.exists ? tokenDoc.data().fcmToken : null;

  if (!token) {
    console.log('No device token saved yet — open the app once and tap "Arm background".');
    return { statusCode: 200, body: 'no token yet' };
  }

  const snap = await db.collection('reminders').where('enabled', '==', true).get();
  if (snap.empty) return { statusCode: 200, body: 'nothing due' };

  const batch = db.batch();
  let firedCount = 0;

  for (const doc of snap.docs) {
    const r = doc.data();
    if (!r.targetUTC || r.targetUTC > now) continue;

    // Fire the push
    try {
      await admin.messaging().send({
        token,
        notification: { title: '⏰ Reminder', body: r.text },
        data: {
          id: String(r.id || doc.id),
          text: String(r.text || ''),
          date: String(r.date || ''),
          time: String(r.time || '')
        },
        android: { priority: 'high' }
      });
      firedCount++;
    } catch (err) {
      console.error('Push failed for', r.id, err.message);
      continue; // don't update state if the push itself failed
    }

    const next = nextOccurrence(r);
    if (next) {
      batch.update(doc.ref, { targetUTC: next });
    } else {
      batch.update(doc.ref, { enabled: false });
    }
  }

  await batch.commit();
  return { statusCode: 200, body: `fired ${firedCount}` };
};

exports.handler = schedule('* * * * *', handler);
