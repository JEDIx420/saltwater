export type Joystick={x:number;y:number};
export function normalizeJoystick(x:number,y:number,radius=52):Joystick{const length=Math.hypot(x,y);if(length<radius*.1)return{x:0,y:0};const scale=length>radius?radius/length:1;return{x:x*scale/radius,y:y*scale/radius}}
export function joystickHeading(joy:Joystick,cameraYaw:number){return cameraYaw+Math.atan2(-joy.x,-joy.y)}
export function angleDelta(from:number,to:number){return ((to-from+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI}
export function clamp(v:number,min:number,max:number){return Math.min(max,Math.max(min,v))}
export function approach(value:number,target:number,rate:number,dt:number){return target+(value-target)*Math.exp(-rate*dt)}
