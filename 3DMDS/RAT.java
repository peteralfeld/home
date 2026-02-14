import java.io.*;

class RAT implements Serializable {

    INT numerator, denominator;

    boolean checked = false;

    RAT () {
    }

    RAT (long n) {
        checked = true;
      	numerator = new INT(n);
	denominator = new INT(1);
    }

    RAT (int n) {
        checked = true;
      	numerator = new INT((long) n);
	denominator = new INT(1);
    }

    RAT(INT I, INT J) {
        checked = false;
      	numerator = INT.copy(I);
	denominator = INT.copy(J);
    }

    RAT(long i, long j) {
        checked = false;
      	numerator = new INT(i); 
	denominator = new INT(j); 
	normalize();
    }

    static RAT copy(RAT copied) {
        RAT dummy = new RAT();
        dummy.checked = copied.checked;
        dummy.numerator = INT.copy(copied.numerator);
        dummy.denominator = INT.copy(copied.denominator);
        return dummy;
    }

    static RAT add(RAT A, RAT B) {
 	return new RAT(INT.add(INT.multiply(A.numerator, B.denominator),INT.multiply(A.denominator,B.numerator)),
      		       INT.multiply(A.denominator,B.denominator));
    }

    static RAT subtract(RAT A, RAT B) {
	return (new RAT(INT.subtract(INT.multiply(A.numerator, B.denominator),INT.multiply(A.denominator,B.numerator)),
      			INT.multiply(A.denominator,B.denominator)));
    }

    static RAT divide(RAT A, RAT B) {
        if (B.isZero()) {
	    INT.write(" dividing by zero ");
            int[] z = new int[1];
            z[1] = 0;
	}
	return (RAT.multiply(A, reciprocal(B)));
    }

    static RAT reciprocal(RAT A) {
	RAT result = new RAT();
        result.checked = A.checked;
	result.numerator = INT.copy(A.denominator);
	result.denominator = INT.copy(A.numerator);
	result.normalize();
	return result;
    }

    static RAT multiply(RAT A, RAT B) {
	return ((new RAT(INT.multiply(A.numerator,B.numerator),INT.multiply(A.denominator,B.denominator))));
    }

    static RAT simplify(RAT A) {
        if (!A.checked) {
	    A.normalize();
	    INT GCF = INT.gcf(A.numerator,A.denominator);
	    if (!GCF.isOne()) {
		RAT B = new RAT(INT.divide(A.numerator,GCF),INT.divide(A.denominator,GCF));
                B.checked = true;
                return B;
	    }
	    else {
		A.checked = true;
		return A;
	    }
	}
        else {
	    return A;
	}
    }

    void report(String s) {
	INT.write(s);
	numerator.report  (" numerator   ");
	denominator.report(" denominator ");
    }    

    static RAT pow(RAT A, int exponent) {
      	return new RAT(INT.pow(A.numerator,exponent), INT.pow(A.denominator,exponent));
    }

    void normalize() {
	if (denominator.negative) {
      	    denominator.negative = false;
	    numerator.negative = !numerator.negative;
      	}
    }
 
    void negate() {
        numerator.negative = !numerator.negative;
    }

    boolean isZero() {
	return numerator.isZero();
    }

    void tell(PrintWriter out, boolean quadruple, String comment) {
        String s = " ";
        if (!quadruple) {
	    s = s + floatIt(16) + " ";
	} 
	else {
	    s =  s + floatIt(32) + " " ;
	}
	s = s + numerator.value() + " " ;             
	s = s + denominator.value() + " ";            
	s = s + comment;          
	out.println(s);
    }

    void setZero() {
        numerator = new INT(0);
        denominator = new INT(1);
    }

    static RAT fac(long i) {
        if (i < 2) {
	    return new RAT(1,1);
	}
        else {
	    INT result = new INT(1);
            for (int j = 2; j <=i; j++) {
		result = INT.multiply(result,(new INT(j)));
	    }
	    return new RAT(result);
	}
    }

    RAT (INT I) {
	numerator = INT.copy(I);
        denominator = new INT(1);
    }				      


    boolean integer (double d) {
	int dint = (int) d;
        double dd = dint;
        return (dd == d);
    }

    String floatIt(int N) {
        normalize();
	INT P = numerator; 
        INT Q = denominator; 
        String result;
        double diff = P.log() - Q.log();
        if (integer(diff)) {
	    if (P.negative != Q.negative) {
		result = "-1.0E"+diff;
	    }
	    else {
		result = "1.0E"+diff; 
	    }
	}
        else {
	    int beta = 0;
	    if (diff >= 0.0) {
		beta = (int) diff + 1;
	    }
	    else {
		beta = (int) diff;
	    }
	    P = INT.multiply(P,INT.pow(new INT(10),N-beta));
	    if (P.negative != Q.negative) {
		result = "-0.";
	    }
	    else {
		result = "0.";
	    }
	    P.negative = false;
	    INT.divides(P,Q);
	    result = result + INT.ratio.value()+"E";
	    if (beta < 0) {
		result = result + beta;
	    }
	    else {
		result = result + "+" + beta;
	    }
	}
        return result;
    }


    static double extractDouble (RAT R) {
        if (R == null) {
	    return 0.0;
        }
        else {
            double result = INT.extractDouble(R.numerator)/INT.extractDouble(R.denominator);
            return result;
	}
    }

}
