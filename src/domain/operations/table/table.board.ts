import { RedisStorage } from "database/redis/game.redis";
import { RedisKeys } from "database/redis/redis.keys";

export class Board {

    private static _instance: Board;
    public SnakeHead:Array<number>
    public SnakeTail:Array<number>
    public LadderHead:Array<number>
    public LadderTail:Array<number>
    public PowerCard:Array<number>
    public PowerCan:Array<number>
    private redis: RedisStorage;
    public DicardArray:Array<number>
    
    constructor(){
        this.redis = RedisStorage.Instance;
        this.SnakeHead = [41,20]
        this.SnakeTail = [22,7]
        this.LadderHead = [35,15]
        this.LadderTail = [24,4]
        this.PowerCan = [1,0,-1]
        this.PowerCard = [5,10,30]
        this.DicardArray=[1,42,37,6]

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
            this.PowerCan.forEach(async (power)=>{
                power = await this.randomIntFromInterval(-2,2)
            })
            this.DicardArray.concat(this.LadderHead,this.LadderTail,this.SnakeHead,this.SnakeTail)
            this.PowerCard.forEach(async (pos)=>{
                pos = await this.getPowerCardPos(this.DicardArray);
            })
            return true;
        } catch (err: any) {
            console.log('Error while getting gameBoard', err);
            throw err
        }
    }
    public async randomIntFromInterval(min:number, max:number) { // min and max included 
        return Math.floor(Math.random() * (max - min + 1) + min)
    }
    public async getPowerCardPos(discardArr:Array<number>): Promise<any> { // discard some array for 
        let randompos =  Math.floor(Math.random() * (42 - 1 + 1) + 1)
        if(discardArr.includes(randompos)){
            return this.getPowerCardPos(discardArr)
        }
        return randompos
    }
}