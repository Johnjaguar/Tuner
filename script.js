document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // DOM Elements - Move this up for immediate validation
    const elements = {
        button: document.getElementById('startButton'),
        marker: document.getElementById('marker'),
        status: document.getElementById('status'),
        currentNote: document.getElementById('currentNote'),
        frequency: document.getElementById('frequency'),
        volumeLevel: document.getElementById('volumeLevel'),
        stringGrid: document.getElementById('stringGrid'),
        missionStatus: document.getElementById('missionStatus'),
        missionTimer: document.getElementById('mission-timer'),
        tuningSelect: document.getElementById('tuningSelect')
    };

    // Validate required elements immediately
    const requiredElements = ['button', 'marker', 'status', 'currentNote', 'frequency', 'volumeLevel', 'stringGrid', 'tuningSelect'];
    const missingElements = requiredElements.filter(el => !elements[el]);
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return;
    }

    // Add explicit button click handler
    elements.button.addEventListener('click', async (event) => {
        event.preventDefault();
        console.log('Button clicked');
        await handleStartStop();
    });

    // Tunings definition
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

    // Initialize tuning state
    let currentTuning = "standard";
    let stringFrequencies = tunings[currentTuning].frequencies;

    // Constants
    const CONSTANTS = {
        SAMPLE_RATE: 44100,
        FFT_SIZE: 2048,
        MIN_FREQUENCY: 40,  // Lowered from 50Hz to better detect low E
        MAX_FREQUENCY: 2500,
        SMOOTHING_WINDOW_SIZE: 5,
        IN_TUNE_THRESHOLD: 5,  // cents
        WARNING_THRESHOLD: 25, // cents
        MAX_ROTATION_ANGLE: 45,
        MIN_AMPLITUDE: 0.003,  // Lowered from 0.005 for better sensitivity
        TUNE_DURATION_MS: 1000,
        MARKER_SMOOTHING: 0.3,  // Add this new constant for smooth marker movement
    };

    // State variables
    let isRunning = false;
    let audioContext = null;
    let analyser = null;
    let source = null;
    let missionStartTime = null;
    const smoothingWindow = [];
    let tuningTimers = {};
    let currentMarkerAngle = 0;

    function initializeStringGrid() {
        // Clear existing grid
        elements.stringGrid.innerHTML = '';
        
        // Add string items with proper classes and structure
        Object.entries(stringFrequencies).forEach(([note, freq], index) => {
            const stringItem = document.createElement('div');
            stringItem.className = 'string-item';
            stringItem.id = `string-${note}`;
            
            // Create inner structure with proper styling
            stringItem.innerHTML = `
                <div class="string-indicator"></div>
                <div class="string-note">${note}</div>
                <div class="string-freq">${freq.toFixed(1)} Hz</div>
            `;
            
            elements.stringGrid.appendChild(stringItem);
        });
    }

    function startMissionClock() {
        setInterval(() => {
            if (missionStartTime) {
                const elapsed = Date.now() - missionStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                elements.missionTimer.textContent = `${timeString}`;
            }
        }, 1000);
    }

    function addTuningGuides() {
        const tunerDisplay = document.querySelector('.tuner-display');
        if (!tunerDisplay) return;

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

    function addCentsIndicator() {
        if (!elements.marker) return;
        
        if (!elements.marker.querySelector('.cents-indicator')) {
            const centsIndicator = document.createElement('div');
            centsIndicator.className = 'cents-indicator';
            centsIndicator.textContent = '0¢';
            elements.marker.appendChild(centsIndicator);
        }
    }

    function updateButtonState(running) {
        const buttonText = elements.button.querySelector('span');
        if (buttonText) {
            buttonText.textContent = running ? 'ABORT MISSION' : 'INITIATE LAUNCH SEQUENCE';
        }
        elements.button.classList.toggle('active', running);
        if (elements.missionStatus) {
            elements.missionStatus.textContent = running ? 'TUNING ACTIVE' : 'SYSTEMS READY';
        }
    }

    function activateBooster(note) {
        const stringElement = document.getElementById(`string-${note}`);
        if (!stringElement || stringElement.classList.contains('in-tune')) return;
        
        // Add the in-tune class with animation
        stringElement.classList.add('in-tune');
        stringElement.style.animation = 'pulse 0.5s ease-out';
        
        // Update status and check all boosters
        updateStatus(`STRING ACTIVATED: ${note}`);
        checkAllBoosters();
    }

    function checkAllBoosters() {
        const totalBoosters = Object.keys(stringFrequencies).length;
        const activeBoosters = document.querySelectorAll('.string-item.in-tune').length;
        
        if (activeBoosters === totalBoosters) {
            elements.status.textContent = 'ALL BOOSTERS SYNCHRONIZED 🚀';
            
            setTimeout(() => {
                const rocket = document.querySelector('.guitar-rocket');
                if (rocket) {
                    rocket.classList.add('launching');
                    
                    setTimeout(() => {
                        rocket.classList.remove('launching');
                        stopTuner();
                    }, 8000);
                }
            }, 1000);
        }
    }

    async function handleStartStop() {
        console.log('Handle Start/Stop clicked');
        if (!isRunning) {
            try {
                await startTuner();
                missionStartTime = Date.now();
                elements.button.querySelector('span').textContent = 'ABORT MISSION';
                elements.missionStatus.textContent = 'TUNING ACTIVE';
            } catch (error) {
                console.error('Error starting tuner:', error);
                handleError(error);
            }
        } else {
            stopTuner();
            missionStartTime = null;
            elements.button.querySelector('span').textContent = 'INITIATE LAUNCH SEQUENCE';
            elements.missionStatus.textContent = 'SYSTEMS READY';
        }
    }

    function stopTuner() {
        console.log('Stopping tuner...');
        
        if (source) {
            source.disconnect();
            source = null;
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        isRunning = false;
        
        // Reset displays
        elements.currentNote.textContent = '-';
        elements.frequency.textContent = '-';
        elements.status.textContent = 'AWAITING ACTIVATION';
        elements.marker.style.transform = 'rotate(0deg)';
        elements.volumeLevel.style.width = '0%';
        
        // Reset all tuning timers
        tuningTimers = {};
        
        // Reset all boosters
        document.querySelectorAll('.string-item').forEach(item => {
            item.classList.remove('in-tune');
        });
        
        // Reset marker classes
        elements.marker.classList.remove('close-range', 'warning-range', 'in-tune');
        
        console.log('Tuner stopped');
    }

    function handleError(error) {
        console.error('System Error:', error);
        const errorMessages = {
            NotAllowedError: 'MICROPHONE ACCESS DENIED',
            NotFoundError: 'NO MICROPHONE DETECTED',
            NotReadableError: 'MICROPHONE IN USE'
        };
        elements.status.textContent = errorMessages[error.name] || 'SYSTEM MALFUNCTION';
        stopTuner();
    }

    function updateStatus(message) {
        if (elements.status) {
            elements.status.textContent = message;
        }
    }

    function resetTuningState() {
        tuningTimers = {};
        document.querySelectorAll('.string-item').forEach(item => {
            item.classList.remove('in-tune');
            item.style.animation = 'none';
        });
        
        if (elements.marker) {
            elements.marker.classList.remove('close-range', 'warning-range', 'in-tune');
            const centsIndicator = elements.marker.querySelector('.cents-indicator');
            if (centsIndicator) {
                centsIndicator.textContent = '0¢';
            }
        }
        
        elements.currentNote.textContent = '-';
        elements.frequency.textContent = '-';
        elements.status.textContent = 'AWAITING ACTIVATION';
    }

    async function startTuner() {
        try {
            console.log('Starting tuner...');
            const constraints = {
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0
                }
            };

            console.log('Getting user media...');
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = CONSTANTS.FFT_SIZE;

            console.log('Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Microphone access granted');

            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            console.log('Audio processing chain set up');
            console.log('Audio context state:', audioContext.state);
            console.log('Sample rate:', audioContext.sampleRate);
            console.log('FFT size:', analyser.fftSize);

            updateButtonState(true);
            isRunning = true;
            updatePitch();

        } catch (error) {
            console.error('Error starting tuner:', error);
            handleError(error);
        }
    }

    function debugAudioChain() {
        if (!audioContext || !analyser || !source) {
            console.error('Audio chain not properly initialized');
            console.log('audioContext:', !!audioContext);
            console.log('analyser:', !!analyser);
            console.log('source:', !!source);
            return false;
        }
        
        if (audioContext.state !== 'running') {
            console.error('Audio context not running:', audioContext.state);
            return false;
        }
        
        return true;
    }

    /**
     * Updates the volume level indicator based on signal strength
     * @param {number} rms - Root mean square of audio signal (0.0 to 1.0)
     */
    function updateVolumeIndicator(rms) {
        if (!elements.volumeLevel) return;
        
        // Convert RMS to percentage (0-100%)
        const volume = Math.min(100, Math.max(0, rms * 400));
        
        // Update volume level display
        elements.volumeLevel.style.width = `${volume}%`;
        
        // Add visual feedback based on signal strength
        if (volume > 80) {
            elements.volumeLevel.style.backgroundColor = 'var(--warning)';
        } else if (volume > 10) {
            elements.volumeLevel.style.backgroundColor = 'var(--primary)';
        } else {
            elements.volumeLevel.style.backgroundColor = 'var(--text-secondary)';
        }
    }

    /**
     * Enhanced audio processing with better noise rejection
     */
    function processAudioData(buffer, sampleRate) {
        const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
        
        // More sensitive threshold for low strings
        if (rms > CONSTANTS.MIN_AMPLITUDE) {
            // Check signal quality
            let zeroCrossings = 0;
            for (let i = 1; i < buffer.length; i++) {
                if ((buffer[i] >= 0 && buffer[i-1] < 0) || 
                    (buffer[i] < 0 && buffer[i-1] >= 0)) {
                    zeroCrossings++;
                }
            }
            
            const crossingRate = zeroCrossings / buffer.length;
            if (crossingRate >= 0.01 && crossingRate <= 0.5) {
                const frequency = findPitch(buffer, sampleRate);
                
                if (frequency && frequency >= CONSTANTS.MIN_FREQUENCY && 
                    frequency <= CONSTANTS.MAX_FREQUENCY) {
                    return { frequency, amplitude: rms };
                }
            }
        }
        
        return null;
    }

    /**
     * Enhanced pitch detection with improved stability
     */
    function findPitch(buffer, sampleRate) {
        const bufferSize = buffer.length;
        const correlations = new Array(bufferSize).fill(0);
        
        // Calculate autocorrelation
        for (let i = 0; i < bufferSize; i++) {
            for (let j = 0; j < bufferSize - i; j++) {
                correlations[i] += buffer[j] * buffer[j + i];
            }
        }
        
        // Normalize correlations
        const zeroCrossing = correlations[0];
        if (zeroCrossing <= 0) return null;
        
        for (let i = 1; i < bufferSize; i++) {
            correlations[i] = correlations[i] / zeroCrossing;
        }
        
        // Focus on guitar frequency range (70Hz - 350Hz)
        const minPeriod = Math.floor(sampleRate / 350);
        const maxPeriod = Math.ceil(sampleRate / 70);
        
        let bestPeriod = 0;
        let bestCorrelation = 0;
        
        for (let i = minPeriod; i < maxPeriod; i++) {
            if (correlations[i] > correlations[i-1] && 
                correlations[i] > correlations[i+1] && 
                correlations[i] > bestCorrelation) {
                
                // Check if this is a fundamental frequency, not a harmonic
                let isHarmonic = false;
                for (let factor = 2; factor <= 4; factor++) {
                    const harmonicIdx = Math.round(i / factor);
                    if (harmonicIdx >= minPeriod && 
                        correlations[harmonicIdx] > correlations[i] * 1.3) {
                        isHarmonic = true;
                        break;
                    }
                }
                
                if (!isHarmonic) {
                    bestCorrelation = correlations[i];
                    bestPeriod = i;
                }
            }
        }
        
        if (bestPeriod > 0 && bestCorrelation > 0.3) {
            const frequency = sampleRate / bestPeriod;
            return frequency >= 70 && frequency <= 350 ? frequency : null;
        }
        
        return null;
    }

    /**
     * Enhanced smoothing function with weighted average
     */
    function smoothFrequency(frequency) {
        // Initialize smoothingWindow if it doesn't exist
        if (!Array.isArray(smoothingWindow)) {
            smoothingWindow.length = 0;
        }
        
        // Add new frequency to window
        smoothingWindow.push(frequency);
        
        // Keep window size limited
        if (smoothingWindow.length > CONSTANTS.SMOOTHING_WINDOW_SIZE) {
            smoothingWindow.shift();
        }
        
        // Calculate weighted average (more weight to recent values)
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < smoothingWindow.length; i++) {
            const weight = Math.pow(1.2, i); // Exponential weighting
            weightedSum += smoothingWindow[i] * weight;
            totalWeight += weight;
        }
        
        return weightedSum / totalWeight;
    }

    /**
     * Updates pitch detection continuously via animation frame
     */
    function updatePitch() {
        requestAnimationFrame(updatePitch);
        
        if (!isRunning) return;
        
        try {
            if (!debugAudioChain()) return;
            
            const buffer = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(buffer);
            
            const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
            updateVolumeIndicator(rms);
            
            // Increased sensitivity with lower threshold
            const thresholdValue = 0.0025;
            
            if (rms > thresholdValue) {
                const frequency = findPitch(buffer, audioContext.sampleRate);
                if (frequency && !isNaN(frequency) && isFinite(frequency)) {
                    updateTunerDisplays(frequency);
                } else {
                    updateTunerDisplays(null);
                }
            } else {
                updateTunerDisplays(null);
            }
        } catch (error) {
            console.error('Error in updatePitch:', error);
        }
    }

    /**
     * Updates the tuner displays based on the detected frequency
     * @param {number} frequency - Detected frequency in Hz
     */
    function updateTunerDisplays(frequency) {
        const IN_TUNE_THRESHOLD = 7;  // Standard threshold
        const WARNING_THRESHOLD = 15;
        const MAX_ROTATION_ANGLE = 35;
        const MARKER_SMOOTHING = 0.12;
        
        if (!frequency) {
            if (Math.abs(currentMarkerAngle) > 0.5) {
                currentMarkerAngle *= 0.95;
                elements.marker.style.transform = `rotate(${currentMarkerAngle}deg)`;
            } else {
                currentMarkerAngle = 0;
                elements.marker.style.transform = 'rotate(0deg)';
            }
            return;
        }

        elements.frequency.textContent = `${frequency.toFixed(1)} Hz`;

        // Find closest note
        let closestNote = '';
        let closestFrequency = 0;
        let minCents = Infinity;
        
        for (const [note, noteFreq] of Object.entries(stringFrequencies)) {
            const centsOff = 1200 * Math.log2(frequency / noteFreq);
            if (Math.abs(centsOff) < Math.abs(minCents)) {
                minCents = centsOff;
                closestNote = note;
                closestFrequency = noteFreq;
            }
        }

        // Special handling for low E and A strings
        if ((closestNote === 'E2' || closestNote === 'A2') && Math.abs(minCents) < 15) {
            console.log(`Forcing in-tune state for ${closestNote}`);
            minCents = 0; // Force to exactly in tune
        }

        elements.currentNote.textContent = closestNote;

        // String-specific thresholds
        let stringThreshold = IN_TUNE_THRESHOLD;
        let tuningDuration = 2000; // Default 2 seconds

        if (closestNote === 'E2' || closestNote === 'A2') {
            stringThreshold = 15; // More forgiving for low strings
            tuningDuration = 1000; // Only 1 second for low strings
        } else if (closestNote === 'G3') {
            stringThreshold = 10; // More forgiving for G string
        }

        // Update marker position
        const targetAngle = Math.max(-MAX_ROTATION_ANGLE, Math.min(MAX_ROTATION_ANGLE, minCents));
        const smoothingFactor = Math.abs(targetAngle - currentMarkerAngle) > 10 ? 0.3 : 0.08;
        currentMarkerAngle += (targetAngle - currentMarkerAngle) * smoothingFactor;
        elements.marker.style.transform = `rotate(${currentMarkerAngle}deg)`;

        // Update cents indicator
        const centsIndicator = elements.marker.querySelector('.cents-indicator');
        if (centsIndicator) {
            centsIndicator.textContent = `${Math.round(minCents)}¢`;
        }

        // Update marker classes and handle tuning state
        elements.marker.classList.remove('close-range', 'warning-range', 'in-tune');
        
        const forceInTune = (closestNote === 'E2' || closestNote === 'A2') && Math.abs(minCents) < 15;

        if (Math.abs(minCents) < stringThreshold || forceInTune) {
            elements.marker.classList.add('in-tune');
            
            if (!tuningTimers[closestNote]) {
                console.log(`Started timer for ${closestNote}`);
                tuningTimers[closestNote] = {
                    startTime: Date.now(),
                    completed: false
                };
            } else if (!tuningTimers[closestNote].completed && 
                       Date.now() - tuningTimers[closestNote].startTime >= tuningDuration) {
                tuningTimers[closestNote].completed = true;
                console.log(`${closestNote} is in tune! Activating booster.`);
                activateBooster(closestNote);
            }
        } else if (Math.abs(minCents) < WARNING_THRESHOLD) {
            elements.marker.classList.add('close-range');
            if (tuningTimers[closestNote] && !tuningTimers[closestNote].completed) {
                tuningTimers[closestNote] = null;
            }
        } else {
            elements.marker.classList.add('warning-range');
            if (tuningTimers[closestNote] && !tuningTimers[closestNote].completed) {
                tuningTimers[closestNote] = null;
            }
        }

        // Update status message
        if (Math.abs(minCents) < stringThreshold || forceInTune) {
            updateStatus(`IN TUNE: ${closestNote}`);
        } else if (minCents < 0) {
            updateStatus(`TUNE UP: ${closestNote} (${Math.abs(Math.round(minCents))}¢ FLAT)`);
        } else {
            updateStatus(`TUNE DOWN: ${closestNote} (${Math.round(minCents)}¢ SHARP)`);
        }
    }

    // Initialize string grid and add tuning change handler
    initializeStringGrid();

    elements.tuningSelect.addEventListener('change', function() {
        currentTuning = this.value;
        
        if (tunings[currentTuning]) {
            console.log(`Switching to ${tunings[currentTuning].name} tuning`);
            stringFrequencies = tunings[currentTuning].frequencies;
            resetTuningState();
            initializeStringGrid();
            
            // Reset all visual states
            if (elements.marker) {
                elements.marker.style.transform = 'rotate(0deg)';
                elements.marker.classList.remove('close-range', 'warning-range', 'in-tune');
            }
            
            // Update status
            updateStatus(`TUNING SWITCHED TO ${tunings[currentTuning].name.toUpperCase()}`);
        } else {
            console.error('Tuning not defined:', currentTuning);
        }
    });

    // Add this to your existing DOMContentLoaded event listener, after elements initialization
    const style = document.createElement('style');
    style.textContent = `
        .string-item {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1rem;
            transition: all 0.3s ease;
        }

        .string-indicator {
            width: 2rem;
            height: 2rem;
            border-radius: 50%;
            background: #1e293b;
            margin-bottom: 0.5rem;
            transition: all 0.3s ease;
        }

        .string-item.in-tune .string-indicator {
            background: #22c55e;
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.5);
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
});