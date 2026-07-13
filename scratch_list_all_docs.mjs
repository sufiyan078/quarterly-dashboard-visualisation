import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAfcZU7TxYBPd2yNOpkS2hY9AZyXdZ-Uz4",
  authDomain: "inv-analytics-portal-58f8e.firebaseapp.com",
  projectId: "inv-analytics-portal-58f8e",
  storageBucket: "inv-analytics-portal-58f8e.firebasestorage.app",
  messagingSenderId: "567039984271",
  appId: "1:567039984271:web:03c2e21b357684530d66fa"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  await signInAnonymously(auth);
  const q = collection(db, "reports");
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} documents in reports collection:`);
  snap.forEach(doc => {
    console.log(`- ID: ${doc.id}`);
    console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
