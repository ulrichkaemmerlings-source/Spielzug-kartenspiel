// Game Engine for SPIELZUG

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
        this.gameState = 'selecting_attacker'; // selecting_attacker, selecting_defender, field_duel, goal_chance, game_over
        this.selectedAttacker = null;
        this.selectedDefender = null;
        this.selectedAttackTactic = null;
        this.selectedDefenseTactic = null;
        this.isPlayerTurn = true;
    }
    
    draftTeam() {
        const team = {
            tw: null, // Torwart
            iv: [], // 2 Innenverteidiger
            zm: null, // 1 Zentrales Mittelfeld
            st: [] // 2 Stürmer
        };
        
        // Draft: 1 TW, 2 IV, 1 ZM, 2 ST
        team.tw = { ...PLAYERS.iv[0], role: 'TW', tired: false }; // Placeholder Torwart
        
        const ivPool = shuffleArray(PLAYERS.iv);
        team.iv = [
            { ...ivPool[0], role: 'IV', tired: false },
            { ...ivPool[1], role: 'IV', tired: false }
        ];
        
        const zmPool = shuffleArray(PLAYERS.zm);
        team.zm = { ...zmPool[0], role: 'ZM', tired: false, attacksUsed: 0 };
        
        const stPool = shuffleArray(PLAYERS.st);
        team.st = [
            { ...stPool[0], role: 'ST', tired: false, attacksUsed: 0 },
            { ...stPool[1], role: 'ST', tired: false, attacksUsed: 0 }
        ];
        
        return team;
    }
    
    initializeTactics() {
        const tactics = [];
        for (let i = 0; i < 5; i++) {
            tactics.push({
                ...TACTICS.attack[i],
                type: 'attack'
            });
            tactics.push({
                ...TACTICS.defense[i],
                type: 'defense'
            });
        }
        return tactics;
    }
    
    // Get available attackers
    getAvailableAttackers(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        const attackers = [];
        
        // ZM can attack once per half
        if (team.zm.attacksUsed < 1 && !team.zm.tired) {
            attackers.push(team.zm);
        }
        
        // ST can attack once per half each
        team.st.forEach(st => {
            if (st.attacksUsed < 1 && !st.tired) {
                attackers.push(st);
            }
        });
        
        return attackers;
    }
    
    // Get available defenders (IV)
    getAvailableDefenders(isPlayer) {
        const team = isPlayer ? this.playerTeam : this.aiTeam;
        return team.iv.filter(iv => !iv.tired);
    }
    
    // Get available tactic cards for attacker
    getAvailableAttackTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'attack');
    }
    
    // Get available tactic cards for defender
    getAvailableDefenseTactics(isPlayer) {
        const tactics = isPlayer ? this.playerTactics : this.aiTactics;
        return tactics.filter(t => t.type === 'defense');
    }
    
    // Resolve field duel
    resolveFieldDuel(attacker, attackTactic, defender, defenseTactic) {
        let attackValue = attacker.attack;
        let defenseValue = defender.defense;
        
        // Apply tactic bonus (Konter-Bonus)
        const bonus = getTacticBonus(attackTactic.name, defenseTactic.name);
        if (bonus > 0) {
            attackValue += bonus;
        } else if (bonus < 0) {
            defenseValue -= bonus;
        }
        
        // Check for player special abilities
        const defenderSpecial = defender.special;
        if (defenderSpecial === 'dribbling_counter' && attackTactic.name === 'Dribbling') {
            defenseValue += 1;
        }
        
        // Determine result
        let isSuccess = false;
        if (attackValue > defenseValue) {
            isSuccess = true;
        } else if (attackValue === defenseValue) {
            // Check mode draw rule
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
    
    // Resolve goal chance (Strafraum-Drama)
    resolveGoalChance(isPlayerAttacking) {
        const deck = this.momentumDeck;
        
        if (deck.length < 2) {
            this.momentumDeck = shuffleArray(buildMomentumDeck());
        }
        
        // Draw 2 momentum cards for each player
        const playerCards = [deck.pop(), deck.pop()];
        const aiCards = [deck.pop(), deck.pop()];
        
        return {
            playerCards,
            aiCards,
            playerChoice: null,
            aiChoice: null
        };
    }
    
    // AI decision making
    makeAIDecision(phase) {
        if (phase === 'attacker') {
            const availableAttackers = this.getAvailableAttackers(false);
            return availableAttackers[Math.floor(Math.random() * availableAttackers.length)];
        } else if (phase === 'defender') {
            const availableDefenders = this.getAvailableDefenders(false);
            return availableDefenders[Math.floor(Math.random() * availableDefenders.length)];
        } else if (phase === 'attackTactic') {
            const tactics = this.getAvailableAttackTactics(false);
            return tactics[Math.floor(Math.random() * tactics.length)];
        } else if (phase === 'defenseTactic') {
            const tactics = this.getAvailableDefenseTactics(false);
            return tactics[Math.floor(Math.random() * tactics.length)];
        }
        return null;
    }
    
    // End turn (mark players as tired, update attack count)
    endTurn(attacker, isPlayerAttacking) {
        attacker.tired = true;
        attacker.attacksUsed = (attacker.attacksUsed || 0) + 1;
        
        if (isPlayerAttacking) {
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
    
    // Reset for next half
    startNextHalf() {
        if (this.currentHalf === 1) {
            this.currentHalf = 2;
            this.attacksThisHalf = { player: 0, ai: 0 };
            
            // Reset tired status
            [this.playerTeam, this.aiTeam].forEach(team => {
                team.tw.tired = false;
                team.iv.forEach(iv => iv.tired = false);
                team.zm.tired = false;
                team.zm.attacksUsed = 0;
                team.st.forEach(st => {
                    st.tired = false;
                    st.attacksUsed = 0;
                });
            });
            
            // Restore tactic cards
            this.playerTactics = this.initializeTactics();
            this.aiTactics = this.initializeTactics();
            
            return true;
        }
        return false;
    }
    
    // Check if game is over
    isGameOver() {
        return this.currentHalf > 1 && this.isHalfOver();
    }
    
    // Get game winner
    getWinner() {
        if (this.playerScore > this.aiScore) return 'player';
        if (this.aiScore > this.playerScore) return 'ai';
        return 'draw';
    }
}
