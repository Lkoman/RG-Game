export class LevelController {
    constructor() {
        this.level = 1;
    }

    nextLevel() {
        this.level++;
    }

    getLevel() {
        return this.level;
    }
}