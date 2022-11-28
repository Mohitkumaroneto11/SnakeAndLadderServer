import { XFacAbstract } from 'domain/operations/xfac/xfac.abstract'
import mongoose from 'mongoose'
import { GameConfig } from '../game/game.model'
export enum PlayerState {
  WAITING = 1,
  PLAYING = 2,
  WON =3 ,
  LOST = 4 ,
  EXIT =5 ,
  AUTOEXIT =6
}

export enum ExitReason {
  GAME_EXIT = 1,
  EXIT_BEFORE_MATCH_MAKING = 2,
  TURN_SKIP_3 = 3
}

export enum PlayerType{
  HUMAN = 1,
  XFAC = 2
}

export type PlayerOpts = {
    _id : string
    name : string
    color? : number
    pos ? : number
    mid?: number
    did?: string,
    referCode?: string,
    totalGameWinners?: number,
    playerType?: PlayerType,
    xfac?: XFacAbstract
}
export interface IPlayer {
  _id: string
  userId : string,
  name: string
  did: string
  token : string
  createdAt: Date
  color : number
  pos : number
  pawnStack : Array<any>  
  state : PlayerState 
}

export const playerModel = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  did: {
    type: String,
    required: true,
  },
  token: { type: String },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
})

export type TPlayer = typeof playerModel
