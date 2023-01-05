import { RedisStorage } from "database/redis/game.redis";
import { RedisKeys } from "database/redis/redis.keys";
import SQL from "database/sql";
import { Breakup, Category, ContestData, GameIds, JoinedContest, PracticeContestUser } from "domain/entities/game/game.model";
import { BadRequest } from "domain/utils/error";
import { BaseHttpResponse } from "utils";
import { ERROR_CODE } from "utils/error.dto";
import { TransactionMethod } from "./transaction";
import { from } from "linq-to-typescript";

export class ContestMethod {
    private static _instance: ContestMethod;
    matchContestDetails: any[] = [];
    prizeBreakUp: Array<Breakup> = []
    private sql: SQL;
    private redis: RedisStorage;
    private _transactionMethod: TransactionMethod

    constructor() {
        this.sql = SQL.Instance
        this.redis = RedisStorage.Instance
        this._transactionMethod = new TransactionMethod();
    }


    async getContestById(contestId: string, gameId: GameIds) {
        let resp: ContestData;
        let contests: ContestData[] = await this.getContestList(gameId);

        for (let contest of contests) {
            if (contest.cid.toString() == contestId.toString()) {
                resp = contest
                // resp.IsXFac = true
            }
        }
        return resp;
    }

    async getContestList(gameId: GameIds): Promise<ContestData[]> {
        let cList: ContestData[] = []
        const cacheKey = RedisKeys.ContestDetails(String(gameId));
        let contests: ContestData[];
        contests = await this.redis.get(cacheKey);
        if (!contests || Object.keys(contests).length == 0) {
            let procName = 'PROC_GET_GameContests_V2';
            let procParam = `@GameId=${gameId}`
            let resp = await this.sql.GetDataFromCasualGame(procName, procParam);
            if (!resp) {
                throw new BaseHttpResponse(null, "No contest found", ERROR_CODE.DEFAULT, '')
            }
            contests = resp;
            await this.redis.set(cacheKey, contests);

        }
        cList = [...contests]

        return cList
    }

    async canUserJoinContest(userId: number, contestId: string, gameId: number): Promise<boolean> {
        try {
            const contestDetails = await this.getContestById(contestId, gameId);
            if (!contestDetails) {
                console.log('INVALID CONTEST')
                throw new BadRequest("Invalid Contest");
            }
            var userBalance = await this._transactionMethod.GetUserBalance(userId);
            if (!userBalance) {
                console.log('Invalid userId')
                throw new BadRequest("Unable to fetch user balance");
            }
            userBalance = userBalance[0]['Balance']
            if (Number(userBalance) < Number(contestDetails.ja)) {

                throw new BadRequest("Insufficient Balance",
                    ERROR_CODE.INSUFFICIENTBALANCE,
                    { balanceRequired: Math.abs(Number(userBalance) - Number(contestDetails.ja)) });
            }
            return true
        } catch (err: any) {
            console.log('Error while checking user can join contest', err);
            throw err
        }

    }

    async checkUserBalance(userId: number, amount: number): Promise<boolean> {
        try {
            var userBalance = await this._transactionMethod.GetUserBalance(userId);
            if (!userBalance) {
                console.log('Invalid userId')
                throw new BadRequest("Unable to fetch user balance", ERROR_CODE.DEFAULT, null);
            }
            userBalance = userBalance[0]['Balance']
            if (Number(userBalance) < amount) {
                throw new BadRequest("Insufficient Balance",
                    ERROR_CODE.INSUFFICIENTBALANCE, { balanceRequired: Math.abs(Number(userBalance) - amount) });
            }
            return true
        } catch (err) {
            console.log('Error in check user bal=>', err);
            throw err
        }
    }

    async incContestCounter(contestId: string, incBy: number) {
        return await this.redis.REDIS_CLIENT.hincrby(RedisKeys.JoinedContestCount('1'), contestId, incBy)
    }
    async getPrizeBreakUp(contestId: number) {
        try {
            const prizebreakupcacheName = RedisKeys.ContestPrizeBreakUp(contestId.toString());
            let cacheResp = await this.redis.get(prizebreakupcacheName);
            if (cacheResp != null) {
                this.prizeBreakUp = JSON.parse(cacheResp.toString());
                this.prizeBreakUp = from(this.prizeBreakUp).orderBy((x: any) => x.wf).toArray()
            }
            else {
                this.prizeBreakUp = await this.SaveContestPriceBreakupInCache(contestId)
                if (this.prizeBreakUp != null) {
                    await this.redis.set(prizebreakupcacheName, JSON.stringify(this.prizeBreakUp));
                }
            }
            return this.prizeBreakUp;
        } catch (err: any) {
            console.log('Error while getting prize breakup', err);
            throw err
        }
    }

    async SaveContestPriceBreakupInCache(contestId: number) {
        const proc_name = "PROC_GET_ContestPrizeBreakup";
        const param = "@ContestId=" + contestId;
        var result = await this.sql.GetDataFromCasualGame(proc_name, param);
        return result;
    }

    async getContestDuration(contestId: number) {
        let contestDuration = 0;
        try {
            const proc_name = "PROC_GET_ContestDuration";
            const param = "@ContestId=" + contestId;
            var result = await this.sql.GetDataFromCasualGame(proc_name, param);
            if (result.length > 0)
                contestDuration = parseInt(result[0].GameDuration);

            return contestDuration;
        } catch (err: any) {
            console.log('Error while getting prize breakup', err);
            throw err
        }
    }
    
    
}