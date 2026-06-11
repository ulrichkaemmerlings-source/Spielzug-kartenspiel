// Game Engine for SPIELZUG - FIXED VERSION

class SPIELZUGGame {
    constructor(mode) {
        this.mode = mode;
        this.playerScore = 0;
        this.aiScore = 0;
        this.currentHalf = 1;
        this.attacksThisHalf = { player: 0, ai: 0 };
        this.maxAttacksPerHalf = 3;
        
        // Draft teams
        this.playerTeam = this.draftTeam();
        this.aiTeam = this.draftTeam();
        
        // Select coaches
        this.playerCoach = getRandomCoach();
        this.aiCoach = getRandomCoach();
        
        // Initialize momentum deck
        this.momentumDeck = shuffleArray(buildMomentumDeck());
        
        // Tactic hands (5 attack, 5 defense)
        this.playerTactics = this.initializeTactics();
        this.aiTactics = this.initializeTactics();
        
        // Game log
        this.log = [];
        
        // Game state
        this.gameState = 'selecting_attacker';
        this.selectedAttacker = null;
        this.selectedDefender = null;
        this.selectedAttackTactic = null;
        this.selectedDefenseTactic = null;
        this.isPlayerTurn = true;
        
        // Track who has played this half
        this.playersPlayedThisHalf = new Set();
        this.aiPlayersPlayedThisHalf = new Set();
    }
    
    draftTeam() {
        const team = {
            tw: null,
            iv: [],
            zm: null,
            st: []
        };
        
        // Torwart (placeholder)
        team.tw = { name: 'Keeper', attack: 1, defense: 5, role: 'TW', id: 'tw-1' };
        
        // 2 Innenverteidiger
        const ivPool = shuffleArray(PLAYERS.iv);
        team.iv = [
            { ...ivPool[0], role: 'IV', id: 'iv-1' },
            { ...ivPool[1], role: 'IV', id: 'iv-2' }
        ];
        
        // 1 Zentrales Mittelfeld
        const zmPool = shuffleArray(PLAYERS.zm);
        team.zm = { ...zmPool[0], role: 'ZM', id: 'zm-1' };
        
        // 2 Stürmer
        const stPool = shuffleArray(PLAYERS.st);
        team.st = [
            { ...stPool[0], role: 'ST', id: 'st-1' },
            { ...stPool[1], role: 'ST', id: 'st-2' }
        ];
        
        return team;
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
    
    // Get available attackers (ZM und ST die noch nicht gespielt haben)
    getAvailableAttackers(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        const playedSet = isPlayer ? this.playersPlayedThisHalf : this.aiPlayersPlayedThisHalf;
        const attackers = [];
        
        if (!playedSet.has(team.zm.id)) {
            attackers.push(team.zm);
        }
        
        team.st.forEach(st => {
            if (!playedSet.has(st.id)) {
                attackers.push(st);
            }
        });
        
        return attackers;
    }
    
    // Get available defenders (IV)
    getAvailableDefenders(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        return team.iv;
    }
    
    // Get available tactic cards
    getAvailableAttackTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'attack');
    }
    
    getAvailableDefenseTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'defense');
    }
    
    // Resolve field duel
    resolveFieldDuel(attacker, attackTactic, defender, defenseTactic) {
        let attackValue = attacker.attack;
        let defenseValue = defender.defense;
        
        // Apply tactic bonus
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
            isSuccess,
            attacker,
            defender
        };
    }
    
    // Resolve goal chance
    resolveGoalChance() {
        const deck = this.momentumDeck;
        
        if (deck.length < 4) {
            this.momentumDeck = shuffleArray(buildMomentumDeck());
        }
        
        const playerCard1 = deck.pop();
        const playerCard2 = deck.pop();
        const aiCard1 = deck.pop();
        const aiCard2 = deck.pop();
        
        return {
            playerCards: [playerCard1, playerCard2],
            aiCards: [aiCard1, aiCard2]
        };
    }
    
    // AI decision
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
    
    // Mark player as used this half
    markPlayerAsUsed(player, isPlayer) {
        if (isPlayer) {
            this.playersPlayedThisHalf.add(player.id);
        } else {
            this.aiPlayersPlayedThisHalf.add(player.id);
        }
    }
    
    // Update attack count
    updateAttackCount(isPlayer) {
        if (isPlayer) {
            this.attacksThisHalf.player++;
        } else {
            this.attacksThisHalf.ai++;
        }
    }
    
    // Check if half is over
    isHalfOver() {
        return this.attacksThisHalf.player >= this.maxAttacksPerHalf && 
               this.attacksThisHalf.ai >= this.maxAttacksPerHalf;
    }
    
    // Start next half
    startNextHalf() {
        if (this.currentHalf === 1) {
            this.currentHalf = 2;
            this.attacksThisHalf = { player: 0, ai: 0 };
            this.playersPlayedThisHalf = new Set();
            this.aiPlayersPlayedThisHalf = new Set();
            
            // Restore tactic cards
            this.playerTactics = this.initializeTactics();
            this.aiTactics = this.initializeTactics();
            
            return true;
        }
        return false;
    }
    
    // Check game over
    isGameOver() {
        return this.currentHalf > 1 && this.isHalfOver();
    }
    
    // Get winner
    getWinner() {
        if (this.playerScore > this.aiScore) return 'player';
        if (this.aiScore > this.playerScore) return 'ai';
        return 'draw';
    }
}
