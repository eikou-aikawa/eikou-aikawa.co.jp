$(".require-script").show();

const emailjsPublicKey="Z8ZJQXlvchgOH7GoL";
const emailjsServiceId="service_vx3v6uj";
const emailjsTemplateId="template_cjeucaa";
const emailjsMaxTotalFileSize=500*1024;
//const emailjsMaxTotalFileSize=Number.POSITIVE_INFINITY;
const maxFileCount=5;
const grecaptchaSiteKey="6LeyKqwtAAAAANsrq3275nZygf-mzJGvxRj96ekO";

emailjs.init({publicKey: emailjsPublicKey});


function toFileSizeString(size){
	if(size<1024){
		return `${size}B`;
	}

	if(size<1024*1024){
		return `${Math.ceil(size/1024*10)/10}kB`;
	}

	// GB and higher are not needed
	return `${Math.ceil(size/1024/1024*10)/10}MB`;
}

let $debug;

$("div.files").each((_,domElement)=>{
	const element=$(domElement);

	function createInputElement(){
		let div=$('<div class="input-file" />');

		let innerDiv=$("<div />");
		innerDiv.append(
			$('<div><div><p>✖</p></div></div>')
				.on("click",()=>{
					div.remove();
					onInput();
				}),
			$('<input type="file">').on("input",onInput)
		)

		div.append(
			innerDiv,
			$('<p class="file-size" />')
		);

		$debug=div;
		return div;
	}

	function onInput(){
		element.children("p.total-file-size").remove();

		let totalFileSize=0;
		element.children("div.input-file").each((index,element)=>{
			let input=element.querySelector("input");
			if(input.files.length==0){
				element.remove();
			}else{
				let fileSize=input.files[0].size;
				let fileSizeElement=element.querySelector("p.file-size");

				fileSizeElement.innerText=`(${toFileSizeString(fileSize)})`;
				if(fileSize>emailjsMaxTotalFileSize){
					fileSizeElement.classList.add("red");
				}

				totalFileSize+=fileSize;
			}
		});
		
		if(element.children("div.input-file").length<maxFileCount){
			element.append(createInputElement());
		}
		element.append(`<p class="total-file-size">合計サイズ: <span${totalFileSize>emailjsMaxTotalFileSize?' class="red"':""}>${toFileSizeString(totalFileSize)}</span> / ${toFileSizeString(emailjsMaxTotalFileSize)}</p>`)
	}

	element.data("getFiles",async ()=>{
		let promises=element.children("div.input-file").map((_,fileElement)=>{
			return new Promise((resolve,reject)=>{
				try{
					let input=fileElement.querySelector("input");
					if(input.files.length==0){
						resolve();
						return;
					}

					let file=input.files[0];

					// https://ja.javascript.info/blob
					let reader=new FileReader();

					reader.onload=()=>{
						resolve(
							{
								file,
								name: file.name,
								size: file.size,
								content: reader.result
							}
						);
					};

					reader.onerror=(error)=>{
						console.error("An error occured during reading files!",error);
						reject(error);
					}
					
					reader.readAsDataURL(file);
				}catch(e){
					console.error(e);
					reject(e);
				}
			});
		});

		let files=(await Promise.all(promises)).filter(item=>item!=undefined);

		let totalSize=0;
		files.forEach(({size})=>totalSize+=size);
		
		return {
			files,
			totalSize
		};
	});

	onInput();
});

const errorElements=$("div.error");
document.onmousemove=(event)=>{
	mousePos={x: event.pageX, y: event.pageY};

	errorElements.each((index)=>{
		let element=$(errorElements[index]);

		if(
			event.pageX>=element.offset().left
			&& event.pageX<=element.offset().left+element.width()
			&& event.pageY>=element.offset().top
			&& event.pageY<=element.offset().top+element.height()
		){
			element.children().css("opacity",0.25);
		}else{
			element.children().css("opacity",1);
		}
	});
};

elements=undefined;
class FormItem{
	constructor(name,validator=()=>true,label=undefined,required=undefined,enabledWith=undefined,suffix=""){
		this.name=name;
		this.suffix=suffix;
		this.elements=$(`*[name="${name}"]`);

		elements=this.elements;
		if(this.elements[0].tagName=="TEXTAREA"){
			this.type="text";
		}else{
			this.type=this.elements[0].type;
		}

		if(this.type=="text" && this.elements.length!=1){
			throw new Error("複数のテキストフィールド");
		}

		if(label==undefined){
			label=this.elements.prev()[0].innerText.replace("\n","");
		}
		this.label=label;

		if(required==undefined){
			required=this.elements[0].required;
		}
		this.required=required;

		this.validator=validator;
		this.enabledWith=enabledWith;
	}

