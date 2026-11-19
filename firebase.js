import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAf89nYZMx_agGM1xbApWM3hRqeHqxN-hQ",
    authDomain: "circularseed-d0ced.firebaseapp.com",
    databaseURL: "https://circularseed-d0ced-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "circularseed-d0ced",
    storageBucket: "circularseed-d0ced.firebasestorage.app",
    messagingSenderId: "38587494359",
    appId: "1:38587494359:web:8d0fd91446c8fca7326592",
    measurementId: "G-2TW3RT1SX8"
  };

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const machineRef = ref(database, "machines/CS001");

export function subscribeToMachine(callback) {
    return onValue(machineRef, (snapshot) => {
        const data = snapshot.val();

        console.log("Firebase machine data:", data);

        if (data) {
            callback(data);
        }
    });
}