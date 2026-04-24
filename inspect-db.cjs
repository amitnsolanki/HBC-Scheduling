const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
const fs = require('fs');

async function run() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  
  console.log("--- sessionSignups ---");
  const signups = await getDocs(query(collection(db, 'sessionSignups'), limit(5)));
  signups.forEach(doc => console.log(doc.id, doc.data()));

  console.log("\n--- users ---");
  const users = await getDocs(query(collection(db, 'users'), limit(5)));
  users.forEach(doc => console.log(doc.id, doc.data()));
}

run().catch(console.error);
