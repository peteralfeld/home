import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class ct extends Frame 
    implements ActionListener, ItemListener, Serializable {

    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);

    boolean Verror = false, Eerror = false, Ferror = false;

    static int r = tv.TV.r; 
    static int d = tv.TV.d; 

    static int bv = r;
    static int c = 0;
    static int be = 0;
    static int ie = 0;
    static int fac = 0;

    Panel Panel0, Panel1;
    Button Stop, Hide, Init, Draw, Set, Clear;
    static TextField Status;

    Button bvMinus, bvPlus;
    TextField tbv;    

    Button cMinus, cPlus;
    TextField tc;    

    Button beMinus, bePlus;
    TextField tbe;    

    Button ieMinus, iePlus;
    TextField tie;    

    Button facMinus, facPlus;
    TextField tfac;    

    public ct() {

	r = tv.TV.r; 
	d = tv.TV.d; 
	bv = r;
        if (bv > d-r) {
	    bv = d-r;
	}
	c = 0;
	be = 0;
	ie = 0;
        fac = 0;

	Panel0= new Panel();
        String banner = "CT macro";
        write(banner);
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0.add(Banner);

        Stop = new Button("Stop");
        Stop.setBackground(Color.yellow);
        Stop.setForeground(Color.red);
        Stop.addActionListener(this); 
	Panel0.add(Stop);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        Panel0.add(Hide);

        Draw = new Button("Draw");
        Draw.setBackground(new Color(100,20,50));
        Draw.setForeground(Color.white);
        Draw.addActionListener(this); 
        Panel0.add(Draw);

        Init = new Button("Init");
        Init.setBackground(new Color(100,50,100));
        Init.setForeground(Color.white);
        Init.addActionListener(this); 
        Panel0.add(Init);

        Set = new Button("Set");
        Set.setBackground(new Color(70,70,100));
        Set.setForeground(Color.white);
        Set.addActionListener(this); 
        Panel0.add(Set);

        Status = new TextField(60);
        Status.setBackground(Color.white);
        Status.setForeground(new Color(0,0,155));
        Panel0.add(Status);

        Clear = new Button("Clear");
        Clear.setBackground(new Color(127,0,0));
        Clear.setForeground(Color.white);
        Clear.addActionListener(this); 
        Panel0.add(Clear);

        Panel1 = new Panel();

        Label bvLab = new Label("   V0:");
        bvLab.setForeground(fg);
        bvLab.setBackground(bg);
        Panel1.add(bvLab);
        bvMinus = new Button("<");
        bvMinus.setBackground(buttonBackground);
        bvMinus.setForeground(buttonForeground);
        bvMinus.addActionListener(this); 
	Panel1.add(bvMinus);
        tbv = new TextField(5);
        tbv.setBackground(textBackground);        
        tbv.setForeground(textForeground);        
        tbv.setText(" "+bv);
        tbv.addActionListener(this); 
        Panel1.add(tbv);
        bvPlus = new Button(">");
        bvPlus.setBackground(buttonBackground);
        bvPlus.setForeground(buttonForeground);
        bvPlus.addActionListener(this); 
	Panel1.add(bvPlus);
    
        Label cLab = new Label("   V4:");
        cLab.setForeground(fg);
        cLab.setBackground(bg);
        Panel1.add(cLab);
        cMinus = new Button("<");
        cMinus.setBackground(buttonBackground);
        cMinus.setForeground(buttonForeground);
        cMinus.addActionListener(this); 
	Panel1.add(cMinus);
        tc = new TextField(5);
        tc.setBackground(textBackground);        
        tc.setForeground(textForeground);        
        tc.setText(" "+c);
        tc.addActionListener(this); 
        Panel1.add(tc);
        cPlus = new Button(">");
        cPlus.setBackground(buttonBackground);
        cPlus.setForeground(buttonForeground);
        cPlus.addActionListener(this); 
	Panel1.add(cPlus);
    
        Label beLab = new Label("   E01:");
        beLab.setForeground(fg);
        beLab.setBackground(bg);
        Panel1.add(beLab);
        beMinus = new Button("<");
        beMinus.setBackground(buttonBackground);
        beMinus.setForeground(buttonForeground);
        beMinus.addActionListener(this); 
	Panel1.add(beMinus);
        tbe = new TextField(5);
        tbe.setBackground(textBackground);        
        tbe.setForeground(textForeground);        
        tbe.setText(" " + be);
        tbe.addActionListener(this); 
        Panel1.add(tbe);
        bePlus = new Button(">");
        bePlus.setBackground(buttonBackground);
        bePlus.setForeground(buttonForeground);
        bePlus.addActionListener(this); 
	Panel1.add(bePlus);
    
        Label ieLab = new Label("   E04:");
        ieLab.setForeground(fg);
        ieLab.setBackground(bg);
        Panel1.add(ieLab);
        ieMinus = new Button("<");
        ieMinus.setBackground(buttonBackground);
        ieMinus.setForeground(buttonForeground);
        ieMinus.addActionListener(this); 
	Panel1.add(ieMinus);
        tie = new TextField(5);
        tie.setBackground(textBackground);        
        tie.setForeground(textForeground);        
        tie.setText(" "+ie);
        tie.addActionListener(this); 
        Panel1.add(tie);
        iePlus = new Button(">");
        iePlus.setBackground(buttonBackground);
        iePlus.setForeground(buttonForeground);
        iePlus.addActionListener(this); 
	Panel1.add(iePlus);
    
        Label facLab = new Label("   F014:");
        facLab.setForeground(fg);
        facLab.setBackground(bg);
        Panel1.add(facLab);
        facMinus = new Button("<");
        facMinus.setBackground(buttonBackground);
        facMinus.setForeground(buttonForeground);
        facMinus.addActionListener(this); 
	Panel1.add(facMinus);
        tfac = new TextField(5);
        tfac.setBackground(textBackground);        
        tfac.setForeground(textForeground);        
        tfac.setText(" "+fac);
        tfac.addActionListener(this); 
        Panel1.add(tfac);
        facPlus = new Button(">");
        facPlus.setBackground(buttonBackground);
        facPlus.setForeground(buttonForeground);
        facPlus.addActionListener(this); 
	Panel1.add(facPlus);

	setLayout(new GridLayout(2,1));
        add(Panel0);
        add(Panel1);
        setBackground(new Color(255,255,210));
        setSize(950,100);
        setTitle("CT macro");
        setVisible(false);
    }


    public void itemStateChanged(java.awt.event.ItemEvent E) {
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Stop)) {
	    tv.Config.stop();
	}
        else {
	    tv.Config.addEvent(E,31);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        int oldbv = bv;
        int oldc = c;
        int oldbe = be;
        int oldie = ie;
        int oldfac = fac;
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
	}
        else if (arg.equals(Set)) {
            doit();
            count();
	}
        else if (arg.equals(bvMinus)) {
	    if (bv > 0) {
		bv--;
	    }
	}
        else if (arg.equals(bvPlus)) {
	    if (bv < d-r) {
		bv++;
	    }
	}
        else if (arg.equals(cMinus)) {
	    if (c > 0) {
		c--;
	    }
	}
        else if (arg.equals(cPlus)) {
	    if (c < d-r) {
		c++;
	    }
	}
        else if (arg.equals(beMinus)) {
	    if (be > 0) {
		be--;
	    }
	}
        else if (arg.equals(bePlus)) {
	    if (be < d-r) {
		be++;
	    }
	}
	else if (arg.equals(ieMinus)) {
	    if (ie > 0) {
		ie--;
	    }
	}
        else if (arg.equals(iePlus)) {
	    if (ie < d-r) {
		ie++;
	    }
	}
        else if (arg.equals(facMinus)) {
	    if (fac > 0) {
		fac--;
	    }
	}
        else if (arg.equals(facPlus)) {
	    if (fac < d-r) {
		fac++;
	    }
	}
        else if (arg.equals(tbv)) {
            bv = getInt(tbv, bv, 0,d-r);
	}
        else if (arg.equals(tc)) {
            c = getInt(tc, c, 0,d-r);
	}
        else if (arg.equals(tbe)) {
            be = getInt(tbe, be, 0,d-r);
	}
        else if (arg.equals(tbe)) {
            be = getInt(tbe, be, 0,d-r);
	}
        else if (arg.equals(tfac)) {
            fac = getInt(tfac, fac, 0,d-r);
	}
        else if (arg.equals(Clear)) {
            bv = 0;
            c = 0;
            be = 0;
            ie = 0;
            fac = 0;
	}
        if (oldbv != bv) {
	    tbv.setText((""+bv));
	}
        if (oldc != c) {
	    tc.setText((""+c));
	}
        if (oldbe != be) {
	    tbe.setText((""+be));
	}
        if (oldie != ie) {
	    tie.setText((""+ie));
	}
        if (oldfac != fac) {
	    tfac.setText((""+fac));
	}
        if (!tv.Config.LApresent) {
            doit();            
	}
    }

    static void doit() {
        int job = (((bv*10+c)*10+be)*10+ie)*10+fac;
        Status.setText("doing " + job);
        write("doing " + job);
	tv.Config.initSuper();
	tv.Config.nSuper = 0;
	for (int i = 0; i < bv; i++) {
	    tv.Config.addSuper(1,0);
	    tv.Config.addSuper(1,1);
	    tv.Config.addSuper(1,2);
	    tv.Config.addSuper(1,3);
	}
	for (int i = 0; i < c; i++) {
	    tv.Config.addSuper(1,4);
	}
	for (int i = 0; i < be; i++) {
	    tv.Config.addSuper(2,tv.Config.findEdge(0,1));
	    tv.Config.addSuper(2,tv.Config.findEdge(0,2));
	    tv.Config.addSuper(2,tv.Config.findEdge(0,3));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,2));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,3));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,3));
	}
	for (int i = 0; i < ie; i++) {
	    tv.Config.addSuper(2,tv.Config.findEdge(0,4));
	    tv.Config.addSuper(2,tv.Config.findEdge(1,4));
	    tv.Config.addSuper(2,tv.Config.findEdge(2,4));
	    tv.Config.addSuper(2,tv.Config.findEdge(3,4));
	}
	for (int i = 0; i < fac; i++) {
	    tv.Config.addSuper(3,tv.Config.findFace(0,1,4));
	    tv.Config.addSuper(3,tv.Config.findFace(0,2,4));
	    tv.Config.addSuper(3,tv.Config.findFace(0,3,4));
	    tv.Config.addSuper(3,tv.Config.findFace(1,2,4));
	    tv.Config.addSuper(3,tv.Config.findFace(1,3,4));
	    tv.Config.addSuper(3,tv.Config.findFace(2,3,4));
	}
	tv.Config.drawIt();
    }

    void count() {
        Status.setText("");
        int V = tv.Config.V;
        int nDps = tv.Config.nDps;
        d = tv.Config.d;
        r = tv.Config.r;
        int R = r + bv;
        int RE = r + be;
	if (!tv.Config.LApresent) {
	    doit();
            tv.Config.LAinit();
	}
        int counting = tv.Config.sofar;
        Verror = Eerror = Ferror = false;
        /* do vertex globs */
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
        write (" counted  vertices " + counting + " " + tv.Config.sofar);
        if (counting == tv.Config.sofar) {
	    Status.setText(" vertices OK " + counting);
	}
        else {
            Verror = true;
	    Status.setText(" vertices error " + counting + " " + tv.Config.sofar);
	}
        if (!Verror) {
	    /* do edge globs */
	    for (int k = tv.Config.EI; k < tv.Config.E; k++) {
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
	    int edges = 0;
	    for (int rho = 0; rho <= RE; rho++) {
		int add = (d- 2*R - 1 + rho)*(rho+1);
		if (add > 0) {
		    edges = edges + add;
		}
	    }
	    edges = edges*6;
	    counting = counting + edges;
	    write (" counted  edges " + counting + " " + tv.Config.sofar);
	    if (counting == tv.Config.sofar) {
		Status.setText(" edges OK " + counting);
	    }
	    else {
		Eerror = true;
		Status.setText(" edges error " + counting + " " + tv.Config.sofar);
	    }
	    if (!Eerror) {
		/* look at faces */
		int faces = 0;
		for (int rho = 0; rho <=r; rho++) {
		    int top = d-rho+2-3*(RE-rho+1);
		    if (top >= 2) {
			faces = faces + (top)*(top-1)/2;
		    }
		    top = R+2-rho-2*(RE+1-rho);
		    if (top >= 2) {
			faces = faces - 3*(top)*(top-1)/2;
		    }
		}
		faces = 4*faces;
		for (int rho =0; rho <=r; rho++) {
		    for (int j = 0; j < nDps; j++) {
			if (tv.Config.dps[j][V+1] == 0 && tv.Config.dps[j][4] == rho) {
			    faces--;
			}
		    }
		}
		counting = counting + faces;
		for (int k = tv.Config.TI; k < tv.Config.T; k++) {
		    int i0 = tv.Config.faces[k][0];
		    int i1 = tv.Config.faces[k][1];
		    int i2 = tv.Config.faces[k][2];
		    for (int l = 0; l < nDps; l++) {
			if (tv.Config.dps[l][V+1] == 1) {
			    if (tv.Config.dps[l][i0] + tv.Config.dps[l][i1] + tv.Config.dps[l][i2] >= d-r) {
				tv.Config.process(l);
			    }
			}
		    }
		}
		write (" counted  faces " + counting + " " + tv.Config.sofar);
		if (counting == tv.Config.sofar) {
		    Status.setText(" can impose " + counting +" conditions! ");
		}
		else {
		    Status.setText(" can only impose " + tv.Config.sofar + "  conditions of " + counting);
		    Ferror = true;
		}
	    }
	}
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

    static public void write(String s) {
	tv.write(s);
    }

    static public void debug(String s) {
	tv.write(s);
    }
}

        
