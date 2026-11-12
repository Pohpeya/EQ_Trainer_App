/**
 * EQ Master Trainer - Interactive Spectrum Analyzer & Sweet-Spot Visualizer
 * Fully responsive for Desktop, Mobile Portrait & Mobile Landscape with Multi-Touch Support
 * Supports Low Cut (HPF) Visualization, Sweet Spot Gain & Interactive Q Width
 */

class EQCanvas {
    constructor(canvas, audioEngine, onSweetSpotChange, onHoverChange, onQChange) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.audio = audioEngine;
        this.onSweetSpotChange = onSweetSpotChange;
        this.onHoverChange = onHoverChange;
        this.onQChange = onQChange;

        this.displayWidth = canvas.width;
        this.displayHeight = canvas.height;
        this.paddingTop = 46;
        this.paddingBottom = 26;

        this.minFreq = 20;
        this.maxFreq = 20000;
        this.minDb = -12;
        this.maxDb = 12;

        this.activeZones = [];
        this.hoveredIndex = -1;
        this.draggedIndex = -1;
        this.isDragging = false;

        // Double-tap tracking for mobile
        this.lastTapTime = 0;
        this.lastTapIndex = -1;

        // RTA smoothing buffers
        this.numSpectrumPoints = 240;
        this.spectrumPoints = new Float32Array(this.numSpectrumPoints);
        this.peakHoldPoints = new Float32Array(this.numSpectrumPoints);

        // Precalculated frequency response points
        this.numResponsePoints = 280;
        this.responseFreqs = new Float32Array(this.numResponsePoints);
        for (let i = 0; i < this.numResponsePoints; i++) {
            const frac = i / (this.numResponsePoints - 1);
            this.responseFreqs[i] = this.minFreq * Math.pow(this.maxFreq / this.minFreq, frac);
        }

        this.cursorReadoutEl = document.getElementById("cursorFreqReadout");

