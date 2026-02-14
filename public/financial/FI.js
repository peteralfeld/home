/*
 * financial calcualator JS code
 * witten by Peter Alfeld
 * started August 6, 2025
 */

let N = 360; // N is the loan duration measured in months
let I = 0.5; // I is the interest rate given as a monthly percentage
let A = 100000; // A is the initial Loan Amount
let P = 599.55; // P is the monthly payment
let F = 0.0; // F is the future value

let debug = true; // the function Debug(outputstring) will write to the console if true

function Debug(outputstring) {
    if (debug) {
	console.log("debug: " + outputstring);
    }
}

let Schedule = "";
let eta = 1.0+I/100; // monthly multiplication factor

const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'decimal', // Use 'currency' and set 'currency' property for currency symbols
});

let Consistent = true; // The numbers in the text fields are consistent <==> Consistent

let Ready = false;

let cc = "cannot compute";

update(0);

function Z(xi) {
    if (xi != 0) {
	let alpha = (1+xi/100);
	return F-(alpha**N*A-P*(1.0-alpha**N)/(1-alpha));
    }
    else {
	return F+N*P;
    }
}

function Compute(what) { // cpmpute N
    Consistent = true;
    if (I != 0) {
	eta = 1.0+I/100.0;
	if (what == 1) {
	    let NN = Math.round(Math.log((F+P/(1-eta))/(A+P/(1-eta)))/Math.log(eta));
	    if (Number.isFinite(NN)) {
		N = NN;
	    }
	    else {
                Consistent = false;
		makeItRed();
		document.getElementById("tN").value = cc;
	    }
	}
	else if (what == 2) {
            if (Math.abs(Z(0.0)) < 1.0) {
		I = 0.0
	    }
	    else {
                let Start = 0.2;
                if (I < 0) {
		    Start = -Start;
		}
		let mult = 1.1;
		let alpha = Start/mult;
		let beta = Start*mult;
		let Alpha = Z(alpha);
		let Beta = Z(beta);
		while(Alpha*Beta > 0.0 && Number.isFinite(Alpha) && Number.isFinite(Beta)) {
		    alpha = alpha/mult;
		    beta = beta*mult;
		    Alpha = Z(alpha);
		    Beta = Z(beta);
		}
		let tol = 1E-8;
		while (Math.abs(beta - alpha) > tol && Number.isFinite(Alpha) && Number.isFinite(Beta)) {
		    let gamma = (alpha+beta)/2;
		    let Gamma = Z(gamma);
		    if (Alpha*Gamma < 0) {
			beta = gamma;
			Beta = Gamma;
		    }
		    else {
			alpha = gamma;
			Alpha = Gamma;
		    }
		}
                let II = (alpha+beta)/2;
		if (Number.isFinite(II) && Number.isFinite(Alpha) && Number.isFinite(Beta)) {
		    I = II;
		}
		else {
                    Consistent = false;
		    makeItRed();
		    document.getElementById("tI").value = cc;
		}
	    }
	}
	else if (what == 3) { // compute A
	    let AA = (F+(1-eta**N)/(1-eta)*P)/eta**N
	    if (Number.isFinite(AA)) {
		A = AA;
	    }
	    else {
                Consistent = false;
		makeItRed();
		document.getElementById("tA").value = cc;
	    }

	}
	else if (what == 4) { // compute P
	    let PP = -(F-eta**N*A)*(1-eta)/(1-eta**N);
	    if (Number.isFinite(PP)) {
		P = PP;
	    }
	    else {
                Consistent = false;
		makeItRed();
		document.getElementById("tP").value = cc;
	    }
	}
	else if (what == 5) { //compute F
	    let FF = eta**N*A-P*(1.0-eta**N)/(1-eta);
	    if (Number.isFinite(FF)) {
		F = FF;
	    }
	    else {
                Consistent = false;
		makeItRed();
		document.getElementById("tF").value = cc;
	    }
	}
    }
    else { // consider the case of zero interest
	if (what == 1) {
	    N = (A-F)/P;
	}
        if (what== 2) {
            I = 0.1;
	    Compute(2);
            if (!Consistent) {
		I = 0.0;
		makeItRed();
		document.getElementById("tI").value = cc;
	    }
	}
	else if (what == 3) { // compute A
	    A = F+N*P;
	}
	else if (what == 4) { // compute P
	    P = (A-F)/N;
	}
	else if (what == 5) { //compute F
	    F = A - N*P;
	}
    }
    document.getElementById("output").innerHTML = "";
    Schedule = "";
    if (Consistent) {
	update(0);
    }
}

