import {MathUtils} from 'three';

export const ROLL_DURATION=1.55;
/** Brief coil, accelerating turn, then a controlled recovery. Full 360° without a snap. */
export function rollPose(remaining:number){
 const progress=MathUtils.clamp(1-remaining/ROLL_DURATION,0,1);
 const spin=MathUtils.smoothstep(progress,.14,.86);
 const tuck=MathUtils.smoothstep(progress,0,.13)*(1-MathUtils.smoothstep(progress,.84,1));
 return {progress,angle:spin*Math.PI*2,tuck,lift:Math.sin(progress*Math.PI)*.18,coil:Math.sin(progress*Math.PI*2)*tuck};
}
