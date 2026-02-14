// scripts/setupFirstAdmin.js
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkH9Gr8-WWXF6aw9tYplhRuUfHK46cmpY",
  authDomain: "testimonyapp-6fdf5.firebaseapp.com",
  projectId: "testimonyapp-6fdf5",
  storageBucket: "testimonyapp-6fdf5.firebasestorage.app",
  messagingSenderId: "869610360285",
  appId: "1:869610360285:web:195b3f353e8126a6a6fa34"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupFirstAdmin() {
  try {
    // Replace with your actual admin user UID
    const adminUid = "YOUR_ADMIN_USER_UID_HERE"; // Get this from Firebase Authentication
    
    if (!adminUid || adminUid === "YOUR_ADMIN_USER_UID_HERE") {
      console.error("Please replace YOUR_ADMIN_USER_UID_HERE with your actual admin user UID");
      return;
    }
    
    const adminData = {
      uid: adminUid,
      email: "admin@example.com", // Replace with actual admin email
      phone: "+232123456789", // Replace with actual admin phone
      addedAt: new Date(),
      addedBy: "system",
      role: "superadmin"
    };
    
    // Create admin document
    const adminRef = doc(db, "admins", adminUid);
    await setDoc(adminRef, adminData);
    
    console.log("✅ Admin document created successfully!");
    console.log("Admin UID:", adminUid);
    console.log("You can now access the admin dashboard.");
    
  } catch (error) {
    console.error("❌ Error setting up admin:", error);
  }
}

setupFirstAdmin();