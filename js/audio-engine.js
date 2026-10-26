/**
 * EQ Master Trainer - Web Audio API Sound Synthesis & Processing Engine
 * High-quality real-time multi-instrument sound engine & parametric filter graph
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.currentInstrument = "kick";
        this.tempo = 100;
        this.timerID = null;
        this.currentStep = 0;
        
        // Custom user audio buffer
        this.customBuffer = null;
        this.customSourceNode = null;
        this.isCustomLoaded = false;
        this.customFileName = "";

        // Real drum audio sample buffers
        this.drumSampleBuffers = {};
        this.drumSourceNode = null;
        this.isSampleLoaded = {};

        // EQ Mode: "parametric" or "graphic"
        this.eqMode = "parametric";

        // Graphic EQ Parameters (10 Standard ISO Bands: 31.5Hz to 16kHz)
        this.graphicFreqs = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.graphicGains = [1.0, 4.5, 1.0, -2.5, -6.0, -2.0, 1.0, 4.0, 0.0, -3.0];
        this.graphicFilterNodes = [];
        this.paramGain = null;
        this.graphicGain = null;

        // EQ Filter parameters (8 Bands)
        this.bands = [
            { id: 0, type: "highpass", freq: 20, q: 0.71, gain: 0, enabled: true, label: "HPF" },
            { id: 1, type: "lowshelf", freq: 100, q: 0.71, gain: 0, enabled: true, label: "Low Shelf" },
            { id: 2, type: "peaking", freq: 250, q: 1.4, gain: 0, enabled: true, label: "Low-Mid" },
            { id: 3, type: "peaking", freq: 1000, q: 1.4, gain: 0, enabled: true, label: "Mid" },
            { id: 4, type: "peaking", freq: 3000, q: 1.4, gain: 0, enabled: true, label: "High-Mid" },
            { id: 5, type: "peaking", freq: 6000, q: 2.0, gain: 0, enabled: true, label: "Presence" },
            { id: 6, type: "highshelf", freq: 10000, q: 0.71, gain: 0, enabled: true, label: "High Shelf" },
            { id: 7, type: "lowpass", freq: 20000, q: 0.71, gain: 0, enabled: true, label: "LPF" }
        ];

        // Web Audio Nodes
        this.filterNodes = [];
        this.inputGain = null;
        this.outputGain = null;
        this.limiter = null; // Protection limiter against clipping
        this.analyser = null;
        this.isBypassed = false;

        // Solo Band (Band Audition)
        this.soloBandIndex = -1;
        this.soloFilter = null;
        this.soloGain = null;
        this.normalGain = null;

        // Sound generator noise buffer
        this.noiseBuffer = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Create Noise Buffer for Drums/Acoustic transients
        this.createNoiseBuffer();

        // Input and Output Gains
        this.inputGain = this.ctx.createGain();
        this.inputGain.gain.value = 0.75;

        this.outputGain = this.ctx.createGain();
        this.outputGain.gain.value = 0.75;

        // Safety Limiter to prevent clipping when user boosts heavily
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
        this.limiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
        this.limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
        this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.limiter.release.setValueAtTime(0.1, this.ctx.currentTime);

        // Analyser for Spectrum Visualizer
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;

        // Build 8-band Parametric Filter Chain
        this.buildFilterChain();

        // Build 10-band Graphic Filter Chain
        this.buildGraphicFilterChain();

        // Parametric & Graphic EQ switch gains
        this.paramGain = this.ctx.createGain();
        this.paramGain.gain.value = (this.eqMode === "parametric") ? 1.0 : 0.0;

        this.graphicGain = this.ctx.createGain();
        this.graphicGain.gain.value = (this.eqMode === "graphic") ? 1.0 : 0.0;

        // Solo audition filter system
        this.soloFilter = this.ctx.createBiquadFilter();
        this.soloFilter.type = "bandpass";
        this.soloGain = this.ctx.createGain();
        this.soloGain.gain.value = 0.0;

        this.normalGain = this.ctx.createGain();
        this.normalGain.gain.value = 1.0;

        // Route:
        // Input -> ParametricFilterChain -> paramGain -> normalGain -> outputGain -> limiter -> analyser -> destination
        // Input -> GraphicFilterChain -> graphicGain -> normalGain
        // Input -> soloFilter -> soloGain -> outputGain
        this.inputGain.connect(this.filterNodes[0]);
        this.filterNodes[this.filterNodes.length - 1].connect(this.paramGain);
        this.paramGain.connect(this.normalGain);

        this.inputGain.connect(this.graphicFilterNodes[0]);
        this.graphicFilterNodes[this.graphicFilterNodes.length - 1].connect(this.graphicGain);
        this.graphicGain.connect(this.normalGain);

        this.normalGain.connect(this.outputGain);

        this.inputGain.connect(this.soloFilter);
        this.soloFilter.connect(this.soloGain);
        this.soloGain.connect(this.outputGain);

        this.outputGain.connect(this.limiter);
        this.limiter.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        // Attempt to load local sample files if available (e.g. samples/kick.wav)
        this.loadLocalSamples();
    }

    async loadLocalSamples() {
        const drumFiles = {
            kick: "samples/KICK.wav",
            snare: "samples/SNARE FOR.wav",
            hihat: "samples/HIHAT.wav",
            tom1: "samples/TOM 1.wav",
            tom2: "samples/TOM 2.wav",
            floortom: "samples/FLOOR TOM.wav",
            overhead_l: "samples/OVERHEAD L.wav",
            overhead_r: "samples/OVERHEAD R.wav"
        };

        // 1. First, decode embedded base64 samples (works instantly offline & on file://)
        if (typeof window !== "undefined" && window.EMBEDDED_SAMPLES) {
            for (const [id, base64] of Object.entries(window.EMBEDDED_SAMPLES)) {
                try {
                    const binaryString = window.atob(base64);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    this.ctx.decodeAudioData(bytes.buffer.slice(0), (decoded) => {
                        this.drumSampleBuffers[id] = decoded;
                        this.isSampleLoaded[id] = true;
                        // If this instrument is currently active and playing, switch to the real sample loop!
                        if (id === this.currentInstrument && this.isPlaying && !this.drumSourceNode) {
                            this.playDrumSampleLoop(id);
                        }
                    }, (err) => {
                        console.warn(`Failed to decode embedded sample for ${id}:`, err);
                    });
                } catch (e) {
                    console.warn(`Error processing embedded sample ${id}:`, e);
                }
            }
        }

        // 2. Also try dynamic fetch from samples/ folder (if served over http/https)
        for (const [id, url] of Object.entries(drumFiles)) {
            if (this.drumSampleBuffers[id]) continue;
            try {
                const res = await fetch(encodeURI(url));
                if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    this.ctx.decodeAudioData(arrayBuffer, (decoded) => {
                        this.drumSampleBuffers[id] = decoded;
                        this.isSampleLoaded[id] = true;
                        if (id === this.currentInstrument && this.isPlaying && !this.drumSourceNode) {
                            this.playDrumSampleLoop(id);
                        }
                    });
                }
            } catch (e) {
                // Silently skip if fetch is blocked by CORS on file://
            }
        }
    }

    playDrumSampleLoop(instId) {
        if (!this.drumSampleBuffers[instId] || !this.ctx) return false;

        // Stop any previous playing sample loop
        if (this.drumSourceNode) {
            try { this.drumSourceNode.stop(); } catch(e) {}
            this.drumSourceNode = null;
        }

        // Stop synthetic sequencer for real drum loop
        if (this.timerID) {
            clearInterval(this.timerID);
            this.timerID = null;
        }

        this.drumSourceNode = this.ctx.createBufferSource();
        this.drumSourceNode.buffer = this.drumSampleBuffers[instId];
        this.drumSourceNode.loop = true; // Seamless loop!
        this.drumSourceNode.connect(this.inputGain);
        this.drumSourceNode.start(0);
        return true;
    }

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    buildFilterChain() {
        this.filterNodes = [];
        for (let i = 0; i < this.bands.length; i++) {
            const b = this.bands[i];
            const node = this.ctx.createBiquadFilter();
            node.type = b.type;
            node.frequency.value = b.freq;
            node.Q.value = b.q;
            if (node.gain) {
                node.gain.value = b.gain;
            }
            this.filterNodes.push(node);

            if (i > 0) {
                this.filterNodes[i - 1].connect(node);
            }
        }
    }

    buildGraphicFilterChain() {
        this.graphicFilterNodes = [];
        for (let i = 0; i < this.graphicFreqs.length; i++) {
            const freq = this.graphicFreqs[i];
            const node = this.ctx.createBiquadFilter();
            node.type = (i === 0) ? "lowshelf" : (i === this.graphicFreqs.length - 1 ? "highshelf" : "peaking");
            node.frequency.value = freq;
            node.Q.value = 1.414;
            node.gain.value = this.graphicGains[i];
            this.graphicFilterNodes.push(node);

            if (i > 0) {
                this.graphicFilterNodes[i - 1].connect(node);
            }
        }
    }

    setEQMode(mode) {
        this.eqMode = mode;
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (mode === "graphic") {
            if (this.paramGain) this.paramGain.gain.setTargetAtTime(0.0, now, 0.02);
            if (this.graphicGain) this.graphicGain.gain.setTargetAtTime(1.0, now, 0.02);
        } else {
            if (this.paramGain) this.paramGain.gain.setTargetAtTime(1.0, now, 0.02);
            if (this.graphicGain) this.graphicGain.gain.setTargetAtTime(0.0, now, 0.02);
        }
    }

    setGraphicGain(index, gainDb) {
        if (index < 0 || index >= this.graphicGains.length) return;
        this.graphicGains[index] = Math.max(-12, Math.min(12, gainDb));
        if (this.graphicFilterNodes[index] && this.ctx) {
            this.graphicFilterNodes[index].gain.setTargetAtTime(this.graphicGains[index], this.ctx.currentTime, 0.01);
        }
    }

    setAllGraphicGains(gainsArray) {
        for (let i = 0; i < this.graphicGains.length; i++) {
            const g = (gainsArray && gainsArray[i] !== undefined) ? gainsArray[i] : 0;
            this.setGraphicGain(i, g);
        }
    }

    resetGraphicEQ() {
        this.setAllGraphicGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }

    loadStandardGraphicPreset(instrumentId) {
        const inst = (typeof INSTRUMENTS_DATA !== "undefined") ? INSTRUMENTS_DATA[instrumentId] : null;
        if (inst && inst.graphicStandard) {
            this.setAllGraphicGains(inst.graphicStandard);
            return inst.graphicStandard;
        } else {
            this.resetGraphicEQ();
            return this.graphicGains;
        }
    }

    getGraphicBandEnergies() {
        if (!this.analyser) return new Float32Array(10);
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
        const binSize = sampleRate / (bufferLength * 2);

        const energies = new Float32Array(this.graphicFreqs.length);
        for (let i = 0; i < this.graphicFreqs.length; i++) {
            const freq = this.graphicFreqs[i];
            const bin = Math.min(bufferLength - 1, Math.round(freq / binSize));
            energies[i] = dataArray[bin] / 255.0;
        }
        return energies;
    }

    updateBand(index, params) {
        if (index < 0 || index >= this.bands.length) return;
        const b = this.bands[index];
        const node = this.filterNodes[index];

        if (params.freq !== undefined) {
            b.freq = Math.max(20, Math.min(20000, params.freq));
            if (node && this.ctx) node.frequency.setTargetAtTime(b.freq, this.ctx.currentTime, 0.01);
        }
        if (params.gain !== undefined) {
            b.gain = Math.max(-18, Math.min(18, params.gain));
            if (node && node.gain && this.ctx) node.gain.setTargetAtTime(b.gain, this.ctx.currentTime, 0.01);
        }
        if (params.q !== undefined) {
            b.q = Math.max(0.2, Math.min(15, params.q));
            if (node && this.ctx) node.Q.setTargetAtTime(b.q, this.ctx.currentTime, 0.01);
        }
        if (params.type !== undefined) {
            b.type = params.type;
            if (node) node.type = b.type;
        }
        if (params.enabled !== undefined) {
            b.enabled = params.enabled;
            if (node && node.gain && this.ctx) {
                node.gain.setTargetAtTime(b.enabled ? b.gain : 0, this.ctx.currentTime, 0.01);
            }
        }

        // If this band is currently in Solo Audition mode, update solo filter
        if (this.soloBandIndex === index && this.soloFilter && this.ctx) {
            this.soloFilter.frequency.setTargetAtTime(b.freq, this.ctx.currentTime, 0.01);
            this.soloFilter.Q.setTargetAtTime(Math.max(2.0, b.q * 1.5), this.ctx.currentTime, 0.01);
        }
    }

    setSoloBand(index) {
        if (!this.ctx) return;
        if (this.soloBandIndex === index || index === -1) {
            // Turn off solo
            this.soloBandIndex = -1;
            this.normalGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
            this.soloGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.02);
        } else {
            // Activate solo for band index
            this.soloBandIndex = index;
            const b = this.bands[index];
            this.soloFilter.frequency.setTargetAtTime(b.freq, this.ctx.currentTime, 0.02);
            this.soloFilter.Q.setTargetAtTime(Math.max(2.5, b.q * 1.5), this.ctx.currentTime, 0.02);
            this.normalGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.02);
            this.soloGain.gain.setTargetAtTime(1.3, this.ctx.currentTime, 0.02);
        }
    }

    setBypass(bypass) {
        this.isBypassed = bypass;
        if (!this.ctx) return;
        for (let i = 0; i < this.bands.length; i++) {
            const b = this.bands[i];
            const node = this.filterNodes[i];
            if (bypass) {
                if (node.type === "highpass") node.frequency.setTargetAtTime(10, this.ctx.currentTime, 0.01);
                else if (node.type === "lowpass") node.frequency.setTargetAtTime(22000, this.ctx.currentTime, 0.01);
                else if (node.gain) node.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
            } else {
                node.frequency.setTargetAtTime(b.freq, this.ctx.currentTime, 0.01);
                if (node.gain) node.gain.setTargetAtTime(b.enabled ? b.gain : 0, this.ctx.currentTime, 0.01);
            }
        }
        if (this.graphicFilterNodes && this.ctx) {
            for (let i = 0; i < this.graphicFilterNodes.length; i++) {
                const node = this.graphicFilterNodes[i];
                if (node && node.gain) {
                    node.gain.setTargetAtTime(bypass ? 0 : this.graphicGains[i], this.ctx.currentTime, 0.01);
                }
            }
        }
    }

    resetEQ() {
        const defaults = [
            { freq: 20, q: 0.71, gain: 0, type: "highpass" },
            { freq: 100, q: 0.71, gain: 0, type: "lowshelf" },
            { freq: 250, q: 1.4, gain: 0, type: "peaking" },
            { freq: 1000, q: 1.4, gain: 0, type: "peaking" },
            { freq: 3000, q: 1.4, gain: 0, type: "peaking" },
            { freq: 6000, q: 2.0, gain: 0, type: "peaking" },
            { freq: 10000, q: 0.71, gain: 0, type: "highshelf" },
            { freq: 20000, q: 0.71, gain: 0, type: "lowpass" }
        ];
        for (let i = 0; i < this.bands.length; i++) {
            this.updateBand(i, defaults[i]);
        }
        this.setSoloBand(-1);
    }

    applyPreset(bandsPreset) {
        this.resetEQ();
        bandsPreset.forEach(p => {
            let bestIdx = -1;
            let minDiff = Infinity;
            for (let i = 0; i < this.bands.length; i++) {
                if (this.bands[i].type === p.type) {
                    const diff = Math.abs(Math.log2(this.bands[i].freq / p.freq));
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestIdx = i;
                    }
                }
            }
            if (bestIdx !== -1) {
                this.updateBand(bestIdx, {
                    freq: p.freq,
                    gain: p.gain !== undefined ? p.gain : 0,
                    q: p.q !== undefined ? p.q : 1.4
                });
            }
        });
    }

    // -------------------------------------------------------------
    // PLAYBACK & SEQUENCER ENGINE
    // -------------------------------------------------------------
    async start() {
        this.init();
        if (this.ctx.state === "suspended") {
            await this.ctx.resume();
        }
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentStep = 0;

        if (this.isCustomLoaded && this.customBuffer && this.currentInstrument === "custom") {
            this.playCustomAudio();
        } else if (this.drumSampleBuffers[this.currentInstrument]) {
            this.playDrumSampleLoop(this.currentInstrument);
        } else {
            this.startSequencer();
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) {
            clearInterval(this.timerID);
            this.timerID = null;
        }
        if (this.customSourceNode) {
            try { this.customSourceNode.stop(); } catch(e) {}
            this.customSourceNode = null;
        }
        if (this.drumSourceNode) {
            try { this.drumSourceNode.stop(); } catch(e) {}
            this.drumSourceNode = null;
        }
    }

    async toggle() {
        if (this.isPlaying) this.stop();
        else await this.start();
        return this.isPlaying;
    }

    setMasterVolume(val) {
        if (this.outputGain && this.ctx) {
            this.outputGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
        }
    }

    setInstrument(instId) {
        this.currentInstrument = instId;
        this.loadStandardGraphicPreset(instId);
        if (this.isPlaying) {
            if (this.customSourceNode) {
                try { this.customSourceNode.stop(); } catch(e) {}
                this.customSourceNode = null;
            }
            if (this.drumSourceNode) {
                try { this.drumSourceNode.stop(); } catch(e) {}
                this.drumSourceNode = null;
            }

            if (instId === "custom" && this.isCustomLoaded) {
                if (this.timerID) clearInterval(this.timerID);
                this.playCustomAudio();
            } else if (this.drumSampleBuffers[instId]) {
                this.playDrumSampleLoop(instId);
            } else {
                if (!this.timerID) this.startSequencer();
            }
        }
    }

    playCustomAudio() {
        if (!this.customBuffer || !this.ctx) return;
        if (this.customSourceNode) {
            try { this.customSourceNode.stop(); } catch(e) {}
        }
        this.customSourceNode = this.ctx.createBufferSource();
        this.customBufferSource = this.customBuffer;
        this.customSourceNode.buffer = this.customBuffer;
        this.customSourceNode.loop = true;
        this.customSourceNode.connect(this.inputGain);
        this.customSourceNode.start();
    }

    async loadUserAudioFile(file) {
        this.init();
        const arrayBuffer = await file.arrayBuffer();
        this.ctx.decodeAudioData(arrayBuffer, (decoded) => {
            this.customBuffer = decoded;
            this.isCustomLoaded = true;
            this.customFileName = file.name;
            this.setInstrument("custom");
            if (window.onCustomAudioLoaded) {
                window.onCustomAudioLoaded(file.name);
            }
            if (!this.isPlaying) {
                this.start();
            }
        }, (err) => {
            console.error("Audio decoding error:", err);
            alert("ไม่สามารถอ่านไฟล์เสียงนี้ได้ กรุณาลองไฟล์ .wav หรือ .mp3 อื่น");
        });
    }

    startSequencer() {
        if (this.timerID) clearInterval(this.timerID);
        const stepTimeMs = (60 / this.tempo / 4) * 1000;
        this.timerID = setInterval(() => {
            if (!this.isPlaying || (this.currentInstrument === "custom" && this.isCustomLoaded) || this.drumSampleBuffers[this.currentInstrument]) return;
            const now = this.ctx.currentTime;
            this.triggerInstrumentStep(this.currentInstrument, this.currentStep, now);
            this.currentStep = (this.currentStep + 1) % 16;
        }, stepTimeMs);
    }

    // -------------------------------------------------------------
    // REAL-TIME SYNTHESIS OF GLOBAL INSTRUMENTS
    // -------------------------------------------------------------
    triggerInstrumentStep(instrument, step, time) {
        switch (instrument) {
            case "kick":
                if (step % 4 === 0 || step === 14) this.synthKick(time, 1.0);
                break;
            case "snare":
                if (step === 4 || step === 12) this.synthSnare(time, 1.0);
                else if (step === 15) this.synthSnare(time, 0.4);
                break;
            case "hihat":
                const acc = (step % 4 === 0) ? 0.9 : (step % 2 === 0 ? 0.6 : 0.4);
                this.synthHiHat(time, acc, step === 14);
                break;
            case "overhead_l":
                // Overhead Left (Pan L): Hi-hat, Left Crash, Left Tom bleed
                this.synthOverheadL(time, step);
                break;
            case "overhead_r":
                // Overhead Right (Pan R): Ride Cymbal, Right Crash, Floor Tom bleed
                this.synthOverheadR(time, step);
                break;
            case "tom1":
                // High Rack Tom groove (16th syncopations)
                if (step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14) {
                    const vel = (step === 0 || step === 8) ? 1.0 : 0.75;
                    this.synthTom(time, 240, 175, 0.42, vel);
                }
                break;
            case "tom2":
                // Mid Rack Tom groove
                if (step === 0 || step === 4 || step === 7 || step === 10 || step === 12 || step === 15) {
                    const vel = (step === 0 || step === 10) ? 1.0 : 0.8;
                    this.synthTom(time, 185, 130, 0.52, vel);
                }
                break;
            case "floortom":
                // Deep Low Floor Tom groove
                if (step === 0 || step === 3 || step === 6 || step === 8 || step === 12 || step === 14) {
                    const vel = (step === 0 || step === 8) ? 1.0 : 0.85;
                    this.synthTom(time, 125, 80, 0.75, vel);
                }
                break;
            case "bass":
                this.playBassStep(step, time);
                break;
            case "acoustic_guitar":
                this.playAcousticGuitarStep(step, time);
                break;
            case "electric_guitar":
                this.playElectricGuitarStep(step, time);
                break;
            case "vocals":
                this.playVocalStep(step, time);
                break;
            case "piano":
                this.playPianoStep(step, time);
                break;
        }
    }

    // TOM DRUM SYNTHESIS (Tuned acoustic pitch drop + resonant body + stick click)
    synthTom(time, baseFreq, endFreq, decayTime, velocity = 1.0) {
        // 1. Primary pitched body oscillator
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + decayTime * 0.45);

        gain.gain.setValueAtTime(0.85 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        // 2. Harmonic shell resonance (triangle)
        const oscHarm = this.ctx.createOscillator();
        const gainHarm = this.ctx.createGain();
        oscHarm.type = "triangle";
        oscHarm.frequency.setValueAtTime(baseFreq * 1.52, time);
        oscHarm.frequency.exponentialRampToValueAtTime(endFreq * 1.25, time + decayTime * 0.35);

        gainHarm.gain.setValueAtTime(0.3 * velocity, time);
        gainHarm.gain.exponentialRampToValueAtTime(0.001, time + decayTime * 0.65);

        // 3. Stick Attack transient (tuned bandpass click)
        const click = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        const clickFilter = this.ctx.createBiquadFilter();
        clickFilter.type = "bandpass";
        clickFilter.frequency.value = 3600;
        clickFilter.Q.value = 2.5;

        click.type = "triangle";
        click.frequency.setValueAtTime(2200, time);
        click.frequency.exponentialRampToValueAtTime(250, time + 0.025);
        clickGain.gain.setValueAtTime(0.55 * velocity, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        click.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(this.inputGain);

        osc.connect(gain);
        gain.connect(this.inputGain);

        oscHarm.connect(gainHarm);
        gainHarm.connect(this.inputGain);

        osc.start(time);
        oscHarm.start(time);
        click.start(time);
        osc.stop(time + decayTime + 0.05);
        oscHarm.stop(time + decayTime + 0.05);
        click.stop(time + 0.04);
    }

    // KICK SYNTHESIS
    synthKick(time, velocity = 1.0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);

        gain.gain.setValueAtTime(1.0 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

        // Click beater
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        const clickFilter = this.ctx.createBiquadFilter();
        clickFilter.type = "bandpass";
        clickFilter.frequency.value = 3500;
        clickFilter.Q.value = 3.0;

        clickOsc.type = "triangle";
        clickOsc.frequency.setValueAtTime(2500, time);
        clickOsc.frequency.exponentialRampToValueAtTime(200, time + 0.02);
        clickGain.gain.setValueAtTime(0.45 * velocity, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

        clickOsc.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(this.inputGain);

        osc.connect(gain);
        gain.connect(this.inputGain);

        osc.start(time);
        clickOsc.start(time);
        osc.stop(time + 0.45);
        clickOsc.stop(time + 0.03);
    }

    // SNARE SYNTHESIS
    synthSnare(time, velocity = 1.0) {
        const osc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(195, time);
        osc.frequency.exponentialRampToValueAtTime(110, time + 0.08);

        bodyGain.gain.setValueAtTime(0.7 * velocity, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

        osc.connect(bodyGain);
        bodyGain.connect(this.inputGain);

        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = "highpass";
            noiseFilter.frequency.value = 1200;

            const noiseFilter2 = this.ctx.createBiquadFilter();
            noiseFilter2.type = "peaking";
            noiseFilter2.frequency.value = 3500;
            noiseFilter2.gain.value = 6;
            noiseFilter2.Q.value = 1.5;

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.65 * velocity, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseFilter2);
            noiseFilter2.connect(noiseGain);
            noiseGain.connect(this.inputGain);

            noise.start(time);
            noise.stop(time + 0.3);
        }

        osc.start(time);
        osc.stop(time + 0.2);
    }

    // HI-HAT SYNTHESIS
    synthHiHat(time, velocity = 0.5, isOpen = false) {
        if (!this.noiseBuffer) return;
        const dur = isOpen ? 0.35 : 0.05;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 7500;

        const shelf = this.ctx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 10000;
        shelf.gain.value = 4;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        noise.connect(filter);
        filter.connect(shelf);
        shelf.connect(gain);
        gain.connect(this.inputGain);

        noise.start(time);
        noise.stop(time + dur + 0.01);
    }

    // KICK IN SYNTHESIS (Inside mic: sharp beater click attack 4kHz & tight transient)
    synthKickIn(time, velocity = 1.0) {
        // Fast pitch drop, tight low body
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(170, time);
        osc.frequency.exponentialRampToValueAtTime(64, time + 0.08);

        gain.gain.setValueAtTime(0.9 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

        // Prominent 4.2 kHz beater click (plastic/wood beater slap)
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        const clickFilter = this.ctx.createBiquadFilter();
        clickFilter.type = "bandpass";
        clickFilter.frequency.value = 4200;
        clickFilter.Q.value = 2.5;

        clickOsc.type = "triangle";
        clickOsc.frequency.setValueAtTime(3200, time);
        clickOsc.frequency.exponentialRampToValueAtTime(300, time + 0.02);
        clickGain.gain.setValueAtTime(0.85 * velocity, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

        clickOsc.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(this.inputGain);

        osc.connect(gain);
        gain.connect(this.inputGain);

        osc.start(time);
        clickOsc.start(time);
        osc.stop(time + 0.26);
        clickOsc.stop(time + 0.04);
    }

    // KICK OUT SYNTHESIS (Outside / Sub mic: deep 48Hz resonant weight & boom)
    synthKickOut(time, velocity = 1.0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Very deep sub drop 75Hz -> 46Hz with longer decay
        osc.frequency.setValueAtTime(75, time);
        osc.frequency.exponentialRampToValueAtTime(46, time + 0.18);

        gain.gain.setValueAtTime(1.1 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.58);

        // Subkick Lowpass filter: cuts high clicks & bleed completely
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3200;

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.inputGain);

        osc.start(time);
        osc.stop(time + 0.6);
    }

    // SNARE TOP SYNTHESIS (Woody body fundamental & stick crack)
    synthSnareTop(time, velocity = 1.0) {
        const osc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(210, time);
        osc.frequency.exponentialRampToValueAtTime(125, time + 0.08);

        bodyGain.gain.setValueAtTime(0.9 * velocity, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

        // Stick transient impact (Crack 3.2 kHz)
        const stick = this.ctx.createOscillator();
        const stickGain = this.ctx.createGain();
        const stickFilter = this.ctx.createBiquadFilter();
        stickFilter.type = "bandpass";
        stickFilter.frequency.value = 3200;
        stickFilter.Q.value = 2.0;

        stick.type = "triangle";
        stick.frequency.setValueAtTime(2800, time);
        stick.frequency.exponentialRampToValueAtTime(400, time + 0.02);
        stickGain.gain.setValueAtTime(0.6 * velocity, time);
        stickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        stick.connect(stickFilter);
        stickFilter.connect(stickGain);
        stickGain.connect(this.inputGain);

        osc.connect(bodyGain);
        bodyGain.connect(this.inputGain);

        osc.start(time);
        stick.start(time);
        osc.stop(time + 0.18);
        stick.stop(time + 0.04);
    }

    // SNARE BOTTOM SYNTHESIS (Snare wires: pure metallic sizzle, highpass noise)
    synthSnareBottom(time, velocity = 1.0) {
        if (!this.noiseBuffer) return;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        // Cut low fundamental completely (High-Pass 350 Hz)
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = "highpass";
        hpf.frequency.value = 350;

        // Crisp wire resonance boost at 5.5 kHz and 8 kHz
        const wirePeak = this.ctx.createBiquadFilter();
        wirePeak.type = "peaking";
        wirePeak.frequency.value = 5500;
        wirePeak.gain.value = 7.0;
        wirePeak.Q.value = 1.8;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

        noise.connect(hpf);
        hpf.connect(wirePeak);
        wirePeak.connect(gain);
        gain.connect(this.inputGain);

        noise.start(time);
        noise.stop(time + 0.3);
    }

    // OVERHEAD LEFT (Pan L -0.75: Hi-hat, Left Crash, Left Tom bleed)
    synthOverheadL(time, step) {
        if (!this.noiseBuffer) return;
        const panner = (this.ctx.createStereoPanner) ? this.ctx.createStereoPanner() : null;
        if (panner) panner.pan.value = -0.75;

        // Left Crash on step 0
        if (step === 0) {
            const crash = this.ctx.createBufferSource();
            crash.buffer = this.noiseBuffer;
            const hpf = this.ctx.createBiquadFilter();
            hpf.type = "highpass";
            hpf.frequency.value = 5500;

            const crashGain = this.ctx.createGain();
            crashGain.gain.setValueAtTime(0.45, time);
            crashGain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);

            crash.connect(hpf);
            hpf.connect(crashGain);
            if (panner) { crashGain.connect(panner); panner.connect(this.inputGain); }
            else { crashGain.connect(this.inputGain); }

            crash.start(time);
            crash.stop(time + 0.88);
        }

        // Hi-Hat steady 16ths on left overhead
        const open = (step === 14);
        const dur = open ? 0.32 : 0.055;
        const vel = (step % 4 === 0) ? 0.65 : (step % 2 === 0 ? 0.45 : 0.25);

        const hat = this.ctx.createBufferSource();
        hat.buffer = this.noiseBuffer;
        const hatFilt = this.ctx.createBiquadFilter();
        hatFilt.type = "highpass";
        hatFilt.frequency.value = 7000;

        const hatGain = this.ctx.createGain();
        hatGain.gain.setValueAtTime(vel * 0.35, time);
        hatGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        hat.connect(hatFilt);
        hatFilt.connect(hatGain);
        if (panner) { hatGain.connect(panner); panner.connect(this.inputGain); }
        else { hatGain.connect(this.inputGain); }

        hat.start(time);
        hat.stop(time + dur + 0.01);
    }

    // OVERHEAD RIGHT (Pan R +0.75: Ride Cymbal Ping, Bell, Right Crash)
    synthOverheadR(time, step) {
        if (!this.noiseBuffer) return;
        const panner = (this.ctx.createStereoPanner) ? this.ctx.createStereoPanner() : null;
        if (panner) panner.pan.value = 0.75;

        // Ride ping on 8th notes (0, 2, 4, 6, 8, 10, 12, 14)
        if (step % 2 === 0) {
            const isBell = (step === 8); // Ride bell accent
            const pingFreq = isBell ? 1800 : 860;
            const dur = isBell ? 0.45 : 0.25;

            // Metallic inharmonic bell tone
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(pingFreq, time);

            gain.gain.setValueAtTime(isBell ? 0.32 : 0.18, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

            // Shimmer noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const hpf = this.ctx.createBiquadFilter();
            hpf.type = "highpass";
            hpf.frequency.value = 6500;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.12, time);
            nGain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.8);

            osc.connect(gain);
            noise.connect(hpf);
            hpf.connect(nGain);

            if (panner) {
                gain.connect(panner);
                nGain.connect(panner);
                panner.connect(this.inputGain);
            } else {
                gain.connect(this.inputGain);
                nGain.connect(this.inputGain);
            }

            osc.start(time);
            noise.start(time);
            osc.stop(time + dur + 0.02);
            noise.stop(time + dur + 0.02);
        }
    }

    // BASS GUITAR
    playBassStep(step, time) {
        const notes = [
            73.42, null, 73.42, null,
            87.31, null, 98.00, 103.83,
            110.00, null, 73.42, null,
            130.81, null, 110.00, null
        ];
        const freq = notes[step];
        if (!freq) return;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = "sawtooth";
        osc2.type = "triangle";
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq, time);

        const subOsc = this.ctx.createOscillator();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(freq / 2, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, time);
        filter.frequency.exponentialRampToValueAtTime(350, time + 0.25);
        filter.Q.value = 3.5;

        const midFilter = this.ctx.createBiquadFilter();
        midFilter.type = "peaking";
        midFilter.frequency.value = 900;
        midFilter.gain.value = 5.0;
        midFilter.Q.value = 2.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

        osc1.connect(filter);
        osc2.connect(filter);
        subOsc.connect(filter);
        filter.connect(midFilter);
        midFilter.connect(gain);
        gain.connect(this.inputGain);

        osc1.start(time);
        osc2.start(time);
        subOsc.start(time);
        osc1.stop(time + 0.3);
        osc2.stop(time + 0.3);
        subOsc.stop(time + 0.3);
    }

    // ACOUSTIC GUITAR
    playAcousticGuitarStep(step, time) {
        if (step !== 0 && step !== 3 && step !== 6 && step !== 8 && step !== 11 && step !== 14) return;

        const chordProgression = [
            [130.81, 196.00, 246.94, 293.66, 329.63],
            [110.00, 164.81, 196.00, 261.63, 493.88]
        ];
        const chord = chordProgression[Math.floor(this.currentStep / 8) % 2];

        chord.forEach((freq, idx) => {
            const delay = idx * 0.016;
            const stringTime = time + delay;

            const osc = this.ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, stringTime);

            const bodyFilter = this.ctx.createBiquadFilter();
            bodyFilter.type = "bandpass";
            bodyFilter.frequency.value = freq;
            bodyFilter.Q.value = 8.0;

            const highShine = this.ctx.createBiquadFilter();
            highShine.type = "highshelf";
            highShine.frequency.value = 3500;
            highShine.gain.value = 3;

            const stringGain = this.ctx.createGain();
            stringGain.gain.setValueAtTime(0.1, stringTime);
            stringGain.gain.exponentialRampToValueAtTime(0.001, stringTime + 0.7);

            osc.connect(bodyFilter);
            bodyFilter.connect(highShine);
            highShine.connect(stringGain);
            stringGain.connect(this.inputGain);

            osc.start(stringTime);
            osc.stop(stringTime + 0.75);
        });
    }

    // ELECTRIC GUITAR
    playElectricGuitarStep(step, time) {
        if (step !== 0 && step !== 4 && step !== 8 && step !== 12) return;

        const chordFreqs = (step < 8) ? [146.83, 220.00, 293.66] : [130.81, 196.00, 261.63];

        chordFreqs.forEach(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, time);

            const cabLow = this.ctx.createBiquadFilter();
            cabLow.type = "highpass";
            cabLow.frequency.value = 85;

            const cabHigh = this.ctx.createBiquadFilter();
            cabHigh.type = "lowpass";
            cabHigh.frequency.value = 5200;

            const crunchPeak = this.ctx.createBiquadFilter();
            crunchPeak.type = "peaking";
            crunchPeak.frequency.value = 2200;
            crunchPeak.gain.value = 6;
            crunchPeak.Q.value = 2.0;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.14, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);

            osc.connect(cabLow);
            cabLow.connect(cabHigh);
            cabHigh.connect(crunchPeak);
            crunchPeak.connect(gain);
            gain.connect(this.inputGain);

            osc.start(time);
            osc.stop(time + 0.6);
        });
    }

    // VOCAL FORMANT
    playVocalStep(step, time) {
        const vocalMelody = [
            329.63, null, null, 329.63,
            392.00, null, 440.00, null,
            523.25, null, null, 440.00,
            392.00, null, 329.63, null
        ];
        const pitch = vocalMelody[step];
        if (!pitch) return;

        const osc = this.ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(pitch, time);

        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 5.5;
        lfoGain.gain.value = pitch * 0.015;
        lfo.connect(osc.frequency);

        const f1 = this.ctx.createBiquadFilter();
        f1.type = "bandpass";
        f1.frequency.value = 750;
        f1.Q.value = 5.0;

        const f2 = this.ctx.createBiquadFilter();
        f2.type = "bandpass";
        f2.frequency.value = 1350;
        f2.Q.value = 6.0;

        const f3 = this.ctx.createBiquadFilter();
        f3.type = "bandpass";
        f3.frequency.value = 2900;
        f3.Q.value = 7.0;

        const vocalGain = this.ctx.createGain();
        vocalGain.gain.setValueAtTime(0.3, time);
        vocalGain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

        osc.connect(f1);
        osc.connect(f2);
        osc.connect(f3);
        f1.connect(vocalGain);
        f2.connect(vocalGain);
        f3.connect(vocalGain);
        vocalGain.connect(this.inputGain);

        osc.start(time);
        lfo.start(time);
        osc.stop(time + 0.48);
        lfo.stop(time + 0.48);
    }

    // PIANO
    playPianoStep(step, time) {
        if (step !== 0 && step !== 4 && step !== 8 && step !== 12) return;

        const chords = [
            [174.61, 220.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 392.00],
            [164.81, 196.00, 246.94, 329.63],
            [220.00, 261.63, 329.63, 440.00]
        ];
        const chordIndex = Math.floor(step / 4);
        const chord = chords[chordIndex];

        chord.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, time);

            const oscHarmonic = this.ctx.createOscillator();
            oscHarmonic.type = "sine";
            oscHarmonic.frequency.setValueAtTime(freq * 2, time);

            const filter = this.ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(3000, time);
            filter.frequency.exponentialRampToValueAtTime(500, time + 0.9);

            const gain = this.ctx.createGain();
            const noteVel = 0.16 / Math.sqrt(idx + 1);
            gain.gain.setValueAtTime(noteVel, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.95);

            osc.connect(filter);
            oscHarmonic.connect(filter);
            filter.connect(gain);
            gain.connect(this.inputGain);

            osc.start(time);
            oscHarmonic.start(time);
            osc.stop(time + 1.0);
            oscHarmonic.stop(time + 1.0);
        });
    }
}

if (typeof window !== "undefined") {
    window.AudioEngine = AudioEngine;
}
