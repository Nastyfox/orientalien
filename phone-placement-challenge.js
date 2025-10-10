import {
  goBack,
  completeChallenge,
  vhToPx,
  vwToPx,
  pxToVh,
  pxToVw,
  loadChallenge,
  initHints,
  initSubmitAndBack,
  checkCombination,
  updateTeamArray,
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

import { initCombinationLock, getEnterButton } from "./combination-lock.js";

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
let imageContainer = null;
let startButton = null;
let openButton = null;

let hintIndex = 0;

let lock;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);

    initSubmitAndBack(false, true);

    initHints(teamName, hintIndex);

    lock = document.getElementById("lock");

    openButton = document.getElementById("open-challenge");
    startButton = document.getElementById("start-challenge");

    openButton.addEventListener("click", openChallenge);

    startButton.addEventListener("click", startChallenge);

    document
      .getElementById("close-btn")
      .addEventListener("click", closeImageContainer);

    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    initCombinationLock();
    getEnterButton().addEventListener("click", () => {
      checkCombination(targetId);
    });

    await initDisplayCode();

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);

    console.log("Target ID after loading challenge:", targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

// Global array to store image elements
const images = [];

// Function to create and display multiple images with circle overlays
function createImages(imageUrls) {
  const container = document.getElementById("image-container");
  const numImages = imageUrls.length;

  // Calculate the height for each image in vh
  const maxImageHeight = 50; // Each image takes up a fraction of the height based on the number of images

  imageUrls.forEach((url, index) => {
    let imageHeight = Math.min(0.25, Math.random()) * maxImageHeight;
    const imageHeightInPx = vhToPx(imageHeight);
    // Calculate dynamic positions using percentages (vw and vh) for responsiveness
    let leftPos = 0; // Randomize position in vw (20vw margin)
    let topPos = Math.random() * (100 - imageHeight); // Top position based on vh units
    let calculatedWidthInVw = 0;

    // Create the draggable image
    const img = document.createElement("img");
    img.src = url;
    img.alt = `Image ${index + 1}`;
    img.classList.add("movable-image");

    img.onload = function () {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const calculatedWidthInPx = imageHeightInPx * aspectRatio;
      calculatedWidthInVw = (calculatedWidthInPx / screenWidth) * 100;

      if (calculatedWidthInPx > screenWidth) {
        img.style.width = `${100}vw`;
      } else {
        img.style.height = `${imageHeight}vh`;
        leftPos = Math.random() * (100 - calculatedWidthInVw);
      }

      // Set image dimensions and position
      img.style.position = "absolute";
      img.style.left = `${leftPos}vw`; // Offset to keep image centered inside the circle
      img.style.top = `${topPos}vh`; // Offset to keep image centered inside the circle
      img.style.pointerEvents = "auto"; // Allow image to be draggable

      img.style.transform = `rotate(${Math.random() * 360}deg)`; // Random rotation for fun

      // Make the image draggable
      makeDraggable(img); // Pass circle image as well

      // Add the image to the container and the array
      container.appendChild(img);
    };
  });
}

let screenWidth;
let screenHeight;

function makeDraggable(img) {
  let isDragging = false;
  let isRotating = false;
  let isZooming = false;
  let startX, startY, initialX, initialY;
  let initialAngle = 0;
  let initialRotation = 0;
  let initialDistance = 0;
  let scale = 1; // Échelle actuelle

  const startDrag = (e) => {
    if (e.touches && e.touches.length === 2) {
      // Deux doigts → rotation et zoom
      isRotating = true;
      isZooming = true;
      isDragging = false;

      const [touch1, touch2] = e.touches;
      initialAngle = getAngleBetweenTouches(touch1, touch2);
      initialRotation = getRotationDegrees(img);

      // On NE réinitialise PAS scale ici pour éviter le reset
      initialDistance = getDistanceBetweenTouches(touch1, touch2);
    } else if (e.touches && e.touches.length === 1) {
      // Un doigt → déplacement
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      initialX = img.offsetLeft;
      initialY = img.offsetTop;
    } else if (e.type === "mousedown") {
      // Souris → déplacement
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = img.offsetLeft;
      initialY = img.offsetTop;
    }

    e.preventDefault();
  };

  const zoomFactor = 0.05; // Réduit la sensibilité du zoom

  const onDrag = (e) => {
    if (isDragging) {
      const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      let newX = initialX + dx;
      let newY = initialY + dy;

      img.style.left = `${newX}px`;
      img.style.top = `${newY}px`;

      keepImageInsideScreen(img);
    } else if (
      (isRotating || isZooming) &&
      e.touches &&
      e.touches.length === 2
    ) {
      const [touch1, touch2] = e.touches;

      // Rotation
      const currentAngle = getAngleBetweenTouches(touch1, touch2);
      const angleDiff = currentAngle - initialAngle;
      const newRotation = initialRotation + angleDiff;

      // Zoom
      const currentDistance = getDistanceBetweenTouches(touch1, touch2);
      const scaleDiff = currentDistance / initialDistance;
      let newScale = scale * scaleDiff; // Calcul de la nouvelle échelle

      // Limite l'échelle entre 0.5x et 3x
      newScale = Math.max(
        0.5,
        Math.min(scale + (scaleDiff - 1) * zoomFactor, 3)
      );

      // Limite le zoom pour ne pas dépasser la taille de l'écran
      const imgRect = img.getBoundingClientRect();

      // Si l'image est plus grande que l'écran après le zoom, on ajuste l'échelle
      if (imgRect.width * newScale > screenWidth) {
        newScale = screenWidth / imgRect.width;
      }
      if (imgRect.height * newScale > screenHeight) {
        newScale = screenHeight / imgRect.height;
      }

      scale = newScale; // Met à jour l'échelle actuelle

      img.style.transform = `rotate(${newRotation}deg) scale(${scale})`;

      setTimeout(() => keepImageInsideScreen(img), 0);
    }
  };

  const endDrag = () => {
    isDragging = false;
    isRotating = false;
    isZooming = false;
  };

  const getAngleBetweenTouches = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const getDistanceBetweenTouches = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getRotationDegrees = (elem) => {
    const style = window.getComputedStyle(elem);
    const transform =
      style.transform || style.webkitTransform || style.mozTransform;

    if (transform && transform !== "none") {
      const values = transform.match(/matrix.*\((.+)\)/)[1].split(",");
      const a = parseFloat(values[0]);
      const b = parseFloat(values[1]);
      const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
      return angle < 0 ? angle + 360 : angle;
    }
    return 0;
  };

  const getCurrentScale = (elem) => {
    const style = window.getComputedStyle(elem);
    const transform =
      style.transform || style.webkitTransform || style.mozTransform;

    if (transform && transform !== "none") {
      const match = transform.match(/matrix\(([^)]+)\)/);
      if (match) {
        const values = match[1].split(",");
        const scaleX = parseFloat(values[0]); // Récupère la mise à l'échelle actuelle
        return scaleX;
      }
    }
    return 1;
  };

  img.addEventListener("touchstart", startDrag);
  window.addEventListener("touchmove", onDrag);
  window.addEventListener("touchend", endDrag);

  img.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", endDrag);
}

