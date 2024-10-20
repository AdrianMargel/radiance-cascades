
SHADER_FUNCS.RADIANCE=glsl`

struct Level{
	float idx;
	float leng;
	float scale;//Grid Scale
	vec2 dims;
	vec2 size;
};
struct Cascade{
	float idx;
	float leng;
	float radius;//Cascade Scale
	vec2 pos;
};
struct Probe{
	float idx;
	float leng;
	float ang;
	vec2 dir;
	vec2 pos;
};
struct Ray{
	float idx;
	float ang;
	vec2 dir;
	vec2 pos;
};

float getLevelScale(float levelIdx){
	return pow(branching,levelIdx);
}
float getCascadeRadius(float levelIdx){
	return pow(branching,levelIdx)*${sqrt(2)}/2.*1.001;
}
float getCascadeLength(float levelIdx){
	return pow(branching,levelIdx)*4.;
}
float getProbeLength(float levelIdx){
	return pow(branching,levelIdx)*4.;
}

Level newLevel(float levelIdx,vec2 boundarySize){
	float scale=getLevelScale(levelIdx);
	vec2 dims=ceil(boundarySize/scale);
	return Level(
		levelIdx,
		dims.x*dims.y,
		scale,
		dims,
		dims*scale
	);
}
Cascade newCascade(float cascadeIdx,Level level){
	vec2 coord=vec2(getIdxCoord(int(cascadeIdx),level.dims));
	vec2 pos=(coord+.5)*level.scale;
	return Cascade(
		cascadeIdx,
		getCascadeLength(level.idx),
		getCascadeRadius(level.idx),
		pos
	);
}
Cascade newCascade(vec2 pos,Level level){
	vec2 coord=floor(pos/level.scale);
	float cascadeIdx=coord.y*level.dims.x+coord.x;
	return newCascade(cascadeIdx,level);
}
Probe newProbe(float probeIdx,Cascade cascade,Level level){
	float ang=(probeIdx+.5)/cascade.leng*TAU;
	vec2 dir=vec2(cos(ang),sin(ang));
	return Probe(
		probeIdx,
		getProbeLength(level.idx),
		ang,
		dir,
		cascade.pos+dir*cascade.radius
	);
}
Ray newRay(float rayIdx,Probe probe){
	float ang=(rayIdx+.5)/probe.leng*TAU;
	vec2 dir=vec2(cos(ang),sin(ang));
	return Ray(
		rayIdx,
		ang,
		dir,
		probe.pos
	);
}
vec2 rot(vec2 p,float r){
	float sn=sin(r);
	float cs=cos(r);
	// return vec2(
	// 	cs*p.x-sn*p.y,
	// 	sn*p.x+cs*p.y
	// );
    return mat2(cs,sn,-sn,cs)*p;
}
vec2 intersect(vec2 linePos,float ang,vec2 circlePos,float radius){
	vec2 a=circlePos;
	a-=linePos;
	a=rot(a,-ang);

	if(radius<a.y){
		return linePos;
	}
	float intersectX=sqrt(pow(radius,2.)-pow(a.y,2.));
	a.x+=intersectX;
	a.y=0.;
	a=rot(a,ang);
	a+=linePos;
	return a;
}
vec4 getAt(Level level,Cascade cascade,Probe probe,Ray ray){
	float idx=cascade.idx*cascade.leng*probe.leng
		+probe.idx*probe.leng
		+ray.idx;
	return texelFetch(radianceTex,getIdxCoord(int(idx),radianceSize),0);
}`;

class RadianceShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp isampler2D;

				uniform sampler2D worldTex;
				uniform vec2 worldSize;
				uniform vec2 boundarySize;
				uniform sampler2D radianceTex;
				uniform vec2 radianceSize;
				uniform float levelIdx;
				uniform float branching;

				uniform float t;

				flat out vec4 vColor;
				
				${SHADER_FUNCS.DATA_TEX}
				${SHADER_FUNCS.RADIANCE}

				float screen(float a,float b){
					return 1.-((1.-a)*(1.-b));
				}

				// A <--> A
				vec4 mergeAA(vec4 ray1,vec4 ray2,float mx){
					return mix(ray1,ray2,mx);
				}
				// A --> B
				vec4 mergeAB(vec4 ray1,vec4 ray2){
					return vec4(
						ray1.xyz+ray2.xyz*ray2.w*(1.-ray1.w),
						screen(ray1.w,ray2.w)
					);
					// return max(ray1,ray2);
				}

				vec4 castRay(vec2 start,vec2 end){
					//TODO: clean this up
					vec2 dir=end-start;
					float dist=length(dir);
					dir/=dist;

					vec4 val=vec4(0);
					float stepDist=5.;//TODO
					for(float s=0.;s<=dist;s+=stepDist){
						vec2 rayPos=start+dir*s;
						vec2 samplePos=rayPos/worldSize;//TODO
						samplePos=vec2(samplePos.x,1.-samplePos.y);//invert y
						vec4 rayVal;
						if(samplePos.x<0.||samplePos.x>1.||samplePos.y<0.||samplePos.y>1.){
							rayVal=vec4(0.,0.,0.,1.);
						}else{
							rayVal=texture(worldTex,samplePos);
							// if(rayVal.xyz==vec3(0.)){
							// 	rayVal.w=0.;
							// }
							// rayVal.w*=.1;
						}
						// rayVal*=2.-(s/dist);

						val=mergeAB(val,rayVal);
						if(val.w>=1.){//TODO: decide tolerance
							break;
						}
					}
					return val;
				}

				void main(){
					gl_PointSize=1.;
					
					// Setup data
					Level level=newLevel(levelIdx,boundarySize);
					Level nextLevel=newLevel(levelIdx+1.,boundarySize);

					float cascadeLength=getCascadeLength(level.idx);
					float probeLength=getProbeLength(level.idx);
					
					float idx=float(gl_VertexID);
					float cascadeIdx=floor(idx/(cascadeLength*probeLength));
					float probeIdx=mod(floor(idx/probeLength),cascadeLength);
					float rayIdx=mod(idx,probeLength);

					Cascade cascade=newCascade(cascadeIdx,level);
					Cascade nextCascade=newCascade(cascade.pos,nextLevel);
					Probe probe=newProbe(probeIdx,cascade,level);
					Ray ray=newRay(rayIdx,probe);

					// Calculate cone
					float margin=TAU/(probe.leng*2.);

					float rayAng=ray.ang;
					float rayAngStart=ray.ang-margin;
					float rayAngEnd=ray.ang+margin;
					float rayIdxStart2=rayAngStart/TAU*nextCascade.leng-.5;
					float rayIdxEnd2=rayAngEnd/TAU*nextCascade.leng-.5;
					float rayIdxDist2=rayIdxStart2-rayIdxEnd2;
					float rayIdxStart=floor(rayAngStart/TAU*nextCascade.leng-.5);
					float rayIdxEnd=ceil(rayAngEnd/TAU*nextCascade.leng-.5);

					vec2 coneMid=intersect(
						ray.pos,rayAng,
						nextCascade.pos,nextCascade.radius
					);
					vec2 cone1=intersect(
						ray.pos,rayAngStart,
						nextCascade.pos,nextCascade.radius
					);
					vec2 cone2=intersect(
						ray.pos,rayAngEnd,
						nextCascade.pos,nextCascade.radius
					);
					float coneAng1=atan(cone1.y-nextCascade.pos.y,cone1.x-nextCascade.pos.x);
					float coneAng2=atan(cone2.y-nextCascade.pos.y,cone2.x-nextCascade.pos.x);

					float coneStartIdx=floor(coneAng1/TAU*nextCascade.leng-.5);
					float coneEndIdx=ceil(coneAng2/TAU*nextCascade.leng-.5);
					coneEndIdx=mod(coneEndIdx-coneStartIdx,nextCascade.leng)+coneStartIdx;
					float coneMidAng=atan(coneMid.y-probe.pos.y,coneMid.x-probe.pos.x);//TODO: =ray.ang
					float coneStartAng=atan(cone1.y-probe.pos.y,cone1.x-probe.pos.x);
					float coneEndAng=atan(cone2.y-probe.pos.y,cone2.x-probe.pos.x);

					// Cast ray
					vec4 rayVal=castRay(
						ray.pos,
						coneMid
					);
					// if(level.idx==5.){
					// 	rayVal*=0.;//TODO: remove
					// }

					// Sum view of next cascade
					vec4 nextVal;
					float nextWeight;
					for(float pI=coneStartIdx;pI<=coneEndIdx;pI++){
						float nextProbeIdx=mod(pI,nextCascade.leng);
						Probe nextProbe=newProbe(nextProbeIdx,nextCascade,nextLevel);
						
						for(float rI=rayIdxStart;rI<=rayIdxEnd;rI++){
							float nextRayIdx=mod(rI,nextProbe.leng);
							// float nextRayAng=atan(nextProbe.pos.y-probe.pos.y,nextProbe.pos.x-probe.pos.x);
							// float nextRayAng=coneMidAng;
							// nextRayAng-=TAU/nextProbe.leng*.5;
							// nextRayAng=clamp(
							// 	nextRayAng-coneMidAng,
							// 	coneStartAng-coneMidAng,
							// 	coneEndAng-coneMidAng
							// )+coneMidAng;

							Ray nextRay=newRay(nextRayIdx,nextProbe);

							vec4 nextRayVal=getAt(nextLevel,nextCascade,nextProbe,nextRay);

							float weight=1.;
							nextVal+=nextRayVal*weight;
							nextWeight+=weight;
						}
					}


					if(nextWeight>0.){
						nextVal/=nextWeight;
					}

					// Combine
					// vec4 val=rayVal;
					vec4 val=mergeAB(rayVal,nextVal);

					// Return
					vColor=val;
					gl_Position=vec4(getIdxPos(int(idx),radianceSize)*2.-1.,1.,1.);
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				flat in vec4 vColor;
				out vec4 outColor;

				void main(){
					outColor=vColor;
				}
			`,
		);
		this.drawType=gl.POINTS;
	}
	run(level,boundarySize,radianceTexPP,worldTex){
		let branching=2.;
		let levelScale=pow(2.,level);
		let cascadeLength=pow(branching,level)*4.;
		let probeLength=pow(branching,level)*4.;
		
		let levelSize=boundarySize.cln().scl(1/levelScale).ceil();
		let levelLength=levelSize.x*levelSize.y*cascadeLength*probeLength;

		this.uniforms={
			worldTex:worldTex.tex,
			worldSize:boundarySize,
			boundarySize,
			radianceTex:radianceTexPP.tex,
			radianceSize:radianceTexPP.size,
			levelIdx:level,
			branching,
			t:this.t=(this.t??0)+1
		};
		this.attachments=[
			{
				attachment:radianceTexPP.flip().tex,
				...sizeObj(radianceTexPP.size)
			}
		];
		super.run(levelLength);
		// console.log("tex",probeTex.read(4,gl.RGBA,gl.FLOAT,Float32Array));
	}
}
class RadianceOutShader extends FragShader{
	constructor(){
		super(
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				uniform vec2 boundarySize;
				uniform sampler2D radianceTex;
				uniform vec2 radianceSize;
				uniform float levelIdx;
				uniform float branching;

				in vec2 pos;

				out vec4 outColor;
				
				${SHADER_FUNCS.DATA_TEX}
				${SHADER_FUNCS.GAMMA}
				${SHADER_FUNCS.RADIANCE}

				void main(){//TODO
					vec2 pos2=(pos+1.)*.5;
					vec2 realPos=pos2*boundarySize;
					
					// Setup data
					Level nextLevel=newLevel(levelIdx,boundarySize);
					Cascade nextCascade=newCascade(realPos,nextLevel);

					// Sum view of next cascade
					vec4 nextVal;
					float nextWeight;
					for(float i=0.;i<nextCascade.leng;i++){
						float nextProbeIdx=i;
						Probe nextProbe=newProbe(nextProbeIdx,nextCascade,nextLevel);

						float nextRayAng=atan(nextProbe.pos.y-realPos.y,nextProbe.pos.x-realPos.x);
						float nextRayIdx=nextRayAng/TAU*nextProbe.leng-.5;
						float nextRayMix=mod(nextRayIdx,1.);
						Ray nextRayA=newRay(mod(floor(nextRayIdx),nextProbe.leng),nextProbe);
						Ray nextRayB=newRay(mod(ceil(nextRayIdx),nextProbe.leng),nextProbe);

						vec4 nextValA=getAt(nextLevel,nextCascade,nextProbe,nextRayA);
						vec4 nextValB=getAt(nextLevel,nextCascade,nextProbe,nextRayB);

						vec2 startPos=newProbe(nextProbeIdx-1.,nextCascade,nextLevel).pos;
						vec2 endPos=newProbe(nextProbeIdx+1.,nextCascade,nextLevel).pos;
						float startAng=atan(startPos.y-realPos.y,startPos.x-realPos.x);
						float endAng=atan(endPos.y-realPos.y,endPos.x-realPos.x);
						float weight=mod((endAng-startAng),TAU);
						// weight=1./length(nextProbe.pos-realPos);

						nextVal+=mix(nextValA,nextValB,nextRayMix)*weight;
						// nextVal+=nextValA;
						nextWeight+=weight;
					}
					if(nextWeight>0.){
						nextVal/=nextWeight;
					}

					// outColor=vec4(gammaCorrect(val.xyz*15.*gammaShift(vec3(1.,.5,.1))),1.);
					outColor=vec4(gammaCorrect(nextVal.xyz*1.),1.);
					// outColor=vec4(val.www*10.,1.);
					// outColor=vec4(val.x,0.,val.w,1.);
				}
			`,
		);
	}
	run(level,boundarySize,radianceTex,outTex){
		let branching=2.;
		this.uniforms={
			boundarySize,
			radianceTex:radianceTex.tex,
			radianceSize:radianceTex.size,
			levelIdx:level,
			branching,
		};
		this.attachments=[
			{
				attachment:outTex.tex,
				...sizeObj(outTex.size)
			}
		];
		super.run();
	}
}