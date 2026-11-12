/**
 * EQ Master Trainer - Main Controller
 * Focused Sweet-Spot Ear Training for Real Drum Loops
 * With ±300 Hz Frequency Sweep, Filter Type Selection, Low Cut & ±2, ±4, ±6 dB Levels
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Core Subsystems
    const audio = new AudioEngine();
    let currentInstrumentId = "kick";

    // 8 Real Drum Instruments (with audio samples)
    const DRUM_CHANNELS = [
        { id: "kick", name: "KICK", icon: "🥁", short: "กระเดื่อง" },
        { id: "snare", name: "SNARE", icon: "🥁", short: "สแนร์" },
        { id: "hihat", name: "HI-HAT", icon: "✨", short: "ไฮแฮท" },
        { id: "tom1", name: "TOM 1", icon: "🥁", short: "ทอม 1" },
        { id: "tom2", name: "TOM 2", icon: "🥁", short: "ทอม 2" },
        { id: "floortom", name: "FLOOR TOM", icon: "🥁", short: "ฟลอร์ทอม" },
        { id: "overhead_l", name: "OH - LEFT", icon: "🎙️", short: "โอเวอร์เฮด ซ้าย" },
        { id: "overhead_r", name: "OH - RIGHT", icon: "🎙️", short: "โอเวอร์เฮด ขวา" }
    ];

    // DOM Elements
    const playBtn = document.getElementById("playBtn");
    const bypassBtn = document.getElementById("bypassBtn");
    const resetEqBtn = document.getElementById("resetEqBtn");
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeReadout = document.getElementById("volumeReadout");
    const instrumentsBar = document.getElementById("instrumentsBar");
    const activeInstBadge = document.getElementById("activeInstBadge");
    const activeZoneSummary = document.getElementById("activeZoneSummary");
    const sweetSpotsGrid = document.getElementById("sweetSpotsGrid");
    const bypassBanner = document.getElementById("bypassBanner");
    const canvasElement = document.getElementById("eqCanvas");

    // Low Cut Elements
    const lowCutToggleBtn = document.getElementById("lowCutToggleBtn");
    const lowCutStatusPill = document.getElementById("lowCutStatusPill");
    const lowCutSlider = document.getElementById("lowCutSlider");
    const lowCutReadout = document.getElementById("lowCutReadout");
    const lowCutPresets = document.querySelectorAll(".btn-lc-preset");

    // Format frequency helper
    function formatHz(freq) {
        return freq >= 1000 ? (freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1) + " kHz" : Math.round(freq) + " Hz";
    }

    // 2. Initialize Canvas Visualizer with Gain, Freq & Q callbacks
    const canvas = new EQCanvas(
        canvasElement,
        audio,
        (zoneIndex, gainDb, freqVal) => {
            // Callback when user drags nodes on the canvas (2D: Y for gain, X for freq ±300Hz)
            if (gainDb !== undefined && freqVal !== undefined) {
                setGainAndFreqForSweetSpot(zoneIndex, gainDb, freqVal);
            } else if (gainDb !== undefined) {
                setGainForSweetSpot(zoneIndex, gainDb);
            }
        },
        (hoveredIndex) => {
            // Callback when user hovers a node
            highlightCard(hoveredIndex);
        },
        (zoneIndex, qVal) => {
            // Callback when user scrolls mouse wheel over a node to adjust Q
            setQForSweetSpot(zoneIndex, qVal);
        }
    );

    // 3. Render 8 Drum Buttons
    function renderInstrumentNav() {
        instrumentsBar.innerHTML = "";
        DRUM_CHANNELS.forEach(ch => {
            const btn = document.createElement("button");
            btn.className = `inst-btn ${ch.id === currentInstrumentId ? "active" : ""}`;
            btn.dataset.id = ch.id;
            btn.innerHTML = `
                <span class="inst-icon">${ch.icon}</span>
                <span class="inst-name">${ch.name}</span>
                <span class="inst-short">${ch.short}</span>
            `;

            btn.addEventListener("click", () => {
                selectInstrument(ch.id);
            });

            instrumentsBar.appendChild(btn);
        });
    }

    // 4. Select Instrument & Reconfigure Sweet Spots
    function selectInstrument(instId) {
        if (!INSTRUMENTS_DATA[instId]) return;
        currentInstrumentId = instId;

        // Update nav buttons
        document.querySelectorAll(".inst-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.id === instId);
        });

        const instData = INSTRUMENTS_DATA[instId];

        // Update badges
        if (activeInstBadge) {
            activeInstBadge.textContent = `${instData.icon} ${instData.name}`;
        }
        if (activeZoneSummary) {
            activeZoneSummary.textContent = `${instData.zones.length} ย่านเสียงสำคัญ`;
        }

        // Initialize audio engine on user interaction
        audio.init();

        // Switch drum sample loop if already playing
        if (audio.isPlaying) {
            audio.playDrumSampleLoop(instId);
        }

        // Reconfigure audio filters for this instrument's sweet spots (all reset to 0 dB & default freq)
        audio.setInstrumentSweetSpots(instData.zones);

        // Update Canvas
        canvas.setZones(instData.zones);

        // Render direct sweet spot cards
        renderSweetSpotCards(instData.zones);
    }

    // 5. Render Dedicated Sweet-Spot Control Cards
    function renderSweetSpotCards(zones) {
        sweetSpotsGrid.innerHTML = "";

        zones.forEach((zone, index) => {
            const card = document.createElement("div");
            card.className = "sweet-card";
            card.id = `sweetCard_${index}`;
            card.dataset.index = index;
            card.style.setProperty("--zone-color", zone.color || "#00d2ff");

            const b = audio.bands[index];
            const currentGain = b ? b.gain : 0;
            const currentFreq = b ? b.freq : zone.centerFreq;
            const defaultFreq = b ? (b.defaultFreq || zone.centerFreq) : zone.centerFreq;
            const currentQ = b ? b.q : (zone.q || 1.4);
            const currentType = b ? b.type : "peaking";

            const minF = Math.max(20, defaultFreq - 300);
            const maxF = defaultFreq + 300;
            const freqDelta = Math.round(currentFreq - defaultFreq);

            const gainSign = currentGain > 0 ? `+${currentGain.toFixed(1)}` : `${currentGain.toFixed(1)}`;

            // Split title
            const parts = zone.name.split("(");
            const enTitle = parts[0].trim();
            const thTitle = parts[1] ? parts[1].replace(")", "").trim() : "";

            const typeLabel = {
                peaking: "Bell",
                lowshelf: "L-Shelf",
                highshelf: "H-Shelf",
                highpass: "High Pass",
                lowpass: "Low Pass"
            }[currentType] || "Bell";

            card.innerHTML = `
                <div class="card-head">
                    <div class="card-freq-pill" id="cardFreqPill_${index}" style="background: ${zone.color};">
                        ${formatHz(currentFreq)}
                    </div>
                    <div class="card-title-box">
                        <strong class="title-en">${enTitle}</strong>
                        <span class="title-th">${thTitle}</span>
                    </div>
                    <div class="card-badges-right">
                        <span class="card-type-badge" id="cardTypeBadge_${index}">${typeLabel}</span>
                        <span class="card-q-badge" id="cardQBadge_${index}">Q: ${currentQ.toFixed(1)}</span>
                        <div class="card-gain-readout ${currentGain > 0 ? 'boosted' : (currentGain < 0 ? 'cut' : 'flat')}" id="cardGainReadout_${index}">
                            ${gainSign} dB
                        </div>
                    </div>
                </div>

                <!-- Filter Shape / Band Type Selection -->
                <div class="card-filter-types-row">
                    <span class="sub-ctrl-label">ชนิดฟิลเตอร์:</span>
                    <div class="type-btn-group">
                        <button type="button" class="btn-type ${currentType === 'peaking' ? 'active' : ''}" data-index="${index}" data-type="peaking" title="Bell / Peaking (เน้นบูสต์/คัตเฉพาะจุด)">🔔 Bell</button>
                        <button type="button" class="btn-type ${currentType === 'lowshelf' ? 'active' : ''}" data-index="${index}" data-type="lowshelf" title="Low Shelf (ยก/ลดย่านต่ำทั้งหมด)">⎍ Low Shelf</button>
                        <button type="button" class="btn-type ${currentType === 'highshelf' ? 'active' : ''}" data-index="${index}" data-type="highshelf" title="High Shelf (ยก/ลดย่านแหลมทั้งหมด)">⎎ High Shelf</button>
                        <button type="button" class="btn-type ${currentType === 'highpass' ? 'active' : ''}" data-index="${index}" data-type="highpass" title="High Pass (ตัดย่านต่ำทิ้ง)">⎾ High Pass</button>
                        <button type="button" class="btn-type ${currentType === 'lowpass' ? 'active' : ''}" data-index="${index}" data-type="lowpass" title="Low Pass (ตัดย่านแหลมทิ้ง)">⎿ Low Pass</button>
                    </div>
                </div>

                <!-- 7 Audition Level Buttons: -6, -4, -2, 0, +2, +4, +6 dB -->
                <div class="card-levels-section">
                    <div class="level-btn-row">
                        <div class="level-btn-group cut-group">
                            <button type="button" class="btn-step step-cut ${currentGain === -6 ? 'active' : ''}" data-index="${index}" data-gain="-6">-6 dB</button>
                            <button type="button" class="btn-step step-cut ${currentGain === -4 ? 'active' : ''}" data-index="${index}" data-gain="-4">-4 dB</button>
                            <button type="button" class="btn-step step-cut ${currentGain === -2 ? 'active' : ''}" data-index="${index}" data-gain="-2">-2 dB</button>
                        </div>

                        <button type="button" class="btn-step step-flat ${currentGain === 0 ? 'active' : ''}" data-index="${index}" data-gain="0" title="คืนค่าเป็น 0 dB (Flat)">
                            0 dB
                        </button>

                        <div class="level-btn-group boost-group">
                            <button type="button" class="btn-step step-boost ${currentGain === 2 ? 'active' : ''}" data-index="${index}" data-gain="2">+2 dB</button>
                            <button type="button" class="btn-step step-boost ${currentGain === 4 ? 'active' : ''}" data-index="${index}" data-gain="4">+4 dB</button>
                            <button type="button" class="btn-step step-boost ${currentGain === 6 ? 'active' : ''}" data-index="${index}" data-gain="6">+6 dB</button>
                        </div>
                    </div>
                </div>

                <!-- Continuous Gain Slider -->
                <div class="card-fader-row">
                    <span class="fader-limit">-12</span>
                    <input type="range" class="fader-range" id="fader_${index}" data-index="${index}" min="-12" max="12" step="0.5" value="${currentGain}">
                    <span class="fader-limit">+12 dB</span>
                </div>

                <!-- Frequency Shift Slider (±300 Hz) -->
                <div class="card-freq-shift-section">
                    <div class="freq-shift-header">
                        <span class="sub-ctrl-label">กวาดความถี่ (Sweep ±300 Hz):</span>
                        <div class="freq-readout-wrap">
                            <strong class="freq-val-text" id="freqValText_${index}">${Math.round(currentFreq)} Hz</strong>
                            <span class="freq-delta-pill" id="freqDeltaPill_${index}">${freqDelta !== 0 ? (freqDelta > 0 ? `+${freqDelta}` : `${freqDelta}`) + ' Hz' : '±0'}</span>
                        </div>
                        <button type="button" class="btn-reset-freq" data-index="${index}" data-default="${defaultFreq}" title="คืนค่าความถี่มาตรฐาน (${defaultFreq} Hz)">
                            🔄 เดิม
                        </button>
                    </div>
                    <div class="freq-shift-slider-row">
                        <span class="f-limit">${minF} Hz</span>
                        <input type="range" class="freq-range" id="freqSlider_${index}" data-index="${index}" min="${minF}" max="${maxF}" step="1" value="${currentFreq}">
                        <span class="f-limit">${maxF} Hz</span>
                    </div>
                </div>

                <!-- Q (Bandwidth) Controller -->
                <div class="card-q-section">
                    <div class="q-header-row">
                        <span class="sub-ctrl-label">ความกว้างย่านเสียง (Q):</span>
                        <div class="q-presets">
                            <button type="button" class="btn-q-preset ${Math.abs(currentQ - 0.7) < 0.2 ? 'active' : ''}" data-index="${index}" data-q="0.7">0.7 กว้าง</button>
                            <button type="button" class="btn-q-preset ${Math.abs(currentQ - 1.4) < 0.2 ? 'active' : ''}" data-index="${index}" data-q="1.4">1.4 ปกติ</button>
                            <button type="button" class="btn-q-preset ${Math.abs(currentQ - 3.0) < 0.2 ? 'active' : ''}" data-index="${index}" data-q="3.0">3.0 แคบ</button>
                        </div>
                    </div>
                    <div class="q-slider-row">
                        <span class="q-sub-lbl">กว้าง (0.4)</span>
                        <input type="range" class="q-range" id="qSlider_${index}" data-index="${index}" min="0.4" max="6.0" step="0.1" value="${currentQ}">
                        <span class="q-sub-lbl">แคบ (6.0)</span>
                    </div>
                </div>

                <!-- Ear Training Cues -->
                <div class="card-cues">
                    <div class="cue-item cue-boost">
                        <span class="cue-label">🔺 ถ้าเร่ง:</span>
                        <span class="cue-text">${zone.ifBoosted || zone.idealTone}</span>
                    </div>
                    <div class="cue-item cue-cut">
                        <span class="cue-label">🔻 ถ้าตัด:</span>
                        <span class="cue-text">${zone.ifCut}</span>
                    </div>
                </div>
            `;

            // Hover card to highlight canvas node
            card.addEventListener("mouseenter", () => {
                canvas.setHoveredIndex(index);
            });
            card.addEventListener("mouseleave", () => {
                canvas.setHoveredIndex(-1);
            });

            sweetSpotsGrid.appendChild(card);
        });

        // Attach event listeners
        attachCardControls();
    }

    // 6. Card Control Interactions
    function attachCardControls() {
        // Step buttons: -6, -4, -2, 0, +2, +4, +6 dB
        sweetSpotsGrid.querySelectorAll(".btn-step").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                const gain = parseFloat(btn.dataset.gain);
                setGainForSweetSpot(idx, gain);
            });
        });

        // Gain sliders: continuous real-time adjustment
        sweetSpotsGrid.querySelectorAll(".fader-range").forEach(slider => {
            const idx = parseInt(slider.dataset.index, 10);

            const handleInput = () => {
                const gain = parseFloat(slider.value);
                setGainForSweetSpot(idx, gain);
            };

            slider.addEventListener("input", handleInput);
            slider.addEventListener("change", handleInput);

            // Double click slider to reset to 0 dB
            slider.addEventListener("dblclick", () => {
                setGainForSweetSpot(idx, 0);
            });
        });

        // Filter Type buttons
        sweetSpotsGrid.querySelectorAll(".btn-type").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                const type = btn.dataset.type;
                setFilterTypeForSweetSpot(idx, type);
            });
        });

        // Frequency Shift Sliders (±300 Hz)
        sweetSpotsGrid.querySelectorAll(".freq-range").forEach(slider => {
            const idx = parseInt(slider.dataset.index, 10);
            const handleFreq = () => {
                const freq = parseFloat(slider.value);
                setFreqForSweetSpot(idx, freq);
            };
            slider.addEventListener("input", handleFreq);
            slider.addEventListener("change", handleFreq);

            slider.addEventListener("dblclick", () => {
                const b = audio.bands[idx];
                const defF = b ? b.defaultFreq : 100;
                setFreqForSweetSpot(idx, defF);
            });
        });

        // Reset Freq button
        sweetSpotsGrid.querySelectorAll(".btn-reset-freq").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                const defF = parseFloat(btn.dataset.default);
                setFreqForSweetSpot(idx, defF);
            });
        });

        // Q Preset buttons: 0.7, 1.4, 3.0
        sweetSpotsGrid.querySelectorAll(".btn-q-preset").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                const q = parseFloat(btn.dataset.q);
                setQForSweetSpot(idx, q);
            });
        });

        // Q Sliders
        sweetSpotsGrid.querySelectorAll(".q-range").forEach(qSlider => {
            const idx = parseInt(qSlider.dataset.index, 10);
            const handleQ = () => {
                const q = parseFloat(qSlider.value);
                setQForSweetSpot(idx, q);
            };
            qSlider.addEventListener("input", handleQ);
            qSlider.addEventListener("change", handleQ);
        });
    }

    // 7. Update Gain Helper
    function setGainForSweetSpot(index, gainDb) {
        audio.init();

        const clampedGain = Math.max(-12, Math.min(12, gainDb));

        // 1. Update Audio Engine
        audio.setSweetSpotGain(index, clampedGain);

        // 2. Update Slider
        const slider = document.getElementById(`fader_${index}`);
        if (slider && parseFloat(slider.value) !== clampedGain) {
            slider.value = clampedGain;
        }

        // 3. Update Gain Text Readout
        const readout = document.getElementById(`cardGainReadout_${index}`);
        if (readout) {
            const gainStr = clampedGain > 0 ? `+${clampedGain.toFixed(1)}` : `${clampedGain.toFixed(1)}`;
            readout.textContent = `${gainStr} dB`;
            readout.classList.toggle("boosted", clampedGain > 0);
            readout.classList.toggle("cut", clampedGain < 0);
            readout.classList.toggle("flat", clampedGain === 0);
        }

        // 4. Update Step Buttons active states
        const card = document.getElementById(`sweetCard_${index}`);
        if (card) {
            card.querySelectorAll(".btn-step").forEach(btn => {
                const bGain = parseFloat(btn.dataset.gain);
                btn.classList.toggle("active", bGain === clampedGain);
            });
        }
    }

    // 8. Update Frequency Helper (±300 Hz)
    function setFreqForSweetSpot(index, freqVal) {
        audio.init();
        audio.setSweetSpotFreq(index, freqVal);

        const b = audio.bands[index];
        const curFreq = b ? b.freq : freqVal;
        const defaultFreq = b ? (b.defaultFreq || curFreq) : curFreq;
        const delta = Math.round(curFreq - defaultFreq);

        // Update Pill
        const pill = document.getElementById(`cardFreqPill_${index}`);
        if (pill) {
            pill.textContent = formatHz(curFreq);
        }

        // Update Slider
        const fSlider = document.getElementById(`freqSlider_${index}`);
        if (fSlider && Math.abs(parseFloat(fSlider.value) - curFreq) > 0.5) {
            fSlider.value = curFreq;
        }

        // Update Readout text
        const textVal = document.getElementById(`freqValText_${index}`);
        if (textVal) {
            textVal.textContent = `${Math.round(curFreq)} Hz`;
        }

        // Update Delta pill
        const deltaPill = document.getElementById(`freqDeltaPill_${index}`);
        if (deltaPill) {
            deltaPill.textContent = delta !== 0 ? (delta > 0 ? `+${delta}` : `${delta}`) + ' Hz' : '±0';
            deltaPill.classList.toggle("shifted", delta !== 0);
        }
    }

    // Combined Gain & Freq update from Canvas dragging
    function setGainAndFreqForSweetSpot(index, gainDb, freqVal) {
        setGainForSweetSpot(index, gainDb);
        setFreqForSweetSpot(index, freqVal);
    }

    // 9. Update Filter Type Helper
    function setFilterTypeForSweetSpot(index, type) {
        audio.init();
        audio.setSweetSpotType(index, type);

        const typeLabel = {
            peaking: "Bell",
            lowshelf: "L-Shelf",
            highshelf: "H-Shelf",
            highpass: "High Pass",
            lowpass: "Low Pass"
        }[type] || "Bell";

        const badge = document.getElementById(`cardTypeBadge_${index}`);
        if (badge) {
            badge.textContent = typeLabel;
        }

        const card = document.getElementById(`sweetCard_${index}`);
        if (card) {
            card.querySelectorAll(".btn-type").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.type === type);
            });
        }
    }

    // 10. Update Q Helper
    function setQForSweetSpot(index, qVal) {
        audio.init();
        const clampedQ = Math.max(0.4, Math.min(6.0, qVal));

        audio.setSweetSpotQ(index, clampedQ);

        const qBadge = document.getElementById(`cardQBadge_${index}`);
        if (qBadge) {
            qBadge.textContent = `Q: ${clampedQ.toFixed(1)}`;
        }

        const qSlider = document.getElementById(`qSlider_${index}`);
        if (qSlider && Math.abs(parseFloat(qSlider.value) - clampedQ) > 0.05) {
            qSlider.value = clampedQ;
        }

        const card = document.getElementById(`sweetCard_${index}`);
        if (card) {
            card.querySelectorAll(".btn-q-preset").forEach(btn => {
                const btnQ = parseFloat(btn.dataset.q);
                btn.classList.toggle("active", Math.abs(btnQ - clampedQ) < 0.2);
            });
        }
    }

    // Highlight Card from Canvas hover
    function highlightCard(index) {
        sweetSpotsGrid.querySelectorAll(".sweet-card").forEach((c, idx) => {
            c.classList.toggle("highlighted", idx === index);
        });
    }

    // 11. Low Cut (HPF) Controls
    function updateLowCutUI() {
        const isEnabled = audio.lowCutEnabled;
        const freq = audio.lowCutFreq || 40;

        lowCutToggleBtn.classList.toggle("active", isEnabled);
        lowCutStatusPill.textContent = isEnabled ? "ON" : "OFF";
        lowCutStatusPill.className = `lowcut-status-pill ${isEnabled ? 'on' : 'off'}`;

        lowCutSlider.disabled = !isEnabled;
        lowCutSlider.value = freq;
        lowCutReadout.textContent = `${Math.round(freq)} Hz`;

        lowCutPresets.forEach(btn => {
            const btnF = parseFloat(btn.dataset.freq);
            btn.classList.toggle("active", isEnabled && Math.abs(btnF - freq) < 5);
        });
    }

    lowCutToggleBtn.addEventListener("click", () => {
        audio.init();
        const newState = !audio.lowCutEnabled;
        audio.setLowCut(newState);
        updateLowCutUI();
    });

    lowCutPresets.forEach(btn => {
        btn.addEventListener("click", () => {
            audio.init();
            const freq = parseFloat(btn.dataset.freq);
            audio.setLowCut(true, freq);
            updateLowCutUI();
        });
    });

    lowCutSlider.addEventListener("input", (e) => {
        const freq = parseFloat(e.target.value);
        audio.setLowCut(true, freq);
        updateLowCutUI();
    });

    // 12. Transport Controls
    // Play / Stop
    function togglePlay() {
        audio.init();

        if (audio.isPlaying) {
            audio.stop();
            playBtn.classList.remove("playing");
            playBtn.querySelector(".btn-icon").textContent = "▶";
            playBtn.querySelector(".btn-label").textContent = "เล่น LOOP";
        } else {
            const success = audio.playDrumSampleLoop(currentInstrumentId);
            if (success) {
                audio.isPlaying = true;
                playBtn.classList.add("playing");
                playBtn.querySelector(".btn-icon").textContent = "⏸";
                playBtn.querySelector(".btn-label").textContent = "หยุดเล่น";
            }
        }
    }

    playBtn.addEventListener("click", togglePlay);

    // Bypass EQ Toggle (A/B Test)
    bypassBtn.addEventListener("click", () => {
        audio.init();
        const bypassed = audio.setBypass(!audio.isBypassed);
        bypassBtn.classList.toggle("active", audio.isBypassed);
        bypassBtn.querySelector(".btn-label").textContent = audio.isBypassed ? "EQ: ปิดอยู่" : "BYPASS";

        if (bypassBanner) {
            bypassBanner.style.display = audio.isBypassed ? "flex" : "none";
        }
    });

    // Reset All Sweet Spots to 0 dB Flat, Default Freq, and Bell Type
    resetEqBtn.addEventListener("click", () => {
        audio.init();
        audio.resetSweetSpots();

        const instData = INSTRUMENTS_DATA[currentInstrumentId];
        if (instData && instData.zones) {
            instData.zones.forEach((z, idx) => {
                setGainForSweetSpot(idx, 0);
                setFreqForSweetSpot(idx, z.centerFreq);
                setFilterTypeForSweetSpot(idx, "peaking");
            });
        }
    });

    // Master Volume Fader
    volumeSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (audio.outputGain) {
            audio.outputGain.gain.setTargetAtTime(val, audio.ctx.currentTime, 0.01);
        }
        const db = val > 0 ? (20 * Math.log10(val)).toFixed(1) : "-∞";
        volumeReadout.textContent = `${db > 0 ? "+" : ""}${db} dB`;
    });

    // Keyboard Shortcut: Spacebar for Play/Stop
    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
            togglePlay();
        }
    });

    // 13. Start Main Animation Loop
    function renderLoop() {
        canvas.draw();
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

    // 14. Initial Setup
    renderInstrumentNav();
    selectInstrument(currentInstrumentId);
    updateLowCutUI();
});
