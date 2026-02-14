import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class gen extends Frame 
    implements ActionListener, ItemListener, Serializable {

    int N = 0;
    int V = 0;
    int[][] vtcs;
    int[][] tets;

    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);

    Button  Clear, Before, After, Init, Difference, Quit, Hide;
    Panel Panel0, Panel1;
    Panel Faces, Edges, Vertices, Control, Specials;
    Checkbox F012, F013, F023, F123, E01, E02, E03, E12, E13, E23, V0, V1, V2, V3;
    Choice examples;

    public gen() {

        String banner = "general assembly";
        write(banner);
        Label Banner = new Label ("General Assembly Control Panel ");
        Panel0 = new Panel();
        Panel0.add(Banner);

        Faces = new Panel();
	Faces.setLayout(new GridLayout(4,1));
        F012 = new Checkbox("F012");
        F012.addItemListener(this);
        Faces.add(F012);
        F013 = new Checkbox("F013");
	F013.addItemListener(this);
        Faces.add(F013);
        F023 = new Checkbox("F023");
	F023.addItemListener(this);
        Faces.add(F023);
        F123 = new Checkbox("F123");
	F123.addItemListener(this);
        Faces.add(F123);

        Edges = new Panel();
	Edges.setLayout(new GridLayout(6,1));
        E01 = new Checkbox("E01");
	E01.addItemListener(this);
        Edges.add(E01);
        E02 = new Checkbox("E02");
	E02.addItemListener(this);
        Edges.add(E02);
        E03 = new Checkbox("E03");
	E03.addItemListener(this);
        Edges.add(E03);
        E12 = new Checkbox("E12");
	E12.addItemListener(this);
        Edges.add(E12);
        E13 = new Checkbox("E13");
	E13.addItemListener(this);
        Edges.add(E13);
        E23 = new Checkbox("E23");
	E23.addItemListener(this);
        Edges.add(E23);

        Vertices = new Panel();
	Vertices.setLayout(new GridLayout(4,1));
        V0 = new Checkbox("V0");
	V0.addItemListener(this);
        Vertices.add(V0);
        V1 = new Checkbox("V1");
	V1.addItemListener(this);
        Vertices.add(V1);
        V2 = new Checkbox("V2");
	V2.addItemListener(this);
        Vertices.add(V2);
        V3 = new Checkbox("V3");
	V3.addItemListener(this);
        Vertices.add(V3);

	Control = new Panel();
	Control.setLayout(new GridLayout(4,1));
        Clear = new Button("Clear All");
        Clear.setBackground(new Color(127,0,0));
        Clear.setForeground(buttonForeground);
        Clear.addActionListener(this); 
	Control.add(Clear);
        Before = new Button("Before");
        Before.setBackground(buttonBackground);
        Before.setForeground(buttonForeground);
        Before.addActionListener(this); 
	Control.add(Before);
        After = new Button("After");
        After.setBackground(new Color(0,0,127));
        After.setForeground(buttonForeground);
        After.addActionListener(this); 
	Control.add(After);
        Difference = new Button("Difference");
        Difference.setBackground(new Color(255,0,0));
        Difference.setForeground(buttonForeground);
        Difference.addActionListener(this); 
	Control.add(Difference);

        Specials = new Panel();

	examples = new Choice();
        examples.add("assembly");
        examples.add("square torus");
        examples.add("generic square torus");
        examples.add("symmetric cave");
        examples.add("generic cave");
        examples.add("triangular torus");
        examples.add("generic triangular torus");
        examples.setBackground(Color.white);
        examples.setForeground(Color.red);
        examples.addItemListener(this);
        Specials.add(examples);

        Quit = new Button("Quit");
        Quit.setBackground(Color.red);
        Quit.setForeground(Color.white);
        Quit.addActionListener(this); 
	Specials.add(Quit);

        Hide = new Button("Hide");
        Hide.setBackground(Color.red);
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
	Specials.add(Hide);

        Init = new Button("Initialize");
        Init.setBackground(new Color(0,127,127));
        Init.setForeground(buttonForeground);
        Init.addActionListener(this); 
	Specials.add(Init);



        Panel1 = new Panel();
	Panel1.setLayout(new GridLayout(1,6));
        Panel1.add(Specials);
        Panel1.add(Faces);
        Panel1.add(Edges);
        Panel1.add(Vertices);
        Panel1.add(Control);

        setLayout(new GridLayout(1,1));

 	add(Panel1);
        setBackground(new Color(255,255,210));
        setSize(800,200);
        setTitle(banner);
        setVisible(false);
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
	Object arg = E.getSource();
        if (arg.equals(F012)) {
	    boolean state = F012.getState();
            E01.setState(state);
            E02.setState(state);
            E12.setState(state);
            V0.setState(state);
            V1.setState(state);
            V2.setState(state);
            examples.select(0);
	}
        else if (arg.equals(F013)) {
	    boolean state = F013.getState();
            E01.setState(state);
            E03.setState(state);
            E13.setState(state);
            V0.setState(state);
            V1.setState(state);
            V3.setState(state);
            examples.select(0);
	}
        else if (arg.equals(F023)) {
	    boolean state = F023.getState();
            E02.setState(state);
            E03.setState(state);
            E23.setState(state);
            V0.setState(state);
            V2.setState(state);
            V3.setState(state);
            examples.select(0);
	}
        else if (arg.equals(F123)) {
	    boolean state = F123.getState();
            E12.setState(state);
            E13.setState(state);
            E23.setState(state);
            V1.setState(state);
            V2.setState(state);
            V3.setState(state);
            examples.select(0);
	}
        else if (arg.equals(E01)) {
            boolean state = E01.getState();
            V0.setState(state);
            V1.setState(state);
            examples.select(0);
	}
        else if (arg.equals(E02)) {
            boolean state = E02.getState();
            V0.setState(state);
            V2.setState(state);
            examples.select(0);
	}
        else if (arg.equals(E03)) {
            boolean state = E03.getState();
            V0.setState(state);
            V3.setState(state);
            examples.select(0);
	}
        else if (arg.equals(E12)) {
            boolean state = E12.getState();
            V1.setState(state);
            examples.select(0);
            V2.setState(state);
	}
        else if (arg.equals(E13)) {
            boolean state = E13.getState();
            V1.setState(state);
            V3.setState(state);
            examples.select(0);
	}
        else if (arg.equals(E23)) {
            boolean state = E23.getState();
            V2.setState(state);
            V3.setState(state);
            examples.select(0);
	}
        else if (arg.equals(examples)) {
            int which = examples.getSelectedIndex();
            create(which);
	}
    }

    void create(int which) {
	if (which > 0) {
	    clear();
	    if (which == 1) {
		tv.Config.title = "square torus";
                V = 16;
                N = 24;
                vtcs = new int[V][3];
                tets = new int[N][4];
                int v = 0;
		vtcs[v][0] = -120; vtcs[v][1] = 120; vtcs[v][2] = 0; v++;
		vtcs[v][0] = -120; vtcs[v][1] = -120; vtcs[v][2] = 0; v++;
		vtcs[v][0] = 120; vtcs[v][1] = -120; vtcs[v][2] = 0; v++;
		vtcs[v][0] = 120; vtcs[v][1] = 120; vtcs[v][2] = 0; v++;
		vtcs[v][0] = -240; vtcs[v][1] = 240; vtcs[v][2] = 0; v++;
		vtcs[v][0] = -240; vtcs[v][1] = -240; vtcs[v][2] = 0; v++;
		vtcs[v][0] = 240; vtcs[v][1] = -240; vtcs[v][2] = 0; v++;
		vtcs[v][0] = 240; vtcs[v][1] = 240; vtcs[v][2] = 0; v++;
		vtcs[v][0] = -120; vtcs[v][1] = 120; vtcs[v][2] = 120; v++;
		vtcs[v][0] = -120; vtcs[v][1] = -120; vtcs[v][2] = 120; v++;
		vtcs[v][0] = 120; vtcs[v][1] = -120; vtcs[v][2] = 120; v++;
		vtcs[v][0] = 120; vtcs[v][1] = 120; vtcs[v][2] = 120; v++;
		vtcs[v][0] = -240; vtcs[v][1] = 240; vtcs[v][2] = 120; v++;
		vtcs[v][0] = -240; vtcs[v][1] = -240; vtcs[v][2] = 120; v++;
		vtcs[v][0] = 240; vtcs[v][1] = -240; vtcs[v][2] = 120; v++;
		vtcs[v][0] = 240; vtcs[v][1] = 240; vtcs[v][2] = 120; v++;
                int t = 0;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 3; tets[t][3] = 7; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 7; tets[t][3] = 4; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 4; tets[t][3] = 12; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 12; tets[t][3] = 8; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 8; tets[t][3] = 11; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 11; tets[t][3] = 3; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 0; tets[t][3] = 4; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 4; tets[t][3] = 5; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 5; tets[t][3] = 13; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 13; tets[t][3] = 9; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 9; tets[t][3] = 8; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 8; tets[t][3] = 0; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 1; tets[t][3] = 5; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 5; tets[t][3] = 6; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 6; tets[t][3] = 14; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 14; tets[t][3] = 10; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 10; tets[t][3] = 9; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 9; tets[t][3] = 1; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 2; tets[t][3] = 6; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 6; tets[t][3] = 7; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 7; tets[t][3] = 15; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 15; tets[t][3] = 11; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 11; tets[t][3] = 10; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 10; tets[t][3] = 2; t++;
	    }
	    else if (which == 2) {
		tv.Config.title = "generic torus";
                V = 16;
                N = 24;
                vtcs = new int[V][3];
                tets = new int[N][4];
                int v = 0;
		vtcs[v][0] = -125; vtcs[v][1] = 111; vtcs[v][2] = -5; v++;
		vtcs[v][0] = -128; vtcs[v][1] = -127; vtcs[v][2] = -2; v++;
		vtcs[v][0] = 116; vtcs[v][1] = -116; vtcs[v][2] = -9; v++;
		vtcs[v][0] = 125; vtcs[v][1] = 111; vtcs[v][2] = -9; v++;
		vtcs[v][0] = -234; vtcs[v][1] = 234; vtcs[v][2] = 7; v++;
		vtcs[v][0] = -233; vtcs[v][1] = -230; vtcs[v][2] = -2; v++;
		vtcs[v][0] = 232; vtcs[v][1] = -245; vtcs[v][2] = 2; v++;
		vtcs[v][0] = 238; vtcs[v][1] = 244; vtcs[v][2] = -5; v++;
		vtcs[v][0] = -120; vtcs[v][1] = 117; vtcs[v][2] = 110; v++;
		vtcs[v][0] = -120; vtcs[v][1] = -112; vtcs[v][2] = 110; v++;
		vtcs[v][0] = 123; vtcs[v][1] = -117; vtcs[v][2] = 118; v++;
		vtcs[v][0] = 119; vtcs[v][1] = 114; vtcs[v][2] = 124; v++;
		vtcs[v][0] = -236; vtcs[v][1] = 245; vtcs[v][2] = 117; v++;
		vtcs[v][0] = -244; vtcs[v][1] = -245; vtcs[v][2] = 128; v++;
		vtcs[v][0] = 248; vtcs[v][1] = -230; vtcs[v][2] = 126; v++;
		vtcs[v][0] = 246; vtcs[v][1] = 247; vtcs[v][2] = 116; v++;
                int t = 0;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 3; tets[t][3] = 7; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 7; tets[t][3] = 4; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 4; tets[t][3] = 12; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 12; tets[t][3] = 8; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 8; tets[t][3] = 11; t++;
		tets[t][0] = 0; tets[t][1] = 15; tets[t][2] = 11; tets[t][3] = 3; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 0; tets[t][3] = 4; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 4; tets[t][3] = 5; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 5; tets[t][3] = 13; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 13; tets[t][3] = 9; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 9; tets[t][3] = 8; t++;
		tets[t][0] = 1; tets[t][1] = 12; tets[t][2] = 8; tets[t][3] = 0; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 1; tets[t][3] = 5; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 5; tets[t][3] = 6; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 6; tets[t][3] = 14; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 14; tets[t][3] = 10; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 10; tets[t][3] = 9; t++;
		tets[t][0] = 2; tets[t][1] = 13; tets[t][2] = 9; tets[t][3] = 1; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 2; tets[t][3] = 6; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 6; tets[t][3] = 7; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 7; tets[t][3] = 15; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 15; tets[t][3] = 11; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 11; tets[t][3] = 10; t++;
		tets[t][0] = 3; tets[t][1] = 14; tets[t][2] = 10; tets[t][3] = 2; t++;
	    }
            else if (which == 3) {
		N = 14;
		V = 8;
		tv.Config.title = "symmetric cave";
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; tets[count][0] = 4; tets[count][1] = 5; tets[count][2] = 6; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 5; tets[count][2] = 2; tets[count][3] = 7;
		count++; tets[count][0] = 4; tets[count][1] = 1; tets[count][2] = 6; tets[count][3] = 7;
		count++; tets[count][0] = 0; tets[count][1] = 5; tets[count][2] = 6; tets[count][3] = 7;
		count++; tets[count][0] = 4; tets[count][1] = 5; tets[count][2] = 2; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 6; tets[count][2] = 1; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 7; tets[count][2] = 1; tets[count][3] = 2;
		count++; tets[count][0] = 5; tets[count][1] = 6; tets[count][2] = 0; tets[count][3] = 3;
		count++; tets[count][0] = 5; tets[count][1] = 7; tets[count][2] = 0; tets[count][3] = 2;
		count++; tets[count][0] = 6; tets[count][1] = 7; tets[count][2] = 0; tets[count][3] = 1;
		count++; tets[count][0] = 0; tets[count][1] = 1; tets[count][2] = 2; tets[count][3] = 7;
		count++; tets[count][0] = 0; tets[count][1] = 1; tets[count][2] = 6; tets[count][3] = 3;
		count++; tets[count][0] = 0; tets[count][1] = 5; tets[count][2] = 2; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 1; tets[count][2] = 2; tets[count][3] = 3;
		count = -1;
		count++; vtcs[count][0] = 14; vtcs[count][1] = 42; vtcs[count][2] = 42;
		count++; vtcs[count][0] = 14; vtcs[count][1] = 0; vtcs[count][2] = 42;
		count++; vtcs[count][0] = -14; vtcs[count][1] = 21; vtcs[count][2] = 21;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 21; vtcs[count][2] = 0;
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7;
		    vtcs[5][i] = (2*vtcs[0][i]+vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7;
		    vtcs[6][i] = (2*vtcs[0][i]+2*vtcs[1][i]+vtcs[2][i]+2*vtcs[3][i])/7;
		    vtcs[7][i] = (2*vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+vtcs[3][i])/7;
		}
	    }
	    else if (which == 4) {
		N = 14;
		V = 8;
		tv.Config.title = "generic cave";
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
		count++; tets[count][0] = 4; tets[count][1] = 5; tets[count][2] = 6; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 5; tets[count][2] = 2; tets[count][3] = 7;
		count++; tets[count][0] = 4; tets[count][1] = 1; tets[count][2] = 6; tets[count][3] = 7;
		count++; tets[count][0] = 0; tets[count][1] = 5; tets[count][2] = 6; tets[count][3] = 7;
		count++; tets[count][0] = 4; tets[count][1] = 5; tets[count][2] = 2; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 6; tets[count][2] = 1; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 7; tets[count][2] = 1; tets[count][3] = 2;
		count++; tets[count][0] = 5; tets[count][1] = 6; tets[count][2] = 0; tets[count][3] = 3;
		count++; tets[count][0] = 5; tets[count][1] = 7; tets[count][2] = 0; tets[count][3] = 2;
		count++; tets[count][0] = 6; tets[count][1] = 7; tets[count][2] = 0; tets[count][3] = 1;
		count++; tets[count][0] = 0; tets[count][1] = 1; tets[count][2] = 2; tets[count][3] = 7;
		count++; tets[count][0] = 0; tets[count][1] = 1; tets[count][2] = 6; tets[count][3] = 3;
		count++; tets[count][0] = 0; tets[count][1] = 5; tets[count][2] = 2; tets[count][3] = 3;
		count++; tets[count][0] = 4; tets[count][1] = 1; tets[count][2] = 2; tets[count][3] = 3;
		count = -1;
		count++; vtcs[count][0] = 140; vtcs[count][1] = 420; vtcs[count][2] = 420;
		count++; vtcs[count][0] = 140; vtcs[count][1] = 0; vtcs[count][2] = 420;
		count++; vtcs[count][0] = -140; vtcs[count][1] = 210; vtcs[count][2] = 210;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 21; vtcs[count][2] = 0;
		for (int i = 0; i < 3; i++) {
		    vtcs[4][i] = (vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7+i;
		    vtcs[5][i] = (2*vtcs[0][i]+vtcs[1][i]+2*vtcs[2][i]+2*vtcs[3][i])/7-i;
		    vtcs[6][i] = (2*vtcs[0][i]+2*vtcs[1][i]+vtcs[2][i]+2*vtcs[3][i])/7+i*i;
		    vtcs[7][i] = (2*vtcs[0][i]+2*vtcs[1][i]+2*vtcs[2][i]+vtcs[3][i])/7-i-1;
		}
	    }
	    else if (which == 5) {
		N = 9;
		V = 9;
		tv.Config.title = "triangular torus";
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
                int i0 = 0; int i1 = 1; int i2 = 2; int i3 = 3; int i4 = 4; int i5 = 5;
                count++; tets[count][0] = i0;tets[count][1] = i1;tets[count][2] = i2;tets[count][3] = i3;
                count++; tets[count][0] = i1;tets[count][1] = i2;tets[count][2] = i3;tets[count][3] = i4;
                count++; tets[count][0] = i2;tets[count][1] = i3;tets[count][2] = i4;tets[count][3] = i5;
                i0 = 3; i1 = 4; i2 = 5; i3 = 6; i4 = 7; i5 = 8;
                count++; tets[count][0] = i0;tets[count][1] = i1;tets[count][2] = i2;tets[count][3] = i3;
                count++; tets[count][0] = i1;tets[count][1] = i2;tets[count][2] = i3;tets[count][3] = i4;
                count++; tets[count][0] = i2;tets[count][1] = i3;tets[count][2] = i4;tets[count][3] = i5;
                i0 = 6; i1 = 7; i2 = 8; i3 = 0; i4 = 1; i5 = 2;
                count++; tets[count][0] = i0;tets[count][1] = i1;tets[count][2] = i2;tets[count][3] = i3;
                count++; tets[count][0] = i1;tets[count][1] = i2;tets[count][2] = i3;tets[count][3] = i4;
                count++; tets[count][0] = i2;tets[count][1] = i3;tets[count][2] = i4;tets[count][3] = i5;
                count = -1;
		count++; vtcs[count][0] = -240; vtcs[count][1] = -240; vtcs[count][2] = 0;
		count++; vtcs[count][0] = -120; vtcs[count][1] = -120; vtcs[count][2] = 0;
		count++; vtcs[count][0] = -180; vtcs[count][1] = -180; vtcs[count][2] = 120;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 240; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 120; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 180; vtcs[count][2] = 120;
		count++; vtcs[count][0] = 240; vtcs[count][1] = -240; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 120; vtcs[count][1] = -120; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 180; vtcs[count][1] = -180; vtcs[count][2] = 120;
	    }
	    else if (which == 6) {
		N = 9;
		V = 9;
		tv.Config.title = "generic triangular torus";
		vtcs = new int[V][3];
		tets = new int[N][4];
		int count = -1;
                int i0 = 0; int i1 = 1; int i2 = 2; int i3 = 3; int i4 = 4; int i5 = 5;
                count++; tets[count][0] = i0;tets[count][1] = i1;tets[count][2] = i2;tets[count][3] = i3;
                count++; tets[count][0] = i1;tets[count][1] = i2;tets[count][2] = i3;tets[count][3] = i4;
                count++; tets[count][0] = i2;tets[count][1] = i3;tets[count][2] = i4;tets[count][3] = i5;
                i0 = 3; i1 = 4; i2 = 5; i3 = 6; i4 = 7; i5 = 8;
                count++; tets[count][0] = i0;tets[count][1] = i1;tets[count][2] = i2;tets[count][3] = i3;
                count++; tets[count][0] = i1;tets[count][1] = i2;tets[count][2] = i3;tets[count][3] = i4;
                count++; tets[count][0] = i2;tets[count][1] = i3;tets[count][2] = i4;tets[count][3] = i5;
                i0 = 6; i1 = 7; i2 = 8; i3 = 0; i4 = 1; i5 = 2;
                count++; tets[count][0] = i0;tets[count][1] = i1;tets[count][2] = i2;tets[count][3] = i3;
                count++; tets[count][0] = i1;tets[count][1] = i2;tets[count][2] = i3;tets[count][3] = i4;
                count++; tets[count][0] = i2;tets[count][1] = i3;tets[count][2] = i4;tets[count][3] = i5;
                count = -1;
		count++; vtcs[count][0] = -240; vtcs[count][1] = -240; vtcs[count][2] = 0;
		count++; vtcs[count][0] = -120; vtcs[count][1] = -120; vtcs[count][2] = 0;
		count++; vtcs[count][0] = -180; vtcs[count][1] = -180; vtcs[count][2] = 120;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 240; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 120; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 0; vtcs[count][1] = 180; vtcs[count][2] = 120;
		count++; vtcs[count][0] = 240; vtcs[count][1] = -240; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 120; vtcs[count][1] = -120; vtcs[count][2] = 0;
		count++; vtcs[count][0] = 180; vtcs[count][1] = -180; vtcs[count][2] = 120;
                for (int i = 0; i < 8; i++) {
		    for (int j = 0; j <3; j++) {
			vtcs[i][j] = vtcs[i][j] + j*8 + i;
		    }
		}
	    }
	    prepare();
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

    int det(int i0, int i1, int i2, int i3) {
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
        int result = x0*y1*z2-x0*y1*z3-x0*z1*y2+x0*z1*y3+x0*y2*z3-x0*y3*z2
	    -y0*x1*z2+y0*x1*z3+y0*z1*x2-y0*z1*x3-y0*x2*z3+y0*x3*z2
	    +z0*x1*y2-z0*x1*y3-z0*y1*x2+z0*y1*x3+z0*x2*y3-z0*x3*y2
	    -x1*y2*z3+x1*y3*z2+y1*x2*z3-y1*x3*z2-z1*x2*y3+z1*x3*y2;
        return result;
    }



    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Before)) {
	    doit(true);
            examples.select(0);
	}
        else if (arg.equals(After)) {
	    doit(false);
            examples.select(0);
	}
        else if (arg.equals(Init)) {
	    tv.Config.LAinit();
	}
        else if (arg.equals(Difference)) {
            examples.select(0);
            doit(true);
	    tv.Config.LAinit();
            int diff = tv.Config.dim;
            doit(false);
	    tv.Config.LAinit();
            diff = tv.Config.dim - diff;
            tv.Status.setText(" difference = " + diff);
	    write(" difference = " + diff);
	}
        else if(arg.equals(Clear)) {
            clear();
            examples.select(0);
	}
        else if(arg.equals(Quit)) {
            System.exit(0);
	}
        else if(arg.equals(Hide)) {
            setVisible(false);
	}
    }

    void clear() {
	F012.setState(false);
	F013.setState(false);
	F023.setState(false);
	F123.setState(false);
	E01.setState(false);
	E02.setState(false);
	E03.setState(false);
	E12.setState(false);
	E13.setState(false);
	E23.setState(false);
	V0.setState(false);
	V1.setState(false);
	V2.setState(false);
	V3.setState(false);
    }

    void doit(boolean pre) {
        write(" doing general assembly ");
        tv.Config.steps = null;
	facet F = new facet(0, 1, 2, 3);
        if (F012.getState()) {F.mark(0,1,2);}
        if (F013.getState()) {F.mark(0,1,3);}
        if (F023.getState()) {F.mark(0,2,3);}
        if (F123.getState()) {F.mark(1,2,3);}
        if (E01.getState()) {F.mark(0,1);}         
        if (E02.getState()) {F.mark(0,2);}         
        if (E03.getState()) {F.mark(0,3);}         
        if (E12.getState()) {F.mark(1,2);}         
        if (E13.getState()) {F.mark(1,3);}         
        if (E23.getState()) {F.mark(2,3);}         
        if (V0.getState()) {F.mark(0);}
        if (V1.getState()) {F.mark(1);}
        if (V2.getState()) {F.mark(2);}
        if (V3.getState()) {F.mark(3);} 
        F.unmark();
        N = 1;
        V = 4;
        for (int f = 0; f < 4; f++) {
            if (F.done[3][f] == 0) {
		N++;
		V++;
	    }
	}
        for (int f = 4; f < 10; f++) {
	    if (F.done[3][f] == 0) {
		N++;
		V += 2;
	    }
	}
        for (int f = 10; f < 14; f++) {
	    if (F.done[3][f] == 0) {
		N++;
		V+=3;
	    }
	}
        tets = new int[N][4];
        vtcs = new int[V][3];
        int n = -1;
        int v = 0;
        vtcs[v][0] = 0; vtcs[v][1] = 0; vtcs[v][2] = 12; v++;
        vtcs[v][0] = 0; vtcs[v][1] = 6; vtcs[v][2] = -8; v++;        
        vtcs[v][0] = 6; vtcs[v][1] = -6; vtcs[v][2] = -8; v++;        
        vtcs[v][0] = -6; vtcs[v][1] = -6; vtcs[v][2] = -8; v++;        
        for (int f = 0; f < 4; f++) {
	    if (F.done[3][f] == 0) {
		int i0 = F.done[0][f];
		int i1 = F.done[1][f];
		int i2 = F.done[2][f];
		n++;
		tets[n][0] = i0;
		tets[n][1] = i1;
		tets[n][2] = i2;
		tets[n][3] = v;
		for (int i = 0; i < 3; i++) {
		    vtcs[v][i] = (2*(vtcs[i0][i]+vtcs[i1][i]+vtcs[i2][i]))/3;
		}
		v++;
	    }
	}
	for (int f = 4; f < 10; f++) {
	    if (F.done[3][f] == 0) {
		int i0 = F.done[0][f];
		int i1 = F.done[1][f];
		int[] x = new int[3];
		int[] c = new int[3];
		int[] e = new int[3];
		for (int i = 0; i < 3; i++) {
		    x[i] = vtcs[i0][i]-vtcs[i1][i];
		    c[i] = (vtcs[i0][i]+vtcs[i1][i]);
		}
		e[0] = x[1]*c[2]-x[2]*c[1];
		e[1] = x[2]*c[0]-x[0]*c[2];
		e[2] = x[0]*c[1]-x[1]*c[0];
		double a = java.lang.Math.sqrt(c[0]*c[0]+c[1]*c[1]+c[2]*c[2]);
		double E = java.lang.Math.sqrt(e[0]*e[0]+e[1]*e[1]+e[2]*e[2]);
		for (int i = 0; i < 3; i++) {
		    e[i] = (int)((e[i]*a)/E)/2;
		    vtcs[v][i] = c[i]+e[i];
		    vtcs[v+1][i] = c[i]-e[i];
		}
		n++;
		tets[n][0] =i0;
		tets[n][1] =i1;
		tets[n][2] =v;
		tets[n][3] =v+1;;
		v += 2;
	    }
	}
	for (int f = 10; f < 14; f++) {
	    if (F.done[3][f] == 0) {
		int i0 = F.done[0][f];
		for (int k = 0; k < 4; k++) {
		    if (i0 != k) {
			for (int i = 0; i < 3; i++) {
			    vtcs[v][i] = vtcs[i0][i] - vtcs[k][i];
			}
			v++;
		    }
		}
                n++;
		tets[n][0] =i0;
		tets[n][1] =v-3;
		tets[n][2] =v-2;
		tets[n][3] =v-1;
	    }
	}
        if (!pre) {
	    n++;
	    for (int i = 0; i < 4; i++) {
		tets[n][i] = i;
	    }
	}
        else { // eliminate unneeded points, reduce # tets by 1
	    N--; 
            boolean[] need = new boolean[4];
            for (int i = 0; i < 4; i++) {need[i] = false;}
            for (int j = 0; j < N; j++) {
		for (int k = 0; k < 4; k++) {
		    if (tets[j][k] < 4) {
			need[tets[j][k]] = true;
		    }
		}
	    }
            boolean done = false;
            while (!done) {
		done = true;
                for (int i = 0; i < 4; i++) {
		    if (!need[i]) {
			done = false;
                        for (int j = 0; j < N; j++) {
			    for (int k = 0; k < 4; k++) {
				if (tets[j][k] > i) {
				    tets[j][k]--;
				}
			    }
			}
                        for (int j = i; j < V-1; j++) {
			    for (int k = 0; k < 3; k++) {
				vtcs[j][k] = vtcs[j+1][k];
			    }
			}
                        for (int j = i; j < 3; j++) {
			    need[j] = need[j+1];
			}
                        need[3] = true;
			V--;
		    }
		}
	    }
	}
        prepare();
    }

    void prepare() {
        tv.Config.innocent();
        tv.Config.general = true;
        tv.Config.loaded = true;
        tv.Config.N = N;
        tv.Config.V = V;
        tv.Config.vtcs = new int[V][3];
        tv.Config.tets = new int[N][4];
        for (int k = 0; k < N; k++) {
	    tv.Config.newTet(k,tets[k][0],tets[k][1],tets[k][2],tets[k][3]);
	}
        for (int k = 0; k < V; k++) {
	    tv.Config.newPoint(k,vtcs[k][0],vtcs[k][1],vtcs[k][2]);
	}
        tv.Config.title = " general assembly";
        tv.Config.prepare();
    }

    static public void write(String s) {
	tv.write(s);
    }

    static public void debug(String s) {
	tv.write(s);
    }
}
