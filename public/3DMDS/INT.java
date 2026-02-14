import java.io.*;

class INT implements Serializable {

    static int base = 1000000;

    static final double log10 = java.lang.Math.log(10);

    static int gcfCount = 0;

    static boolean initialized = false;

    static int baselength;
    static int words;
    static double logBase = 0.0;
    int length = 0;
    boolean negative = false;
    int[] digits;

    static INT ratio, remainder;

    INT() {
    }

    INT (long I) {
	int n;
	if (I == 0) {
	    n = 1;
	}
	else {
	    n = 0;
	    long res = I;
	    if (res < 0) {
		res = -res;
	    }
	    while (res > 0) {
		n++;
		res = (res - (res % base))/base;
	    }
	}
	length = n;
	digits = new int[n];
	if (I == 0) {
	    digits[0] = 0;
	}
	else {
	    long res = I;
	    if (res < 0) {
		res = -res;
	    }
	    int i = 0;
	    while (res > 0) {
		long rem = res % base; 
		digits[i] = (int) rem; 
		res = (res - rem) / base;
		i++;
	    }
	    if (I < 0) {
		negative = true;
	    }
	}
    }

    static INT fill(long I, int zeros) {
	if (zeros < 1) {
	    return new INT(I);
	}
	else {
	    INT K = new INT();
	    INT KK = new INT(I);
	    K.length = KK.length + zeros;
	    K.digits = new int[KK.length + zeros];
	    for (int i = 0; i < KK.length; i++) {
		K.digits[K.length - KK.length + i] = KK.digits[i];
	    }
	    return K;
	}
    }

    static INT copy (INT copied) {
	INT dummy = new INT();
	dummy.length = copied.length;
	dummy.digits = new int[dummy.length];
	for (int i = 0; i < dummy.length; i++) {
	    dummy.digits[i] = copied.digits[i];
	}
	dummy.negative = copied.negative;
	return dummy;
    }

    int mod() {
	int P = config.P;
        int result = digits[length-1] % P;
        for (int i = length-1; i > 0; i--) {
	    result = (result * base + digits[i-1]) % P;
	}
        if (negative) {
            result = P - result;
	}
        if (result > P/2) {
            result = result - P;
	}        
        return result;
    }

    static boolean greater(INT a, INT b) {
	if (a.length > b.length) {
	    return true;
	}
	else if (a.length < b.length) {
	    return false;
	}
	else {
	    for (int i = a.length-1; i >=0; i--) {
		if (a.digits[i] > b.digits[i]) {
		    return true;
		}
		else if (a.digits[i] < b.digits[i]) {
		    return false;
		}
	    }
	    return false;
	}
    }

    static boolean greaterOrEqual(INT a, INT b) {
	if (a.length > b.length) {
	    return true;
	}
	else if (a.length < b.length) {
	    return false;
	}
	else {
	    for (int i = a.length-1; i >=0; i--) {
		if (a.digits[i] > b.digits[i]) {
		    return true;
		}
		else if (a.digits[i] < b.digits[i]) {
		    return false;
		}
	    }
	    return true;
	}
    }



    static boolean divides(INT numerator, INT denominator) {
	/* divide is true if the remainder is zero, false otherwise */
	if (greater(denominator, numerator)) {
	    ratio = new INT(0); 
	    remainder = copy(numerator);
	    return false;
	}
	else if (denominator.isZero()) {
	    write(" dividing by zero ");
            int[] z = new int[1];
            z[1] = 0;
            return false;
	}
	else if (denominator.isOne()) {
	    remainder = new INT(0);
	    ratio = copy(numerator);
	    return true;
	}
	else {
	    approximateDivide(numerator, denominator);
	    INT oldRemainder = copy(remainder);
	    INT Ratio = INT.copy(ratio);
	    while(greaterOrEqual(remainder,denominator)) {
		INT residual = INT.copy(remainder);
		approximateDivide(residual, denominator);
		if (greater(remainder,oldRemainder)) {
		    write(" catastrophic error - no convergence in INT division - exiting");
		    numerator.report  (" numerator   ");
		    denominator.report(" denominator ");
		    write(" base = " + base);
		    System.exit(0);
		    return false;
		}
		else {
		    oldRemainder = copy(remainder);
		}
		Ratio = INT.add(Ratio,ratio);
	    }
	    ratio = INT.copy(Ratio);
	    if (remainder.isZero()) {
		return true;
	    }
	    else {
		return false;
	    }
	}
    }

    static void approximateDivide (INT numerator, INT denominator) {
	long n = extract(numerator); 
	long d = extract(denominator); 
	double r = ((double) n) / ((double) d); 
	int z = (int) (java.lang.Math.log(r)/java.lang.Math.log(base)+1-words);
	double scaled = r/java.lang.Math.pow(base,z); 
	long intPart = (long) scaled; 
	int zeros = z;
	if (numerator.length - words > 0) {
	    zeros = zeros + numerator.length - words;
	}
	if (denominator.length - words > 0) {
	    zeros = zeros - denominator.length + words;
	}
	if (zeros < 0) {
	    intPart = (long) (((double) intPart)/java.lang.Math.pow(base,-zeros));
	    zeros = 0;
	}
	ratio = INT.fill(intPart, zeros);
	if (numerator.negative != denominator.negative) {
	    ratio.negative = true;
	}
	remainder = INT.subtract(numerator,INT.multiply(denominator, ratio)); 
    }

