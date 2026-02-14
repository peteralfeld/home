import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class star extends Frame 
    implements ActionListener, ItemListener, Serializable {
    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);
    TextField Status;

    Panel Panel0;

    Button Hide;

    choice Face, Edge, Vertex;

    int[] faces, edges, vertices;


    public star() {

	Panel0= new Panel();
        String banner = "Star Panel";
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0.add(Banner);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        Panel0.add(Hide);

        Color choices = new Color(100,150,255);

        Label lbl2 = new Label("Face:");
        lbl2.setForeground(fg);
        lbl2.setBackground(bg);
        Panel0.add(lbl2);
	Face = new choice(); 
        Face.setBackground(choices);
        Face.addItem("");
        int T = tv.Config.T;
        int N = 0;
        int M = tv.Config.V;
        boolean[] K = new boolean[T];
        for (int i = 0; i < T; i++) {
            int i0 = tv.Config.faces[i][0];
            int i1 = tv.Config.faces[i][1];
            int i2 = tv.Config.faces[i][2];
            int k = tv.Config.tets(i0,i1,i2);
            if (k > 1 && k < tv.Config.N) {
                K[i] = true;
		N++;
	    }
	}
	faces = new int[N];
        int[] tsize = new int[N];
        int n = 0;	
        for (int k = 0; k < T; k++) {
	    if (K[k]) {
	    faces[n] = k;
            tsize[n] = ((tv.Config.faces[k][0]*M + tv.Config.faces[k][1])*M +
			tv.Config.faces[k][2]);
	    n++;
	    }
	}
        boolean sorted = false;
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
        for (int j =0; j < N; j++) {
            int i = faces[j];
            String v0 = tv.Config.nameV(tv.Config.faces[i][0]);
            String v1 = tv.Config.nameV(tv.Config.faces[i][1]);
            String v2 = tv.Config.nameV(tv.Config.faces[i][2]);
            String s = v0+"-"+v1+"-"+v2;
	    //            String s = tv.Config.faces[i][0]+"-"+tv.Config.faces[i][1]+"-"+tv.Config.faces[i][2];
            Face.addItem(s);
	}
        Face.addItemListener(this);
        Face.select(0);
        Panel0.add(Face);

        Label lbl3 = new Label("Edge:");
        lbl3.setForeground(fg);
        lbl3.setBackground(bg);
        Panel0.add(lbl3);
	Edge = new choice(); 
        Edge.setBackground(choices);
        Edge.addItem("");
        int E = tv.Config.E;
        N = 0;
        M = tv.Config.V;
        K = new boolean[T];
        for (int i = 0; i < E; i++) {
            int i0 = tv.Config.edges[i][0];
            int i1 = tv.Config.edges[i][1];
            int k = tv.Config.tets(i0,i1);
            if (k > 1 && k < tv.Config.N) {
                K[i] = true;
		N++;
	    }
	}
	edges = new int[N];
        tsize = new int[N];
        n = 0;	
        for (int k = 0; k < T; k++) {
	    if (K[k]) {
	    edges[n] = k;
            tsize[n] = (tv.Config.edges[k][0]*M + tv.Config.edges[k][1]);
	    n++;
	    }
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
        for (int j =0; j < N; j++) {
            int i = edges[j];
            String v0 = tv.Config.nameV(tv.Config.edges[i][0]);
            String v1 = tv.Config.nameV(tv.Config.edges[i][1]);
            String s = v0+"-"+v1;
	    //            String s = tv.Config.edges[i][0]+"-"+tv.Config.edges[i][1];
            Edge.addItem(s);
	}
        Edge.addItemListener(this);
        Edge.select(0);
        Panel0.add(Edge);

        Label lbl4 = new Label("Vertex:");
        lbl4.setForeground(fg);
        lbl4.setBackground(bg);
        Panel0.add(lbl4);
	Vertex = new choice(); 
        Vertex.setBackground(choices);
        Vertex.addItem("");
        N = 0;
        M = tv.Config.V;
        K = new boolean[M];
        for (int i = 0; i < M; i++) {
            int k = tv.Config.tets(i);
            if (k > 1 && k < tv.Config.N) {
                K[i] = true;
		N++;
	    }
	}
	vertices = new int[N];
        n = 0;	
        for (int k = 0; k < M; k++) {
	    if (K[k]) {
	    vertices[n] = k;
            Vertex.addItem(""+tv.Config.nameV(k));
	    n++;
	    }
	}
        Vertex.addItemListener(this);
        Vertex.select(0);
        Panel0.add(Vertex);

        setLayout(new GridLayout(1,1));
        add(Panel0);
        setBackground(new Color(255,255,210));
        setSize(600,80);
        setTitle("Star Panel");
        setVisible(false);

    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
	tv.TV.Config.addEvent(E,28);
    }

    void wait(int n) {
        try {
	    Thread.sleep(n);
	}
        catch (java.lang.InterruptedException e) {;}
    }

    public void ItemStateChanged(java.awt.event.ItemEvent E) {
	Object arg = E.getSource();
	if (arg.equals(Face)) {
	    tv.Config.faceStar(faces[Face.getSelectedIndex()-1]);
	}
	else if (arg.equals(Edge)) {
	    tv.Config.edgeStar(edges[Edge.getSelectedIndex()-1]);
	}
	else if (arg.equals(Vertex)) {
	    tv.Config.vertexStar(vertices[Vertex.getSelectedIndex()-1]);
	}
	tv.configuration.select(0);
        setVisible(false);
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Hide)) {
	    setVisible(false);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent Event) {
	Object arg = Event.getSource();
    }

    public void debug(String s) {
        System.out.println(s);
    }

}
