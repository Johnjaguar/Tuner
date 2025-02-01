document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Constants
    const tunings = {
        standard: {
            name: "Standard E (EADGBE)",
            frequencies: {
                "E2": 82.41,
                "A2": 110.00,
                "D3": 146.83,
                "G3": 196.00,
                "B3": 246.94,
                "E4": 329.63
            }
        },
        "half-step": {
            name: "Half Step Down",
            frequencies: {
                "Eb2": 77.78,
                "Ab2": 103.83,
                "Db3": 138.59,
                "Gb3": 185.00,
                "Bb3": 233.08,
                "Eb4": 311.13
            }
        },
        dropD: {
            name: "Drop D",
            frequencies: {
                "D2": 73.42,
                "A2": 110.00,
                "D3": 146.83,
                "G3": 196.00,
                "B3": 246.94,
                "E4": 329.63
            }
        },
        dropC: {
            name: "Drop C",
            frequencies: {
                "C2": 65.41,
                "G2": 98.00,
                "C3": 130.81,
                "F3": 174.61,
                "A3": 220.00,
                "D4": 293.66
            }
        },
        openG: {
            name: "Open G",
            frequencies: {
                "D2": 73.42,
                "G2": 98.00,
                "D3": 146.83,
                "G3": 196.00,
                "B3": 246.94,
                "D4": 293.66
            }
        },
        openE: {
            name: "Open E",
            frequencies: {
                "E2": 82.41,
                "B2": 123.47,
                "E3": 164.81,
                "G#3": 207.65,
                "B3": 246.94,
                "E4": 329.63
            }
        },
        dadgad: {
            name: "DADGAD",
            frequencies: {
                "D2": 73.42,
                "A2": 110.00,
                "D3": 146.83,
                "G3": 196.00,
                "A3": 220.00,
                "D4": 293.66
            }
        },
        dadfad: {
            name: "Dm (DADFAD)",
            frequencies: {
                "D2": 73.42,
                "A2": 110.00,
                "D3": 146.83,
                "F3": 174.61,
                "A3": 220.00,
                "D4": 293.66
            }
        }
    };

    let currentTuning = "standard";
    let stringFrequencies = tunings[currentTuning].frequencies;

    // DOM Elements
    const button = document.getElementById('startButton');
    const marker = document.getElementById('marker');
    const status = document.getElementById('status');
    const currentNote = document.getElementById('currentNote');
    const frequency = document.getElementById('frequency');
    const volumeLevel = document.getElementById('volumeLevel');
    const stringGrid = document.getElementById('stringGrid');
    const missionStatus = document.getElementById('missionStatus');
    const missionTime = document.getElementById('missionTime');
    const missionTimer = document.getElementById('mission-timer');
    const tuningSelect = document.getElementById('tuningSelect');

    // State variables
    let isRunning = false;
    let audioContext = null;
    let analyser = null;
    let source = null;
    let missionStartTime = null;
    const smoothingWindow = [];
    const maxSmoothingWindowSize = 8;
    let tuningTimers = {};
    const TUNE_THRESHOLD_CENTS = 10;
    const TUNE_DURATION_MS = 500; // Time needed to stay in tune (500ms)

    // Event Listeners
    button.addEventListener('click', handleStartStop);
    tuningSelect.addEventListener('change', (e) => {
        currentTuning = e.target.value;
        stringFrequencies = tunings[currentTuning].frequencies;
        
        // Reset all tuning states
        tuningTimers = {};
        document.querySelectorAll('.string-item').forEach(item => {
            item.classList.remove('in-tune');
        });
        
        // Reinitialize the string grid with new frequencies
        stringGrid.innerHTML = '';
        initializeStringGrid();
        
        // Update status
        status.textContent = `TUNING CHANGED TO ${tunings[currentTuning].name}`;
    });

    // Initialize everything - ONLY ONCE
    initializeStringGrid();
    startMissionClock();
    addTuningGuides();
    addCentsIndicator();
    createEnhancedFlameEffects();
    setupFlameEffects();

    // Initialize marker with cents indicator
    marker.innerHTML = '<div class="cents-indicator">0¢</div>';

    // Add CSS styles programmatically
    const style = document.createElement('style');
    style.textContent = `
    .cents-indicator {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 36px;
        height: 36px;
        background: rgba(15, 23, 42, 0.9);
        border: 2px solid var(--primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Share Tech Mono', monospace;
        font-weight: 600;
        font-size: 0.75rem;
        color: var(--text-primary);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
        backdrop-filter: blur(4px);
        z-index: 20;
        pointer-events: none;
    }

    .marker.close-range .cents-indicator {
        width: 42px;
        height: 42px;
        font-size: 0.875rem;
        background: rgba(15, 23, 42, 0.95);
        border-width: 3px;
    }

    .marker.in-tune .cents-indicator {
        border-color: var(--success);
        box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
        background: rgba(15, 23, 42, 0.98);
        width: 48px;
        height: 48px;
        font-size: 1rem;
        font-weight: 700;
        color: var(--success);
    }`;

    document.head.appendChild(style);

    function initializeStringGrid() {
        Object.entries(stringFrequencies).forEach(([note, freq], index) => {
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
    function activateBooster(note) {
        console.log('Activating booster for note:', note);
        
        const stringElement = document.getElementById(`string-${note}`);
        if (stringElement && !stringElement.classList.contains('in-tune')) {
            stringElement.classList.add('in-tune');
            
            // Create dynamic booster mapping based on current tuning
            const stringPositions = Object.keys(stringFrequencies);
            const boosterNum = stringPositions.indexOf(note) + 1;
            
            console.log('Mapped booster number:', boosterNum, 'for note:', note);
            
            if (boosterNum > 0) { // Check if valid booster number (1-6)
                const nozzle = document.querySelector(`.nozzle-${boosterNum}`);
                if (nozzle) {
                    // Get the nozzle's position relative to the SVG
                    const nozzleRect = nozzle.getBoundingClientRect();
                    const svgRect = document.querySelector('.guitar-base').getBoundingClientRect();
                    
                    // Calculate relative position
                    const nozzleX = nozzle.cx.baseVal.value;
                    const nozzleY = nozzle.cy.baseVal.value;
                    
                    console.log('Nozzle position:', nozzleX, nozzleY);
                    
                    // Remove existing flame
                    const existingFlame = document.querySelector(`.enhanced-flame-group-${boosterNum}`);
                    if (existingFlame) {
                        existingFlame.remove();
                    }
                    
                    // Create new flame
                    const flameGroup = enhanceBoosterFlames(boosterNum, nozzleX, nozzleY);
                    
                    // Get the engine section
                    const engineSection = document.querySelector('.engine-section');
                    if (engineSection) {
                        engineSection.appendChild(flameGroup);
                        console.log('Flame added to engine section');
                    }
                }
            }
        }
    }
    
    function getBoosterAngle(boosterNum) {
        const angles = {
            1: -30,
            2: -20,
            3: -10,
            4: 30,
            5: 20,
            6: 10
        };
        return angles[boosterNum] || 0;
    }
    function startMissionClock() {
        setInterval(() => {
            if (missionStartTime) {
                const elapsed = Date.now() - missionStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                missionTime.textContent = `T+${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    async function handleStartStop() {
        if (!isRunning) {
            try {
                await startTuner();
                missionStartTime = Date.now();
            } catch (error) {
                handleError(error);
            }
        } else {
            stopTuner();
            missionStartTime = null;
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
        source.connect(analyser);

        updateButtonState(true);
        isRunning = true;
        updatePitch();
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
        isRunning = false;
        updateButtonState(false);
        resetDisplays();
        
        // Reset all tuning timers
        tuningTimers = {};
        
        // Reset all boosters
        document.querySelectorAll('.string-item').forEach(item => {
            item.classList.remove('in-tune');
        });
    }

    function updateButtonState(running) {
        button.classList.toggle('active', running);
        button.querySelector('span').textContent = running ? 'ABORT MISSION' : 'ACTIVATE TUNER';
        missionStatus.textContent = running ? 'TUNING ACTIVE' : 'SYSTEMS READY';
    }

    function resetDisplays() {
        currentNote.textContent = '-';
        frequency.textContent = '-';
        status.textContent = 'AWAITING ACTIVATION';
        marker.style.left = '50%';
        volumeLevel.style.width = '0%';
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
    }

    function processPitch(buffer) {
        const detectedPitch = yin(buffer, audioContext.sampleRate);
        
        if (detectedPitch) {
            const smoothedFrequency = smoothFrequency(detectedPitch);
            
            const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
            const volumeThreshold = 0.005;
            
            if (rms < volumeThreshold) {
                return;
            }
            
            const closestNote = findClosestNote(smoothedFrequency);
            const targetFreq = stringFrequencies[closestNote.note];
            
            // Log values for debugging
            console.log('Detected:', smoothedFrequency.toFixed(2), 'Target:', targetFreq);
            const cents = getCents(smoothedFrequency, targetFreq);
            console.log('Cents:', cents);
            
            updateTunerDisplays(smoothedFrequency);
        } else {
            status.textContent = 'NO SIGNAL DETECTED';
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
        // Increase window size for smoother movement
        if (smoothingWindow.length >= maxSmoothingWindowSize) {
            smoothingWindow.shift();
        }
        smoothingWindow.push(freq);
        
        // Use exponential moving average for smoother results
        const alpha = 0.3; // Lower alpha = smoother movement
        return smoothingWindow.reduce((sum, f, i) => {
            return sum + f * Math.pow(alpha * (1 - alpha), smoothingWindow.length - 1 - i);
        }, 0) / smoothingWindow.reduce((sum, _, i) => {
            return sum + Math.pow(alpha * (1 - alpha), smoothingWindow.length - 1 - i);
        }, 0);
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
        // Avoid division by zero or negative numbers
        if (frequency <= 0 || targetFrequency <= 0) {
            console.log('Invalid frequency values:', frequency, targetFrequency);
            return 0;
        }
        
        // Calculate cents using the formula: cents = 1200 * log2(f2/f1)
        const cents = Math.round(1200 * Math.log2(frequency / targetFrequency));
        
        // Log the calculation
        console.log(`Cents calculation: ${frequency} Hz / ${targetFrequency} Hz = ${cents} cents`);
        
        // Limit the range to ±100 cents for better readability
        return Math.max(-100, Math.min(100, cents));
    }

    function updateTunerDisplays(detectedFrequency) {
        frequency.textContent = `${detectedFrequency.toFixed(1)} Hz`;
        const closestNote = findClosestNote(detectedFrequency);
        currentNote.textContent = closestNote.note;
        
        const targetFreq = stringFrequencies[closestNote.note];
        const cents = getCents(detectedFrequency, targetFreq);
        
        // Log for debugging
        console.log(`Note: ${closestNote.note}, Detected: ${detectedFrequency.toFixed(1)} Hz, Target: ${targetFreq} Hz, Cents: ${cents}`);
        
        updateTunerVisualization(cents, closestNote.note);
    }

    function updateTunerVisualization(cents, note) {
        const maxCents = Math.abs(cents) < 25 ? 25 : 50;
        const smoothingFactor = 0.15;
        
        const targetPosition = 50 + (cents * 50) / maxCents;
        const currentPosition = parseFloat(marker.style.left) || 50;
        const newPosition = currentPosition + (targetPosition - currentPosition) * smoothingFactor;
        
        marker.style.left = `${Math.min(100, Math.max(0, newPosition))}%`;
        marker.classList.toggle('close-range', Math.abs(cents) < 25);

        // Update cents indicator
        const centsIndicator = marker.querySelector('.cents-indicator');
        if (centsIndicator) {
            const precision = Math.abs(cents) < 25 ? 1 : 0;
            const centsValue = Math.abs(cents).toFixed(precision);
            const sign = cents > 0 ? '+' : (cents < 0 ? '-' : '');
            centsIndicator.textContent = `${sign}${centsValue}¢`;
        }

        // Only update in-tune state after holding for 1 second
        if (Math.abs(cents) < TUNE_THRESHOLD_CENTS) {
            if (!tuningTimers[note]) {
                tuningTimers[note] = {
                    startTime: Date.now(),
                    inTune: false
                };
            }
            
            const timeInTune = Date.now() - tuningTimers[note].startTime;
            
            if (timeInTune >= TUNE_DURATION_MS) {
                if (!tuningTimers[note].inTune) {
                    marker.classList.add('in-tune');
                    tuningTimers[note].inTune = true;
                    activateBooster(note);
                    checkAllBoosters();
                }
            }
            
            // Show progress towards in-tune state
            const progress = Math.min(100, (timeInTune / TUNE_DURATION_MS) * 100);
            status.textContent = `HOLD STEADY: ${Math.floor(progress)}% 🚀`;
        } else {
            // Reset timer if note goes out of tune
            if (tuningTimers[note]) {
                tuningTimers[note] = null;
            }
            marker.classList.remove('in-tune');
            
            const direction = cents > 0 ? 'TUNE DOWN ↓' : 'TUNE UP ↑';
            const precision = Math.abs(cents) < 25 ? 1 : 0;
            status.textContent = `${direction} (${Math.abs(cents).toFixed(precision)})`;
        }
    }

    function activateThruster(element) {
        element.querySelector('.thruster-effect').style.opacity = '1';
    }

    function checkAllBoosters() {
        const totalBoosters = Object.keys(stringFrequencies).length;
        const activeBoosters = document.querySelectorAll('.string-item.in-tune').length;
        
        if (activeBoosters === totalBoosters) {
            status.textContent = 'ALL BOOSTERS SYNCHRONIZED 🚀';
            
            // Add a slight delay before launch to show the success message
            setTimeout(() => {
                const rocket = document.querySelector('.guitar-rocket');
                const launchComplex = document.querySelector('.launch-complex');
                
                if (rocket) {
                    rocket.classList.add('launching');
                    if (launchComplex) {
                        launchComplex.classList.add('launching');
                    }
                    
                    // Add launch effects
                    document.body.classList.add('launch-in-progress');
                    
                    // Reset the rocket position after animation completes
                    setTimeout(() => {
                        rocket.classList.remove('launching');
                        if (launchComplex) {
                            launchComplex.classList.remove('launching');
                        }
                        document.body.classList.remove('launch-in-progress');
                        stopTuner();
                    }, 8000);
                }
            }, 1000);
        }
    }

    function indicateNoPitch() {
        currentNote.textContent = '-';
        frequency.textContent = '-';
        status.textContent = 'NO SIGNAL DETECTED';
    }

    // Add this function to create tuning guides
    function addTuningGuides() {
        const tunerDisplay = document.querySelector('.tuner-display');
        const guides = document.createElement('div');
        guides.className = 'tuning-guides';
        
        const leftGuide = document.createElement('div');
        leftGuide.className = 'tuning-guide left-10';
        
        const rightGuide = document.createElement('div');
        rightGuide.className = 'tuning-guide right-10';
        
        guides.appendChild(leftGuide);
        guides.appendChild(rightGuide);
        tunerDisplay.appendChild(guides);
    }

    // Add this function to create the cents indicator
    function addCentsIndicator() {
        const marker = document.getElementById('marker');
        const centsIndicator = document.createElement('div');
        centsIndicator.className = 'cents-indicator';
        centsIndicator.textContent = '0¢';
        marker.appendChild(centsIndicator);
    }
});

function createEnhancedFlameEffects() {
    const svg = document.querySelector('.guitar-base');
    if (!svg) {
        console.error('SVG element not found');
        return;
    }

    let defs = svg.querySelector('defs');
    if (!defs) {
        console.error('Defs section not found in SVG');
        return;
    }
}

function setupFlameEffects() {
    const flameGroups = document.querySelectorAll('#exhaustEffects g');
    flameGroups.forEach((group, index) => {
        const mainFlame = group.querySelector('path[fill="url(#flameGradient)"]');
        if (mainFlame) {
            mainFlame.classList.add('thrust-flame');
            mainFlame.classList.add(`flame-${index}`);
        }
        
        const coreFlame = group.querySelector('path[fill="white"]');
        if (coreFlame) {
            coreFlame.classList.add('core-flame');
        }
        
        const diamonds = group.querySelectorAll('ellipse');
        diamonds.forEach(diamond => {
            diamond.classList.add('shock-diamond');
        });
    });
}

function enhanceBoosterFlames(boosterNum, nozzleX, nozzleY) {
    console.log(`Creating flame for booster ${boosterNum} at position:`, nozzleX, nozzleY);
    
    const flameGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    flameGroup.setAttribute('class', `enhanced-flame-group-${boosterNum}`);
    
    // Adjust coordinates based on booster position
    let adjustedX = nozzleX;
    let adjustedY = nozzleY;
    
    // Create main flame
    const mainFlame = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mainFlame.setAttribute('class', 'flame');
    mainFlame.setAttribute('fill', 'url(#enhancedCoreFlame)');
    
    // Adjust flame dimensions
    const flameHeight = 40;
    const flameWidth = 10;
    
    // Create flame path starting from nozzle position
    const flamePath = `
        M ${adjustedX - flameWidth/2} ${adjustedY}
        Q ${adjustedX - flameWidth/2} ${adjustedY + flameHeight/2},
          ${adjustedX} ${adjustedY + flameHeight}
        Q ${adjustedX + flameWidth/2} ${adjustedY + flameHeight/2},
          ${adjustedX + flameWidth/2} ${adjustedY}
        Q ${adjustedX} ${adjustedY + 5},
          ${adjustedX - flameWidth/2} ${adjustedY}
    `;
    
    mainFlame.setAttribute('d', flamePath);
    flameGroup.appendChild(mainFlame);
    
    // Add shock diamonds
    const diamondPositions = [0.3, 0.6, 0.8];
    diamondPositions.forEach((pos) => {
        const diamond = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        diamond.setAttribute('class', 'shock-diamond');
        diamond.setAttribute('cx', adjustedX);
        diamond.setAttribute('cy', adjustedY + (flameHeight * pos));
        diamond.setAttribute('r', 2);
        diamond.setAttribute('fill', 'url(#enhancedShockDiamond)');
        flameGroup.appendChild(diamond);
    });
    
    // Add outer glow
    const outerFlame = document.createElementNS("http://www.w3.org/2000/svg", "path");
    outerFlame.setAttribute('class', 'flame outer-flame');
    outerFlame.setAttribute('fill', 'url(#enhancedOuterFlame)');
    
    const outerFlamePath = `
        M ${adjustedX - flameWidth} ${adjustedY}
        Q ${adjustedX - flameWidth} ${adjustedY + flameHeight/2},
          ${adjustedX} ${adjustedY + flameHeight * 0.8}
        Q ${adjustedX + flameWidth} ${adjustedY + flameHeight/2},
          ${adjustedX + flameWidth} ${adjustedY}
        Q ${adjustedX} ${adjustedY + 5},
          ${adjustedX - flameWidth} ${adjustedY}
    `;
    
    outerFlame.setAttribute('d', outerFlamePath);
    flameGroup.insertBefore(outerFlame, mainFlame);
    
    // Log the created flame group for debugging
    console.log('Created flame group:', flameGroup);
    
    return flameGroup;
}