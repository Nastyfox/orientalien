// Import the Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-storage.js";

import { v4 as uuidv4 } from "https://jspm.dev/uuid";

import { getUserTeam, getOrCreateUniqueId } from "./utils.js";

import { addPoints } from "./utils-challenge.js";

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
// Initialize Firestore
const db = getFirestore(app);
const storage = getStorage(app);

// DOM elements
const teamsContainer = document.getElementById("teams-container");

// Global variables
let mediaRecorder;
let audioChunks = [];
let userTeamName = null;
const phoneId = getOrCreateUniqueId(); // Get the user's phone ID
let isAdmin = true;

loadTeams();

// Load teams from Firestore and avoid showing admin team
async function loadTeams() {
  try {
    const teamsSnapshot = await getDocs(collection(db, "teams"));
    const teams = [];

    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const teamId = doc.id;
      const teamName = teamData.name;
      // Exclude the admin team and store teams that are not admin
      if (teamId !== "admin") {
        teams.push({ name: teamName, id: teamId });
      }
    });
	
    // Process each team and create UI elements
    teams.forEach((team) => {
      const teamCard = document.createElement("div");
      teamCard.className = "team-card";
      teamCard.dataset.team = team.name;

      teamCard.innerHTML = `
        <h2>${team.name}</h2>
        <button class="record-btn">Record Message</button>
        <div class="message-container" style="display:none;"></div>
        <button class="points-btn">Add/Remove Points</button>
        <div class="points-container" style="display:none;">
          <input type="number" class="points-input" placeholder="Enter points">
          <button class="update-points-btn">Update Points</button>
        </div>
      `;

      const messageContainer = teamCard.querySelector(".message-container");
      const recordBtn = teamCard.querySelector(".record-btn");
      const pointsBtn = teamCard.querySelector(".points-btn");
      const updatePointsBtn = teamCard.querySelector(".update-points-btn");

      const teamName = teamCard.querySelector("h2");
	  
	  console.log(team.id);

      loadMessagesForTeam(team.id, messageContainer, teamName);
      setInterval(function () {
        loadMessagesForTeam(team.id, messageContainer, teamName);
      }, 30000);

      // Load messages when team is clicked
      teamCard.addEventListener("click", () => {
        if (messageContainer.style.display === "none") {
          messageContainer.style.display = "block";
        } else {
          messageContainer.style.display = "none";
        }
      });
	  
      // Attach record message functionality
      recordBtn.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent clicking on the team card itself
        if (recordBtn.textContent === "Record Message") {
          startRecordingForTeam(team.id, recordBtn);
        } else {
          stopRecording(recordBtn);
        }
      });

      pointsBtn.addEventListener("click", () => {
        const pointsContainer = teamCard.querySelector(".points-container");
        pointsContainer.style.display =
          pointsContainer.style.display === "none" ? "block" : "none";
      });

      updatePointsBtn.addEventListener("click", async () => {
        const pointsInput = teamCard.querySelector(".points-input").value;
        const points = parseInt(pointsInput, 10);
        if (!isNaN(points)) {
          await addPoints(team.id, points);
		  alert("Points added successfully!");
        }
      });

      teamsContainer.appendChild(teamCard);
    });
  } catch (error) {
    console.error("Error loading teams:", error);
  }
}

// Load messages for a specific team
async function loadMessagesForTeam(teamName, messageContainer, teamElement) {
  console.log("Load messages Team" + teamName);
  try {
    const messagesQuery = query(
      collection(db, "voice-messages"),
      where("team", "==", teamName)
    );
    const messagesSnapshot = await getDocs(messagesQuery);
    messageContainer.innerHTML = ""; // Clear previous messages

    let hasUnreadMessages = false;

    messagesSnapshot.forEach((doc) => {
      const messageData = doc.data();
      const messageId = doc.id;

      // Only display messages sent by non-admin users
      if (!messageData.isAdmin) {
        // Check if the message is unread (not in the readBy array for this team)
        const isUnread =
          !messageData.readBy ||
          !messageData.readBy.some((entry) => entry.team === "admin");

        if (isUnread) {
          hasUnreadMessages = true;
        }

        const messageElement = document.createElement("div");
        messageElement.className = isUnread ? "message unread" : "message read"; // Add a class based on read status
        messageElement.innerHTML = `
          <audio controls>
            <source src="${messageData.audioURL}" type="audio/wav">
            Your browser does not support the audio tag.
          </audio>
        `;

        // Get the audio element inside the message
        const audioElement = messageElement.querySelector("audio");

        // Mark the message as read when it starts playing
        audioElement.addEventListener("play", () => {
          markMessagesAsRead(messageId, messageElement); // Call your function with the message ID
        });

        messageContainer.appendChild(messageElement);
      }
    });

    // Update unread marker for the team
    updateUnreadMarker(teamElement, hasUnreadMessages);
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

// Function to update the unread marker next to the team name
function updateUnreadMarker(teamElement, hasUnreadMessages) {
  let marker = teamElement.querySelector(".unread-marker");

  if (hasUnreadMessages) {
    if (!marker) {
      marker = document.createElement("span");
      marker.className = "unread-marker";
      marker.innerHTML = " 🔴"; // You can replace this with a styled icon
      teamElement.appendChild(marker);
    }
  } else {
    if (marker) {
      marker.remove();
    }
  }
}

// Start recording a message for a specific team
async function startRecordingForTeam(teamName, recordBtn) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: "audio/wav" });
        audioChunks = [];

        // Upload the voice message
        await uploadVoiceMessage(blob, teamName, isAdmin);
      };

      mediaRecorder.start();
      recordBtn.textContent = "Stop Recording"; // Change button text to "Stop Recording"
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
  } else {
    alert("Media Devices API not supported.");
  }
}

// Stop recording
function stopRecording(recordBtn) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Stopping recording...");

    // Stop the MediaRecorder
    mediaRecorder.stop();

    // Stop all tracks associated with the media stream (this releases the microphone)
    const tracks = mediaRecorder.stream.getTracks();
    tracks.forEach((track) => track.stop());
    recordBtn.textContent = "Record Message"; // Change button text back to "Record Message"
  }
}

// Upload voice message to Firestore and Storage
async function uploadVoiceMessage(blob, teamName, isAdmin) {
  try {
    const storageRef = ref(
      storage,
      `voice-messages/${teamName}/${Date.now()}.wav`
    );
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
	
	console.log(teamName);

    // Now save the metadata including the download URL and admin status in Firestore
    await addDoc(collection(db, "voice-messages"), {
      team: teamName,
      isAdmin: isAdmin, // Tagging the message as admin or non-admin
      audioURL: downloadURL,
      timestamp: serverTimestamp(), // Save the server timestamp
      readBy: [], // Initialize with an empty array for tracking who has read this message
      isDisplayed: false,
    });

    alert("Message uploaded successfully!");
  } catch (error) {
    console.error("Error uploading message:", error);
  }
}

// Function to mark messages as read
async function markMessagesAsRead(messageId, messageElement) {
  console.log(messageId);
  const messageRef = doc(db, "voice-messages", messageId);

  try {
    await updateDoc(messageRef, {
      readBy: arrayUnion({
        team: "admin",
      }),
    });

    messageElement.className = "message read";
    console.log("Message marked as read");
  } catch (error) {
    console.error("Error marking message as read:", error);
  }
}
