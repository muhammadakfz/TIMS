import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBnJ7-DLE3aPr_mUDiQFdbqHZGTlpYBiEI",
  authDomain: "esp32-tims.firebaseapp.com",
  databaseURL: "https://esp32-tims-default-rtdb.firebaseio.com",
  projectId: "esp32-tims",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);