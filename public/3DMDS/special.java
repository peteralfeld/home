import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class special extends Frame 
    implements ActionListener, ItemListener, Serializable {
    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);
    TextField Status;

    String blank = "---";

    Panel Panel0, Panel1, Panel2, Panel3;

    choice Face;
 
    Button undoSpecial, clearSpecial, listSpecial, Hide;

    Button Left, Right;

    Label banner,v0,v4;

    TextField tv1, tv2, tv3;
 
    Label tv0, tv4;

    Button v1minus, v1plus, v2minus, v2plus, v3minus, v3plus;

    int r, d, nDps;

    int[] faces, tsize;

    int i0,i1,i2,i3,i4, j1,j2,j3,j4;

    public special() {

	r = tv.TV.r; 
	d = tv.TV.d; 
        int M = tv.Config.V;

        Color outer = new Color(255,255,100);
        Color inner = new Color(200,255,255);
        Color text = new Color(200,0,0);

	Panel0= new Panel();
        String banner = "Special Conditions";
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0.add(Banner);

        undoSpecial = new Button("undo Special");
        undoSpecial.setBackground(Color.blue);
        undoSpecial.setForeground(Color.white);
        undoSpecial.addActionListener(this); 
	Panel0.add(undoSpecial);

        clearSpecial = new Button("clear Special");
        clearSpecial.setBackground(Color.blue);
        clearSpecial.setForeground(Color.white);
        clearSpecial.addActionListener(this); 
	Panel0.add(clearSpecial);

        listSpecial = new Button("list Special");
        listSpecial.setBackground(Color.blue);
        listSpecial.setForeground(Color.white);
        listSpecial.addActionListener(this); 
	Panel0.add(listSpecial);

        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        Panel0.add(Hide);

        Panel1 = new Panel();

        v0 = new Label(blank);
        v0.setForeground(fg);
        v0.setBackground(bg);
        Panel1.add (v0);

        Left = new Button("Impose");
        Left.setBackground(new Color(100,0,0));
        Left.setForeground(Color.white);
        Left.addActionListener(this); 
        Panel1.add(Left);

	Face = new choice(); 
        Face.addItem("Face");
        int N = tv.Config.TI;
	faces = new int[N];
        tsize = new int[N];
        for (int i = 0; i < N; i++) {
	    faces[i] = i;
            tsize[i] = ((tv.Config.faces[i][0]*M + tv.Config.faces[i][1])*M +
			tv.Config.faces[i][2]);
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
        for (int j =0; j < tv.Config.TI; j++) {
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

        Right = new Button("Impose");
        Right.setBackground(new Color(100,0,0));
        Right.setForeground(Color.white);
        Right.addActionListener(this); 
        Panel1.add(Right);
        v4 = new Label(blank);
        v4.setForeground(fg);
        v4.setBackground(bg);
        Panel1.add (v4);

        Panel2 = new Panel();
        tv0 = new Label(blank);
        tv0.setBackground(outer);
        tv0.setForeground(text);
        Panel2.add (tv0);
        v1minus = new Button("<");
        v1minus.setBackground(buttonBackground);
        v1minus.setForeground(buttonForeground);
        v1minus.addActionListener(this); 
	Panel2.add(v1minus);
        tv1 = new TextField(blank);
        tv1.addActionListener(this); 
        tv1.setBackground(inner);
        tv1.setForeground(text);
        Panel2.add (tv1);
        v1plus = new Button(">");
        v1plus.setBackground(buttonBackground);
        v1plus.setForeground(buttonForeground);
        v1plus.addActionListener(this); 
	Panel2.add(v1plus);
        v2minus = new Button("<");
        v2minus.setBackground(buttonBackground);
        v2minus.setForeground(buttonForeground);
        v2minus.addActionListener(this); 
	Panel2.add(v2minus);
        tv2 = new TextField(blank);
        tv2.addActionListener(this); 
        tv2.setBackground(inner);
        tv2.setForeground(text);
        Panel2.add (tv2);
        v2plus = new Button(">");
        v2plus.setBackground(buttonBackground);
        v2plus.setForeground(buttonForeground);
        v2plus.addActionListener(this); 
	Panel2.add(v2plus);
        v3minus = new Button("<");
        v3minus.setBackground(buttonBackground);
        v3minus.setForeground(buttonForeground);
        v3minus.addActionListener(this); 
	Panel2.add(v3minus);
        tv3 = new TextField(blank);
        tv3.addActionListener(this); 
        tv3.setBackground(inner);
        tv3.setForeground(text);
        Panel2.add (tv3);
        v3plus = new Button(">");
        v3plus.setBackground(buttonBackground);
        v3plus.setForeground(buttonForeground);
        v3plus.addActionListener(this); 
	Panel2.add(v3plus);
        tv4 = new Label(blank);
        tv4.setBackground(outer);
        tv4.setForeground(text);
        Panel2.add (tv4);

        setLayout(new GridLayout(3,1));
        add(Panel0);
        add(Panel1);
        add(Panel2);
        setBackground(new Color(255,255,210));
        setSize(600,150);
        setTitle("Selection Panel");
        setVisible(false);

    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
	tv.TV.Config.addEvent(E,25);
    }

    public void ItemStateChanged(java.awt.event.ItemEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Face)) {
	    int face = Face.getSelectedIndex()-1;
            if (face == -1) {
		v0.setText(blank);
		v4.setText(blank);
		tv0.setText(blank);
		tv1.setText(blank);
		tv2.setText(blank);
		tv3.setText(blank);
		tv4.setText(blank);
	    }
	    else {
                int fac = faces[face];
                i0 = tv.Config.faces[fac][3];
                i1 = tv.Config.faces[fac][0];
                i2 = tv.Config.faces[fac][1];
                i3 = tv.Config.faces[fac][2];
                i4 = tv.Config.faces[fac][4];
                j4 = d - j1 - j2 - j3;
                v0.setText(" " + tv.Config.nameV(i0));
                v4.setText(" " + tv.Config.nameV(i4));
                tv0.setText(" " + j4);
                tv1.setText(" " + j1);
                tv2.setText(" " + j2);
                tv3.setText(" " + j3);
                tv4.setText(" " + j4);
	    }
	}
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Hide)) {
	    setVisible(false);
	}
        else {
	    tv.TV.Config.addEvent(E,24);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent Event) {
	Object arg = Event.getSource();
        if (arg.equals(undoSpecial)) {
            if (tv.Config.nSpecial > 0) {
                tv.Config.decSpecial();
	    }
	}
        else if (arg.equals(listSpecial)) {
	    tv.Config.listSpecial();
	}
        else if (arg.equals(clearSpecial)) {
	    tv.Config.clearSpecial();
	}
	else if (arg.equals(v1minus)) {
	    if (j1 > 0) {
		j1--;
                j4++;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
                tv1.setText(" " + j1);
	    }
	}
        else if (arg.equals(v1plus)) {
	    if (j4 > 0) {
		j1++;
                j4--;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
                tv1.setText(" " + j1);
	    }
	}
        else if (arg.equals(tv1)) {
            int j1old = j1;
            j1 = getInt(tv1,j1,0,d-j2-j3);
	    if (j1 != j1old) {
                j4 = d-j1-j2-j3;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
	    }
	}
	else if (arg.equals(v2minus)) {
	    if (j2 > 0) {
		j2--;
                j4++;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
                tv2.setText(" " + j2);
	    }
	}
        else if (arg.equals(v2plus)) {
	    if (j4 > 0) {
		j2++;
                j4--;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
                tv2.setText(" " + j2);
	    }
	}
        else if (arg.equals(tv2)) {
            int j2old = j2;
            j2 = getInt(tv2,j2,0,d-j1-j3);
	    if (j2 != j2old) {
                j4 = d-j1-j2-j3;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
	    }
	}
	else if (arg.equals(v3minus)) {
	    if (j3 > 0) {
		j3--;
                j4++;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
                tv3.setText(" " + j3);
	    }
	}
        else if (arg.equals(v3plus)) {
	    if (j4 > 0) {
		j3++;
                j4--;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
                tv3.setText(" " + j3);
	    }
	}
        else if (arg.equals(tv3)) {
            int j3old = j3;
            j3 = getInt(tv3,j3,0,d-j1-j2);
	    if (j3 != j3old) {
                j4 = d-j1-j2-j3;
                tv0.setText(" " + j4);
                tv4.setText(" " + j4);
	    }
	}
        else if (arg.equals(Left) && j4 > r) { 
            tv.Config.checkSpecial();
	    int face = Face.getSelectedIndex()-1;
            face = faces[face];
            int w = tv.Config.identify(i0,j4,i1,j1,i2,j2,i3,j3);
	    tv.Config.SpecialPresent = true;
	    tv.Config.specialConds[tv.Config.nSpecial][0] = face;
	    tv.Config.specialConds[tv.Config.nSpecial][1] = w;
	    tv.Config.drawSpecial(tv.Config.nSpecial);
	    tv.Config.nSpecial++;
	    if (tv.Config.activateSpecial(tv.Config.nSpecial - 1)) {
		tv.Config.drawIt();
	    }
	    tv.Config.indicateSpecial();
	}
        else if (arg.equals(Right) && j4 > r) { 
            tv.Config.checkSpecial();
	    int face = Face.getSelectedIndex()-1;
            face = faces[face];
            int w = tv.Config.identify(i1,j1,i2,j2,i3,j3,i4,j4);
	    tv.Config.SpecialPresent = true;
	    tv.Config.specialConds[tv.Config.nSpecial][0] = face;
	    tv.Config.specialConds[tv.Config.nSpecial][1] = w;
	    tv.Config.drawSpecial(tv.Config.nSpecial);
	    tv.Config.nSpecial++;
	    if (tv.Config.activateSpecial(tv.Config.nSpecial - 1)) {
		tv.Config.drawIt();
	    }
	    tv.Config.indicateSpecial();
	}
    }

    void write(String s) {
	    System.out.println(s);
    }

    void debug(String s) {write(s);}
 
    public int getInt(TextField where, int dflt, int low, int high) {
	int result;
	try{ result = Integer.parseInt(where.getText().trim()); }
	catch (NumberFormatException e) { result = dflt; write("did not parse "+where.getText()); };
	if (result < low) result = low;
	if (result > high) result = high;
	where.setText(String.valueOf(result));
	return result;
    }

    

}
