import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Power, Activity } from 'lucide-react';

const STRING_FREQUENCIES = {
    "E2": 82.41,
    "A2": 110.00,
    "D3": 146.83,
    "G3": 196.00,
    "B3": 246.94,
    "E4": 329.63
};

const STRING_ORDER = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

export default function RocketGuitarTuner() {
    const [isRunning, setIsRunning] = useState(false);
    const [missionTime, setMissionTime] = useState('T-00:00:00');
    const [currentNote, setCurrentNote] = useState('-');
    const [frequency, setFrequency] = useState('-');
    const [markerPosition, setMarkerPosition] = useState(50);
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [inTuneStrings, setInTuneStrings] = useState(new Set());
    const [isLaunching, setIsLaunching] = useState(false);
    const [status, setStatus] = useState('SYSTEMS READY');

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const animationFrameRef = useRef(null);
    const smoothingWindowRef = useRef([]);
    const missionStartTimeRef = useRef(null);

    const updateMissionTime = () => {
        if (!missionStartTimeRef.current) {
            missionStartTimeRef.current = Date.now();
        }

        const elapsed = Math.floor((Date.now() - missionStartTimeRef.current) / 1000);
        const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        setMissionTime(`T+${hours}:${minutes}:${seconds}`);
    };

    const updatePitch = () => {
        if (!isRunning || !analyserRef.current) return;
    
        const buffer = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(buffer);
    
        // Calculate volume
        const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
        const volume = Math.min(100, Math.max(0, rms * 400));
        setVolumeLevel(volume);
    
        if (volume > 5) { // Process pitch only if volume is high enough
            const detectedPitch = yin(buffer, audioContextRef.current.sampleRate);
    
            if (detectedPitch) {
                // Smooth frequencies
                if (smoothingWindowRef.current.length >= 5) smoothingWindowRef.current.shift();
                smoothingWindowRef.current.push(detectedPitch);
                const smoothedFrequency = smoothingWindowRef.current.reduce((sum, f) => sum + f) / smoothingWindowRef.current.length;
    
                // Update frequency and note
                setFrequency(smoothedFrequency.toFixed(1));
                const closestNote = findClosestNote(smoothedFrequency);
                setCurrentNote(closestNote.note);
    
                // Calculate cents and marker position
                const cents = getCents(smoothedFrequency, closestNote.frequency);
                const position = 50 + (cents * 50) / 50;
                setMarkerPosition(Math.min(100, Math.max(0, position)));
    
                // Update tuning status
                if (Math.abs(cents) < 5) {
                    setStatus('BOOSTER ALIGNED 🚀');
                    setInTuneStrings(prev => new Set([...prev, closestNote.note]));
                } else {
                    setStatus(cents > 0 ? `TUNE DOWN ↓ (${Math.abs(cents).toFixed(1)} cents)` : `TUNE UP ↑ (${Math.abs(cents).toFixed(1)} cents)`);
                }
            }
        } else {
            setFrequency('-');
            setCurrentNote('-');
            setStatus('SIGNAL TOO WEAK');
        }
    
        animationFrameRef.current = requestAnimationFrame(updatePitch);
    };
    

    const startTuner = async () => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0
                }
            };

            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);

            setIsRunning(true);
            missionStartTimeRef.current = Date.now();
            updatePitch();
        } catch (error) {
            console.error('Error starting tuner:', error);
            setStatus('ERROR: MICROPHONE ACCESS REQUIRED');
        }
    };

    const stopTuner = () => {
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setIsRunning(false);
        setInTuneStrings(new Set());
        setIsLaunching(false);
        smoothingWindowRef.current = [];
        missionStartTimeRef.current = null;
        setMissionTime('T-00:00:00');
        setStatus('SYSTEMS READY');
    };

    useEffect(() => {
        let intervalId;
        if (isRunning) {
            intervalId = setInterval(updateMissionTime, 1000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isRunning]);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (inTuneStrings.size === STRING_ORDER.length) {
            setIsLaunching(true);
            setStatus('LAUNCH SEQUENCE INITIATED');
        }
    }, [inTuneStrings]);

    return (
        <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-4 space-y-8">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(2px_2px_at_20px_30px,#ffffff,rgba(0,0,0,0))] opacity-50" />
            </div>

            <header className="text-center relative z-10">
                <div className="text-yellow-400 text-sm animate-pulse font-mono">TRANSMISSION ACTIVE</div>
                <h1 className="flex items-center justify-center gap-2 text-4xl font-bold my-4">
                    <Rocket className="text-blue-400" />
                    <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        RocketGuitar
                    </span>
                </h1>
                <div className="text-slate-400 text-sm tracking-wider">{missionTime}</div>
            </header>

            <div className={`w-full max-w-md relative transition-transform duration-[3000ms] ${
                isLaunching ? '-translate-y-[200vh]' : 'translate-y-0'
            }`}>
                <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-t-[120px] overflow-hidden shadow-xl border border-slate-700">
                    <div className="flex justify-between items-center p-4 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                            <span className="text-slate-300">{status}</span>
                        </div>
                        <button 
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                                isRunning 
                                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            }`}
                            onClick={() => isRunning ? stopTuner() : startTuner()}
                        >
                            <Power size={16} />
                            <span>{isRunning ? 'ABORT MISSION' : 'ACTIVATE TUNER'}</span>
                        </button>
                    </div>

                    <div className="h-32 bg-gradient-to-b from-slate-900 to-indigo-900 relative">
                        <div className="absolute left-1/2 top-0 w-px h-full bg-slate-700" />
                        <div 
                            className="absolute top-1/2 h-4/5 w-1 bg-blue-500 transition-all duration-200"
                            style={{ left: `${markerPosition}%`, transform: 'translate(-50%, -50%)' }}
                        />
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                            <Activity size={16} className="text-slate-400" />
                            <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-200"
                                    style={{ width: `${volumeLevel}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
                            <div className="text-sm text-slate-400">CURRENT NOTE</div>
                            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                                {currentNote}
                            </div>
                        </div>
                        
                        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
                            <div className="text-sm text-slate-400">FREQUENCY</div>
                            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                                {frequency !== '-' ? `${frequency} Hz` : '-'}
                            </div>
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl">
                            <div className="text-sm text-slate-400 mb-4">STRING TUNER</div>
                            <div className="grid grid-cols-3 gap-4">
                                {STRING_ORDER.map((stringNote, index) => (
                                    <div 
                                        key={index} 
                                        className={`aspect-square rounded-full flex items-center justify-center bg-slate-900 transition-all ${
                                            inTuneStrings.has(stringNote) 
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30' 
                                                : 'border border-slate-700'
                                        }`}
                                    >
                                        <span className="text-lg font-bold text-white">
                                            {stringNote.charAt(0)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}