function update(what) {
    if (what === 0) {
	document.getElementById("tN").value = ""+(N+0.4999).toFixed(0);
	document.getElementById("tI").value = ""+I.toFixed(6);
	document.getElementById("tA").value = "$"+formatter.format(A);
	document.getElementById("tP").value = "$"+formatter.format(P);
	document.getElementById("tF").value = "$"+formatter.format(F);
	Ready = true;
    }
    else {
	if (Ready && what == 1 ) {
	    let newN = parseInt(document.getElementById('tN').value,10);
	    if (Number.isFinite(newN) && newN >= 1) {N = newN;}
	}
	else if (Ready && what == 2) {
	    let newI = parseFloat(document.getElementById('tI').value,10);
	    if (Number.isFinite(newI)) {I = newI;}
	}
	else if (Ready && what == 3) {
	    let newA=parseFloat(document.getElementById('tA').value,10);
	    if (Number.isFinite(newA)) {A = newA;}
	}
	else if (Ready && what == 4) {
	    let newP=parseFloat(document.getElementById('tP').value,10);
	    if (Number.isFinite(newP)) {P = newP;} }
	else if (Ready && what == 5) {
	    let newF=parseFloat(document.getElementById('tF').value,10);
	    if (Number.isFinite(newF)) {F = newF; }
	}
	Consistent = false;
	document.getElementById("output").innerHTML = "";
	Schedule = "";
	update(0);
    }
    makeItWhite();
    if (Consistent) {
        makeItGreen();
    }
    else {
        makeItRed();
    } 
}

function makeItRed() {
    document.getElementById("tN").style.backgroundColor = "rgb(127,0,0)";
    document.getElementById("tI").style.backgroundColor = "rgb(127,0,0)";
    document.getElementById("tA").style.backgroundColor = "rgb(127,0,0)";
    document.getElementById("tP").style.backgroundColor = "rgb(127,0,0)";
    document.getElementById("tF").style.backgroundColor = "rgb(127,0,0)";
}

function makeItGreen() {
    document.getElementById("tN").style.backgroundColor = "rgb(0,127,0)";
    document.getElementById("tI").style.backgroundColor = "rgb(0,127,0)";
    document.getElementById("tA").style.backgroundColor = "rgb(0,127,0)";
    document.getElementById("tP").style.backgroundColor = "rgb(0,127,0)";
    document.getElementById("tF").style.backgroundColor = "rgb(0,127,0)";
}

function makeItWhite() {
    document.getElementById("tN").style.color = "rgb(255,255,255)";
    document.getElementById("tI").style.color = "rgb(255,255,255)";
    document.getElementById("tA").style.color = "rgb(255,255,255)";
    document.getElementById("tP").style.color = "rgb(255,255,255)";
    document.getElementById("tF").style.color = "rgb(255,255,255)";
}

function printSchedule() {
    if (!Consistent) {
	document.getElementById("output").innerHTML = " <B> provide consistent data first </B> ";
    }
    else {
	createSchedule();
	document.getElementById("output").innerHTML = Schedule;
    }
}

