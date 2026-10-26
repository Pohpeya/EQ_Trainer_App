/**
 * EQ Master Trainer - Ear Training Quiz Module
 * ทดสอบและฝึกฝนการแยกแยะย่านความถี่ (Golden Ears Training)
 */

class EQQuiz {
    constructor(audioEngine, eqCanvas, onQuizStateChange) {
        this.audio = audioEngine;
        this.canvas = eqCanvas;
        this.onStateChange = onQuizStateChange;

        this.isActive = false;
        this.score = 0;
        this.streak = 0;
        this.totalQuestions = 0;

        this.difficulty = "intermediate"; // beginner, intermediate, pro
        this.targetBand = null;
        this.targetFreq = 1000;
        this.targetGain = 6;
        this.targetType = "peaking";
        this.isMysteryBypassed = false;

        // Band frequencies by level
        this.difficultyLevels = {
            beginner: [
                { label: "Low Bass (100 Hz)", freq: 100, range: "ย่านต่ำลึก แน่น หนัก" },
                { label: "Mids (1,000 Hz)", freq: 1000, range: "ย่านกลาง พุ่ง ชัด กระป๋อง" },
                { label: "Highs (8,000 Hz)", freq: 8000, range: "ย่านแหลม สว่าง คม ซ่า" }
            ],
            intermediate: [
                { label: "Sub / Punch (80 Hz)", freq: 80, range: "ความแน่นและแรงปะทะของกระเดื่อง/เบส" },
                { label: "Mud / Boxy (350 Hz)", freq: 350, range: "ความอู้อี้ ก้องกล่องกระดาษลัง" },
                { label: "Mid / Nasal (1,000 Hz)", freq: 1000, range: "เสียงขึ้นจมูก ชัดเจนแบบโทรศัพท์" },
                { label: "Attack / Bite (3,500 Hz)", freq: 3500, range: "ความคมชัด หัวไม้ และความกัดคม" },
                { label: "Air / Shimmer (10,000 Hz)", freq: 10000, range: "ประกายความโปร่ง แฉ และลมหายใจ" }
            ],
            pro: [
                { label: "60 Hz", freq: 60, range: "Sub Bass Weight" },
                { label: "150 Hz", freq: 150, range: "Upper Bass / Snare Body" },
                { label: "400 Hz", freq: 400, range: "Low-Mid Cardboard" },
                { label: "800 Hz", freq: 800, range: "Hollow Ring" },
                { label: "1.8 kHz", freq: 1800, range: "Upper Mid Bite" },
                { label: "3.5 kHz", freq: 3500, range: "Presence & Pluck" },
                { label: "6.5 kHz", freq: 6500, range: "Sibilance & Harshness" },
                { label: "12 kHz", freq: 12000, range: "Studio Air & Sparkle" }
            ]
        };
    }

    start() {
        this.isActive = true;
        this.score = 0;
        this.streak = 0;
        this.totalQuestions = 0;
        this.nextQuestion();
    }

    stop() {
        this.isActive = false;
        // Restore normal EQ
        this.audio.resetEQ();
        if (this.onStateChange) this.onStateChange();
    }

    setDifficulty(level) {
        this.difficulty = level;
        if (this.isActive) {
            this.nextQuestion();
        }
    }

    nextQuestion() {
        // Reset all EQ bands to 0 dB first
        this.audio.resetEQ();

        const options = this.difficultyLevels[this.difficulty];
        const randomIndex = Math.floor(Math.random() * options.length);
        const selected = options[randomIndex];

        this.targetFreq = selected.freq;
        // Boost or Cut (+6dB or -6dB for intermediate, +/- 4dB for pro, +8dB for beginner)
        const gainsByLevel = {
            beginner: [8, -8],
            intermediate: [6, -6],
            pro: [4, -4, 5, -5]
        };
        const gainChoices = gainsByLevel[this.difficulty];
        this.targetGain = gainChoices[Math.floor(Math.random() * gainChoices.length)];

        // Apply mystery EQ to band 3 or 4
        this.targetBand = 3;
        this.audio.updateBand(this.targetBand, {
            type: "peaking",
            freq: this.targetFreq,
            gain: this.targetGain,
            q: this.difficulty === "pro" ? 2.5 : 1.8
        });

        this.isMysteryBypassed = false;
        if (this.onStateChange) this.onStateChange();
    }

    toggleMysteryBypass() {
        this.isMysteryBypassed = !this.isMysteryBypassed;
        if (this.isMysteryBypassed) {
            // Bypass mystery band
            this.audio.updateBand(this.targetBand, { gain: 0 });
        } else {
            // Re-apply mystery band
            this.audio.updateBand(this.targetBand, { gain: this.targetGain });
        }
        if (this.onStateChange) this.onStateChange();
    }

    checkAnswer(chosenFreq) {
        this.totalQuestions++;
        const isCorrect = (chosenFreq === this.targetFreq);
        if (isCorrect) {
            this.score += 100;
            this.streak++;
        } else {
            this.streak = 0;
        }

        const isBoost = this.targetGain > 0;
        const result = {
            isCorrect: isCorrect,
            chosenFreq: chosenFreq,
            correctFreq: this.targetFreq,
            gain: this.targetGain,
            action: isBoost ? "บูสต์ (Boost)" : "คัต (Cut)",
            score: this.score,
            streak: this.streak,
            total: this.totalQuestions
        };

        return result;
    }
}

// Export to window
if (typeof window !== "undefined") {
    window.EQQuiz = EQQuiz;
}