	isEnabled(){
		if(this.enabledWith==undefined){
			return true;
		}

		for(let element of this.enabledWith){
			if(!element.checked) return false;
		}
		return true;
	}

	getRawValue(){
		let ret="";
		switch(this.type){
			case "text":
				ret=this.elements[0].value;
				break;
			case "date":
				ret=this.elements[0].value.replaceAll("-","/");
				break;
			case "checkbox":
				for(let element of this.elements){
					if(element.checked){
						if(ret!="") ret+=", ";
						ret+=element.value;
					}
				}
				break;
			case "radio":
				for(let element of this.elements){
					if(element.checked){
						ret=element.value;
						break;
					}
				}
				break;
		}

		return ret.trim();
	}

	getValue(){
		if(!this.isEnabled()){
			return "";
		}

		return this.getRawValue()+this.suffix;
	}

	validate(){
		if(!this.isEnabled()){
			return true;
		}

		let value=this.getRawValue();
		if(value==""){
			return !this.required;
		}

		return this.validator(this.getRawValue());
	}

	markInvalid(){
		let parents=this.elements;
		
		while(parents.length!=1){
			for(let element of parents){
				if(element.tagName=="HTML"){
					throw new Error("No common parent found.");
				}
			}

			parents=parents.parent();
		}

		parents.addClass("invalid");
	}

	save(id){
		localStorage.setItem(`${id}.${this.name}`,this.getRawValue());
	}

	load(id){
		let rawData=localStorage.getItem(`${id}.${this.name}`)??"";
		switch(this.type){
			case "text":
				this.elements[0].value=rawData;
				break;
			case "date":
				this.elements[0].value=rawData.replaceAll("/","-");
				break;
			case "checkbox":
				for(let element of this.elements){
					element.checked=rawData.split(", ").includes(element.value);
				}
				break;
			case "radio":
				for(let element of this.elements){
					element.checked=element.value==rawData;
				}
				break;
		}
	}
}

let confirm=$(".confirm");
let confirmContainer=$(".confirm-container");
function showConfirm(){
	$("html").css("overflow","hidden");
	confirmContainer.css("pointer-events","unset");
	confirmContainer.animate(
		{
			opacity: 1
		},
		200
	);
}

function hideConfirm(){
	$("html").css("overflow","auto");
	confirmContainer.animate(
		{
			opacity: 0
		},
		200
	);
	setTimeout(()=>{
		confirm.children().remove();
		confirmContainer.css("pointer-events","none");
		grecaptcha.reset(confirm.data("recaptchaId"));
		confirm.data("objectURLs")?.forEach(URL.revokeObjectURL);
	},200);
}

confirmContainer.click((event)=>{
	if($("div.confirm:hover").length==0) hideConfirm();
});
$(window).keydown((event)=>{
	if(event.keyCode==27) hideConfirm();
});

// TODO
//var onloadCallback=()=>{
//	console.log("onloadCallback");
//};

function notifyInvalid(errorElement,element,anchor,message){
	$(element)[0].scrollIntoView({behavior: "smooth"});
	$(".error-anchor").removeClass("error-anchor");
	$(anchor).addClass("error-anchor");
	errorElement.children()[0].innerText=message;
	errorElement.css("opacity",0);
	errorElement.animate(
		{
			opacity: 1
		},
		1000,
		"swing"
	);
	setTimeout(()=>{
		errorElement.animate(
			{
				opacity: 0
			},
			1000,
			"swing"
		);
	},4000);
}

class Form{
	static instances=[];

