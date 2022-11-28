import { RedisStorage } from "database/redis/game.redis";
import { gameLog } from "utils/logger";

const EXPIRE_TIME = 100000
export class GameServices {
    private readonly _gameRedis : RedisStorage
    constructor(gameRedis: RedisStorage) {
        this._gameRedis = gameRedis;
      }
      async createGameEntryOnStart(redisData:any) {
        const redisAck  = await this._gameRedis.hmset(redisData._id, redisData, EXPIRE_TIME);
        return {redisAck};
      }
      async createGameEntryOnEnd(redisData:any) {
        const redisAck  = await this._gameRedis.hmset(redisData._id, redisData, EXPIRE_TIME);
        return {redisAck};
      }

      async syncGameState(gameId: string, data: any) {
        // gameLog(gameId, 'Last sync state =>',data);
        return await this._gameRedis.hmset(gameId, data, EXPIRE_TIME);
      }

      async getFullGameState(gameId: string) {
        return await this._gameRedis.hgetall(gameId);
      }

      async getPartialGameState(gameId: string, keys: string) {
        return await this._gameRedis.hmget(gameId, keys);
      }

      async updateGameEntryOnEnd(gameId: string, redisData: any, mongoData:any) {
        await this._gameRedis.hmset(gameId, redisData, EXPIRE_TIME);
      }
}