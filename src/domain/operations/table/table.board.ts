import { RedisStorage } from "database/redis/game.redis";
import { RedisKeys } from "database/redis/redis.keys";

export class Board {

    private static _instance: Board;
    public SnakeHead:Array<number>
    public SnakeTail:Array<number>
    public LadderHead:Array<number>
    public LadderTail:Array<number>
    private redis: RedisStorage;
    
    constructor(){
        this.redis = RedisStorage.Instance;
        this.SnakeHead = [20,26]
        this.SnakeTail = [2,13]
        this.LadderHead = [23,14]
        this.LadderTail = [12,3]

    }
    public static get Instance()
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }
    public async getBoardTableRedis(boardId: number) {
        try {
            const getBoardKey = RedisKeys.getGameBoard(boardId);
            var boards:any = await this.redis.get(getBoardKey);
            boards.forEach((board:any)=> {
                this.SnakeHead = board.snake.head;
                this.SnakeTail = board.snake.tail;
                this.LadderHead = board.ladder.head;
                this.LadderTail = board.ladder.tail;
            });
            return true;
        } catch (err: any) {
            console.log('Error while getting gameBoard', err);
            throw err
        }
    }
}