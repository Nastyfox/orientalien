// Initialize the map and set the view to a default location
const map = L.map('map').setView([51.505, -0.09], 13); // Default location (London)

// Add a tile layer from OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Function to handle geolocation success
function onLocationFound(e) {
    const radius = e.accuracy / 2;

    // Add a marker for the current location
    L.marker(e.latlng).addTo(map)
        .bindPopup('You are within ' + Math.round(radius) + ' meters from this point')
        .openPopup();

    // Optionally, you can set the map view to your current location
    map.setView(e.latlng, 13);
}

// Function to handle geolocation errors
function onLocationError(e) {
    alert(e.message);
}

// Request the user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onLocationFound, onLocationError);
} else {
    alert("Geolocation is not supported by this browser.");
}

// Load target data and initialize markers
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        data.targets.forEach(target => {
            const marker = L.marker([target.lat, target.lng]).addTo(map);
            marker.bindPopup(`
                <div>
                    <strong>Challenge Point</strong>
                    <p>${target.question}</p>
                    <input type="text" id="answer-${target.id}" placeholder="Your answer">
                    <button onclick="checkAnswer('${target.id}', '${target.answer}')">Submit</button>
                    <div id="result-${target.id}" style="margin-top: 10px;"></div>
                </div>
            `);
        });
    })
    .catch(error => console.error('Error loading target data:', error));

// Function to check the user's answer
function checkAnswer(id, correctAnswer) {
    const userAnswer = document.getElementById(`answer-${id}`).value.trim();
    const resultDiv = document.getElementById(`result-${id}`);

    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        resultDiv.innerHTML = "<span style='color: green;'>Correct! Well done.</span>";
    } else {
        resultDiv.innerHTML = "<span style='color: red;'>Incorrect. Try again!</span>";
    }
}

// Update compass needle based on device orientation
function updateCompass(event) {
    const needle = document.getElementById('needle');

    if (event.alpha !== null) {
        const angle = event.alpha;
        needle.style.transform = `translateX(-50%) translateY(-100%) rotate(${-angle}deg)`;
    }
}

window.addEventListener('deviceorientation', updateCompass);

window.addEventListener('deviceorientationabsolute', (event) => {
    if (event.alpha === null) {
        console.error('Device orientation data is not available.');
    }
});
