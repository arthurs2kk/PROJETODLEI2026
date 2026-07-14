// ── Pro Povo — firebase.js ──
// ── Pro Povo — firebase.js ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, push, set, get, onValue, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0_N-623Sh_C4wx1J8JkU7_MhaJeZmjNI",
  authDomain: "pro--povo.firebaseapp.com",
  projectId: "pro--povo",
  storageBucket: "pro--povo.firebasestorage.app",
  messagingSenderId: "814154120529",
  appId: "1:814154120529:web:e0d5768097e74bd9e8e770",
  measurementId: "G-E2THFYQ1HH",
  databaseURL: "https://pro--povo-default-rtdb.firebaseio.com"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getDatabase(app);
const storage  = getStorage(app);
const provider = new GoogleAuthProvider();

export {
  auth, db, storage, provider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged,
  ref, push, set, get, onValue, update, runTransaction,
  sRef, uploadBytes, getDownloadURL
};