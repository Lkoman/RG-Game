const TicTac = {
    player: "X", //jaz sem  X
    copmuter: "O", //računalnik je O
    state: Array(9).fill(null), // plošča
    gameOver: false, 
    possibilities: Array(9), //možnosti
    cPlayer: "X", // trenutni igralec

    //reset plošče
    init() {
        this.board();
        document
            .getElementById("reset")
            .addEventListener("click", () => this.reset());
    },

    // Create the game board dynamically
    board() {
        for (let i = 0; i < 9; i++) {
            this.possibilities[i] = i;
        }
        const board = document.getElementById("board");
        board.innerHTML = ""; //kar je prej pisalo na plošči bo pobrisano
        this.state.forEach((_, i) => {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.index = i;
            board.appendChild(cell);
        });
        board.addEventListener("click", (e) => this.handleClick(e)); // Handle clicks on the board
        this.uMessage(`Player ${this.cPlayer}'s turn`);
    },

    // Handle a cell click
    handleClick(e) {
        const cell = e.target;
        const i = cell.dataset.index;

        // Ignore clicks if game is over or cell is taken
        if (this.gameOver || !cell.classList.contains("cell") || this.state[i])
            return;

        // Update board state and UI
        this.state[i] = this.cPlayer;
        this.possibilities[i] = -1;
        cell.textContent = this.cPlayer;
        cell.classList.add("taken");

        // Check for winner or tie
        const winCombo = this.checkWin();
        if (winCombo) {
            this.highlight(winCombo);
            this.uMessage(`Player ${this.cPlayer} wins!`);
            this.gameOver = true;
        } else if (this.state.every((cell) => cell)) {
            this.uMessage("It's a tie!");
            this.gameOver = true;
        } else {
            // Switch players
            this.cPlayer = this.copmuter;
            this.uMessage(`Player ${this.cPlayer}'s turn`);
            if (this.cPlayer === "O" && !this.gameOver) {
                setTimeout(() => this.computerMove(), 500); // Small delay for computer's move
            }
    
        }
        console.log(this.possibilities);

    },

    computerMove(){
        let move;

        if(Math.random() > 0.5){
            move = this.random();
        } else{
            move = this.minimax();
        }
        console.log(move);

        this.state[move] = this.cPlayer;
        this.possibilities[move] = -1;

        document.getElementById("board").children[move].classList.add("taken");
        document.getElementById("board").children[move].textContent = this.cPlayer;

        // Check for winner or tie
        const winCombo = this.checkWin();
        if (winCombo) {
            this.highlight(winCombo);
            this.uMessage(`Player ${this.cPlayer} wins!`);
            this.gameOver = true;
        } else if (this.state.every((cell) => cell)) {
            this.uMessage("It's a tie!");
            this.gameOver = true;
        } else {
            // Switch players
            this.cPlayer = this.player;
            this.uMessage(`Player ${this.cPlayer}'s turn`);
        }
        console.log(this.possibilities);

    },

    // Check if there's a winning combination
    checkWin() {
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
            combo.every((i) => this.state[i] === this.cPlayer)
        );
    },

    // Highlight winning cells
    highlight(combo) {
        combo.forEach((i) => {
            document.getElementById("board").children[i].style.color = "red";
        });
    },

    random() {
        let move = -1;
        while(move<0){
            ind = Math.floor(Math.random() * 9);
            if(this.possibilities[ind] !== -1){
                move = ind;
            }
        }
        return move;
    },

    minimax() {
        let move = this.random();
        return move;
    },

    // Reset the game
    reset() {
        this.state = Array(9).fill(null);
        this.cPlayer = "X";
        this.gameOver = false;
        this.board();
    },

    // Update the game status message
    uMessage(msg) {
        document.getElementById("message").textContent = msg;
    },
};

// Start the game
TicTac.init();