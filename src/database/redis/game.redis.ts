import  Redis from "ioredis";
import { gameLog } from "utils/logger";
import { RedisTimeout } from "./redis.dto";
import { RedisKeys } from "./redis.keys";
export class RedisStorage {
    private  redisClient : Redis;
    private static instance: RedisStorage;
    public constructor(private opts : any) {
        this.redisClient =  new Redis(opts.host);
        this.redisClient.on("error", (err:any) => {
            console.log("Redis error", err);
        });
        this.redisClient.on("connect", () => {
            console.log("Redis connected");
        });
    }

    static get Instance(){
        const options = { host: process.env.REDIS_URL, port: 6379 };
        if(!this.instance){
            this.instance = new RedisStorage(options);
        } 
        return this.instance
    }

    public async hgetall(gameId: string) : Promise<any> {
        const data = await this.redisClient.hgetall(RedisKeys.gameKey(gameId));
        if(data && data._id) {
            // gameLog(gameId, 'Fetch sync state =>',data);
            console.log(" hgetall ",data);
            const resp = {
                _id: data._id,
                capacity: parseInt(data.capacity),
                isFull: data.isFull == 'true' ? true : false,
                state: parseInt(data.state),
                startedAt: parseInt(data.startedAt),
                gameStartTime: parseInt(data.gameStartTime),
                gameTime: parseInt(data.gameTime),
                isGameTimeOver: data.isGameTimeOver == 'true' ? true : false,
                players: JSON.parse(data.players),
                contestId: parseInt(data.contestId),
                roomId: parseInt(data.roomId),
                gameConfig: parseInt(data.gameConfig),
                isOnGameEndCallbackCalled: data.isOnGameEndCallbackCalled == 'true' ? true: false,
                gameLevel: parseInt(data.gameLevel),
                xFacLogId: parseInt(data.xFacLogId),
                xFacId: data.xFacId,
                gameId: parseInt(data.gameId)
            }
            console.log(" hgetall ",resp);
            return resp;
        }
        return null
    }
    public async hmget(gameId: string, keys: string) {
        const data = await this.redisClient.hmget(RedisKeys.gameKey(gameId),keys);
        if (!data) return null;
        if (!data[0]) return null;
        const result: any = {};
        const fields = keys.split(",");
        for (let index: number = 0; index < data.length; index++) {
            result[fields[index]] = data[index];
        }
        return result;
    }
    public async hset(gameId: string, key: string, value: string, expire: number = 0) {
        return this.redisClient.pipeline().hset(RedisKeys.gameKey(gameId), key, value).expire(RedisKeys.gameKey(gameId), expire).exec();
    }
    public async hmset(gameId: string, data: any, expire: number = 0) {
        // console.log("\n hmset data ", data);
        try {
            const resp =  await this.redisClient.pipeline().hmset(RedisKeys.gameKey(gameId), data).expire(RedisKeys.gameKey(gameId), expire).exec();
            console.log("resp ", resp);
        } catch (error) {
            console.error("error in hmset", error);
        }
    }
    public async get(key: string) {
        const resp = await this.redisClient.get(key);
        return JSON.parse(resp)
    }

    public async set(key: string, data: any, expire: number = RedisTimeout.ONE_DAY) {
        const resp = await this.redisClient.pipeline().set(key, JSON.stringify(data)).expire(key, expire).exec();
        return resp
    }

    get REDIS_CLIENT(){
        return this.redisClient
    }
}