function createSchedule() {
    if (!Consistent) {
	document.getElementById("output").innerHTML = " <B> provide consistent data first </B> ";
    }
    else if (!Schedule === "") {
	return;
    }
    else {
	Schedule = "<H1> Payment Schedule </H1>";
	Schedule += "Loan Duration = " + (N+0.49999).toFixed(0);
	Schedule += "<BR>monthly interest rate = "+I.toFixed(6)+"%";
	Schedule += "<BR>Loan Amount = $"+formatter.format(A);
	Schedule += "<BR>monthly payment = $"+formatter.format(P);
	Schedule += "<BR>Future Value = $"+formatter.format(F);F;
	Schedule += "<BR><br>";
	Schedule += "<table><tr><td><B>month</B></td><td><B>balance</B></td><td><B>principal</B></td><td><B>interest</B></td></tr>"
	let totalInterest = 0.0;
	let i = 0;
	let a = A;
	let interest =0;
	let p = 0;
	while (i < N+1) {
	    Schedule += "<tr><td>"+i+"</td><td>$"+formatter.format(a)+"</td><td>$"+formatter.format(p)+"</td><td>$"+formatter.format(interest)+"</td></tr>";
	    interest = I/100*a; 
	    totalInterest += interest;
	    p = P-interest;
	    a = (1+I/100)*a - P;
	    i = i+1;
	}
	Schedule += "</table>";
	Schedule += "<BR><BR>";
	Schedule += "<BR> total payments = $" + formatter.format(N*P);
	Schedule += "<BR> total interest = $" + formatter.format(totalInterest); }
}

function exportHTML() {
    if (!Consistent) {
	document.getElementById("output").innerHTML = "<B>Provide consistent data first.</B>"; }
    else { 
	createSchedule();
    }
    let HTML = new Blob([Schedule], { type: "text/plain" }); 
    let HTMLurl = URL.createObjectURL(HTML); 
    let downloadLink = document.createElement('a'); 
    downloadLink.download = "Schedule.html"; 
    downloadLink.href= HTMLurl; 
    document.body.appendChild(downloadLink); 
    downloadLink.click(); 
    URL.revokeObjectURL(HTMLurl); 
    document.body.removeChild(downloadLink); 
}

function exportCSV() {
    if (!Consistent) {
	document.getElementById("output").innerHTML = "<B>Provide consistent data first.</B>"; }
    else { 
	let BS = ","; // Break String
        let NL = "\n";
	Schedule = BS + " Payment Schedule"+NL;
	Schedule += BS + "Loan Duration = " + (N+0.49999).toFixed(0)+NL;
	Schedule += BS + "monthly interest rate = "+I.toFixed(6)+"%"+NL;
	Schedule += BS + "Loan Amount = $"+A+NL;
	Schedule += BS + "monthly payment = $"+P+NL;
	Schedule += BS + "Future Value = $"+F+NL;
	Schedule += NL+NL;
	Schedule += "month" + BS + "balance" + BS + "principal" + BS + "interest";
	let totalInterest = 0.0;
	let i = 0;
	let a = A;
	let interest =0;
	let p = 0;
	while (i < N+1) {
            Schedule += NL;
	    Schedule +=+ i+BS+a+BS+p+BS+interest;
	    interest = I/100*a; 
	    totalInterest += interest;
	    p = P-interest;
	    a = (1+I/100)*a - P;
	    i = i+1;
	}
	Schedule += NL + NL + BS + "total = " + BS + N*P + NL;
	Schedule += BS + " total interest = " + BS + totalInterest +NL ;
    }
    let CSV = new Blob([Schedule], { type: "text/plain" });
    let CSVurl = URL.createObjectURL(CSV); 
    let downloadLink = document.createElement('a');
    downloadLink.download = "Schedule.csv"; 
    downloadLink.href= CSVurl; 
    document.body.appendChild(downloadLink); 
    downloadLink.click(); 
    URL.revokeObjectURL(CSVurl); 
    document.body.removeChild(downloadLink); 
}

function playBell1() {
    let bellAudio = document.getElementById('Bell1');
    bellAudio.currentTime = 0; // Rewind to the beginning for repeated plays
    bellAudio.play();
}