    static long extract (INT I) {
	long result = I.digits[I.length-1];
	for (int i = 1; i < words; i++) {
	    int j = I.length - i - 1;
	    if (j >= 0) {
		result = base*result + I.digits[j];               
	    }
	    else {
		i = words;
	    }
	}
	return result;
    }

    static double extractDouble (INT I) {
  	double result = I.digits[I.length-1];
  	for (int i = 1; i < words+1; i++) {
	    int j = I.length - i - 1;
  	    if (j >= 0) {
  		result = base*result + I.digits[j];               
  	    }
  	    else {
  		i = words+1;
  	    }
  	}
        if (I.length > words + 1) {
            result = result*java.lang.Math.pow(base,I.length-words-1);
	}
        if (I.negative) { 
	    result = -result;
	}
	return result;
    }

    static INT multiply(INT I, INT J) {
	if (I.isZero() || J.isZero()) {
	    return new INT(0);
  	}
	else if (I.isOne()) {
	    return J;
  	}
	else if (J.isOne()) {
	    return I;
  	}
  	else {
  	    INT K = new INT();
	    int Length = I.length + J.length;
	    long[] Digits = new long[Length];
  	    for (int i = 0; i < I.length; i++) {
  		for (int j = 0; j < J.length; j++) {
  		    Digits[i+j] = Digits[i+j] + (long) I.digits[i] * (long) J.digits[j];
		}
	    }
	    int realLength = 0;
	    for (int i = 0; i < Length; i++) {
		if (Digits[i] != 0) {
		    realLength = i+1;
		}
	    }
	    for (int i = 0; i < realLength; i++) {
                if (Digits[i] > base - 1) {
		    long mult = Digits[i]/base;
                    Digits[i] = Digits[i] - mult*base;
                    Digits[i+1] = Digits[i+1] + mult;
		}
	    }
	    realLength = 1;
	    for (int i = 0; i < Length; i++) {
		if (Digits[i] != 0) {
		    realLength = i+1;
		}
	    }
            for (int i = 0; i < realLength; i++) {
		if (Digits[i] < 0 || Digits[i] > base-1) {
		    String s = " catastrophic error - failure to reconcile ";
                    for (int j = K.length-1; j>=0; j++) {
			s = s + " " + Digits[j];
		    }
                    write(s);
                    System.exit(0);
		}
	    }
	    K.length = realLength;
	    K.digits = new int[K.length];
	    for (int i = 0; i < K.length; i++) {
		K.digits[i] = (int) Digits[i];
	    }
	    Digits = null;
	    if (I.negative == J.negative) {
		K.negative = false;
	    }
	    else {
		K.negative = true;
	    }
            return K;
	}
    }

    static INT add(INT I, INT J) {
        if (I.isZero()) {
	    return J;
	}
        else if (J.isZero()) {
	    return I;
	}
	else {
	    INT K = new INT();
	    int length = I.length;
	    if (I.length < J.length) {
		length = J.length;
	    }
	    length = length + 1;
	    K.length = length;
	    K.digits = new int[length];
	    for (int i = 0; i < length; i++) {
		if (I.negative && J.negative) {
		    K.digits[i] = -I.Digits(i) - J.Digits(i);
		}
		else if (I.negative && !J.negative) {
		    K.digits[i] = -I.Digits(i) + J.Digits(i);
		}
		else if (!I.negative && J.negative) {
		    K.digits[i] = I.Digits(i) - J.Digits(i);
		}
		else {
		    K.digits[i] = I.Digits(i) + J.Digits(i);
		}
	    }
	    K.reconcile(); 
	    return K;
	}
    }

    static INT subtract(INT I, INT J) {
	INT K = INT.copy(J);
        K.negative = !K.negative;
        return INT.add(I,K);
    }

    boolean isOne() {
	if (length == 1 && !negative && digits[0] == 1) {
	    return true;
	}
	else{
	    return false;
	}
    }


