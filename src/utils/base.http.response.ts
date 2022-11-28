import { v4 as uuid } from 'uuid';
export class BaseHttpResponse {
    private static gameMsgCounter: any = {}
    public msgId: number;
    constructor(
      public readonly data: any = {},
      public readonly error: string | null = null,
      public readonly statusCode: number,
      public readonly gameId: string,
      public readonly isLastEvent: boolean = false,
      public readonly timestamp: number = Date.now()
    ) {
      let lastMsgId = BaseHttpResponse.gameMsgCounter[gameId];
      if(!lastMsgId){
        lastMsgId = 1
      } else {
        lastMsgId++;
      }
      this.msgId = lastMsgId;
      BaseHttpResponse.gameMsgCounter[gameId] = lastMsgId;

      if(isLastEvent){
        delete BaseHttpResponse.gameMsgCounter[gameId]
      }
    }
  
    static success(data: any, statusCode = 200, gameId:string) {
      return new BaseHttpResponse(data, null, statusCode, gameId)
    }
  
    static failed(msg: string, statusCode = 400, gameId: string) {
      return new BaseHttpResponse(null, msg, statusCode, gameId)
    }
  }
  