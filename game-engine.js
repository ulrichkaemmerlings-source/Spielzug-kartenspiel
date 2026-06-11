// Game Engine for SPIELZUG

class SPIELZUGGame {
    constructor(mode) {
        this.mode = mode;
        this.playerScore = 0;
        this.aiScore = 0;
        this.currentHalf = 1;
        // Angriffe: abwechselnd, je 3 pro Halbzeit
        this.attacksThisHalf = { player: 0, ai: 0 };
        this.maxAttacksPerHalf = 3;

        // Draft
        this.draftPhase = true;
        // Korrekte Schlangen-Reihenfolge: A-B, B-A-A-B => player first
        this.draftOrder = ['player', 'ai', 'ai', 'player', 'player', 'ai'];
        this.draftIndex = 0;
        this.availablePlayers = this.getAllPlayers();

        this.playerTeam = null;
        this.aiTeam = null;

        this.playerCoach = getRandomCoach();
        this.aiCoach = getRandomCoach();

        this.momentumDeck = shuffleArray(buildMomentumDeck());

        // Taktik-Hände: je 5 Angriff + 5 Abwehr
        this.playerTactics = this.buildTacticHand();
        this.aiTactics = this.buildTacticHand();

        this.log = [];

        // Aktuell gewählte Karten
        this.selectedAttacker = null;
        this.selectedDefender = null;
        this.selectedAttackTactic = null;
        this.selectedDefenseTactic = null;
        this.lastWinningAttackTactic = null; // für Kopfballungeheuer

        // Erschöpfte Spieler (haben diesen Halb bereits angegriffen)
        this.playersPlayedThisHalf = new Set();
        this.aiPlayersPlayedThisHalf = new Set();

        // Trainer-Status-Flags
        this.playerCoachState = {
            taktikFuchsNoBonusNextAttack: false,
            theoretikerPeekUsedThisHalf: false,
            dinosaurierFirstAttackDone: false,
            fanatikerGoalBonusActive: false,
            floodlightPendingFor: null, // 'player' oder 'ai'
            secondBallAvailable: false,
            favoritePlayer: null, // für Präsidenten-Kumpel
        };
        this.aiCoachState = {
            taktikFuchsNoBonusNextAttack: false,
            theoretikerPeekUsedThisHalf: false,
            dinosaurierFirstAttackDone: false,
            fanatikerGoalBonusActive: false,
            floodlightPendingFor: null,
            secondBallAvailable: false,
            favoritePlayer: null,
        };
    }

    getAllPlayers() {
        const all = [];
        PLAYERS.iv.forEach((p, i) => all.push({ ...p, role: 'IV', id: `iv-${i}` }));
        PLAYERS.zm.forEach((p, i) => all.push({ ...p, role: 'ZM', id: `zm-${i}` }));
        PLAYERS.st.forEach((p, i) => all.push({ ...p, role: 'ST', id: `st-${i}` }));
        return shuffleArray(all);
    }

    buildTacticHand() {
        const hand = [];
        TACTICS.attack.forEach((t, i) => hand.push({ ...t, type: 'attack', id: `attack-${i}` }));
        TACTICS.defense.forEach((t, i) => hand.push({ ...t, type: 'defense', id: `defense-${i}` }));
        return hand;
    }

    initializeDraft() {
        this.draftIndex = 0;
        this.playerTeam = {
            tw: { name: 'Torwart', attack: 1, defense: 5, role: 'TW', id: 'tw-player' },
            iv: [], zm: null, st: []
        };
        this.aiTeam = {
            tw: { name: 'Torwart', attack: 1, defense: 5, role: 'TW', id: 'tw-ai' },
            iv: [], zm: null, st: []
        };
    }

