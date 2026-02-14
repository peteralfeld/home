import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class appearance extends Frame 
    implements ActionListener, Serializable {
    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);
    TextField Status;

    Panel Panel0, Panel1, Panel2, Panel3;

    Button Hide, Default, Minus, minus, Plus, plus;

    TextField aValue;
 
    static final int aDefault =  255;
    static final int transparentDefault = 100;

    int aCurrent;

    public appearance() {

	Panel0= new Panel();
        String banner = "Transparency";
        Label Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0.add(Banner);

        Hide = new Button("Hide");
        Hide.setBackground(Color.red);
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
	Panel0.add(Hide);
        Default = new Button("Default");
        Default.setBackground(new Color(0,0,127));
        Default.setForeground(Color.white);
        Default.addActionListener(this); 
	Panel0.add(Default);
        Minus = new Button("<<");
        Minus.setBackground(buttonBackground);
        Minus.setForeground(buttonForeground);
        Minus.addActionListener(this); 
	Panel0.add(Minus);
        minus = new Button("<");
        minus.setBackground(buttonBackground);
        minus.setForeground(buttonForeground);
        minus.addActionListener(this); 
	Panel0.add(minus);
        aValue = new TextField(20);
        aValue.addActionListener(this); 
        aValue.setBackground(Color.white);
        aValue.setForeground(Color.black); // 
        aCurrent = tv.Config.Alpha;
        aValue.setText("" + aCurrent);
        Panel0.add (aValue);
        plus = new Button(">");
        plus.setBackground(buttonBackground);
        plus.setForeground(buttonForeground);
        plus.addActionListener(this); 
	Panel0.add(plus);
        Plus = new Button(">>");
        Plus.setBackground(buttonBackground);
        Plus.setForeground(buttonForeground);
        Plus.addActionListener(this); 
	Panel0.add(Plus);
        setLayout(new GridLayout(1,1));
        add(Panel0);
        setBackground(new Color(255,255,210));
        setSize(600,75);
        setTitle("Transparency Selection Panel");
        setVisible(false);
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
	Object arg = E.getSource();
        if (arg.equals(Hide)) {
	    setVisible(false);
	}
        else {
	    tv.Config.addEvent(E,27);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent Event) {
	Object arg = Event.getSource();
        int currentAlpha = tv.Config.Alpha;
        int currentValue = getInt(aValue, currentAlpha, 2, aDefault);
        if (arg.equals(Minus)) {
            currentValue = currentValue - 50;
            if (currentValue < 0) {
                currentValue = 0;
	    }
	}
        else if (arg.equals(minus)) {
	    currentValue = currentValue - 10;
            if (currentValue < 0) {
                currentValue = 0;
	    }
	}
        else if (arg.equals(aValue)) {
	    currentValue = getInt(aValue, currentValue, 0, aDefault);
	}
        else if (arg.equals(plus)) {
            if (currentValue < aDefault) {
		currentValue = currentValue + 10;
		if (currentValue > aDefault) {
		    currentValue = aDefault;
		}
	    }
	}
	else if (arg.equals(Plus)) {
	    currentValue = currentValue + 50;
	    if (currentValue > aDefault) {
		currentValue = aDefault;
	    }
	}
	else if (arg.equals(Default)) {
            if (currentValue !=aDefault) {
		currentValue = aDefault;
	    }
            else {
		currentValue = transparentDefault;
	    }
	}
	aValue.setText(""+currentValue);
	if (currentValue != currentAlpha) {
	    config.Alpha = currentValue;
	    currentAlpha = currentValue;
	    tv.Config.coloring();
	    tv.Config.drawIt();
	}
    }


    double sqrt(double x) {
	return java.lang.Math.sqrt(x);
    }

    void write(String s) {
	System.out.println(s);
    }

    boolean isPrime (int n) {
	if (n == 2 || n == 3 || n == 5 || n == 7) {
	    return true;
	}
	else if (n < 2) {
	    return false;
	}
	else if (n %2 == 0) {
	    return false;
	}
	else {
	    boolean isprime = true;
	    int m = (int) sqrt((double) n);
	    for (int i = 3; i <= m; i = i+2) {
		if (n % i == 0) {
		    isprime = false;
		    i = m;
		}
	    }
	    return isprime;
	}
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
