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
let brightnessChangeThreshold = 80; // Detect significant changes in brightness

class ImprovedLightDetector {
  constructor(context, canvas) {
    this.context = context;
    this.canvas = canvas;
    this.baselineBrightness = null;
    this.baselineSamples = [];
    this.stabilizationCount = 0;
  }

  async detectLightLevel(video, sampleCount = 10, sampleDelay = 20) {
    const brightnessSamples = [];
    
    for (let i = 0; i < sampleCount; i++) {
      this.context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imageData.data;
      
      let totalBrightness = 0;
      const pixelCount = (this.canvas.width * this.canvas.height);
      
      for (let j = 0; j < data.length; j += 4) {
        const r = data[j];
        const g = data[j + 1];
        const b = data[j + 2];
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        totalBrightness += brightness;
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      brightnessSamples.push(avgBrightness);
      
      if (i < sampleCount - 1) {
        await this.delay(sampleDelay);
      }
    }

    return this.analyzeBrightnessChange(brightnessSamples);
  }

  analyzeBrightnessChange(samples) {
    const currentAvg = samples.reduce((a, b) => a + b) / samples.length;
    const minBrightness = Math.min(...samples);
    const maxBrightness = Math.max(...samples);
    const variance = this.calculateVariance(samples);
    
    // Establish baseline if not set
    if (this.baselineBrightness === null) {
      if (variance < 5) { // Stable readings
        this.stabilizationCount++;
        if (this.stabilizationCount >= 3) {
          this.baselineBrightness = currentAvg;
          this.baselineSamples = [...samples];
          console.log('Baseline established:', this.baselineBrightness);
        }
      }
      return { status: 'calibrating', baseline: null, change: 0 };
    }

    // Calculate relative change
    const relativeChange = ((currentAvg - this.baselineBrightness) / this.baselineBrightness) * 100;
    
    // Use multiple detection criteria
    const detectionResult = {
      samples: samples,
      currentBrightness: currentAvg,
      baselineBrightness: this.baselineBrightness,
      relativeChange: relativeChange,
      absoluteChange: currentAvg - this.baselineBrightness,
      variance: variance,
      lightDetected: this.isLightDetected(relativeChange, currentAvg, variance)
    };

    return detectionResult;
  }

  isLightDetected(relativeChange, currentBrightness, variance) {
    // Multiple criteria for light detection
    const relativeThreshold = 10; // 10% increase
    const absoluteMinChange = 15; // Minimum 15 point change
    const varianceThreshold = 20; // High variance indicates rapid change
    
    return (
      relativeChange > relativeThreshold || 
      (currentBrightness - this.baselineBrightness > absoluteMinChange && variance < varianceThreshold)
    );
  }

  calculateVariance(numbers) {
    const avg = numbers.reduce((a, b) => a + b) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return squaredDiffs.reduce((a, b) => a + b) / numbers.length;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  resetBaseline() {
    this.baselineBrightness = null;
    this.stabilizationCount = 0;
  }
}

let lightDetector;

async function startLightCheck() {
  video = document.getElementById("camera");
  video.setAttribute("playsinline", true);
  video.setAttribute("autoplay", true);
  canvas = document.getElementById("lightCanvas");
  darkScreen = document.getElementById("dark-screen");
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
      
      // Initialize the improved detector
      improvedLightDetector = new ImprovedLightDetector(context, canvas);
      
      // Start enhanced light level checking
      enhancedLightCheck(video);
    };
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Unable to access the camera.");
  }
}

let improvedLightDetector;
let calibrationPhase = true;
let consecutiveDetections = 0;

