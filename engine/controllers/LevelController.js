export let gameOver = false;
export let playerWin = false;

export class LevelController {
    constructor() {
        this.possibilities = Array(9).fill(0);

        this.initHandler();
    }

    initHandler() {
        for (let i = 0; i < 9; i++) {
            this.possibilities[i] = 0;
        }
    }

    computerMove() {
        let move;

        if(Math.random() > 0.5){
            move = this.random();
        } else{
            move = this.minimax();
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
                gameOver = true;
            } else {
                console.log("Player wins");
                playerWin = true;
            }
            this.gameOver = true;
        } 
        // check if every cell in possibilities is not 0
        else if (this.possibilities.forEach((i) => this.possibilities[i] != 0)) {
            console.log("It's a tie!");
            console.log(this.possibilities);
            this.gameOver = true;
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
        let move = -1;
        while(move<0){
            let ind = Math.floor(Math.random() * 9);
            if(this.possibilities[ind] == 0){
                move = ind;
            }
        }
        return move;
    }

    minimax() {
        let move = this.random();
        return move;
    }
}