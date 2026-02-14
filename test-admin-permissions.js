// Quick test to check admin permissions
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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

async function testAdminPermissions() {
  const adminUid = "sdiHndA1JcaRvWC7SslcsLT84lb2";
  
  console.log("🧪 Testing Admin Permissions");
  console.log("Admin UID:", adminUid);
  
  try {
    // 1. Check if admin document exists
    const adminDoc = await getDoc(doc(db, "admins", adminUid));
    console.log("✅ Admin document exists:", adminDoc.exists());
    
    if (adminDoc.exists()) {
      console.log("📋 Admin data:", adminDoc.data());
    } else {
      console.log("❌ Admin document not found!");
      console.log("Please create an admin document in Firestore:");
      console.log("Collection: admins");
      console.log("Document ID:", adminUid);
      console.log("Data:", {
        uid: adminUid,
        email: "admin@example.com",
        phone: "+232123456789",
        firstName: "Admin",
        lastName: "User",
        addedAt: new Date(),
        addedBy: "system",
        role: "superadmin"
      });
    }
    
    // 2. Try to create a test user
    const testUserData = {
      uid: "test-user-" + Date.now(),
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phone: "+232987654321",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminUid,
      userType: "user"
    };
    
    console.log("\n🧪 Testing user creation...");
    console.log("Test user data:", testUserData);
    
    // Note: This will fail without proper authentication
    // This is just to test the structure
    
  } catch (error) {
    console.error("❌ Test error:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
  }
}

testAdminPermissions();