function keepImageInsideScreen(img) {
  const imgRect = img.getBoundingClientRect();

  let newX = img.offsetLeft;
  let newY = img.offsetTop;

  // Centre de l'image (important pour la rotation)
  const centerX = imgRect.left + imgRect.width / 2;
  const centerY = imgRect.top + imgRect.height / 2;

  // Taille après rotation et zoom
  const width = imgRect.width;
  const height = imgRect.height;

  // Vérifie si l'image dépasse et ajuste la position
  if (imgRect.left < 0) newX += -imgRect.left;
  if (imgRect.top < 0) newY += -imgRect.top;
  if (imgRect.right > screenWidth) newX -= imgRect.right - screenWidth;
  if (imgRect.bottom > screenHeight) newY -= imgRect.bottom - screenHeight;

  // Applique la nouvelle position
  img.style.left = `${newX}px`;
  img.style.top = `${newY}px`;
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
async function getImagesURL(userCount) {
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));

  if (challengeDoc.exists()) {
    let imagesURLs = null;
    const userName = "user" + currentUserCount;
    console.log(userCount);
    switch (userCount) {
      case 2:
        imagesURLs = getCurrentUserImagesURLs(
          userName,
          challengeDoc.data().users2
        );
        break;
      case 3:
        imagesURLs = getCurrentUserImagesURLs(
          userName,
          challengeDoc.data().users3
        );
        break;
      case 4:
        imagesURLs = getCurrentUserImagesURLs(
          userName,
          challengeDoc.data().users4
        );
        break;
      case 5:
        imagesURLs = getCurrentUserImagesURLs(
          userName,
          challengeDoc.data().users5
        );
        break;
      case 6:
        imagesURLs = getCurrentUserImagesURLs(
          userName,
          challengeDoc.data().users6
        );
        break;
    }
    if (imagesURLs) {
      console.log(imagesURLs);
      return imagesURLs; // Return corresponding image URL
    }
  }
  return null; // Fallback if no image found
}

async function getCurrentUserImagesURLs(userName, challengeData) {
  for (const [userCount, urls] of Object.entries(challengeData)) {
    if (userCount === userName) {
      return urls;
    }
  }
}

// Start the camera and display the overlay
async function startChallenge() {
  // Get the current team and count its members
  const teamName = await getUserTeam(db, phoneId);
  const userCount = await getTeamUserCount(teamName);

  const imagesURL = await getImagesURL(userCount);
  console.log(imagesURL);
  createImages(imagesURL);

  imageContainer = document.getElementById("image-container");
  document
    .getElementById("close-btn")
    .addEventListener("click", closeImageContainer);

  // Display the video element when the camera starts
  imageContainer.style.display = "block"; // Make video visible
  lock.classList.remove("hidden");
  startButton.style.display = "none";
  openButton.style.display = "inline-block";

  let array = {
    displayCode: true,
  };
  await updateTeamArray(teamName, array, 0);
}

function openChallenge() {
  imageContainer.style.display = "block";
  document
    .getElementById("close-btn")
    .addEventListener("click", closeImageContainer);
}

function closeImageContainer() {
  imageContainer.style.display = "none"; // Hide the image container
}

async function initDisplayCode() {
  const challengeDoc = doc(db, "challenges", targetId); // Use the targetId from the challenge
  const challengeSnapshot = await getDoc(challengeDoc);

  const teamData = challengeSnapshot.data()?.[teamName];

  if (teamData) {
    if (teamData[0].displayCode) {
      lock.classList.remove("hidden");
    }
  } else {
    console.log("No team data found");
  }
}
