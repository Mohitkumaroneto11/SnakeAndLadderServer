import { Request } from 'express'
import mongoose from 'mongoose'
export interface IUser {
  _id: string
  userId : string,
  name: string
  did: string
  token : string
  createdAt: Date
  assignedServer?: string,
  mid?: number,
  referCode? : string
}

export interface IUserRequest extends Request {
    profile?: IUser;
}

export const userModel = new mongoose.Schema({
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