async function enhancedLightCheck(video) {
  if (lockOpacity) {
    setTimeout(() => enhancedLightCheck(video), 300);
    return;
  }

  try {
    const lightResult = await improvedLightDetector.detectLightLevel(video, 8, 25);
    
    if (lightResult.status === 'calibrating') {
      document.getElementById("brightnessDisplay").textContent = 
        `Calibrage en cours... ${Math.round(lightResult.currentBrightness || 0)}`;
      setTimeout(() => enhancedLightCheck(video), 500);
      return;
    }

    const { currentBrightness, baselineBrightness, relativeChange, absoluteChange, lightDetected } = lightResult;
    
    // Enhanced display with more information
    document.getElementById("brightnessDisplay").textContent = 
      `Luminosité: ${Math.round(currentBrightness)} | Base: ${Math.round(baselineBrightness)} | Change: ${relativeChange.toFixed(1)}% (${absoluteChange.toFixed(1)})`;
    
    console.log('Enhanced Light Analysis:', {
      current: currentBrightness,
      baseline: baselineBrightness,
      relativeChange: relativeChange,
      absoluteChange: absoluteChange,
      detected: lightDetected,
      samples: lightResult.samples
    });

    if (lightDetected) {
      consecutiveDetections++;
      
      // Require multiple consecutive detections to avoid false positives
      if (consecutiveDetections >= 2) {
        darkScreen.style.opacity = 0;
        darkScreen.style.pointerEvents = "none";
        clearInterval(torchInterval);
        
        lockOpacityUntilSignificantChange(currentBrightness);
        consecutiveDetections = 0; // Reset counter
      }
    } else {
      consecutiveDetections = 0;
      
      // Check if brightness dropped significantly below baseline
      if (relativeChange < -15) { // 15% decrease from baseline
        darkScreen.style.opacity = 1;
        darkScreen.style.pointerEvents = "auto";
        
        if (!torchInterval) {
          torchInterval = setInterval(createTorchIcon, 30000);
        }
      }
    }
    
    lastBrightness = currentBrightness;
    
  } catch (error) {
    console.error('Enhanced light check failed:', error);
    // Fallback to simple brightness calculation
    const simpleBrightness = calculateBrightness(video);
    document.getElementById("brightnessDisplay").textContent = 
      `Luminosité (Simple): ${Math.round(simpleBrightness)}`;
  }

  setTimeout(() => enhancedLightCheck(video), 200);
}

// Keep original brightness calculation as fallback
function calculateBrightness(video) {
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let totalBrightness = 0;
  const pixelCount = (canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalBrightness += brightness;
  }

  return totalBrightness / pixelCount;
}

function lockOpacityUntilSignificantChange(avgBrightness) {
  lastBrightness = avgBrightness;
  lockOpacity = true;
  clearTimeout(lockTimer);
  
  lockTimer = setTimeout(() => {
    detectSignificantChange();
  }, 1000);
}

function detectSignificantChange() {
  checkBrightnessChange();
}

async function checkBrightnessChange() {
  try {
    // Use rapid sampling even during locked state for better change detection
    const lightResult = await lightDetector.detectLightLevel(video, 4, 50);
    const currentBrightness = lightResult.estimatedActualBrightness;
    
    const brightnessChange = Math.abs(currentBrightness - lastBrightness);
    
    if (brightnessChange > brightnessChangeThreshold) {
      lockOpacity = false;
      lastBrightness = currentBrightness;
      console.log('Significant brightness change detected, unlocking opacity');
    } else {
      setTimeout(checkBrightnessChange, 200);
    }
  } catch (error) {
    // Fallback to simple brightness check
    const averageBrightness = calculateBrightness(video);
    if (Math.abs(averageBrightness - lastBrightness) > brightnessChangeThreshold) {
      lockOpacity = false;
      lastBrightness = averageBrightness;
    } else {
      setTimeout(checkBrightnessChange, 200);
    }
  }
}

function createTorchIcon() {
  const torchIcon = document.createElement("div");
  torchIcon.className = "torch-icon";
  document.body.appendChild(torchIcon);

  const randomX = Math.random() * (window.innerWidth - 50);
  const randomY = Math.random() * (window.innerHeight - 50);
  torchIcon.style.position = "absolute";
  torchIcon.style.left = `${randomX}px`;
  torchIcon.style.top = `${randomY}px`;

  torchIcon.style.opacity = 1;
  setTimeout(() => {
    torchIcon.style.opacity = 0;
    setTimeout(() => {
      document.body.removeChild(torchIcon);
    }, 250);
  }, 250);
}