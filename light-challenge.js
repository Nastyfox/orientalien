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

// Variables pour la détection stable du torch
let torchDetectionStartTime = null;
let torchConfirmed = false;
let lastScreenState = 1; // 1 = écran noir visible, 0 = écran noir supprimé
const TORCH_CONFIRMATION_PERIOD = 1000; // 1 seconde de détection stable requises

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

function updateTorchDetectionState(torchDetected) {
  const now = Date.now();
  
  if (torchDetected) {
    // Début de détection du torch
    if (torchDetectionStartTime === null) {
      torchDetectionStartTime = now;
      console.log('🔦 Début de détection torch - Démarrage du timer de confirmation');
    }
    
    // Vérifier si on a assez attendu
    const elapsedTime = now - torchDetectionStartTime;
    if (elapsedTime >= TORCH_CONFIRMATION_PERIOD && !torchConfirmed) {
      torchConfirmed = true;
      console.log('✅ TORCH CONFIRMÉ après 1 seconde de détection stable!');
      
      // Maintenant on peut enlever l'écran noir
      darkScreen.style.opacity = 0;
      darkScreen.style.pointerEvents = "none";
      clearInterval(torchInterval);
      lastScreenState = 0;
      
      lockOpacityUntilChange();
    }
    
    return {
      status: torchConfirmed ? 'confirmed' : 'confirming',
      timeRemaining: torchConfirmed ? 0 : Math.max(0, TORCH_CONFIRMATION_PERIOD - elapsedTime),
      progress: Math.min(100, (elapsedTime / TORCH_CONFIRMATION_PERIOD) * 100)
    };
  } else {
    // Plus de détection de torch
    if (torchDetectionStartTime !== null) {
      console.log('❌ Détection torch interrompue - Reset du timer');
    }
    torchDetectionStartTime = null;
    
    // Si le torch était confirmé et qu'on ne le détecte plus, on peut restaurer l'écran
    if (torchConfirmed) {
      console.log('🔄 Torch confirmé disparu - Attendre avant de restaurer l\'écran');
      // On ne restore pas immédiatement, on attend la fonction lockOpacityUntilChange
    }
    
    return { status: 'none', timeRemaining: 0, progress: 0 };
  }
}

// Fonction pour formater toutes les informations de détection
function formatDetectionDetails(detection, analysis, torchState) {
  let details = [];
  
  // Informations de base
  details.push(`Lum: ${Math.round(analysis.avgBrightness)}`);
  details.push(`Centre: ${analysis.centerBrightRatio.toFixed(1)}%`);
  details.push(`Haut: ${analysis.topBrightRatio.toFixed(1)}%`);
  details.push(`Bords: ${analysis.edgeBrightRatio.toFixed(1)}%`);
  
  // Informations de détection
  details.push(`Type: ${detection.type}`);
  details.push(`Score Torch: ${detection.torchScore}`);
  details.push(`Score Contre-jour: ${detection.backlightScore}`);
  details.push(`Confiance: ${detection.confidence}`);
  
  // Raisons de détection
  if (detection.reasons.length > 0) {
    details.push(`Raisons: ${detection.reasons.join(', ')}`);
  }
  
  // État de confirmation du torch
  if (torchState.status === 'confirming') {
    const secondsLeft = (torchState.timeRemaining / 1000).toFixed(1);
    details.push(`🔦 Torch détecté (${secondsLeft}s) ${Math.round(torchState.progress)}%`);
  } else if (torchState.status === 'confirmed') {
    details.push('✅ TORCH CONFIRMÉ');
  }
  
  return details.join(' | ');
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
  const torchState = updateTorchDetectionState(detection.detected && detection.type === 'torch');
  
  // Affichage complet de toutes les informations
  const fullDisplayText = formatDetectionDetails(detection, analysis, torchState);
  document.getElementById("brightnessDisplay").textContent = fullDisplayText;
  
  console.log('Informations complètes:', {
    analysis: {
      avgBrightness: analysis.avgBrightness.toFixed(2),
      centerBrightRatio: analysis.centerBrightRatio.toFixed(2),
      topBrightRatio: analysis.topBrightRatio.toFixed(2),
      edgeBrightRatio: analysis.edgeBrightRatio.toFixed(2)
    },
    detection: detection,
    torchState: torchState,
    screenOpacity: darkScreen.style.opacity
  });

  // IMPORTANT: Pendant la vérification, on ne change PAS l'état de l'écran
  // L'écran ne change QUE quand le torch est confirmé (dans updateTorchDetectionState)
  // ou quand lockOpacityUntilChange détecte un changement significatif
  
  previousAnalysis = analysis;
  
  setTimeout(smartLightCheck, 100);
}

function lockOpacityUntilChange() {
  lockOpacity = true;
  
  clearTimeout(lockTimer);
  
  const checkForChange = () => {
    const newAnalysis = analyzeSpatialDistribution();
    
    if (!newAnalysis) {
      setTimeout(checkForChange, 200);
      return;
    }
    
    const newDetection = detectTorchVsBacklight(newAnalysis, previousAnalysis);
    
    // Si on ne détecte plus de torch pendant un certain temps, restaurer
    if (newDetection.type !== 'torch' || !newDetection.detected) {
      // Vérifier si ça fait assez longtemps qu'on ne détecte plus le torch
      const now = Date.now();
      if (torchDetectionStartTime === null || (now - torchDetectionStartTime) > 2000) {
        lockOpacity = false;
        torchConfirmed = false;
        torchDetectionStartTime = null;
        
        // Restaurer l'écran sombre
        darkScreen.style.opacity = 1;
        darkScreen.style.pointerEvents = "auto";
        lastScreenState = 1;
        
        if (!torchInterval) {
          torchInterval = setInterval(createTorchIcon, 30000);
        }
        
        console.log('🔄 Torch disparu - Écran noir restauré');
        return;
      }
    }
    
    setTimeout(checkForChange, 200);
  };
  
  lockTimer = setTimeout(checkForChange, 1000);
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