	constructor(id,items){
		this.id=id;
		this.items=items;
		this.name=$(`form#${this.id} h2`).text();
		this.files=$(`form#${this.id} div.files`);

		$(`form#${this.id}`).show();

		$(`form#${this.id} input.submit`).on("click",async (event)=>{
			event.preventDefault();

			$(".invalid").removeClass("invalid");
			let invalidFlag;
			for(let item of this.items){
				if(!item.validate()){
					item.markInvalid();
					invalidFlag=true;
				}
			}
			
			let files=await this.files.data("getFiles")();
			if(files.totalSize>emailjsMaxTotalFileSize){
				this.files.addClass("invalid");
				invalidFlag=true;
			}
			
			if(invalidFlag){
				let invalid=this.items.find((item)=>!item.validate());
				let element=invalid?.elements[0]??this.files[0];

				let message;
				if(invalid==undefined){
					message="ファイルサイズが制限を超えています。";
				}else if(invalid.getValue()==""){
					message="必須項目が未入力です。";
				}else{
					message=invalid.validator.message??"入力された値が無効です。";
				}
				notifyInvalid($("div#error-form"),element,invalid?.elements[invalid.elements.length-1]??element,message)
				return;
			}

			confirm.append(
				"<h2><big>確認内容の確認</big></h2>",
				"<p>送信内容をお確かめください。</p>"
			);

			let text=`========================================\n==       ${this.name}       ==\n========================================\n\n\n`;
			let email;
			let ul=$("<ul/>");
			for(let item of this.items){
				if(!item.isEnabled()) continue;

				let value=item.getValue();
				let textValue=(value || "(未記入)").split("\n").map(text=>"┃"+text).join("\n");
				if(value.includes("\n")){
					textValue=`┏━━━━━━━━━━━━━━━━━┉\n${textValue}\n┗━━━━━━━━━━━━━━━━━━━`;
				}else{
					textValue=`┏━━━━━┉\n${textValue}\n┗━━━━━━━`;
				}
				text+=`・${item.label}:\n${textValue}\n\n`;
				
				let li=$("<li/>");
				li.append($("<b/>").text(item.label));
				if(value==""){
					li.append('<i style="color: #7f7f7f;">未記入</i>');
				}else{
					li.append($("<p/>").text(value));
				}
				ul.append(li);

				if(item.elements[0].classList.contains("form-email")){
					if(email!=undefined) throw new Error("Multiple email addresses specified.");
					email=value;
				}
			}
			// let li=$("<li/>");
			// li.append($("<b/>").text("添付ファイル"));
			// if(files.files.length==0){
			// 	li.append('<i style="color: #7f7f7f;">添付ファイルなし</i>');
			// }else{
			// 	let objectURLs=[];
				
			// 	li.append($("<ul/>").append(
			// 		...files.files.map((file)=>{
			// 			let objectURL=URL.createObjectURL(file.file);
			// 			objectURLs.push(objectURL);

			// 			return $("<li/>").append($('<a target="_blank" />').text(file.name).attr("href",objectURL));
			// 		})
			// 	));

			// 	confirm.data("objectURLs",objectURLs);
			// }
			// ul.append(li);

			if(email==undefined) throw new Error("No email address specified.")

			let buttons=$('<div class="buttons" />');
			buttons.append($('<div id="g-recaptcha"></div>'));
			buttons.append(
				$('<input type="submit" value="修正する">').click((event)=>{
					event.preventDefault();
					hideConfirm();
				})
			);
			buttons.append(
				$('<input type="submit" value="送信">').click((event)=>{
					event.preventDefault();

					this.submitForm(email,text,files,recaptchaId);
				})
			);

			confirm.append(
				ul,
				"<p>上記の内容でよろしければ、「送信」ボタンをクリックしてください。</p>",
				$('<center><div id="g-recaptcha" /></center>'),
				buttons
			);
			let recaptchaId=grecaptcha.render(
				"g-recaptcha",
				{
					sitekey: grecaptchaSiteKey
					// TODO: エラーハンドリング
				}
			);
			confirm.data("recaptchaId",recaptchaId);
			showConfirm();
		});
		
		Form.instances.push(this);
	}

	// プランの金額的に添付ファイルは非対応
	submitForm(email,message,files,recaptchaId){
		console.log("\n\n\n\n\n\n\n\nsubmit!\n\n");
		console.log("\n"+message);

		let recaptchaResponse=grecaptcha.getResponse(recaptchaId);
		if(!recaptchaResponse){
			let element=$("#g-recaptcha");
			element.addClass("invalid");
			notifyInvalid($("div#error-confirm"),element,element,"reCAPTCHA認証を完了してください。");
			return;
		}

		emailjs.send(
			emailjsServiceId,
			emailjsTemplateId,
			{
				subject: this.name,
				email,
				message: message.replaceAll(" ","\u2060 \u2060"),
				"g-recaptcha-response": recaptchaResponse
			}
		).then(
			(result)=>{
				console.log("Submitted form data successfully!",result);

				hideConfirm();
				//clearForm();

				alert("フォームは正常に送信されました。");
			},
			(error)=>{
				console.error("An error occured while submitting form data.",error);
				alert("!! フォームを送信中にエラーが発生しました !!\n※フォームの内容はまだ送信されていません。お手数ですが、少し時間を空けてから再度送信してください。\n※何度もこのエラーが発生する場合は、eikou@wing.ocn.ne.jpにご連絡ください。");
			}
		);
	}

	clearStorage(){
		Object.keys(localStorage).forEach((key)=>{
			if(key.startsWith(this.id+".")){
				localStorage.removeItem(key);
			}
		});
	}

	save(){
		this.clearStorage();
		this.items.forEach((item)=>item.save(this.id));
		localStorage.setItem(`${this.id}.$date`,new Date().toISOString());
	}