    void reconcile() {
        int realLength = 0;
        negative = false;
        for (int i = 0; i < length; i++) {
	    if (digits[i] != 0) {
		realLength = i+1;
                if (digits[i] < 0) {
		    negative = true;
		}
                else {
                    negative = false;
		}
	    }
	}
        for (int i = 0; i < realLength; i++) {
	    if (negative) {
		while (digits[i] > 0) {
                    digits[i] = digits[i] - base;
                    digits[i+1] = digits[i+1] + 1;
		}
                while (digits[i] < 1 - base) {
                    digits[i] =  base + digits[i];
                    digits[i+1] = digits[i+1] - 1;
		}
                digits[i] = -digits[i];
	    }
            else {
		while (digits[i] < 0) {
                    digits[i] = digits[i] + base;
                    digits[i+1] = digits[i+1] - 1;
		}
                while (digits[i] > base - 1) {
                    digits[i] = digits[i] - base;
                    digits[i+1] = digits[i+1] + 1;
		}
	    }
	}
        if (negative) { 
	    digits[realLength] = -digits[realLength];
	}
        realLength = 1;
        for (int i = 0; i < length; i++) {
	    if (digits[i] != 0) {
		realLength = i+1;
	    }
	}
        length = realLength;
        for (int i = 0; i < length; i++) {
            if (digits[i] < 0 || digits[i] > base) {
		write(" catastrophic error - failure to reconcile ");
                report();
                String s = " digits: ";
                for (int j = length-1; j >= 0; j--) {
		    s = s + " " + digits[j];
 		}
                write(s);
                System.exit(0);
	    }
	}
    }

    String absValue() {
	String s = "";
        if (isZero()) {
	    s = "0";
	}
        else {
	    int k = 0;
	    for (int i = 0; i < length-1; i++) {
		k = digits[i];
		for (int j = 0; j < baselength; j++) {
		    int dgt = k % 10;
		    s = dgt + s;
		    k = (k - dgt)/10;
		}
	    }
	    k = digits[length-1];
	    for (int j = 0; j < baselength; j++) {
		if (k > 0) {
		    int dgt = k % 10;
		    s = dgt + s;
		    k = (k - dgt)/10;
		}
	    }
	}
        if (initialized) {
	    return s;
	}
	else {
            return("initialize INT - INT.init()");
	}
    } 

    String value() {
        if (negative) {
	    return(" - "+absValue());
	}
        else {
	    return absValue();
	}
    }

    int Digits(int i) {
	if (i >= 0 && i < length) {
	    return digits[i];
	}
        else {
            return 0;
	}
    }

    boolean isZero() {
	if (length == 1 && digits[0] ==0 ){
	    return true;
	}
        else {
            return false;
	}
    }

    void report() {
	report("");
    }


    void report(String s) {
        if (!initialized) {
	    write("INT not initialized - INT.init()");
	}
        else {
	    write(s + " integer of length " + length + " = " + value());
	}
    }

    static void write(String s) {
	System.out.println(s);
    }

    static void write() {
	System.out.println("");
    }

    static void init(int I) {
        base = I;
        init();
    }

    static void init() {
        gcfCount = 0;
	baselength = (int) (java.lang.Math.log((double) base) /
			    java.lang.Math.log((double) 10));
	if (java.lang.Math.pow(10.,baselength) < base) {
	    baselength++;
	}
        logBase = java.lang.Math.log(base)/log10;
        words = (int) (63/java.lang.Math.log(base)*java.lang.Math.log(2));
        if (java.lang.Math.pow(base,words) > java.lang.Math.pow(2,63) ) {
	    write(" words too large ... ");
            words--;
	}
        initialized = true;
    }

    static INT divide(INT A, INT B) {
	divides(A,B);
        return(copy(ratio));
    }

    static INT gcf(INT A, INT B)  {
        gcfCount++;
	if (A.isZero() && B.isZero()) {
	    return new INT(1);
	}
	else if (A.isZero()) {
	    return B;
	}
	else if (B.isZero()) {
	    return A;
	}
        else if (greater (B,A)) {
	    return gcf(B,A);
	}
        else {
            INT numerator = copy(A);
            INT denominator = copy(B);
            while (!divides(numerator,denominator)) {
		numerator = denominator;
                denominator = remainder;
	    }
            return denominator;
	}
    }

    static INT pow(INT A, int exponent) {
	if (exponent < 1) {
	    return new INT(1);
	}
        else {
            INT B = new INT(1);
            for (int i = 1; i <= exponent; i++) {
		B = INT.multiply(B,A);
	    }
            return(B);
	}
    }

    double doubleValue() {
	double result = digits[length-1];
        for (int i = 0; i < words; i++) {
	    int j = length - i -2;
            if (j >= 0) {
		result = result * base  + digits[j];
	    }
	    else {
		i = words;
	    }
	}
        if (length > words + 1) {
            result = result * java.lang.Math.pow(base,length - words -1);
	}
        if (negative) {
            result = -result;
	}
        return result;
    }

    double log() {
        double z = digits[length-1];
        for (int i = 1; i < words+1; i++) {
	    int j = length - i - 1;
            if (j >= 0) {
		z = base*z + digits[j];
	    } 
            else {
                i = words+1;
	    }
	}
        double result = java.lang.Math.log(z)/log10;
        if (length > words) {
	    result = result + (length-words-1)*logBase;
	}
	return result;
    }

    static INT fac(long i) {
        if (i < 2) {
	    return new INT(1);
	}
        else {
	    INT result = new INT(1);
            for (int j = 2; j <=i; j++) {
		result = INT.multiply(result,(new INT(j)));
	    }
	    return result;
	}
    }
}


 

