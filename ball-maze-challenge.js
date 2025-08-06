import {
  goBack,
  completeChallenge,
  vhToPx,
  vwToPx,
  pxToVh,
  pxToVw,
  loadChallenge,
  getTeamInfos,
  updateTeamArray,
  initHints,
  initSubmitAndBack,
  listenChallengeChanges,
} from "./utils-challenge.js";

import {
  initCombinationLock,
  getCombination,
  getEnterButton,
  codeCheck,
} from "./combination-lock.js";

import { getUserTeam, getOrCreateUniqueId, loadPage } from "./utils.js";

import {
  collection,
  getDoc,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  getDocs,
  onSnapshot,
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

const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

let teamName = null;

let canvas,
  ctx,
  ball = null;

let sensitivity = 5000;

let hintIndex = 0;

let exitCodeElement = null;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId, "code"); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);
    initSubmitAndBack(false, true);

    hintIndex = initHints(teamName, hintIndex);

    canvas = document.getElementById("maze");
    ctx = canvas.getContext("2d");

    exitCodeElement = document.getElementById("exitCode");

    // N'oubliez pas d'initialiser les tableaux de collision au démarrage
    initCollisionArrays();

    await getInfosForGame();
    await loadGameData();
    const gateChangesListener = listenToGateChanges();
    const ballUpdatesListener = listenForBallUpdates(); // Start listening for ball updates
    drawMaze(false, true);
    gameLoop();

    const ballMovementListener = startEventListenerBallMovement();

    initCombinationLock();

    getEnterButton().addEventListener("click", checkCombination);

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);

    console.log("Target ID after loading challenge:", targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

let walls = [];

let gates = [];

let exits = [];

let allGates = [];

// Load SVGs
let wallImages = [];
let horizontalDoorImages = [];
let verticalDoorImages = [];
let normalExitImage = null;
let exitImages = [];

let drawWidth = null;
let drawHeight = null;

let numTilesWidth;
let numTilesHeight;

let wallsStartX = [];
let wallsStartY = [];
let wallsWidths = [];
let wallsHeights = [];

let gatesStartX = [];
let gatesStartY = [];
let gatesWidths = [];
let gatesHeights = [];

let exitsStartX = [];
let exitsStartY = [];
let exitsWidth = null;
let exitsHeight = null;

const horizontalColorMapDoors = {
  2605: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_bleu_horizontal.png?v=1743191826120",
  5605: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_bordeaux_horizontal.png?v=1743191831540",
  2005: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_dore_horizontal.png?v=1743191835640",
  5026: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_rose_horizontal.png?v=1743191840490",
  5050: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_turquoise_horizontal.png?v=1743191844596",
  6226: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_vert_horizontal.png?v=1743191848616",
};

const verticalColorMapDoors = {
  2605: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_bleu_vertical.png?v=1743191829404",
  5605: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_bordeaux_vertical.png?v=1743191833726",
  2005: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_dore_vertical.png?v=1743191837553",
  5026: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_rose_vertical.png?v=1743191842592",
  5050: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_turquoise_vertical.png?v=1743191846657",
  6226: "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/door_vert_vertical.png?v=1743191850315",
};

const colorMapExits = {
  "30D5C8":
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit_turquoise.png?v=1742418198504",
  E64C93:
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit_rose.png?v=1742418195074",
  "105DC2":
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit_bleu.png?v=1742418190815",
  D6940F:
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit_dore.png?v=1742418193600",
  AD1D3F:
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit_bordeaux.png?v=1742418191885",
  "14CC6A":
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit_vert.png?v=1742418199731",
  "000000":
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit.png?v=1740506128436",
};

let referenceCanvasWidth;

async function drawMaze(coloredExits = false) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let wallCount = 0;

  // Draw walls
  walls.forEach((wall) => {
    let wallImage;
    if (wall.horizontal) {
      wallImage = wallImages[0];
    } else {
      wallImage = wallImages[1];
    }

    drawWidth = wallImage.naturalWidth;
    drawHeight = wallImage.naturalHeight;

    const wallWidth = wall.x[1] - wall.x[0];
    const wallHeight = wall.y[1] - wall.y[0];
    const width = wallWidth * canvas.width;
    const height = wallHeight * canvas.height;
    const aspectRatio = wallImage.width / wallImages[1].height;

    const numRepeatsX = width === 0 ? 1 : Math.ceil(width / drawWidth);
    const numRepeatsY = height === 0 ? 1 : Math.ceil(height / drawHeight);

    if (wallsWidths.length < walls.length) {
      wallsWidths.push(numRepeatsX * drawWidth);
      wallsHeights.push(numRepeatsY * drawHeight);
    }

    const startX =
      wall.x[0] === 0
        ? 0
        : wall.x[0] === 1
        ? canvas.width - drawWidth
        : wall.x[0] * canvas.width;
    wallsStartX.push(startX);
    const startY =
      wall.y[0] === 0
        ? 0
        : wall.y[0] === 1
        ? canvas.height - drawHeight
        : wall.y[0] * canvas.height;
    wallsStartY.push(startY);

    for (let i = 0; i < numRepeatsX; i++) {
      for (let j = 0; j < numRepeatsY; j++) {
        ctx.drawImage(
          wallImage,
          startX + i * drawWidth,
          startY + j * drawHeight,
          drawWidth,
          drawHeight
        );
      }
    }
  });

  let i = 0;

  const scaleFactorWidth = canvas.width / referenceCanvasWidth;
  const scaleFactorHeight = canvas.height / referenceCanvasWidth;

  // Draw gates
  gates.forEach((gate) => {
    let doorImage;
    if (gate.horizontal) {
      doorImage = horizontalDoorImages[i];
    } else {
      doorImage = verticalDoorImages[i];
    }

    let doorWidth;
    let doorHeight;

    if (doorImage != null) {
      doorWidth = doorImage.naturalWidth * 2 * scaleFactorWidth;
      doorHeight = doorImage.naturalHeight * 2 * scaleFactorHeight;

      if (gatesWidths.length < gates.length) {
        gatesWidths.push(doorWidth);
        gatesHeights.push(doorHeight);
      }

      const startX =
        gate.x === 0
          ? 0
          : gate.x === 1
          ? canvas.width - doorWidth
          : gate.x * canvas.width;
      gatesStartX.push(startX);
      const startY =
        gate.y === 0
          ? 0
          : gate.y === 1
          ? canvas.height - doorHeight
          : gate.y * canvas.height;
      gatesStartY.push(startY);
      //ctx.clearRect(startX, startY, doorWidth, doorHeight);

      if (!gate.open) {
        ctx.drawImage(doorImage, startX, startY, doorWidth, doorHeight);
      }
      i++;
    }
  });

  exitsWidth = normalExitImage.naturalWidth * scaleFactorWidth;
  exitsHeight = normalExitImage.naturalHeight * scaleFactorHeight;

  i = 0;

  // Draw exits
  exits.forEach((exit) => {
    const startX =
      exit.x === 0
        ? 0
        : exit.x === 1
        ? canvas.width - exitsWidth
        : exit.x * canvas.width;
    exitsStartX.push(startX);
    const startY =
      exit.y === 0
        ? 0
        : exit.y === 1
        ? canvas.height - exitsHeight
        : exit.y * canvas.height;
    exitsStartY.push(startY);
    //ctx.clearRect(startX, startY, exitsWidth, exitsHeight);

    if (!coloredExits) {
      ctx.drawImage(normalExitImage, startX, startY, exitsWidth, exitsHeight);
    } else if (exitImages[i] != null) {
      ctx.drawImage(exitImages[i], startX, startY, exitsWidth, exitsHeight);
      i++;
    }
  });

  // Draw ball
  if (ball) {
    ctx.beginPath();
    ctx.arc(
      ball.x * canvas.width,
      ball.y * canvas.height,
      ball.radius * canvas.width,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "blue";
    ctx.fill();
    ctx.closePath();
  }
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = url;
  });
}

