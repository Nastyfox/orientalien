import {
  goBack,
  completeChallenge,
  loadChallenge,
  initHints,
  initSubmitAndBack,
  listenChallengeChanges,
} from "./utils-challenge.js";

import {
  collection,
  getDoc,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import { getUserTeam, getOrCreateUniqueId, loadPage, isIOS } from "./utils.js";

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
let hintIndex = 0;

const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

let torchInterval = null;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);

    initSubmitAndBack();

    hintIndex = initHints(teamName, hintIndex);

    canvas = document.getElementById("lightCanvas");
    darkScreen = document.getElementById("dark-screen");
    context = canvas.getContext("2d");

    // Set interval to create the torch icon every 10 seconds
    torchInterval = setInterval(createTorchIcon, 30000);
    const startCameraButton = document.getElementById("startCamera");
    startLightCheck();

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

const message = document.getElementById("message");
let currentStream = null;
let canvas,
  context,
  darkScreen,
  video,
  lastBrightness = 0;
let lockOpacity = false; // To lock the opacity when a flashlight is detected
let lockTimer = null; // Timer to reset the lock after a period
let brightnessChangeThreshold = 150; // Detect significant changes in brightness

async function startLightCheck() {
  const video = document.getElementById("camera");
  video.setAttribute("playsinline", true);
  video.setAttribute("autoplay", true);
  canvas = document.getElementById("lightCanvas");
  darkScreen = document.getElementById("dark-screen");
  context = canvas.getContext("2d");

  // Request access to the camera without displaying video
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    }); /*
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });*/
    video.srcObject = stream;
    video.play();

    video.oncanplay = () => {
      // Set canvas size to match video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context = canvas.getContext("2d");

      // Start checking light levels periodically
      checkLightLevel(video);
    };
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Unable to access the camera.");
  }
}

// Function to calculate brightness of the video frame
function calculateBrightness(video) {
  // Draw the current video frame to the canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let totalBrightness = 0;
  const pixelCount = (canvas.width * canvas.height) / 4;

  // Calculate the total brightness of the image
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Brightness formula
    totalBrightness += brightness;
  }

  // Calculate the average brightness of the frame
  return totalBrightness / pixelCount;
}

function checkLightLevel(video) {
  if (lockOpacity) {
    // If the opacity is locked, do not update it and skip checking the brightness
    setTimeout(() => checkLightLevel(video), 100);
    return;
  }

  const averageBrightness = calculateBrightness(video); // Use the brightness function

  // Define brightness threshold to detect a flashlight
  const brightnessThreshold = 800; // Adjust this threshold based on your needs

  document.getElementById(
    "brightnessDisplay"
  ).textContent = `Luminosité : ${Math.round(averageBrightness)}`;
  console.log(averageBrightness);

  // Check if the brightness exceeds the threshold
  if (averageBrightness > brightnessThreshold) {
    // If brightness is significantly higher, lock the opacity
    darkScreen.style.opacity = 0;
    darkScreen.style.pointerEvents = "none";

    clearInterval(torchInterval);

    // Lock the opacity and monitor for significant brightness changes
    lockOpacityUntilSignificantChange(averageBrightness);
  } else if (
    averageBrightness < lastBrightness - brightnessChangeThreshold ||
    averageBrightness > lastBrightness + brightnessChangeThreshold
  ) {
    // If brightness has dropped significantly, we may want to restore opacity
    darkScreen.style.opacity = 1;
    darkScreen.style.pointerEvents = "auto";
  }

  // Repeat the check after a short delay
  setTimeout(() => checkLightLevel(video), 100);
}

function lockOpacityUntilSignificantChange(avgBrightness) {
  // Store the last brightness value for comparison
  lastBrightness = avgBrightness;
  // Lock the opacity and start checking for significant brightness changes
  lockOpacity = true;
  clearTimeout(lockTimer); // Clear any existing timer

  lockTimer = setTimeout(() => {
    // After the lock period, keep the opacity locked until a significant brightness change is detected
    detectSignificantChange();
  }, 1000); // Lock the opacity for 3 seconds
}

function detectSignificantChange() {
  checkBrightnessChange();
}

function checkBrightnessChange() {
  const detectionInterval = 100; // Check brightness every 100ms

  const averageBrightness = calculateBrightness(video); // Use the brightness function

  // If the brightness change exceeds the threshold, unlock the opacity
  if (
    Math.abs(averageBrightness - lastBrightness) > brightnessChangeThreshold
  ) {
    lockOpacity = false; // Unlock opacity
    lastBrightness = averageBrightness; // Update last known brightness
  } else {
    // Continue checking for significant changes
    setTimeout(checkBrightnessChange, detectionInterval);
  }
}

// Add this function to your script
function createTorchIcon() {
  // Create a new div element for the torch icon
  const torchIcon = document.createElement("div");
  torchIcon.className = "torch-icon"; // Assign a class for styling
  document.body.appendChild(torchIcon); // Add it to the body

  // Randomize position
  const randomX = Math.random() * (window.innerWidth - 50); // 50 is the width of the icon
  const randomY = Math.random() * (window.innerHeight - 50); // 50 is the height of the icon
  torchIcon.style.position = "absolute";
  torchIcon.style.left = `${randomX}px`;
  torchIcon.style.top = `${randomY}px`;

  // Fade in and out
  torchIcon.style.opacity = 1; // Start fully visible
  setTimeout(() => {
    torchIcon.style.opacity = 0; // Fade out after 0.5 seconds
    setTimeout(() => {
      document.body.removeChild(torchIcon); // Remove the icon from the DOM
    }, 250); // Wait for fade out to finish before removing
  }, 250); // Keep visible for 0.5 seconds
}
