function updateCompass(event) {
    const needle = document.getElementById('needle');

    // Check if the event has the alpha property (which indicates device orientation)
    if (event.alpha !== null) {
        // Device orientation in degrees (0 to 360)
        const angle = event.alpha; 
        
        // Rotate the needle based on device orientation
        needle.style.transform = `translateX(-50%) rotate(${-angle}deg)`;
    }
}

// Listen for device orientation events
window.addEventListener('deviceorientation', updateCompass);

// Optional: handle the case where device orientation is not supported
window.addEventListener('deviceorientationabsolute', (event) => {
    if (event.alpha === null) {
        console.error('Device orientation data is not available.');
    }
});
