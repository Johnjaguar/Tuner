document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Constants
    const stringFrequencies = {
        "E2": 82.41,
        "A2": 110.00,
        "D3": 146.83,
        "G3": 196.00,
        "B3": 246.94,
        "E4": 329.63
    };

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
    // State variables
    let isRunning = false;
    let audioContext = null;
    let analyser = null;
    let source = null;
    let missionStartTime = null;
    const smoothingWindow = [];
    const maxSmoothingWindowSize = 5;

    // Initialize grid and start mission clock
    initializeStringGrid();
    startMissionClock();

    // Event Listeners
    button.addEventListener('click', handleStartStop);

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
        const stringElement = document.getElementById(`string-${note}`);
        if (stringElement) {
            stringElement.classList.add('in-tune');
            
            const boosterMap = {
                'E4': 1,
                'B3': 2,
                'G3': 3,
                'D3': 4,
                'A2': 5,
                'E2': 6
            };
            
            const boosterNum = boosterMap[note];
            if (boosterNum) {
                const booster = document.querySelector(`.booster-${boosterNum}`);
                const nozzle = document.querySelector(`.nozzle-${boosterNum}`);
                
                if (booster && nozzle) {
                    // Enhance booster appearance
                    booster.style.fill = '#ffd700';
                    booster.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,0.7))';
                    nozzle.style.fill = '#ff4500';
                    nozzle.style.filter = 'drop-shadow(0 0 5px rgba(255,69,0,0.8))';
                    
                    // Create enhanced flame effect
                    if (!document.querySelector(`.flame-group-${boosterNum}`)) {
                        const flameGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        flameGroup.setAttribute('class', `flame-group flame-group-${boosterNum}`);
                        
                        // Base flame
                        const baseFlame = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        baseFlame.setAttribute('class', 'base-flame');
                        baseFlame.setAttribute('fill', 'url(#coreFlame)');
                        
                        // Inner flame
                        const innerFlame = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        innerFlame.setAttribute('class', 'inner-flame');
                        innerFlame.setAttribute('fill', 'white');
                        
                        // Outer flame
                        const outerFlame = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        outerFlame.setAttribute('class', 'outer-flame');
                        outerFlame.setAttribute('fill', 'url(#outerFlame)');
                        
                        // Calculate flame paths based on nozzle position
                        const nozzleX = nozzle.cx.baseVal.value;
                        const nozzleY = nozzle.cy.baseVal.value;
                        const flameHeight = 30;
                        const flameWidth = 15;
                        
                        // Set flame paths
                        baseFlame.setAttribute('d', `
                            M${nozzleX - flameWidth/2} ${nozzleY}
                            Q${nozzleX} ${nozzleY + flameHeight * 0.7}
                            ${nozzleX} ${nozzleY + flameHeight}
                            Q${nozzleX} ${nozzleY + flameHeight * 0.7}
                            ${nozzleX + flameWidth/2} ${nozzleY}
                        `);
                        
                        innerFlame.setAttribute('d', `
                            M${nozzleX - flameWidth/3} ${nozzleY + 5}
                            Q${nozzleX} ${nozzleY + flameHeight * 0.6}
                            ${nozzleX} ${nozzleY + flameHeight * 0.8}
                            Q${nozzleX} ${nozzleY + flameHeight * 0.6}
                            ${nozzleX + flameWidth/3} ${nozzleY + 5}
                        `);
                        
                        outerFlame.setAttribute('d', `
                            M${nozzleX - flameWidth} ${nozzleY}
                            Q${nozzleX} ${nozzleY + flameHeight}
                            ${nozzleX} ${nozzleY + flameHeight * 1.2}
                            Q${nozzleX} ${nozzleY + flameHeight}
                            ${nozzleX + flameWidth} ${nozzleY}
                        `);
                        
                        // Add sparks
                        const sparkGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        sparkGroup.setAttribute('class', 'sparks');
                        
                        for (let i = 0; i < 4; i++) {
                            const spark = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                            spark.setAttribute('class', 'spark');
                            spark.setAttribute('r', '1');
                            spark.setAttribute('fill', 'white');
                            spark.style.setProperty('--spark-x', `${(Math.random() * 10 - 5)}px`);
                            sparkGroup.appendChild(spark);
                        }
                        
                        // Assemble flame group
                        flameGroup.appendChild(outerFlame);
                        flameGroup.appendChild(baseFlame);
                        flameGroup.appendChild(innerFlame);
                        flameGroup.appendChild(sparkGroup);
                        
                        // Add to engine section
                        const engineSection = document.querySelector('.engine-section');
                        engineSection.appendChild(flameGroup);
                        
                        // Set position and rotation based on booster number
                        const angle = getBoosterAngle(boosterNum);
                        flameGroup.style.transform = `rotate(${angle}deg) translateY(15px)`;
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

    function updateTunerDisplays(detectedFrequency) {
        frequency.textContent = `${detectedFrequency.toFixed(1)} Hz`;
        const closestNote = findClosestNote(detectedFrequency);
        currentNote.textContent = closestNote.note;
        
        const cents = getCents(detectedFrequency, closestNote.frequency);
        updateTunerVisualization(cents, closestNote.note);
    }

    function updateTunerVisualization(cents, note) {
    const maxCents = 50;
    const position = 50 + (cents * 50) / maxCents;
    marker.style.left = `${Math.min(100, Math.max(0, position))}%`;

    const stringElement = document.getElementById(`string-${note}`);

    if (Math.abs(cents) < 5) {
        status.textContent = 'BOOSTER ALIGNED 🚀';
        marker.style.backgroundColor = 'var(--success)';
        
        if (stringElement && !stringElement.classList.contains('in-tune')) {
            activateBooster(note);
            checkAllBoosters();
        }
    } else {
        const direction = cents > 0 ? 'TUNE DOWN ↓' : 'TUNE UP ↑';
        status.textContent = `${direction} (${Math.abs(cents).toFixed(1)} cents)`;
        marker.style.backgroundColor = 'var(--primary)';
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
            launchRocket();
            
            setTimeout(() => {
                isLaunching = false;
                launchButton.disabled = false;
                launchButton.textContent = 'Launch Rocket';
            }, 10000);
        }
    }

    function indicateNoPitch() {
        currentNote.textContent = '-';
        frequency.textContent = '-';
        status.textContent = 'NO SIGNAL DETECTED';
    }
});
document.addEventListener('DOMContentLoaded', () => {
    setupFlameEffects();
    setupLaunchSequence();
});

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

