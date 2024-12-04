document.getElementById("startButton").addEventListener("click", async () => {
    const button = document.getElementById("startButton");
    const tuner = document.getElementById("tuner");

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1;

        source.connect(gainNode);
        gainNode.connect(analyser);

        console.log("Audio input connected successfully!");
        button.style.display = "none";
        tuner.style.display = "block";

        positionDialElements();
        detectPitch(analyser, audioContext.sampleRate, gainNode);
    } catch (error) {
        console.error("Error setting up audio:", error);
    }
});

let currentAngle = 0;
let frequencyHistory = []; // Store recent frequencies for smoothing
const maxHistoryLength = 5; // Number of frequencies to average for smoothing

function positionDialElements() {
    const tunerContainer = document.querySelector(".tuner-container");
    const dial = document.getElementById("dial");
    const centerLine = document.getElementById("centerLine");

    const containerHeight = tunerContainer.offsetHeight;

    // Position dial and center line based on container size
    dial.style.top = `${containerHeight * 0.3}px`;
    dial.style.left = "50%";

    centerLine.style.top = `${containerHeight * 0.3}px`;
    centerLine.style.left = "50%";
}

function detectPitch(analyser, sampleRate, gainNode) {
    const buffer = new Float32Array(analyser.fftSize);
    let lastValidFrequency = null;
    const minFrequency = 70;
    const maxFrequency = 350;
    const signalThreshold = 0.01; // Minimum signal strength (RMS)

    function update() {
        analyser.getFloatTimeDomainData(buffer);

        const rms = calculateRMS(buffer);

        if (rms < signalThreshold) {
            gainNode.gain.value = 5; // Boost signal if weak
            resetPitchDisplay("Weak signal detected");
            requestAnimationFrame(update);
            return;
        } else {
            gainNode.gain.value = 1;
        }

        const frequency = calculatePitch(buffer, sampleRate);

        if (frequency && frequency >= minFrequency && frequency <= maxFrequency) {
            lastValidFrequency = smoothFrequency(frequency); // Smooth the frequency
            displayPitch(lastValidFrequency);
        } else if (lastValidFrequency) {
            displayPitch(lastValidFrequency, true); // Show the last detected frequency
        } else {
            resetPitchDisplay("No valid pitch detected");
        }

        requestAnimationFrame(update);
    }

    update();
}

function calculateRMS(buffer) {
    const sum = buffer.reduce((acc, value) => acc + value ** 2, 0);
    return Math.sqrt(sum / buffer.length);
}

function resetPitchDisplay(message = "No sound detected") {
    const noteElement = document.getElementById("note");
    const statusElement = document.getElementById("status");
    const dialElement = document.getElementById("dial");

    noteElement.textContent = "-";
    statusElement.textContent = message;
    dialElement.style.transform = `translateX(-50%) rotate(${currentAngle}deg)`;
    dialElement.style.backgroundColor = "#007BFF";
}

function calculatePitch(buffer, sampleRate) {
    let bestOffset = -1;
    let bestCorrelation = 0;

    for (let offset = 1; offset < buffer.length / 2; offset++) {
        let correlation = 0;

        for (let i = 0; i < buffer.length / 2; i++) {
            correlation += buffer[i] * buffer[i + offset];
        }

        correlation /= buffer.length;

        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = offset;
        }
    }

    if (bestCorrelation > 0.01) {
        // Ignore weak correlations
        return sampleRate / bestOffset;
    }

    return null;
}

function smoothFrequency(frequency) {
    frequencyHistory.push(frequency);
    if (frequencyHistory.length > maxHistoryLength) {
        frequencyHistory.shift(); // Remove oldest frequency
    }

    // Calculate the average of recent frequencies
    const sum = frequencyHistory.reduce((acc, freq) => acc + freq, 0);
    return sum / frequencyHistory.length;
}

function displayPitch(frequency, useLastNote = false) {
    const noteElement = document.getElementById("note");
    const statusElement = document.getElementById("status");
    const dialElement = document.getElementById("dial");

    const notes = [
        { note: "E2", frequency: 82.41 },
        { note: "A2", frequency: 110.00 },
        { note: "D3", frequency: 146.83 },
        { note: "G3", frequency: 196.00 },
        { note: "B3", frequency: 246.94 },
        { note: "E4", frequency: 329.63 },
    ];

    const closestNote = notes.reduce((prev, curr) =>
        Math.abs(curr.frequency - frequency) < Math.abs(prev.frequency - frequency)
            ? curr
            : prev
    );

    const difference = frequency - closestNote.frequency;

    if (!useLastNote) {
        noteElement.textContent = closestNote.note;
    }

    const offsetPercentage = (difference / closestNote.frequency) * 100;
    const maxAngle = 45;
    const targetAngle = Math.max(Math.min((offsetPercentage / 10) * maxAngle, maxAngle), -maxAngle);

    currentAngle += (targetAngle - currentAngle) * 0.1;
    dialElement.style.transform = `translateX(-50%) rotate(${currentAngle.toFixed(2)}deg)`;

    if (Math.abs(difference) < 1) {
        dialElement.style.backgroundColor = "green";
        statusElement.textContent = "In Tune!";
    } else if (difference > 0) {
        dialElement.style.backgroundColor = "red";
        statusElement.textContent = `Sharp by ${difference.toFixed(2)} Hz`;
    } else {
        dialElement.style.backgroundColor = "red";
        statusElement.textContent = `Flat by ${Math.abs(difference).toFixed(2)} Hz`;
    }
}
