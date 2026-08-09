// ── Pro Povo — firebase.js ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, push, set, get, onValue, update, runTransaction, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
const provider = new GoogleAuthProvider();

export {
  auth, db, provider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged,
  updateProfile, sendPasswordResetEmail, sendEmailVerification,
  ref, push, set, get, onValue, update, runTransaction,
  query, orderByChild, equalTo
};