function playBell2() {
    let bellAudio = document.getElementById('Bell2');
    bellAudio.currentTime = 0; // Rewind to the beginning for repeated plays
    bellAudio.play();
}

function playWhistle1() {
    let whistleAudio = document.getElementById('Whistle1');
    whistleAudio.currentTime = 0; // Rewind to the beginning for repeated plays
    whistleAudio.play();
}

function playWhistle2() {
    let whistleAudio = document.getElementById('Whistle2');
    whistleAudio.currentTime = 0; // Rewind to the beginning for repeated plays
    whistleAudio.play();

}


document.getElementById("tN").addEventListener("change", function () {if (Ready) {update(1);} else return;});
document.getElementById("tI").addEventListener("change", function () {if (Ready) {update(2);} else return;});
document.getElementById("tA").addEventListener("change", function () {if (Ready) {update(3);} else return;});
document.getElementById("tP").addEventListener("change", function () {if (Ready) {update(4);} else return;});
document.getElementById("tF").addEventListener("change", function () {if (Ready) {update(5);} else return;});

document.getElementById("bN").addEventListener("click", function () {Compute(1);});
document.getElementById("bI").addEventListener("click", function () {Compute(2);});
document.getElementById("bA").addEventListener("click", function () {Compute(3);});
document.getElementById("bP").addEventListener("click", function () {Compute(4);});
document.getElementById("bF").addEventListener("click", function () {Compute(5);});
document.getElementById("Schedule").addEventListener("click", function () {printSchedule()});
document.getElementById("ExportHTML").addEventListener("click", function () {exportHTML()});
document.getElementById("ExportCSV").addEventListener("click", function () {exportCSV()});

document.getElementById("tN").addEventListener("click", function () {
    let C = document.getElementById("tN");
    let contents = C.value;
    if (contents == "" || contents == cc) {
	C.value = ""+(N+0.4999).toFixed(0);
    }
    else {
	C.value = "";
    }
});

document.getElementById("tI").addEventListener("click", function () {
    let C = document.getElementById("tI");
    let contents = C.value; 
    if (contents == "" || contents == cc) {
	C.value = ""+I.toFixed(6); 
    }
    else {
	C.value = ""; 
    }
});

document.getElementById("tA").addEventListener("click", function () {
    let C = document.getElementById("tA");
    let contents = C.value;
    if (contents == "" || contents == cc) {
	C.value = ""+"$"+formatter.format(A);
    }
    else {
	C.value = "";
    }
});

document.getElementById("tP").addEventListener("click", function () {
    let C = document.getElementById("tP");
    let contents = C.value;
    if (contents == "" || contents == cc) {
	C.value = ""+"$"+formatter.format(P);
    }
    else {
	C.value = "";
    }
});

document.getElementById("tF").addEventListener("click", function () {
    let C = document.getElementById("tF");
    let contents = C.value;
    if (contents == "" || contents == cc) {
	C.value = ""+"$"+formatter.format(F);
    }
    else {
	C.value = "";
    }
});


/* Remove the comment to activate popup window for future value

   const putF = document.getElementById('tF');
   const puF = document.getElementById('puF');

   putF.addEventListener('mouseover', (event) => {
   puF.style.display = 'block'; // Show the pop-up
   updateputFPosition(event); // Update its position
   });

   putF.addEventListener('mousemove', (event) => {
   updateputFPosition(event); // Keep updating position as mouse moves
   });

   putF.addEventListener('mouseout', () => {
   puF.style.display = 'none'; // Hide the pop-up
   });

   function updateputFPosition(event) {
   // Get the mouse coordinates
   const mouseX = event.clientX;
   const mouseY = event.clientY;
   // Set the pop-up's position (offset slightly from the cursor)
   puF.style.left = mouseX + 15 + 'px'; 
   puF.style.top = mouseY - 5 + 'px'; 
   }

   end popup window code */
