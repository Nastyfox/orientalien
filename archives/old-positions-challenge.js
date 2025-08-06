function startChallenge() {
  // Load challenge data
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get("id");

  fetch("data.json")
    .then((response) => response.json())
    .then((data) => {
      phonesData = data.targets.find((t) => t.id === targetId);
      if (phonesData && phonesData.challengeType === "phone-placement") {
        // Start tracking phone positions
        trackPhonePositions();
      }
    })
    .catch((error) => console.error("Error loading challenge data:", error));
}

function trackPhonePositions() {
  // Get user’s current location and start tracking
  navigator.geolocation.watchPosition(
    handlePositionUpdate,
    (error) => console.error("Error getting location:", error),
    { enableHighAccuracy: true }
  );
}

function handlePositionUpdate(position) {
  if (!phonesData) return;

  const { latitude, longitude } = position.coords;

  // Check proximity and orientation
  const isValid = checkPlacement(latitude, longitude);

  if (isValid) {
    alert("Congratulations! Phones are placed correctly.");
    // Redirect or handle challenge completion
  } else {
    console.log("Continue placing the phones...");
  }
}

function checkPlacement(latitude, longitude) {
  // Define tolerance for proximity check
  const tolerance = 0.0001;
  const rotationTolerance = 15; // Allowable deviation in rotation
  let valid = true;

  // Check if phones are within the correct proximity
  phonesData.phones.forEach((phone) => {
    const phoneLat = phone.position.y;
    const phoneLng = phone.position.x;

    // Check proximity (this is a simplification)
    const distance = Math.sqrt(
      Math.pow(phoneLat - latitude, 2) + Math.pow(phoneLng - longitude, 2)
    );
    if (distance > tolerance) {
      valid = false;
    }
  });

  // Check orientations
  phonesData.phones.forEach((phone) => {
    // Find the other phones for orientation check
    phonesData.phones.forEach((otherPhone) => {
      if (phone.id !== otherPhone.id) {
        const direction = getDirection(phone.position, otherPhone.position);
        if (direction !== phone.direction) {
          valid = false;
        }

        // Check rotation
        const rotationDifference = Math.abs(
          phone.rotation - otherPhone.rotation
        );
        if (rotationDifference > rotationTolerance) {
          valid = false; // Invalid rotation
        }
      }
    });
  });

  return valid;
}

function getDirection(p1, p2) {
  if (p1.x < p2.x) return "left";
  if (p1.x > p2.x) return "right";
  if (p1.y < p2.y) return "above";
  if (p1.y > p2.y) return "below";
  return "none";
}