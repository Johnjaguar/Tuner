document.addEventListener("DOMContentLoaded", () => {
    const stringFrequencies = {
        "E2": 82.41,
        "A2": 110.00,
        "D3": 146.83,
        "G3": 196.00,
        "B3": 246.94,
        "E4": 329.63
    };

    const STRING_ORDER = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

    // DOM Elements
    const button = document.getElementById('startButton');
    const marker = document.getElementById('marker');
    const status = document.getElementById('status');
    const currentNote = document.getElementById('currentNote');
    const frequency = document.getElementById('frequency');
    const volumeLevel = document.getElementById('volumeLevel');
    const stringGrid = document.getElementById('stringGrid');
    const guitarRocket = document.getElementById('guitarRocket');
    const leftBoosters = document.getElementById('leftBoosters');
    const rightBoosters = document.getElementById('rightBoosters');
    const stringsGroup = document.getElementById('strings');
    const missionTime = document.getElementById('missionTime');

    // State variables
    let isRunning = false;
    let audioContext = null;
    let analyser = null;
    let source = null;
    const smoothingWindow = [];
    const maxSmoothingWindowSize = 5;
    const stabilityMap = {};
    const stabilityDuration = 200;
    let missionStartTime = null;
    let missionTimeInterval = null;

    // Initialize everything
    initializeStringGrid();
    initializeGuitarRocket();

    button.addEventListener('click', handleStartStop);

    function initializeGuitarRocket() {
        // Create left boosters
        [250, 300, 350].forEach((yPos, idx) => {
            const booster = document.createElementNS("http://www.w3.org/2000/svg", "path");
            booster.setAttribute("d", `M90 ${yPos} L120 ${yPos} L130 ${yPos + 100} L80 ${yPos + 100} Z`);
            booster.setAttribute("class", "booster");
            booster.setAttribute("data-string", STRING_ORDER[idx]);
            
            const thruster = document.createElementNS("http://www.w3.org/2000/svg", "path");
            thruster.setAttribute("d", `M85 ${yPos + 100} L125 ${yPos + 100} L105 ${yPos + 150} Z`);
            thruster.setAttribute("class", "thruster-fire");
            
            leftBoosters.appendChild(booster);
            leftBoosters.appendChild(thruster);
        });

        // Create right boosters
        [250, 300, 350].forEach((yPos, idx) => {
            const booster = document.createElementNS("http://www.w3.org/2000/svg", "path");
            booster.setAttribute("d", `M280 ${yPos} L310 ${yPos} L320 ${yPos + 100} L270 ${yPos + 100} Z`);
            booster.setAttribute("class", "booster");
            booster.setAttribute("data-string", STRING_ORDER[idx + 3]);
            
            const thruster = document.createElementNS("http://www.w3.org/2000/svg", "path");
            thruster.setAttribute("d", `M275 ${yPos + 100} L315 ${yPos + 100} L295 ${yPos + 150} Z`);
            thruster.setAttribute("class", "thruster-fire");
            
            rightBoosters.appendChild(booster);
            rightBoosters.appendChild(thruster);
        });

        // Create strings
        [190, 195, 200, 205, 210, 215].forEach((x, idx) => {
            const string = document.createElementNS("http://www.w3.org/2000/svg", "line");
            string.setAttribute("x1", x);
            string.setAttribute("y1", "50");
            string.setAttribute("x2", x);
            string.setAttribute("y2", "250");
            string.setAttribute("class", "string");
            string.setAttribute("data-string", STRING_ORDER[idx]);
            stringsGroup.appendChild(string);
        });
    }

    function initializeStringGrid() {
        Object.entries(stringFrequencies).forEach(([note, freq]) => {
            const stringItem = document.createElement('div');
            stringItem.className = 'string-item';
            stringItem.id = `string-${note}`;
            stringItem.innerHTML = `
                <div class="string-note">${note}</div>
                <div class="string-freq">${freq} Hz</div>
            `;
            stringGrid.appendChild(stringItem);
        });
    }

    async function handleStartStop() {
        if (!isRunning) {
            try {
                await startTuner();
            } catch (error) {
                handleError(error);
            }
        } else {
            stopTuner();
        }
    }

    async function startTuner() {
        const constraints = {
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
                latency: 0
            }
        };

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        source = audioContext.createMediaStreamSource(stream);

        const highPassFilter = audioContext.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 70;
        source.connect(highPassFilter).connect(analyser);

        isRunning = true;
        missionStartTime = Date.now();
        updateMissionTime();
        missionTimeInterval = setInterval(updateMissionTime, 1000);
        updatePitch();
        updateButtonState(true);
    }

    function stopTuner() {
        if (source) {
            source.disconnect();
            source = null;
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        if (missionTimeInterval) {
            clearInterval(missionTimeInterval);
            missionTimeInterval = null;
        }
        isRunning = false;
        missionStartTime = null;
        updateButtonState(false);
        resetDisplays();
        document.querySelectorAll('.string-item').forEach(item => {
            item.classList.remove('in-tune');
        });
        document.querySelectorAll('.booster').forEach(b => {
            b.classList.remove('active');
        });
        document.querySelectorAll('.string').forEach(s => {
            s.classList.remove('in-tune');
        });
    }

    function updateMissionTime() {
        if (!missionStartTime) {
            missionTime.textContent = 'T-00:00:00';
            return;
        }
        const elapsed = Math.floor((Date.now() - missionStartTime) / 1000);
        const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        missionTime.textContent = `T+${hours}:${minutes}:${seconds}`;
    }

    function updateButtonState(running) {
        button.classList.toggle('active', running);
        button.querySelector('span').textContent = running ? 'ABORT MISSION' : 'ACTIVATE TUNER';
        status.textContent = running ? 'TUNING ACTIVE' : 'SYSTEMS READY';
    }

    function resetDisplays() {
        currentNote.textContent = '-';
        frequency.textContent = '-';
        status.textContent = 'AWAITING ACTIVATION';
        marker.style.left = '50%';
        volumeLevel.style.width = '0%';
        missionTime.textContent = 'T-00:00:00';
    }

    function handleError(error) {
        console.error('System Error:', error);
        const errorMessages = {
            NotAllowedError: 'MICROPHONE ACCESS DENIED',
            NotFoundError: 'NO MICROPHONE DETECTED',
            NotReadableError: 'MICROPHONE IN USE'
        };
        status.textContent = errorMessages[error.name] || 'SYSTEM MALFUNCTION';
        stopTuner();
    }

    function updatePitch() {
        if (!isRunning) return;

        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        updateVolumeLevel(buffer);
        processPitch(buffer);

        requestAnimationFrame(updatePitch);
    }

    function updateVolumeLevel(buffer) {
        const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
        const volume = Math.min(100, Math.max(0, rms * 400));
        volumeLevel.style.width = `${volume}%`;

        if (volume < 5) {
            indicateNoPitch();
        }
    }

    function processPitch(buffer) {
        const detectedPitch = yin(buffer, audioContext.sampleRate);

        if (detectedPitch) {
            const smoothedFrequency = smoothFrequency(detectedPitch);
            updateTunerDisplays(smoothedFrequency);
        } else {
            indicateNoPitch();
        }
    }

    function yin(buffer, sampleRate) {
        const threshold = 0.1;
        const minFrequency = 70;
        const maxFrequency = 400;
        const halfBufferSize = Math.floor(buffer.length / 2);

        const difference = new Float32Array(halfBufferSize);
        const cumulativeMeanNormalizedDifference = new Float32Array(halfBufferSize);

        for (let tau = 0; tau < halfBufferSize; tau++) {
            for (let j = 0; j < halfBufferSize; j++) {
                const delta = buffer[j] - buffer[j + tau];
                difference[tau] += delta * delta;
            }
        }

        cumulativeMeanNormalizedDifference[0] = 1;
        for (let tau = 1; tau < halfBufferSize; tau++) {
            let runningSum = 0;
            for (let j = 1; j <= tau; j++) {
                runningSum += difference[j];
            }
            cumulativeMeanNormalizedDifference[tau] = difference[tau] * tau / runningSum;
        }

        let tauEstimate = -1;
        for (let tau = 2; tau < halfBufferSize; tau++) {
            if (cumulativeMeanNormalizedDifference[tau] < threshold) {
                while (tau + 1 < halfBufferSize &&
                       cumulativeMeanNormalizedDifference[tau + 1] < cumulativeMeanNormalizedDifference[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) return null;

        let betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < halfBufferSize - 1) {
            const alpha = cumulativeMeanNormalizedDifference[tauEstimate - 1];
            const beta = cumulativeMeanNormalizedDifference[tauEstimate];
            const gamma = cumulativeMeanNormalizedDifference[tauEstimate + 1];
            const peak = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
            betterTau = tauEstimate + peak;
        }

        const pitchHz = sampleRate / betterTau;
        return (pitchHz > minFrequency && pitchHz < maxFrequency) ? pitchHz : null;
    }

    function smoothFrequency(freq) {
        if (smoothingWindow.length >= maxSmoothingWindowSize) {
            smoothingWindow.shift();
        }
        smoothingWindow.push(freq);
        return smoothingWindow.reduce((sum, f) => sum + f) / smoothingWindow.length;
    }

    function findClosestNote(freq) {
        let closestNote = "";
        let closestDiff = Infinity;

        Object.entries(stringFrequencies).forEach(([note, noteFreq]) => {
            const diff = Math.abs(freq - noteFreq);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestNote = note;
            }
        });

        return {
            note: closestNote,
            frequency: stringFrequencies[closestNote]
        };
    }

    function getCents(frequency, targetFrequency) {
        return 1200 * Math.log2(frequency / targetFrequency);
    }

    function launchRocket() {
        guitarRocket.classList.add('launching');
        status.textContent = 'LAUNCH SEQUENCE INITIATED 🚀';
        
        setTimeout(() => {
            guitarRocket.classList.remove('launching');
            document.querySelectorAll('.booster').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.string').forEach(s => s.classList.remove('in-tune'));
            document.querySelectorAll('.string-item').forEach(item => {
                item.classList.remove('in-tune');
            });
            status.textContent = 'SYSTEMS READY';
        }, 3000);
    }

    function updateTunerDisplays(detectedFrequency) {
        frequency.textContent = `${detectedFrequency.toFixed(1)} Hz`;
        const closestNote = findClosestNote(detectedFrequency);
        currentNote.textContent = closestNote.note;

        const cents = getCents(detectedFrequency, closestNote.frequency);

        // Update guitar rocket elements
        const booster = document.querySelector(`[data-string="${closestNote.note}"]`);
        const string = document.querySelector(`line[data-string="${closestNote.note}"]`);
        
        if (Math.abs(cents) < 5) {
            if (!stabilityMap[closestNote.note]) {
                stabilityMap[closestNote.note] = { startTime: Date.now(), sustained: false };
            }

            const stabilityState = stabilityMap[closestNote.note];
            if (!stabilityState.sustained) {
                const elapsed = Date.now() - stabilityState.startTime;
                if (elapsed >= stabilityDuration) {
                    stabilityState.sustained = true;
                    markInTune(closestNote.note);
                    if (booster) booster.classList.add('active');
                    if (string) string.classList.add('in-tune');
                    
                    // Check if all strings are in tune
                    const allBoosters = document.querySelectorAll('.booster');
                    const activeBoosters = document.querySelectorAll('.booster.active');
                    
                    if (allBoosters.length === activeBoosters.length) {
                        launchRocket();
                    }
                }
            }
        } else {
            if (stabilityMap[closestNote.note]) {
                stabilityMap[closestNote.note]
                stabilityMap[closestNote.note].startTime = Date.now();
                stabilityMap[closestNote.note].sustained = false;
            }
        }

        // Update the marker position and visualization
        updateTunerVisualization(cents, closestNote.note);
    }

    function markInTune(note) {
        const stringElement = document.getElementById(`string-${note}`);
        if (stringElement && !stringElement.classList.contains('in-tune')) {
            stringElement.classList.add('in-tune');
            status.textContent = 'BOOSTER ALIGNED 🚀';
            marker.style.backgroundColor = 'var(--success)';
        }
    }

    function updateTunerVisualization(cents, note) {
        const maxCents = 50;
        const position = 50 + (cents * 50) / maxCents;
        marker.style.left = `${Math.min(100, Math.max(0, position))}%`;

        if (Math.abs(cents) >= 5) {
            status.textContent = cents > 0 ? 'TUNE DOWN ↓' : 'TUNE UP ↑';
            marker.style.backgroundColor = 'var(--primary)';
        }
    }

    function indicateNoPitch() {
        currentNote.textContent = '-';
        frequency.textContent = '-';
        status.textContent = 'NO SIGNAL DETECTED';
    }
});