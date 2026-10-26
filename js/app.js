/**
 * PRO-EQ Studio Trainer - Main Application & Plugin UI Controller
 * ควบคุมระบบเสียง, จอ Analyzer, ปุ่มหมุน Rotary Knobs, 8-Band Strip, Graphic EQ และ Golden Ears Quiz
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Instantiate Core Subsystems
    const audio = new AudioEngine();
    let currentInstrumentId = "kick";
    let selectedBandIndex = 2; // Default to Band 3 (Low-Mid 250 Hz)

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
    const tempoSlider = document.getElementById("tempoSlider");
    const tempoValue = document.getElementById("tempoValue");
    const audioFileInput = document.getElementById("audioFileInput");
    const instrumentsBar = document.getElementById("instrumentsBar");

    // Mode Switcher & Display Options
    const modeParametricBtn = document.getElementById("modeParametricBtn");
    const modeGraphicBtn = document.getElementById("modeGraphicBtn");
    const graphicModeStatus = document.getElementById("graphicModeStatus");
    const graphicInstName = document.getElementById("graphicInstName");
    const canvasModeLabel = document.getElementById("canvasModeLabel");
    const canvasHint = document.getElementById("canvasHint");
    const parametricRack = document.getElementById("parametricRack");
    const graphicEqRack = document.getElementById("graphicEqRack");
    const dbRangeBtns = document.querySelectorAll(".db-range-btn");

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

    // Guide, Presets & Dock Tabs
    const currentInstTitle = document.getElementById("currentInstTitle");
    const currentInstDesc = document.getElementById("currentInstDesc");
    const zonesList = document.getElementById("zonesList");
    const presetsChipsContainer = document.getElementById("presetsChipsContainer");
    const dockTabBtns = document.querySelectorAll(".dock-tab-btn");
    const dockPanelGuide = document.getElementById("dockPanelGuide");
    const dockPanelQuiz = document.getElementById("dockPanelQuiz");

    // Quiz Elements
    const startQuizBtn = document.getElementById("startQuizBtn");
    const stopQuizBtn = document.getElementById("stopQuizBtn");
    const quizSetupBox = document.getElementById("quizSetupBox");
    const quizActiveArea = document.getElementById("quizActiveArea");
    const quizChoicesGrid = document.getElementById("quizChoicesGrid");
    const quizBypassBtn = document.getElementById("quizBypassBtn");
    const quizNextBtn = document.getElementById("quizNextBtn");
    const quizFeedback = document.getElementById("quizFeedback");
    const quizScoreVal = document.getElementById("quizScoreVal");
    const quizStreakVal = document.getElementById("quizStreakVal");
    const quizTotalVal = document.getElementById("quizTotalVal");
    const diffBtns = document.querySelectorAll(".diff-btn");

    // Logarithmic slider helpers for Parametric Frequency slider (0..1000 <-> 20..20000 Hz)
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
        },
        (bandIdx) => {
            selectBand(bandIdx);
        },
        (zone) => {
            handleZoneAudition(zone, 6.0);
        },
        (graphicIndex, gain) => {
            syncGraphicFaderFromCanvas(graphicIndex, gain);
        }
    );

    canvas.draw();

    // 3. Initialize Quiz Subsystem
    const quiz = new EQQuiz(audio, canvas, () => {
        updateQuizUI();
    });

    // -------------------------------------------------------------
    // RIGHT DOCK TABS (TONE GUIDE vs GOLDEN EARS QUIZ)
    // -------------------------------------------------------------
    dockTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.docktab;
            dockTabBtns.forEach(b => b.classList.toggle("active", b === btn));
            if (target === "quiz") {
                dockPanelGuide.style.display = "none";
                dockPanelQuiz.style.display = "flex";
            } else {
                dockPanelGuide.style.display = "flex";
                dockPanelQuiz.style.display = "none";
            }
        });
    });

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
    // EQ MODE SWITCHER (PARAMETRIC VS GRAPHIC EQ)
    // -------------------------------------------------------------
    function setEQMode(mode) {
        audio.setEQMode(mode);
        modeParametricBtn.classList.toggle("active", mode === "parametric");
        modeGraphicBtn.classList.toggle("active", mode === "graphic");

        if (mode === "graphic") {
            parametricRack.style.display = "none";
            graphicEqRack.style.display = "flex";
            graphicModeStatus.style.display = "flex";
            canvasModeLabel.textContent = "10-BAND ISO GRAPHIC CONSOLE & REAL-TIME RTA";
            canvasHint.textContent = "💡 ดึงเฟดเดอร์ด้านล่างหรือลากบนกราฟได้โดยตรง | ดับเบิลคลิกเพื่อรีเซ็ต 0 dB";
            updateGraphicFadersUI();
        } else {
            parametricRack.style.display = "flex";
            graphicEqRack.style.display = "none";
            graphicModeStatus.style.display = "none";
            canvasModeLabel.textContent = "PRO-Q SPECTRUM ANALYZER & COMPOSITE CURVE";
            canvasHint.textContent = "💡 ลากจุดเพื่อปรับ Freq/Gain | หมุนลูกกลิ้งเมาส์ปรับความแคบ-กว้าง (Q) | ดับเบิลคลิกจุดเพื่อรีเซ็ต 0 dB";
        }
    }

    modeParametricBtn.addEventListener("click", () => setEQMode("parametric"));
    modeGraphicBtn.addEventListener("click", () => setEQMode("graphic"));

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

            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                audio.setGraphicGain(i, val);
                updateSingleFaderBadge(i, val);
            });

            slider.addEventListener("dblclick", () => {
                audio.setGraphicGain(i, 0);
                slider.value = 0;
                updateSingleFaderBadge(i, 0);
            });

            sliderWrap.appendChild(slider);
            faderSliderEls.push(slider);

            const freqLabel = document.createElement("div");
            freqLabel.className = "fader-freq-label";
            freqLabel.textContent = label;

            const hintLabel = document.createElement("div");
            hintLabel.className = "fader-tone-hint";
            hintLabel.textContent = hint;

            strip.appendChild(meterTrack);
            strip.appendChild(badge);
            strip.appendChild(sliderWrap);
            strip.appendChild(freqLabel);
            strip.appendChild(hintLabel);

            graphicFadersContainer.appendChild(strip);
        }
    }

    function updateSingleFaderBadge(i, val) {
        if (!faderBadgeEls[i]) return;
        const b = faderBadgeEls[i];
        b.textContent = (val > 0 ? "+" : "") + val.toFixed(1) + " dB";
        b.className = `fader-db-badge ${val > 0 ? "boost" : (val < 0 ? "cut" : "flat")}`;
    }

    function syncGraphicFaderFromCanvas(i, gain) {
        if (faderSliderEls[i]) {
            faderSliderEls[i].value = gain;
            updateSingleFaderBadge(i, gain);
        }
    }

    function updateGraphicFadersUI() {
        for (let i = 0; i < audio.graphicFreqs.length; i++) {
            const gain = audio.graphicGains[i];
            if (faderSliderEls[i]) faderSliderEls[i].value = gain;
            updateSingleFaderBadge(i, gain);
        }
    }

    loadStandardGraphicBtn.addEventListener("click", () => {
        audio.loadStandardGraphicPreset(currentInstrumentId);
        updateGraphicFadersUI();
    });

    resetFlatGraphicBtn.addEventListener("click", () => {
        audio.resetGraphicEQ();
        updateGraphicFadersUI();
    });

    // Real-Time RTA & Master Stereo Output Meter Animation Loop
    let smoothedPeakL = 0;
    let smoothedPeakR = 0;

    function animateMeters() {
        if (audio.isPlaying && audio.analyser) {
            const energies = audio.getGraphicBandEnergies();
            for (let i = 0; i < energies.length; i++) {
                if (faderMeterFillEls[i]) {
                    const pct = Math.min(100, Math.round(energies[i] * 105));
                    faderMeterFillEls[i].style.height = `${pct}%`;
                }
            }

            // Calculate Master Output Level from Analyser time-domain data
            const tdLen = audio.analyser.fftSize;
            const tdData = new Uint8Array(tdLen);
            audio.analyser.getByteTimeDomainData(tdData);
            let sumSq = 0;
            let maxPeak = 0;
            for (let i = 0; i < tdLen; i++) {
                const sample = (tdData[i] - 128) / 128.0;
                const abs = Math.abs(sample);
                if (abs > maxPeak) maxPeak = abs;
                sumSq += sample * sample;
            }
            const rms = Math.sqrt(sumSq / tdLen);
            const targetL = Math.min(1.0, (maxPeak * 0.7 + rms * 0.6));
            const targetR = Math.min(1.0, (maxPeak * 0.68 + rms * 0.62));

            smoothedPeakL = targetL > smoothedPeakL ? targetL : smoothedPeakL * 0.9;
            smoothedPeakR = targetR > smoothedPeakR ? targetR : smoothedPeakR * 0.9;

            const pctL = Math.min(100, Math.max(2, Math.round(Math.pow(smoothedPeakL, 0.55) * 100)));
            const pctR = Math.min(100, Math.max(2, Math.round(Math.pow(smoothedPeakR, 0.55) * 100)));

            if (masterMeterL) masterMeterL.style.height = `${pctL}%`;
            if (masterMeterR) masterMeterR.style.height = `${pctR}%`;

            if (masterPeakReadout) {
                const dbVal = smoothedPeakL > 0.001 ? (20 * Math.log10(smoothedPeakL)) : -60;
                masterPeakReadout.textContent = dbVal <= -55 ? "-∞" : dbVal.toFixed(1);
                masterPeakReadout.style.color = dbVal > -1.5 ? "#ff453a" : "#00d2ff";
            }
        } else {
            faderMeterFillEls.forEach(el => { el.style.height = "0%"; });
            smoothedPeakL *= 0.85;
            smoothedPeakR *= 0.85;
            if (masterMeterL) masterMeterL.style.height = `${Math.round(smoothedPeakL * 100)}%`;
            if (masterMeterR) masterMeterR.style.height = `${Math.round(smoothedPeakR * 100)}%`;
            if (masterPeakReadout && smoothedPeakL < 0.01) {
                masterPeakReadout.textContent = "-∞";
                masterPeakReadout.style.color = "var(--text-muted)";
            }
        }
        requestAnimationFrame(animateMeters);
    }
    animateMeters();

    // -------------------------------------------------------------
    // CATEGORIZED TRACK / INSTRUMENT SELECTOR BAR
    // -------------------------------------------------------------
    const drumIds = ["kick", "snare", "hihat", "tom1", "tom2", "floortom", "overhead_l", "overhead_r"];

    function renderInstrumentsBar() {
        instrumentsBar.innerHTML = "";

        // Group 1: Drum Kit Channels (Real Samples)
        const drumGroup = document.createElement("div");
        drumGroup.className = "inst-group";
        const drumTag = document.createElement("span");
        drumTag.className = "inst-group-label";
        drumTag.textContent = "DRUMS";
        drumGroup.appendChild(drumTag);

        // Group 2: Melodic & Studio Instruments
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
        if (match) match.classList.add("active");

        const data = INSTRUMENTS_DATA[instId];
        if (data) {
            const hasRealSample = Boolean(audio.drumSampleBuffers[instId] || (typeof window !== "undefined" && window.EMBEDDED_SAMPLES && window.EMBEDDED_SAMPLES[instId]));
            currentInstTitle.innerHTML = `${data.icon} ${data.name} ${hasRealSample ? '<span class="real-sample-badge">● REAL SAMPLE LOOP</span>' : ''}`;
            currentInstDesc.textContent = data.description;
            graphicInstName.textContent = data.name.split("(")[0].trim();
            canvas.setActiveZones(data.zones);
            canvas.setHighlightedZone(null);
            renderZonesGuide(data.zones);
            renderPresets(data.presets);
            updateGraphicFadersUI();
            updateAllBandTabCards();
        }
    }

    // -------------------------------------------------------------
    // FREQUENCY CHARACTERISTICS GUIDE ("เนื้อเสียงที่ถูกต้อง")
    // -------------------------------------------------------------
    function renderZonesGuide(zones) {
        zonesList.innerHTML = "";
        if (!zones || zones.length === 0) {
            zonesList.innerHTML = "<p style='color: var(--text-muted); font-size: 13px;'>ไม่มีข้อมูลย่านสำหรับไฟล์ที่นำเข้าเอง</p>";
            return;
        }

        zones.forEach(zone => {
            const card = document.createElement("div");
            card.className = "zone-card";
            card.style.setProperty("--zone-color", zone.color || "#00d2ff");
            card.style.borderLeftColor = zone.color || "var(--accent-cyan)";

            card.innerHTML = `
                <div class="zone-header">
                    <span class="zone-title" style="color:${zone.color}">${zone.name}</span>
                    <span class="zone-freq-badge">${zone.range}</span>
                </div>
                <div class="zone-body">
                    <div class="zone-item"><span class="zone-tag tag-ideal">🎯 เนื้อเสียง</span> <span>${zone.idealTone}</span></div>
                    <div class="zone-item"><span class="zone-tag tag-boost">🔺 ถ้าดันเยอะ</span> <span>${zone.ifBoosted}</span></div>
                    <div class="zone-item"><span class="zone-tag tag-cut">🔻 ถ้าคัตออก</span> <span>${zone.ifCut}</span></div>
                    <div class="zone-protip">💡 <strong>Pro Tip:</strong> ${zone.proTip}</div>
                </div>
                <div class="zone-actions-row">
                    <button type="button" class="zone-act-btn boost-act" title="ทดลองบูสต์ย่านนี้ +6 dB เพื่อฟังคาแรกเตอร์เสียง">
                        🔊 ฟังย่านนี้ (+6 dB)
                    </button>
                    <button type="button" class="zone-act-btn cut-act" title="ทดลองคัตย่านนี้ -6 dB เพื่อฟังความสะอาดเมื่อตัดออก">
                        ✂️ ลองคัต (-6 dB)
                    </button>
                </div>
            `;

            // Hovering card spotlights that zone on the EQ Analyzer Canvas!
            card.addEventListener("mouseenter", () => {
                canvas.setHighlightedZone(zone);
            });
            card.addEventListener("mouseleave", () => {
                canvas.setHighlightedZone(null);
            });

            const boostBtn = card.querySelector(".boost-act");
            const cutBtn = card.querySelector(".cut-act");

            boostBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                handleZoneAudition(zone, 6.0);
            });

            cutBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                handleZoneAudition(zone, -6.0);
            });

            card.addEventListener("click", () => {
                handleZoneAudition(zone, 6.0);
            });

            zonesList.appendChild(card);
        });
    }

    function handleZoneAudition(zone, targetGain = 6.0) {
        if (audio.eqMode === "graphic") {
            let closestIdx = 0;
            let minDiff = Infinity;
            for (let i = 0; i < audio.graphicFreqs.length; i++) {
                const diff = Math.abs(Math.log2(audio.graphicFreqs[i] / zone.centerFreq));
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            }
            audio.setGraphicGain(closestIdx, targetGain);
            updateSingleFaderBadge(closestIdx, targetGain);
            if (faderSliderEls[closestIdx]) faderSliderEls[closestIdx].value = targetGain;
        } else {
            selectBand(3);
            audio.updateBand(3, {
                type: "peaking",
                freq: zone.centerFreq,
                gain: targetGain,
                q: zone.q || 2.0,
                enabled: true
            });
            syncBandRackUI(3);
            updateBandTabCard(3);
        }

        if (!audio.isPlaying) {
            audio.start().then(() => {
                updatePlayBtn();
            });
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
                    setEQMode("parametric");
                }
                audio.applyPreset(p.bands);
                syncBandRackUI(selectedBandIndex);
                updateAllBandTabCards();
            });
            presetsChipsContainer.appendChild(chip);
        });
    }

    // -------------------------------------------------------------
    // 8-BAND AT-A-GLANCE STRIP & ROTARY KNOBS (Pro-Q / Channel EQ)
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
                <span class="band-power-dot" data-power="${idx}" title="คลิกเพื่อ เปิด/ปิด Band ${idx + 1}" style="background:${b.enabled ? color : 'transparent'}; border-color:${color}"></span>
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
        canvas.selectedBand = idx;
        updateAllBandTabCards();
        syncBandRackUI(idx);
    }

    // Update SVG Rotary Knob rotation & glowing ring
    function updateKnobVisual(capEl, arcEl, normVal, color, isBipolar = false) {
        const clamped = Math.max(0, Math.min(1, normVal));
        const angle = -135 + clamped * 270; // -135 deg to +135 deg
        if (capEl) {
            capEl.style.transform = `rotate(${angle}deg)`;
        }
        if (arcEl) {
            const maxArc = 146;
            arcEl.style.stroke = color;
            if (isBipolar) {
                const len = Math.abs(clamped - 0.5) * maxArc;
                arcEl.style.strokeDasharray = `${len} 200`;
                arcEl.style.strokeDashoffset = clamped >= 0.5 ? "-88" : `${-88 + len}`;
            } else {
                const len = clamped * maxArc;
                arcEl.style.strokeDasharray = `${len} 200`;
                arcEl.style.strokeDashoffset = "-15";
            }
        }
    }

    function syncBandRackUI(idx) {
        const b = audio.bands[idx];
        if (!b) return;

        const color = bandColors[idx];

        // Update Active Band Badge
        if (activeBandBadge) {
            activeBandBadge.textContent = `BAND ${idx + 1} • ${b.label.toUpperCase()}`;
            activeBandBadge.style.background = color + "22";
            activeBandBadge.style.borderColor = color;
            activeBandBadge.style.color = color;
        }

        // Frequency
        const freqSlideVal = freqToSlider(b.freq);
        paramFreqSlider.value = freqSlideVal;
        paramFreqVal.textContent = formatHz(b.freq);
        paramFreqVal.style.color = color;
        updateKnobVisual(knobFreqCap, knobFreqArc, freqSlideVal / 1000, color, false);

        // Gain
        const isPass = (b.type === "highpass" || b.type === "lowpass");
        paramGainSlider.value = b.gain;
        paramGainVal.textContent = isPass ? "N/A (Pass)" : ((b.gain > 0 ? "+" : "") + b.gain.toFixed(1) + " dB");
        paramGainSlider.disabled = isPass;
        updateKnobVisual(knobGainCap, knobGainArc, (b.gain + 18) / 36, isPass ? "#555" : color, true);

        // Q
        paramQSlider.value = b.q;
        paramQVal.textContent = b.q.toFixed(2);
        updateKnobVisual(knobQCap, knobQArc, (b.q - 0.2) / 9.8, color, false);

        // Filter Shape Pills & Hidden Select
        paramTypeSelect.value = b.type;
        filterShapePills.forEach(pill => {
            const active = (pill.dataset.type === b.type);
            pill.classList.toggle("active", active);
            pill.style.borderColor = active ? color : "";
            pill.style.color = active ? color : "";
        });

        // Power Enable Switch
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

    // Filter Shape Pill Clicks
    filterShapePills.forEach(pill => {
        pill.addEventListener("click", () => {
            const newType = pill.dataset.type;
            paramTypeSelect.value = newType;
            audio.updateBand(selectedBandIndex, { type: newType, enabled: true });
            syncBandRackUI(selectedBandIndex);
            updateBandTabCard(selectedBandIndex);
        });
    });

    // Interactive Rotary Knob Dragging & Mouse Wheel
    function setupRotaryKnobDrag(knobId, onDelta, onDblClick) {
        const el = document.getElementById(knobId);
        if (!el) return;
        let dragging = false;
        let lastY = 0;

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
            playBtn.innerHTML = `<span>⏹</span> <span>หยุดเสียง (Stop)</span>`;
            playBtn.classList.remove("btn-primary");
            playBtn.classList.add("btn-danger");
        } else {
            playBtn.innerHTML = `<span>▶</span> <span>เล่นเสียง (Play)</span>`;
            playBtn.classList.add("btn-primary");
            playBtn.classList.remove("btn-danger");
        }
    }

    playBtn.addEventListener("click", async () => {
        await audio.toggle();
        updatePlayBtn();
    });

    // Spacebar shortcut for Play/Stop
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
        bypassBtn.innerHTML = newBypass ? `<span>⚡</span> <span>BYPASSED (เสียงดิบ)</span>` : `<span>⚡</span> <span>Bypass EQ</span>`;
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

    if (tempoSlider) {
        tempoSlider.addEventListener("input", (e) => {
            const bpm = parseInt(e.target.value, 10);
            audio.tempo = bpm;
            if (tempoValue) tempoValue.textContent = bpm;
            if (audio.isPlaying && !audio.isCustomLoaded && !audio.drumSampleBuffers[currentInstrumentId]) {
                audio.startSequencer();
            }
        });
    }

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
        currentInstTitle.textContent = `🎵 ${fileName}`;
        currentInstDesc.textContent = `ไฟล์เสียงจริงที่คุณนำเข้า (${fileName}) สามารถฝึกหมุน EQ, สังเกตเส้น Real-Time RTA, ปรับ Graphic Fader และทดสอบ Golden Ears Quiz ได้ทันที`;
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

    // -------------------------------------------------------------
    // DRAG & DROP AUDIO FILE SUPPORT
    // -------------------------------------------------------------
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
    // EAR TRAINING QUIZ SYSTEM
    // -------------------------------------------------------------
    startQuizBtn.addEventListener("click", async () => {
        if (!audio.isPlaying) {
            await audio.start();
            updatePlayBtn();
        }
        quiz.start();
        quizSetupBox.style.display = "none";
        quizActiveArea.style.display = "flex";
        quizFeedback.style.display = "none";
        renderQuizChoices();
    });

    stopQuizBtn.addEventListener("click", () => {
        quiz.stop();
        quizSetupBox.style.display = "flex";
        quizActiveArea.style.display = "none";
        quizFeedback.style.display = "none";
    });

    diffBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            diffBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            quiz.setDifficulty(btn.dataset.diff);
            if (quiz.isActive) renderQuizChoices();
        });
    });

    quizBypassBtn.addEventListener("click", () => {
        quiz.toggleMysteryBypass();
    });

    quizNextBtn.addEventListener("click", () => {
        quiz.nextQuestion();
        quizFeedback.style.display = "none";
        quizNextBtn.style.display = "none";
        document.querySelectorAll(".quiz-choice-btn").forEach(b => b.disabled = false);
    });

    function renderQuizChoices() {
        quizChoicesGrid.innerHTML = "";
        const options = quiz.difficultyLevels[quiz.difficulty];

        options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "quiz-choice-btn";
            btn.innerHTML = `
                <span>${opt.label}</span>
                <span class="quiz-choice-sub">${opt.range}</span>
            `;
            btn.addEventListener("click", () => {
                handleQuizAnswer(opt.freq);
            });
            quizChoicesGrid.appendChild(btn);
        });
    }

    function handleQuizAnswer(freq) {
        document.querySelectorAll(".quiz-choice-btn").forEach(b => b.disabled = true);
        const res = quiz.checkAnswer(freq);

        quizScoreVal.textContent = res.score;
        quizStreakVal.textContent = res.streak + " 🔥";
        quizTotalVal.textContent = res.total;

        const isCorrect = res.isCorrect;
        quizFeedback.className = `quiz-feedback-box ${isCorrect ? "correct" : "incorrect"}`;
        quizFeedback.style.display = "flex";

        const correctHz = res.correctFreq >= 1000 ? (res.correctFreq / 1000) + " kHz" : res.correctFreq + " Hz";
        const sign = res.gain > 0 ? "+" : "";

        quizFeedback.innerHTML = `
            <div style="font-size: 14px; font-weight: 700;">
                ${isCorrect ? "🎉 ถูกต้องยอดเยี่ยม! (Correct)" : "❌ ยังไม่ถูกต้อง (Incorrect)"}
            </div>
            <div style="font-size: 12.5px;">
                ย่านที่เปลี่ยนคือ: <strong>${correctHz} (${sign}${res.gain} dB)</strong> • <strong>${res.action}</strong>
            </div>
            <div style="font-size: 11.5px; opacity: 0.9;">
                ${getFrequencySoundDescription(res.correctFreq)}
            </div>
        `;

        quizNextBtn.style.display = "inline-flex";
    }

    function updateQuizUI() {
        quizBypassBtn.innerHTML = quiz.isMysteryBypassed ?
            "<span>👂 กำลังฟัง: เสียงปกติ (Normal Flat)</span>" :
            "<span>🎧 กำลังฟัง: เสียงที่ถูก EQ (Mystery EQ)</span>";
        quizBypassBtn.classList.toggle("btn-active", !quiz.isMysteryBypassed);
    }

    function getFrequencySoundDescription(freq) {
        if (freq <= 100) return "ย่าน Sub-Bass & Punch แรงกระแทกของกระเดื่องและฐานเสียงเบส หากดันจะแน่นลึก หากคัตจะรู้สึกเบาโหวง";
        if (freq <= 250) return "ย่าน Body & Warmth ความหนาของสแนร์และเสียงร้อง หากดันมากไปจะบวมอับทึบ";
        if (freq <= 500) return "ย่าน Boxiness & Mud เสียงเหมือนเคาะกล่องกระดาษ อู้อี้ ซาวด์เอนจิเนียร์มักคัตย่านนี้ลงเพื่อความสะอาด";
        if (freq <= 1500) return "ย่าน Mid & Nasal เสียงก้องขึ้นจมูก ชัดเจนแบบลำโพงโทรศัพท์หรือโทรโข่ง";
        if (freq <= 4000) return "ย่าน Presence & Attack ความคมชัด หัวไม้กลอง การดีดสายกีตาร์ และความชัดเจนของคำร้อง";
        if (freq <= 8000) return "ย่าน Sibilance & Harshness เสียงลมพ่นฟัน ส, ซ และความคมบาดหู";
        return "ย่าน Air & Shimmer ประกายความหรูหรา ความโปร่ง และบรรยากาศของสตูดิโอระดับโลก";
    }

    // -------------------------------------------------------------
    // INITIAL BOOTSTRAP
    // -------------------------------------------------------------
    renderInstrumentsBar();
    renderBandTabs();
    renderGraphicFaders();
    selectInstrument("kick");
    selectBand(2);
});