    applyCoachPassives() {
        // Offensiv-Fanatiker: IVs dauerhaft -1 DEF
        if (COACHES[this.playerCoach].special === 'offensive_fanatic') {
            this.playerTeam.iv.forEach(iv => { iv.defense = Math.max(0, iv.defense - 1); });
        }
        if (COACHES[this.aiCoach].special === 'offensive_fanatic') {
            this.aiTeam.iv.forEach(iv => { iv.defense = Math.max(0, iv.defense - 1); });
        }

        // Präsidenten-Kumpel: Lieblingsspieler wählen (höchster ATT-Wert)
        if (COACHES[this.playerCoach].special === 'praesidenten_kumpel') {
            const allP = [...this.playerTeam.iv, this.playerTeam.zm, ...this.playerTeam.st].filter(Boolean);
            const fav = allP.reduce((a, b) => (a.attack + a.defense > b.attack + b.defense ? a : b));
            fav.attack += 2; fav.defense += 2;
            this.playerCoachState.favoritePlayer = fav.id;
            this.log.push(`⭐ Lieblingsspieler (Präsidenten-Kumpel): ${fav.name}`);
        }
        if (COACHES[this.aiCoach].special === 'praesidenten_kumpel') {
            const allA = [...this.aiTeam.iv, this.aiTeam.zm, ...this.aiTeam.st].filter(Boolean);
            const fav = allA.reduce((a, b) => (a.attack + a.defense > b.attack + b.defense ? a : b));
            fav.attack += 2; fav.defense += 2;
            this.aiCoachState.favoritePlayer = fav.id;
        }

        // Medizinball-Schleifer: 4 Angriffe pro Halbzeit statt 3
        if (COACHES[this.playerCoach].special === 'medizinball') {
            this.maxAttacksPerHalfPlayer = 4;
        } else {
            this.maxAttacksPerHalfPlayer = 3;
        }
        if (COACHES[this.aiCoach].special === 'medizinball') {
            this.maxAttacksPerHalfAI = 4;
        } else {
            this.maxAttacksPerHalfAI = 3;
        }
    }

    getDraftCurrentPlayer() {
        if (this.draftIndex >= this.draftOrder.length) return null;
        return this.draftOrder[this.draftIndex];
    }

    selectPlayerInDraft(playerIndex) {
        const player = this.availablePlayers[playerIndex];
        const currentTurn = this.getDraftCurrentPlayer();

        const assignTo = (team) => {
            if (player.role === 'IV' && team.iv.length < 2) team.iv.push(player);
            else if (player.role === 'ZM' && !team.zm) team.zm = player;
            else if (player.role === 'ST' && team.st.length < 2) team.st.push(player);
            // Fallback: passt überall rein wenn Slot frei
            else if (team.iv.length < 2) { player.role = 'IV'; team.iv.push(player); }
            else if (!team.zm) { player.role = 'ZM'; team.zm = player; }
            else if (team.st.length < 2) { player.role = 'ST'; team.st.push(player); }
        };

        if (currentTurn === 'player') assignTo(this.playerTeam);
        else if (currentTurn === 'ai') assignTo(this.aiTeam);

        this.availablePlayers.splice(playerIndex, 1);
        this.draftIndex++;
        return this.draftIndex >= this.draftOrder.length;
    }

    getMaxAttacks(isPlayer) {
        return isPlayer ? (this.maxAttacksPerHalfPlayer || 3) : (this.maxAttacksPerHalfAI || 3);
    }

    getAvailableAttackers(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        const playedSet = isPlayer ? this.playersPlayedThisHalf : this.aiPlayersPlayedThisHalf;
        const attackers = [];
        if (team.zm && !playedSet.has(team.zm.id)) attackers.push(team.zm);
        team.st.forEach(st => { if (!playedSet.has(st.id)) attackers.push(st); });
        return attackers;
    }

    getAvailableDefenders(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        return team.iv || [];
    }

    getAvailableAttackTactics(isPlayer) {
        let tactics = [...TACTICS.attack];
        const coach = isPlayer ? this.playerCoach : this.aiCoach;
        const score = isPlayer ? this.playerScore : this.aiScore;
        const oppScore = isPlayer ? this.aiScore : this.playerScore;

        // Defensiv-Guru: bei eigener Führung kein Distanzschuss/Flügelspiel
        if (COACHES[coach].special === 'defensive_guru' && score > oppScore) {
            tactics = tactics.filter(t => t.name !== 'Distanzschuss' && t.name !== 'Flügelspiel');
        }
        return tactics;
    }

    getAvailableDefenseTactics(isPlayer) {
        return [...TACTICS.defense];
    }