        this.initEvents();
        this.resize();
    }

    setZones(zones) {
        this.activeZones = zones || [];
        this.hoveredIndex = -1;
        this.draggedIndex = -1;
        this.isDragging = false;
    }

    setHoveredIndex(index) {
        this.hoveredIndex = index;
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        this.canvas.width = Math.round(rect.width * dpr);
        this.canvas.height = Math.round(rect.height * dpr);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;

        const isCompact = (rect.height < 240 || rect.width < 500);
        this.paddingTop = isCompact ? 38 : 46;
        this.paddingBottom = isCompact ? 20 : 26;
    }

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

    initEvents() {
        const c = this.canvas;

        const getPos = (e) => {
            const rect = c.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const findNearestZone = (x, y) => {
            if (!this.activeZones || this.activeZones.length === 0) return -1;
            let bestIdx = -1;
            let minDistance = Infinity;

            for (let i = 0; i < this.activeZones.length; i++) {
                const z = this.activeZones[i];
                const nodeX = this.freqToX(z.centerFreq);
                const currentGain = (this.audio.bands[i] ? this.audio.bands[i].gain : 0);
                const nodeY = this.dbToY(currentGain);

                const dx = x - nodeX;
                const dy = y - nodeY;
                const distNode = Math.sqrt(dx * dx + dy * dy);

                // Distance to node handle (36px) or vertical line (28px)
                if (distNode < 36 && distNode < minDistance) {
                    minDistance = distNode;
                    bestIdx = i;
                } else if (Math.abs(dx) < 28 && Math.abs(dx) < minDistance) {
                    minDistance = Math.abs(dx);
                    bestIdx = i;
                }
            }
            return bestIdx;
        };

        // Pointer Move
        const onMove = (e) => {
            const pos = getPos(e);
            const freq = this.xToFreq(pos.x);
            const db = this.yToDb(pos.y);

            if (this.cursorReadoutEl) {
                const freqStr = freq >= 1000 ? (freq / 1000).toFixed(2) + " kHz" : Math.round(freq) + " Hz";
                const dbStr = (db >= 0 ? "+" : "") + db.toFixed(1) + " dB";
                this.cursorReadoutEl.textContent = `${freqStr} | ${dbStr}`;
            }

            if (this.isDragging && this.draggedIndex !== -1) {
                if (e.cancelable) e.preventDefault();
                const newGain = Math.round(this.yToDb(pos.y) * 2) / 2; // snap to 0.5 dB
                const clamped = Math.max(-12, Math.min(12, newGain));
                if (this.onSweetSpotChange) {
                    this.onSweetSpotChange(this.draggedIndex, clamped);
                }
            } else {
                const hovered = findNearestZone(pos.x, pos.y);
                if (hovered !== this.hoveredIndex) {
                    this.hoveredIndex = hovered;
                    if (this.onHoverChange) this.onHoverChange(hovered);
                    c.style.cursor = hovered !== -1 ? "ns-resize" : "crosshair";
                }
            }
        };

        // Pointer Down
        const onStart = (e) => {
            const pos = getPos(e);
            const nearest = findNearestZone(pos.x, pos.y);

            // Double tap check to reset
            const now = Date.now();
            if (nearest !== -1 && nearest === this.lastTapIndex && (now - this.lastTapTime) < 320) {
                if (this.onSweetSpotChange) {
                    this.onSweetSpotChange(nearest, 0);
                }
                this.lastTapTime = 0;
                this.lastTapIndex = -1;
                return;
            }
            this.lastTapTime = now;
            this.lastTapIndex = nearest;

            if (nearest !== -1) {
                if (e.cancelable) e.preventDefault();
                this.isDragging = true;
                this.draggedIndex = nearest;
                this.hoveredIndex = nearest;
                c.style.cursor = "ns-resize";

                const newGain = Math.round(this.yToDb(pos.y) * 2) / 2;
                const clamped = Math.max(-12, Math.min(12, newGain));
                if (this.onSweetSpotChange) {
                    this.onSweetSpotChange(nearest, clamped);
                }
            }
        };

        // Pointer Up
        const onEnd = () => {
            this.isDragging = false;
            this.draggedIndex = -1;
            c.style.cursor = this.hoveredIndex !== -1 ? "ns-resize" : "crosshair";
        };

        // Mouse Wheel for Q adjustment on node
        c.addEventListener("wheel", (e) => {
            const pos = getPos(e);
            const nearest = findNearestZone(pos.x, pos.y);
            if (nearest !== -1) {
                e.preventDefault();
                const currentQ = (this.audio.bands[nearest] ? this.audio.bands[nearest].q : 1.4);
                const delta = e.deltaY > 0 ? -0.2 : 0.2;
                const newQ = Math.round(Math.max(0.4, Math.min(6.0, currentQ + delta)) * 10) / 10;
                if (this.onQChange) {
                    this.onQChange(nearest, newQ);
                }
            }
        }, { passive: false });

        c.addEventListener("mousedown", onStart);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onEnd);

        c.addEventListener("touchstart", onStart, { passive: false });
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd);
        window.addEventListener("touchcancel", onEnd);

        c.addEventListener("dblclick", (e) => {
            const pos = getPos(e);
            const nearest = findNearestZone(pos.x, pos.y);
            if (nearest !== -1 && this.onSweetSpotChange) {
                this.onSweetSpotChange(nearest, 0);
            }
        });

        window.addEventListener("resize", () => {
            this.resize();
        });
    }

    draw() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;

        ctx.clearRect(0, 0, w, h);

        // 1. Draw Background Grid & Frequency Labels
        this.drawGrid(ctx, w, h);

        // 2. Draw Real-Time RTA Spectrum (if playing)
        this.drawSpectrum(ctx, w, h);

        // 3. Draw Low Cut Filter Visualizer Overlay
        this.drawLowCutOverlay(ctx, w, h);

        // 4. Draw Composite EQ Curve
        this.drawMasterEQCurve(ctx, w, h);

        // 5. Draw Sweet-Spot Target Lines, Interactive Pin Callouts & Q Bandwidth
        this.drawSweetSpots(ctx, w, h);
    }

    drawGrid(ctx, w, h) {
        const usableH = h - this.paddingTop - this.paddingBottom;
        const zeroY = this.paddingTop + usableH / 2;

        ctx.save();

        // Background dark gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, "#0b0f19");
        bgGrad.addColorStop(1, "#070a10");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Frequency Grid Lines
        const freqs = [30, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000];
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.font = "500 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";

        freqs.forEach(f => {
            const x = Math.round(this.freqToX(f));
            ctx.beginPath();
            ctx.moveTo(x, this.paddingTop - 10);
            ctx.lineTo(x, h - this.paddingBottom + 4);
            ctx.stroke();

            const lbl = f >= 1000 ? `${f / 1000}k` : `${f}`;
            ctx.fillText(lbl, x, h - 8);
        });

        // dB Horizontal Lines (-12, -6, -4, -2, 0, +2, +4, +6, +12)
        const dbs = [-12, -6, -4, -2, 0, 2, 4, 6, 12];
        dbs.forEach(db => {
            const y = Math.round(this.dbToY(db));
            const isZero = (db === 0);
            const isMajor = (Math.abs(db) === 6 || Math.abs(db) === 12 || isZero);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.strokeStyle = isZero ? "rgba(255, 255, 255, 0.22)" : (isMajor ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.025)");
            ctx.lineWidth = isZero ? 1.4 : 1;
            ctx.stroke();

            // Label on major levels
            if (isMajor) {
                ctx.fillStyle = isZero ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.28)";
                ctx.font = isZero ? "700 9.5px 'JetBrains Mono', monospace" : "500 9px 'JetBrains Mono', monospace";
                ctx.textAlign = "left";
                ctx.fillText(`${db > 0 ? "+" : ""}${db} dB`, 6, y - 3);
            }
        });

        ctx.restore();
    }

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

            this.spectrumPoints[i] = rawVal > this.spectrumPoints[i]
                ? rawVal * 0.65 + this.spectrumPoints[i] * 0.35
                : this.spectrumPoints[i] * 0.91;

            if (this.spectrumPoints[i] >= this.peakHoldPoints[i]) {
                this.peakHoldPoints[i] = this.spectrumPoints[i];
            } else {
                this.peakHoldPoints[i] = Math.max(0, this.peakHoldPoints[i] - 0.002);
            }

            const x = frac * w;
            const y = bottomY - (this.spectrumPoints[i] * usableH * 0.92);
            ctx.lineTo(x, y);
        }

        ctx.lineTo(w, bottomY);
        ctx.closePath();

        const specGrad = ctx.createLinearGradient(0, this.paddingTop, 0, bottomY);
        specGrad.addColorStop(0, "rgba(0, 229, 255, 0.38)");
        specGrad.addColorStop(0.5, "rgba(0, 210, 150, 0.22)");
        specGrad.addColorStop(1, "rgba(0, 160, 120, 0.02)");
        ctx.fillStyle = specGrad;
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.55)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
    }

    drawLowCutOverlay(ctx, w, h) {
        if (!this.audio.lowCutEnabled) return;
        const lcFreq = this.audio.lowCutFreq || 80;
        const x = Math.round(this.freqToX(lcFreq));
        const bottomY = h - this.paddingBottom;

        ctx.save();

        // Shaded cut area to the left of Low Cut
        const cutGrad = ctx.createLinearGradient(0, 0, x, 0);
        cutGrad.addColorStop(0, "rgba(245, 158, 11, 0.18)");
        cutGrad.addColorStop(1, "rgba(245, 158, 11, 0.02)");
        ctx.fillStyle = cutGrad;
        ctx.fillRect(0, this.paddingTop, x, bottomY - this.paddingTop);

        // Vertical dashed line
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, this.paddingTop);
        ctx.lineTo(x, bottomY);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Top Flag Badge
        const tag = `HPF · ${Math.round(lcFreq)} Hz`;
        ctx.font = "700 10.5px 'JetBrains Mono', monospace";
        const tagW = ctx.measureText(tag).width + 12;
        const tagH = 19;
        const tagX = Math.max(4, x - tagW / 2);
        const tagY = this.paddingTop + 4;

        ctx.fillStyle = "rgba(18, 24, 36, 0.95)";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.2;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tagW, tagH, 4);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(tagX, tagY, tagW, tagH);
            ctx.strokeRect(tagX, tagY, tagW, tagH);
        }

        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tag, tagX + tagW / 2, tagY + tagH / 2);
        ctx.restore();
    }

    drawMasterEQCurve(ctx, w, h) {
        if (!this.audio.filterNodes || this.audio.filterNodes.length === 0) return;

        const numPoints = this.numResponsePoints;
        const totalMag = new Float32Array(numPoints).fill(1.0);
        const tempMag = new Float32Array(numPoints);
        const tempPhase = new Float32Array(numPoints);

        const nodes = this.audio.filterNodes;

        if (!this.audio.isBypassed) {
            // 1. Include Low Cut Filter if enabled
            if (this.audio.lowCutFilter && this.audio.lowCutEnabled) {
                this.audio.lowCutFilter.getFrequencyResponse(this.responseFreqs, tempMag, tempPhase);
                for (let i = 0; i < numPoints; i++) {
                    totalMag[i] *= tempMag[i];
                }
            }

            // 2. Include Sweet Spot Peaking Filters
            for (let b = 0; b < this.audio.bands.length; b++) {
                if (this.audio.bands[b].enabled && nodes[b]) {
                    nodes[b].getFrequencyResponse(this.responseFreqs, tempMag, tempPhase);
                    for (let i = 0; i < numPoints; i++) {
                        totalMag[i] *= tempMag[i];
                    }
                }
            }
        }

        ctx.save();
        ctx.beginPath();

        for (let i = 0; i < numPoints; i++) {
            const freq = this.responseFreqs[i];
            const magDb = 20 * Math.log10(Math.max(1e-6, totalMag[i]));
            const x = this.freqToX(freq);
            const y = this.dbToY(magDb);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.shadowColor = "rgba(255, 214, 10, 0.6)";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#ffd60a";
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.restore();
    }

    drawSweetSpots(ctx, w, h) {
        if (!this.activeZones || this.activeZones.length === 0) return;
        const bottomY = h - this.paddingBottom;

        ctx.save();

        this.activeZones.forEach((zone, index) => {
            const freq = zone.centerFreq;
            const x = Math.round(this.freqToX(freq));
            const currentGain = (this.audio.bands[index] ? this.audio.bands[index].gain : 0);
            const q = (this.audio.bands[index] ? this.audio.bands[index].q : (zone.q || 1.4));
            const nodeY = Math.round(this.dbToY(currentGain));
            const color = zone.color || "#00d2ff";
            const isHovered = (this.hoveredIndex === index || this.draggedIndex === index);

            // 1. Q Bandwidth Visualization on Hover/Drag
            if (isHovered && currentGain !== 0) {
                const f0 = freq;
                const f1 = f0 * (Math.sqrt(1 + 1 / (4 * q * q)) - 1 / (2 * q));
                const f2 = f0 * (Math.sqrt(1 + 1 / (4 * q * q)) + 1 / (2 * q));
                const x1 = Math.max(2, this.freqToX(f1));
                const x2 = Math.min(w - 2, this.freqToX(f2));

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x1, nodeY);
                ctx.lineTo(x2, nodeY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.4;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x1, nodeY, 2.5, 0, Math.PI * 2);
                ctx.arc(x2, nodeY, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.restore();
            }

            // 2. Vertical Target Guide Line (Dashed Laser)
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(x, this.paddingTop);
            ctx.lineTo(x, bottomY);
            ctx.strokeStyle = isHovered ? color : "rgba(255, 255, 255, 0.18)";
            ctx.lineWidth = isHovered ? 2.0 : 1.2;
            if (isHovered) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
            }
            ctx.stroke();
            ctx.restore();

            // 3. Top Pin Badge Callout (Tag with frequency, name & Q)
            const cleanName = zone.name.split("(")[0].trim();
            const freqText = freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${Math.round(freq)}`;
            const pinText = `${freqText} Hz · ${cleanName} · Q:${q.toFixed(1)}`;

            ctx.font = "600 11px 'Prompt', sans-serif";
            const textWidth = ctx.measureText(pinText).width;
            const badgeW = Math.max(76, textWidth + 14);
            const badgeH = 22;
            const badgeX = Math.max(4, Math.min(w - badgeW - 4, x - badgeW / 2));
            const badgeY = 12;

            ctx.save();
            ctx.fillStyle = isHovered ? color : "rgba(20, 24, 34, 0.9)";
            ctx.strokeStyle = color;
            ctx.lineWidth = isHovered ? 2 : 1.2;
            if (isHovered) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
            }

            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
                ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
            }

            ctx.fillStyle = isHovered ? "#000000" : "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(pinText, badgeX + badgeW / 2, badgeY + badgeH / 2);
            ctx.restore();

            // 4. Interactive Draggable Node on the EQ Curve
            ctx.save();
            const nodeRadius = isHovered ? 10 : 8;

            ctx.beginPath();
            ctx.arc(x, nodeY, nodeRadius + 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = isHovered ? 0.45 : 0.2;
            ctx.fill();

            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(x, nodeY, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = isHovered ? 14 : 6;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, nodeY, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.restore();

            // 5. Live Gain Readout Badge near the node
            if (currentGain !== 0 || isHovered) {
                const gainStr = `${currentGain > 0 ? "+" : ""}${currentGain.toFixed(1)} dB`;
                ctx.save();
                ctx.font = "700 10px 'JetBrains Mono', monospace";
                const gTextW = ctx.measureText(gainStr).width;
                const gBadgeW = gTextW + 8;
                const gBadgeH = 16;
                const gX = Math.max(4, Math.min(w - gBadgeW - 4, x + (x > w - 60 ? -gBadgeW - 12 : 12)));
                const gY = nodeY - 8;

                ctx.fillStyle = "rgba(10, 14, 22, 0.92)";
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(gX, gY, gBadgeW, gBadgeH, 3);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillRect(gX, gY, gBadgeW, gBadgeH);
                    ctx.strokeRect(gX, gY, gBadgeW, gBadgeH);
                }

                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(gainStr, gX + gBadgeW / 2, gY + gBadgeH / 2);
                ctx.restore();
            }
        });

        ctx.restore();
    }
}

// Export to window
if (typeof window !== "undefined") {
    window.EQCanvas = EQCanvas;
}
