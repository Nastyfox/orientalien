import {
  goBack,
  completeChallenge,
  vhToPx,
  vwToPx,
  pxToVh,
  pxToVw,
  loadChallenge,
  initSubmitAndBack,
  initHints,
  listenChallengeChanges,
} from "./utils-challenge.js";

import { getUserTeam, getOrCreateUniqueId, loadPage } from "./utils.js";

import {
  collection,
  getDoc,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

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
const db = getFirestore(app); // Ensure db is defined

let targetId; // Make targetId a global variable
let teamName;

const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

let hintIndex = 0;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);

    initSubmitAndBack();

    initHints(teamName, hintIndex);

    document
      .getElementById("startCamera")
      .addEventListener("click", startCamera); // Ensure correct ID
    document.getElementById("openCamera").addEventListener("click", openCamera);

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);

    console.log("Target ID after loading challenge:", targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

let currentUserCount = 0;

// Get the number of users in the current team from Firestore
async function getTeamUserCount(teamName) {
  const usersRef = collection(db, "users");
  const querySnapshot = await getDocs(usersRef);
  let userCount = 0;

  querySnapshot.forEach((doc) => {
    const userData = doc.data();
    if (userData.team === teamName) {
      userCount++; // Count users in the same team
    }
    if (userData.phoneId === phoneId) {
      currentUserCount = userCount;
    }
  });

  return userCount;
}

// Get overlay image URL based on user count from Firestore
async function getOverlayImageURL(userCount) {
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));

  console.log(userCount);
  console.log(currentUserCount);

  if (challengeDoc.exists()) {
    let overlayURLs = null;
    switch (userCount) {
      case 1:
        overlayURLs = challengeDoc.data().users1;
        break;
      case 2:
        overlayURLs = challengeDoc.data().users2;
        break;
      case 3:
        overlayURLs = challengeDoc.data().users3;
        break;
      case 4:
        overlayURLs = challengeDoc.data().users4;
        break;
      case 5:
        overlayURLs = challengeDoc.data().users5;
        break;
      case 6:
        overlayURLs = challengeDoc.data().users6;
        break;
    }
    if (overlayURLs && overlayURLs[currentUserCount - 1]) {
      console.log(overlayURLs);
      console.log(overlayURLs[currentUserCount - 1]);
      return overlayURLs[currentUserCount - 1]; // Return corresponding image URL
    }
  }
  return null; // Fallback if no image found
}

let currentStream = null;

async function startCamera() {
  const video = document.getElementById("camera");
  const overlay = document.getElementById("overlay");

  // Get the current team and count its members
  const teamName = await getUserTeam(db, phoneId);
  const userCount = await getTeamUserCount(teamName);

  // Display the video element when the camera starts
  video.style.display = "block"; // Make video visible
  video.setAttribute("autoplay", true); // Assure autoplay is set

  try {
    // Start the camera and wait for it to be ready
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop()); // Stop any previously running stream
    }
    currentStream = stream;
    video.srcObject = stream; // Set the video stream

    // Once the camera stream is ready, proceed to load and display the overlay
    video.onloadedmetadata = async () => {
      // Get the overlay image URL based on the team size
      const overlayImageURL = await getOverlayImageURL(userCount);

      // Display the overlay image if a valid URL is retrieved
      if (overlayImageURL) {
        // Create the draggable image
        const img = document.createElement("img");
        img.src = overlayImageURL;
        const imageHeight = 100;
        const imageHeightInPx = vhToPx(imageHeight);

        img.onload = function () {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          console.log(aspectRatio);
          const calculatedWidthInPx = imageHeightInPx * aspectRatio;
          const calculatedWidthInVw =
            (calculatedWidthInPx / window.innerWidth) * 100;

          if (calculatedWidthInPx > window.innerWidth) {
            img.style.width = `${100}vw`;
          } else {
            img.style.height = `${imageHeight}vh`;
          }
        };

        overlay.appendChild(img);
        overlay.style.display = "block"; // Show the overlay after the camera is ready
      }

      // Hide start camera button and show the open camera button
      document.getElementById("startCamera").style.display = "none";
      document.getElementById("openCamera").style.display = "inline-block";
      document
        .getElementById("close-btn")
        .addEventListener("click", closeCamera);
    };
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Unable to access the camera.");
    video.style.display = "none"; // Hide video again if there's an error
  }
}

function closeCamera() {
  document.getElementById("camera").style.display = "none"; // Hide the image container
  document.getElementById("overlay").style.display = "none"; // Hide the image container
}

function openCamera() {
  document.getElementById("camera").style.display = "block"; // Hide the image container
  document.getElementById("overlay").style.display = "block"; // Hide the image container
  document.getElementById("close-btn").addEventListener("click", closeCamera);
}

function backToMap() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop()); // Stop all active tracks
    currentStream = null; // Clear the current stream reference
  }
  goBack();
}
