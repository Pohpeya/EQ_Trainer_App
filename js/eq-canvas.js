/**
 * PRO-EQ Studio Trainer - Interactive Parametric & Graphic EQ Visualizer
 * Inspired by FabFilter Pro-Q 3, Logic Pro Channel EQ, Ableton EQ Eight & Kirchhoff-EQ
 */

const BAND_COLORS = [
    "#ff453a", // Band 1: Red (HPF / Sub)
    "#ff9f0a", // Band 2: Orange (Low Shelf / Bass)
    "#ffd60a", // Band 3: Yellow (Low-Mid)
    "#30d158", // Band 4: Green (Mid)
    "#00d2ff", // Band 5: Cyan (Upper-Mid)
    "#5e5ce6", // Band 6: Indigo (Presence)
    "#bf5af2", // Band 7: Purple (High Shelf / Air)
    "#ff375f"  // Band 8: Pink-Red (LPF)
];

class EQCanvas {
    constructor(canvas, audioEngine, onBandChange, onNodeSelect, onZoneClick, onGraphicChange) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.audio = audioEngine;
        this.onBandChange = onBandChange;
        this.onNodeSelect = onNodeSelect;
        this.onZoneClick = onZoneClick;
        this.onGraphicChange = onGraphicChange;

        this.width = canvas.width;
        this.height = canvas.height;
        this.paddingTop = 48;    // Space for acoustic sub-band bar + instrument sweet-spot pills
        this.paddingBottom = 26; // Space for frequency axis labels

        this.minFreq = 20;
        this.maxFreq = 20000;
        this.minDb = -18;
        this.maxDb = 18;

        this.selectedBand = 2;
        this.hoveredBand = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Graphic EQ drag state
        this.selectedGraphicBand = null;
        this.isDraggingGraphic = false;

        // Cursor position for live Pro-Q crosshair readout
        this.cursorPos = null;
        this.cursorReadoutEl = document.getElementById("cursorFreqReadout");

        // Highlighted zone from hovering Guide cards or top zone bar
        this.highlightedZone = null;

        // Visual spectrum smoothing buffers & peak hold
        this.spectrumPoints = new Float32Array(280);
        this.peakHoldPoints = new Float32Array(280);

        // Precalculated frequency array for filter response
        this.numResponsePoints = 320;
        this.responseFreqs = new Float32Array(this.numResponsePoints);
        for (let i = 0; i < this.numResponsePoints; i++) {
            const frac = i / (this.numResponsePoints - 1);
            this.responseFreqs[i] = this.minFreq * Math.pow(this.maxFreq / this.minFreq, frac);
        }

        // Active instrument zones for overlay
        this.activeZones = [];