    // Hauptkampf-Auflösung
    resolveFieldDuel(attacker, attackTactic, defender, defenseTactic, isPlayerAttacking) {
        const attackerCoach = isPlayerAttacking ? this.playerCoach : this.aiCoach;
        const defenderCoach = isPlayerAttacking ? this.aiCoach : this.playerCoach;
        const attackerCoachState = isPlayerAttacking ? this.playerCoachState : this.aiCoachState;

        let attackValue = attacker.attack;
        let defenseValue = defender.defense;
        let bonusLog = [];

        // Taktik-Konter-Bonus (korrekte Berechnung)
        const tacticBonus = getTacticBonus(attackTactic.name, defenseTactic.name);
        let attackerGetsBonus = false;
        let defenderGetsBonus = false;

        if (tacticBonus > 0) {
            // Prüfen ob Bonus blockiert (Taktik-Fuchs nach Pressing-Niederlage)
            if (COACHES[attackerCoach].special === 'taktik_fuchs' && attackerCoachState.taktikFuchsNoBonusNextAttack) {
                bonusLog.push('⚠️ Taktik-Fuchs: Kein Bonus (Strafe aktiv)');
                attackerCoachState.taktikFuchsNoBonusNextAttack = false;
            } else {
                attackValue += 2;
                attackerGetsBonus = true;
                bonusLog.push(`🎯 Konter-Bonus: ${attacker.name} +2`);
            }
        } else if (tacticBonus < 0) {
            defenseValue += 2;
            defenderGetsBonus = true;
            bonusLog.push(`🛡️ Konter-Bonus: ${defender.name} +2`);
        }

        // Sture Dinosaurier: Kopfball-ST ignoriert negativen Taktik-Effekt
        if (defenderGetsBonus && COACHES[attackerCoach].special === 'dinosaurier'
            && attacker.special === 'header_bonus'
            && (attackTactic.name === 'Flügelspiel' || attackTactic.name === 'Steilpass')) {
            defenseValue -= 2;
            bonusLog.push(`🦕 Dinosaurier: Negativer Taktik-Effekt ignoriert`);
        }

        // Trainer-Angriffs-Boni
        if (COACHES[attackerCoach].special === 'taktik_fuchs') {
            if (attackTactic.name === 'Kurzpass' || attackTactic.name === 'Steilpass') {
                attackValue += 1;
                bonusLog.push(`🦊 Taktik-Fuchs: +1 für ${attackTactic.name}`);
            }
        }

        // Spieler-Spezialfähigkeiten Angreifer (Feldduell)
        switch (attacker.special) {
            case 'through_pass':
                if (attackTactic.name === 'Steilpass') { attackValue += 1; bonusLog.push(`⚡ ${attacker.name}: +1 (Steilpass)`); }
                break;
            case 'short_pass':
                if (attackTactic.name === 'Kurzpass') { attackValue += 1; bonusLog.push(`⚡ ${attacker.name}: +1 (Kurzpass)`); }
                break;
            case 'dribbling_bonus':
                if (attackTactic.name === 'Dribbling') { attackValue += 1; bonusLog.push(`⚡ ${attacker.name}: +1 (Dribbling)`); }
                break;
            case 'through_pass_bonus':
                if (attackTactic.name === 'Steilpass') { attackValue += 1; bonusLog.push(`⚡ ${attacker.name}: +1 (Steilpass)`); }
                break;
            case 'long_shot_bonus':
                if (attackTactic.name === 'Distanzschuss') { attackValue += 1; bonusLog.push(`⚡ ${attacker.name}: +1 (Distanzschuss)`); }
                break;
            case 'short_pass_bonus':
                if (attackTactic.name === 'Kurzpass') { attackValue += 1; bonusLog.push(`⚡ ${attacker.name}: +1 (Kurzpass)`); }
                break;
        }

        // Spieler-Spezialfähigkeiten Verteidiger (Feldduell)
        switch (defender.special) {
            case 'dribbling_counter':
                if (attackTactic.name === 'Dribbling') { defenseValue += 1; bonusLog.push(`🛡️ ${defender.name}: +1 DEF (Dribbling)`); }
                break;
            case 'offside_trap':
                if (defenseTactic.name === 'Abseitsfalle') { defenseValue += 1; bonusLog.push(`🛡️ ${defender.name}: +1 DEF (Abseitsfalle)`); }
                break;
            case 'wing_counter':
                if (attackTactic.name === 'Flügelspiel') { defenseValue += 1; bonusLog.push(`🛡️ ${defender.name}: +1 DEF (Flügelspiel)`); }
                break;
            case 'zonal_defense':
                if (defenseTactic.name === 'Raumdeckung') { defenseValue += 1; bonusLog.push(`🛡️ ${defender.name}: +1 DEF (Raumdeckung)`); }
                break;
            case 'pressing_bonus':
                if (defenseTactic.name === 'Pressing') { defenseValue += 1; bonusLog.push(`🛡️ ${defender.name}: +1 DEF (Pressing)`); }
                if (attackTactic.name === 'Steilpass') { defenseValue -= 1; bonusLog.push(`⚠️ ${defender.name}: -1 DEF (Steilpass gegen Abräumer)`); }
                break;
        }

        // Defensiv-Guru: +1 für IV bei Tief stehen / Manndeckung
        if (COACHES[defenderCoach].special === 'defensive_guru') {
            if (defenseTactic.name === 'Tief stehen' || defenseTactic.name === 'Manndeckung') {
                defenseValue += 1;
                bonusLog.push(`🧠 Defensiv-Guru: +1 DEF (${defenseTactic.name})`);
            }
        }

        // Taktik-Fuchs Nachteil: Wenn Angriff gegen Pressing verliert
        if (COACHES[attackerCoach].special === 'taktik_fuchs' && defenseTactic.name === 'Pressing') {
            // Wird nach dem Duell gesetzt wenn Angriff verliert
        }

        let isSuccess = attackValue > defenseValue;
        if (attackValue === defenseValue) {
            isSuccess = GAME_MODES[this.mode].drawRule === 'attacker';
        }

        // Taktik-Fuchs Nachteil setzen
        if (!isSuccess && COACHES[attackerCoach].special === 'taktik_fuchs' && defenseTactic.name === 'Pressing') {
            attackerCoachState.taktikFuchsNoBonusNextAttack = true;
            bonusLog.push(`🦊 Taktik-Fuchs Nachteil: Nächster Angriff ohne Bonus`);
        }

        return { attackValue, defenseValue, attackTactic: attackTactic.name, defenseTactic: defenseTactic.name,
                 tacticBonus, isSuccess, attacker, defender, bonusLog };
    }

