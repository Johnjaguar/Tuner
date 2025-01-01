document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Constants
    const STRING_FREQUENCIES = {
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
    const currentNote = document.getElementById('currentNote');
    const volumeLevel = document.getElementById('volumeLevel');
    const stringGrid = document.getElementById('stringGrid');
    const missionStatus = document.getElementById('missionStatus');

    // State
    let isRunning = false;
    let audioContext = null;
    let analyser = null;
    let source = null;
    const smoothingWindow = [];

    // Initialize string grid
    initializeStringGrid();

    function initializeStringGrid() {
        Object.entries(STRING_FREQUENCIES).forEach(([note]) => {
            const stringItem = document.createElement('div');
            stringItem.className = 'string-item';
            stringItem.id = `string-${note}`;
            stringItem.textContent = note;
            stringGrid.appendChild(stringItem);
        });
    }

    async function startTuner() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            });

            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            button.classList.add('active');
            button.querySelector('span').textContent = 'STOP TUNER';
            missionStatus.textContent = 'TUNER ACTIVE';
            isRunning = true;

            updatePitch();
        } catch (error) {
            missionStatus.textContent = 'MICROPHONE ACCESS DENIED';
            console.error('Error:', error);
        }
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
        button.classList.remove('active');
        button.querySelector('span').textContent = 'START TUNER';
        missionStatus.textContent = 'READY FOR LAUNCH';
        currentNote.textContent = '-';
        marker.style.left = '50%';
        volumeLevel.style.width = '0%';
        
        document.querySelectorAll('.string-item').forEach(item => {
            item.classList.remove('in-tune');
        });
    }

    function updatePitch() {
        if (!isRunning) return;

        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        // Update volume level
        const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
        const volume = Math.min(100, Math.max(0, rms * 400));
        volumeLevel.style.width = `${volume}%`;

        if (volume > 5) {  // Only process pitch if volume is high enough
            const detectedPitch = autoCorrelate(buffer, audioContext.sampleRate);
            
            if (detectedPitch && !isNaN(detectedPitch)) {
                // Smooth the frequency
                if (smoothingWindow.length >= 5) smoothingWindow.shift();
                smoothingWindow.push(detectedPitch);
                const smoothedFreq = smoothingWindow.reduce((a, b) => a + b) / smoothingWindow.length;

                const closest = findClosestNote(smoothedFreq);
                currentNote.textContent = closest.note;
                
                const cents = getCents(smoothedFreq, closest.frequency);
                const position = 50 + (cents * 50) / 50;
                marker.style.left = `${Math.min(100, Math.max(0, position))}%`;

                // Update string indicators
                const stringElement = document.getElementById(`string-${closest.note}`);
                if (Math.abs(cents) < 5) {
                    marker.style.background = 'var(--success)';
                    if (stringElement) stringElement.classList.add('in-tune');
                } else { marker.style.background = 'var(--primary)';
                    if (stringElement) stringElement.classList.remove('in-tune');
                }
            }
        }

        requestAnimationFrame(updatePitch);
    }

    function autoCorrelate(buffer, sampleRate) {
        // ACF2+ algorithm for pitch detection
        const size = buffer.length;
        const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / size);
        
        if (rms < 0.01) return null;

        let r1 = 0, r2 = size - 1;
        const thres = 0.2;
        
        for (let i = 0; i < size/2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < size/2; i++) {
            if (Math.abs(buffer[size-i]) < thres) { r2 = size - i; break; }
        }

        const buf2 = buffer.slice(r1, r2);
        const c = new Array(buf2.length).fill(0);
        
        for (let i = 0; i < buf2.length; i++) {
            for (let j = 0; j < buf2.length - i; j++) {
                c[i] = c[i] + buf2[j] * buf2[j+i];
            }
        }

        let d = 0;
        for (let i = 1; i < c.length; i++) {
            if (c[i] > c[d]) d = i;
        }
        
        let maxval = -1, maxpos = -1;
        for (let i = d; i < c.length; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        
        let T0 = maxpos;
        
        const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        
        if (a) T0 = T0 - b / (2 * a);
        
        return sampleRate/T0;
    }

    function findClosestNote(freq) {
        let closestNote = "";
        let closestDiff = Infinity;
        
        Object.entries(STRING_FREQUENCIES).forEach(([note, noteFreq]) => {
            const diff = Math.abs(freq - noteFreq);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestNote = note;
            }
        });

        return {
            note: closestNote,
            frequency: STRING_FREQUENCIES[closestNote]
        };
    }

    function getCents(frequency, targetFrequency) {
        return 1200 * Math.log2(frequency / targetFrequency);
    }

    // Event Listeners
    button.addEventListener('click', () => {
        if (isRunning) {
            stopTuner();
        } else {
            startTuner();
        }
    }); })