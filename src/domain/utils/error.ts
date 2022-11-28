import { ERROR_CODE } from 'utils/error.dto';
import { v4 as uuid } from 'uuid';


export class BaseHttpResponse {
    constructor(
      public readonly data: any = {},
      public readonly error: string | null = null,
      public readonly statusCode: number,
      public readonly timestamp: number = Date.now(),
      public readonly msgUuid: string = uuid()
    ) {}
  
    static success(data: any, statusCode = 200) {
      return new BaseHttpResponse(data, null, statusCode)
    }
  
    static failed(msg: string, statusCode = 400) {
      return new BaseHttpResponse(null, msg, statusCode)
    }
  }

  export class BadRequest extends Error {
    statusCode: number
    data: any;
  
    constructor(message: string, code=ERROR_CODE.DEFAULT, data: any = {}) {
      super();
      this.message = message;
      this.name = 'BadRequest';
      this.data = data;
      this.statusCode = code;
      Error.captureStackTrace(this, BadRequest);
      Object.setPrototypeOf(this, BadRequest.prototype);
    }
  }
  