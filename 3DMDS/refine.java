import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class refine extends Frame 
    implements ActionListener, ItemListener, Serializable {
    Color buttonBackground = new Color(0,127,0);
    Color abB = new Color(127,0,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);
    Color choices = new Color(100,150,255);
    Color lbg = new Color(0,0,200);
    Color lfg = Color.white;

    int P = config.P;

    Label one, other;

    int[] tetrahedra, faces, edges, vertics;

    Panel P0, Ptet, PwCT, Pface, Pedge;

    Panel Pfwct;

    Button pc0, mc0, pc1, mc1, pc2, mc2, fwct;

    Button Quit, Hide, Undo, Redo, Reset;

    Choice Tetrahedron, Face, Edge;

    Button tCT, tMS, tinvert, allCT, tEdge1, tEdge2, allT60, allT504;

    Button fCT, fMS, fPS6, fPS12, pierce, p01,  p02, p12;

    
    TextField tc0,tc1,tc2;
    Label Lfdenominator;

    TextField tb0,tb1,tb2,tb3;
    Label ldenominator;
    int b0=1, b1=1, b2=1, b3=1;
    int denominator = b0+b1+b2+b3;
    
    int c0=1, c1=1, c2=1;
    int fdenominator = c0+c1+c2;

    Button pb0,mb0,pb1,mb1,pb2,mb2,pb3,mb3, wCT;


    Button eSplit;    

    int e0 = 1, e1 = 1;
    int edenominator = c0 + c1;    
    Label Ledenominator;
    Button pe0, me0, pe1, me1, wes;
    TextField te0,te1;

    public refine() {

	P0= new Panel();
        String banner = "Refinement Panel";
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        P0.add(Banner);

        Quit = new Button("Quit");
        Quit.setBackground(Color.red);
        Quit.setForeground(Color.white);
        Quit.addActionListener(this); 
	P0.add(Quit);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        P0.add(Hide);

        if (!tv.inApplet) {
	    Undo = new Button("Undo");
	    Undo.setBackground(new Color(50,20,100));
	    Undo.setForeground(Color.white);
	    Undo.addActionListener(this); 
	    P0.add(Undo);
	    Redo = new Button("Redo");
	    Redo.setBackground(new Color(50,20,100));
	    Redo.setForeground(Color.white);
	    Redo.addActionListener(this); 
	    P0.add(Redo);
	    Reset = new Button("Reset");
	    Reset.setBackground(new Color(50,20,100));
	    Reset.setForeground(Color.white);
	    Reset.addActionListener(this); 
	    P0.add(Reset);
	}
       
        Ptet = new Panel();
        Label lbl1 = new Label("Tetrahedron:");
        lbl1.setForeground(fg);
        lbl1.setBackground(bg);
        Ptet.add(lbl1);
	Tetrahedron = new choice(); 
        Tetrahedron.setBackground(choices);
        Tetrahedron.addItem("");
        int N = tv.Config.N;
        int M = tv.Config.V;
	tetrahedra = new int[N];
        int[] tsize = new int[N];
        for (int i = 0; i < N; i++) {
	    tetrahedra[i] = i;
            tsize[i] = ((((tv.Config.tets[i][0]*M + tv.Config.tets[i][1])*M +
			  tv.Config.tets[i][2])*M) + tv.Config.tets[i][3]);
	}
        boolean sorted = false;
	while (!sorted) {
            sorted = true;
	    for (int i = 1; i < N; i++) {
		if (tsize[i-1] > tsize[i]) {
		    int dmy = tsize[i-1];
                    tsize[i-1] = tsize[i];
                    tsize[i] = dmy;
		    dmy = tetrahedra[i-1];
                    tetrahedra[i-1] = tetrahedra[i];
                    tetrahedra[i] = dmy;
                    sorted = false;
		}
	    }
	}
        for (int j =0; j < tv.Config.N; j++) {
            int i = tetrahedra[j];
            String s = tv.Config.tets[i][0]+"-"+tv.Config.tets[i][1]+"-"+tv.Config.tets[i][2]+"-"+tv.Config.tets[i][3];
            Tetrahedron.addItem(s);
	}
        Tetrahedron.addItemListener(this);
        Tetrahedron.select(0);
        Ptet.add(Tetrahedron);

        tCT = new Button("CT");
        tCT.setBackground(buttonBackground);
        tCT.setForeground(buttonForeground);
        tCT.addActionListener(this); 
	Ptet.add(tCT);

        tMS = new Button("MS");
        tMS.setBackground(buttonBackground);
        tMS.setForeground(buttonForeground);
        tMS.addActionListener(this); 
	Ptet.add(tMS);

        tinvert = new Button("invert");
        tinvert.setBackground(buttonBackground);
        tinvert.setForeground(buttonForeground);
        tinvert.addActionListener(this); 
	Ptet.add(tinvert);

        tEdge1 = new Button("edges 12");
        tEdge1.setBackground(buttonBackground);
        tEdge1.setForeground(buttonForeground);
        tEdge1.addActionListener(this); 
	Ptet.add(tEdge1);

        tEdge2 = new Button("edges 16");
        tEdge2.setBackground(buttonBackground);
        tEdge2.setForeground(buttonForeground);
        tEdge2.addActionListener(this); 
	Ptet.add(tEdge2);

        allCT = new Button("all CT");
        allCT.setBackground(abB);
        allCT.setForeground(buttonForeground);
        allCT.addActionListener(this); 
	Ptet.add(allCT);

        allT60 = new Button("all T60");
        allT60.setBackground(abB);
        allT60.setForeground(buttonForeground);
        allT60.addActionListener(this); 
	Ptet.add(allT60);

        allT504 = new Button("all T504");
        allT504.setBackground(abB);
        allT504.setForeground(buttonForeground);
        allT504.addActionListener(this); 
	Ptet.add(allT504);

        PwCT = new Panel();

        Label lb0 = new Label("b0:");
        lb0.setForeground(fg);
        lb0.setBackground(bg);
        PwCT.add(lb0);
        mb0 = new Button("<");
        mb0.setBackground(buttonBackground);
        mb0.setForeground(buttonForeground);
        mb0.addActionListener(this); 
	PwCT.add(mb0);
        tb0 = new TextField(5);
        tb0.setBackground(textBackground);        
        tb0.setForeground(textForeground);        
        tb0.setText(" "+b0);
        tb0.addActionListener(this); 
        PwCT.add(tb0);
        pb0 = new Button(">");
        pb0.setBackground(buttonBackground);
        pb0.setForeground(buttonForeground);
        pb0.addActionListener(this); 
	PwCT.add(pb0);

        Label lb1 = new Label("b1:");
        lb1.setForeground(fg);
        lb1.setBackground(bg);
        PwCT.add(lb1);
        mb1 = new Button("<");
        mb1.setBackground(buttonBackground);
        mb1.setForeground(buttonForeground);
        mb1.addActionListener(this); 
	PwCT.add(mb1);
        tb1 = new TextField(5);
        tb1.setBackground(textBackground);        
        tb1.setForeground(textForeground);        
        tb1.setText(" "+b1);
        tb1.addActionListener(this); 
        PwCT.add(tb1);
        pb1 = new Button(">");
        pb1.setBackground(buttonBackground);
        pb1.setForeground(buttonForeground);
        pb1.addActionListener(this); 
	PwCT.add(pb1);

        Label lb2 = new Label("b2:");
        lb2.setForeground(fg);
        lb2.setBackground(bg);
        PwCT.add(lb2);
        mb2 = new Button("<");
        mb2.setBackground(buttonBackground);
        mb2.setForeground(buttonForeground);
        mb2.addActionListener(this); 
	PwCT.add(mb2);
        tb2 = new TextField(5);
        tb2.setBackground(textBackground);        
        tb2.setForeground(textForeground);        
        tb2.setText(" "+b2);
        tb2.addActionListener(this); 
        PwCT.add(tb2);
        pb2 = new Button(">");
        pb2.setBackground(buttonBackground);
        pb2.setForeground(buttonForeground);
        pb2.addActionListener(this); 
	PwCT.add(pb2);

        Label lb3 = new Label("b3:");
        lb3.setForeground(fg);
        lb3.setBackground(bg);
        PwCT.add(lb3);
        mb3 = new Button("<");
        mb3.setBackground(buttonBackground);
        mb3.setForeground(buttonForeground);
        mb3.addActionListener(this); 
	PwCT.add(mb3);
        tb3 = new TextField(5);
        tb3.setBackground(textBackground);        
        tb3.setForeground(textForeground);        
        tb3.setText(" "+b3);
        tb3.addActionListener(this); 
        PwCT.add(tb3);
        pb3 = new Button(">");
        pb3.setBackground(buttonBackground);
        pb3.setForeground(buttonForeground);
        pb3.addActionListener(this); 
	PwCT.add(pb3);

        denominator = b0+b1+b2+b3;
        ldenominator = new Label("    " + denominator + "        " );
        ldenominator.setForeground(lfg);
        ldenominator.setBackground(lbg);
	PwCT.add(ldenominator);

        wCT = new Button("wCT");
        wCT.setBackground(abB);
        wCT.setForeground(buttonForeground);
        wCT.addActionListener(this); 
	PwCT.add(wCT);

        Pface = new Panel();

        Label lbl2 = new Label("Face:");
        lbl2.setForeground(fg);
        lbl2.setBackground(bg);
        Pface.add(lbl2);
        one = new Label("  ");
        one.setForeground(lfg);
        one.setBackground(lbg);
        Pface.add(one);
	Face = new choice(); 
        Face.setBackground(choices);
        Face.addItem("");
        N = tv.Config.T;
	faces = new int[N];
        tsize = new int[N];
        for (int i = 0; i < N; i++) {
	    faces[i] = i;
            tsize[i] = ((tv.Config.faces[i][0]*M + tv.Config.faces[i][1])*M +
			tv.Config.faces[i][2]);
	}
        sorted = false;
	while (!sorted) {
            sorted = true;
	    for (int i = 1; i < N; i++) {
		if (tsize[i-1] > tsize[i]) {
		    int dmy = tsize[i-1];
                    tsize[i-1] = tsize[i];
                    tsize[i] = dmy;
		    dmy = faces[i-1];
                    faces[i-1] = faces[i];
                    faces[i] = dmy;
                    sorted = false;
		}
	    }
	}
        for (int j =0; j < tv.Config.T; j++) {
            int i = faces[j];
            String s = tv.Config.faces[i][0]+"-"+tv.Config.faces[i][1]+"-"+tv.Config.faces[i][2];
            Face.addItem(s);
	}
        Face.addItemListener(this);
        Face.select(0);
        Pface.add(Face);
        other = new Label("  ");
        other.setForeground(lfg);
        other.setBackground(lbg);
        Pface.add(other);

        fCT = new Button("CT");
        fCT.setBackground(buttonBackground);
        fCT.setForeground(buttonForeground);
        fCT.addActionListener(this); 
	Pface.add(fCT);

        fMS = new Button("MS");
        fMS.setBackground(buttonBackground);
        fMS.setForeground(buttonForeground);
        fMS.addActionListener(this); 
	Pface.add(fMS);

        fPS6 = new Button("PS6");
        fPS6.setBackground(buttonBackground);
        fPS6.setForeground(buttonForeground);
        fPS6.addActionListener(this); 
	Pface.add(fPS6);

        fPS12 = new Button("PS12");
        fPS12.setBackground(buttonBackground);
        fPS12.setForeground(buttonForeground);
        fPS12.addActionListener(this); 
	Pface.add(fPS12);

        pierce = new Button("pierce");
        pierce.setBackground(buttonBackground);
        pierce.setForeground(buttonForeground);
        pierce.addActionListener(this); 
	Pface.add(pierce);

        p01 = new Button("edge 01");
        p01.setBackground(abB);
        p01.setForeground(buttonForeground);
        p01.addActionListener(this); 
	Pface.add(p01);

        p02 = new Button("edge 02");
        p02.setBackground(abB);
        p02.setForeground(buttonForeground);
        p02.addActionListener(this); 
	Pface.add(p02);

        p12 = new Button("edge 12");
        p12.setBackground(abB);
        p12.setForeground(buttonForeground);
        p12.addActionListener(this); 
	Pface.add(p12);

        Pfwct = new Panel();

        Label lc0 = new Label("b0:");
        lc0.setForeground(fg);
        lc0.setBackground(bg);
        Pfwct.add(lc0);
        mc0 = new Button("<");
        mc0.setBackground(buttonBackground);
        mc0.setForeground(buttonForeground);
        mc0.addActionListener(this); 
	Pfwct.add(mc0);
        tc0 = new TextField(5);
        tc0.setBackground(textBackground);        
        tc0.setForeground(textForeground);        
        tc0.setText(" "+c0);
        tc0.addActionListener(this); 
        Pfwct.add(tc0);
        pc0 = new Button(">");
        pc0.setBackground(buttonBackground);
        pc0.setForeground(buttonForeground);
        pc0.addActionListener(this); 
	Pfwct.add(pc0);

        Label lc1 = new Label("b1:");
        lc1.setForeground(fg);
        lc1.setBackground(bg);
        Pfwct.add(lc1);
        mc1 = new Button("<");
        mc1.setBackground(buttonBackground);
        mc1.setForeground(buttonForeground);
        mc1.addActionListener(this); 
	Pfwct.add(mc1);
        tc1 = new TextField(5);
        tc1.setBackground(textBackground);        
        tc1.setForeground(textForeground);        
        tc1.setText(" "+c1);
        tc1.addActionListener(this); 
        Pfwct.add(tc1);
        pc1 = new Button(">");
        pc1.setBackground(buttonBackground);
        pc1.setForeground(buttonForeground);
        pc1.addActionListener(this); 
	Pfwct.add(pc1);

        Label lc2 = new Label("b2:");
        lc2.setForeground(fg);
        lc2.setBackground(bg);
        Pfwct.add(lc2);
        mc2 = new Button("<");
        mc2.setBackground(buttonBackground);
        mc2.setForeground(buttonForeground);
        mc2.addActionListener(this); 
	Pfwct.add(mc2);
        tc2 = new TextField(5);
        tc2.setBackground(textBackground);        
        tc2.setForeground(textForeground);        
        tc2.setText(" "+c2);
        tc2.addActionListener(this); 
        Pfwct.add(tc2);
        pc2 = new Button(">");
        pc2.setBackground(buttonBackground);
        pc2.setForeground(buttonForeground);
        pc2.addActionListener(this); 
	Pfwct.add(pc2);

        fdenominator = c0+c1+c2;
        Lfdenominator = new Label("    " + fdenominator + "        " );
        Lfdenominator.setForeground(lfg);
        Lfdenominator.setBackground(lbg);
	Pfwct.add(Lfdenominator);

        fwct = new Button("fwct");
        fwct.setBackground(abB);
        fwct.setForeground(buttonForeground);
        fwct.addActionListener(this); 
	Pfwct.add(fwct);

        Pedge = new Panel();

        Label lbl3 = new Label("Edge:");
        lbl3.setForeground(fg);
        lbl3.setBackground(bg);
        Pedge.add(lbl3);
	Edge = new choice(); 
        Edge.setBackground(choices);
        Edge.addItem("");
        N = tv.Config.E;
	edges = new int[N];
        tsize = new int[N];
        for (int i = 0; i < N; i++) {
	    edges[i] = i;
            tsize[i] = tv.Config.edges[i][0]*M + tv.Config.edges[i][1];
	}
        sorted = false;
	while (!sorted) {
            sorted = true;
	    for (int i = 1; i < N; i++) {
		if (tsize[i-1] > tsize[i]) {
		    int dmy = tsize[i-1];
                    tsize[i-1] = tsize[i];
                    tsize[i] = dmy;
		    dmy = edges[i-1];
                    edges[i-1] = edges[i];
                    edges[i] = dmy;
                    sorted = false;
		}
	    }
	}

        for (int j = 0; j < tv.Config.E; j++) {
            int i = edges[j];
            String s = tv.Config.edges[i][0]+"-"+tv.Config.edges[i][1];
            Edge.addItem(s);
	}
        Edge.addItemListener(this);
        Edge.select(0);
        Pedge.add(Edge);

        eSplit = new Button("split");
        eSplit.setBackground(buttonBackground);
        eSplit.setForeground(buttonForeground);
        eSplit.addActionListener(this); 
	Pedge.add(eSplit);



        Label le0 = new Label("b0:");
        le0.setForeground(fg);
        le0.setBackground(bg);
        Pedge.add(le0);
        me0 = new Button("<");
        me0.setBackground(buttonBackground);
        me0.setForeground(buttonForeground);
        me0.addActionListener(this); 
	Pedge.add(me0);
        te0 = new TextField(5);
        te0.setBackground(textBackground);        
        te0.setForeground(textForeground);        
        te0.setText(" "+e0);
        te0.addActionListener(this); 
        Pedge.add(te0);
        pe0 = new Button(">");
        pe0.setBackground(buttonBackground);
        pe0.setForeground(buttonForeground);
        pe0.addActionListener(this); 
	Pedge.add(pe0);

        Label le1 = new Label("b1:");
        le1.setForeground(fg);
        le1.setBackground(bg);
        Pedge.add(le1);
        me1 = new Button("<");
        me1.setBackground(buttonBackground);
        me1.setForeground(buttonForeground);
        me1.addActionListener(this); 
	Pedge.add(me1);
        te1 = new TextField(5);
        te1.setBackground(textBackground);        
        te1.setForeground(textForeground);        
        te1.setText(" "+e1);
        te1.addActionListener(this); 
        Pedge.add(te1);
        pe1 = new Button(">");
        pe1.setBackground(buttonBackground);
        pe1.setForeground(buttonForeground);
        pe1.addActionListener(this); 
	Pedge.add(pe1);

        Ledenominator = new Label("    " + edenominator + "        " );
        Ledenominator.setForeground(lfg);
        Ledenominator.setBackground(lbg);
	Pedge.add(Ledenominator);

        wes = new Button("weighted split");
        wes.setBackground(abB);
        wes.setForeground(buttonForeground);
        wes.addActionListener(this); 
	Pedge.add(wes);

        setLayout(new GridLayout(6,1));
        add(P0);
        add(Ptet);
        add(PwCT);
        add(Pface);
        add(Pfwct);
        add(Pedge);
        setBackground(new Color(255,255,210));
        setSize(800,270);
        setTitle("Refinement Panel");
        if (tv.TV.Config.N == 1) {
	    Tetrahedron.select(1);
	}
        setVisible(false);
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
        Object arg = E.getSource();
        if (arg.equals(Face)) {
	    int f = Face.getSelectedIndex() -1 ;
            if ( f == -1) {
		one.setText("   ");
                other.setText("   ");
                p01.setLabel("    ");
		p02.setLabel("    ");
		p12.setLabel("    ");
	    }
            else {
                int F = faces[f];
                int i0 = tv.Config.faces[F][0]; 
                int i1 = tv.Config.faces[F][1]; 
                int i2 = tv.Config.faces[F][2]; 
                int i3 = tv.Config.faces[F][3]; 
                int i4 = tv.Config.faces[F][4]; 
                other.setText("" + i3);
                if (i4 > -1 ){
		    one.setText(i4+"");
		}
                else {
		    one.setText("   ");
		}
                p01.setLabel("" + i0+ "-" + i1);
                p02.setLabel("" + i0+ "-" + i2);
                p12.setLabel("" + i1+ "-" + i2);

	    }
	}
    }

    public void ItemStateChanged(java.awt.event.ItemEvent E) {
	Object arg = E.getSource();
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Quit)) {
	    tv.TV.stop();
	}
	else if (arg.equals(Hide)) {
	    setVisible(false);
	}
	else if (arg.equals(Redo)) {
            config.pasts += 2;
	    tv.TV.restoreIt(project(config.pasts));            
	    tv.TV.Config.newRefine();
	    config.pasts--;
	}
	else if (arg.equals(Reset)) {
            config.pasts = 0;
	}
	else if (arg.equals(Undo)) {
            save();
            config.pasts--;
	    if (config.pasts > 0) {
		tv.TV.restoreIt(project(config.pasts));            
		config.pasts--;
                tv.TV.Config.newRefine();
	    }
	    else {
		tv.Config.write(" no undo info " + project(config.pasts));
	    }
	}
        else {
	    if (arg.equals(tCT)) {
		int t = Tetrahedron.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.tCT(tetrahedra[t]);
		}
	    }            
	    if (arg.equals(wCT)) {
		int t = Tetrahedron.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.tCT(tetrahedra[t],b0,b1,b2,b3);
		}
	    }            
	    else if (arg.equals(tMS)) {
		int t = Tetrahedron.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.tMS(tetrahedra[t]);
		}
	    }            
	    else if (arg.equals(tinvert)) {
		int t = Tetrahedron.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.tinvert(tetrahedra[t]);
		}
	    }            
	    else if (arg.equals(tEdge1)) {
		int t = Tetrahedron.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.tEdge1(tetrahedra[t]);
		}
	    }            
	    else if (arg.equals(tEdge2)) {
		int t = Tetrahedron.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.tEdge2(tetrahedra[t]);
		}
	    }            
	    else if (arg.equals(allCT)) {
		save();
		tv.Config.allCT();
	    }            
	    else if (arg.equals(allT60)) {
		save();
		tv.Config.allT60();
	    }            
	    else if (arg.equals(allT504)) {
		save();
		tv.Config.allT504();
	    }            
            else if (arg.equals(pb0)) {
                b0++;
                tb0.setText(""+b0);
                denominator++;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(tb0)) {
                b0 = getInt(tb0, b0, 1, P);
                tb0.setText(""+b0);
                denominator = b0+b1+b2+b3;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(mb0)) {
                if (b0 > 1) {
                b0--;
                tb0.setText(""+b0);
                denominator--;
                ldenominator.setText(""+denominator);
		}
	    }
            else if (arg.equals(pb1)) {
                b1++;
                tb1.setText(""+b1);
                denominator++;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(tb1)) {
                b1 = getInt(tb1, b1, 1, P);
                tb1.setText(""+b1);
                denominator = b0+b1+b2+b3; 
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(mb1)) {
                if (b1 > 1) {
                b1--;
                tb1.setText(""+b1);
                denominator--;
                ldenominator.setText(""+denominator);
		}
	    }
            else if (arg.equals(pb2)) {
                b2++;
                tb2.setText(""+b2);
                denominator++;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(tb2)) {
                b2 = getInt(tb2, b2, 1, P);
                tb2.setText(""+b2);
                denominator = b0+b1+b2+b3;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(mb2)) {
                if (b2 > 1) {
                b2--;
                tb2.setText(""+b2);
                denominator--;
                ldenominator.setText(""+denominator);
		}
	    }
            else if (arg.equals(pb3)) {
                b3++;
                tb3.setText(""+b3);
                denominator++;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(tb3)) {
                b3 = getInt(tb3, b3, 1, P);
                tb3.setText(""+b3);
                denominator = b0+b1+b2+b3;
                ldenominator.setText(""+denominator);
	    }
            else if (arg.equals(mb3)) {
                if (b3 > 1) {
                b3--;
                tb3.setText(""+b3);
                denominator--;
                ldenominator.setText(""+denominator);
		}
	    }
	    else if (arg.equals(fCT)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fCT(faces[t]);
		}
	    }            
	    else if (arg.equals(fwct)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fCT(faces[t],c0,c1,c2);
		}
	    }            
	    else if (arg.equals(fMS)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fMS(faces[t]);
		}
	    }            
	    else if (arg.equals(fPS6)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fPS6(faces[t]);
		}
	    }            
	    else if (arg.equals(fPS12)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fPS12(faces[t]);
		}
	    }            
	    else if (arg.equals(pierce)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fpierce(faces[t]);
		}
	    }            
	    else if (arg.equals(p01)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fp(faces[t],2);
		}
	    }            
	    else if (arg.equals(p02)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fp(faces[t],1);
		}
	    }            
	    else if (arg.equals(p12)) {
		int t = Face.getSelectedIndex()-1;
		if (t >= 0) { 
		    save();
		    tv.Config.fp(faces[t],0);
		}
	    }            
	    else if (arg.equals(eSplit)) {
		int e = Edge.getSelectedIndex()-1;
		if (e >= 0) { 
		    save();
		    tv.Config.eSplit(edges[e]);
		}
	    }            
	    else if (arg.equals(wes)) {
		int e = Edge.getSelectedIndex()-1;
		if (e >= 0) { 
		    save();
		    tv.Config.eSplit(edges[e],e0,e1);
		}
	    }            
            else if (arg.equals(pc0)) {
                c0++;
                tc0.setText(""+c0);
                fdenominator++;
                Lfdenominator.setText(""+fdenominator);
	    }
            else if (arg.equals(tc0)) {
                c0 = getInt(tc0, c0, 1, P);
                tc0.setText(""+c0);
                fdenominator = c0+c1+c2;
                Lfdenominator.setText(""+fdenominator);
	    }
            else if (arg.equals(mc0)) {
                if (c0 > 1) {
                c0--;
                tc0.setText(""+c0);
                fdenominator--;
                Lfdenominator.setText(""+fdenominator);
		}
	    }
            else if (arg.equals(pc1)) {
                c1++;
                tc1.setText(""+c1);
                fdenominator++;
                Lfdenominator.setText(""+fdenominator);
	    }
            else if (arg.equals(tc1)) {
                c1 = getInt(tc1, c1, 1, P);
                tc1.setText(""+c1);
                fdenominator = c0+c1+c2; 
                Lfdenominator.setText(""+fdenominator);
	    }
            else if (arg.equals(mc1)) {
                if (c1 > 1) {
                c1--;
                tc1.setText(""+c1);
                fdenominator--;
                Lfdenominator.setText(""+fdenominator);
		}
	    }
            else if (arg.equals(pc2)) {
                c2++;
                tc2.setText(""+c2);
                fdenominator++;
                Lfdenominator.setText(""+fdenominator);
	    }
            else if (arg.equals(tc2)) {
                c2 = getInt(tc2, c2, 1, P);
                tc2.setText(""+c2);
                fdenominator = c0+c1+c2;
                Lfdenominator.setText(""+fdenominator);
	    }
            else if (arg.equals(mc2)) {
                if (c2 > 1) {
                c2--;
                tc2.setText(""+c2);
                fdenominator--;
                Lfdenominator.setText(""+fdenominator);
		}
	    }
            else if (arg.equals(pe0)) {
                e0++;
                te0.setText(""+e0);
                edenominator++;
                Ledenominator.setText(""+edenominator);
	    }
            else if (arg.equals(te0)) {
                e0 = getInt(te0, e0, 1, P);
                te0.setText(""+e0);
                edenominator = e0+e1;
                Ledenominator.setText(""+edenominator);
	    }
            else if (arg.equals(me0)) {
                if (e0 > 1) {
                e0--;
                te0.setText(""+e0);
                edenominator--;
                Ledenominator.setText(""+edenominator);
		}
	    }
            else if (arg.equals(pe1)) {
                e1++;
                te1.setText(""+e1);
                edenominator++;
                Ledenominator.setText(""+edenominator);
	    }
            else if (arg.equals(te1)) {
                e1 = getInt(te1, e1, 1, P);
                te1.setText(""+e1);
                edenominator = e0+e1; 
                Ledenominator.setText(""+edenominator);
	    }
            else if (arg.equals(me1)) {
                if (e1 > 1) {
                e1--;
                te1.setText(""+e1);
                edenominator--;
                Ledenominator.setText(""+edenominator);
		}
	    }





	}
    }

    void save() {
        if (!tv.inApplet) {
	    config.pasts++;
	    tv.TV.saveIt(project(config.pasts));
	}
    }

    String project(int pasts) {
	return "r."+pasts + "~";
    }

    void debug(String s) {
	tv.Config.write(s);
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

    void write(String s) {
        System.out.println(s);
    }

}
