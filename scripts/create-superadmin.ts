/**
 * CLI script to grant superadmin role custom claims to an email or UID.
 * Usage: npx tsx scripts/create-superadmin.ts <email_or_uid>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const target = process.argv[2];

if (!target) {
  console.error('Error: Please provide a user email or UID.');
  console.log('Example: npx tsx scripts/create-superadmin.ts erfanalltime@gmail.com');
  process.exit(1);
}

// Initialize Admin SDK
if (!getApps().length) {
  initializeApp();
}

const auth = getAuth();
const db = getFirestore();

async function run() {
  try {
    let user;
    if (target.includes('@')) {
      user = await auth.getUserByEmail(target);
    } else {
      user = await auth.getUser(target);
    }

    console.log(`Found user: ${user.email} (${user.uid})`);

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, {
      role: 'superadmin',
      isAdmin: true,
    });

    // Update firestore document
    await db.collection('users').doc(user.uid).set({
      isAdmin: true,
      role: 'superadmin',
      status: 'active'
    }, { merge: true });

    // Write audit log
    await db.collection('adminLogs').add({
      adminUid: 'cli-script',
      adminEmail: 'cli-admin',
      action: 'role_granted',
      targetType: 'user',
      targetId: user.uid,
      beforeValue: null,
      afterValue: { role: 'superadmin' },
      reason: 'Bootstrapping first superadmin via CLI',
      timestamp: new Date()
    });

    console.log(`Successfully granted 'superadmin' custom claim and privileges to ${user.email}!`);
  } catch (err: any) {
    console.error('Failed to grant superadmin:', err.message);
    process.exit(1);
  }
}

run();
