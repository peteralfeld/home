import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class wf extends Frame 
    implements ActionListener, ItemListener, Serializable {

    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);

    static int r = tv.TV.r; 
    static int d = tv.TV.d; 

    boolean Verror = false, Eerror = false, Ferror = false;

    static int types = 9;
   
    /*

    Types are as follows:
  
    0: V0  "corner"
    1: V4  Centroid              
    2: V5  face centroids
    3: E01 boundary edges
    4: E04  edges from a boundary vertex to the centroid
    5: E05  edges from a boundary vertex to a face centroid
    6: E45  edges from the centroid to a face entroid
    7: F014  a face containing a boundary edge and the centroid
    8: F045  a face containing a boundary vertex, the centroid, and a face centroid

    */

    static int[] s = new int[types];
   
    Button[] sMinus = new Button[types];
    Button[] sPlus = new Button[types];
    TextField[] ts = new TextField[types];

    Panel[] panel;

    Button Stop, Hide, Init, Draw, Vbutton, Ebutton, Fbutton, Clear;
    static TextField Status;
    static boolean vdone, edone, fdone;

    Label[] sample = new Label[types];

    public wf() {

	panel = new Panel[4];
	for (int i = 0; i < 4; i++) {
	    panel[i] = new Panel();
	}
	r = tv.TV.r; 
        d = tv.TV.d;
        int bv = r;
        if (bv > d-r) {
	    bv = d-r;
	}
        s[0] = bv;
        sample[0] = new Label("V0:");
        sample[1] = new Label("V4:");
        sample[2] = new Label("V5:");
        sample[3] = new Label("E01:");
        sample[4] = new Label("E04:");
        sample[5] = new Label("E05:");
        sample[6] = new Label("E45:");
        sample[7] = new Label("F014:");
        sample[8] = new Label("F045:");

        String banner = "Worsey-Farin macro";
        write(banner);
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        panel[0].add(Banner);

        Stop = new Button("Stop");
        Stop.setBackground(Color.yellow);
        Stop.setForeground(Color.red);
        Stop.addActionListener(this); 
	panel[0].add(Stop);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        panel[0].add(Hide);

        Draw = new Button("Draw");
        Draw.setBackground(new Color(100,20,50));
        Draw.setForeground(Color.white);
        Draw.addActionListener(this); 
        panel[0].add(Draw);

        Init = new Button("Init");
        Init.setBackground(new Color(100,50,100));
        Init.setForeground(Color.white);
        Init.addActionListener(this); 
        panel[0].add(Init);

        Vbutton = new Button("V");
        Vbutton.setBackground(new Color(70,70,100));
        Vbutton.setForeground(Color.white);
        Vbutton.addActionListener(this); 
        panel[0].add(Vbutton);

        Ebutton = new Button("E");
        Ebutton.setBackground(new Color(70,70,100));
        Ebutton.setForeground(Color.white);
        Ebutton.addActionListener(this); 
        panel[0].add(Ebutton);

        Fbutton = new Button("F");
        Fbutton.setBackground(new Color(70,70,100));
        Fbutton.setForeground(Color.white);
        Fbutton.addActionListener(this); 
        panel[0].add(Fbutton);

        Status = new TextField(40);
        Status.setBackground(Color.white);
        Status.setForeground(new Color(0,0,155));
        panel[0].add(Status);

        Clear = new Button("Clear");
        Clear.setBackground(new Color(127,0,0));
        Clear.setForeground(Color.white);
        Clear.addActionListener(this); 
        panel[0].add(Clear);

	Panel p = new Panel();

        for (int i = 0; i < types; i++) {
            if (i < 3) {
                p = panel[1];
	    }
            else if (i < 7) {
                p = panel[2];
	    }
            else  {
                p = panel[3];
	    }
            sample[i].setForeground(fg);            
            sample[i].setBackground(bg);            
            p.add(sample[i]);
	    sMinus[i] = new Button("<");
	    sMinus[i].setBackground(buttonBackground);
	    sMinus[i].setForeground(buttonForeground);
	    sMinus[i].addActionListener(this); 
	    p.add(sMinus[i]);
	    ts[i] = new TextField(5);
	    ts[i].setBackground(textBackground);        
	    ts[i].setForeground(textForeground);        
	    ts[i].setText(" "+s[i]);
	    ts[i].addActionListener(this); 
	    p.add(ts[i]);
	    sPlus[i] = new Button(">");
	    sPlus[i].setBackground(buttonBackground);
	    sPlus[i].setForeground(buttonForeground);
	    sPlus[i].addActionListener(this); 
	    p.add(sPlus[i]);
	}    
	setLayout(new GridLayout(4,1));
        for (int i = 0; i < 4; i++) {
	    add(panel[i]);
	}
        setBackground(new Color(255,255,210));
        setSize(800,200);
        setTitle("Worsey-Farin macro");
        setVisible(false);
    }


    public void itemStateChanged(java.awt.event.ItemEvent E) {
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Stop)) {
	    tv.TV.Config.stop();
	}
        else {
            tv.Config.addEvent(E,61);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        int[] olds = new int[types];
        for (int i = 0; i < types; i++) {
	    olds[i] = s[i];
	}
        r = tv.Config.r;
        d = tv.Config.d;
        if (arg.equals(Hide)) {
	    setVisible(false);
	}
        else if (arg.equals(Draw)) {
            doit();
	}
        else if (arg.equals(Init)) {
	    doit();
            tv.Config.selectSuper = false;
            tv.Config.selectSpecial = false;
            tv.Super.setBackground(Color.red);
            tv.Special.setBackground(Color.red);
            tv.Config.LAinit();
            tv.Config.drawIt();
            vdone = false;
            edone = false;
            fdone = false;
	}
        else if (arg.equals(Vbutton)) {
            countVtcs();
	}
        else if (arg.equals(Ebutton)) {
            countEdgs();
	}
        else if (arg.equals(Fbutton)) {
            countFcs();
	}
        else if (arg.equals(Clear)) {
            for (int i = 0; i < types; i++) {
		s[i] = 0;
                ts[i].setText(""+0);
	    }
	}
        else {
	    int kind = -1;
            int which = -1;
            for (int i = 0; i < types; i++) {
		if (arg.equals(sMinus[i])) {
		    kind = 0;
                    which = i;
                    i = types;
		}
                else if (arg.equals(ts[i])) {
		    kind = 1;
                    which = i;
                    i = types;
		}
                else if (arg.equals(sPlus[i])) {
		    kind = 2;
                    which = i;
                    i = types;
		}
	    }
            if (kind == 0) {
		if (s[which] > 0) {
		    s[which]--;
		}
	    }
	    else if (kind == 1) {
		s[which] = getInt(ts[which], s[which], 0, d-r);
	    }
	    else if (kind == 2) {
		if (s[which] < d-r) {
		    s[which]++;
		}
	    }
	}
        for (int i = 0; i < types; i++) {
	    if (olds[i] != s[i]) {
		ts[i].setText("" + s[i]);
	    }
	}
        if (!tv.Config.LApresent) {
            doit();            
	}
    }

    static void doit() {
        vdone = false;
        edone = false;
        fdone = false;
        long job = 0;
        for (int i = 0; i < types; i++) {
	    job = 10*job + s[i];
	}
        Status.setText("doing " + job);
        write("doing " + job);
	tv.Config.initSuper();
	tv.Config.nSuper = 0;
	/* corner vertices: */
	for (int i = 0; i < s[0]; i++) {
	    tv.Config.addSuper(1,0);
	    tv.Config.addSuper(1,1);
	    tv.Config.addSuper(1,2);
	    tv.Config.addSuper(1,3);
	}
	/* centroid */
	for (int i = 0; i < s[1]; i++) {
	    tv.Config.addSuper(1,4);
	}
	/* face entroids: */
	for (int i = 0; i < s[2]; i++) {
	    tv.Config.addSuper(1,5);
	    tv.Config.addSuper(1,6);
	    tv.Config.addSuper(1,7);
	    tv.Config.addSuper(1,8);
	}
	/* boundary edges */
	for (int i = 0; i < s[3]; i++) {
	    tv.Config.addSuper(2,tv.Config.findEdge(0,1));
	    tv.Config.addSuper(2,tv.Config.findEdge(0,2));
	    tv.Config.addSuper(2,tv.Config.findEdge(0,3));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,2));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,3));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,3));
	}
	/* from corner to centroid */
	for (int i = 0; i < s[4]; i++) {
	    tv.Config.addSuper(2,tv.Config.findEdge(0,4));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,4));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,4));
	    tv.Config.addSuper(2,tv.Config.findEdge(3,4));
	}
	/* from corner to face centroid */
	for (int i = 0; i < s[5]; i++) {
	    tv.Config.addSuper(2,tv.Config.findEdge(0,6));
	    tv.Config.addSuper(2,tv.Config.findEdge(0,7));
	    tv.Config.addSuper(2,tv.Config.findEdge(0,8));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,5));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,7));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,8));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,5));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,6));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,8));
	    tv.Config.addSuper(2,tv.Config.findEdge(3,5));
	    tv.Config.addSuper(2,tv.Config.findEdge(3,6));
	    tv.Config.addSuper(2,tv.Config.findEdge(3,7));
	}
	/* edges from the centroid to a face centroid */
	for (int i = 0; i < s[6]; i++) {
	    tv.Config.addSuper(2,tv.Config.findEdge(4,5));
	    tv.Config.addSuper(2,tv.Config.findEdge(4,6));
	    tv.Config.addSuper(2,tv.Config.findEdge(4,7));
	    tv.Config.addSuper(2,tv.Config.findEdge(4,8));
	}
	/* a face containing a boundary edge and the centroid */
	for (int i = 0; i < s[7]; i++) {
	    tv.Config.addSuper(3,tv.Config.findFace(0,1,4));
	    tv.Config.addSuper(3,tv.Config.findFace(0,2,4));
	    tv.Config.addSuper(3,tv.Config.findFace(0,3,4));
	    tv.Config.addSuper(3,tv.Config.findFace(1,2,4));
	    tv.Config.addSuper(3,tv.Config.findFace(1,3,4));
	    tv.Config.addSuper(3,tv.Config.findFace(2,3,4));
	}
	/* a face containing a boundary vertex, the centroid, and a face centroid */  
	for (int i = 0; i < s[8]; i++) {
	    tv.Config.addSuper(3,tv.Config.findFace(1,4,8));
	    tv.Config.addSuper(3,tv.Config.findFace(2,4,8));
	    tv.Config.addSuper(3,tv.Config.findFace(0,4,8));
	    tv.Config.addSuper(3,tv.Config.findFace(1,4,7));
	    tv.Config.addSuper(3,tv.Config.findFace(3,4,7));
	    tv.Config.addSuper(3,tv.Config.findFace(0,4,7));
	    tv.Config.addSuper(3,tv.Config.findFace(2,4,6));
	    tv.Config.addSuper(3,tv.Config.findFace(3,4,6));
	    tv.Config.addSuper(3,tv.Config.findFace(0,4,6));
	    tv.Config.addSuper(3,tv.Config.findFace(2,4,5));
	    tv.Config.addSuper(3,tv.Config.findFace(3,4,5));
	    tv.Config.addSuper(3,tv.Config.findFace(1,4,5));
	}
	tv.Config.drawIt();
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

    void countVtcs() {
        if (!vdone) {
            Verror = false;
            if (!tv.Config.LApresent) {
                tv.Config.drawIt();
		tv.Config.LAinit();
	    }
	    Status.setText("setting vertices");
	    int V = tv.Config.V;
	    int nDps = tv.Config.nDps;
	    d = tv.Config.d;
	    r = tv.Config.r;
	    int R = r + s[0];
	    int RE = r + s[3];
	    if (!tv.Config.LApresent) {
		doit();
		tv.Config.LAinit();
	    }
	    int counting = tv.Config.sofar;
	    for (int i = 0; i < 4; i++) {
		for (int j = 0; j < nDps; j++) {
		    if (tv.Config.dps[j][V+1] == 1) {
			if (tv.Config.dps[j][0] >= d-R ||
			    tv.Config.dps[j][1] >= d-R ||
			    tv.Config.dps[j][2] >= d-R ||
			    tv.Config.dps[j][3] >= d-R) {
			    tv.Config.process(j);
			}
		    }
		}
	    }
	    counting = counting + 4*(R+3)*(R+2)*(R+1)/6;
	    if (counting == tv.Config.sofar) {
		String s = " vertices OK " + counting;
		Status.setText(s);
		write(s);
	    }
	    else {
                Verror = true;
		String s = " vertices error " + counting + " " + tv.Config.sofar;
		Status.setText(s);
		write(s);
	    }
	    vdone = true;
	}
    }

    void countEdgs() {
        if (!edone) {
            Eerror = false;
	    if (!vdone) {
		countVtcs();
	    }
            if (!Verror) {
		Status.setText(" setting edges ");
		int V = tv.Config.V;
		int nDps = tv.Config.nDps;
		d = tv.Config.d;
		r = tv.Config.r;
		int R = r + s[0];
		int RE = r + s[3];
		int counting = tv.Config.sofar;
		for (int mu = 0; mu < 4; mu++) {
		    for (int nu = mu+1; nu < 4; nu++) {
			int k = tv.Config.findEdge(mu,nu);
			int i = tv.Config.edges[k][0];
			int j = tv.Config.edges[k][1];
			for (int l = 0; l < nDps; l++) {
			    if (tv.Config.dps[l][V+1] == 1) {
				if (tv.Config.dps[l][i] + tv.Config.dps[l][j] >= d-RE) {
				    tv.Config.process(l);
				}
			    }
			}
		    }
		}
		int edges = 0;
		for (int rho = 0; rho <= RE; rho++) {
		    int add = (d- 2*R - 1 + rho)*(rho+1);
		    if (add > 0) {
			edges = edges + add;
		    }
		}
		edges = edges*6;
		counting = counting + edges;
		if (counting == tv.Config.sofar) {
		    String s = " edges OK " + counting;
		    Status.setText(s);
		    write(s);
		}
		else {
		    Eerror = true;
		    String s = " edges error " + counting + " " + tv.Config.sofar;
		    Status.setText(s);
		    write(s);
		}
		edone = true;
	    }
	}
    }

    void countFcs() {
        if (!fdone) {
	    if (!edone) {
		countEdgs();
	    }
            if (!Verror && ! Eerror) {
		Ferror = false;
		Status.setText(" setting faces ");
		int V = tv.Config.V;
		int nDps = tv.Config.nDps;
		d = tv.Config.d;
		r = tv.Config.r;
		int R = r + s[0];
		int RE = r + s[3];
		int counting = tv.Config.sofar;
		int bigfaces = tv.Config.TB/4;
		int bigfaceCount = 0;
		int sofar = tv.Config.sofar;
		for (int k = tv.Config.TI; k < tv.Config.T; k++) {
		    int i0 = tv.Config.faces[k][0];
		    int i1 = tv.Config.faces[k][1];
		    int i2 = tv.Config.faces[k][2];
		    for (int l = 0; l < nDps; l++) {
			if (tv.Config.dps[l][V+1] == 1) {
			    if (tv.Config.dps[l][i0] + tv.Config.dps[l][i1] + tv.Config.dps[l][i2] >= d-r) {
				if (k - tv.Config.TI < bigfaces) {
				    bigfaceCount++;
				}
				tv.Config.process(l);
			    }
			}
		    }
		}
		String s = " imposed " + tv.Config.sofar + " total";
		int delta = tv.Config.sofar - sofar;
		if (delta == 4*bigfaceCount) {
		    s = s + " --- looks OK ";
		}
		else {
		    s = s + " --- face error " + delta + " " + 4*bigfaceCount;
		    Ferror = true;
		}
		Status.setText(s);
		write(s);
		fdone = true;
	    }
	}
    }

    static public void write(String s) {
	tv.write(s);
    }

    static public void debug(String s) {
	tv.write(s);
    }
}

        
