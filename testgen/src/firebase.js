import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCEk3nkcDMzo9L4Qb8UtqZpDp77HCQpd1w",
  authDomain: "testgen-83c9d.firebaseapp.com",
  projectId: "testgen-83c9d",
  storageBucket: "testgen-83c9d.firebasestorage.app",
  messagingSenderId: "239262798433",
  appId: "1:239262798433:web:89cf72eb210c2614b01020"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
