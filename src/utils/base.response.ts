export class BaseResponse {
    constructor(
      
      public readonly rs:number,
      public readonly res:any,
      public readonly rc:any[],
      public readonly msgkey:string,
      public readonly error:string

    ) {

    }
  
    static success(rs:number, res:any, rc:any[], msgkey="F9E8B71A-DBCD-460F-912B-935089AD4BB90") {
      return new BaseResponse(rs, res, rc,msgkey, null)
    }
  
    static failed(rs:number,msgkey="F9E8B71A-DBCD-460F-912B-935089AD4BB90",error="") {
      return new BaseResponse(rs, null, null,msgkey,error)
    }
  }