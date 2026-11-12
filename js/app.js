/**
 * EQ Master Trainer - Main Controller
 * Focused Sweet-Spot Ear Training for Real Drum Loops
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

    // Format frequency helper
    function formatHz(freq) {
        return freq >= 1000 ? (freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1) + " kHz" : Math.round(freq) + " Hz";
    }

    // 2. Initialize Canvas Visualizer
    const canvas = new EQCanvas(
        canvasElement,
        audio,
        (zoneIndex, gainDb) => {
            // Callback when user drags or taps nodes on the canvas
            setGainForSweetSpot(zoneIndex, gainDb);
        },
        (hoveredIndex) => {
            // Callback when user hovers a node
            highlightCard(hoveredIndex);
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

        // Reconfigure audio filters for this instrument's sweet spots (all reset to 0 dB)
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

            const currentGain = audio.bands[index] ? audio.bands[index].gain : 0;
            const gainSign = currentGain > 0 ? `+${currentGain.toFixed(1)}` : `${currentGain.toFixed(1)}`;

            // Split title
            const parts = zone.name.split("(");
            const enTitle = parts[0].trim();
            const thTitle = parts[1] ? parts[1].replace(")", "").trim() : "";

            card.innerHTML = `
                <div class="card-head">
                    <div class="card-freq-pill" style="background: ${zone.color};">
                        ${formatHz(zone.centerFreq)}
                    </div>
                    <div class="card-title-box">
                        <strong class="title-en">${enTitle}</strong>
                        <span class="title-th">${thTitle}</span>
                    </div>
                    <div class="card-gain-readout" id="cardGainReadout_${index}">
                        ${gainSign} dB
                    </div>
                </div>

                <!-- Instant Audition Buttons (1-Tap to hear!) -->
                <div class="card-quick-actions">
                    <button type="button" class="btn-step step-cut ${currentGain === -6 ? 'active' : ''}" data-index="${index}" data-gain="-6" title="ตัดเสียงย่านนี้ลง -6 dB">
                        🔻 -6 dB (ตัด)
                    </button>
                    <button type="button" class="btn-step step-flat ${currentGain === 0 ? 'active' : ''}" data-index="${index}" data-gain="0" title="คืนค่าเป็นเสียงปกติ 0 dB">
                        🔄 0 dB (เดิม)
                    </button>
                    <button type="button" class="btn-step step-boost ${currentGain === 6 ? 'active' : ''}" data-index="${index}" data-gain="6" title="เร่งเสียงย่านนี้ขึ้น +6 dB">
                        🔺 +6 dB (เร่ง)
                    </button>
                </div>

                <!-- Smooth Slider -->
                <div class="card-fader-row">
                    <span class="fader-limit">-12</span>
                    <input type="range" class="fader-range" id="fader_${index}" data-index="${index}" min="-12" max="12" step="0.5" value="${currentGain}">
                    <span class="fader-limit">+12 dB</span>
                </div>

                <!-- Ear Training Cues -->
                <div class="card-cues">
                    <div class="cue-item cue-boost">
                        <span class="cue-label">🔺 เร่ง (+):</span>
                        <span class="cue-text">${zone.ifBoosted || zone.idealTone}</span>
                    </div>
                    <div class="cue-item cue-cut">
                        <span class="cue-label">🔻 ตัด (-):</span>
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

        // Attach event listeners to all step buttons & sliders in grid
        attachCardControls();
    }

    // 6. Card Control Interactions
    function attachCardControls() {
        // Step buttons: -6, 0, +6 dB
        sweetSpotsGrid.querySelectorAll(".btn-step").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                const gain = parseFloat(btn.dataset.gain);
                setGainForSweetSpot(idx, gain);
            });
        });

        // Sliders: continuous real-time adjustment
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
    }

    // 7. Update Gain Helper (Unified for Canvas drag, Step buttons, and Sliders)
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

    // Highlight Card from Canvas hover
    function highlightCard(index) {
        sweetSpotsGrid.querySelectorAll(".sweet-card").forEach((c, idx) => {
            c.classList.toggle("highlighted", idx === index);
        });
    }

    // 8. Transport Controls
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

    // Reset All Sweet Spots to 0 dB Flat
    resetEqBtn.addEventListener("click", () => {
        audio.init();
        audio.resetSweetSpots();

        const instData = INSTRUMENTS_DATA[currentInstrumentId];
        if (instData && instData.zones) {
            instData.zones.forEach((_, idx) => {
                setGainForSweetSpot(idx, 0);
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

    // 9. Start Main Animation Loop
    function renderLoop() {
        canvas.draw();
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

    // 10. Initial Setup
    renderInstrumentNav();
    selectInstrument(currentInstrumentId);
});
