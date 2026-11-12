/**
 * PRO-EQ Studio Trainer - Main Application & Plugin UI Controller
 * ควบคุมระบบเสียง, จอ Analyzer, Smart Sweet-Spot Station, Pro 8-Band, และ Graphic EQ
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Instantiate Core Subsystems
    const audio = new AudioEngine();
    let currentInstrumentId = "kick";
    let selectedBandIndex = 2; // Default to Band 3 (Low-Mid 250 Hz)
    let currentSmartZoneIndex = 0;

    const bandColors = window.BAND_COLORS || [
        "#ff453a", "#ff9f0a", "#ffd60a", "#30d158",
        "#00d2ff", "#5e5ce6", "#bf5af2", "#ff375f"
    ];

    // Header Controls
    const playBtn = document.getElementById("playBtn");
    const bypassBtn = document.getElementById("bypassBtn");
    const soloBtn = document.getElementById("soloBtn");
    const resetEqBtn = document.getElementById("resetEqBtn");
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeReadout = document.getElementById("volumeReadout");
    const audioFileInput = document.getElementById("audioFileInput");
    const instrumentsBar = document.getElementById("instrumentsBar");

    // Mode Switcher & Display Options
    const modeSmartBtn = document.getElementById("modeSmartBtn");
    const modeParametricBtn = document.getElementById("modeParametricBtn");
    const modeGraphicBtn = document.getElementById("modeGraphicBtn");
    const graphicModeStatus = document.getElementById("graphicModeStatus");
    const graphicInstName = document.getElementById("graphicInstName");
    const canvasModeLabel = document.getElementById("canvasModeLabel");
    const canvasHint = document.getElementById("canvasHint");
    const smartStationRack = document.getElementById("smartStationRack");
    const parametricRack = document.getElementById("parametricRack");
    const graphicEqRack = document.getElementById("graphicEqRack");
    const dbRangeBtns = document.querySelectorAll(".db-range-btn");

    // Smart Station Elements
    const smartZonesGrid = document.getElementById("smartZonesGrid");
    const smartInstBadge = document.getElementById("smartInstBadge");
    const smartActiveDot = document.getElementById("smartActiveDot");
    const smartActiveName = document.getElementById("smartActiveName");
    const smartActiveFreqPill = document.getElementById("smartActiveFreqPill");
    const smartGainValueText = document.getElementById("smartGainValueText");
    const smartGainSlider = document.getElementById("smartGainSlider");
    const smartStepBtns = document.querySelectorAll(".step-btn");
    const microBoostText = document.getElementById("microBoostText");
    const microCutText = document.getElementById("microCutText");
    const microTipText = document.getElementById("microTipText");

    // Master Output Meter Elements
    const masterMeterL = document.getElementById("masterMeterL");
    const masterMeterR = document.getElementById("masterMeterR");
    const masterPeakReadout = document.getElementById("masterPeakReadout");

    // Graphic EQ Elements
    const loadStandardGraphicBtn = document.getElementById("loadStandardGraphicBtn");
    const resetFlatGraphicBtn = document.getElementById("resetFlatGraphicBtn");
    const graphicFadersContainer = document.getElementById("graphicFadersContainer");

    // Parametric Band Rack & Rotary Knob Elements
    const bandTabsContainer = document.getElementById("bandTabsContainer");
    const activeBandBadge = document.getElementById("activeBandBadge");
    const filterShapePills = document.querySelectorAll(".shape-pill");
    const paramFreqSlider = document.getElementById("paramFreqSlider");
    const paramFreqVal = document.getElementById("paramFreqVal");
    const paramGainSlider = document.getElementById("paramGainSlider");
    const paramGainVal = document.getElementById("paramGainVal");
    const paramQSlider = document.getElementById("paramQSlider");
    const paramQVal = document.getElementById("paramQVal");
    const paramTypeSelect = document.getElementById("paramTypeSelect");
    const paramEnableCheck = document.getElementById("paramEnableCheck");
    const paramSoloBtn = document.getElementById("paramSoloBtn");

    // Rotary Knob Visual Elements
    const knobFreqCap = document.getElementById("knobFreqCap");
    const knobGainCap = document.getElementById("knobGainCap");
    const knobQCap = document.getElementById("knobQCap");
    const knobFreqArc = document.getElementById("knobFreqArc");
    const knobGainArc = document.getElementById("knobGainArc");
    const knobQArc = document.getElementById("knobQArc");

    // Presets
    const presetsChipsContainer = document.getElementById("presetsChipsContainer");

    // Helper functions
    function sliderToFreq(val) {
        return 20 * Math.pow(1000, val / 1000);
    }

    function freqToSlider(freq) {
        return (Math.log10(Math.max(20, Math.min(20000, freq)) / 20) / 3) * 1000;
    }

    function formatHz(freq) {
        return freq >= 1000 ? (freq / 1000).toFixed(2) + " kHz" : Math.round(freq) + " Hz";
    }

    function getFilterShapeSvg(type) {
        switch (type) {
            case "highpass":
                return `<svg viewBox="0 0 24 14" width="18" height="11"><path d="M2,12 L8,12 C11,12 12,2 16,2 L22,2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            case "lowshelf":
                return `<svg viewBox="0 0 24 14" width="18" height="11"><path d="M2,3 L8,3 C12,3 12,11 16,11 L22,11" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            case "highshelf":
                return `<svg viewBox="0 0 24 14" width="18" height="11"><path d="M2,11 L8,11 C12,11 12,3 16,3 L22,3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            case "lowpass":
                return `<svg viewBox="0 0 24 14" width="18" height="11"><path d="M2,2 L8,2 C12,2 13,12 16,12 L22,12" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            default:
                return `<svg viewBox="0 0 24 14" width="18" height="11"><path d="M2,11 L7,11 C9,11 10,2 12,2 C14,2 15,11 17,11 L22,11" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
        }
    }

    function getZoneIcon(zoneName) {
        const lower = zoneName.toLowerCase();
        if (lower.includes("sub") || lower.includes("ใต้ลึก")) return "💥";
        if (lower.includes("punch") || lower.includes("กระแทก")) return "🥊";
        if (lower.includes("body") || lower.includes("fat") || lower.includes("หนา")) return "🪵";
        if (lower.includes("mud") || lower.includes("box") || lower.includes("กล่อง") || lower.includes("กระป๋อง")) return "📦";
        if (lower.includes("crack") || lower.includes("snap") || lower.includes("สะบัด")) return "⚡";
        if (lower.includes("click") || lower.includes("attack") || lower.includes("หัวไม้")) return "🎯";
        if (lower.includes("sizzle") || lower.includes("wire") || lower.includes("สาย")) return "✨";
        if (lower.includes("harsh") || lower.includes("bite") || lower.includes("บาด")) return "🔪";
        if (lower.includes("air") || lower.includes("shimmer") || lower.includes("ประกาย")) return "💨";
        return "🎵";
    }

    function parseZoneName(fullName) {
        const match = fullName.match(/^([^()]+)\s*(?:\(([^()]+)\))?/);
        if (match) {
            const eng = match[1].trim();
            const thai = match[2] ? match[2].trim() : eng;
            return { eng, thai };
        }
        return { eng: fullName, thai: fullName };
    }

    // 2. Initialize Canvas Visualizer
    const canvasEl = document.getElementById("eqCanvas");
    const canvas = new EQCanvas(
        canvasEl,
        audio,
        (bandIdx) => {
            if (bandIdx === selectedBandIndex) {
                syncBandRackUI(bandIdx);
            }
            updateBandTabCard(bandIdx);
            syncSmartStationFromCanvas(bandIdx);
        },
        (bandIdx) => {
            selectBand(bandIdx);
        },
        (zone) => {
            // Audition callback
            if (zone) selectSmartZoneByZone(zone);
        },
        (graphicIndex, gain) => {
            syncGraphicFaderFromCanvas(graphicIndex, gain);
        }
    );

    canvas.draw();

    // -------------------------------------------------------------
    // DISPLAY dB RANGE SWITCHER (±12, ±18, ±30 dB)
    // -------------------------------------------------------------
    dbRangeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const range = parseInt(btn.dataset.range, 10);
            dbRangeBtns.forEach(b => b.classList.toggle("active", b === btn));
            canvas.setDbRange(range);
        });
    });

    // -------------------------------------------------------------
    // EQ MODE SWITCHER (SMART EQ vs PRO 8-BAND vs GRAPHIC EQ)
    // -------------------------------------------------------------
    function setEQMode(mode) {
        audio.setEQMode(mode === "graphic" ? "graphic" : "parametric");
        modeSmartBtn.classList.toggle("active", mode === "smart");
        modeParametricBtn.classList.toggle("active", mode === "parametric");
        modeGraphicBtn.classList.toggle("active", mode === "graphic");

        if (mode === "smart") {
            smartStationRack.style.display = "flex";
            parametricRack.style.display = "none";
            graphicEqRack.style.display = "none";
            graphicModeStatus.style.display = "none";
            canvasModeLabel.textContent = "SMART EQ: SWEET SPOTS & REAL-TIME SPECTRUM";
            canvasHint.textContent = "💡 แตะเลือกย่านเสียงด้านล่างแล้วกด +3dB, +6dB หรือเลื่อนสไลเดอร์เพื่อฟังผลทันที";
        } else if (mode === "parametric") {
            smartStationRack.style.display = "none";
            parametricRack.style.display = "flex";
            graphicEqRack.style.display = "none";
            graphicModeStatus.style.display = "none";
            canvasModeLabel.textContent = "PRO-Q SPECTRUM ANALYZER & COMPOSITE CURVE";
            canvasHint.textContent = "💡 ลากจุดเพื่อปรับ Freq/Gain | หมุนลูกกลิ้งเมาส์ปรับความแคบ-กว้าง (Q) | ดับเบิลคลิกจุดเพื่อรีเซ็ต 0 dB";
        } else {
            smartStationRack.style.display = "none";
            parametricRack.style.display = "none";
            graphicEqRack.style.display = "flex";
            graphicModeStatus.style.display = "flex";
            canvasModeLabel.textContent = "10-BAND ISO GRAPHIC CONSOLE & REAL-TIME RTA";
            canvasHint.textContent = "💡 ดึงเฟดเดอร์ด้านล่างหรือลากบนกราฟได้โดยตรง | ดับเบิลคลิกเพื่อรีเซ็ต 0 dB";
            updateGraphicFadersUI();
        }
        setTimeout(() => canvas.resize(), 30);
    }

    modeSmartBtn.addEventListener("click", () => setEQMode("smart"));
    modeParametricBtn.addEventListener("click", () => setEQMode("parametric"));
    modeGraphicBtn.addEventListener("click", () => setEQMode("graphic"));

    // -------------------------------------------------------------
    // SMART SWEET-SPOT STATION (ALL-IN-ONE COMPACT CONTROLLER)
    // -------------------------------------------------------------
    function renderSmartStation(zones) {
        smartZonesGrid.innerHTML = "";
        const data = INSTRUMENTS_DATA[currentInstrumentId];
        smartInstBadge.textContent = data ? `${data.icon} ${data.name}` : "🥁 KICK";

        if (!zones || zones.length === 0) {
            smartZonesGrid.innerHTML = "<div style='color: var(--text-muted); font-size: 13px; grid-column: 1 / -1; padding: 10px;'>ไม่มีข้อมูลย่านแนะนำสำหรับไฟล์เสียงที่นำเข้าเอง สามารถปรับได้อิสระที่ Pro 8-Band</div>";
            smartActiveName.textContent = "ไฟล์เสียงที่นำเข้าเอง";
            smartActiveFreqPill.textContent = "อิสระ";
            smartActiveDot.style.background = "var(--accent-cyan)";
            microBoostText.textContent = "ปรับเร่งย่านที่ต้องการด้วยจุดบนหน้าจอ EQ";
            microCutText.textContent = "ตัดความถี่ที่ไม่ต้องการออก";
            microTipText.textContent = "ใช้เมาส์หรือสัมผัสบนหน้าจอกราฟได้โดยตรง";
            return;
        }

        currentSmartZoneIndex = Math.min(currentSmartZoneIndex, zones.length - 1);

        zones.forEach((zone, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `smart-zone-btn ${idx === currentSmartZoneIndex ? "active" : ""}`;
            btn.style.setProperty("--zone-color", zone.color || "#00d2ff");

            const icon = getZoneIcon(zone.name);
            const { eng, thai } = parseZoneName(zone.name);

            btn.innerHTML = `
                <div class="smart-btn-left">
                    <span class="smart-btn-icon">${icon}</span>
                    <div class="smart-btn-info">
                        <span class="smart-btn-title">${eng}</span>
                        <span class="smart-btn-thai">${thai}</span>
                    </div>
                </div>
                <span class="smart-btn-freq">${formatHz(zone.centerFreq)}</span>
            `;

            btn.addEventListener("click", () => {
                selectSmartZone(idx);
            });

            smartZonesGrid.appendChild(btn);
        });

        // Activate the chosen zone
        selectSmartZone(currentSmartZoneIndex, false);
    }

    function selectSmartZone(idx, autoAudition = true) {
        const zones = INSTRUMENTS_DATA[currentInstrumentId]?.zones || [];
        if (!zones[idx]) return;

        currentSmartZoneIndex = idx;
        const zone = zones[idx];

        // Update active class on zone buttons
        const buttons = smartZonesGrid.querySelectorAll(".smart-zone-btn");
        buttons.forEach((b, i) => b.classList.toggle("active", i === idx));

        // Update Header in Controls Strip
        smartActiveDot.style.background = zone.color || "var(--accent-cyan)";
        smartActiveDot.style.boxShadow = `0 0 10px ${zone.color || "var(--accent-cyan)"}`;
        smartActiveName.textContent = zone.name;
        smartActiveFreqPill.textContent = formatHz(zone.centerFreq);
        smartActiveFreqPill.style.color = zone.color || "var(--accent-cyan)";
        smartActiveFreqPill.style.borderColor = zone.color || "var(--accent-cyan)";

        // Update 3 Micro-Guide bullets
        microBoostText.textContent = zone.ifBoosted || "เสียงหนาแน่นขึ้น";
        microCutText.textContent = zone.ifCut || "เสียงบางลงหรือสะอาดขึ้น";
        microTipText.textContent = zone.proTip || "ทดลองปรับเพิ่มลดเพื่อหาจุดที่ชอบที่สุด";

        // Map to Band 3 (or the closest band to this frequency)
        selectBand(3);
        const curGain = autoAudition ? (audio.bands[3].gain !== 0 ? audio.bands[3].gain : 3.0) : audio.bands[3].gain;
        audio.updateBand(3, {
            type: "peaking",
            freq: zone.centerFreq,
            gain: curGain,
            q: zone.q || 2.0,
            enabled: true
        });

        // Sync visual slider and canvas
        smartGainSlider.value = curGain;
        updateSmartGainValueDisplay(curGain);
        syncBandRackUI(3);
        updateBandTabCard(3);
        canvas.setHighlightedZone(zone);

        if (autoAudition && !audio.isPlaying) {
            audio.start().then(updatePlayBtn);
        }
    }

    function selectSmartZoneByZone(targetZone) {
        const zones = INSTRUMENTS_DATA[currentInstrumentId]?.zones || [];
        const foundIdx = zones.findIndex(z => z.centerFreq === targetZone.centerFreq);
        if (foundIdx !== -1) {
            selectSmartZone(foundIdx, false);
        }
    }

    function updateSmartGainValueDisplay(gain) {
        const sign = gain > 0 ? "+" : "";
        smartGainValueText.textContent = `${sign}${gain.toFixed(1)} dB`;
        smartGainValueText.style.color = gain > 0 ? "var(--accent-cyan)" : (gain < 0 ? "var(--accent-red)" : "#ffffff");

        // Update active class on step buttons
        smartStepBtns.forEach(btn => {
            const stepVal = parseFloat(btn.dataset.step);
            btn.classList.toggle("active", Math.abs(gain - stepVal) < 0.3);
        });
    }

    function syncSmartStationFromCanvas(bandIdx) {
        if (bandIdx === 3 && activeBandBadge) {
            const g = audio.bands[3].gain;
            smartGainSlider.value = g;
            updateSmartGainValueDisplay(g);
        }
    }

    // Smart Gain Slider input
    smartGainSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        audio.updateBand(3, { gain: val, enabled: true });
        updateSmartGainValueDisplay(val);
        syncBandRackUI(3);
        updateBandTabCard(3);
    });

    // Smart Step Buttons (-6, -3, 0, +3, +6 dB)
    smartStepBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const step = parseFloat(btn.dataset.step);
            smartGainSlider.value = step;
            audio.updateBand(3, { gain: step, enabled: step !== 0 });
            updateSmartGainValueDisplay(step);
            syncBandRackUI(3);
            updateBandTabCard(3);

            if (step !== 0 && !audio.isPlaying) {
                await audio.start();
                updatePlayBtn();
            }
        });
    });

    // -------------------------------------------------------------
    // GRAPHIC EQ 10-BAND CONSOLE & MASTER METER LOOP
    // -------------------------------------------------------------
    const toneHints = [
        "Sub Rumble", "Sub / Punch", "Bass / Body", "Warmth / Mud", "Boxy / Ring",
        "Mid / Nasal", "Bite / Crack", "Attack / Slap", "Sizzle / Crisp", "Air / Shimmer"
    ];

    const faderSliderEls = [];
    const faderBadgeEls = [];
    const faderMeterFillEls = [];

    function renderGraphicFaders() {
        graphicFadersContainer.innerHTML = "";
        faderSliderEls.length = 0;
        faderBadgeEls.length = 0;
        faderMeterFillEls.length = 0;

        for (let i = 0; i < audio.graphicFreqs.length; i++) {
            const label = GRAPHIC_EQ_LABELS[i];
            const hint = toneHints[i];
            const gain = audio.graphicGains[i];

            const strip = document.createElement("div");
            strip.className = "graphic-fader-strip";

            const meterTrack = document.createElement("div");
            meterTrack.className = "fader-meter-track";
            const meterFill = document.createElement("div");
            meterFill.className = "fader-meter-fill";
            meterTrack.appendChild(meterFill);
            faderMeterFillEls.push(meterFill);

            const badge = document.createElement("div");
            badge.className = `fader-db-badge ${gain > 0 ? "boost" : (gain < 0 ? "cut" : "flat")}`;
            badge.textContent = (gain > 0 ? "+" : "") + gain.toFixed(1) + " dB";
            faderBadgeEls.push(badge);

            const sliderWrap = document.createElement("div");
            sliderWrap.className = "fader-slider-wrap";
            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "graphic-v-slider";
            slider.min = "-12";
            slider.max = "12";
            slider.step = "0.5";
            slider.value = gain;
            slider.orient = "vertical";

            const idx = i;
            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                audio.setGraphicGain(idx, val);
                updateSingleFaderBadge(idx, val);
            });

            slider.addEventListener("dblclick", () => {
                slider.value = 0;
                audio.setGraphicGain(idx, 0);
                updateSingleFaderBadge(idx, 0);
            });

            sliderWrap.appendChild(slider);
            faderSliderEls.push(slider);

            const freqLabel = document.createElement("div");
            freqLabel.className = "fader-freq-label";
            freqLabel.textContent = label;

            const toneLabel = document.createElement("div");
            toneLabel.className = "fader-tone-hint";
            toneLabel.textContent = hint;

            strip.appendChild(meterTrack);
            strip.appendChild(badge);
            strip.appendChild(sliderWrap);
            strip.appendChild(freqLabel);
            strip.appendChild(toneLabel);

            graphicFadersContainer.appendChild(strip);
        }
    }

    function updateSingleFaderBadge(idx, gain) {
        if (!faderBadgeEls[idx]) return;
        const badge = faderBadgeEls[idx];
        badge.className = `fader-db-badge ${gain > 0 ? "boost" : (gain < 0 ? "cut" : "flat")}`;
        badge.textContent = (gain > 0 ? "+" : "") + gain.toFixed(1) + " dB";
    }

    function updateGraphicFadersUI() {
        for (let i = 0; i < audio.graphicFreqs.length; i++) {
            const gain = audio.graphicGains[i];
            if (faderSliderEls[i]) faderSliderEls[i].value = gain;
            updateSingleFaderBadge(i, gain);
        }
    }

    function syncGraphicFaderFromCanvas(graphicIndex, gain) {
        if (faderSliderEls[graphicIndex]) {
            faderSliderEls[graphicIndex].value = gain;
        }
        updateSingleFaderBadge(graphicIndex, gain);
    }

    loadStandardGraphicBtn.addEventListener("click", () => {
        audio.loadInstrumentStandardGraphic();
        updateGraphicFadersUI();
    });

    resetFlatGraphicBtn.addEventListener("click", () => {
        audio.resetGraphicEQ();
        updateGraphicFadersUI();
    });

    // Hardware Stereo VU Meter & Graphic Meter Loop
    function updateMasterMetersLoop() {
        requestAnimationFrame(updateMasterMetersLoop);

        if (!audio.isPlaying) {
            masterMeterL.style.height = "0%";
            masterMeterR.style.height = "0%";
            masterPeakReadout.textContent = "-∞";
            faderMeterFillEls.forEach(el => el.style.height = "0%");
            return;
        }

        const levels = audio.getOutputLevels();
        const lH = Math.min(100, Math.max(0, (levels.dbL + 48) * (100 / 48)));
        const rH = Math.min(100, Math.max(0, (levels.dbR + 48) * (100 / 48)));

        masterMeterL.style.height = `${lH}%`;
        masterMeterR.style.height = `${rH}%`;

        const maxDb = Math.max(levels.dbL, levels.dbR);
        masterPeakReadout.textContent = maxDb <= -48 ? "-∞" : `${maxDb.toFixed(1)} dB`;
        masterPeakReadout.style.color = maxDb >= -0.5 ? "var(--accent-red)" : (maxDb >= -6 ? "var(--accent-gold)" : "var(--accent-cyan)");

        // Graphic RTA Fader Meter Fill
        if (audio.eqMode === "graphic") {
            const bandsRTA = audio.getGraphicRTABands();
            for (let i = 0; i < faderMeterFillEls.length; i++) {
                const val = bandsRTA[i] || 0;
                faderMeterFillEls[i].style.height = `${Math.min(100, val * 105)}%`;
            }
        }
    }

    updateMasterMetersLoop();

    // -------------------------------------------------------------
    // CATEGORIZED INSTRUMENT / CHANNEL BAR (DRUMS & PERCUSSION)
    // -------------------------------------------------------------
    function renderInstrumentsBar() {
        instrumentsBar.innerHTML = "";

        const drumIds = ["kick", "snare", "hihat", "tom1", "tom2", "floortom", "overhead_l", "overhead_r"];
        const drumGroup = document.createElement("div");
        drumGroup.className = "inst-group";
        const drumTag = document.createElement("span");
        drumTag.className = "inst-group-label";
        drumTag.textContent = "DRUMS";
        drumGroup.appendChild(drumTag);

        const instGroup = document.createElement("div");
        instGroup.className = "inst-group";
        const instTag = document.createElement("span");
        instTag.className = "inst-group-label";
        instTag.textContent = "SYNTH / INST";
        instGroup.appendChild(instTag);

        Object.values(INSTRUMENTS_DATA).forEach(inst => {
            if (inst.id === "custom") return;
            const isDrum = drumIds.includes(inst.id);
            const hasSample = Boolean(typeof window !== "undefined" && window.EMBEDDED_SAMPLES && window.EMBEDDED_SAMPLES[inst.id]);

            const pill = document.createElement("button");
            pill.className = `instrument-pill ${inst.id === currentInstrumentId ? "active" : ""}`;
            pill.dataset.instId = inst.id;
            pill.innerHTML = `
                ${hasSample ? '<span class="sample-dot" title="Real Audio Sample Loop"></span>' : `<span>${inst.icon}</span>`}
                <span>${inst.name.split("(")[0].trim()}</span>
            `;
            pill.addEventListener("click", () => {
                selectInstrument(inst.id);
            });

            if (isDrum) drumGroup.appendChild(pill);
            else instGroup.appendChild(pill);
        });

        instrumentsBar.appendChild(drumGroup);

        const sep = document.createElement("div");
        sep.className = "inst-bar-divider";
        instrumentsBar.appendChild(sep);

        instrumentsBar.appendChild(instGroup);

        // Custom File Upload button
        const uploadLabel = document.createElement("label");
        uploadLabel.className = "file-upload-label";
        uploadLabel.innerHTML = `📁 <span>IMPORT AUDIO (.wav, .mp3)</span>`;
        uploadLabel.appendChild(audioFileInput);
        instrumentsBar.appendChild(uploadLabel);
    }

    function selectInstrument(instId) {
        currentInstrumentId = instId;
        audio.setInstrument(instId);

        document.querySelectorAll(".instrument-pill").forEach(p => {
            p.classList.remove("active");
        });
        const match = document.querySelector(`.instrument-pill[data-inst-id="${instId}"]`);
        if (match) {
            match.classList.add("active");
            try {
                match.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            } catch (err) {}
        }

        const data = INSTRUMENTS_DATA[instId];
        if (data) {
            graphicInstName.textContent = data.name.split("(")[0].trim();
            canvas.setActiveZones(data.zones);
            canvas.setHighlightedZone(null);
            renderSmartStation(data.zones);
            renderPresets(data.presets);
            updateGraphicFadersUI();
            updateAllBandTabCards();
        }
    }

    function renderPresets(presets) {
        presetsChipsContainer.innerHTML = "";
        if (!presets) return;

        const flatChip = document.createElement("button");
        flatChip.className = "preset-chip";
        flatChip.textContent = "🔄 Flat (0 dB)";
        flatChip.addEventListener("click", () => {
            if (audio.eqMode === "graphic") {
                audio.resetGraphicEQ();
                updateGraphicFadersUI();
            } else {
                audio.resetEQ();
                syncBandRackUI(selectedBandIndex);
                updateAllBandTabCards();
                smartGainSlider.value = 0;
                updateSmartGainValueDisplay(0);
            }
        });
        presetsChipsContainer.appendChild(flatChip);

        presets.forEach(p => {
            const chip = document.createElement("button");
            chip.className = "preset-chip";
            chip.title = p.desc;
            chip.innerHTML = `✨ ${p.name}`;
            chip.addEventListener("click", () => {
                if (audio.eqMode === "graphic") {
                    setEQMode("smart");
                }
                audio.applyPreset(p.bands);
                syncBandRackUI(selectedBandIndex);
                updateAllBandTabCards();
                smartGainSlider.value = audio.bands[3].gain;
                updateSmartGainValueDisplay(audio.bands[3].gain);
            });
            presetsChipsContainer.appendChild(chip);
        });
    }

    // -------------------------------------------------------------
    // PARAMETRIC 8-BAND STRIP & ROTARY KNOBS (PRO-Q MODE)
    // -------------------------------------------------------------
    function renderBandTabs() {
        bandTabsContainer.innerHTML = "";
        audio.bands.forEach((b, idx) => {
            const card = document.createElement("div");
            card.className = `band-tab-btn ${idx === selectedBandIndex ? "active" : ""} ${b.enabled ? "" : "band-disabled"}`;
            card.dataset.bandIdx = idx;
            card.style.setProperty("--band-color", bandColors[idx]);

            card.addEventListener("click", () => selectBand(idx));
            bandTabsContainer.appendChild(card);
            updateBandTabCard(idx);
        });
    }

    function updateBandTabCard(idx) {
        const card = bandTabsContainer.children[idx];
        const b = audio.bands[idx];
        if (!card || !b) return;

        const color = bandColors[idx];
        const isPass = (b.type === "highpass" || b.type === "lowpass");
        const gainStr = isPass
            ? b.type.toUpperCase()
            : ((b.gain > 0 ? "+" : "") + b.gain.toFixed(1) + " dB");

        card.className = `band-tab-btn ${idx === selectedBandIndex ? "active" : ""} ${b.enabled ? "" : "band-disabled"}`;
        card.innerHTML = `
            <div class="band-card-top">
                <span class="band-power-dot" data-power="${idx}" title="เปิด/ปิด Band ${idx + 1}" style="background:${b.enabled ? color : 'transparent'}; border-color:${color}"></span>
                <span class="band-num" style="color:${color}">B${idx + 1}</span>
                <span class="band-shape-icon" style="color:${color}">${getFilterShapeSvg(b.type)}</span>
            </div>
            <div class="band-card-freq">${formatHz(b.freq)}</div>
            <div class="band-card-gain ${b.gain > 0.1 ? 'is-boost' : (b.gain < -0.1 ? 'is-cut' : '')}">${gainStr}</div>
        `;

        const powerDot = card.querySelector(".band-power-dot");
        if (powerDot) {
            powerDot.addEventListener("click", (e) => {
                e.stopPropagation();
                const newState = !b.enabled;
                audio.updateBand(idx, { enabled: newState });
                updateBandTabCard(idx);
                if (idx === selectedBandIndex) {
                    syncBandRackUI(idx);
                }
            });
        }
    }

    function updateAllBandTabCards() {
        for (let i = 0; i < audio.bands.length; i++) {
            updateBandTabCard(i);
        }
    }

    function selectBand(idx) {
        selectedBandIndex = idx;
        canvas.setSelectedBand(idx);

        const tabs = bandTabsContainer.querySelectorAll(".band-tab-btn");
        tabs.forEach((t, i) => t.classList.toggle("active", i === idx));

        syncBandRackUI(idx);
    }

    function syncBandRackUI(idx) {
        const b = audio.bands[idx];
        if (!b) return;

        const color = bandColors[idx];
        activeBandBadge.textContent = `BAND ${idx + 1}`;
        activeBandBadge.style.borderColor = color;
        activeBandBadge.style.color = color;

        // Freq
        paramFreqVal.textContent = formatHz(b.freq);
        paramFreqSlider.value = freqToSlider(b.freq);
        const fRatio = Math.max(0, Math.min(1, Math.log10(b.freq / 20) / Math.log10(20000 / 20)));
        const fDeg = fRatio * 270 - 135;
        knobFreqCap.style.transform = `rotate(${fDeg}deg)`;
        knobFreqArc.style.stroke = color;
        knobFreqArc.setAttribute("stroke-dasharray", `${fRatio * 146} 200`);

        // Gain
        paramGainVal.textContent = (b.gain > 0 ? "+" : "") + b.gain.toFixed(1) + " dB";
        paramGainSlider.value = b.gain;
        const gRatio = (b.gain + 18) / 36;
        const gDeg = gRatio * 270 - 135;
        knobGainCap.style.transform = `rotate(${gDeg}deg)`;
        knobGainArc.style.stroke = b.gain > 0 ? "var(--accent-cyan)" : (b.gain < 0 ? "var(--accent-red)" : "rgba(255,255,255,0.2)");
        knobGainArc.setAttribute("stroke-dasharray", `${Math.abs(b.gain / 18) * 73} 200`);

        // Q
        paramQVal.textContent = b.q.toFixed(2);
        paramQSlider.value = b.q;
        const qRatio = Math.max(0, Math.min(1, (b.q - 0.2) / 9.8));
        const qDeg = qRatio * 270 - 135;
        knobQCap.style.transform = `rotate(${qDeg}deg)`;
        knobQArc.style.stroke = color;
        knobQArc.setAttribute("stroke-dasharray", `${qRatio * 146} 200`);

        // Filter Shape Pills
        paramTypeSelect.value = b.type;
        filterShapePills.forEach(pill => {
            const active = (pill.dataset.type === b.type);
            pill.classList.toggle("active", active);
            pill.style.borderColor = active ? color : "";
            pill.style.color = active ? color : "";
        });

        // Power Switch
        paramEnableCheck.checked = b.enabled;
        const powerUi = paramEnableCheck.nextElementSibling;
        if (powerUi) {
            powerUi.textContent = b.enabled ? "⏻ ON" : "⏻ OFF";
            powerUi.classList.toggle("is-on", b.enabled);
        }

        // Solo Button
        const isSolo = (audio.soloBandIndex === idx);
        paramSoloBtn.classList.toggle("btn-active", isSolo);
        soloBtn.classList.toggle("btn-active", isSolo);
    }

    filterShapePills.forEach(pill => {
        pill.addEventListener("click", () => {
            const newType = pill.dataset.type;
            paramTypeSelect.value = newType;
            audio.updateBand(selectedBandIndex, { type: newType, enabled: true });
            syncBandRackUI(selectedBandIndex);
            updateBandTabCard(selectedBandIndex);
        });
    });

    // Interactive Rotary Knob Dragging & Touch
    function setupRotaryKnobDrag(knobId, onDelta, onDblClick) {
        const el = document.getElementById(knobId);
        if (!el) return;
        let dragging = false;
        let lastY = 0;
        let lastTapTime = 0;

        el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            dragging = true;
            lastY = e.clientY;
            document.body.style.cursor = "ns-resize";
        });

        window.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const dy = lastY - e.clientY;
            lastY = e.clientY;
            if (dy !== 0) onDelta(dy);
        });

        window.addEventListener("mouseup", () => {
            if (dragging) {
                dragging = false;
                document.body.style.cursor = "";
            }
        });

        el.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;
            const now = performance.now();
            if (now - lastTapTime < 320 && onDblClick) {
                e.preventDefault();
                onDblClick();
                lastTapTime = 0;
                return;
            }
            lastTapTime = now;
            dragging = true;
            lastY = e.touches[0].clientY;
        }, { passive: false });

        el.addEventListener("touchmove", (e) => {
            if (!dragging || e.touches.length !== 1) return;
            e.preventDefault();
            const dy = lastY - e.touches[0].clientY;
            lastY = e.touches[0].clientY;
            if (dy !== 0) onDelta(dy);
        }, { passive: false });

        el.addEventListener("touchend", () => {
            dragging = false;
        });

        el.addEventListener("wheel", (e) => {
            e.preventDefault();
            const step = e.deltaY < 0 ? 4 : -4;
            onDelta(step);
        }, { passive: false });

        if (onDblClick) {
            el.addEventListener("dblclick", onDblClick);
        }
    }

    setupRotaryKnobDrag("knobFreq", (dy) => {
        const cur = parseFloat(paramFreqSlider.value);
        const next = Math.max(0, Math.min(1000, cur + dy * 2.5));
        paramFreqSlider.value = next;
        const f = sliderToFreq(next);
        audio.updateBand(selectedBandIndex, { freq: f, enabled: true });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    setupRotaryKnobDrag("knobGain", (dy) => {
        const b = audio.bands[selectedBandIndex];
        if (b.type === "highpass" || b.type === "lowpass") return;
        const next = Math.max(-18, Math.min(18, b.gain + dy * 0.15));
        audio.updateBand(selectedBandIndex, { gain: Math.round(next * 2) / 2, enabled: true });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    }, () => {
        audio.updateBand(selectedBandIndex, { gain: 0 });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    setupRotaryKnobDrag("knobQ", (dy) => {
        const b = audio.bands[selectedBandIndex];
        const next = Math.max(0.2, Math.min(10, b.q + dy * 0.04));
        audio.updateBand(selectedBandIndex, { q: Math.round(next * 100) / 100, enabled: true });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    }, () => {
        audio.updateBand(selectedBandIndex, { q: 1.4 });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    // Fine Range Sliders
    paramFreqSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        const f = sliderToFreq(val);
        audio.updateBand(selectedBandIndex, { freq: f });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    paramGainSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        audio.updateBand(selectedBandIndex, { gain: val });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    paramQSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        audio.updateBand(selectedBandIndex, { q: val });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    paramTypeSelect.addEventListener("change", (e) => {
        audio.updateBand(selectedBandIndex, { type: e.target.value });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    paramEnableCheck.addEventListener("change", (e) => {
        audio.updateBand(selectedBandIndex, { enabled: e.target.checked });
        syncBandRackUI(selectedBandIndex);
        updateBandTabCard(selectedBandIndex);
    });

    paramSoloBtn.addEventListener("click", () => {
        audio.setSoloBand(selectedBandIndex);
        syncBandRackUI(selectedBandIndex);
    });

    // -------------------------------------------------------------
    // GLOBAL TRANSPORT & UTILITY CONTROLS
    // -------------------------------------------------------------
    function updatePlayBtn() {
        if (audio.isPlaying) {
            playBtn.innerHTML = `<span>⏹</span> <span>STOP</span>`;
            playBtn.classList.remove("btn-primary");
            playBtn.classList.add("btn-danger");
        } else {
            playBtn.innerHTML = `<span>▶</span> <span>PLAY</span>`;
            playBtn.classList.add("btn-primary");
            playBtn.classList.remove("btn-danger");
        }
    }

    playBtn.addEventListener("click", async () => {
        await audio.toggle();
        updatePlayBtn();
    });

    window.addEventListener("keydown", async (e) => {
        if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") {
            e.preventDefault();
            await audio.toggle();
            updatePlayBtn();
        }
    });

    bypassBtn.addEventListener("click", () => {
        const newBypass = !audio.isBypassed;
        audio.setBypass(newBypass);
        bypassBtn.classList.toggle("btn-active", newBypass);
        bypassBtn.innerHTML = newBypass ? `<span>⚡</span> <span>BYPASSED</span>` : `<span>⚡</span> <span>BYPASS EQ</span>`;
    });

    soloBtn.addEventListener("click", () => {
        audio.setSoloBand(selectedBandIndex);
        syncBandRackUI(selectedBandIndex);
    });

    resetEqBtn.addEventListener("click", () => {
        if (audio.eqMode === "graphic") {
            audio.resetGraphicEQ();
            updateGraphicFadersUI();
        } else {
            audio.resetEQ();
            syncBandRackUI(selectedBandIndex);
            updateAllBandTabCards();
            smartGainSlider.value = 0;
            updateSmartGainValueDisplay(0);
        }
    });

    volumeSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        audio.setMasterVolume(val);
        if (volumeReadout) {
            const db = val > 0.01 ? (20 * Math.log10(val / 0.85)) : -60;
            volumeReadout.textContent = db <= -45 ? "-∞ dB" : ((db >= 0 ? "+" : "") + db.toFixed(1) + " dB");
        }
    });

    // Custom Audio File Handling
    audioFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            audio.loadUserAudioFile(file);
        }
    });

    window.onCustomAudioLoaded = (fileName) => {
        currentInstrumentId = "custom";
        selectInstrument("custom");
        graphicInstName.textContent = fileName.length > 18 ? fileName.substring(0, 16) + "..." : fileName;

        let customPill = document.getElementById("customAudioPill");
        if (!customPill) {
            customPill = document.createElement("button");
            customPill.id = "customAudioPill";
            customPill.className = "instrument-pill active";
            const uploadBtn = instrumentsBar.querySelector(".file-upload-label");
            if (uploadBtn) {
                instrumentsBar.insertBefore(customPill, uploadBtn);
            } else {
                instrumentsBar.appendChild(customPill);
            }
        }
        customPill.innerHTML = `<span class="sample-dot"></span> <span>${fileName.length > 16 ? fileName.substring(0, 14) + "..." : fileName}</span>`;
        customPill.onclick = () => {
            selectInstrument("custom");
        };

        document.querySelectorAll(".instrument-pill").forEach(p => p.classList.remove("active"));
        customPill.classList.add("active");

        updatePlayBtn();
    };

    // Drag & Drop Audio File Support
    const dropOverlay = document.getElementById("dropOverlay");
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        if (dropOverlay) dropOverlay.classList.add("active");
    });

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    window.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (dropOverlay) dropOverlay.classList.remove("active");
        }
    });

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (dropOverlay) dropOverlay.classList.remove("active");

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith("audio/") || /\.(wav|mp3|m4a|flac|aac|ogg|aiff)$/i.test(file.name)) {
                audio.loadUserAudioFile(file);
            } else {
                alert("กรุณาลากไฟล์เสียงที่เป็น .wav, .mp3, .m4a หรือ .flac เข้ามาในโปรแกรม");
            }
        }
    });

    // -------------------------------------------------------------
    // INITIAL BOOTSTRAP
    // -------------------------------------------------------------
    renderInstrumentsBar();
    renderBandTabs();
    renderGraphicFaders();
    selectInstrument("kick");
    selectBand(2);
    setEQMode("smart"); // Default to the simplest, most intuitive mode!
});
