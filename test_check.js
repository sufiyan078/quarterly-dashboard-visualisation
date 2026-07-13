const { initializeApp } = require("firebase/app");
const { getAuth, signInAnonymously } = require("firebase/auth");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

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

  for (const docId of ["Dk9TpOKzbUuY8tvr1EEz", "Dk9TpOKzbUuY8tvr4EEz"]) {
    const docRef = doc(db, "reports", docId);
    console.log(`Getting document: reports/${docId}`);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      console.log(`Document reports/${docId} EXISTS!`);
      console.log(`Status: ${snap.data().status}`);
      console.log(`highestStepReached: ${snap.data().highestStepReached}`);
      console.log(`has preReportConfig: ${!!snap.data().preReportConfig}`);
    } else {
      console.log(`Document reports/${docId} DOES NOT EXIST!`);
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
