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
let torchInterval = null;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId);
    teamName = await getUserTeam(db, phoneId);
    initSubmitAndBack();
    hintIndex = initHints(teamName, hintIndex);
    
    canvas = document.getElementById("lightCanvas");
    darkScreen = document.getElementById("dark-screen");
    context = canvas.getContext("2d");
    
    // Set interval to create the torch icon every 30 seconds
    torchInterval = setInterval(createTorchIcon, 30000);
    
    startHistogramLightCheck();
    
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

const message = document.getElementById("message");
let currentStream = null;
let canvas, context, darkScreen, video;
let lastBrightPixelRatio = 0;
let lockOpacity = false;
let lockTimer = null;

async function startHistogramLightCheck() {
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
    /*
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });*/
    
    video.srcObject = stream;
    video.play();
    
    video.oncanplay = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context = canvas.getContext("2d");
      
      // Start histogram-based light checking
      histogramLightCheck();
    };
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Unable to access the camera.");
  }
}

// Enhanced brightness analysis with histogram
function analyzeImageHistogram() {
  if (!video || !canvas || !context) return null;
  
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Create histogram for brightness values
  const histogram = new Array(256).fill(0);
  let totalBrightness = 0;
  let totalPixels = 0;
  
  // Calculate histogram and average brightness
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    
    histogram[brightness]++;
    totalBrightness += brightness;
    totalPixels++;
  }
  
  // Analyze different brightness ranges
  const veryBrightPixels = histogram.slice(220, 256).reduce((a, b) => a + b, 0); // 220-255
  const brightPixels = histogram.slice(180, 256).reduce((a, b) => a + b, 0);     // 180-255
  const normalPixels = histogram.slice(80, 180).reduce((a, b) => a + b, 0);      // 80-179
  const darkPixels = histogram.slice(0, 80).reduce((a, b) => a + b, 0);          // 0-79
  
  // Calculate ratios
  const veryBrightRatio = (veryBrightPixels / totalPixels) * 100;
  const brightRatio = (brightPixels / totalPixels) * 100;
  const normalRatio = (normalPixels / totalPixels) * 100;
  const darkRatio = (darkPixels / totalPixels) * 100;
  
  // Find peak brightness
  const maxCount = Math.max(...histogram);
  const peakBrightness = histogram.indexOf(maxCount);
  
  // Average brightness
  const avgBrightness = totalBrightness / totalPixels;
  
  return {
    avgBrightness: avgBrightness,
    veryBrightRatio: veryBrightRatio,
    brightRatio: brightRatio,
    normalRatio: normalRatio,
    darkRatio: darkRatio,
    peakBrightness: peakBrightness,
    histogram: histogram,
    totalPixels: totalPixels
  };
}

function histogramLightCheck() {
  if (lockOpacity) {
    setTimeout(histogramLightCheck, 100);
    return;
  }

  const analysis = analyzeImageHistogram();
  
  if (!analysis) {
    setTimeout(histogramLightCheck, 100);
    return;
  }
  
  // Display comprehensive brightness information
  document.getElementById("brightnessDisplay").textContent = 
    `Lum: ${Math.round(analysis.avgBrightness)} | Brillants: ${analysis.brightRatio.toFixed(1)}% | Très brillants: ${analysis.veryBrightRatio.toFixed(1)}% | Pic: ${analysis.peakBrightness}`;
  
  console.log('Histogram Analysis:', {
    avgBrightness: analysis.avgBrightness.toFixed(2),
    veryBrightRatio: analysis.veryBrightRatio.toFixed(2),
    brightRatio: analysis.brightRatio.toFixed(2),
    peakBrightness: analysis.peakBrightness,
    darkRatio: analysis.darkRatio.toFixed(2)
  });

  // Torch detection based on histogram analysis
  const torchDetected = detectTorchFromHistogram(analysis);
  
  if (torchDetected.detected) {
    console.log('🔦 TORCH DETECTED!', torchDetected);
    
    // Remove dark screen overlay
    darkScreen.style.opacity = 0;
    darkScreen.style.pointerEvents = "none";
    clearInterval(torchInterval);
    
    // Lock the opacity until significant change
    lockOpacityUntilHistogramChange(analysis);
  } else {
    // Check if we should restore the dark screen
    const significantDecrease = 
      lastBrightPixelRatio > 0 && 
      analysis.brightRatio < lastBrightPixelRatio * 0.5; // 50% decrease
    
    if (significantDecrease) {
      darkScreen.style.opacity = 1;
      darkScreen.style.pointerEvents = "auto";
      
      if (!torchInterval) {
        torchInterval = setInterval(createTorchIcon, 30000);
      }
    }
  }
  
  lastBrightPixelRatio = analysis.brightRatio;
  
  // Continue checking
  setTimeout(histogramLightCheck, 100);
}

function detectTorchFromHistogram(analysis) {
  // Multiple criteria for torch detection
  let score = 0;
  let reasons = [];
  
  // Very bright pixels (220-255) - strong indicator
  if (analysis.veryBrightRatio > 5) {
    score += 40;
    reasons.push(`Very bright pixels: ${analysis.veryBrightRatio.toFixed(1)}%`);
  }
  
  // Bright pixels (180-255) - moderate indicator
  if (analysis.brightRatio > 15) {
    score += 25;
    reasons.push(`Bright pixels: ${analysis.brightRatio.toFixed(1)}%`);
  }
  
  // Peak brightness location
  if (analysis.peakBrightness > 200) {
    score += 20;
    reasons.push(`High peak brightness: ${analysis.peakBrightness}`);
  }
  
  // High contrast (both very bright and dark pixels)
  if (analysis.veryBrightRatio > 3 && analysis.darkRatio > 20) {
    score += 15;
    reasons.push('High contrast detected');
  }
  
  // Unusual distribution (not normal bell curve)
  if (analysis.brightRatio > 10 && analysis.normalRatio < 60) {
    score += 10;
    reasons.push('Unusual brightness distribution');
  }
  
  return {
    detected: score >= 50,
    score: score,
    reasons: reasons,
    confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low'
  };
}

function lockOpacityUntilHistogramChange(currentAnalysis) {
  lockOpacity = true;
  const referenceAnalysis = { ...currentAnalysis };
  
  clearTimeout(lockTimer);
  
  // Check for significant histogram changes
  const checkHistogramChange = () => {
    const newAnalysis = analyzeImageHistogram();
    
    if (!newAnalysis) {
      setTimeout(checkHistogramChange, 200);
      return;
    }
    
    // Calculate change in bright pixel ratio
    const brightRatioChange = Math.abs(newAnalysis.brightRatio - referenceAnalysis.brightRatio);
    const veryBrightRatioChange = Math.abs(newAnalysis.veryBrightRatio - referenceAnalysis.veryBrightRatio);
    
    // Unlock if significant change detected
    if (brightRatioChange > 10 || veryBrightRatioChange > 3) {
      lockOpacity = false;
      console.log('Histogram change detected, unlocking opacity');
    } else {
      setTimeout(checkHistogramChange, 200);
    }
  };
  
  // Start checking after 1 second
  lockTimer = setTimeout(checkHistogramChange, 1000);
}

// Simple brightness calculation (fallback)
function calculateBrightness() {
  if (!video || !canvas || !context) return 0;
  
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

// Add this function to your script
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
