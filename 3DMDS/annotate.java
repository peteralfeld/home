import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class annotate extends Frame 
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


    int cI = 10;

    Label swatch;

    Panel P0, P1, P2, P3;

    Button Quit, Hide, DoIt, Erase, ps;
    Button xminus, yminus, xplus, yplus;
    Button Rminus, Gminus, Bminus, Rplus, Gplus, Bplus;
    TextField tx, ty, tR, tG, tB, tText;       
    Choice theFont, Style, Size;
    int x = 100;
    int xinc = 20;
    int yinc = 30;
    int y = 100;
    int R = 0, G = 0, B = 0;

    int oldx = x, oldy = y;
    boolean indicated = false;

    Color cText = new Color(R,G,B);

    public annotate() {

	P0= new Panel();
        String banner = "Annotation Panel";
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

        DoIt = new Button("Draw Text");
        DoIt.setBackground(new Color(0,100,0));
        DoIt.setForeground(Color.white);
        DoIt.addActionListener(this); 
        P0.add(DoIt);

        Erase = new Button("Erase Text");
        Erase.setBackground(new Color(0,100,0));
        Erase.setForeground(Color.white);
        Erase.addActionListener(this); 
        P0.add(Erase);

        ps = new Button("add ps");
        ps.setBackground(new Color(0,100,0));
        ps.setForeground(Color.white);
        ps.addActionListener(this); 
        P0.add(ps);

        P1 = new Panel();

        P1.add(new Label("Location   x:"));

        xminus = new Button("<");
        xminus.setBackground(buttonBackground);
        xminus.setForeground(buttonForeground);
        xminus.addActionListener(this); 
	P1.add(xminus);

        tx = new TextField(5);
        tx.setBackground(textBackground);        
        tx.setForeground(textForeground);        
        tx.setText(" "+x);
        tx.addActionListener(this); 
        P1.add(tx);

        xplus = new Button(">");
        xplus.setBackground(buttonBackground);
        xplus.setForeground(buttonForeground);
        xplus.addActionListener(this); 
	P1.add(xplus);

        P1.add(new Label(" y:"));
        yminus = new Button("<");
        yminus.setBackground(buttonBackground);
        yminus.setForeground(buttonForeground);
        yminus.addActionListener(this); 
	P1.add(yminus);

        ty = new TextField(5);
        ty.setBackground(textBackground);        
        ty.setForeground(textForeground);        
        ty.setText(" "+y);
        ty.addActionListener(this); 
        P1.add(ty);

        yplus = new Button(">");
        yplus.setBackground(buttonBackground);
        yplus.setForeground(buttonForeground);
        yplus.addActionListener(this); 
	P1.add(yplus);

        P1.add(new Label(" Font:"));

        theFont = new Choice();
        theFont.add("Helvetica");
        theFont.add("Times");
        theFont.add("Ariel");
        theFont.add("Serif");
        P1.add(theFont);

        P1.add(new Label(" Style:"));

        Style = new Choice();
        Style.add("plain");
        Style.add("italic");
        Style.add("bold");
        P1.add(Style);

        P1.add(new Label(" Size:"));

        Size = new Choice();
        Size.add("8");
        Size.add("10");
        Size.add("12");
        Size.add("16");
        Size.add("20");
        Size.add("24");
        Size.add("30");
        Size.add("36");
        Size.select(4);
        P1.add(Size);

        P2 = new Panel();

        P2.add(new Label(" Color     R:"));

        Rminus = new Button("<");
        Rminus.setBackground(buttonBackground);
        Rminus.setForeground(buttonForeground);
        Rminus.addActionListener(this); 
	P2.add(Rminus);

        tR = new TextField(5);
        tR.setBackground(textBackground);        
        tR.setForeground(textForeground);        
        tR.setText(" "+R);
        tR.addActionListener(this); 
        P2.add(tR);

        Rplus = new Button(">");
        Rplus.setBackground(buttonBackground);
        Rplus.setForeground(buttonForeground);
        Rplus.addActionListener(this); 
	P2.add(Rplus);

        P2.add(new Label("G:"));

        Gminus = new Button("<");
        Gminus.setBackground(buttonBackground);
        Gminus.setForeground(buttonForeground);
        Gminus.addActionListener(this); 
	P2.add(Gminus);

        tG = new TextField(5);
        tG.setBackground(textBackground);        
        tG.setForeground(textForeground);        
        tG.setText(" "+G);
        tG.addActionListener(this); 
        P2.add(tG);

        Gplus = new Button(">");
        Gplus.setBackground(buttonBackground);
        Gplus.setForeground(buttonForeground);
        Gplus.addActionListener(this); 
	P2.add(Gplus);

        P2.add(new Label("B:"));

        Bminus = new Button("<");
        Bminus.setBackground(buttonBackground);
        Bminus.setForeground(buttonForeground);
        Bminus.addActionListener(this); 
	P2.add(Bminus);

        tB = new TextField(5);
        tB.setBackground(textBackground);        
        tB.setForeground(textForeground);        
        tB.setText(" "+B);
        tB.addActionListener(this); 
        P2.add(tB);

        Bplus = new Button(">");
        Bplus.setBackground(buttonBackground);
        Bplus.setForeground(buttonForeground);
        Bplus.addActionListener(this); 
	P2.add(Bplus);

        swatch = new Label("this Color");
        swatch.setBackground(Color.white);
        swatch.setForeground(cText);              
        P2.add(swatch);

        P3 = new Panel();
        P3.add(new Label("Text: "));
        tText = new TextField(60);
        tText.setBackground(Color.white);
        P3.add(tText);

        setLayout(new GridLayout(4,1));
        add(P0);
        add(P1);
        add(P2);
        add(P3);
        setBackground(new Color(255,255,210));
	setSize(750,190);
        setTitle("Annotation Panel");
        setVisible(false);
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
        Object arg = E.getSource();
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        boolean action = false;
        if (arg.equals(Quit)) {
	    tv.TV.stop();
	}
	else if (arg.equals(Hide)) {
	    setVisible(false);
            tv.ANNOTATE = null;
	}
        else if (arg.equals(DoIt)) {
            doit();
	}
        else if (arg.equals(Erase)) {
            tv.Config.drawIt();
	}
        else if (arg.equals(ps)) {
            String s = "/"+theFont.getSelectedItem();
	    int i = Style.getSelectedIndex();
	    if (i == 1) {
		s = s + "-Italic";
	    }
	    else if (i == 2) {
		s = s + "-Bold";
	    }
	    s = s + " ff ";
	    s = s + Integer.parseInt(Size.getSelectedItem()) + " scf sf ";
	    float[] rgb = new float[3];
	    (new Color(R,G,B)).getColorComponents(rgb);
	    s = s +  tv.Config.ps(rgb[0]) + " " + tv.Config.ps(rgb[1]) + " " + tv.Config.ps(rgb[2]) + " sc ";
	    s = s + tv.Config.ps(tv.Config.psx(x)) + " " + tv.Config.ps(tv.Config.psy(y)) + " M ";
	    s = s+"("+tText.getText()+") show ";
	    tv.Config.addPs(s);
    }
        else if (arg.equals(xminus)) {
            x = getInt(tx, x, 0, tv.Config.getSize().width);
            if (x >= xinc) {
		x -= xinc;
                tx.setText(""+x);
	    }
	}
	else if (arg.equals(tx)) {
            x = getInt(tx, x, 0, tv.Config.getSize().width);
	    tx.setText(""+x);
            action = true;
	}
        else if (arg.equals(xplus)) {
            x = getInt(tx, x, 0, tv.Config.getSize().width);
            if (x < tv.Config.getSize().width - xinc) {
		x += xinc;
	    }
            else { 
		x = tv.Config.getSize().width;
	    }
	    tx.setText(""+x);
            action = true;
	}
        else if (arg.equals(yminus)) {
            y = getInt(ty, y, 0, tv.Config.getSize().height);
            if (y >= xinc) {
		y -= yinc;
	    }
	    else {
		y = 0;
	    }
	    ty.setText(""+y);
            action = true;
	    
	}
	else if (arg.equals(ty)) {
            y = getInt(ty, y, 0, tv.Config.getSize().height);
	    ty.setText(""+y);
            action = true;
	}
        else if (arg.equals(yplus)) {
            y = getInt(ty, y, 0, tv.Config.getSize().height);
            if (y < tv.Config.getSize().height - yinc) {
		y += yinc;
	    }
	    else { 
		y = tv.Config.getSize().height;
	    }
	    ty.setText(""+y);
            action = true;
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
	    colorIt();
	}
	else if (arg.equals(tR)) {
            R = getInt(tR, R, 0, 255);
	    tR.setText(""+R);
	    colorIt();
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
	    colorIt();
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
	    colorIt();
	}
	else if (arg.equals(tG)) {
            G = getInt(tG, G, 0, 255);
	    tG.setText(""+G);
	    colorIt();
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
	    colorIt();
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
	    colorIt();
	}
	else if (arg.equals(tB)) {
            B = getInt(tB, B, 0, 255);
	    tB.setText(""+B);
	    colorIt();
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
	    colorIt();
	}
        if (action) {
	    indicate();
	}
    }

    void indicate() {
	indicate(true);
    }

    void indicate(boolean shift) {
        int offset = 10;
	tv.Config.g.setXORMode(Color.gray); 
	if (indicated) {
	    tv.Config.g.fillOval(oldx,oldy-offset,offset,offset);
	}
        indicated = shift;
        if (shift) {
	    oldx = x;
	    oldy = y;
	    tv.Config.g.fillOval(oldx,oldy-offset,offset,offset);
	}
	tv.Config.g.setPaintMode(); 
    }

    void colorIt() {
        swatch.setForeground(new Color(R,G,B));
        swatch.setBackground(new Color(R,G,B));
    }

    void doit() {
        indicate(false);
        String f = theFont.getSelectedItem();
        int size = Integer.parseInt(Size.getSelectedItem());
        int i = Style.getSelectedIndex();
        int s = 0;
        if (i == 0) {
	    s = Font.PLAIN;
	}
        else if (i == 1) {
            s = Font.ITALIC;
	}
	else if (i == 2) {
	    s = Font.BOLD;
	}
        Font font = new Font(f,s,size);
        String text = tText.getText();
        write(text);
        Color c = tv.Config.g.getColor();
        Font old = tv.Config.getFont();
        tv.Config.g.setFont(font);
        tv.Config.oG.setFont(font);
        tv.Config.g.setColor(new Color(R,G,B));
        tv.Config.g.drawString(text, x, y);
        tv.Config.oG.setColor(new Color(R,G,B));
        tv.Config.oG.drawString(text, x, y);
        tv.Config.g.setFont(old);
	tv.Config.g.setColor(c);
        tv.Config.oG.setFont(old);
	tv.Config.oG.setColor(c);
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
