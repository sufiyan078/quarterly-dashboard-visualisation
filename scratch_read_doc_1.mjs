import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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
  console.log("Signing in anonymously...");
  await signInAnonymously(auth);
  console.log("Signed in successfully!");

  const docId = "Dk9TpOKzbUuY8tvr1EEz";
  const docRef = doc(db, "reports", docId);
  console.log(`Getting document: reports/${docId}`);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    console.log("Document EXISTS!");
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log("Document DOES NOT EXIST!");
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
