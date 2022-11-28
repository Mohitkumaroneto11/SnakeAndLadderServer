import * as sql from "mssql";
import SQL from "database/sql";
import { RedisStorage } from "database/redis/game.redis";
import { ContestWinnerRequest, TransactionTokenRequest } from "domain/entities/transaction/transaction.dto";
import { ContestData, JoinContestResponse } from "domain/entities/game/game.model";
import { gameLog } from "utils/logger";
import { RedisKeys } from "database/redis/redis.keys";
import { BadRequest } from "domain/utils/error";
import { ERROR_CODE } from "utils/error.dto";
import { GameServer } from "application";
export class TransactionMethod {
    private sql: SQL;
    private redis: RedisStorage

    constructor() {
        this.sql = SQL.Instance
        this.redis = RedisStorage.Instance
    }


    async JoinContest(request: TransactionTokenRequest) {
        let joinContestRespone = new JoinContestResponse();
        let responseStatus = 0;
        try {
            console.log(request);
            gameLog(request.gameserverid, `Request come to room creation`, request);
            const contestId = request.cid.toString();
            var contestData: ContestData = await GameServer.Instance.ContestMethods.getContestById(contestId, request.gameId);

            if (!contestData) {
                throw new BadRequest("Contest does not exists", ERROR_CODE.CONTESTNOTFOUND);
            }

            request.amt = contestData.ja;
            request.mba = contestData.mba;

            const proc_name = "PROC_DEDUCT_JOIN_CASUAL_GAME_FEES";
            let param = "@GameId=" + request.gameId + ", @ContestId=" + request.cid + ", @CategoryId=" + contestData.catid;
            param = param + ", @Amount=" + request.amt + ", @GameTypeId=2, @MaxBonusAllowed=" + request.mba;
            param = param + ", @GameServerId='" + request.gameserverid + "'";
            param = param + ", @dtUserJson='" + JSON.stringify(request.userList) + "'";
            var result = await this.sql.GetDataFromTransaction(proc_name, param);
            if (result.length > 0) {
                console.log("Result : " + result);
                gameLog(request.gameserverid, `Deduct money before room creation `, result);
                let dtCasualRoomParticipants = [];
                for (let o of result) {
                    var objParticipants = {
                        UserId: o.UserId,
                        UserLoginId: o.UserLoginId,
                        WalletTransactionId: o.WalletTransactionId,
                        ReferCode: o.ReferCode
                    };
                    if (o.ResponseStatus == 1) {
                        dtCasualRoomParticipants.push(objParticipants);
                    }
                    else if (o.ResponseStatus == 501) {
                        throw new BadRequest("Insufficient balance", ERROR_CODE.INSUFFICIENTBALANCE);
                    }
                    else {
                        throw new BadRequest("Transaction failed", ERROR_CODE.FAILED);
                    }

                }
                const game_proc_name = "PROC_CreateCasualRoomAndAssignToUser";
                let gameParam = "@ContestId=" + request.cid + ", @GameServerId='" + request.gameserverid + "'" + ", @GameId=" + request.gameId;
                gameParam = gameParam + ", @dtCasualRoomParticipantsJson='" + JSON.stringify(dtCasualRoomParticipants) + "'";
                console.log(game_proc_name, gameParam)
                var gameResult = await this.sql.GetDataFromCasualGame(game_proc_name, gameParam);
                if (gameResult.length > 0) {
                    responseStatus = gameResult[0].status;
                    if (responseStatus == 1 && gameResult[0].RoomId > 0) {
                        joinContestRespone.ResponseStatus = 1;
                        joinContestRespone.RoomId = gameResult[0].RoomId;

                        gameLog(request.gameserverid, `Room creation successfully`, gameResult);
                    }
                    else {
                        var tbl_RefundUserList = new sql.Table();
                        tbl_RefundUserList.columns.add("UserId", sql.VarChar(50), { nullable: true });
                        tbl_RefundUserList.columns.add("WalletTransactionId", sql.BigInt, { nullable: true });

                        for (let ul of dtCasualRoomParticipants) {
                            tbl_RefundUserList.rows.add(ul.UserId, ul.WalletTransactionId);
                        }

                        const proc_refund_name = "PROC_REFUND_CASUAL_GAME_ENTRY_FEE_V2";
                        var refund_result = await this.sql.RefundToUser(proc_refund_name, tbl_RefundUserList);

                        gameLog(request.gameserverid, `Refund money in step 1 `, gameResult);

                        joinContestRespone.ResponseStatus = 0;
                        throw new BadRequest("Room creation failed", ERROR_CODE.FAILED);
                    }
                }
                else {

                    var tbl_RefundUserList = new sql.Table();
                    tbl_RefundUserList.columns.add("UserId", sql.VarChar(50), { nullable: true });
                    tbl_RefundUserList.columns.add("WalletTransactionId", sql.BigInt, { nullable: true });

                    for (let ul of dtCasualRoomParticipants) {
                        tbl_RefundUserList.rows.add(ul.UserId, ul.WalletTransactionId);
                    }

                    const proc_refund = "PROC_REFUND_CASUAL_GAME_ENTRY_FEE_V2";
                    var refund_result1 = await this.sql.RefundToUser(proc_refund, tbl_RefundUserList);

                    gameLog(request.gameserverid, `Refund money in step 2 `, gameResult);

                    joinContestRespone.ResponseStatus = 0;
                    throw new BadRequest("Room creation failed", ERROR_CODE.FAILED);
                }
            }
            else {
                joinContestRespone.ResponseStatus = 0;
                throw new BadRequest("Transaction failed", ERROR_CODE.FAILED);
            }

        }
        catch (ex: any) {
            console.error('Error in join contest', ex);
            joinContestRespone.ResponseStatus = 0;
            throw new BadRequest(JSON.stringify(ex.message), ERROR_CODE.EXCEPTION);
        }
        return joinContestRespone;
    }

    async GetUserBalance(UserId: number) {
        const proc_name = "PROC_GET_UserBalanceForContestJoin";
        let Param = "@UserId=" + UserId
        var Result = await this.sql.GetDataFromTransaction(proc_name, Param);
        return Result
    }

    async getContestWinners(request: ContestWinnerRequest, gameId: string) {
        try {
            gameLog(gameId, 'User data in in getContestWinner', request);
            if (request.ludoParticipantScore.length > 0) {
                var tbl_UserList = new sql.Table();
                tbl_UserList.columns.add("UserId", sql.BigInt, { nullable: true });
                tbl_UserList.columns.add("Score", sql.BigInt, { nullable: true });

                for (let ul of request.ludoParticipantScore) {
                    tbl_UserList.rows.add(ul.UserId, ul.Score);
                }

                const proc_name = "PROC_DECLARE_CASUAL_GAME_WINNERS_FOR_SOCKET";
                var result = await this.sql.GetDataForContestWinners(proc_name, request.ContestId, request.RoomId, tbl_UserList);
                gameLog(gameId, 'Resultsest in getContestWinner', result);
                if (result.length > 0)
                    return result;
                else
                    throw new BadRequest("Something went wrong with procedure", ERROR_CODE.FAILED);
            }
            else {
                throw new BadRequest("Invalid request", ERROR_CODE.INVALIDREQUEST);
            }
        } catch (ex: any) {
            console.log(JSON.stringify(ex.message));
            throw new BadRequest(JSON.stringify(ex.message), ERROR_CODE.EXCEPTION);
        }
    }
}