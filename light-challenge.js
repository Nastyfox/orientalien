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

// Enhanced brightness analysis with histogram
function analyzeImageHistogram(context, canvas, video) {
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Create histogram
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    histogram[brightness]++;
    totalPixels++;
  }
  
  // Analyze histogram characteristics
  const brightPixels = histogram.slice(200, 256).reduce((a, b) => a + b, 0);
  const brightRatio = (brightPixels / totalPixels) * 100;
  
  // Find peak brightness
  const maxCount = Math.max(...histogram);
  const peakBrightness = histogram.indexOf(maxCount);
  
  const avgBrightness = data.reduce((sum, val, i) => {
    if (i % 4 === 3) return sum; // Skip alpha
    return sum + val;
  }, 0) / (data.length * 3 / 4);
  
  return {
    avgBrightness: avgBrightness,
    brightPixelRatio: brightRatio,
    peakBrightness: peakBrightness,
    histogram: histogram
  };
}

function displayAdvancedBrightness() {
  if (video && canvas && context) {
    const analysis = analyzeImageHistogram(context, canvas, video);
    
    document.getElementById("brightnessDisplay").textContent = 
      `Luminosité: ${Math.round(analysis.avgBrightness)} | Pixels brillants: ${analysis.brightPixelRatio.toFixed(1)}% | Pic: ${analysis.peakBrightness}`;
    
    console.log('Full analysis:', analysis);
    
    // A torch will create high bright pixel ratio even with auto-exposure
    if (analysis.brightPixelRatio > 15) {
      console.log('Possible torch detected - high bright pixel ratio');
    }
  }
  
  setTimeout(displayAdvancedBrightness, 100);
}
