
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// keep your credentials 
const firebaseConfig = {
  apiKey: "AIzaSyAeV28Q3C0b4aLzrSHosK9VmEc09OtFULs",
  authDomain: "twiller-b3309.firebaseapp.com",
  projectId: "twiller-b3309",
  storageBucket: "twiller-b3309.firebasestorage.app",
  messagingSenderId: "457143345315",
  appId: "1:457143345315:web:afcec2fbba453c97a85f16",
  measurementId: "G-9Z6KWLMS1Q"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