function setupLaunchSequence() {
    const launchButton = document.querySelector('.launch-button');
    let isLaunching = false;

    launchButton.addEventListener('click', () => {
        if (isLaunching) return;
        isLaunching = true;
        launchButton.disabled = true;
        launchButton.textContent = 'Launching...';
        
        launchRocket();
        
        setTimeout(() => {
            isLaunching = false;
            launchButton.disabled = false;
            launchButton.textContent = 'Launch Rocket';
        }, 10000);
    });

    // Add hover effects
    launchButton.addEventListener('mouseenter', () => {
        const flames = document.querySelectorAll('.thrust-flame');
        flames.forEach(flame => {
            flame.style.filter = 'drop-shadow(0 5px 25px rgba(255,69,0,0.4))';
        });
    });

    launchButton.addEventListener('mouseleave', () => {
        const flames = document.querySelectorAll('.thrust-flame');
        flames.forEach(flame => {
            flame.style.filter = 'drop-shadow(0 5px 15px rgba(100,100,100,0.4))';
        });
    });
}

function launchRocket() {
    const rocket = document.querySelector('.guitar-rocket');
    const launchComplex = document.querySelector('.launch-complex');
    const mainFlames = document.querySelectorAll('.thrust-flame');
    const coreFlames = document.querySelectorAll('.core-flame');
    const shockDiamonds = document.querySelectorAll('.shock-diamond');

    // Pre-launch effects
    addPreLaunchEffects();
    
    // Launch sequence timing
    setTimeout(() => {
        // Activate launch clamps
        launchComplex.classList.add('launching');
        
        // Start main engine ignition sequence
        startEngineIgnition(mainFlames, coreFlames, shockDiamonds);
        
        // Launch the rocket
        setTimeout(() => {
            rocket.classList.add('launching');
            addLaunchEffects();
        }, 1000);
        
        // Reset sequence
        setTimeout(resetLaunch, 10000);
    }, 500);
}

