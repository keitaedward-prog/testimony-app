import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCkH9Gr8-WWXF6aw9tYplhRuUfHK46cmpY",
  authDomain: "testimonyapp-6fdf5.firebaseapp.com",
  projectId: "testimonyapp-6fdf5",
  storageBucket: "testimonyapp-test-bucket",
  messagingSenderId: "869610360285",
  appId: "1:869610360285:web:195b3f353e8126a6a6fa34"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;