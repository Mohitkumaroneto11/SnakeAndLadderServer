import * as sql from "mssql";
import { gameLog } from "utils/logger";

class SQL {
  private static _instance: SQL; 
  private casualDbConnection: sql.ConnectionPool;
  private transactionDbConnection: sql.ConnectionPool;
  private static MAX_RETRY = 1;
  constructor() {
    //this._dbContext = DBContext.Instance;
  }

  static get Instance() {
    if(!this._instance) {
      this._instance = new SQL();
    }
    return this._instance;
  }

  private async getCasualDb(roomId: string) {
    if (!this.casualDbConnection || !this.casualDbConnection.connected) {
      gameLog(roomId.toString(), 'creating new connection', this.casualDbConnection);
      this.casualDbConnection = await new sql.ConnectionPool(process.env.GAME_DB_CONN).connect()
    }
    return this.casualDbConnection;
  }

  private async getTransactionDb() {
    if (!this.transactionDbConnection || !this.transactionDbConnection.connected) {
      this.transactionDbConnection = await new sql.ConnectionPool(process.env.TRANSACTION_DB_CONN).connect()
    }
    return this.transactionDbConnection;
  }

  async GetDataFromCasualGame(proc_name: string, param: string) {
    let recordList: any = [];
    try {

      let query = "EXEC " + proc_name + " " + param;
      const result = await (await this.getCasualDb('noroom')).query(query)
      recordList = result.recordset;
    }
    catch (err) {
      console.log(err);
    }
    return recordList;
  }

  async GetDataFromTransaction(proc_name: string, param: string) {
    let recordList: any = [];
    try {
      let query = "EXEC " + proc_name + " " + param;
      const result = await (await this.getTransactionDb()).query(query)
      recordList = result.recordset;

    }
    catch (err) {
      console.log(err);
    }
    return recordList;
  }

  async GetDataForContestWinners(proc_name: string, contestId: number, roomId: number, tbl: any, retry: number = 0) {
    let winnerList: any = []
    try {
      if(retry>SQL.MAX_RETRY){
        return [];
      }
      retry++
      let connetion = await this.getCasualDb(roomId.toString());
      const request = new sql.Request(connetion);
      request.input('RoomId', sql.BigInt, roomId)
      request.input('ContestId', sql.BigInt, contestId)
      request.input('dtLudoRoomParticipantsScore', sql.TVP, tbl)
      const result = await request.execute(proc_name);

      winnerList = result.recordset;

      gameLog(roomId.toString(), 'Recordset in get contest winner ', result.recordset);
    }
    catch (err) {
      this.GetDataForContestWinners(proc_name, contestId, roomId, tbl, retry);
      gameLog(roomId.toString(), 'Connection error log in get contest winner ', err);
      console.log(err);
    }
    return winnerList;
  }

  async RefundToUser(proc_name: string, tbl: any) {
    let refundStatusList: any = []
    try {
      let connetion = await this.getTransactionDb()

      const request = await new sql.Request(connetion);
      request.input('dtRefundedLudoUser', sql.TVP, tbl)
      const result = await request.execute(proc_name);

      refundStatusList = result.recordset;
    }
    catch (err) {
      console.log(err);
      }
      return refundStatusList;
    }

}

export default SQL;