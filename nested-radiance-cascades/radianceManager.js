class RadianceManager{
	constructor(){
		this.radianceShader=new RadianceShader();
		this.radianceOutShader=new RadianceOutShader();
		this.renderShader=new RenderShader();

		this.boundarySize=Vec(512,512);
		this.worldTex=new Texture({
			width: this.boundarySize.x,
			height: this.boundarySize.y,
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RGBA32F,
		});

		let radianceLength=this.boundarySize.x*this.boundarySize.y*4*4;
		let radianceSize=boxSize(radianceLength);

		this.radianceTexPP=new TexturePingPong({
			...sizeObj(radianceSize),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RGBA32F,
		});

		this.lightTex=new Texture({
			width: this.boundarySize.x,
			height: this.boundarySize.y,
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RGBA32F,
		});
	}
	run(shaderManager,canvasTex){
		shaderManager.resizeToDisplay();
		this.radianceTexPP.clear();

		// this.radianceShader.run(9,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(8,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(7,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(6,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(5,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(4,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(3,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(2,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(1,this.boundarySize,this.radianceTexPP,canvasTex);
		this.radianceShader.run(0,this.boundarySize,this.radianceTexPP,canvasTex);

		// this.radianceShader.run(1,this.boundarySize,this.radianceTexPP,canvasTex);
		// this.radianceMergeShader.run(4,this.boundarySize,this.radianceTex,this.radianceMergeTexPP);
		
		// this.radianceOutShader.run(1,this.boundarySize,this.radianceTexPP,this.lightTex);
		this.radianceOutShader.run(0,this.boundarySize,this.radianceTexPP,this.lightTex);
		// this.renderShader.run(this.radianceTexPP);
		this.renderShader.run(this.lightTex);
	}
}