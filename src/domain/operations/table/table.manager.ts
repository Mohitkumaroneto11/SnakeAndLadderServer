import {
    gameLog
} from 'utils/logger';
import {
    GameServer
} from 'application';
import {
    TableFactory
} from './table.factory'
import {
    GameState
} from 'domain/entities/game/game.model';
import {
    Game
} from '../game/game';
import {
    RedisStorage
} from '../../../database/redis/game.redis';
import {
    RedisKeys
} from '../../../database/redis/redis.keys'
export abstract class TableManager {
    private static _tableMap: Map < string, Game > = new Map();
    private static _waitingTables: Set < string > = new Set();
    private static _4_waitingTables: Set < string > = new Set();

    private static createTable(opts: any): Game {
        const newTable: Game = TableFactory.getTable(opts);
        if (!newTable) return null;
        newTable.initTable(opts.playerCount);
        this._tableMap.set(newTable.ID, newTable);
        this.addWaitingTable(newTable.ID, newTable.Capacity);
        this._waitingTables.add(newTable.ID);
        gameLog('counters', 'Table map count', newTable.ID, this._tableMap.size, this._waitingTables.size);
        return newTable;
    }
    public static addWaitingTable(tableId: string, capacity: number) {
        if (capacity == 2) {
            this._waitingTables.add(tableId);
        } else {
            this._4_waitingTables.add(tableId);
        }
    }
    public static search(searchOpts: any): Game {
        const table: Game = this.searchTable(searchOpts);
        if (table) return table;
        gameLog('common', 'Creating new table for user ', searchOpts.userId)
        return this.createTable(searchOpts);
    }
    private static searchTable(searchOpts: any): Game {
        gameLog('common', 'Search table for ', searchOpts.userId)
        if (searchOpts.playerCount == 2) {
            for (const tableId of this._waitingTables) {
                gameLog(tableId, 'Check table ', tableId, 'in table map')
                console.log('++++++++++++======>', tableId, this._tableMap.get(tableId).CONTEST_ID,
                    this._tableMap.get(tableId) ?.canJoin(searchOpts.userId))
                if (this._tableMap.has(tableId) && this._tableMap.get(tableId).CONTEST_ID == searchOpts.contestId &&
                    this._tableMap.get(tableId) ?.canJoin(searchOpts.userId)) {

                    return this._tableMap.get(tableId);
                }
            }
        } else {
            for (const tableId of this._4_waitingTables) {
                gameLog('common', 'Check table ', tableId, 'in table map')
                console.log('TABLE MAP', this._tableMap)
                if (this._tableMap.has(tableId) && this._tableMap.get(tableId).CONTEST_ID == searchOpts.contestId &&
                    this._tableMap.get(tableId) ?.canJoin(searchOpts.userId)) {
                    gameLog('common', 'User can use this table', this._tableMap.get(tableId))
                    return this._tableMap.get(tableId);
                }
            }
        }
    }
    public static deleteTableFromMap(tableId: string): boolean {
        if (this._tableMap.has(tableId)) {
            if (this._tableMap.get(tableId).isRunning()) return false;
            this._tableMap.delete(tableId)
            // console.log("deleted from map ", tableId);
            gameLog('counters', 'Delete table map', this._tableMap.size,
                this._waitingTables.size, tableId, this._tableMap.has(tableId));
            return true;
        }
    }
    public static removeTableFromRunningGroup(tableId: string) {
        this._waitingTables.delete(tableId);
    }

    public static async fetchTableStateRedis(gameId: string): Promise < Game > {
        // return null
        const table = await GameServer.Instance.GameServices.getFullGameState(gameId);
        // && table.state == GameState.RUNNING
        if (table) {
            let existingTable = this.getTableFromMemory(gameId);
            gameLog(gameId, 'Existing game sync in fetchTableStateRedis', existingTable);
            if (existingTable) {
                return existingTable
            }
            gameLog(gameId, 'Creating new game on gameSync')
            const game: Game = this.createTable(table);
            game.initTableOnRestart(table);
            return game;
        }
    }
    public static async getGameStateRedis(gameId: string) {
        let getRedisKeyForGameData = RedisKeys.getGameDataKey();
        let response = await RedisStorage.Instance.hmget(gameId, getRedisKeyForGameData);
        return response;


    }
    public static async updateGameStateRedis(gameId: string) {
        let getRedisKeyForGameData = RedisKeys.getGameDataKey();
        let response = await RedisStorage.Instance.hmset(gameId, getRedisKeyForGameData);
        return response;


    }

    public static getTableFromMemory(gameId: string): Game {
        return this._tableMap.get(gameId);
    }
    public static fetchTable(searchOpts: any) {
        let game: Game = this.getTableFromMemory(searchOpts._id);
        if (!game) {
            console.log('UNABLE TO FETCH SNAKE AND LADDER FROM MEMORY, CREATING NEW SNAKE AND LADDER');
            game = this.createTable(searchOpts);
        }
        return game
    }
}