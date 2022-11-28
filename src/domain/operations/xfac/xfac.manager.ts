import { GameIds } from "domain/entities/game/game.model";
import { Game } from "../game/game";
import { FruitCutXFac } from "./fruitcut.xfac";
import { KnifeHitXFac } from "./knifehit.xfac";
import { XFacAbstract } from "./xfac.abstract";

export class XFacManager{
    static getXFac(game: Game): XFacAbstract{
        let xfac: XFacAbstract;
        if(game.gameId == GameIds.KNIFE_HIT){
            xfac = new KnifeHitXFac(game);
        } else{
            xfac = new FruitCutXFac(game);
            
        }
        return xfac
    }
}