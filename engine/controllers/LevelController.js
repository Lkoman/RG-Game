

export let gameOver; 
export let playerWin; 

export class LevelController {
    constructor() {
        this.possibilities = Array(9).fill(0);
        this.minmaxPossibilities= Array(9).fill(0)
        this.initHandler();
    }

    initHandler() {
        this.gameOver=false;
        this.playerWin = false;
        for (let i = 0; i < 9; i++) {
            this.possibilities[i] = 0;
        }
    }

    computerMove() {
        let move;

        if(Math.random() > 0.5){
            move = this.random();
        } else{
            
            move = this.bestMove();
        }
        console.log(move);
    
        this.possibilities[move] = -1;

        this.checkForWinner(-1);
    }

    checkForWinner(player) {
        // Check for winner or tie
        const winCombo = this.checkWin(player);
        if (winCombo) {
            if (player == -1) {
                console.log("Computer wins");
                this.gameOver = true;
                console.log(this.gameOver)
            } else {
                console.log("Player wins");
                this.playerWin = true;
            }
        } 
        // check if every cell in possibilities is not 0
        else if (this.possibilities.forEach((i) => this.possibilities[i] != 0)) {
            console.log("It's a tie!");
            console.log(this.possibilities);
            gameOver = true;
        }
    }

    // Check if there's a winning combination
    checkWin(player) {
        const wins = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8], // Rows
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8], // Columns
            [0, 4, 8],
            [2, 4, 6], // Diagonals
        ];
        return wins.find((combo) =>
            combo.every((i) => this.possibilities[i] === player)
        );
    }

    random() {
        console.log("playing random")
        let move = -1;
        while(move<0){
            let ind = Math.floor(Math.random() * 9);
            if(this.possibilities[ind] == 0){
                move = ind;
            }
        }
        return move;
    }

    minimax(depth, isMaximizing) {
        const scores = {
            '-1': 10, // Computer wins
            '1': -10, // Player wins
            'tie': 0
        };

        const winner = this.checkWin(-1) ? -1 : this.checkWin(1) ? 1 : null;
        if (winner !== null) {
            return scores[winner];
        }
        if (this.minmaxPossibilities.every((i) => i != 0)) {
            return scores['tie'];
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (this.possibilities[i] == 0) {
                    this.minmaxPossibilities[i] = -1;
                    let score = this.minimax(depth + 1, false);
                    this.minmaxPossibilities[i] = 0;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (this.possibilities[i] == 0) {
                    this.minmaxPossibilities[i] = 1;
                    let score = this.minimax(depth + 1, true);
                    this.minmaxPossibilities[i] = 0;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    bestMove() {
        console.log("playing minmax")
        let bestScore = -Infinity;
        this.minmaxPossibilities = this.possibilities;
        let move;
        for (let i = 0; i < 9; i++) {
            if (this.possibilities[i] == 0) {
                this.minmaxPossibilities[i] = -1;
                let score = this.minimax(0, false);
                this.minmaxPossibilities[i] = 0;
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    }

}