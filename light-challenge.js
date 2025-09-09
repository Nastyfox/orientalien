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
    
    torchInterval = setInterval(createTorchIcon, 30000);
    
    startSmartLightCheck();
    
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

const message = document.getElementById("message");
let currentStream = null;
let canvas, context, darkScreen, video;
let brightnessHistory = [];
let lockOpacity = false;
let lockTimer = null;

// Variables pour la détection différée du torch
let torchDetectionHistory = [];
const TORCH_CONFIRMATION_DELAY = 500; // 500ms pour confirmer qu'il s'agit bien d'un torch

async function startSmartLightCheck() {
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
      
      smartLightCheck();
    };
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Unable to access the camera.");
  }
}

// Analyse spatiale pour différencier torch vs contre-jour
function analyzeSpatialDistribution() {
  if (!video || !canvas || !context) return null;
  
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  const width = canvas.width;
  const height = canvas.height;
  
  const centerRegion = { bright: 0, total: 0 };
  const edgeRegion = { bright: 0, total: 0 };
  const topRegion = { bright: 0, total: 0 };
  
  const centerX = width / 2;
  const centerY = height / 2;
  const centerRadius = Math.min(width, height) / 4;
  
  let totalBrightness = 0;
  let brightPixels = 0;
  let veryBrightPixels = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      totalBrightness += brightness;
      
      const isBright = brightness > 180;
      const isVeryBright = brightness > 220;
      
      if (isBright) brightPixels++;
      if (isVeryBright) veryBrightPixels++;
      
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      
      if (distanceFromCenter < centerRadius) {
        centerRegion.total++;
        if (isBright) centerRegion.bright++;
      } else {
        edgeRegion.total++;
        if (isBright) edgeRegion.bright++;
      }
      
      if (y < height / 3) {
        topRegion.total++;
        if (isBright) topRegion.bright++;
      }
    }
  }
  
  const totalPixels = width * height;
  const avgBrightness = totalBrightness / totalPixels;
  const brightRatio = (brightPixels / totalPixels) * 100;
  const veryBrightRatio = (veryBrightPixels / totalPixels) * 100;
  
  const centerBrightRatio = centerRegion.total > 0 ? (centerRegion.bright / centerRegion.total) * 100 : 0;
  const edgeBrightRatio = edgeRegion.total > 0 ? (edgeRegion.bright / edgeRegion.total) * 100 : 0;
  const topBrightRatio = topRegion.total > 0 ? (topRegion.bright / topRegion.total) * 100 : 0;
  
  return {
    avgBrightness,
    brightRatio,
    veryBrightRatio,
    centerBrightRatio,
    edgeBrightRatio,
    topBrightRatio,
    timestamp: Date.now()
  };
}

function detectTorchVsBacklight(analysis, previousAnalysis) {
  if (!analysis) return { detected: false, type: 'no_data' };
  
  let torchScore = 0;
  let backlightScore = 0;
  let reasons = [];
  
  // Score TORCH
  if (analysis.centerBrightRatio > analysis.edgeBrightRatio * 1.3) {
    torchScore += 35;
    reasons.push('Luminosité concentrée au centre');
  }
  
  if (analysis.veryBrightRatio > 2 && analysis.centerBrightRatio > 15) {
    torchScore += 30;
    reasons.push('Pixels très brillants concentrés');
  }
  
  // Changement soudain
  if (previousAnalysis) {
    const brightChange = analysis.brightRatio - previousAnalysis.brightRatio;
    const centerChange = analysis.centerBrightRatio - previousAnalysis.centerBrightRatio;
    
    if (brightChange > 10 || centerChange > 12) {
      torchScore += 25;
      reasons.push('Changement soudain de luminosité');
    }
  }
  
  // Score CONTRE-JOUR
  if (analysis.topBrightRatio > analysis.centerBrightRatio * 1.2) {
    backlightScore += 30;
    reasons.push('Luminosité principalement en haut');
  }
  
  if (analysis.edgeBrightRatio > analysis.centerBrightRatio * 1.1) {
    backlightScore += 25;
    reasons.push('Luminosité sur les bords');
  }
  
  if (analysis.brightRatio > 20 && analysis.topBrightRatio > 30) {
    backlightScore += 35;
    reasons.push('Fort contre-jour détecté');
  }
  
  // Répartition uniforme = contre-jour
  const uniformity = Math.abs(analysis.centerBrightRatio - analysis.edgeBrightRatio);
  if (uniformity < 12 && analysis.brightRatio > 15) {
    backlightScore += 25;
    reasons.push('Répartition uniforme de la luminosité');
  }
  
  return {
    detected: torchScore > backlightScore && torchScore > 35,
    type: torchScore > backlightScore ? 'torch' : 'backlight',
    torchScore,
    backlightScore,
    confidence: Math.max(torchScore, backlightScore) > 50 ? 'high' : 'medium',
    reasons
  };
}

