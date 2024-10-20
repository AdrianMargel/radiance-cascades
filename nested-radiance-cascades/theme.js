class Theme{
	constructor(){
		/* GENERAL */
		this.center=`
			display: flex;
			justify-content: center;
			align-items: center;
		`;
		this.centerX=`
			display: flex;
			justify-content: center;
		`;
		this.centerY=`
			display: flex;
			align-items: center;
		`;
		this.centerText=`text-align: center;`,
		this.elementReset=`
			display: block;
		`;

		/* COLORS */
		this.color={
			// greyStep:(a)=>this.#colorStep2(a,new Color("#363640"),new Color("#09000b"),0.6),
			greyStep:(a)=>this.#colorStep(a,new Color("#363640"),0.6),
			inputStep:(a)=>this.#colorStep(a,new Color("#363639"),0.6),
			highlight:Col("#7AC16C"),
			highlightDark:Col("#58934C"),
			white:Col(1),
			black:Col(0),
		}
		
		/* FONTS */
		let primary="font-family: 'Sen', sans-serif;";
		let secondary="font-family: 'Montserrat', sans-serif;";
		let fontSizeStep=(a)=>"font-size:"+Math.floor(this.#genericStep(a,10,150,24))+"px;";
		this.font={
			primary,
			secondary,
			sizeStep:fontSizeStep,
			text:()=>`
				font-weight: 400;
				${secondary}
				${fontSizeStep(-0.5)}
			`,
			title:()=>`
				font-weight: 700;
				${primary}
				${fontSizeStep(3)}
			`,
			interact:()=>`
				font-weight: 700;
				${primary}
				${fontSizeStep(-0.5)}
			`
		}

		/* OTHER */
		this.mobile="@media only screen and (max-width: 600px)";
		this.boxShadowStep=(a)=>"box-shadow: 0 0 "+this.#genericStep(a,0,80,30)+"px #00000080;";
	}
	#genericStep(a,min,max,mid){
		let smallDist=mid-min;
		let bigDist=max-mid;
		let totalDist=smallDist+bigDist;
	
		let smallScale=smallDist/totalDist;
		let bigScale=bigDist/totalDist;
		if(a>0){
			a*=smallScale;
			let blend=(sigmoid(a)-0.5)*2;
			return mix(mid,max,blend);
		}else{
			a*=bigScale;
			let blend=(sigmoid(a)-0.5)*2;
			return mix(mid,min,-blend);
		}
	}

	#colorStep2(a,base,shadow,modifier){
		return this.#colorStep(a,base.cln().sub(shadow).clamp(),modifier).add(shadow);
	};
	#colorStep(a,base,modifier=1){
		// a = (-infinity,infinity)
		let minCol=Math.min(base.r,base.g,base.b);
		let maxCol=Math.max(base.r,base.g,base.b);
	
		let darkDist=maxCol;
		let lightDist=1-minCol;
		let totalDist=darkDist+lightDist;
	
		let lightScale=lightDist/totalDist;
		let darkScale=darkDist/totalDist;
	
		if(a>0){
			a*=darkScale;
		}else{
			a*=lightScale;
		}
		a=sigmoid(a*modifier);
		
		let blend=(a-0.5)*2;
		if(blend>0){
			return base.cln().mix(Col(1),blend);
		}else{
			return base.cln().mix(Col(0),-blend);
		}
	}
}
function easeInOutExpo(x) {
	return x === 0
		? 0
		: x === 1
		? 1
		: x < 0.5 ? Math.pow(2, 20 * x - 10) / 2
		: (2 - Math.pow(2, -20 * x + 10)) / 2;
}
function easeInOutQuad(x) {
	return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Create theme
let theme=new Theme();