    drawMomentumCards(count) {
        if (this.momentumDeck.length < count) {
            this.momentumDeck = shuffleArray(buildMomentumDeck());
        }
        const drawn = [];
        for (let i = 0; i < count; i++) drawn.push(this.momentumDeck.pop());
        return drawn;
    }

    // Strafraum auflösen – gibt Objekt zurück
    resolveGoalChance(isPlayerAttacking, selectedAttackerCard, selectedDefenderCard, winningTactic) {
        const attacker = this.selectedAttacker;
        const goalkeeper = isPlayerAttacking ? this.aiTeam.tw : this.playerTeam.tw;
        const attackerCoach = isPlayerAttacking ? this.playerCoach : this.aiCoach;
        const defenderCoach = isPlayerAttacking ? this.aiCoach : this.playerCoach;
        const attackerCoachState = isPlayerAttacking ? this.playerCoachState : this.aiCoachState;

        let attackerMomentum = selectedAttackerCard.value;
        let defenderMomentum = selectedDefenderCard.value;

        // Knipser: negative Momentum -> 0
        if (attacker.special === 'negative_momentum_to_zero' && attackerMomentum < 0) {
            attackerMomentum = 0;
        }

        // Medizinball-Schleifer: alle Spieler -1 im Strafraum
        if (COACHES[attackerCoach].special === 'medizinball') {
            attackerMomentum -= 1;
        }
        if (COACHES[defenderCoach].special === 'medizinball') {
            defenderMomentum -= 1;
        }

        let attackValue = attacker.attack + attackerMomentum;
        let defenseValue = goalkeeper.defense + defenderMomentum;

        // Modus C: Stürmer +1
        if (GAME_MODES[this.mode].strikerBonus && attacker.role === 'ST') {
            attackValue += GAME_MODES[this.mode].strikerBonus;
        }

        // Kopfballungeheuer: +1 im Strafraum wenn über Flügelspiel gewonnen
        if (attacker.special === 'header_bonus' && winningTactic === 'Flügelspiel') {
            attackValue += 1;
        }

        // Offensiv-Fanatiker: +1 für Stürmer nach gewonnenem Feldduell
        if (COACHES[attackerCoach].special === 'offensive_fanatic' && attackerCoachState.fanatikerGoalBonusActive) {
            attackValue += 1;
            attackerCoachState.fanatikerGoalBonusActive = false;
        }

        // Aluminium-Sonderkarte: bei Gleichstand Verteidigung gewinnt immer
        let aluminumActive = selectedAttackerCard.special === 'aluminum' || selectedDefenderCard.special === 'aluminum';

        let isGoal;
        if (attackValue > defenseValue) {
            isGoal = true;
        } else if (attackValue === defenseValue) {
            if (aluminumActive) {
                isGoal = false;
            } else {
                // Theoretiker profitiert nie von Rückstands-Regel
                const theoretiker = isPlayerAttacking
                    ? COACHES[this.playerCoach].special === 'theoretiker'
                    : COACHES[this.aiCoach].special === 'theoretiker';
                if (theoretiker) {
                    isGoal = false;
                } else {
                    isGoal = GAME_MODES[this.mode].drawRule === 'attacker';
                }
            }
        } else {
            isGoal = false;
        }

        // Tunnel/Nutmeg: Tor zählt doppelt
        let goals = isGoal ? 1 : 0;
        let nutmegActive = false;
        if (isGoal && (selectedAttackerCard.special === 'nutmeg' || selectedDefenderCard.special === 'nutmeg')) {
            goals = 2;
            nutmegActive = true;
        }

        return { attackValue, defenseValue, isGoal, goals, nutmegActive, aluminumActive,
                 attackerCard: selectedAttackerCard, defenderCard: selectedDefenderCard,
                 goalkeeper, attacker };
    }

