import java.util.*;
import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;
import java.net.*;

public class config extends Frame 
    implements MouseListener, MouseMotionListener, KeyListener, Runnable, Serializable {

    int xps = 612;
    int yps = 792;

    boolean hashed = false;

    boolean named = false;

    boolean partial = false;

    static int pasts = 0;

    boolean zeroDenominator;

    int[] steps; int LBgen, UBgen;

    static int Alpha = 255;

    Color BGdefault = Color.white;

    Color BG = BGdefault;

    Color[] edgeColor;
    Color boundaryEdge = new Color(0,0,0);
    Color interiorEdge = new Color(127,127,0);
    Color straightInterior = new Color(0,200,200);
    Color straightBoundary = new Color(0,0,255);

    int Events; int pending = -1;
    MouseEvent[] mEvents; 
    KeyEvent[] kEvents;
    ActionEvent[] aEvents;
    ItemEvent[] iEvents;

    int [][] gBCs;
    int ngbcs;

    int[] Notes;

    facet[] F;
    
    boolean bcsOnly = false;

    /* Notes [i] 
       =  0 no note
       =  1 mouse pressed
       =  2 mouse clicked
       =  3 mouse dragged
       =  4 mouse released
       =  5 mouse entered
       =  6 mouse exited
       =  7 mouse moved
       = 11 key typed
       = 21 Action Event
       = 22 Action Event from select class
       = 23 Item Event from select class
       = 24 Action Event from special class
       = 25 Item Event from special class
       = 26 Action Event from prime class
       = 27 Action Event from appearance class
       = 31 Action Event from ct class
       = 41 Action Event from dct class
       = 51 Action Event from ms class
       = 61 Action Event from wf class
       = 71 Action Event from ps class
       = 81 Action Event from dctf class
       = 91 Action Event from msf class
    */

    Thread doing = null;

    int AnlzM = -1;
    int AnlzN = -1;

    int density;

    int lb, ub1, ub2, ub;

    long modCount = 0;

    int extras = 0;

    String selected;

    boolean general = false;

    /* if general is true we are considering more 
       general conditions than face conditions */

    boolean fishy = false;

    boolean analyze = false;

    Dialog ask;

    boolean loaded = false;

    boolean SuperPresent = false, selectSuper = false; 
    int nSuper = 0, superProperties = 3;
    boolean facesPresent = false;

    boolean SpecialPresent = false, selectSpecial = false;    
    int nSpecial = 0, specialProperties = 2;
    int specialFace = -1;

    boolean listEqs = false;

    int[][] superConds; 
    boolean identical = false; /* eliminate identical equations if identical = true */

    int superMax = 10;
  
    /* superConds[i][j] contains information about the i-th
       super condition.  
       [i][0]: type: 1: vertex, 2: edge, 3: face
       [i][1]: index of vertex, edge, or face. 
       [i][2]: degree of smoothness conditions
    */

    int[][] specialConds; 
    int specialMax = 10;
  
    /* specialConds[i][j] contains information about the i-th
       special condition.  
       [i][0]: index of the face across which the condition holds.
       [i][1] domain point that forms the tip of the condition.
    */

    boolean showFaces = false;

    boolean numbers = false;

    int fileCount = 0;

    int selectedVertex = -1, selectedEdge = -1, selectedFace = -1, selectedTetrahedron = -1;

    int saveHeight, saveWidth;

    static int P = 2147483647; 
    int sofar = 0;
    int impliedOnes = 0;

    int rank = 0; /* rank is the number of linearly independent equations */

    int active, inactive, dim;

    int[] vs;

    int[] I, D, M; boolean[] bI, bM;

    int neq, Neqs, Nvars;

    hash A;
    int[][] AM;

    RAT[][] Anlz;
    double[][] AD;

    double[][] Astab;

    double xmin, xmax, ymin, ymax, xrange, yrange;
    double xxmin, xxmax, yymin, yymax;

    boolean BCsPrinted = false;

    boolean Remove = false;

    boolean someDps;
    
    double xminold, xmaxold, yminold, ymaxold;

    boolean zoomed = false; int xZoom0,yZoom0,xZoom1,yZoom1;
    boolean zoomDrawn = false; int oldZoomx, oldZoomy;

    int[] undos; int dones = -1, donesMax = 1000;

    Font f; FontMetrics fm;
    Font small = new Font("TimesRoman", Font.BOLD, 22);

    boolean coordsDrawn = false; 
    int xCoords = 0, yCoords = 0; 
    String coordinates = "";
    int whichCoords;
    Color coordColor = Color.white;

    Color strongly = new Color(0,0,150,Alpha);
    Color colInactive = new Color(127,127,127,Alpha);

    boolean silence = false;

    boolean hidden = true;

    Color[] inMDS, implied, uncertain; 


    Graphics g, oG; Image offscreenImage;

    double Q[][]; // an orthogonal matrix.  We view along the first column of Q.
    double dpDouble[][]; // floating point locations of the domain points
    double dpFlat[][]; // floating point locations of the domain point projections
    int dpInt[][]; // screen coordinates of domain points

    int d, r, configuration;

    int Diameter = 20; 

    boolean rotated;
    int xdown,ydown,xup,yup;
    Color fog = new Color(220,220,255);
    double[][] vfog;
    int[][] vFogInt;

    int[][] bcs;
    INT[][] INTbcs;

    int[][] vtcs, tets, faces, edges; 
    String vN[]; Color vC[];
    int[][] Faces, Edges; 
    int[][] dps; int nDps; 
    /* 
       dps lists the domain points.
       dps[i][0..V-1] are the indices in the generalized b-form.
       dps[i][V] contains more information on location
       0: vertex
       1: interior of edge
       2: interior of face
       k>2: distance to closest face is k-2
       dps[i][V+1] contains information on status (symbolized by color):
       0: black: does not enter smoothness conditions (inactive)
       1: green: does enter smoothness conditions, not yet assigned to MDS, not implied
       2: red: assigned to MDS
       3: blue: implied.
       4: black: strongly implied
       dps[i][V+2] = 1 if dp is drawn, 0 otherwise;
    */

    boolean Strong = true;
    boolean[][] nz;

    int[] sortedDps;

    String title = "";

    int N, T, E, V, VB, VI, EB, EI, TB, TI, faceCount, edgeCount; 
    boolean[] bFaces, bEdges, bVertices, dEdges;

    boolean[] shadeFaces;

    boolean first = true;  boolean starting = true;

    boolean LApresent = false;
    boolean GeometryPresent = false;

    int width, height;

    double border = 0.1;

    public config() {
	setBackground(BGdefault);
        saveHeight = 900;
        saveWidth = 900;
	setSize(saveWidth,saveHeight);
        if (!tv.batch) {
	    setVisible(true);
	}
        Events = 100;
        mEvents = new MouseEvent[Events];
        kEvents = new KeyEvent[Events];
        aEvents = new ActionEvent[Events];
        iEvents = new ItemEvent[Events];
        Notes = new int[Events];
        pending = -1;
	init();
    }

    void showVisible() {
        showVisible(false);
    }

    void showTotal() {
        showVisible(true);
    }

    void showVisible(boolean which) {
        int inactive = 0;
        int inMDS = 0;
        int implied = 0;
        int unassigned = 0;
        int visible = 0;
        int strongs = 0;
        for (int i = 0; i < nDps; i++) {
            if (dps[i][V+2] == 1 || which) {
                visible++;
		if (dps[i][V+1] == 0) {
		    inactive++;
		}
		else if (dps[i][V+1] == 1) {
                    unassigned++;
		}
		else if (dps[i][V+1] == 2) {
                    inMDS++;
		}
		else if (dps[i][V+1] == 3) {
                    implied++;
		}
		else if (dps[i][V+1] == 4) {
                    implied++;
                    strongs++;
		}
	    }
	}
        String s = "";
        if (!which) {
	    s = "vis.: " + visible;
	}
        else {
	    s = "tot: " + visible;
	}
        s = s + "  inact: " + inactive;
        s = s + "  MDS: " + inMDS;
        s = s + "  impl: " + implied;
        if (strongs > 0) {
	    s = s + " (" + strongs + " strg)";
	}
        s = s + "  unass: " + unassigned;
        mess(s);
    }

    void doubleE() {
	Events = 2*Events;
	MouseEvent[] mEs = new MouseEvent[Events];
	KeyEvent[] kEs = new KeyEvent[Events];
	ActionEvent[] aEs = new ActionEvent[Events];
        ItemEvent[] iEs = new ItemEvent[Events];
	int[] Ns = new int[Events];
	for (int i = 0; i < pending-1; i++) {
	    mEs[i] = mEvents[i];
	    kEs[i] = kEvents[i];
	    aEs[i] = aEvents[i];
	    iEs[i] = iEvents[i];
	    Ns[i] = Notes[i];
	}
	mEvents = new MouseEvent[Events];         
	kEvents = new KeyEvent[Events];
	aEvents = new ActionEvent[Events];
        iEvents = new ItemEvent[Events];
	Notes = new int[Events];
	for (int i = 0; i < pending-1; i++) {
	    mEvents[i] = mEs[i];
	    kEvents[i] = kEs[i];
	    aEvents[i] = aEs[i];
	    iEvents[i] = iEs[i];
	    Notes[i] = Ns[i];
	}
    }

    void addEvent(int note) {
        try{ 
	    pending++; 
	    if (pending >= Events) {
		doubleE();
	    }
	    Notes[pending] = note;
	    if (doing == null) {
		doing = new Thread(this);
		doing.start();
	    }
	}
        catch(java.lang.ArrayIndexOutOfBoundsException e) {;}
    }

    void addEvent(MouseEvent E, int note) {
        try {
	    pending++; 
	    if (pending >= Events) {
		doubleE();
	    }
	    mEvents[pending] = E;
	    Notes[pending] = note;
	    if (doing == null) {
		doing = new Thread(this);
		doing.start();
	    }
	}
        catch(java.lang.ArrayIndexOutOfBoundsException e) {;}
    }

    void addEvent(ActionEvent E, int note) {
        pending++;
        if (pending >= Events) {
            doubleE();
	}
	aEvents[pending] = E;
        Notes[pending] = note;
        if (doing == null) {
	    doing = new Thread(this);
            doing.start();
	}
    }

    void addEvent(KeyEvent E, int note) {
        pending++;
        if (pending >= Events) {
	    doubleE();
	}
	kEvents[pending] = E;
        Notes[pending] = note;
        if (doing == null) {
	    doing = new Thread(this);
            doing.start();
	}
    }

    void addEvent(ItemEvent E, int note) {
        pending++;
        if (pending >= Events) {
	    doubleE();
	}
	iEvents[pending] = E;
        Notes[pending] = note;
        if (doing == null) {
	    doing = new Thread(this);
            doing.start();
	}
    }

    public config(int i) {
	setBackground(BGdefault);
        saveHeight = 900;
        saveWidth = 900;
	setSize(saveWidth,saveHeight);
        if (!tv.batch) {
	    setVisible(true);
	}
    }

    public void flush() {
        pending = -1;
        mess("flushed event queue");
    }

    public void stop() {
        if (doing !=null) {
	    doing.stop(); 
            doing = null;
	    pending = -1;
            crosshair();
            if (LApresent) {
		startOver();
	    }
            drawIt();
            mess("stopping...");
	}
    }

    public void run() {
	while (pending >= 0) {
            int n = Notes[0];
            MouseEvent mE = null;
            KeyEvent kE = null;
            ActionEvent aE = null;
            ItemEvent iE = null;
            if ( n == 23 || n == 25 || n == 28) {
		iE = iEvents[0];
	    }
            else if (n < 10) {
		mE = mEvents[0];
	    }
            else if (n < 20) {
		kE = kEvents[0];
	    }
            else {
		aE = aEvents[0];
	    }
            try{
		for (int i = 0 ; i < pending; i++) {
		    Notes[i] = Notes[i+1];
		    aEvents[i] = aEvents[i+1];                
		    mEvents[i] = mEvents[i+1];                
		    kEvents[i] = kEvents[i+1];                
		}
	    }
            catch (java.lang.ArrayIndexOutOfBoundsException e) {
		doubleE();
		for (int i = 0 ; i < pending; i++) {
		    Notes[i] = Notes[i+1];
		    aEvents[i] = aEvents[i+1];                
		    mEvents[i] = mEvents[i+1];                
		    kEvents[i] = kEvents[i+1];                
		}
	    }
	    try {
		pending--;
		if (n == 1) {
		    MousePressed(mE);
		}           
		else if (n == 2) {
		    MouseClicked(mE);
		}           
		else if (n == 3) {
		    MouseDragged(mE);
		}           
		else if (n == 4) {
		    MouseReleased(mE);
		}           
		else if (n == 5) {
		    MouseEntered(mE);
		}           
		else if (n == 6) {
		    MouseEntered(mE);
		}           
		else if (n == 6) {
		    MouseExited(mE);
		}           
		else if (n == 7) {
		    MouseMoved(mE);
		}           
		else if (n == 11) {
		    KeyTyped(kE);	    
		}           
		else if (n == 21) {
		    tv.TV.ActionPerformed(aE);
		}           
		else if (n == 22) {
		    tv.Select.ActionPerformed(aE);
		}           
		else if (n == 23) {
		    tv.Select.ItemStateChanged(iE);
		}           
		else if (n == 24) {
		    tv.SPECIAL.ActionPerformed(aE);
		}           
		else if (n == 25) {
		    tv.SPECIAL.ItemStateChanged(iE);
		}           
		else if (n == 26) {
		    tv.PRIME.ActionPerformed(aE);
		}           
		else if (n == 27) {
		    tv.APPEARANCE.ActionPerformed(aE);
		}           
		else if (n == 28) {
		    tv.Star.ItemStateChanged(iE);
		}           
		else if (n == 31) {
		    tv.CT.ActionPerformed(aE);
		}           
		else if (n == 41) {
		    tv.dCT.ActionPerformed(aE);
		}           
		else if (n == 51) {
		    tv.MS.ActionPerformed(aE);
		}           
		else if (n == 61) {
		    tv.WF.ActionPerformed(aE);
		}           
		else if (n == 71) {
		    tv.PS.ActionPerformed(aE);
		}           
		else if (n == 71) {
		    tv.DCTF.ActionPerformed(aE);
		}           
		else if (n == 81) {
		    tv.MSF.ActionPerformed(aE);
		}           
	    }
	    catch (Exception e) {
		write(e.toString());
		e.printStackTrace();
	    }
	}
        doing = null;
    }

    public void start() {
    }

    int tau0(int r, int d) {
        return bico(d+3,3);
    }

    int tau1(int r, int d) {
        return bico(d+3-(r+1),3);
    }

    int tau2(int r, int d) {
	int result = 0;
        for (int k = r+1; k <=d; k++) {
	    result += bico(k,2)-bico(r,2)-2*r*(k-r);
	}
        return result;
    }

    int tau3(int r, int d) {
	int result = 0;
        for (int k = r+1; k <=d; k++) {
	    result += bico(k-1,2)-3*bico(r,2)+3*bico(2*r-k+1,2)
		-bico(3*r-2*k+2,2)-3*bico(k-r,2)+3*bico(k-2*r,2);
	}
        return result;
    }

    int kappa2(int r, int d) {
        return bico(d+3-2*(r+1),3);
    }

    int kappa3(int r, int d) {
        return bico(d+3-3*(r+1),3);
    }

    void Bounds() {
        if (steps == null) {
	    int a0 = 1;
	    int a1 = 2*N-2-TI+VI;
	    int a2 = TI+1-N-2*VI;
	    int a3 = VI;
	    int t0 = tau0(r,d);
	    int t1 = tau1(r,d);
	    int t2 = tau2(r,d);
	    int t3 = tau3(r,d);
	    int u0 = t0;
	    int u1 = t1;
	    int u2 = kappa2(r,d);
	    int u3 = kappa3(r,d);
	    lb = a0*t0 + a1*t1 + a2*t2 + a3*t3 - extras;
	    ub1 = a0*u0 + a1*u1 + a2*u2 + a3*u3;
	    ub2 = bub();
            if(ub2 < dim) {  
		ub2 = ub1; // calculation of ub2 may abort due to memory limitations
	    }
	    ub = min(ub1,ub2);
	    String s = " l.b. = " + lb;
	    if (LApresent) {
		if (dim == lb) {
		    s = s + " = ";
		}
		else if (dim > lb) {
		    s = s + " < " ;
		}
		else { 
		    s = s + " >! ";
		    fishy = true; 
		}
		s = s + "dim = " + dim;
		if (dim == ub) {
		    s = s + " = ";
		}
		else if (dim < ub) {
		    s = s + " < ";
		}
		else {
		    s = s + " >! ";
		    fishy = true;
		}
	    }
	    else {
		if (ub == lb) {
		    s = s + " = ";
		}            
		else if (ub > lb) {
		    s = s + " < ";
		}
		else {
		    s = s + " >! ";
		    fishy = true; 
		}
	    }
	    s = s + ub;
	    if (ub2 > ub1) {
		s = s + " = simple u.b.";
	    }
	    else {
		s = s + " = u.b.";
	    }
            if (fishy) {
		drawIt();
	    }
	    tv.TV.Status.setText(s);
	    write(s);
	    write(" simple upper bound = " + ub1 + " complex upper bound = " + ub2);
	    write(" " + comma(modCount) + " mods");
	    mess(s);
	}
	else {
            UBgen = 0;
            LBgen = 0;
            for (int i = 0; i < 28; i++) {
		UBgen += steps[i]*ub(i,r,d);
		LBgen += steps[i]*lb(i,r,d);
	    }
            write(" general assembly: LB = " + LBgen + " UB = " + UBgen);
	}
    }

    /* methods starting with P were introduced to conform to the paper */

    int Pn(int r) {
	return bico3(r+3);
    }

    int Pm2b(int r, int d) {
        return bico3(2*r-d+3);
    }

    int Pm3b(int r, int d) {
        return bico3(3*r-2*d+3);
    }

    int Pm4b(int r, int d) {
        return bico3(4*r-3*d+3);
    }

    int Pm1t(int r, int d) {
        int result = Pn(r);
        for (int k = r+1; k <=d; k++) {
	    result += bico2(r+2);
	}
        return result;
    }

    int Pm2t(int r, int d) {
        int result = Pn(r);
        for (int k = r+1; k <=d; k++) {
	    result += bico2(2*r+2-k);
	}
        return result;
    }

    int Pmto(int r, int d) {
        if (d > 2*r) {
	    return 0; 
	} 
	else{
	    int result = 0;
            for (int nu = d-r; nu <= r; nu++) {
		result +=(nu+1)*(d+1-nu);
	    }
            return result;
	}
    }


    int Pm3t(int r, int d) {
        int result = Pn(r);
        for (int k = r+1; k <= d; k++) {
            result += bico2(3*r+2-2*k);
	}
        return result;
    }

    int Pm3tf(int r, int d) {
        int result = 0;
        for (int nu = 0; nu <= r; nu++) {
	    result += ( bico2(3*r-2*nu-d+2) - 3*bico2(2*r-nu-d+1) );
	}
        return result;
    }

    int Pm3tp(int r, int d) {
        int result = 0;
        for (int nu = d-r; nu <= r; nu++) {
	    for (int mu = 0; mu <= nu; mu++) {
		result += ( d+1 - max(nu, d-r+mu) );
	    }
	}
        return result;
    }

    int Pm4tl(int r, int d) {
        int result = 0;
        for (int nu = d-r; nu <= r; nu++) {
	    for (int mu = 0; mu <= nu; mu++) {
		result += ( min(d,r+mu)+1 - max(nu,d-r+mu) );
	    }
	}
        return result;
    }

    int Pmtb(int r, int d) {
        int result = 0;
        for (int nu = 0; nu <=2*r-d; nu++ ){
	    result += (nu+1)*(r-nu+1);
	}
        return result;
    }

    int Pmt2b(int r, int d) {
        int result = 0; 
        for (int nu = 0; nu <= 3*r-2*d; nu++) {
	    result +=(nu+1)*(2*r-d-nu+1);
	}
        return result;
    }
 
    int Pm2tb(int r, int d) {
        int result = 0;
        for (int nu = 0; nu <=2*r-d; nu++) {
	    result += (nu+1)*(nu+1) - bico2(r-d+nu+1);
	}
        return result;
    }

    int Pms(int r, int d) {
        return Pn(d)-Pn(d-r-1);
    }

    int Pmts(int r, int d) {
        int result = 0;
        for (int nu = 0; nu <= r; nu++ ) {
	    result += (nu+1)*min(r+1,d-nu+1);
	}
        return result;
    }
			      
    int Pm2t2b(int r, int d) {
        int result = 0;
        for (int i = d-r; i <=r; i++) {
	    for (int j = max(d-r,r+1-i); j <= d-i; j++) {
		result += d-i-j+1;
	    }
	}
        return result;
    }

    int lb(int step, int r, int d) {
        int bound = 0;
        if (step == 0) {
	    bound = Pn(d);
	}
        else if (step == 1) {
            bound = Pn(d)-Pn(r);
	}
        else if (step == 2) {
            bound = Pn(d)-2*Pn(r);
	}
        else if (step == 3) {
            bound = Pn(d)-3*Pn(r);
	}
        else if (step == 4) { 
            bound = Pn(d)-4*Pn(r);
	}
        else if (step == 5) {   
            bound = Pn(d)-Pm1t(r,d);
	}
        else if (step == 6) {           
            bound = Pn(d)-2*Pm1t(r,d);
	}
        else if (step == 7) {           
            bound = Pn(d)-2*Pm1t(r,d)+Pn(r);
	}
	else if (step == 8) {
            bound = Pn(d)-3*Pm1t(r,d)+2*Pn(r);
	}
	else if (step == 9) {
            bound  = Pn(d)-3*Pm1t(r,d)+2*Pn(r);
	}
	else if (step == 10) {
            bound = Pn(d)-3*Pm1t(r,d)+3*Pn(r)-Pm3b(r,d);
	}
	else if (step == 11) {
	    bound = Pn(d)-4*Pm1t(r,d)+4*Pn(r) - Pm4b(r,d);
	}
	else if (step == 12) {
            bound = Pn(d)-4*Pm1t(r,d)+4*Pn(r) - Pm3b(r,d);
	}
      	else if (step == 13) {
            bound = Pn(d)-5*Pm1t(r,d)+6*Pn(r)-2*Pm3b(r,d);
	}
      	else if (step == 14) {
	    bound = Pn(d)-6*Pm1t(r,d)+8*Pn(r)-4*Pm3b(r,d)+Pm4b(r,d);
	}
      	else if (step == 15) {
	    bound = Pn(d)-Pm1t(r,d)-Pn(r);
	}        
      	else if (step == 16) {         
	    bound = Pn(d)-Pm1t(r,d)-2*Pn(r);
	}
      	else if (step == 17) {         
	    bound = Pn(d)-2*Pm1t(r,d);
	}
      	else if (step == 18) {         
            bound = Pn(d) - 3*Pm1t(r,d)+ 2*Pn(r) - Pm3b(r,d);
	}
      	else if (step == 19) {         
            bound = Pn(d) -Pms(r,d)-Pm1t(r,d)+Pn(r);
	}
      	else if (step == 20) {         
	    bound = Pn(d)-Pms(r,d)-2*Pm1t(r,d)+3*Pn(r)-Pm3b(r,d);
	}
      	else if (step == 21) {         
	    bound  = Pn(d) - Pms(r,d) - 3*Pm1t(r,d) + 5*Pn(r) - 3*Pm3b(r,d) + Pm4b(r,d);
	}
      	else if (step == 22) {         
            bound = Pn(d) - 2*Pms(r,d) + 2*Pn(r) - Pm2b(r,d) + Pm2t2b(r,d);
	}
      	else if (step == 23) {         
	    bound = Pn(d) - Pms(r,d);
	}
      	else if (step == 24) {         
	    bound = Pn(d)-2*Pms(r,d)+Pm1t(r,d);
	}
      	else if (step == 25) {         
            bound = Pn(d) - 3*Pms(r,d)+3*Pm1t(r,d) - Pm3t(r,d);
	}
      	else if (step == 26) {         
            if (d <=2*r) {
		bound =  - 4*(Pms(r,d) - 3*Pm1t(r,d) + 3* Pm2t(r,d) - Pm3tf(r,d));
	    }
            else {
                bound = Pn(d) - 4*Pms(r,d) + 6*Pm1t(r,d) - 4*Pm3t(r,d);
	    }
	}
      	else if (step == 27) {         
	    bound = Pn(d) - Pms(r,d) - Pn(r);
	}
        if (step < 0 || step > 27) {
	    write("lb: invalid assembly step: " + step);
            fishy = true;
	}
	return bound;
    }

    int ub(int step, int r, int d) {
        int bound = 0;
        if (step == 0) {
	    bound = Pn(d);
	}
        else if (step == 1) {
            bound = Pn(d)-Pn(r);
	}
        else if (step == 2) {
            bound = Pn(d)-2*Pn(r)+Pm2b(r,d);
	}
        else if (step == 3) {
            bound = Pn(d)-3*Pn(r)+3*Pm2b(r,d)-Pm3b(r,d);
	}
        else if (step == 4) { 
            bound = Pn(d)-4*Pn(r)+6*Pm2b(r,d)-4*Pm3b(r,d)+Pm4b(r,d);
	}
        else if (step == 5) {   
            bound = Pn(d)-Pm1t(r,d);
	}
        else if (step == 6) {           
            bound = Pn(d)-2*Pm1t(r,d)+Pmto(r,d);
	}
        else if (step == 7) {           
            bound = Pn(d)-2*Pm1t(r,d)+Pm2t(r,d);
	}
	else if (step == 8) {
            bound = Pn(d)-3*Pm1t(r,d)+2*Pm2t(r,d)+Pmto(r,d)-Pm3tp(r,d);
	}
	else if (step == 9) {
            bound  = Pn(d)-3*Pm1t(r,d)+3*Pm2t(r,d)-Pm3t(r,d);
	}
	else if (step == 10) {
	    bound = Pn(d)-3*Pm1t(r,d)+3*Pm2t(r,d)-Pm3tf(r,d);
	}
	else if (step == 11) {
	    bound = Pn(d)-4*Pm1t(r,d)+4*Pm2t(r,d)+2*Pmto(r,d)-4*Pm3tp(r,d)+Pm4tl(r,d);
	}
	else if (step == 12) {
            if (d <= 2*r ) {
		bound = 0;
	    }
            else {
                bound = Pn(d) - 4*Pm1t(r,d) + 5*Pm2t(r,d) - Pm3t(r,d) - Pm3tf(r,d);
	    }
	}
      	else if (step == 13) {
            if (d <= 2*r ) {
		bound = 0;
	    }
            else {
                bound = Pn(d) - 5*Pm1t(r,d) + 8*Pm2t(r,d) - 2*Pm3tf(r,d) - 2*Pm3t(r,d);
	    }
	}
      	else if (step == 14) {
            if (d <= 2*r ) {
		bound = 0;
	    }
            else {
                bound = Pn(d) - 6*Pm1t(r,d) + 12*Pm2t(r,d) - 4*Pm3t(r,d) - 4*Pm3tf(r,d);
	    }
	}
      	else if (step == 15) {
	    bound = Pn(d)-Pm1t(r,d)-Pn(r)+Pmtb(r,d);
	}        
      	else if (step == 16) {         
	    bound = Pn(d) - Pm1t(r,d) - 2*Pn(r) + 2*Pmtb(r,d)  + Pm2b(r,d) - Pmt2b(r,d);
	}
      	else if (step == 17) {         
            bound = Pn(d) - 2*Pm1t(r,d) - Pn(r) + Pm2t(r,d) + 2*Pmtb(r,d) - Pm2tb(r,d);
	}
      	else if (step == 18) {         
            bound = Pn(d) - Pn(r) - 3*(Pm1t(r,d) - Pm1t(2*r-d,r) - Pm2t(r,d) + Pm2t(2*r-d,r))
		- (Pm3tf(r,d) - Pm3tf(2*r-d,r));
	}
      	else if (step == 19) {         
	    bound = Pn(d)-Pms(r,d) - Pm1t(r,d) + Pmts(r,d);
	}
      	else if (step == 20) {         
            if (d <= 2*r ) {
		bound = 0;
	    }
            else {
                bound = Pn(d) - Pms(r,d)  - 2*Pm1t(r,d-r-1) + Pm2t(r,d-r-1);
	    }
	}
      	else if (step == 21) {         
            if (d <= 2*r ) {
		bound = 0;
	    }
            else {
                bound = Pn(d) - Pms(r,d)  - 3*Pm1t(r,d-r-1) + 3*Pm2t(r,d-r-1) - Pm3t(r,d-r-1);
	    }
	}
      	else if (step == 22) {         
            if (d <= 3*r ) {
		bound = 0;
	    }
            else {
                bound = Pn(d-2*r-2)-Pm1t(r,d)+2*Pmts(r,d);
	    }
	}
      	else if (step == 23) {         
	    bound = Pn(d-r-1);
	}
      	else if (step == 24) {         
	    bound = Pn(d-2*r-2);
	}
      	else if (step == 25) {         
	    bound = Pn(d-3*r-3);
	}
      	else if (step == 26) {         
	    bound = Pn(d-4*r-4);
	}
      	else if (step == 27) {         
	    bound = plus(Pn(d)-Pms(r,d)-Pn(r));
	}
        if (step < 0 || step > 27) {
	    write("ub: invalid assembly step: " + step);
            fishy = true;
	}
	return bound;
    }

    int max(int a, int b, int c) {
	return max(a,max(b,c));
    }

    int plus(int m) {
	if (m < 0) {
	    return 0;
	}
	else {
	    return m;
	}
    }

    static int bico3(int m) {
        if (m < 3) {
	    return 0;
	}
        else { 
	    long result = (m-2)*(m-1)*m;
	    return (int) (result/6);
	}
    }

    static int bico2(int m) {
        if (m < 2) {
	    return 0;
	}
        else { 
	    long result = (m-1)*m;
	    return (int) (result/2);
	}
    }


    void clb() {
        if (Strong) {
            boolean Batch = tv.batch;
            if (!LApresent || nz == null) {
		LAinit();
	    }
            boolean possible = true;
            checkStrong();
            for (int i = 0; i < Nvars; i++) {
		if (dps[i][V+1] == 3) {
		    possible = false;
                    i = Nvars;
		}
	    }
            if (possible) {
		waiting();
		mess ("computing combinatorial lower bound");
		int k = 0;
		int m = Neqs;
		int n = Nvars;
		int mactive = m;
		int nactive = n;
		int[] rows = new int[m];
		int[] cols = new int[n];
		for (int i = 0; i < m; i++) {
		    rows[i] = i;
		}
		for (int j = 0; j < n; j++) {
		    cols[j] = j;
		}
		int shoot = dim - nDps + n;
		for (int jj = n-1; jj >=k; jj--) {
		    int j = cols[jj];
		    if (dps[j][V+1] == 3) {
			possible = false;
			jj = n;
		    }
		    if (dps[j][V+1] == 2) {
			cols[jj] = cols[k];
			cols[k] = j;
			k++;
			jj++;
		    }
		}
		bar(k,shoot,Color.black,Color.orange);
		if (k > 0) {
		    boolean done = false;
		    while (!done) {
			done = true;
			for (int ii = 0; ii < mactive; ii++) {
			    int i = rows[ii];
			    int jnz = -1;
			    int nzs = 0;
			    for (int jj = k; jj < nactive; jj++) {
				int j  = cols [jj];
				if (nz[i][j]) {
				    jnz = jj;
				    nzs++;
				}
			    }
			    if (nzs <= 1) {
				if (nzs == 1) {
				    nactive--;
				    int dmy = cols[nactive];
				    cols[nactive] = cols[jnz];
				    cols[jnz] = dmy;
				    done = false;
				}                              
				mactive--;
				bar(mactive,m,Color.red,Color.black);
				rows[ii] = rows[mactive];
				rows[mactive] = i;
				ii--;
			    }
			}
		    }
		}
		int[] Cols = new int[nactive];
		int[] Rows = new int[mactive];
		double gain  = 0.0;
		int ipivot = 0;
		int jpivot = 0;
		while(ipivot > -1 && jpivot > -1) {
		    ipivot = -1;
		    jpivot = -1;
		    gain = 0.0;
		    for (int ii = 0; ii < mactive; ii++) {
			int i = rows[ii];
			for (int jj = k; jj < nactive; jj++) {
			    int j  = cols[jj];
			    if (nz[i][j]) {
				int K = k;
				int Mactive = mactive;
				int Nactive = nactive;
				for (int mu = 0; mu < mactive; mu++) {
				    Rows[mu] = rows[mu];
				}
				for (int nu  = k; nu < nactive; nu++) {
				    Cols[nu] = cols[nu];
				}
				for (int nnu = k; nnu < nactive; nnu++) {
				    int nu = Cols[nnu];
				    if (nz[i][nu] && nu != j) {
					Cols[nnu] = Cols[K];
					Cols[K] = nu;
					K++;
				    }
				}
				if (K > k) {
				    boolean Done = false;
				    while (!Done) {
					Done = true;
					for (int II = 0; II < Mactive; II++) {
					    int I = Rows[II];
					    int jnz = -1;
					    int nzs = 0;
					    for (int JJ = K; JJ < Nactive; JJ++) {
						int J  = Cols [JJ];
						if (nz[I][J]) {
						    jnz = JJ;
						    nzs++;
						}
					    }
					    if (nzs <= 1) {
						if (nzs == 1) {
						    Nactive--;
						    int dmy = Cols[Nactive];
						    Cols[Nactive] = Cols[jnz];
						    Cols[jnz] = dmy;
						    Done = false;
						}                              
						Mactive--;
						Rows[II] = Rows[Mactive];
						Rows[Mactive] = I;
						II--;
					    }
					}
				    }
				    boolean legit = true;
				    double newGain = 0;
				    newGain = ((double) (nactive - Nactive))/((double) ((K-k)*(K-k)));
				    if (newGain <= gain) {
					legit = false;
				    }
				    if (legit) {
					tv.batch = true;
					startOver();
					for (int JJ = 0; JJ < K; JJ++) {
					    int J = cols[JJ];
					    if (dps[J][V+1] != 1) {
						legit = false;
						JJ = K;
					    }
					    else {
						process(J);
					    }
					}
					if (legit) {
					    checkStrong();
					    for (int J = 0; J < n; J++) {
						if (dps[J][V+1] == 3) {
						    legit = false;
						    J = n;
						}
					    } 
					}
					tv.batch = Batch;
				    }
				    if (legit) {   
					ipivot = ii;
					jpivot = jj;
					gain = newGain;
				    }
				}
			    }
			}
		    }
		    if (ipivot > -1 && jpivot > -1) {
			int i = rows[ipivot];
			int K = k;
			for (int nnu = k; nnu < nactive; nnu++) {
			    int nu = cols[nnu];
			    if (nz[i][nu] && nu != cols[jpivot]) {
				cols[nnu] = cols[K];
				cols[K] = nu;
				K++;
			    }
			}
			k = K;
			bar(k,shoot,Color.black,Color.orange);
			boolean Done = false;
			while (!Done) {
			    Done = true;
			    for (int ii = 0; ii < mactive; ii++) {
				i = rows[ii];
				int jnz = -1;
				int nzs = 0;
				for (int jj = k; jj < nactive; jj++) {
				    int j  = cols [jj];
				    if (nz[i][j]) {
					jnz = jj;
					nzs++;
				    }
				}
				if (nzs <= 1) {
				    if (nzs == 1) {
					nactive--;
					int dmy = cols[nactive];
					cols[nactive] = cols[jnz];
					cols[jnz] = dmy;
					Done = false;
				    }                              
				    mactive--;
				    rows[ii] = rows[mactive];
				    rows[mactive] = i;
				    ii--;
				}
			    }
			}
		    }
		}
		tv.batch = Batch;
		startOver();
		for (int jj = 0; jj < k; jj++) {
		    process(cols[jj]);
		}
		checkStrong();
		int bound = k + nDps - n;
		mess(dim + " = dimension >= " + bound);
	    }
	    else {
		mess (" remove weak dependencies first ");
	    }
	}
        else {
	    mess(" Strong not set");
	}
        crosshair();
    }

    void cub() {
        if (Strong) {
            if (!LApresent) {
		LAinit();
	    }
            int m = Neqs;
            int n = Nvars;
            int[] rows = new int[m];
            int[] cols = new int[n];
	    for (int i = 0; i < m; i++) {
		rows[i] = i;
	    }
            for (int j = 0; j < n; j++) {
                cols[j] = j;
	    }
            int k = 0;
	    mess ("computing combinatorial upper bound");
            int rowIgnore = m;
            int colIgnore = n;
            for (int jj = 0; jj < colIgnore; jj++) {
                int j = cols[jj];
		if (dps[j][V+1] == 2) {
		    colIgnore--;
                    cols[jj] = cols[colIgnore];
                    cols[colIgnore] = j;
		    jj--;
		}
	    }
            while (k < rowIgnore && k < colIgnore) {
                /* first elimnate rows with non-zeros in the first k-1 columns */
                for (int ii = k; ii < rowIgnore; ii++) {
                    int i = rows[ii];
		    boolean zero = true;
                    for (int jj = 0; jj < k; jj++) {
                        int j = cols[jj];
			if (nz[i][j]) {
                            zero = false;
                            jj = k;
			}
		    }
                    if (!zero) {
			rowIgnore--;
                        rows[ii] = rows[rowIgnore];               
			rows[rowIgnore] = i;
			ii--;
		    }
		}
                if (k < rowIgnore && k < rowIgnore) {           
		    /* find the column with the smallest number of non-zeros */
		    int nzMin = m + 1;
                    int jpivot = -1;
		    for (int jj = k; jj < colIgnore; jj++) {
			int j = cols[jj];
			int nzs = 0;
			for (int ii = k; ii < rowIgnore; ii++) {
			    int i = rows[ii];
			    if (nz[i][j]) {
				nzs++;
			    }
			}
			if (nzs == 0) {
			    colIgnore --;
                            cols[jj] = cols[colIgnore];
			    cols[colIgnore] = j;
			    jj--;
			}
			else if (nzs < nzMin) {
			    nzMin = nzs;
			    jpivot = jj;
			}
		    }
                    if (jpivot > -1) { 
			/* we found a new good column - 
			   find the row with the fewest non-zeros*/
                        int ipivot = -1;
                        int jpiv = cols[jpivot];
                        nzMin = n + 1;
                        for (int ii = k; ii < rowIgnore; ii++) {
                            int i = rows[ii];
			    if (nz[i][jpiv]) {
				int nzs = 0;
                                for (int jj = k; jj < colIgnore; jj++) {
                                    int j = cols[jj];
				    if (nz[i][j]) {
                                        nzs++;
                                    }
				}
                                if (nzs < nzMin) {
				    nzMin = nzs;
                                    ipivot = ii;
				}
			    }
			}
			int dmy = rows[k];
                        rows[k] = rows[ipivot];
                        rows[ipivot] = dmy;
			dmy = cols[k];
                        cols[k] = cols[jpivot];
                        cols[jpivot] = dmy;
                        bar(k,nDps-dim,Color.yellow,Color.black);
			k++;
		    }
		}
	    }
            int bound = nDps - k;
            if (dim == bound) {
                startOver();
		for (int jj = n-1; jj >= k; jj--) {
		    process(cols[jj]);
		}
		checkStrong();
	    }
	    mess(dim + " = dimension <= " + bound);
	}
    }

    void startOver() {
        for (int i = 0; i < nDps; i++) {
	    if (dps[i][V+1] > 0) {
		dps[i][V+1] = 1;
	    }
	}
        for (int i = 0; i < active; i++) {
	    bM[i] = false;
	}
	sofar = inactives();
        impliedOnes = 0;
        drawIt();
	if (tv.WF != null) {
	    tv.WF.vdone = false;
	    tv.WF.edone = false;
	    tv.WF.fdone = false;
	}
	if (tv.PS != null) {
	    tv.PS.vdone = false;
	    tv.PS.edone = false;
	    tv.PS.fdone = false;
	}
	if (tv.DCTF != null) {
	    tv.DCTF.vdone = false;
	    tv.DCTF.edone = false;
	    tv.DCTF.fdone = false;
	}
	if (tv.MSF != null) {
	    tv.MSF.vdone = false;
	    tv.MSF.edone = false;
	    tv.MSF.fdone = false;
	}
        report();
    }

    void initSuper() {
	selectSuper = true;
        selectSpecial = false;
        tv.Special.setBackground(Color.red);      
	if (tv.SPECIAL != null) {
	    tv.SPECIAL.setVisible(false);
	    tv.SPECIAL = null;
	}
	if (LApresent) {
            innocent();
            activate();
	}
        if (superConds == null) {
	    superConds = new int[superMax][superProperties];
	}        
	drawIt();
    }

    void initSpecial() {
        selectSpecial = true;
        selectSuper = false;
        tv.Super.setBackground(Color.red);      
        if (LApresent) {
            innocent();
            activate();
	}
        if (specialConds == null) {
	    specialConds = new int[specialMax][specialProperties];
	}        
	drawIt();
    }

    void decSuper() {
	for (int i = 0; i < nDps; i++) {
	    dps[i][V+1] = 0;
	}
        activate();
	nSuper--;
	for (int i = 0; i < nSuper; i++) {
	    activateSuper(i);
	}
	indicateSuper();
	drawIt();
    }

    void decSpecial() {
	for (int i = 0; i < nDps; i++) {
	    dps[i][V+1] = 0;
	}
        activate();
	nSpecial--;
	for (int i = 0; i < nSpecial; i++) {
	    activateSpecial(i);
	}
	indicateSpecial();
	drawIt();
    }


    void indicateSuper() {
        String s = "";
        if (nSuper == 0) {
	    s = "no super";
	}
        else {
            int i = nSuper - 1;
            s = i + ": ";
	    int index = nSuper - 1;
	    if (superConds[index][0] == 1) {
		s = s + "V " + superConds[index][1];
	    }
	    else if (superConds[index][0] == 2) {
		int edge = superConds[index][1];
		s = s +  "E " +edges[edge][0] + " " + edges[edge][1];
	    }
	    else if (superConds[index][0] == 3) {
		int face = superConds[index][1];
		s = s + "F " + faces[face][0] + " " + faces[face][1] + " " + faces[face][2];
	    }
	    s = s + " --- " + superConds[index][2];
	}
        tv.Status.setText(s);
    }
       
    void indicateSpecial() {
        String s = "";
        if (nSpecial == 0) {
	    s = "no special";
	}
        else {
            int i = nSpecial - 1;
            s = i + ": " + specialConds[i][0] 
		+ " " + specialConds[i][1];
	}
        tv.Status.setText(s);
    }

    void listSuper() {
        if (nSuper == 0) {
	    write(" no super conditions");
	}
        else {
            for (int i = 0; i < nSuper; i++) {
		String s = i + ": ";
		if (superConds[i][0] == 1) {
		    s = s + "V " + superConds[i][1];
		}
		else if (superConds[i][0] == 2) {
		    int edge = superConds[i][1];
		    s = s + "E " + edges[edge][0] + " " + edges[edge][1];
		}
		else if (superConds[i][0] == 3) {
		    int face = superConds[i][1];
		    s = s + "F " + faces[face][0] + " " + faces[face][1] + " " + faces[face][2];
		}
		s = s + " --- " + superConds[i][2];
		write(s);
	    }
	}
    }

    int count (int i) {
	int result = 0;
        for (int j = 0; j < V; j++) {
	    if (dps[i][j] > 0) {
		result++;
	    }
	}
        return result;
    }

    void listSpecial() {
        if (nSpecial == 0) {
	    write(" no special conditions");
	}
        else {
            for (int i = 0; i < nSpecial; i++) {
                int face = specialConds[i][0];
                int w = specialConds[i][1];
                int i0 = faces[face][0];
                int i1 = faces[face][1];
                int i2 = faces[face][2];
                String s = i + " face: " + nameV(i0) + " " + nameV(i1) + " " + nameV(i2) + " - " ;
		int vtx = -1;
                for (int j = 0; j < V; j++) {
		    if (j != i0 && j != i1 && j !=i2 && dps[w][j] > 0) {
			vtx = j;
                        j = V;
		    }
		}
                s = s + nameV(vtx) + " : " + dps[w][i0] + " " + dps[w][i1] + " " + dps[w][i2] + " " + dps[w][vtx];
                write(s);
	    }
	}
    }

    void wSuper() {
        if (SuperPresent) {
	    try {
		String file = tv.fileName.getText() + ".super";
		PrintWriter out = new PrintWriter(new FileOutputStream(file));
                out.println(nSuper + " " + nSpecial);
                for (int i = 0; i < nSuper; i++) {
		    out.println(superConds[i][0]+ " " + superConds[i][1] + " " + superConds[i][2]);
		}
                for (int i = 0; i < nSpecial; i++) {
                    out.println(specialConds[i][0] + " " + specialConds[i][1]);
		}
                out.close();
	    }
	    catch(java.io.FileNotFoundException e) {
		write(" file not found " + e);
	    }
	    catch(java.io.IOException e) {
		write(" IOException " + e);
	    }
	}
    }

    void rSuper() {
        try{         
	    String file = tv.fileName.getText() + ".super";
	    FileInputStream is = new FileInputStream(file);
	    BufferedReader input = new BufferedReader(new InputStreamReader(is));
	    String line = input.readLine().trim();
	    line = line.trim();
	    int k = line.indexOf(" ");
	    nSuper = Integer.parseInt(line.substring(0,k).trim());
	    nSpecial = Integer.parseInt(line.substring(k,line.length()).trim()); 
	    LApresent = false;
	    GeometryPresent = false;
            SuperPresent = true;
            if (nSuper > 0) {
		superConds = new int[nSuper][3];
	    }
            if (nSpecial > 0) {
                specialConds = new int[nSpecial][2];
	    }
            for (int i = 0; i < nSuper; i++) {
		line = input.readLine().trim();
		k = line.indexOf(" ");
		superConds[i][0] = Integer.parseInt(line.substring(0,k).trim());
		line = line.substring(k,line.length()).trim();
		k = line.indexOf(" ");
		superConds[i][1] = Integer.parseInt(line.substring(0,k).trim());
		superConds[i][2] = Integer.parseInt(line.substring(k,line.length()).trim());
	    }
            for (int i = 0; i < nSpecial; i++) {
		line = input.readLine().trim();
		k = line.indexOf(" ");
		specialConds[i][0] = Integer.parseInt(line.substring(0,k).trim());
		specialConds[i][1] = Integer.parseInt(line.substring(k,line.length()).trim());
	    }
            input.close();
            drawIt();
	}
        catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	}
        catch(java.io.IOException e) {
	    write(" IOException " + e);
	}
    }

    void wDps() {
	if (LApresent) {
	    try {
		String file = tv.fileName.getText() + ".MDS";
		PrintWriter out = new PrintWriter(new FileOutputStream(file));
		int N = 0;
		for (int i = 0; i < nDps; i++) {
		    if (dps[i][V+1] == 2) {
			N++;
		    }
		}
		out.println(N);
		for (int i = 0; i < nDps; i++) {
		    if (dps[i][V+1] == 2) {
			out.println(""+i);
		    }
		}
		out.close();
	    }
	    catch(java.io.FileNotFoundException e) {
		write(" file not found " + e);
	    }
	    catch(java.io.IOException e) {
		write(" IOException " + e);
	    }
	}
        else {
	    write ("initialize linear algebra");
	}
    }

    void rDps() {
        try{         
	    String file = tv.fileName.getText() + ".MDS";
	    FileInputStream is = new FileInputStream(file);
	    BufferedReader input = new BufferedReader(new InputStreamReader(is));
            if (!LApresent) {
		LAinit();
	    }
            for (int i = 0; i < nDps; i++) {
                if (dps[i][V+1] > 0) {
		    dps[i][V+1] = 1;
		}
	    }
	    String line = input.readLine().trim();
	    int N = Integer.parseInt(line);
            for (int i = 0; i < N; i++) {
		line = input.readLine().trim();
                int n = Integer.parseInt(line);
                if (dps[n][V+1] == 1) {
		    process(n);
		}          
                else {
                    write(" cannot add " + i + "-th point number " + n);
		}
	    }      
            input.close();
            checkStrong();
	}
        catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	}
        catch(java.io.IOException e) {
	    write(" IOException " + e);
	}
    }


    void gv() {
        try {
	    String file = tv.fileName.getText() + ".off";
	    PrintWriter out = new PrintWriter(new FileOutputStream(file));
            out.println("OFF");
            /* count points and polygons */
            int points = 0;
            int polygs = 0;
            /* edges: */
            points = points + V;
            polygs = polygs + E;
            /* visible domain points - tetrahedra for points still to be determined,
	       octahedra for points in MDS
	       cubes for implied points */
            for (int i = 0; i < nDps; i++) {
                if (dps[i][V+2] == 1) {
		    /* point is visible */
                    if (dps[i][V+1] == 1) {
                        /* tetrahedron */
                        points = points + 4;
                        polygs = polygs + 4;
		    }
                    else if (dps[i][V+1] == 2) {
                        /* octahedron */
                        points = points + 6;
                        polygs = polygs + 8;
		    }
                    else if (dps[i][V+1] == 3 || dps[i][V+1] == 4) {
                        /* hexahedron */
                        points = points + 8;
                        polygs = polygs + 6;
		    }
		}
	    }
            if (showFaces) {
		polygs = polygs + T;
	    }
            out.println(points + " " + polygs + " 0");
            /* compute radius of symbols */
            double radius = 200000000.0;
            for (int i = 0; i < E; i++) {
		double x0 = dpDouble[vs[edges[i][0]]][0]-dpDouble[vs[edges[i][1]]][0];
		double x1 = dpDouble[vs[edges[i][0]]][1]-dpDouble[vs[edges[i][1]]][1];
		double x2 = dpDouble[vs[edges[i][0]]][2]-dpDouble[vs[edges[i][1]]][2];
                double h = sqrt(x0*x0+x1*x1+x2*x2);
                if (radius > h) {
		    radius = h;
		}
	    }
            radius = radius/3/(d+1);
            if (radius < 0.05) {
		radius = 0.05;
	    }
	    double c = 0.866;
	    double s = sqrt(1.0-c*c);
	    double cr = c*radius;
	    double sr = s*radius;
	    double ccr = c*cr;
	    double csr = c*sr;
            double z0 = 0.0, z1 = 0.0, z2 = 0.0;
            double radius2 = radius/2;
            for (int i = 0; i < V; i++) {
                double x0 = dpDouble[vs[i]][0];
                double x1 = dpDouble[vs[i]][1];
                double x2 = dpDouble[vs[i]][2];
                out.println(x0 + " " + x1 + " " + x2);
	    }
            for (int i = 0; i < nDps; i++) {
                if (dps[i][V+2] == 1 && dps[i][V] < 3+r) {
		    /* point is visible */
                    double x0 = dpDouble[i][0];
                    double x1 = dpDouble[i][1];
                    double x2 = dpDouble[i][2];
                    if (dps[i][V+1] == 1) {
                        /* tetrahedron */
                        z2 = x2 + radius; out.println(x0 + " " + x1 + " " + z2);
                        z1 = x1 + cr; z2 = x2-sr; out.println(x0 + " " + z1 + " " + z2);
                        z0 = x0+ccr; z1 = x1-csr; z2 = x2-sr; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0-ccr; z1 = x1-csr; z2 = x2-sr; out.println(z0 + " " + z1 + " " + z2);
		    }
                    else if (dps[i][V+1] == 2) {
                        /* octahedron */
                        z2 = x2 + radius; out.println(x0 + " " + x1 + " " + z2);
                        z1 = x1 + radius; out.println(x0 + " " + z1 + " " + x2);
                        z0 = x0 + radius; out.println(z0 + " " + x1 + " " + x2);
                        z1 = x1 - radius; out.println(x0 + " " + z1 + " " + x2);
                        z0 = x0 - radius; out.println(z0 + " " + x1 + " " + x2);
                        z2 = x2 - radius; out.println(x0 + " " + x1 + " " + z2);
		    }
                    else if (dps[i][V+1] == 3 || dps[i][V+1] == 4) {
                        /* hexahedron */
                        z0 = x0 + radius2 ; z1 = x1 + radius2; z2 = x2 + radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 - radius2 ; z1 = x1 + radius2; z2 = x2 + radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 - radius2 ; z1 = x1 - radius2; z2 = x2 + radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 + radius2 ; z1 = x1 - radius2; z2 = x2 + radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 + radius2 ; z1 = x1 + radius2; z2 = x2 - radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 - radius2 ; z1 = x1 + radius2; z2 = x2 - radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 - radius2 ; z1 = x1 - radius2; z2 = x2 - radius2; out.println(z0 + " " + z1 + " " + z2);
                        z0 = x0 + radius2 ; z1 = x1 - radius2; z2 = x2 - radius2; out.println(z0 + " " + z1 + " " + z2);
		    }
		}
	    }
            /* list polygons */
            for (int i = 0; i < E; i++) {
                out.println(2 + " " + edges[i][0] + " " + edges[i][1] + " 0 0 0 ");
	    }
            int pointBase = V;
            for (int i = 0; i < nDps; i++) {
                if (dps[i][V+2] == 1 && dps[i][V] < 3+r) {
		    /* point is visible */
                    int location = dps[i][V];
                    int R = 0, G = 0, B = 0;
                    if (dps[i][V+1] == 1) {
                        /* tetrahedron */
			int i0 = pointBase;
			int i1 = pointBase + 1;
			int i2 = pointBase + 2;
			int i3 = pointBase + 3;
			R = uncertain[location].getRed();
			G = uncertain[location].getGreen();
                        B = uncertain[location].getBlue();
			out.println(3 + " " + i0 + " " + i1 + " " + i2 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i0 + " " + i1 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i0 + " " + i2 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i1 + " " + i2 + " " + i3 + " " + R + " " + G + " " + B);
                        pointBase = pointBase+4;
		    }
                    else if (dps[i][V+1] == 2) {
                        /* octahedron */
			int i0 = pointBase;
			int i1 = pointBase + 1;
			int i2 = pointBase + 2;
			int i3 = pointBase + 3;
			int i4 = pointBase + 4;
			int i5 = pointBase + 5;
			R = inMDS[location].getRed();
			G = inMDS[location].getGreen();
                        B = inMDS[location].getBlue();
			out.println(3 + " " + i0 + " " + i1 + " " + i2 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i0 + " " + i2 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i0 + " " + i3 + " " + i4 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i0 + " " + i4 + " " + i1 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i5 + " " + i1 + " " + i2 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i5 + " " + i2 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i5 + " " + i3 + " " + i4 + " " + R + " " + G + " " + B);
			out.println(3 + " " + i5 + " " + i4 + " " + i1 + " " + R + " " + G + " " + B);
                        pointBase = pointBase+6;
 		    }
                    else if (dps[i][V+1] == 3 || dps[i][V+1] == 4) {
                        /* hexahedron */
			int i0 = pointBase;
			int i1 = pointBase + 1;
			int i2 = pointBase + 2;
			int i3 = pointBase + 3;
			int i4 = pointBase + 4;
			int i5 = pointBase + 5;
			int i6 = pointBase + 6;
			int i7 = pointBase + 7;
			R = implied[location].getRed();
			G = implied[location].getGreen();
                        B = implied[location].getBlue();
			out.println(4 + " " + i0 + " " + i1 + " " + i2 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(4 + " " + i0 + " " + i1 + " " + i5 + " " + i4 + " " + R + " " + G + " " + B);
			out.println(4 + " " + i1 + " " + i2 + " " + i6 + " " + i5 + " " + R + " " + G + " " + B);
			out.println(4 + " " + i7 + " " + i6 + " " + i2 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(4 + " " + i7 + " " + i4 + " " + i0 + " " + i3 + " " + R + " " + G + " " + B);
			out.println(4 + " " + i6 + " " + i7 + " " + i4 + " " + i5 + " " + R + " " + G + " " + B);
                        pointBase = pointBase+8;
		    }
		}
	    }
            if (showFaces) {
                for (int i = 0; i< T; i++) {
		    out.println("3 " + faces[i][0] + " " + faces[i][1] + " " + faces[i][2] + " 0 255 50 20 ");
		}
	    }
            out.close();
	}
        catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	}
        catch(java.io.IOException e) {
	    write(" IOException " + e);
	}
    }

    void makeGraphics() {
	g = getGraphics();    
	offscreenImage = createImage(getSize().width, getSize().height);
	oG = offscreenImage.getGraphics();
	f = new Font("TimesRoman", Font.BOLD, 36);
	fm = getFontMetrics(f);
	g.setFont(f);
	oG.setFont(f);
    }

    void process(int w) {
        Thread.yield();
        try{
	    if (!LApresent) {
		LAinit();
	    }
	    if (dps[w][V+1] == 1) {
		addP(w);
                coordsDrawn = false;
	    }
	    else if (dps[w][V+1] == 2) {
		removeP(w);
                coordsDrawn = false;
	    }
	    if (dps[w][V+2] == 1) {
		drawP(w);
                coordsDrawn = false;
	    }
	}
	catch(java.lang.ArrayIndexOutOfBoundsException e) {e.printStackTrace();}
    }
 
    void checkP(int i) {
	int which = I[i];
	boolean implied = true;
	for (int j = 0; j < active; j++) {
	    if (AM[i][j] != 0 && !bM[j]) {
		implied = false;
		bI[i] = false;
                if (dps[which][V+1] != 1) {
                    if (dps[which][V+1] == 3 || dps[which][V+1] == 4) {
			impliedOnes--;
		    }
		    dps[which][V+1] = 1;
		    drawP(which);
		}
		j = active;
	    }
	}
        if (implied && !bI[i]) {
	    bI[i] = true;
	    dps[which][V+1] = 3;
            impliedOnes++;
	    drawP(which);
	}
    }

    void checkStrong() {
        if (Strong && nz != null) {
	    for (int i = 0; i < nDps; i++) {
		if (dps[i][V+1] == 4) {
		    dps[i][V+1] = 3;
		}
	    }
            boolean done = false;
            while (!done) {
                done = true;
                for (int i = 0; i < Neqs; i++) {
		    int whichImplied = -1;
                    int nons = 0;
                    for (int jj = 0; jj < nDps; jj++) {
                        int j = sortedDps[jj];
                        if (j < Nvars) {
			    if (nz[i][j]) {
				if (dps[j][V+1] == 1) {
				    nons = 0;
				    jj = nDps;
				}
				if (dps[j][V+1] == 3) {
				    nons++;
				    if (nons > 1) {
					jj = nDps;
				    }
				    whichImplied = j;
				}
			    }
			}
		    }
		    if (nons == 1) {
			dps[whichImplied][V+1] = 4;
                        drawP(whichImplied);
			done = false;
		    }
		}
	    }
	}
    }

    void removeP(int p) {
	if (dps[p][V+1] == 2) {
	    for (int i = 0; i < active; i++) {
		if (M[i] == p && bM[i]) {
		    bM[i] = false;
		    for (int j = 0; j < rank; j++) {
			checkP(j);
		    }
		}
	    }
            sofar--;
	    dps[p][V+1] = 1;
	    drawP(p);
            report();
	}
    }

    int inactives() {
        int result = 0;
	for (int i = 0; i < nDps; i++){
	    if (dps[i][V+1] == 0) {
		result++;
	    }
	}
        return result;
    }

    void report() {
        if (!tv.batch) {
	    int left = nDps - sofar - impliedOnes;
	    String s = " r=" + r + "  d=" + d + "  dim=" + dim + "  MDS: " + sofar + "  impl: " + impliedOnes + "  unass: " + left;
	    mess(s);
	    write(s);
	}
    }

    void complete() {
	if (!LApresent) {
	    LAinit();
	}
        for (int i = 0; i < rank; i++) {
	    bI[i] = true;
            int which = I[i];
            if (dps[which][V+1] !=3 && dps[which][V+1] !=4) {
		dps[which][V+1] = 3;
		impliedOnes++;
	    }
	}
        for (int i = 0; i < active; i++) {
	    bM[i] = true;
            int which = M[i];
            if (dps[which][V+1] == 3 || dps[which][V+1] == 4) {
		impliedOnes--;
	    }
            dps[which][V+1] = 2;
	}
        sofar = dim;
        renderit();
        checkStrong();
    }

    void restart() {
	if (LApresent) {
            write(" got here");
	    for (int w = 0; w < nDps; w++) {
		if (dps[w][V+1] == 2) {
		    removeP(w);
		}
	    }
	}
    }


    void addP(int p) {
        sofar++;
        dps[p][V+1] = 2; 
        drawP(p);
        boolean done = false; 
        int apq = 0;
        int awq = 0;
	for (int i = 0; i < active; i++) {
	    if (M[i] == p) { /*  we found it */
		done = true;
		bM[i] = true;
		for (int j = 0; j < rank; j++) {
		    checkP(j);
		}
	    }
	}
	if (!done) {
	    for (int i = 0; i < rank; i++) {
		if (I[i] == p && !bI[i]) {
		    done = true;
 		    int q = -1;
		    for (int j= 0; j < active; j++) {
			if (AM[i][j]!=0 && !bM[j]) {
			    q = j;
			    apq = AM[i][j];
			    j = active;
			}
		    }
		    for (int w = 0; w < rank; w++) {
			if (w !=i) {
			    awq = AM[w][q];
			    for (int t = 0; t < active; t++) {
				if (t != q) {
				    AM[w][t] = mod(minus(mod(prod(awq,AM[i][t])),mod(prod(AM[w][t],AM[i][q]))));
				}
			    }
			    AM[w][q]= mod(prod(D[i],awq));
			    D[w] = -mod(prod(D[w],apq));
			}
		    }
		    AM[i][q] = D[i];
		    D[i] = apq;
		    I[i] = M[q];
		    M[q] = p;
		    bM[q] = true;
		    for (int j = 0; j < rank; j++) {
			checkP(j);
		    }
		    i = rank;
		}
	    }
	}
        report();
    }

    int gcd (int m,int n) {
	int mm = m;
        int nn = n;
        if (mm < 0) { mm = -mm; }
        if (nn < 0) { nn = -nn; }
        if (mm < nn) { 
	    int h = mm; 
	    mm = nn; 
	    nn = h; 
	}
        if (nn == 0) { 
            if (mm != 0) {
		return mm;
	    }
            else { 
		return 1;
	    }
        }
        else {
	    while (mm % nn != 0) {
		int h = mm % nn; 
		mm = nn; 
		nn = h;
	    }
	}
        return nn;
    }


    void moveDps() {
        /* make active variables come first */
	int count = 0;
        vs = new int[V];
        for (int i = 0; i < V; i++) {vs[i]=i;}
        if (TI > 0) {
	    int[][] newdps = new int[nDps][V+3];
	    for (int distance = 0; distance <= d; distance++) {
		for (int mu = 0; mu < TI; mu++) {
		    for (int i = 0; i < nDps; i++) {
			if (dps[i][V+1] != -1) {
                            if (i < V) {vs[i] = count;}
			    int i0 = faces[mu][0];
			    int i1 = faces[mu][1];
			    int i2 = faces[mu][2];
			    if (dps[i][i0]+dps[i][i1]+dps[i][i2]+distance == d) {
				for (int j = 0; j< V+3; j++) {
				    newdps[count][j] = dps[i][j];
				}
				count++;
				dps[i][V+1] = -1;
			    }
			}
		    }
		}
	    }
	    for (int i = 0; i < nDps; i++) {
		if (dps[i][V+1] != -1) {
		    if (i < V) {vs[i] = count;}
		    for (int j = 0; j<V+2; j++) {
			newdps[count][j] = dps[i][j];
		    }
		    count++;
		}
	    }
	    dps = newdps;
	    newdps = null;
	}
        vfog = new double[V][3];
        vFogInt = new int[V][2];
    }

    int superEquations(int condition) {
        int result = 0;
        int kind = superConds[condition][0];
        int which = superConds[condition][1];
        int degree = superConds[condition][2];
        if (kind == 1) {
	    for (int i = 0; i < TI; i++) {
                if (which == faces[i][0] || which == faces[i][1] || which == faces[i][2]) {
                    for (int j = r + 1; j <= degree; j++) {
			result = result + j - r;
		    }
		}
	    }
	}
        else if (kind == 2) {
	    int i0 = edges[which][0];
	    int i1 = edges[which][1];
            for (int i = 0; i < TI; i++) {
                if (inFace(i0,i) && inFace(i1,i)) {
		    result = result+(degree-r)*(d+1-degree);
		}
	    }
	}
        else if (kind == 3) {
            result = (d-degree+2)*(d-degree+1)/2;
	}
        return result;
    }

    boolean inFace(int vtx, int face) {
        boolean result = false;
        for (int i = 0; i < 3; i++) {
            if (vtx == faces[face][i]) {
		result = true;
	    }
	}
	return result;
    }

    boolean activateSuper(int condition) {
        boolean result = false;
        int kind = superConds[condition][0];
        int which = superConds[condition][1];
        int degree = superConds[condition][2];
        if (kind == 1) {
	    for (int i = 0; i < TI; i++) {
                if (inFace(which,i)) {
                    int i0 = -1; int i1 = -1; int i2 = -1;
                    if (which == faces[i][0]) {
                        i0 = which; i1 = faces[i][1]; i2 = faces[i][2]; 
		    } 
                    else if (which == faces[i][1]) {
                        i0 = which; i1 = faces[i][0]; i2 = faces[i][2]; 
		    } 
                    else if (which == faces[i][2]) {
                        i0 = which; i1 = faces[i][0]; i2 = faces[i][1]; 
		    } 
                    int i3 = faces[i][3];
                    int i4 = faces[i][4];
                    for(int j = 0; j < nDps; j++) {
 			if (dps[j][V+1] == 0) {
			    if (dps[j][i0] >= d-degree) {
				int j3 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i3];
				int j4 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i4];
				if (j3 == d || j4 == d) {
				    result = true;
				    dps[j][V+1] = 1;
				}
			    }
			}
		    }
		}
	    }
	}
        else if (kind == 2) {
	    int i0 = edges[which][0];
            int i1 = edges[which][1]; 
            for (int i = 0; i < TI; i++) {
		int i2 =-1; 
                if (i0 != faces[i][0]) {
		    i2 = faces[i][0];
		}
                else if (i0 != faces[i][1] && i1 != faces[i][1]) {
                    i2 = faces[i][1];
                }
                else {
                    i2 = faces[i][2];
  		}
		int i3 = faces[i][3];
		int i4 = faces[i][4];
		for(int j = 0; j < nDps; j++) {
		    if (dps[j][V+1] == 0) {
			if (dps[j][i0] + dps[j][i1] >= d-degree) {
			    int j3 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i3];
			    int j4 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i4];
			    if (j3 == d || j4 == d) {
				result = true;
				dps[j][V+1] = 1;
			    }
			}
		    }
		}                
	    }
	}
	else if (kind == 3) {
	    int i0 = faces[which][0];
            int i1 = faces[which][1]; 
            int i2 = faces[which][2]; 
            int i3 = faces[which][3]; 
            int i4 = faces[which][4]; 
	    for(int j = 0; j < nDps; j++) {
		if (dps[j][V+1] == 0) {
		    if (dps[j][i0] + dps[j][i1] + dps[j][i2] >= d-degree) {
			int j3 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i3];
			int j4 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i4];
			if (j3 == d || j4 == d) {
			    result = true;
			    dps[j][V+1] = 1;
			}
		    }
		}
	    }
	}
	return result;
    }

    void addEq(int face, int j0, int j1, int j2, int j4) {
	int rho = j4;
        int i = j0;
        int j = j1;
        int k = j2;
        int i0 = faces[face][0];
        int i1 = faces[face][1];
        int i2 = faces[face][2];
        int i3 = faces[face][3];
        int i4 = faces[face][4];
        int b0 = bcs[face][0];
        int b1 = bcs[face][1];        
	int b2 = bcs[face][2];
        int b3 = bcs[face][3];
        int denom = bcs[face][4];
	int m = identify(i0,i,i1,j,i2,k,i4,rho);
	A.put(neq,m,  -1);
        if (analyze) {
	    Anlz[neq][m] = new RAT(-1);
            AD[neq][m] = -1;
	}
	for (int mu = 0; mu < rho; mu++) {
	    A.put(neq,m,  mod(prod(A.get(neq,m),denom)));
            if (analyze) {
		Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(denom));
                AD[neq][m] = dp(A.get(neq,m));
	    }
	}
	for (int mu = 0; mu <= rho; mu++) {
	    for (int nu = 0; nu <= rho-mu; nu++) {
		for (int kappa = 0; kappa <=rho-mu-nu; kappa++) {
		    int delta = rho - mu - nu - kappa;
		    m = identify(i0,i+mu,i1,j+nu,i2,k+kappa,i3,delta);
		    long b = Lbinom(rho, mu, nu, kappa, delta);
		    A.put(neq,m,  mod(b));
		    if (analyze) {
			Anlz[neq][m] = new RAT(b);
			AD[neq][m] = dp(A.get(neq,m));
		    }
		    for (int p = 0; p < mu; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b0))); 
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b0)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		    for (int p = 0; p < nu; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b1)));
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b1)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		    for (int p = 0; p < kappa; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b2)));
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b2)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		    for (int p = 0; p < delta; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b3)));
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b3)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		}
	    }
	}
        neq++;
    }

    void revEq(int face, int j0, int j1, int j2, int j4) {
	int rho = j4;
        int i = j0;
        int j = j1;
        int k = j2;
        int i0 = faces[face][0];
        int i1 = faces[face][1];
        int i2 = faces[face][2];
        int i3 = faces[face][4];
        int i4 = faces[face][3];
        int c0 = bcs[face][0];
        int c1 = bcs[face][1];        
	int c2 = bcs[face][2];
        int c3 = bcs[face][3];
        int den = bcs[face][4];
        int b0 = -c0;
        int b1 = -c1;
        int b2 = -c2;
        int b3 = den;
        int denom = c3;
	int m = identify(i0,i,i1,j,i2,k,i4,rho);
	A.put(neq,m,  -1);
	for (int mu = 0; mu < rho; mu++) {
	    A.put(neq,m,  mod(prod(A.get(neq,m),denom)));
	}
	for (int mu = 0; mu <= rho; mu++) {
	    for (int nu = 0; nu <= rho-mu; nu++) {
		for (int kappa = 0; kappa <=rho-mu-nu; kappa++) {
		    int delta = rho - mu - nu - kappa;
		    m = identify(i0,i+mu,i1,j+nu,i2,k+kappa,i3,delta);
		    long b = Lbinom(rho, mu, nu, kappa, delta);
		    A.put(neq,m,  mod(b));
		    if (analyze) {
			AD[neq][m] = dp(A.get(neq,m));
			Anlz[neq][m] = new RAT(b);
		    }
		    for (int p = 0; p < mu; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b0))); 
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b0)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		    for (int p = 0; p < nu; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b1)));
			if (analyze) {
			    AD[neq][m] = dp(A.get(neq,m));
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b1)); 
			}
		    }
		    for (int p = 0; p < kappa; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b2)));
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b2)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		    for (int p = 0; p < delta; p++) { 
			A.put(neq,m,  mod(prod(A.get(neq,m),b3)));
			if (analyze) {
			    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b3)); 
			    AD[neq][m] = dp(A.get(neq,m));
			}
		    }
		}
	    }
	}
        neq++;
    }

    void clearSuper() {
        if (SuperPresent || selectSuper) {
            innocent();
            selectSuper = false;
            SuperPresent = false;
            nSuper = 0;
            drawIt();
	    tv.Super.setBackground(Color.red);
	}
    }

    void clearSpecial() {
        if (SpecialPresent || selectSpecial) {
            innocent();
            selectSpecial = false;
            SpecialPresent = false;
            nSpecial = 0;
            specialFace = -1;
            drawIt();
            indicateSpecial();
	    tv.Special.setBackground(Color.red);
	    if (tv.SPECIAL != null) {
		tv.SPECIAL.setVisible(false);
		tv.SPECIAL = null;
	    }
	}
    }

    boolean activateSpecial(int condition) {
	boolean result = false;
        int face = specialConds[condition][0];
        int w = specialConds[condition][1];
        boolean duplicated = false;
        int j0 = faces[face][0]; int i0 = dps[w][j0];
        int j1 = faces[face][1]; int i1 = dps[w][j1];
        int j2 = faces[face][2]; int i2 = dps[w][j2];
        int j3 = faces[face][3]; int i3 = dps[w][j3];
        int j4 = faces[face][4]; int i4 = dps[w][j4];
        int degree = max(i3,i4);
        int tet3 = tetrahedron(j0,j1,j2,j3);
        int tet4 = tetrahedron(j0,j1,j2,j4);
        boolean oriented = true;
        if (dps[w][j3] > 0) {
	    oriented = false;
	}
        int p0 = identify(j0,i0+degree, j1,i1, j2,i2, j3,0);
        int p1 = identify(j0,i0, j1,i1+degree, j2,i2, j3,0);
        int p2 = identify(j0,i0, j1,i1, j2,i2+degree, j3,0);
        int p3 = identify(j0,i0, j1,i1, j2,i2, j3,degree);
        int p4 = identify(j0,i0, j1,i1, j2,i2, j4,degree);
	if (dps[p4][V+1] != 1 && oriented) {
	    dps[p4][V+1] = 1;
	    result = true;
	}
	if (dps[p3][V+1] != 1 && !oriented) {
	    dps[p3][V+1] = 1;
	    result = true;
	}
	for (int mu0 = 0; mu0 <= degree; mu0 ++) {
	    for (int mu1 = 0; mu1 <= degree-mu0; mu1++) {
		for (int mu2 = 0; mu2 <= degree-mu0-mu1; mu2++) {
		    int mu3 = degree - mu0 - mu1 - mu2;
		    int p = -1;
		    if (oriented) {
			p = identify(j0,i0+mu0, j1,i1+mu1, j2,i2+mu2, j3,i3+mu3);
		    }
		    else {
			p = identify(j0,i0+mu0, j1,i1+mu1, j2,i2+mu2, j4,i4+mu3);
		    }
		    if (dps[p][V+1] != 1) {
			dps[p][V+1] = 1;
			result = true;
		    }
		}
	    }
	}
	return result;
    }

    boolean edgeInFace (int i0, int i1, int face) {
        boolean result = false;
        if (i0 >= i1) {
	    write(" checking for bad edge: " + i0 + " " + i1);
            fishy = true;
            drawIt();
	}
        else if ( (i0 == faces[face][0] || i0 == faces[face][1] || i0 == faces[face][2]) &&
		  (i1 == faces[face][1] || i1 == faces[face][2]) ) {
	    result = true;
	}
        return result;
    }




    void geometry() {
	bcs = new int[TI][5];
	INTbcs = new INT[TI][5];
	for (int face = 0; face < TI; face++) {
	    int i0 = faces[face][0];
	    int i1 = faces[face][1];
	    int i2 = faces[face][2];
	    int i3 = faces[face][3];
	    int i4 = faces[face][4];
	    int x = vtcs[i4][0];
	    int y = vtcs[i4][1];
	    int z = vtcs[i4][2];
	    int x0 = vtcs[i0][0];
	    int y0 = vtcs[i0][1];
	    int z0 = vtcs[i0][2];
	    int x1 = vtcs[i1][0];
	    int y1 = vtcs[i1][1];
	    int z1 = vtcs[i1][2];
	    int x2 = vtcs[i2][0];
	    int y2 = vtcs[i2][1];
	    int z2 = vtcs[i2][2];
	    int x3 = vtcs[i3][0];
	    int y3 = vtcs[i3][1];
	    int z3 = vtcs[i3][2];
	    int K = 3;
	    RAT[][] AA = new RAT[K+1][K+2];
	    RAT[] BC = new RAT[K+1];
	    AA[0][0] = new RAT(x0);
	    AA[0][1] = new RAT(x1);
	    AA[0][2] = new RAT(x2);
	    AA[0][3] = new RAT(x3);
	    AA[0][4] = new RAT(x);
	    AA[1][0] = new RAT(y0);
	    AA[1][1] = new RAT(y1);
	    AA[1][2] = new RAT(y2);
	    AA[1][3] = new RAT(y3);
	    AA[1][4] = new RAT(y);
	    AA[2][0] = new RAT(z0);
	    AA[2][1] = new RAT(z1);
	    AA[2][2] = new RAT(z2);
	    AA[2][3] = new RAT(z3);
	    AA[2][4] = new RAT(z);
	    AA[3][0] = new RAT(1);
	    AA[3][1] = new RAT(1);
	    AA[3][2] = new RAT(1);
	    AA[3][3] = new RAT(1);
	    AA[3][4] = new RAT(1);
	    int[] Rows = new int[K+1];
	    for (int i = 0; i <= K; i++) {
		Rows[i] = i;
	    }
	    for (int k = 0; k <= K; k++) {
		int pivot = -1;
		for (int i = k; i <= K; i++) {
		    if (!AA[Rows[i]][k].isZero()) {
			pivot = Rows[i];
			Rows[i] = Rows[k];
			Rows[k] = pivot;
			i = K+1;
		    }
		}
		if (pivot == -1) {
		    mess(" zero pivot for bc calculation");
		}                            
		for (int i = k+1; i <= K; i++) {
		    RAT multiplier = RAT.divide(AA[Rows[i]][k],AA[pivot][k]);
		    for (int j = k+1; j < K+2; j++) {
			AA[Rows[i]][j] = RAT.simplify(RAT.subtract(AA[Rows[i]][j],RAT.multiply(multiplier,AA[pivot][j])));
		    }
		}
	    }
	    /* backward substitution */
	    for (int i = K; i >= 0; i--) {
		for (int j = i+1; j <= K; j++) {
		    AA[Rows[i]][K+1] = RAT.simplify(RAT.subtract(AA[Rows[i]][K+1], RAT.multiply(AA[Rows[i]][j],AA[Rows[j]][K+1])));
		}
		AA[Rows[i]][K+1] = RAT.simplify(RAT.divide(AA[Rows[i]][K+1],AA[Rows[i]][i]));
		BC[i] = RAT.copy(AA[Rows[i]][K+1]);
	    }
	    /* end backward substitution */

	    /* find LCM of denominators */

	    INT Denom = BC[0].denominator;
	    Denom = INT.divide(INT.multiply(Denom,BC[1].denominator),INT.gcf(Denom,BC[1].denominator));
	    Denom = INT.divide(INT.multiply(Denom,BC[2].denominator),INT.gcf(Denom,BC[2].denominator));
	    Denom = INT.divide(INT.multiply(Denom,BC[3].denominator),INT.gcf(Denom,BC[3].denominator));
	    for (int i = 0; i < 4; i++) {
		INT Factor = INT.divide(Denom,BC[i].denominator);
		INTbcs[face][i] = INT.multiply(BC[i].numerator,Factor);
	    }
            
	    INTbcs[face][4] = Denom;              
            
	    bcs[face][0] = INTbcs[face][0].mod();
	    bcs[face][1] = INTbcs[face][1].mod();
	    bcs[face][2] = INTbcs[face][2].mod();
	    bcs[face][3] = INTbcs[face][3].mod();
	    bcs[face][4] = INTbcs[face][4].mod();
            if (bcs[face][4] < 0) {
		for (int i = 0; i < 5; i++) {
		    bcs[face][i] = -bcs[face][i];
		}
	    }
	}
        GeometryPresent = true;
    }

    void checkGeometry() {
        /* check if any point is inside another tetradron */
        waiting();
        mess("Checking Geometry");
        if (!GeometryPresent) {
            geometry();
	}
        boolean OK = true;
        String s = "";
        for (int t = 0; t < N; t++) {
            int i0 = tets[t][0];
            int i1 = tets[t][1];
            int i2 = tets[t][2];
            int i3 = tets[t][3];
            for (int i4 = 0; i4 < V; i4++) {
		if (i4 != i0 && i4 != i1 && i4 != i2 && i4 != i3) {
		    int x = vtcs[i4][0];
		    int y = vtcs[i4][1];
		    int z = vtcs[i4][2];
		    int x0 = vtcs[i0][0];
		    int y0 = vtcs[i0][1];
		    int z0 = vtcs[i0][2];
		    int x1 = vtcs[i1][0];
		    int y1 = vtcs[i1][1];
		    int z1 = vtcs[i1][2];
		    int x2 = vtcs[i2][0];
		    int y2 = vtcs[i2][1];
		    int z2 = vtcs[i2][2];
		    int x3 = vtcs[i3][0];
		    int y3 = vtcs[i3][1];
		    int z3 = vtcs[i3][2];
		    int K = 3;
		    RAT[][] AA = new RAT[K+1][K+2];
		    RAT[] BC = new RAT[K+1];
		    AA[0][0] = new RAT(x0);
		    AA[0][1] = new RAT(x1);
		    AA[0][2] = new RAT(x2);
		    AA[0][3] = new RAT(x3);
		    AA[0][4] = new RAT(x);
		    AA[1][0] = new RAT(y0);
		    AA[1][1] = new RAT(y1);
		    AA[1][2] = new RAT(y2);
		    AA[1][3] = new RAT(y3);
		    AA[1][4] = new RAT(y);
		    AA[2][0] = new RAT(z0);
		    AA[2][1] = new RAT(z1);
		    AA[2][2] = new RAT(z2);
		    AA[2][3] = new RAT(z3);
		    AA[2][4] = new RAT(z);
		    AA[3][0] = new RAT(1);
		    AA[3][1] = new RAT(1);
		    AA[3][2] = new RAT(1);
		    AA[3][3] = new RAT(1);
		    AA[3][4] = new RAT(1);
		    int[] Rows = new int[K+1];
		    for (int i = 0; i <= K; i++) {
			Rows[i] = i;
		    }
		    for (int k = 0; k <= K; k++) {
			int pivot = -1;
			for (int i = k; i <= K; i++) {
			    if (!AA[Rows[i]][k].isZero()) {
				pivot = Rows[i];
				Rows[i] = Rows[k];
				Rows[k] = pivot;
				i = K+1;
			    }
			}
			if (pivot == -1) {
			    mess(" zero pivot for bc calculation");
			}                            
			for (int i = k+1; i <= K; i++) {
			    RAT multiplier = RAT.divide(AA[Rows[i]][k],AA[pivot][k]);
			    for (int j = k+1; j < K+2; j++) {
				AA[Rows[i]][j] = RAT.simplify(RAT.subtract(AA[Rows[i]][j],RAT.multiply(multiplier,AA[pivot][j])));
			    }
			}
		    }
		    /* backward substitution */
		    for (int i = K; i >= 0; i--) {
			for (int j = i+1; j <= K; j++) {
			    AA[Rows[i]][K+1] = RAT.simplify(RAT.subtract(AA[Rows[i]][K+1], RAT.multiply(AA[Rows[i]][j],AA[Rows[j]][K+1])));
			}
			AA[Rows[i]][K+1] = RAT.simplify(RAT.divide(AA[Rows[i]][K+1],AA[Rows[i]][i]));
			BC[i] = RAT.copy(AA[Rows[i]][K+1]);
		    }
		    /* end backward substitution */

		    /* find LCM of denominators */

		    boolean inside = true;
		    for (int i = 0; i < 4; i++) {
			BC[i].normalize();
			if (BC[i].numerator.negative) {
			    inside = false;
			}
		    }
		    if (inside) {
                        s = "vertex " + i4 +" is in tetrahedron "
			    + t + " : " + i0 + " " + i1 + " " + i2 + " " + i3;
			write(s);
                        mess(s);
			OK = false;
		    }
		}
	    }
	}
        for (int face = 0; face < TI; face++) {
            if (bcs[face][3] >= 0) {
                s = " vertex " + faces[face][4] + " on wrong side of face " + face +": " 
  	            + faces[face][0] + " " + faces[face][1] 
                    + " " + faces[face][2] + " opposite " + faces[face][3];
		OK = false;
	    }
	}
	if (OK) {
	    write(" Geometry OK");
	    mess(" Geometry OK");             
	}
	else {
	    fishy = true;
            drawIt();
            mess(s);
	}
        crosshair();
    }

    void LAinit() {
        if (!general) {
	    try{
		waiting();
		if (selectSuper || selectSpecial) {
		    selectSuper = false;
		    selectSpecial = false;
		    drawIt();
		}
		modCount = 0;
		impliedOnes = 0;
		sofar = 0;
		boolean enabled = false;
		PrintWriter eqs = null;
		PrintWriter matlab = null;
		String file = "";
		String ml = "";
		try{
		    if (listEqs) {
			file = tv.fileName.getText() + ".eqs";
			eqs = new PrintWriter(new FileOutputStream(file));
                        ml = tv.fileName.getText() + ".m";
			matlab = new PrintWriter(new FileOutputStream(ml));
                        matlab.println(" clear A; ");
			enabled = true;
		    }
		}
		catch(java.io.FileNotFoundException e) {
 		    enabled = false;
		}
		catch(java.io.IOException e) {
		    enabled = false;
		}
		int perFace = 0;
		for (int i = 1; i <= r; i++) {
		    perFace = perFace + (d+2-i)*(d+1-i)/2;
		}
		Neqs = perFace*TI;
		extras = Neqs;
		if (SuperPresent) {
		    for (int i = 0; i < nSuper; i++) {
			Neqs = Neqs + superEquations(i);
		    }
		}            
		if (SpecialPresent) {
		    Neqs = Neqs + nSpecial;
		}
		extras = Neqs - extras;
		activate();
		if (SuperPresent) {
		    for (int i = 0; i < nSuper; i++) {
			activateSuper(i);
		    }
		}
		if (SpecialPresent) {
		    for (int i = 0; i < nSpecial; i++) {
			activateSpecial(i);
		    }
		}
		Nvars = 0;
		for (int i = 0; i < nDps; i++) {
		    if (dps[i][V+1] == 1) { Nvars++; }
		}
		sofar = inactives();
		if (SuperPresent || SpecialPresent) {
		    Nvars = nDps;
		}
		if (enabled) {
		    for (int i = 0; i < Nvars; i++) {
			String s = cName(i);
                        if (tv.cMode.getSelectedIndex() != 3) {
			    s = " var("+i+"):=" + s + ";";
			}
			else {
 			    s = i +": $" +  s + "$";
			}
			eqs.println(s);
		    }
		    eqs.println("\n");
		}
                hashed = false;
		A = new hash(Neqs,Nvars);
                if (A.hashed) {
                    hashed = true;
		    write(" using hash table -- be patient!");
                    write(" disabling analysis, identification of strong dependencies, and improved upper bound ");
		    analyze = false;
                    Strong = false;
		}
		if (analyze) {
                    AD = new double[Neqs][Nvars];
		    Anlz = new RAT[Neqs][Nvars];
		    AnlzM = Neqs;
		    AnlzN = Nvars;
		    Astab = new double[Neqs][Nvars];
		}
		else {
                    AD = null;
		    Anlz = null;
		    Astab = null;
		    AnlzM = -1;
		    AnlzN = -1;
		}
		neq = 0;
		mess("setting up equations",Color.blue);
                if (enabled && matlab != null) {
		    matlab.println(" A(1,"+Nvars+")=1;");
		    matlab.println(" A(1,"+Nvars+")=0;");
		}
		write(" setting up " + Neqs + " by " + Nvars + " equations - P = " + P);
		int[] rows = new int[Neqs];
		int[] cols = new int[Nvars];
		for (int i = 0; i < Neqs; i++) {
		    rows[i] = i;
		}
		for (int j = 0; j < Nvars; j++) {
		    cols[j] = j;
		}
                geometry();
		for (int face = 0; face < TI; face++) {
		    bar(face,TI,Color.orange,Color.magenta);
		    int i0 = faces[face][0];
		    int i1 = faces[face][1];
		    int i2 = faces[face][2];
		    int i3 = faces[face][3];
		    int i4 = faces[face][4];
		    int b0 = bcs[face][0];
		    int b1 = bcs[face][1];
		    int b2 = bcs[face][2];
		    int b3 = bcs[face][3];
		    int denom = bcs[face][4];
		    if (!BCsPrinted) {
			String s = " V" + i4 + " = (" + comma(b0) + " V" + i0;
			if (b1 < 0 ) {
			    s = s+ " " + comma(b1);
			}
			else {
			    s = s + " + " + comma(b1);
			}
			s = s + " V" + i1 ;
			if (b2 < 0 ) {
			    s = s+" " + comma(b2);
			}
			else {
			    s = s + " + " + comma(b2)  ;
			}
			s = s + " V" + i2;
			if (b3 < 0 ) {
			    s = s+ " " + comma(b3);
			}
			else {
			    s = s + " + " + comma(b3) ;
			}
			s = s + " V" + i3;
			s = s + ")/" + comma(denom);
			write(s);
		    }
		    for (int rho = 1; rho <= r; rho++) {
			for (int i = 0; i <= d - rho; i++) {
			    for (int j = 0; j <= d-rho -i; j++) {
				int k = d - rho - i - j;
				int m = identify(i0,i,i1,j,i2,k,i4,rho);
				A.put(neq,m,-1);
				if (analyze) {
				    Anlz[neq][m] = new RAT(-1);
				    Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
				    AD[neq][m] = dp(A.get(neq,m));
				}
				for (int mu = 0; mu < rho; mu++) {
				    A.put(neq,m,  mod(prod(A.get(neq,m),denom)));
				}
				if (analyze) {
				    for (int mu = 0; mu < rho; mu++) {
					Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(denom));
					Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
					AD[neq][m] = dp(A.get(neq,m));
				    }
				}
				for (int mu = 0; mu <= rho; mu++) {
				    for (int nu = 0; nu <= rho-mu; nu++) {
					for (int kappa = 0; kappa <=rho-mu-nu; kappa++) {
					    int delta = rho - mu - nu - kappa;
					    m = identify(i0,i+mu,i1,j+nu,i2,k+kappa,i3,delta);
					    long b = Lbinom(rho, mu, nu, kappa, delta);
					    A.put(neq,m,  mod(b));
					    if (analyze) {
						Anlz[neq][m] = new RAT(b);
						Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
						AD[neq][m] = dp(A.get(neq,m));
					    }
					    for (int p = 0; p < mu; p++) { 
						A.put(neq,m,  mod(prod(A.get(neq,m),b0))); 
						if (analyze) {
						    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b0)); 
						    Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
						    AD[neq][m] = dp(A.get(neq,m));
						}
					    }
					    for (int p = 0; p < nu; p++) { 
						A.put(neq,m,  mod(prod(A.get(neq,m),b1)));
						if (analyze) {
						    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b1)); 
						    Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
						    AD[neq][m] = dp(A.get(neq,m));
						}
					    }
					    for (int p = 0; p < kappa; p++) { 
						A.put(neq,m,  mod(prod(A.get(neq,m),b2)));
						if (analyze) {
						    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b2)); 
						    Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
						    AD[neq][m] = dp(A.get(neq,m));
						}
					    }
					    for (int p = 0; p < delta; p++) { 
						A.put(neq,m,  mod(prod(A.get(neq,m),b3)));
						if (analyze) {
						    Anlz[neq][m] = RAT.multiply(Anlz[neq][m],new RAT(b3)); 
						    Astab[neq][m] = RAT.extractDouble(Anlz[neq][m]);
						    AD[neq][m] = dp(A.get(neq,m));
						}
					    }
					}
				    }
				}
				if (listEqs) {
				    if (enabled) {
					eqs.println(equation(neq));
					matlab.println(mequation(neq));
				    }
				}
				neq++;
			    }
			}
		    }
		}
                write("basic equations done");
		if (SuperPresent) {
		    /* add Super Conditions */
                    mess("adding super equations");
                    write("adding super equations");
		    if (listEqs) {
			if (enabled) {
			    eqs.println("\n super conditions: \n");
			}
			write("super conditions:");
		    }
		    for (int condition = 0; condition < nSuper; condition++) {
                        bar(condition,nSuper,Color.orange,Color.magenta);
			int kind = superConds[condition][0];
			int which = superConds[condition][1];
			int degree = superConds[condition][2];
			if (kind == 1) {
			    for (int i = 0; i < TI; i++) {
				if (inFace(which,i)) {
				    int i0 = -1; int i1 = -1; int i2 = -1;
				    if (which == faces[i][0]) {
					i0 = which; i1 = faces[i][1]; i2 = faces[i][2]; 
				    } 
				    else if (which == faces[i][1]) {
					i0 = which; i1 = faces[i][0]; i2 = faces[i][2]; 
				    } 
				    else if (which == faces[i][2]) {
					i0 = which; i1 = faces[i][0]; i2 = faces[i][1]; 
				    } 
				    int i4 = faces[i][4];
				    for(int j = 0; j < nDps; j++) {
					int j0 = dps[j][i0];
					int j1 = dps[j][i1];
					int j2 = dps[j][i2];
					int j4 = dps[j][i4];
					if (j0 == d-degree && j4 > r && j1+j2+j4 == degree) {
					    addEq(i,dps[j][faces[i][0]],dps[j][faces[i][1]],dps[j][faces[i][2]],dps[j][faces[i][4]]);
					    if (listEqs) {
						if (enabled) {
						    eqs.println(equation(neq-1));
						    matlab.println(mequation(neq-1));
						}
					    }
					}
				    }
				}
			    }
			}
			else if (kind == 2) {
			    int i0 = edges[which][0];
			    int i1 = edges[which][1]; 
			    for (int i = 0; i < TI; i++) {
				if (edgeInFace(i0,i1,i)) {                            
				    int i2 =-1; 
				    if (i0 != faces[i][0]) {
					i2 = faces[i][0];
				    }
				    else if (i0 != faces[i][1] && i1 != faces[i][1]) {
					i2 = faces[i][1];
				    }
				    else {
					i2 = faces[i][2];
				    }
				    int i3 = faces[i][3];
				    int i4 = faces[i][4];
				    for(int j = 0; j < nDps; j++) {
					int j0 = dps[j][i0];
					int j1 = dps[j][i1];
					int j2 = dps[j][i2];
					int j4 = dps[j][i4];
					if (j0 + j1  == d-degree && j2 + j4 == degree && j4 > r) {
					    addEq(i,dps[j][faces[i][0]],dps[j][faces[i][1]],dps[j][faces[i][2]],dps[j][faces[i][4]]);
					    if (listEqs) {
						if (enabled) {
						    eqs.println(equation(neq-1));
						    matlab.println(mequation(neq-1));
						}
					    }
					}
				    }
				}
			    }
			}
			else if (kind == 3) {
			    int i0 = faces[which][0];
			    int i1 = faces[which][1]; 
			    int i2 = faces[which][2]; 
			    int i3 = faces[which][3]; 
			    int i4 = faces[which][4]; 
			    for(int j = 0; j < nDps; j++) {
				if (dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i4] == d && dps[j][i4] == degree) {
				    int j4 = dps[j][i0] + dps[j][i1] + dps[j][i2] + dps[j][i4];
				    if (j4 == d) {
					addEq(which,dps[j][i0],dps[j][i1],dps[j][i2],dps[j][i4]);
					if (listEqs) {
					    if (enabled) {
						eqs.println(equation(neq-1));
						matlab.println(mequation(neq-1));
					    }
					}
				    }
				}
			    }
			}
		    }
		}
		if (SpecialPresent) {
		    if (enabled) {
			eqs.println("\n special conditions: \n");
		    }
		    for (int i = 0; i < nSpecial; i++) {
			int face = specialConds[i][0];
			int w = specialConds[i][1];
			int j0 = faces[face][0]; int i0 = dps[w][j0];
			int j1 = faces[face][1]; int i1 = dps[w][j1];
			int j2 = faces[face][2]; int i2 = dps[w][j2];
			int j3 = faces[face][3]; int i3 = dps[w][j3];
			int j4 = faces[face][4]; int i4 = dps[w][j4];
			boolean oriented = true;
			if (dps[w][j4] > 0) {
			    oriented = true;
			}
			else {
			    oriented = false;
			}
			if (oriented) {
			    addEq(face, i0,i1,i2,i4);
			}
			else {
			    revEq(face, i0,i1,i2,i3);
			}                    
			if (listEqs) {
			    if (enabled) {
				eqs.println(equation(neq-1));
				matlab.println(mequation(neq-1));
			    }
			}

		    }
		}
		if (fishy) {
		    repaint();
		}
                eliminateIdentical();
		if (eqs!= null) {
                    if (tv.cMode.getSelectedIndex() == 3) {
			eqs.println("\\bye");
		    }
		    eqs.close();
		}
                if (matlab != null) {
                    matlab.close();
		}
		if (Strong) {
		    try {
			nz = new boolean[Neqs][Nvars];
		    }
                    catch (Exception e) {
			write(" cannot analyze strong dependencies ");
			e.printStackTrace();
                        nz = null;
		    }
		}
		else {
		    nz = null;
		}
		if (Strong && nz != null) {
		    for (int i = 0; i < Neqs; i++) {
			for (int j = 0; j < Nvars; j++) {
			    if (A.get(i,j) != 0) {
				nz[i][j] = true;
			    }
			    else {
				nz[i][j] = false;
			    }
			}
		    }    
		}
		if (analyze) {
		    for (int i = 0; i < AnlzM; i++) {
			for (int j = 0; j < AnlzN; j++) {
			    Astab[i][j] = RAT.extractDouble(Anlz[i][j]);
			}
		    }
		}
		if (analyze) {
		    double hadamard = 0.0;
		    for (int i = 0; i < AnlzM; i++) {
			INT gcd = new INT(1);
			for (int j = 0; j < AnlzN; j++) {
			    if (Anlz[i][j] != null ) {
				INT cf = INT.gcf(gcd,Anlz[i][j].denominator);
				gcd = INT.multiply(gcd,Anlz[i][j].denominator);
				boolean works = gcd.divides(gcd,cf);
				if (!works) {
				    write("division error in Hadamard");
				}
				gcd = gcd.ratio;
			    }
			}
			double norm2 = 1.0;
			for (int j = 0; j < AnlzN; j++) {
			    double h = RAT.extractDouble(Anlz[i][j]);
			    norm2 = norm2 + h*h;
			}
			double f = INT.extractDouble(gcd);
			hadamard = hadamard + log(norm2) + 2.0*log(abs(f));
		    }
		    hadamard = hadamard/log(10)/2;
		    int had = (int) (hadamard + 0.5);
		    write(" Hadamard: determinant < 10^"+had);
		}
                eliminate();
	    }
	    catch (java.lang.OutOfMemoryError e) { 
		write(" out of memory");	
                e.printStackTrace();
		indicateMemory();
	    }
	    Bounds();
	}	
	else {
	    genInit();
	}
        if (fishy) {
	    repaint();
	}
    }
 
    void eliminateIdentical() {
	try {
	    if (identical && A != null && !hashed) {
                write(" eliminating identical equations ");
                mess(" eliminating identical equations ");
		int count = 0;
		for (int i = 0; i < Neqs; i++) {
                    bar(i, Neqs, Color.black, Color.green);
		    for (int j = i+1; j < Neqs; j++) {
			boolean same = true;
			for (int k = 0; k < Nvars; k++) {
			    if (A.get(i,k) != A.get(j,k)) {
				same = false;
				k = Nvars;
			    }
			}
			if (same) { 
                            System.out.print("-");
			    count++;
			    Neqs--;
			    for (int k = j; k < Neqs; k++) {
				for (int mu = 0; mu < Nvars; mu++) {
				    A.put(k,mu,  A.get(k+1,mu));
				}
			    }
			    j--;
			}
		    }
		}
		write("\n suppressed " + count + " identical equations ");
	    }
	}
	catch(Exception e) {e.printStackTrace();}
	catch(Error e) {e.printStackTrace();}
    }

    void genInit() {
	try {
	    A = new hash(Neqs,Nvars);
            nz = new boolean[Neqs][Nvars];
	    neq = 0;
	    for (int t = 1; t < N; t++) {
		for (int f = 0; f < 4; f++) {
		    if (F[t].done[3][f] == 0) {
			/* i1, i2, i3, i4  is the new tetrahedron , i1,i2,i3 is the common face,
			   i1,i2,i3,i5 is the new tetrahedron */
			int i1 = F[t].done[0][f];
			int i2 = F[t].done[1][f];
			int i3 = F[t].done[2][f];
			int i4 = -1;
			for (int j = 0; j < 4; j++) {
			    int k = tets[t][j];
			    if (k != i1 && k != i2 && k !=i3) {
				i4 = k;
				j = 4;
			    }
			}
			int i5 = -1;
			for (int tau = 0; tau < t; tau++) {
			    if (inTet(i1,tau) && inTet(i2,tau) && inTet(i3,tau) && !inTet(i4,tau)) {
				for (int j = 0; j < 4; j++) {
				    int k = tets[tau][j];
				    if (!inTet(k,t)) {
					i5 = k;
					j = 4;
					tau = t;
				    }
				}
			    }
			}
			int b5 = gbcs(i5,i1,i2,i3,i4,0);
			int b1 = gbcs(i5,i1,i2,i3,i4,1);
			int b2 = gbcs(i5,i1,i2,i3,i4,2);
			int b3 = gbcs(i5,i1,i2,i3,i4,3);
			int bd = gbcs(i5,i1,i2,i3,i4,4);                    
			for (int j4 = 1; j4 <= r; j4++) {
			    for (int j1 = 0; j1 <= d-j4; j1++) {
				for (int j2 = 0; j2 <= d-j4-j1; j2++) {
				    int j3 = d-j1-j2-j4;
				    int m = identify(i1,j1,i2,j2,i3,j3,i4,j4);
                                    nz[neq][m] = true;
				    A.put(neq,m,  -1);
				    for (int k = 0; k < j4; k++) {
					A.put(neq,m,  mod(prod(A.get(neq,m),bd)));
				    }
				    for (int k5 = 0; k5 <= j4; k5++) {
					for(int k1 = 0; k1 <= j4-k5; k1++) {
					    for (int k2 = 0; k2 <= j4-k5-k1; k2++) {
						int k3 = j4-k5-k1-k2;
                                                long b = Lbinom(j4,k5,k1,k2,k3);
						int a = mod(b);
						for (int p = 0; p < k5; p++) { 
						    a = mod(prod(a,b5)); 
						}
						for (int p = 0; p < k1; p++) { 
						    a = mod(prod(a,b1));
						}
						for (int p = 0; p < k2; p++) { 
						    a = mod(prod(a,b2));
						}
						for (int p = 0; p < k3; p++) { 
						    a = mod(prod(a,b3));
						}
						m = identify(i5,k5,i1,j1+k1,i2,j2+k2,i3,j3+k3);
						nz[neq][m] = true;
						A.put(neq,m,  mod(plus(a,A.get(neq,m))));
					    }
					}
				    }
				    neq++;
				}
			    }
			}
		    }
		}
		for (int f = 4; f < 10; f++) {
		    if (F[t].done[3][f] == 0) {
			/* i1, i2, i3, i4  is the new tetrahedron , i1, i2 is the common edge
			   i1, i2, i5, i6 is an existing tetrahedron 
			   we need to replace i5 and i6 with i3 and i4 */
			int i1 = F[t].done[0][f];
			int i2 = F[t].done[1][f];
			int i3 = -1;
			for (int j = 0; j < 4; j++) {
			    int k = tets[t][j];
			    if (k != i1 && k != i2 ) {
				i3 = k;
				j = 4;
			    }
			}
			int i4 = -1;
			for (int j = 0; j < 4; j++) {
			    int k = tets[t][j];
			    if (k != i1 && k != i2 && k !=i3) {
				i4 = k;
				j = 4;
			    }
			}
			int i5 = -1;
			int i6 = -1;
			for (int tau = 0; tau < t; tau++) {
			    if (inTet(i1,tau) && inTet(i2,tau) && !inTet(i3,tau) && !inTet(i4,tau)) {
				for (int j = 0; j < 4; j++) {
				    int k = tets[tau][j];
				    if (!inTet(k,t)) {
					i5 = k;
					j = 4;
				    }
				}
				for (int j = 0; j < 4; j++) {
				    int k = tets[tau][j];
				    if (!inTet(k,t) && i5 != k) {
					i6 = k;
					j = 4;
					tau = t;
				    }
				}
			    }
			}
                        int zeroDenominatorCount = 0;
                        zeroDenominator = false;
                        boolean done = false;
			int b1 = 0;
			int b2 = 0;
			int b5 = 0;
			int b6 = 0;
			int bd = 0;
			int c1 = 0;
			int c2 = 0;
			int c3 = 0;
			int c6 = 0;
			int cd = 0;
                        while (!done) {
			    done = true;
			    b1 = gbcs(i1,i2,i5,i6,i3,0);
			    b2 = gbcs(i1,i2,i5,i6,i3,1);
			    b5 = gbcs(i1,i2,i5,i6,i3,2);
			    b6 = gbcs(i1,i2,i5,i6,i3,3);
			    bd = gbcs(i1,i2,i5,i6,i3,4);
			    c1 = gbcs(i1,i2,i3,i6,i4,0);
			    c2 = gbcs(i1,i2,i3,i6,i4,1);
			    c3 = gbcs(i1,i2,i3,i6,i4,2);
			    c6 = gbcs(i1,i2,i3,i6,i4,3);
			    cd = gbcs(i1,i2,i3,i6,i4,4);
			    if (zeroDenominator) {
				done = false;
				zeroDenominator = false;
				zeroDenominatorCount++;
                                int k = i6;
                                i6 = i5;
                                i5 = k;
			    }
			    if (zeroDenominatorCount > 2) {
				write(" zero denominator in edge match, giving up : "  + i1 + " " + i2 + " " + i3 + " " + i4 + " " + i5 + " " + i6);
				System.exit(0);
			    }
			}
			for (int j1 = 0; j1 < d; j1++) {
			    for (int j2 = max(0,d-r-j1); j2 < d-j1; j2++) {
				for (int j3 = 0; j3 <= d-j1-j2; j3++) {
				    int j4 = d-j1-j2-j3;
				    int m = identify(i1,j1,i2,j2,i3,j3,i4,j4);
				    nz[neq][m] = true;
				    A.put(neq,m,  -1);
                                    for (int j = 0; j < j4; j++) {
					A.put(neq,m,  mod(prod(A.get(neq,m),cd)));
				    }
                                    for (int j = 0; j < r; j++) {
					A.put(neq,m,  mod(prod(A.get(neq,m),bd)));
				    }
				    for (int k1 = 0; k1 <= j4; k1++) {
					for (int k2=0; k2 <= j4-k1; k2++) {	
					    for (int k3 = 0; k3 <= j4-k1-k2; k3++) {
						int k6 = j4-k1-k2-k3;
                                                long b = Lbinom(j4,k1,k2,k3,k6);
						int a = mod(b);
						for (int p = 0; p < k1; p++) { 
						    a = mod(prod(a,c1)); 
						}
						for (int p = 0; p < k2; p++) { 
						    a = mod(prod(a,c2)); 
						}
						for (int p = 0; p < k3; p++) { 
						    a = mod(prod(a,c3)); 
						}
						for (int p = 0; p < k6; p++) { 
						    a = mod(prod(a,c6)); 
						}
						int rho = j3+k3;
                                                
						for (int l1 = 0; l1 <= rho; l1++) {
						    for (int l2 = 0; l2 <= rho-l1; l2++) {
							for (int l5 = 0; l5 <= rho-l1-l2; l5++) {
							    int l6 = rho - l1-l2-l5;
							    int aa = a;
							    for (int j = rho; j < r; j++) {
								aa = mod(prod(aa,bd));
							    }
                                                            long bb = Lbinom(rho,l1,l2,l5,l6);
							    int bbb = mod(bb);
							    aa = mod(prod(aa,bbb));
							    for (int p = 0; p < l1; p++) {
								aa = mod(prod(aa,b1)); 
							    }
							    for (int p = 0; p < l2; p++) {
								aa = mod(prod(aa,b2)); 
							    }
							    for (int p = 0; p < l5; p++) {
								aa = mod(prod(aa,b5)); 
							    }
							    for (int p = 0; p < l6; p++) {
								aa = mod(prod(aa,b6)); 
							    }
							    int mm = identify(i1,j1+k1+l1,i2,j2+k2+l2,i5,l5,i6,k6+l6);
							    nz[neq][mm] = true;
							    A.put(neq,mm,  mod(plus(aa,A.get(neq,mm))));
							}
						    }
						}
					    }
					}
				    }
				    neq++;
				}
			    }
			}
		    }
		}
		for (int f = 10; f < 14; f++) {
		    if (F[t].done[3][f] == 0) {
			/* i1, i2, i3, i4 is the new tetrahedron, i1 is the common vertex,
                           and i1, i5, i6, i7 is an existing tetrahedron 
                           we need to replace i2,i3,i4 with i5,i6,i7
			   V2 = a1 V1 + a5 V5 + a6 V6 + a7 V7
                           as in the edge case:
                           V3 = b1 V1 + b2 V2 + b5 V5 + b6 V6 and   
                           V4 = c1 V1 + c2 V2 + c3 V3 + c6 V6
			*/
			int i1 = F[t].done[0][f];
			int i2 = -1;
			for (int j = 0; j < 4; j++) {
			    int k = tets[t][j];
			    if (k != i1 && k != i2 ) {
				i2 = k;
				j = 4;
			    }
			}
			int i3 = -1;
			for (int j = 0; j < 4; j++) {
			    int k = tets[t][j];
			    if (k != i1 && k != i2 && k !=i2) {
				i3 = k;
				j = 4;
			    }
			}
			int i4 = -1;
			for (int j = 0; j < 4; j++) {
			    int k = tets[t][j];
			    if (k != i1 && k != i2 && k !=i2 && k != i3) {
				i4 = k;
				j = 4;
			    }
			}
                        int i5 = -1;
                        int i6 = -1;
                        int i7 = -1;
                        for (int tau = 0; tau < t; tau++) {
                            if (inTet(i1,tau)) {
				for (int j = 0; j < 4; j++) {
				    int k = tets[tau][j];
				    if (!inTet(k,t)) {
					i5 = k;
					j = 4;
				    }
				}
				for (int j = 0; j < 4; j++) {
				    int k = tets[tau][j];
				    if (!inTet(k,t) && i5 != k) {
					i6 = k;
					j = 4;
				    }
				}
				for (int j = 0; j < 4; j++) {
				    int k = tets[tau][j];
				    if (!inTet(k,t) && i5 != k && i6 != k) {
					i7 = k;
					j = 4;
					tau = t;
				    }
				}

			    }
			}
                        int zeroDenominatorCount = 0;
                        zeroDenominator = false;
                        boolean done = false;
			int a1 = 0;
			int a7 = 0;
			int a5 = 0;
			int a6 = 0;
			int ad = 0;
			int b1 = 0;
			int b2 = 0;
			int b5 = 0;
			int b6 = 0;
			int bd = 0;
			int c1 = 0;
			int c2 = 0;
			int c3 = 0;
			int c6 = 0;
			int cd = 0;
                        while (!done) {
			    done = true;
			    a1 = gbcs(i1,i7,i5,i6,i2,0);
			    a7 = gbcs(i1,i7,i5,i6,i2,1);
			    a5 = gbcs(i1,i7,i5,i6,i2,2);
			    a6 = gbcs(i1,i7,i5,i6,i2,3);
			    ad = gbcs(i1,i7,i5,i6,i2,4);
			    b1 = gbcs(i1,i2,i5,i6,i3,0);
			    b2 = gbcs(i1,i2,i5,i6,i3,1);
			    b5 = gbcs(i1,i2,i5,i6,i3,2);
			    b6 = gbcs(i1,i2,i5,i6,i3,3);
			    bd = gbcs(i1,i2,i5,i6,i3,4);
			    c1 = gbcs(i1,i2,i3,i6,i4,0);
			    c2 = gbcs(i1,i2,i3,i6,i4,1);
			    c3 = gbcs(i1,i2,i3,i6,i4,2);
			    c6 = gbcs(i1,i2,i3,i6,i4,3);
			    cd = gbcs(i1,i2,i3,i6,i4,4);
			    if (zeroDenominator) {
				done = false;
				zeroDenominator = false;
				zeroDenominatorCount++;
				int j5 = i5;
				int j6 = i6;
				int j7 = i7;
				i5 = j7;
				i6 = j5;
				i7 = j6;
			    }                       
			    if (zeroDenominatorCount > 6) {
				write(" zero denominator in vertex match, giving up : "  + i1 + " " + i2 + " " + i3 + " " + i4 + " " + i5 + " " + i6 + " " +i7);
				System.exit(0);
			    }
			}
			for (int j1 = d-r; j1 < d; j1++) {
			    for (int j2 = 0; j2 <= d-j1; j2++) {
				for (int j3 = 0; j3 <= d-j1-j2; j3++) {
				    int j4 = d-j1-j2-j3;
				    int m = identify(i1,j1,i2,j2,i3,j3,i4,j4);
				    nz[neq][m] = true;
				    A.put(neq,m,  -1);
                                    for (int j = 0; j < j4; j++) {
					A.put(neq,m,  mod(prod(A.get(neq,m),cd)));
				    }
                                    for (int j = 0; j < r; j++) {
					A.put(neq,m,  mod(prod(A.get(neq,m),bd)));
				    }
                                    for (int j = 0; j < r; j++) {
					A.put(neq,m,  mod(prod(A.get(neq,m),ad)));
				    }
				    for (int k1 = 0; k1 <= j4; k1++) {
					for (int k2=0; k2 <= j4-k1; k2++) {	
					    for (int k3 = 0; k3 <= j4-k1-k2; k3++) {
						int k6 = j4-k1-k2-k3;
                                                long b = Lbinom(j4,k1,k2,k3,k6);
						int a = mod(b);
						for (int p = 0; p < k1; p++) { 
						    a = mod(prod(a,c1)); 
						}
						for (int p = 0; p < k2; p++) { 
						    a = mod(prod(a,c2)); 
						}
						for (int p = 0; p < k3; p++) { 
						    a = mod(prod(a,c3)); 
						}
						for (int p = 0; p < k6; p++) { 
						    a = mod(prod(a,c6)); 
						}
						int rho = j3+k3;
						for (int l1 = 0; l1 <= rho; l1++) {
						    for (int l2 = 0; l2 <= rho-l1; l2++) {
							for (int l5 = 0; l5 <= rho-l1-l2; l5++) {
							    int l6 = rho - l1-l2-l5;
							    int aa = a;
							    for (int j = rho; j < r; j++) {
								aa = mod(prod(aa,bd));
							    }
							    long bb = Lbinom(rho,l1,l2,l5,l6);
							    int bbb = mod(bb);
							    aa = mod(prod(aa,bbb));
							    for (int p = 0; p < l1; p++) {
								aa = mod(prod(aa,b1)); 
							    }
							    for (int p = 0; p < l2; p++) {
								aa = mod(prod(aa,b2)); 
							    }
							    for (int p = 0; p < l5; p++) {
								aa = mod(prod(aa,b5)); 
							    }
							    for (int p = 0; p < l6; p++) {
								aa = mod(prod(aa,b6)); 
							    }
                                                            int sigma = j2 + k2 + l2;
							    for (int m1 = 0; m1 <= sigma; m1++) {
								for (int m5 = 0; m5 <= sigma-m1; m5++) {
								    for (int m6 = 0; m6 <= sigma - m1 - m5; m6++) {
									int m7 = sigma - m1 - m5 - m6;
									int aaa = aa;
                                                                        for (int j = sigma; j < r; j++) {
									    aaa = mod(prod(aaa,ad));
									}
                                                                        long ss = Lbinom(sigma,m1,m5,m6,m7);
                                                                        int s = mod(ss);
                                                                        aaa = mod(prod(s,aaa));
									for (int p = 0; p < m1; p++) {
									    aaa = mod(prod(aaa,a1)); 
									}
									for (int p = 0; p < m5; p++) {
									    aaa = mod(prod(aaa,a5)); 
									}
									for (int p = 0; p < m6; p++) {
									    aaa = mod(prod(aaa,a6)); 
									}
									for (int p = 0; p < m7; p++) {
									    aaa = mod(prod(aaa,a7)); 
									}
									int mmm = identify(i1,j1+k1+l1+m1,i5,l5+m5,i6,k6+l6+m6,i7,m7);
									nz[neq][mmm] = true;
									A.put(neq,mmm,  mod(plus(aaa,A.get(neq,mmm))));
								    }
								}
							    }
							}
						    }
						}
					    }
					}
				    }
				    neq++;
				}
			    }
			}
		    }
		}
	    }
	    try{
		if (listEqs) {
		    String file = tv.fileName.getText() + ".eqs";
		    PrintWriter eqs = new PrintWriter(new FileOutputStream(file));
		    for (int i = 0; i < Neqs; i++) {
			eqs.println(equation(i));
		    }
		    eqs.close();
		}
	    }
	    catch(java.io.FileNotFoundException e) {
		e.printStackTrace();
	    }
	    catch(java.io.IOException e) {
		e.printStackTrace();
	    }
	    eliminateIdentical();
	    eliminate();
	}
	catch(java.lang.ArrayIndexOutOfBoundsException e) {write("genInit:"+e);e.printStackTrace();}
    }

    void eliminate() {
        try{
	    int[] rows = new int[Neqs];
	    int[] cols = new int[Nvars];
	    for (int i = 0; i < Neqs; i++) {
		rows[i] = i;
	    }
	    for (int j = 0; j < Nvars; j++) {
		cols[j] = j;
	    }
	    /* reduce to triangular form */
	    mess("reducing to triangular form", Color.blue);
	    int m = min(Neqs,Nvars);
	    for (int k = 0; k < m; k++) {
		bar(k,m,Color.red, Color.yellow);
		/* k-th elimination stage - do total pivoting */
		int jpivot = -1, ipivot = -1;
		for (int j = k; j < Nvars; j++) {
		    int jcol = cols[j];
		    for (int i = k; i < Neqs; i++) {
			int irow = rows[i];
			if (A.get(irow,jcol) != 0) {
			    ipivot = i;
			    jpivot = j;
			    i = Neqs;
			    j = Nvars;
			}
		    }
		}
		if (jpivot == -1) {
		    m = k;
		    k = Neqs;
		    /* elimination is done --- exit */
		}
		else {
		    int dummy = rows[k];
		    rows[k] = rows[ipivot];
		    rows[ipivot] = dummy;
		    dummy = cols[k];
		    cols[k] = cols[jpivot];
		    cols[jpivot] = dummy;
		    int krow = rows[k];
		    int kcol = cols[k];
		    int pivot = A.get(krow,kcol);
		    for (int i = k+1; i < Neqs; i++) {
			int irow = rows[i];
			if (A.get(irow,kcol) != 0) {
			    int multiplier = A.get(irow,kcol);
			    A.put(irow,kcol,  0);
			    for (int j=k+1; j < Nvars; j++) {
				int jcol = cols[j];
				A.put(irow,jcol,  
				      mod(minus(mod(prod(pivot,A.get(irow,jcol))),
						mod(prod(multiplier,A.get(krow,jcol))))));
			    }
			}
		    }
		}
	    }
	    write (" The original matrix is " + Neqs + " by " + Nvars  + " and has rank " + m);
	    write (title + " r = " + r + " d = " + d + " dim Srd = " + (nDps - m));
	    /* now reduce the front part to a diagonal matrix */ 
	    mess ("Diagonalizing - dimension = " + (nDps-m), Color.blue);
	    for (int k = m-1; k > 0; k--) {
		bar(k,m-1,Color.green,Color.cyan);
		int kcol = cols[k];
		int krow = rows[k];
		int pivot = A.get(krow,kcol);
		for (int j = 0; j < k; j++) {
		    int jrow = rows[j];
		    if (A.get(jrow,kcol) !=0) {
			int multiplier = A.get(jrow,kcol);
			for (int mu = j; mu < Nvars; mu++) {
			    int mucol = cols[mu];
			    A.put(jrow,mucol,  
				  mod(minus(mod(prod(pivot,A.get(jrow,mucol))),
					    mod(prod(multiplier,A.get(krow,mucol))))));
			}
		    }
		}
	    } 
	    /* set global working array */
	    I = new int[m];
	    D = new int[m];
	    bI = new boolean[m];
	    for (int i = 0; i < m; i++) {
		I[i] = cols[i];
		bI[i] = false;
	    }
	    active = Nvars - m;
	    M = new int[active]; 
	    bM = new boolean[active];
	    for (int i = m; i < Nvars; i++) {
		M[i-m] = cols[i];
		bM[i-m] = false;
	    }
	    for (int i = 0; i < m; i++) {
		D[i] = A.get(rows[i],cols[i]);
	    }
	    AM = new int[m][active];
	    write(" the reduced matrix is " + m + " by " + active);
	    for (int i = 0; i < m; i ++) { 
		int irow = rows[i];
		for (int j = m; j < Nvars; j++) {
		    int jcol = cols[j];
		    AM[i][j-m] = A.get(irow,jcol);
		}
	    }
            A.report();
	    A = null;
	    rows = null;
	    cols = null;
	    dim = nDps - m;
	    rank = m;
	    BCsPrinted = true;
	    crosshair();
	    bar(0,10000,BGdefault, BGdefault);
	    LApresent = true;
	}
	catch(Exception e) {e.printStackTrace();}
	catch(Error e) {e.printStackTrace();}
    }

 

    int gbcs (int i0, int i1, int i2, int i3, int i4, int k) {
	/* return bk of vi4 = sum bi Vi, denominator if k = 4 */
        /* first see if we already have that face */
        for (int f = 0; f < ngbcs; f++) {
	    if (i0 == gBCs[f][0] && i1 == gBCs[f][1] && i2 == gBCs[f][2] && i3 == gBCs[f][3] && i4 == gBCs[f][4]) {
		return gBCs[f][5+k];
	    }
	}
        /* we don't */
        ngbcs++;
	int x = vtcs[i4][0];
	int y = vtcs[i4][1];
	int z = vtcs[i4][2];
	int x0 = vtcs[i0][0];
	int y0 = vtcs[i0][1];
	int z0 = vtcs[i0][2];
	int x1 = vtcs[i1][0];
	int y1 = vtcs[i1][1];
	int z1 = vtcs[i1][2];
	int x2 = vtcs[i2][0];
	int y2 = vtcs[i2][1];
	int z2 = vtcs[i2][2];
	int x3 = vtcs[i3][0];
	int y3 = vtcs[i3][1];
	int z3 = vtcs[i3][2];
	int denom = x0*y1*z2-x0*y1*z3-x0*z1*y2+x0*z1*y3+x0*y2*z3
	    -x0*y3*z2-y0*x1*z2+y0*x1*z3+y0*z1*x2-y0*z1*x3-y0*x2*z3+y0*x3*z2
	    +z0*x1*y2-z0*x1*y3-z0*y1*x2+z0*y1*x3+z0*x2*y3-z0*x3*y2-x1*y2*z3
	    +x1*y3*z2+y1*x2*z3-y1*x3*z2-z1*x2*y3+z1*x3*y2;
	if (denom == 0) {
            zeroDenominator = true;
            return 0;
	}
	int b0 = x*y1*z2-x*y1*z3-x*z1*y2+x*z1*y3+x*y2*z3-x*y3*z2-y*x1*z2
	    +y*x1*z3+y*z1*x2-y*z1*x3-y*x2*z3+y*x3*z2+z*x1*y2-z*x1*y3-z*y1*x2
	    +z*y1*x3+z*x2*y3-z*x3*y2-x1*y2*z3+x1*y3*z2
	    +y1*x2*z3-y1*x3*z2-z1*x2*y3+z1*x3*y2;
	int b1 = x0*y*z2-x0*y*z3-x0*z*y2+x0*z*y3+x0*y2*z3-x0*y3*z2
	    -y0*x*z2+y0*x*z3+y0*z*x2-y0*z*x3-y0*x2*z3+y0*x3*z2+z0*x*y2
	    -z0*x*y3-z0*y*x2+z0*y*x3+z0*x2*y3-z0*x3*y2-x*y2*z3+x*y3*z2
	    +y*x2*z3-y*x3*z2-z*x2*y3+z*x3*y2;
	int b2 = x0*y1*z-x0*y1*z3-x0*z1*y+x0*z1*y3+x0*y*z3-x0*z*y3
	    -y0*x1*z+y0*x1*z3+y0*z1*x-y0*z1*x3-y0*x*z3+y0*z*x3+z0*x1*y
	    -z0*x1*y3-z0*y1*x+z0*y1*x3+z0*x*y3-z0*y*x3-y*x1*z3+z*x1*y3
	    +x*y1*z3-z*y1*x3-x*z1*y3+y*z1*x3;
	int b3 = x0*y1*z2-x0*y1*z-x0*z1*y2+x0*z1*y+x0*z*y2-x0*y*z2-y0*x1*z2
	    +y0*x1*z+y0*z1*x2-y0*z1*x-y0*z*x2+y0*x*z2+z0*x1*y2-z0*x1*y
	    -z0*y1*x2+z0*y1*x+z0*y*x2-z0*x*y2-z*x1*y2+y*x1*z2
	    +z*y1*x2-x*y1*z2-y*z1*x2+x*z1*y2;
	long I0 = i0;
	long I1 = i1;
	long I2 = i2;
	long I3 = i3;
	long I4 = i4;
	long X = x;
	long Y = y;
	long Z = z;
	long X0 = x0;
	long Y0 = y0;
	long Z0 = z0;
	long X1 = x1;
	long Y1 = y1;
	long Z1 = z1;
	long X2 = x2;
	long Y2 = y2;
	long Z2 = z2;
	long X3 = x3;
	long Y3 = y3;
	long Z3 = z3;
	long DENOM = X0*Y1*Z2-X0*Y1*Z3-X0*Z1*Y2+X0*Z1*Y3+X0*Y2*Z3
	    -X0*Y3*Z2-Y0*X1*Z2+Y0*X1*Z3+Y0*Z1*X2-Y0*Z1*X3-Y0*X2*Z3+Y0*X3*Z2
	    +Z0*X1*Y2-Z0*X1*Y3-Z0*Y1*X2+Z0*Y1*X3+Z0*X2*Y3-Z0*X3*Y2-X1*Y2*Z3
	    +X1*Y3*Z2+Y1*X2*Z3-Y1*X3*Z2-Z1*X2*Y3+Z1*X3*Y2;
	long B0 = X*Y1*Z2-X*Y1*Z3-X*Z1*Y2+X*Z1*Y3+X*Y2*Z3-X*Y3*Z2-Y*X1*Z2
	    +Y*X1*Z3+Y*Z1*X2-Y*Z1*X3-Y*X2*Z3+Y*X3*Z2+Z*X1*Y2-Z*X1*Y3-Z*Y1*X2
	    +Z*Y1*X3+Z*X2*Y3-Z*X3*Y2-X1*Y2*Z3+X1*Y3*Z2
	    +Y1*X2*Z3-Y1*X3*Z2-Z1*X2*Y3+Z1*X3*Y2;
	long B1 = X0*Y*Z2-X0*Y*Z3-X0*Z*Y2+X0*Z*Y3+X0*Y2*Z3-X0*Y3*Z2
	    -Y0*X*Z2+Y0*X*Z3+Y0*Z*X2-Y0*Z*X3-Y0*X2*Z3+Y0*X3*Z2+Z0*X*Y2
	    -Z0*X*Y3-Z0*Y*X2+Z0*Y*X3+Z0*X2*Y3-Z0*X3*Y2-X*Y2*Z3+X*Y3*Z2
	    +Y*X2*Z3-Y*X3*Z2-Z*X2*Y3+Z*X3*Y2;
	long B2 = X0*Y1*Z-X0*Y1*Z3-X0*Z1*Y+X0*Z1*Y3+X0*Y*Z3-X0*Z*Y3
	    -Y0*X1*Z+Y0*X1*Z3+Y0*Z1*X-Y0*Z1*X3-Y0*X*Z3+Y0*Z*X3+Z0*X1*Y
	    -Z0*X1*Y3-Z0*Y1*X+Z0*Y1*X3+Z0*X*Y3-Z0*Y*X3-Y*X1*Z3+Z*X1*Y3
	    +X*Y1*Z3-Z*Y1*X3-X*Z1*Y3+Y*Z1*X3;
	long B3 = X0*Y1*Z2-X0*Y1*Z-X0*Z1*Y2+X0*Z1*Y+X0*Z*Y2-X0*Y*Z2-Y0*X1*Z2
	    +Y0*X1*Z+Y0*Z1*X2-Y0*Z1*X-Y0*Z*X2+Y0*X*Z2+Z0*X1*Y2-Z0*X1*Y
	    -Z0*Y1*X2+Z0*Y1*X+Z0*Y*X2-Z0*X*Y2-Z*X1*Y2+Y*X1*Z2
	    +Z*Y1*X2-X*Y1*Z2-Y*Z1*X2+X*Z1*Y2;
	long db0 = B0-b0;
	long db1 = B1-b1;
	long db2 = B2-b2;
	long db3 = B3-b3;
	long ddenom = DENOM - denom;
	if(db0 != 0 || db1 != 0 || db2 != 0 || db3 != 0 || ddenom !=0) {
	    write(" bc integer overflow ");
	    fishy = true;
	}
	int factor = denom;
	if (factor < 0) { factor = -factor;}
	factor = gcd(factor, b0);
	factor = gcd(factor, b1);
	factor = gcd(factor, b2);
	factor = gcd(factor, b3);
	if (denom < 0) {
	    factor = -factor;
	}
	denom = denom/factor;
	b0 = b0/factor;
	b1 = b1/factor;
	b2 = b2/factor;
	b3 = b3/factor;
	gBCs[ngbcs][0] = i0;
	gBCs[ngbcs][1] = i1;
	gBCs[ngbcs][2] = i2;
	gBCs[ngbcs][3] = i3;
	gBCs[ngbcs][4] = i4;
	gBCs[ngbcs][5] = b0;
	gBCs[ngbcs][6] = b1;
	gBCs[ngbcs][7] = b2;
	gBCs[ngbcs][8] = b3;
	gBCs[ngbcs][9] = denom;
	return gbcs (i0,i1,i2,i3,i4,k);
    }





    String mequation (int i) {
        String result = "";
        int P2 = (P-1)/2;
        int ip1 = i+1;
        for (int j = 0; j < Nvars; j++) {
            int jp1 = j+1;
	    if (A.get(i,j) != 0) {
		int a = A.get(i,j);
		if (a > P2) {
		    a = a - P;
		}
                result += "A(" + ip1 + "," + jp1 + ")=" + a + "; ";
	    }
	}
	return result;
    }



    String equation (int i) {
        int mode = tv.cMode.getSelectedIndex();
        String result = "";
	if (mode != 3) {
	    result = "eq(" + i + "):=";
	}
	else {
            result = "$0 = ";
	}
        int P2 = (P-1)/2;
        for (int j = 0; j < Nvars; j++) {
	    if (A.get(i,j) != 0) {
		int a = A.get(i,j);
		if (a > P2) {
		    a = a - P;
		}
                if (a == 1) {
		    result = result + "+" + cName(j);
		}
                else if (a == -1) {
		    result = result + "-" + cName(j);
		}
                else if (a < 0) {
                    a = -a;
		    result = result + " - " + a + "*" + cName(j);
		}
                else {
                    result = result + " + " + a + "*" + cName(j);
		}
	    }
	}
        if (mode != 3) {
	    result = result + ";";
	}
        else {
	    result = result + "$";
	}
	return result;
    }

    void indicateMemory() {
        boolean done = false;
        dim = -1;
        if (!tv.batch) {
	    try {
		int hsize = getSize().width;
		int vsize = getSize().height;
		A = null;
		AM = null;
                innocent();
		write (" out of memory ");
		Color yellow = new Color(255,255,75);
		g.setColor(yellow);
		g.fillRect(0,0,hsize,vsize);
		String s = " Out of Memory!";
		Font f = new Font("TimesRoman", Font.BOLD, 36);
		FontMetrics fm = getFontMetrics(f);
		int xstart = (hsize - fm.stringWidth(s))/2;
		int ystart = vsize/2 - 3*fm.getHeight();
		g.setFont(f);
		g.setColor(Color.red);
		g.drawString(s, xstart,ystart);
		s = " Sorry!";
		xstart = (hsize - fm.stringWidth(s))/2;
		ystart = vsize/2 - fm.getHeight();
		g.drawString(s, xstart,ystart);
		f = new Font("TimesRoman", Font.BOLD, 18);
		fm = getFontMetrics(f);
		g.setFont(f);
		g.setColor(Color.blue);
		s = " You should still be able to do";
		xstart = (hsize - fm.stringWidth(s))/2;
		ystart = vsize/2 + 4*fm.getHeight();
		g.drawString(s, xstart,ystart);
		s = "smaller problems ... ";
		xstart = (hsize - fm.stringWidth(s))/2;
		ystart = vsize/2 + 6*fm.getHeight();
		g.drawString(s, xstart,ystart);
		r = 1; tv.r = 1; tv.tr.setText(""+r);
		d = 1; tv.d = 1; tv.td.setText(""+d);
		init();
		mess(" out of memory, resetting ",Color.red);
		write(" out of memory");
	    }
	    catch (java.lang.OutOfMemoryError e) {
		write(" giving up ");
	    }
	}
    }


    int abs(int x) {
	if (x < 0) { 
	    return -x;
	}
        else {
	    return x;
	}
    }

    long abs(long x) {
	if (x < 0) { 
	    return -x;
	}
        else {
	    return x;
	}
    }

    int min(int i, int j) {
	if (i < j) {
	    return i;
	}
	else {
	    return j;
	}
    }

    int min(int a, int b, int c) {
        return min(a,min(b,c));
    }

    void mess(String s) {
        mess (s, Color.blue);
    }

    void mess(String s, Color C) {
        if (!tv.batch) {
	    Font ft = new Font("TimesRoman", Font.BOLD, 18);
	    FontMetrics fm = getFontMetrics(ft);
	    int xstart = (getSize().width - fm.stringWidth(s))/2;
	    xstart = 200;
	    int ystart = (int) (getSize().height*(1.0-border/2));
	    g.setColor(BG);
	    int height = fm.getMaxAscent();
	    try {g.drawImage(offscreenImage, 0, 0, this);}
	    catch (java.lang.NullPointerException e) {};
	    g.setFont(ft);
	    g.setColor(C);
	    g.drawString(s,xstart,ystart);
	    g.setColor(Color.black);	
	    g.setFont(f);
	    tv.Status.setText(s);
	}
    }

    void bar(int n, int m, Color c1, Color c2) {
        Thread.yield();
	tv.Status.setText(n+" / " + m);
        if (!tv.batch) {
	    int lngth = (int) (getSize().width);
	    int hght = 10;
	    int start = (int) (border*lngth);
	    int stop = lngth - start;
	    lngth = stop - start;
	    int y = (int) (getSize().height*(1.0-border/2))+5;
	    g.setColor(c1);
	    g.fillRect(start,y,lngth,hght);
	    if (m > 0) {
		int l = n*lngth/m;
		g.setColor(c2);
		g.fillRect(start,y,l,hght);
	    }
	    getToolkit().sync();
	}
    }

    void testA() {
	boolean OK = true;
        int nonzeros = 0;
        for (int i = 0; i < rank; i++) {
	    int sum = D[i];
            for (int j = 0; j < active; j++) {
                if (AM[i][j] != 0) {
		    nonzeros++;
		    sum = mod(plus(sum,AM[i][j]));
		}
	    }
	    if (sum != 0 ) {
		OK = false;
		write(" faulty row " + i);
		String s = "";
		for (int j = 0; j < active; j++) {
		    if (AM[i][j] !=0) {
			s = s + " " + j + ": " +AM[i][j];
		    }
		}
		s = s + " sum = " + sum;
		write(s);
	    }
	}
	if (OK) { 
	    write(" A ok! rank = " + rank + " active = " + active); 
	} 
	else {
	    write(" rank = " + rank + " active = " + active);
	    write (" catastrophic error --- contact Peter Alfeld"); 
	    fishy = true;
	    mess("catastrophic error");
	}
        int total = rank*active;
        write(" reduced matrix is " + rank + "x" + active);
        density = (int) (100* (double) nonzeros / (double) total);
        write(" density = " + nonzeros + "/" + total+ " = " + density + "%");
        String smods = (comma(modCount));
        write(" modCount = " + smods);
        if (OK) {
	    tv.Status.setText("A: OK " + rank+'x'+active + " " + density + "% " + smods + " mods");
	}
        else {
	    tv.Status.setText(" catastrophic error");
	}
    }

    String comma(long number) {
        String result = "";
        String sign = "";
        long it = number;
        if (it < 0) {
            it = -it;
            sign = "-";
	}
        while (it > 1000) {
            long part = it % 1000;
            String Part = ""+part;
            if (part < 10) {
		Part = "00"+Part;
	    }
            else if (part < 100) {
		Part = "0"+Part;
	    }
            result = "," + Part + result;
            it = it - part;
            it = it/1000;
	}
        result = sign + it + result;
        return result;
    }

    long prod(int m, int n) {
	long longm = m;
	long longn = n;
	return longm*longn;
    }

    long plus(int m, int n) {
	long longm = m;
	long longn = n;
	return longm+longn;
    }

    long minus(int m, int n) {
	long longm = m;
	long longn = n;
	return longm-longn;
    }

    int identify (int i0, int j0, int i1, int j1, int i2, int j2, int i3, int j3) {
        int result = -1;
        for (int i = 0; i < nDps; i++) {
            if (dps[i][i0] == j0 && dps[i][i1] == j1 && dps[i][i2] == j2 && dps[i][i3] == j3) {
                result = i;
                i = nDps;
	    }
	}
        if (result == -1) {
	    write(" cannot identify " + i0 + " " + j0 + "  " + i1 + " " + j1 + "  " + i2 + " " + j2 + "  " + i3 + " " + j3);
	    fishy = true;
	}
        return result;
    }

    int mod(long n, int modulus) {
	int result = 0;
	if (n !=0) {
	    long longresult = n % modulus;
	    result = (int) longresult;
	    if (result < 0) {
		result = result + modulus;
	    }
	    modCount++;
	}
	return result;
    }

    int mod(long n) {
        return mod(n,P);
    }

    void crosshair() {
	//        setCursor(java.awt.Cursor.getPredefinedCursor(java.awt.Cursor.CROSSHAIR_CURSOR));
	// this statement sometimes causes the package to freeze when restoring  - debug
    }

    void waiting() {
	//	setCursor(java.awt.Cursor.getPredefinedCursor(java.awt.Cursor.WAIT_CURSOR));
	// this statement sometimes causes the package to freeze when restoring - debug
    }

    void stage() {
	fishy = false;
        blankStatus();
        SuperPresent = false;
        selectSuper = false;
        nSuper = 0;
        SpecialPresent = false;
        selectSpecial = false;
	tv.Special.setBackground(Color.red);
	if (tv.SPECIAL != null) {
	    tv.SPECIAL.setVisible(false);
	    tv.SPECIAL = null;
	}
        nSpecial = 0;
        specialFace = -1;
        zoomed = false;
        innocent();
    }

    void init() {
	if (first) {
	    addMouseListener(this);
	    addMouseMotionListener(this);
	    addKeyListener(this);
            makeQ();
            crosshair();
            undos = new int[donesMax];
	    INT.init();
	    first = false;
	}
        if (tv.Star != null) {
            tv.Star.setVisible(false);
	    tv.Star = null;
	}
        if (!general) {
            steps = null;
	}
        LBgen = UBgen = 0;
	nz = null;
        stage();
        if (g == null && !tv.batch) {
	    g = getGraphics();
	    offscreenImage = createImage(getSize().width, getSize().height);
            oG = offscreenImage.getGraphics();
	    f = new Font("TimesRoman", Font.BOLD, 36);
	    fm = getFontMetrics(f);
	    g.setFont(f);
	    oG.setFont(f);
	}
	d = tv.d; r=tv.r; Diameter = tv.diameter;
        configuration = tv.configuration.getSelectedIndex();
        if (configuration != 5 && tv.CT != null) {
	    tv.CT.setVisible(false);
	}
        if (configuration != 6 && configuration !=11 && tv.MS != null) {
	    tv.MS.setVisible(false);
	}
        if (configuration != 8 && configuration !=13 && tv.WF != null) {
	    tv.WF.setVisible(false);
	}
        if (configuration != 21 && configuration !=22 && configuration !=23  && tv.PS != null) {
	    tv.PS.setVisible(false);
	}
        if (configuration != 8 && configuration !=13 && tv.DCTF != null) {
	    tv.DCTF.setVisible(false);
	}
        if (configuration != 17 && configuration !=18 && tv.MSF != null) {
	    tv.MSF.setVisible(false);
	}
        if (configuration != 9 && configuration != 14 && configuration != 24&& tv.dCT != null) {
	    tv.dCT.setVisible(false);
	}
        if (configuration > 0) {
            if (tv.TV.REFINE != null) {
		tv.TV.REFINE.setVisible(false);
                tv.TV.REFINE = null;
                tv.TV.refineOn = false;
                named = false;
                vColor();
	    }
            if (ask != null) {
		ask.setVisible(false);
                ask = null;
                tv.TV.refineOn = false;
	    }
	    if (configuration == 1) {
		title = " 1 tetrahedron";
		N = 1;
		V = 4;
		vtcs = new int[V][3];
		tets = new int[N][4];
		newTet(0,0,1,2,3);
		int count = -1;
		count++; newPoint(count,2,6,6);
		count++; newPoint(count,2,0,6);
		count++; newPoint(count,-2,3,3);
		count++; newPoint(count,0,3,0);
	    }
	    else if (configuration == 2) {
		title = " 2 tetrahedra";
		N = 2;
		V = 5;
		vtcs = new int[V][3];
		tets = new int[N][4];
		newTet(0,0,1,2,3);
		newTet(1,0,1,2,4);
		int count = -1;
		count++; newPoint(count,-3,6,0);
		count++; newPoint(count,3,0,3);
		count++; newPoint(count,-3,-6,0);
		count++; newPoint(count,0,0,6);
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = 2*(vtcs[0][i]+vtcs[1][i]+vtcs[2][i])/3-vtcs[3][i];
		}
	    }
	    else if (configuration == 3) {
		title = "3-orange";
		N = 3;
		V = 5;
		vtcs = new int[V][3];
		tets = new int[N][4];
		newPoint(0,-5,-5,0);
		newPoint(1,0,5,0);
		newPoint(2,5,-5,0);
		newPoint(3,0,0,5);
		newPoint(4,0,0,-5);
		newTet(0,0,1,3,4);            
		newTet(1,1,2,3,4);            
		newTet(2,0,2,3,4);            
	    }
	    else if (configuration == 4) {
		title = " type-I-cube";
		N = 6;
		V = 8;
		vtcs = new int[V][3];
		tets = new int[N][4];
		newTet(0,0,1,2,7);
		newTet(1,0,1,6,7);
		newTet(2,0,2,3,7);
		newTet(3,0,3,4,7);
		newTet(4,0,4,5,7);
		newTet(5,0,5,6,7);
		newPoint(0,-1,-1,-1);           
		newPoint(1, 1,-1,-1);           
		newPoint(2, 1, 1,-1);           
		newPoint(3,-1, 1,-1);           
		newPoint(4,-1, 1, 1);           
		newPoint(5,-1,-1, 1);           
		newPoint(6, 1,-1, 1);           
		newPoint(7, 1, 1, 1);           
	    }
	    else if (configuration == 5) {
		title = " Clough-Tocher";
		N = 4;
		V = 5;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newPoint(count,8,24,24);
		count++; newPoint(count,8,0,24);
		count++; newPoint(count,-8,12,12);
		count++; newPoint(count,0,12,0);
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[2][i]+vtcs[3][i])/4;
		}
		newTet(0,1,2,3,4);
		newTet(1,0,2,3,4);
		newTet(2,0,1,3,4);
		newTet(3,0,1,2,4);
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 6 ) {
		N = 15;
		V = 8;
		title = " Morgan-Scott";
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,4,5,6,7);
		count++; newTet(count,4,5,6,3);
		count++; newTet(count,4,5,2,7);
		count++; newTet(count,4,1,6,7);
		count++; newTet(count,0,5,6,7);
		count++; newTet(count,4,5,2,3);
		count++; newTet(count,4,6,1,3);
		count++; newTet(count,4,7,1,2);
		count++; newTet(count,5,6,0,3);
		count++; newTet(count,5,7,0,2);
		count++; newTet(count,6,7,0,1);
		count++; newTet(count,0,1,2,7);
		count++; newTet(count,0,1,6,3);
		count++; newTet(count,0,5,2,3);
		count++; newTet(count,4,1,2,3);
		count = -1;
		count++; newPoint(count,14,42,42);
		count++; newPoint(count,14,0,42);
		count++; newPoint(count,-14,21,21);
		count++; newPoint(count,0,21,0);
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7;
		    vtcs[5][i] = (2*vtcs[0][i]+vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7;
		    vtcs[6][i] = (2*vtcs[0][i]+2*vtcs[1][i]+vtcs[2][i]+2*vtcs[3][i])/7;
		    vtcs[7][i] = (2*vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+vtcs[3][i])/7;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 7) {
		title = "octahedron";
		N = 8;
		V = 7;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,0,1,2,5);            
		count++; newTet(count,0,2,3,5);            
		count++; newTet(count,0,3,4,5);            
		count++; newTet(count,0,1,4,5);            
		count++; newTet(count,0,1,2,6);            
		count++; newTet(count,0,2,3,6);            
		count++; newTet(count,0,3,4,6);            
		count++; newTet(count,0,1,4,6);            
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,1,0,0);
		count++; newPoint(count,0,1,0);
		count++; newPoint(count,-1,0,0);
		count++; newPoint(count,0,-1,0);
		count++; newPoint(count,0,0,1);
		count++; newPoint(count,0,0,-1);
	    }
	    else if (configuration == 8) {
		title = "Worsey-Farin";
		V = 9;
		N = 12;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,8,1,2,4); 
		count++; newTet(count,0,8,2,4); 
		count++; newTet(count,0,1,8,4); 
		count++; newTet(count,7,1,3,4); 
		count++; newTet(count,0,7,3,4); 
		count++; newTet(count,0,1,7,4); 
		count++; newTet(count,6,2,3,4); 
		count++; newTet(count,0,6,3,4); 
		count++; newTet(count,0,2,6,4); 
		count++; newTet(count,5,2,3,4); 
		count++; newTet(count,1,5,3,4); 
		count++; newTet(count,1,2,5,4); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,12,0,0);
		count++; newPoint(count,0,12,0);
		count++; newPoint(count,0,0,12);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/4; 
		    vtcs[5][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[6][i] = (vtcs[0][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[7][i] = (vtcs[1][i] + vtcs[0][i] + vtcs[3][i])/3;
		    vtcs[8][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[0][i])/3;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 9) {
		title = "double CT";
		V = 9;
		N = 16;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,0,1,2,8); 
		count++; newTet(count,4,1,2,8); 
		count++; newTet(count,0,4,2,8); 
		count++; newTet(count,0,1,4,8); 
		count++; newTet(count,0,1,3,7);
		count++; newTet(count,4,1,3,7); 
		count++; newTet(count,0,4,3,7); 
		count++; newTet(count,0,1,4,7); 
		count++; newTet(count,0,2,3,6); 
		count++; newTet(count,4,2,3,6); 
		count++; newTet(count,0,4,3,6); 
		count++; newTet(count,0,2,4,6); 
		count++; newTet(count,1,2,3,5); 
		count++; newTet(count,4,2,3,5); 
		count++; newTet(count,1,4,3,5); 
		count++; newTet(count,1,2,4,5); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,16,0,0);
		count++; newPoint(count,0,16,0);
		count++; newPoint(count,0,0,16);
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[2][i]+vtcs[3][i])/4;
		    vtcs[5][i] = (vtcs[4][i]+vtcs[1][i]+vtcs[2][i]+vtcs[3][i])/4;
		    vtcs[6][i] = (vtcs[0][i]+vtcs[4][i]+vtcs[2][i]+vtcs[3][i])/4;
		    vtcs[7][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[4][i]+vtcs[3][i])/4;
		    vtcs[8][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[2][i]+vtcs[4][i])/4;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 10) {
		title = "type-IV-cube";
		N = 24;
		V = 15;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,4,9,3,5);
		count++; newTet(count,4,9,5,6);
		count++; newTet(count,4,9,6,7);
		count++; newTet(count,4,9,7,3);
		count++; newTet(count,4,10,3,5);
		count++; newTet(count,4,10,5,2);
		count++; newTet(count,4,10,2,0);
		count++; newTet(count,4,10,0,3);
		count++; newTet(count,4,11,0,1);
		count++; newTet(count,4,11,1,7);
		count++; newTet(count,4,11,7,3);
		count++; newTet(count,4,11,3,0);
		count++; newTet(count,4,12,6,7);
		count++; newTet(count,4,12,7,1);
		count++; newTet(count,4,12,1,8);
		count++; newTet(count,4,12,8,6);
		count++; newTet(count,4,13,5,6);
		count++; newTet(count,4,13,6,8);
		count++; newTet(count,4,13,8,2);
		count++; newTet(count,4,13,2,5);
		count++; newTet(count,4,14,2,8);
		count++; newTet(count,4,14,8,1);
		count++; newTet(count,4,14,1,0);
		count++; newTet(count,4,14,0,2);
		int[] o = new int[3];
		int[] x = new int[3]; x[0] = 10;
		int[] y = new int[3]; y[1] = 10;
		int[] z = new int[3]; z[2] = 10;
		for (int i = 0; i < 3; i++) {
		    vtcs[0][i] = o[i];
		    vtcs[1][i] = x[i];
		    vtcs[2][i] = y[i];
		    vtcs[3][i] = z[i];
		    vtcs[4][i] = (x[i]+y[i]+z[i]-o[i])/2;
		    vtcs[5][i] = y[i]+z[i]-o[i];
		    vtcs[6][i] = x[i]+y[i]+z[i]-2*o[i];
		    vtcs[7][i] = x[i]+z[i]-o[i];
		    vtcs[8][i] = x[i]+y[i]-o[i];
		    vtcs[9][i] = (x[i]+y[i])/2+z[i]-o[i];
		    vtcs[10][i] = (y[i]+z[i])/2;
		    vtcs[11][i] = (x[i]+z[i])/2;
		    vtcs[12][i] = x[i]+(y[i]+z[i])/2-o[i];
		    vtcs[13][i] = y[i]+(x[i]+z[i])/2-o[i];
		    vtcs[14][i] = (x[i]+y[i])/2;
		}
	    }
	    else if (configuration == 11) {
		title = "generic Morgan-Scott";
		N = 15;
		V = 8;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,4,5,6,7);
		count++; newTet(count,4,5,6,3);
		count++; newTet(count,4,5,2,7);
		count++; newTet(count,4,1,6,7);
		count++; newTet(count,0,5,6,7);
		count++; newTet(count,4,5,2,3);
		count++; newTet(count,4,6,1,3);
		count++; newTet(count,4,7,1,2);
		count++; newTet(count,5,6,0,3);
		count++; newTet(count,5,7,0,2);
		count++; newTet(count,6,7,0,1);
		count++; newTet(count,0,1,2,7);
		count++; newTet(count,0,1,6,3);
		count++; newTet(count,0,5,2,3);
		count++; newTet(count,4,1,2,3);
		count = -1;
		count++; newPoint(count,140,420,420);
		count++; newPoint(count,140,0,420);
		count++; newPoint(count,-140,210,210);
		count++; newPoint(count,0,21,0);
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7+i;
		    vtcs[5][i] = (2*vtcs[0][i]+vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7-i;
		    vtcs[6][i] = (2*vtcs[0][i]+2*vtcs[1][i]+vtcs[2][i]+2*vtcs[3][i])/7+i*i;
		    vtcs[7][i] = (2*vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+vtcs[3][i])/7-i-1;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 12) {
		title = "generic octahedron";
		N = 8;
		V = 7;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,0,1,2,5);            
		count++; newTet(count,0,2,3,5);            
		count++; newTet(count,0,3,4,5);            
		count++; newTet(count,0,1,4,5);            
		count++; newTet(count,0,1,2,6);            
		count++; newTet(count,0,2,3,6);            
		count++; newTet(count,0,3,4,6);            
		count++; newTet(count,0,1,4,6);            
		count = -1;
		count++; newPoint(count,1,2,3);
		count++; newPoint(count,10,0,1);
		count++; newPoint(count,3,11,2);
		count++; newPoint(count,-12,0,0);
		count++; newPoint(count,-1,-13,2);
		count++; newPoint(count,1,-2,14);
		count++; newPoint(count,2,-3,-15);
	    }
	    else if (configuration == 13) {
		title = "generic Worsey-Farin";
		V = 9;
		N = 12;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,8,1,2,4); 
		count++; newTet(count,0,8,2,4); 
		count++; newTet(count,0,1,8,4); 
		count++; newTet(count,7,1,3,4); 
		count++; newTet(count,0,7,3,4); 
		count++; newTet(count,0,1,7,4); 
		count++; newTet(count,6,2,3,4); 
		count++; newTet(count,0,6,3,4); 
		count++; newTet(count,0,2,6,4); 
		count++; newTet(count,5,2,3,4); 
		count++; newTet(count,1,5,3,4); 
		count++; newTet(count,1,2,5,4); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,24,0,0);
		count++; newPoint(count,0,24,0);
		count++; newPoint(count,0,0,24);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/4 + i; 
		    vtcs[5][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[6][i] = (vtcs[0][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[7][i] = (vtcs[1][i] + vtcs[0][i] + vtcs[3][i])/3;
		    vtcs[8][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[0][i])/3;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 14) {
		title = "generic double CT";
		V = 9;
		N = 16;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,0,1,2,8); 
		count++; newTet(count,4,1,2,8); 
		count++; newTet(count,0,4,2,8); 
		count++; newTet(count,0,1,4,8); 
		count++; newTet(count,0,1,3,7);
		count++; newTet(count,4,1,3,7); 
		count++; newTet(count,0,4,3,7); 
		count++; newTet(count,0,1,4,7); 
		count++; newTet(count,0,2,3,6); 
		count++; newTet(count,4,2,3,6); 
		count++; newTet(count,0,4,3,6); 
		count++; newTet(count,0,2,4,6); 
		count++; newTet(count,1,2,3,5); 
		count++; newTet(count,4,2,3,5); 
		count++; newTet(count,1,4,3,5); 
		count++; newTet(count,1,2,4,5); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,32,0,0);
		count++; newPoint(count,0,32,0);
		count++; newPoint(count,0,0,32);
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[2][i]+vtcs[3][i])/4+i;
		    vtcs[5][i] = (vtcs[4][i]+vtcs[1][i]+vtcs[2][i]+vtcs[3][i])/4+1-i;
		    vtcs[6][i] = (vtcs[0][i]+vtcs[4][i]+vtcs[2][i]+vtcs[3][i])/4-1+i;
		    vtcs[7][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[4][i]+vtcs[3][i])/4+2-i;
		    vtcs[8][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[2][i]+vtcs[4][i])/4+1-2;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 15) {
		title = "generic type-IV";
		N = 24;
		V = 15;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,4,9,3,5);
		count++; newTet(count,4,9,5,6);
		count++; newTet(count,4,9,6,7);
		count++; newTet(count,4,9,7,3);
		count++; newTet(count,4,10,3,5);
		count++; newTet(count,4,10,5,2);
		count++; newTet(count,4,10,2,0);
		count++; newTet(count,4,10,0,3);
		count++; newTet(count,4,11,0,1);
		count++; newTet(count,4,11,1,7);
		count++; newTet(count,4,11,7,3);
		count++; newTet(count,4,11,3,0);
		count++; newTet(count,4,12,6,7);
		count++; newTet(count,4,12,7,1);
		count++; newTet(count,4,12,1,8);
		count++; newTet(count,4,12,8,6);
		count++; newTet(count,4,13,5,6);
		count++; newTet(count,4,13,6,8);
		count++; newTet(count,4,13,8,2);
		count++; newTet(count,4,13,2,5);
		count++; newTet(count,4,14,2,8);
		count++; newTet(count,4,14,8,1);
		count++; newTet(count,4,14,1,0);
		count++; newTet(count,4,14,0,2);
		int[] o = new int[3];
		int[] x = new int[3]; x[0] = 30; x[1] = 1; x[2] = -2;
		int[] y = new int[3]; y[1] = 30; y[0] = -1; y[2] = 3;
		int[] z = new int[3]; z[2] = 30; z[0] =2; z[1] = -3;
		for (int i = 0; i < 3; i++) {
		    vtcs[0][i] = o[i];
		    vtcs[1][i] = x[i];
		    vtcs[2][i] = y[i];
		    vtcs[3][i] = z[i];
		    vtcs[4][i] = (x[i]+y[i]+z[i]-o[i])/2 + i; 
		    vtcs[5][i] = y[i]+z[i]-o[i] - i;
		    vtcs[6][i] = x[i]+y[i]+z[i]-2*o[i] +i+1;
		    vtcs[7][i] = x[i]+z[i]-o[i]-i*i;
		    vtcs[8][i] = x[i]+y[i]-o[i]+i*i;
		    vtcs[9][i] = (x[i]+y[i])/2+z[i]-o[i]+i-1;;
		    vtcs[10][i] = (y[i]+z[i])/2+i-2;;
		    vtcs[11][i] = (x[i]+z[i])/2-i+2;;
		    vtcs[12][i] = x[i]+(y[i]+z[i])/2-o[i]+i*i-1;;
		    vtcs[13][i] = y[i]+(x[i]+z[i])/2-o[i]+i*1-2;;
		    vtcs[14][i] = (x[i]+y[i])/2-i*i+3;
		}
	    }
	    else if (configuration == 16) {
		title = "Rudin";
		N = 41;
		V = 14;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		int x1 = 0, x2 = 1, x3 = 2, x4 = 3;
		int u1 = 4, u2 = 5, u3 = 4, u4 = 5;
		int y1 = 6, y2 = 7, y3 = 8, y4 = 9;
		int z1 = 10, z2 = 11, z3 = 12, z4 = 13;
		count = -1;
		/* (1) */
		count++; newTet(count,x1,z1,x2,y1);    
		count++; newTet(count,x2,z2,x3,y2);    
		count++; newTet(count,x3,z3,x4,y3);    
		count++; newTet(count,x4,z4,x1,y4);    
		/* (2) */
		count++; newTet(count,x1,z2,x2,y1);       
		count++; newTet(count,x2,z3,x3,y2);       
		count++; newTet(count,x3,z4,x4,y3);       
		count++; newTet(count,x4,z1,x1,y4);       
		/* (3) */
		count++; newTet(count,z1,z2,x2,y1);
		count++; newTet(count,z2,z3,x3,y2);
		count++; newTet(count,z3,z4,x4,y3);
		count++; newTet(count,z4,z1,x1,y4);
		/* (4) */
		count++; newTet(count,z1,z2,x2,y2);
		count++; newTet(count,z2,z3,x3,y3);
		count++; newTet(count,z3,z4,x4,y4);
		count++; newTet(count,z4,z1,x1,y1);
		/* (5) */
		count++; newTet(count,z1,z2,z3,z4);
		/* (6) */
		count++; newTet(count,z1,z2,y1,z3);
		count++; newTet(count,z2,z3,y2,z4);
		count++; newTet(count,z3,z4,y3,z1);
		count++; newTet(count,z4,z1,y4,z2);
		/* (7) */
		count++; newTet(count,x1,z2,y1,z3);
		count++; newTet(count,x2,z3,y2,z4);
		count++; newTet(count,x3,z4,y3,z1);
		count++; newTet(count,x4,z1,y4,z2);
		/* (8) */
		count++; newTet(count,x1,z2,y3,z3);
		count++; newTet(count,x2,z3,y4,z4);
		count++; newTet(count,x3,z4,y1,z1);
		count++; newTet(count,x4,z1,y2,z2);
		/* (9) */
		count++; newTet(count,x1,u1,y3,z3);
		count++; newTet(count,x2,u2,y4,z4);
		count++; newTet(count,x3,u3,y1,z1);
		count++; newTet(count,x4,u4,y2,z2);
		/* (10) */
		count++; newTet(count,x1,u1,y1,z3);
		count++; newTet(count,x2,u2,y2,z4);
		count++; newTet(count,x3,u3,y3,z1);
		count++; newTet(count,x4,u4,y4,z2);
		/* (11) */
		count++; newTet(count,z1,u1,y1,z3);
		count++; newTet(count,z2,u2,y2,z4);
		count++; newTet(count,z3,u3,y3,z1);
		count++; newTet(count,z4,u4,y4,z2);
		int a1 = 58, a2 = 11, a3 = 3; int a = a1+a2+a3;
		int b1 = 54, b2 = 4, b3 = 14; int b = b1+b2+b3;
		vtcs[1][0] = a;
		vtcs[2][1] = a;
		vtcs[3][2] = a;
		for (int i = 0; i < 3; i++) {
		    /* ui */
		    vtcs[u1][i] = (vtcs[x1][i]+vtcs[x3][i])/2;
		    vtcs[u2][i] = (vtcs[x2][i]+vtcs[x4][i])/2;
		    /* yi */
		    vtcs[y1][i] = (a1*vtcs[x1][i] + a2*vtcs[x3][i] + a3*vtcs[x4][i])/a;
		    vtcs[y2][i] = (a1*vtcs[x2][i] + a2*vtcs[x4][i] + a3*vtcs[x1][i])/a;
		    vtcs[y3][i] = (a1*vtcs[x3][i] + a2*vtcs[x1][i] + a3*vtcs[x2][i])/a;
		    vtcs[y4][i] = (a1*vtcs[x4][i] + a2*vtcs[x2][i] + a3*vtcs[x3][i])/a;
		    /* zi */                                
		    vtcs[z1][i] = (b1*vtcs[x1][i] + b2*vtcs[x2][i] + b3*vtcs[x4][i])/b;
		    vtcs[z2][i] = (b1*vtcs[x2][i] + b2*vtcs[x3][i] + b3*vtcs[x1][i])/b;
		    vtcs[z3][i] = (b1*vtcs[x3][i] + b2*vtcs[x4][i] + b3*vtcs[x2][i])/b;
		    vtcs[z4][i] = (b1*vtcs[x4][i] + b2*vtcs[x1][i] + b3*vtcs[x3][i])/b;
		}
	    }
	    else if (configuration == 17) {
		title = "Morgan-Scott Face";
		N = 28;
		V = 17;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
                int i0 = 0;
                int i1 = 1;
                int i2 = 2;
                int j0 = 5;
                int j1 = 6;
                int j2 = 7;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
                i0 = 0; i1 = 1; i2 = 3; j0 = 8; j1 = 9; j2 = 10;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
                i0 = 0; i1 = 2; i2 = 3; j0 = 11; j1 = 12; j2 = 13;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
                i0 = 1; i1 = 2; i2 = 3; j0 = 14; j1 = 15; j2 = 16;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
		int[] o = new int[3];
		int[] x = new int[3]; x[0] = 40; x[1] = 0; x[2] = 20;
		int[] y = new int[3]; y[0] = 0; y[1] = 40; y[2] = 0;
		int[] z = new int[3]; z[0] = 0; z[1] = 0; z[2] = 40;
		for (int i = 0; i < 3; i++) {
		    vtcs[0][i] = o[i];
		    vtcs[1][i] = x[i];
		    vtcs[2][i] = y[i];
		    vtcs[3][i] = z[i];
		    vtcs[4][i] = (x[i]+y[i]+z[i]+o[i])/4;
                    i0 = 0; i1 = 1; i2 = 2; j0 = 5; j1 = 6; j2 = 7;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j1][i] = (2*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 2*vtcs[i1][i] + vtcs[i2][i])/5;
                    i0 = 0; i1 = 1; i2 = 3; j0 = 8; j1 = 9; j2 = 10;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j1][i] = (2*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 2*vtcs[i1][i] + vtcs[i2][i])/5;
                    i0 = 0; i1 = 2; i2 = 3; j0 = 11; j1 = 12; j2 = 13;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j1][i] = (2*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 2*vtcs[i1][i] + vtcs[i2][i])/5;
                    i0 = 1; i1 = 2; i2 = 3; j0 = 14; j1 = 15; j2 = 16;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j1][i] = (2*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/5;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 2*vtcs[i1][i] + vtcs[i2][i])/5;
		}
	    }
	    else if (configuration == 18) {
		title = "Wang/Morgan-Scott Face";
		N = 28;
		V = 17;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
                int i0 = 0;
                int i1 = 1;
                int i2 = 2;
                int j0 = 5;
                int j1 = 6;
                int j2 = 7;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
                i0 = 0; i1 = 3; i2 = 1; j0 = 8; j1 = 10; j2 = 9;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
                i0 = 0; i1 = 2; i2 = 3; j0 = 11; j1 = 12; j2 = 13;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
                i0 = 1; i1 = 3; i2 = 2; j0 = 14; j1 = 16; j2 = 15;
                count++; newTet(count,i0,i1,j2,4);
                count++; newTet(count,j0,i1,j2,4);
                count++; newTet(count,j0,i1,i2,4);
                count++; newTet(count,j0,j1,i2,4);
                count++; newTet(count,i0,j1,i2,4);
                count++; newTet(count,i0,j1,j2,4);                
                count++; newTet(count,j0,j1,j2,4);                
		int[] o = new int[3];
		int[] x = new int[3]; x[0] = 56; x[1] = 0; x[2] = 28;
		int[] y = new int[3]; y[0] = 0; y[1] = 56; y[2] = 0;
		int[] z = new int[3]; z[0] = 0; z[1] = 0; z[2] = 56;
		for (int i = 0; i < 3; i++) {
		    vtcs[0][i] = o[i];
		    vtcs[1][i] = x[i];
		    vtcs[2][i] = y[i];
		    vtcs[3][i] = z[i];
		    vtcs[4][i] = (x[i]+y[i]+z[i]+o[i])/4;
                    i0 = 0; i1 = 1; i2 = 2; j0 = 5; j1 = 6; j2 = 7;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 4*vtcs[i2][i])/7;
                    vtcs[j1][i] = (4*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/7;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 4*vtcs[i1][i] + vtcs[i2][i])/7;
		    i0 = 0; i1 = 3; i2 = 1; j0 = 8; j1 = 10; j2 = 9;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 4*vtcs[i2][i])/7;
                    vtcs[j1][i] = (4*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/7;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 4*vtcs[i1][i] + vtcs[i2][i])/7;
                    i0 = 0; i1 = 2; i2 = 3; j0 = 11; j1 = 12; j2 = 13;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 4*vtcs[i2][i])/7;
                    vtcs[j1][i] = (4*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/7;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 4*vtcs[i1][i] + vtcs[i2][i])/7;
		    i0 = 1; i1 = 3; i2 = 2; j0 = 14; j1 = 16; j2 = 15;
                    vtcs[j0][i] = (vtcs[i0][i] + 2*vtcs[i1][i] + 4*vtcs[i2][i])/7;
                    vtcs[j1][i] = (4*vtcs[i0][i] + vtcs[i1][i] + 2*vtcs[i2][i])/7;
                    vtcs[j2][i] = (2*vtcs[i0][i] + 4*vtcs[i1][i] + vtcs[i2][i])/7;
		}
	    }
	    else if (configuration == 19) {
		title = "double CT Face";
		N = 36;
		V = 21;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
                int i0 = 0;
                int i1 = 1;
                int i2 = 2;
                int j0 = 9;
                int j1 = 10;
                int j2 = 11;
                int k = 8;
                count++; newTet(count,i2,j1,k,4);    
                count++; newTet(count,i2,k,j0,4);    
                count++; newTet(count,i1,i2,j0,4);    
                count++; newTet(count,i1,j0,k,4);    
                count++; newTet(count,i1,j2,k,4);    
                count++; newTet(count,i0,i1,j2,4);    
                count++; newTet(count,i0,j2,k,4);    
                count++; newTet(count,i0,j1,k,4);    
                count++; newTet(count,i0,i2,j1,4);    
		i0 = 0; i1 = 1; i2 = 3; j0 = 12; j1 = 13; j2 = 14; k = 7;
                count++; newTet(count,i2,j1,k,4);    
                count++; newTet(count,i2,k,j0,4);    
                count++; newTet(count,i1,i2,j0,4);    
                count++; newTet(count,i1,j0,k,4);    
                count++; newTet(count,i1,j2,k,4);    
                count++; newTet(count,i0,i1,j2,4);    
                count++; newTet(count,i0,j2,k,4);    
                count++; newTet(count,i0,j1,k,4);    
                count++; newTet(count,i0,i2,j1,4);    
		i0 = 0; i1 = 2; i2 = 3; j0 = 15; j1 = 16; j2 = 17; k = 6;
                count++; newTet(count,i2,j1,k,4);    
                count++; newTet(count,i2,k,j0,4);    
                count++; newTet(count,i1,i2,j0,4);    
                count++; newTet(count,i1,j0,k,4);    
                count++; newTet(count,i1,j2,k,4);    
                count++; newTet(count,i0,i1,j2,4);    
                count++; newTet(count,i0,j2,k,4);    
                count++; newTet(count,i0,j1,k,4);    
                count++; newTet(count,i0,i2,j1,4);    
		i0 = 1; i1 = 2; i2 = 3; j0 = 18; j1 = 19; j2 = 20; k = 5;
                count++; newTet(count,i2,j1,k,4);    
                count++; newTet(count,i2,k,j0,4);    
                count++; newTet(count,i1,i2,j0,4);    
                count++; newTet(count,i1,j0,k,4);    
                count++; newTet(count,i1,j2,k,4);    
                count++; newTet(count,i0,i1,j2,4);    
                count++; newTet(count,i0,j2,k,4);    
                count++; newTet(count,i0,j1,k,4);    
                count++; newTet(count,i0,i2,j1,4);    
  		int[] o = new int[3];
		int[] x = new int[3]; x[0] = 72; x[1] = 0; x[2] = 36;
		int[] y = new int[3]; y[0] = 0; y[1] = 72; y[2] = 0;
		int[] z = new int[3]; z[0] = 0; z[1] = 0; z[2] = 72;
		for (int i = 0; i < 3; i++) {
		    vtcs[0][i] = o[i];
		    vtcs[1][i] = x[i];
		    vtcs[2][i] = y[i];
		    vtcs[3][i] = z[i];
		    vtcs[4][i] = (x[i]+y[i]+z[i]+o[i])/4;
                    i0 = 0; i1 = 1; i2 = 2; j0 = 9; j1 = 10; j2 = 11; k = 8;
                    vtcs[k][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j0][i] = (vtcs[k][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j1][i] = (vtcs[i0][i]+vtcs[k][i]+vtcs[i2][i])/3;
                    vtcs[j2][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[k][i])/3;
                    i0 = 0; i1 = 1; i2 = 3; j0 = 12; j1 = 13; j2 = 14; k = 7;
                    vtcs[k][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j0][i] = (vtcs[k][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j1][i] = (vtcs[i0][i]+vtcs[k][i]+vtcs[i2][i])/3;
                    vtcs[j2][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[k][i])/3;
                    i0 = 0; i1 = 2; i2 = 3; j0 = 15; j1 = 16; j2 = 17; k = 6;
                    vtcs[k][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j0][i] = (vtcs[k][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j1][i] = (vtcs[i0][i]+vtcs[k][i]+vtcs[i2][i])/3;
                    vtcs[j2][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[k][i])/3;
                    i0 = 1; i1 = 2; i2 = 3; j0 = 18; j1 = 19; j2 = 20; k = 5;
                    vtcs[k][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j0][i] = (vtcs[k][i]+vtcs[i1][i]+vtcs[i2][i])/3;
                    vtcs[j1][i] = (vtcs[i0][i]+vtcs[k][i]+vtcs[i2][i])/3;
                    vtcs[j2][i] = (vtcs[i0][i]+vtcs[i1][i]+vtcs[k][i])/3;
		}
	    }
	    else if (configuration == 20) {
		title = "8-cell";
		N = 8;
		V = 7;
		vtcs = new int[V][3];
		tets = new int[N][4];
                int count = -1;
                count++; newTet(count,0,1,2,3);
                count++; newTet(count,0,1,2,4);
                count++; newTet(count,0,1,3,6);
                count++; newTet(count,0,1,4,6);
                count++; newTet(count,0,3,4,6);
                count++; newTet(count,0,2,4,5);
                count++; newTet(count,0,2,3,5);
                count++; newTet(count,0,3,4,5);
  		int[] o = new int[3];
		int[] x = new int[3]; x[0] = 72; x[1] = 0; x[2] = 24;
		int[] y = new int[3]; y[0] = 0; y[1] = 72; y[2] = 0;
		int[] z = new int[3]; z[0] = 0; z[1] = 0; z[2] = 72;
		for (int i = 0; i < 3; i++) {
                    o[i] = 7+i;
		    vtcs[1][i] = o[i];
		    vtcs[2][i] = x[i];
		    vtcs[3][i] = y[i];
		    vtcs[4][i] = z[i];
		    vtcs[0][i] = (x[i]+y[i]+z[i]+o[i])/4+3+i;
		    vtcs[5][i] = (vtcs[2][i]+vtcs[4][i]+vtcs[3][i])/3; 
		    vtcs[5][i] = 2*vtcs[5][i] - vtcs[0][i];
		    vtcs[6][i] = (vtcs[1][i]+vtcs[4][i]+vtcs[3][i])/3; 
		    vtcs[6][i] = 2*vtcs[6][i] - vtcs[0][i];
		}
	    }
	    else if (configuration == 21) {
		title = "aligned Powell-Sabin";
		V = 14;
		N = 24;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,8,1,2,4); 
		count++; newTet(count,0,8,2,4); 
		count++; newTet(count,0,1,8,4); 
		count++; newTet(count,7,1,3,4); 
		count++; newTet(count,0,7,3,4); 
		count++; newTet(count,0,1,7,4); 
		count++; newTet(count,6,2,3,4); 
		count++; newTet(count,0,6,3,4); 
		count++; newTet(count,0,2,6,4); 
		count++; newTet(count,5,2,3,4); 
		count++; newTet(count,1,5,3,4); 
		count++; newTet(count,1,2,5,4); 
		count++; newTet(count,8,1,2,9); 
		count++; newTet(count,0,8,2,9); 
		count++; newTet(count,0,1,8,9); 
		count++; newTet(count,11,1,10,9); 
		count++; newTet(count,0,11,10,9); 
		count++; newTet(count,0,1,11,9); 
		count++; newTet(count,13,2,10,9); 
		count++; newTet(count,0,13,10,9); 
		count++; newTet(count,0,2,13,9); 
		count++; newTet(count,12,2,10,9); 
		count++; newTet(count,1,12,10,9); 
		count++; newTet(count,1,2,12,9); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,720,0,0);
		count++; newPoint(count,0,720,0);
		count++; newPoint(count,0,0,720);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/4; 
		    vtcs[5][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[6][i] = (vtcs[0][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[7][i] = (vtcs[1][i] + vtcs[0][i] + vtcs[3][i])/3;
		    vtcs[8][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[0][i])/3;
		    vtcs[9][i] = (2*vtcs[8][i] - vtcs[4][i]);
		    vtcs[10][i] = (2*vtcs[9][i] - vtcs[8][i]);
                    vtcs[11][i] = (vtcs[0][i]+vtcs[1][i] + vtcs[10][i])/3;
                    vtcs[12][i] = (vtcs[2][i]+vtcs[1][i] + vtcs[10][i])/3;
                    vtcs[13][i] = (vtcs[2][i]+vtcs[0][i] + vtcs[10][i])/3;
		}
	    }
	    else if (configuration == 22) {
		title = "Powell-Sabin";
		V = 14;
		N = 24;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,8,1,2,4); 
		count++; newTet(count,0,8,2,4); 
		count++; newTet(count,0,1,8,4); 
		count++; newTet(count,7,1,3,4); 
		count++; newTet(count,0,7,3,4); 
		count++; newTet(count,0,1,7,4); 
		count++; newTet(count,6,2,3,4); 
		count++; newTet(count,0,6,3,4); 
		count++; newTet(count,0,2,6,4); 
		count++; newTet(count,5,2,3,4); 
		count++; newTet(count,1,5,3,4); 
		count++; newTet(count,1,2,5,4); 
		count++; newTet(count,8,1,2,9); 
		count++; newTet(count,0,8,2,9); 
		count++; newTet(count,0,1,8,9); 
		count++; newTet(count,11,1,10,9); 
		count++; newTet(count,0,11,10,9); 
		count++; newTet(count,0,1,11,9); 
		count++; newTet(count,13,2,10,9); 
		count++; newTet(count,0,13,10,9); 
		count++; newTet(count,0,2,13,9); 
		count++; newTet(count,12,2,10,9); 
		count++; newTet(count,1,12,10,9); 
		count++; newTet(count,1,2,12,9); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,720,0,0);
		count++; newPoint(count,0,720,0);
		count++; newPoint(count,0,0,720);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/4; 
		    vtcs[5][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[6][i] = (vtcs[0][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[7][i] = (vtcs[1][i] + vtcs[0][i] + vtcs[3][i])/3;
		    vtcs[8][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[0][i])/3;
		    vtcs[9][i] = (2*vtcs[8][i] - vtcs[4][i]);
		    vtcs[10][i] = (2*vtcs[9][i] - vtcs[8][i]) + (vtcs[0][i]-vtcs[1][i])/30;
                    vtcs[11][i] = (vtcs[0][i]+vtcs[1][i] + vtcs[10][i])/3;
                    vtcs[12][i] = (vtcs[2][i]+vtcs[1][i] + vtcs[10][i])/3;
                    vtcs[13][i] = (vtcs[2][i]+vtcs[0][i] + vtcs[10][i])/3;
		}
	    }
	    else if (configuration == 23) {
		title = "generic Powell-Sabin";
		V = 14;
		N = 24;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,8,1,2,4); 
		count++; newTet(count,0,8,2,4); 
		count++; newTet(count,0,1,8,4); 
		count++; newTet(count,7,1,3,4); 
		count++; newTet(count,0,7,3,4); 
		count++; newTet(count,0,1,7,4); 
		count++; newTet(count,6,2,3,4); 
		count++; newTet(count,0,6,3,4); 
		count++; newTet(count,0,2,6,4); 
		count++; newTet(count,5,2,3,4); 
		count++; newTet(count,1,5,3,4); 
		count++; newTet(count,1,2,5,4); 
		count++; newTet(count,8,1,2,9); 
		count++; newTet(count,0,8,2,9); 
		count++; newTet(count,0,1,8,9); 
		count++; newTet(count,11,1,10,9); 
		count++; newTet(count,0,11,10,9); 
		count++; newTet(count,0,1,11,9); 
		count++; newTet(count,13,2,10,9); 
		count++; newTet(count,0,13,10,9); 
		count++; newTet(count,0,2,13,9); 
		count++; newTet(count,12,2,10,9); 
		count++; newTet(count,1,12,10,9); 
		count++; newTet(count,1,2,12,9); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,720,0,0);
		count++; newPoint(count,0,720,0);
		count++; newPoint(count,0,0,720);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/4 + 6*i; 
		    vtcs[5][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[6][i] = (vtcs[0][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[7][i] = (vtcs[1][i] + vtcs[0][i] + vtcs[3][i])/3;
		    vtcs[8][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[0][i])/3;
		    vtcs[9][i] = (2*vtcs[8][i] - vtcs[4][i])+(vtcs[2][i]-vtcs[1][i])/30;
		    vtcs[10][i] = (2*vtcs[9][i] - vtcs[8][i]);
                    vtcs[11][i] = (vtcs[0][i]+vtcs[1][i] + vtcs[10][i])/3;
                    vtcs[12][i] = (vtcs[2][i]+vtcs[1][i] + vtcs[10][i])/3;
                    vtcs[13][i] = (vtcs[2][i]+vtcs[0][i] + vtcs[10][i])/3;
		}
	    }
	    else if (configuration == 24) {
		title = "inverted";
		V = 8;
		N = 11;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
                count++; newTet(count,4,5,6,7);
                count++; newTet(count,0,5,6,7);
                count++; newTet(count,4,1,6,7);
                count++; newTet(count,4,5,2,7);
                count++; newTet(count,4,5,6,3);
		count++; newTet(count,0,1,2+4,3+4); 
		count++; newTet(count,0,1+4,2,3+4); 
		count++; newTet(count,0+4,1,2,3+4); 
		count++; newTet(count,0,1+4,2+4,3); 
		count++; newTet(count,0+4,1,2+4,3); 
		count++; newTet(count,0+4,1+4,2,3); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,3,0,0);
		count++; newPoint(count,0,3,0);
		count++; newPoint(count,0,0,3);
		for (int i = 0; i < 3; i++) {
		    vtcs[7][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[2][i])/3;
		    vtcs[6][i] = (vtcs[0][i]+vtcs[1][i]+vtcs[3][i])/3;
		    vtcs[5][i] = (vtcs[0][i]+vtcs[2][i]+vtcs[3][i])/3;
		    vtcs[4][i] = (vtcs[1][i]+vtcs[2][i]+vtcs[3][i])/3;
		}
	    }
	    /* checkTetrahedron(); */
	    else if (configuration == 25) {
		title = " t60 ";
		N = 1;
		V = 4;
		vtcs = new int[V][3];
		tets = new int[N][4];
		newTet(0,0,1,2,3);
		int count = -1;
		count++; newPoint(count,2,6,6);
		count++; newPoint(count,2,0,6);
		count++; newPoint(count,-2,3,3);
		count++; newPoint(count,0,3,0);
                combinatorics();
                allT60();
	    }
	    else if (configuration == 26) {
		title = " t504 ";
		N = 1;
		V = 4;
		vtcs = new int[V][3];
		tets = new int[N][4];
		newTet(0,0,1,2,3);
		int count = -1;
		count++; newPoint(count,2,6,6);
		count++; newPoint(count,2,0,6);
		count++; newPoint(count,-2,3,3);
		count++; newPoint(count,0,3,0);
                combinatorics();
                allT504();
	    }
	    else if (configuration == 27) {
		title = "symmetric Worsey-Piper";
		V = 15;
		N = 24;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,0,9,8,4);
		count++; newTet(count,9,1,8,4); 
		count++; newTet(count,1,12,8,4); 
		count++; newTet(count,12,2,8,4); 
		count++; newTet(count,2,10,8,4); 
		count++; newTet(count,10,0,8,4); 
		count++; newTet(count,0,10,6,4);
		count++; newTet(count,10,2,6,4); 
		count++; newTet(count,2,14,6,4); 
		count++; newTet(count,14,3,6,4); 
		count++; newTet(count,3,11,6,4); 
		count++; newTet(count,11,0,6,4); 
		count++; newTet(count,1,13,7,4);
		count++; newTet(count,13,3,7,4); 
		count++; newTet(count,3,11,7,4); 
		count++; newTet(count,11,0,7,4); 
		count++; newTet(count,0,9,7,4); 
		count++; newTet(count,9,1,7,4); 
		count++; newTet(count,1,13,5,4);
		count++; newTet(count,13,3,5,4); 
		count++; newTet(count,3,14,5,4); 
		count++; newTet(count,14,2,5,4); 
		count++; newTet(count,2,12,5,4); 
		count++; newTet(count,12,1,5,4); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,600,0,0);
		count++; newPoint(count,0,600,0);
		count++; newPoint(count,0,0,600);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/4; 
		    vtcs[5][i] = (vtcs[1][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[6][i] = (vtcs[0][i] + vtcs[2][i] + vtcs[3][i])/3;
		    vtcs[7][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[3][i])/3;
		    vtcs[8][i] = (vtcs[0][i] + vtcs[1][i] + vtcs[2][i])/3;
                    vtcs[9][i] = (vtcs[0][i] + vtcs[1][i])/2;
                    vtcs[10][i] = (vtcs[0][i] + vtcs[2][i])/2;
                    vtcs[11][i] = (vtcs[0][i] + vtcs[3][i])/2;
                    vtcs[12][i] = (vtcs[1][i] + vtcs[2][i])/2;
                    vtcs[13][i] = (vtcs[1][i] + vtcs[3][i])/2;
                    vtcs[14][i] = (vtcs[2][i] + vtcs[3][i])/2;
		}
		/* checkTetrahedron(); */
	    }
	    else if (configuration == 28) {
		title = "generic Worsey-Piper";
		V = 15;
		N = 24;
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; newTet(count,0,9,8,4);
		count++; newTet(count,9,1,8,4); 
		count++; newTet(count,1,12,8,4); 
		count++; newTet(count,12,2,8,4); 
		count++; newTet(count,2,10,8,4); 
		count++; newTet(count,10,0,8,4); 
		count++; newTet(count,0,10,6,4);
		count++; newTet(count,10,2,6,4); 
		count++; newTet(count,2,14,6,4); 
		count++; newTet(count,14,3,6,4); 
		count++; newTet(count,3,11,6,4); 
		count++; newTet(count,11,0,6,4); 
		count++; newTet(count,1,13,7,4);
		count++; newTet(count,13,3,7,4); 
		count++; newTet(count,3,11,7,4); 
		count++; newTet(count,11,0,7,4); 
		count++; newTet(count,0,9,7,4); 
		count++; newTet(count,9,1,7,4); 
		count++; newTet(count,1,13,5,4);
		count++; newTet(count,13,3,5,4); 
		count++; newTet(count,3,14,5,4); 
		count++; newTet(count,14,2,5,4); 
		count++; newTet(count,2,12,5,4); 
		count++; newTet(count,12,1,5,4); 
		count = -1;
		count++; newPoint(count,0,0,0);
		count++; newPoint(count,660,0,0);
		count++; newPoint(count,0,660,0);
		count++; newPoint(count,0,0,660);
		for (int i =0; i < 3; i++) {
		    vtcs[4][i] = (10*vtcs[0][i] + 11*vtcs[1][i] + 12*vtcs[2][i] + 13*vtcs[3][i])/46; 
		    vtcs[5][i] = (7*vtcs[1][i] + 7*vtcs[2][i] + 8*vtcs[3][i])/22;
		    vtcs[6][i] = (7*vtcs[0][i] + 8*vtcs[2][i] + 7*vtcs[3][i])/22;
		    vtcs[7][i] = (8*vtcs[0][i] + 7*vtcs[1][i] + 7*vtcs[3][i])/22;
		    vtcs[8][i] = (6*vtcs[0][i] + 9*vtcs[1][i] + 7*vtcs[2][i])/22;
                    vtcs[9][i] = (10*vtcs[0][i] + 12*vtcs[1][i])/22;
                    vtcs[10][i] = (12*vtcs[0][i] + 10*vtcs[2][i])/22;
                    vtcs[11][i] = (9*vtcs[0][i] + 13*vtcs[3][i])/22;
                    vtcs[12][i] = (13*vtcs[1][i] + 9*vtcs[2][i])/22;
                    vtcs[13][i] = (14*vtcs[1][i] + 8*vtcs[3][i])/22;
                    vtcs[14][i] = (8*vtcs[2][i] + 14*vtcs[3][i])/22;
		}
		/* checkTetrahedron();  */
	    }
            else if (configuration == 29) {
		title = "symmetric MS cone";
                N = 7;
                V = 7;
		vtcs = new int[V][3];
		tets = new int[N][4];
                newPoint(0,50,50,-50);
		newPoint(1,0,0,0);
		newPoint(2,0,150,0);
		newPoint(3,150,0,0);
		newPoint(4,(10*vtcs[1][0]+20*vtcs[2][0]+20*vtcs[3][0])/50,(10*vtcs[1][1]+20*vtcs[2][1]+20*vtcs[3][1])/50,0);
		newPoint(5,(20*vtcs[1][0]+10*vtcs[2][0]+20*vtcs[3][0])/50,(20*vtcs[1][1]+10*vtcs[2][1]+20*vtcs[3][1])/50,0);
		newPoint(6,(20*vtcs[1][0]+20*vtcs[2][0]+10*vtcs[3][0])/50,(20*vtcs[1][1]+20*vtcs[2][1]+10*vtcs[3][1])/50,0);
		newTet(0,0,4,5,6);
		newTet(1,0,1,5,6);
		newTet(2,0,2,4,6);
		newTet(3,0,3,4,5);
		newTet(4,0,1,3,5);
		newTet(5,0,1,2,6);
		newTet(6,0,2,3,4);
	    }
            else if (configuration == 30) {
		title = "generic MS cone";
                N = 7;
                V = 7;
		vtcs = new int[V][3];
		tets = new int[N][4];
                newPoint(0,50,50,-50);
		newPoint(1,0,0,0);
		newPoint(2,0,150,0);
		newPoint(3,150,0,0);
		newPoint(4,( 9*vtcs[1][0]+21*vtcs[2][0]+20*vtcs[3][0])/50,( 9*vtcs[1][1]+21*vtcs[2][1]+20*vtcs[3][1])/50,0);
		newPoint(5,(20*vtcs[1][0]+11*vtcs[2][0]+19*vtcs[3][0])/50,(20*vtcs[1][1]+11*vtcs[2][1]+19*vtcs[3][1])/50,0);
		newPoint(6,(20*vtcs[1][0]+20*vtcs[2][0]+10*vtcs[3][0])/50,(20*vtcs[1][1]+20*vtcs[2][1]+10*vtcs[3][1])/50,0);
		newTet(0,0,4,5,6);
		newTet(1,0,1,5,6);
		newTet(2,0,2,4,6);
		newTet(3,0,3,4,5);
		newTet(4,0,1,3,5);
		newTet(5,0,1,2,6);
		newTet(6,0,2,3,4);
	    }
	    else if (configuration == 31){
		if (tv.Gen  == null) {
		    tv.Gen = new gen();
		}
		tv.Gen.setVisible(true);
	    }
	    prepare();
	}
        else {
	    title = "imported";
	    if (!loaded && !tv.Cells) {
		if (ask == null) {
		    ask = new Dialog();
		}
		else {
		    ask.setVisible(true);
		}
	    }
	    else {
		prepare();
	    }
	}
        if (tv.Select != null) {
            tv.Select.setVisible(false);
	    tv.Select = null;
	    tv.selectOn = false;
            partial = false;
	}
    }

    void blankStatus() {
        tv.Status.setText("");
    }

    void storeV() {
	try {
	    String file = tv.VNAMES.fileName.getText();
            PrintWriter out = new PrintWriter(new FileOutputStream(file));
            for (int v = 0; v < V; v++) {
		out.println(nameV(v));
	    }
            for (int v = 0; v < V; v++) {
                Color c = vC[v];
		String s = c.getRed() + " " + c.getGreen() + " " + c.getBlue();
                out.println(s);
	    }
            write(" saved vertex names ");
            out.close();
            
	}
        catch(Exception e) {
	    write(" cannot save vertex names ");
	    e.printStackTrace();
	}
    }

    void restoreV() {
        try {
	    BufferedReader in = new BufferedReader
		(new InputStreamReader
		 (new FileInputStream(
				      new File(tv.VNAMES.fileName.getText()))));
            for (int v = 0; v < V; v++) {
		vN[v] = in.readLine();
	    }
            for (int v = 0; v < V; v++) {
		String line = in.readLine();
		line = line.replace(',',' ');
		line = line.trim();
		int k = line.indexOf(" "); 
		int R = Integer.parseInt(line.substring(0,k).trim());
		line = line.substring(k,line.length()).trim();
		k = line.indexOf(" "); 
		int G = Integer.parseInt(line.substring(0,k).trim()); 
		line = line.substring(k,line.length()).trim();
		int B = Integer.parseInt(line.trim()); 
                vC[v] = new Color(R,G,B);
	    }
            write("loaded vertex names");
            drawIt();
	}
        catch(Exception e) {
	    write(" cannot load vertex names ");
	    e.printStackTrace();
	}
    }

    void load(int n, String s) {
        try {
            general = false;
	    if (n == 0) {
		write("loading from file " + s + ":");
	    }
	    else if (n == 1) {
		write("loading from URL " + s + ":");
	    }
            else {
                general = true;
                if (n == 2) {
		    write("loading general configuration from file " + s + ":");
		}
                else {
		    write("loading general configration from URL " + s + ":");
		}
	    }
	    BufferedReader input;
	    if (n == 0 || n == 2) {
		File f = new File(s);
		FileInputStream is = new FileInputStream(f);
		input = new BufferedReader(new InputStreamReader(is)); 
	    }
	    else {
		URL url = new URL(s);
		input = new BufferedReader(new InputStreamReader(url.openStream()));
	    }
	    String line = input.readLine().trim();
	    line = line.replace(',',' ');
	    line = line.trim();
	    int k = line.indexOf(" ");
	    V = Integer.parseInt(line.substring(0,k).trim());
	    N = Integer.parseInt(line.substring(k,line.length()).trim());
	    vtcs = new int[V][3];
	    tets = new int[N][4];
	    for (int i = 0; i < V; i++) {
		line = input.readLine();
		line = line.replace(',',' ');
		line = line.trim();
		k = line.indexOf(" "); 
		int x0 = Integer.parseInt(line.substring(0,k).trim()); 
		line = line.substring(k,line.length()).trim();
		k = line.indexOf(" "); 
		int x1 = Integer.parseInt(line.substring(0,k).trim()); 
		line = line.substring(k,line.length()).trim();
		int x2 = Integer.parseInt(line.trim()); 
		newPoint(i,x0,x1,x2);
	    }
	    for (int i = 0; i < N; i++) {
		line = input.readLine();
                String readLine = line;
		line = line.replace(',',' ');
		line = line.trim();
		k = line.indexOf(" "); 
		int i0 = Integer.parseInt(line.substring(0,k).trim()); 
		line = line.substring(k,line.length()).trim();
		k = line.indexOf(" "); 
		int i1 = Integer.parseInt(line.substring(0,k).trim()); 
		line = line.substring(k,line.length()).trim();
		k = line.indexOf(" "); 
		int i2 = Integer.parseInt(line.substring(0,k).trim()); 
		line = line.substring(k,line.length()).trim();
		int i3 = Integer.parseInt(line.trim()); 
                if (i0 < 0 || i1 < 0 || i2 < 0 || i3 < 0 || i0 >=V || i1 >= V || i2 >= V || i3 >= V) {
		    write(" loading bad tetrahedron number " + i + " read " + readLine);
                    tv.Status.setText(" bad tetrahedron");
		}
		newTet(i,i0,i1,i2,i3);
	    }
	    loaded = true;
	    prepare();
	}
	catch(java.io.FileNotFoundException E) {write(""+E);}
	catch(java.net.MalformedURLException E) {write(""+E);}
	catch(java.io.IOException E) {write(""+E);}
    }

    void build(int n) {
	if (n == 1) {
	    title = "v10 <- 1 tet";
            N = 2;
            V = 7;
	    vtcs = new int[V][3];
	    tets = new int[N][4];
	    newTet(1,0,1,2,3);
	    newTet(0,0,4,5,6);
	    int count = -1;
	    count++; newPoint(count,0,12,-12);
	    count++; newPoint(count,12,-12,-12);
	    count++; newPoint(count,-12,-12,-12);
	    count++; newPoint(count,0,0,12);
	    count++; newPoint(count,6,12,-12);
	    count++; newPoint(count,0,18,-12);
	    count++; newPoint(count,0,12,-18);
	}
	else if (n == 2) {
	    title = "v21 <- 2 tets";
            N = 3;
            V = 10;          
	    vtcs = new int[V][3];
	    tets = new int[N][4];
	    tets = new int[N][4];
	    newTet(2,0,1,2,3);
            newTet(1,1,7,8,9);
	    newTet(0,0,4,5,6);
	    int count = -1;
	    count++; newPoint(count,0,12,-12);
	    count++; newPoint(count,12,-12,-12);
	    count++; newPoint(count,-12,-12,-12);
	    count++; newPoint(count,0,0,12);
	    count++; newPoint(count,6,12,-12);
	    count++; newPoint(count,0,18,-12);
	    count++; newPoint(count,0,12,-18);
	    count++; newPoint(count,18,-12,-12);
	    count++; newPoint(count,12,-18,-9);
	    count++; newPoint(count,12,-9,-18);
	}
	else if (n == 3) {
	    title = "v21 <- 3 tets";
            N = 4;
            V = 13;          
	    vtcs = new int[V][3];
	    tets = new int[N][4];
	    newTet(3,0,1,2,3);
            newTet(2,2,10,11,12);
            newTet(1,1,7,8,9);
	    newTet(0,0,4,5,6);
	    int count = -1;
	    count++; newPoint(count,0,12,-12);
	    count++; newPoint(count,12,-12,-12);
	    count++; newPoint(count,-12,-12,-12);
	    count++; newPoint(count,0,0,12);
	    count++; newPoint(count,6,12,-12);
	    count++; newPoint(count,0,18,-12);
	    count++; newPoint(count,0,12,-18);
	    count++; newPoint(count,18,-15,-9);
	    count++; newPoint(count,12,-18,-9);
	    count++; newPoint(count,12,-9,-18);
	    count++; newPoint(count,-18,-12,-12);
	    count++; newPoint(count,-12,-18,-12);
	    count++; newPoint(count,-12,-12,-18);


	}
	else if (n == 4) {
	    title = "v46";
	}
	else if (n == 5) {
	    title = "e10";
	}
	else if (n == 6) {
	    title = "e20";
	}
	else if (n == 7) {
	    title = "e21";
	}
	else if (n == 8) {
	    title = "e32";
	}
	else if (n == 9) {
	    title = "e3v1";
	}
	else if (n == 10) {
	    title = "e3f1";
	}
	else if (n == 11) {
	    title = "e44";
	}
	else if (n == 12) {
	    title = "e56";
	}
	else if (n == 13) {
	    title = "e612";
	}
	else if (n == 14) {
	    title = "ev11";
	}
	else if (n == 15) {
	    title = "ev12";
	}
	else if (n == 16) {
	    title = "ev21";
	}
	else if (n == 17) {
	    title = "fe11";
	}
	else if (n == 18) {
	    title = "fe12";
	}
	else if (n == 19) {
	    title = "fe13";
	}
	else if (n == 21) {
	    title = "fe21";
	}
	else if (n == 22) {
	    title = "fe31";
	}
	else if (n == 23) {
	    title = "fe1";
	}
	else if (n == 24) {
	    title = "fe2";
	}
	else if (n == 25) {
	    title = "fe3";
	}
	else if (n == 26) {
	    title = "fe4";
	}
        if (n > 0) {
            write(" building genral configuration " + n + " named " + title);
	    general = true;
            loaded = true;
            prepare();
	}
    }
    


    void Prepare() {
        /* prepare general assembly calculations */
        nDps = bico(d+3,3)*N*2;
        gBCs = new int[nDps][10];
        ngbcs = 0;
        Neqs = 0;
        Nvars = 0;
        dps = null;
        F = new facet[N];
	int[][] tempDps = new int[nDps][V+3];
        for (int i = 0; i < V; i++) {
	    tempDps[i][i] = d;
	}
        int count = V;
        for (int t = 0; t < N; t++) {
            int i0 = tets[t][0];
            int i1 = tets[t][1];
            int i2 = tets[t][2];
            int i3 = tets[t][3];
	    for (int i = 0; i <= d;  i++) {
		for (int j = 0; j <=d-i; j++) {
		    for (int k = 0; k <=d-i-j; k++) {
			int l = d-i-j-k;
                        boolean present = false;
                        for (int mu = 0; mu < count; mu++) {
                            if(tempDps[mu][i0] == i && tempDps[mu][i1] == j && tempDps[mu][i2] == k && tempDps[mu][i3] == l) {
                                present = true;
                                mu = count;
			    }
			}
                        if (!present) {
			    tempDps[count][i0] = i;
			    tempDps[count][i1] = j;
			    tempDps[count][i2] = k;
			    tempDps[count][i3] = l;
                            count++;
			}
		    }
		}
	    }
	}
        nDps = count;
	dps = new int[nDps][V+3];
        sortedDps = new int[nDps];
        for (int i = 0; i < nDps; i++) {
	    dps[i][V+2] = 1;
            sortedDps[i] = i;
            for (int j = 0; j < V; j++) {
		dps[i][j] = tempDps[i][j];      
	    }
            int location = 0;
            for (int j = 0; j < V; j++) {
		if (dps[i][j] > 0) {
		    location++;
		}
	    }
            dps[i][V] = location - 1;
	    sortedDps[i] = i;
	}
        tempDps = null;
        combinatorics();
        /* mark active points */
        for (int t = 1; t < N; t++) {
            F[t] = new facet(tets[t][0],tets[t][1],tets[t][2],tets[t][3]);
            for (int tau = 0; tau < t; tau++) {
		int i0 = tets[tau][0];          
		int i1 = tets[tau][1];          
		int i2 = tets[tau][2];          
		int i3 = tets[tau][3];          
		F[t].mark(i0,i1,i2);            
		F[t].mark(i0,i1,i3);            
		F[t].mark(i0,i2,i3);            
		F[t].mark(i1,i2,i3);            
		F[t].mark(i0,i1);
		F[t].mark(i0,i2);
		F[t].mark(i0,i3);
		F[t].mark(i1,i2);
		F[t].mark(i1,i3);
		F[t].mark(i2,i3);
		F[t].mark(i0);
		F[t].mark(i1);
		F[t].mark(i2);
		F[t].mark(i3);
	    }
	    for (int f = 0; f < 4; f++) {
		if (F[t].done[3][f] == 0) {
                    Neqs += bico(d+2,3) - bico(d-r+2,3);
		    int i0 = F[t].done[0][f];               
		    int i1 = F[t].done[1][f];               
		    int i2 = F[t].done[2][f];               
		    F[t].unmark(i0,i1);
		    F[t].unmark(i0,i2);
		    F[t].unmark(i1,i2);
                    F[t].unmark(i0);
                    F[t].unmark(i1);
                    F[t].unmark(i2);
		    for (int p = 0; p < nDps; p++) {
			if(dps[p][i0] + dps[p][i1] + dps[p][i2] >= d-r) {
			    dps[p][V+1] = 1;
			}
		    }
		}
	    }
	    for (int f = 4; f < 10; f++) {
		if (F[t].done[3][f] == 0) {
                    Neqs += ((r+2)*(r+1)*(3*d-2*r+3))/6 - (d+1);
		    int i0 = F[t].done[0][f];               
		    int i1 = F[t].done[1][f];               
		    F[t].unmark(i0);
		    F[t].unmark(i1);
		    for (int p = 0; p < nDps; p++) {
			if(dps[p][i0] + dps[p][i1] >= d-r) {
			    dps[p][V+1] = 1;
			}
		    }
		}

	    }
	    for (int f = 10; f < 14; f++) {
		if (F[t].done[3][f] == 0) {
		    Neqs += bico(r+3,3)-1;
		    int i0 = F[t].done[0][f];               
		    for (int p = 0; p < nDps; p++) {
			if(dps[p][i0] >= d-r) {
			    dps[p][V+1] = 1;
			}
		    }
		}
	    }
            boolean done = false;
            while (!done) {
                done = true;
                int uL = nDps-1;
		for (int p  = 0; p < uL; p++) {
		    for (int q = p+1; q < nDps; q++) {
			if (dps[p][V+1] == 0 && dps[q][V+1] == 1) {
			    done = false;
                            for (int i = 0; i < V+3; i++) {
				int temp = dps[p][i]; 
                                dps[p][i] = dps[q][i];
                                dps[q][i] = temp;
			    }
			    q = nDps;
			    p = nDps;
			}
		    }
		}
	    }
	}
	for (int p = 0; p < nDps; p++) {
	    if (dps[p][V+1] == 1) {
		Nvars++;
	    }
	}
	makeDps();
	vs = new int[V];
	for (int p = 0; p < nDps; p++) {
	    for (int v = 0; v < V; v++) {
		if (dps[p][v] == d) {
		    vs[v] = p;
		}
	    }
	}
        vfog = new double[V][3];
        vFogInt = new int[V][2];
    } 

    void prepare() {
        if (!named) {
	    vColor();
	}
	LApresent = false;
        GeometryPresent = false;
	BCsPrinted = false;
        reduceV();
        if (!general) {
	    combinatorics();
	    check();
	    makeDps();
	}
        else {
	    Prepare();
	}
        renderit();
        starting = false;
    }

    void check() {
        fishy = false;
        if (3*TB != 2*EB) {
            int x1 = 3*TB; int x2 = 2*EB;
	    write("combinatorics error " + " 3TB = " + x1 + " should equal 2EB = "+x2);
            fishy = true;
            drawIt();
	}
        if (TB != EB-VB+2) {
            int x1 = EB-VB+2;
	    write("combinatorics error " + "TB = " + TB + " should equal EB-VB+2 = " + x1);
            fishy = true;
            drawIt();
	}
        if (4*N != 2*TI + TB) {
	    int x1 = 4*N; int x2 = 2*TI+TB;
            write("combinatorics error " + "4N = " + x1 + "should equal 2TI+TB = " + x2);
            fishy = true;
            drawIt();
	}
        if (N-T+E-V !=-1) {
            int x1 = N-T+E-V;
            write("combinatorics error " + "N-T+E-V = " + x1 + "  should equal -1 ");
            fishy = true;
            drawIt();
	}
        if (fishy) {
	    tv.Status.setText(" combinatorics error ");
	}
    }



    long det(int i0, int i1, int i2, int i3) {
        int x0 = vtcs[i0][0];
        int y0 = vtcs[i0][1];
        int z0 = vtcs[i0][2];
        int x1 = vtcs[i1][0];
        int y1 = vtcs[i1][1];
        int z1 = vtcs[i1][2];
        int x2 = vtcs[i2][0];
        int y2 = vtcs[i2][1];
        int z2 = vtcs[i2][2];
	int x3 = vtcs[i3][0];
        int y3 = vtcs[i3][1];
        int z3 = vtcs[i3][2];
        long result = x0*y1*z2-x0*y1*z3-x0*z1*y2+x0*z1*y3+x0*y2*z3-x0*y3*z2
	    -y0*x1*z2+y0*x1*z3+y0*z1*x2-y0*z1*x3-y0*x2*z3+y0*x3*z2
	    +z0*x1*y2-z0*x1*y3-z0*y1*x2+z0*y1*x3+z0*x2*y3-z0*x3*y2
	    -x1*y2*z3+x1*y3*z2+y1*x2*z3-y1*x3*z2-z1*x2*y3+z1*x3*y2;
        return result;
    }

    long volume() {
        long sum = 0;
        for (int i = 0; i < N; i++) {
            long volume = abs(det(tets[i][0],tets[i][1],tets[i][2],tets[i][3])); 
	    sum = sum + volume;
            if (volume == 0) {
		write (" tetrahdron " + i + " has zero volume ");
                fishy = true;
	    }
	}       
        return sum;
    }


    void checkTetrahedron() {
       	/* see if the volumes of the tetrahedra add to the volume of the 
           overall tetrahdron */
        long total = abs(det(0,1,2,3));
        long sum = volume();
        if (sum == total) {
	    write(" sum check OK");
	}
	else {
            checkGeometry();
            write(" sum = " + sum + " total = " + total);
            fishy = true;
            drawIt();
	}
    }

    void reduceV () {
	/* remove common factor in vertex coordinates */
        int factor = 0;
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
                if (vtcs[i][j] != 0) {
                    factor = vtcs[i][j];
                    if (factor < 0) { factor = -factor; }
                    j = 3;
                    i = V;
		}
	    }
	}
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		factor = gcd(factor,vtcs[i][j]);
	    }
	}
        if (factor > 1) {
	    for (int i = 0; i < V; i++) {
		for (int j = 0; j < 3; j++) {
		    vtcs[i][j] = vtcs[i][j]/factor;
		}
	    }
	}
    }



    void makeQ() {
        Q = new double[3][3];
        Qidentity();
    }

    void Qidentity() {
        for (int i = 0; i < 3; i++) {
	    for (int j = 0; j < 3; j++) {
		Q[i][j] = 0.0;
	    }
            Q[i][i] = 1.0;
	}
    }

    void gs() {
	/* stabilize Q with Gram Schmidt */
        double norm = sqrt(Q[0][0]*Q[0][0] + Q[1][0]*Q[1][0] +Q[2][0]*Q[2][0]);
        Q[0][0] = Q[0][0]/norm;
        Q[1][0] = Q[1][0]/norm;
        Q[2][0] = Q[2][0]/norm;
        double gamma = -(Q[0][0]*Q[0][1]+Q[1][0]*Q[1][1]+Q[2][0]*Q[2][1]);
        Q[0][1] = Q[0][1] + gamma*Q[0][0];
        Q[1][1] = Q[1][1] + gamma*Q[1][0];
        Q[2][1] = Q[2][1] + gamma*Q[2][0];
        norm = sqrt(Q[0][1]*Q[0][1] + Q[1][1]*Q[1][1] +Q[2][1]*Q[2][1]);
        Q[0][1] = Q[0][1]/norm;
        Q[1][1] = Q[1][1]/norm;
        Q[2][1] = Q[2][1]/norm;
        gamma = -(Q[0][0]*Q[0][2]+Q[1][0]*Q[1][2]+Q[2][0]*Q[2][2]);
        Q[0][2] = Q[0][2] + gamma*Q[0][0];
        Q[1][2] = Q[1][2] + gamma*Q[1][0];
        Q[2][2] = Q[2][2] + gamma*Q[2][0];
        gamma = -(Q[0][1]*Q[0][2]+Q[1][1]*Q[1][2]+Q[2][1]*Q[2][2]);
        Q[0][2] = Q[0][2] + gamma*Q[0][1];
        Q[1][2] = Q[1][2] + gamma*Q[1][1];
        Q[2][2] = Q[2][2] + gamma*Q[2][1];
        norm = sqrt(Q[0][2]*Q[0][2] + Q[1][2]*Q[1][2] +Q[2][2]*Q[2][2]);
        Q[0][2] = Q[0][2]/norm;
        Q[1][2] = Q[1][2]/norm;
        Q[2][2] = Q[2][2]/norm;
    }

    void testQ() {
        double sum;
        write("testing Q");
        for (int i = 0; i < 3; i++) {
	    for (int j = 0; j < 3; j++) {
		sum = 0.0;
                for (int k = 0; k < 3; k++) {
		    sum = sum + Q[k][i]*Q[k][j];
		}
		write(i+" " + j +" " +sum);
	    }
	}
    }
    
    double sqrt(double x) { return java.lang.Math.sqrt(x);}

    void coloring() {
        int colors = 3+d/4; 
        uncertain = new Color[colors];
        implied = new Color[colors];
        inMDS = new Color[colors];
        for (int i = 0; i < colors; i++) {
	    uncertain[i] = new Color(i*255/(colors-1),255,i*128/(colors-1),Alpha
				     );
            inMDS[i] = new Color(255,i*128/(colors-1),i*255/(colors-1),Alpha);
            implied[i] = new Color(i*128/(colors-1),i*255/(colors-1),255,Alpha);
	}
        strongly = new Color(strongly.getRed(),strongly.getGreen(),strongly.getBlue(),Alpha);
        colInactive = new Color(colInactive.getRed(),colInactive.getGreen(),colInactive.getBlue(),Alpha);
    }

    void renderit() {
        /* We project the locations of the domain points into the plane
	   perpendicular to the first column of the orthogonal matrix Q,
	   and normalize the coordinates in that plane to fit into the
	   viewing window.  If x is a domain point its coordinates 
	   in the projection plane are the second and third entries of
	   QTx.  */
        waiting();
        coloring();
        if (!zoomed) {
	    xmin = 1.0E50;
	    ymin = xmin;
	    xmax = -xmin;
	    ymax = -ymin;
	}
	for (int i = 0; i < nDps; i++) {
	    double x = Q[0][1]*dpDouble[i][0]+Q[1][1]*dpDouble[i][1]+Q[2][1]*dpDouble[i][2];
	    double y = Q[0][2]*dpDouble[i][0]+Q[1][2]*dpDouble[i][1]+Q[2][2]*dpDouble[i][2];
	    if (!zoomed) {
		if (x > xmax) xmax = x; 
		if (x < xmin) xmin = x;       
		if (y > ymax) ymax = y; 
		if (y < ymin) ymin = y;       
	    }
	    dpFlat[i][0] = x;
	    dpFlat[i][1] = y;
	}
	if (!zoomed) {
	    double xadd = border*(xmax-xmin);
	    double yadd = border*(ymax-ymin);
	    xmin = xmin-xadd;
	    xmax = xmax + xadd;
	    ymin = ymin - yadd;
	    ymax = ymax + yadd;
	}
        sortDps();
        drawIt();
    }

    void zoomOut() {
	double xadd = 2*border*(xmax-xmin);
	double yadd = 2*border*(ymax-ymin);
	xmin = xmin - xadd;
	xmax = xmax + xadd;
	ymin = ymin - yadd;
	ymax = ymax + yadd;
	zoomed = true;
        renderit(); 
    }

    synchronized void drawIt() {
        if (!tv.batch) {
            facesPresent = false;
	    waiting();
            g.setColor(BG);
            oG.setColor(BG);
	    someDps = false;
	    width = getSize().width;
	    height = getSize().height;
	    xrange = xmax - xmin; 
	    yrange = ymax - ymin;
	    for (int i = 0; i < nDps; i++) {
		int dpx = (int)  ((dpFlat[i][0]-xmin)/xrange*width);
		int dpy = (int)  ((dpFlat[i][1]-ymin)/yrange*height);
		dpInt[i][0] = dpx;
		dpInt[i][1] = dpy;
		if (dpx > 0 && dpx < width && dpy > 0 && dpy < height) {
		    someDps = true;
		}
	    }
	    if (someDps) {
		coordsDrawn = false;
		if (fishy) {
		    BG = new Color(150,150,150);
		}
		else if (selectSuper) {
		    BG = new Color(210,230,255);
		}
		else if (selectSpecial) {
		    BG = new Color(255,220,250);
		}
		else {
		    int action = tv.globs.getSelectedIndex();
		    if (action == 0) {
			BG = BGdefault;
		    }
		    else {
			BG = new Color(240,255,230);
		    }
		}
                g.setColor(BG);
                oG.setColor(BG);
		g.fillRect(0,0,width,height);
		oG.fillRect(0,0,width,height);
		if (tv.showGrid) {
		    drawGrid();
		}
                ShadeFaces();
		drawEdges();
		drawSuper();
		drawSpecial();
		if (facesPresent) {
		    drawGrid();
		}
		Diameter = tv.diameter;
		int diameter = Diameter;
		for (int k = 0; k < nDps; k++) {
		    int i = sortedDps[k];
		    drawP(i);
		}
		if (tv.labelVtcs) {
		    g.setFont(f);
		    oG.setFont(f);
		    for (int i = 0; i < V; i++) {
                        if (drawThisVtx(i)) {
                            g.setColor(vC[i]);
                            oG.setColor(vC[i]);
			    g.drawString(nameV(i),dpInt[vs[i]][0]+10,dpInt[vs[i]][1]+10);
			    oG.drawString(nameV(i),dpInt[vs[i]][0]+10,dpInt[vs[i]][1]+10);
			}
		    }
		}
		g.setColor(Color.black);
		oG.setColor(Color.black);
	    }
	    crosshair();
	}

    }

    void markFace(int i) {
        g.setColor(new Color(200,50,0));
        int i0 = vs[faces[i][0]];
        int i1 = vs[faces[i][1]];
        int i2 = vs[faces[i][2]];
        markLine(i0,i1);
        markLine(i1,i2);
        markLine(i2,i0);
    }

    void markLine(int i0, int i1) {
        int x0 = dpInt[i0][0];
        int y0 = dpInt[i0][1];
        int x1 = dpInt[i1][0];
        int y1 = dpInt[i1][1];
	for (int i = -1; i < 2; i++) {
	    for (int j = -1; j < 2; j++) {
		g.drawLine(x0+i,y0+j,x1+i,y1+j);
	    }
	}
    }

    void drawLine(int i0, int i1) {
        int x0 = dpInt[i0][0];
        int y0 = dpInt[i0][1];
        int x1 = dpInt[i1][0];
        int y1 = dpInt[i1][1];
	for (int i = -1; i < 2; i++) {
	    for (int j = -1; j < 2; j++) {
		g.drawLine(x0+i,y0+j,x1+i,y1+j);
		oG.drawLine(x0+i,y0+j,x1+i,y1+j);
	    }
	}
    }

    int max (int i, int j) {
	if (j > i) {
	    return j;
	}
	else {
            return i;
	}
    }

    int tetrahedron(int i0, int i1, int i2, int i3) {
        for (int i = 0; i < N; i++) {
	    if (inTet(i0,i) && inTet(i1,i) && inTet(i2,i) && inTet(i3,i)) {
		return i;
	    }
	}
	return -1;
    }

    boolean inTet(int vertex, int tetrahedron) {
        if (vertex == tets[tetrahedron][0] ||
	    vertex == tets[tetrahedron][1] ||
	    vertex == tets[tetrahedron][2] ||
	    vertex == tets[tetrahedron][3]) {
	    return true;
	}
	else {
            return false;
	}
    }

    void drawSpecial() {
        for (int i = 0; i < nSpecial; i++) {
	    drawSpecial(i);
	}
    }

    void drawSpecial (int i) {
        int face = specialConds[i][0];
        int w = specialConds[i][1];
        boolean duplicated = false;
        int j0 = faces[face][0]; int i0 = dps[w][j0];
        int j1 = faces[face][1]; int i1 = dps[w][j1];
        int j2 = faces[face][2]; int i2 = dps[w][j2];
        int j3 = faces[face][3]; int i3 = dps[w][j3];
        int j4 = faces[face][4]; int i4 = dps[w][j4];
        int degree = max(i3,i4);
        int tet3 = tetrahedron(j0,j1,j2,j3);
        int tet4 = tetrahedron(j0,j1,j2,j4);
        boolean oriented = true;
        if (dps[w][j3] > 0) {
	    oriented = false;
	}
        int p0 = identify(j0,i0+degree, j1,i1, j2,i2, j3,0);
        int p1 = identify(j0,i0, j1,i1+degree, j2,i2, j3,0);
        int p2 = identify(j0,i0, j1,i1, j2,i2+degree, j3,0);
        int p3 = identify(j0,i0, j1,i1, j2,i2, j3,degree);
        int p4 = identify(j0,i0, j1,i1, j2,i2, j4,degree);
        for (int j = 0; j < i; j++) {
	    if (specialConds[j][0] == face) {
		if ( (!oriented && specialConds[j][1] == p4) ||
		     (oriented && specialConds[j][1] == p3)) {
		    duplicated = true;
                    j = i;
		}
	    }
	}
        g.setColor(new Color(255,0,255));
	oG.setColor(new Color(255,0,255));
        drawLine(p0,p1);
        drawLine(p1,p2);
        drawLine(p2,p0);
        if (!duplicated) {
	    if (oriented) {
		g.setColor(new Color(255,175,255));
		oG.setColor(new Color(255,175,255));
	    }
	    else {
		g.setColor(new Color(255,75,255));
		oG.setColor(new Color(255,75,255));
	    }
	}
        drawLine(p0,p3);
        drawLine(p1,p3);
        drawLine(p2,p3);
        if (!duplicated) {
	    if (!oriented) {
		g.setColor(new Color(255,175,255));
		oG.setColor(new Color(255,175,255));
	    }
	    else {
		g.setColor(new Color(255,75,255));
		oG.setColor(new Color(255,75,255));
	    }
	}
        drawLine(p0,p4);
        drawLine(p1,p4);
        drawLine(p2,p4);
    }

    void drawGrid() {
	if (tv.showGrid) {
	    g.setColor(new Color(180,180,255));
	    oG.setColor(new Color(180,180,255));
	    for (int n = 0; n < N; n++) {
                if (drawThis(n)) {
		    for (int i = 0; i <=d; i++) {
			for (int j = 0; j <= d-i; j++) {
			    int k = d-i-j;
			    if (i != d && j !=d && k != d) {
				gridLine(n, i,j,k,0, i,j,0,k);
				gridLine(n, i,j,k,0, i,0,k,j);
				gridLine(n, i,j,k,0, 0,j,k,i);
				gridLine(n, i,j,0,k, i,0,j,k);
				gridLine(n, i,j,0,k, 0,j,i,k);
				gridLine(n, i,0,j,k, 0,i,j,k);
			    }
			}
		    }
		}
	    }
	}
    }

    void drawSuper() {
        if (SuperPresent) {
	    for (int i = 0; i < nSuper; i++) {
		int kind = superConds[i][0];
		int which = superConds[i][1];
		int degree = superConds[i][2];
		if (kind == 3) {
		    if (degree == r+1) {
			g.setColor(new Color(255,200,200,Alpha));
			oG.setColor(new Color(255,200,200,Alpha));
		    }
		    else if (degree == r+2) {
			g.setColor(new Color(255,175,175,Alpha));
			oG.setColor(new Color(255,175,175,Alpha));
		    }
		    else if (degree == r+3) {
			g.setColor(new Color(255,150,150,Alpha));
			oG.setColor(new Color(255,150,150,Alpha));
		    }
		    else if (degree == r+4) {
			g.setColor(new Color(255,125,125,Alpha));
			oG.setColor(new Color(255,125,125,Alpha));
		    }
		    else  {
			g.setColor(new Color(255,100,Alpha));
			oG.setColor(new Color(255,100,Alpha));
		    }
		    Polygon p = new Polygon();
		    for (int j = 0; j < 3; j++) {
			p.addPoint(dpInt[vs[faces[which][j]]][0],dpInt[vs[faces[which][j]]][1]);
		    }
		    g.fillPolygon(p);
		    oG.fillPolygon(p);
		    facesPresent = true;
		}
	    }
	    if (facesPresent) {
		drawEdges();
	    }
	    for (int i = 0; i < nSuper; i++) {
		int kind = superConds[i][0];
		int which = superConds[i][1];
		int degree = superConds[i][2];
		if (kind == 1 && Diameter > 0) {
		    if (drawThisVtx(which)) {
			int x = dpInt[vs[which]][0];
			int y = dpInt[vs[which]][1];
			g.setColor(Color.red);
			oG.setColor(Color.red);
			int diameter = Diameter/2;
			for (int j = r; j < degree; j++) {
			    for (int k = 0; k < 3; k++) {
				g.drawOval(x-diameter-8*j-k,y-diameter-8*j-k,2*(diameter+8*j+k),2*(diameter+8*j+k));
				oG.drawOval(x-diameter-8*j-k,y-diameter-8*j-k,2*(diameter+8*j+k),2*(diameter+8*j+k));
			    }
			}
		    }
		}
		else if (kind == 2) {
                    if (drawThis(edges[which][0],edges[which][1])) {
			int x0 = dpInt[vs[edges[which][0]]][0];
			int y0 = dpInt[vs[edges[which][0]]][1];                
			int x1 = dpInt[vs[edges[which][1]]][0];
			int y1 = dpInt[vs[edges[which][1]]][1];                
			g.setColor(Color.red);
			oG.setColor(Color.red);
			Line(x0,y0,x1,y1);               
			if (degree > r+1) {
			    int z0 = y0-y1;
			    int z1 = x1-x0;
			    double s = sqrt(z0*z0+z1*z1);
			    z0 = (int) ((double)(8*z0)/s);
			    z1 = (int) ((double)(8*z1)/s);
			    for (int k = 2; k <= degree-r; k++) {
				int parity = k%2;
				int dist = (k-parity)/2;
				int sign = 2*parity - 1;
				int X0 = x0 + dist*sign*z0;
				int X1 = x1 + dist*sign*z0;
				int Y0 = y0 + dist*sign*z1;
				int Y1 = y1 + dist*sign*z1;
				Line(X0,Y0,X1,Y1);
			    }
			}                 
		    }
		}
	    }
	}
        if (SpecialPresent || selectSpecial) {
  	    for (int i = 0; i < nSpecial; i++) {
		drawSpecial(i);
	    }
	}
    }

    void Line(int x0, int y0, int x1, int y1) {
	for (int i = -1; i < 2; i++) {
	    for (int j = -1; j < 2; j++) {
		g.drawLine(x0+i,y0+j,x1+i,y1+j);
		oG.drawLine(x0+i,y0+j,x1+i,y1+j);
	    }
	}
    }

    void allVisible() {
	for (int i = 0; i < nDps; i++) {
	    dps[i][V+2] = 1;
	}
    }

    void drawEdges() {
        line[] lines = new line[E];
        line.p[0] = Q[0][0];
        line.p[1] = Q[1][0];
        line.p[2] = Q[2][0];
	for (int i = 0; i < E; i++) {
	    if (drawThis(edges[i][0],edges[i][1])) {
		lines[i] = new line(dpInt[vs[edges[i][0]]][0],dpInt[vs[edges[i][0]]][1],dpInt[vs[edges[i][1]]][0],dpInt[vs[edges[i][1]]][1],
				    dpDouble[vs[edges[i][0]]][0],dpDouble[vs[edges[i][0]]][1],dpDouble[vs[edges[i][0]]][2],
				    dpDouble[vs[edges[i][1]]][0],dpDouble[vs[edges[i][1]]][1],dpDouble[vs[edges[i][1]]][2]);
		lines[i].dashed = dEdges[i];
	    }
	}
        if (hidden) {
	    for (int i=0; i< E; i++) {
		if (drawThis(edges[i][0],edges[i][1])) {
		    for (int j = i+1; j < E; j++) {
			if (drawThis(edges[j][0],edges[j][1])) {
			    lines[i].intersect(lines[i],lines[j]);
			}
		    }
		}
	    }
	}
	for (int i=0; i < E; i++) {
	    if (drawThis(edges[i][0],edges[i][1])) {
		lines[i].draw(g,edgeColor[i],1);
		lines[i].draw(oG,edgeColor[i],1);
	    }
	}
    }

    boolean drawThisVtx (int v) {
	if (!partial || !tv.selectOn) {
	    return true;
	} 
	else {
	    for (int t = 0; t < N; t++) {
		if (inTet(v,t)) {
		    int j0 = tets[t][0];
		    int j1 = tets[t][1];
		    int j2 = tets[t][2];
		    int j3 = tets[t][3];
		    for (int k0 = 0; k0 <= d; k0++) {
			for (int k1 = 0; k1 <= d-k0; k1++) {
			    for (int k2 = 0; k2 <= d-k0-k1; k2++) {
				int k3 = d-k0-k1-k2;
				if(dps[findIndex(t,k0,k1,k2,k3)][V+2] == 1) {
				    return true;
				}
			    }
			}
		    }
		}
	    }
	}
	return false;
    }


    boolean drawThis(int i0, int i1) {
	/* return true if edge is associated with a tetrahedron that 
	   contains a drawn domain point */
	if (!partial || !tv.selectOn) {
	    return true;
	} 
	else {
	    for (int t = 0; t < N; t++) {
		if (inTet(i0,t) && inTet(i1,t)) {
		    int j0 = tets[t][0];
		    int j1 = tets[t][1];
		    int j2 = tets[t][2];
		    int j3 = tets[t][3];
		    for (int k0 = 0; k0 <= d; k0++) {
			for (int k1 = 0; k1 <= d-k0; k1++) {
			    for (int k2 = 0; k2 <= d-k0-k1; k2++) {
				int k3 = d-k0-k1-k2;
				if(dps[findIndex(t,k0,k1,k2,k3)][V+2] == 1) {
				    return true;
				}
			    }
			}
		    }
		}
	    }
	}
	return false;
    }

    boolean drawThis(int t) {
	/* return true if there is a drawn domain point in Tetrahedron t */
       
	if (!partial || !tv.selectOn) {
	    return true;
	} 
	else {
            int j0 = tets[t][0];
            int j1 = tets[t][1];
            int j2 = tets[t][2];
            int j3 = tets[t][3];
	    for (int k0 = 0; k0 <= d; k0++) {
		for (int k1 = 0; k1 <= d-k0; k1++) {
		    for (int k2 = 0; k2 <= d-k0-k1; k2++) {
			int k3 = d-k0-k1-k2;
			if(dps[findIndex(t,k0,k1,k2,k3)][V+2] == 1) {
			    return true;
			}
		    }
		}
	    }
	}
	return false;
    }

    void shadow() {
        rotated = true;
	g.setColor(fog);
        g.fillRect(0,0,width,height);       
	for (int i = 0; i < V; i++) {
	    double x = Q[0][1]*vfog[i][0]+Q[1][1]*vfog[i][1]+Q[2][1]*vfog[i][2];
	    double y = Q[0][2]*vfog[i][0]+Q[1][2]*vfog[i][1]+Q[2][2]*vfog[i][2];
	    vFogInt[i][0] = (int) ((x-xmin)/xrange*(width) );
	    vFogInt[i][1] = (int) ((y-ymin)/yrange*(height) );
	}
        g.setColor(Color.blue);
	for (int i = 0; i < E; i++) {
            int i0 = edges[i][0];
	    int i1 = edges[i][1];
	    g.drawLine(vFogInt[i0][0],vFogInt[i0][1],vFogInt[i1][0],vFogInt[i1][1]);
	}
    }

    void drawP(int i) {
        if (!tv.batch && Diameter > 0) {
	    int diameter = Diameter;
	    if (dps[i][V+2] == 1) { 
		if (dps[i][V+1] > 0) { 
		    int location = dps[i][V]; 
		    diameter = Diameter; 
		    g.setColor(Color.black);
		    oG.setColor(Color.black);
		    g.drawOval(dpInt[i][0]-diameter/2-1,dpInt[i][1]-diameter/2-1,diameter+2,diameter+2);
		    oG.drawOval(dpInt[i][0]-diameter/2-1,dpInt[i][1]-diameter/2-1,diameter+2,diameter+2); 
		    if (dps[i][V+1] == 1) {
			g.setColor(uncertain[location]);
			oG.setColor(uncertain[location]); 
		    }
		    else if (dps[i][V+1] == 2) {
			g.setColor(inMDS[location]);
			oG.setColor(inMDS[location]); 
		    }
		    else if (dps[i][V+1] == 3) {
			g.setColor(implied[location]);
			oG.setColor(implied[location]); 
		    }
		    else if (dps[i][V+1] == 4) {
			g.setColor(strongly);
			oG.setColor(strongly); 
		    }
		    else {
			write (" unknown status: " + i);
		    }
		} 
		else {
		    g.setColor(colInactive); 
                    oG.setColor(colInactive);
		    diameter = 12; 
		}
		g.fillOval(dpInt[i][0]-diameter/2,dpInt[i][1]-diameter/2,diameter,diameter);
		oG.fillOval(dpInt[i][0]-diameter/2,dpInt[i][1]-diameter/2,diameter,diameter);
		if (numbers) {
                    Color c = new Color(100,100,0);
		    g.setColor(c); oG.setColor(c);
		    g.setFont(small); oG.setFont(small);
		    g.drawString(""+i, dpInt[i][0],dpInt[i][1]); 
		    oG.drawString(""+i, dpInt[i][0],dpInt[i][1]); 
		}
	    } 
	}
    }

    void gridLine(int n, int i0, int i1, int i2, int i3, int j0,int j1, int j2, int j3) {
	int i = findIndex(n,i0,i1,i2,i3);
	int j = findIndex(n,j0,j1,j2,j3);
	g.drawLine(dpInt[i][0],dpInt[i][1],dpInt[j][0],dpInt[j][1]);
	oG.drawLine(dpInt[i][0],dpInt[i][1],dpInt[j][0],dpInt[j][1]);
    }

    int findIndex(int n, int i0, int i1, int i2, int i3) {
	for (int k = 0; k < nDps; k++) {
	    if (i0 == dps[k][tets[n][0]] &&
                i1 == dps[k][tets[n][1]] &&
                i2 == dps[k][tets[n][2]] &&
                i3 == dps[k][tets[n][3]]) {
		return k;
	    }
	}
	write ("*** index not found: " + n + " - " + i0 + " " + i1 + " " + i2 + " " + i3);
        fishy = true;
	return -1;
    }

    int bico(int m,int n) {
	if (m < n || m < 0 || n < 0) {
	    return 0;
	}
        else {
            int result = 1;
            int k = n;
            if (m-k > k) {
                k = m-k;
	    }
            for (int j = k+1; j <= m; j++) {
		result = result * j;
            }
            for (int j = 2; j <= m-k; j++) {
                result = result/j;
	    }
            return result;
	}
    }

    long fac(int m) {
        if (m < 2) {
	    return 1;
	}
        else {
	    long prod = 1;
            for (int j = 2; j <=m; j++) {
		prod = prod*j;
	    }
            return prod;
	}
    }

    void makeDps() {
        if (!general) {
	    dones = -1;
	    dps = null;
	    nDps = V + (d-1)*E + bico(d-1,2)*T + bico(d-1,3)*N;
	    impliedOnes = 0;
	    sofar = 0;
	    dps = new int[nDps][V+3];
	    sortedDps = null;
	    sortedDps = new int[nDps];
	    int count = 0;
	    for (int i = 0; i < V; i++) {
		dps[count][i]=d;
		dps[count][V]=0;
		dps[count][V+2] = 1;
		sortedDps[count] = count;
		count++;
	    }
	    for (int i = 0; i < E; i++) {
		int j0 = edges[i][0];
		int j1 = edges[i][1];
		for (int mu = 1; mu < d; mu++) {
		    dps[count][j0] = mu;
		    dps[count][j1] = d-mu;
		    dps[count][V]=1;
		    dps[count][V+2] = 1;
		    sortedDps[count] = count;
		    count++;
		}
	    }
	    for (int i = 0; i < T; i++) {
		int j0 = faces[i][0];
		int j1 = faces[i][1];
		int j2 = faces[i][2];
		for (int mu = 1; mu < d; mu++) {
		    for (int nu = 1; nu < d-mu; nu++) {
			int kappa = d-mu-nu;
			dps[count][j0] = mu;
			dps[count][j1] = nu;
			dps[count][j2] = kappa;
			dps[count][V] = 2;
			dps[count][V+2] = 1;
			sortedDps[count] = count;
			count++;
		    }
		}
	    }
	    for (int i =0; i < N; i++) {
		int j0 = tets[i][0];
		int j1 = tets[i][1];
		int j2 = tets[i][2];
		int j3 = tets[i][3];
		for (int mu = 1; mu < d; mu++) {
		    for (int nu = 1; nu < d-mu; nu++) {
			for (int kappa =1; kappa < d-mu-nu; kappa++) {
			    int rho = d-mu-nu-kappa;
			    dps[count][j0] = mu;                 
			    dps[count][j1] = nu;                 
			    dps[count][j2] = kappa;                 
			    dps[count][j3] = rho;                 
			    int m = java.lang.Math.min(mu,nu);
			    m = java.lang.Math.min(m,kappa);
			    m = java.lang.Math.min(m,rho);
			    dps[count][V+2] = 1;
			    sortedDps[count] = count;
			    dps[count][V] = m + 2;
			    count++;
			}
		    }
		}
	    }
	    if (count != nDps) {
		write("*** miscounted domain points " + count + " " + nDps);
	    }
	    write(" " + nDps + " domain points");
	    moveDps();
	}
	else {
	    sortedDps = null;
	    sortedDps = new int[nDps];
	    for (int p = 0; p < nDps; p++) {
		sortedDps[p] = p;
	    }
	}
        dpDouble = new double[nDps][3];
        dpInt = new int[nDps][2];
        dpFlat = new double[nDps][2];
        for (int i = 0; i < nDps; i++) {
	    dpDouble[i][0]=dpDouble[i][1]=dpDouble[i][2] = 0.0;
	    for (int j = 0; j < V; j++) {
		if (dps[i][j] !=0) {
		    double u = (double) dps[i][j];
                    dpDouble[i][0] = dpDouble[i][0] + u*vtcs[j][0];
                    dpDouble[i][1] = dpDouble[i][1] + u*vtcs[j][1];
                    dpDouble[i][2] = dpDouble[i][2] + u*vtcs[j][2];
		}
	    }
	}
        /* normalize to cube [-1..1,-1..1,-1..1] */
        double[] Mins = new double[3], Maxs = new double[3];
        for (int i = 0; i < 3; i++) {
	    Mins[i] = 1.0E50;
            Maxs[i] = - Mins[i];
            for (int j = 0; j < nDps; j++) {
		if (Mins[i] > dpDouble[j][i]) {
		    Mins[i] = dpDouble[j][i]; 
		}
		if (Maxs[i] < dpDouble[j][i]) {
		    Maxs[i] = dpDouble[j][i]; 
		}
	    }
	}
	for (int j = 0; j < nDps; j++) {
	    for (int i = 0; i < 3; i++) {
		dpDouble[j][i] = -1.0 + 2*(dpDouble[j][i]-Mins[i])/(Maxs[i]-Mins[i]);
	    }
	}
        activate();
    }

  
    void activate() {
        if (!general) {
	    /* mark active domain points as such */
	    for (int i = 0; i < nDps; i++) {
		dps[i][V+1] = 0;
	    }
	    if (r > 0) {
		for (int i = 0; i < TI; i++) {
		    int i0 = faces[i][0];
		    int i1 = faces[i][1];
		    int i2 = faces[i][2];
		    int i3 = faces[i][3];
		    int i4 = faces[i][4];
		    for (int j = 0; j < nDps; j++) {
			int faceIndcs = dps[j][i0]+dps[j][i1]+dps[j][i2]+dps[j][i3];
			if (faceIndcs == d && dps[j][i3] <= r) {
			    dps[j][V+1] = 1;
			}
			faceIndcs = dps[j][i0]+dps[j][i1]+dps[j][i2]+dps[j][i4];
			if (faceIndcs == d && dps[j][i4] <= r) {
			    dps[j][V+1] = 1;
			}
		    }
		}
	    }
	}
    }

    void listDps() {
        write(" domain points:") ;
        for (int i = 0; i < nDps; i++) {
	    String s = i +":  ";
            for (int j = 0; j < V; j++) {
		s = s + " " + dps[i][j];
	    }
	    s = s + " --- " + dps[i][V] + " " + + dps[i][V+1] + " " + + dps[i][V+2];
	    write(s);
	}
    }



    synchronized void sortDps() {
        waiting();
	double [] distance = new double[nDps];
        for (int i = 0; i < nDps; i++) {
	    distance[i] = Q[0][0]*dpDouble[i][0] + Q[1][0]*dpDouble[i][1] + Q[2][0]*dpDouble[i][2];
	}
        sortedDps = sorted(sortedDps, distance, nDps);
        crosshair();
    }

    synchronized int[] sorted(int[] sortIt, double[] size, int length) {
        if (length == 1) {
	    return sortIt;
	}
        else {
            boolean done = true;
            for (int i = 1; i < length; i++) {
		if (size[sortIt[i-1]] < size[sortIt[i]]) {
		    done = false;
                    i = length;
		}
	    }
	    if (done) {
		return sortIt;
	    }
            int k = length/2;
	    double pivot = size[sortIt[k]];
	    int[] bottom = new int[length];
	    int[] top = new int[length];
	    int[] sorted = new int[length];
	    int Top = 0;
	    int Bottom = 0;
	    for (int i = 0; i < length; i++) {
		if (i != k) {
		    if (size[sortIt[i]] < pivot) {
			top[Top] = sortIt[i];
			Top++;
		    }
		    else {
			bottom[Bottom] = sortIt[i];
			Bottom++;
		    }
		}

	    }
	    if (Top > 1) {
		top = sorted(top, size, Top);
	    }
            if (Bottom > 1) {
		bottom = sorted(bottom, size, Bottom);
	    }
	    for (int i = 0; i < Bottom; i++) {
		sorted[i] = bottom[i];
	    }
	    sorted[Bottom] = sortIt[k];
	    for (int i = 0; i < Top; i++) {
		sorted[Bottom+i+1] = top[i];
	    }
	    return sorted;
	}
    }
   
    void newTet(int i, int i0, int i1, int i2, int i3) {
        if (i0 >= V || i1 >= V || i2 >= V || i3 >= V) {
	    write (" vertex index too large - tetrahedron " + i + " vertices: " + i0 + " " + i1 + " " + i2 + " " + i3);
	}
        tets[i][0] = i0;
        tets[i][1] = i1;
        tets[i][2] = i2;
        tets[i][3] = i3;
        boolean sorted = false;
	while (!sorted) {
            sorted = true;
	    for (int j = 0; j < 3; j++) {
		if (tets[i][j] > tets[i][j+1]) {
		    sorted = false;
                    int dmy = tets[i][j];
                    tets[i][j] = tets[i][j+1];
                    tets[i][j+1] = dmy;
		}
	    }
	}
    }

    void newPoint(int i, int x0, int x1, int x2) {
        vtcs[i][0] = x0;
        vtcs[i][1] = x1;
        vtcs[i][2] = x2;
    }

    void checkUsed() {
	boolean[] used = new boolean[V];
	for (int i = 0; i < V; i++) {
	    used[i] = false;
	}
	for (int i = 0; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		used[tets[i][j]] = true;
	    }
	}
	for (int i = 0; i < V; i++) {
	    if (!used[i]) {write(" *** vertex " + i + " not used");}
	}
    }

    void combinatorics() {
        try {
	    Faces = new int[4*N][5]; bFaces = new boolean[4*N]; faceCount = 0;
	    for (int i = 0; i < 4*N; i++) { Faces[i][3]=-1; Faces[i][4] = -1; }
	    Edges = new int[6*N][3]; bEdges = new boolean[6*N]; edgeCount = 0;
	    bVertices = new boolean[V];
            checkUsed();
	    for (int i = 0; i < N; i++) {
		boolean done = false;
		while (!done) {
		    done = true;
		    for (int k = 0; k < 3; k++) {
			if (tets[i][k] > tets[i][k+1]) {
			    int dmy = tets[i][k];
			    tets[i][k] = tets[i][k+1];
			    tets[i][k+1] = dmy;
			    done = false;
			}
		    }
		}
	    }
	    for (int i = 0; i < N; i++) {
		face(tets[i][0],tets[i][1],tets[i][2],tets[i][3]);
		face(tets[i][0],tets[i][1],tets[i][3],tets[i][2]);
		face(tets[i][0],tets[i][2],tets[i][3],tets[i][1]);
		face(tets[i][1],tets[i][2],tets[i][3],tets[i][0]);
	    }
	    T = faceCount;
	    TB = 0;
	    TI = 0;
	    for (int i = 0; i < T; i++) {
		if (bFaces[i]) { TB++; } else { TI++;}
	    }
	    for (int cnt = 0; cnt < T; cnt++) {
		edge(Faces[cnt][0],Faces[cnt][1]);           
		edge(Faces[cnt][0],Faces[cnt][2]);           
		edge(Faces[cnt][1],Faces[cnt][2]);
	    }
	    for (int cnt = 0; cnt < T; cnt++) {
		if (bFaces[cnt]) {
		    bedge(Faces[cnt][0],Faces[cnt][1]);           
		    bedge(Faces[cnt][0],Faces[cnt][2]);           
		    bedge(Faces[cnt][1],Faces[cnt][2]);
		}
	    }
	    E = edgeCount;
	    EI = 0;
	    EB = 0;
	    for (int i = 0; i < E; i++) {
		if (bEdges[i]) {EB++; } else {EI++; }
	    }
	    for (int i = 0; i < V; i++) {
		bVertices[i] = false;
	    }
	    for (int i = 0; i < T; i++) {
		if (bFaces[i]) {
		    bVertices[Faces[i][0]] = true;
		    bVertices[Faces[i][1]] = true;
		    bVertices[Faces[i][2]] = true;
		}
	    }
	    faces = new int[T][5];
            shadeFaces = new boolean[T];
	    int cnt = 0;
	    for (int i = 0; i < T; i++) {
		if (!bFaces[i]) {
		    faces[cnt][0]=Faces[i][0];
		    faces[cnt][1]=Faces[i][1];
		    faces[cnt][2]=Faces[i][2];
		    faces[cnt][3]=Faces[i][3];
		    faces[cnt][4]=Faces[i][4];
		    cnt++;
		}
	    }
	    for (int i = 0; i < T; i++) {
		if (bFaces[i]) {
		    faces[cnt][0]=Faces[i][0];
		    faces[cnt][1]=Faces[i][1];
		    faces[cnt][2]=Faces[i][2];
		    faces[cnt][3]=Faces[i][3];
		    faces[cnt][4]=Faces[i][4];
		    cnt++;
		}
	    }
	    Faces =null; bFaces=null;
	    edges = new int[E][2];
            dEdges = new boolean[E];
            edgeColor = new Color[E];
	    cnt = 0;
	    for (int i = 0; i < E; i++) {
		if (!bEdges[i]) {
		    edges[cnt][0]=Edges[i][0];
		    edges[cnt][1]=Edges[i][1];
		    cnt++;
		}
	    }
	    for (int i = 0; i < E; i++) {
		if (bEdges[i]) {
		    edges[cnt][0]=Edges[i][0];
		    edges[cnt][1]=Edges[i][1];
		    cnt++;
		}
	    }
            colorEdges();
	    Edges = null; bEdges=null;
	    write(title + " combinatorics: \n" + N + " tetrahedra: ");
	    for(int i = 0; i < N; i++) {
		write(i + ": " + tets[i][0] + "," + tets[i][1] + "," + tets[i][2] + "," + tets[i][3]);
	    }
	    write(T + " faces ");
	    write(TI + " interior faces: ");
	    for (int i = 0; i < TI; i++) {
		write (i + ": " + faces[i][0] + " " + faces[i][1] + " " + faces[i][2] + " -- " + faces[i][3] + " " + faces[i][4]);
	    }
	    write(TB + " boundary faces: ");
	    cnt = 0;
	    for (int i = TI; i < T; i++) {
		write (i + ": " + faces[i][0] + " " + faces[i][1] + " " + faces[i][2] + " -- " + faces[i][3] + " " + faces[i][4]);
	    }
	    write(E + " edges");
	    write(EI + " interior edges: ");
	    for (int i = 0; i < EI; i++) {
		write(i + ": " + edges[i][0] + " " + edges[i][1] + " --- " + edegree(i)); 
	    }
	    write(EB + " boundary edges: ");   
	    for (int i = EI; i < E; i++) {
		write(i + ": " + edges[i][0] + " " + edges[i][1] + " --- " + edegree(i)); 
	    }
	    VB = 0;
	    VI = 0;
	    for (int i = 0; i < V; i++) {
		if (bVertices[i]) {VB++;} else {VI++;}
	    }
	    write(V + " vertices ");
	    write(VB + " boundary vertices:");
	    cnt = 0;
	    for (int i = 0; i< V; i++) {
		if (bVertices[i]) {write(cnt + ": " + i +" (" +vtcs[i][0]+","+vtcs[i][1]+","+vtcs[i][2]+")" + " --- " + vdegree(i)); cnt++;}
	    }
	    write(VI + " interior vertices:");
	    cnt = 0;
	    for (int i = 0; i < V; i++) {
		if (!bVertices[i]) {write(cnt + ": " + i +" (" +vtcs[i][0]+","+vtcs[i][1]+","+vtcs[i][2]+")" + " --- " + vdegree(i)); cnt++;}
	    }
            if (!general) {
		String s = "N = " + N + ", T = " + T + ", T_B = " + TB + ", T_I = " + TI 
		    + ", E = " + E + ", E_B = " + EB + ", E_I = " + EI 
		    + ", V = " + V + ", V_B = " + VB + ", V_I = " + VI ;
		write(s);
		int a1 = 2*N-2-TI+VI;
		int a2 = TI+1-N-2*VI;
		s = "a_0 = 1, a_1 = " + a1 +", a_2 = " + a2 + ", a_3 = " + VI;
		write("shelling parameters: \n " + s);
		tv.Status.setText(s);
	    }
        }
        catch(java.lang.ArrayIndexOutOfBoundsException E) { write (" combinatorial error " + E);E.printStackTrace();}
    }

    void colorEdges() {
	for (int e = 0; e < E; e++) {
	    if (e < EI) {
		edgeColor[e] = interiorEdge;
	    }
            else {
    		edgeColor[e] = boundaryEdge;
	    }
	}
        for (int e0 = 0; e0 < E; e0++) {
	    for (int e1 = e0+1; e1 < E; e1++) {
		for (int v = 0; v < V; v++) {
		    int i00 = edges[e0][0];
		    int i01 = edges[e0][1];
		    int i10 = edges[e1][0];
		    int i11 = edges[e1][1];
                    if ((v == i00 || v == i01) && (v == i10 || v == i11)) {
			int[] d0 = new int[3];
			int[] d1 = new int[3];
                        for (int i  = 0; i < 3; i++) {
                            d0[i] = vtcs[edges[e0][0]][i] - vtcs[edges[e0][1]][i];
                            d1[i] = vtcs[edges[e1][0]][i] - vtcs[edges[e1][1]][i];
			}
                        int p = 0; 
                        int q = 0; 
                        for (int i = 0; i < 3; i++) {
			    if (d1[i] != 0) {
				p = d0[i];
                                q = d1[i];
                                i = 3;
			    }
			}
                        boolean parallel = true;
                        for (int i = 0; i < 3; i++) {
			    if (q*d0[i] != p*d1[i]) {
				parallel = false;
			    }
			}
                        if (parallel) {
			    if (e0 < EI) {
				edgeColor[e0] = straightInterior;
			    }
                            else {
				edgeColor[e0] = straightBoundary;
			    }
			    if (e1 < EI) {
				edgeColor[e1] = straightInterior;
			    }
                            else {
				edgeColor[e1] = straightBoundary;
			    }
			}
		    }
		}
	    }
	}
    }                                    

    void edge(int i, int j) {
	boolean newEdge = true;
	for (int cnt = 0; cnt < edgeCount; cnt++) {
	    if (i == Edges[cnt][0] && j == Edges[cnt][1]) {newEdge = false;cnt = edgeCount;}
	}
	if (newEdge) {
	    Edges[edgeCount][0] = i;
	    Edges[edgeCount][1] = j;
	    edgeCount++;
	}
    }

    void bedge(int i, int j) {
	for (int cnt = 0; cnt < edgeCount; cnt++) {
	    if (i == Edges[cnt][0] && j == Edges[cnt][1]) {bEdges[cnt]= true; cnt = edgeCount;}
	}
    }

    void face(int i, int j, int k, int l) {
	boolean newFace = true;
	for (int cnt = 0; cnt < faceCount; cnt++) {
	    if (i == Faces[cnt][0] && j == Faces[cnt][1] && k == Faces[cnt][2]) {
                Faces[cnt][4] = l; 
		newFace = false;
		if (!bFaces[cnt]) { 
		    write (" *** face " + i + " " + j + " " + k + " occurs more than twice");
		    fishy = true;
		}
		bFaces[cnt] = false;
		cnt = faceCount;                
	    }
	}
	if (newFace) {
	    Faces[faceCount][0] = i;
	    Faces[faceCount][1] = j;
	    Faces[faceCount][2] = k;
            Faces[faceCount][3] = l;
	    bFaces[faceCount] = true;
	    faceCount++;
	}
    }
		
    void write(String s) {
	if (!silence) {
	    System.out.println(s);
	}
    }

    void debug(String s) {write(s);}
 
    void rotate() {
        double alpha = (double) (xup-xdown);
        double beta =  (double) (yup-ydown); 
        double[] r = new double[3];
        double[] s = new double[3];
        double[] u = new double[3];
        double[] v = new double[3];
        double[] p = new double[3];
        double[] phat = new double[3];
        double[] uhat = new double[3];
        double[] vhat = new double[3];
        double[] rhat = new double[3];
        double w = (double) getSize().width;
        double h = (double) getSize().height;
        double theta = 2*sqrt(alpha*alpha + beta*beta)/sqrt(h*h+w*w);
        for (int i = 0; i < 3; i++) {
	    r[i] = 0.0;
	    s[i] = 0.0;
	    p[i] = Q[i][0];
	    u[i] = Q[i][1];
	    v[i] = Q[i][2];
            phat[i] = 0.0;
            uhat[i] = 0.0;
            rhat[i] = 0.0;
	}
        double normr = 0.0;
        double norms = 0.0;
	for (int i=0; i < 3; i++) {
            double dmy = alpha*u[i] + beta*v[i];
	    r[i] = dmy;
	    normr = normr + dmy*dmy;
            if (beta !=0) {
		dmy = u[i] - alpha/beta*v[i];
	    }
            else {
                dmy = v[i] - beta/alpha*u[i];
	    }
	    s[i] = dmy;
	    norms = norms + dmy*dmy;
	}
        normr = sqrt(normr); norms = sqrt(norms);
        for (int i = 0; i < 3; i++) {
            r[i] = r[i]/normr;
            s[i] = s[i]/norms;
	}
	double cosTheta = java.lang.Math.cos(theta);
	double sinTheta = java.lang.Math.sin(theta);
        for (int i = 0; i < 3; i++) {
            phat[i] = cosTheta*p[i] + sinTheta*r[i];
            rhat[i] = cosTheta*r[i] - sinTheta*p[i];
	}
        double rTu = 0.0, sTu = 0.0, rTv = 0.0, sTv = 0.0;
        for (int i = 0; i < 3; i++) {
	    rTu = rTu + r[i]*u[i];
	    sTu = sTu + s[i]*u[i];
	    rTv = rTv + r[i]*v[i];
	    sTv = sTv + s[i]*v[i];
	}
        for (int i = 0; i < 3; i++) {
            Q[i][0] = phat[i];
            Q[i][1] = sTu*s[i] + rTu*rhat[i];
            Q[i][2] = sTv*s[i] + rTv*rhat[i];
	}
	gs(); 
    }

    void eraseCoords() {
	if (coordsDrawn) {
    	    g.setXORMode(coordColor); 
            g.setFont(f);
	    g.drawString(coordinates, xCoords, yCoords);
            drawDp(whichCoords);
	    coordsDrawn = false;
    	    g.setPaintMode(); 
	}
    }

    void drawDp(int k) {
	if (tv.showDynamicDps) {
	    int diameter = Diameter;
	    g.setXORMode(coordColor);
	    g.fillOval(dpInt[k][0]-diameter/2-1,dpInt[k][1]-diameter/2-1,diameter+2,diameter+2);
	    g.setPaintMode();
	}
    }

    String getCoordinates(int x, int y) {
        int k = getCs(x,y);
        if (k > -1) {
	    whichCoords = k;
            return cName(k);
	}
	else {
	    return "";
	}
    }


    int getCs(int x, int y) {
        int k = -1;
        int distance = 1000000000;
        for (int i = 0; i < nDps; i++) {
            if (dps[i][V+2] == 1) {
		int dmy = (x-dpInt[i][0])*(x-dpInt[i][0])+(y-dpInt[i][1])*(y-dpInt[i][1]);
		if (dmy < distance) {
		    k = i;
		    distance = dmy;
		}
	    }
	}
	return k;
    }

    void undo() {
	if (dones >= 0) {
	    int w = undos[dones];
	    for (int i = 0; i < nDps; i++) {
		boolean add = true;
		for (int j = 0; j < V; j++) {
		    if (dps[i][j] > 0 && dps[w][j] == 0) {
			add = false;
			j=V;
		    }
		}
		if (add) {
		    dps[i][V+2] = 1;
		}
	    }
	    renderit();
	}
        if (dones >=0 ){
	    dones--;
	}
    }

    void removeThem(int w) {
        if (dones < donesMax-1) {
	    dones++;
	}
        else {
            for (int i = 0; i < donesMax - 1; i++) {
		undos[i] = undos [i+1];
	    }
	}
	undos[dones] = w;
        for (int i = 0; i < nDps; i++) {
	    boolean remove = true;
	    for (int j = 0; j < V; j++) {
		if (dps[i][j] > 0 && dps[w][j] == 0) {
		    remove = false;
		    j=V;
		}
	    }
	    if (remove) {
		dps[i][V+2] = 0;
	    }
	}
    }

    void addSuper(int kind, int which) {
	if (nSuper == superMax) {
	    int[][] foo = new int[superMax][superProperties];
	    for (int i = 0; i < superMax; i++) {
		for (int j = 0; j < superProperties; j++) {
		    foo[i][j] = superConds[i][j];
		}
	    }
	    int superMax2 = 2*superMax;
	    superConds = new int[superMax2][superProperties];
	    for (int i = 0; i < superMax; i++) {
		for (int j = 0; j < superProperties; j++) {
		    superConds[i][j] = foo[i][j];
		}
	    }
	    superMax = superMax2;
	}
	if (!(kind == 3 && which >=TI )) {
	    boolean present = false;
	    int degree = 0;
	    for (int i = 0; i < nSuper; i++) {
		if (superConds[i][0] == kind && superConds[i][1] == which) {
		    present = true;
		    if (degree < superConds[i][2]) {
			degree = superConds[i][2];
		    }
		}
	    }
	    if (degree < d) {
		if (present) {
		    superConds[nSuper][0] = kind;
		    superConds[nSuper][1] = which;
		    superConds[nSuper][2] = degree + 1;
		}
		else {
		    superConds[nSuper][0] = kind;
		    superConds[nSuper][1] = which;
		    superConds[nSuper][2] = r + 1;
		}
		if (activateSuper(nSuper)) {
		}
		for (int i = 0; i < nDps; i++) {
		    if (dps[i][V+1] > 0) {
			dps[i][V+1] = 1;
		    }
		}
		nSuper++;
		SuperPresent = true;
	    }
	}
    }

    public void mouseReleased(java.awt.event.MouseEvent E) {
	addEvent(E,4);
    }

    public void MouseReleased(java.awt.event.MouseEvent E) {
	int modifiers = E.getModifiers();
	if ((modifiers == E.BUTTON3_MASK || modifiers == E.BUTTON1_MASK + E.CTRL_MASK) && rotated) {
	    rotated = false;
	    renderit();
	}
	else if (modifiers == E.BUTTON2_MASK  || modifiers == E.BUTTON1_MASK + E.SHIFT_MASK) {
	    xZoom1 = E.getX();
	    yZoom1 = E.getY();
	    width = getSize().width;
	    height = getSize().height;
	    if (xZoom1 < xZoom0) {
		int dmy = xZoom0; xZoom0 = xZoom1; xZoom1 = dmy;
	    }
	    if (yZoom1 < yZoom0) {
		int dmy = yZoom0; yZoom0 = yZoom1; yZoom1 = dmy;
	    }
	    if ( (xZoom1 - xZoom0) > 20 && (yZoom1 - yZoom0) > 20 ) {
		xxmin = ((width-xZoom0)*xmin+xZoom0*xmax)/width;
		xxmax = ((width-xZoom1)*xmin+xZoom1*xmax)/width;
		yymin = ((height-yZoom0)*ymin+yZoom0*ymax)/height;
		yymax = ((height-yZoom1)*ymin+yZoom1*ymax)/height;
		xminold = xmin; xmaxold = xmax; yminold = ymin; ymaxold = ymax;
		xmin = xxmin; xmax = xxmax; ymin = yymin; ymax = yymax; 
		zoomed = true;
		if (!someDps) {
		    xmin = xminold;xmax = xmaxold; ymin = yminold;ymax = ymaxold; 
		    if (zoomDrawn) {
			g.setXORMode(BGdefault);
			g.drawRect(min(xZoom0,oldZoomx),min(yZoom0,oldZoomy),abs(oldZoomx-xZoom0),abs(oldZoomy-yZoom0));
			g.setPaintMode();
		    }
		}
                else {
		    drawIt();
		}
		zoomDrawn = false;
	    }
	}
    } 

    public void mouseClicked(java.awt.event.MouseEvent E) {
        addEvent(E,2);
    }

    public void MouseClicked(java.awt.event.MouseEvent E) {
	int modifiers = E.getModifiers();
	if (modifiers == E.BUTTON1_MASK) {
	    int x = E.getX();
	    int y = E.getY();
	    int w = getCs(x,y);
	    if (selectSuper) {
		/* select super Smoothness */
                if (nSuper == superMax) {
                    int[][] foo = new int[superMax][superProperties];
                    for (int i = 0; i < superMax; i++) {
                        for (int j = 0; j < superProperties; j++) {
			    foo[i][j] = superConds[i][j];
			}
		    }
                    int superMax2 = 2*superMax;
                    superConds = new int[superMax2][superProperties];
                    for (int i = 0; i < superMax; i++) {
                        for (int j = 0; j < superProperties; j++) {
			    superConds[i][j] = foo[i][j];
			}
		    }
                    superMax = superMax2;
		}
                int kind = 0;
                int[] is = new int[4];
                for (int i = 0; i < V; i++) {
		    if (dps[w][i] !=0 ) {
			is[kind] = i;
                        kind++;
		    }
		}
                int which = -1;
		if (kind == 1) {
		    which = is[0];
		}
		else if (kind == 2) {
		    which = findEdge(is[0],is[1]);
		}
                else if (kind == 3) {
		    which = findFace(is[0],is[1],is[2]);
		}
		if (kind < 4 && !(kind == 3 && which >=TI )) {
		    boolean present = false;
		    int degree = 0;
		    for (int i = 0; i < nSuper; i++) {
			if (superConds[i][0] == kind && superConds[i][1] == which) {
			    present = true;
			    if (degree < superConds[i][2]) {
				degree = superConds[i][2];
			    }
			}
		    }
		    if (degree < d) {
			if (present) {
			    superConds[nSuper][0] = kind;
			    superConds[nSuper][1] = which;
			    superConds[nSuper][2] = degree + 1;
			}
			else {
			    superConds[nSuper][0] = kind;
			    superConds[nSuper][1] = which;
			    superConds[nSuper][2] = r + 1;
			}
			if (activateSuper(nSuper)) {
			    drawIt();
			}
                        for (int i = 0; i < nDps; i++) {
                            if (dps[i][V+1] > 0) {
				dps[i][V+1] = 1;
			    }
			}
			nSuper++;
                        SuperPresent = true;
			indicateSuper();
                        drawIt();
		    }
		}
	    }
            else if (selectSpecial) {
                checkSpecial();
                int count = 0;
                int[] is = new int[4];
                for (int i = 0; i < V; i++) {
		    if (dps[w][i] > 0) {
			is[count] = i;
			count++;
 		    }
		} 
                boolean findSpecial = true;
                if (count == 3) {
		    int f = findFace(is[0],is[1],is[2]);
                    if (f == specialFace) {
                        specialFace =-1;
                        findSpecial = false;                        
                        repaint();
		    }
                    else if (specialFace == -1 && f < TI) {
			specialFace = f;
                        markFace(f);
                        findSpecial = false;
		    }
		}
                if (findSpecial && specialFace >= 0) {
                    int i3 = dps[w][faces[specialFace][3]];
                    int i4 = dps[w][faces[specialFace][4]];
                    int total = dps[w][faces[specialFace][0]]
			+dps[w][faces[specialFace][1]]
			+dps[w][faces[specialFace][2]];
                    int degree = max(i3,i4);
                    if (total + degree == d && degree > r) {
                        boolean doit = true;
                        for (int i = 0; i < nSpecial; i++) {
			    if (specialConds[i][0] == specialFace && specialConds[i][1] == w) {
				doit = false;
                                i = nSpecial;
			    }
			}
                        if (doit) {
			    SpecialPresent = true;
			    specialConds[nSpecial][0] = specialFace;
			    specialConds[nSpecial][1] = w;
			    drawSpecial(nSpecial);
			    nSpecial++;
                            if (activateSpecial(nSpecial - 1)) {
				drawIt();
			    }
			    indicateSpecial();
			}
		    }
		}
	    }
            else {
		int action = tv.globs.getSelectedIndex();
                if (action > 0) {
		    waiting();
		}
		if (action == 0) {
		    selectedVertex = -1;
		    selectedEdge = -1;
		    selectedFace = -1;
		    selectedTetrahedron = -1;
		    process(w);
		}
		else if (action == 1) {
		    selectedEdge = -1;
		    selectedFace = -1;
		    selectedTetrahedron = -1;
		    int i = -1;
		    for (int k = 0; k < V; k++) {
			if (dps[w][k] == d) {
			    i = k;
			    k = V;
			}
		    }
		    if (i > -1) {
			coordsDrawn = false;
			try {g.drawImage(offscreenImage, 0, 0, this);}
			catch (java.lang.NullPointerException e) {};
			selectedVertex = i;
			g.setColor(Color.blue);
			for (int j = 0; j < 3; j++) {
			    g.drawRect(dpInt[vs[selectedVertex]][0]-Diameter/2-j,dpInt[vs[selectedVertex]][1]-Diameter/2-j,
				       Diameter+2*j,Diameter+2*j);
			}
		    }
		    else {
			if (selectedVertex == -1) {
			    write(" select vertex!");                       
			}
			else {
			    int wstatus = dps[w][V+1];
			    int distance = dps[w][selectedVertex];
			    if (wstatus == 1 || wstatus == 2) {
				process(w);
				for (int j = 0; j < nDps; j++) {
				    if (wstatus == dps[j][V+1] && dps[j][selectedVertex] >= distance && dps[j][V+2] == 1) {
					process(j);
				    }
				}
			    }
			}
		    }
		}
		else if (action == 2) {
		    int distance = 0;
		    selectedVertex = -1;
		    selectedFace = -1;
		    selectedTetrahedron = -1;
		    int i = -1;
		    int count = 0;
		    int i1 = -1;
		    int i2 = -1;
		    for (int k = 0; k < V; k++) {
			if (dps[w][k] > 0) {
			    count++;
			    if (i1 == -1) {
				i1 = k;
			    }
			    else {
				i2 = k;
			    }
			}
		    }
		    boolean doit = true;
		    if (count == 2) {
			int newEdge = findEdge(i1,i2);
			if (newEdge != selectedEdge) {
			    selectedEdge = newEdge;
			    doit = false;
			    g.setColor(Color.blue);
			    coordsDrawn = false;
			    try {g.drawImage(offscreenImage, 0, 0, this);}
			    catch (java.lang.NullPointerException e) {};
			    int x0 = dpInt[vs[edges[selectedEdge][0]]][0];
			    int y0 = dpInt[vs[edges[selectedEdge][0]]][1];
			    int x1 = dpInt[vs[edges[selectedEdge][1]]][0];
			    int y1 = dpInt[vs[edges[selectedEdge][1]]][1];
			    Line(x0,y0,x1,y1);
			}
		    }
		    if (doit) {
			if (selectedEdge == -1) {
			    write(" select edge");
			}
			else {
			    int j0 = edges[selectedEdge][0];
			    int j1 = edges[selectedEdge][1];
			    int wstatus = dps[w][V+1];
			    distance = dps[w][j0] + dps[w][j1];
			    if (wstatus == 1 || wstatus == 2) {
				process(w);
				for (int j = 0; j < nDps; j++) {
				    if (wstatus == dps[j][V+1] && dps[j][j0] + dps[j][j1] >= distance && dps[j][V+2] == 1) {
					process(j);
				    }
				}
			    }
			}
		    }
		}
		else if (action == 3) {
		    int distance = 0;
		    selectedVertex = -1;
		    selectedEdge = -1;
		    selectedTetrahedron = -1;
		    int i = -1;
		    int count = 0;
		    int i1 = -1; 
		    int i2 = -1;
		    int i3 = -1;
		    for (int k = 0; k < V; k++) {
			if (dps[w][k] > 0) {
			    count++;
			    if (count == 1) {
				i1 = k;
			    } 
			    else if (count == 2) {
				i2 = k;
			    } 
			    else if (count == 3) {
				i3 = k;
			    }
			}
		    }
		    boolean doit = true;
		    if (count == 3) {
			int newFace = findFace(i1,i2,i3);
			if (newFace != selectedFace) {
			    selectedFace = newFace;
			    coordsDrawn = false;
			    try {g.drawImage(offscreenImage, 0, 0, this);}
			    catch (java.lang.NullPointerException e) {};
			    g.setColor(Color.blue);
			    for (int j = -1; j < 2; j++) {
				for (int k = -1; k < 2; k++) {
				    int x0 = dpInt[vs[faces[selectedFace][0]]][0]+j;
				    int x1 = dpInt[vs[faces[selectedFace][1]]][0]+j;
				    int x2 = dpInt[vs[faces[selectedFace][2]]][0]+j;
				    int y0 = dpInt[vs[faces[selectedFace][0]]][1]+k;
				    int y1 = dpInt[vs[faces[selectedFace][1]]][1]+k;
				    int y2 = dpInt[vs[faces[selectedFace][2]]][1]+k;
				    g.drawLine(x0,y0,x1,y1);
				    g.drawLine(x1,y1,x2,y2);
				    g.drawLine(x2,y2,x0,y0);
				}
			    }
			    doit = false;
			}
		    }
		    if (doit) {
			if (selectedFace == -1) {
			    write(" select face");
			}
			else {
			    int j0 = faces[selectedFace][0];
			    int j1 = faces[selectedFace][1];
			    int j2 = faces[selectedFace][2];
			    int wstatus = dps[w][V+1];                            
			    distance = dps[w][j0] + dps[w][j1] + dps[w][j2];
			    if (wstatus == 1|| wstatus == 2)   {
				process(w);
				for (int j = 0; j < nDps; j++) {
				    if (wstatus == dps[j][V+1] && dps[j][j0] + dps[j][j1] + dps[j][j2] >= distance  && dps[j][V+2] == 1) {
					process(j);
				    }
				}
			    }
			}
		    }
		}
		else if (action == 4) {
		    int distance = 0;
		    selectedVertex = -1;
		    selectedEdge = -1;
		    selectedFace = -1;
		    int i = -1;
		    int count = 0;
		    int i1 = -1; 
		    int i2 = -1;
		    int i3 = -1;
		    int i4 = -1;
		    for (int k = 0; k < V; k++) {
			if (dps[w][k] > 0) {
			    count++;
			    if (count == 1) {
				i1 = k;
			    } 
			    else if (count == 2) {
				i2 = k;
			    } 
			    else if (count == 3) {
				i3 = k;
			    }
			    else if (count == 4) {
				i4 = k;
			    }
			}
		    }
		    int wstatus = dps[w][V+1];
		    if (count == 4) {
			if (wstatus == 1 || wstatus == 2) {
			    process(w);
			    for (int j = 0; j < nDps; j++) {
				if (wstatus == dps[j][V+1] && dps[j][i1] + dps[j][i2] + dps[j][i3] + dps[j][i4] == d  && dps[j][V+2] == 1) {
				    process(j);
				}
			    }
			}
		    }
		}
		else if (action == 5) {
		    selectedVertex = -1;
		    selectedEdge = -1;
		    selectedFace = -1;
		    selectedTetrahedron = -1;
		    int wstatus = dps[w][V+1];
		    if (wstatus == 1 || wstatus == 2) {
                        process(w);
			int[] is = new int[4];
			int count = 0;
			for (int k = 0; k < V; k++) {
			    if (dps[w][k] > 0) {
				is[count] = k;
				count++;
			    }
			}
			for (int j = 0; j < nDps; j++) {
			    int total = 0;
			    if (dps[j][V+1] == wstatus) {          
				for (int k = 0; k < count; k++) {
				    total = total + dps[j][is[k]];
				}
				if (total == d  && dps[j][V+2] == 1) {
				    process(j);
				}
			    }
			}
		    }
		}
                else if (action == 6) {
		    selectedVertex = -1;
		    selectedEdge = -1;
		    selectedFace = -1;
		    selectedTetrahedron = -1;
		    int wstatus = dps[w][V+1];
                    if (wstatus == 1 || wstatus == 2) {
			process(w);
                        for (int i = 0; i < nDps; i++) {
                            if (dps[i][V+2] == 1 && dps[i][V+1] == wstatus) {
                                process(i);
			    }
			}
 		    }
		}
                checkStrong();
                crosshair();
	    }
	}
	else if (modifiers == E.BUTTON2_MASK  || modifiers == E.BUTTON1_MASK + E.SHIFT_MASK) {
            if (Remove) {
		int x = E.getX();
		int y = E.getY();
		int w = getCs(x,y);
		if (w > -1) {
		    removeThem(w);
		}
		drawIt();
	    }
	    else {
		zoomOut();
	    }
	}
    }

    public void mousePressed(java.awt.event.MouseEvent E) {
	addEvent(E,1);
    }

    public void MousePressed(java.awt.event.MouseEvent E) {
        int modifiers = E.getModifiers();
        if (modifiers == E.BUTTON3_MASK || modifiers == E.BUTTON1_MASK + E.CTRL_MASK) {
	    xdown = E.getX();
	    ydown = E.getY();
            height = getSize().height;
            width = getSize().width;	    
            for (int i = 0; i < V; i++) {
		vfog[i][0] = dpDouble[vs[i]][0];               
		vfog[i][1] = dpDouble[vs[i]][1];               
		vfog[i][2] = dpDouble[vs[i]][2];               
	    }
            shadow();
	}
        else if (modifiers == E.BUTTON2_MASK  || modifiers == E.BUTTON1_MASK + E.SHIFT_MASK) {
            xZoom0 = E.getX();
            yZoom0 = E.getY();
            zoomDrawn = false;
	}
    }

    public void mouseDragged(java.awt.event.MouseEvent E) {
	addEvent(E,3);
    }

    public void MouseDragged(java.awt.event.MouseEvent E) {
	int modifiers = E.getModifiers();
	if (modifiers == E.BUTTON3_MASK || modifiers == E.BUTTON1_MASK + E.CTRL_MASK ) {
	    xup = E.getX();
	    yup = E.getY();
	    if (xdown != xup || ydown != yup) {
		rotate();
		shadow();
		xdown = xup;
		ydown = yup;
	    }
	}
        else if (modifiers == E.BUTTON2_MASK || modifiers == E.BUTTON1_MASK + E.SHIFT_MASK ) {
	    g.setXORMode(BGdefault);
	    if (zoomDrawn) {
                g.drawRect(min(xZoom0,oldZoomx),min(yZoom0,oldZoomy),abs(oldZoomx-xZoom0),abs(oldZoomy-yZoom0));
	    }
	    zoomDrawn = true;
	    oldZoomx = E.getX();
	    oldZoomy = E.getY();
	    g.drawRect(min(xZoom0,oldZoomx),min(yZoom0,oldZoomy),abs(oldZoomx-xZoom0),abs(oldZoomy-yZoom0));
	    g.setPaintMode();
	}
    }

    public void mouseEntered(java.awt.event.MouseEvent E) {
	addEvent(E,5);
    }

    public void MouseEntered(java.awt.event.MouseEvent E) {
    }

    public void mouseExited(java.awt.event.MouseEvent E) {
	addEvent(E,6);
    }

    public void MouseExited(java.awt.event.MouseEvent E) {
	eraseCoords();
    }

    public void mouseMoved(java.awt.event.MouseEvent E) {
	addEvent(E,7);
    }

    public void MouseMoved(java.awt.event.MouseEvent E) {
	if (tv.showCoords && !starting) {
            g.setColor(Color.black);
            eraseCoords();
	    int x = E.getX();
	    int y = E.getY();
    	    g.setXORMode(coordColor); 
            coordsDrawn = true;
            coordinates = getCoordinates(x,y);
            g.setFont(f);
            int w = fm.stringWidth(coordinates);
            if (tv.showDynamicCoords) {
		xCoords = x + 20;
		yCoords = y - 10;
		if (width - xCoords < 0) {
		    xCoords = x - 20 - w;
		}
	    }
            else  {
		xCoords = width - w - 20;
		yCoords = (int) (height*2*border);
	    }
            g.setFont(f);
	    g.drawString(coordinates, xCoords, yCoords);
	    drawDp(whichCoords);
	    g.setPaintMode();
	}
    }

    void printIt() {
        PrintJob pjob = getToolkit().getPrintJob(this,"MDS",null);
        if (pjob != null) {
	    Graphics pg = pjob.getGraphics();
	    if (pg != null) {
		paint(pg);
                pg.dispose();
	    }
            pjob.end();
	}
    }


    int findEdge(int i1, int i2) {
        if (i1 > i2) {
	    return findEdge(i2,i1);
	}
	else {
	    for (int i = 0; i < E; i++) {
		if (i1 == edges[i][0] && i2 == edges[i][1]) {
		    return i;
		}
	    }
	}
	return -1;
    }
 
    int findFace(int i1, int i2, int i3) {
        if (i1 > i2) {
	    return findFace(i2, i1, i3);
	}
        else if (i2 > i3) {
 	    return findFace(i1, i3, i2);
	}
        else {
	    for (int i = 0; i < T; i++) {
		if (i1 == faces[i][0] && i2 == faces[i][1] && i3 == faces[i][2]) {
		    return i;
		}
	    }
	}
	return -1;
    }
 
    int findTet(int i0, int i1, int i2, int i3) {
        if (i0 > i1) {
	    return findTet(i1, i0, i2, i3);
	}
        else if (i1 > i2) {
	    return findTet(i0, i2, i1, i3);
	}
        else if (i2 > i3) {
	    return findTet(i0, i1, i3, i2);
	}
	else {

	    for (int i = 0; i < N; i++) {
		if (i0 == tets[i][0] &&i1 == tets[i][1] && i2 == tets[i][2] && i3 == tets[i][3]) {
		    return i;
		}
	    }
	}
	return -1;
    }

    void innocent() {
	GeometryPresent = false;
	LApresent = false;
        analyze = false;
        A = null;
        AM = null;
        Anlz = null;
        Astab = null;
	AnlzM = -1;
	AnlzN = -1;
        if (!tv.inApplet) {
	    tv.Analyze.setForeground(Color.white);
	    tv.Analyze.setBackground(Color.red);
	    tv.Forward.setForeground(Color.white);
	    tv.Forward.setBackground(Color.red);
	    tv.Stability.setForeground(Color.white);
	    tv.Stability.setBackground(Color.red);
	    tv.Code.setForeground(Color.white);
	    tv.Code.setBackground(Color.red);
	}
    }

    boolean isZero(RAT R) {
	if (R == null) {
	    return true;
	}
        else {
	    return R.isZero();
	}
    }

    void analyzeIt(boolean complete) {
        if (LApresent && analyze) {
	    try {
                int mode = tv.cMode.getSelectedIndex();
		String file = tv.fileName.getText() + ".explicit";
		PrintWriter out = new PrintWriter(new FileOutputStream(file));
		int m = AnlzM;
		int n = AnlzN;
                int[] rows = new int[m];
                int[] cols = new int[n];
                boolean[] solved = new boolean[n];
                for (int i = 0; i < m; i++) {
		    rows[i] = i;
		}
                for (int j = 0; j < n; j++) {
		    cols[j] = j;
		}
                for (int j = 0; j < n; j++) {
                    solved[j] = false;
		}
                for (int j = 0; j < active; j++) {
                    solved[M[j]] = true;
		}
                int count = 0;
                if (mode != 3) {
                    out.println(" ## coefficients");                    
                    for (int v = 0; v < V; v++) {
                        if (mode == 0) {
			    out.println("## "+ v+": " + cName(v));
			}
                        else {
			    out.println("## "+ v+": " + cName(v,0) +" = " + cName(v,mode));
			}
		    }
		    out.println("# Minimal Determining Set: \n");
		}
		else {
		    out.println(" \n %% coefficients\n");                    
		    for (int v = 0; v < V; v++) {
			out.println("\n %% "+ v+": " + cName(v,0) +" = " + cName(v,mode));
		    }
		    out.println("Minimal Determining Set: \n");
		    mess ("writing minimal determining set");
		}
                for (int j = 0; j < n; j++) {
                    if (solved[j]) {
                        String s = "";
                        if (mode!= 3) {
			    s = s + "## " +cName(j) + " := 0;# " + count + " " + j;
			}
                        else {
			    s = s +"$" + cName(j) + " := 0$\n ";
			}
                        out.println(s);
                        count++;
                        bar(count,n,Color.green,Color.black);
		    }
		}
                mess("searching for strong implications");
                int mactive = m; /* number of active equations */
                int nactive = n-count; /* number of active columns */
                int ncurrent = n-1; /* current column in moving inactive columns */
                /* sort columns: */
                for (int j = 0; j < nactive; j++) {
                    if (solved[j]) {
			while (solved[ncurrent]) {
                            ncurrent--;
			}
                        cols[ncurrent] = j;
                        cols[j] = ncurrent;
                        ncurrent--;
		    }
		}
                /* search for strong implications */
                if (mode != 3) {
		    out.println("\n# Strongly implied Points: \n ");
		}
                else {
		    out.println("\n Strongly implied Points: \n ");
		}
                boolean done = false;
                while (!done) {
                    done = true;
                    for (int ii = 0; ii < mactive; ii++) {
			int i = rows[ii];
                        int nz = 0;
			int pivot = -1;
                        int jpiv = -1;
                        for (int jj = 0; jj < nactive; jj++) {
                            int j = cols[jj];
                            if (!isZero(Anlz[i][j])) {
				nz++;
                                pivot = j;
                                jpiv = jj;
			    }
			}
			if (nz <= 1) { 
			    if (nz == 1) { /* we found a stong implication */
				done = false; /* there may be more now */
				RAT divide = RAT.copy(Anlz[i][pivot]);            
                                divide.negate();
                                String s = "";
                                if (mode != 3) {
				    s = cName(pivot) + " := " ;
				}
                                else {
				    s = "$" + cName(pivot) + " = " ;
				}
				for (int nu = nactive; nu < n; nu++) {
				    int nnu = cols[nu];
				    if (!isZero(Anlz[i][nnu])) {
					RAT c = RAT.simplify(RAT.divide(Anlz[i][nnu],divide));
					s = s + " \n " + frac(c) + "*" +cName(nnu);
				    }
				}
                                if (mode != 3) {
				    s = s + ";  # " + count + " " + pivot;
				}
                                else {
				    s = s +"$\n";
				}
				out.println(s);
				count++;
				nactive--;
				cols[jpiv] = cols[nactive];
				cols[nactive] = pivot;
				bar(count,n,Color.blue,Color.black);
			    }
			    mactive--;
			    for (int mu = ii; mu < mactive; mu++) {
				rows[mu] = rows[mu+1];
			    }
			    rows[mactive] = i;
			}
		    }
		}
                /* starting elimination */
                nactive = n - count;
                if (nactive <= 0) {
                    if (mode !=3) {
			out.println("\n### all points are strongly implied! \n ");
		    }
                    else {
			out.println("\n all points are strongly implied! \n ");
		    }
                    mess(" all points are strongly implied!");
                    write(" all points are strongly implied!");
		}
                if (nactive > 0) {
		    mess("eliminating");
		    boolean eliminated = false;
		    int k = 0;
		    while (!eliminated) {
			int ii = k;
			int ipivot = -1;
			int jpivot = -1;
			int nzMin = n + 1;
			boolean swept = false;
			while(!swept) {
			    int i = rows[ii];
			    int nzCount = 0;
			    for (int jj = k; jj < nactive; jj++) {
				int j = cols[jj];
				if (!isZero(Anlz[i][j])) {
				    nzCount++;
				}
			    }
			    if (nzCount == 0) {
				mactive--;
				for (int mu = ii; mu < mactive; mu++) {
				    rows[mu] = rows[mu+1];
				}
				rows[mactive] = i;
			    }
			    else {
				for (int jj = nactive; jj < n; jj++) {
				    int j = cols[jj];
				    if (!isZero(Anlz[i][j])) {
					nzCount++;
				    }
				}
				if (nzCount < nzMin) {
				    ipivot = ii;
				    nzMin = nzCount;
				}
			    }
			    ii++;
			    if (ii >= mactive) { 
				swept = true;
			    }
			}
			if (ipivot > -1) {
			    int irow = rows[ipivot];
			    for (int jj = k; jj < nactive; jj++) {
				int j = cols[jj];
				if (!isZero(Anlz[irow][j])) {
				    jpivot = jj;
				    jj = nactive;
				}
			    }
			    int dmy = rows[k]; 
			    rows[k] = rows[ipivot];
			    rows[ipivot] = dmy;
			    dmy = cols[k]; 
			    cols[k] = cols[jpivot];
			    cols[jpivot] = dmy;
			    int rowk = rows[k];
			    int colk = cols[k];
			    RAT pivot = RAT.copy(Anlz[rowk][colk]);
			    for (int iii = k+1; iii < mactive; iii++) {
				int i = rows[iii];
				if (!isZero(Anlz[i][colk])) {
				    for (int jj = 0; jj < n; jj++) {
					int j = cols[jj];
					if (j != colk) {
					    if (!isZero(Anlz[rowk][j])) {
						if (Anlz[i][j] == null) {
						    Anlz[i][j] = new RAT(0);
						}
						Anlz[i][j] = RAT.simplify(
									  RAT.subtract(Anlz[i][j],
										       RAT.multiply(Anlz[rowk][j],
												    RAT.divide(Anlz[i][colk],pivot))));
						if(isZero(Anlz[i][j])) {
						    Anlz[i][j] = null;
						}
					    }
					}
				    }
				}
				Anlz[i][colk] = null;
			    }
			    k++;
			    count++;
			    bar(count,n,Color.green,Color.black);
			}
			if(k >= nactive) {
			    eliminated = true;
			}
		    }
                    if (mode != 3) {
			out.println("\n # eliminating " + k + " variables: \n");
		    }
                    else {
			out.println("\n eliminating " + k + " variables: \n");
		    }
		    mess("backward substitution");
		    for (int ii = k-1; ii >=0; ii--) {
			int i = rows[ii];
			int j = cols[ii];
			RAT pivot = RAT.copy(Anlz[i][j]);
			pivot.negate();
                        String s = "";
                        if (mode != 3) {
			    s =cName(j) + " := " ;
			}
                        else {
			    s = "$" + cName(j) + " = " ;
			}
			for (int nu = 0; nu < n; nu++) {
			    if (nu != ii) {
				int nnu = cols[nu];
				if (!isZero(Anlz[i][nnu])) {
				    RAT c = RAT.divide(Anlz[i][nnu],pivot);
				    c = RAT.simplify(c);
				    c.normalize();
				    s = s + "\n " + frac(c) + "*" +cName(nnu);
				}
			    }
			}
                        if (mode != 3) {
			    s = s + ";  # " + count + " " + j;
			}
                        else {
			    s = s +  "$\n";
			}
			out.println(s);
			bar(ii,k,Color.red,Color.black);
		    }
		}
                if (complete) {
		    mess(" computing fully explicit");
		    for (int k = 0; k < m; k++) {
			bar(k,m,Color.green,Color.blue);
			done = true;
			for (int jj = k; jj < n-active; jj++) {
			    int j = cols[jj];
			    for (int ii = k; ii < m; ii++) {
				int i = rows[ii];
				if (!isZero(Anlz[i][j])) {
				    int dummy = rows[ii];
				    rows[ii] = rows[k];
				    rows[k] = dummy;
				    dummy = cols[jj];
				    cols[jj] = cols[k];
				    cols[k] = dummy;
				    ii = m;
				    jj = n;
				    done = false; /* we found a pivot */
				}
			    }
			}
			if (done) {
			    k = m;
			}
			else {
			    int ipivot = rows[k];
			    int jpivot = cols[k];
			    RAT pivot = RAT.simplify(RAT.copy(Anlz[ipivot][jpivot]));
			    Anlz[ipivot][jpivot] = new RAT(1);
			    for (int jj = k+1; jj < n; jj++) {
				int j = cols[jj];
				if (!isZero(Anlz[ipivot][j])) {                        
				    Anlz[ipivot][j] = RAT.divide(Anlz[ipivot][j],pivot);
				}
			    }
			    for (int ii = 0; ii < m; ii++) {
				int i = rows[ii];
				if (ii != k && !isZero(Anlz[i][jpivot])) { 
				    RAT multiplier = RAT.copy(Anlz[i][jpivot]);
				    Anlz[i][jpivot] = null;
				    for (int jj = k+1; jj < n; jj++) {
					int j = cols[jj];
					if (!isZero(Anlz[ipivot][j])) {                        
					    if (isZero(Anlz[i][j])) {
						Anlz[i][j] = RAT.simplify(RAT.multiply(Anlz[ipivot][j],multiplier));
						Anlz[i][j].negate();
					    }
					    else {
						Anlz[i][j] = RAT.simplify(
									  RAT.subtract(Anlz[i][j],RAT.multiply(multiplier,Anlz[ipivot][j])));
					    }
					}
				    }
				}
			    }
			}
		    }
                    if (mode !=3) {
			out.println("\n ## fully explicit:\n");
		    }
                    else {
			out.println("\n fully explicit:\n");
		    }
		    count = 0;
		    for (int k = 0; k < n-active; k++) {
			int i = rows[k];
			int K = cols[k];
                        String s = "";
                        if (mode != 3) {
			    s = cName(K) + " := " ;
			}
			else {
			    s = "\n $" + cName(K) + " = " ;
			}
			for (int nu = n-active; nu < n; nu++) {
			    int nnu = cols[nu];
			    if (!isZero(Anlz[i][nnu])) {
				RAT c = RAT.copy(RAT.simplify(Anlz[i][nnu]));
				c.negate();
				c.normalize();
				s = s + "\n " + frac(c) + "*" +cName(nnu);
			    }
			}
                        if (mode !=3) {
			    s = s + ";  # " + count + " " + i;
			} 
			else {
			    s = s  + "$";
			}
			out.println(s);
			count++;
		    }
		    double norm = 0.0;
		    for (int ii = 0; ii < n-active; ii++) {
			int i = rows[ii];
			double rowsum = 0.0;
                        double norm2 = 0.0;
			for (int jj = n-active; jj < n; jj++) {
			    int j = cols[jj];
			    if (!isZero(Anlz[i][j])) {
                                double h = java.lang.Math.abs(RAT.extractDouble(Anlz[i][j]));
				rowsum = rowsum + h;
                                
                                norm2 = norm2 + h*h;
			    }
			}
			if (rowsum > norm) {
			    norm = rowsum;
			}
		    }
		    write(" norm of transformation matrix is " + norm);
                    if (mode != 3) {
			out.println(" ## norm of transformation matrix is " + norm);
		    }
                    else {
			out.println(" \n norm of transformation matrix is " + norm);
		    }
		}
                if (mode == 3) {
		    out.println("\\bye");
		}
                out.close();
                mess("successfully wrote " + file);
		boolean foundThem = false;
                int activeEqs = m;
                while (!foundThem) {
		    foundThem = true;
		}
                bar(n,n,BG,BG);
	    }
	    catch (java.io.FileNotFoundException e) {
		write(" cannot analyze, file not found " + e);
	    }
	    catch(java.io.IOException e) {
		write(" cannot analyze, IOException " + e);
	    }
	}
    }

    double log(double x) {
	return java.lang.Math.log(x);
    }

    void stability() {
        if (LApresent && analyze) {
	    int m = AnlzM;
	    int n = AnlzN;
	    int[] rows = new int[m];
	    int[] cols = new int[n];
	    boolean[] solved = new boolean[n];
	    for (int i = 0; i < m; i++) {
		rows[i] = i;
	    }
	    for (int j = 0; j < n; j++) {
		cols[j] = j;
	    }
	    for (int j = 0; j < n; j++) {
		solved[j] = false;
	    }
	    for (int j = 0; j < active; j++) {
		solved[M[j]] = true;
	    }
	    int ncurrent = n-1;
	    for (int j = 0; j < ncurrent; j++) {
		if (solved[j]) {
		    while (solved[ncurrent] && ncurrent > 0) {
			ncurrent--;
		    }
		    if (j < ncurrent) {
			cols[ncurrent] = j;
			cols[j] = ncurrent;
			ncurrent--;
		    }
		}
	    }
	    for (int k = 0; k < n-active; k++) {
                bar(k,n-active,Color.cyan,Color.orange);
		int ipivot = -1;
		int jpivot = -1;
		double maxEntry = 0.0;
		for (int ii = k; ii < m; ii++) {
		    int i = rows[ii];
		    for (int jj = k; jj < n-active; jj++) {
			int j = cols[jj];
			if (abs(Astab[i][j]) > maxEntry) {
			    ipivot = ii;
			    jpivot = jj;
			    maxEntry = abs(Astab[i][j]);
			}
		    }
		}
		if (ipivot < 0) {
		    write(" stability error - no pivot ");
		    k = active;
		}
		int dummy = rows[k];
		rows[k] = rows[ipivot];
		rows[ipivot] = dummy;
		dummy = cols[k];
		cols[k] = cols[jpivot];
		cols[jpivot] = dummy;
		int rowk = rows[k];
		int colk = cols[k];
		double pivot = Astab[rowk][colk];
		Astab[rowk][colk] = 1.0;
		for (int jj = k+1; jj < n; jj++) {
		    int j = cols[jj];
		    Astab[rowk][j] = Astab[rowk][j]/pivot;
		}
		for (int ii = 0; ii < m; ii++) {
		    if (ii != k) {
			int i = rows[ii];
			if (Astab[i][colk] != 0.0) {
			    double multiplier = Astab[i][colk];
			    Astab[i][colk] = 0.0;
			    for (int jj = k+1; jj < n; jj++) {
				int j = cols[jj];
				Astab[i][j] = Astab[i][j] - multiplier*Astab[rowk][j];
			    }
			}
		    }
		}
	    }
	    double maxRowsum = 0.0;
	    for (int ii = 0; ii < m; ii++) {
                bar(ii,m,Color.orange,Color.cyan);
		double rowsum = 0.0;
		double norm2 = 0.0;
		int i = rows[ii];
		for (int jj = n-active; jj < n; jj++) {
		    int j = cols[jj];
                    double h = abs(Astab[i][j]);
		    rowsum = rowsum + h;
		    norm2 = norm2 + h*h;
		}
		if (rowsum > maxRowsum) {
		    maxRowsum = rowsum;
		}
                if (norm2 > 0.0) {
		}
	    }
	    mess("norm transformation matrix: " + maxRowsum);
	    write(" stability: norm of transformation matrix is " + maxRowsum);
	}
    }


    String frac(RAT d) {
        d.normalize();
	if (isZero(d)) {
	    return " + 0";
	}
        else {
            RAT c = RAT.copy(d);
	    c = RAT.simplify(c);   
	    INT denm1 = INT.subtract(c.denominator,new INT(1));
            if (denm1.isZero()) {
		if (c.numerator.negative) {
		    return " - " + c.numerator.absValue();
		}
                else {
                    return " + " + c.numerator.value();
		}
	    }
	    else {
		if (c.numerator.negative) {
		    return " - "+c.numerator.absValue() + "/" + c.denominator.value();
		}
		else {
		    return " + "+c.numerator.absValue() + "/" + c.denominator.value();
		}
	    }
	}
    }


    String Row(int i) {
	String s = " row + " +i + ":" ;
        for (int j = 0; j < AnlzN; j++) {
	    if (!isZero(Anlz[i][j])) {
                s = s + "+" + Anlz[i][j].numerator.value() + "/" + Anlz[i][j].denominator.value() +cName(j);
	    }
	}
	return s;
    }		      
								      
    public synchronized void keyTyped(java.awt.event.KeyEvent E) {
        int key = E.getKeyChar();
        if (key == 'x') {
	    stop();
	}
        else if (key == 'X') {
	    tv.TV.stop();
	}
        else {
	    addEvent(E,11);
	}
    }

    public synchronized void KeyTyped(java.awt.event.KeyEvent E) {
        int key = E.getKeyChar();
        if (key == 'u') {
	    undo();
	}
        else if (key == 'd') {
	    tv.ddown();
	}
        else if (key == 's') {
	    shell(true);
	}
        else if (key == 'D') {
	    tv.dup();
	}
        else if (key == 'r') {
	    tv.rdown();
	}
        else if (key == 'R') {
	    tv.rup();
	}
        else if (key == 'S') {
            zoomed = false;
	    renderit();
	}
        else if (key == ' ' || key == '\n') {
            coordsDrawn = false;
	    repaint();
	}
        else if (key == 'p') {
            printIt();
	}
        else if (key == 'c') {
            tv.TV.toFront();
	}
        else if (key == 'g') {
            tv.TV.showGrid = !tv.TV.showGrid;
	    if (tv.TV.showGrid) {
		tv.TV.grid.setBackground(tv.TV.dont);
	    }
	    else {
		tv.TV.grid.setBackground(tv.TV.doit);
	    }
            renderit();
	}
        else if (key == 'G') {
            checkGeometry();
	}
        else if (key == 'T' || key == 't') {
            checkTetrahedron();
	}
        else {
	    write ("typed unassigned key " + key + E);
	}
    }

    public void keyReleased(java.awt.event.KeyEvent E) {
    }

    public void keyPressed(java.awt.event.KeyEvent E) {
    }

    public void paint(Graphics g) {
        int height = getSize().height;
        int width = getSize().width;
        if (height !=saveHeight || width != saveWidth) {
	    saveHeight = height;
            saveWidth = width;
            makeGraphics();
            drawIt();
	}
	try {g.drawImage(offscreenImage, 0, 0, this);}
	catch (java.lang.NullPointerException e) {};
    }

    void checkSpecial() {
	if (nSpecial == specialMax) {
	    int[][] foo = new int[specialMax][specialProperties];
	    for (int i = 0; i < specialMax; i++) {
		for (int j = 0; j < specialProperties; j++) {
		    foo[i][j] = specialConds[i][j];
		}
	    }
	    int specialMax2 = 2*specialMax;
	    specialConds = new int[specialMax2][specialProperties];
	    for (int i = 0; i < specialMax; i++) {
		for (int j = 0; j < specialProperties; j++) {
		    specialConds[i][j] = foo[i][j];
		}
	    }
	    specialMax = specialMax2;
	}

    }

    double abs(double x) {
	return java.lang.Math.abs(x);
    }

    void shell(boolean strong) {
	write(" shelling ");
	if (N > 0) {
	    int a0 = 1;
	    int a1 = 0;
	    int a2 = 0;
	    int a3 = 0;
	    int[] sequence = new int[N];
	    boolean[] used = new boolean[N];
	    for (int i = 0; i < N; i++) {
		used[i] = false;
	    }
	    sequence[0] = 0;
	    sequence[1] = 1;
	    used[0] = true;
	    used[1] = true;
	    int level = 1;
	    boolean done = false;
	    while(!done) {
		if (sequence[level] < N) {
		    int count = 0;
                    for (int i = 0; i < level; i++) {
			if (three(sequence[i],sequence[level])) {
                            count++;
			}
		    }
		    boolean really = true;
                    if (count > 0 && count < 4 && strong)  {
			int tet = sequence[level];
			if (count == 1) { 
			    /* there must be a new vertex */
			    for (int j = 0; j < level; j++) {
				if (three(sequence[j],tet)) {
				    int vtx = -1;
				    for (int k = 0; k < 4; k++) {
					if (!inTet(tets[tet][k],sequence[j])) {
					    vtx = tets[tet][k];
					    k = 4;
					}
				    }
				    for (int mu = 0; mu < level; mu++) {
					for (int nu = 0; nu < 4; nu++) {
					    if (vtx == tets[sequence[mu]][nu]) {
						really = false;
						nu = 4;
						mu = level;
					    }
					}
				    }       
				}
			    }
			}
			if (count == 2) { 
			    boolean newEdge = false;
			    /* there must be a new boundary edge */
			    for (int mu = 0; mu < 4; mu ++ ) {
				for (int nu = 0; nu < 4; nu++) {
				    if (mu != nu) {
					int v1 = tets[tet][mu];
					int v2 = tets[tet][nu];
					boolean absent = true;
					for (int k = 0; k < level; k++) {
					    if (inTet(v1,sequence[k]) && inTet(v2,sequence[k])) {
						absent = false;
						k = level;
					    }
					}
					if (absent) {
					    newEdge = true;
					    mu = 4;
					    nu = 4;
					}                            
				    }
				}
			    }
			    if (!newEdge) {
				really = false;
			    }
			}
			if (count == 3) {
			    /* the new interior vertex must in face be interior */
			    for (int k = 0; k < 4; k++) {
				int Count = 0;
				int v = tets[tet][k];
				for (int j = 0; j < level; j++) {
				    if (three(tet,sequence[j],v)) {
					Count++;
				    }
				}
				if (Count == 3) {
				    if (bVertices[v]) {
					really = false;
				    }
				}
			    }
			}
		    }
		    if (count > 0 && count < 4 && really) {
			level++;
			if (level == N) {
			    done = true;
			} 
			else {
			    for (int i = 0; i < N; i++) {
				if (!used[i]) {
				    used[i] = true;
				    sequence[level]=i;
				    i = N;
				}
			    }
			}
		    }
		    else {
			int tet = sequence[level];
			used[tet] = false;
			sequence[level] = N;
			for (int i = tet+1; i < N; i++) {
			    if (!used[i]) {
				used[i] = true;
				sequence[level]=i;
				i = N;
			    }
			}
		    }
		}
		else {
		    level--;
		    if (level < 0) {
			if (!strong) {
			    done = true;
			    write(" no shelling ");
			}
			else {
			    strong = false;
			    sequence[0] = 0;
			    sequence[1] = 1;
			    for (int i = 0; i < N; i++) {
				used[i] = false;
			    }
			    used[0] = true;
			    used[1] = true;
			    level = 1;
			}
		    }
		    else {
			int tet = sequence[level];
			used[tet] = false;
			sequence[level] = N;
			for (int i = tet+1; i < N; i++) {
			    if (!used[i]) {
				used[i] = true;
				sequence[level]=i;
				i = N;
			    }
			}
		    }
		}
	    }
	    if (level == N) {
		for (int i = 0; i < N; i++) {
		    int tet = sequence[i];
		    String s = i + ": " + tet + " - ";
		    for (int k = 0; k < 4; k++) {
			s = s+ " " + tets[tet][k];
		    }
		    s = s + " --- " ;
		    int count = 0;
		    for (int j = 0; j < i; j++) {
			if (three(sequence[j],tet)) {
			    s = s + " " + j;
			    count++;
			}
		    }
		    if (count == 1) { 
			a1++;
			/* there must be a new vertex */
			for (int j = 0; j < i; j++) {
			    if (three(sequence[j],tet)) {
				int vtx = -1;
				for (int k = 0; k < 4; k++) {
				    if (!inTet(tets[tet][k],sequence[j])) {
					vtx = tets[tet][k];
					k = 4;
				    }
				}
				for (int mu = 0; mu < i; mu++) {
				    for (int nu = 0; nu < 4; nu++) {
					if (vtx == tets[sequence[mu]][nu]) {
					    s = s + " ->  1 face with old vertex " + vtx;
					    nu = 4;
					    mu = i;
					}
				    }
				}       
			    }
			}
		    }
		    if (count == 2) { 
			a2++;
			boolean newEdge = false;
			/* there must be a new boundary edge */
			for (int mu = 0; mu < 4; mu ++ ) {
			    for (int nu = 0; nu < 4; nu++) {
				if (mu != nu) {
				    int v1 = tets[tet][mu];
				    int v2 = tets[tet][nu];
				    boolean absent = true;
				    for (int k = 0; k < i; k++) {
					if (inTet(v1,sequence[k]) && inTet(v2,sequence[k])) {
					    absent = false;
					    k = i;
					}
				    }
				    if (absent) {
					newEdge = true;
					mu = 4;
					nu = 4;
				    }                            
				}
			    }
			}
			if (!newEdge) {
			    s = s + " -> 2 face with no new boundary edge";
			}
		    }
		    if (count == 3) {
			a3++;
			/* the new interior vertex must in face be interior */
			for (int k = 0; k < 4; k++) {
			    int Count = 0;
			    int v = tets[tet][k];
			    for (int j = 0; j < i; j++) {
				if (three(tet,sequence[j],v)) {
				    Count++;
				}
			    }
			    if (Count == 3) {
				if (bVertices[v]) {
				    s = s + " -> 3 face - new interior vertex " + v;
				    s = s + " is not interior ";
				}
			    }
			}
		    }
		    write(s);
		}
	    }
	    write(" a0 = " + a0 + ", a1 = " + a1 + ", a2 = " + a2 + ", a3 = " + a3);
	}
    }

    boolean three(int s, int t) {
	int count = 0;
        for (int i = 0; i < 4; i++) {
	    for (int j = 0; j < 4; j++) {
		if (tets[s][i] == tets[t][j]) {
		    count++;
		}
	    }
	}
        return (count == 3);
    }

    boolean three(int s, int t, int v) {
	int count = 0;
        if (three(s,t)) {
	    for (int i = 0; i < 4; i++) {
		for (int j = 0; j < 4; j++) {
		    if (tets[s][i] == tets[t][j] && tets[t][j] == v) {
			count++;
		    }
		}
	    }
	}
        return (count == 1);
    }

    void buildIt() {
        if (N > 0) {
            write("\n Building the tetrahedral partition: ");
            steps = new int[28];
            for (int level = 0; level < N; level++) {
		int faces = 0;
                int edges = 0;
                int vtcs = 0;
                facet F = new facet(tets[level][0],tets[level][1],tets[level][2],tets[level][3]);
                for (int previous = 0; previous < level; previous++) {
		    int i0 = tets[previous][0];
		    int i1 = tets[previous][1];
		    int i2 = tets[previous][2];
		    int i3 = tets[previous][3];
                    F.mark(i0,i1,i2);
                    F.mark(i0,i1,i3);
                    F.mark(i0,i2,i3);
                    F.mark(i1,i2,i3);
                    F.mark(i0,i1);                    
                    F.mark(i0,i2);                    
                    F.mark(i0,i3);                    
                    F.mark(i1,i2);                    
                    F.mark(i1,i3);                    
                    F.mark(i2,i3);                    
                    F.mark(i0);
                    F.mark(i1);
                    F.mark(i2);
                    F.mark(i3);
		}
                F.unmark();
                int step = F.which();
                steps[step]++;
                String rep = " new tetrahedron: ";
                rep = rep + " " + tets[level][0];
                rep = rep + " " + tets[level][1];
                rep = rep + " " + tets[level][2];
                rep = rep + " " + tets[level][3];
                rep = rep + " --- block type " + step + " " + name(step);
                write(rep);
                if (step > 0) {
		    write(" joining at ");
                    for (int f = 0; f < 4; f++) {
			if (F.marked(f)) {
			    write(" face: " + F.done[0][f] + " " + F.done[1][f] + " " + F.done[2][f]);
			}
		    }
                    for (int f = 4; f < 10; f++) {
			if (F.marked(f)) {
			    write(" edge: " + F.done[0][f] + " " + F.done[1][f]);
			}
		    }
                    for (int f = 10; f < 14; f++) {
			if (F.marked(f)) {
			    write(" vertex: " + F.done[0][f]);
			}
		    }
		}
	    }
	    write(" building blocks summary: ");
	    for (int b = 0; b < 28; b++) {
		int s = steps[b];
		if (s > 0) {
		    write(" " + b + " " + name(b) + " --- " + s);

		}
	    }
	}
        else {
	    write(" nothing to build ");
	}
    }

    String name(int block) {
	if (block == 0) {
	    return ("T");
	}
	if (block == 1) {
	    return ("v10");
	}
	if (block == 2) {
	    return ("v21");
	}
	if (block == 3) {
	    return ("v33");
	}
	if (block == 4) {
	    return ("v46");
	}
	if (block == 5) {
	    return ("e10");
	}
	if (block == 6) {
	    return ("e20");
	}
	if (block == 7) {
	    return ("e21");
	}
	if (block == 8) {
	    return ("e32");
	}
	if (block == 9) {
	    return ("e33");
	}
	if (block == 10) {
	    return ("e33F");
	}
	if (block == 11) {
	    return ("e44");
	}
	if (block == 12) {
	    return ("e45");
	}
	if (block == 13) {
	    return ("e56");
	}
	if (block == 14) {
	    return ("e612");
	}
	if (block == 15) {
	    return ("ev11");
	}
	if (block == 16) {
	    return ("ev12");
	}
	if (block == 17) {
	    return ("ev21");
	}
	if (block == 18) {
	    return ("ev31");
	}
	if (block == 19) {
	    return ("fe11");
	}
	if (block == 20) {
	    return ("fe12");
	}
	if (block == 21) {
	    return ("fe13");
	}
	if (block == 22) {
	    return ("fe21");
	}
	if (block == 23) {
	    return ("f1");
	}
	if (block == 24) {
	    return ("f2");
	}
	if (block == 25) {
	    return ("f3");
	}
	if (block == 26) {
	    return ("f4");
	}
	if (block == 27) {
	    return ("fv");
	}
        return (" unknown building block ");
    }

    void newRefine() {
        tv.TV.REFINE.setVisible(false);
        tv.TV.REFINE = null;
        tv.TV.REFINE = new refine();
        tv.TV.REFINE.setVisible(true);
    }

    void tCT(int t) {
	tCT(t, 1, 1, 1, 1);
    }

    void tCT(int t, int b0, int b1, int b2, int b3) {
	/* split tetrahedron t into 4 */
        int gcf = gcd(b0,b1);
        gcf = gcd(gcf,b2);
        gcf = gcd(gcf,b3);
        b0 = b0/gcf;
        b1 = b1/gcf;
        b2 = b2/gcf;
        b3 = b3/gcf;
        int denominator = b0 + b1 + b2 + b3;
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = denominator*vtcs[i][j];
	    }
	}
        vtcs = new int[V+1][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = 4*newVtcs[i][j];
	    }
	}
        int i0 = tets[t][0];
        int i1 = tets[t][1];
        int i2 = tets[t][2];
        int i3 = tets[t][3];
        V++;
        newPoint(V-1,
                 (b0*vtcs[i0][0]+b1*vtcs[i1][0]+b2*vtcs[i2][0]+b3*vtcs[i3][0])/denominator,
                 (b0*vtcs[i0][1]+b1*vtcs[i1][1]+b2*vtcs[i2][1]+b3*vtcs[i3][1])/denominator,
                 (b0*vtcs[i0][2]+b1*vtcs[i1][2]+b2*vtcs[i2][2]+b3*vtcs[i3][2])/denominator);
        int[][] newTets = new int[N][4];
        for (int i = 0; i < t; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	}
        for (int i = t+1; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i-1][j] = tets[i][j];
	    }
	}
        tets = new int[N+3][4];
        for (int i = 0; i < N-1; i++) {
	    for (int j = 0; j < 4; j++) {
		tets[i][j] = newTets[i][j];
	    }
	}
        newTet(N-1,i0,i1,i2,V-1);
        newTet(N,i0,i1,V-1,i3);
        newTet(N+1,i0,V-1,i2,i3);
        newTet(N+2,V-1,i1,i2,i3);
        N += 3;
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined tCT";
        prepare();
        newRefine();
    }



    void tMS(int t) {
	/* split tetrahedron t into 15 by MS */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 4*vtcs[i][j];
	    }
	}
        vtcs = new int[V+4][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = 7*newVtcs[i][j];
	    }
	}
        int i0 = tets[t][0];
        int i1 = tets[t][1];
        int i2 = tets[t][2];
        int i3 = tets[t][3];
        V += 4;
        int i4 = V-4;
        newPoint(i4,
                 (vtcs[i0][0]+2*vtcs[i1][0]+2*vtcs[i2][0]+2*vtcs[i3][0])/7,
                 (vtcs[i0][1]+2*vtcs[i1][1]+2*vtcs[i2][1]+2*vtcs[i3][1])/7,
                 (vtcs[i0][2]+2*vtcs[i1][2]+2*vtcs[i2][2]+2*vtcs[i3][2])/7);
        int i5 = V-3;
        newPoint(i5,
                 (2*vtcs[i0][0]+vtcs[i1][0]+2*vtcs[i2][0]+2*vtcs[i3][0])/7,
                 (2*vtcs[i0][1]+vtcs[i1][1]+2*vtcs[i2][1]+2*vtcs[i3][1])/7,
                 (2*vtcs[i0][2]+vtcs[i1][2]+2*vtcs[i2][2]+2*vtcs[i3][2])/7);
        int i6 = V-2;
        newPoint(i6,
                 (2*vtcs[i0][0]+2*vtcs[i1][0]+vtcs[i2][0]+2*vtcs[i3][0])/7,
                 (2*vtcs[i0][1]+2*vtcs[i1][1]+vtcs[i2][1]+2*vtcs[i3][1])/7,
                 (2*vtcs[i0][2]+2*vtcs[i1][2]+vtcs[i2][2]+2*vtcs[i3][2])/7);
        int i7 = V-1;
        newPoint(i7,
                 (2*vtcs[i0][0]+2*vtcs[i1][0]+2*vtcs[i2][0]+vtcs[i3][0])/7,
                 (2*vtcs[i0][1]+2*vtcs[i1][1]+2*vtcs[i2][1]+vtcs[i3][1])/7,
                 (2*vtcs[i0][2]+2*vtcs[i1][2]+2*vtcs[i2][2]+vtcs[i3][2])/7);
        int[][] newTets = new int[N][4];
        for (int i = 0; i < t; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	}
        for (int i = t+1; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i-1][j] = tets[i][j];
	    }
	}
        tets = new int[N+14][4];
        for (int i = 0; i < N-1; i++) {
	    for (int j = 0; j < 4; j++) {
		tets[i][j] = newTets[i][j];
	    }
	}
        int count = N-2;
	count++; newTet(count,i4,i5,i6,i7);
	count++; newTet(count,i4,i5,i6,i3);
	count++; newTet(count,i4,i5,i2,i7);
	count++; newTet(count,i4,i1,i6,i7);
	count++; newTet(count,i0,i5,i6,i7);
	count++; newTet(count,i4,i5,i2,i3);
	count++; newTet(count,i4,i6,i1,i3);
	count++; newTet(count,i4,i7,i1,i2);
	count++; newTet(count,i5,i6,i0,i3);
	count++; newTet(count,i5,i7,i0,i2);
	count++; newTet(count,i6,i7,i0,i1);
	count++; newTet(count,i0,i1,i2,i7);
	count++; newTet(count,i0,i1,i6,i3);
	count++; newTet(count,i0,i5,i2,i3);
	count++; newTet(count,i4,i1,i2,i3);
        N += 14;
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined tMS";
        prepare();
        newRefine();
    }

    void tEdge1(int T) {
        /* split each edge of a terahedron t about its midpoint, add 
           the centroid of T, split T into 16 tetrahedra,  
           and apply minimal splits to 
           neighboring tetrahedra. */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 4*vtcs[i][j];
	    }
	}
	vtcs = new int[V+7][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int i0 = tets[T][0];
        int i1 = tets[T][1];
        int i2 = tets[T][2];
        int i3 = tets[T][3];
        int w = V;
        int i01 = V+1;
        int i02 = V+2;
        int i03 = V+3;
        int i12 = V+4;
        int i13 = V+5;
        int i23 = V+6;
        V += 7;
        newPoint(w,(vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0]+vtcs[i3][0])/4,
		 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1]+vtcs[i3][1])/4,
		 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2]+vtcs[i3][2])/4);
        newPoint(i01,(vtcs[i0][0]+vtcs[i1][0])/2,(vtcs[i0][1]+vtcs[i1][1])/2,(vtcs[i0][2]+vtcs[i1][2])/2);
        newPoint(i02,(vtcs[i0][0]+vtcs[i2][0])/2,(vtcs[i0][1]+vtcs[i2][1])/2,(vtcs[i0][2]+vtcs[i2][2])/2);
        newPoint(i03,(vtcs[i0][0]+vtcs[i3][0])/2,(vtcs[i0][1]+vtcs[i3][1])/2,(vtcs[i0][2]+vtcs[i3][2])/2);
        newPoint(i12,(vtcs[i1][0]+vtcs[i2][0])/2,(vtcs[i1][1]+vtcs[i2][1])/2,(vtcs[i1][2]+vtcs[i2][2])/2);
        newPoint(i13,(vtcs[i1][0]+vtcs[i3][0])/2,(vtcs[i1][1]+vtcs[i3][1])/2,(vtcs[i1][2]+vtcs[i3][2])/2);
        newPoint(i23,(vtcs[i2][0]+vtcs[i3][0])/2,(vtcs[i2][1]+vtcs[i3][1])/2,(vtcs[i2][2]+vtcs[i3][2])/2);
        int[][] newTets = new int[N][4];
        int[][] tcount = new int[N][8];
        /* tcount[t][i] contains information about neighboring status of 
           terahedron t, as follows: 
           i = 0: number n of vertices shared with split tetrahedron T (0-4)
           if n = 2:
	   i = 1: index of the splitpoint of the edge
	   i = 2: index of one end point of the edge
	   i = 3: index of the other end point of the edge
	   i = 4: index of one other vertex of t
	   i = 5: index of the remaining vertex of t
           if n = 3: 
	   i = 1,2,3: indices of the vertices of the shared face
	   i = 4,5,6: indices of splitpoints of edges 12, 23, 31
	   i = 7: index of the remaining vertex of t
	*/
        int newCount = N + 11;
	for (int i = 0; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	    int vcount = 0;
	    if (inTet(i0,i)) { vcount++; }
	    if (inTet(i1,i)) { vcount++; }
	    if (inTet(i2,i)) { vcount++; }
	    if (inTet(i3,i)) { vcount++; }
	    tcount[i][0] = vcount;
            if (vcount == 2) { 
		newCount++;
                if (inTet(i0,i) && inTet(i1,i)) {
		    tcount[i][1] = i01;
                    tcount[i][2] = i0;
		    tcount[i][3] = i1;
		}
                else if (inTet(i0,i) && inTet(i2,i)) {
		    tcount[i][1] = i02;
                    tcount[i][2] = i0;
		    tcount[i][3] = i2;
		}
                else if (inTet(i0,i) && inTet(i3,i)) {
		    tcount[i][1] = i03;
                    tcount[i][2] = i0;
		    tcount[i][3] = i3;
		}
                else if (inTet(i1,i) && inTet(i2,i)) {
		    tcount[i][1] = i12;
                    tcount[i][2] = i1;
		    tcount[i][3] = i2;
		}
                else if (inTet(i1,i) && inTet(i3,i)) {
		    tcount[i][1] = i13;
                    tcount[i][2] = i1;
		    tcount[i][3] = i3;
		}
                else if (inTet(i2,i) && inTet(i3,i)) {
		    tcount[i][1] = i23;
                    tcount[i][2] = i2;
		    tcount[i][3] = i3;
		}
                boolean found = false;
		for (int k = 0; k < 4; k++) {
		    if (newTets[i][k] != tcount[i][2] && newTets[i][k] != tcount[i][3]) {
			if (found) {
			    tcount[i][4] = newTets[i][k];
			}
                        else {
			    tcount[i][5] = newTets[i][k];
			}
                        found = !found;
		    }
		}
	    }
            if (vcount == 3) { 
		newCount += 3; 
                if (!inTet(i0,i)) {
		    tcount[i][1] = i1;
		    tcount[i][2] = i2;
		    tcount[i][3] = i3;
                    tcount[i][4] = i23;
                    tcount[i][5] = i13;
                    tcount[i][6] = i12;
                    tcount[i][7] = faces[findFace(i1,i2,i3)][3];
                    if (tcount[i][7] == i0) {
			tcount[i][7] = faces[findFace(i1,i2,i3)][4];
		    }
		}
		else if (!inTet(i1,i)) {
		    tcount[i][1] = i0;
		    tcount[i][2] = i2;
		    tcount[i][3] = i3;
                    tcount[i][4] = i23;
                    tcount[i][5] = i03;
                    tcount[i][6] = i02;
                    tcount[i][7] = faces[findFace(i0,i2,i3)][3];
                    if (tcount[i][7] == i1) {
			tcount[i][7] = faces[findFace(i0,i2,i3)][4];
		    }
		}
		else if (!inTet(i2,i)) {
		    tcount[i][1] = i0;
		    tcount[i][2] = i1;
		    tcount[i][3] = i3;
                    tcount[i][4] = i13;
                    tcount[i][5] = i03;
                    tcount[i][6] = i01;
                    tcount[i][7] = faces[findFace(i0,i1,i3)][3];
                    if (tcount[i][7] == i2) {
			tcount[i][7] = faces[findFace(i0,i1,i3)][4];
		    }
		}
		else if (!inTet(i3,i)) {
		    tcount[i][1] = i0;
		    tcount[i][2] = i1;
		    tcount[i][3] = i2;
                    tcount[i][4] = i12;
                    tcount[i][5] = i02;
                    tcount[i][6] = i01;
                    tcount[i][7] = faces[findFace(i0,i1,i2)][3];
                    if (tcount[i][7] == i3) {
			tcount[i][7] = faces[findFace(i0,i1,i2)][4];
		    }
		}
	    }
	}
        tets = new int[newCount][4];
        int count = 0;
        for (int t = 0; t < N; t++) {
	    if (tcount[t][0] < 2) {
		newTet(count,newTets[t][0],newTets[t][1],newTets[t][2],newTets[t][3]); count++;
	    }
            else if (tcount[t][0] == 2) {
                newTet(count,tcount[t][1],tcount[t][2],tcount[t][4],tcount[t][5]); count++;
                newTet(count,tcount[t][1],tcount[t][3],tcount[t][4],tcount[t][5]); count++;
	    }
	    else if (tcount[t][0] == 3) {
                newTet(count,tcount[t][7],tcount[t][1],tcount[t][5],tcount[t][6]); count++;
                newTet(count,tcount[t][7],tcount[t][3],tcount[t][4],tcount[t][5]); count++;
                newTet(count,tcount[t][7],tcount[t][2],tcount[t][4],tcount[t][6]); count++;
                newTet(count,tcount[t][7],tcount[t][4],tcount[t][5],tcount[t][6]); count++;
	    }
            else if (tcount[t][0] == 4) {
                newTet(count,i0,i01,i02,i03); count++;
                newTet(count,i1,i01,i12,i13); count++;
                newTet(count,i2,i02,i12,i23); count++;
                newTet(count,i3,i03,i13,i23); count++;
                newTet(count,w,i01,i02,i03); count++;
                newTet(count,w,i01,i12,i13); count++;
                newTet(count,w,i02,i12,i23); count++;
                newTet(count,w,i03,i13,i23); count++;

                newTet(count,w,i01,i02,i12); count++;
                newTet(count,w,i01,i03,i13); count++;
                newTet(count,w,i02,i03,i23); count++;
                newTet(count,w,i12,i13,i23); count++;

	    }
	}
        N = newCount;
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined edged 12";
        prepare();
        newRefine();
    }

    void tEdge2(int T) {
        /* split each edge of a terahedron t about its midpoint, add 
           the centroid of T, split T into 16 tetrahedra,  
           and apply minimal splits to 
           neighboring tetrahedra. */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 4*vtcs[i][j];
	    }
	}
	vtcs = new int[V+7][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int i0 = tets[T][0];
        int i1 = tets[T][1];
        int i2 = tets[T][2];
        int i3 = tets[T][3];
        int w = V;
        int i01 = V+1;
        int i02 = V+2;
        int i03 = V+3;
        int i12 = V+4;
        int i13 = V+5;
        int i23 = V+6;
        V += 7;
        newPoint(w,(vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0]+vtcs[i3][0])/4,
		 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1]+vtcs[i3][1])/4,
		 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2]+vtcs[i3][2])/4);
        newPoint(i01,(vtcs[i0][0]+vtcs[i1][0])/2,(vtcs[i0][1]+vtcs[i1][1])/2,(vtcs[i0][2]+vtcs[i1][2])/2);
        newPoint(i02,(vtcs[i0][0]+vtcs[i2][0])/2,(vtcs[i0][1]+vtcs[i2][1])/2,(vtcs[i0][2]+vtcs[i2][2])/2);
        newPoint(i03,(vtcs[i0][0]+vtcs[i3][0])/2,(vtcs[i0][1]+vtcs[i3][1])/2,(vtcs[i0][2]+vtcs[i3][2])/2);
        newPoint(i12,(vtcs[i1][0]+vtcs[i2][0])/2,(vtcs[i1][1]+vtcs[i2][1])/2,(vtcs[i1][2]+vtcs[i2][2])/2);
        newPoint(i13,(vtcs[i1][0]+vtcs[i3][0])/2,(vtcs[i1][1]+vtcs[i3][1])/2,(vtcs[i1][2]+vtcs[i3][2])/2);
        newPoint(i23,(vtcs[i2][0]+vtcs[i3][0])/2,(vtcs[i2][1]+vtcs[i3][1])/2,(vtcs[i2][2]+vtcs[i3][2])/2);
        int[][] newTets = new int[N][4];
        int[][] tcount = new int[N][8];
        /* tcount[t][i] contains information about neighboring status of 
           terahedron t, as follows: 
           i = 0: number n of vertices shared with split tetrahedron T (0-4)
           if n = 2:
	   i = 1: index of the splitpoint of the edge
	   i = 2: index of one end point of the edge
	   i = 3: index of the other end point of the edge
	   i = 4: index of one other vertex of t
	   i = 5: index of the remaining vertex of t
           if n = 3: 
	   i = 1,2,3: indices of the vertices of the shared face
	   i = 4,5,6: indices of splitpoints of edges 12, 23, 31
	   i = 7: index of the remaining vertex of t
	*/
        int newCount = N + 15;
	for (int i = 0; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	    int vcount = 0;
	    if (inTet(i0,i)) { vcount++; }
	    if (inTet(i1,i)) { vcount++; }
	    if (inTet(i2,i)) { vcount++; }
	    if (inTet(i3,i)) { vcount++; }
	    tcount[i][0] = vcount;
            if (vcount == 2) { 
		newCount++;
                if (inTet(i0,i) && inTet(i1,i)) {
		    tcount[i][1] = i01;
                    tcount[i][2] = i0;
		    tcount[i][3] = i1;
		}
                else if (inTet(i0,i) && inTet(i2,i)) {
		    tcount[i][1] = i02;
                    tcount[i][2] = i0;
		    tcount[i][3] = i2;
		}
                else if (inTet(i0,i) && inTet(i3,i)) {
		    tcount[i][1] = i03;
                    tcount[i][2] = i0;
		    tcount[i][3] = i3;
		}
                else if (inTet(i1,i) && inTet(i2,i)) {
		    tcount[i][1] = i12;
                    tcount[i][2] = i1;
		    tcount[i][3] = i2;
		}
                else if (inTet(i1,i) && inTet(i3,i)) {
		    tcount[i][1] = i13;
                    tcount[i][2] = i1;
		    tcount[i][3] = i3;
		}
                else if (inTet(i2,i) && inTet(i3,i)) {
		    tcount[i][1] = i23;
                    tcount[i][2] = i2;
		    tcount[i][3] = i3;
		}
                boolean found = false;
		for (int k = 0; k < 4; k++) {
		    if (newTets[i][k] != tcount[i][2] && newTets[i][k] != tcount[i][3]) {
			if (found) {
			    tcount[i][4] = newTets[i][k];
			}
                        else {
			    tcount[i][5] = newTets[i][k];
			}
                        found = !found;
		    }
		}
	    }
            if (vcount == 3) { 
		newCount += 3; 
                if (!inTet(i0,i)) {
		    tcount[i][1] = i1;
		    tcount[i][2] = i2;
		    tcount[i][3] = i3;
                    tcount[i][4] = i23;
                    tcount[i][5] = i13;
                    tcount[i][6] = i12;
                    tcount[i][7] = faces[findFace(i1,i2,i3)][3];
                    if (tcount[i][7] == i0) {
			tcount[i][7] = faces[findFace(i1,i2,i3)][4];
		    }
		}
		else if (!inTet(i1,i)) {
		    tcount[i][1] = i0;
		    tcount[i][2] = i2;
		    tcount[i][3] = i3;
                    tcount[i][4] = i23;
                    tcount[i][5] = i03;
                    tcount[i][6] = i02;
                    tcount[i][7] = faces[findFace(i0,i2,i3)][3];
                    if (tcount[i][7] == i1) {
			tcount[i][7] = faces[findFace(i0,i2,i3)][4];
		    }
		}
		else if (!inTet(i2,i)) {
		    tcount[i][1] = i0;
		    tcount[i][2] = i1;
		    tcount[i][3] = i3;
                    tcount[i][4] = i13;
                    tcount[i][5] = i03;
                    tcount[i][6] = i01;
                    tcount[i][7] = faces[findFace(i0,i1,i3)][3];
                    if (tcount[i][7] == i2) {
			tcount[i][7] = faces[findFace(i0,i1,i3)][4];
		    }
		}
		else if (!inTet(i3,i)) {
		    tcount[i][1] = i0;
		    tcount[i][2] = i1;
		    tcount[i][3] = i2;
                    tcount[i][4] = i12;
                    tcount[i][5] = i02;
                    tcount[i][6] = i01;
                    tcount[i][7] = faces[findFace(i0,i1,i2)][3];
                    if (tcount[i][7] == i3) {
			tcount[i][7] = faces[findFace(i0,i1,i2)][4];
		    }
		}
	    }
	}
        tets = new int[newCount][4];
        int count = 0;
        for (int t = 0; t < N; t++) {
	    if (tcount[t][0] < 2) {
		newTet(count,newTets[t][0],newTets[t][1],newTets[t][2],newTets[t][3]); count++;
	    }
            else if (tcount[t][0] == 2) {
                newTet(count,tcount[t][1],tcount[t][2],tcount[t][4],tcount[t][5]); count++;
                newTet(count,tcount[t][1],tcount[t][3],tcount[t][4],tcount[t][5]); count++;
	    }
	    else if (tcount[t][0] == 3) {
                newTet(count,tcount[t][7],tcount[t][1],tcount[t][5],tcount[t][6]); count++;
                newTet(count,tcount[t][7],tcount[t][3],tcount[t][4],tcount[t][5]); count++;
                newTet(count,tcount[t][7],tcount[t][2],tcount[t][4],tcount[t][6]); count++;
                newTet(count,tcount[t][7],tcount[t][4],tcount[t][5],tcount[t][6]); count++;
	    }
            else if (tcount[t][0] == 4) {
                newTet(count,i01,i0,i02,w); count++;
                newTet(count,i02,i2,i12,w); count++;
                newTet(count,i12,i1,i01,w); count++;
                newTet(count,i01,i02,i12,w); count++;

                newTet(count,i01,i0,i03,w); count++;
                newTet(count,i03,i3,i13,w); count++;
                newTet(count,i13,i1,i01,w); count++;
                newTet(count,i01,i03,i13,w); count++;

                newTet(count,i02,i0,i03,w); count++;
                newTet(count,i03,i3,i23,w); count++;
                newTet(count,i23,i2,i02,w); count++;
                newTet(count,i02,i03,i23,w); count++;

                newTet(count,i12,i1,i13,w); count++;
                newTet(count,i13,i3,i23,w); count++;
                newTet(count,i23,i2,i12,w); count++;
                newTet(count,i12,i13,i23,w); count++;
	    }
	}
        N = newCount;
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined edged 16";
        prepare();
        newRefine();
    }

    void tinvert(int t) {
	/* insert an inverted terahedron in t and cone interior interior faces of t */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 4*vtcs[i][j];
	    }
	}
	vtcs = new int[V+4][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = 3*newVtcs[i][j];
	    }
	}
        int i0 = tets[t][0];
        int i1 = tets[t][1];
        int i2 = tets[t][2];
        int i3 = tets[t][3];
        V += 4;
        int i4 = V-4;
        int f4 = findFace(i1,i2,i3);
        newPoint(i4,
                 (vtcs[i1][0]+vtcs[i2][0]+vtcs[i3][0])/3,
                 (vtcs[i1][1]+vtcs[i2][1]+vtcs[i3][1])/3,
                 (vtcs[i1][2]+vtcs[i2][2]+vtcs[i3][2])/3);
        int i5 = i4 + 1;
        int f5 = findFace(i0,i2,i3);
        newPoint(i5,
                 (vtcs[i0][0]+vtcs[i2][0]+vtcs[i3][0])/3,
                 (vtcs[i0][1]+vtcs[i2][1]+vtcs[i3][1])/3,
                 (vtcs[i0][2]+vtcs[i2][2]+vtcs[i3][2])/3);
        int i6 = i5 + 1;
        int f6 = findFace(i0,i1,i3);
        newPoint(i6,
                 (vtcs[i0][0]+vtcs[i1][0]+vtcs[i3][0])/3,
                 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i3][1])/3,
                 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i3][2])/3);
        int i7 = i6 + 1;
        int f7 = findFace(i0,i1,i2);
        newPoint(i7,
                 (vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0])/3,
                 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1])/3,
                 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2])/3);
        int nTs = 10;
        int t4 = -1; int t5 = -1; int t6 = -1; int t7 = -1; 
        int k4 = -1; int k5 = -1; int k6 = -1; int k7 = -1; 
        if (f4 < TI) { 
	    nTs += 2; 
	    k4 = faces[f4][3];        
	    if (k4 == i0) {
		k4 = faces[f4][4];
	    }
	    t4 = tetrahedron(i1,i2,i3,k4);
	}
        if (f5 < TI) { 
	    nTs += 2; 
	    k5 = faces[f5][3];        
	    if (k5 == i1) {
		k5 = faces[f5][4];
	    }
	    t5 = tetrahedron(i0,i2,i3,k5);
	}
        if (f6 < TI) { 
	    nTs += 2; 
	    k6 = faces[f6][3];        
	    if (k6 == i2) {
		k6 = faces[f6][4];
	    }
	    t6 = tetrahedron(i0,i1,i3,k6);
	}
        if (f7 < TI) { 
	    nTs += 2; 
	    k7 = faces[f7][3];        
	    if (k7 == i3) {
		k7 = faces[f7][4];
	    }
	    t7 = tetrahedron(i0,i1,i2,k7);
	}
        int[][] newTets = new int[N][4];
        int count = 0;
        for (int i = 0; i < N; i++) {
            if (i != t && i!= t4 && i!= t5 && i!= t6 && i!= t7) {
		for (int j = 0; j < 4; j++) {
		    newTets[count][j] = tets[i][j];
		}
		count++;
	    }
	}
        tets = new int[N+nTs][4];
        for (int i = 0; i < count; i++) {
	    for (int j = 0; j < 4; j++) {
		tets[i][j] = newTets[i][j];
	    }
	}
	newTet(count,i4,i5,i6,i7);
	count++; newTet(count,i0,i5,i6,i7);
	count++; newTet(count,i4,i1,i6,i7);
	count++; newTet(count,i4,i5,i2,i7);
	count++; newTet(count,i4,i5,i6,i3);
	count++; newTet(count,i0,i1,i6,i7);
	count++; newTet(count,i0,i5,i2,i7);
	count++; newTet(count,i0,i5,i6,i3);
	count++; newTet(count,i4,i1,i2,i7);
	count++; newTet(count,i4,i1,i6,i3);
	count++; newTet(count,i4,i5,i2,i3);
        if (t4 >= 0) {
	    count++; newTet(count,k4,i4,i2,i3);
	    count++; newTet(count,k4,i1,i4,i3);
	    count++; newTet(count,k4,i1,i2,i4);
	}          
        if (t5 >= 0) {
	    count++; newTet(count,i5,k5,i2,i3);
	    count++; newTet(count,i0,k5,i5,i3);
	    count++; newTet(count,i0,k5,i2,i5);
	}          
        if (t6 >= 0) {
	    count++; newTet(count,i6,i1,k6,i3);
	    count++; newTet(count,i0,i6,k6,i3);
	    count++; newTet(count,i0,i1,k6,i6);
	}          
        if (t7 >= 0) {
	    count++; newTet(count,i7,i1,i2,k7);
	    count++; newTet(count,i0,i7,i2,k7);
	    count++; newTet(count,i0,i1,i7,k7);
	}          
        N = count+1;
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined inverted";
        prepare();
        newRefine();
    }

    void fCT(int f) {
	fCT(f, 1, 1, 1);
    }    

    void fCT(int f, int c0, int c1, int c2) {
	/* split face f into 3 by weighted CT */
        int denominator = c0 + c1 + c2;
        boolean interior = f < TI;
        int[][] newVtcs = new int[V+1][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = denominator*vtcs[i][j];
	    }
	}
        vtcs = new int[V+1][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int i0 = faces[f][0];        
        int i1 = faces[f][1];        
        int i2 = faces[f][2];        
        int i3 = faces[f][3];        
        int i4 = faces[f][4];        
        V++;
        newPoint(V-1,
                 (c0*vtcs[i0][0]+c1*vtcs[i1][0]+c2*vtcs[i2][0])/denominator,
                 (c0*vtcs[i0][1]+c1*vtcs[i1][1]+c2*vtcs[i2][1])/denominator,
                 (c0*vtcs[i0][2]+c1*vtcs[i1][2]+c2*vtcs[i2][2])/denominator);
        int[][] newTets = new int[N][4];
	int t3 = tv.Config.tetrahedron(i0,i1,i2,i3);
	int t4 = -1;
        if (interior) {
	    t4 = tv.Config.tetrahedron(i0,i1,i2,i4);
	}
	int count = 0;
        for (int i = 0; i < N; i++) {
            if (i != t3 && i != t4) {
		for (int j = 0; j < 4; j++) {
		    newTets[count][j] = tets[i][j];
		}
		count++;
	    }
	}
        if (interior) { 
	    N += 4;
	}
        else {
            N += 2;
	}
        tets = new int[N][4];
        for (int i = 0; i < count; i++) {
	    for (int j = 0; j < 4; j++) {
		tets[i][j] = newTets[i][j];
	    }
	}
        newTet(count,i0,i1,i3,V-1); count++;
        newTet(count,i0,i3,i2,V-1); count++;
        newTet(count,i3,i1,i2,V-1); count++;
        if (interior) {
	    newTet(count,i0,i1,i4,V-1); count++;
	    newTet(count,i0,i4,i2,V-1); count++;
	    newTet(count,i4,i1,i2,V-1); count++;
	}
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined fCT";
        prepare();
        newRefine();
    }

    void fMS(int f) {
	/* split face f into 7 by MS */
        boolean interior = f < TI;
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 5*vtcs[i][j];
	    }
	}
        vtcs = new int[V+3][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int i0 = faces[f][0];        
        int i1 = faces[f][1];        
        int i2 = faces[f][2];        
        int i3 = faces[f][3];        
        int i4 = faces[f][4];        
        V += 3;
        newPoint(V-3,
                 (vtcs[i0][0]+2*vtcs[i1][0]+2*vtcs[i2][0])/5,
                 (vtcs[i0][1]+2*vtcs[i1][1]+2*vtcs[i2][1])/5,
                 (vtcs[i0][2]+2*vtcs[i1][2]+2*vtcs[i2][2])/5);
        newPoint(V-2,
                 (2*vtcs[i0][0]+vtcs[i1][0]+2*vtcs[i2][0])/5,
                 (2*vtcs[i0][1]+vtcs[i1][1]+2*vtcs[i2][1])/5,
                 (2*vtcs[i0][2]+vtcs[i1][2]+2*vtcs[i2][2])/5);
        newPoint(V-1,
                 (2*vtcs[i0][0]+2*vtcs[i1][0]+vtcs[i2][0])/5,
                 (2*vtcs[i0][1]+2*vtcs[i1][1]+vtcs[i2][1])/5,
                 (2*vtcs[i0][2]+2*vtcs[i1][2]+vtcs[i2][2])/5);
        int[][] newTets = new int[N][4];
	int t3 = tv.Config.tetrahedron(i0,i1,i2,i3);
	int t4 = -1;
        if (interior) {
	    t4 = tv.Config.tetrahedron(i0,i1,i2,i4);
	}
	int count = 0;
        for (int i = 0; i < N; i++) {
            if (i != t3 && i != t4) {
		for (int j = 0; j < 4; j++) {
		    newTets[count][j] = tets[i][j];
		}
		count++;
	    }
	}
        if (interior) { 
	    N += 12;
	}
        else {
            N += 6;
	}
        tets = new int[N][4];
        for (int i = 0; i < count; i++) {
	    for (int j = 0; j < 4; j++) {
		tets[i][j] = newTets[i][j];
	    }
	}
        int j0 = V-3;
        int j1 = V-2;
        int j2 = V-1;
        newTet(count,j0,i1,i2,i3); count++;
        newTet(count,i0,j1,i2,i3); count++;
        newTet(count,i0,i1,j2,i3); count++;
        newTet(count,j0,j1,i2,i3); count++;
        newTet(count,j0,i1,j2,i3); count++;
        newTet(count,i0,j1,j2,i3); count++;
        newTet(count,j0,j1,j2,i3); count++;
        if (interior) {
	    newTet(count,j0,i1,i2,i4); count++;
	    newTet(count,i0,j1,i2,i4); count++;
	    newTet(count,i0,i1,j2,i4); count++;
	    newTet(count,j0,j1,i2,i4); count++;
	    newTet(count,j0,i1,j2,i4); count++;
	    newTet(count,i0,j1,j2,i4); count++;
	    newTet(count,j0,j1,j2,i4); count++;
	}
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined fMS";
        prepare();
        newRefine();
    }



    void fpierce(int f) {
	/* split face f into 3 by connecting the opposing vertices, if possible */
	if (f >= TI) {
	    fCT(f);
	}
	else {
	    int[][] newVtcs = new int[V][3];
	    int i0 = faces[f][0];        
	    int i1 = faces[f][1];        
	    int i2 = faces[f][2];        
	    int i3 = faces[f][3];        
	    int i4 = faces[f][4];        
            if (!GeometryPresent) {
                geometry();
	    }
            int p0 = bcs[f][0];
            int p1 = bcs[f][1];
            int p2 = bcs[f][2];
            int p3 = bcs[f][3];
            int q = bcs[f][4];
            int denom = q-p3;
            if (denom == 0) {
		write(" zero denominator in piercing step ");
                fishy = true;
	    }    
	    else {
		int cf = gcd(denom,p0);
		cf = gcd(cf,p1);
		cf = gcd(cf,p2);
		if (denom < 0) {
		    cf = -cf;
		}
		int r0 = p0/cf;
		int r1 = p1/cf;
		int r2 = p2/cf;
		denom = denom/cf;
		if (r0 > 0 && r1 > 0 && r2 > 0) {
		    for (int i = 0; i < V; i++) {
			for (int j = 0; j < 3; j++) {
			    newVtcs[i][j] = denom*vtcs[i][j];
			}
		    }
		    vtcs = new int[V+1][3];
		    for (int i = 0; i < V; i++) {
			for (int j = 0; j < 3; j++) {
			    vtcs[i][j] = newVtcs[i][j];
			}
		    }
		    V++;
		    newPoint(V-1,
			     (r0*vtcs[i0][0]+r1*vtcs[i1][0]+r2*vtcs[i2][0])/denom,
			     (r0*vtcs[i0][1]+r1*vtcs[i1][1]+r2*vtcs[i2][1])/denom,
			     (r0*vtcs[i0][2]+r1*vtcs[i1][2]+r2*vtcs[i2][2])/denom);
		    int[][] newTets = new int[N][4];
		    int t3 = tv.Config.tetrahedron(i0,i1,i2,i3);
		    int t4 = tv.Config.tetrahedron(i0,i1,i2,i4);
		    int count = 0;
		    for (int i = 0; i < N; i++) {
			if (i != t3 && i != t4) {
			    for (int j = 0; j < 4; j++) {
				newTets[count][j] = tets[i][j];
			    }
			    count++;
			}
		    }
		    N += 4;
		    tets = new int[N][4];
		    for (int i = 0; i < count; i++) {
			for (int j = 0; j < 4; j++) {
			    tets[i][j] = newTets[i][j];
			}
		    }
		    newTet(count,i0,i1,i3,V-1); count++;
		    newTet(count,i0,i3,i2,V-1); count++;
		    newTet(count,i3,i1,i2,V-1); count++;
		    newTet(count,i0,i1,i4,V-1); count++;
		    newTet(count,i0,i4,i2,V-1); count++;
		    newTet(count,i4,i1,i2,V-1); count++;
		    configuration = 0;
		    loaded = true;
		    tv.TV.configuration.select(0);
		    title = "refined fCT";
		    prepare();
		    newRefine();
		}
		else {
		    write(" cannot pierce ");
		    mess("cannot pierce");
		}
	    }
	}
    }

    void eSplit(int e) {
        eSplit(e,1,1);
    }

    void eSplit(int e, int e0, int e1) {
	/* split edge e into 2 about its midpoint */
        int denominator = e0 + e1;
	int[][] newVtcs = new int[V][3];
	int i0 = edges[e][0];        
	int i1 = edges[e][1];        
	for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = denominator*vtcs[i][j];
	    }
	}
	vtcs = new int[V+1][3];
	for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
	V++;
	newPoint(V-1,(e0*vtcs[i0][0]+e1*vtcs[i1][0])/denominator,
		 (e0*vtcs[i0][1]+e1*vtcs[i1][1])/denominator,
		 (e0*vtcs[i0][2]+e1*vtcs[i1][2])/denominator);
	int[][] newTets = new int[2*N][4];
	int count = 0;
        for (int t = 0; t < N; t++) {
	    if (inTet(i0,t) && inTet(i1,t)) {
		int i2 = -1;
                int i3 = -1;
                for (int j = 0; j < 4; j++) {
		    if (tets[t][j] != i0 && tets[t][j] != i1) {
			if (i2 < 0) {
			    i2 = tets[t][j];
			}
                        else {
                            i3 = tets[t][j];
			}
		    }
		}
                newTets[count][0] = i2;
                newTets[count][1] = i3;
                newTets[count][2] = i0;
                newTets[count][3] = V-1;
                count++;
                newTets[count][0] = i2;
                newTets[count][1] = i3;
                newTets[count][2] = i1;
                newTets[count][3] = V-1;
                count++;
	    }
	    else {
		newTets[count][0] = tets[t][0];
                newTets[count][1] = tets[t][1];
                newTets[count][2] = tets[t][2];
                newTets[count][3] = tets[t][3];
                count++;
	    }
	}
        N = count;
        tets = new int[N][4];
	for (int i = 0; i < N; i++) {
	    int j0 = newTets[i][0];
	    int j1 = newTets[i][1];
	    int j2 = newTets[i][2];
	    int j3 = newTets[i][3];
	    newTet(i,j0,j1,j2,j3);
	}
	configuration = 0;
	loaded = true;
	tv.TV.configuration.select(0);
	title = "refined edge split";
	prepare();
	newRefine();
    }


    void fPS6(int f) {
	/* split face f into PS 6 */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 6*vtcs[i][j];
	    }
	}
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int i0 = faces[f][0];        
        int i1 = faces[f][1];        
        int i2 = faces[f][2];        
        int i3 = faces[f][3];        
        int i4 = faces[f][4];        
        vtcs = new int[V+4][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        V += 4;
        int j0 = V-4;
	newPoint(j0,(vtcs[i1][0]+vtcs[i2][0])/2,
		 (vtcs[i1][1]+vtcs[i2][1])/2,
		 (vtcs[i1][2]+vtcs[i2][2])/2);
        int j1 = V-3;
	newPoint(j1,(vtcs[i0][0]+vtcs[i2][0])/2,
		 (vtcs[i0][1]+vtcs[i2][1])/2,
		 (vtcs[i0][2]+vtcs[i2][2])/2);
        int j2 = V-2;
	newPoint(j2,(vtcs[i1][0]+vtcs[i0][0])/2,
		 (vtcs[i1][1]+vtcs[i0][1])/2,
		 (vtcs[i1][2]+vtcs[i0][2])/2);
        int j3 = V-1;   
	newPoint(j3,(vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0])/3,
		 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1])/3,
		 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2])/3);
        int toadd = 0;
        int[][] newTets = new int[N][4];
        int[] prs = new int[N];
        for (int t = 0; t < N; t++) {
	    int present = 0;
            if (inTet(i0,t)) {present++;}
            if (inTet(i1,t)) {present++;}
            if (inTet(i2,t)) {present++;}
            prs[t] = present;
            if (present == 2) { toadd++; }
            if (present == 3) { toadd += 5; }
	    for (int j = 0; j < 4; j++) {
		newTets[t][j] = tets[t][j];
	    }
	}
        N += toadd;
        int count = 0;
        tets = new int[N][4];
        for (int t = 0; t < N - toadd; t++) {
            int present = prs[t];
	    if (present < 2) {
		newTet(count,newTets[t][0],newTets[t][1],newTets[t][2],newTets[t][3]);
                count++;
	    }
            else {
                int k0 = -1;
                int k1 = -1;
                int k2 = -1;
                int k3 = -1;
                int k4 = -1;
                int s0 = newTets[t][0];
                int s1 = newTets[t][1];
                int s2 = newTets[t][2];
                int s3 = newTets[t][3];
		if (present == 2) {
		    if (i0 == s0 && i1 == s1) {
			k0 = i0;
                        k1 = i1;
                        k2 = s2;
                        k3 = s3;
                        k4 = j2;
		    }
                    else if (i0 == s0 && i1 == s2) {
			k0 = i0;
                        k1 = i1;
                        k2 = s1;
                        k3 = s3;
                        k4 = j2;
		    }
                    else if (i0 == s0 && i1 == s3) {
			k0 = i0;
                        k1 = i1;
                        k2 = s1;
                        k3 = s2;
                        k4 = j2;
		    }
                    else if (i0 == s1 && i1 == s2) {
			k0 = i0;
                        k1 = i1;
                        k2 = s0;
                        k3 = s3;
                        k4 = j2;
		    }
                    else if (i0 == s1 && i1 == s3) {
			k0 = i0;
                        k1 = i1;
                        k2 = s0;
                        k3 = s2;
                        k4 = j2;
		    }
                    else if (i0 == s2 && i1 == s3) {
			k0 = i0;
                        k1 = i1;
                        k2 = s0;
                        k3 = s1;
                        k4 = j2;
		    }
		    else if (i0 == s0 && i2 == s1) {
			k0 = i0;
                        k1 = i2;
                        k2 = s2;
                        k3 = s3;
                        k4 = j1;
		    }
                    else if (i0 == s0 && i2 == s2) {
			k0 = i0;
                        k1 = i2;
                        k2 = s1;
                        k3 = s3;
                        k4 = j1;
		    }
                    else if (i0 == s0 && i2 == s3) {
			k0 = i0;
                        k1 = i2;
                        k2 = s1;
                        k3 = s2;
                        k4 = j1;
		    }
                    else if (i0 == s1 && i2 == s2) {
			k0 = i0;
                        k1 = i2;
                        k2 = s0;
                        k3 = s3;
                        k4 = j1;
		    }
                    else if (i0 == s1 && i2 == s3) {
			k0 = i0;
                        k1 = i2;
                        k2 = s0;
                        k3 = s2;
                        k4 = j1;
		    }
                    else if (i0 == s2 && i2 == s3) {
			k0 = i0;
                        k1 = i2;
                        k2 = s0;
                        k3 = s1;
                        k4 = j1;
		    }
		    else if (i1 == s0 && i2 == s1) {
			k0 = i1;
                        k1 = i2;
                        k2 = s2;
                        k3 = s3;
                        k4 = j0;
		    }
                    else if (i1 == s0 && i2 == s2) {
			k0 = i1;
                        k1 = i2;
                        k2 = s1;
                        k3 = s3;
                        k4 = j0;
		    }
                    else if (i1 == s0 && i2 == s3) {
			k0 = i1;
                        k1 = i2;
                        k2 = s1;
                        k3 = s2;
                        k4 = j0;
		    }
                    else if (i1 == s1 && i2 == s2) {
			k0 = i1;
                        k1 = i2;
                        k2 = s0;
                        k3 = s3;
                        k4 = j0;
		    }
                    else if (i1 == s1 && i2 == s3) {
			k0 = i1;
                        k1 = i2;
                        k2 = s0;
                        k3 = s2;
                        k4 = j0;
		    }
                    else if (i1 == s2 && i2 == s3) {
			k0 = i1;
                        k1 = i2;
                        k2 = s0;
                        k3 = s1;
                        k4 = j0;
		    }
                    else {
			fishy = true;
                        mess("PS 6 split error 3");
		    }
		    newTet(count,k0,k2,k3,k4); count++; 
		    newTet(count,k1,k2,k3,k4); count++; 
		}
                else {
                    int k = -1;
		    if (s0 != i0 && s0 != i1 && s0 != i2) {
			k = s0;
		    }
		    else if (s1 != i0 && s1 != i1 && s1 != i2) {
			k = s1;
		    }
		    else if (s2 != i0 && s2 != i1 && s2 != i2) {
			k = s2;
		    }
		    else if (s3 != i0 && s3 != i1 && s3 != i2) {
			k = s3;
		    }
                    else {
			fishy = true;
                        mess("PS 6 split error 3");
		    }
		    newTet(count,i0,j3,j1,k); count++; 
		    newTet(count,j1,j3,i2,k); count++; 
		    newTet(count,i2,j3,j0,k); count++; 
		    newTet(count,j0,j3,i1,k); count++; 
		    newTet(count,i1,j3,j2,k); count++; 
		    newTet(count,j2,j3,i0,k); count++; 
		}
	    }
	}
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined PS 6";
        prepare();
        newRefine();
    }


    void fPS12(int f) {
	/* split face f into PS 12 */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 12*vtcs[i][j];
	    }
	}
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int i0 = faces[f][0];        
        int i1 = faces[f][1];        
        int i2 = faces[f][2];        
        int i3 = faces[f][3];        
        int i4 = faces[f][4];        
        vtcs = new int[V+7][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        V += 7;
        int u0 = V-7;
	newPoint(u0,(2*vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0])/4,
  		 (2*vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1])/4,
		 (2*vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2])/4);
        int u1 = V-6;
	newPoint(u1,(vtcs[i0][0]+2*vtcs[i1][0]+vtcs[i2][0])/4,
  		 (vtcs[i0][1]+2*vtcs[i1][1]+vtcs[i2][1])/4,
		 (vtcs[i0][2]+2*vtcs[i1][2]+vtcs[i2][2])/4);
        int u2 = V-5;
	newPoint(u2,(vtcs[i0][0]+vtcs[i1][0]+2*vtcs[i2][0])/4,
  		 (vtcs[i0][1]+vtcs[i1][1]+2*vtcs[i2][1])/4,
		 (vtcs[i0][2]+vtcs[i1][2]+2*vtcs[i2][2])/4);
        int j0 = V-4;
	newPoint(j0,(vtcs[i1][0]+vtcs[i2][0])/2,
		 (vtcs[i1][1]+vtcs[i2][1])/2,
		 (vtcs[i1][2]+vtcs[i2][2])/2);
        int j1 = V-3;
	newPoint(j1,(vtcs[i0][0]+vtcs[i2][0])/2,
		 (vtcs[i0][1]+vtcs[i2][1])/2,
		 (vtcs[i0][2]+vtcs[i2][2])/2);
        int j2 = V-2;
	newPoint(j2,(vtcs[i1][0]+vtcs[i0][0])/2,
		 (vtcs[i1][1]+vtcs[i0][1])/2,
		 (vtcs[i1][2]+vtcs[i0][2])/2);
        int j3 = V-1;   
	newPoint(j3,(vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0])/3,
		 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1])/3,
		 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2])/3);
        int toadd = 0;
        int[][] newTets = new int[N][4];
        int[] prs = new int[N];
        for (int t = 0; t < N; t++) {
	    int present = 0;
            if (inTet(i0,t)) {present++;}
            if (inTet(i1,t)) {present++;}
            if (inTet(i2,t)) {present++;}
            prs[t] = present;
            if (present == 2) { toadd++; }
            if (present == 3) { toadd += 11; }
	    for (int j = 0; j < 4; j++) {
		newTets[t][j] = tets[t][j];
	    }
	}
        N += toadd;
        tets = new int[N][4];
        int count = 0;
        for (int t = 0; t < N - toadd; t++) {
            int present = prs[t];
	    if (present < 2) {
		newTet(count,newTets[t][0],newTets[t][1],newTets[t][2],newTets[t][3]);
                count++;
	    }
            else {
                int k0 = -1;
                int k1 = -1;
                int k2 = -1;
                int k3 = -1;
                int k4 = -1;
                int s0 = newTets[t][0];
                int s1 = newTets[t][1];
                int s2 = newTets[t][2];
                int s3 = newTets[t][3];
		if (present == 2) {
		    if (i0 == s0 && i1 == s1) {
			k0 = i0;
                        k1 = i1;
                        k2 = s2;
                        k3 = s3;
                        k4 = j2;
		    }
                    else if (i0 == s0 && i1 == s2) {
			k0 = i0;
                        k1 = i1;
                        k2 = s1;
                        k3 = s3;
                        k4 = j2;
		    }
                    else if (i0 == s0 && i1 == s3) {
			k0 = i0;
                        k1 = i1;
                        k2 = s1;
                        k3 = s2;
                        k4 = j2;
		    }
                    else if (i0 == s1 && i1 == s2) {
			k0 = i0;
                        k1 = i1;
                        k2 = s0;
                        k3 = s3;
                        k4 = j2;
		    }
                    else if (i0 == s1 && i1 == s3) {
			k0 = i0;
                        k1 = i1;
                        k2 = s0;
                        k3 = s2;
                        k4 = j2;
		    }
                    else if (i0 == s2 && i1 == s3) {
			k0 = i0;
                        k1 = i1;
                        k2 = s0;
                        k3 = s1;
                        k4 = j2;
		    }
		    else if (i0 == s0 && i2 == s1) {
			k0 = i0;
                        k1 = i2;
                        k2 = s2;
                        k3 = s3;
                        k4 = j1;
		    }
                    else if (i0 == s0 && i2 == s2) {
			k0 = i0;
                        k1 = i2;
                        k2 = s1;
                        k3 = s3;
                        k4 = j1;
		    }
                    else if (i0 == s0 && i2 == s3) {
			k0 = i0;
                        k1 = i2;
                        k2 = s1;
                        k3 = s2;
                        k4 = j1;
		    }
                    else if (i0 == s1 && i2 == s2) {
			k0 = i0;
                        k1 = i2;
                        k2 = s0;
                        k3 = s3;
                        k4 = j1;
		    }
                    else if (i0 == s1 && i2 == s3) {
			k0 = i0;
                        k1 = i2;
                        k2 = s0;
                        k3 = s2;
                        k4 = j1;
		    }
                    else if (i0 == s2 && i2 == s3) {
			k0 = i0;
                        k1 = i2;
                        k2 = s0;
                        k3 = s1;
                        k4 = j1;
		    }
		    else if (i1 == s0 && i2 == s1) {
			k0 = i1;
                        k1 = i2;
                        k2 = s2;
                        k3 = s3;
                        k4 = j0;
		    }
                    else if (i1 == s0 && i2 == s2) {
			k0 = i1;
                        k1 = i2;
                        k2 = s1;
                        k3 = s3;
                        k4 = j0;
		    }
                    else if (i1 == s0 && i2 == s3) {
			k0 = i1;
                        k1 = i2;
                        k2 = s1;
                        k3 = s2;
                        k4 = j0;
		    }
                    else if (i1 == s1 && i2 == s2) {
			k0 = i1;
                        k1 = i2;
                        k2 = s0;
                        k3 = s3;
                        k4 = j0;
		    }
                    else if (i1 == s1 && i2 == s3) {
			k0 = i1;
                        k1 = i2;
                        k2 = s0;
                        k3 = s2;
                        k4 = j0;
		    }
                    else if (i1 == s2 && i2 == s3) {
			k0 = i1;
                        k1 = i2;
                        k2 = s0;
                        k3 = s1;
                        k4 = j0;
		    }
                    else {
			fishy = true;
                        mess("PS 6 split error 3");
		    }
		    newTet(count,k0,k2,k3,k4); count++;
		    newTet(count,k1,k2,k3,k4); count++;
		}
                else {
                    int k = -1;
		    if (s0 != i0 && s0 != i1 && s0 != i2) {
			k = s0;
		    }
		    else if (s1 != i0 && s1 != i1 && s1 != i2) {
			k = s1;
		    }
		    else if (s2 != i0 && s2 != i1 && s2 != i2) {
			k = s2;
		    }
		    else if (s3 != i0 && s3 != i1 && s3 != i2) {
			k = s3;
		    }
                    else {
			fishy = true;
                        mess("PS 6 split error 3");
		    }
                    newTet(count,j2,i1,u1,k);count++;
                    newTet(count,u1,i1,j0,k);count++;
                    newTet(count,j2,u1,j3,k);count++;
                    newTet(count,j3,u1,j0,k);count++;
                    newTet(count,u2,j3,j0,k);count++;
                    newTet(count,u2,j0,i2,k);count++;
                    newTet(count,i2,j1,u2,k);count++;
                    newTet(count,j1,j3,u2,k);count++;
                    newTet(count,j1,u0,j3,k);count++;
                    newTet(count,j1,u0,i0,k);count++;
                    newTet(count,u0,i0,j2,k);count++;
                    newTet(count,j3,j2,u0,k);count++;
		}
	    }
	}
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined PS 12";
        prepare();
        newRefine();
    }


    void fp(int face, int edge) {

        /* In the face 012 common to tetrahedra 0123 and 0124 split the edge
	   01 by the plane spanned by vertices 2, 3, 4, if possible 
	   j0,j1,j2,j3,j4  logical indices 0, 1, 2, 3, 4
	   i0,i1,i2,i3,i4  physical vertex indices
	   edge: determines which edge of face face to split
	   e: edge 01
        */

        boolean canDo = true;

        if (face >= TI) {
	    canDo = false;
	}
        else {
	    int j0 = -1;
	    int j1 = -1;
	    int j2 = -1;
	    int j3 = 3;
	    int j4 = 4;
	    if (edge == 0) {
		j0 = 1;
		j1 = 2;
		j2 = 0;
	    }
	    else if (edge == 1) {
		j0 = 0;
		j1 = 2;
		j2 = 1;
	    }
	    else if (edge == 2) {
		j0 = 0;
		j1 = 1;
		j2 = 2;
	    }
	    int i0 = tv.Config.faces[face][j0];
	    int i1 = tv.Config.faces[face][j1];
	    int i2 = tv.Config.faces[face][j2];
	    int i3 = tv.Config.faces[face][j3];
	    int i4 = tv.Config.faces[face][j4];
	    int e = tv.Config.findEdge(i0,i1);
	    geometry();
	    int c0 = tv.Config.bcs[face][j0];
	    int c1 = tv.Config.bcs[face][j1];
	    int c2 = tv.Config.bcs[face][j2];
	    int c3 = tv.Config.bcs[face][j3];
	    int q = tv.Config.bcs[face][4];
	    int denom = q-c2-c3;
	    int alpha = 0;
	    if (denom == 0) {
		canDo = false;
	    }
	    if (canDo) {
		alpha = c0;
		if (denom < 0) {
		    denom = -denom;
		    alpha = -alpha;
		}
		if (alpha <= 0 || alpha >= denom) {
		    canDo = false;
		}
	    }
	    if (canDo) {
		int[][] newVtcs = new int[V][3];
		for (int i = 0; i < V; i++) {
		    for (int j = 0; j < 3; j++) {
			newVtcs[i][j] = denom*vtcs[i][j];
		    }
		}
		vtcs = new int[V+1][3];
		for (int i = 0; i < V; i++) {
		    for (int j = 0; j < 3; j++) {
			vtcs[i][j] = newVtcs[i][j];
		    }
		}
		V++;
		int beta = denom-alpha;
		newPoint(V-1,(alpha*vtcs[i0][0]+beta*vtcs[i1][0])/denom,
			 (alpha*vtcs[i0][1]+beta*vtcs[i1][1])/denom,
			 (alpha*vtcs[i0][2]+beta*vtcs[i1][2])/denom);
		int[][] newTets = new int[2*N][4];
		int count = 0;
		for (int t = 0; t < N; t++) {
		    if (inTet(i0,t) && inTet(i1,t)) {
			i2 = -1;
			i3 = -1;
			for (int j = 0; j < 4; j++) {
			    if (tets[t][j] != i0 && tets[t][j] != i1) {
				if (i2 < 0) {
				    i2 = tets[t][j];
				}
				else {
				    i3 = tets[t][j];
				}
			    }
			}
			newTets[count][0] = i2;
			newTets[count][1] = i3;
			newTets[count][2] = i0;
			newTets[count][3] = V-1;
			count++;
			newTets[count][0] = i2;
			newTets[count][1] = i3;
			newTets[count][2] = i1;
			newTets[count][3] = V-1;
			count++;
		    }
		    else {
			newTets[count][0] = tets[t][0];
			newTets[count][1] = tets[t][1];
			newTets[count][2] = tets[t][2];
			newTets[count][3] = tets[t][3];
			count++;
		    }
		}
		N = count;
		tets = new int[N][4];
		for (int i = 0; i < N; i++) {
		    int k0 = newTets[i][0];
		    int k1 = newTets[i][1];
		    int k2 = newTets[i][2];
		    int k3 = newTets[i][3];
		    newTet(i,k0,k1,k2,k3);
		}
		configuration = 0;
		loaded = true;
		tv.TV.configuration.select(0);
		title = "refined edge cut " + config.pasts;
		prepare();
		newRefine();
	    }
	}
        if (!canDo) {
	    mess("cannot cut edge");
	}
    }

    void allCT() {
	/* split all tetrahedra into CT */
        named = false;
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 4*vtcs[i][j];
	    }
	}
        vtcs = new int[V+N][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int Vcount = V;
        int Tcount = 0;
        int[][] newTets = new int[N][4];
        for (int i = 0; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	}
        tets = new int[4*N][4];
        V = V+N;
        N = 4*N;
        for (int i = 0; i < N/4; i++) {
	    int i0 = newTets[i][0];
	    int i1 = newTets[i][1];
	    int i2 = newTets[i][2];
	    int i3 = newTets[i][3];
            int i4 = Vcount;
            newPoint(Vcount,
		     (vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0]+vtcs[i3][0])/4,
		     (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1]+vtcs[i3][1])/4,
		     (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2]+vtcs[i3][2])/4);
            Vcount++;
            newTet(Tcount,i4,i1,i2,i3); Tcount++;
            newTet(Tcount,i0,i4,i2,i3); Tcount++;
            newTet(Tcount,i0,i1,i4,i3); Tcount++;
            newTet(Tcount,i0,i1,i2,i4); Tcount++;
	}
        configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined all CT";
        prepare();
        newRefine();
    }

    void ShadeFaces() {
        Color old = g.getColor();
        int alpha = select.alpha;
	g.setColor(new Color(127,127,255,alpha));
	oG.setColor(new Color(127,127,255,alpha));
        for (int f = 0; f < T; f++) {
            if (shadeFaces[f]) {
		Polygon p = new Polygon();
		for (int j = 0; j < 3; j++) {
		    p.addPoint(dpInt[vs[faces[f][j]]][0],dpInt[vs[faces[f][j]]][1]);
		}
		g.fillPolygon(p);
		oG.fillPolygon(p);
	    }
	}
	g.setColor(old);
	oG.setColor(old);
    }

    void ps() {
        try {
	    float[] rgb;
	    String s = tv.TV.Postscript.name.getText()+".ps";
            write(" writing " + s);
	    PrintWriter out = new PrintWriter(new FileOutputStream(s));	// 
            out.println("%!PS-Adobe-2.0");
            out.println("% 3DMDS " + tv.banner);
            out.println("% " + title + " r = " + r + " d = " + d);
            out.println("% ");
            int aspect = tv.TV.Postscript.aspect.getSelectedIndex();
	    if (aspect == 0) { // full letter size
		xps = 72*17/2;
		yps = 72*11;
	    }
            else if (aspect == 1) { // screen on letter
                int h = tv.Config.getSize().height;
                int w = tv.Config.getSize().width;
                double a = ((double) h)/((double) w);
		double p = ((double) 792)/((double) 612);
                if (a > p) {
		    yps = 792;
                    xps = (int) (792.0/a);
		}
                else {
                    xps = 612;
                    yps = (int) (xps*a);
		}
	    }
            else if (aspect == 2) { // screen
		xps = tv.Config.getSize().width;
		yps = tv.Config.getSize().height;
	    }
            else if (aspect == 3) { // square letter
		xps = 72*17/2;
                yps = 72*17/2;
	    }
            else if (aspect == 4) { // legal
		xps = 72*17/2;
                yps = 72*11;
	    }
            else if (aspect == 5) { // 11x17
		xps = 72*11;
                yps = 72*17;
	    }
            else if (aspect == 6) { // 17x22
		xps = 72*17;
                yps = 72*22;
	    }
            else if (aspect == 7) { // A4
		xps = 595;
                yps = 842;
	    }
            if (tv.TV.Postscript.Gray) {
		out.println(" /sc { add add 3 div setgray } def");
                out.println("% to see this image in glorious color uncomment the following line ");
		out.println("% /sc { setrgbcolor } def");
	    }
            else {
		out.println("/sc { setrgbcolor } def");
                out.println("% If you must have this image in Gray Scale uncomment the following line and comment the preceding line ");		
		out.println("% /sc { add add 3 div setgray } def");
	    }
	    out.println("%% ps range = " + xps + "x" +yps);
            out.println("%% defining shortcuts:");
	    out.println("/A { arc } def");
	    out.println("/C { closepath } def");
	    out.println("/F { fill } def");
	    out.println("/L { lineto } def");
	    out.println("/M { moveto } def");
	    out.println("/N { newpath } def");
	    out.println("/sd { setdash } def");
	    out.println("/S { stroke } def");
	    out.println("/slw { setlinewidth } def");
	    out.println("/ff { findfont } def");
	    out.println("/sf { setfont } def");
	    out.println("/scf { scalefont } def");
	    out.println("%% setting background ");
            psDrawIt(out);
            out.println("showpage");
            out.println("% the end ");
            out.close(); 
	}
        catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	}
        catch(java.io.IOException e) {
	    write(" IOException " + e);
	}
    }

    double psx(int x) {
	return  ((double) x)/((double) this.getSize().width) *xps;
    }
  
    double psy(int y) {
	return yps - ((double) y)/((double) this.getSize().height)*yps;
    }

    String ps(double x) {
	DecimalFormat dfl = new DecimalFormat("####.00");
	return " " + dfl.format(x);
    }
  
    void psDrawEdges(PrintWriter out) {
        out.println("%% drawing edges ... ");
        line[] lines = new line[E];
        line.p[0] = Q[0][0];
        line.p[1] = Q[1][0];
        line.p[2] = Q[2][0];
	for (int i = 0; i < E; i++) {
	    if (drawThis(edges[i][0],edges[i][1])) {
		lines[i] = new line(dpInt[vs[edges[i][0]]][0],dpInt[vs[edges[i][0]]][1],dpInt[vs[edges[i][1]]][0],dpInt[vs[edges[i][1]]][1],
				    dpDouble[vs[edges[i][0]]][0],dpDouble[vs[edges[i][0]]][1],dpDouble[vs[edges[i][0]]][2],
				    dpDouble[vs[edges[i][1]]][0],dpDouble[vs[edges[i][1]]][1],dpDouble[vs[edges[i][1]]][2]);
		lines[i].dashed = dEdges[i];
	    }
	}
        if (hidden) {
	    for (int i=0; i< E; i++) {
		if (drawThis(edges[i][0],edges[i][1])) {
		    for (int j = i+1; j < E; j++) {
			if (drawThis(edges[j][0],edges[j][1])) {
			    lines[i].intersect(lines[i],lines[j]);
			}
		    }
		}
	    }
	}
	for (int i=0; i < E; i++) {
	    if (drawThis(edges[i][0],edges[i][1])) {
		lines[i].psDraw(out,edgeColor[i],2);
	    }
	}
        out.println("[] 0 sd ");
    }


    void psDrawIt(PrintWriter out) {
	facesPresent = false;
	boolean someDps = false;
	width = getSize().width;
	height = getSize().height;
	xrange = xmax - xmin; 
	yrange = ymax - ymin;
	out.println("%% ps range = " + xps + "x" +yps);
	for (int i = 0; i < nDps; i++) {
	    int dpx = (int)  ((dpFlat[i][0]-xmin)/xrange*width);
	    int dpy = (int)  ((dpFlat[i][1]-ymin)/yrange*height);
	    dpInt[i][0] = dpx;
	    dpInt[i][1] = dpy;
	    if (dpx > 0 && dpx < width && dpy > 0 && dpy < height) {
		someDps = true;
	    }
	}
	if (someDps) {
	    coordsDrawn = false;
	    if (fishy) {
		BG = new Color(150,150,150);
	    }
	    else if (selectSuper) {
		BG = new Color(210,230,255);
	    }
	    else if (selectSpecial) {
		BG = new Color(255,220,250);
	    }
	    else {
		int action = tv.globs.getSelectedIndex();
		if (action == 0) {
		    BG = BGdefault;
		}
		else {
		    BG = new Color(240,255,230);
		}
	    }
	    String bg = "N " + psColor(BG);
	    bg = bg + " 0 0 M 0 " + yps + " L " + xps + " " + yps + " L " + xps  + " 0 L C F ";
	    out.println(bg);
	    if (tv.showGrid) {
		psDrawGrid(out);
	    }
	    psShadeFaces(out);
	    psDrawEdges(out);
	    psDrawSuper(out);
	    psDrawSpecial(out);
	    if (facesPresent && tv.showGrid) {
		psDrawGrid(out);
	    }
	    Diameter = tv.diameter;
	    int diameter = Diameter;
	    for (int k = 0; k < nDps; k++) {
		int i = sortedDps[k];
		psDrawP(out, i);
	    }
	    if (tv.labelVtcs) {
		for (int i = 0; i < V; i++) {
		    if (drawThisVtx(i)) {
			out.println(psThisVtx(i));
		    }
		}
	    }
	}
    }

    void addPs(String s) {
        try {
	    String backup = tv.fileName.getText() + ".pre.ps";
	    PrintWriter Out = new PrintWriter(new FileOutputStream(backup));
	    String file = tv.fileName.getText() + ".ps";
	    FileInputStream is = new FileInputStream(file);
	    BufferedReader In = new BufferedReader(new InputStreamReader(is));
	    String line = In.readLine().trim();
	    Out.println(line);	    
            while (line != null) {
		try {
		    line = In.readLine().trim();
		    Out.println(line);
		}
		catch(java.lang.NullPointerException e) {
		    line = null;
		}                
	    }
	    In.close();
            Out.close();
	    backup = tv.fileName.getText() + ".ps";
	    Out = new PrintWriter(new FileOutputStream(backup));
	    file = tv.fileName.getText() + ".pre.ps";
	    is = new FileInputStream(file);
	    In = new BufferedReader(new InputStreamReader(is));
	    line = In.readLine().trim();
            Out.println(line);
            String lastline = "";
            while (line != null) {
		try {
		    line = In.readLine().trim();
		    if (line.indexOf("showpage") < 0) {
			Out.println(line);
		    }
		    else {
			lastline = line;                  
		    }
		}
		catch(java.lang.NullPointerException e) {
		    line = null;
		}                
	    }
	    Out.println(s);
	    Out.println(lastline);
            Out.close();
            In.close();
	}
	catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	}
	catch(java.io.IOException e) {
	    write(" IOException " + e);
	}
    }

    String psColor(Color c) {
	float[] rgb = new float[3];
	c.getColorComponents(rgb);
	return ps(rgb[0]) + " " + ps(rgb[1]) + " " + ps(rgb[2]) + " sc ";
    }

    void psShadeFaces(PrintWriter out) {
        int alpha = select.alpha;
        double rgb = 1.0- (((double) alpha)/255.0/2);
	double rgb2 = 1.0- (((double) alpha)/255.0/6);
        String s = "N " + ps(rgb) + ps(rgb) + ps(rgb2) + " sc";
        out.println(s + " % shading faces");
        for (int f = 0; f < T; f++) {
            if (shadeFaces[f]) {
                facesPresent = true;
                s = ps(psx(dpInt[vs[faces[f][0]]][0])) + ps(psy(dpInt[vs[faces[f][0]]][1])) + " M ";
                s = s + ps(psx(dpInt[vs[faces[f][1]]][0])) + ps(psy(dpInt[vs[faces[f][1]]][1])) + " L ";
                s = s + ps(psx(dpInt[vs[faces[f][2]]][0])) + ps(psy(dpInt[vs[faces[f][2]]][1])) + " L C F ";
                out.println(s);
	    }
	}
    }

    void psDrawSuper(PrintWriter out) {
        if (SuperPresent) {
            out.println("%% drawing super conditions ");
            out.println(" 2 slw");        
	    facesPresent = false;
	    for (int i = 0; i < nSuper; i++) {
		int kind = superConds[i][0];
		int which = superConds[i][1];
		int degree = superConds[i][2];
                String s = "N ";
		if (kind == 3) {
		    if (degree == r+1) {
			s = s + psColor(new Color(255,200,200));
		    }
		    else if (degree == r+2) {
			s = s + psColor(new Color(255,175,175));
		    }
		    else if (degree == r+3) {
			s = s + psColor(new Color(255,150,150));
		    }
		    else if (degree == r+4) {
			s = s + psColor(new Color(255,125,125));
		    }
		    else  {
			s = s + psColor(new Color(255,100,Alpha));
		    }
		    s = s + ps(psx(dpInt[vs[faces[which][0]]][0])) + ps(psy(dpInt[vs[faces[which][0]]][1])) + " M ";
		    s = s + ps(psx(dpInt[vs[faces[which][1]]][0])) + ps(psy(dpInt[vs[faces[which][1]]][1])) + " L ";
		    s = s + ps(psx(dpInt[vs[faces[which][2]]][0])) + ps(psy(dpInt[vs[faces[which][2]]][1])) + " L C F ";
		    out.println(s);
		    facesPresent = true;
		}
	    }
	    if (facesPresent) {
		psDrawEdges(out);
	    }
	    for (int i = 0; i < nSuper; i++) {
		int kind = superConds[i][0];
		int which = superConds[i][1];
		int degree = superConds[i][2];
		if (kind == 1 && Diameter > 0) {
		    if (drawThisVtx(which)) {
			String sx = ps(psx(dpInt[vs[which]][0]));
			String sy = ps(psy(dpInt[vs[which]][1]));
                        out.println("1 0 0 sc ");
			int diameter = Diameter/2;
			for (int j = r; j < degree; j++) {
			    int R = diameter + 6*j;
			    out.println(sx + " " + sy + " " + R + " 0 360 A S");
			}
		    }
		}
		else if (kind == 2) {
                    if (drawThis(edges[which][0],edges[which][1])) {
			int x0 = dpInt[vs[edges[which][0]]][0];
			int y0 = dpInt[vs[edges[which][0]]][1];                
			int x1 = dpInt[vs[edges[which][1]]][0];
			int y1 = dpInt[vs[edges[which][1]]][1];                
                        out.println(" 1 0 0 sc ");
			psLine(out,x0,y0,x1,y1);               
			if (degree > r+1) {
			    int z0 = y0-y1;
			    int z1 = x1-x0;
			    double s = sqrt(z0*z0+z1*z1);
			    z0 = (int) ((double)(8*z0)/s);
			    z1 = (int) ((double)(8*z1)/s);
			    for (int k = 2; k <= degree-r; k++) {
				int parity = k%2;
				int dist = (k-parity)/2;
				int sign = 2*parity - 1;
				int X0 = x0 + dist*sign*z0;
				int X1 = x1 + dist*sign*z0;
				int Y0 = y0 + dist*sign*z1;
				int Y1 = y1 + dist*sign*z1;
				psLine(out, X0,Y0,X1,Y1);
			    }
			}                 
		    }
		}
	    }
	}
        if (SpecialPresent || selectSpecial) {
  	    for (int i = 0; i < nSpecial; i++) {
		drawSpecial(i);
	    }
	}
    }


    void psDrawSpecial(PrintWriter out) {
        for (int i = 0; i < nSpecial; i++) {
	    psDrawSpecial(out, i);
	}
    }

    void psDrawSpecial (PrintWriter out, int i) {
        out.println("%% drawing special conditions ");
        out.println("2 slw");
        int face = specialConds[i][0];
        int w = specialConds[i][1];
        boolean duplicated = false;
        int j0 = faces[face][0]; int i0 = dps[w][j0];
        int j1 = faces[face][1]; int i1 = dps[w][j1];
        int j2 = faces[face][2]; int i2 = dps[w][j2];
        int j3 = faces[face][3]; int i3 = dps[w][j3];
        int j4 = faces[face][4]; int i4 = dps[w][j4];
        int degree = max(i3,i4);
        int tet3 = tetrahedron(j0,j1,j2,j3);
        int tet4 = tetrahedron(j0,j1,j2,j4);
        boolean oriented = true;
        if (dps[w][j3] > 0) {
	    oriented = false;
	}
        int p0 = identify(j0,i0+degree, j1,i1, j2,i2, j3,0);
        int p1 = identify(j0,i0, j1,i1+degree, j2,i2, j3,0);
        int p2 = identify(j0,i0, j1,i1, j2,i2+degree, j3,0);
        int p3 = identify(j0,i0, j1,i1, j2,i2, j3,degree);
        int p4 = identify(j0,i0, j1,i1, j2,i2, j4,degree);
        for (int j = 0; j < i; j++) {
	    if (specialConds[j][0] == face) {
		if ( (!oriented && specialConds[j][1] == p4) ||
		     (oriented && specialConds[j][1] == p3)) {
		    duplicated = true;
                    j = i;
		}
	    }
	}
        out.println(psColor(new Color(255,0,255)));
        psDrawLine(out,p0,p1);
        psDrawLine(out,p1,p2);
        psDrawLine(out,p2,p0);
        if (!duplicated) {
	    if (oriented) {
		out.println(psColor(new Color(255,175,255)));
	    }
	    else {
		out.println(psColor(new Color(255,75,255)));
	    }
	}
        psDrawLine(out,p0,p3);
        psDrawLine(out,p1,p3);
        psDrawLine(out,p2,p3);
        if (!duplicated) {
	    if (oriented) {
		out.println(psColor(new Color(255,175,255)));
	    }
	    else {
		out.println(psColor(new Color(255,75,255)));
	    }
	}
        psDrawLine(out,p0,p4);
        psDrawLine(out,p1,p4);
        psDrawLine(out,p2,p4);
    }
 
    void psDrawLine(PrintWriter out, int i, int j) {
	psLine(out, dpInt[i][0], dpInt[i][1], dpInt[j][0], dpInt[j][1]);
    }

    void psGridLine(PrintWriter out, int n, int i0, int i1, int i2, int i3, int j0,int j1, int j2, int j3) {
	int i = findIndex(n,i0,i1,i2,i3);
	int j = findIndex(n,j0,j1,j2,j3);
        String s = "N " + ps(psx(dpInt[i][0])) + ps(psy(dpInt[i][1])) + " M " + ps(psx(dpInt[j][0])) + ps(psy(dpInt[j][1])) +  " L S";
        out.println(s);
    }

    void psDrawGrid(PrintWriter out) {
	if (tv.showGrid) {
	    out.println("%% drawing grid ... ");
	    out.println(psColor(new Color(180,180,255))+ " 0.5 slw % modify for visibility");
	    for (int n = 0; n < N; n++) {
                if (drawThis(n)) {
		    for (int i = 0; i <=d; i++) {
			for (int j = 0; j <= d-i; j++) {
			    int k = d-i-j;
			    if (i != d && j !=d && k != d) {
				psGridLine(out, n, i,j,k,0, i,j,0,k);
				psGridLine(out, n, i,j,k,0, i,0,k,j);
				psGridLine(out, n, i,j,k,0, 0,j,k,i);
				psGridLine(out, n, i,j,0,k, i,0,j,k);
				psGridLine(out, n, i,j,0,k, 0,j,i,k);
				psGridLine(out, n, i,0,j,k, 0,i,j,k);
			    }
			}
		    }
		}
	    }
	}
    }
 
    void psDrawP(PrintWriter out,int i) {
        if (Diameter > 0) {
	    String s = "N ";
	    String sx = ps(psx(dpInt[i][0]));
	    String sy = ps(psy(dpInt[i][1]));
            double diameter = ((double) Diameter*max(width,height))/xps/2;
	    if (dps[i][V+2] == 1) { 
		if (dps[i][V+1] > 0) { 
		    int location = dps[i][V]; 
		    diameter = ((double) Diameter*xps)/((double) width)/2;
		    if (dps[i][V+1] == 1) {
                        s = s + psColor(uncertain[location]);
		    }
		    else if (dps[i][V+1] == 2) {
			s = s + psColor(inMDS[location]);
		    }
		    else if (dps[i][V+1] == 3) {
			s = s + psColor(implied[location]);
		    }
		    else if (dps[i][V+1] == 4) {
			s = s + psColor(strongly);
		    }
		    else {
			write (" unknown status: " + i);
		    }
		} 
		else {
		    s = s + psColor(colInactive); 
		    diameter = 3; 
		}
		s = s + sx + " " + sy + ps(diameter) + " 0 360 A F ";
		s = s + " 0 0 0 sc ";
		s = s + sx + " " + sy + ps(diameter) + " 0 360 A S ";
		out.println(s);
		if (numbers) {
		    s = psColor(new Color(100,100,0)) + " /Times-Bold ff 10 scf sf " + sx + " " + sy + " M (" + i + ") show ";
                    out.println(s);
		}
	    } 
	}
    }
   
    void psLine(PrintWriter out, int x0, int y0, int x1, int y1) {
        out.println("N " + ps(psx(x0)) + ps(psy(y0)) + " M " + ps(psx(x1)) + ps(psy(y1)) + " L S ");
    }

    String psThisVtx(int i) {
	return psColor(vC[i]) + 
	    ps(psx(dpInt[vs[i]][0]+10)) + ps(psy(dpInt[vs[i]][1]-10)) +
	    " M /Times-Bold ff 24 scf sf (" + nameV(i) + ") show ";
    }


    String cName(int j) {
        int mode = tv.cMode.getSelectedIndex();
        return cName(j,mode);
    }
 
    String cName(int j, int mode) {
	String result = "c";
        if (mode == 0) {
	    for (int k = 0; k < V; k++) {
		int idx = dps[j][k];
		if (idx < 10) {
		    result = result + idx;
		}
		else {
		    if (k == 0) {
			result = result + idx + ",";
		    }
		    else {
			result = result + "," + idx + ",";
		    }
		}
	    }
	}
        else if (mode == 1) {
	    int zero = 0;
	    for (int k = 0; k < V; k++) {
		int idx = dps[j][k];
		if (idx == 0) {
		    zero++;
		}
		else {
		    if (zero > 0) {
			if (zero == 1) {
			    result = result + "0";
			}
			else if (zero == 2) {
			    result = result + "00";
			}
			else {
			    result = result + "[" +zero +"]";
			}
			zero = 0;
		    }
		    if (idx < 10) {
			result = result + idx;
		    }
		    else {
			if (k == 0) {
			    result = result + idx + ",";
			}
			else {
			    result = result + "," + idx + ",";
			}
			
		    }
		}
	    }
	    if (zero > 0) {
		if (zero == 1) {
		    result = result + "0";
		}
		else if (zero == 2) {
		    result = result + "00";
		}
		else {
		    result = result + "[" +zero +"]";
		}
	    }
	}
        else if  (mode == 2) {
	    result = result + j;
	}
        else if (mode == 3) {
            String sub = "";
            String sup = "";
	    boolean first = true;
	    for (int k = 0; k < V; k++) {
		int idx = dps[j][k];
		if (idx != 0) {
		    if (!first) {
			sup = sup + "," + nameV(k);
			sub = sub + "," + idx;
		    }
		    else {
			sup = sup + nameV(k);
			sub = sub + idx;
                        first = false;
		    }
		}
	    }
	    sub = "{"+sub+"}";
	    sup = "{"+sup+"}";
	    result = result + "_" + sub + "^" + sup;
	}
        return result;
    }

    String nameV(int j) {
        if (named) {
	    return vN[j];
	}
        else {
	    return "" + j;
	}
    }

    void vColor() {
        vC = new Color[V];
        vN = new String[V];
	for (int v = 0; v < V; v++) {
	    vN[v] = "" + v;
            vC[v] = new Color(0,0,128);
	}
    }

    void faceStar(int f) {
        title = " face star";
        configuration = 0;
        int i0 = faces[f][0];
        int i1 = faces[f][1];
        int i2 = faces[f][2];
        int nN = 0;
        int nV = 0;
        int[] nVtcs = new int[V];
        int[][] nTets = new int[N][4];
        for (int tau = 0; tau < N; tau++) {
	    if (inTet(i0,tau) && inTet(i1,tau) && inTet(i2,tau)) {
		for (int k = 0; k < 4; k++) {
                    int v = tets[tau][k];
		    nTets[nN][k] = v;
                    boolean nPoint = true;
                    for (int j = 0; j < nV; j++) {
			if (nVtcs[j] == v) {
                            nPoint = false;
                            j = nV;
			}
                    }
                    if (nPoint) {
			nVtcs[nV] = v;
                        nV++;
		    }
		}
		nN++;
	    }
	}
        boolean sorted = false;
        while (!sorted) {
            sorted = true;
	    for (int v = 1; v < nV; v++) {
		if (nVtcs[v-1] > nVtcs[v]) {
                    int s = nVtcs[v-1];
                    nVtcs[v-1] = nVtcs[v];
                    nVtcs[v] = s;
                    sorted = false;
		}
	    }
	}
        int[][] nVcoord = new int[nV][3];
        String[] nNameV = new String[nV];
	for (int v = 0; v < nV; v++) {
	    for (int j = 0; j < 3; j++) {
		nVcoord[v][j] = vtcs[nVtcs[v]][j];
	    }
            nNameV[v] = nameV(nVtcs[v]);
	}
        for (int tau = 0; tau < nN; tau++) {
	    for (int i = 0; i < 4; i++) {
		for (int j = 0; j < nV; j++) {
		    if (nTets[tau][i] == nVtcs[j]) {
                        nTets[tau][i] = j;
                        j = nV;
		    }
		}
	    }
	}
        N = nN;
        V = nV;
        vN = new String[V];
        for (int tau = 0; tau < N; tau++) {
	    newTet(tau, nTets[tau][0], nTets[tau][1], nTets[tau][2], nTets[tau][3]);
  	}
        for (int v = 0; v < V; v++) {
            newPoint(v, nVcoord[v][0], nVcoord[v][1], nVcoord[v][2]);
            vN[v] = nNameV[v];
	}
        loaded = true;
        named = true;
        prepare();	
        named = false;	
    }

    void edgeStar(int f) {
        title = " edge star";
        configuration = 0;
        int i0 = edges[f][0];
        int i1 = edges[f][1];
        int nN = 0;
        int nV = 0;
        int[] nVtcs = new int[V];
        int[][] nTets = new int[N][4];
        for (int tau = 0; tau < N; tau++) {
	    if (inTet(i0,tau) && inTet(i1,tau)) {
		for (int k = 0; k < 4; k++) {
                    int v = tets[tau][k];
		    nTets[nN][k] = v;
                    boolean nPoint = true;
                    for (int j = 0; j < nV; j++) {
			if (nVtcs[j] == v) {
                            nPoint = false;
                            j = nV;
			}
                    }
                    if (nPoint) {
			nVtcs[nV] = v;
                        nV++;
		    }
		}
		nN++;
	    }
	}
        boolean sorted = false;
        while (!sorted) {
            sorted = true;
	    for (int v = 1; v < nV; v++) {
		if (nVtcs[v-1] > nVtcs[v]) {
                    int s = nVtcs[v-1];
                    nVtcs[v-1] = nVtcs[v];
                    nVtcs[v] = s;
                    sorted = false;
		}
	    }
	}
        int[][] nVcoord = new int[nV][3];
        String[] nNameV = new String[nV];
	for (int v = 0; v < nV; v++) {
	    for (int j = 0; j < 3; j++) {
		nVcoord[v][j] = vtcs[nVtcs[v]][j];
	    }
            nNameV[v] = nameV(nVtcs[v]);
	}
        for (int tau = 0; tau < nN; tau++) {
	    for (int i = 0; i < 4; i++) {
		for (int j = 0; j < nV; j++) {
		    if (nTets[tau][i] == nVtcs[j]) {
                        nTets[tau][i] = j;
                        j = nV;
		    }
		}
	    }
	}
        N = nN;
        V = nV;
        vN = new String[V];
        for (int tau = 0; tau < N; tau++) {
	    newTet(tau, nTets[tau][0], nTets[tau][1], nTets[tau][2], nTets[tau][3]);
  	}
        for (int v = 0; v < V; v++) {
            newPoint(v, nVcoord[v][0], nVcoord[v][1], nVcoord[v][2]);
            vN[v] = nNameV[v];
	}
        loaded = true;
        named = true;
        prepare();	
        named = false;	
    }

    void vertexStar(int i0) {
        title = " vertex star";
        configuration = 0;
        int nN = 0;
        int nV = 0;
        int[] nVtcs = new int[V];
        int[][] nTets = new int[N][4];
        for (int tau = 0; tau < N; tau++) {
	    if (inTet(i0,tau)) {
		for (int k = 0; k < 4; k++) {
                    int v = tets[tau][k];
		    nTets[nN][k] = v;
                    boolean nPoint = true;
                    for (int j = 0; j < nV; j++) {
			if (nVtcs[j] == v) {
                            nPoint = false;
                            j = nV;
			}
                    }
                    if (nPoint) {
			nVtcs[nV] = v;
                        nV++;
		    }
		}
		nN++;
	    }
	}
        boolean sorted = false;
        while (!sorted) {
            sorted = true;
	    for (int v = 1; v < nV; v++) {
		if (nVtcs[v-1] > nVtcs[v]) {
                    int s = nVtcs[v-1];
                    nVtcs[v-1] = nVtcs[v];
                    nVtcs[v] = s;
                    sorted = false;
		}
	    }
	}
        int[][] nVcoord = new int[nV][3];
        String[] nNameV = new String[nV];
	for (int v = 0; v < nV; v++) {
	    for (int j = 0; j < 3; j++) {
		nVcoord[v][j] = vtcs[nVtcs[v]][j];
	    }
            nNameV[v] = nameV(nVtcs[v]);
	}
        for (int tau = 0; tau < nN; tau++) {
	    for (int i = 0; i < 4; i++) {
		for (int j = 0; j < nV; j++) {
		    if (nTets[tau][i] == nVtcs[j]) {
                        nTets[tau][i] = j;
                        j = nV;
		    }
		}
	    }
	}
        N = nN;
        V = nV;
        vN = new String[V];
        for (int tau = 0; tau < N; tau++) {
	    newTet(tau, nTets[tau][0], nTets[tau][1], nTets[tau][2], nTets[tau][3]);
  	}
        for (int v = 0; v < V; v++) {
            newPoint(v, nVcoord[v][0], nVcoord[v][1], nVcoord[v][2]);
            vN[v] = nNameV[v];
	}
        loaded = true;
        named = true;
        prepare();	
        named = false;	
    }

    int tets(int i0) {
        int count = 0;
        for (int i = 0; i < N; i++) {
	    if (inTet(i0,i)) {
		count++;
	    }
	}
	return count;
    }

    int tets(int i0, int i1) {
        int count = 0;
        for (int i = 0; i < N; i++) {
	    if (inTet(i0,i) && inTet(i1,i)) {
		count++;
	    }
	}
	return count;
    }

    int tets(int i0, int i1, int i2) {
        int count = 0;
        for (int i = 0; i < N; i++) {
	    if (inTet(i0,i) && inTet(i1,i) && inTet(i2,i)) {
		count++;
	    }
	}
	return count;
    }

    void reduce(boolean General) {
        boolean doit = false;
        for (int tau = 0; tau < N; tau++) {
	    if (!drawThis(tau)) {
		doit = true;
                tau = N;
	    }
	}
        if (doit) {
	    general = General;
	    title = " partial ";
	    configuration = 0;
	    int nN = 0;
	    int nV = 0;
	    int[] nVtcs = new int[V];
	    int[][] nTets = new int[N][4];
	    for (int tau = 0; tau < N; tau++) {
		if (drawThis(tau)) {
		    for (int k = 0; k < 4; k++) {
			int v = tets[tau][k];
			nTets[nN][k] = v;
			boolean nPoint = true;
			for (int j = 0; j < nV; j++) {
			    if (nVtcs[j] == v) {
				nPoint = false;
				j = nV;
			    }
			}
			if (nPoint) {
			    nVtcs[nV] = v;
			    nV++;
			}
		    }
		    nN++;
		}
	    }
	    boolean sorted = false;
	    while (!sorted) {
		sorted = true;
		for (int v = 1; v < nV; v++) {
		    if (nVtcs[v-1] > nVtcs[v]) {
			int s = nVtcs[v-1];
			nVtcs[v-1] = nVtcs[v];
			nVtcs[v] = s;
			sorted = false;
		    }
		}
	    }
	    int[][] nVcoord = new int[nV][3];
	    String[] nNameV = new String[nV];
	    for (int v = 0; v < nV; v++) {
		for (int j = 0; j < 3; j++) {
		    nVcoord[v][j] = vtcs[nVtcs[v]][j];
		}
		nNameV[v] = nameV(nVtcs[v]);
	    }
	    for (int tau = 0; tau < nN; tau++) {
		for (int i = 0; i < 4; i++) {
		    for (int j = 0; j < nV; j++) {
			if (nTets[tau][i] == nVtcs[j]) {
			    nTets[tau][i] = j;
			    j = nV;
			}
		    }
		}
	    }
	    N = nN;
	    V = nV;
	    vN = new String[V];
	    for (int tau = 0; tau < N; tau++) {
		newTet(tau, nTets[tau][0], nTets[tau][1], nTets[tau][2], nTets[tau][3]);
	    }
	    for (int v = 0; v < V; v++) {
		newPoint(v, nVcoord[v][0], nVcoord[v][1], nVcoord[v][2]);
		vN[v] = nNameV[v];
	    }
	    loaded = true;
	    named = true;
            if (!general) {
		prepare();	
	    }
            else {
		Prepare();	
	    }
	    named = false;	
	}
    }

    int edegree(int i) {
	int result = 0;
        for (int n = 0; n < N; n++) {
	    if (inTet(edges[i][0],n) && inTet(edges[i][1],n)) {
		result++;
	    }
	}
	return result;
    }

    int vdegree(int i) {
	int result = 0;
        for (int n = 0; n < N; n++) {
	    if (inTet(i,n)) {
		result++;
	    }
	}
	return result;
    }



    void cmb() {
        PrintWriter cmb = null;
        try {
            String file = tv.TV.fileName.getText()+".cmb";
	    cmb = new PrintWriter(new FileOutputStream(file));
	    cmb.println(title + " combinatorics: \n" + N + " tetrahedra: ");
	    for(int i = 0; i < N; i++) {
		cmb.println(i + ": " + vN[tets[i][0]] + "," + vN[tets[i][1]] + "," + vN[tets[i][2]] + "," + vN[tets[i][3]]);
	    }
	    cmb.println(T + " faces ");
	    cmb.println(TI + " interior faces: ");
	    for (int i = 0; i < TI; i++) {
		cmb.println (i + ": " + vN[faces[i][0]] + " " + vN[faces[i][1]] + " " + vN[faces[i][2]] + " -- " + vN[faces[i][3]] + " " + vN[faces[i][4]]);
	    }
	    cmb.println(TB + " boundary faces: ");
	    for (int i = TI; i < T; i++) {
		cmb.println (i + ": " + vN[faces[i][0]] + " " + vN[faces[i][1]] + " " + vN[faces[i][2]] + " -- " + vN[faces[i][3]]);
	    }
	    cmb.println(E + " edges");
	    cmb.println(EI + " interior edges: ");
	    for (int i = 0; i < EI; i++) {
		cmb.println(i + ": " + vN[edges[i][0]] + " " + vN[edges[i][1]] + " --- " + edegree(i)); 
	    }
	    cmb.println(EB + " boundary edges: ");   
	    for (int i = EI; i < E; i++) {
		cmb.println(i + ": " + vN[edges[i][0]] + " " + vN[edges[i][1]] + " --- " + edegree(i)); 
	    }
	    cmb.println(V + " vertices ");
	    cmb.println(VB + " boundary vertices:");
	    for (int i = 0; i< V; i++) {
		if (bVertices[i]) {cmb.println(vN[i] +" (" + vtcs[i][0]+","+ vtcs[i][1] +","+ vtcs[i][2] +")" + " --- " + vdegree(i));}
	    }
	    cmb.println(VI + " interior vertices:");
	    for (int i = 0; i < V; i++) {
		if (!bVertices[i]) {cmb.println(vN[i] +" " + vtcs[i][0] +","+ vtcs[i][1] +","+ vtcs[i][2] +")" + " --- " + vdegree(i));}
	    }
            if (!general) {
		String s = "N = " + N + ", T = " + T + ", T_B = " + TB + ", T_I = " + TI 
		    + ", E = " + E + ", E_B = " + EB + ", E_I = " + EI 
		    + ", V = " + V + ", V_B = " + VB + ", V_I = " + VI ;
		cmb.println(s);
		int a1 = 2*N-2-TI+VI;
		int a2 = TI+1-N-2*VI;
		s = "a_0 = 1, a_1 = " + a1 +", a_2 = " + a2 + ", a_3 = " + VI;
		cmb.println("shelling parameters: \n " + s);
		tv.Status.setText(s);
	    }
	    cmb.close();
        }
        catch(Exception E) { write (" writing combinatorics Error: " + E);E.printStackTrace();cmb.close();}
    }


    void allT60() {
	/* split all tetrahedra into T60 */
        int[][] newVtcs = new int[V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 36*vtcs[i][j];
	    }
	}
        vtcs = new int[11*N+T+V][3];
        for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
        int Vcount = V;
        int Tcount = 0;
        int[][] newTets = new int[60*N][4];
        for (int i = 0; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	}
        tets = new int[N*60][4];
        V = V+11*N+T;
        int oldN = N;
        N = 60*N;
        String[] nV = new String[V];
        Color[] cV = new Color[V];
        int[] centroids = new int[T];
        for (int i = 0; i < Vcount; i++) {
            nV[i] = "v"+i;
            cV[i] = new Color(0,0,0);
	}
	int v0, v1, v2, v3, u3, u2, u1, u0, u01, u02, u03, u12, u13, u23, p0, p1, p2, p3, w;
        for (int i = 0; i < T; i++) {
	    centroids[i] = -1;
	}
        for (int t = 0; t < oldN; t++) {
	    int i0 = newTets[t][0];
	    int i1 = newTets[t][1];
	    int i2 = newTets[t][2];
	    int i3 = newTets[t][3];
            v0 = i0;
            v1 = i1;
            v2 = i2;
            v3 = i3;
	    int f = whichFace(i0,i1,i2);
            if (centroids[f] == -1) {
		newPoint(Vcount,
			 (vtcs[i0][0]+vtcs[i1][0]+vtcs[i2][0])/3,
			 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i2][1])/3,
			 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i2][2])/3);
                nV[Vcount] = "u" + Vcount;
                cV[Vcount] = new Color(0,0,255);
                u3 = Vcount;
                centroids[f] = Vcount;
                Vcount++;
	    }
            else {
		u3 = centroids[f];
	    }
	    f = whichFace(i0,i1,i3);
            if (centroids[f] == -1) {
		newPoint(Vcount,
			 (vtcs[i0][0]+vtcs[i1][0]+vtcs[i3][0])/3,
			 (vtcs[i0][1]+vtcs[i1][1]+vtcs[i3][1])/3,
			 (vtcs[i0][2]+vtcs[i1][2]+vtcs[i3][2])/3);
                centroids[f] = Vcount;
                nV[Vcount] = "u" + Vcount;
                cV[Vcount] = new Color(0,0,255);
                u2 = Vcount;
                Vcount++;
	    }
            else {
		u2 = centroids[f];
	    }
	    f = whichFace(i0,i2,i3);
            if (centroids[f] == -1) {
		newPoint(Vcount,
			 (vtcs[i0][0]+vtcs[i2][0]+vtcs[i3][0])/3,
			 (vtcs[i0][1]+vtcs[i2][1]+vtcs[i3][1])/3,
			 (vtcs[i0][2]+vtcs[i2][2]+vtcs[i3][2])/3);
                nV[Vcount] = "u" + Vcount;
                cV[Vcount] = new Color(0,0,255);
                u1 = Vcount;
                centroids[f] = Vcount;
                Vcount++;
	    }
            else {
		u1 = centroids[f];
	    }
	    f = whichFace(i1,i2,i3);
            if (centroids[f] == -1) {
		newPoint(Vcount,
			 (vtcs[i1][0]+vtcs[i2][0]+vtcs[i3][0])/3,
			 (vtcs[i1][1]+vtcs[i2][1]+vtcs[i3][1])/3,
			 (vtcs[i1][2]+vtcs[i2][2]+vtcs[i3][2])/3);
                nV[Vcount] = "u" + Vcount;
                cV[Vcount] = new Color(0,0,255);
                u0 = Vcount;
                centroids[f] = Vcount;
                Vcount++;
	    }
            else {
		u0 = centroids[f];
	    }
            u01 = Vcount; Vcount++;
            newPoint(u01,(vtcs[u0][0]+vtcs[u1][0])/2,
		     (vtcs[u0][1]+vtcs[u1][1])/2,
		     (vtcs[u0][2]+vtcs[u1][2])/2);
	    nV[u01] = "u"+u0+"."+u1;
            cV[u01] = new Color(0,255,0);
            u02 = Vcount; Vcount++;
            newPoint(u02,(vtcs[u0][0]+vtcs[u2][0])/2,
		     (vtcs[u0][1]+vtcs[u2][1])/2,
		     (vtcs[u0][2]+vtcs[u2][2])/2);
	    nV[u02] = "u"+u0+"."+u2;
            cV[u02] = new Color(0,255,0);
            u03 = Vcount; Vcount++;
            newPoint(u03,(vtcs[u0][0]+vtcs[u3][0])/2,
		     (vtcs[u0][1]+vtcs[u3][1])/2,
		     (vtcs[u0][2]+vtcs[u3][2])/2);
	    nV[u03] = "u"+u0+"."+u3;
            cV[u03] = new Color(0,255,0);
            u12 = Vcount; Vcount++;
            newPoint(u12,(vtcs[u1][0]+vtcs[u2][0])/2,
		     (vtcs[u1][1]+vtcs[u2][1])/2,
		     (vtcs[u1][2]+vtcs[u2][2])/2);
	    nV[u12] = "u"+u1+"."+u2;
            cV[u12] = new Color(0,255,0);
            u13 = Vcount; Vcount++;
            newPoint(u13,(vtcs[u1][0]+vtcs[u3][0])/2,
		     (vtcs[u1][1]+vtcs[u3][1])/2,
		     (vtcs[u1][2]+vtcs[u3][2])/2);
	    nV[u13] = "u"+u1+"."+u3;
            cV[u13] = new Color(0,255,0);
            u23 = Vcount; Vcount++;
            newPoint(u23,(vtcs[u2][0]+vtcs[u3][0])/2,
		     (vtcs[u2][1]+vtcs[u3][1])/2,
		     (vtcs[u2][2]+vtcs[u3][2])/2);
	    nV[u23] = "u"+u2+"."+u3;
            cV[u23] = new Color(0,255,0);
            p0 = Vcount; Vcount++;             
	    newPoint(p0,
		     (vtcs[u1][0]+vtcs[u2][0]+vtcs[u3][0])/3,
		     (vtcs[u1][1]+vtcs[u2][1]+vtcs[u3][1])/3,
		     (vtcs[u1][2]+vtcs[u2][2]+vtcs[u3][2])/3);
	    nV[p0] = "p"+p0;
	    cV[p0] = new Color(0,255,255);
            p1 = Vcount; Vcount++;             
	    newPoint(p1,
		     (vtcs[u0][0]+vtcs[u2][0]+vtcs[u3][0])/3,
		     (vtcs[u0][1]+vtcs[u2][1]+vtcs[u3][1])/3,
		     (vtcs[u0][2]+vtcs[u2][2]+vtcs[u3][2])/3);
	    nV[p1] = "p"+p1;
	    cV[p1] = new Color(0,255,255);
            p2 = Vcount; Vcount++;             
	    newPoint(p2,
		     (vtcs[u0][0]+vtcs[u1][0]+vtcs[u3][0])/3,
		     (vtcs[u0][1]+vtcs[u1][1]+vtcs[u3][1])/3,
		     (vtcs[u0][2]+vtcs[u1][2]+vtcs[u3][2])/3);
	    nV[p2] =  "p"+p2;
	    cV[p2] = new Color(0,255,255);
            p3 = Vcount; Vcount++;             
	    newPoint(p3,
		     (vtcs[u0][0]+vtcs[u1][0]+vtcs[u2][0])/3,
		     (vtcs[u0][1]+vtcs[u1][1]+vtcs[u2][1])/3,
		     (vtcs[u0][2]+vtcs[u1][2]+vtcs[u2][2])/3);
	    nV[p3] =   "p"+p3;
	    cV[p3] = new Color(0,255,255);
            w = Vcount; Vcount++;
	    newPoint(w,
		     (vtcs[v0][0]+vtcs[v1][0]+vtcs[v2][0]+vtcs[v3][0])/4,
		     (vtcs[v0][1]+vtcs[v1][1]+vtcs[v2][1]+vtcs[v3][1])/4,
		     (vtcs[v0][2]+vtcs[v1][2]+vtcs[v2][2]+vtcs[v3][2])/4);
	    nV[w] = "w"+w;
	    cV[w] = new Color(255,0,0);
            write(" points for T60 split:");
	    write("v0 = " + nV[v0]);
	    write("v1 = " + nV[v1]);
	    write("v2 = " + nV[v2]);
	    write("v3 = " + nV[v3]);
	    write("u0 = " + nV[u0]);
	    write("u1 = " + nV[u1]);
	    write("u2 = " + nV[u2]);
	    write("u3 = " + nV[u3]);
	    write("p0 = " + nV[p0]);
	    write("p1 = " + nV[p1]);
	    write("p2 = " + nV[p2]);
	    write("p3 = " + nV[p3]);
	    write("u01 = " + nV[u01]);
	    write("u02 = " + nV[u02]);
	    write("u03 = " + nV[u03]);
	    write("u12 = " + nV[u12]);
	    write("u13 = " + nV[u13]);
	    write("u23 = " + nV[u23]);
	    write("w = " + nV[w]);
	    newTet(Tcount,w,u3,p0,u23); Tcount++;
	    newTet(Tcount,w,u2,p0,u23); Tcount++;
	    newTet(Tcount,w,u3,p0,u13); Tcount++;
	    newTet(Tcount,w,u1,p0,u13); Tcount++;
	    newTet(Tcount,w,u2,p0,u12); Tcount++;
	    newTet(Tcount,w,u1,p0,u12); Tcount++;
	    newTet(Tcount,v0,u3,p0,u23); Tcount++;
	    newTet(Tcount,v0,u2,p0,u23); Tcount++;
	    newTet(Tcount,v0,u3,p0,u13); Tcount++;
	    newTet(Tcount,v0,u1,p0,u13); Tcount++;
	    newTet(Tcount,v0,u2,p0,u12); Tcount++;
	    newTet(Tcount,v0,u1,p0,u12); Tcount++;
	    newTet(Tcount,w,u3,p1,u23); Tcount++;
	    newTet(Tcount,w,u2,p1,u23); Tcount++;
	    newTet(Tcount,w,u3,p1,u03); Tcount++;
	    newTet(Tcount,w,u0,p1,u03); Tcount++;
	    newTet(Tcount,w,u2,p1,u02); Tcount++;
	    newTet(Tcount,w,u0,p1,u02); Tcount++;
	    newTet(Tcount,v1,u3,p1,u23); Tcount++;
	    newTet(Tcount,v1,u2,p1,u23); Tcount++;
	    newTet(Tcount,v1,u3,p1,u03); Tcount++;
	    newTet(Tcount,v1,u0,p1,u03); Tcount++;
	    newTet(Tcount,v1,u2,p1,u02); Tcount++;
	    newTet(Tcount,v1,u0,p1,u02); Tcount++;
	    newTet(Tcount,w,u3,p2,u13); Tcount++;
	    newTet(Tcount,w,u1,p2,u13); Tcount++;
	    newTet(Tcount,w,u3,p2,u03); Tcount++;
	    newTet(Tcount,w,u0,p2,u03); Tcount++;
	    newTet(Tcount,w,u1,p2,u01); Tcount++;
	    newTet(Tcount,w,u0,p2,u01); Tcount++;
	    newTet(Tcount,v2,u3,p2,u13); Tcount++;
	    newTet(Tcount,v2,u1,p2,u13); Tcount++;
	    newTet(Tcount,v2,u3,p2,u03); Tcount++;
	    newTet(Tcount,v2,u0,p2,u03); Tcount++;
	    newTet(Tcount,v2,u1,p2,u01); Tcount++;
	    newTet(Tcount,v2,u0,p2,u01); Tcount++;
	    newTet(Tcount,w,u2,p3,u12); Tcount++;
	    newTet(Tcount,w,u1,p3,u12); Tcount++;
	    newTet(Tcount,w,u2,p3,u02); Tcount++;
	    newTet(Tcount,w,u0,p3,u02); Tcount++;
	    newTet(Tcount,w,u1,p3,u01); Tcount++;
	    newTet(Tcount,w,u0,p3,u01); Tcount++;
	    newTet(Tcount,v3,u2,p3,u12); Tcount++;
	    newTet(Tcount,v3,u1,p3,u12); Tcount++;
	    newTet(Tcount,v3,u2,p3,u02); Tcount++;
	    newTet(Tcount,v3,u0,p3,u02); Tcount++;
	    newTet(Tcount,v3,u1,p3,u01); Tcount++;
	    newTet(Tcount,v3,u0,p3,u01); Tcount++;
	    newTet(Tcount,v0,v1,u3,u23); Tcount++;
	    newTet(Tcount,v0,v1,u2,u23); Tcount++;
	    newTet(Tcount,v0,v2,u3,u13); Tcount++;
	    newTet(Tcount,v0,v2,u1,u13); Tcount++;
	    newTet(Tcount,v1,v2,u3,u03); Tcount++;
	    newTet(Tcount,v1,v2,u0,u03); Tcount++;
	    newTet(Tcount,v0,v3,u2,u12); Tcount++;
	    newTet(Tcount,v0,v3,u1,u12); Tcount++;
	    newTet(Tcount,v1,v3,u2,u02); Tcount++;
	    newTet(Tcount,v1,v3,u0,u02); Tcount++;
	    newTet(Tcount,v2,v3,u1,u01); Tcount++;
	    newTet(Tcount,v2,v3,u0,u01); Tcount++;
	}
	configuration = 0;
        loaded = true;
        tv.TV.configuration.select(0);
        title = "refined all T60";
        named = false;
        prepare();
        named = true;
        vN = new String[V];
        vC = new Color[V];
        for (int v = 0; v < V; v++) {
	    vN[v] = nV[v];
	    vC[v] = cV[v];
	}
        drawIt();
    }

    int whichFace(int i0, int i1, int i2) {
        int result = -1;
        for (int i = 0; i < T; i++) {
	    if (inFace(i0,i) && inFace(i1,i) && inFace(i2,i)) {
		result = i;
                i = T;
	    }
	}
        return result;
    }
    
    int whichEdge(int i, int j) {
        for (int k = 0; k < E; k++) {
	    if ( (i == edges[k][0] && j == edges[k][1]) ||
		 (i == edges[k][1] && j == edges[k][0]) )
		return k;
	}
	return -1;
    }


    void allT504() {
        Color VV = new Color(0,128,128);
        Color vv = new Color(40,100,100);
        Color dd = new Color(200,200,120);
        Color UU = new Color(0,0,200);
        Color uu = new Color(100,100,200);
        Color pp = new Color(127,60,0);
        Color qq = new Color(40,127,67);
        Color rr = new Color(0,127,255);
        Color ee = new Color(63,63,255);
        Color zz = new Color(63,63,127);
        Color tt = new Color(63,127,63);
        Color xx = new Color(127,63,63);
        Color bb = new Color(127,127,63);
        Color ww = new Color(255,0,0);
	int[][] newVtcs = new int[V][3];
	for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		newVtcs[i][j] = 27720*vtcs[i][j];
	    }
	}
	vtcs = new int[V+E+4*T+91*N][3];
	for (int i = 0; i < V; i++) {
	    for (int j = 0; j < 3; j++) {
		vtcs[i][j] = newVtcs[i][j];
	    }
	}
	int Vcount = V;
	int Tcount = 0;
	int[][] newTets = new int[N][4];
	for (int i = 0; i < N; i++) {
	    for (int j = 0; j < 4; j++) {
		newTets[i][j] = tets[i][j];
	    }
	}
	tets = new int[504*N][4];
	V = V+E+4*T+91*N;
	int oldN = N;
	N = 504*N;
	String[] nV = new String[V];
	Color[] cV = new Color[V];
	int[][] facepoints = new int[T][4];
	for (int i = 0; i < T; i++ ) {
	    facepoints[i][0] = -1;
	}
	int[] edgepoints = new int[E];
	for (int i = 0; i < E; i++ ) {
	    edgepoints[i] = -1;
	}
	for (int i = 0; i < Vcount; i++) {
	    nV[i] = "V"+i;
	    cV[i] = VV;
	}
	int w, V1, V2, V3, V4, U1, U2, U3, U4, p1, p2, p3, p4, q1, q2, q3, q4, r1, r2, r3, r4;
	int u12, u13, u14, u23, u24, u34, v12, v13, v14, v23, v24, v34;
	int d12, e12, b12, z12, t12;
	int d13, e13, b13, z13, t13;
	int d14, e14, b14, z14, t14;
	int d21, e21, b21, z21, t21;
	int d23, e23, b23, z23, t23;
	int d24, e24, b24, z24, t24;
	int d31, e31, b31, z31, t31;
	int d32, e32, b32, z32, t32;
	int d34, e34, b34, z34, t34;
	int d41, e41, b41, z41, t41;
	int d42, e42, b42, z42, t42;
	int d43, e43, b43, z43, t43;
	int x123, x124, x132, x134, x142, x143, x213, x214, x231, x234, x241, x243, x312, x314, x321, x324, x341, x342, x412, x413, x421, x423, x431, x432;
	for (int t = 0; t < oldN; t++) {
	    V1 = newTets[t][0];
	    V2 = newTets[t][1];
	    V3 = newTets[t][2];
	    V4 = newTets[t][3];
	    int e;
	    e = whichEdge(V1,V2);
	    if (edgepoints[e] == -1) {
		v12 = Vcount;
                edgepoints[e] = v12;
		newPoint(Vcount,
			 (vtcs[V1][0] + vtcs[V2][0])/2,
			 (vtcs[V1][1] + vtcs[V2][1])/2,
			 (vtcs[V1][2] + vtcs[V2][2])/2);
		Vcount++;
	    }
	    else {
		v12 =  edgepoints[e];
	    }
	    nV[v12] = "v" + v12;
	    cV[v12] = vv;
	    e = whichEdge(V1,V3);
	    if (edgepoints[e] == -1) {
		v13 = Vcount;
                edgepoints[e] = v13;
		newPoint(Vcount,
			 (vtcs[V1][0] + vtcs[V3][0])/2,
			 (vtcs[V1][1] + vtcs[V3][1])/2,
			 (vtcs[V1][2] + vtcs[V3][2])/2);
		Vcount++;
	    }
	    else {
		v13 =  edgepoints[e];
	    }
	    nV[v13] = "v" + v13;
	    cV[v13] = vv;
	    e = whichEdge(V1,V4);
	    if (edgepoints[e] == -1) {
		v14 = Vcount;
                edgepoints[e] = v14;
		newPoint(Vcount,
			 (vtcs[V1][0] + vtcs[V4][0])/2,
			 (vtcs[V1][1] + vtcs[V4][1])/2,
			 (vtcs[V1][2] + vtcs[V4][2])/2);
		Vcount++;
	    }
	    else {
		v14 =  edgepoints[e];
	    }
	    nV[v14] = "v" + v14;
	    cV[v14] = vv;
	    e = whichEdge(V2,V3);
	    if (edgepoints[e] == -1) {
		v23 = Vcount;
                edgepoints[e] = v23;
		newPoint(Vcount,
			 (vtcs[V2][0] + vtcs[V3][0])/2,
			 (vtcs[V2][1] + vtcs[V3][1])/2,
			 (vtcs[V2][2] + vtcs[V3][2])/2);
		Vcount++;
	    }
	    else {
		v23 =  edgepoints[e];
	    }
	    nV[v23] = "v" + v23;
	    cV[v23] = vv;
	    e = whichEdge(V2,V4);
	    if (edgepoints[e] == -1) {
		v24 = Vcount;
                edgepoints[e] = v24;
		newPoint(Vcount,
			 (vtcs[V2][0] + vtcs[V4][0])/2,
			 (vtcs[V2][1] + vtcs[V4][1])/2,
			 (vtcs[V2][2] + vtcs[V4][2])/2);
		Vcount++;
	    }
	    else {
		v24 =  edgepoints[e];
	    }
	    nV[v24] = "v" + v24;
	    cV[v24] = vv;
	    e = whichEdge(V3,V4);
	    if (edgepoints[e] == -1) {
		v34 = Vcount;
                edgepoints[e] = v34;
		newPoint(Vcount,
			 (vtcs[V3][0] + vtcs[V4][0])/2,
			 (vtcs[V3][1] + vtcs[V4][1])/2,
			 (vtcs[V3][2] + vtcs[V4][2])/2);
		Vcount++;
	    }
	    else {
		v34 =  edgepoints[e];
	    }
	    nV[v34] = "v" + v34;
	    cV[v34] = vv;
	    int f, fi, fj, fk, fmin, fmax; 
            fi = fj = fk = fmin = fmax = -1;
	    f = whichFace(V1,V2,V3);
	    fmin = min(min(V1,V2),V3); 
	    fmax = max(max(V1,V2),V3); 
	    if (fmin == V1) { fi = 1; } 
	    if (fmin == V2) { fi = 2; } 
	    if (fmin == V3) { fi = 3; } 
	    if (fmax == V1) { fk = 1; } 
	    if (fmax == V2) { fk = 2; } 
	    if (fmax == V3) { fk = 3; } 
	    fj = -1; 
	    if (fi != 1 && fk !=1) {fj = 1;} 
	    if (fi != 2 && fk !=2) {fj = 2;} 
	    if (fi != 3 && fk !=3) {fj = 3;} 
	    if (facepoints[f][0] == -1 ) { 
		newPoint(Vcount,
			 (vtcs[V1][0] + vtcs[V2][0] + vtcs[V3][0])/3,
			 (vtcs[V1][1] + vtcs[V2][1] + vtcs[V3][1])/3,
			 (vtcs[V1][2] + vtcs[V2][2] + vtcs[V3][2])/3);
		U4 = Vcount;
		facepoints[f][0] = Vcount;
		Vcount++;
		d14 = Vcount;
		newPoint(Vcount,
			 (vtcs[v12][0] + vtcs[v13][0])/2,
			 (vtcs[v12][1] + vtcs[v13][1])/2,
			 (vtcs[v12][2] + vtcs[v13][2])/2);
		facepoints[f][fi] = Vcount;
		Vcount++;
		d24 = Vcount;
		newPoint(Vcount,
			 (vtcs[v12][0] + vtcs[v23][0])/2,
			 (vtcs[v12][1] + vtcs[v23][1])/2,
			 (vtcs[v12][2] + vtcs[v23][2])/2);
		facepoints[f][fj] = Vcount;
		Vcount++;
		d34 = Vcount;
		newPoint(Vcount,
			 (vtcs[v13][0] + vtcs[v23][0])/2,
			 (vtcs[v13][1] + vtcs[v23][1])/2,
			 (vtcs[v13][2] + vtcs[v23][2])/2);
		facepoints[f][fk] = Vcount;
		cV[Vcount] = dd;
		Vcount++;
	    }
	    else {
		U4 = facepoints[f][0];
		d14 = facepoints[f][fi];
		d24 = facepoints[f][fj];
		d34 = facepoints[f][fk];
	    }
	    cV[U4] = UU;
	    nV[U4] = "U" + U4;
	    cV[d14] = dd;
	    nV[d14] = "d" +d14;
	    cV[d24] = dd;
	    nV[d24] = "d" +d24;
	    cV[d34] = dd;
	    nV[d34] = "d" +d34;
	    f = whichFace(V1,V2,V4);
	    fmin = min(min(V1,V2),V4); 
	    fmax = max(max(V1,V2),V4); 
	    if (fmin == V1) { fi = 1; } 
	    if (fmin == V2) { fi = 2; } 
	    if (fmin == V4) { fi = 3; } 
	    if (fmax == V1) { fk = 1; } 
	    if (fmax == V2) { fk = 2; } 
	    if (fmax == V4) { fk = 3; } 
	    fj = -1; 
	    if (fi != 1 && fk !=1) {fj = 1;} 
	    if (fi != 2 && fk !=2) {fj = 2;} 
	    if (fi != 3 && fk !=3) {fj = 3;} 
	    if (facepoints[f][0] == -1 ) { 
		newPoint(Vcount,
			 (vtcs[V1][0] + vtcs[V2][0] + vtcs[V4][0])/3,
			 (vtcs[V1][1] + vtcs[V2][1] + vtcs[V4][1])/3,
			 (vtcs[V1][2] + vtcs[V2][2] + vtcs[V4][2])/3);
		U3 = Vcount;
		facepoints[f][0] = Vcount;
		Vcount++;
		d13 = Vcount;
		newPoint(Vcount,
			 (vtcs[v12][0] + vtcs[v14][0])/2,
			 (vtcs[v12][1] + vtcs[v14][1])/2,
			 (vtcs[v12][2] + vtcs[v14][2])/2);
		facepoints[f][fi] = Vcount;
		Vcount++;
		d23 = Vcount;
		newPoint(Vcount,
			 (vtcs[v12][0] + vtcs[v24][0])/2,
			 (vtcs[v12][1] + vtcs[v24][1])/2,
			 (vtcs[v12][2] + vtcs[v24][2])/2);
		facepoints[f][fj] = Vcount;
		Vcount++;
		d43 = Vcount;
		newPoint(Vcount,
			 (vtcs[v14][0] + vtcs[v24][0])/2,
			 (vtcs[v14][1] + vtcs[v24][1])/2,
			 (vtcs[v14][2] + vtcs[v24][2])/2);
		facepoints[f][fk] = Vcount;
		cV[Vcount] = dd;
		Vcount++;
	    }
	    else {
		U3 = facepoints[f][0];
		d13 = facepoints[f][fi];
		d23 = facepoints[f][fj];
		d43 = facepoints[f][fk];
	    }
	    cV[U3] = UU;
	    nV[U3] = "U" + U3;
	    cV[d13] = dd;
	    nV[d13] = "d" +d13;
	    cV[d23] = dd;
	    nV[d23] = "d" +d23;
	    cV[d43] = dd;
	    nV[d43] = "d" +d43;
	    f = whichFace(V1,V3,V4);
	    fmin = min(min(V1,V3),V4); 
	    fmax = max(max(V1,V3),V4); 
	    if (fmin == V1) { fi = 1; } 
	    if (fmin == V3) { fi = 2; } 
	    if (fmin == V4) { fi = 3; } 
	    if (fmax == V1) { fk = 1; } 
	    if (fmax == V3) { fk = 2; } 
	    if (fmax == V4) { fk = 3; } 
	    fj = -1; 
	    if (fi != 1 && fk !=1) {fj = 1;} 
	    if (fi != 2 && fk !=2) {fj = 2;} 
	    if (fi != 3 && fk !=3) {fj = 3;} 
	    if (facepoints[f][0] == -1 ) { 
		newPoint(Vcount,
			 (vtcs[V1][0] + vtcs[V3][0] + vtcs[V4][0])/3,
			 (vtcs[V1][1] + vtcs[V3][1] + vtcs[V4][1])/3,
			 (vtcs[V1][2] + vtcs[V3][2] + vtcs[V4][2])/3);
		U2 = Vcount;
		facepoints[f][0] = Vcount;
		Vcount++;
		d12 = Vcount;
		newPoint(Vcount,
			 (vtcs[v13][0] + vtcs[v14][0])/2,
			 (vtcs[v13][1] + vtcs[v14][1])/2,
			 (vtcs[v13][2] + vtcs[v14][2])/2);
		facepoints[f][fi] = Vcount;
		Vcount++;
		d32 = Vcount;
		newPoint(Vcount,
			 (vtcs[v13][0] + vtcs[v34][0])/2,
			 (vtcs[v13][1] + vtcs[v34][1])/2,
			 (vtcs[v13][2] + vtcs[v34][2])/2);
		facepoints[f][fj] = Vcount;
		Vcount++;
		d42 = Vcount;
		newPoint(Vcount,
			 (vtcs[v14][0] + vtcs[v34][0])/2,
			 (vtcs[v14][1] + vtcs[v34][1])/2,
			 (vtcs[v14][2] + vtcs[v34][2])/2);
		facepoints[f][fk] = Vcount;
		cV[Vcount] = dd;
		Vcount++;
	    }
	    else {
		U2 = facepoints[f][0];
		d12 = facepoints[f][fi];
		d32 = facepoints[f][fj];
		d42 = facepoints[f][fk];
	    }
	    cV[U2] = UU;
	    nV[U2] = "U" + U2;
	    cV[d12] = dd;
	    nV[d12] = "d" +d12;
	    cV[d32] = dd;
	    nV[d32] = "d" +d32;
	    cV[d42] = dd;
	    nV[d42] = "d" +d42;
	    f = whichFace(V2,V3,V4);
	    fmin = min(min(V2,V3),V4); 
	    fmax = max(max(V2,V3),V4); 
	    if (fmin == V2) { fi = 1; } 
	    if (fmin == V3) { fi = 2; } 
	    if (fmin == V4) { fi = 3; } 
	    if (fmax == V2) { fk = 1; } 
	    if (fmax == V3) { fk = 2; } 
	    if (fmax == V4) { fk = 3; } 
	    fj = -1; 
	    if (fi != 1 && fk !=1) {fj = 1;} 
	    if (fi != 2 && fk !=2) {fj = 2;} 
	    if (fi != 3 && fk !=3) {fj = 3;} 
	    if (facepoints[f][0] == -1 ) { 
		newPoint(Vcount,
			 (vtcs[V2][0] + vtcs[V3][0] + vtcs[V4][0])/3,
			 (vtcs[V2][1] + vtcs[V3][1] + vtcs[V4][1])/3,
			 (vtcs[V2][2] + vtcs[V3][2] + vtcs[V4][2])/3);
		U1 = Vcount;
		facepoints[f][0] = Vcount;
		Vcount++;
		d21 = Vcount;
		newPoint(Vcount,
			 (vtcs[v23][0] + vtcs[v24][0])/2,
			 (vtcs[v23][1] + vtcs[v24][1])/2,
			 (vtcs[v23][2] + vtcs[v24][2])/2);
		facepoints[f][fi] = Vcount;
		Vcount++;
		d31 = Vcount;
		newPoint(Vcount,
			 (vtcs[v23][0] + vtcs[v34][0])/2,
			 (vtcs[v23][1] + vtcs[v34][1])/2,
			 (vtcs[v23][2] + vtcs[v34][2])/2);
		facepoints[f][fj] = Vcount;
		Vcount++;
		d41 = Vcount;
		newPoint(Vcount,
			 (vtcs[v24][0] + vtcs[v34][0])/2,
			 (vtcs[v24][1] + vtcs[v34][1])/2,
			 (vtcs[v24][2] + vtcs[v34][2])/2);
		facepoints[f][fk] = Vcount;
		cV[Vcount] = dd;
		Vcount++;
	    }
	    else {
		U1 = facepoints[f][0];
		d21 = facepoints[f][fi];
		d31 = facepoints[f][fj];
		d41 = facepoints[f][fk];
	    }
	    cV[U1] = UU;
	    nV[U1] = "U" + U1;
	    cV[d21] = dd;
	    nV[d21] = "d" +d21;
	    cV[d31] = dd;
	    nV[d31] = "d" +d31;
	    cV[d41] = dd;
	    nV[d41] = "d" +d41;
	    u12 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U1][0] + vtcs[U2][0])/2,
		     (vtcs[U1][1] + vtcs[U2][1])/2,
		     (vtcs[U1][2] + vtcs[U2][2])/2);
	    nV[Vcount] = "u" + Vcount;
	    cV[Vcount] = uu;
	    Vcount++;
	    u13 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U1][0] + vtcs[U3][0])/2,
		     (vtcs[U1][1] + vtcs[U3][1])/2,
		     (vtcs[U1][2] + vtcs[U3][2])/2);
	    nV[Vcount] = "u" + Vcount;
	    cV[Vcount] = uu;
	    Vcount++;
	    u14 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U1][0] + vtcs[U4][0])/2,
		     (vtcs[U1][1] + vtcs[U4][1])/2,
		     (vtcs[U1][2] + vtcs[U4][2])/2);
	    nV[Vcount] = "u" + Vcount;
	    cV[Vcount] = uu;
	    Vcount++;
	    u23 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U2][0] + vtcs[U3][0])/2,
		     (vtcs[U2][1] + vtcs[U3][1])/2,
		     (vtcs[U2][2] + vtcs[U3][2])/2);
	    nV[Vcount] = "u" + Vcount;
	    cV[Vcount] = uu;
	    Vcount++;
	    u24 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U2][0] + vtcs[U4][0])/2,
		     (vtcs[U2][1] + vtcs[U4][1])/2,
		     (vtcs[U2][2] + vtcs[U4][2])/2);
	    nV[Vcount] = "u" + Vcount;
	    cV[Vcount] = uu;
	    Vcount++;
	    u34 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U3][0] + vtcs[U4][0])/2,
		     (vtcs[U3][1] + vtcs[U4][1])/2,
		     (vtcs[U3][2] + vtcs[U4][2])/2);
	    nV[Vcount] = "u" + Vcount;
	    cV[Vcount] = uu;
	    Vcount++;
	    p1 = Vcount;
	    newPoint(Vcount,
		     (vtcs[v12][0] + vtcs[v13][0] + vtcs[v14][0])/3,
		     (vtcs[v12][1] + vtcs[v13][1] + vtcs[v14][1])/3,
		     (vtcs[v12][2] + vtcs[v13][2] + vtcs[v14][2])/3);
	    nV[Vcount] = "p" + Vcount;
	    cV[Vcount] = pp;
	    Vcount++;
	    q1 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p1][0] + vtcs[U2][0] + vtcs[U3][0]+ vtcs[U4][0])/5,
		     (2*vtcs[p1][1] + vtcs[U2][1] + vtcs[U3][1]+ vtcs[U4][1])/5,
		     (2*vtcs[p1][2] + vtcs[U2][2] + vtcs[U3][2]+ vtcs[U4][2])/5);
	    nV[Vcount] = "q" + Vcount;
	    cV[Vcount] = qq;
	    Vcount++;
	    r1 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U2][0] + vtcs[U3][0] + vtcs[U4][0])/3,
		     (vtcs[U2][1] + vtcs[U3][1] + vtcs[U4][1])/3,
		     (vtcs[U2][2] + vtcs[U3][2] + vtcs[U4][2])/3);
	    nV[Vcount] = "r" + Vcount;
	    cV[Vcount] = rr;
	    Vcount++;
	    p2 = Vcount;
	    newPoint(Vcount,
		     (vtcs[v23][0] + vtcs[v24][0] + vtcs[v12][0])/3,
		     (vtcs[v23][1] + vtcs[v24][1] + vtcs[v12][1])/3,
		     (vtcs[v23][2] + vtcs[v24][2] + vtcs[v12][2])/3);
	    nV[Vcount] = "p" + Vcount;
	    cV[Vcount] = pp;
	    Vcount++;
	    q2 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p2][0] + vtcs[U3][0] + vtcs[U4][0]+ vtcs[U1][0])/5,
		     (2*vtcs[p2][1] + vtcs[U3][1] + vtcs[U4][1]+ vtcs[U1][1])/5,
		     (2*vtcs[p2][2] + vtcs[U3][2] + vtcs[U4][2]+ vtcs[U1][2])/5);
	    nV[Vcount] = "q" + Vcount;
	    cV[Vcount] = qq;
	    Vcount++;
	    r2 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U3][0] + vtcs[U4][0] + vtcs[U1][0])/3,
		     (vtcs[U3][1] + vtcs[U4][1] + vtcs[U1][1])/3,
		     (vtcs[U3][2] + vtcs[U4][2] + vtcs[U1][2])/3);
	    nV[Vcount] = "r" + Vcount;
	    cV[Vcount] = rr;
	    Vcount++;
	    p3 = Vcount;
	    newPoint(Vcount,
		     (vtcs[v34][0] + vtcs[v13][0] + vtcs[v23][0])/3,
		     (vtcs[v34][1] + vtcs[v13][1] + vtcs[v23][1])/3,
		     (vtcs[v34][2] + vtcs[v13][2] + vtcs[v23][2])/3);
	    nV[Vcount] = "p" + Vcount;
	    cV[Vcount] = pp;
	    Vcount++;
	    q3 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p3][0] + vtcs[U4][0] + vtcs[U1][0]+ vtcs[U2][0])/5,
		     (2*vtcs[p3][1] + vtcs[U4][1] + vtcs[U1][1]+ vtcs[U2][1])/5,
		     (2*vtcs[p3][2] + vtcs[U4][2] + vtcs[U1][2]+ vtcs[U2][2])/5);
	    nV[Vcount] = "q" + Vcount;
	    cV[Vcount] = qq;
	    Vcount++;
	    r3 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U4][0] + vtcs[U1][0] + vtcs[U2][0])/3,
		     (vtcs[U4][1] + vtcs[U1][1] + vtcs[U2][1])/3,
		     (vtcs[U4][2] + vtcs[U1][2] + vtcs[U2][2])/3);
	    nV[Vcount] = "r" + Vcount;
	    cV[Vcount] = rr;
	    Vcount++;
	    p4 = Vcount;
	    newPoint(Vcount,
		     (vtcs[v14][0] + vtcs[v24][0] + vtcs[v34][0])/3,
		     (vtcs[v14][1] + vtcs[v24][1] + vtcs[v34][1])/3,
		     (vtcs[v14][2] + vtcs[v24][2] + vtcs[v34][2])/3);
	    nV[Vcount] = "p" + Vcount;
	    cV[Vcount] = pp;
	    Vcount++;
	    q4 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p4][0] + vtcs[U1][0] + vtcs[U2][0]+ vtcs[U3][0])/5,
		     (2*vtcs[p4][1] + vtcs[U1][1] + vtcs[U2][1]+ vtcs[U3][1])/5,
		     (2*vtcs[p4][2] + vtcs[U1][2] + vtcs[U2][2]+ vtcs[U3][2])/5);
	    nV[Vcount] = "q" + Vcount;
	    cV[Vcount] = qq;
	    Vcount++;
	    r4 = Vcount;
	    newPoint(Vcount,
		     (vtcs[U1][0] + vtcs[U2][0] + vtcs[U3][0])/3,
		     (vtcs[U1][1] + vtcs[U2][1] + vtcs[U3][1])/3,
		     (vtcs[U1][2] + vtcs[U2][2] + vtcs[U3][2])/3);
	    nV[Vcount] = "r" + Vcount;
	    cV[Vcount] = rr;
	    Vcount++;
	    e12 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d13][0] + vtcs[d14][0])/2,
		     (vtcs[d13][1] + vtcs[d14][1])/2,
		     (vtcs[d13][2] + vtcs[d14][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    b14 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p1][0] + vtcs[U4][0])/3,
		     (2*vtcs[p1][1] + vtcs[U4][1])/3,
		     (2*vtcs[p1][2] + vtcs[U4][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    z12 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p1][0] + vtcs[u34][0])/2,
		     (vtcs[p1][1] + vtcs[u34][1])/2,
		     (vtcs[p1][2] + vtcs[u34][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t12 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e12][0] + 3*vtcs[u34][0])/7,
		     (4*vtcs[e12][1] + 3*vtcs[u34][1])/7,
		     (4*vtcs[e12][2] + 3*vtcs[u34][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x124 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U4][0] + 8*vtcs[e12][0])/11,
		     (3*vtcs[U4][1] + 8*vtcs[e12][1])/11,
		     (3*vtcs[U4][2] + 8*vtcs[e12][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b13 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p1][0] + vtcs[U3][0])/3,
		     (2*vtcs[p1][1] + vtcs[U3][1])/3,
		     (2*vtcs[p1][2] + vtcs[U3][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x123 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U3][0] + 8*vtcs[e12][0])/11,
		     (3*vtcs[U3][1] + 8*vtcs[e12][1])/11,
		     (3*vtcs[U3][2] + 8*vtcs[e12][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e13 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d12][0] + vtcs[d14][0])/2,
		     (vtcs[d12][1] + vtcs[d14][1])/2,
		     (vtcs[d12][2] + vtcs[d14][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z13 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p1][0] + vtcs[u24][0])/2,
		     (vtcs[p1][1] + vtcs[u24][1])/2,
		     (vtcs[p1][2] + vtcs[u24][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t13 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e13][0] + 3*vtcs[u24][0])/7,
		     (4*vtcs[e13][1] + 3*vtcs[u24][1])/7,
		     (4*vtcs[e13][2] + 3*vtcs[u24][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x134 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U4][0] + 8*vtcs[e13][0])/11,
		     (3*vtcs[U4][1] + 8*vtcs[e13][1])/11,
		     (3*vtcs[U4][2] + 8*vtcs[e13][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b12 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p1][0] + vtcs[U2][0])/3,
		     (2*vtcs[p1][1] + vtcs[U2][1])/3,
		     (2*vtcs[p1][2] + vtcs[U2][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x132 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U2][0] + 8*vtcs[e13][0])/11,
		     (3*vtcs[U2][1] + 8*vtcs[e13][1])/11,
		     (3*vtcs[U2][2] + 8*vtcs[e13][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e14 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d12][0] + vtcs[d13][0])/2,
		     (vtcs[d12][1] + vtcs[d13][1])/2,
		     (vtcs[d12][2] + vtcs[d13][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z14 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p1][0] + vtcs[u23][0])/2,
		     (vtcs[p1][1] + vtcs[u23][1])/2,
		     (vtcs[p1][2] + vtcs[u23][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t14 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e14][0] + 3*vtcs[u23][0])/7,
		     (4*vtcs[e14][1] + 3*vtcs[u23][1])/7,
		     (4*vtcs[e14][2] + 3*vtcs[u23][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x143 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U3][0] + 8*vtcs[e14][0])/11,
		     (3*vtcs[U3][1] + 8*vtcs[e14][1])/11,
		     (3*vtcs[U3][2] + 8*vtcs[e14][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    x142 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U2][0] + 8*vtcs[e14][0])/11,
		     (3*vtcs[U2][1] + 8*vtcs[e14][1])/11,
		     (3*vtcs[U2][2] + 8*vtcs[e14][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e21 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d23][0] + vtcs[d24][0])/2,
		     (vtcs[d23][1] + vtcs[d24][1])/2,
		     (vtcs[d23][2] + vtcs[d24][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    b24 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p2][0] + vtcs[U4][0])/3,
		     (2*vtcs[p2][1] + vtcs[U4][1])/3,
		     (2*vtcs[p2][2] + vtcs[U4][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    z21 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p2][0] + vtcs[u34][0])/2,
		     (vtcs[p2][1] + vtcs[u34][1])/2,
		     (vtcs[p2][2] + vtcs[u34][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t21 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e21][0] + 3*vtcs[u34][0])/7,
		     (4*vtcs[e21][1] + 3*vtcs[u34][1])/7,
		     (4*vtcs[e21][2] + 3*vtcs[u34][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x214 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U4][0] + 8*vtcs[e21][0])/11,
		     (3*vtcs[U4][1] + 8*vtcs[e21][1])/11,
		     (3*vtcs[U4][2] + 8*vtcs[e21][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b23 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p2][0] + vtcs[U3][0])/3,
		     (2*vtcs[p2][1] + vtcs[U3][1])/3,
		     (2*vtcs[p2][2] + vtcs[U3][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x213 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U3][0] + 8*vtcs[e21][0])/11,
		     (3*vtcs[U3][1] + 8*vtcs[e21][1])/11,
		     (3*vtcs[U3][2] + 8*vtcs[e21][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e23 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d21][0] + vtcs[d24][0])/2,
		     (vtcs[d21][1] + vtcs[d24][1])/2,
		     (vtcs[d21][2] + vtcs[d24][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z23 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p2][0] + vtcs[u14][0])/2,
		     (vtcs[p2][1] + vtcs[u14][1])/2,
		     (vtcs[p2][2] + vtcs[u14][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t23 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e23][0] + 3*vtcs[u14][0])/7,
		     (4*vtcs[e23][1] + 3*vtcs[u14][1])/7,
		     (4*vtcs[e23][2] + 3*vtcs[u14][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x234 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U4][0] + 8*vtcs[e23][0])/11,
		     (3*vtcs[U4][1] + 8*vtcs[e23][1])/11,
		     (3*vtcs[U4][2] + 8*vtcs[e23][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b21 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p2][0] + vtcs[U1][0])/3,
		     (2*vtcs[p2][1] + vtcs[U1][1])/3,
		     (2*vtcs[p2][2] + vtcs[U1][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x231 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U1][0] + 8*vtcs[e23][0])/11,
		     (3*vtcs[U1][1] + 8*vtcs[e23][1])/11,
		     (3*vtcs[U1][2] + 8*vtcs[e23][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e24 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d21][0] + vtcs[d23][0])/2,
		     (vtcs[d21][1] + vtcs[d23][1])/2,
		     (vtcs[d21][2] + vtcs[d23][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z24 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p2][0] + vtcs[u13][0])/2,
		     (vtcs[p2][1] + vtcs[u13][1])/2,
		     (vtcs[p2][2] + vtcs[u13][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t24 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e24][0] + 3*vtcs[u13][0])/7,
		     (4*vtcs[e24][1] + 3*vtcs[u13][1])/7,
		     (4*vtcs[e24][2] + 3*vtcs[u13][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x243 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U3][0] + 8*vtcs[e24][0])/11,
		     (3*vtcs[U3][1] + 8*vtcs[e24][1])/11,
		     (3*vtcs[U3][2] + 8*vtcs[e24][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    x241 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U1][0] + 8*vtcs[e24][0])/11,
		     (3*vtcs[U1][1] + 8*vtcs[e24][1])/11,
		     (3*vtcs[U1][2] + 8*vtcs[e24][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e31 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d32][0] + vtcs[d34][0])/2,
		     (vtcs[d32][1] + vtcs[d34][1])/2,
		     (vtcs[d32][2] + vtcs[d34][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    b34 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p3][0] + vtcs[U4][0])/3,
		     (2*vtcs[p3][1] + vtcs[U4][1])/3,
		     (2*vtcs[p3][2] + vtcs[U4][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    z31 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p3][0] + vtcs[u24][0])/2,
		     (vtcs[p3][1] + vtcs[u24][1])/2,
		     (vtcs[p3][2] + vtcs[u24][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t31 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e31][0] + 3*vtcs[u24][0])/7,
		     (4*vtcs[e31][1] + 3*vtcs[u24][1])/7,
		     (4*vtcs[e31][2] + 3*vtcs[u24][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x314 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U4][0] + 8*vtcs[e31][0])/11,
		     (3*vtcs[U4][1] + 8*vtcs[e31][1])/11,
		     (3*vtcs[U4][2] + 8*vtcs[e31][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b32 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p3][0] + vtcs[U2][0])/3,
		     (2*vtcs[p3][1] + vtcs[U2][1])/3,
		     (2*vtcs[p3][2] + vtcs[U2][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x312 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U2][0] + 8*vtcs[e31][0])/11,
		     (3*vtcs[U2][1] + 8*vtcs[e31][1])/11,
		     (3*vtcs[U2][2] + 8*vtcs[e31][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e32 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d31][0] + vtcs[d34][0])/2,
		     (vtcs[d31][1] + vtcs[d34][1])/2,
		     (vtcs[d31][2] + vtcs[d34][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z32 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p3][0] + vtcs[u14][0])/2,
		     (vtcs[p3][1] + vtcs[u14][1])/2,
		     (vtcs[p3][2] + vtcs[u14][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t32 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e32][0] + 3*vtcs[u14][0])/7,
		     (4*vtcs[e32][1] + 3*vtcs[u14][1])/7,
		     (4*vtcs[e32][2] + 3*vtcs[u14][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x324 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U4][0] + 8*vtcs[e32][0])/11,
		     (3*vtcs[U4][1] + 8*vtcs[e32][1])/11,
		     (3*vtcs[U4][2] + 8*vtcs[e32][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b31 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p3][0] + vtcs[U1][0])/3,
		     (2*vtcs[p3][1] + vtcs[U1][1])/3,
		     (2*vtcs[p3][2] + vtcs[U1][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x321 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U1][0] + 8*vtcs[e32][0])/11,
		     (3*vtcs[U1][1] + 8*vtcs[e32][1])/11,
		     (3*vtcs[U1][2] + 8*vtcs[e32][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e34 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d31][0] + vtcs[d32][0])/2,
		     (vtcs[d31][1] + vtcs[d32][1])/2,
		     (vtcs[d31][2] + vtcs[d32][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z34 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p3][0] + vtcs[u12][0])/2,
		     (vtcs[p3][1] + vtcs[u12][1])/2,
		     (vtcs[p3][2] + vtcs[u12][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t34 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e34][0] + 3*vtcs[u12][0])/7,
		     (4*vtcs[e34][1] + 3*vtcs[u12][1])/7,
		     (4*vtcs[e34][2] + 3*vtcs[u12][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x342 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U2][0] + 8*vtcs[e34][0])/11,
		     (3*vtcs[U2][1] + 8*vtcs[e34][1])/11,
		     (3*vtcs[U2][2] + 8*vtcs[e34][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    x341 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U1][0] + 8*vtcs[e34][0])/11,
		     (3*vtcs[U1][1] + 8*vtcs[e34][1])/11,
		     (3*vtcs[U1][2] + 8*vtcs[e34][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e41 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d42][0] + vtcs[d43][0])/2,
		     (vtcs[d42][1] + vtcs[d43][1])/2,
		     (vtcs[d42][2] + vtcs[d43][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    b43 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p4][0] + vtcs[U3][0])/3,
		     (2*vtcs[p4][1] + vtcs[U3][1])/3,
		     (2*vtcs[p4][2] + vtcs[U3][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    z41 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p4][0] + vtcs[u23][0])/2,
		     (vtcs[p4][1] + vtcs[u23][1])/2,
		     (vtcs[p4][2] + vtcs[u23][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t41 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e41][0] + 3*vtcs[u23][0])/7,
		     (4*vtcs[e41][1] + 3*vtcs[u23][1])/7,
		     (4*vtcs[e41][2] + 3*vtcs[u23][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x413 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U3][0] + 8*vtcs[e41][0])/11,
		     (3*vtcs[U3][1] + 8*vtcs[e41][1])/11,
		     (3*vtcs[U3][2] + 8*vtcs[e41][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b42 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p4][0] + vtcs[U2][0])/3,
		     (2*vtcs[p4][1] + vtcs[U2][1])/3,
		     (2*vtcs[p4][2] + vtcs[U2][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x412 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U2][0] + 8*vtcs[e41][0])/11,
		     (3*vtcs[U2][1] + 8*vtcs[e41][1])/11,
		     (3*vtcs[U2][2] + 8*vtcs[e41][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e42 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d41][0] + vtcs[d43][0])/2,
		     (vtcs[d41][1] + vtcs[d43][1])/2,
		     (vtcs[d41][2] + vtcs[d43][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z42 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p4][0] + vtcs[u13][0])/2,
		     (vtcs[p4][1] + vtcs[u13][1])/2,
		     (vtcs[p4][2] + vtcs[u13][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t42 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e42][0] + 3*vtcs[u13][0])/7,
		     (4*vtcs[e42][1] + 3*vtcs[u13][1])/7,
		     (4*vtcs[e42][2] + 3*vtcs[u13][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x423 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U3][0] + 8*vtcs[e42][0])/11,
		     (3*vtcs[U3][1] + 8*vtcs[e42][1])/11,
		     (3*vtcs[U3][2] + 8*vtcs[e42][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    b41 = Vcount;
	    newPoint(Vcount,
		     (2*vtcs[p4][0] + vtcs[U1][0])/3,
		     (2*vtcs[p4][1] + vtcs[U1][1])/3,
		     (2*vtcs[p4][2] + vtcs[U1][2])/3);
	    nV[Vcount] = "b" + Vcount;
	    cV[Vcount] = bb;
	    Vcount++;
	    x421 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U1][0] + 8*vtcs[e42][0])/11,
		     (3*vtcs[U1][1] + 8*vtcs[e42][1])/11,
		     (3*vtcs[U1][2] + 8*vtcs[e42][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    e43 = Vcount;
	    newPoint(Vcount,
		     (vtcs[d41][0] + vtcs[d42][0])/2,
		     (vtcs[d41][1] + vtcs[d42][1])/2,
		     (vtcs[d41][2] + vtcs[d42][2])/2);
	    nV[Vcount] = "e" + Vcount;
	    cV[Vcount] = ee;
	    Vcount++;
	    z43 = Vcount;
	    newPoint(Vcount,
		     (vtcs[p4][0] + vtcs[u12][0])/2,
		     (vtcs[p4][1] + vtcs[u12][1])/2,
		     (vtcs[p4][2] + vtcs[u12][2])/2);
	    nV[Vcount] = "z" + Vcount;
	    cV[Vcount] = zz;
	    Vcount++;
	    t43 = Vcount;
	    newPoint(Vcount,
		     (4*vtcs[e43][0] + 3*vtcs[u12][0])/7,
		     (4*vtcs[e43][1] + 3*vtcs[u12][1])/7,
		     (4*vtcs[e43][2] + 3*vtcs[u12][2])/7);
	    nV[Vcount] = "t" + Vcount;
	    cV[Vcount] = tt;
	    Vcount++;
	    x432 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U2][0] + 8*vtcs[e43][0])/11,
		     (3*vtcs[U2][1] + 8*vtcs[e43][1])/11,
		     (3*vtcs[U2][2] + 8*vtcs[e43][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    x431 = Vcount;
	    newPoint(Vcount,
		     (3*vtcs[U1][0] + 8*vtcs[e43][0])/11,
		     (3*vtcs[U1][1] + 8*vtcs[e43][1])/11,
		     (3*vtcs[U1][2] + 8*vtcs[e43][2])/11);
	    nV[Vcount] = "x"+ Vcount;
	    cV[Vcount] = xx;
	    Vcount++;
	    w = Vcount; Vcount++;
	    newPoint(w,
		     (vtcs[V1][0]+vtcs[V2][0]+vtcs[V3][0]+vtcs[V4][0])/4,
		     (vtcs[V1][1]+vtcs[V2][1]+vtcs[V3][1]+vtcs[V4][1])/4,
		     (vtcs[V1][2]+vtcs[V2][2]+vtcs[V3][2]+vtcs[V4][2])/4);
	    nV[w] = "w"+w;
	    cV[w] = ww;
	    /* start T 1 1  */
	    newTet(Tcount, V1, v12, d14, e12); Tcount++;
	    newTet(Tcount, V1, v12, d13, e12); Tcount++;
	    newTet(Tcount, V1, p1, d14, e12); Tcount++;
	    newTet(Tcount, V1, p1, d13, e12); Tcount++;
	    newTet(Tcount, V1, p1, d13, e14); Tcount++;
	    newTet(Tcount, V1, v14, d13, e14); Tcount++;
	    newTet(Tcount, V1, v14, d12, e14); Tcount++;
	    newTet(Tcount, V1, p1, d12, e14); Tcount++;
	    newTet(Tcount, V1, p1, d12, e13); Tcount++;
	    newTet(Tcount, V1, v13, d12, e13); Tcount++;
	    newTet(Tcount, V1, v13, d14, e13); Tcount++;
	    newTet(Tcount, V1, p1, d14, e13); Tcount++;
	    /* end T 1 1  */
	    /* start T 1 2  */
	    newTet(Tcount, U2, u23, r1, q1); Tcount++;
	    newTet(Tcount, u23, U3, r1, q1); Tcount++;
	    newTet(Tcount, U3, u34, r1, q1); Tcount++;
	    newTet(Tcount, u34, U4, r1, q1); Tcount++;
	    newTet(Tcount, U4, u24, r1, q1); Tcount++;
	    newTet(Tcount, u24, U2, r1, q1); Tcount++;
	    newTet(Tcount, p1, b12, z14, q1); Tcount++;
	    newTet(Tcount, b12, U2, z14, q1); Tcount++;
	    newTet(Tcount, U2, u23, z14, q1); Tcount++;
	    newTet(Tcount, u23, U3, z14, q1); Tcount++;
	    newTet(Tcount, U3, b13, z14, q1); Tcount++;
	    newTet(Tcount, b13, p1, z14, q1); Tcount++;
	    newTet(Tcount, p1, b13, z12, q1); Tcount++;
	    newTet(Tcount, b13, U3, z12, q1); Tcount++;
	    newTet(Tcount, U3, u34, z12, q1); Tcount++;
	    newTet(Tcount, u34, U4, z12, q1); Tcount++;
	    newTet(Tcount, U4, b14, z12, q1); Tcount++;
	    newTet(Tcount, b14, p1, z12, q1); Tcount++;
	    newTet(Tcount, p1, b12, z13, q1); Tcount++;
	    newTet(Tcount, b12, U2, z13, q1); Tcount++;
	    newTet(Tcount, U2, u24, z13, q1); Tcount++;
	    newTet(Tcount, u24, U4, z13, q1); Tcount++;
	    newTet(Tcount, U4, b14, z13, q1); Tcount++;
	    newTet(Tcount, b14, p1, z13, q1); Tcount++;
	    /* end T 1 2  */
	    /* start T 1 3  */
	    newTet(Tcount, U2, u23, r1, w); Tcount++;
	    newTet(Tcount, u23, U3, r1, w); Tcount++;
	    newTet(Tcount, U3, u34, r1, w); Tcount++;
	    newTet(Tcount, u34, U4, r1, w); Tcount++;
	    newTet(Tcount, U4, u24, r1, w); Tcount++;
	    newTet(Tcount, u24, U2, r1, w); Tcount++;
	    /* end T 1 3  */
	    /* start T 1 4 2  */
	    newTet(Tcount, U3, u34, z12, t12); Tcount++;
	    newTet(Tcount, u34, U4, z12, t12); Tcount++;
	    newTet(Tcount, U4, b14, z12, t12); Tcount++;
	    newTet(Tcount, b14, p1, z12, t12); Tcount++;
	    newTet(Tcount, p1, b13, z12, t12); Tcount++;
	    newTet(Tcount, b13, U3, z12, t12); Tcount++;
	    newTet(Tcount, v12, e12, x124, t12); Tcount++;
	    newTet(Tcount, e12, p1, x124, t12); Tcount++;
	    newTet(Tcount, p1, b14, x124, t12); Tcount++;
	    newTet(Tcount, b14, U4, x124, t12); Tcount++;
	    newTet(Tcount, U4, v12, x124, t12); Tcount++;
	    newTet(Tcount, v12, e12, x123, t12); Tcount++;
	    newTet(Tcount, e12, p1, x123, t12); Tcount++;
	    newTet(Tcount, p1, b13, x123, t12); Tcount++;
	    newTet(Tcount, b13, U3, x123, t12); Tcount++;
	    newTet(Tcount, U3, v12, x123, t12); Tcount++;
	    newTet(Tcount, U3, v12, u34, t12); Tcount++;
	    newTet(Tcount, U4, v12, u34, t12); Tcount++;
	    /* end T 1 4  */
	    /* T5ing start T 1 5 2 3 4 */
	    newTet(Tcount, v12, U4, x124, d14); Tcount++;
	    newTet(Tcount, U4, b14, x124, d14); Tcount++;
	    newTet(Tcount, b14, p1, x124, d14); Tcount++;
	    newTet(Tcount, p1, e12, x124, d14); Tcount++;
	    newTet(Tcount, e12, v12, x124, d14); Tcount++;
	    newTet(Tcount, v13, U4, x134, d14); Tcount++;
	    newTet(Tcount, U4, b14, x134, d14); Tcount++;
	    newTet(Tcount, b14, p1, x134, d14); Tcount++;
	    newTet(Tcount, p1, e13, x134, d14); Tcount++;
	    newTet(Tcount, e13, v13, x134, d14); Tcount++;
	    /* start T 1 5 2 3 4 */
	    /* T5ing start T 1 5 2 4 3 */
	    newTet(Tcount, v12, U3, x123, d13); Tcount++;
	    newTet(Tcount, U3, b13, x123, d13); Tcount++;
	    newTet(Tcount, b13, p1, x123, d13); Tcount++;
	    newTet(Tcount, p1, e12, x123, d13); Tcount++;
	    newTet(Tcount, e12, v12, x123, d13); Tcount++;
	    newTet(Tcount, v14, U3, x143, d13); Tcount++;
	    newTet(Tcount, U3, b13, x143, d13); Tcount++;
	    newTet(Tcount, b13, p1, x143, d13); Tcount++;
	    newTet(Tcount, p1, e14, x143, d13); Tcount++;
	    newTet(Tcount, e14, v14, x143, d13); Tcount++;
	    /* start T 1 5 2 4 3 */
	    /* start T 1 4 3  */
	    newTet(Tcount, U2, u24, z13, t13); Tcount++;
	    newTet(Tcount, u24, U4, z13, t13); Tcount++;
	    newTet(Tcount, U4, b14, z13, t13); Tcount++;
	    newTet(Tcount, b14, p1, z13, t13); Tcount++;
	    newTet(Tcount, p1, b12, z13, t13); Tcount++;
	    newTet(Tcount, b12, U2, z13, t13); Tcount++;
	    newTet(Tcount, v13, e13, x134, t13); Tcount++;
	    newTet(Tcount, e13, p1, x134, t13); Tcount++;
	    newTet(Tcount, p1, b14, x134, t13); Tcount++;
	    newTet(Tcount, b14, U4, x134, t13); Tcount++;
	    newTet(Tcount, U4, v13, x134, t13); Tcount++;
	    newTet(Tcount, v13, e13, x132, t13); Tcount++;
	    newTet(Tcount, e13, p1, x132, t13); Tcount++;
	    newTet(Tcount, p1, b12, x132, t13); Tcount++;
	    newTet(Tcount, b12, U2, x132, t13); Tcount++;
	    newTet(Tcount, U2, v13, x132, t13); Tcount++;
	    newTet(Tcount, U2, v13, u24, t13); Tcount++;
	    newTet(Tcount, U4, v13, u24, t13); Tcount++;
	    /* end T 1 4  */
	    /* T5ing start T 1 5 3 4 2 */
	    newTet(Tcount, v13, U2, x132, d12); Tcount++;
	    newTet(Tcount, U2, b12, x132, d12); Tcount++;
	    newTet(Tcount, b12, p1, x132, d12); Tcount++;
	    newTet(Tcount, p1, e13, x132, d12); Tcount++;
	    newTet(Tcount, e13, v13, x132, d12); Tcount++;
	    newTet(Tcount, v14, U2, x142, d12); Tcount++;
	    newTet(Tcount, U2, b12, x142, d12); Tcount++;
	    newTet(Tcount, b12, p1, x142, d12); Tcount++;
	    newTet(Tcount, p1, e14, x142, d12); Tcount++;
	    newTet(Tcount, e14, v14, x142, d12); Tcount++;
	    /* start T 1 5 3 4 2 */
	    /* start T 1 4 4  */
	    newTet(Tcount, U2, u23, z14, t14); Tcount++;
	    newTet(Tcount, u23, U3, z14, t14); Tcount++;
	    newTet(Tcount, U3, b13, z14, t14); Tcount++;
	    newTet(Tcount, b13, p1, z14, t14); Tcount++;
	    newTet(Tcount, p1, b12, z14, t14); Tcount++;
	    newTet(Tcount, b12, U2, z14, t14); Tcount++;
	    newTet(Tcount, v14, e14, x143, t14); Tcount++;
	    newTet(Tcount, e14, p1, x143, t14); Tcount++;
	    newTet(Tcount, p1, b13, x143, t14); Tcount++;
	    newTet(Tcount, b13, U3, x143, t14); Tcount++;
	    newTet(Tcount, U3, v14, x143, t14); Tcount++;
	    newTet(Tcount, v14, e14, x142, t14); Tcount++;
	    newTet(Tcount, e14, p1, x142, t14); Tcount++;
	    newTet(Tcount, p1, b12, x142, t14); Tcount++;
	    newTet(Tcount, b12, U2, x142, t14); Tcount++;
	    newTet(Tcount, U2, v14, x142, t14); Tcount++;
	    newTet(Tcount, U2, v14, u23, t14); Tcount++;
	    newTet(Tcount, U3, v14, u23, t14); Tcount++;
	    /* end T 1 4  */
	    /* start T 2 1  */
	    newTet(Tcount, V2, v12, d24, e21); Tcount++;
	    newTet(Tcount, V2, v12, d23, e21); Tcount++;
	    newTet(Tcount, V2, p2, d24, e21); Tcount++;
	    newTet(Tcount, V2, p2, d23, e21); Tcount++;
	    newTet(Tcount, V2, p2, d23, e24); Tcount++;
	    newTet(Tcount, V2, v24, d23, e24); Tcount++;
	    newTet(Tcount, V2, v24, d21, e24); Tcount++;
	    newTet(Tcount, V2, p2, d21, e24); Tcount++;
	    newTet(Tcount, V2, p2, d21, e23); Tcount++;
	    newTet(Tcount, V2, v23, d21, e23); Tcount++;
	    newTet(Tcount, V2, v23, d24, e23); Tcount++;
	    newTet(Tcount, V2, p2, d24, e23); Tcount++;
	    /* end T 2 1  */
	    /* start T 2 2  */
	    newTet(Tcount, U1, u13, r2, q2); Tcount++;
	    newTet(Tcount, u13, U3, r2, q2); Tcount++;
	    newTet(Tcount, U3, u34, r2, q2); Tcount++;
	    newTet(Tcount, u34, U4, r2, q2); Tcount++;
	    newTet(Tcount, U4, u14, r2, q2); Tcount++;
	    newTet(Tcount, u14, U1, r2, q2); Tcount++;
	    newTet(Tcount, p2, b21, z24, q2); Tcount++;
	    newTet(Tcount, b21, U1, z24, q2); Tcount++;
	    newTet(Tcount, U1, u13, z24, q2); Tcount++;
	    newTet(Tcount, u13, U3, z24, q2); Tcount++;
	    newTet(Tcount, U3, b23, z24, q2); Tcount++;
	    newTet(Tcount, b23, p2, z24, q2); Tcount++;
	    newTet(Tcount, p2, b23, z21, q2); Tcount++;
	    newTet(Tcount, b23, U3, z21, q2); Tcount++;
	    newTet(Tcount, U3, u34, z21, q2); Tcount++;
	    newTet(Tcount, u34, U4, z21, q2); Tcount++;
	    newTet(Tcount, U4, b24, z21, q2); Tcount++;
	    newTet(Tcount, b24, p2, z21, q2); Tcount++;
	    newTet(Tcount, p2, b21, z23, q2); Tcount++;
	    newTet(Tcount, b21, U1, z23, q2); Tcount++;
	    newTet(Tcount, U1, u14, z23, q2); Tcount++;
	    newTet(Tcount, u14, U4, z23, q2); Tcount++;
	    newTet(Tcount, U4, b24, z23, q2); Tcount++;
	    newTet(Tcount, b24, p2, z23, q2); Tcount++;
	    /* end T 2 2  */
	    /* start T 2 3  */
	    newTet(Tcount, U1, u13, r2, w); Tcount++;
	    newTet(Tcount, u13, U3, r2, w); Tcount++;
	    newTet(Tcount, U3, u34, r2, w); Tcount++;
	    newTet(Tcount, u34, U4, r2, w); Tcount++;
	    newTet(Tcount, U4, u14, r2, w); Tcount++;
	    newTet(Tcount, u14, U1, r2, w); Tcount++;
	    /* end T 2 3  */
	    /* start T 2 4 1  */
	    newTet(Tcount, U3, u34, z21, t21); Tcount++;
	    newTet(Tcount, u34, U4, z21, t21); Tcount++;
	    newTet(Tcount, U4, b24, z21, t21); Tcount++;
	    newTet(Tcount, b24, p2, z21, t21); Tcount++;
	    newTet(Tcount, p2, b23, z21, t21); Tcount++;
	    newTet(Tcount, b23, U3, z21, t21); Tcount++;
	    newTet(Tcount, v12, e21, x214, t21); Tcount++;
	    newTet(Tcount, e21, p2, x214, t21); Tcount++;
	    newTet(Tcount, p2, b24, x214, t21); Tcount++;
	    newTet(Tcount, b24, U4, x214, t21); Tcount++;
	    newTet(Tcount, U4, v12, x214, t21); Tcount++;
	    newTet(Tcount, v12, e21, x213, t21); Tcount++;
	    newTet(Tcount, e21, p2, x213, t21); Tcount++;
	    newTet(Tcount, p2, b23, x213, t21); Tcount++;
	    newTet(Tcount, b23, U3, x213, t21); Tcount++;
	    newTet(Tcount, U3, v12, x213, t21); Tcount++;
	    newTet(Tcount, U3, v12, u34, t21); Tcount++;
	    newTet(Tcount, U4, v12, u34, t21); Tcount++;
	    /* end T 2 4  */
	    /* T5ing start T 2 5 1 3 4 */
	    newTet(Tcount, v12, U4, x214, d24); Tcount++;
	    newTet(Tcount, U4, b24, x214, d24); Tcount++;
	    newTet(Tcount, b24, p2, x214, d24); Tcount++;
	    newTet(Tcount, p2, e21, x214, d24); Tcount++;
	    newTet(Tcount, e21, v12, x214, d24); Tcount++;
	    newTet(Tcount, v23, U4, x234, d24); Tcount++;
	    newTet(Tcount, U4, b24, x234, d24); Tcount++;
	    newTet(Tcount, b24, p2, x234, d24); Tcount++;
	    newTet(Tcount, p2, e23, x234, d24); Tcount++;
	    newTet(Tcount, e23, v23, x234, d24); Tcount++;
	    /* start T 2 5 1 3 4 */
	    /* T5ing start T 2 5 1 4 3 */
	    newTet(Tcount, v12, U3, x213, d23); Tcount++;
	    newTet(Tcount, U3, b23, x213, d23); Tcount++;
	    newTet(Tcount, b23, p2, x213, d23); Tcount++;
	    newTet(Tcount, p2, e21, x213, d23); Tcount++;
	    newTet(Tcount, e21, v12, x213, d23); Tcount++;
	    newTet(Tcount, v24, U3, x243, d23); Tcount++;
	    newTet(Tcount, U3, b23, x243, d23); Tcount++;
	    newTet(Tcount, b23, p2, x243, d23); Tcount++;
	    newTet(Tcount, p2, e24, x243, d23); Tcount++;
	    newTet(Tcount, e24, v24, x243, d23); Tcount++;
	    /* start T 2 5 1 4 3 */
	    /* start T 2 4 3  */
	    newTet(Tcount, U1, u14, z23, t23); Tcount++;
	    newTet(Tcount, u14, U4, z23, t23); Tcount++;
	    newTet(Tcount, U4, b24, z23, t23); Tcount++;
	    newTet(Tcount, b24, p2, z23, t23); Tcount++;
	    newTet(Tcount, p2, b21, z23, t23); Tcount++;
	    newTet(Tcount, b21, U1, z23, t23); Tcount++;
	    newTet(Tcount, v23, e23, x234, t23); Tcount++;
	    newTet(Tcount, e23, p2, x234, t23); Tcount++;
	    newTet(Tcount, p2, b24, x234, t23); Tcount++;
	    newTet(Tcount, b24, U4, x234, t23); Tcount++;
	    newTet(Tcount, U4, v23, x234, t23); Tcount++;
	    newTet(Tcount, v23, e23, x231, t23); Tcount++;
	    newTet(Tcount, e23, p2, x231, t23); Tcount++;
	    newTet(Tcount, p2, b21, x231, t23); Tcount++;
	    newTet(Tcount, b21, U1, x231, t23); Tcount++;
	    newTet(Tcount, U1, v23, x231, t23); Tcount++;
	    newTet(Tcount, U1, v23, u14, t23); Tcount++;
	    newTet(Tcount, U4, v23, u14, t23); Tcount++;
	    /* end T 2 4  */
	    /* T5ing start T 2 5 3 4 1 */
	    newTet(Tcount, v23, U1, x231, d21); Tcount++;
	    newTet(Tcount, U1, b21, x231, d21); Tcount++;
	    newTet(Tcount, b21, p2, x231, d21); Tcount++;
	    newTet(Tcount, p2, e23, x231, d21); Tcount++;
	    newTet(Tcount, e23, v23, x231, d21); Tcount++;
	    newTet(Tcount, v24, U1, x241, d21); Tcount++;
	    newTet(Tcount, U1, b21, x241, d21); Tcount++;
	    newTet(Tcount, b21, p2, x241, d21); Tcount++;
	    newTet(Tcount, p2, e24, x241, d21); Tcount++;
	    newTet(Tcount, e24, v24, x241, d21); Tcount++;
	    /* start T 2 5 3 4 1 */
	    /* start T 2 4 4  */
	    newTet(Tcount, U1, u13, z24, t24); Tcount++;
	    newTet(Tcount, u13, U3, z24, t24); Tcount++;
	    newTet(Tcount, U3, b23, z24, t24); Tcount++;
	    newTet(Tcount, b23, p2, z24, t24); Tcount++;
	    newTet(Tcount, p2, b21, z24, t24); Tcount++;
	    newTet(Tcount, b21, U1, z24, t24); Tcount++;
	    newTet(Tcount, v24, e24, x243, t24); Tcount++;
	    newTet(Tcount, e24, p2, x243, t24); Tcount++;
	    newTet(Tcount, p2, b23, x243, t24); Tcount++;
	    newTet(Tcount, b23, U3, x243, t24); Tcount++;
	    newTet(Tcount, U3, v24, x243, t24); Tcount++;
	    newTet(Tcount, v24, e24, x241, t24); Tcount++;
	    newTet(Tcount, e24, p2, x241, t24); Tcount++;
	    newTet(Tcount, p2, b21, x241, t24); Tcount++;
	    newTet(Tcount, b21, U1, x241, t24); Tcount++;
	    newTet(Tcount, U1, v24, x241, t24); Tcount++;
	    newTet(Tcount, U1, v24, u13, t24); Tcount++;
	    newTet(Tcount, U3, v24, u13, t24); Tcount++;
	    /* end T 2 4  */
	    /* start T 3 1  */
	    newTet(Tcount, V3, v13, d34, e31); Tcount++;
	    newTet(Tcount, V3, v13, d32, e31); Tcount++;
	    newTet(Tcount, V3, p3, d34, e31); Tcount++;
	    newTet(Tcount, V3, p3, d32, e31); Tcount++;
	    newTet(Tcount, V3, p3, d32, e34); Tcount++;
	    newTet(Tcount, V3, v34, d32, e34); Tcount++;
	    newTet(Tcount, V3, v34, d31, e34); Tcount++;
	    newTet(Tcount, V3, p3, d31, e34); Tcount++;
	    newTet(Tcount, V3, p3, d31, e32); Tcount++;
	    newTet(Tcount, V3, v23, d31, e32); Tcount++;
	    newTet(Tcount, V3, v23, d34, e32); Tcount++;
	    newTet(Tcount, V3, p3, d34, e32); Tcount++;
	    /* end T 3 1  */
	    /* start T 3 2  */
	    newTet(Tcount, U1, u12, r3, q3); Tcount++;
	    newTet(Tcount, u12, U2, r3, q3); Tcount++;
	    newTet(Tcount, U2, u24, r3, q3); Tcount++;
	    newTet(Tcount, u24, U4, r3, q3); Tcount++;
	    newTet(Tcount, U4, u14, r3, q3); Tcount++;
	    newTet(Tcount, u14, U1, r3, q3); Tcount++;
	    newTet(Tcount, p3, b31, z34, q3); Tcount++;
	    newTet(Tcount, b31, U1, z34, q3); Tcount++;
	    newTet(Tcount, U1, u12, z34, q3); Tcount++;
	    newTet(Tcount, u12, U2, z34, q3); Tcount++;
	    newTet(Tcount, U2, b32, z34, q3); Tcount++;
	    newTet(Tcount, b32, p3, z34, q3); Tcount++;
	    newTet(Tcount, p3, b32, z31, q3); Tcount++;
	    newTet(Tcount, b32, U2, z31, q3); Tcount++;
	    newTet(Tcount, U2, u24, z31, q3); Tcount++;
	    newTet(Tcount, u24, U4, z31, q3); Tcount++;
	    newTet(Tcount, U4, b34, z31, q3); Tcount++;
	    newTet(Tcount, b34, p3, z31, q3); Tcount++;
	    newTet(Tcount, p3, b31, z32, q3); Tcount++;
	    newTet(Tcount, b31, U1, z32, q3); Tcount++;
	    newTet(Tcount, U1, u14, z32, q3); Tcount++;
	    newTet(Tcount, u14, U4, z32, q3); Tcount++;
	    newTet(Tcount, U4, b34, z32, q3); Tcount++;
	    newTet(Tcount, b34, p3, z32, q3); Tcount++;
	    /* end T 3 2  */
	    /* start T 3 3  */
	    newTet(Tcount, U1, u12, r3, w); Tcount++;
	    newTet(Tcount, u12, U2, r3, w); Tcount++;
	    newTet(Tcount, U2, u24, r3, w); Tcount++;
	    newTet(Tcount, u24, U4, r3, w); Tcount++;
	    newTet(Tcount, U4, u14, r3, w); Tcount++;
	    newTet(Tcount, u14, U1, r3, w); Tcount++;
	    /* end T 3 3  */
	    /* start T 3 4 1  */
	    newTet(Tcount, U2, u24, z31, t31); Tcount++;
	    newTet(Tcount, u24, U4, z31, t31); Tcount++;
	    newTet(Tcount, U4, b34, z31, t31); Tcount++;
	    newTet(Tcount, b34, p3, z31, t31); Tcount++;
	    newTet(Tcount, p3, b32, z31, t31); Tcount++;
	    newTet(Tcount, b32, U2, z31, t31); Tcount++;
	    newTet(Tcount, v13, e31, x314, t31); Tcount++;
	    newTet(Tcount, e31, p3, x314, t31); Tcount++;
	    newTet(Tcount, p3, b34, x314, t31); Tcount++;
	    newTet(Tcount, b34, U4, x314, t31); Tcount++;
	    newTet(Tcount, U4, v13, x314, t31); Tcount++;
	    newTet(Tcount, v13, e31, x312, t31); Tcount++;
	    newTet(Tcount, e31, p3, x312, t31); Tcount++;
	    newTet(Tcount, p3, b32, x312, t31); Tcount++;
	    newTet(Tcount, b32, U2, x312, t31); Tcount++;
	    newTet(Tcount, U2, v13, x312, t31); Tcount++;
	    newTet(Tcount, U2, v13, u24, t31); Tcount++;
	    newTet(Tcount, U4, v13, u24, t31); Tcount++;
	    /* end T 3 4  */
	    /* T5ing start T 3 5 1 2 4 */
	    newTet(Tcount, v13, U4, x314, d34); Tcount++;
	    newTet(Tcount, U4, b34, x314, d34); Tcount++;
	    newTet(Tcount, b34, p3, x314, d34); Tcount++;
	    newTet(Tcount, p3, e31, x314, d34); Tcount++;
	    newTet(Tcount, e31, v13, x314, d34); Tcount++;
	    newTet(Tcount, v23, U4, x324, d34); Tcount++;
	    newTet(Tcount, U4, b34, x324, d34); Tcount++;
	    newTet(Tcount, b34, p3, x324, d34); Tcount++;
	    newTet(Tcount, p3, e32, x324, d34); Tcount++;
	    newTet(Tcount, e32, v23, x324, d34); Tcount++;
	    /* start T 3 5 1 2 4 */
	    /* T5ing start T 3 5 1 4 2 */
	    newTet(Tcount, v13, U2, x312, d32); Tcount++;
	    newTet(Tcount, U2, b32, x312, d32); Tcount++;
	    newTet(Tcount, b32, p3, x312, d32); Tcount++;
	    newTet(Tcount, p3, e31, x312, d32); Tcount++;
	    newTet(Tcount, e31, v13, x312, d32); Tcount++;
	    newTet(Tcount, v34, U2, x342, d32); Tcount++;
	    newTet(Tcount, U2, b32, x342, d32); Tcount++;
	    newTet(Tcount, b32, p3, x342, d32); Tcount++;
	    newTet(Tcount, p3, e34, x342, d32); Tcount++;
	    newTet(Tcount, e34, v34, x342, d32); Tcount++;
	    /* start T 3 5 1 4 2 */
	    /* start T 3 4 2  */
	    newTet(Tcount, U1, u14, z32, t32); Tcount++;
	    newTet(Tcount, u14, U4, z32, t32); Tcount++;
	    newTet(Tcount, U4, b34, z32, t32); Tcount++;
	    newTet(Tcount, b34, p3, z32, t32); Tcount++;
	    newTet(Tcount, p3, b31, z32, t32); Tcount++;
	    newTet(Tcount, b31, U1, z32, t32); Tcount++;
	    newTet(Tcount, v23, e32, x324, t32); Tcount++;
	    newTet(Tcount, e32, p3, x324, t32); Tcount++;
	    newTet(Tcount, p3, b34, x324, t32); Tcount++;
	    newTet(Tcount, b34, U4, x324, t32); Tcount++;
	    newTet(Tcount, U4, v23, x324, t32); Tcount++;
	    newTet(Tcount, v23, e32, x321, t32); Tcount++;
	    newTet(Tcount, e32, p3, x321, t32); Tcount++;
	    newTet(Tcount, p3, b31, x321, t32); Tcount++;
	    newTet(Tcount, b31, U1, x321, t32); Tcount++;
	    newTet(Tcount, U1, v23, x321, t32); Tcount++;
	    newTet(Tcount, U1, v23, u14, t32); Tcount++;
	    newTet(Tcount, U4, v23, u14, t32); Tcount++;
	    /* end T 3 4  */
	    /* T5ing start T 3 5 2 4 1 */
	    newTet(Tcount, v23, U1, x321, d31); Tcount++;
	    newTet(Tcount, U1, b31, x321, d31); Tcount++;
	    newTet(Tcount, b31, p3, x321, d31); Tcount++;
	    newTet(Tcount, p3, e32, x321, d31); Tcount++;
	    newTet(Tcount, e32, v23, x321, d31); Tcount++;
	    newTet(Tcount, v34, U1, x341, d31); Tcount++;
	    newTet(Tcount, U1, b31, x341, d31); Tcount++;
	    newTet(Tcount, b31, p3, x341, d31); Tcount++;
	    newTet(Tcount, p3, e34, x341, d31); Tcount++;
	    newTet(Tcount, e34, v34, x341, d31); Tcount++;
	    /* start T 3 5 2 4 1 */
	    /* start T 3 4 4  */
	    newTet(Tcount, U1, u12, z34, t34); Tcount++;
	    newTet(Tcount, u12, U2, z34, t34); Tcount++;
	    newTet(Tcount, U2, b32, z34, t34); Tcount++;
	    newTet(Tcount, b32, p3, z34, t34); Tcount++;
	    newTet(Tcount, p3, b31, z34, t34); Tcount++;
	    newTet(Tcount, b31, U1, z34, t34); Tcount++;
	    newTet(Tcount, v34, e34, x342, t34); Tcount++;
	    newTet(Tcount, e34, p3, x342, t34); Tcount++;
	    newTet(Tcount, p3, b32, x342, t34); Tcount++;
	    newTet(Tcount, b32, U2, x342, t34); Tcount++;
	    newTet(Tcount, U2, v34, x342, t34); Tcount++;
	    newTet(Tcount, v34, e34, x341, t34); Tcount++;
	    newTet(Tcount, e34, p3, x341, t34); Tcount++;
	    newTet(Tcount, p3, b31, x341, t34); Tcount++;
	    newTet(Tcount, b31, U1, x341, t34); Tcount++;
	    newTet(Tcount, U1, v34, x341, t34); Tcount++;
	    newTet(Tcount, U1, v34, u12, t34); Tcount++;
	    newTet(Tcount, U2, v34, u12, t34); Tcount++;
	    /* end T 3 4  */
	    /* start T 4 1  */
	    newTet(Tcount, V4, v14, d43, e41); Tcount++;
	    newTet(Tcount, V4, v14, d42, e41); Tcount++;
	    newTet(Tcount, V4, p4, d43, e41); Tcount++;
	    newTet(Tcount, V4, p4, d42, e41); Tcount++;
	    newTet(Tcount, V4, p4, d42, e43); Tcount++;
	    newTet(Tcount, V4, v34, d42, e43); Tcount++;
	    newTet(Tcount, V4, v34, d41, e43); Tcount++;
	    newTet(Tcount, V4, p4, d41, e43); Tcount++;
	    newTet(Tcount, V4, p4, d41, e42); Tcount++;
	    newTet(Tcount, V4, v24, d41, e42); Tcount++;
	    newTet(Tcount, V4, v24, d43, e42); Tcount++;
	    newTet(Tcount, V4, p4, d43, e42); Tcount++;
	    /* end T 4 1  */
	    /* start T 4 2  */
	    newTet(Tcount, U1, u12, r4, q4); Tcount++;
	    newTet(Tcount, u12, U2, r4, q4); Tcount++;
	    newTet(Tcount, U2, u23, r4, q4); Tcount++;
	    newTet(Tcount, u23, U3, r4, q4); Tcount++;
	    newTet(Tcount, U3, u13, r4, q4); Tcount++;
	    newTet(Tcount, u13, U1, r4, q4); Tcount++;
	    newTet(Tcount, p4, b41, z43, q4); Tcount++;
	    newTet(Tcount, b41, U1, z43, q4); Tcount++;
	    newTet(Tcount, U1, u12, z43, q4); Tcount++;
	    newTet(Tcount, u12, U2, z43, q4); Tcount++;
	    newTet(Tcount, U2, b42, z43, q4); Tcount++;
	    newTet(Tcount, b42, p4, z43, q4); Tcount++;
	    newTet(Tcount, p4, b42, z41, q4); Tcount++;
	    newTet(Tcount, b42, U2, z41, q4); Tcount++;
	    newTet(Tcount, U2, u23, z41, q4); Tcount++;
	    newTet(Tcount, u23, U3, z41, q4); Tcount++;
	    newTet(Tcount, U3, b43, z41, q4); Tcount++;
	    newTet(Tcount, b43, p4, z41, q4); Tcount++;
	    newTet(Tcount, p4, b41, z42, q4); Tcount++;
	    newTet(Tcount, b41, U1, z42, q4); Tcount++;
	    newTet(Tcount, U1, u13, z42, q4); Tcount++;
	    newTet(Tcount, u13, U3, z42, q4); Tcount++;
	    newTet(Tcount, U3, b43, z42, q4); Tcount++;
	    newTet(Tcount, b43, p4, z42, q4); Tcount++;
	    /* end T 4 2  */
	    /* start T 4 3  */
	    newTet(Tcount, U1, u12, r4, w); Tcount++;
	    newTet(Tcount, u12, U2, r4, w); Tcount++;
	    newTet(Tcount, U2, u23, r4, w); Tcount++;
	    newTet(Tcount, u23, U3, r4, w); Tcount++;
	    newTet(Tcount, U3, u13, r4, w); Tcount++;
	    newTet(Tcount, u13, U1, r4, w); Tcount++;
	    /* end T 4 3  */
	    /* start T 4 4 1  */
	    newTet(Tcount, U2, u23, z41, t41); Tcount++;
	    newTet(Tcount, u23, U3, z41, t41); Tcount++;
	    newTet(Tcount, U3, b43, z41, t41); Tcount++;
	    newTet(Tcount, b43, p4, z41, t41); Tcount++;
	    newTet(Tcount, p4, b42, z41, t41); Tcount++;
	    newTet(Tcount, b42, U2, z41, t41); Tcount++;
	    newTet(Tcount, v14, e41, x413, t41); Tcount++;
	    newTet(Tcount, e41, p4, x413, t41); Tcount++;
	    newTet(Tcount, p4, b43, x413, t41); Tcount++;
	    newTet(Tcount, b43, U3, x413, t41); Tcount++;
	    newTet(Tcount, U3, v14, x413, t41); Tcount++;
	    newTet(Tcount, v14, e41, x412, t41); Tcount++;
	    newTet(Tcount, e41, p4, x412, t41); Tcount++;
	    newTet(Tcount, p4, b42, x412, t41); Tcount++;
	    newTet(Tcount, b42, U2, x412, t41); Tcount++;
	    newTet(Tcount, U2, v14, x412, t41); Tcount++;
	    newTet(Tcount, U2, v14, u23, t41); Tcount++;
	    newTet(Tcount, U3, v14, u23, t41); Tcount++;
	    /* end T 4 4  */
	    /* T5ing start T 4 5 1 2 3 */
	    newTet(Tcount, v14, U3, x413, d43); Tcount++;
	    newTet(Tcount, U3, b43, x413, d43); Tcount++;
	    newTet(Tcount, b43, p4, x413, d43); Tcount++;
	    newTet(Tcount, p4, e41, x413, d43); Tcount++;
	    newTet(Tcount, e41, v14, x413, d43); Tcount++;
	    newTet(Tcount, v24, U3, x423, d43); Tcount++;
	    newTet(Tcount, U3, b43, x423, d43); Tcount++;
	    newTet(Tcount, b43, p4, x423, d43); Tcount++;
	    newTet(Tcount, p4, e42, x423, d43); Tcount++;
	    newTet(Tcount, e42, v24, x423, d43); Tcount++;
	    /* start T 4 5 1 2 3 */
	    /* T5ing start T 4 5 1 3 2 */
	    newTet(Tcount, v14, U2, x412, d42); Tcount++;
	    newTet(Tcount, U2, b42, x412, d42); Tcount++;
	    newTet(Tcount, b42, p4, x412, d42); Tcount++;
	    newTet(Tcount, p4, e41, x412, d42); Tcount++;
	    newTet(Tcount, e41, v14, x412, d42); Tcount++;
	    newTet(Tcount, v34, U2, x432, d42); Tcount++;
	    newTet(Tcount, U2, b42, x432, d42); Tcount++;
	    newTet(Tcount, b42, p4, x432, d42); Tcount++;
	    newTet(Tcount, p4, e43, x432, d42); Tcount++;
	    newTet(Tcount, e43, v34, x432, d42); Tcount++;
	    /* start T 4 5 1 3 2 */
	    /* start T 4 4 2  */
	    newTet(Tcount, U1, u13, z42, t42); Tcount++;
	    newTet(Tcount, u13, U3, z42, t42); Tcount++;
	    newTet(Tcount, U3, b43, z42, t42); Tcount++;
	    newTet(Tcount, b43, p4, z42, t42); Tcount++;
	    newTet(Tcount, p4, b41, z42, t42); Tcount++;
	    newTet(Tcount, b41, U1, z42, t42); Tcount++;
	    newTet(Tcount, v24, e42, x423, t42); Tcount++;
	    newTet(Tcount, e42, p4, x423, t42); Tcount++;
	    newTet(Tcount, p4, b43, x423, t42); Tcount++;
	    newTet(Tcount, b43, U3, x423, t42); Tcount++;
	    newTet(Tcount, U3, v24, x423, t42); Tcount++;
	    newTet(Tcount, v24, e42, x421, t42); Tcount++;
	    newTet(Tcount, e42, p4, x421, t42); Tcount++;
	    newTet(Tcount, p4, b41, x421, t42); Tcount++;
	    newTet(Tcount, b41, U1, x421, t42); Tcount++;
	    newTet(Tcount, U1, v24, x421, t42); Tcount++;
	    newTet(Tcount, U1, v24, u13, t42); Tcount++;
	    newTet(Tcount, U3, v24, u13, t42); Tcount++;
	    /* end T 4 4  */
	    /* T5ing start T 4 5 2 3 1 */
	    newTet(Tcount, v24, U1, x421, d41); Tcount++;
	    newTet(Tcount, U1, b41, x421, d41); Tcount++;
	    newTet(Tcount, b41, p4, x421, d41); Tcount++;
	    newTet(Tcount, p4, e42, x421, d41); Tcount++;
	    newTet(Tcount, e42, v24, x421, d41); Tcount++;
	    newTet(Tcount, v34, U1, x431, d41); Tcount++;
	    newTet(Tcount, U1, b41, x431, d41); Tcount++;
	    newTet(Tcount, b41, p4, x431, d41); Tcount++;
	    newTet(Tcount, p4, e43, x431, d41); Tcount++;
	    newTet(Tcount, e43, v34, x431, d41); Tcount++;
	    /* start T 4 5 2 3 1 */
	    /* start T 4 4 3  */
	    newTet(Tcount, U1, u12, z43, t43); Tcount++;
	    newTet(Tcount, u12, U2, z43, t43); Tcount++;
	    newTet(Tcount, U2, b42, z43, t43); Tcount++;
	    newTet(Tcount, b42, p4, z43, t43); Tcount++;
	    newTet(Tcount, p4, b41, z43, t43); Tcount++;
	    newTet(Tcount, b41, U1, z43, t43); Tcount++;
	    newTet(Tcount, v34, e43, x432, t43); Tcount++;
	    newTet(Tcount, e43, p4, x432, t43); Tcount++;
	    newTet(Tcount, p4, b42, x432, t43); Tcount++;
	    newTet(Tcount, b42, U2, x432, t43); Tcount++;
	    newTet(Tcount, U2, v34, x432, t43); Tcount++;
	    newTet(Tcount, v34, e43, x431, t43); Tcount++;
	    newTet(Tcount, e43, p4, x431, t43); Tcount++;
	    newTet(Tcount, p4, b41, x431, t43); Tcount++;
	    newTet(Tcount, b41, U1, x431, t43); Tcount++;
	    newTet(Tcount, U1, v34, x431, t43); Tcount++;
	    newTet(Tcount, U1, v34, u12, t43); Tcount++;
	    newTet(Tcount, U2, v34, u12, t43); Tcount++;
	    /* end T 4 4  */
	    write("dictionary for tetrahedron " + t);
	    write("w= " +  w);
	    write("V1= " +  V1);
	    write("V2= " +  V2);
	    write("V3= " +  V3);
	    write("V4= " +  V4);
	    write("U1= " +  U1);
	    write("U2= " +  U2);
	    write("U3= " +  U3);
	    write("U4= " +  U4);
	    write("p1= " +  p1);
	    write("p2= " +  p2);
	    write("p3= " +  p3);
	    write("p4= " +  p4);
	    write("q1= " +  q1);
	    write("q2= " +  q2);
	    write("q3= " +  q3);
	    write("q4= " +  q4);
	    write("r1= " +  r1);
	    write("r2= " +  r2);
	    write("r3= " +  r3);
	    write("r4= " +  r4);
	    write("u12= " +  u12);
	    write("u13= " +  u13);
	    write("u14= " +  u14);
	    write("u23= " +  u23);
	    write("u24= " +  u24);
	    write("u34= " +  u34);
	    write("v12= " +  v12);
	    write("v13= " +  v13);
	    write("v14= " +  v14);
	    write("v23= " +  v23);
	    write("v24= " +  v24);
	    write("v34= " +  v34);
	    write("d12= " +  d12);
	    write("e12= " +  e12);
	    write("b12= " +  b12);
	    write("z12= " +  z12);
	    write("t12= " +  t12);
	    write("d13= " +  d13);
	    write("e13= " +  e13);
	    write("b13= " +  b13);
	    write("z13= " +  z13);
	    write("t13= " +  t13);
	    write("d14= " +  d14);
	    write("e14= " +  e14);
	    write("b14= " +  b14);
	    write("z14= " +  z14);
	    write("t14= " +  t14);
	    write("d21= " +  d21);
	    write("e21= " +  e21);
	    write("b21= " +  b21);
	    write("z21= " +  z21);
	    write("t21= " +  t21);
	    write("d23= " +  d23);
	    write("e23= " +  e23);
	    write("b23= " +  b23);
	    write("z23= " +  z23);
	    write("t23= " +  t23);
	    write("d24= " +  d24);
	    write("e24= " +  e24);
	    write("b24= " +  b24);
	    write("z24= " +  z24);
	    write("t24= " +  t24);
	    write("d31= " +  d31);
	    write("e31= " +  e31);
	    write("b31= " +  b31);
	    write("z31= " +  z31);
	    write("t31= " +  t31);
	    write("d32= " +  d32);
	    write("e32= " +  e32);
	    write("b32= " +  b32);
	    write("z32= " +  z32);
	    write("t32= " +  t32);
	    write("d34= " +  d34);
	    write("e34= " +  e34);
	    write("b34= " +  b34);
	    write("z34= " +  z34);
	    write("t34= " +  t34);
	    write("d41= " +  d41);
	    write("e41= " +  e41);
	    write("b41= " +  b41);
	    write("z41= " +  z41);
	    write("t41= " +  t41);
	    write("d42= " +  d42);
	    write("e42= " +  e42);
	    write("b42= " +  b42);
	    write("z42= " +  z42);
	    write("t42= " +  t42);
	    write("d43= " +  d43);
	    write("e43= " +  e43);
	    write("b43= " +  b43);
	    write("z43= " +  z43);
	    write("t43= " +  t43);
	    write("x123= " +  x123);
	    write("x124= " +  x124);
	    write("x132= " +  x132);
	    write("x134= " +  x134);
	    write("x142= " +  x142);
	    write("x143= " +  x143);
	    write("x213= " +  x213);
	    write("x214= " +  x214);
	    write("x231= " +  x231);
	    write("x234= " +  x234);
	    write("x241= " +  x241);
	    write("x243= " +  x243);
	    write("x312= " +  x312);
	    write("x314= " +  x314);
	    write("x321= " +  x321);
	    write("x324= " +  x324);
	    write("x341= " +  x341);
	    write("x342= " +  x342);
	    write("x412= " +  x412);
	    write("x413= " +  x413);
	    write("x421= " +  x421);
	    write("x423= " +  x423);
	    write("x431= " +  x431);
	    write("x432= " +  x432);
	    nV[U1] = "U" + U1;
	    nV[U2] = "U" + U2;
	    nV[U3] = "U" + U3;
	    nV[U4] = "U" + U4;
	}
	configuration = 0;
	loaded = true;
	tv.TV.configuration.select(0);
	title = "refined all T504";
        named = false;
	prepare();
	named = true;
	vN = new String[V];
	vC = new Color[V];
	for (int v = 0; v < V; v++) {
	    vN[v] = nV[v];
	    vC[v] = cV[v];
	}
	named = true;
	drawIt();
    }


    int bub() {
        int result = 0;
        if (!hashed) {
	    try {
		/* compute better upper bound */
		/* find center */ 
		int[] center = new int[3];
		int[] p = new int[3];
		int[] q = new int[3];
		int mmax = 1000;
		boolean success = true;
		for (int m = 2; m < mmax; m++) {
		    for (int i = 1; i < m; i++) {
			for (int j = i; j < m-i; j++) {
			    int k = m-i-j;
			    center[0] = i;
			    center[1] = j;
			    center[2] = k;
			    success = true;
			    for (int mu = 0; mu < TI; mu++) {
				int i1 = faces[mu][0];                
				int i2 = faces[mu][1];                
				int i3 = faces[mu][2];
				long x1 = vtcs[i1][0];
				long y1 = vtcs[i1][1];
				long z1 = vtcs[i1][2];
				long x2 = vtcs[i2][0];
				long y2 = vtcs[i2][1];
				long z2 = vtcs[i2][2];
				long x3 = vtcs[i3][0];
				long y3 = vtcs[i3][1];
				long z3 = vtcs[i3][2];
				long den = x1*y2*z3-x1*y3*z2-y1*x2*z3+y1*x3*z2+z1*x2*y3-z1*x3*y2;
				long b1 = i*y2*z3-i*y3*z2-j*x2*z3+j*x3*z2+k*x2*y3-k*x3*y2;
				long b2 = x1*j*z3-x1*y3*k-y1*i*z3+y1*x3*k+z1*i*y3-z1*x3*j;
				long b3 = x1*y2*k-x1*j*z2-y1*x2*k+y1*i*z2+z1*x2*j-z1*i*y2;
				long zero = b1 + b2 + b3;
				if ( (zero == 0 && den !=0) || (den == 0 && b1 == 0 && b2 == 0 && b3 == 0) ) {
				    success = false;
				    mu = TI;
				}
			    }
			    if (success) {
				i = mmax;
				j = mmax;
				m = mmax;
			    }
			}
		    }
		}
		if (!success) {
		    write(" upper bound error - no center");
		    return 0;
		}
		for (int i = 0; i < 3; i++) {
		    if (center[i] != 0) {
			int alpha = -center[i];
			int beta = center[0]*center[0] + center[1]*center[1] + center[2]*center[2];
			for (int j = 0; j < 3; j++) {
			    p[j] = alpha*center[j];
			}
			p[i] = p[i] + beta*center[i];
			i = 3;
		    }
		}
		int gcf = gcd(p[0],p[1]);
		gcf = gcd(gcf,p[2]);
		if (gcf > 1) {
		    p[0] = p[0]/gcf;
		    p[1] = p[1]/gcf;
		    p[2] = p[2]/gcf;
		}
		q[0] = center[1]*p[2] - center[2]*p[1];
		q[1] = center[2]*p[0] - center[0]*p[2];
		q[2] = center[0]*p[1] - center[1]*p[0];
		gcf = gcd(q[0],q[1]);
		gcf = gcd(gcf,q[2]);
		if (gcf > 1) {
		    q[0] = q[0]/gcf;
		    q[1] = q[1]/gcf;
		    q[2] = q[2]/gcf;
		}
		int[][] slopes = new int[TI][2];
		for (int i = 0; i < TI; i++) {
		    int i1 = faces[i][0];                
		    int i2 = faces[i][1];                
		    int i3 = faces[i][2];
		    int x1 = vtcs[i1][0];
		    int y1 = vtcs[i1][1];
		    int z1 = vtcs[i1][2];
		    int x2 = vtcs[i2][0];
		    int y2 = vtcs[i2][1];
		    int z2 = vtcs[i2][2];
		    int x3 = vtcs[i3][0];
		    int y3 = vtcs[i3][1];
		    int z3 = vtcs[i3][2];
		    int b3 = center[0]*(x2-x1)+center[1]*(y2-y1)+center[2]*(z2-z1);
		    int b2 = -(center[0]*(x3-x1)+center[1]*(y3-y1)+center[2]*(z3-z1));
		    int b1 = 1-b2-b3;
		    int[] u = new int[3];
		    u[0] = b1*x1 + b2*x2 + b3*x3 - x1;
		    u[1] = b1*y1 + b2*y2 + b3*y3 - y1;
		    u[2] = b1*z1 + b2*z2 + b3*z3 - z1;
		    gcf = gcd(u[0],u[1]);
		    gcf = gcd(gcf,u[2]);
		    u[0] = u[0]/gcf; 
		    u[1] = u[1]/gcf;
		    u[2] = u[2]/gcf;
		    int ptp = (p[0]*p[0]+p[1]*p[1]+p[2]*p[2]);
		    int qtq = (q[0]*q[0]+q[1]*q[1]+q[2]*q[2]);
		    int z = ptp*qtq;
		    u[0] = u[0]*z;
		    u[1] = u[1]*z;
		    u[2] = u[2]*z;
		    int y = (p[0]*u[0]+p[1]*u[1]+p[2]*u[2])/ptp;
		    int x = (q[0]*u[0]+q[1]*u[1]+q[2]*u[2])/qtq;
		    gcf = gcd(x,y);
		    x = x/gcf;
		    y = y/gcf;
		    slopes[i][0] = x;
		    slopes[i][1] = y;
		}
		int a = 0;
		int b = 0;
		int c = 0;
		for (int m = 2; m < mmax; m++) {
		    for (int i = 1; i < m; i++) {
			int j = i-m;
			success = true;
			for (int mu = 0; mu < TI; mu++) {
			    if (i*slopes[mu][1] - j*slopes[mu][0] == 0) {
				success = false;
				mu = TI;
			    }
			}
			if (success) {
			    a = -j;
			    b = i;
			    c = -a*b;
			    m = mmax;
			    i = mmax;
			}
		    }
		}
		if (!success) {
		    write(" upper bound error - no line");
		    return 0;
		}
		/* The line in question is ax + by -ab = 0 */
		/* we intersect with the line Ax = By where A =g slopes[][1] 
		   and B = slopes[][0]  
		   intersection point is xi = Ba/(Ab+Ba) */
		int[][] points = new int[TI][2];
		for (int i = 0; i < TI; i++) {
		    int B = slopes[i][1];
		    int A = slopes[i][0];
		    points[i][0] = B*a;
		    points[i][1] = A*b+B*a;
		    if (points[i][1] < 0) {
			points[i][0] = -points[i][0];
			points[i][1] = -points[i][1];
		    }
		    gcf = gcd(points[i][0],points[i][1]);
		    if (gcf > 1) {
			points[i][0] = points[i][0]/gcf;
			points[i][1] = points[i][1]/gcf;
		    }
		    if (points[i][1] == 0) {
			write("upper bound error, infinite point");
		    }
		}
		result = (9*d*r + 6*d + 5*r + 6 + 3*d*r*r - 2*r*r*r - 3*r*r)/6;
		for (int delta = r+1; delta <=d; delta++) {
		    /* set up and analyze linear system */
		    int Neqs = (r+1)*TI;
		    int Nvars = N*(delta+1);
		    int[][] A = new int[Neqs][Nvars];
		    int neq = 0;
		    for (int face = 0; face < TI; face++) {
			int t1 = tetrahedron(faces[face][0],faces[face][1],faces[face][2],faces[face][3]);
			int t2 = tetrahedron(faces[face][0],faces[face][1],faces[face][2],faces[face][4]);
			int eta = points[face][0];
			int kappa = points[face][1];
			for (int i = 0; i <=r; i++) {
			    for (int j = i; j <= delta; j++) {
				int alpha = t1*(delta+1)+j;
				int beta = t2*(delta+1)+j;
				A[neq][alpha] = 1;
				A[neq][beta] = -1;
				for (int mu = j-i+1; mu <= delta-i; mu++) {
				    A[neq][alpha] = mod(prod(A[neq][alpha],mu));
				    A[neq][beta] = mod(prod(A[neq][beta],mu));
				}
				for (int mu = 0; mu < delta-j; mu++) {
				    A[neq][alpha] = mod(prod(A[neq][alpha],eta));
				    A[neq][beta] = mod(prod(A[neq][beta],eta));
				}
				for (int mu = 0; mu < j-i; mu++) {
				    A[neq][alpha] = mod(prod(A[neq][alpha],kappa));
				    A[neq][beta] = mod(prod(A[neq][beta],kappa));
				}
			    }
			    neq++;
			}
		    }
		    /* now analyze it ... */
		    int[] rows = new int[Neqs];
		    int[] cols = new int[Nvars];
		    for (int i = 0; i < Neqs ; i++) {
			rows[i] = i;
		    }
		    for (int i = 0; i < Nvars ; i++) {
			cols[i] = i;
		    }
		    int m = min(Neqs,Nvars);
		    for (int k = 0; k < m; k++) {
			/* k-th elimination stage - do total pivoting */
			int jpivot = -1, ipivot = -1;
			for (int j = k; j < Nvars; j++) {
			    int jcol = cols[j];
			    for (int i = k; i < Neqs; i++) {
				int irow = rows[i];
				if (A[irow][jcol] != 0) {
				    ipivot = i;
				    jpivot = j;
				    i = Neqs;
				    j = Nvars;
				}
			    }
			}
			if (jpivot == -1) {
			    m = k;
			    k = Neqs;
			    /* elimination is done --- exit */
			}
			else {
			    int dummy = rows[k];
			    rows[k] = rows[ipivot];
			    rows[ipivot] = dummy;
			    dummy = cols[k];
			    cols[k] = cols[jpivot];
			    cols[jpivot] = dummy;
			    int krow = rows[k];
			    int kcol = cols[k];
			    int pivot = A[krow][kcol];
			    for (int i = k+1; i < Neqs; i++) {
				int irow = rows[i];
				if (A[irow][kcol] != 0) {
				    int multiplier = A[irow][kcol];
				    A[irow][kcol] = 0;
				    for (int j=k+1; j < Nvars; j++) {
					int jcol = cols[j];
					A[irow][jcol] = 
					    mod(minus(mod(prod(pivot,A[irow][jcol])),
						      mod(prod(multiplier,A[krow][jcol]))));
				    }
				}
			    }
			}
		    }
		    int dim = Nvars-m;
		    result = result + dim*(d-delta+1);
		}
	    }
	    catch(Exception e) {write(" upper bound error ");e.printStackTrace(); result = 0;}
	    catch(Error e) {write(" upper bound error ");e.printStackTrace(); result = 0;}
	}
        return result;
    }

    void Code() {
        String file = "";
        String ml = "";
	try {
	    file = tv.fileName.getText() + ".code";
	    PrintWriter out = new PrintWriter(new FileOutputStream(file));
	    write(" writing code file " + file);
            ml = tv.fileName.getText() + ".m";
	    out.println(N + " <--- tetrahedra");
	    out.println(VB + " <--- boundary vertices");
	    out.println(VI + " <--- interior vertices");
	    out.println(EB + " <--- boundary edges");
	    out.println(EI + " <--- interior edges");
	    out.println(TB + " <--- boundary faces");
	    out.println(TI + " <--- interior faces");
	    out.println(Nvars + " <--- active domain points ");
	    out.println(active + " <--- active points in a MDS");
	    out.println((Nvars - active) + " <--- number of points to be determined");
	    out.println(r + " <--- smoothness degree r ");
	    out.println(d + " <--- polynomial degree d ");
	    for (int i = 4; i < V; i++) {
		long x = vtcs[i][0];
		long y = vtcs[i][1];
		long z = vtcs[i][2];
		long x0 = vtcs[0][0];
		long y0 = vtcs[0][1];
		long z0 = vtcs[0][2];
		long x1 = vtcs[1][0];
		long y1 = vtcs[1][1];
		long z1 = vtcs[1][2];
		long x2 = vtcs[2][0];
		long y2 = vtcs[2][1];
		long z2 = vtcs[2][2];
		long x3 = vtcs[3][0];
		long y3 = vtcs[3][1];
		long z3 = vtcs[3][2];
		long denom=x1*y2*z3-x1*y3*z2-y1*x2*z3+y1*x3*z2+z1*x2*y3-z1*x3*y2-x0*y2*z3+x0*y3*z2+x0*y1*z3-x0*y1*z2-x0*z1*y3+x0*z1*y2+y0*x2*z3-y0*x3*z2-y0*x1*z3+y0*x1*z2+y0*z1*x3-y0*z1*x2-z0*x2*y3+z0*x3*y2+z0*x1*y3-z0*x1*y2-z0*y1*x3+z0*y1*x2;
		if (denom == 0) {
		    write (" V0, V1, V2, V3 are colinear ");
		    out.println(" V0, V1, V2, V2 are colinear ");
		}
		else {
		    long b0 = x1*y2*z3-x1*y3*z2-y1*x2*z3+y1*x3*z2+z1*x2*y3-z1*x3*y2-x*y2*z3+x*y3*z2+x*y1*z3-x*y1*z2-x*z1*y3+x*z1*y2+y*x2*z3-y*x3*z2-y*x1*z3+y*x1*z2+y*z1*x3-y*z1*x2-z*x2*y3+z*x3*y2+z*x1*y3-z*x1*y2-z*y1*x3+z*y1*x2;
		    long b1 = -x0*y2*z3+x0*y3*z2+z0*x3*y2-z0*x2*y3-y0*x3*z2+y0*x2*z3+x*y2*z3-x*y3*z2-x*y0*z3+x*z0*y3+x*y0*z2-x*z0*y2+y*x0*z3-y*z2*x0-y*x2*z3+y*z0*x2+y*x3*z2-y*z0*x3-z*y3*x0+z*y2*x0-z*y0*x2+z*x2*y3-z*x3*y2+z*y0*x3;
		    long b2 = x0*y1*z3-x0*z1*y3-z0*y1*x3+y0*z1*x3+z0*x1*y3-y0*x1*z3+x*y0*z3-x*y1*z3-x*y0*z1+x*z0*y1-x*z0*y3+x*z1*y3-y*x0*z3+y*z1*x0+y*z0*x3-y*z1*x3-y*z0*x1+y*x1*z3-z*x1*y3+z*y3*x0+z*y0*x1+z*y1*x3-z*y1*x0-z*y0*x3;
		    long b3 = -x0*y1*z2+x0*z1*y2-z0*x1*y2+y0*x1*z2-y0*z1*x2+z0*y1*x2-x*z1*y2+x*z0*y2-x*z0*y1+x*y1*z2-x*y0*z2+x*y0*z1-y*x1*z2+y*z2*x0+y*z0*x1+y*z1*x2-y*z1*x0-y*z0*x2+z*x1*y2-z*y2*x0-z*y0*x1-z*y1*x2+z*y1*x0+z*y0*x2;
		    double B0 = ((double) b0) / ((double) denom);
		    double B1 = ((double) b1) / ((double) denom);
		    double B2 = ((double) b2) / ((double) denom);
		    double B3 = ((double) b3) / ((double) denom);
		    out.println(B0  + "\n" + B1 + "\n" + B2 + "\n" + B3 + " <--- bcs for V" + i);
                    if (abs(B0+B1+B2+B3-1) > 0.000000000001) {
			String s = " BC calculation overflow --- sum = " + (B0+B1+B2+B3);
                        out.println(s);
                        write(s);
		    }
		}
	    }
	    for (int i = 0; i < N; i++) {
		out.println(tets[i][0] + " " + tets[i][1] + " " +  tets[i][2] + " "  + tets[i][3] + " <--- tetrahedron " + i);
	    }
	    for (int i = 0; i < Nvars; i++) {
		String line = "";
		for (int j = 0; j < V; j++) {
		    line = line + " " + dps[i][j] ;
		}
		out.println(line + " <--- " + i + "-th coefficient " + cName(i));
	    }
	    for (int i = 0; i < Nvars-active; i++) {
		out.println(I[i] + " <--- point " + i + " to be determined");
	    }
	    for (int i = 0; i < active; i++) {
		out.println(M[i] + " <--- point " + i + " in MDS");
	    }
	    for (int i = 0; i < neq; i++) {
		double size = 0.0;
		for (int j = 0; j < Nvars; j++) {
		    if (size < java.lang.Math.abs(AD[i][j])) {
			size = java.lang.Math.abs(AD[i][j]);
		    }
		}
		if (size > 0.0) {
		    for (int j = 0; j < Nvars; j++) { 
			AD[i][j] = AD[i][j]/size;
		    }
		}
		/* check */
		double zero = 0.0;
		for (int j = 0; j < Nvars; j++) { 
		    zero = AD[i][j] + zero;
		}
	    }
	    /* Gauss-Jordan Elimination 
	       rows[i]: physical index of equation that goes with the i-th element of the determined set
	       kk = I[k], physical index of the column going with the k-th element of the determined set.
	       Neqs physical number of rows in AD
	       m: number of points to be determined
	       active: number of active points in the MDS, M[i], 0 <= i < active
	       pivot: physical row of pivot element

	    */
	    int m = Nvars - active;
	    int rows[] = new int[Neqs];
	    for (int i = 0; i < Neqs; i++) {
		rows[i] = i;
	    }
	    /* reduce to triangular: */
	    mess("reducing to triangular form",Color.blue); 
	    for (int k = 0; k < m; k++) {
		bar(k,m,Color.gray,Color.yellow);
		int kk = I[k];
		int pivot = k;
		double pivotSize = java.lang.Math.abs(AD[rows[pivot]][kk]);
		for (int i = k+1; i < Neqs; i++) {
		    if (pivotSize < java.lang.Math.abs(AD[rows[i]][kk])) {
			pivot = i;
			pivotSize = java.lang.Math.abs(AD[rows[i]][kk]);
		    }
		}
		int dummy = rows[pivot];
		rows[pivot] = rows[k];
		rows[k] = dummy;
		for (int i = k+1; i < Neqs; i++) {
		    if (AD[rows[i]][kk] != 0.0) {
			double multiplier = -AD[rows[i]][kk]/AD[rows[k]][kk];
			for (int j = k+1; j < m; j++) {
			    AD[rows[i]][I[j]] = AD[rows[i]][I[j]] + multiplier*AD[rows[k]][I[j]];
			}
			for (int j = 0; j < active; j++) {
			    AD[rows[i]][M[j]] = AD[rows[i]][M[j]] + multiplier*AD[rows[k]][M[j]];
			}
		    }
		}
	    }
	    /* reduce to diagonal */		       
	    mess("back substitution", Color.blue);
	    for (int k = m-1; k >=0; k--) {
		bar(k,m,Color.green,Color.gray);
		for (int i = 0; i < k; i++) {
		    if (AD[rows[i]][I[k]] != 0.0) {
			double multiplier =  -AD[rows[i]][I[k]]/AD[rows[k]][I[k]];
			for (int j = 0; j < active; j++) {
			    AD[rows[i]][M[j]] = AD[rows[i]][M[j]] + multiplier*AD[rows[k]][M[j]];
			}
		    }
		}
		for (int j = 0; j < active; j++) {
		    AD[rows[k]][M[j]] = - AD[rows[k]][M[j]] / AD[rows[k]][I[k]];
		}
	    }
	    double unit = 1.0;
	    while (1.0 + unit > 1.0) {
		unit = unit/2.0;
	    }
            unit *= 2.0;
	    /* count nonzero entries */
	    int nonzero = 0;
	    for (int i = 0; i < m; i++) {
		for (int j = 0; j < active; j++) {
		    if (java.lang.Math.abs(AD[rows[i]][M[j]]) > unit ) {
			nonzero++;
		    }
                    else {
			AD[rows[i]][M[j]] = 0.0;
		    }
		}
	    }
	    out.println(nonzero + " <--- number of non-zero entries");
	    /* print nonzero entries */
	    double norm = 0.0;
	    double error = 0.0;
	    int count = 0;
	    mess("writing results",Color.blue);
	    for (int i = 0; i < m; i++) {
		double rowsum = 0.0;
		double one = -1.0;
		for (int j = 0; j < active; j++) {
		    if (AD[rows[i]][M[j]] != 0.0 ) {
			out.println(I[i] + " " + M[j] + " " + AD[rows[i]][M[j]] + " <--- " + count);
			rowsum = rowsum + java.lang.Math.abs(AD[rows[i]][M[j]]);
			one = one + AD[rows[i]][M[j]];
			count++;
		    }
		}
		if (norm < rowsum) {
		    norm = rowsum;
		}
		if (error < java.lang.Math.abs(one)) {
		    error = java.lang.Math.abs(one); 
		}
	    }
	    out.println(norm + " <--- infinity norm of transformation matrix");
	    out.println(error + " <--- max deviation of line sum from 1 in transformation matrix");
	    write(" wrote floating point to " + file + 
		  ",\n norm of transformation matrix is " + norm +
		  "\n max deviation of line sum from 1 in transformation matrix = " + error);
	    write (" round-off unit = " + unit);
	    out.println(unit + " <--- round-off unit");
	    double density = ((double) nonzero)/((double)(Neqs*Nvars));
	    out.println(density + " <--- density");
	    mess(" wrote code file " + file);
	    out.close();
	}
	catch (Exception e) {
	    write(" cannot write code file " + file);
	    e.printStackTrace();
	}
    }

    double dp(int x) {
	x = mod(x,P);
        if (x > P/2) {
	    x = x - P;
	}
        return (double) x;
    }

    void defaultVertexNames() {
        named = false;
	vColor();
        drawIt();
    }

    void listNames() {
        write(" vertex names: ");
        for (int v = 0; v < V; v++) {
	    String s = v+": ";
            s += cName(v,0) + " ";
            s += cName(v,1) + " ";
            s += cName(v,2) + " ";
            s += cName(v,3) + " ";
	    write(s);
	}
    }

    long Lbinom(int rho, int mu, int nu, int kappa, int delta) {
        long result = 1;
        if (rho > 20) { 
	    int[] Rho = new int[1], Mu = new int[1], Nu = new int[1], Kappa = new int[1], Delta = new int[1];
	    if (rho > 0) {Rho = new int[rho]; for (int j = 1; j < rho; j++) {Rho[j] = j+1;}   }
	    if (mu > 0) {Mu = new int[mu]; for (int j = 1; j < mu; j++) {Mu[j] = j+1;}   }
	    if (nu > 0) {Nu = new int[nu]; for (int j = 1; j < nu; j++) {Nu[j] = j+1;}   }
	    if (kappa > 0) {Kappa = new int[kappa]; for (int j = 1; j < kappa; j++) {Kappa[j] = j+1;}   }
	    if (delta > 0) {Delta = new int[delta]; for (int j = 1; j < delta; j++) {Delta[j] = j+1;}   }
	    if (rho > 0) {
		int rhoCount = 2;
		boolean done = false;
		while (!done) {
		    done = true;
		    if (mu > 0 ) { for (int j = 0; j < mu; j++) {if (Mu[j] > 0 && result % Mu[j] == 0) {result /= Mu[j]; Mu[j] = 0; done = false; }}}
		    if (nu > 0 ) { for (int j = 0; j < nu; j++) {if (Nu[j] > 0 && result % Nu[j] == 0) {result /= Nu[j]; Nu[j] = 0; done = false; }}}
		    if (kappa > 0 ) { for (int j = 0; j < kappa; j++) {if (Kappa[j] > 0 && result % Kappa[j] == 0) {result /= Kappa[j]; Kappa[j] = 0; done = false; }}}
		    if (delta > 0 ) { for (int j = 0; j < delta; j++) {if (Delta[j] > 0 && result % Delta[j] == 0) {result /= Delta[j]; Delta[j] = 0; done = false; }}}      
		    if (rhoCount <= rho) { result *= rhoCount; rhoCount++; done = false;}
		}
	    }
	}
        else {
	    result = fac(rho)/fac(mu)/fac(nu)/fac(kappa)/fac(delta);
	}
        return result;
    }
}
