// Game Engine for SPIELZUG - COMPLETE IMPLEMENTATION

class SPIELZUGGame {
    constructor(mode) {
        this.mode = mode;
        this.playerScore = 0;
        this.aiScore = 0;
        this.currentHalf = 1;
        this.attacksThisHalf = { player: 0, ai: 0 };
        this.maxAttacksPerHalf = 3;
        
        // Draft phase
        this.draftPhase = true;
        this.draftOrder = ['player', 'ai', 'ai', 'player', 'player', 'ai']; // FIXED: Correct snake draft
        this.draftIndex = 0;
        this.availablePlayers = this.getAllPlayers();
        
        // Teams after draft
        this.playerTeam = null;
        this.aiTeam = null;
        
        // Coaches
        this.playerCoach = getRandomCoach();
        this.aiCoach = getRandomCoach();
        this.playerCoachState = {}; // Track coach-specific states
        this.aiCoachState = {};
        
        // Initialize momentum deck
        this.momentumDeck = shuffleArray(buildMomentumDeck());
        
        // Tactic hands
        this.playerTactics = this.initializeTactics();
        this.aiTactics = this.initializeTactics();
        
        // Game log
        this.log = [];
        
        // Current state
        this.selectedAttacker = null;
        this.selectedDefender = null;
        this.selectedAttackTactic = null;
        this.selectedDefenseTactic = null;
        this.lastAttackTactic = null; // For special abilities like header_bonus
        
        // Attack order - should alternate
        this.attackOrder = []; // Will be filled with 'player' and 'ai' alternating
        this.currentAttackIndex = 0;
        this.playerAttackSequence = [];
        this.aiAttackSequence = [];
    }
    
    getAllPlayers() {
        const all = [];
        PLAYERS.iv.forEach((p, i) => all.push({ ...p, role: 'IV', id: `iv-${i}` }));
        PLAYERS.zm.forEach((p, i) => all.push({ ...p, role: 'ZM', id: `zm-${i}` }));
        PLAYERS.st.forEach((p, i) => all.push({ ...p, role: 'ST', id: `st-${i}` }));
        return shuffleArray(all);
    }
    
    initializeTactics() {
        const tactics = [];
        for (let i = 0; i < 5; i++) {
            tactics.push({
                ...TACTICS.attack[i],
                type: 'attack',
                id: `attack-${i}`
            });
            tactics.push({
                ...TACTICS.defense[i],
                type: 'defense',
                id: `defense-${i}`
            });
        }
        return shuffleArray(tactics);
    }
    
    initializeDraft() {
        this.draftIndex = 0;
        this.playerTeam = { tw: null, iv: [], zm: null, st: [] };
        this.aiTeam = { tw: null, iv: [], zm: null, st: [] };
        this.playerTeam.tw = { name: 'Keeper', attack: 1, defense: 5, role: 'TW', id: 'tw-player', special: null };
        this.aiTeam.tw = { name: 'Keeper', attack: 1, defense: 5, role: 'TW', id: 'tw-ai', special: null };
    }
    
    getDraftCurrentPlayer() {
        if (this.draftIndex >= this.draftOrder.length) return null;
        return this.draftOrder[this.draftIndex];
    }
    
    selectPlayerInDraft(playerIndex) {
        const player = JSON.parse(JSON.stringify(this.availablePlayers[playerIndex]));
        const currentTurn = this.getDraftCurrentPlayer();
        
        if (currentTurn === 'player') {
            if (this.playerTeam.iv.length < 2) {
                this.playerTeam.iv.push(player);
            } else if (!this.playerTeam.zm) {
                this.playerTeam.zm = player;
            } else if (this.playerTeam.st.length < 2) {
                this.playerTeam.st.push(player);
            }
        } else if (currentTurn === 'ai') {
            if (this.aiTeam.iv.length < 2) {
                this.aiTeam.iv.push(player);
            } else if (!this.aiTeam.zm) {
                this.aiTeam.zm = player;
            } else if (this.aiTeam.st.length < 2) {
                this.aiTeam.st.push(player);
            }
        }
        
        this.availablePlayers.splice(playerIndex, 1);
        this.draftIndex++;
        
        // Apply coach effects to team when draft is complete
        if (this.draftIndex >= this.draftOrder.length) {
            this.applyCoachEffects();
            this.initializeAttackOrder();
        }
        
        return this.draftIndex >= this.draftOrder.length;
    }
    