    makeAIDecision(phase, context) {
        if (phase === 'attacker') {
            const available = this.getAvailableAttackers(false);
            return available[Math.floor(Math.random() * available.length)];
        } else if (phase === 'defender') {
            const available = this.getAvailableDefenders(false);
            return available[Math.floor(Math.random() * available.length)];
        } else if (phase === 'attackTactic') {
            const tactics = this.getAvailableAttackTactics(false);
            return tactics[Math.floor(Math.random() * tactics.length)];
        } else if (phase === 'defenseTactic') {
            const tactics = this.getAvailableDefenseTactics(false);
            return tactics[Math.floor(Math.random() * tactics.length)];
        } else if (phase === 'momentum') {
            const cards = context;
            // Präsidenten-Kumpel muss negative Karten zwingend spielen
            if (COACHES[this.aiCoach].special === 'praesidenten_kumpel') {
                const negCard = cards.find(c => c.value < 0);
                if (negCard) return cards.indexOf(negCard);
            }
            // KI wählt beste Karte
            const best = cards.reduce((a, b) => (b.value > a.value ? b : a));
            return cards.indexOf(best);
        }
        return null;
    }

    markPlayerAsUsed(player, isPlayer) {
        const set = isPlayer ? this.playersPlayedThisHalf : this.aiPlayersPlayedThisHalf;
        set.add(player.id);
    }

    reviveExhaustedPlayer(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        const playedSet = isPlayer ? this.playersPlayedThisHalf : this.aiPlayersPlayedThisHalf;
        const allOffensive = [team.zm, ...team.st].filter(Boolean);
        const exhausted = allOffensive.find(p => playedSet.has(p.id));
        if (exhausted) {
            playedSet.delete(exhausted.id);
            return exhausted;
        }
        return null;
    }

    updateAttackCount(isPlayer) {
        if (isPlayer) this.attacksThisHalf.player++;
        else this.attacksThisHalf.ai++;
    }

    isHalfOver() {
        return this.attacksThisHalf.player >= this.getMaxAttacks(true) &&
               this.attacksThisHalf.ai >= this.getMaxAttacks(false);
    }

    playerHalfDone() {
        return this.attacksThisHalf.player >= this.getMaxAttacks(true);
    }

    aiHalfDone() {
        return this.attacksThisHalf.ai >= this.getMaxAttacks(false);
    }

    startNextHalf() {
        if (this.currentHalf === 1) {
            this.currentHalf = 2;
            this.attacksThisHalf = { player: 0, ai: 0 };
            this.playersPlayedThisHalf = new Set();
            this.aiPlayersPlayedThisHalf = new Set();
            this.playerTactics = this.buildTacticHand();
            this.aiTactics = this.buildTacticHand();
            this.playerCoachState.theoretikerPeekUsedThisHalf = false;
            this.aiCoachState.theoretikerPeekUsedThisHalf = false;
            this.playerCoachState.dinosaurierFirstAttackDone = false;
            this.aiCoachState.dinosaurierFirstAttackDone = false;
            return true;
        }
        return false;
    }

    isGameOver() {
        return this.currentHalf >= 2 && this.isHalfOver();
    }

    getWinner() {
        if (this.playerScore > this.aiScore) return 'player';
        if (this.aiScore > this.playerScore) return 'ai';
        return 'draw';
    }
}