function addPreLaunchEffects() {
    // Add steam/smoke effects
    const steamEffect = document.createElement('div');
    steamEffect.classList.add('pre-launch-steam');
    document.querySelector('.launch-complex').appendChild(steamEffect);
    
    // Add platform vibration
    document.querySelector('.launch-complex').classList.add('vibrating');
    
    // Enhance wing glow
    const wings = document.querySelectorAll('.wing-left, .wing-right');
    wings.forEach(wing => {
        wing.style.filter = 'drop-shadow(0 0 15px rgba(255,165,0,0.6))';
    });
}

function startEngineIgnition(mainFlames, coreFlames, shockDiamonds) {
    const centerIndex = Math.floor(mainFlames.length / 2);
    let activationOrder = [centerIndex];
    
    // Build activation sequence outward from center
    for (let i = 1; i < Math.ceil(mainFlames.length / 2); i++) {
        activationOrder.push(centerIndex - i);
        activationOrder.push(centerIndex + i);
    }
    
    // Filter valid indices
    activationOrder = activationOrder.filter(index => index >= 0 && index < mainFlames.length);
    
    // Activate all flame components with sequence
    activationOrder.forEach((index, orderIndex) => {
        setTimeout(() => {
            // Activate main flame
            mainFlames[index].classList.add('active');
            mainFlames[index].style.animationDelay = `${Math.random() * 0.15}s`;
            
            // Activate core flame
            if (coreFlames[index]) {
                coreFlames[index].classList.add('active');
                coreFlames[index].style.animationDelay = `${Math.random() * 0.1}s`;
            }
            
            // Activate shock diamonds
            const diamonds = document.querySelectorAll(`.flame-${index} ~ .shock-diamond`);
            diamonds.forEach(diamond => {
                diamond.classList.add('active');
                diamond.style.animationDelay = `${Math.random() * 0.2}s`;
            });
        }, orderIndex * 80);
    });
}

function addLaunchEffects() {
    // Add exhaust smoke
    const exhaustSmoke = document.createElement('div');
    exhaustSmoke.classList.add('exhaust-smoke');
    document.querySelector('.launch-complex').appendChild(exhaustSmoke);
    
    // Add launch vibration
    document.querySelector('.guitar-rocket').classList.add('vibrating');
    
    // Intensify flame effects
    document.querySelectorAll('.thrust-flame.active').forEach(flame => {
        flame.style.filter = 'brightness(1.2) blur(1px)';
    });
}

function resetLaunch() {
    // Reset rocket
    const rocket = document.querySelector('.guitar-rocket');
    rocket.classList.remove('launching', 'vibrating');
    
    // Reset launch complex
    const launchComplex = document.querySelector('.launch-complex');
    launchComplex.classList.remove('launching', 'vibrating');
    
    // Remove added effects
    document.querySelectorAll('.pre-launch-steam, .exhaust-smoke').forEach(effect => {
        effect.remove();
    });
    
    // Reset flames
    document.querySelectorAll('.thrust-flame').forEach(flame => {
        flame.classList.remove('active');
        flame.style.animationDelay = '0s';
        flame.style.filter = '';
    });
    
    document.querySelectorAll('.core-flame').forEach(flame => {
        flame.classList.remove('active');
        flame.style.animationDelay = '0s';
    });
    
    document.querySelectorAll('.shock-diamond').forEach(diamond => {
        diamond.classList.remove('active');
        diamond.style.animationDelay = '0s';
    });
    
    // Reset wing effects
    document.querySelectorAll('.wing-left, .wing-right').forEach(wing => {
        wing.style.filter = 'none';
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    const rocket = document.querySelector('.guitar-rocket');
    if (!rocket.classList.contains('launching')) {
        rocket.style.transform = 'translateX(-50%)';
    }
});