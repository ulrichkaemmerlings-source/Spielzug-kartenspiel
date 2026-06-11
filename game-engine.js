// Game Engine for SPIELZUG - COMPLETE REWRITE

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
        this.draftOrder = []; // 'ai', 'player', 'player', 'ai', 'ai', 'player'
        this.draftIndex = 0;
        this.availablePlayers = this.getAllPlayers();
        
        // Teams after draft
        this.playerTeam = null;
        this.aiTeam = null;
        
        // Coaches
        this.playerCoach = getRandomCoach();
        this.aiCoach = getRandomCoach();
        
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
        
        // Track who has played
        this.playersPlayedThisHalf = new Set();
        this.aiPlayersPlayedThisHalf = new Set();
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
        // Snake draft: AI, Player, Player, AI, AI, Player
        this.draftOrder = ['ai', 'player', 'player', 'ai', 'ai', 'player'];
        this.draftIndex = 0;
        this.playerTeam = { tw: null, iv: [], zm: null, st: [] };
        this.aiTeam = { tw: null, iv: [], zm: null, st: [] };
        // Torwarte werden automatisch vergeben
        this.playerTeam.tw = { name: 'Keeper', attack: 1, defense: 5, role: 'TW', id: 'tw-player' };
        this.aiTeam.tw = { name: 'Keeper', attack: 1, defense: 5, role: 'TW', id: 'tw-ai' };
    }
    
    getDraftCurrentPlayer() {
        if (this.draftIndex >= this.draftOrder.length) return null;
        return this.draftOrder[this.draftIndex];
    }
    
    selectPlayerInDraft(playerIndex) {
        const player = this.availablePlayers[playerIndex];
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
        
        // Remove from available
        this.availablePlayers.splice(playerIndex, 1);
        this.draftIndex++;
        
        return this.draftIndex >= this.draftOrder.length;
    }
    
    getAvailableAttackers(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        const playedSet = isPlayer ? this.playersPlayedThisHalf : this.aiPlayersPlayedThisHalf;
        const attackers = [];
        
        if (team.zm && !playedSet.has(team.zm.id)) {
            attackers.push(team.zm);
        }
        
        if (team.st) {
            team.st.forEach(st => {
                if (!playedSet.has(st.id)) {
                    attackers.push(st);
                }
            });
        }
        
        return attackers;
    }
    
    getAvailableDefenders(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        return team.iv || [];
    }
    
    getAvailableAttackTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'attack');
    }
    
    getAvailableDefenseTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'defense');
    }
    
    resolveFieldDuel(attacker, attackTactic, defender, defenseTactic) {
        let attackValue = attacker.attack;
        let defenseValue = defender.defense;
        
        const bonus = getTacticBonus(attackTactic.name, defenseTactic.name);
        if (bonus > 0) {
            attackValue += bonus;
        } else if (bonus < 0) {
            defenseValue -= bonus;
        }
        
        let isSuccess = false;
        if (attackValue > defenseValue) {
            isSuccess = true;
        } else if (attackValue === defenseValue) {
            if (GAME_MODES[this.mode].drawRule === 'defense') {
                isSuccess = false;
            } else {
                isSuccess = true;
            }
        }
        
        return {
            attackValue,
            defenseValue,
            attackTactic: attackTactic.name,
            defenseTactic: defenseTactic.name,
            bonus,
            isSuccess,
            attacker,
            defender
        };
    }
    
    resolveGoalChance() {
        const deck = this.momentumDeck;
        
        if (deck.length < 4) {
            this.momentumDeck = shuffleArray(buildMomentumDeck());
        }
        
        return {
            playerCards: [deck.pop(), deck.pop()],
            aiCards: [deck.pop(), deck.pop()]
        };
    }
    
    makeAIDecision(phase) {
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
        }
        return null;
    }
    
    markPlayerAsUsed(player, isPlayer) {
        if (isPlayer) {
            this.playersPlayedThisHalf.add(player.id);
        } else {
            this.aiPlayersPlayedThisHalf.add(player.id);
        }
    }
    
    updateAttackCount(isPlayer) {
        if (isPlayer) {
            this.attacksThisHalf.player++;
        } else {
            this.attacksThisHalf.ai++;
        }
    }
    
    isHalfOver() {
        return this.attacksThisHalf.player >= this.maxAttacksPerHalf && 
               this.attacksThisHalf.ai >= this.maxAttacksPerHalf;
    }
    
    startNextHalf() {
        if (this.currentHalf === 1) {
            this.currentHalf = 2;
            this.attacksThisHalf = { player: 0, ai: 0 };
            this.playersPlayedThisHalf = new Set();
            this.aiPlayersPlayedThisHalf = new Set();
            
            this.playerTactics = this.initializeTactics();
            this.aiTactics = this.initializeTactics();
            
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