    applyCoachEffects() {
        // Offensiv-Fanatiker: IVs have -1 defense
        if (this.playerCoach === 'Der Offensiv-Fanatiker') {
            this.playerTeam.iv.forEach(iv => iv.defense -= 1);
        }
        if (this.aiCoach === 'Der Offensiv-Fanatiker') {
            this.aiTeam.iv.forEach(iv => iv.defense -= 1);
        }
        
        // Präsidenten-Kumpel: Choose favorite player with +2 to all
        if (this.playerCoach === 'Der Präsidenten-Kumpel') {
            const allPlayers = [...this.playerTeam.iv, this.playerTeam.zm, ...this.playerTeam.st];
            const favorite = allPlayers[Math.floor(Math.random() * allPlayers.length)];
            favorite.attack += 2;
            favorite.defense += 2;
            this.playerCoachState.favoriteId = favorite.id;
        }
        if (this.aiCoach === 'Der Präsidenten-Kumpel') {
            const allPlayers = [...this.aiTeam.iv, this.aiTeam.zm, ...this.aiTeam.st];
            const favorite = allPlayers[Math.floor(Math.random() * allPlayers.length)];
            favorite.attack += 2;
            favorite.defense += 2;
            this.aiCoachState.favoriteId = favorite.id;
        }
    }
    
    initializeAttackOrder() {
        // Create attack sequence: player, ai, player, ai, player, ai
        this.attackOrder = [];
        for (let i = 0; i < 3; i++) {
            this.attackOrder.push('player');
            this.attackOrder.push('ai');
        }
        this.currentAttackIndex = 0;
        
        // Shuffle attack order for each player (3 attacks per player)
        this.playerAttackSequence = [
            this.playerTeam.zm,
            this.playerTeam.st[0],
            this.playerTeam.st[1]
        ];
        this.aiAttackSequence = [
            this.aiTeam.zm,
            this.aiTeam.st[0],
            this.aiTeam.st[1]
        ];
    }
    
    getNextAttacker() {
        if (this.currentAttackIndex >= this.attackOrder.length) return null;
        const side = this.attackOrder[this.currentAttackIndex];
        
        if (side === 'player') {
            return this.playerAttackSequence[this.attacksThisHalf.player];
        } else {
            return this.aiAttackSequence[this.attacksThisHalf.ai];
        }
    }
    
    getAvailableDefenders(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        return team.iv || [];
    }
    
    getAvailableAttackTactics(isPlayer) {
        let tactics = isPlayer ? this.playerTactics : this.aiTactics;
        tactics = tactics.filter(t => t.type === 'attack');
        
        // Defensiv-Guru: Cannot use Distanzschuss & Flügelspiel if winning
        const coach = isPlayer ? this.playerCoach : this.aiCoach;
        const score = isPlayer ? [this.playerScore, this.aiScore] : [this.aiScore, this.playerScore];
        
        if (coach === 'Der Defensiv-Guru' && score[0] > score[1]) {
            tactics = tactics.filter(t => t.name !== 'Distanzschuss' && t.name !== 'Flügelspiel');
        }
        
        return tactics;
    }
    
    getAvailableDefenseTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'defense');
    }
    
    resolveFieldDuel(attacker, attackTactic, defender, defenseTactic) {
        let attackValue = attacker.attack;
        let defenseValue = defender.defense;
        let bonusBreakdown = { attack: 0, defense: 0 };
        
        // Base tactic bonus
        const tacticBonus = getTacticBonus(attackTactic.name, defenseTactic.name);
        
        if (tacticBonus > 0) {
            attackValue += tacticBonus;
            bonusBreakdown.attack += tacticBonus;
        } else if (tacticBonus < 0) {
            defenseValue += 2; // Defender gets +2 (fixed double negative)
            bonusBreakdown.defense += 2;
        }
        
        // Apply player special abilities
        // Defender specials
        if (defender.special === 'dribbling_counter' && attackTactic.name === 'Dribbling') {
            defenseValue += 1;
            bonusBreakdown.defense += 1;
        }
        if (defender.special === 'offside_trap' && defenseTactic.name === 'Abseitsfalle') {
            defenseValue += 1;
            bonusBreakdown.defense += 1;
        }
        if (defender.special === 'wing_counter' && attackTactic.name === 'Flügelspiel') {
            defenseValue += 1;
            bonusBreakdown.defense += 1;
        }
        if (defender.special === 'zonal_defense' && defenseTactic.name === 'Raumdeckung') {
            defenseValue += 1;
            bonusBreakdown.defense += 1;
        }
        if (defender.special === 'pressing_bonus') {
            if (defenseTactic.name === 'Pressing') {
                defenseValue += 1;
                bonusBreakdown.defense += 1;
            }
            // But -1 if attacker plays Steilpass
            if (attackTactic.name === 'Steilpass') {
                defenseValue -= 1;
                bonusBreakdown.defense -= 1;
            }
        }
        
        // Attacker specials
        if (attacker.special === 'through_pass' && attackTactic.name === 'Steilpass') {
            attackValue += 1;
            bonusBreakdown.attack += 1;
        }
        if (attacker.special === 'short_pass' && attackTactic.name === 'Kurzpass') {
            attackValue += 1;
            bonusBreakdown.attack += 1;
        }
        if (attacker.special === 'dribbling' && attackTactic.name === 'Dribbling') {
            attackValue += 1;
            bonusBreakdown.attack += 1;
        }
        if (attacker.special === 'through_pass_bonus' && attackTactic.name === 'Steilpass') {
            attackValue += 1;
            bonusBreakdown.attack += 1;
        }
        if (attacker.special === 'long_shot_bonus' && attackTactic.name === 'Distanzschuss') {
            attackValue += 1;
            bonusBreakdown.attack += 1;
        }
        if (attacker.special === 'short_pass_bonus' && attackTactic.name === 'Kurzpass') {
            attackValue += 1;
            bonusBreakdown.attack += 1;
        }
        
        // Trainer effects for Taktik-Fuchs
        const attackerIsPlayer = attacker.id.startsWith('st-') || attacker.id.startsWith('zm-');
        const coach = attackerIsPlayer ? this.playerCoach : this.aiCoach;
        const coachState = attackerIsPlayer ? this.playerCoachState : this.aiCoachState;
        
        if (coach === 'Der Taktik-Fuchs' && !coachState.tacticBonusBlocked) {
            if (attackTactic.name === 'Kurzpass' || attackTactic.name === 'Steilpass') {
                attackValue += 1;
                bonusBreakdown.attack += 1;
            }
        }
        
        // Defensiv-Guru for defenders
        if (coach === 'Der Defensiv-Guru') {
            if (defenseTactic.name === 'Tief stehen' || defenseTactic.name === 'Manndeckung') {
                defenseValue += 1;
                bonusBreakdown.defense += 1;
            }
        }
        
        let isSuccess = false;
        if (attackValue > defenseValue) {
            isSuccess = true;
        } else if (attackValue === defenseValue) {
            // Reiner Theoretiker doesn't benefit from draw rule
            if (coach === 'Der Reiner Theoretiker') {
                isSuccess = false;
            } else if (GAME_MODES[this.mode].drawRule === 'defense') {
                isSuccess = false;
            } else {
                isSuccess = true;
            }
        }
        
        // Check if Taktik-Fuchs lost against Pressing
        if (!isSuccess && attackTactic.name !== 'Pressing' && defenseTactic.name === 'Pressing' && coach === 'Der Taktik-Fuchs') {
            coachState.tacticBonusBlocked = true;
        }
        
        return {
            attackValue,
            defenseValue,
            attackTactic: attackTactic.name,
            defenseTactic: defenseTactic.name,
            tacticBonus,
            bonusBreakdown,
            isSuccess,
            attacker,
            defender
        };
    }
    
    resolveGoalChance(isPlayer) {
        const deck = this.momentumDeck;
        
        if (deck.length < 4) {
            this.momentumDeck = shuffleArray(buildMomentumDeck());
        }
        
        let playerCards = [deck.pop(), deck.pop()];
        let aiCards = [deck.pop(), deck.pop()];
        
        // Mentalitäts-Monster: 3 cards if losing in goal chance
        const attacker = isPlayer ? this.selectedAttacker : this.selectedAttacker;
        const coach = isPlayer ? this.playerCoach : this.aiCoach;
        const myScore = isPlayer ? this.playerScore : this.aiScore;
        const oppScore = isPlayer ? this.aiScore : this.playerScore;
        
        if (coach === 'Das Mentalitäts-Monster' && myScore < oppScore) {
            if (isPlayer) {
                playerCards.push(deck.pop());
            } else {
                aiCards.push(deck.pop());
            }
        }
        
        return {
            playerCards,
            aiCards
        };
    }
    
    makeAIDecision(phase) {
        if (phase === 'defender') {
            const available = this.getAvailableDefenders(false);
            return available[Math.floor(Math.random() * available.length)];
        } else if (phase === 'attackTactic') {
            const tactics = this.getAvailableAttackTactics(false);
            return tactics[Math.floor(Math.random() * tactics.length)];
        } else if (phase === 'defenseTactic') {
            const tactics = this.getAvailableDefenseTactics(false);
            return tactics[Math.floor(Math.random() * tactics.length)];
        }
        return null;
    }
    
    updateAttackCount(isPlayer) {
        if (isPlayer) {
            this.attacksThisHalf.player++;
        } else {
            this.attacksThisHalf.ai++;
        }
        this.currentAttackIndex++;
    }
    
    isHalfOver() {
        return this.attacksThisHalf.player >= this.maxAttacksPerHalf && 
               this.attacksThisHalf.ai >= this.maxAttacksPerHalf;
    }
    
    startNextHalf() {
        if (this.currentHalf === 1) {
            this.currentHalf = 2;
            this.attacksThisHalf = { player: 0, ai: 0 };
            this.currentAttackIndex = 0;
            
            this.playerTactics = this.initializeTactics();
            this.aiTactics = this.initializeTactics();
            
            // Reset coach states for new half
            this.playerCoachState.tacticBonusBlocked = false;
            this.aiCoachState.tacticBonusBlocked = false;
            
            return true;
        }
        return false;
    }
    
    isGameOver() {
        return this.currentHalf > 1 && this.isHalfOver();
    }
    
    getWinner() {
        if (this.playerScore > this.aiScore) return 'player';
        if (this.aiScore > this.playerScore) return 'ai';
        return 'draw';
    }
}