function evaluateTorchConfirmation() {
  // Vérifier les détections récentes
  const now = Date.now();
  const recentDetections = torchDetectionHistory.filter(
    detection => (now - detection.timestamp) < TORCH_CONFIRMATION_DELAY
  );
  
  if (recentDetections.length < 3) {
    return { confirmed: false, reason: 'Pas assez de détections récentes' };
  }
  
  // Vérifier que c'est bien des détections de torch (pas de contre-jour)
  const torchDetections = recentDetections.filter(d => d.type === 'torch');
  const backlightDetections = recentDetections.filter(d => d.type === 'backlight');
  
  if (backlightDetections.length > torchDetections.length) {
    return { confirmed: false, reason: 'Plus de contre-jour que de torch détecté' };
  }
  
  if (torchDetections.length >= 3) {
    return { 
      confirmed: true, 
      reason: `${torchDetections.length} détections de torch confirmées`,
      avgTorchScore: torchDetections.reduce((sum, d) => sum + d.torchScore, 0) / torchDetections.length
    };
  }
  
  return { confirmed: false, reason: 'Détection non stable' };
}

let previousAnalysis = null;

function smartLightCheck() {
  if (lockOpacity) {
    setTimeout(smartLightCheck, 100);
    return;
  }

  const analysis = analyzeSpatialDistribution();
  
  if (!analysis) {
    setTimeout(smartLightCheck, 100);
    return;
  }
  
  const detection = detectTorchVsBacklight(analysis, previousAnalysis);
  
  // Ajouter à l'historique
  torchDetectionHistory.push({
    timestamp: analysis.timestamp,
    type: detection.type,
    detected: detection.detected,
    torchScore: detection.torchScore,
    backlightScore: detection.backlightScore
  });
  
  // Garder seulement les 10 dernières détections
  if (torchDetectionHistory.length > 10) {
    torchDetectionHistory.shift();
  }
  
  // Évaluer si on a confirmation d'un torch
  const confirmation = evaluateTorchConfirmation();
  
  // Affichage
  document.getElementById("brightnessDisplay").textContent = 
    `Lum: ${Math.round(analysis.avgBrightness)} | Centre: ${analysis.centerBrightRatio.toFixed(1)}% | Haut: ${analysis.topBrightRatio.toFixed(1)}% | ${detection.type} | ${confirmation.confirmed ? '✅ TORCH CONFIRMÉ' : '⏳ Vérification...'}`;
  
  console.log('Analyse:', {
    detection: detection,
    confirmation: confirmation,
    recentHistory: torchDetectionHistory.slice(-5)
  });

  // SEULE CONDITION pour enlever l'image noire : TORCH CONFIRMÉ
  if (confirmation.confirmed) {
    console.log('🔦 TORCH CONFIRMÉ - Suppression de l\'écran noir!', confirmation);
    
    darkScreen.style.opacity = 0;
    darkScreen.style.pointerEvents = "none";
    clearInterval(torchInterval);
    
    lockOpacityUntilChange(analysis);
  }
  
  // Le contre-jour ne fait RIEN - l'image noire reste
  if (detection.type === 'backlight') {
    console.log('☀️ Contre-jour détecté - L\'écran noir reste en place');
  }
  
  previousAnalysis = analysis;
  
  setTimeout(smartLightCheck, 100);
}

function lockOpacityUntilChange(referenceAnalysis) {
  lockOpacity = true;
  
  clearTimeout(lockTimer);
  
  const checkForChange = () => {
    const newAnalysis = analyzeSpatialDistribution();
    
    if (!newAnalysis) {
      setTimeout(checkForChange, 200);
      return;
    }
    
    // Vérifier si la luminosité centrale a diminué significativement
    const centerChange = referenceAnalysis.centerBrightRatio - newAnalysis.centerBrightRatio;
    const overallChange = referenceAnalysis.brightRatio - newAnalysis.brightRatio;
    
    if (centerChange > 10 || overallChange > 8) {
      lockOpacity = false;
      
      // Réinitialiser l'historique des détections
      torchDetectionHistory = [];
      
      // Restaurer l'écran sombre
      darkScreen.style.opacity = 1;
      darkScreen.style.pointerEvents = "auto";
      
      if (!torchInterval) {
        torchInterval = setInterval(createTorchIcon, 30000);
      }
      
      console.log('Changement significatif détecté, déverrouillage');
    } else {
      setTimeout(checkForChange, 200);
    }
  };
  
  lockTimer = setTimeout(checkForChange, 500);
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