	load(){
		let savedDateText=localStorage.getItem(`${this.id}.$date`);
		if(savedDateText==undefined || (new Date()-new Date(savedDateText))>1000*60*60*24){ //有効期限は24時間
			this.clearStorage();
		}

		this.items.forEach((item)=>item.load(this.id));
	}

	clearForm(){
		if(window.confirm("フォームの内容をクリアします。")){
			this.clearStorage();
			this.load();
			$(".invalid").removeClass("invalid");
		}
	}


	static saveAll(){
		this.instances.forEach((instance)=>instance.save());
	}

	static loadAll(){
		this.instances.forEach((instance)=>instance.load());
	}
}


function toHalfWidth(text){
	return text.replace("０","0")
		.replace("１","1")
		.replace("２","2")
		.replace("３","3")
		.replace("４","4")
		.replace("５","5")
		.replace("６","6")
		.replace("７","7")
		.replace("８","8")
		.replace("９","9")
		.replace("＋","+")
		.replace("－","-")
		.replace("ｰ","-")
		.replace("ー","-");
}

const validator={
	nonEmpty(text){
		return Boolean(text);
	},

	tel(text){
		text=toHalfWidth(text);

		if(text.startsWith("+")){
			text=text.substring(1);
		}
		if(text.startsWith("-") || text.endsWith("-")) return false;
		text=text.replaceAll("-","");
		return Array.from(text).every((char)=>"0123456789 ".includes(char));
	},

	email(text){
		// https://www.javadrive.jp/regex-basic/sample/index13.html
		return /^[a-zA-Z0-9_+-]+(.[a-zA-Z0-9_+-]+)*@([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}$/.test(text);
	},

	hour(text){
		let hourText=toHalfWidth(text);
		if(!/^[0-9]+$/.test(hourText)) return false;
		let hour=Number(hourText);
		return Number.isFinite(hour) && hour>=0 && hour<24;
	},

	confirm(name){
		let item=new FormItem(name,undefined,"");
		
		let validator=(text)=>{
			return text==item.getRawValue();
		};
		validator.message="同じ値を入力してください。";

		return validator;
	}
}

let estimateForm=new Form(
	"estimate",
	[
		new FormItem("name"),
		new FormItem("pic"),
		new FormItem("address"),
		new FormItem("tel",validator.tel),
		new FormItem("fax",validator.tel),
		new FormItem("email",validator.email),
		new FormItem("email-confirm",validator.confirm("email")),
		new FormItem("phone",validator.tel),
		new FormItem("type",undefined,"ご希望の工事種類"),
		new FormItem("type-details",undefined,"(その他の内容)",true,$('input[id="type.other"]')),
		new FormItem("details"),
		new FormItem("site-address"),
		new FormItem("send-method",undefined,"見積書送付方法"),
		new FormItem("send-to",undefined,"見積書送付先",true,$('input[id="send-method.post"]')),
		new FormItem("send-to-address",undefined,"(その他の内容)",true,[$('input[id="send-method.post"]')[0],$('input[id="send-to.other"]')[0]]),
		new FormItem("advance-notification",undefined,"事前電話連絡"),
		new FormItem("accompany",undefined,"見積もり時の現場への同行希望"),
		new FormItem("meet",undefined,"待ち合わせ場所",true,$('input[id="accompany.yes"]')),
		new FormItem("meet-address",undefined,"(その他の内容)",true,[$('input[id="accompany.yes"]')[0],$('input[id="meet.other"]')[0]]),
		new FormItem("time-1st",undefined,"希望年月日(第1希望)",true,$('input[id="accompany.yes"]')),
		new FormItem("date-1st",validator.hour,"時間(第1希望、24時間表記)",true,$('input[id="accompany.yes"]'),"時ごろ"),
		new FormItem("time-2nd",undefined,"希望年月日(第2希望)",true,$('input[id="accompany.yes"]')),
		new FormItem("date-2nd",validator.hour,"時間(第2希望、24時間表記)",true,$('input[id="accompany.yes"]'),"時ごろ"),
		new FormItem("entry",undefined,"弊社社員の敷地内立ち入り許可",true,$('input[id="accompany.no"]')),
		new FormItem("scaling",undefined,"測量の為のスケール当て許可",true,$('input[id="accompany.no"]')),
		new FormItem("note",undefined,"その他連絡事項")
	]
);

let contactForm=new Form(
	"contact",
	[
		new FormItem("contact-name"),
		new FormItem("contact-email",validator.email),
		new FormItem("contact-email-confirm",validator.confirm("contact-email")),
		new FormItem("contents",undefined,"お問合せ内容")
	]
);

Form.loadAll();
setInterval(()=>{
	Form.saveAll();
},5000);
