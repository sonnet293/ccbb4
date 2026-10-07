// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDpdTiZYMoItlKWUMdmHEKOk8KYrmJmGxg",
  authDomain: "ccbb-6cde8.firebaseapp.com",
  projectId: "ccbb-6cde8",
  storageBucket: "ccbb-6cde8.firebasestorage.app",
  messagingSenderId: "79365406892",
  appId: "1:79365406892:web:bf51aca56988c5f4279f09",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);