        this.initEvents();
        this.resize();
    }

    setDbRange(rangeDb) {
        this.minDb = -rangeDb;
        this.maxDb = rangeDb;
    }

    setHighlightedZone(zone) {
        this.highlightedZone = zone || null;
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
    }

    setActiveZones(zones) {
        this.activeZones = zones || [];
    }

    // -------------------------------------------------------------
    // COORDINATE & MUSICAL PITCH CONVERSIONS
    // -------------------------------------------------------------
    freqToX(freq) {
        const minLog = Math.log10(this.minFreq);
        const maxLog = Math.log10(this.maxFreq);
        const valLog = Math.log10(Math.max(this.minFreq, Math.min(this.maxFreq, freq)));
        return ((valLog - minLog) / (maxLog - minLog)) * this.displayWidth;
    }

    xToFreq(x) {
        const minLog = Math.log10(this.minFreq);
        const maxLog = Math.log10(this.maxFreq);
        const frac = Math.max(0, Math.min(1, x / this.displayWidth));
        return Math.pow(10, minLog + frac * (maxLog - minLog));
    }

    dbToY(db) {
        const usableHeight = this.displayHeight - this.paddingTop - this.paddingBottom;
        const zeroY = this.paddingTop + usableHeight / 2;
        const clampedDb = Math.max(this.minDb, Math.min(this.maxDb, db));
        return zeroY - (clampedDb / this.maxDb) * (usableHeight / 2);
    }

    yToDb(y) {
        const usableHeight = this.displayHeight - this.paddingTop - this.paddingBottom;
        const zeroY = this.paddingTop + usableHeight / 2;
        const db = -((y - zeroY) / (usableHeight / 2)) * this.maxDb;
        return Math.max(this.minDb, Math.min(this.maxDb, db));
    }

    freqToMusicalNote(freq) {
        if (freq < 20 || freq > 20000) return "";
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const midi = Math.round(12 * Math.log2(freq / 440) + 69);
        if (midi < 12 || midi > 127) return "";
        const note = noteNames[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        return `${note}${octave}`;
    }

    parseZoneRange(rangeStr) {
        if (!rangeStr) return null;
        const parts = rangeStr.match(/([\d\.]+)\s*(k?Hz)\s*-\s*([\d\.]+)\s*(k?Hz)/i);
        if (!parts) return null;
        const f1 = parseFloat(parts[1]) * (parts[2].toLowerCase() === "khz" ? 1000 : 1);
        const f2 = parseFloat(parts[3]) * (parts[4].toLowerCase() === "khz" ? 1000 : 1);
        return { f1, f2 };
    }

    // -------------------------------------------------------------
    // EVENT HANDLING (DRAG, HOVER, WHEEL FOR Q, CROSSHAIR)
    // -------------------------------------------------------------
    initEvents() {
        window.addEventListener("resize", () => this.resize());

        this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        window.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        window.addEventListener("mouseup", () => this.handleMouseUp());
        this.canvas.addEventListener("mouseleave", () => {
            this.cursorPos = null;
            if (!this.isDragging) this.hoveredBand = null;
            if (this.cursorReadoutEl) this.cursorReadoutEl.textContent = "--- Hz | -- dB";
        });
        this.canvas.addEventListener("wheel", (e) => this.handleWheel(e), { passive: false });
        this.canvas.addEventListener("dblclick", (e) => this.handleDblClick(e));

        // Touch support
        this.canvas.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, rect });
            }
        }, { passive: false });

        window.addEventListener("touchmove", (e) => {
            if ((this.isDragging || this.isDraggingGraphic) && e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }, { passive: false });

        window.addEventListener("touchend", () => this.handleMouseUp());
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    findBandUnderPointer(pos) {
        const radius = 16;
        for (let i = 0; i < this.audio.bands.length; i++) {
            const b = this.audio.bands[i];
            const bx = this.freqToX(b.freq);
            const by = this.dbToY(b.gain);
            const dist = Math.hypot(pos.x - bx, pos.y - by);
            if (dist <= radius) {
                return i;
            }
        }
        return null;
    }

    handleMouseDown(e) {
        const pos = this.getCanvasPos(e);

        // Check if clicked in top sweet-spot zone bar (20px - 46px)
        if (pos.y >= 18 && pos.y <= 46 && this.activeZones && this.activeZones.length > 0) {
            for (let zone of this.activeZones) {
                const parsed = this.parseZoneRange(zone.range);
                if (parsed) {
                    const x1 = Math.max(0, this.freqToX(parsed.f1));
                    const x2 = Math.min(this.displayWidth, this.freqToX(parsed.f2));
                    if (pos.x >= x1 && pos.x <= x2) {
                        if (this.onZoneClick) {
                            this.onZoneClick(zone);
                            return;
                        }
                    }
                }
            }
        }

        // Check if in Graphic EQ mode
        if (this.audio.eqMode === "graphic") {
            const freqs = this.audio.graphicFreqs;
            for (let i = 0; i < freqs.length; i++) {
                const bx = this.freqToX(freqs[i]);
                if (Math.abs(pos.x - bx) <= 24) {
                    this.selectedGraphicBand = i;
                    this.isDraggingGraphic = true;
                    const newGain = Math.max(-12, Math.min(12, this.yToDb(pos.y)));
                    this.audio.setGraphicGain(i, newGain);
                    if (this.onGraphicChange) this.onGraphicChange(i, newGain);
                    return;
                }
            }
            return;
        }

        const bandIdx = this.findBandUnderPointer(pos);
        if (bandIdx !== null) {
            this.selectedBand = bandIdx;
            this.isDragging = true;
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;
            if (this.onNodeSelect) this.onNodeSelect(bandIdx);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const isInside = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (isInside) {
            this.cursorPos = pos;
            const cFreq = this.xToFreq(pos.x);
            const cDb = this.yToDb(pos.y);
            const note = this.freqToMusicalNote(cFreq);
            const freqStr = cFreq >= 1000 ? (cFreq / 1000).toFixed(2) + " kHz" : Math.round(cFreq) + " Hz";
            const dbStr = (cDb > 0 ? "+" : "") + cDb.toFixed(1) + " dB";
            if (this.cursorReadoutEl) {
                this.cursorReadoutEl.textContent = `${freqStr} (${note}) | ${dbStr}`;
            }
        }

        if (this.isDraggingGraphic && this.selectedGraphicBand !== null) {
            const newGain = Math.max(-12, Math.min(12, this.yToDb(pos.y)));
            this.audio.setGraphicGain(this.selectedGraphicBand, newGain);
            if (this.onGraphicChange) this.onGraphicChange(this.selectedGraphicBand, newGain);
            return;
        }

        if (this.isDragging && this.selectedBand !== null) {
            const b = this.audio.bands[this.selectedBand];
            let newFreq = this.xToFreq(pos.x);
            let newGain = Math.max(-18, Math.min(18, this.yToDb(pos.y)));

            if (b.type === "highpass" || b.type === "lowpass") {
                newGain = 0;
            }

            if (!b.enabled) {
                this.audio.updateBand(this.selectedBand, { enabled: true });
            }

            this.audio.updateBand(this.selectedBand, {
                freq: newFreq,
                gain: newGain
            });

            if (this.onBandChange) {
                this.onBandChange(this.selectedBand, this.audio.bands[this.selectedBand]);
            }
        } else if (isInside) {
            const hovered = this.findBandUnderPointer(pos);
            this.hoveredBand = hovered;
            if (pos.y >= 18 && pos.y <= 46) {
                this.canvas.style.cursor = "pointer";
            } else {
                this.canvas.style.cursor = (hovered !== null) ? "grab" : "crosshair";
            }
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isDraggingGraphic = false;
        this.selectedGraphicBand = null;
        if (this.hoveredBand !== null) {
            this.canvas.style.cursor = "grab";
        }
    }

    handleWheel(e) {
        const pos = this.getCanvasPos(e);
        const targetBand = (this.hoveredBand !== null) ? this.hoveredBand : this.selectedBand;
        if (targetBand !== null && this.audio.eqMode === "parametric") {
            e.preventDefault();
            const b = this.audio.bands[targetBand];
            const delta = e.deltaY > 0 ? -0.18 : 0.18;
            let newQ = Math.max(0.2, Math.min(10, b.q + delta));
            this.audio.updateBand(targetBand, { q: newQ });
            if (this.onBandChange) {
                this.onBandChange(targetBand, this.audio.bands[targetBand]);
            }
        }
    }

    handleDblClick(e) {
        const pos = this.getCanvasPos(e);
        if (this.audio.eqMode === "graphic") {
            const freqs = this.audio.graphicFreqs;
            for (let i = 0; i < freqs.length; i++) {
                const bx = this.freqToX(freqs[i]);
                if (Math.abs(pos.x - bx) <= 24) {
                    this.audio.setGraphicGain(i, 0);
                    if (this.onGraphicChange) this.onGraphicChange(i, 0);
                    return;
                }
            }
            return;
        }

        const bandIdx = this.findBandUnderPointer(pos);
        if (bandIdx !== null) {
            this.audio.updateBand(bandIdx, { gain: 0 });
            if (this.onBandChange) {
                this.onBandChange(bandIdx, this.audio.bands[bandIdx]);
            }
        }
    }

    // -------------------------------------------------------------
    // MAIN 60FPS RENDER PIPELINE
    // -------------------------------------------------------------
    draw() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;

        if (!w || !h) {
            requestAnimationFrame(() => this.draw());
            return;
        }

        ctx.clearRect(0, 0, w, h);

        // 1. Logarithmic Studio Grid & Acoustic Sub-Band Header
        this.drawGrid(ctx, w, h);

        // 2. Highlighted Zone Spotlight (when hovering guide card)
        this.drawHighlightedZoneSpotlight(ctx, w, h);

        // 3. Real-Time FFT Spectrum Analyzer + Peak Hold
        this.drawSpectrum(ctx, w, h);

        // 4. Top Instrument Sweet-Spot Zones Bar
        this.drawZoneOverlay(ctx, w, h);

        // 5. Individual Per-Band Shaded Curves (Pro-Q 3 / Logic Channel EQ style)
        if (this.audio.eqMode === "parametric" && !this.audio.isBypassed) {
            this.drawIndividualBandCurves(ctx, w, h);
        }

        // 6. Master Composite EQ Curve
        this.drawEQResponseCurve(ctx, w, h);

        // 7. Live Cursor Crosshair
        this.drawCursorCrosshair(ctx, w, h);

        // 8. Interactive Filter Nodes
        this.drawBandNodes(ctx, w, h);

        requestAnimationFrame(() => this.draw());
    }

    // -------------------------------------------------------------
    // 1. STUDIO LOGARITHMIC GRID & SUB-BAND HEADER
    // -------------------------------------------------------------
    drawGrid(ctx, w, h) {
        ctx.save();

        // Top Acoustic Sub-Bands Reference Bar (0 to 20px)
        const acousticBands = [
            { name: "SUB BASS", f1: 20, f2: 60, color: "rgba(255, 69, 58, 0.08)" },
            { name: "BASS", f1: 60, f2: 250, color: "rgba(255, 159, 10, 0.08)" },
            { name: "LOW MID", f1: 250, f2: 500, color: "rgba(255, 214, 10, 0.07)" },
            { name: "MIDRANGE", f1: 500, f2: 2000, color: "rgba(48, 209, 88, 0.07)" },
            { name: "UPPER MID", f1: 2000, f2: 4000, color: "rgba(0, 210, 255, 0.08)" },
            { name: "PRESENCE", f1: 4000, f2: 6000, color: "rgba(94, 92, 230, 0.08)" },
            { name: "BRILLIANCE / AIR", f1: 6000, f2: 20000, color: "rgba(191, 90, 242, 0.08)" }
        ];

        acousticBands.forEach(ab => {
            const x1 = this.freqToX(ab.f1);
            const x2 = this.freqToX(ab.f2);
            ctx.fillStyle = ab.color;
            ctx.fillRect(x1, 0, x2 - x1, 19);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x2, 0);
            ctx.lineTo(x2, 19);
            ctx.stroke();

            if (x2 - x1 > 42) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
                ctx.font = "600 9px 'JetBrains Mono', monospace";
                ctx.textAlign = "center";
                ctx.fillText(ab.name, (x1 + x2) / 2, 13);
            }
        });

        // Subtle divider below acoustic sub-bands
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(0, 19);
        ctx.lineTo(w, 19);
        ctx.stroke();

        // Minor Logarithmic Vertical Lines
        const minorFreqs = [
            30, 40, 60, 70, 80, 90,
            300, 400, 600, 700, 800, 900,
            3000, 4000, 6000, 7000, 8000, 9000
        ];
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        minorFreqs.forEach(f => {
            const x = Math.round(this.freqToX(f)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, this.paddingTop);
            ctx.lineTo(x, h - this.paddingBottom);
            ctx.stroke();
        });

        // Major Logarithmic Vertical Lines & Bottom Labels
        const majorFreqs = [
            { f: 20, l: "20" },
            { f: 50, l: "50" },
            { f: 100, l: "100" },
            { f: 200, l: "200" },
            { f: 500, l: "500" },
            { f: 1000, l: "1k" },
            { f: 2000, l: "2k" },
            { f: 5000, l: "5k" },
            { f: 10000, l: "10k" },
            { f: 20000, l: "20k" }
        ];

        majorFreqs.forEach(item => {
            const x = Math.round(this.freqToX(item.f)) + 0.5;
            const isDecade = (item.f === 100 || item.f === 1000 || item.f === 10000);
            ctx.strokeStyle = isDecade ? "rgba(255, 255, 255, 0.11)" : "rgba(255, 255, 255, 0.06)";
            ctx.beginPath();
            ctx.moveTo(x, this.paddingTop);
            ctx.lineTo(x, h - this.paddingBottom);
            ctx.stroke();

            ctx.fillStyle = isDecade ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.42)";
            ctx.font = isDecade ? "600 10px 'JetBrains Mono', monospace" : "400 10px 'JetBrains Mono', monospace";
            ctx.textAlign = (item.f === 20) ? "left" : (item.f === 20000 ? "right" : "center");
            const labelX = (item.f === 20) ? x + 4 : (item.f === 20000 ? x - 4 : x);
            ctx.fillText(item.l, labelX, h - 8);
        });

        // Horizontal dB Grid Lines
        const step = this.maxDb === 12 ? 3 : (this.maxDb === 30 ? 10 : 6);
        const dbMarks = [];
        for (let db = this.maxDb; db >= this.minDb; db -= step) {
            dbMarks.push(db);
        }

        dbMarks.forEach(db => {
            const y = Math.round(this.dbToY(db)) + 0.5;
            const isZero = (db === 0);
            ctx.strokeStyle = isZero ? "rgba(255, 255, 255, 0.28)" : "rgba(255, 255, 255, 0.055)";
            ctx.lineWidth = isZero ? 1.2 : 1;

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            ctx.fillStyle = isZero ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.35)";
            ctx.font = "500 9.5px 'JetBrains Mono', monospace";
            ctx.textAlign = "right";
            ctx.fillText((db > 0 ? "+" : "") + db + " dB", w - 8, y - 4);
        });

        ctx.restore();
    }

    // -------------------------------------------------------------
    // 2. SPOTLIGHT WHEN HOVERING GUIDE ZONE
    // -------------------------------------------------------------
    drawHighlightedZoneSpotlight(ctx, w, h) {
        if (!this.highlightedZone) return;
        const parsed = this.parseZoneRange(this.highlightedZone.range);
        if (!parsed) return;

        const x1 = Math.max(0, this.freqToX(parsed.f1));
        const x2 = Math.min(w, this.freqToX(parsed.f2));
        const zw = Math.max(4, x2 - x1);
        const color = this.highlightedZone.color || "#00d2ff";

        ctx.save();
        // Vertical glowing curtain
        const grad = ctx.createLinearGradient(0, this.paddingTop, 0, h - this.paddingBottom);
        grad.addColorStop(0, color + "33");
        grad.addColorStop(0.5, color + "18");
        grad.addColorStop(1, color + "33");
        ctx.fillStyle = grad;
        ctx.fillRect(x1, this.paddingTop, zw, h - this.paddingTop - this.paddingBottom);

        // Left & Right boundary dashed lines
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, this.paddingTop);
        ctx.lineTo(x1, h - this.paddingBottom);
        ctx.moveTo(x2, this.paddingTop);
        ctx.lineTo(x2, h - this.paddingBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Spotlight Floating Banner
        const cx = Math.max(90, Math.min(w - 90, (x1 + x2) / 2));
        ctx.fillStyle = "rgba(10, 14, 22, 0.92)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        const label = `🎯 ${this.highlightedZone.name} (${this.highlightedZone.range})`;
        ctx.font = "600 11px 'Prompt', sans-serif";
        const tw = ctx.measureText(label).width;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(cx - tw / 2 - 10, this.paddingTop + 10, tw + 20, 24, 6);
            ctx.fill();
            ctx.stroke();
        }
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(label, cx, this.paddingTop + 26);

        ctx.restore();
    }

    // -------------------------------------------------------------
    // 3. TOP INSTRUMENT SWEET-SPOT PILLS BAR
    // -------------------------------------------------------------
    drawZoneOverlay(ctx, w, h) {
        if (!this.activeZones || this.activeZones.length === 0) return;
        ctx.save();

        this.activeZones.forEach(zone => {
            const parsed = this.parseZoneRange(zone.range);
            if (!parsed) return;

            const x1 = Math.max(2, this.freqToX(parsed.f1));
            const x2 = Math.min(w - 2, this.freqToX(parsed.f2));
            const zoneWidth = Math.max(4, x2 - x1);
            const isHighlighted = (this.highlightedZone === zone);
            const color = zone.color || "#00d2ff";

            // Pill Box in row y=22..42
            ctx.fillStyle = color;
            ctx.globalAlpha = isHighlighted ? 0.35 : 0.16;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x1, 22, zoneWidth, 20, 4);
                ctx.fill();
            } else {
                ctx.fillRect(x1, 22, zoneWidth, 20);
            }

            ctx.globalAlpha = isHighlighted ? 1.0 : 0.75;
            ctx.strokeStyle = color;
            ctx.lineWidth = isHighlighted ? 1.8 : 1;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x1, 22, zoneWidth, 20, 4);
                ctx.stroke();
            }

            if (zoneWidth > 38) {
                ctx.globalAlpha = 0.95;
                ctx.fillStyle = "#ffffff";
                ctx.font = "600 9.5px 'Prompt', sans-serif";
                ctx.textAlign = "center";
                let cleanName = zone.name.split("(")[0].trim();
                if (zoneWidth < 80 && cleanName.length > 10) {
                    cleanName = cleanName.substring(0, 9) + "…";
                }
                ctx.fillText(cleanName, (x1 + x2) / 2, 35);
            }
        });

        ctx.restore();
    }

    // -------------------------------------------------------------
    // 4. REAL-TIME FFT SPECTRUM + PEAK HOLD TRACE
    // -------------------------------------------------------------
    drawSpectrum(ctx, w, h) {
        if (!this.audio.analyser) return;

        const bufferLength = this.audio.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.audio.analyser.getByteFrequencyData(dataArray);

        const sampleRate = this.audio.ctx ? this.audio.ctx.sampleRate : 44100;
        const binSize = sampleRate / (bufferLength * 2);

        const numPoints = this.spectrumPoints.length;
        const bottomY = h - this.paddingBottom;
        const usableH = h - this.paddingTop - this.paddingBottom;

        ctx.save();

        // Main RTA Fill Path
        ctx.beginPath();
        ctx.moveTo(0, bottomY);

        for (let i = 0; i < numPoints; i++) {
            const frac = i / (numPoints - 1);
            const freq = this.minFreq * Math.pow(this.maxFreq / this.minFreq, frac);
            const exactBin = freq / binSize;
            const b0 = Math.min(bufferLength - 1, Math.floor(exactBin));
            const b1 = Math.min(bufferLength - 1, Math.ceil(exactBin));
            const interp = exactBin - b0;
            const rawVal = ((dataArray[b0] * (1 - interp)) + (dataArray[b1] * interp)) / 255.0;

            // Smooth attack/release
            this.spectrumPoints[i] = rawVal > this.spectrumPoints[i]
                ? rawVal * 0.65 + this.spectrumPoints[i] * 0.35
                : this.spectrumPoints[i] * 0.91;

            // Peak hold with gentle decay
            if (this.spectrumPoints[i] >= this.peakHoldPoints[i]) {
                this.peakHoldPoints[i] = this.spectrumPoints[i];
            } else {
                this.peakHoldPoints[i] = Math.max(0, this.peakHoldPoints[i] - 0.0022);
            }

            const x = frac * w;
            const y = bottomY - (this.spectrumPoints[i] * usableH * 0.88);
            ctx.lineTo(x, y);
        }

        ctx.lineTo(w, bottomY);
        ctx.closePath();

        // Pro-Q 3 style analyzer gradient fill
        const grad = ctx.createLinearGradient(0, this.paddingTop, 0, bottomY);
        grad.addColorStop(0, "rgba(0, 210, 255, 0.32)");
        grad.addColorStop(0.55, "rgba(88, 86, 214, 0.16)");
        grad.addColorStop(1, "rgba(15, 20, 32, 0.02)");
        ctx.fillStyle = grad;
        ctx.fill();

        // Crisp top edge of RTA
        ctx.strokeStyle = "rgba(0, 220, 255, 0.62)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Peak Hold Trace Line
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
            const x = (i / (numPoints - 1)) * w;
            const y = bottomY - (this.peakHoldPoints[i] * usableH * 0.88);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(0, 210, 255, 0.24)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // -------------------------------------------------------------
    // 5. INDIVIDUAL PER-BAND SHADED CURVES (FabFilter / Logic EQ style)
    // -------------------------------------------------------------
    drawIndividualBandCurves(ctx, w, h) {
        const nodes = this.audio.filterNodes;
        if (!nodes || nodes.length === 0) return;

        const numPoints = this.numResponsePoints;
        const tempMag = new Float32Array(numPoints);
        const tempPhase = new Float32Array(numPoints);
        const zeroY = this.dbToY(0);

        ctx.save();
        for (let b = 0; b < nodes.length; b++) {
            const band = this.audio.bands[b];
            if (!band || !band.enabled) continue;

            const isActiveFilter = (band.type === "highpass" && band.freq > 22) ||
                                   (band.type === "lowpass" && band.freq < 19500) ||
                                   (Math.abs(band.gain) >= 0.15) ||
                                   (this.selectedBand === b) ||
                                   (this.hoveredBand === b);

            if (!isActiveFilter) continue;

            nodes[b].getFrequencyResponse(this.responseFreqs, tempMag, tempPhase);
            const color = BAND_COLORS[b % BAND_COLORS.length];
            const isFocused = (this.selectedBand === b || this.hoveredBand === b);

            ctx.beginPath();
            for (let i = 0; i < numPoints; i++) {
                const db = 20 * Math.log10(Math.max(0.0001, tempMag[i]));
                const x = this.freqToX(this.responseFreqs[i]);
                const y = this.dbToY(db);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            // Stroke individual band curve
            ctx.strokeStyle = color;
            ctx.globalAlpha = isFocused ? 0.85 : 0.45;
            ctx.lineWidth = isFocused ? 1.8 : 1.1;
            ctx.stroke();

            // Fill between curve and 0 dB line
            ctx.lineTo(w, zeroY);
            ctx.lineTo(0, zeroY);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.globalAlpha = isFocused ? 0.18 : 0.08;
            ctx.fill();
        }
        ctx.restore();
    }

    // -------------------------------------------------------------
    // 6. MASTER COMPOSITE EQ RESPONSE CURVE
    // -------------------------------------------------------------
    drawEQResponseCurve(ctx, w, h) {
        const isGraphic = (this.audio.eqMode === "graphic");
        const activeNodes = isGraphic ? this.audio.graphicFilterNodes : this.audio.filterNodes;
        if (!activeNodes || activeNodes.length === 0) return;

        const numPoints = this.numResponsePoints;
        const totalMag = new Float32Array(numPoints).fill(1.0);
        const tempMag = new Float32Array(numPoints);
        const tempPhase = new Float32Array(numPoints);

        for (let b = 0; b < activeNodes.length; b++) {
            const node = activeNodes[b];
            if (!this.audio.isBypassed) {
                if (isGraphic || this.audio.bands[b].enabled) {
                    node.getFrequencyResponse(this.responseFreqs, tempMag, tempPhase);
                    for (let i = 0; i < numPoints; i++) {
                        totalMag[i] *= tempMag[i];
                    }
                }
            }
        }

        ctx.save();
        ctx.beginPath();
        const zeroY = this.dbToY(0);

        for (let i = 0; i < numPoints; i++) {
            const freq = this.responseFreqs[i];
            const mag = totalMag[i];
            const db = 20 * Math.log10(Math.max(0.0001, mag));
            const x = this.freqToX(freq);
            const y = this.dbToY(db);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        const curveColor = this.audio.isBypassed
            ? "rgba(255, 255, 255, 0.35)"
            : (isGraphic ? "#00d2ff" : "#ffd60a");

        ctx.strokeStyle = curveColor;
        ctx.lineWidth = 2.6;
        ctx.shadowColor = this.audio.isBypassed ? "transparent" : curveColor;
        ctx.shadowBlur = 10;
        ctx.stroke();

        if (isGraphic) {
            ctx.lineTo(w, zeroY);
            ctx.lineTo(0, zeroY);
            ctx.closePath();
            const fillGrad = ctx.createLinearGradient(0, this.paddingTop, 0, h - this.paddingBottom);
            fillGrad.addColorStop(0, "rgba(0, 210, 255, 0.16)");
            fillGrad.addColorStop(0.5, "rgba(0, 210, 255, 0.05)");
            fillGrad.addColorStop(1, "rgba(0, 210, 255, 0.0)");
            ctx.fillStyle = fillGrad;
            ctx.shadowBlur = 0;
            ctx.fill();
        }

        ctx.restore();
    }

    // -------------------------------------------------------------
    // 7. LIVE CURSOR CROSSHAIR
    // -------------------------------------------------------------
    drawCursorCrosshair(ctx, w, h) {
        if (!this.cursorPos || this.isDragging || this.isDraggingGraphic) return;
        const { x, y } = this.cursorPos;
        if (y < this.paddingTop || y > h - this.paddingBottom) return;

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        ctx.moveTo(x, this.paddingTop);
        ctx.lineTo(x, h - this.paddingBottom);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.restore();
    }

    // -------------------------------------------------------------
    // 8. GRAPHIC & PARAMETRIC DRAGGABLE NODES
    // -------------------------------------------------------------
    drawGraphicNodes(ctx, w, h) {
        const freqs = this.audio.graphicFreqs;
        const gains = this.audio.graphicGains;
        const zeroY = this.dbToY(0);

        ctx.save();
        for (let i = 0; i < freqs.length; i++) {
            const f = freqs[i];
            const g = gains[i];
            const x = this.freqToX(f);
            const y = this.dbToY(g);

            // Vertical fader column line
            ctx.strokeStyle = "rgba(0, 210, 255, 0.15)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(x, this.paddingTop);
            ctx.lineTo(x, h - this.paddingBottom);
            ctx.stroke();

            // Glow bar from 0dB to current gain
            ctx.setLineDash([]);
            ctx.strokeStyle = g >= 0 ? "rgba(0, 210, 255, 0.75)" : "rgba(255, 69, 58, 0.75)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, zeroY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Draggable fader handle cap
            ctx.fillStyle = g >= 0 ? "#00d2ff" : "#ff453a";
            ctx.shadowColor = g >= 0 ? "#00d2ff" : "#ff453a";
            ctx.shadowBlur = (this.selectedGraphicBand === i) ? 14 : 6;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - 10, y - 6, 20, 12, 3);
            } else {
                ctx.rect(x - 10, y - 6, 20, 12);
            }
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x - 5, y - 1, 10, 2);

            // Numeric dB badge above fader
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.font = "600 9.5px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            const valStr = (g > 0 ? "+" : "") + g.toFixed(1);
            ctx.fillText(valStr, x, y - 10);
        }
        ctx.restore();
    }

    drawBandNodes(ctx, w, h) {
        if (this.audio.eqMode === "graphic") {
            this.drawGraphicNodes(ctx, w, h);
            return;
        }

        const bands = this.audio.bands;

        bands.forEach((b, i) => {
            const x = this.freqToX(b.freq);
            const y = this.dbToY(b.gain);
            const isHovered = (this.hoveredBand === i);
            const isSelected = (this.selectedBand === i);
            const isSoloed = (this.audio.soloBandIndex === i);
            const color = BAND_COLORS[i % BAND_COLORS.length];

            ctx.save();

            if (!b.enabled) {
                ctx.globalAlpha = 0.35;
            }

            // Solo audition aura
            if (isSoloed) {
                ctx.beginPath();
                ctx.arc(x, y, 22, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 55, 95, 0.32)";
                ctx.fill();
                ctx.strokeStyle = "#ff375f";
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Selected Halo Ring
            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = b.enabled ? 0.65 : 0.3;
                ctx.stroke();
                ctx.globalAlpha = b.enabled ? 1.0 : 0.35;
            }

            // Main Colored Node Circle
            const r = isSelected ? 10.5 : (isHovered ? 9.5 : 8.5);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = (isSelected || isHovered) ? 14 : 5;
            ctx.fill();

            // Band Number Inside Node (Pro-Q 3 style!)
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#0b0d13";
            ctx.font = "800 10px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText((i + 1).toString(), x, y + 0.5);

            // Floating HUD Callout on Selected / Hovered Node
            if (isSelected || isHovered) {
                const textHz = b.freq >= 1000 ? (b.freq / 1000).toFixed(2) + " kHz" : Math.round(b.freq) + " Hz";
                const note = this.freqToMusicalNote(b.freq);
                const textDb = (b.gain > 0 ? "+" : "") + b.gain.toFixed(1) + " dB";
                const textQ = "Q " + b.q.toFixed(2);
                const tooltipText = `B${i + 1} (${b.label})  •  ${textHz} [${note}]  •  ${textDb}  •  ${textQ}`;

                ctx.font = "600 10.5px 'JetBrains Mono', monospace";
                const textWidth = ctx.measureText(tooltipText).width;
                const boxW = textWidth + 18;
                const boxX = Math.max(8, Math.min(w - boxW - 8, x - boxW / 2));
                const tipY = (y > this.paddingTop + 48) ? y - 24 : y + 26;

                ctx.fillStyle = "rgba(11, 14, 22, 0.94)";
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(boxX, tipY - 12, boxW, 22, 5);
                } else {
                    ctx.rect(boxX, tipY - 12, boxW, 22);
                }
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "#ffffff";
                ctx.textBaseline = "alphabetic";
                ctx.textAlign = "center";
                ctx.fillText(tooltipText, boxX + boxW / 2, tipY + 3);
            }

            ctx.restore();
        });
    }
}

if (typeof window !== "undefined") {
    window.EQCanvas = EQCanvas;
    window.BAND_COLORS = BAND_COLORS;
}
