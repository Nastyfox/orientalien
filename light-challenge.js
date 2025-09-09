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
const db = getFirestore(app);
let targetId;
let teamName;
let hintIndex = 0;
const phoneId = getOrCreateUniqueId();

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId);
    teamName = await getUserTeam(db, phoneId);
    initSubmitAndBack();
    hintIndex = initHints(teamName, hintIndex);
    
    startBrightnessDisplay();
    
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

let canvas, context, video;

async function startBrightnessDisplay() {
  video = document.getElementById("camera");
  video.setAttribute("playsinline", true);
  video.setAttribute("autoplay", true);
  canvas = document.getElementById("lightCanvas");
  context = canvas.getContext("2d");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    
    video.srcObject = stream;
    video.play();
    
    video.oncanplay = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context = canvas.getContext("2d");
      
      // Start continuous brightness display
      displayBrightness();
    };
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Unable to access the camera.");
  }
}

// Simple brightness calculation
function calculateBrightness() {
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let totalBrightness = 0;
  const pixelCount = canvas.width * canvas.height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalBrightness += brightness;
  }

  return totalBrightness / pixelCount;
}

// Continuous brightness display
function displayBrightness() {
  if (video && canvas && context) {
    const brightness = calculateBrightness();
    
    // Display only the brightness value
    document.getElementById("brightnessDisplay").textContent = 
      `Luminosité: ${Math.round(brightness)}`;
    
    // Log to console for debugging
    console.log(`Brightness: ${brightness.toFixed(2)}`);
  }
  
  // Continue updating every 100ms
  setTimeout(displayBrightness, 100);
}