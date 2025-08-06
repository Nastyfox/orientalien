// Import the Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-storage.js";

import { getUserTeam, getOrCreateUniqueId } from "./utils.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBlBc7SqkqKbvAHHNOnnV1CurxAHkwg9-E",
  authDomain: "web-compass-df2fe.firebaseapp.com",
  projectId: "web-compass-df2fe",
  storageBucket: "web-compass-df2fe.appspot.com",
  messagingSenderId: "834740391251",
  appId: "1:834740391251:web:c862255165e426f39465a6",
  measurementId: "G-6QHSKR9SSB",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize Firestore
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

export async function loadNotes() {
  console.log("LOAD NOTES");
  try {
    if (phoneId) {
      console.log("Phone ID:", phoneId);
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phoneId", "==", phoneId));

      getDocs(q).then((querySnapshot) => {
        if (!querySnapshot.empty) {
          querySnapshot.forEach((doc) => {
            const userData = doc.data();
            console.log("Found user with phoneId:", userData);

            // Your logic here
            if (userData.phoneId === phoneId) {
              if (userData.notes != "") {
                // Get the iframe element first
                const iframe = document.getElementById("notesIframe");
                iframe.onload = function () {
                  const iframeDocument =
                    iframe.contentDocument || iframe.contentWindow.document;
                  const notesElement = iframeDocument.getElementById("notes");

                  if (notesElement) {
                    // Set up expanding functionality inside iframe
                    notesElement.style.resize = "none";
                    notesElement.style.overflow = "hidden";
                    notesElement.style.minHeight = "50px";

                    notesElement.addEventListener("input", function () {
                      this.style.height = "auto";
                      this.style.height = this.scrollHeight + "px";
                    });

                    // Set value from Firebase
                    notesElement.value = userData.notes || "";

                    // Trigger initial resize
                    notesElement.style.height = "auto";
                    notesElement.style.height =
                      notesElement.scrollHeight + "px";

                    console.log("Notes loaded:", notesElement.value);
                  }
                };
              }
            }
          });
        } else {
          console.log("No user found with that phoneId");
        }
      });
    } else {
      console.error("No phone ID found for this user.");
    }
  } catch (error) {
    console.error("Error initializing the page:", error);
  }
}

export async function saveNotes() {
  // Get the iframe element first
  const iframe = document.getElementById("notesIframe");
  const iframeDocument =
    iframe.contentDocument || iframe.contentWindow.document;
  // Now get the element from inside the iframe
  const notesValue = iframeDocument.getElementById("notes").value;

  try {
    if (phoneId) {
      console.log("Phone ID:", phoneId);
      const usersRef = collection(db, "users");
      console.log(usersRef);
      const q = query(usersRef, where("phoneId", "==", phoneId));

      getDocs(q).then(async (querySnapshot) => {
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          console.log("User data:", userData);

          // Now you can use await inside here
          try {
            // Mettre à jour le document
            await updateDoc(userDoc.ref, {
              notes: notesValue,
            });

            console.log(
              "Notes sauvegardées pour l'utilisateur avec phoneId:",
              phoneId
            );
          } catch (error) {
            console.error("Error in async operation:", error);
          }
        } else {
          console.log("No user found with that phoneId");
        }
      });
    } else {
      console.error("No phone ID found for this user.");
    }
  } catch (error) {
    console.error("Error initializing the page:", error);
  }
}