// Configuration des collisions
let wallsCollisions = [];
let gatesCollisions = [];

// Initialisation des tableaux de collision
function initCollisionArrays() {
  // Réinitialiser les tableaux de collision
  wallsCollisions = walls.map(() => ({ collisionX: false, collisionY: false }));
  gatesCollisions = gates.map(() => ({ collisionX: false, collisionY: false }));
}

// Fonction pour détecter une collision entre la balle et un rectangle
function detectCollision(ball, rect) {
  // Convertir les coordonnées normalisées en pixels
  const ballX = ball.x * canvas.width;
  const ballY = ball.y * canvas.height;
  const ballRadius = ball.radius * canvas.width;

  // Calculer le point le plus proche du rectangle par rapport au centre de la balle
  const closestX = Math.max(rect.x, Math.min(ballX, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(ballY, rect.y + rect.height));

  // Calculer la distance entre le centre de la balle et le point le plus proche
  const distanceX = ballX - closestX;
  const distanceY = ballY - closestY;
  const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

  // Il y a collision si la distance est inférieure au rayon de la balle
  return {
    collision: distance < ballRadius,
    distanceX: distanceX,
    distanceY: distanceY,
    distance: distance,
  };
}

// Fonction pour mettre à jour la position de la balle en traitant les axes séparément
function updateBallPosition() {
  // Sauvegarder la position actuelle
  const prevBall = {
    x: ball.x,
    y: ball.y,
    speedX: ball.speedX,
    speedY: ball.speedY,
    radius: ball.radius,
  };

  // Étape 1: Mettre à jour la position X et vérifier les collisions
  let nextBallX = {
    x: ball.x + ball.speedX,
    y: ball.y,
    radius: ball.radius,
  };

  // Vérifier les collisions sur l'axe X
  let collisionDetectedX = false;

  // Vérifier les murs (axe X)
  for (let i = 0; i < walls.length; i++) {
    const wallRect = {
      x: wallsStartX[i],
      y: wallsStartY[i],
      width: wallsWidths[i],
      height: wallsHeights[i],
    };

    const collision = detectCollision(nextBallX, wallRect);

    if (collision.collision) {
      // Collision avec un mur - réinitialiser la position de la balle
      resetBallPos();
      return;
    }
  }

  // Vérifier les portes fermées (axe X)
  if (!collisionDetectedX) {
    for (let i = 0; i < gates.length; i++) {
      if (!gates[i].open) {
        const gateRect = {
          x: gatesStartX[i],
          y: gatesStartY[i],
          width: gatesWidths[i],
          height: gatesHeights[i],
        };

        const collision = detectCollision(nextBallX, gateRect);

        if (collision.collision) {
          // Résoudre la collision sur l'axe X
          if (ball.speedX > 0) {
            // Collision à droite
            nextBallX.x =
              (gateRect.x - ball.radius * canvas.width) / canvas.width;
          } else {
            // Collision à gauche
            nextBallX.x =
              (gateRect.x + gateRect.width + ball.radius * canvas.width) /
              canvas.width;
          }
          ball.speedX = 0;
          collisionDetectedX = true;
          break;
        }
      }
    }
  }

  // Mettre à jour la position X si aucune collision n'est détectée
  if (!collisionDetectedX) {
    ball.x = nextBallX.x;
  }

  // Étape 2: Mettre à jour la position Y et vérifier les collisions
  let nextBallY = {
    x: ball.x,
    y: ball.y + ball.speedY,
    radius: ball.radius,
  };

  // Vérifier les collisions sur l'axe Y
  let collisionDetectedY = false;

  // Vérifier les murs (axe Y)
  for (let i = 0; i < walls.length; i++) {
    const wallRect = {
      x: wallsStartX[i],
      y: wallsStartY[i],
      width: wallsWidths[i],
      height: wallsHeights[i],
    };

    const collision = detectCollision(nextBallY, wallRect);

    if (collision.collision) {
      // Collision avec un mur - réinitialiser la position de la balle
      resetBallPos();
      return;
    }
  }

  // Vérifier les portes fermées (axe Y)
  if (!collisionDetectedY) {
    for (let i = 0; i < gates.length; i++) {
      if (!gates[i].open) {
        const gateRect = {
          x: gatesStartX[i],
          y: gatesStartY[i],
          width: gatesWidths[i],
          height: gatesHeights[i],
        };

        const collision = detectCollision(nextBallY, gateRect);

        if (collision.collision) {
          // Résoudre la collision sur l'axe Y
          if (ball.speedY > 0) {
            // Collision en bas
            nextBallY.y =
              (gateRect.y - ball.radius * canvas.height) / canvas.height;
          } else {
            // Collision en haut
            nextBallY.y =
              (gateRect.y + gateRect.height + ball.radius * canvas.height) /
              canvas.height;
          }
          ball.speedY = 0;
          collisionDetectedY = true;
          break;
        }
      }
    }
  }

  // Mettre à jour la position Y si aucune collision n'est détectée
  if (!collisionDetectedY) {
    ball.y = nextBallY.y;
  }

  // Vérifier les sorties après avoir mis à jour la position
  for (let i = 0; i < exits.length; i++) {
    const exitRect = {
      x: exitsStartX[i],
      y: exitsStartY[i],
      width: exitsWidth,
      height: exitsHeight,
    };

    if (detectCollision(ball, exitRect).collision) {
      if (handleBallExit(exits[i])) {
        resetBallPos();
        return;
      }
    }
  }

  // S'assurer que la balle reste dans les limites du canvas
  ball.x = Math.max(ball.radius, Math.min(ball.x, 1 - ball.radius));
  ball.y = Math.max(ball.radius, Math.min(ball.y, 1 - ball.radius));
}

function handleBallExit(exit) {
  console.log("Ball exited through:", exit);

  if (exit.correct) {
    newUserBall(currentUserCount);
  } else {
    return true;
  }
}

function listenForBallUpdates() {
  const challengeDoc = doc(db, "challenges", targetId);

  onSnapshot(challengeDoc, (docSnapshot) => {
    const teamDataChallenge = docSnapshot.data()?.[teamName];

    if (teamDataChallenge[0].lastExit) {
      endGame();
    } else if (teamDataChallenge[0].phoneId == phoneId && !ball) {
      resetBallPos();
      startEventListenerBallMovement();
      gameLoop();
    } else if (!ball) {
      ball = null;
    }
  });
}

// Main game loop
function gameLoop() {
  if (ball) {
    drawMaze();
    updateBallPosition();
    requestAnimationFrame(gameLoop);
  }
}

async function toggleGates(openedGatesIndices, closedGatesIndices) {
  const challengeDoc = doc(db, "challenges", targetId); // Use the targetId from challenge
  const challengeSnapshot = await getDoc(challengeDoc);

  // Get the existing team data
  const teamDataChallenge = challengeSnapshot.data()?.[teamName];

  if (!teamDataChallenge || !teamDataChallenge[1].gates) {
    console.error("Gates data not found for the team");
    return;
  }

  // Toggle the gate states for the specified indices
  openedGatesIndices.forEach((gateIndex) => {
    if (teamDataChallenge[1].gates[gateIndex]) {
      teamDataChallenge[1].gates[gateIndex].open = true;
    } else {
      console.warn(`Gate at index ${gateIndex} does not exist.`);
    }
  });

  // Toggle the gate states for the specified indices
  closedGatesIndices.forEach((gateIndex) => {
    if (teamDataChallenge[1].gates[gateIndex]) {
      teamDataChallenge[1].gates[gateIndex].open = false;
    } else {
      console.warn(`Gate at index ${gateIndex} does not exist.`);
    }
  });

  // Update Firebase with the new gate states
  await updateDoc(challengeDoc, { [teamName]: teamDataChallenge });
}

function listenToGateChanges() {
  const challengeDoc = doc(db, "challenges", targetId);

  onSnapshot(challengeDoc, (docSnapshot) => {
    const teamDataChallenge = docSnapshot.data()?.[teamName];
    allGates = teamDataChallenge[1]?.gates;
    const gatesData =
      teamDataChallenge[1]?.gates.filter((gate) => gate.phoneId === phoneId) ||
      [];

    // Sync local gates with Firebase data for the current phoneId gates only
    gates.forEach((gate, index) => {
      gate.open = gatesData[index]?.open; // Update local gate state
    });

    drawMaze(); // Re-render maze when gate states change
  });
}

let initBall = null;

async function loadGameData() {
  const challengeDoc = doc(db, "challenges", targetId); // Use the targetId from the challenge
  const challengeSnapshot = await getDoc(challengeDoc);

  const teamDataChallenge = challengeSnapshot.data()?.[teamName];

  let teamMazeData = null;

  switch (userCount) {
    case 1:
      teamMazeData = challengeSnapshot.data().users2;
      break;
    case 2:
      teamMazeData = challengeSnapshot.data().users2;
      break;
    case 3:
      teamMazeData = challengeSnapshot.data().users3;
      break;
    case 4:
      teamMazeData = challengeSnapshot.data().users4;
      break;
    case 5:
      teamMazeData = challengeSnapshot.data().users5;
      break;
    case 6:
      teamMazeData = challengeSnapshot.data().users6;
      break;
  }

  let mazeData = null;

  switch (currentUserCount) {
    case 1:
      mazeData = teamMazeData.user1.maze;
      break;
    case 2:
      mazeData = teamMazeData.user2.maze;
      break;
    case 3:
      mazeData = teamMazeData.user3.maze;
      break;
    case 4:
      mazeData = teamMazeData.user4.maze;
      break;
    case 5:
      mazeData = teamMazeData.user5.maze;
      break;
    case 6:
      mazeData = teamMazeData.user6.maze;
      break;
  }

  walls = mazeData.walls;
  exits = mazeData.exits;
  gates = mazeData.gates;
  numTilesWidth = mazeData.size[0].x;
  numTilesHeight = mazeData.size[0].y;
  initBall = mazeData.ball;
  resizeBasedNumTiles();

  canvas.width = numTilesWidth * wallImages[0].naturalWidth;
  canvas.height = numTilesHeight * wallImages[1].naturalHeight;

  for (const gate of gates) {
    gate.phoneId = phoneId;
    horizontalDoorImages.push(
      await loadImage(horizontalColorMapDoors[gate.code])
    );
    verticalDoorImages.push(await loadImage(verticalColorMapDoors[gate.code]));
  }

  exits.forEach(async (exit) => {
    exitImages.push(await loadImage(colorMapExits[exit.color]));
  });

  if (!teamDataChallenge) {
    // Save default gates to Firebase
    await updateDoc(challengeDoc, { [teamName]: { gates: gates } });
  } else if (!teamDataChallenge[1]) {
    // Récupérer les gates existantes s'il y en a
    const existingGates = teamDataChallenge[1]?.gates || [];
    const notUserGates = existingGates.filter(
      (gate) => gate.phoneId != phoneId
    );
    // Fusionner les gates existantes avec les nouvelles gates de l'utilisateur
    const updatedGates = [...notUserGates, ...gates];

    let array = { gates: updatedGates };
    await updateTeamArray(teamName, array, 1);
  } else {
    // Récupérer les gates existantes s'il y en a
    const existingGates = teamDataChallenge[1]?.gates || [];
    const userGates = existingGates.filter((gate) => gate.phoneId === phoneId);

    if (userGates.length <= 0) {
      // Fusionner les gates existantes avec les nouvelles gates de l'utilisateur
      const updatedGates = [...existingGates, ...gates];
      let array = { gates: updatedGates };
      await updateTeamArray(teamName, array, 1);
    } else {
      gates = userGates;
    }
  }

  // Sync local gates with default data
  gates.forEach((gate, index) => {
    Object.assign(gate, gates[index]);
  });

  if (teamDataChallenge[0].lastExit) {
    endGame();
  } else if (teamDataChallenge[0].phoneId == phoneId) {
    resetBallPos();
  } else {
    ball = null;
  }
}

let currentUserCount = 0;
let userCount = 0;
let listUsers = [];
let currentUser = 0;

async function getInfosForGame() {
  const teamData = await getTeamInfos(teamName);
  userCount = teamData[0];
  currentUserCount = teamData[1];
  listUsers = teamData[2];

  const challengeDoc = doc(db, "challenges", targetId); // Use the targetId from challenge
  const challengeSnapshot = await getDoc(challengeDoc);

  // Get the existing team data
  const teamDataChallenge = challengeSnapshot.data()?.[teamName];

  if (!teamDataChallenge || !teamDataChallenge[0]) {
    let array = { phoneId: listUsers[currentUser].phoneId };

    await updateTeamArray(listUsers[currentUser].team, array, 0);
  }

  // Load SVGs
  wallImages.push(
    await loadImage(
      "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/wall_horizontal.png?v=1743241568950"
    )
  );
  wallImages.push(
    await loadImage(
      "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/wall_vertical.png?v=1743241571341"
    )
  );
  normalExitImage = await loadImage(
    "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/exit.png?v=1740506128436"
  );
}

async function newUserBall(value) {
  // Remove ball locally
  ball = null; // Or set to an inactive state

  if (value == userCount) {
    let array = { phoneId: listUsers[currentUser].phoneId, lastExit: true };

    await updateTeamArray(listUsers[currentUser].team, array, 0);

    stopEventListenerBallMovement();
  } else {
    currentUser = value;

    let array = { phoneId: listUsers[currentUser].phoneId, lastExit: false };

    await updateTeamArray(listUsers[currentUser].team, array, 0);

    stopEventListenerBallMovement();
  }
}

// Define listener variables
let deviceOrientationListener;
let keydownListener;
let keyupListener;
const moveSpeed = 0.005;

function startEventListenerBallMovement() {
  if (!deviceOrientationListener) {
    // Device orientation listener
    deviceOrientationListener = (event) => {
      const tiltX = event.beta; // Forward/backward tilt
      const tiltY = event.gamma; // Left/right tilt
      ball.speedX = tiltY / sensitivity;
      ball.speedY = tiltX / sensitivity;
    };
    window.addEventListener("deviceorientation", deviceOrientationListener);
  }

  if (!keydownListener) {
    // Keydown listener
    keydownListener = (event) => {
      switch (event.key) {
        case "ArrowUp":
          ball.speedY = -moveSpeed;
          break;
        case "ArrowDown":
          ball.speedY = moveSpeed;
          break;
        case "ArrowLeft":
          ball.speedX = -moveSpeed;
          break;
        case "ArrowRight":
          ball.speedX = moveSpeed;
          break;
      }
    };
    document.addEventListener("keydown", keydownListener);
  }

  if (!keyupListener) {
    // Keyup listener
    keyupListener = (event) => {
      switch (event.key) {
        case "ArrowUp":
        case "ArrowDown":
          ball.speedY = 0;
          break;
        case "ArrowLeft":
        case "ArrowRight":
          ball.speedX = 0;
          break;
      }
    };
    document.addEventListener("keyup", keyupListener);
  }
}

function stopEventListenerBallMovement() {
  // Remove device orientation listener
  if (deviceOrientationListener) {
    console.log("STOP ORIENTATION LISTENER");
    window.removeEventListener("deviceorientation", deviceOrientationListener);
  }

  // Remove keydown listener
  if (keydownListener) {
    document.removeEventListener("keydown", keydownListener);
  }

  // Remove keyup listener
  if (keyupListener) {
    document.removeEventListener("keyup", keyupListener);
  }
}

function checkCombination() {
  let combo = getCombination();
  let i = 0;
  let openedGatesIndices = [];
  let closedGatesIndices = [];
  let wrongCode = true;

  for (let gate of allGates) {
    if (gate.code == combo) {
      openedGatesIndices.push(i);
      wrongCode = false;
    } else {
      closedGatesIndices.push(i);
    }
    i++;
  }
  toggleGates(openedGatesIndices, closedGatesIndices);

  if (wrongCode && gameEnded) {
    codeCheck(combo, targetId);
  }
}

let gameEnded = false;

function endGame() {
  exitCodeElement.style.display = "block";

  let i = 0;
  let closedGatesIndices = [];

  for (let gate of allGates) {
    closedGatesIndices.push(i);
    i++;
  }
  toggleGates([], closedGatesIndices);

  gameEnded = true;

  drawMaze(true);
  ball = null;
}

function resetBallPos() {
  ball = {
    x: initBall.x,
    y: initBall.y,
    radius: resizedRadius,
    speedX: 0,
    speedY: 0,
  };
}

let resizedRadius;

function resizeBasedNumTiles() {
  switch (numTilesWidth) {
    case 10:
      referenceCanvasWidth = 3000;
      resizedRadius = initBall.radius * 1.2;
      break;
    case 15:
      referenceCanvasWidth = 3000;
      resizedRadius = initBall.radius * 0.9;
      break;
  }
}
