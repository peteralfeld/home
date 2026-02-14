import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class vNames extends Frame 
    implements ActionListener, ItemListener, Serializable {
    Color ButtonBackground = new Color(0,127,0);
    Color abB = new Color(127,0,0);
    Color ButtonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);
    Color choices = new Color(100,150,255);
    Color lbg = new Color(0,0,200);
    Color lfg = Color.white;
    Choice clrs;

    int cI = 10;

    int vtx = 0;

    Button vPlus, vMinus, Save, Restore, SetIt, Default, List, Hide, Quit;
    TextField tvtx, fileName, tvn;
    Panel P0, P1;
  
    int R = 0;
    int G = 0;
    int B = 127;

    Label swatch;

    Button Rminus, Gminus, Bminus, Rplus, Gplus, Bplus;
    TextField tR, tG, tB;
    Color cVtx = new Color(R,G,B);

    public vNames() {

	P0= new Panel();
        String banner = "vertex names";

        P0.add(new Label("vtx: "));

        vMinus = new Button("<");
        vMinus.setBackground(ButtonBackground);
        vMinus.setForeground(ButtonForeground);
        vMinus.addActionListener(this); 
	P0.add(vMinus);

        tvtx = new TextField(5);
        tvtx.setBackground(textBackground);        
        tvtx.setForeground(textForeground);        
        tvtx.setText(""+vtx);
        tvtx.addActionListener(this); 
        P0.add(tvtx);

        vPlus = new Button(">");
        vPlus.setBackground(ButtonBackground);
        vPlus.setForeground(ButtonForeground);
        vPlus.addActionListener(this); 
	P0.add(vPlus);

        P0.add(new Label(" name: "));
        tvn = new TextField(10);
        tvn.setBackground(textBackground);        
        tvn.setForeground(textForeground);        
        tvn.setText("0");
        tvn.addActionListener(this); 

        P0.add(tvn);

        P0.add(new Label(" file: "));

        fileName = new TextField(20);
        fileName.setBackground(textBackground);        
        fileName.setForeground(textForeground);        
        if (!tv.inApplet) {
	    fileName.setText(tv.fileName.getText()+".vs");
	    fileName.addActionListener(this); 
	    P0.add(fileName);
	}

        SetIt = new Button("SetIt");
        SetIt.setBackground(new Color(127,0,0));
        SetIt.setForeground(Color.white);
        SetIt.addActionListener(this); 
        P0.add(SetIt);

        Default = new Button("Default");
        Default.setBackground(new Color(127,0,0));
        Default.setForeground(Color.white);
        Default.addActionListener(this); 
        P0.add(Default);

        List = new Button("List");
        List.setBackground(new Color(127,0,0));
        List.setForeground(Color.white);
        List.addActionListener(this); 
        P0.add(List);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        P0.add(Hide);

        Quit = new Button("Quit");
        Quit.setBackground(Color.red);
        Quit.setForeground(Color.white);
        Quit.addActionListener(this); 
	P0.add(Quit);

	Save = new Button("Save");
	Save.setBackground(new Color(0,127,0));
	Save.setForeground(ButtonForeground);
	Save.addActionListener(this); 
        if (!tv.inApplet) {
	    P0.add(Save);
	}

	Restore = new Button("restore");
	Restore.setBackground(new Color(0,127,0));
	Restore.setForeground(ButtonForeground);
	Restore.addActionListener(this); 
        if (!tv.inApplet) {
	    P0.add(Restore);
	}

	P1 = new Panel();
        P1.add(new Label(" Color     r:"));
        clrs = new Choice();
        clrs.add("default");
        clrs.add("red");
        clrs.add("green");
        clrs.add("blue");
        clrs.add("cyan");
        clrs.add("magenta");
        clrs.add("yellow");
        clrs.add("black");
        clrs.add("gray");
        clrs.add("white");
        clrs.addItemListener(this);
        P1.add(clrs);

        Rminus = new Button("<");
        Rminus.setBackground(ButtonBackground);
        Rminus.setForeground(ButtonForeground);
        Rminus.addActionListener(this); 
	P1.add(Rminus);

        tR = new TextField(5);
        tR.setBackground(textBackground);        
        tR.setForeground(textForeground);        
        tR.setText(" "+R);
        tR.addActionListener(this); 
        P1.add(tR);

        Rplus = new Button(">");
        Rplus.setBackground(ButtonBackground);
        Rplus.setForeground(ButtonForeground);
        Rplus.addActionListener(this); 
	P1.add(Rplus);

        P1.add(new Label("g:"));

        Gminus = new Button("<");
        Gminus.setBackground(ButtonBackground);
        Gminus.setForeground(ButtonForeground);
        Gminus.addActionListener(this); 
	P1.add(Gminus);

        tG = new TextField(5);
        tG.setBackground(textBackground);        
        tG.setForeground(textForeground);        
        tG.setText(" "+G);
        tG.addActionListener(this); 
        P1.add(tG);

        Gplus = new Button(">");
        Gplus.setBackground(ButtonBackground);
        Gplus.setForeground(ButtonForeground);
        Gplus.addActionListener(this); 
	P1.add(Gplus);

        P1.add(new Label("b:"));

        Bminus = new Button("<");
        Bminus.setBackground(ButtonBackground);
        Bminus.setForeground(ButtonForeground);
        Bminus.addActionListener(this); 
	P1.add(Bminus);

        tB = new TextField(5);
        tB.setBackground(textBackground);        
        tB.setForeground(textForeground);        
        tB.setText(" "+B);
        tB.addActionListener(this); 
        P1.add(tB);

        Bplus = new Button(">");
        Bplus.setBackground(ButtonBackground);
        Bplus.setForeground(ButtonForeground);
        Bplus.addActionListener(this); 
	P1.add(Bplus);

        P1.add(new Label(" Color: "));
        swatch = new Label("this very Color");
        swatch.setBackground(new Color(R,G,B));
        swatch.setForeground(cVtx);              
        P1.add(swatch);

        setLayout(new GridLayout(2,1));
        add(P0);
        add(P1);
        setBackground(new Color(255,255,210));
	setSize(850,140);
        setTitle("vertex names panel");
        setVisible(false);
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
	Object arg = E.getSource();
        if (arg.equals(clrs)) {
            int c = clrs.getSelectedIndex();
            setC(c); 
	}
    }

    void setC(int c) {
        if (c == 0) {
	    R = 0; G = 0; B = 127; //default
	}
        else if (c == 1) {
            R = 180; G =0; B = 0; //red
	}
        else if (c == 2) {
            R = 0; G = 180; B = 0; // green
	}
        else if (c == 3) {
            R = 0; G = 0; B = 180; //blue
	}
        else if (c == 4) {
            R = 0; G = 127; B = 127; //cyan
	}
        else if (c == 5) {
            R = 127; G = 0; B = 127; //magenta
	}
        else if (c == 6) {
            R = 127; G = 127; B = 0; //yellow
	}
        else if (c == 7) {
            R = 0; G = 0; B = 0; //black
	}
        else if (c == 8) {
            R = 127; G = 127; B = 127; //gray
	}
        else if (c == 9) {
            R = 255; G = 255; B = 255; //white
	}
        tR.setText(""+R);
        tG.setText(""+G);
        tB.setText(""+B);
        ColorIt();
    }


    public void actionPerformed(java.awt.event.ActionEvent E) {
        int V = tv.Config.V;
	Object arg = E.getSource();
        if (arg.equals(vPlus)) {
	    if (vtx < V-1) {
		vtx++;
                tvtx.setText(""+vtx);
                tvn.setText(tv.Config.vN[vtx]);
	    }
	}
        else if (arg.equals(vMinus)) {
            if (vtx > 0) {
		vtx--;
		tvtx.setText(""+vtx);
                tvn.setText(tv.Config.vN[vtx]);
	    }
	}
        else if (arg.equals(tvtx)) {
            vtx = getInt(tvtx,vtx,0,V);
	    tvn.setText(tv.Config.vN[vtx]);
	}
        else if (arg.equals(Rminus)) {
            R = getInt(tR, R, 0, 255);
            if (R > cI-1) {
		R -= cI;
            }
	    else {
                R = 0;
	    }
	    tR.setText(""+R);
	    ColorIt();
	}
	else if (arg.equals(tR)) {
            R = getInt(tR, R, 0, 255);
	    tR.setText(""+R);
	    ColorIt();
	}
        else if (arg.equals(Rplus)) {
            R = getInt(tR, R, 0, 255);
            if (R < 255-cI) {
		R += cI;
	    }
	    else {
		R = 255;
	    }
	    tR.setText(""+R);
	    ColorIt();
	}
        else if (arg.equals(Gminus)) {
            G = getInt(tG, G, 0, 255);
            if (G > cI-1) {
		G -= cI;
            }
	    else {
                G = 0;
	    }
	    tG.setText(""+G);
	    ColorIt();
	}
	else if (arg.equals(tG)) {
            G = getInt(tG, G, 0, 255);
	    tG.setText(""+G);
	    ColorIt();
	}
        else if (arg.equals(Gplus)) {
            G = getInt(tG, G, 0, 255);
            if (G < 255-cI) {
		G += cI;
	    }
	    else {
		G = 255;
	    }
	    tG.setText(""+G);
	    ColorIt();
	}
        else if (arg.equals(Bminus)) {
            B = getInt(tB, B, 0, 255);
            if (B > cI-1) {
		B -= cI;
            }
	    else {
                B = 0;
	    }
	    tB.setText(""+B);
	    ColorIt();
	}
	else if (arg.equals(tB)) {
            B = getInt(tB, B, 0, 255);
	    tB.setText(""+B);
	    ColorIt();
	}
        else if (arg.equals(Bplus)) {
            B = getInt(tB, B, 0, 255);
            if (B < 255-cI) {
		B += cI;
	    }
	    else {
		B = 255;
	    }
	    tB.setText(""+B);
	    ColorIt();
	}
        else if (arg.equals(Quit)) {
	    tv.TV.stop();
	}
	else if (arg.equals(Hide)) {
	    setVisible(false);
            tv.VNAMES = null;
	}
	else if (arg.equals(List)) {
            tv.Config.listNames();
	}
        else if (arg.equals(tvn)) {
            tv.Config.vN[vtx] = tvn.getText().trim();
            tv.Config.vC[vtx] = new Color(R,G,B);
	}
        else if (arg.equals(SetIt)) {
            tv.Config.named = true;
            tv.Config.vN[vtx] = tvn.getText().trim();
            tv.Config.vC[vtx] = new Color(R,G,B);
            tv.Config.drawIt();
	}
        else if (arg.equals(Default)) {
            tv.Config.defaultVertexNames();
	}
        else if (arg.equals(Save)) {
            tv.Config.storeV();
	}
        else if (arg.equals(Restore)) {
            tv.Config.restoreV();
	}
    }

    void ColorIt() {
        swatch.setForeground(new Color(R,G,B));
        swatch.setBackground(new Color(R,G,B));
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

    void debug(String s) {
	write(s);
    }

    void write(String s) {
        System.out.println(s);
    }
}
