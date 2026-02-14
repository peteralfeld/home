import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class select extends Frame 
    implements ActionListener, ItemListener, Serializable {
    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);
    TextField Status;

    Panel Panel0, Panel1, Panel2, Panel3, Panel4, Panel5, Panel6;

    choice Tetrahedron, Face, Edge, Vertex, dashEdge, shadeFace;
    Choice AAndOr, AndOr, Radius, BAndOr;

    static int alpha = 70;

    Button alphaPlus, alphaMinus;
    TextField talpha;

    Button Stop, Clear, Flush, Quit;

    Button Reduce, General;

  
    Button Keep, Draw, All, V, E, F, Hide, None;

    Button Partial;

    Button Interior;
    boolean interior = false;

    Button Tets;
    boolean tets = false;

    Choice v0, v1, v2, v3, v4, v5, relation, sum;
    Choice V0, V1, V2, V3, V4, V5, Relation, Sum;
    Choice AV0, AV1, AV2, AV3, AV4, AV5, ARelation, ASum;
    Choice BV0, BV1, BV2, BV3, BV4, BV5, BRelation, BSum;
    Color cInterior = new Color(0,200,50);
    Color ncInterior = new Color(200,50,0);


    int r, d, nDps;

    int[] tetrahedra, faces, edges, vertics;

    Button Dash, Undash;
    Button Shade, Unshade;

    public select() {

	r = tv.TV.r; 
	d = tv.TV.d; 

	Panel0= new Panel();
        String banner = "Selection Panel";
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0.add(Banner);

        Clear = new Button("CLEAR");
        Clear.setBackground(new Color(240,0,0));
        Clear.setForeground(Color.white);
        Clear.addActionListener(this); 
        Panel0.add(Clear);

        Flush = new Button("Flush");
        Flush.setBackground(new Color(50,255,50));
        Flush.setForeground(Color.red);
        Flush.addActionListener(this); 
	Panel0.add(Flush);
        Stop = new Button("Stop");
        Stop.setBackground(Color.yellow);
        Stop.setForeground(Color.red);
        Stop.addActionListener(this); 
	Panel0.add(Stop);
        Quit = new Button("Quit");
        Quit.setBackground(Color.red);
        Quit.setForeground(Color.black);
        Quit.addActionListener(this); 
	Panel0.add(Quit);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        Panel0.add(Hide);

        None = new Button("None");
        None.setBackground(new Color(0,127,255));
        None.setForeground(Color.white);
        None.addActionListener(this); 
        Panel0.add(None);

        Interior = new Button("Interior");
	if (interior) {
	    Interior.setBackground(cInterior);
	}
	else {
	    Interior.setBackground(ncInterior);
	}
        Interior.setForeground(Color.white);
        Interior.addActionListener(this); 
        Panel0.add(Interior);

        Tets = new Button("Tets");
	if (interior) {
	    Tets.setBackground(cInterior);
	}
	else {
	    Tets.setBackground(ncInterior);
	}
        Tets.setForeground(Color.white);
        Tets.addActionListener(this); 
        Panel0.add(Tets);

        V = new Button("V");
        V.setBackground(new Color(0,127,255));
        V.setForeground(Color.white);
        V.addActionListener(this); 
        Panel0.add(V);

        E = new Button("E");
        E.setBackground(new Color(0,127,255));
        E.setForeground(Color.white);
        E.addActionListener(this); 
        Panel0.add(E);

        F = new Button("F");
        F.setBackground(new Color(0,127,255));
        F.setForeground(Color.white);
        F.addActionListener(this); 
        Panel0.add(F);

        All = new Button("All");
        All.setBackground(new Color(0,127,255));
        All.setForeground(Color.white);
        All.addActionListener(this); 
        Panel0.add(All);

        Partial = new Button("Partial");
	if (tv.Config.partial) {
	    Partial.setBackground(cInterior);
	}
	else {
	    Partial.setBackground(ncInterior);
	}
        Partial.setForeground(Color.white);
        Partial.addActionListener(this); 
        Panel0.add(Partial);

        Reduce = new Button("Reduce");
        Reduce.setBackground(new Color(0,0,100));
        Reduce.setForeground(Color.yellow);
        Reduce.addActionListener(this); 
        Panel0.add(Reduce);

        General = new Button("General");
        General.setBackground(new Color(0,0,100));
        General.setForeground(Color.yellow);
        General.addActionListener(this); 
        Panel0.add(General);



        Panel1 = new Panel();

        Color choices = new Color(100,150,255);

        Label lbl1 = new Label("Tetrahedron:");
        lbl1.setForeground(fg);
        lbl1.setBackground(bg);
        Panel1.add(lbl1);
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
            String v0 = tv.Config.nameV(tv.Config.tets[i][0]);
            String v1 = tv.Config.nameV(tv.Config.tets[i][1]);
            String v2 = tv.Config.nameV(tv.Config.tets[i][2]);
            String v3 = tv.Config.nameV(tv.Config.tets[i][3]);
            String s = v0+"-"+v1+"-"+v2+"-"+v3;
            Tetrahedron.addItem(s);
	}
        Tetrahedron.addItemListener(this);
        Tetrahedron.select(0);
        Panel1.add(Tetrahedron);

        Label lbl2 = new Label("Face:");
        lbl2.setForeground(fg);
        lbl2.setBackground(bg);
        Panel1.add(lbl2);
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
            String v0 = tv.Config.nameV(tv.Config.faces[i][0]);
            String v1 = tv.Config.nameV(tv.Config.faces[i][1]);
            String v2 = tv.Config.nameV(tv.Config.faces[i][2]);
            String s = v0+"-"+v1+"-"+v2;
            Face.addItem(s);
	}
        Face.addItemListener(this);
        Face.select(0);
        Panel1.add(Face);

        Label lbl3 = new Label("Edge:");
        lbl3.setForeground(fg);
        lbl3.setBackground(bg);
        Panel1.add(lbl3);
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
            String v0 = tv.Config.nameV(tv.Config.edges[i][0]);
            String v1 = tv.Config.nameV(tv.Config.edges[i][1]);
            String s = v0+"-"+v1;
            Edge.addItem(s);
	}
        Edge.addItemListener(this);
        Edge.select(0);
        Panel1.add(Edge);

        Label lbl4 = new Label("Vertex:");
        lbl4.setForeground(fg);
        lbl4.setBackground(bg);
        Panel1.add(lbl4);
	Vertex = new choice(); 
	Vertex.setBackground(choices);
        Vertex.addItem("");
        for (int i =0; i < tv.Config.V; i++) {
            String s = "" +tv.Config.nameV(i);
            Vertex.addItem(s);
	}
        Vertex.addItemListener(this);
        Vertex.select(0);
        Panel1.add(Vertex);

        Label lbl5 = new Label("Radius:");
        lbl5.setForeground(fg);
        lbl5.setBackground(bg);
        Panel1.add(lbl5);
	Radius = new choice(); 
	Radius.setBackground(choices);
        for (int i =0; i <=d; i++) {
            String s = "" +i;
            Radius.addItem(s);
	}
        Radius.addItemListener(this);
        Radius.select(0);
        Panel1.add(Radius);

        Panel2 = new Panel();

        Keep = new Button("Keep");
        Keep.setBackground(new Color(100,20,50));
        Keep.setForeground(Color.white);
        Keep.addActionListener(this); 
        Panel2.add(Keep);

        Draw = new Button("DRAW");
        Draw.setBackground(new Color(100,20,50));
        Draw.setForeground(Color.white);
        Draw.addActionListener(this); 
        Panel2.add(Draw);

	Panel2.add(new Label("[[  V"));
        v0 = null;
        v0 = new Choice();
        v0.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    v0.addItem(tv.Config.nameV(i));
	}
        v0.addItemListener(this);
        v0.setBackground(new Color(127,0,0));
        v0.setForeground(Color.white);
        v0.select(0);
        Panel2.add(v0);
	Panel2.add(new Label("+ V"));
        v1 = null;
        v1 = new Choice();
        v1.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    v1.addItem(tv.Config.nameV(i));
	}
        v1.addItemListener(this);
        v1.setBackground(new Color(127,0,0));
        v1.setForeground(Color.white);
        v1.select(0);
        Panel2.add(v1);
        Panel2.add(new Label("+ V")); 
        v2 = null;
        v2 = new Choice();
        v2.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    v2.addItem(tv.Config.nameV(i));
	}
        v2.addItemListener(this);
        v2.setBackground(new Color(127,0,0));
        v2.setForeground(Color.white);
        v2.select(0);
        Panel2.add(v2);
        Panel2.add(new Label("+ V"));
        v3 = null;
        v3 = new Choice();
        v3.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    v3.addItem(tv.Config.nameV(i));
	}
        v3.addItemListener(this);
        v3.setBackground(new Color(127,0,0));
        v3.setForeground(Color.white);
        v3.select(0);
        Panel2.add(v3);
        Panel2.add(new Label("+ V"));
        v4 = null;
        v4 = new Choice();
        v4.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    v4.addItem(tv.Config.nameV(i));
	}
        v4.addItemListener(this);
        v4.setBackground(new Color(127,0,0));
        v4.setForeground(Color.white);
        v4.select(0);
        Panel2.add(v4);
        Panel2.add(new Label("+ V"));
        v5 = null;
        v5 = new Choice();
        v5.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    v5.addItem(tv.Config.nameV(i));
	}
        v5.addItemListener(this);
        v5.setBackground(new Color(127,0,0));
        v5.setForeground(Color.white);
        v5.select(0);
        Panel2.add(v5);
        relation = null;
        relation = new Choice();
        relation.add("=");
        relation.add("<=");
        relation.add(">=");
        relation.addItemListener(this);
        relation.setBackground(new Color(0,127,0));
        relation.setForeground(Color.white);
        Panel2.add(new Label(" "));
        relation.select(0);
        Panel2.add(relation);
        sum = null;
        sum = new Choice();
        for (int i = 0; i <=  tv.Config.d ; i++) {
	    sum.addItem(""+i);
	}
        sum.setBackground(new Color(127,0,127));
        sum.setForeground(Color.white);
        Panel2.add(new Label(" "));
        sum.select(d);
        Panel2.add(sum);

        Panel3 = new Panel();

        AndOr = new Choice();
        AndOr.add("and");
        AndOr.add("or");
        AndOr.add("and not");
        AndOr.setBackground(Color.red);
        Panel3.add(AndOr);

	Panel3.add(new Label("V"));
        V0 = null;
        V0 = new Choice();
        V0.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    V0.addItem(tv.Config.nameV(i));
	}
        V0.addItemListener(this);
        V0.setBackground(new Color(127,0,0));
        V0.setForeground(Color.white);
        V0.select(0);
        Panel3.add(V0);
	Panel3.add(new Label("+ V"));
        V1 = null;
        V1 = new Choice();
        V1.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    V1.addItem(tv.Config.nameV(i));
	}
        V1.addItemListener(this);
        V1.setBackground(new Color(127,0,0));
        V1.setForeground(Color.white);
        V1.select(0);
        Panel3.add(V1);
        Panel3.add(new Label("+ V")); 
        V2 = null;
        V2 = new Choice();
        V2.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    V2.addItem(tv.Config.nameV(i));
	}
        V2.addItemListener(this);
        V2.setBackground(new Color(127,0,0));
        V2.setForeground(Color.white);
        V2.select(0);
        Panel3.add(V2);
        Panel3.add(new Label("+ V"));
        V3 = null;
        V3 = new Choice();
        V3.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    V3.addItem(tv.Config.nameV(i));
	}
        V3.addItemListener(this);
        V3.setBackground(new Color(127,0,0));
        V3.setForeground(Color.white);
        V3.select(0);
        Panel3.add(V3);
        Panel3.add(new Label("+ V"));
        V4 = null;
        V4 = new Choice();
        V4.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    V4.addItem(tv.Config.nameV(i));
	}
        V4.addItemListener(this);
        V4.setBackground(new Color(127,0,0));
        V4.setForeground(Color.white);
        V4.select(0);
        Panel3.add(V4);
        Panel3.add(new Label("+ V"));
        V5 = null;
        V5 = new Choice();
        V5.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    V5.addItem(tv.Config.nameV(i));
	}
        V5.addItemListener(this);
        V5.setBackground(new Color(127,0,0));
        V5.setForeground(Color.white);
        V5.select(0);
        Panel3.add(V5);
        Relation = null;
        Relation = new Choice();
        Relation.add("=");
        Relation.add("<=");
        Relation.add(">=");
        Relation.addItemListener(this);
        Relation.setBackground(new Color(0,127,0));
        Relation.setForeground(Color.white);
        Panel3.add(new Label(" "));
        Relation.select(0);
        Panel3.add(Relation);
        Sum = null;
        Sum = new Choice();
        for (int i = 0; i <=  tv.Config.d ; i++) {
	    Sum.addItem(""+i);
	}
        Sum.setBackground(new Color(127,0,127));
        Sum.setForeground(Color.white);
        Panel3.add(new Label(" "));
        Sum.select(d);
        Panel3.add(Sum);
        Panel3.add(new Label("]"));

        Panel4 = new Panel();

        AAndOr = new Choice();
        AAndOr.add("and");
        AAndOr.add("or");
        AAndOr.add("and not");
        AAndOr.setBackground(Color.red);
        Panel4.add(AAndOr);

	Panel4.add(new Label("V"));
        AV0 = null;
        AV0 = new Choice();
        AV0.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    AV0.addItem(tv.Config.nameV(i));
	}
        AV0.addItemListener(this);
        AV0.setBackground(new Color(127,0,0));
        AV0.setForeground(Color.white);
        AV0.select(0);
        Panel4.add(AV0);
	Panel4.add(new Label("+ V"));
        AV1 = null;
        AV1 = new Choice();
        AV1.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    AV1.addItem(tv.Config.nameV(i));
	}
        AV1.addItemListener(this);
        AV1.setBackground(new Color(127,0,0));
        AV1.setForeground(Color.white);
        AV1.select(0);
        Panel4.add(AV1);
        Panel4.add(new Label("+ V")); 
        AV2 = null;
        AV2 = new Choice();
        AV2.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    AV2.addItem(tv.Config.nameV(i));
	}
        AV2.addItemListener(this);
        AV2.setBackground(new Color(127,0,0));
        AV2.setForeground(Color.white);
        AV2.select(0);
        Panel4.add(AV2);
        Panel4.add(new Label("+ V"));
        AV3 = null;
        AV3 = new Choice();
        AV3.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    AV3.addItem(tv.Config.nameV(i));
	}
        AV3.addItemListener(this);
        AV3.setBackground(new Color(127,0,0));
        AV3.setForeground(Color.white);
        AV3.select(0);
        Panel4.add(AV3);
        Panel4.add(new Label("+ V"));
        AV4 = null;
        AV4 = new Choice();
        AV4.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    AV4.addItem(tv.Config.nameV(i));
	}
        AV4.addItemListener(this);
        AV4.setBackground(new Color(127,0,0));
        AV4.setForeground(Color.white);
        AV4.select(0);
        Panel4.add(AV4);
        Panel4.add(new Label("+ V"));
        AV5 = null;
        AV5 = new Choice();
        AV5.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    AV5.addItem(tv.Config.nameV(i));
	}
        AV5.addItemListener(this);
        AV5.setBackground(new Color(127,0,0));
        AV5.setForeground(Color.white);
        AV5.select(0);
        Panel4.add(AV5);
        ARelation = null;
        ARelation = new Choice();
        ARelation.add("=");
        ARelation.add("<=");
        ARelation.add(">=");
        ARelation.addItemListener(this);
        ARelation.setBackground(new Color(0,127,0));
        ARelation.setForeground(Color.white);
        Panel4.add(new Label(" "));
        ARelation.select(0);
        Panel4.add(ARelation);
        ASum = null;
        ASum = new Choice();
        for (int i = 0; i <=  tv.Config.d ; i++) {
	    ASum.add(""+i);
	}
        ASum.setBackground(new Color(127,0,127));
        ASum.setForeground(Color.white);
        Panel4.add(new Label(" "));
        ASum.select(d);
        Panel4.add(ASum);
        Panel4.add(new Label("]"));

        Panel5 = new Panel();

        BAndOr = new Choice();
        BAndOr.add("and");
        BAndOr.add("or");
        BAndOr.add("and not");
        BAndOr.setBackground(Color.red);
        Panel5.add(BAndOr);
	Panel5.add(new Label("V"));
        BV0 = null;
        BV0 = new Choice();
        BV0.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    BV0.addItem(tv.Config.nameV(i));
	}
        BV0.addItemListener(this);
        BV0.setBackground(new Color(127,0,0));
        BV0.setForeground(Color.white);
        BV0.select(0);
        Panel5.add(BV0);
	Panel5.add(new Label("+ V"));
        BV1 = null;
        BV1 = new Choice();
        BV1.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    BV1.addItem(tv.Config.nameV(i));
	}
        BV1.addItemListener(this);
        BV1.setBackground(new Color(127,0,0));
        BV1.setForeground(Color.white);
        BV1.select(0);
        Panel5.add(BV1);
        Panel5.add(new Label("+ V")); 
        BV2 = null;
        BV2 = new Choice();
        BV2.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    BV2.addItem(tv.Config.nameV(i));
	}
        BV2.addItemListener(this);
        BV2.setBackground(new Color(127,0,0));
        BV2.setForeground(Color.white);
        BV2.select(0);
        Panel5.add(BV2);
        Panel5.add(new Label("+ V"));
        BV3 = null;
        BV3 = new Choice();
        BV3.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    BV3.addItem(tv.Config.nameV(i));
	}
        BV3.addItemListener(this);
        BV3.setBackground(new Color(127,0,0));
        BV3.setForeground(Color.white);
        BV3.select(0);
        Panel5.add(BV3);
        Panel5.add(new Label("+ V"));
        BV4 = null;
        BV4 = new Choice();
        BV4.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    BV4.addItem(tv.Config.nameV(i));
	}
        BV4.addItemListener(this);
        BV4.setBackground(new Color(127,0,0));
        BV4.setForeground(Color.white);
        BV4.select(0);
        Panel5.add(BV4);
        Panel5.add(new Label("+ V"));
        BV5 = null;
        BV5 = new Choice();
        BV5.add(" ");
        for (int i = 0; i <  tv.Config.V ; i++) {
	    BV5.addItem(tv.Config.nameV(i));
	}
        BV5.addItemListener(this);
        BV5.setBackground(new Color(127,0,0));
        BV5.setForeground(Color.white);
        BV5.select(0);
        Panel5.add(BV5);
        BRelation = null;
        BRelation = new Choice();
        BRelation.add("=");
        BRelation.add("<=");
        BRelation.add(">=");
        BRelation.addItemListener(this);
        BRelation.setBackground(new Color(0,127,0));
        BRelation.setForeground(Color.white);
        Panel5.add(new Label(" "));
        BRelation.select(0);
        Panel5.add(BRelation);
        BSum = null;
        BSum = new Choice();
        for (int i = 0; i <=  tv.Config.d ; i++) {
	    BSum.add(""+i);
	}
        BSum.setBackground(new Color(127,0,127));
        BSum.setForeground(Color.white);
        Panel5.add(new Label(" "));
        BSum.select(d);
        Panel5.add(BSum);






        Panel6 = new Panel();

        Label dEdg = new Label("dash Edge:");
        dEdg.setForeground(fg);
        dEdg.setBackground(bg);
        Panel6.add(dEdg);
	dashEdge = new choice(); 
        dashEdge.setBackground(choices);
        dashEdge.addItem("");
        for (int j = 0; j < tv.Config.E; j++) {
            int i = edges[j];
            String v0 = tv.Config.nameV(tv.Config.edges[i][0]);
            String v1 = tv.Config.nameV(tv.Config.edges[i][1]);
            String s = v0+"-"+v1;
            dashEdge.addItem(s);
	}
        dashEdge.addItemListener(this);
        dashEdge.select(0);
        Panel6.add(dashEdge);

        Dash = new Button("Dash All");
        Dash.setBackground(new Color(240,0,0));
        Dash.setForeground(Color.white);
        Dash.addActionListener(this); 
        Panel6.add(Dash);

        Undash = new Button("Undash");
        Undash.setBackground(new Color(240,0,0));
        Undash.setForeground(Color.white);
        Undash.addActionListener(this); 
        Panel6.add(Undash);

        
        Label sFace = new Label("shade Face:");
        sFace.setForeground(fg);
        sFace.setBackground(bg);

        Panel6.add(sFace);
	shadeFace = new choice(); 
        shadeFace.setBackground(choices);
        shadeFace.addItem("");
        for (int j = 0; j < tv.Config.T; j++) {
            int i = faces[j];
            String v0 = tv.Config.nameV(tv.Config.faces[i][0]);
            String v1 = tv.Config.nameV(tv.Config.faces[i][1]);
            String v2 = tv.Config.nameV(tv.Config.faces[i][2]);
            String s = v0+"-"+v1+"-"+v2;
            shadeFace.addItem(s);
	}
        shadeFace.addItemListener(this);
        shadeFace.select(0);
        Panel6.add(shadeFace);

        Shade = new Button("Shade All");
        Shade.setBackground(new Color(240,0,0));
        Shade.setForeground(Color.white);
        Shade.addActionListener(this); 
        Panel6.add(Shade);

        Unshade = new Button("Unshade");
        Unshade.setBackground(new Color(240,0,0));
        Unshade.setForeground(Color.white);
        Unshade.addActionListener(this); 
        Panel6.add(Unshade);

        Label alphaLab = new Label(" transparency:");
        alphaLab.setForeground(fg);
        alphaLab.setBackground(bg);
        Panel6.add(alphaLab);
        alphaMinus = new Button("<");
        alphaMinus.setBackground(buttonBackground);
        alphaMinus.setForeground(buttonForeground);
        alphaMinus.addActionListener(this); 
	Panel6.add(alphaMinus);
        talpha = new TextField(5);
        talpha.setBackground(textBackground);        
        talpha.setForeground(textForeground);        
        talpha.setText(" "+alpha);
        talpha.addActionListener(this); 
        Panel6.add(talpha);
        alphaPlus = new Button(">");
        alphaPlus.setBackground(buttonBackground);
        alphaPlus.setForeground(buttonForeground);
        alphaPlus.addActionListener(this); 
	Panel6.add(alphaPlus);
        


        setLayout(new GridLayout(7,1));
        add(Panel0);
        add(Panel1);
        add(Panel2);
        add(Panel3);
        add(Panel4);
        add(Panel5);
        add(Panel6);
        setBackground(new Color(255,255,210));
        setSize(1000,290);
        setTitle("Selection Panel");
        tv.Config.partial = false;
        setVisible(false);

    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
	tv.TV.Config.addEvent(E,23);
    }

    void wait(int n) {
        try {
	    Thread.sleep(n);
	}
        catch (java.lang.InterruptedException e) {;}
    }

    public void ItemStateChanged(java.awt.event.ItemEvent E) {
	Object arg = E.getSource();
	if (arg.equals(Tetrahedron)) {
            if (Tetrahedron.trigger && Tetrahedron.getSelectedIndex() > 0) {
		tetrahedron();
	    }
            else {
		Tetrahedron.trigger = true;
	    }
	}
	else if (arg.equals(Face)) {
            if (Face.trigger && Face.getSelectedIndex() > 0) {
		face();
	    }
            else {
		Face.trigger = true;
	    }

	}
	else if (arg.equals(Edge)) {
            if (Edge.trigger && Edge.getSelectedIndex() > 0) {
		edge();
	    }
            else {
		Edge.trigger = true;
	    }
	}
	else if (arg.equals(Vertex)) {
            if (Vertex.trigger && Vertex.getSelectedIndex() > 0) {
		vertex();
	    }
            else {
		Vertex.trigger = true;
	    }
	}
	else if (arg.equals(dashEdge)) {
            int i = dashEdge.getSelectedIndex()-1;
            if (i >= 0) {
		tv.Config.dEdges[edges[i]] = !tv.Config.dEdges[edges[i]];
	    }
            tv.Config.drawIt();
	}
	else if (arg.equals(shadeFace)) {
            int i = shadeFace.getSelectedIndex()-1;
            if (i >= 0) {
		tv.Config.shadeFaces[faces[i]] = !tv.Config.shadeFaces[faces[i]];
	    }
            tv.Config.drawIt();
	}
	else if (arg.equals(Radius)) {
	    radius();
	}
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Stop)) {
	    tv.Config.stop();
	}
        else if (arg.equals(Quit)) {
	    tv.TV.stop();
	}
        else if (arg.equals(Flush)) {
	    tv.TV.Config.flush();
	}
        else if (arg.equals(Hide)) {
            all();
	    setVisible(false);
            tv.selectOn = false;
	    tv.Config.partial = false;
	}
        else {
	    tv.TV.Config.addEvent(E,22);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent Event) {
	Object arg = Event.getSource();
        if (arg.equals(Clear)) {
	    clear();
            all();
	}
        else if (arg.equals(All)) {
	    all();
	}
        else if (arg.equals(V)) {
	    v();
	}
        else if (arg.equals(E)) {
	    e();
	}
        else if (arg.equals(F)) {
	    f();
	}
        else if (arg.equals(None)) {
	    none();
	}
        else if (arg.equals(Interior)) {
	    interior = !interior;
            if (interior) {
		Interior.setBackground(cInterior);
	    }
            else {
		Interior.setBackground(ncInterior);
	    }
	}
        else if (arg.equals(Tets)) {
	    tets = !tets;
            if (tets) {
		Tets.setBackground(cInterior);
                none();
	    }
            else {
		Tets.setBackground(ncInterior);
	    }
	}
        else if (arg.equals(Partial)) {
	    tv.Config.partial = !tv.Config.partial;
	    if (tv.Config.partial) {
		Partial.setBackground(cInterior);
	    }
	    else {
		Partial.setBackground(ncInterior);
	    }
            tv.Config.drawIt();
	}
        else if (arg.equals(Keep)) {
	    draw(true);
	}
        else if (arg.equals(Draw)) {
	    draw();
	}
        else if (arg.equals(Dash)) {
            for (int i = 0; i< tv.Config.E; i++) {
		tv.Config.dEdges[i] = true;
	    }
            tv.Config.drawIt();
	}
        else if (arg.equals(Undash)) {
            for (int i = 0; i< tv.Config.E; i++) {
		tv.Config.dEdges[i] = false;
	    }
            tv.Config.drawIt();
	}
        else if (arg.equals(Shade)) {
            for (int i = 0; i< tv.Config.T; i++) {
		tv.Config.shadeFaces[i] = true;
	    }
            tv.Config.drawIt();
	}
        else if (arg.equals(Unshade)) {
            for (int i = 0; i< tv.Config.T; i++) {
		tv.Config.shadeFaces[i] = false;
	    }
            tv.Config.drawIt();
	}
        else if (arg.equals(alphaPlus)) {
            if (alpha < 245) {
		alpha += 10;
	    }  
            else {
		alpha = 255;
	    }
            talpha.setText(""+alpha);
            tv.Config.drawIt();
	}
        else if (arg.equals(alphaMinus)) {
            if (alpha > 10) {
		alpha -= 10;
	    }  
            else {
		alpha = 0;
	    }
            talpha.setText(""+alpha);
            tv.Config.drawIt();
	}
        else if (arg.equals(talpha)) {
            alpha = getInt(talpha,alpha,0,255);
            talpha.setText(""+alpha);
            tv.Config.drawIt();
	}
        else if (arg.equals(Reduce)) {
            tv.Config.reduce(false);
            setVisible(false);
	}
        else if (arg.equals(General)) {
            tv.Config.reduce(true);
            setVisible(false);
	}
    }

    void draw() {
	draw(false);
    }

    void draw(boolean keep) {
        Tetrahedron.select(0);
        Tetrahedron.trigger = true;
        Face.select(0);
        Face.trigger = true;
        Edge.select(0);
        Edge.trigger = true;
        Vertex.select(0);
        Vertex.trigger = true;
        int i0 = v0.getSelectedIndex();
        int i1 = v1.getSelectedIndex();
        int i2 = v2.getSelectedIndex();
        int i3 = v3.getSelectedIndex();
        int i4 = v4.getSelectedIndex();
        int i5 = v5.getSelectedIndex();
        int I0 = V0.getSelectedIndex();
        int I1 = V1.getSelectedIndex();
        int I2 = V2.getSelectedIndex();
        int I3 = V3.getSelectedIndex();
        int I4 = V4.getSelectedIndex();
        int I5 = V5.getSelectedIndex();
        int AI0 = AV0.getSelectedIndex();
        int AI1 = AV1.getSelectedIndex();
        int AI2 = AV2.getSelectedIndex();
        int AI3 = AV3.getSelectedIndex();
        int AI4 = AV4.getSelectedIndex();
        int AI5 = AV5.getSelectedIndex();
        int BI0 = BV0.getSelectedIndex();
        int BI1 = BV1.getSelectedIndex();
        int BI2 = BV2.getSelectedIndex();
        int BI3 = BV3.getSelectedIndex();
        int BI4 = BV4.getSelectedIndex();
        int BI5 = BV5.getSelectedIndex();
        int relation1 = relation.getSelectedIndex();
        int relation2 = Relation.getSelectedIndex();
        int relation3 = ARelation.getSelectedIndex();
        int relation4 = BRelation.getSelectedIndex();
        int sum1 = sum.getSelectedIndex();
        int sum2 = Sum.getSelectedIndex();
        int sum3 = ASum.getSelectedIndex();
        int sum4 = BSum.getSelectedIndex();
        boolean active = false;
        if (i0+i1+i2+i3+i4+i5 > 0) {
	    active = true;
	}
        boolean Active = false;
        if (I0+I1+I2+I3+I4+I5 > 0) {
	    Active = true;
	}
        boolean AActive = false;
        if (AI0+AI1+AI2+AI3+AI4+AI5 > 0) {
	    AActive = true;
	}
        boolean BActive = false;
        if (BI0+BI1+BI2+BI3+BI4+BI5 > 0) {
	    BActive = true;
	}
        if (!active && !Active && !AActive && !BActive) {
            all();
	}
	int nDps = tv.TV.Config.nDps;
	int tvV = tv.TV.Config.V;
        for (int i = 0; i < nDps; i++) {
            boolean decision = false;
	    if (active) {
		int k = 0; 
                if (i0 > 0) {
		    k = k + tv.TV.Config.dps[i][i0-1];
		}
                if (i1 > 0) {
		    k = k + tv.TV.Config.dps[i][i1-1];
		}
                if (i2 > 0) {
		    k = k + tv.TV.Config.dps[i][i2-1];
		}
                if (i3 > 0) {
		    k = k + tv.TV.Config.dps[i][i3-1];
		}
                if (i4 > 0) {
		    k = k + tv.TV.Config.dps[i][i4-1];
		}
                if (i5 > 0) {
		    k = k + tv.TV.Config.dps[i][i5-1];
		}
                if (relation1 == 0 && k == sum1) {
		    decision = true;
		}
                if (relation1 == 1 && k <= sum1) {
		    decision = true;
		}
                if (relation1 == 2 && k >= sum1) {
		    decision = true;
		}
	    }
            boolean Decision = false;
	    if (Active) {
		int k = 0; 
                if (I0 > 0) {
		    k = k + tv.TV.Config.dps[i][I0-1];
		}
                if (I1 > 0) {
		    k = k + tv.TV.Config.dps[i][I1-1];
		}
                if (I2 > 0) {
		    k = k + tv.TV.Config.dps[i][I2-1];
		}
                if (I3 > 0) {
		    k = k + tv.TV.Config.dps[i][I3-1];
		}
                if (I4 > 0) {
		    k = k + tv.TV.Config.dps[i][I4-1];
		}
                if (I5 > 0) {
		    k = k + tv.TV.Config.dps[i][I5-1];
		}
                if (relation2 == 0 && k == sum2) {
		    Decision = true;
		}
                if (relation2 == 1 && k <= sum2) {
		    Decision = true;
		}
                if (relation2 == 2 && k >= sum2) {
		    Decision = true;
		}
	    }
            boolean ADecision = false;
	    if (AActive) {
		int k = 0; 
                if (AI0 > 0) {
		    k = k + tv.TV.Config.dps[i][AI0-1];
		}
                if (AI1 > 0) {
		    k = k + tv.TV.Config.dps[i][AI1-1];
		}
                if (AI2 > 0) {
		    k = k + tv.TV.Config.dps[i][AI2-1];
		}
                if (AI3 > 0) {
		    k = k + tv.TV.Config.dps[i][AI3-1];
		}
                if (AI4 > 0) {
		    k = k + tv.TV.Config.dps[i][AI4-1];
		}
                if (AI5 > 0) {
		    k = k + tv.TV.Config.dps[i][AI5-1];
		}
                if (relation3 == 0 && k == sum3) {
		    ADecision = true;
		}
                if (relation3 == 1 && k <= sum3) {
		    ADecision = true;
		}
                if (relation3 == 2 && k >= sum3) {
		    ADecision = true;
		}
	    }
            boolean BDecision = false;
	    if (BActive) {
		int k = 0; 
                if (BI0 > 0) {
		    k = k + tv.TV.Config.dps[i][BI0-1];
		}
                if (BI1 > 0) {
		    k = k + tv.TV.Config.dps[i][BI1-1];
		}
                if (BI2 > 0) {
		    k = k + tv.TV.Config.dps[i][BI2-1];
		}
                if (BI3 > 0) {
		    k = k + tv.TV.Config.dps[i][BI3-1];
		}
                if (BI4 > 0) {
		    k = k + tv.TV.Config.dps[i][BI4-1];
		}
                if (BI5 > 0) {
		    k = k + tv.TV.Config.dps[i][BI5-1];
		}
                if (relation4 == 0 && k == sum4) {
		    BDecision = true;
		}
                if (relation4 == 1 && k <= sum4) {
		    BDecision = true;
		}
                if (relation4 == 2 && k >= sum4) {
		    BDecision = true;
		}
	    }
            boolean verdict = false;
            int andor = AndOr.getSelectedIndex();
            if(!active && Decision) {
		verdict = true;
	    }            
            else if(!Active && decision) {
		verdict = true;
	    }            
	    else if (active && Active) {
		if (andor == 0 && decision && Decision) {
		    verdict = true;
		}            
		else if (andor == 1 && (decision || Decision)) {
		    verdict = true;
		}            
		else if (andor == 2 && decision && !Decision) {
		    verdict = true;
		}            
	    }
            if (AActive) {
                boolean averdict = false;
		int Aandor = AAndOr.getSelectedIndex();
		if (Aandor == 0 && verdict && ADecision) {
		    averdict = true;
		}
		else if (Aandor == 1 && (ADecision || verdict)) {
		    averdict = true;
		}
		else if (Aandor == 2 && verdict && !ADecision) {
		    averdict = true;
		}
                verdict = averdict;
	    }
            if (BActive) {
                boolean bverdict = false;
		int Bandor = BAndOr.getSelectedIndex();
		if (Bandor == 0 && verdict && BDecision) {
		    bverdict = true;
		}
		else if (Bandor == 1 && (BDecision || verdict)) {
		    bverdict = true;
		}
		else if (Bandor == 2 && verdict && !BDecision) {
		    bverdict = true;
		}
                verdict = bverdict;
	    }
	    if (verdict) {
		tv.Config.dps[i][tvV+2] = 1;
	    }
            else if (!keep) {
		tv.Config.dps[i][tvV+2] = 0;
	    }              
	}
	tv.Config.drawIt();
    }		     

    void radius() {
        int t = Face.getSelectedIndex();
        if (t > 0) {
	    face();
	}
        t = Edge.getSelectedIndex();
        if (t > 0) {
	    edge();
	}
        t = Vertex.getSelectedIndex();
        if (t > 0) {
	    vertex();
	}
    }

    void triggerit() {
        wait(100);
        Tetrahedron.trigger = true;
        Face.trigger = true;
        Edge.trigger = true;
        Vertex.trigger = true;
    }

    void tetrahedron() {
	int idx = Tetrahedron.getSelectedIndex();
        if (idx > 0) {
	    int t = tetrahedra[idx-1];
	    int nDps = tv.TV.Config.nDps;
	    int tvV = tv.TV.Config.V;
	    int i0 = tv.TV.Config.tets[t][0];
	    int i1 = tv.TV.Config.tets[t][1];
	    int i2 = tv.TV.Config.tets[t][2];
	    int i3 = tv.TV.Config.tets[t][3];
	    for (int i = 0; i < nDps; i++) {
		int cnt = tv.Config.dps[i][i0]+tv.Config.dps[i][i1]+tv.Config.dps[i][i2]+tv.Config.dps[i][i3];
		if (cnt == tv.Config.d) {
                    if (tets) {
			if (tv.Config.dps[i][i0] > 0 &&
                            tv.Config.dps[i][i1] > 0 &&
                            tv.Config.dps[i][i2] > 0 &&
			    tv.Config.dps[i][i3] > 0) {
			    tv.Config.dps[i][tvV+2] = 1 - tv.Config.dps[i][tvV+2] ;
			}
		    }
		    else {
			if (!interior) {
			    tv.Config.dps[i][tvV+2] = 1;
			}
			else {
			    if (tv.Config.dps[i][i0] > 0 &&
				tv.Config.dps[i][i1] > 0 &&
				tv.Config.dps[i][i2] > 0 &&
				tv.Config.dps[i][i3] > 0) {
				tv.Config.dps[i][tvV+2] = 1;
			    }
			    else {
				tv.Config.dps[i][tvV+2] = 0;
			    }
			}
		    }
		}
	    }
	    tv.Config.drawIt();
	    Face.reset();
	    Edge.reset();
	    Vertex.reset();
	    triggerit();
	}
    }

    void face() {
	int idx = Face.getSelectedIndex();
        if (idx > 0) {
	    int rho = Radius.getSelectedIndex();
	    int t = faces[idx-1];
	    int nDps = tv.TV.Config.nDps;
	    int tvV = tv.TV.Config.V;
	    int i0 = tv.TV.Config.faces[t][0];
	    int i1 = tv.TV.Config.faces[t][1];
	    int i2 = tv.TV.Config.faces[t][2];
	    for (int i = 0; i < nDps; i++) {
		tv.Config.dps[i][tvV+2] = 0;
		int cnt = tv.Config.dps[i][i0]+tv.Config.dps[i][i1]+tv.Config.dps[i][i2];
		if (cnt >= tv.Config.d - rho) {
                    int N = tv.Config.N;
                    for (int j = 0; j < N; j++) {
			if (tv.Config.inTet(i0,j) && tv.Config.inTet(i1,j)  && tv.Config.inTet(i2,j)) {
			    boolean inIt = true;
                            for (int k = 0; k < tvV; k++) {
				if (tv.Config.dps[i][k] > 0 && !tv.Config.inTet(k,j)) {
				    inIt = false;
				}
			    }
                            if (inIt && interior) {
                                if (tv.Config.dps[i][i0] == 0 || tv.Config.dps[i][i1] == 0 || tv.Config.dps[i][i2] == 0) {
				    inIt = false;
				}
			    }
                            if (inIt) {
				tv.Config.dps[i][tvV+2] = 1;
                                j = N;
			    }
			}
		    }
		}
	    }
	    tv.Config.drawIt();
	    Tetrahedron.reset();
            Edge.reset();
            Vertex.reset();    
            triggerit();
	}
    }

    void edge() {
	int idx = Edge.getSelectedIndex();
        if (idx > 0) {
	    int rho = Radius.getSelectedIndex();
	    int t = edges[idx-1];
	    int nDps = tv.TV.Config.nDps;
	    int tvV = tv.TV.Config.V;
	    int i0 = tv.TV.Config.edges[t][0];
	    int i1 = tv.TV.Config.edges[t][1];
	    for (int i = 0; i < nDps; i++) {
		tv.Config.dps[i][tvV+2] = 0;
		int cnt = tv.Config.dps[i][i0]+tv.Config.dps[i][i1];
		if (cnt >= tv.Config.d - rho) {
                    int N = tv.Config.N;
                    for (int j = 0; j < N; j++) {
			if (tv.Config.inTet(i0,j) && tv.Config.inTet(i1,j)) {
			    boolean inIt = true;
                            for (int k = 0; k < tvV; k++) {
				if (tv.Config.dps[i][k] > 0 && !tv.Config.inTet(k,j)) {
				    inIt = false;
				}
			    }
                            if (inIt && interior) {
                                if (tv.Config.dps[i][i0] == 0 || tv.Config.dps[i][i1] == 0) {
				    inIt = false;
				}
			    }
                            if (inIt) {
				tv.Config.dps[i][tvV+2] = 1;
                                j = N;
			    }
			}
		    }
		}
	    }
	    tv.Config.drawIt();
	    Tetrahedron.reset();
            Face.reset();
            Vertex.reset();    
            triggerit();
	}
    }

    void vertex() {
	int t = Vertex.getSelectedIndex();
        if (t > 0) {
	    int rho = Radius.getSelectedIndex();
	    t--;
	    int nDps = tv.TV.Config.nDps;
	    int tvV = tv.TV.Config.V;
	    for (int i = 0; i < nDps; i++) {
		tv.Config.dps[i][tvV+2] = 0;
		int cnt = tv.Config.dps[i][t];
		if (cnt >= tv.Config.d - rho) {
                    int N = tv.Config.N;
                    for (int j = 0; j < N; j++) {
			if (tv.Config.inTet(t,j)) {
			    boolean inIt = true;
                            for (int k = 0; k < tvV; k++) {
				if (tv.Config.dps[i][k] > 0 && !tv.Config.inTet(k,j)) {
				    inIt = false;
				}
			    }
                            if (inIt) {
				tv.Config.dps[i][tvV+2] = 1;
                                j = N;
			    }
			}
		    }
		}
	    }
	    tv.Config.drawIt();
	    Tetrahedron.reset();
            Face.reset();
            Edge.reset();    
            triggerit();
	}
    }

    void v() {
        int nDps = tv.TV.Config.nDps;
        int tvV = tv.TV.Config.V;
        for (int i = 0; i < nDps; i++) {
            if (count(i) == 1) {
		tv.Config.dps[i][tvV+2] = 1;
	    }
            else {
		tv.Config.dps[i][tvV+2] = 0;
	    }
	}
	tv.Config.drawIt();
    }

    void none() {
        int nDps = tv.TV.Config.nDps;
        int tvV = tv.TV.Config.V;
        for (int i = 0; i < nDps; i++) {
	    tv.Config.dps[i][tvV+2] = 0;
	}
	tv.Config.drawIt();
    }

    void e() {
        int nDps = tv.TV.Config.nDps;
        int tvV = tv.TV.Config.V;
        for (int i = 0; i < nDps; i++) {
            int c = count(i);
            if ((!interior && c <= 2) || (interior && c == 2)) {
		tv.Config.dps[i][tvV+2] = 1;
	    }
            else {
		tv.Config.dps[i][tvV+2] = 0;
	    }
	}
	tv.Config.drawIt();
    }

    void f() {
        int nDps = tv.TV.Config.nDps;
        int tvV = tv.TV.Config.V;
        for (int i = 0; i < nDps; i++) {
            int c = count(i);
            if ((!interior && c <= 3) || (interior && c == 3)) {
		tv.Config.dps[i][tvV+2] = 1;
	    }
            else {
		tv.Config.dps[i][tvV+2] = 0;
	    }
	}
	tv.Config.drawIt();
    }

    int count(int i) {
	int result = 0;
        int vs = tv.Config.V;
        for (int j = 0; j < vs; j++) {
	    if (tv.Config.dps[i][j] > 0 ) {
		result++;
	    }
	}
        return result;
    }

    void all () {
        int nDps = tv.TV.Config.nDps;
        int tvV = tv.TV.Config.V;
        boolean missing = false;
        for (int i = 0; i < nDps; i++) {
            if (tv.Config.dps[i][tvV+2] != 1) {
		missing = true;
	    }
	    tv.Config.dps[i][tvV+2] = 1;
	}
        if (missing) {
	    tv.Config.drawIt();
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

    void clear() {
        Tetrahedron.select(0);
        Tetrahedron.trigger = true;
        Face.select(0);
        Face.trigger = true;
        Edge.select(0);
        Edge.trigger = true;
        Vertex.select(0);
        Vertex.trigger = true;
        AndOr.select(0);
        v0.select(0);
        v1.select(0);
        v2.select(0);
        v3.select(0);
        v4.select(0);
        v5.select(0);
        relation.select(0);
        sum.select(d);
        V0.select(0);
        V1.select(0);
        V2.select(0);
        V3.select(0);
        V4.select(0);
        V5.select(0);
        Relation.select(0);
        Sum.select(d);
        AV0.select(0);
        AV1.select(0);
        AV2.select(0);
        AV3.select(0);
        AV4.select(0);
        AV5.select(0);
        ARelation.select(0);
        ASum.select(d);
        BV0.select(0);
        BV1.select(0);
        BV2.select(0);
        BV3.select(0);
        BV4.select(0);
        BV5.select(0);
        BRelation.select(0);
        BSum.select(d);
    }
}
