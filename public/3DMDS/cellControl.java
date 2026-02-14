import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;
import java.net.*;

public class cellControl extends Frame 
    implements ActionListener, ItemListener, Serializable {
    Panel Panel0;
    Label Banner; 
    TextField Status;    
    cell[] C;

    Panel Panel1;
    Panel Panel1a;
    Button degMinMinus, degMinPlus, degMaxMinus, degMaxPlus,
    VBMinMinus, VBMinPlus, VBMaxMinus, VBMaxPlus; 
    TextField tMinDegree, tMaxDegree, tMinVB, tMaxVB;
    int minDegree, maxDegree, minVB, maxVB;
    int MaxDegree = 2147483647;
    int MaxVB = 2147483647;    
    Button howmany;
    Button Sharp; boolean sharp = false;
    Panel Panel2;
    Button hide;
    Button Load;
    Choice points;
    TextField tn;
    Button nPlus, nMinus;
    Button NPlus, NMinus;
    Button NPLUS, NMINUS;
    Button show;
    Button Report;
    Button nice;
    Button reset;
    Button center;
    int n = 0;
    int N = 0;
    TextField Enlarge;

    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);

    public cellControl() {
	String banner = " cells status: ";
	Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0 = new Panel();
        Panel0.add(Banner);
        Status = new TextField(40);
        Status.setText(" no cells loaded ");
        Status.setBackground(Color.white);
        Status.setForeground(new Color(0,0,155));
        Panel0.add(Status);
        Panel1 = new Panel();
        Panel1a = new Panel();
        Panel2 = new Panel();
        hide = new Button("hide");
        hide.setBackground(new Color(200,0,0));
        hide.setForeground(Color.white);
        hide.addActionListener(this); 
        Panel1.add(hide);
        Load = new Button("Load");
        Load.setBackground(new Color(0,0,100));
        Load.setForeground(Color.white);
        Load.addActionListener(this); 
        Panel1.add(Load);
        points = new Choice();
        points.add("4 boundary points");
        points.add("5 boundary points");
        points.add("6 boundary points");
        points.add("7 boundary points");
        points.add("8 boundary points");
        points.add("9 boundary points");
        points.add("10 boundary points");
        points.add("11 boundary points");
        points.add("12 boundary points");
        points.add("13 boundary points");
        points.add("14 boundary points");
        points.add("15 boundary points");
        points.add("16 boundary points");
        points.add("17 boundary points");
        points.add("18 boundary points");
        points.select(5);
        Panel1.add(points);
        NMINUS = new Button("<<");
        NMINUS.setBackground(Color.red);
        NMINUS.setForeground(Color.black);
        NMINUS.addActionListener(this); 
	Panel1.add(NMINUS);
        NMinus = new Button("<");
        NMinus.setBackground(Color.red);
        NMinus.setForeground(Color.black);
        NMinus.addActionListener(this); 
	Panel1.add(NMinus);
        nMinus = new Button("<");
        nMinus.setBackground(buttonBackground);
        nMinus.setForeground(buttonForeground);
        nMinus.addActionListener(this); 
	Panel1.add(nMinus);
        tn = new TextField(5);
        tn.setBackground(textBackground);        
        tn.setForeground(textForeground);        
        tn.setText(" "+0);
        tn.addActionListener(this); 
        Panel1.add(tn);
        nPlus = new Button(">");
        nPlus.setBackground(buttonBackground);
        nPlus.setForeground(buttonForeground);
        nPlus.addActionListener(this); 
	Panel1.add(nPlus);
        NPlus = new Button(">");
        NPlus.setBackground(Color.red);
        NPlus.setForeground(Color.black);
        NPlus.addActionListener(this); 
	Panel1.add(NPlus);
        NPLUS = new Button(">>");
        NPLUS.setBackground(Color.red);
        NPLUS.setForeground(Color.black);
        NPLUS.addActionListener(this); 
	Panel1.add(NPLUS);
        show = new Button("show");
        show.setBackground(Color.red);
        show.setForeground(Color.white);
        show.addActionListener(this); 
	Panel1.add(show);
        Sharp = new Button("inclusive");
        Sharp.setBackground(Color.yellow);
        Sharp.setForeground(Color.red);
        Sharp.addActionListener(this); 
	Panel1a.add(Sharp);
        degMinMinus = new Button("<");
        degMinMinus.setBackground(buttonBackground);
        degMinMinus.setForeground(buttonForeground);
        degMinMinus.addActionListener(this); 
	Panel1a.add(degMinMinus);
        tMinDegree = new TextField(3);
        tMinDegree.setBackground(textBackground);        
        tMinDegree.setForeground(textForeground);        
        minDegree = 3;
        tMinDegree.setText(" "+minDegree);
        tMinDegree.addActionListener(this); 
        Panel1a.add(tMinDegree);
        degMinPlus = new Button(">");
        degMinPlus.setBackground(buttonBackground);
        degMinPlus.setForeground(buttonForeground);
        degMinPlus.addActionListener(this); 
	Panel1a.add(degMinPlus);
        Label deg = new Label(" <= degree <= ");
        Panel1a.add(deg);
        degMaxMinus = new Button("<");
        degMaxMinus.setBackground(buttonBackground);
        degMaxMinus.setForeground(buttonForeground);
        degMaxMinus.addActionListener(this); 
	Panel1a.add(degMaxMinus);
        tMaxDegree = new TextField(3);
        tMaxDegree.setBackground(textBackground);        
        tMaxDegree.setForeground(textForeground);        
        maxDegree = 99;
        tMaxDegree.setText(" "+99);
        tMaxDegree.addActionListener(this); 
        Panel1a.add(tMaxDegree);
        degMaxPlus = new Button(">");
        degMaxPlus.setBackground(buttonBackground);
        degMaxPlus.setForeground(buttonForeground);
        degMaxPlus.addActionListener(this); 
	Panel1a.add(degMaxPlus);
        howmany = new Button(" how many? ");
        howmany.setBackground(new Color(0,0,127));
        howmany.setForeground(Color.white);
        howmany.addActionListener(this); 
	Panel1a.add(howmany);
        VBMinMinus = new Button("<");
        VBMinMinus.setBackground(buttonBackground);
        VBMinMinus.setForeground(buttonForeground);
        VBMinMinus.addActionListener(this); 
	Panel1a.add(VBMinMinus);
        tMinVB = new TextField(3);
        tMinVB.setBackground(textBackground);        
        tMinVB.setForeground(textForeground);        
        minVB = 4;
        tMinVB.setText(" "+minVB);
        tMinVB.addActionListener(this); 
        Panel1a.add(tMinVB);
        VBMinPlus = new Button(">");
        VBMinPlus.setBackground(buttonBackground);
        VBMinPlus.setForeground(buttonForeground);
        VBMinPlus.addActionListener(this); 
	Panel1a.add(VBMinPlus);
        Label VBl = new Label(" <= VB <= ");
        Panel1a.add(VBl);
        VBMaxMinus = new Button("<");
        VBMaxMinus.setBackground(buttonBackground);
        VBMaxMinus.setForeground(buttonForeground);
        VBMaxMinus.addActionListener(this); 
	Panel1a.add(VBMaxMinus);
        tMaxVB = new TextField(3);
        tMaxVB.setBackground(textBackground);        
        tMaxVB.setForeground(textForeground);        
        maxVB = 99;
        tMaxVB.setText(" "+99);
        tMaxVB.addActionListener(this); 
        Panel1a.add(tMaxVB);
        VBMaxPlus = new Button(">");
        VBMaxPlus.setBackground(buttonBackground);
        VBMaxPlus.setForeground(buttonForeground);
        VBMaxPlus.addActionListener(this); 
	Panel1a.add(VBMaxPlus);
        Report = new Button("Report");
        Report.setBackground(Color.magenta);
        Report.setForeground(Color.white);
        Report.addActionListener(this); 
	Panel2.add(Report);
        nice = new Button("nice");
        nice.setBackground(Color.blue);
        nice.setForeground(Color.white);
        nice.addActionListener(this); 
	Panel2.add(nice);
        center = new Button("center");
        center.setBackground(Color.blue);
        center.setForeground(Color.white);
        center.addActionListener(this); 
	Panel2.add(center);
        reset = new Button("reset");
        reset.setBackground(Color.blue);
        reset.setForeground(Color.white);
        reset.addActionListener(this); 
	Panel2.add(reset);
	Label enlrg = new Label("enlarge:");
        enlrg.setForeground(fg);
        enlrg.setBackground(bg);
        Panel2.add(enlrg);
        Enlarge = new TextField(5);
        Enlarge.setText("");
        Enlarge.setBackground(Color.white);
        Enlarge.setForeground(new Color(0,0,155));
        Enlarge.addActionListener(this); 
        Panel2.add(Enlarge);

	setLayout(new GridLayout(4,1));
        add(Panel0);
        add(Panel1);
        add(Panel1a);
        add(Panel2);
        setBackground(new Color(255,255,210));
        setSize(850,200);
        setTitle("Cell Control");
        setVisible(true);
        N = 1;
        C = new cell[N];
        C[0] = cell.origin();
        C[0].init();
        showIt();
    }

    public int getInt(TextField where, int dflt, int low, int high) {
	int result;
	try{ result = Integer.parseInt(where.getText().trim()); }
	catch (NumberFormatException e) { result = dflt; write("did not parse "+where.getText()); };
	if (result < low) result = low;
	if (result > high) result = high;
	where.setText(String.valueOf(result));
	return result;
    }

    public void loadIt() {
	setCursor(java.awt.Cursor.getPredefinedCursor(java.awt.Cursor.WAIT_CURSOR));
	int which = points.getSelectedIndex();
	which = which + 4;
        String label = " loading " + which + " boundary vertices ";
        which++;
        if (which > 11) label = label + " --- be patient ";
        Status.setText(label);
	String s = "http://www.math.utah.edu/~pa/3DMDS/cells." + which;
        try{
	    URL url = new URL(s);
	    ObjectInputStream in = new ObjectInputStream(url.openStream());
	    C = (cell[]) in.readObject();
	    N = 1;
	    if (which >= 6) { N = N + 1; }
	    if (which >= 7) { N = N + 2; }
	    if (which >= 8) { N = N + 5; }
	    if (which >= 9) { N = N + 13; }
	    if (which >= 10) { N = N + 33; }
	    if (which >= 11) { N = N + 85; }
	    if (which >= 12) { N = N + 199; }
	    if (which >= 13) { N = N + 437; }
	    if (which >= 14) { N = N + 936; }
	    if (which >= 15) { N = N + 1878; }
	    if (which >= 16) { N = N + 3674; }
	    if (which >= 17) { N = N + 6910; }
	    if (which >= 18) { N = N + 12638; }
	    if (which == 19) { N = N + 22536; }
	    Status.setText(" loaded " + N + " cells");
            if (n >= N) {
		n = 0;
                tn.setText("" + n);
	    }
	    MaxDegree = 0;
	    MaxVB = C[N-1].V-1;
            for (int i = 0; i < N; i++) {
                if (C[i].maxDegree > MaxDegree) {
		    MaxDegree = C[i].maxDegree;
		}
	    }
            maxDegree = MaxDegree;
            maxVB = MaxVB;
            tMaxDegree.setText(""+maxDegree);
            tMaxVB.setText(""+maxVB);
	}
        catch(java.io.IOException e) { 
            write(""+e); 
            Status.setText(""+e);
	}
        catch(java.lang.ClassNotFoundException e) { 
	    write(""+e);
            Status.setText(""+e);
	}
	    setCursor(java.awt.Cursor.getPredefinedCursor(java.awt.Cursor.DEFAULT_CURSOR));            
    }


    void write(String s) {
        System.out.println(s);
    }

    void debug(String s) {
        System.out.println(s);
    }

    public void showIt() {
        C[n].init();
        tv.Config.stage();
        boolean batch = tv.batch;
        tv.batch = true;
        config newC = C[n].C();
        tv.batch = batch;
        tv.Config.N = newC.N;
        tv.Config.V = newC.V;
        tv.Config.vtcs = new int[tv.Config.V][3];
        tv.Config.tets = new int[tv.Config.N][4];
        for (int i = 0; i < tv.Config.N; i++) {
	    for (int j = 0; j < 4; j++) {
		tv.Config.tets[i][j] = newC.tets[i][j];
	    }
	}
        for (int i = 0; i < tv.Config.V; i++) {
	    for (int j = 0; j < 3; j++) {
 		tv.Config.vtcs[i][j] = newC.vtcs[i][j];
	    }
	}
        tv.Config.title = " cell number " + n;
        tv.Config.prepare();
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
    }

    void count() {
	int Count = 0;
	for (int i = 0; i < N; i++) {
            if (eligible(i)) {
		Count++;
	    }
	}
        Status.setText(Count + " eligible cells ");
    }

    boolean eligible(int i) {
        if (!sharp) {
	    if (C[i].minDegree >= minDegree && C[i].maxDegree <= maxDegree
		&& C[i].V-1 >= minVB && C[i].V-1 <= maxVB) { 
		return true;
	    }
	    else {
		return false;
	    }
	}
        else {
	    if (C[i].minDegree == minDegree && C[i].maxDegree == maxDegree
		&& C[i].V-1 >= minVB && C[i].V-1 <= maxVB) { 
		return true;
	    }
	    else {
		return false;
	    }
	}
    }

    int nextN(int k) {
	int m = k+1;
	while( m < N && !eligible(m)) {
	    m++;
	}
	if (m < N) {
	    return m;
	}
	else {
	    return k;
	}
    }

    int prevN(int k) {
	int m = k-1;
	while(m >=0 && !eligible(m)) {
	    m--;
	}
	if (m >= 0) {
	    return m;
	}
	else {
	    return k;
	}
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
        int oldn = n;
        int oldN = N;
        Object arg = E.getSource();
        if (arg.equals(hide)) {
	    setVisible(false);
	}
        else if (arg.equals(nPlus)) {
	    n = nextN(n);
	}
	else if (arg.equals(nMinus)) {
	    n = prevN(n);
	}
        else if (arg.equals(NPlus)) {
            int m = nextN(n);
            if (m > n) {
		n = m;
                showIt();
	    }
	}
	else if (arg.equals(NPLUS)) {
            if (n < N-1) {
		n = N-1;
		showIt();
	    }
	}
	else if (arg.equals(NMinus)) {
            int m = prevN(n);
            if (m < n) {
		n = m;
                showIt();
	    }
	}
	else if (arg.equals(NMINUS)) {
            if (n > 0) {
		n = 0;
		showIt();
	    }
	}
	else if (arg.equals(tn)) {
            int nn = getInt(tn, n ,0, 2147483647);
	    if (nn != n) { 
		tn.setText(" " + n);
                n = nn;
		tn.setText(" " + n);
                tv.CC.showIt();
	    }
	}
       	else if (arg.equals(Load)) {
            loadIt();
	}
       	else if (arg.equals(show)) {
            showIt();
	}
       	else if (arg.equals(Report)) {
            C[n].report();
	}
       	else if (arg.equals(nice)) {
            C[n].nice();
	}
       	else if (arg.equals(center)) {
            C[n].center();
	}
       	else if (arg.equals(reset)) {
            C[n].reset();
	}
       	else if (arg.equals(Enlarge)) {
            int VV = C[n].V - 1;            
            int nn = getInt(Enlarge, 0, 0, VV);
            C[n].enlarge(nn);
	}
       	else if (arg.equals(degMinMinus)) {
            if (minDegree > 3) {
		minDegree--;
                tMinDegree.setText(""+minDegree);
	    }
	}
       	else if (arg.equals(degMinPlus)) {
            if (minDegree < maxDegree) {
		minDegree++;
                tMinDegree.setText(""+minDegree);
	    }
	}
       	else if (arg.equals(VBMinMinus)) {
            if (minVB > 4) {
		minVB--;
                tMinVB.setText(""+minVB);
	    }
	}
       	else if (arg.equals(VBMinPlus)) {
            if (minVB < maxVB) {
		minVB++;
                tMinVB.setText(""+minVB);
	    }
	}
       	else if (arg.equals(degMaxMinus)) {
            if (maxDegree > minDegree) {
		maxDegree--;
                tMaxDegree.setText(""+maxDegree);
	    }
	}
       	else if (arg.equals(degMaxPlus)) {
            if (maxDegree < MaxDegree) {
		maxDegree++;
                tMaxDegree.setText(""+maxDegree);
	    }
	}
       	else if (arg.equals(VBMaxMinus)) {
            if (maxVB > minVB) {
		maxVB--;
                tMaxVB.setText(""+maxVB);
	    }
	}
       	else if (arg.equals(VBMaxPlus)) {
            if (maxVB < MaxVB) {
		maxVB++;
                tMaxVB.setText(""+maxVB);
	    }
	}
       	else if (arg.equals(tMinDegree)) {
            minDegree = getInt(tMinDegree,minDegree,3,maxDegree);
	}
       	else if (arg.equals(tMaxDegree)) {
            maxDegree = getInt(tMaxDegree,maxDegree,minDegree,MaxDegree);
	}
       	else if (arg.equals(tMinVB)) {
            minVB = getInt(tMinVB,minVB,4,maxVB);
	}
       	else if (arg.equals(tMaxVB)) {
            maxVB = getInt(tMaxVB,maxVB,minVB,MaxVB);
	}
       	else if (arg.equals(howmany)) {
            count();
	}
       	else if (arg.equals(Sharp)) {
            sharp = !sharp;
            if (sharp) {
                Sharp.setLabel("sharp");
	    }
            else {
                Sharp.setLabel("inclusive");
	    }           
	}
        if (oldn != n) {
            tn.setText("" + n);
            C[n].status();
	}
    }
}

