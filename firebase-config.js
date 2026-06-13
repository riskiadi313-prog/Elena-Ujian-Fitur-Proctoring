// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyD89JD_5KO2w44JfGC3Kqucskjcun5aHL4",
  authDomain: "unnes-lms-db.firebaseapp.com",
  projectId: "unnes-lms-db",
  storageBucket: "unnes-lms-db.firebasestorage.app",
  messagingSenderId: "76854237660",
  appId: "1:76854237660:web:e2631a9a8ce6d6260c1719"
};

// Inisialisasi Firebase (menggunakan Compat SDK)
firebase.initializeApp(firebaseConfig);
const firestoreDb = firebase.firestore();

// Opsional: Mengaktifkan offline persistence agar aplikasi tetap bisa 
// diakses sebentar meski koneksi internet putus.
firestoreDb.enablePersistence().catch(function(err) {
  console.warn("Firebase persistence error:", err.code);
});
