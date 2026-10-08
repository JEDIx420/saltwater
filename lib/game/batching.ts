import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Bake rigid details into one vertex-coloured draw call; joints stay independent. */
export function mergeRigid(parent:T.Object3D,exclude:T.Object3D[]=[]){
 const pieces:T.Mesh[]=parent.children.filter(o=>o instanceof T.Mesh&&!exclude.includes(o)&&!(o instanceof T.InstancedMesh)&&!Array.isArray(o.material)&&!o.material.transparent) as T.Mesh[];
 if(pieces.length<2)return null;
 const geos=pieces.map(piece=>{piece.updateMatrix();const g=piece.geometry.clone().toNonIndexed();g.applyMatrix4(piece.matrix);const p=g.attributes.position,old=g.attributes.color,material=piece.material as T.MeshStandardMaterial,base=material.color??new T.Color(0xffffff),colors=[];for(let i=0;i<p.count;i++){const c=base.clone();if(old&&material.vertexColors)c.multiply(new T.Color().setRGB(old.getX(i),old.getY(i),old.getZ(i)));colors.push(c.r,c.g,c.b)}for(const key of Object.keys(g.attributes))if(key!=='position'&&key!=='normal')g.deleteAttribute(key);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g});
 const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!geometry)return null;
 const merged=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.72}));merged.castShadow=true;merged.receiveShadow=true;pieces.forEach(p=>parent.remove(p));parent.add(merged);return merged;
}
